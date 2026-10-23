// Chat model proxy, locked by APP_PASSWORD. Works with whichever provider key is set:
//   GROQ_API_KEY       -> Groq (open models, free tier). Model: GROQ_MODEL (default qwen/qwen3.8-27b)
//   GEMINI_API_KEY     -> Google Gemini (free tier on Flash). Model: GEMINI_MODEL (default gemini-flash-latest)
//   ANTHROPIC_API_KEY  -> Claude (paid). Models: AI_MODEL_FAST / AI_MODEL_SMART
// AI_PROVIDER=groq|gemini|anthropic forces one; otherwise the first configured in the order groq, gemini, anthropic.
const { deny, track, aiQuota } = require('./_lib');

const MAX_INPUT_CHARS = 60000;

function provider() {
  const want = (process.env.AI_PROVIDER || '').toLowerCase();
  const have = {
    groq: !!process.env.GROQ_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
  };
  if (want && have[want]) return want;
  return ['groq', 'gemini', 'anthropic'].find((p) => have[p]) || null;
}

const stripThink = (t) => String(t || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();

async function callGroq(messages, tier) {
  const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
  const body = { model, messages, temperature: 0.7, max_tokens: tier === 'quick' ? 1500 : 6000, reasoning_format: 'hidden' };
  let r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (r.status === 400) { // model may not accept reasoning_format
    delete body.reasoning_format;
    r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { status: r.status, err: (j.error && j.error.message) || '' };
  const c = j.choices && j.choices[0];
  return { text: stripThink(c && c.message && c.message.content), truncated: c && c.finish_reason === 'length' };
}

async function callGemini(messages, tier) {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const contents = messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: tier === 'quick' ? 1500 : 6000, temperature: 0.7 } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { status: r.status, err: (j.error && j.error.message) || '' };
  const cand = j.candidates && j.candidates[0];
  const text = ((cand && cand.content && cand.content.parts) || []).map((p) => p.text || '').join('');
  return { text: stripThink(text), truncated: cand && cand.finishReason === 'MAX_TOKENS' };
}

async function callAnthropic(messages, tier) {
  const models = {
    quick: process.env.AI_MODEL_FAST || 'claude-haiku-5-5',
    default: process.env.AI_MODEL_SMART || 'claude-sonnet-5-5',
    complex: process.env.AI_MODEL_SMART || 'claude-sonnet-5-5',
  };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: models[tier] || models.default, max_tokens: tier === 'quick' ? 1500 : 6000, messages }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { status: r.status, err: (j.error && j.error.message) || '' };
  return { text: (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(''), truncated: j.stop_reason === 'max_tokens' };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.APP_PASSWORD) return res.status(503).json({ error: 'no_password' });
  if (await deny(req, res)) return;
  track('ai', req);
  const prov = provider();
  if (!prov) return res.status(503).json({ error: 'no_key' });

  const body = req.body || {};
  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages || !messages.length) return res.status(400).json({ error: 'bad_request' });
  const clean = [];
  let size = 0;
  for (const m of messages.slice(-30)) {
    const role = m && m.role === 'assistant' ? 'assistant' : 'user';
    const content = String((m && m.content) || '');
    size += content.length;
    clean.push({ role, content });
  }
  if (size > MAX_INPUT_CHARS) return res.status(413).json({ error: 'too_long' });
  if (clean[clean.length - 1].role !== 'user') return res.status(400).json({ error: 'bad_request' });
  const tier = ['quick', 'default', 'complex'].includes(body.tier) ? body.tier : 'default';
  const q = await aiQuota(req);
  if (!q.ok) return res.status(429).json({ error: 'daily_limit', limit: q.limit });

  try {
    const fn = prov === 'groq' ? callGroq : prov === 'gemini' ? callGemini : callAnthropic;
    const out = await fn(clean, tier);
    if (out.status) {
      if (out.status === 429) return res.status(429).json({ error: 'rate_limited' });
      if (/credit|billing|quota|balance/i.test(out.err)) return res.status(402).json({ error: 'billing' });
      console.error(prov, out.status, out.err);
      return res.status(502).json({ error: 'upstream' });
    }
    return res.status(200).json({ text: out.text, truncated: !!out.truncated, provider: prov });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'upstream' });
  }
};
