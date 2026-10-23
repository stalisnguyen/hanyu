// Invite codes: one shared code with a limited number of places.
// Each person who redeems it gets a personal access key that works like the group password
// (AI, sync, voices). The group password itself keeps working for everyone who already has it.
//   POST {action:'redeem', code}            -> {token, n, max}  | 404 invalid | 410 full | 429 too many tries
//   POST {action:'status'}  (owner: ADMIN_PASSWORD or an owner account) -> {code, max, used, issued}
//   POST {action:'check'} -> {ok} whether x-app-key unlocks the app
//   POST {action:'stats'} (ADMIN_PASSWORD) -> beta numbers, see _stats.js
//   POST {action:'set', code?, max?, trial?} (ADMIN_PASSWORD) -> same as status. A new code starts a new count.
//        trial = free days a new Google account gets (0 = off); ailimit = AI calls per person per day;
//        betaLast = last free day of the beta, 'YYYY-MM-DD' Vietnam time.
const crypto = require('crypto');
const { APP, sha, isOwner, checkKey, kv, betaUntil, tooMany, takeInvite, normCode } = require('./_lib');
const { stats } = require('./_stats');

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
    const [code, max, issued, trial, accounts] = await Promise.all([db(['GET', K('code')]), db(['GET', K('max')]), db(['GET', K('issued')]),
      db(['GET', APP + ':cfg:trial']), db(['SCARD', APP + ':accts'])]);
    const [ailimit, bu] = await Promise.all([db(['GET', APP + ':cfg:ailimit']), betaUntil(db)]);
    const used = code ? +(await db(['GET', K('used:' + code)])) || 0 : 0;
    return { code: code || '', max: +max || 50, used, issued: +issued || 0, trial: +trial || 0, accounts: +accounts || 0, ailimit: +ailimit || 50, betaUntil: bu };
  };
  try {
    if (body.action === 'redeem') {
      if (await tooMany(db, req)) return res.status(429).json({ error: 'slow' });
      const t = await takeInvite(db, body.code);
      if (t.full) return res.status(410).json({ error: 'full', max: t.max });
      if (t.invalid) return res.status(404).json({ error: 'invalid' });
      const token = crypto.randomBytes(20).toString('hex');
      await db(['SET', APP + ':tok:' + sha(token).toString('hex'), JSON.stringify({ at: Date.now(), code: t.code, n: t.n })]);
      return res.status(200).json({ token, n: t.n, max: t.max });
    }
    if (body.action === 'check') return res.status(200).json({ ok: await checkKey(req) });
    if (!(await isOwner(req))) return res.status(403).json({ error: 'admin' });
    if (body.action === 'stats') return res.status(200).json(await stats());
    if (body.action === 'set') {
      if (body.trial !== undefined) await db(['SET', APP + ':cfg:trial', String(Math.max(0, Math.min(30, parseInt(body.trial, 10) || 0)))]);
      if (body.ailimit !== undefined) await db(['SET', APP + ':cfg:ailimit', String(Math.max(1, Math.min(500, parseInt(body.ailimit, 10) || 50)))]);
      if (body.betaLast !== undefined) { // last free day 'YYYY-MM-DD', Vietnam time
        const m = String(body.betaLast).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return res.status(400).json({ error: 'date' });
        await db(['SET', APP + ':cfg:betaUntil', String(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1) - 7 * 3600e3)]);
      }
      if (body.code === undefined) return res.status(200).json(await status());
      const code = normCode(body.code), max = Math.max(1, Math.min(1000, parseInt(body.max, 10) || 50));
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
