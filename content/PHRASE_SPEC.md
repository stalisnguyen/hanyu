# Stalong phrase decks spec - 搭配 (collocations) and 成语 (idioms) for Vietnamese learners

Use common teaching references (HSK 标准教程, 汉语搭配词典-style usage, frequent 成语 lists) only as a guide to what is common and useful. Write every explanation and example yourself; do not copy sentences or definitions from books or websites.

## Output

One JSON array at the output path you are given. Each object:

- "deck": "dp" (搭配, a common word combination) or "cy" (成语, four-character idiom).
- "h": the phrase in simplified Chinese, Han characters only, no spaces, no punctuation, no "..." slots. For "dp" write a concrete, complete combination, 3-6 characters, e.g. 提高水平, 解决问题, 养成习惯, 发挥作用, 感兴趣 is NOT allowed alone (write 对历史感兴趣 instead only if it is a fixed pattern; prefer verb-object or adjective-noun pairs). For "cy": exactly 4 characters.
- "p": Hanyu Pinyin with tone marks, one syllable per character, separated by single spaces, lowercase, e.g. "tí gāo shuǐ píng". The number of syllables must equal the number of characters. Use the tone of the character as actually read in this phrase (一/不 tone sandhi written as read: "yí", "bú" where they change).
- "hv": Hán Việt reading, one syllable per character, lowercase, separated by spaces, e.g. "đề cao thủy bình". Same count as characters.
- "vi": short natural Vietnamese meaning, 1-2 senses separated by "; ". For "cy" start with "(thành ngữ) ".
- "note": one or two Vietnamese sentences. For "cy": nghĩa đen từng chữ hoặc điển tích ngắn, rồi dùng khi nào (khen/chê, trang trọng/khẩu ngữ). For "dp": cách kết hợp và lỗi người Việt hay mắc nếu có thật (ví dụ: "Không nói 提高生活, nói 提高生活水平").
- "alt": array of 2-3 related items: for "dp" other common objects/partners of the same word as complete phrases (e.g. 提高效率, 提高质量); for "cy" a near-synonym or opposite 成语 or a plain-language equivalent. Real, common Chinese only.
- "hsk": the HSK level (2-7, where 7 means 7-9) at which a learner can understand this phrase.
- "ex": one natural example sentence in simplified Chinese, 8-25 characters, containing the phrase exactly as written in "h", everyday or HSK-exam style.
- "exp": pinyin of the example with tone marks, words joined as in normal pinyin text (e.g. "Wǒ xiǎng tígāo Hànyǔ shuǐpíng."), first letter capitalised.
- "exvi": natural Vietnamese translation of the example.
- "em": one emoji only when it clearly depicts the meaning, else "".

## Rules

- Topic, counts and level focus are given in your task. Prefer high-frequency, genuinely useful items. Learners are around HSK 3-5, so most "dp" items should use HSK 2-5 words.
- Nothing listed in /home/claude/hanyu/content/existing_words.txt (already in the app) and no duplicates in your file.
- Vietnamese: plain everyday Vietnamese, no em dash, no unicode arrows, no "·".
- Verify with: python3 /home/claude/hanyu/content/check_phrases.py <output.json> <dp count> <cy count>
  It must print OK. Fix what it reports and re-run.
- Reply only with the count per deck and any items you were unsure about.
