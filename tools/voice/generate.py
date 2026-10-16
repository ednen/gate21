"""
Records every line the app speaks with Kokoro (an open, Apache-2.0 neural text-to-speech model),
so learners hear natural voices instead of the phone's robotic one.

    pip install kokoro-onnx soundfile lameenc
    # model files: https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
    KOKORO_DIR=/path/to/models python3 tools/voice/generate.py

Output: voice/<key>.mp3 and voice/index.json at the repository root. Only missing lines are
recorded, and recordings of lines that no longer exist are deleted, so re-running after a
content change is quick. The key is computed the same way in mobile/src/lib/voiceKey.ts.
"""
import json
import os
import re
import sys
import time
from pathlib import Path

import lameenc
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from lines import ROOT, collect, key  # noqa: E402

OUT = ROOT / 'voice'
SAMPLE_RATE = 24000
BITRATE = 48


def digits(d: str) -> str:
    return ' '.join(d)


def spoken(text: str) -> str:
    """How a person reads the line aloud: prices, codes, seats and room numbers."""
    t = re.sub(r'\s*\((?:£|\$|€|A\$)\)', '', text)  # "pound (£)" -> "pound"
    money = {'£': ('pounds', 'p'), '€': ('euros', 'cents'), 'A$': ('Australian dollars', 'cents'), '$': ('dollars', 'cents')}
    for sign, (unit, _) in money.items():
        esc = re.escape(sign)
        t = re.sub(esc + r'(\d+)\.(\d{2})\b', lambda m: f'{m[1]} {unit} {m[2]}' if m[2] != '00' else f'{m[1]} {unit}', t)
        t = re.sub(esc + r'(\d+)\b', lambda m: f'{m[1]} {unit}', t)
    t = re.sub(r'\b([A-Z]{2,})(\d{3,})\b', lambda m: f"{' '.join(m[1])}, {digits(m[2])}", t)  # SYD48213
    t = re.sub(r'\b(code is) (\d{4})\b', lambda m: f'{m[1]} {digits(m[2])}', t)
    t = re.sub(r'\b([a-z]+)(\d+)\b', lambda m: f'{m[1]} {digits(m[2])}', t)  # Wi-Fi passwords
    t = re.sub(r'\b(room(?: is)?) (\d)(\d{2})\b', r'\1 \2 \3', t)  # room 412 -> four twelve
    t = re.sub(r'\b(\d+)([A-Z])\b', r'\1 \2', t)  # seat 14A
    t = re.sub(r'\b([A-Z])(\d{1,2})\b', r'\1 \2', t)  # gate B12
    return t


def mp3(samples: np.ndarray) -> bytes:
    pcm = (np.clip(samples, -1, 1) * 32767).astype('<i2').tobytes()
    enc = lameenc.Encoder()
    enc.set_bit_rate(BITRATE)
    enc.set_in_sample_rate(SAMPLE_RATE)
    enc.set_channels(1)
    enc.set_quality(2)
    return enc.encode(pcm) + enc.flush()


def trim(samples: np.ndarray, threshold=0.004, pad=int(0.08 * SAMPLE_RATE)) -> np.ndarray:
    loud = np.where(np.abs(samples) > threshold)[0]
    if len(loud) == 0:
        return samples
    return samples[max(0, loud[0] - pad): min(len(samples), loud[-1] + pad)]


def main():
    from kokoro_onnx import Kokoro

    models = Path(os.environ.get('KOKORO_DIR', '.'))
    model = models / os.environ.get('KOKORO_MODEL', 'kokoro-v1.0.onnx')
    kokoro = Kokoro(str(model), str(models / 'voices-v1.0.bin'))

    lines = collect()
    OUT.mkdir(exist_ok=True)
    wanted = {key(a, t): (a, t, v) for (a, t), v in lines.items()}
    for old in OUT.glob('*.mp3'):
        if old.stem not in wanted:
            old.unlink()

    if '--respeak' in sys.argv:
        # Re-record the lines whose spoken form differs from the text (after changing spoken()).
        for k, (a, t, v) in wanted.items():
            if spoken(t) != t:
                (OUT / f'{k}.mp3').unlink(missing_ok=True)
    todo = [(k, *val) for k, val in wanted.items() if not (OUT / f'{k}.mp3').exists()]
    print(f'{len(wanted)} lines, {len(todo)} to record', flush=True)
    started = time.time()
    for n, (k, accent, text, voice) in enumerate(todo, 1):
        words = len(text.split())
        # Single words and short phrases a little slower, so every sound is clear.
        speed = 0.88 if words <= 2 else 0.95 if words <= 5 else 1.0
        lang = 'en-gb' if voice.startswith('b') else 'en-us'
        samples, _ = kokoro.create(spoken(text), voice=voice, speed=speed, lang=lang)
        (OUT / f'{k}.mp3').write_bytes(mp3(trim(np.asarray(samples, dtype=np.float32))))
        if n % 50 == 0:
            rate = (time.time() - started) / n
            print(f'{n}/{len(todo)} · {rate:.2f}s/line · ~{(len(todo) - n) * rate / 60:.0f} min left', flush=True)

    index = {'version': 1, 'keys': sorted(wanted)}
    (OUT / 'index.json').write_text(json.dumps(index, separators=(',', ':')) + '\n')
    print('done', len(wanted), flush=True)


if __name__ == '__main__':
    main()
