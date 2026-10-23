// Google sign-in and accounts. The page gets a Google ID token from Google Identity Services and sends it here.
//   POST {action:'google', credential | code}  (x-app-key: the key already on this device, optional)
//        code: one-time code from api/gauth.js (redirect sign-in on phones)
//        -> {token, acct}. A device that already had the group password or an invite key keeps beta access on the account.
//   POST {action:'me'}                  (x-app-key: account key) -> {acct}
//   POST {action:'redeem', code}        (x-app-key: account key) -> {acct, n?, max?} | 404 invalid | 410 full | 429
//        code is the invite code or the group password; either makes the account a beta member.
//   POST {action:'logout'}              (x-app-key: account key) -> {ok}
// Signing in on a device that has the owner's ADMIN_PASSWORD (or entering it) marks the account as owner:
// it can manage invite codes and see the numbers from any device.
// New accounts get a free trial of <app>:cfg:trial days (0 = off, set by the owner in Settings).
const crypto = require('crypto');
const { APP, sha, kv, keyInfo, isActive, betaUntil, isAdmin, getAcct, putAcct, tooMany, takeInvite, GOOGLE_CLIENT_ID } = require('./_lib');

const pub = (a, bu) => ({ email: a.email, name: a.name || '', pic: a.pic || '', beta: !!a.beta, betaUntil: bu, trialEnd: a.trialEnd || 0,
  paidUntil: a.paidUntil || 0, active: isActive(a, bu), owner: !!a.owner });
const same = (x, y) => !!x && !!y && crypto.timingSafeEqual(sha(x), sha(y));

async function verifyGoogle(credential) {
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(String(credential || ''))) return null;
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
  if (!r.ok) return null;
  const j = await r.json();
  if (j.aud !== GOOGLE_CLIENT_ID) return null;
  if (j.iss !== 'accounts.google.com' && j.iss !== 'https://accounts.google.com') return null;
  if (!(+j.exp * 1000 > Date.now())) return null;
  if (String(j.email_verified) !== 'true' || !j.sub || !j.email) return null;
  return { sub: String(j.sub), email: String(j.email).toLowerCase(), name: String(j.name || ''), pic: String(j.picture || '') };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.APP_PASSWORD) return res.status(503).json({ error: 'no_password' });
  const db = kv();
  if (!db) return res.status(503).json({ error: 'no_kv' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  try {
    const bu = await betaUntil(db);
    if (body.action === 'google') {
      if (await tooMany(db, req)) return res.status(429).json({ error: 'slow' });
      let credential = body.credential;
      if (!credential && /^[a-f0-9]{32}$/.test(String(body.code || ''))) credential = await db(['GETDEL', APP + ':gauth:' + body.code]);
      const g = await verifyGoogle(credential);
      if (!g) return res.status(401).json({ error: 'google' });
      const now = Date.now();
      const a = (await getAcct(db, g.sub)) || { at: now };
      Object.assign(a, { email: g.email, name: g.name, pic: g.pic, seen: now });
      // carry over what this device already had
      const k = await keyInfo(req);
      if (isAdmin(req)) Object.assign(a, { beta: true, owner: true, via: a.via || 'admin' });
      else if (k.master && !a.beta) Object.assign(a, { beta: true, via: 'group' });
      else if (k.state === 'ok' && k.tok && !k.tok.sub && !a.beta) Object.assign(a, { beta: true, via: 'code:' + (k.tok.code || '') });
      if (!isActive(a, bu) && !a.trialEnd) {
        const days = +(await db(['GET', APP + ':cfg:trial'])) || 0;
        if (days > 0) a.trialEnd = now + days * 864e5;
      }
      await putAcct(db, g.sub, a);
      const token = crypto.randomBytes(20).toString('hex');
      await db(['SET', APP + ':tok:' + sha(token).toString('hex'), JSON.stringify({ at: now, sub: g.sub }), 'EX', 400 * 86400]);
      return res.status(200).json({ token, acct: pub(a, bu) });
    }
    const k = await keyInfo(req);
    if (body.action === 'logout') {
      const got = String(req.headers['x-app-key'] || '');
      if (k.sub && /^[a-f0-9]{40}$/.test(got)) await db(['DEL', APP + ':tok:' + sha(got).toString('hex')]);
      return res.status(200).json({ ok: true });
    }
    if (!k.sub) return res.status(401).json({ error: 'auth' });
    const a = k.acct;
    if (body.action === 'me') return res.status(200).json({ acct: pub(a, bu) });
    if (body.action === 'redeem') {
      const given = String(body.code || '').trim();
      if (same(process.env.ADMIN_PASSWORD || '', given)) {
        Object.assign(a, { beta: true, owner: true, via: a.via || 'admin' });
        await putAcct(db, k.sub, a);
        return res.status(200).json({ acct: pub(a, bu) });
      }
      if (a.beta) return res.status(200).json({ acct: pub(a, bu) });
      if (same(process.env.APP_PASSWORD || '', given)) {
        Object.assign(a, { beta: true, via: 'group' });
        await putAcct(db, k.sub, a);
        return res.status(200).json({ acct: pub(a, bu) });
      }
      if (await tooMany(db, req)) return res.status(429).json({ error: 'slow' });
      const t = await takeInvite(db, given);
      if (t.full) return res.status(410).json({ error: 'full', max: t.max });
      if (t.invalid) return res.status(404).json({ error: 'invalid' });
      Object.assign(a, { beta: true, via: 'code:' + t.code });
      await putAcct(db, k.sub, a);
      return res.status(200).json({ acct: pub(a, bu), n: t.n, max: t.max });
    }
    return res.status(400).json({ error: 'action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
};
