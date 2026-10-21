// Invite codes: one shared code with a limited number of places.
// Each person who redeems it gets a personal access key that works like the group password
// (AI, sync, voices). The group password itself keeps working for everyone who already has it.
//   POST {action:'redeem', code}            -> {token, n, max}  | 404 invalid | 410 full | 429 too many tries
//   POST {action:'status'}  (group password) -> {code, max, used, issued}
//   POST {action:'set', code, max} (group password) -> same as status. A new code starts a new count.
const crypto = require('crypto');
const { APP, sha, isMaster, kv } = require('./_lib');
const norm = c => String(c || '').trim().toUpperCase().replace(/\s+/g, '');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.APP_PASSWORD) return res.status(503).json({ error: 'no_password' });
  const db = kv();
  if (!db) return res.status(503).json({ error: 'no_kv' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const K = s => APP + ':ref:' + s;
  const status = async () => {
    const [code, max, issued] = await Promise.all([db(['GET', K('code')]), db(['GET', K('max')]), db(['GET', K('issued')])]);
    const used = code ? +(await db(['GET', K('used:' + code)])) || 0 : 0;
    return { code: code || '', max: +max || 50, used, issued: +issued || 0 };
  };
  try {
    if (body.action === 'redeem') {
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
      const rl = APP + ':rl:' + sha(ip).toString('hex').slice(0, 16);
      const tries = await db(['INCR', rl]);
      if (tries === 1) await db(['EXPIRE', rl, 3600]);
      if (tries > 20) return res.status(429).json({ error: 'slow' });
      const { code, max } = await status();
      const given = norm(body.code);
      if (!code || !given || given.length !== code.length ||
          !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(code))) return res.status(404).json({ error: 'invalid' });
      const n = await db(['INCR', K('used:' + code)]);
      if (n > max) { await db(['DECR', K('used:' + code)]); return res.status(410).json({ error: 'full', max }); }
      const token = crypto.randomBytes(20).toString('hex');
      await db(['SET', APP + ':tok:' + sha(token).toString('hex'), JSON.stringify({ at: Date.now(), code, n })]);
      await db(['INCR', K('issued')]);
      return res.status(200).json({ token, n, max });
    }
    if (!isMaster(req)) return res.status(403).json({ error: 'admin' });
    if (body.action === 'set') {
      const code = norm(body.code), max = Math.max(1, Math.min(1000, parseInt(body.max, 10) || 50));
      if (!/^[A-Z0-9-]{4,24}$/.test(code)) return res.status(400).json({ error: 'code' });
      await db(['SET', K('code'), code]);
      await db(['SET', K('max'), String(max)]);
      return res.status(200).json(await status());
    }
    return res.status(200).json(await status());
  } catch (e) {
    return res.status(500).json({ error: 'server' });
  }
};
