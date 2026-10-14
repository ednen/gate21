import { API_URL } from './config';
import { ApiError } from './errors';
import { tokens } from './tokens';

type Options = { auth?: boolean };

/**
 * fetch with the access token attached. On a 401 it refreshes the token once (shared by all
 * requests that fail at the same moment) and retries.
 */
async function request<T>(path: string, init: RequestInit, opts: Options = {}): Promise<T> {
  const auth = opts.auth ?? true;
  const send = async () => {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    const access = auth ? tokens.access() : null;
    if (access) {
      headers.set('Authorization', `Bearer ${access}`);
    }
    try {
      return await fetch(`${API_URL}${path}`, { ...init, headers });
    } catch {
      throw new ApiError(0, 'NETWORK', 'Network request failed');
    }
  };

  let response = await send();
  if (response.status === 401 && auth && (await tokens.refresh())) {
    response = await send();
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    if (response.status === 401 && auth) {
      tokens.signedOutByServer();
    }
    throw new ApiError(response.status, body?.code ?? `HTTP_${response.status}`, body?.detail ?? response.statusText);
  }
  return body as T;
}

export function apiGet<T>(path: string, opts?: Options): Promise<T> {
  return request<T>(path, { method: 'GET' }, opts);
}

export function apiSend<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown, opts?: Options): Promise<T> {
  return request<T>(
    path,
    {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    opts,
  );
}

/** Multipart upload (audio). React Native's FormData accepts {uri, name, type} file parts. */
export function apiUpload<T>(path: string, form: FormData): Promise<T> {
  return request<T>(path, { method: 'POST', body: form });
}
