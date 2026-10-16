import { describe, expect, it } from 'vitest';

import { closestReading, scoreSpeech } from './speechScore';

describe('demo speech scores', () => {
  it('spreads scores instead of giving two fixed values', () => {
    const ref = 'Can I have a coffee, please?';
    const perfect = scoreSpeech(ref, 'can I have a coffee please', 0.93).overall;
    const unsure = scoreSpeech(ref, 'can I have a coffee please', 0.62).overall;
    const near = scoreSpeech(ref, 'can I have a copy please', 0.85).overall;
    const half = scoreSpeech(ref, 'a coffee', 0.9).overall;
    const wrong = scoreSpeech(ref, 'where is the station', 0.9).overall;
    expect(perfect).toBeGreaterThan(unsure);
    expect(unsure).toBeGreaterThan(near);
    expect(near).toBeGreaterThan(half);
    expect(half).toBeGreaterThan(wrong);
    expect(new Set([perfect, unsure, near, half, wrong]).size).toBe(5);
    expect(perfect).toBeGreaterThanOrEqual(90);
    expect(wrong).toBeLessThan(45);
  });

  it('gives different single-word scores for a clear word, a near miss and a wrong word', () => {
    const clear = scoreSpeech('Passport', 'passport', 0.9).overall;
    const near = scoreSpeech('Passport', 'passports', 0.8).overall;
    const wrong = scoreSpeech('Passport', 'bus', 0.8).overall;
    expect(clear).toBeGreaterThan(near);
    expect(near).toBeGreaterThan(wrong);
  });

  it('picks the reading of the speech closest to the expected line', () => {
    expect(closestReading('I have a reservation', ['I have a reservoir', 'I have a reservation', 'eye of a reservation'])).toBe('I have a reservation');
  });

  it('names the weakest word in the tip', () => {
    const a = scoreSpeech('Window seat, please', 'window sit please', 0.8);
    expect(a.weakestWord).toBe('seat');
    expect(a.tipTr).toContain('seat');
  });
});
