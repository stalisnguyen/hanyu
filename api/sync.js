// Stores the learner's progress (one JSON document) in Upstash Redis, locked by APP_PASSWORD.
const { checkKey, kv } = require('./_lib');

const KEY = 'hanyu:progress';
const MAX_BYTES = 900000;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const db = kv();
  if (!db) return res.status(503).json({ error: 'no_store' });
  if (!process.env.APP_PASSWORD) return res.status(503).json({ error: 'no_password' });
  if (!checkKey(req)) return res.status(401).json({ error: 'auth' });
  try {
    if (req.method === 'GET') {
      const raw = await db(['GET', KEY]);
      return res.status(200).json({ data: raw ? JSON.parse(raw) : null });
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const data = req.body && req.body.data;
      if (!data || typeof data !== 'object') return res.status(400).json({ error: 'bad_request' });
      const raw = JSON.stringify(data);
      if (raw.length > MAX_BYTES) return res.status(413).json({ error: 'too_big' });
      const cur = await db(['GET', KEY]);
      if (cur) {
        const old = JSON.parse(cur);
        if ((old.upd || 0) > (data.upd || 0)) return res.status(409).json({ error: 'stale', data: old });
      }
      await db(['SET', KEY, raw]);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'store' });
  }
};
