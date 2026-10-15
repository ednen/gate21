import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { DEMO } from './demo/flag';

/**
 * Keychain (iOS) / Keystore (Android) on devices. The web build is only a development preview,
 * and SecureStore has no web implementation, so there it falls back to sessionStorage.
 */
const web = Platform.OS === 'web';
/** The demo keeps you signed in across visits, like the phone app does. */
const store = (): Storage | undefined => {
  try {
    return DEMO ? globalThis.localStorage : globalThis.sessionStorage;
  } catch {
    return undefined;
  }
};

export const secureStorage = {
  getItem(key: string): Promise<string | null> {
    return web ? Promise.resolve(store()?.getItem(key) ?? null) : SecureStore.getItemAsync(key);
  },
  setItem(key: string, value: string): Promise<void> {
    if (web) {
      store()?.setItem(key, value);
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem(key: string): Promise<void> {
    if (web) {
      store()?.removeItem(key);
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};
