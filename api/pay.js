// Paid plans (VietQR transfer, confirmed by SePay). The person must be signed in with Google; the plan is tied to the account.
//   POST {action:'info'}                    -> {ready, plans}
//   POST {action:'create', plan} (account)  -> {code, amount, qr, bank, account, name}   plan: 'month' | 'year'
//   POST {action:'check', code}  (account)  -> {paid, acct}
//   POST {action:'sales'}        (owner)    -> {ready, revenue, month, year, hook, keyLen, keyTrimmed}
const { APP, kv, keyInfo, isOwner, isActive, betaUntil } = require('./_lib');
const { PLANS, ready, cfg, newCode, qrUrl } = require('./_pay');

const origin = req => 'https://' + String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
const pub = (a, bu) => ({ email: a.email, name: a.name || '', pic: a.pic || '', beta: !!a.beta || Date.now() < bu, betaUntil: bu, trialEnd: a.trialEnd || 0,
  paidUntil: a.paidUntil || 0, active: isActive(a, bu), owner: !!a.owner });

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const db = kv();
  if (!db) return res.status(503).json({ error: 'no_kv' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  try {
    if (body.action === 'info') return res.status(200).json({ ready: ready(), plans: PLANS });
    if (body.action === 'sales') {
      if (!(await isOwner(req))) return res.status(403).json({ error: 'admin' });
      const [rev, m, y] = await Promise.all([db(['GET', APP + ':rev']), db(['GET', APP + ':sold:month']), db(['GET', APP + ':sold:year'])]);
      // keyLen: length of SEPAY_API_KEY only, never the key, so the owner can check it is set in every app
      const key = String(process.env.SEPAY_API_KEY || '');
      return res.status(200).json({ ready: ready(), revenue: +rev || 0, month: +m || 0, year: +y || 0, hook: origin(req) + '/api/sepayhook',
        keyLen: key.length, keyTrimmed: key === key.trim() });
    }
    const k = await keyInfo(req);
    if (!k.sub) return res.status(401).json({ error: 'need_account' });
    if (body.action === 'create') {
      if (!ready()) return res.status(503).json({ error: 'not_ready' });
      const p = PLANS[body.plan];
      if (!p) return res.status(400).json({ error: 'plan' });
      let code = newCode();
      for (let i = 0; i < 5; i++) {
        const ok = await db(['SET', 'pay:order:' + code, JSON.stringify({ code, app: APP, sub: k.sub, email: k.acct.email, plan: body.plan,
          amount: p.amount, at: Date.now(), status: 'PENDING' }), 'NX', 'EX', 60 * 86400]);
        if (ok) break; code = newCode();
      }
      const c = cfg();
      return res.status(200).json({ code, amount: p.amount, plan: body.plan, qr: qrUrl(p.amount, code), bank: c.bank, account: c.acc, name: c.name });
    }
    if (body.action === 'check') {
      const code = String(body.code || '').toUpperCase();
      const raw = /^STA\d{8}$/.test(code) ? await db(['GET', 'pay:order:' + code]) : null;
      if (!raw) return res.status(404).json({ error: 'order' });
      const o = JSON.parse(raw);
      if (o.sub !== k.sub || o.app !== APP) return res.status(404).json({ error: 'order' });
      const a = JSON.parse((await db(['GET', APP + ':acct:' + k.sub])) || '{}');
      return res.status(200).json({ paid: o.status === 'PAID', acct: pub(a, await betaUntil(db)) });
    }
    return res.status(400).json({ error: 'action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
};
