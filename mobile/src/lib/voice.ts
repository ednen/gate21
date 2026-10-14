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

export type Recording = { uri: string; name: string; type: string };

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
export function useVoiceRecorder() {
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

function audioForm(recording: Recording): FormData {
  const form = new FormData();
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
export function sendTurn(sessionId: string, text: string, recording: Recording | null): Promise<SceneView> {
  const form = recording ? audioForm(recording) : new FormData();
  form.append('text', text);
  return apiUpload<SceneView>(`/api/v1/roleplay/sessions/${sessionId}/turns`, form);
}

/** Speaks English with the device's own voice: free, and works offline once the voice is installed. */
export function say(text: string, opts: { slow?: boolean } = {}): void {
  void Speech.stop();
  Speech.speak(text, { language: 'en-US', rate: opts.slow ? 0.7 : 0.92 });
}
