"""Mirror of ContentService.validate + the scripted judge test, plus checks for the v3 lesson format."""
import json, re, sys, os

# Usage: python3 tools/check_content.py
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'content')
STEPS = ["DISCOVER", "PRONOUNCE", "RECOGNIZE", "SPEAK", "USE", "SURVIVE", "MATCH", "DIALOG", "FORM", "DIRECTIONS"]
errors = []

def err(msg):
    errors.append(msg)

def load(p):
    with open(os.path.join(ROOT, p)) as f:
        return json.load(f)

def norm(s):
    return (s or "").lower().replace("’", "'").strip()

def contains(text, kw):
    k = norm(kw)
    return bool(k) and re.search(r"(^|\W)" + re.escape(k) + r"($|\W)", text) is not None

def match_option(options, text):
    best, best_hits = -1, 0
    for i, o in enumerate(options):
        hits = sum(1 for k in o["keywords"] if contains(text, k))
        if hits > best_hits:
            best, best_hits = i, hits
    return best

def fill(t, facts):
    if t is None:
        return None
    return re.sub(r"\{(\w+)\}", lambda m: facts.get(m.group(1), m.group(0)), t)

def check_scenario(s, chapter):
    w = f"Scenario {s['slug']}: "
    if s.get("chapter") != chapter:
        err(w + f"belongs to {s.get('chapter')} but used by {chapter}")
    goals = s["goals"]
    if len(goals) < 5:
        err(w + "fewer than 5 goals")
    ids = set()
    for i, g in enumerate(goals):
        if g["id"] in ids:
            err(w + "dup goal " + g["id"])
        ids.add(g["id"])
        for k in ["instruction", "hint", "successReply", "retryReply"]:
            if not g.get(k):
                err(w + f"goal {g['id']} missing {k}")
        if not g.get("keywords"):
            err(w + f"goal {g['id']} no keywords")
        if i > 0 and not g.get("ask"):
            err(w + f"goal {g['id']} needs ask")
    tids = set()
    for t in s.get("twists", []):
        tids.add(t["id"])
        if len(t["options"]) < 2:
            err(w + "twist options")
    for slot in s.get("twistSlots", []):
        if slot["after"] not in ids:
            err(w + "slot after unknown " + slot["after"])
        if not set(slot["pool"]) <= tids:
            err(w + "slot unknown twist")
    if not s.get("twistSlots"):
        err(w + "no twist slots")
    if not s.get("facts"):
        err(w + "no facts")
    known = {"name"}
    for f in s.get("facts", []):
        if len(f["values"]) < 3:
            err(w + "fact values")
        known.add(f["id"])
    lines = [s.get("opening"), s.get("setting"), s.get("persona"), s.get("briefTr"), s.get("closing")]
    for g in goals:
        lines += [g.get(k) for k in ["ask", "hint", "hintTr", "successReply", "retryReply", "setting", "persona"]]
    for t in s.get("twists", []):
        lines += [t.get("intro"), t.get("retryReply")]
        for o in t["options"]:
            lines += [o["text"], o["reply"]]
    for l in lines:
        for m in re.findall(r"\{(\w+)\}", l or ""):
            if m not in known:
                err(w + "unknown placeholder {" + m + "}")
    facts = {f["id"]: f["values"][0] for f in s.get("facts", [])}
    facts["name"] = "Ozan"
    for g in goals:
        if not any(contains(norm(fill(g["hint"], facts)), k) for k in g["keywords"]):
            err(w + f"hint of {g['id']} fails judge: {g['hint']}")
    for t in s.get("twists", []):
        for i, o in enumerate(t["options"]):
            got = match_option(t["options"], norm(fill(o["text"], facts)))
            if got != i:
                err(w + f"twist {t['id']} option {i} judged as {got}: {o['text']}")

def check_lesson(c, info):
    w = f"Chapter {c['slug']}: "
    steps = c.get("steps")
    if not steps:
        err(w + "no steps")
        return
    for s in steps:
        if s not in STEPS:
            err(w + "unknown step " + s)
    if info["kind"] == "starter" and "SURVIVE" in steps:
        err(w + "starter with survive")
    if info["kind"] == "lesson" and steps[-1] != "SURVIVE":
        err(w + "lesson must end with SURVIVE")
    for k in ["mission", "missionTr", "stamp"]:
        if not c.get(k):
            err(w + "missing " + k)
    words = c.get("words", [])
    en = {x["en"] for x in words}
    if "DISCOVER" in steps and len(words) < 5:
        err(w + "needs 5+ words")
    for x in words:
        if x.get("picture") and x["picture"] not in PICTURES:
            err(w + "unknown picture " + x["picture"])
    if "MATCH" in steps:
        m = c.get("match") or [x["en"] for x in words][:6]
        if len(m) < 4:
            err(w + "match needs 4+")
        for x in m:
            if x not in en:
                err(w + "match word not in words: " + x)
    if "PRONOUNCE" in steps and not c.get("pronounce"):
        err(w + "no pronounce")
    if "RECOGNIZE" in steps:
        for q in c.get("recognize", []):
            if not (0 <= q["answer"] < len(q["options"])):
                err(w + "recognize answer")
        if not c.get("recognize"):
            err(w + "no recognize")
    if "DIALOG" in steps:
        d = c.get("dialog")
        gaps = [l for l in d["lines"] if l.get("gap")]
        if len(gaps) < 2:
            err(w + "dialog needs 2+ gaps")
        for l in gaps:
            if "___" not in l["text"] or l["gap"] not in l["options"]:
                err(w + "bad gap " + l["text"])
    if "FORM" in steps:
        for f in c["form"]["fields"]:
            if not (0 <= f["answer"] < len(f["options"])):
                err(w + "form answer")
    if "USE" in steps:
        u = c["use"]
        joined = " ".join(u["tiles"]).replace(" ?", "?").replace(" .", ".").replace(" ,", ",")
        if joined != u["phrase"]:
            err(w + f"tiles {joined!r} != phrase {u['phrase']!r}")
    if "SPEAK" in steps:
        sp = c["speak"]
        if sp["answer"] not in sp["accept"] and sp["answer"].lower() not in [a.lower() for a in sp["accept"]]:
            err(w + "speak answer not accepted")
    if "SURVIVE" in steps:
        s = load("scenarios/" + c["survive"]["scenario"] + ".json")
        check_scenario(s, c["slug"])

def _pictures():
    src = open(os.path.join(ROOT, '..', 'mobile', 'src', 'components', 'Picture.tsx')).read()
    return set(re.findall(r"^  '?([a-z0-9-]+)'?:", src[src.index('const DRAWINGS'):], re.M))
PICTURES = _pictures()
manifest = load("manifest.json")
stops = {s["slug"]: s for s in manifest["stops"]}
seen = set()
for info in manifest["chapters"]:
    if info["kind"] == "lesson":
        key = (info["stop"], info["week"])
        if key in seen:
            err("dup stop/week " + str(key))
        seen.add(key)
        if info["day"] != (info["week"] - 1) * 7 + stops[info["stop"]]["order"]:
            err("bad day " + info["slug"])
    path = os.path.join(ROOT, "chapters", info["slug"] + ".json")
    if info["available"]:
        c = load("chapters/" + info["slug"] + ".json")
        if c["slug"] != info["slug"]:
            err("slug mismatch " + info["slug"])
        if info["kind"] == "simulation":
            check_scenario(load("scenarios/" + c["survive"]["scenario"] + ".json"), info["slug"])
        else:
            check_lesson(c, info)
    elif os.path.exists(path):
        c = load("chapters/" + info["slug"] + ".json")
        if not c.get("draft"):
            err(info["slug"] + " unavailable but not marked draft")
if len(seen) != 21:
    err(f"expected 21 stop/week lessons, got {len(seen)}")
print("\n".join(errors) if errors else "content OK")
sys.exit(1 if errors else 0)
