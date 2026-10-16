/**
 * How a recorded line is found: the same key as tools/voice/generate.py, from the accent and
 * the exact text (whitespace collapsed). FNV-1a twice with different seeds, 16 hex digits.
 */
export function normalizeLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function fnv(bytes: Uint8Array, seed: number): number {
  let h = seed >>> 0;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

const hex = (n: number) => n.toString(16).padStart(8, '0');

export function voiceKey(accent: string, text: string): string {
  const bytes = new TextEncoder().encode(`${accent}|${normalizeLine(text)}`);
  return hex(fnv(bytes, 0x811c9dc5)) + hex(fnv(bytes, 0x9747b28c));
}

/**
 * Lines that greet the learner by name are recorded without the name (see nameless() in
 * tools/voice/lines.py); this gives the same text from the line the learner actually sees.
 */
export function withoutName(text: string, name: string): string | null {
  if (!name || !text.includes(name)) {
    return null;
  }
  const t = text.split(`, ${name}`).join('').split(` ${name}`).join('').split(name).join('');
  return normalizeLine(t.replace(/\s+([?!.,])/g, '$1'));
}
