# Sổ Tay Hán Ngữ

Web học tiếng Trung HSK 1-9 (chuẩn mới, gồm cả bậc 7-9) cho người Việt, theo danh sách từ HSK 3.0 bản điều chỉnh 2026 (5.181 từ).

## Tính năng

- Ôn từ bằng thẻ lặp lại ngắt quãng (kiểu SM-2): mặt trước là chữ Hán, nghĩa hoặc âm thanh
- Mỗi từ có pinyin tô màu theo thanh điệu, âm Hán Việt, nghĩa tiếng Việt, câu ví dụ và hình minh họa emoji cho từ cụ thể
- Từ điển tìm theo chữ Hán, pinyin không dấu, Hán Việt hoặc nghĩa tiếng Việt; thêm từ riêng
- Luyện viết chữ theo thứ tự nét (Hanzi Writer)
- 183 điểm ngữ pháp HSK 1-6, có ghi chú lỗi người Việt hay mắc và câu luyện tập
- 12 đề thi thử theo format HSK (nghe, đọc, viết), chấm điểm và giải thích
- Thanh điệu và bài luyện nghe thanh

Khi mở trong Claude (bản artifact) có thêm:

- Luyện hội thoại theo 13 tình huống, được sửa lỗi bằng tiếng Việt
- Claude soạn đề thi mới, chấm bài viết HSK 5-6
- Vẽ minh họa và giải thích thêm cho từng từ
- Đồng bộ tiến độ giữa các thiết bị

## Cấu trúc

- `src/` mã nguồn: `shell.html`, `app.css`, `app.js`
- `build.py` gộp thành `index.html` (web tĩnh) và `app.html` (artifact Claude)
- `data/words-1..7.json` (7 là bậc 7-9) từ vựng theo cấp: `[chữ, pinyin, Hán Việt, nghĩa, emoji, ví dụ, pinyin ví dụ, nghĩa ví dụ, lượng từ]`
- `data/grammar.json`, `data/tests/hsk1..6.json`, `data/strokes/` dữ liệu nét chữ

Sửa nội dung: sửa file trong `data/` hoặc `src/`, chạy `python3 build.py`, rồi commit.

## Nguồn dữ liệu

- Danh sách từ HSK: [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (MIT)
- Âm Hán Việt: [hanviet-pinyin-words](https://github.com/ph0ngp/hanviet-pinyin-words) (MIT)
- Nét chữ: [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) (Arphic Public License, xem `data/strokes/LICENSE-ARPHIC.txt`)
- Nghĩa tiếng Việt, câu ví dụ, ngữ pháp và đề thi thử: soạn mới cho dự án này

## Âm thanh

- `audio/w/` từ vựng và `audio/s/` âm tiết: bản thu giọng người thật từ [audio-cmn](https://github.com/hugolpz/audio-cmn) (giọng Yue Tan, Chen Wang; Shtooka), giấy phép CC BY-SA. Đã chuẩn hóa âm lượng và cắt khoảng lặng.
- Câu và bài đọc dùng giọng đọc của trình duyệt (chọn trong nút "Giọng đọc").

## Chạy phần AI và đồng bộ trên web (Vercel)

Thêm trong Vercel -> project hanyu -> Settings -> Environment Variables:

- `APP_PASSWORD`: mật khẩu tự đặt, nhập một lần trên mỗi máy để mở khóa AI và đồng bộ
- Một trong các key AI (app dùng key đầu tiên có trong thứ tự Groq, Gemini, Anthropic; ép bằng `AI_PROVIDER`):
  - `GROQ_API_KEY`: miễn phí, tạo ở console.groq.com/keys; model mặc định `qwen/qwen3.8-27b`, đổi bằng `GROQ_MODEL`
  - `GEMINI_API_KEY`: miễn phí với Flash, tạo ở aistudio.google.com/apikey; đổi model bằng `GEMINI_MODEL`
  - `ANTHROPIC_API_KEY`: Claude, trả phí theo lượng dùng
- Đồng bộ: Vercel -> Storage -> thêm Upstash Redis (gói miễn phí) và kết nối với project; biến `KV_REST_API_URL`, `KV_REST_API_TOKEN` tự được thêm

Sau đó deploy lại.

## Giọng đọc tự nhiên cho câu và bài đọc (tùy chọn)

Tạo tài nguyên Speech trên Azure (gói Free F0, 500.000 ký tự/tháng), rồi thêm trong Vercel:
- `AZURE_SPEECH_KEY`: Key 1 của tài nguyên Speech
- `AZURE_SPEECH_REGION`: vùng của tài nguyên, ví dụ `southeastasia`

Deploy lại. Câu và bài đọc sẽ dùng giọng zh-CN-XiaoxiaoNeural (nữ) và zh-CN-YunxiNeural (nam).

## Nguồn dữ liệu bổ sung

- Tách chữ: [cjkvi-ids](https://github.com/cjkvi/cjkvi-ids) (dựa trên CHISE IDS, GPL v2)
