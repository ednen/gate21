"""
Every English line the app can speak, with the accent and the voice it should be spoken in.

The app looks a recording up by (accent, text), so the text here must be exactly what the app
passes to say()/sayAll(): placeholders filled with every fact value, the dialog gaps filled in,
and the learner's name left out (see NAME_VARIANTS below and nameless() in voice.ts).
"""
import itertools
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / 'content'

# Kokoro voices with the best quality grades; Australian lines use the British voices.
NARRATOR = {'en-GB': 'bf_emma', 'en-US': 'af_heart', 'en-AU': 'bf_emma'}
FEMALE = {'en-GB': ['bf_emma'], 'en-US': ['af_heart', 'af_bella'], 'en-AU': ['bf_emma']}
MALE = {'en-GB': ['bm_george', 'bm_fable'], 'en-US': ['am_michael', 'am_fenrir', 'am_puck'], 'en-AU': ['bm_george', 'bm_fable']}
# Characters by role and accent: a mix of men and women across the journey.
CAST = {
    ('Border officer', 'en-GB'): 'bm_george',
    ('Taxi driver', 'en-GB'): 'bm_fable',
    ('Receptionist', 'en-GB'): 'bf_emma',
    ('Waiter', 'en-GB'): 'bm_george',
    ('Barista', 'en-GB'): 'bf_emma',
    ('Shop assistant', 'en-GB'): 'bf_emma',
    ('Station assistant', 'en-GB'): 'bm_fable',
    ('CBP officer', 'en-US'): 'am_michael',
    ('Driver', 'en-US'): 'am_fenrir',
    ('Front desk agent', 'en-US'): 'af_bella',
    ('Server', 'en-US'): 'af_heart',
    ('Waiter', 'en-US'): 'am_puck',
    ('Barista', 'en-US'): 'af_bella',
    ('Sales assistant', 'en-US'): 'af_heart',
    ('Station agent', 'en-US'): 'am_michael',
    ('Airline staff', 'en-US'): 'af_heart',
    ('Baggage services agent', 'en-AU'): 'bf_emma',
    ('Taxi driver', 'en-AU'): 'bm_george',
    ('Receptionist', 'en-AU'): 'bf_emma',
    ('Duty manager', 'en-AU'): 'bm_fable',
    ('Waiter', 'en-AU'): 'bm_george',
    ('Barista', 'en-AU'): 'bf_emma',
    ('Local', 'en-AU'): 'bm_fable',
    ('Shop assistant', 'en-AU'): 'bf_emma',
    ('Market seller', 'en-AU'): 'bm_george',
    ('Ferry ticket officer', 'en-AU'): 'bf_emma',
}
WEEK_ACCENT = {0: 'en-GB', 1: 'en-GB', 2: 'en-US', 3: 'en-AU'}
# The learner's own lines in a lesson dialog.
YOU = 'en-US'


def fnv(data: bytes, seed: int) -> int:
    h = seed
    for b in data:
        h ^= b
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def key(accent: str, text: str) -> str:
    """The file name of a recording; mobile/src/lib/voiceKey.ts computes the same."""
    data = f'{accent}|{text}'.encode('utf-8')
    return f'{fnv(data, 0x811C9DC5):08x}{fnv(data, 0x9747B28C):08x}'


def normalize(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()


def nameless(text: str) -> str:
    """The line without the learner's name, as the app looks it up (mirrors voice.ts)."""
    text = text.replace(', {name}', '').replace(' {name}', '').replace('{name}', '')
    return normalize(re.sub(r'\s+([?!.,])', r'\1', text))


def voice_for(role: str, accent: str) -> str:
    if (role, accent) in CAST:
        return CAST[(role, accent)]
    pool = FEMALE[accent] + MALE[accent]
    return pool[sum(map(ord, role)) % len(pool)]


def expand(text, facts):
    """Every way a line can read once its fact placeholders are filled."""
    if not text:
        return []
    keys = [k for k in dict.fromkeys(re.findall(r'\{(\w+)}', text)) if k in facts]
    out = []
    for combo in itertools.product(*[facts[k] for k in keys]):
        t = text
        for k, v in zip(keys, combo):
            t = t.replace('{' + k + '}', v)
        out.append(nameless(t) if '{name}' in t else normalize(t))
    return out


def collect():
    """{(accent, text): voice}. The first voice that claims a line keeps it."""
    lines = {}

    def add(accent, text, voice):
        text = normalize(text or '')
        if text and (accent, text) not in lines:
            lines[(accent, text)] = voice

    manifest = json.loads((CONTENT / 'manifest.json').read_text())
    for info in manifest['chapters']:
        path = CONTENT / 'chapters' / f"{info['slug']}.json"
        if not path.exists():
            continue
        c = json.loads(path.read_text())
        accent = WEEK_ACCENT[0 if info['kind'] == 'starter' else info['week']]
        n = NARRATOR[accent]
        for w in c.get('words', []):
            add(accent, w['en'], n)
            add(accent, w.get('example'), n)
        for p in c.get('pronounce', []):
            add(accent, p['word'], n)
        for q in c.get('recognize', []):
            add(accent, q.get('audio'), n)
        for line in (c.get('dialog') or {}).get('lines', []):
            text = line['text'].replace('___', line.get('gap', ''))
            if line['who'] == 'You':
                add(YOU, text, NARRATOR[YOU])
            else:
                add(accent, text, voice_for(line['who'], accent))
        if c.get('use'):
            add(accent, c['use']['phrase'], n)
        if c.get('speak'):
            add(accent, c['speak']['answer'], n)

    placement = json.loads((CONTENT / 'placement.json').read_text())
    for s in placement['speaking']:
        add('en-GB', s['phrase'], NARRATOR['en-GB'])
    for p in json.loads((CONTENT / 'sos.json').read_text())['phrases']:
        add('en-GB', p['en'], NARRATOR['en-GB'])

    for path in sorted((CONTENT / 'scenarios').glob('*.json')):
        s = json.loads(path.read_text())
        facts = {f['id']: f['values'] for f in s['facts']}
        role, accent = s['role'], s.get('voice') or 'en-GB'
        speaker = voice_for(role, accent)
        for t in expand(s['opening'], facts):
            add(accent, t, speaker)
        last = (role, accent)
        for g in s['goals']:
            if g.get('role'):
                last = (g['role'], g.get('voice') or accent)
            r, a = last
            v = voice_for(r, a)
            for k in ('ask', 'successReply', 'retryReply'):
                for t in expand(g.get(k), facts):
                    add(a, t, v)
            # Hints come back in the report and in practice ("say it like this").
            for t in expand(g.get('hint'), facts):
                add(a, t, NARRATOR[a])
        # A surprise is said by whoever is on stage after the goal its slot follows.
        on_stage, current = {}, (role, accent)
        for g in s['goals']:
            if g.get('role'):
                current = (g['role'], g.get('voice') or accent)
            on_stage[g['id']] = current
        speaker_of = {tid: on_stage[slot['after']] for slot in s['twistSlots'] for tid in slot['pool']}
        for t in s['twists']:
            r, a = speaker_of.get(t['id'], (role, accent))
            v = voice_for(r, a)
            for k in ('intro', 'retryReply'):
                for x in expand(t.get(k), facts):
                    add(a, x, v)
            for o in t['options']:
                for x in expand(o['reply'], facts):
                    add(a, x, v)
                for x in expand(o['text'], facts):
                    add(a, x, NARRATOR[a])
        for t in expand(s.get('closing'), facts):
            add(last[1], t, voice_for(*last))
    return lines


if __name__ == '__main__':
    import sys
    lines = collect()
    if '--check' in sys.argv:
        # CI: warn (GitHub annotation) about lines that have no recording yet.
        missing = [t for (a, t) in lines if not (ROOT / 'voice' / f'{key(a, t)}.mp3').exists()]
        for t in missing[:20]:
            print(f'::warning title=Voice not recorded::{t}')
        print(f'{len(lines) - len(missing)}/{len(lines)} lines recorded; run tools/voice/generate.py for the rest.')
        sys.exit(0)
    by = {}
    for (a, _), v in lines.items():
        by[(a, v)] = by.get((a, v), 0) + 1
    print(len(lines), 'lines'); print(by)
    print(sum(len(t) for _, t in lines), 'characters')
