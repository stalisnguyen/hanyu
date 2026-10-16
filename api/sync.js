// Per-learner progress in Upstash Redis, locked by APP_PASSWORD (shared by the study group)
// plus a personal PIN per learner so friends cannot overwrite each other.
//   headers: x-app-key (group password), x-user (profile slug), x-user-pin (personal PIN)
//   GET  -> {data}            PUT {data, summary} -> {ok}
// The first profile ("stalis") keeps the original key so existing progress is kept.
const crypto = require('crypto');
const { checkKey, kv, userOf } = require('./_lib');

const LEGACY = 'hanyu:progress';
const MAX_BYTES = 900000;
const keyOf = (slug) => (slug === 'stalis' ? LEGACY : 'hanyu:p:' + slug);
const hash = (s) => crypto.createHash('sha256').update('stalong:' + s).digest('hex');

async function checkPin(db, slug, pin) {
  const stored = await db(['GET', 'hanyu:pin:' + slug]);
  if (stored) {
    const a = Buffer.from(stored), b = Buffer.from(hash(pin || ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  if (!pin || pin.length < 4) return false;
  await db(['SET', 'hanyu:pin:' + slug, hash(pin), 'NX']);
  return true;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const db = kv();
  if (!db) return res.status(503).json({ error: 'no_store' });
  if (!process.env.APP_PASSWORD) return res.status(503).json({ error: 'no_password' });
  if (!checkKey(req)) return res.status(401).json({ error: 'auth' });
  const u = userOf(req);
  if (!u) return res.status(400).json({ error: 'need_user' });
  try {
    if (!(await checkPin(db, u.slug, u.pin))) return res.status(403).json({ error: 'pin' });
    const KEY = keyOf(u.slug);
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
      const s = req.body.summary;
      if (s && typeof s === 'object') {
        const clean = {
          name: String(s.name || u.slug).slice(0, 30),
          wxp: Math.max(0, Math.min(1e6, +s.wxp || 0)), xp: Math.max(0, Math.min(1e7, +s.xp || 0)),
          streak: Math.max(0, Math.min(5000, +s.streak || 0)), rank: Math.max(0, Math.min(7, +s.rank || 0)),
          known: Math.max(0, Math.min(20000, +s.known || 0)), today: Math.max(0, Math.min(1e5, +s.today || 0)),
          week: String(s.week || '').slice(0, 10), upd: Date.now(),
        };
        await db(['HSET', 'hanyu:board', u.slug, JSON.stringify(clean)]);
      }
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'store' });
  }
};
