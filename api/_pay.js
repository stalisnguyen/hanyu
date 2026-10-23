// payOS (VietQR bank transfer) shared by the four study apps.
// One payOS channel for all apps: orders live under pay:order:<orderCode> with the app name inside,
// so the webhook in any of the apps can credit the right account (all apps share one Redis).
// Env (Vercel, team-shared): PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY.
const crypto = require('crypto');
const { BETA_UNTIL_DEFAULT } = require('./_lib');

const PLANS = { month: { amount: 49000, days: 30, label: 'THANG' }, year: { amount: 399000, days: 365, label: 'NAM' } };
const SHORT = { catalis: 'CAT', hanyu: 'STL', calculis: 'CAL', neuralis: 'NEU' };
const cfg = () => ({ id: process.env.PAYOS_CLIENT_ID || '', key: process.env.PAYOS_API_KEY || '', ck: process.env.PAYOS_CHECKSUM_KEY || '' });
const ready = () => { const c = cfg(); return !!(c.id && c.key && c.ck); };
const hmac = (s, k) => crypto.createHmac('sha256', k).update(s).digest('hex');
const sortObj = o => (o && typeof o === 'object' && !Array.isArray(o)) ? Object.keys(o).sort().reduce((r, k) => (r[k] = o[k], r), {}) : o;
// payOS signature string: data keys sorted, key=value joined by &, empty for null/undefined, arrays as JSON with sorted keys
function dataString(d) {
  return Object.keys(d).sort().map(k => {
    let v = d[k];
    if (v === null || v === undefined || v === 'null' || v === 'undefined') v = '';
    else if (Array.isArray(v)) v = JSON.stringify(v.map(sortObj));
    else if (typeof v === 'object') v = JSON.stringify(sortObj(v));
    return k + '=' + v;
  }).join('&');
}
const sameSig = (a, b) => { a = String(a || '').toLowerCase(); b = String(b || '').toLowerCase();
  return a.length === 64 && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); };
const verifyHook = body => ready() && body && body.data && sameSig(hmac(dataString(body.data), cfg().ck), body.signature);
async function payos(method, path, body) {
  const c = cfg();
  const r = await fetch('https://api-merchant.payos.vn' + path, { method,
    headers: { 'x-client-id': c.id, 'x-api-key': c.key, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return r.json().catch(() => ({}));
}
const createSig = b => hmac(`amount=${b.amount}&cancelUrl=${b.cancelUrl}&description=${b.description}&orderCode=${b.orderCode}&returnUrl=${b.returnUrl}`, cfg().ck);

// Credits one paid order to its account, once. Paid time starts after any time already paid,
// and for beta members after the free beta ends. -> {ok, order, acct} | {already} | {unknown}
async function creditOrder(db, orderCode, amountSeen) {
  const raw = await db(['GET', 'pay:order:' + orderCode]);
  if (!raw) return { unknown: true };
  const o = JSON.parse(raw);
  if (amountSeen !== undefined && +amountSeen < o.amount) return { short: true, order: o };
  const lock = await db(['SET', 'pay:done:' + orderCode, String(Date.now()), 'NX']);
  if (lock === null) return { already: true, order: o };
  try {
    const key = o.app + ':acct:' + o.sub;
    const a = JSON.parse((await db(['GET', key])) || 'null');
    if (!a) throw new Error('no account');
    const bu = +(await db(['GET', o.app + ':cfg:betaUntil'])) || BETA_UNTIL_DEFAULT;
    const now = Date.now();
    const start = Math.max(now, a.paidUntil || 0, a.beta ? bu : 0);
    a.paidUntil = start + PLANS[o.plan].days * 864e5;
    a.pays = (a.pays || []).concat([{ code: o.orderCode, plan: o.plan, amount: o.amount, at: now }]).slice(-50);
    await db(['SET', key, JSON.stringify(a)]);
    Object.assign(o, { status: 'PAID', paidAt: now });
    await db(['SET', 'pay:order:' + orderCode, JSON.stringify(o)]);
    await db(['INCRBY', o.app + ':rev', String(o.amount)]);
    await db(['INCR', o.app + ':sold:' + o.plan]);
    return { ok: true, order: o, acct: a };
  } catch (e) {
    await db(['DEL', 'pay:done:' + orderCode]);
    throw e;
  }
}
module.exports = { PLANS, SHORT, ready, payos, createSig, verifyHook, creditOrder, dataString, hmac };
