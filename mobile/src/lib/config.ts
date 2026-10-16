import Constants from 'expo-constants';

export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'http://localhost:8080';

/**
 * The recorded voices (tools/voice). The browser demo serves them itself; the app reads them
 * from the published demo until they move to a CDN.
 */
export const VOICE_URL: string =
  process.env.EXPO_PUBLIC_VOICE_URL ??
  (process.env.EXPO_PUBLIC_BASE_URL ? `${process.env.EXPO_PUBLIC_BASE_URL}/voice` : 'https://ednen.github.io/gate21/voice');
