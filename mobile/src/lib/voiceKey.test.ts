import { describe, expect, it } from 'vitest';

import { voiceKey, withoutName } from './voiceKey';

describe('voice keys', () => {
  it('match the keys of the recording script', () => {
    expect(voiceKey('en-GB', 'Is breakfast included?')).toBe('bc4a1310860562bd');
    expect(voiceKey('en-US', 'Café — naïve “quotes”')).toBe('0eb7789f845f9ff0');
    expect(voiceKey('en-GB', '  Is   breakfast included? ')).toBe('bc4a1310860562bd');
  });

  it('drops the learner name like the recording script', () => {
    expect(withoutName('Got it, Ozan.', 'Ozan')).toBe('Got it.');
    expect(withoutName("Hang in there, Ozan — we'll find it.", 'Ozan')).toBe("Hang in there — we'll find it.");
    expect(withoutName('Here you go!', 'Ozan')).toBeNull();
  });
});
