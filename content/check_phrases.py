import json, sys, re
path = sys.argv[1]; want = {'dp': int(sys.argv[2]), 'cy': int(sys.argv[3])}
exist = set(open('/home/claude/hanyu/content/existing_words.txt', encoding='utf-8').read().split('\n'))
out = json.load(open(path, encoding='utf-8'))
HAN = re.compile(r'^[一-鿿]+$')
TONE = re.compile(r'[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]')
err = []; seen = set(); cnt = {'dp': 0, 'cy': 0}
for i, b in enumerate(out):
    h = str(b.get('h', '')); tag = h or f'#{i}'
    for k in ['deck', 'h', 'p', 'hv', 'vi', 'note', 'ex', 'exp', 'exvi']:
        if not str(b.get(k, '')).strip(): err.append(f'{tag}: empty {k}')
    if 'em' not in b: err.append(f'{tag}: missing em')
    d = b.get('deck')
    if d not in cnt: err.append(f'{tag}: bad deck'); continue
    cnt[d] += 1
    if not HAN.match(h): err.append(f'{tag}: h must be Han characters only')
    if d == 'cy' and len(h) != 4: err.append(f'{tag}: cy must be 4 characters')
    if d == 'dp' and not 2 <= len(h) <= 6: err.append(f'{tag}: dp should be 2-6 characters')
    if d == 'cy' and not str(b.get('vi', '')).startswith('(thành ngữ) '): err.append(f'{tag}: cy vi must start with "(thành ngữ) "')
    ps = str(b.get('p', '')).split(' '); hv = str(b.get('hv', '')).split(' ')
    if len(ps) != len(h): err.append(f'{tag}: pinyin syllables {len(ps)} != characters {len(h)}')
    if len(hv) != len(h): err.append(f'{tag}: hv syllables {len(hv)} != characters {len(h)}')
    if b.get('p') != str(b.get('p')).lower(): err.append(f'{tag}: pinyin must be lowercase')
    if not all(TONE.search(s) or s in ('de', 'le', 'me', 'ne', 'ba', 'ma', 'zi', 'men', 'ge', 'shang', 'xia', 'li', 'tou', 'guo', 'zhe', 'qi', 'lai', 'qu', 'r') for s in ps):
        err.append(f'{tag}: pinyin syllable without tone mark (neutral tone only for real neutral syllables)')
    if not isinstance(b.get('alt'), list) or not 2 <= len(b['alt']) <= 3: err.append(f'{tag}: alt needs 2-3 items')
    if b.get('hsk') not in (2, 3, 4, 5, 6, 7): err.append(f'{tag}: hsk must be 2-7')
    if h in seen: err.append(f'{tag}: duplicate')
    seen.add(h)
    if h in exist: err.append(f'{tag}: already in the app')
    ex = str(b.get('ex', ''))
    if h not in ex: err.append(f'{tag}: example must contain the phrase exactly')
    n = len(re.findall(r'[一-鿿]', ex))
    if not 8 <= n <= 28: err.append(f'{tag}: example has {n} characters, want 8-25')
    if not TONE.search(str(b.get('exp', ''))): err.append(f'{tag}: exp needs tone marks')
    for f in ['vi', 'note', 'exvi', 'hv']:
        s = str(b.get(f, ''))
        if '—' in s or '·' in s or re.search('[←-⇿]', s): err.append(f'{tag}: dash/arrow/dot in {f}')
for d, n in want.items():
    if cnt[d] != n: err.append(f'deck {d}: {cnt[d]} items, want {n}')
print('OK' if not err else '\n'.join(err[:60] + ([f'... {len(err)} problems'] if len(err) > 60 else [])))
