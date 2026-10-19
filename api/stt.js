// Speech to text with Whisper on Groq (GROQ_API_KEY), locked by APP_PASSWORD.
// Works on every phone: the page records audio (MediaRecorder) and posts the raw bytes here.
//   POST ?lang=en|zh  body: audio bytes, Content-Type: audio/webm | audio/mp4 | audio/ogg | audio/wav  -> {text}
//   GET  ?probe=1 -> {ok} (sends one second of silence, no secrets returned)
const { checkKey } = require('./_lib');

const MAX = 4 * 1024 * 1024;
const extOf = (t) => (/mp4|m4a|aac/.test(t) ? 'm4a' : /ogg/.test(t) ? 'ogg' : /wav/.test(t) ? 'wav' : /mpeg|mp3/.test(t) ? 'mp3' : 'webm');

async function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > MAX) throw Object.assign(new Error('too big'), { code: 413 }); chunks.push(c); }
  return Buffer.concat(chunks);
}
function silenceWav() {
  const n = 16000, h = Buffer.alloc(44), d = Buffer.alloc(n * 2);
  h.write('RIFF', 0); h.writeUInt32LE(36 + d.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(n, 24); h.writeUInt32LE(n * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(d.length, 40);
  return Buffer.concat([h, d]);
}
async function whisper(buf, type, lang) {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: type || 'audio/webm' }), 'speech.' + extOf(type || ''));
  fd.append('model', process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo');
  if (lang) fd.append('language', lang);
  // Whisper may write Chinese in traditional characters; a short simplified-Chinese prompt steers it
  if (lang === 'zh') fd.append('prompt', '以下是普通话的句子，请使用简体中文。');
  fd.append('response_format', 'json');
  fd.append('temperature', '0');
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY }, body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error('groq ' + r.status + ' ' + JSON.stringify(j).slice(0, 300)), { code: r.status });
  return String(j.text || '').trim();
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: 'no_key' });
  if (req.method === 'GET' && req.query && req.query.probe) {
    const t0 = Date.now();
    try { const t = await whisper(silenceWav(), 'audio/wav', 'en'); return res.status(200).json({ ok: true, text: t, ms: Date.now() - t0 }); }
    catch (e) { return res.status(200).json({ ok: false, err: String(e.message).slice(0, 300) }); }
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.APP_PASSWORD) return res.status(503).json({ error: 'no_password' });
  if (!checkKey(req)) return res.status(401).json({ error: 'auth' });
  const lang = ['en', 'zh', 'vi'].includes(String(req.query && req.query.lang)) ? req.query.lang : 'en';
  try {
    const buf = await rawBody(req);
    if (buf.length < 800) return res.status(200).json({ text: '' });
    const text = await whisper(buf, String(req.headers['content-type'] || 'audio/webm').split(';')[0], lang);
    return res.status(200).json({ text });
  } catch (e) {
    console.error('stt', e.message);
    if (e.code === 413) return res.status(413).json({ error: 'too_long' });
    if (e.code === 429) return res.status(429).json({ error: 'rate_limited' });
    return res.status(502).json({ error: 'upstream' });
  }
};
module.exports.config = { api: { bodyParser: false } };
