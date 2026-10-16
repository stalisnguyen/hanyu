// Proxy to the Anthropic Messages API, locked by APP_PASSWORD.
// Env: ANTHROPIC_API_KEY, APP_PASSWORD, optional AI_MODEL_FAST / AI_MODEL_SMART.
const { checkKey } = require('./_lib');

const MODELS = {
  quick: process.env.AI_MODEL_FAST || 'claude-haiku-5-5',
  default: process.env.AI_MODEL_SMART || 'claude-sonnet-5-5',
  complex: process.env.AI_MODEL_SMART || 'claude-sonnet-5-5',
};
const MAX_INPUT_CHARS = 60000;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.APP_PASSWORD) return res.status(503).json({ error: 'no_password' });
  if (!checkKey(req)) return res.status(401).json({ error: 'auth' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: 'no_key' });

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

  const tier = MODELS[body.tier] ? body.tier : 'default';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODELS[tier], max_tokens: tier === 'quick' ? 1500 : 6000, messages: clean }),
    });
    const j = await r.json();
    if (!r.ok) {
      const type = (j && j.error && j.error.type) || '';
      const msg = (j && j.error && j.error.message) || '';
      if (r.status === 429 || type === 'rate_limit_error') return res.status(429).json({ error: 'rate_limited' });
      if (/credit|billing/i.test(msg)) return res.status(402).json({ error: 'billing' });
      console.error('anthropic', r.status, type, msg);
      return res.status(502).json({ error: 'upstream' });
    }
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    return res.status(200).json({ text, truncated: j.stop_reason === 'max_tokens' });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'upstream' });
  }
};
