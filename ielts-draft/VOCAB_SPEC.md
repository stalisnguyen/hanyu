# IELTS vocabulary enrichment spec (Vietnamese learners)

Input batch: JSON array, each item {"w": English lemma, "lv": 1|2|3, "ipa": British IPA from an open dictionary (may be wrong for some words)}.
lv 1 = core general words (band 4.5-5.5), lv 2 = upper general words (band 5.5-6.5), lv 3 = academic words from the New Academic Word List (band 6.5-7.5).

Output: one JSON array, exactly one object per input item, same order, keys:
- "w": same as input
- "ipa": British (RP) IPA with slashes and stress mark, e.g. "/ɪnˈvaɪrənmənt/". Keep the input if correct, fix it if not.
- "pos": main part(s) of speech, short English abbreviations: "n", "v", "adj", "adv", "prep", "conj", "pron", "det", "phr", "n, v" (most useful first).
- "vi": concise natural Vietnamese meaning, 1-3 senses separated by "; ", the sense most useful for IELTS first. Add "(n)" / "(v)" markers only when the word has two common parts of speech with different meanings.
- "ex": one natural example sentence in English, 8-20 words, IELTS-style (education, work, environment, technology, health, society, travel, science...), using the word (any inflected form) in the main sense.
- "exvi": natural Vietnamese translation of the example.
- "col": array of 2-3 common collocations or phrases with the word, e.g. ["make a decision", "a difficult decision"]. Real, frequent ones only.
- "fam": word family, other useful forms with POS, e.g. "decide (v), decision (n), decisive (adj), decisively (adv)". "" if none.
- "em": one emoji only when the word is concrete and clearly depicted (animal, food, object, place, weather, body part, clear action), else "".

Rules
- Vietnamese text: no em dash character, no unicode arrows, plain everyday Vietnamese.
- Final file must be one valid JSON array. Verify with:
  python3 /home/claude/ib/check_vocab.py <input> <output>
  It must print OK. Fix whatever it reports and re-run until OK.
- Build it however is convenient (e.g. a Python script appending chunks), but write real content for every item; no placeholders.
- Reply when done with only: the item count and any words you were unsure about.
