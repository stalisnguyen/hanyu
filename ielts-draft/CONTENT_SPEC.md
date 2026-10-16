# Owlis IELTS content spec

App: a web app for Vietnamese learners preparing for IELTS (Academic and General Training), band 4.5 to 8. All learner-facing explanations are in Vietnamese; all exam material is in English.

## Shared rules (all content)
- Original content written for this project. Do not copy passages, questions or model answers from Cambridge IELTS books, ielts.org, IDP, British Council or any other published source. Mimic the official format and difficulty only.
- English: natural, accurate, British spelling (organise, colour, centre), realistic IELTS register and difficulty.
- Vietnamese: natural everyday Vietnamese, plain and clear. Never use the em dash character (—) or unicode arrows (→ ← ↔); write "->" if needed.
- Answers must be verifiably correct from the text. Explanations ("why") in Vietnamese quote or point to the exact evidence.
- Output files: valid JSON (UTF-8). Build them with a Python script if convenient. Validate with
  `python3 /home/claude/ib/check_content.py <kind> <file>` until it prints OK.
- Reply when done with only: what you produced (counts) and anything you were unsure about.

## kind=reading  (file holds a JSON array of passages)
Passage object:
```
{"id":"a1p1", "type":"academic"|"general", "test":1, "section":1, "title":"...", "topic":"...", "band":"5.5-6.5",
 "paras":[["A","paragraph text"],["B","..."]],            // label paragraphs A, B, C... (GT short texts may be labelled A-E as separate notices/ads)
 "groups":[ { "kind":K, "instr":"exact IELTS-style instructions incl. word limits", "opts":[...optional shared options...],
              "items":[ {"q":"...", "a":ANSWER, "o":[...only for mcq...], "why":"Vietnamese explanation with evidence", "para":"C"} ] } ],
 "vocab":[["word or phrase","nghĩa tiếng Việt"], ... 8-12 useful items from the passage]}
```
Question kinds K and answer formats:
- "tfng": statements; a = "TRUE" | "FALSE" | "NOT GIVEN".
- "ynng": writer's views; a = "YES" | "NO" | "NOT GIVEN".
- "mcq": q = question stem, o = 4 options (text only, no "A." prefix), a = index 0-3.
- "headings": opts = list of headings (text only, more headings than paragraphs), q = "Paragraph B", a = index into opts (0-based).
- "matchinfo": q = a piece of information; a = paragraph letter "C" (state "You may use any letter more than once" in instr if so).
- "matchfeat": opts = list of people/features (text only), q = statement, a = index into opts.
- "sentcomp" | "sumcomp" | "notecomp" | "shortans": q contains "___" where the answer goes (shortans: a question); a = the answer as it appears in the passage, alternatives separated by "|" (e.g. "carbon dioxide|CO2"); respect the word limit in instr.
Academic passage: 750-950 words, 13-14 questions in 3 groups, at least 3 different kinds; difficulty rises from section 1 to 3. Section 3 should include a "ynng" or "mcq" about the writer's argument. General Training: section 1 = 2-3 short everyday texts (notices, ads, timetables; 400-550 words total, 14 questions), section 2 = work-related texts (450-600 words, 13 questions), section 3 = one longer general-interest text (700-850 words, 13 questions).

## kind=listening  (file holds a JSON array of parts)
```
{"id":"l1p1", "test":1, "part":1, "title":"...", "setting":"Vietnamese one-line description of the situation",
 "speakers":[{"id":"A","name":"Receptionist","voice":"f"|"m","accent":"en-GB"|"en-AU"|"en-US"}],
 "lines":[["A","spoken text"],["B","..."]],               // the full script; part 4 is a monologue with one speaker
 "groups":[{"kind":K,"instr":"exact instructions incl. word limit","opts":[...],"items":[{"q":"...","a":ANSWER,"o":[...],"why":"Vietnamese, quote the line"}]}]}
```
Kinds: "form" | "note" | "table" | "sentcomp" (q with "___", a = words heard, alternatives with "|", numbers as digits e.g. "45|forty-five"), "mcq" (o = 3 options, a = index), "matching" (opts = shared options list, a = index), "multi" (choose TWO: o = 5 options, a = [i, j]; counts as 2 questions).
Each part has exactly 10 questions (a "multi" item counts 2). Answers appear in the script in question order. Include realistic distractors (a speaker corrects themselves, a number changes, etc.). Spell names letter by letter when the answer is a name ("That's B-R-A-D-L-E-Y"). Part 1: everyday conversation (two speakers), part 2: monologue on an everyday topic, part 3: academic discussion (2-3 speakers), part 4: academic lecture (monologue). Script length: part 1 ~550-700 words, part 2 ~600-750, part 3 ~650-800, part 4 ~700-850. Lines are short enough to be read by text-to-speech one by one (max ~45 words per line). Mix accents across the test.

## kind=writing1a  (array; Academic Task 1)
```
{"id":"w1a01","title":"...", "chart":CHART, "prompt":"The chart below shows ... Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
 "model":"band 8-9 answer, 170-200 words, paragraphs separated by \n\n", "overview":"the overview sentence copied from the model",
 "notes":"Vietnamese: structure (intro, overview, 2 body paragraphs), what to group, key comparisons", "phrases":[["useful phrase","nghĩa / cách dùng"] x6-8]}
```
CHART: {"type":"line"|"bar"|"pie"|"table","title":"...","unit":"%"|"million tonnes"|..., "x":["2000","2005",...] (categories), "series":[{"name":"...","values":[numbers matching x]}]}
- pie: x = slice labels, one series per pie (1-2 pies).  table: x = row labels, series = columns.
- or {"type":"process","title":"...","steps":["step 1 text", ...8-12]}  or {"type":"map","title":"...","before":{"year":"1990","items":["..."]},"after":{"year":"2020","items":["..."]}} (describe features as short text items).
Data must be internally consistent and the model must match the numbers exactly.

## kind=writing1g  (array; General Training Task 1 letters)
```
{"id":"w1g01","tone":"formal"|"semi-formal"|"informal","prompt":"You ... Write a letter to ... In your letter\n- ...\n- ...\n- ...\nWrite at least 150 words. You do NOT need to write any addresses. Begin your letter as follows: Dear ...,",
 "model":"160-190 words", "notes":"Vietnamese: tone, opening/closing, how each bullet is covered", "phrases":[["phrase","cách dùng"] x6]}
```

## kind=writing2  (array; Task 2, shared by Academic and GT)
```
{"id":"w2x01","type":"opinion"|"discussion"|"advantages"|"problem-solution"|"two-part","topic":"education|environment|technology|health|work|crime|government|media|culture|globalisation|transport|family|tourism|city",
 "prompt":"exact prompt ending with: Give reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
 "outline":"Vietnamese: position, paragraph plan, main ideas", "ideas":{"for":["..."],"against":["..."]},
 "model":"band 8 essay, 270-310 words, 4-5 paragraphs separated by \n\n", "vocab":[["topic word/phrase","nghĩa"] x8]}
```

## kind=speaking  (one JSON object)
```
{"p1":[{"topic":"Hometown","qs":["...",4-5 questions],"samples":[["question","natural band 7-8 answer, 35-60 words"] x2]}],
 "p2":[{"id":"s2_01","card":"Describe a ...","bullets":["You should say:", "...","...","..."],"explain":"and explain ...","topic":"person|place|object|event|experience|activity|media",
        "sample":"band 8 answer, 230-280 words, spoken style", "vocab":[["phrase","nghĩa"] x6],
        "p3":["discussion question", x5], "p3samples":[["question","band 8 answer 60-90 words"] x2]}]}
```

## kind=grammar  (array)
```
{"id":"g01","lv":1|2|3,"cat":"Thì|Câu phức|Câu điều kiện|Bị động|Mạo từ|So sánh|Liên từ|Mệnh đề quan hệ|Danh từ|Giới từ|Văn phong học thuật|...","title":"Vietnamese title","en":"English name",
 "form":"short formula", "explain":"Vietnamese explanation, 2-5 sentences", "ex":[["English example","nghĩa"] x3-4],
 "mistakes":[["wrong sentence typical of Vietnamese learners","corrected sentence","Vietnamese why"] x2-3], "ielts":"Vietnamese: how/where using this raises the Grammatical Range and Accuracy score",
 "quiz":[{"s":"sentence with ___","o":["4 options"],"a":0,"w":"Vietnamese explanation"} x4], "fix":[{"s":"sentence with one error","a":"corrected sentence","w":"Vietnamese"} x2]}
```
lv 1 = band 5 foundations, lv 2 = band 6-6.5, lv 3 = band 7+.

## kind=pron  (one JSON object)
```
{"sounds":[{"ipa":"iː","type":"vowel"|"diphthong"|"consonant","name":"long ee","ex":["sheep","eat","people"],"how":"Vietnamese: mouth/tongue position","vn":"Vietnamese: typical problem for Vietnamese speakers (or empty)","pairs":[["ship","sheep"]]}  // all 44 sounds of British English
 ],
 "rules":[{"id":"ed","title":"Vietnamese title","body":"Vietnamese explanation","examples":[["word or phrase","IPA or note"]],"quiz":[{"q":"...","o":["..."],"a":0,"w":"Vietnamese"} x3]}],
 "minimal":[{"id":"i_ii","contrast":"/ɪ/ vs /iː/","pairs":[["ship","sheep"], x8 real word pairs]}]}
```
Rules to include (at least): -s/-es endings, -ed endings, final consonants (Vietnamese learners drop them), consonant clusters, /θ/ /ð/, /ʃ/ vs /s/, /l/ vs /n/, word stress by suffix, word stress noun vs verb (record), sentence stress and weak forms (schwa), linking, intonation (questions, lists), silent letters, contractions. At least 15 minimal-pair sets.

## kind=daily  (array, 150 items, one per day)
```
{"id":"d001","cat":"idiom"|"collocation"|"phrasal"|"tip"|"mistake"|"fact","title":"short Vietnamese or English title","en":"the expression or tip in English (for tip/fact: one line)","vi":"Vietnamese explanation 1-3 sentences",
 "ex":["English example","nghĩa"], "q":{"q":"quick question","o":["3-4 options"],"a":0}}
```
Mix categories evenly; "tip" = practical IELTS exam strategy, "mistake" = common Vietnamese learner error, "fact" = interesting fact about English or the IELTS test. Interleave categories so consecutive days differ.

## kind=topicvocab  (array; band 7+ topic vocabulary)
Same object shape as the vocabulary spec: {"w","ipa","pos","vi","ex","exvi","col":[2-3],"fam","em"} plus "topic" (English topic name) and "lv": 4. "w" may be a word or a short fixed phrase ("renewable energy", "brain drain"). Choose genuinely band 7-8 items useful for Writing Task 2 and Speaking Part 3 on that topic; avoid basic words. 30 items per topic, no duplicates across topics.
