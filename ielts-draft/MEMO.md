# Catalis (IELTS app) - memo để làm tiếp ở session khác

Trạng thái ngày 2026-10-16. Nhánh này (`ielts-content` trong repo stalisnguyen/hanyu) chỉ để giữ nội dung đã soạn; app IELTS sẽ nằm ở repo riêng.

## Quyết định đã chốt
- Người học: cả nhóm, nhiều trình độ (band 4.5 -> 8), có bài xếp lớp, lộ trình theo band, bảng bạn học như Stalong.
- Thi cả Academic và General Training (chọn trong app).
- Hạ tầng: repo private MỚI + project Vercel riêng, dùng lại cách của hanyu: Groq (trợ lý AI, GROQ_API_KEY), Upstash Redis (đồng bộ), APP_PASSWORD nhóm, hồ sơ theo tên + PIN, api/board.
- Tên: **Catalis** (cat + Stalis, chơi chữ "catalyst": chất xúc tác giúp tăng band), tagline "Stalis's IELTS". Stalis không thích cú, chọn mèo.
- Linh vật: mèo con lông cam tên **Mít**, vẽ SVG trong `ielts-draft/mascot_cat.js` (hàm `catSVG(state,size,rank)`, 7 trạng thái calm/hi/idea/yay/ok/hmm/zzz), ảnh xem trước `mascot_cat_preview.png`. Màu app: xanh navy #22346E + cam/vàng hổ phách.
- Danh hiệu 8 bậc: Freshman, Sophomore, Junior, Senior, Bachelor, Master, PhD, Professor. Mít đổi phụ kiện theo bậc: mũ len -> kính -> mũ tốt nghiệp -> cuộn bằng -> nơ đỏ -> áo choàng.

## Nội dung đã có (ielts-draft/out, tất cả đã qua checker)
- Từ vựng: v00-v29.json = 3.260 từ (NGSL 501-2801 + NAWL 959; lv 1/2/3), mỗi từ có ipa (RP), pos, vi, ex, exvi, col, fam, em. topic_a/topic_b.json = 600 từ band 7+ theo 20 chủ đề (lv 4). Lưu ý: vài từ ghi 2 IPA kiểu "/../ (v), /../ (n)".
- Reading: read_a1..a4.json (4 đề Academic x 3 passage), read_g.json (2 đề GT x 3 section). Đáp án headings/matchfeat là chỉ số 0-based vào opts; instr đánh số câu 1-40 xuyên suốt đề.
- Listening: listen_12/34/56.json = 6 đề x 4 part, mỗi part 10 câu, script theo dòng có speaker (voice f/m, accent en-GB/AU/US) để đọc bằng TTS. "multi" = chọn 2, tính 2 câu.
- Writing: write_1a.json (12 Task 1 Academic, chart JSON line/bar/pie/table/process/map + bài mẫu band 8), write_1g.json (10 thư GT), write_2a/2b.json (30 Task 2 có dàn ý tiếng Việt, ý, bài mẫu band 8, từ vựng).
- Speaking: speak_a.json (30 chủ đề Part 1 + cue card s2_01-20), speak_b.json (cue card s2_21-40), mỗi card có bài mẫu, từ vựng, 5 câu Part 3 + 2 bài mẫu.
- Grammar: gram_a.json (g01-30, lv1-2), gram_b.json (g31-60, lv2-3): công thức, giải thích, lỗi người Việt, quiz, sửa lỗi.
- Pronunciation: pron.json (44 âm, 15 quy tắc, 23 bộ cặp tối thiểu).
- daily.json: 150 mục mỗi ngày (idiom, collocation, phrasal, tip, mistake, fact).
- Schema chi tiết: CONTENT_SPEC.md, VOCAB_SPEC.md. Kiểm tra: `python3 check_content.py <kind> <file>`, `python3 check_vocab.py <in> <out>`.
- Nguồn danh sách từ: NGSL/NAWL (Browne, Culligan, Phillips; CC BY-SA 4.0), IPA từ open-dict-data/ipa-dict (MIT). Cần ghi nguồn trong README.
- Một số dữ kiện thực tế trong bài đọc/nghe/essay viết theo hiểu biết chung, chưa đối chiếu nguồn.

## Việc còn lại
1. Tạo repo private mới (gợi ý `stalisnguyen/catalis`) qua Chrome như lần hanyu, cài Claude GitHub app cho repo đó; tạo project Vercel từ repo (GitHub đã nối Vercel, team inner-world), thêm env: APP_PASSWORD, GROQ_API_KEY, kết nối Upstash Redis.
2. Dựng app dựa trên khung Stalong (src/shell.html, app.css, app.js, features/, build.py, api/*, sw.js, manifest) nhưng bỏ phần tiếng Trung (pinyin, hanzi-writer, thanh điệu, bộ thủ, audio-cmn). Giữ: điều hướng 5 nhóm (Hôm nay, Ôn tập, Luyện, Tra cứu, Tôi), SRS + XP + danh hiệu, kế hoạch ngày, sổ lỗi, trò chơi, Aa sheet, hiệu ứng thưởng, hồ sơ tên + PIN, bảng Bạn học, trợ lý AI qua Groq.
3. Màn cần viết mới:
   - Từ vựng: thẻ SRS (IPA, nghe en-GB TTS, collocation, word family), từ điển, chủ đề band 7+.
   - Listening: làm từng part hoặc cả đề 40 câu, TTS theo speaker/accent, nghe 1 lần như thi thật hoặc luyện tập; chép chính tả câu từ script; quy đổi band.
   - Reading: renderer cho các dạng tfng/ynng/mcq/headings/matchinfo/matchfeat/completion; chế độ 60 phút; quy đổi band Academic/GT khác nhau.
   - Writing: vẽ chart SVG từ JSON (line/bar/pie/table/process/map dạng 2 cột), hẹn giờ, đếm từ, AI chấm theo 4 tiêu chí (TA/TR, CC, LR, GRA) ra band + sửa câu; xem bài mẫu, dàn ý.
   - Speaking: Part 1/2/3 có đồng hồ (1 phút chuẩn bị, 2 phút nói), ghi âm + nhận dạng giọng nói en-GB, AI nhận xét Fluency/Lexical/Grammar/Pronunciation; luyện nói với giám khảo AI; bài mẫu.
   - Grammar, Phát âm (bảng IPA bấm nghe, cặp tối thiểu nghe chọn, quy tắc -s/-ed...), Mẹo mỗi ngày.
   - Thi thử đầy đủ + bài xếp lớp (ra band ước lượng).
4. Test headless 390px và 1200px, deploy, gửi link cho Stalis.
