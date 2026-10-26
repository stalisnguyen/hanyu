// Paid plans by VietQR bank transfer, confirmed by SePay (sepay.vn) shared by the four study apps.
// The buyer transfers straight into the owner's bank account; SePay only reports the incoming transfer
// to api/sepayhook. Each order has a payment code STA + 8 digits that goes in the transfer content.
// Orders live under pay:order:<code> with the app name inside, so the webhook in any app can credit
// the right account (all apps share one Redis).
// Env (Vercel, team-shared): SEPAY_API_KEY (webhook key), SEPAY_BANK (short bank name as in
// vietqr.app/banks.json, e.g. MBBank, ACB), SEPAY_ACCOUNT (account number), SEPAY_ACCOUNT_NAME (optional).
const crypto = require('crypto');
const { BETA_UNTIL_DEFAULT } = require('./_lib');

const PLANS = { month: { amount: 49000, days: 30 }, year: { amount: 399000, days: 365 } };
const PREFIX = 'STA';                       // SePay: payment code prefix STA, numeric suffix of 8
const CODE_RE = /STA(\d{8})/i;
const cfg = () => ({ key: process.env.SEPAY_API_KEY || '', bank: process.env.SEPAY_BANK || '',
  acc: String(process.env.SEPAY_ACCOUNT || '').replace(/\s+/g, ''), name: process.env.SEPAY_ACCOUNT_NAME || '' });
const ready = () => { const c = cfg(); return !!(c.key && c.bank && c.acc); };
const newCode = () => PREFIX + String(crypto.randomInt(0, 1e8)).padStart(8, '0');
const qrUrl = (amount, code) => { const c = cfg();
  return 'https://vietqr.app/img?' + new URLSearchParams({ acc: c.acc, bank: c.bank, amount: String(amount), des: code }).toString(); };
// Authorization: Apikey <SEPAY_API_KEY>
function hookAuthorized(req) {
  const k = cfg().key; if (!k) return false;
  const got = String(req.headers.authorization || '').replace(/^Apikey\s+/i, '');
  const a = crypto.createHash('sha256').update(got).digest(), b = crypto.createHash('sha256').update(k).digest();
  return /^Apikey\s+/i.test(String(req.headers.authorization || '')) && crypto.timingSafeEqual(a, b);
}
const codeOf = t => { const m = String(t || '').match(CODE_RE); return m ? PREFIX + m[1] : null; };

// Credits one paid order to its account, once. Paid time starts after any time already paid,
// and for beta members after the free beta ends. -> {ok, order, acct} | {already} | {unknown} | {short}
async function creditOrder(db, code, amountSeen) {
  const raw = await db(['GET', 'pay:order:' + code]);
  if (!raw) return { unknown: true };
  const o = JSON.parse(raw);
  if (amountSeen !== undefined && +amountSeen < o.amount) return { short: true, order: o };
  const lock = await db(['SET', 'pay:done:' + code, String(Date.now()), 'NX']);
  if (lock === null) return { already: true, order: o };
  try {
    const key = o.app + ':acct:' + o.sub;
    const a = JSON.parse((await db(['GET', key])) || 'null');
    if (!a) throw new Error('no account');
    const bu = +(await db(['GET', o.app + ':cfg:betaUntil'])) || BETA_UNTIL_DEFAULT;
    const now = Date.now();
    const start = Math.max(now, a.paidUntil || 0, bu); // bought during the free beta: the plan starts when the beta ends
    a.paidUntil = start + PLANS[o.plan].days * 864e5;
    a.pays = (a.pays || []).concat([{ code, plan: o.plan, amount: o.amount, at: now }]).slice(-50);
    await db(['SET', key, JSON.stringify(a)]);
    Object.assign(o, { status: 'PAID', paidAt: now });
    await db(['SET', 'pay:order:' + code, JSON.stringify(o)]);
    await db(['INCRBY', o.app + ':rev', String(o.amount)]);
    await db(['INCR', o.app + ':sold:' + o.plan]);
    return { ok: true, order: o, acct: a };
  } catch (e) {
    await db(['DEL', 'pay:done:' + code]);
    throw e;
  }
}
module.exports = { PLANS, PREFIX, ready, cfg, newCode, qrUrl, hookAuthorized, codeOf, creditOrder };
