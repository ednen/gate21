import type { Step } from './types';

/** One finished lesson step, recorded on the device first and synced when online. */
export type Attempt = {
  clientId: string;
  chapter: string;
  step: Step;
  score: number | null;
  occurredAt: string;
};

export const MAX_BATCH = 100;

/** Adds an attempt unless one with the same clientId is already queued. */
export function enqueue(queue: Attempt[], attempt: Attempt): Attempt[] {
  return queue.some((a) => a.clientId === attempt.clientId) ? queue : [...queue, attempt];
}

/** The oldest attempts first, at most MAX_BATCH (the API accepts up to 200). */
export function nextBatch(queue: Attempt[]): Attempt[] {
  return queue.slice(0, MAX_BATCH);
}

/** Removes the attempts the server confirmed. Attempts queued meanwhile are kept. */
export function acknowledge(queue: Attempt[], sent: Attempt[]): Attempt[] {
  const sentIds = new Set(sent.map((a) => a.clientId));
  return queue.filter((a) => !sentIds.has(a.clientId));
}
