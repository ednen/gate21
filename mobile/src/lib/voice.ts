import {
  AudioQuality,
  IOSOutputFormat,
  type RecordingOptions,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { apiUpload } from './api';
import { DEMO } from './demo/flag';
import type { Assessment, SceneView } from './types';

/**
 * 16 kHz mono, what Azure expects. iOS records WAV (linear PCM) directly. Android's recorder
 * cannot write WAV, so it records streamable AAC (ADTS) and the API converts it in memory.
 */
const OPTIONS: RecordingOptions = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  ios: {
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    extension: '.aac',
    sampleRate: 16000,
    outputFormat: 'aac_adts',
    audioEncoder: 'aac',
  },
  web: { mimeType: 'audio/webm' },
};

const MAX_SECONDS = 15;

/** {@code transcript}: in the browser demo, what the browser's own recognizer heard instead of audio. */
export type Recording = { uri: string; name: string; type: string; transcript?: string };

function fileFor(uri: string): Recording {
  if (Platform.OS === 'android') {
    return { uri, name: 'speech.aac', type: 'audio/aac' };
  }
  if (Platform.OS === 'web') {
    return { uri, name: 'speech.webm', type: 'audio/webm' };
  }
  return { uri, name: 'speech.wav', type: 'audio/wav' };
}

/** Tap once to start, tap again to stop. Stops by itself after 15 seconds. */
function useDeviceRecorder() {
  const recorder = useAudioRecorder(OPTIONS);
  const [recording, setRecording] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(async (): Promise<boolean> => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      return false;
    }
    await Speech.stop();
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
    timer.current = setTimeout(() => void recorder.stop(), MAX_SECONDS * 1000);
    return true;
  }, [recorder]);

  const stop = useCallback(async (): Promise<Recording | null> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await recorder.stop();
    setRecording(false);
    // Hand the audio session back to playback so the speaker is loud again on iOS.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    return recorder.uri ? fileFor(recorder.uri) : null;
  }, [recorder]);

  return { recording, start, stop };
}

// ---- browser demo: the browser's speech recognizer stands in for server-side transcription ----

type RecognitionResultList = ArrayLike<ArrayLike<{ transcript: string }>>;
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: { results: RecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (Platform.OS !== 'web') {
    return null;
  }
  const w = globalThis as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

async function microphoneAllowed(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

function useBrowserRecognizer() {
  const [recording, setRecording] = useState(false);
  const recognizer = useRef<Recognition | null>(null);
  const heard = useRef('');
  const ended = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(async (): Promise<boolean> => {
    const Ctor = recognitionCtor();
    if (!Ctor || !(await microphoneAllowed())) {
      return false;
    }
    await Speech.stop();
    const r = new Ctor();
    r.lang = 'en-US';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    heard.current = '';
    r.onresult = (e) => {
      heard.current = Array.from(e.results, (res) => res[0]?.transcript ?? '').join(' ').replace(/\s+/g, ' ').trim();
    };
    r.onerror = () => undefined;
    ended.current = new Promise((resolve) => {
      r.onend = () => resolve();
    });
    try {
      r.start();
    } catch {
      return false;
    }
    recognizer.current = r;
    setRecording(true);
    timer.current = setTimeout(() => r.stop(), MAX_SECONDS * 1000);
    return true;
  }, []);

  const stop = useCallback(async (): Promise<Recording | null> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    recognizer.current?.stop();
    // The last words arrive just before the recognizer ends; don't wait forever for it.
    await Promise.race([ended.current, new Promise((r) => setTimeout(r, 2500))]);
    recognizer.current = null;
    setRecording(false);
    return { uri: 'browser-speech', name: 'speech.txt', type: 'text/plain', transcript: heard.current };
  }, []);

  return { recording, start, stop };
}

/** On a phone: record audio for the API. In the browser demo: let the browser listen. */
export const useVoiceRecorder = DEMO && recognitionCtor() ? useBrowserRecognizer : useDeviceRecorder;

function audioForm(recording: Recording): FormData {
  const form = new FormData();
  if (DEMO) {
    if (recording.transcript !== undefined) {
      form.append('transcript', recording.transcript);
    }
    return form;
  }
  // React Native's FormData takes a {uri, name, type} object for files.
  form.append('audio', recording as unknown as Blob);
  return form;
}

export function assessPronunciation(recording: Recording, referenceText: string): Promise<Assessment> {
  const form = audioForm(recording);
  form.append('referenceText', referenceText);
  return apiUpload<Assessment>('/api/v1/speech/assess', form);
}

/**
 * Sends one role-play turn. The text is what the learner meant to say (the chosen hint, or what
 * they typed); when audio is present the server transcribes it and uses that instead.
 */
export function sendTurn(sessionId: string, text: string, recording: Recording | null, hintUsed: boolean): Promise<SceneView> {
  const form = recording ? audioForm(recording) : new FormData();
  form.append('text', text);
  form.append('hintUsed', hintUsed ? 'true' : 'false');
  return apiUpload<SceneView>(`/api/v1/roleplay/sessions/${sessionId}/turns`, form);
}

type SayOptions = { slow?: boolean; voice?: string | null; rate?: number };

/** Speaks English with the device's own voice: free, and works offline once the voice is installed. */
export function say(text: string, opts: SayOptions = {}): void {
  void Speech.stop();
  speakOne(text, opts);
}

/** Speaks several lines one after another (a reply, then the surprise, then the next question). */
export function sayAll(lines: { text: string; voice?: string | null }[], rate?: number): void {
  void Speech.stop();
  lines.forEach((l) => speakOne(l.text, { voice: l.voice, rate }));
}

function speakOne(text: string, opts: SayOptions): void {
  // An accent the device has no voice for falls back to the default English voice.
  Speech.speak(text, { language: opts.voice ?? 'en-US', rate: opts.rate ?? (opts.slow ? 0.7 : 0.92) });
}
