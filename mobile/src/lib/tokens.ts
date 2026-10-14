
import { API_URL } from './config';
import { secureStorage } from './secureStorage';

/**
 * Access token in memory only; refresh token in the device keychain (see secureStorage).
 * Refreshes are single-flight: the server treats a reused refresh token as theft.
 */
const REFRESH_KEY = 'gate21.refresh-token';

export type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number };

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
const signOutListeners = new Set<() => void>();

export const tokens = {
  access(): string | null {
    return accessToken;
  },

  async save(pair: TokenPair): Promise<void> {
    accessToken = pair.accessToken;
    await secureStorage.setItem(REFRESH_KEY, pair.refreshToken);
  },

  async storedRefreshToken(): Promise<string | null> {
    return secureStorage.getItem(REFRESH_KEY);
  },

  async clear(): Promise<void> {
    accessToken = null;
    await secureStorage.removeItem(REFRESH_KEY);
  },

  refresh(): Promise<boolean> {
    if (!refreshing) {
      refreshing = doRefresh().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  },

  onSignedOut(listener: () => void): () => void {
    signOutListeners.add(listener);
    return () => signOutListeners.delete(listener);
  },

  signedOutByServer(): void {
    void tokens.clear();
    signOutListeners.forEach((l) => l());
  },
};

async function doRefresh(): Promise<boolean> {
  const refreshToken = await secureStorage.getItem(REFRESH_KEY);
  if (!refreshToken) {
    return false;
  }
  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      if (response.status === 401) {
        await tokens.clear();
      }
      return false;
    }
    await tokens.save((await response.json()) as TokenPair);
    return true;
  } catch {
    // Offline: keep the refresh token and try again later.
    return false;
  }
}
