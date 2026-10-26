// Per-learner progress in Upstash Redis. Signed-in accounts: one profile per account.
// Older group password / invite keys: name plus a personal PIN so friends cannot overwrite each other.
//   headers: x-app-key (group password), x-user (profile slug), x-user-pin (personal PIN)
//   GET  -> {data}            PUT {data, summary} -> {ok}
// The first profile ("stalis") keeps the original key so existing progress is kept.
const crypto = require('crypto');
const { denySync, kv, userOf, getAcct, putAcct } = require('./_lib');

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

// Which saved profile this request reads and writes.
// Group password or invite key: the name (x-user) plus a personal PIN, as before.
// Signed-in account: one profile per account, no PIN. On its first sync a learner who already
// synced with name + PIN brings that profile along (the device still sends both); everyone else
// gets a new profile tied to the account. Returns the slug, or 400 / 403.
async function profileSlug(db, req, u) {
  const k = req._k || {};
  if (!k.sub) {
    if (!u) return 400;
    return (await checkPin(db, u.slug, u.pin)) ? u.slug : 403;
  }
  const a = (await getAcct(db, k.sub)) || {};
  if (a.slug) return a.slug;
  let slug = null;
  if (u && u.pin) {
    const stored = await db(['GET', 'hanyu:pin:' + u.slug]);
    if (stored) {
      const x = Buffer.from(stored), y = Buffer.from(hash(u.pin));
      if (x.length === y.length && crypto.timingSafeEqual(x, y)) slug = u.slug;
    }
  }
  if (!slug) slug = 'g-' + crypto.createHash('sha256').update('hanyu:acct:' + k.sub).digest('hex').slice(0, 16);
  a.slug = slug;
  await putAcct(db, k.sub, a);
  return slug;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const db = kv();
  if (!db) return res.status(503).json({ error: 'no_store' });
  if (!process.env.APP_PASSWORD) return res.status(503).json({ error: 'no_password' });
  if (await denySync(req, res)) return;
  const u = userOf(req);
  try {
    const slug = await profileSlug(db, req, u);
    if (slug === 400) return res.status(400).json({ error: 'need_user' });
    if (slug === 403) return res.status(403).json({ error: 'pin' });
    const KEY = keyOf(slug);
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
          name: String(s.name || slug).slice(0, 30),
          wxp: Math.max(0, Math.min(1e6, +s.wxp || 0)), xp: Math.max(0, Math.min(1e7, +s.xp || 0)),
          streak: Math.max(0, Math.min(5000, +s.streak || 0)), rank: Math.max(0, Math.min(7, +s.rank || 0)),
          known: Math.max(0, Math.min(20000, +s.known || 0)), today: Math.max(0, Math.min(1e5, +s.today || 0)),
          week: String(s.week || '').slice(0, 10), upd: Date.now(),
        };
        await db(['HSET', 'hanyu:board', slug, JSON.stringify(clean)]);
      }
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'store' });
  }
};
