"""Validate Owlis content files. Usage: python3 check_content.py <kind> <file>"""
import json, re, sys

kind, path = sys.argv[1], sys.argv[2]
err = []
try:
    D = json.load(open(path, encoding="utf-8"))
except Exception as e:
    print("INVALID JSON:", e); sys.exit(1)

def bad_chars(s, where):
    if "—" in s: err.append(f"{where}: em dash")
    if re.search("[←-⇿]", s): err.append(f"{where}: unicode arrow")

def walk(x, where="root"):
    if isinstance(x, str): bad_chars(x, where)
    elif isinstance(x, list): [walk(v, f"{where}[{i}]") for i, v in enumerate(x)]
    elif isinstance(x, dict): [walk(v, f"{where}.{k}") for k, v in x.items()]
walk(D)

def need(o, keys, where):
    for k in keys:
        if k not in o or o[k] in ("", None, []): err.append(f"{where}: missing {k}")

def words(s): return len(re.findall(r"[A-Za-z']+", s))
def norm(s): return re.sub(r"[^a-z0-9 ]", " ", s.lower())

def check_items(g, where, text, nq_counter, listening=False):
    k = g.get("kind")
    need(g, ["kind", "instr", "items"], where)
    for j, it in enumerate(g.get("items", [])):
        w = f"{where}.items[{j}]"
        need(it, ["q", "why"], w)
        a = it.get("a")
        if a is None or a == "": err.append(f"{w}: missing a")
        if k in ("tfng",) and a not in ("TRUE", "FALSE", "NOT GIVEN"): err.append(f"{w}: tfng answer {a}")
        if k in ("ynng",) and a not in ("YES", "NO", "NOT GIVEN"): err.append(f"{w}: ynng answer {a}")
        if k == "mcq":
            o = it.get("o") or []
            if len(o) < 3 or not isinstance(a, int) or not 0 <= a < len(o): err.append(f"{w}: mcq needs o and int a")
        if k in ("headings", "matchfeat", "matching"):
            opts = g.get("opts") or []
            if not isinstance(a, int) or not 0 <= a < len(opts): err.append(f"{w}: {k} needs int a into opts")
        if k == "matchinfo" and not (isinstance(a, str) and re.fullmatch(r"[A-J]", a)): err.append(f"{w}: matchinfo a must be a letter")
        if k == "multi":
            o = it.get("o") or []
            if not (isinstance(a, list) and len(a) == 2 and all(isinstance(x, int) and 0 <= x < len(o) for x in a)): err.append(f"{w}: multi needs a=[i,j]")
        if k in ("sentcomp", "sumcomp", "notecomp", "shortans", "form", "note", "table"):
            if not isinstance(a, str): err.append(f"{w}: answer must be string"); continue
            if k != "shortans" and "___" not in it.get("q", ""): err.append(f"{w}: q needs ___")
            alts = [x.strip() for x in a.split("|") if x.strip()]
            if not any(norm(x).strip() and norm(x).strip() in norm(text) for x in alts):
                err.append(f"{w}: answer '{a}' not found verbatim in the {'script' if listening else 'passage'}")
        nq_counter[0] += 2 if k == "multi" else 1

if kind == "reading":
    if not isinstance(D, list): err.append("root must be array")
    for i, p in enumerate(D if isinstance(D, list) else []):
        w = f"passage {p.get('id', i)}"
        need(p, ["id", "type", "test", "section", "title", "paras", "groups", "vocab"], w)
        text = " ".join(t for _, t in p.get("paras", []))
        n = words(text)
        lim = {("academic", 1): (700, 1000), ("academic", 2): (700, 1000), ("academic", 3): (700, 1050),
               ("general", 1): (350, 650), ("general", 2): (400, 700), ("general", 3): (650, 950)}.get((p.get("type"), p.get("section")), (300, 1100))
        if not lim[0] <= n <= lim[1]: err.append(f"{w}: {n} words, expected {lim}")
        cnt = [0]
        for gi, g in enumerate(p.get("groups", [])): check_items(g, f"{w}.groups[{gi}]", text, cnt)
        if not 12 <= cnt[0] <= 15: err.append(f"{w}: {cnt[0]} questions, expected 13-14")
        if len({g.get('kind') for g in p.get('groups', [])}) < 2: err.append(f"{w}: use at least 2-3 question kinds")
elif kind == "listening":
    for i, p in enumerate(D):
        w = f"part {p.get('id', i)}"
        need(p, ["id", "test", "part", "title", "setting", "speakers", "lines", "groups"], w)
        ids = {s.get("id") for s in p.get("speakers", [])}
        for s in p.get("speakers", []):
            if s.get("voice") not in ("f", "m") or s.get("accent") not in ("en-GB", "en-AU", "en-US"): err.append(f"{w}: speaker voice/accent")
        for li, (sp, t) in enumerate(p.get("lines", [])):
            if sp not in ids: err.append(f"{w}: line {li} unknown speaker {sp}")
            if words(t) > 60: err.append(f"{w}: line {li} too long ({words(t)} words)")
        text = " ".join(t for _, t in p.get("lines", []))
        n = words(text)
        if not 450 <= n <= 950: err.append(f"{w}: script {n} words")
        cnt = [0]
        for gi, g in enumerate(p.get("groups", [])): check_items(g, f"{w}.groups[{gi}]", text, cnt, True)
        if cnt[0] != 10: err.append(f"{w}: {cnt[0]} questions, expected 10")
elif kind == "writing1a":
    for i, t in enumerate(D):
        w = f"task {t.get('id', i)}"
        need(t, ["id", "title", "chart", "prompt", "model", "overview", "notes", "phrases"], w)
        c = t.get("chart", {})
        if c.get("type") in ("line", "bar", "pie", "table"):
            for s in c.get("series", []):
                if len(s.get("values", [])) != len(c.get("x", [])): err.append(f"{w}: series '{s.get('name')}' length != x")
        elif c.get("type") == "process":
            if len(c.get("steps", [])) < 5: err.append(f"{w}: process needs steps")
        elif c.get("type") == "map":
            need(c, ["before", "after"], w)
        else: err.append(f"{w}: chart type")
        n = words(t.get("model", ""))
        if not 160 <= n <= 230: err.append(f"{w}: model {n} words")
elif kind == "writing1g":
    for i, t in enumerate(D):
        w = f"letter {t.get('id', i)}"
        need(t, ["id", "tone", "prompt", "model", "notes", "phrases"], w)
        n = words(t.get("model", ""))
        if not 150 <= n <= 210: err.append(f"{w}: model {n} words")
elif kind == "writing2":
    for i, t in enumerate(D):
        w = f"essay {t.get('id', i)}"
        need(t, ["id", "type", "topic", "prompt", "outline", "ideas", "model", "vocab"], w)
        n = words(t.get("model", ""))
        if not 255 <= n <= 340: err.append(f"{w}: model {n} words")
elif kind == "speaking":
    need(D, ["p1", "p2"], "root")
    for i, t in enumerate(D.get("p1", [])): need(t, ["topic", "qs", "samples"], f"p1[{i}]")
    for i, t in enumerate(D.get("p2", [])):
        w = f"p2 {t.get('id', i)}"
        need(t, ["id", "card", "bullets", "explain", "topic", "sample", "vocab", "p3", "p3samples"], w)
        n = words(t.get("sample", ""))
        if not 200 <= n <= 320: err.append(f"{w}: sample {n} words")
elif kind == "grammar":
    for i, g in enumerate(D):
        w = f"grammar {g.get('id', i)}"
        need(g, ["id", "lv", "cat", "title", "en", "form", "explain", "ex", "mistakes", "ielts", "quiz", "fix"], w)
        for q in g.get("quiz", []):
            if not (isinstance(q.get("a"), int) and 0 <= q["a"] < len(q.get("o", []))): err.append(f"{w}: quiz answer index")
            if "___" not in q.get("s", ""): err.append(f"{w}: quiz s needs ___")
elif kind == "pron":
    need(D, ["sounds", "rules", "minimal"], "root")
    if len(D.get("sounds", [])) < 44: err.append(f"sounds: {len(D.get('sounds', []))}, expected 44")
    if len(D.get("minimal", [])) < 15: err.append("minimal: expected >= 15 sets")
    for r in D.get("rules", []):
        for q in r.get("quiz", []):
            if not (isinstance(q.get("a"), int) and 0 <= q["a"] < len(q.get("o", []))): err.append(f"rule {r.get('id')}: quiz answer index")
elif kind == "daily":
    if len(D) < 150: err.append(f"{len(D)} items, expected 150")
    for i, d in enumerate(D):
        w = f"daily {d.get('id', i)}"
        need(d, ["id", "cat", "title", "en", "vi", "ex", "q"], w)
        q = d.get("q", {})
        if not (isinstance(q.get("a"), int) and 0 <= q["a"] < len(q.get("o", []))): err.append(f"{w}: q answer index")
elif kind == "topicvocab":
    seen = set()
    for i, v in enumerate(D):
        w = f"item {v.get('w', i)}"
        need(v, ["w", "ipa", "pos", "vi", "ex", "exvi", "col", "topic"], w)
        if v.get("w", "").lower() in seen: err.append(f"{w}: duplicate")
        seen.add(v.get("w", "").lower())
        if not str(v.get("ipa", "")).startswith("/"): err.append(f"{w}: ipa in slashes")
else:
    err.append("unknown kind")

print("OK" if not err else "\n".join(err[:80] + ([f"... {len(err)} problems"] if len(err) > 80 else [])))
