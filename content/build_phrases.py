"""Build data/words-8.json (搭配) and data/words-9.json (成语) from content/out/phr/*.json.
Rows use the word format plus [9] note and [10] alt. words-9 also lists the 成语 already in HSK 7-9 so the deck covers them;
the app merges those with the HSK 7-9 entry (one card, two decks).
Run: python3 content/build_phrases.py"""
import json, glob
from pathlib import Path
root = Path(__file__).resolve().parent.parent
exist = {}
for i in range(1, 8):
    for r in json.load(open(root / f'data/words-{i}.json', encoding='utf-8')): exist.setdefault(r[0], r)
items, seen = {'dp': [], 'cy': []}, set()
for f in sorted(glob.glob(str(root / 'content/out/phr/*.json'))):
    for x in json.load(open(f, encoding='utf-8')):
        if x['h'] in seen or x['h'] in exist: continue
        seen.add(x['h']); items[x['deck']].append(x)
row = lambda x: [x['h'], x['p'], x['hv'], x['vi'], x.get('em', ''), x['ex'], x['exp'], x['exvi'], [], x['note'], x['alt']]
for deck, L in (('dp', 8), ('cy', 9)):
    rows = [row(x) for x in sorted(items[deck], key=lambda x: x['hsk'])]
    if deck == 'cy':
        rows += [r[:9] for r in exist.values() if str(r[3]).startswith('(thành ngữ)')]
    (root / f'data/words-{L}.json').write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'words-{L}.json', len(rows), 'rows,', len(items[deck]), 'new')
