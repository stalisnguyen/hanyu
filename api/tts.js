// Natural Mandarin speech via Azure Speech (neural voices), locked by APP_PASSWORD.
// Env: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION (e.g. southeastasia), APP_PASSWORD.
const { checkKey } = require('./_lib');

const VOICES = { f: 'zh-CN-XiaoxiaoNeural', m: 'zh-CN-YunxiNeural' };
const escXml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const key = process.env.AZURE_SPEECH_KEY, region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) return res.status(503).json({ error: 'no_tts' });
  if (!checkKey(req)) return res.status(401).json({ error: 'auth' });
  const body = req.body || {};
  const text = String(body.text || '').slice(0, 1200);
  if (!text.trim()) return res.status(400).json({ error: 'bad_request' });
  const voice = VOICES[body.voice] || VOICES.f;
  const rate = Math.max(0.5, Math.min(1.3, Number(body.rate) || 1));
  const pct = Math.round((rate - 1) * 100);
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="${voice}"><prosody rate="${pct >= 0 ? '+' : ''}${pct}%">${escXml(text)}</prosody></voice></speak>`;
  try {
    const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'hanyu',
      },
      body: ssml,
    });
    if (!r.ok) {
      console.error('azure tts', r.status, await r.text().catch(() => ''));
      return res.status(r.status === 429 ? 429 : 502).json({ error: r.status === 429 ? 'rate_limited' : 'upstream' });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.status(200).send(buf);
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'upstream' });
  }
};
