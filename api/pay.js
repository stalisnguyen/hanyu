// Paid plans through payOS. The person must be signed in with Google; the plan is tied to the account.
//   POST {action:'info'}                       -> {ready, plans}
//   POST {action:'create', plan}  (account)    -> {checkoutUrl, orderCode}   plan: 'month' | 'year'
//   POST {action:'check', orderCode} (account) -> {paid, status, acct}  asks payOS directly, in case the webhook was missed
//   POST {action:'sales'}  (owner)             -> {revenue, month, year}
//   POST {action:'hook'}   (owner)             -> registers <this site>/api/payhook as the payOS webhook
const { APP, kv, keyInfo, isOwner, isActive, betaUntil } = require('./_lib');
const { PLANS, SHORT, ready, payos, createSig, creditOrder } = require('./_pay');

const origin = req => 'https://' + String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
const pub = (a, bu) => ({ email: a.email, name: a.name || '', pic: a.pic || '', beta: !!a.beta, betaUntil: bu, trialEnd: a.trialEnd || 0,
  paidUntil: a.paidUntil || 0, active: isActive(a, bu), owner: !!a.owner });

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const db = kv();
  if (!db) return res.status(503).json({ error: 'no_kv' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const plans = Object.fromEntries(Object.entries(PLANS).map(([k, p]) => [k, { amount: p.amount, days: p.days }]));
  try {
    if (body.action === 'info') return res.status(200).json({ ready: ready(), plans });
    if (body.action === 'sales' || body.action === 'hook') {
      if (!(await isOwner(req))) return res.status(403).json({ error: 'admin' });
      if (body.action === 'sales') {
        const [rev, m, y] = await Promise.all([db(['GET', APP + ':rev']), db(['GET', APP + ':sold:month']), db(['GET', APP + ':sold:year'])]);
        return res.status(200).json({ ready: ready(), revenue: +rev || 0, month: +m || 0, year: +y || 0 });
      }
      if (!ready()) return res.status(503).json({ error: 'not_ready' });
      const j = await payos('POST', '/confirm-webhook', { webhookUrl: origin(req) + '/api/payhook' });
      return res.status(j.code === '00' ? 200 : 502).json({ code: j.code, desc: j.desc, url: origin(req) + '/api/payhook' });
    }
    const k = await keyInfo(req);
    if (!k.sub) return res.status(401).json({ error: 'need_account' });
    const bu = await betaUntil(db);
    if (body.action === 'create') {
      if (!ready()) return res.status(503).json({ error: 'not_ready' });
      const p = PLANS[body.plan];
      if (!p) return res.status(400).json({ error: 'plan' });
      const orderCode = Number(String(Date.now()).slice(-9) + String(Math.floor(100 + Math.random() * 900)));
      const req2 = { orderCode, amount: p.amount, description: (SHORT[APP] || 'APP') + ' ' + p.label,
        returnUrl: origin(req) + '/?pay=done', cancelUrl: origin(req) + '/?pay=cancel' };
      req2.signature = createSig(req2);
      req2.expiredAt = Math.floor(Date.now() / 1000) + 30 * 60;
      const j = await payos('POST', '/v2/payment-requests', req2);
      if (j.code !== '00' || !j.data || !j.data.checkoutUrl) { console.error('payos create', j.code, j.desc); return res.status(502).json({ error: 'payos', desc: j.desc || '' }); }
      await db(['SET', 'pay:order:' + orderCode, JSON.stringify({ orderCode, app: APP, sub: k.sub, email: k.acct.email, plan: body.plan,
        amount: p.amount, at: Date.now(), status: 'PENDING' }), 'EX', 40 * 86400]);
      return res.status(200).json({ checkoutUrl: j.data.checkoutUrl, orderCode });
    }
    if (body.action === 'check') {
      const code = Number(body.orderCode);
      const raw = Number.isSafeInteger(code) ? await db(['GET', 'pay:order:' + code]) : null;
      if (!raw) return res.status(404).json({ error: 'order' });
      const o = JSON.parse(raw);
      if (o.sub !== k.sub || o.app !== APP) return res.status(404).json({ error: 'order' });
      let status = o.status;
      if (status !== 'PAID' && ready()) {
        const j = await payos('GET', '/v2/payment-requests/' + code);
        const d = j && j.data;
        if (j.code === '00' && d) {
          status = d.status || status;
          if (d.status === 'PAID' || (+d.amountPaid >= o.amount)) { await creditOrder(db, code, d.amountPaid); status = 'PAID'; }
        }
      }
      const a = JSON.parse((await db(['GET', APP + ':acct:' + k.sub])) || '{}');
      return res.status(200).json({ paid: status === 'PAID', status, acct: pub(a, bu) });
    }
    return res.status(400).json({ error: 'action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
};
