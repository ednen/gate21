import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { apiSend } from './api';
import { ApiError } from './errors';
import { acknowledge, type Attempt, enqueue, nextBatch } from './queue';
import type { Step, SyncResult } from './types';

/**
 * Offline-first progress: every finished step is written to a persisted queue first, then
 * synced. The API ignores repeated clientIds, so retrying a batch never double-counts XP.
 */
const KEY = 'gate21.attempt-queue';

let queue: Attempt[] | null = null;
let flushing: Promise<SyncResult | null> | null = null;

async function load(): Promise<Attempt[]> {
  if (queue === null) {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      queue = raw ? (JSON.parse(raw) as Attempt[]) : [];
    } catch {
      queue = [];
    }
  }
  return queue;
}

async function persist(next: Attempt[]): Promise<void> {
  queue = next;
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function recordStep(chapter: string, step: Step, score: number | null): Promise<void> {
  const attempt: Attempt = {
    clientId: Crypto.randomUUID(),
    chapter,
    step,
    score: score === null ? null : Math.round(score),
    occurredAt: new Date().toISOString(),
  };
  await persist(enqueue(await load(), attempt));
  void flushProgress();
}

/** Attempts recorded on this device that the server has not confirmed yet. */
export async function pendingAttempts(): Promise<Attempt[]> {
  return [...(await load())];
}

export async function pendingCount(): Promise<number> {
  return (await load()).length;
}

/** Sends queued attempts. Safe to call often; concurrent calls share one flush. */
export function flushProgress(): Promise<SyncResult | null> {
  if (!flushing) {
    flushing = doFlush().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function doFlush(): Promise<SyncResult | null> {
  let last: SyncResult | null = null;
  for (;;) {
    const batch = nextBatch(await load());
    if (batch.length === 0) {
      return last;
    }
    try {
      last = await apiSend<SyncResult>('POST', '/api/v1/progress/sync', { attempts: batch });
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        // The server will never accept this batch (e.g. a chapter was removed); drop it.
        await persist(acknowledge(await load(), batch));
        continue;
      }
      return last; // Offline or server error: keep the queue for the next try.
    }
    await persist(acknowledge(await load(), batch));
  }
}
