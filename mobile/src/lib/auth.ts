import { create } from 'zustand';

import { apiSend } from './api';
import { type TokenPair, tokens } from './tokens';

type Status = 'loading' | 'signedIn' | 'signedOut';

type AuthState = {
  status: Status;
  bootstrap: () => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul';
  } catch {
    return 'Europe/Istanbul';
  }
}

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',

  /** Restores the session from the keychain. Offline with a saved session still counts as signed in. */
  async bootstrap() {
    const stored = await tokens.storedRefreshToken();
    if (!stored) {
      set({ status: 'signedOut' });
      return;
    }
    await tokens.refresh();
    set({ status: (await tokens.storedRefreshToken()) ? 'signedIn' : 'signedOut' });
  },

  async register(displayName, email, password) {
    const pair = await apiSend<TokenPair>(
      'POST',
      '/api/v1/auth/register',
      { displayName, email, password, timezone: deviceTimezone() },
      { auth: false },
    );
    await tokens.save(pair);
    set({ status: 'signedIn' });
  },

  async login(email, password) {
    const pair = await apiSend<TokenPair>('POST', '/api/v1/auth/login', { email, password }, { auth: false });
    await tokens.save(pair);
    set({ status: 'signedIn' });
  },

  async logout() {
    const refreshToken = await tokens.storedRefreshToken();
    if (refreshToken) {
      await apiSend('POST', '/api/v1/auth/logout', { refreshToken }, { auth: false }).catch(() => undefined);
    }
    await tokens.clear();
    set({ status: 'signedOut' });
  },
}));

tokens.onSignedOut(() => useAuth.setState({ status: 'signedOut' }));
