import {
  AudioQuality,
  createAudioPlayer,
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
import { VOICE_URL } from './config';
import { DEMO } from './demo/flag';
import { voiceKey, withoutName } from './voiceKey';
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
    stopPlayback();
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
  // Finished sentences, and the words of the one still being heard.
  const finals = useRef<string[]>([]);
  const partial = useRef('');
  const listening = useRef(false);
  const ended = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allowed = useRef(false);

  const listen = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      return false;
    }
    const r = new Ctor();
    r.lang = 'en-US';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const said: string[] = [];
      let open = '';
      Array.from(e.results).forEach((res) => {
        const text = res[0]?.transcript ?? '';
        if ((res as unknown as { isFinal?: boolean }).isFinal) {
          said.push(text);
        } else {
          open += text;
        }
      });
      finals.current = said;
      partial.current = open;
    };
    r.onerror = () => undefined;
    ended.current = new Promise((resolve) => {
      r.onend = () => {
        // Some phones stop listening at the first pause; keep listening until the learner taps.
        if (listening.current) {
          const before = [...finals.current, partial.current].join(' ');
          finals.current = before.trim() ? [before] : [];
          partial.current = '';
          try {
            r.start();
            return;
          } catch {
            // Fall through: treat as ended.
          }
        }
        resolve();
      };
    });
    try {
      r.start();
    } catch {
      return false;
    }
    recognizer.current = r;
    return true;
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (!recognitionCtor()) {
      return false;
    }
    // Ask for the microphone once; asking before every turn upsets some phones.
    if (!allowed.current) {
      allowed.current = await microphoneAllowed();
      if (!allowed.current) {
        return false;
      }
    }
    stopPlayback();
    finals.current = [];
    partial.current = '';
    listening.current = true;
    if (!listen()) {
      listening.current = false;
      return false;
    }
    setRecording(true);
    timer.current = setTimeout(() => {
      listening.current = false;
      recognizer.current?.stop();
    }, MAX_SECONDS * 1000);
    return true;
  }, [listen]);

  const stop = useCallback(async (): Promise<Recording | null> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    listening.current = false;
    recognizer.current?.stop();
    // The last words arrive just before the recognizer ends; don't wait forever for it.
    await Promise.race([ended.current, new Promise((r) => setTimeout(r, 2500))]);
    recognizer.current = null;
    setRecording(false);
    const transcript = [...finals.current, partial.current].join(' ').replace(/\s+/g, ' ').trim();
    return { uri: 'browser-speech', name: 'speech.txt', type: 'text/plain', transcript };
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

// ---- speaking: recorded neural voices first, the device's own voice as a fallback ---------------

type SayOptions = { slow?: boolean; voice?: string | null; rate?: number };
type Line = { text: string; voice?: string | null };

const ACCENTS = ['en-GB', 'en-US', 'en-AU'];
let recorded: Set<string> | null = null;
let indexLoading: Promise<void> | null = null;
let learnerName = '';
let defaultAccent = 'en-GB';

/** London, New York, Sydney: the accent of each week (the Starter pack uses the British one). */
export function accentForWeek(week: number | undefined): string {
  return week === 2 ? 'en-US' : week === 3 ? 'en-AU' : 'en-GB';
}

/** The accent for lines that don't name one, e.g. the words of the lesson being played. */
export function setDefaultAccent(accent: string): void {
  defaultAccent = accent;
}

/** Loads the list of recorded lines; until it arrives, lines are spoken by the device. */
export function preloadVoices(): Promise<void> {
  if (!indexLoading) {
    indexLoading = fetch(`${VOICE_URL}/index.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { keys?: string[] } | null) => {
        if (j?.keys) {
          recorded = new Set(j.keys);
        }
      })
      .catch(() => {
        indexLoading = null;
      });
  }
  return indexLoading ?? Promise.resolve();
}

/** Lines that greet the learner by name are recorded without it; this lets them be found. */
export function setLearnerName(name: string): void {
  learnerName = name;
}

function recordingFor(text: string, accent: string): string | null {
  if (!recorded) {
    return null;
  }
  const variants = [text];
  const nameless = withoutName(text, learnerName);
  if (nameless) {
    variants.push(nameless);
  }
  const order = [accent, ...ACCENTS.filter((a) => a !== accent)];
  for (const v of variants) {
    for (const a of order) {
      const key = voiceKey(a, v);
      if (recorded.has(key)) {
        return `${VOICE_URL}/${key}.mp3`;
      }
    }
  }
  return null;
}

let generation = 0;
let stopCurrent: (() => void) | null = null;

/** Stops whatever is being said, recorded or not. */
export function stopPlayback(): void {
  generation++;
  stopCurrent?.();
  stopCurrent = null;
  void Speech.stop();
}

/** Speaks English: a natural recorded voice when the line was recorded, else the device's best voice. */
export function say(text: string, opts: SayOptions = {}): void {
  play([{ text, voice: opts.voice }], opts.rate, opts.slow);
}

/** Speaks several lines one after another (a reply, then the surprise, then the next question). */
export function sayAll(lines: Line[], rate?: number): void {
  play(lines, rate, false);
}

function play(lines: Line[], rate: number | undefined, slow: boolean | undefined): void {
  stopPlayback();
  void preloadVoices();
  const mine = generation;
  void (async () => {
    for (const line of lines) {
      if (mine !== generation) {
        return;
      }
      await speakLine(line.text, line.voice ?? defaultAccent, rate, slow);
    }
  })();
}

async function speakLine(text: string, accent: string, rate: number | undefined, slow: boolean | undefined): Promise<void> {
  const url = recordingFor(text, accent);
  if (url) {
    const playbackRate = slow ? 0.8 : rate ? Math.min(1.2, Math.max(0.75, rate / 0.95)) : 1;
    if (await playRecording(url, playbackRate)) {
      return;
    }
  }
  await speakWithDevice(text, accent, slow ? 0.7 : rate ?? 0.92);
}

// Web: one shared audio element, unlocked by the first tap (mobile browsers block sound that
// does not follow a tap, and a scene's first line arrives after a network call).
let webAudio: HTMLAudioElement | null = null;
/** 50 ms of silence as a WAV data URI, played on the first tap to unlock sound. */
function silence(): string {
  const samples = 400;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => s.split('').forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, 'data');
  view.setUint32(40, samples, true);
  bytes.fill(128, 44);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function audioElement(): HTMLAudioElement | null {
  if (Platform.OS !== 'web' || typeof Audio === 'undefined') {
    return null;
  }
  if (!webAudio) {
    webAudio = new Audio();
    webAudio.preload = 'auto';
    const unlock = () => {
      if (webAudio && !webAudio.src) {
        webAudio.src = silence();
        webAudio.play().catch(() => undefined);
      }
      document.removeEventListener('pointerdown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
  }
  return webAudio;
}

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  audioElement();
}

function playRecording(url: string, rate: number): Promise<boolean> {
  const el = audioElement();
  if (el) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (!settled) {
          settled = true;
          el.onended = null;
          el.onerror = null;
          resolve(ok);
        }
      };
      stopCurrent = () => {
        el.pause();
        finish(true);
      };
      el.onended = () => finish(true);
      el.onerror = () => finish(false);
      el.src = url;
      el.playbackRate = rate;
      (el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
      el.play().catch(() => finish(false));
    });
  }
  return new Promise((resolve) => {
    try {
      const player = createAudioPlayer({ uri: url });
      let settled = false;
      const finish = (ok: boolean) => {
        if (!settled) {
          settled = true;
          sub.remove();
          player.remove();
          resolve(ok);
        }
      };
      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          finish(true);
        }
      });
      stopCurrent = () => {
        player.pause();
        finish(true);
      };
      player.setPlaybackRate(rate, 'high');
      player.play();
      // A recording that never starts (offline) falls back to the device voice.
      setTimeout(() => {
        if (!player.playing && !settled && player.currentTime === 0) {
          finish(false);
        }
      }, 4000);
    } catch {
      resolve(false);
    }
  });
}

let deviceVoices: Speech.Voice[] = [];

/** The most natural installed voice for the accent: enhanced or neural voices first. */
async function deviceVoice(accent: string): Promise<string | undefined> {
  if (deviceVoices.length === 0) {
    deviceVoices = await Speech.getAvailableVoicesAsync().catch(() => []);
  }
  const wanted = accent === 'en-AU' ? ['en-AU', 'en-GB'] : [accent];
  const score = (v: Speech.Voice) => {
    const lang = v.language.replace('_', '-');
    let n = wanted.indexOf(lang) === 0 ? 6 : wanted.includes(lang) ? 4 : lang.startsWith('en') ? 1 : -100;
    if (v.quality === Speech.VoiceQuality.Enhanced) {
      n += 3;
    }
    if (/natural|neural|premium|enhanced|siri|google/i.test(`${v.name} ${v.identifier}`)) {
      n += 3;
    }
    if (/compact|eloquence|novelty|whisper|bad news|bells|bubbles|cellos|zarvox|trinoids|organ/i.test(`${v.name} ${v.identifier}`)) {
      n -= 5;
    }
    return n;
  };
  const best = [...deviceVoices].sort((a, b) => score(b) - score(a))[0];
  return best && score(best) > 0 ? best.identifier : undefined;
}

async function speakWithDevice(text: string, accent: string, rate: number): Promise<void> {
  const voice = await deviceVoice(accent);
  await new Promise<void>((resolve) => {
    stopCurrent = () => resolve();
    Speech.speak(text, { language: accent, voice, rate, onDone: () => resolve(), onStopped: () => resolve(), onError: () => resolve() });
  });
}
