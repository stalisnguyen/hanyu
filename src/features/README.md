# Feature modules

Each `*.js` file here is pasted (in filename order) inside the app's closure in `src/app.js`, right before the boot section, by `build.py`. So a module can use every helper of `app.js` directly and must NOT wrap itself in its own IIFE or use import/export. Keep top-level names prefixed to avoid clashes (e.g. `GM_` for games, `PT_` for pitch).

Register a view: `VIEWS.games = renderGames;` (a function `(el) => {}` that fills `el.innerHTML`). Add the nav button in `src/shell.html` (`<button data-v="games">Trò chơi</button>`). Navigate with `go('games')`.

## Helpers available (from app.js)
- DOM: `$(sel, root)`, `$$(sel, root)` (array), `esc(str)`, `toast(msg)`, `modal(html)` -> `{el, close}`
- Random: `shuffle(arr)`, `pick(arr)`
- Dates: `DAY`, `today()` (midnight ms), `ymd(ms)` -> 'YYYY-MM-DD'
- Chinese: `isHan(c)`, `toneOf(pinyinSyllable)` -> 1..5, `stripTone(s)` (toneless, ü->v, lowercase), `viFold(s)` (strip Vietnamese accents)
- Pinyin of any text: `pyChars(text)` -> [{c, p}], `rubyHTML(text)`, `colorText(text)` (tone-colored hanzi), `pyLine(text)`, `sentPyHTML(pinyinString)`
- Words: `W` (array of all loaded words), `WI` (Map hanzi -> word). word = `{h, p:[syllables], hv, vi, em, ex, exp, exvi, cl, lv, i}`; `hanHTML(w)`, `pyHTML(w)`; `loadAllWords()` (await before relying on all levels)
- Progress: `P` (state; `P.settings.lv` levels array, `P.settings.voiceRate`, `P.hist[ymd]` count of reviews/day), `touch('main')` persists P (local + sync). Add your own sub-object on P, e.g. `P.games = P.games || {}` then `touch('main')`.
- SRS: `P.srs[h]` card `{iv,ef,n,l,due,s}`, `seen(h)`, `known(h)`, `schedule(h, r)` r=0..3
- Audio: `sayWord(h)` (native recording if available, else TTS), `saySyl('ma3')` -> Promise<bool> (native syllable recording, ü written as v), `say(text, {rate})` (TTS sentence), `speak(text)`, `stopSay()`, `audioURL(kind,key,lv)` / `audioIndex()` (internal)
- UI: `levelChips(selectedArray, onChange, {multi, id})` returns HTML string; `subTabs(id, [[key,label]], cur, onPick)` returns HTML; `skillLv()` highest selected level
- Speech hint: `SPK` speaker svg string. Any element with `data-say="text"` plays on click; `data-syl="ma3"` plays a native syllable.
- XP hook (provided by 10-plan.js): call `award(kind, n)` after a meaningful learning action, kind in 'review','listen','speak','read','write','grammar','test','game','culture'. It is defined before games/pitch modules load only if filename sorts earlier, so call it as `window.__award && window.__award(kind,n)` to be safe.

## CSS
Add your styles to `src/app.css` (append at end, prefixed class names). Use only the existing tokens: --bg --surface --sunk --line --line2 --ink --muted --accent --accent-ink --accent-soft --t1..--t5 (tone colors) --ok --bad --warn, fonts --f-han --f-body --f-py. Both light and dark themes must work. Mobile width 390px must not scroll horizontally.

## Rules
- Vietnamese UI text, plain and natural; no em dash, no unicode arrows.
- No alert/confirm/prompt. No external network calls besides existing helpers.
- Test: `python3 build.py` then the headless smoke test pattern in /tmp/claude-0/t3.py (serve /home/claude/hanyu with `python3 -m http.server 8765`, CDN scripts are routed to local copies in /home/claude/work_build/node_modules). Check no page errors and take a screenshot of your view (desktop and 390px wide) and look at it.
