// SePay webhook: called for each transaction on the linked bank account.
// Auth: header "Authorization: Apikey <SEPAY_API_KEY>". Only incoming transfers to SEPAY_ACCOUNT whose content
// carries a payment code STA + 8 digits are used; the order is credited once (amount must cover the plan).
// Each SePay transaction id is handled once (SePay retries until it gets 200 {"success": true}).
const { kv } = require('./_lib');
const { cfg, hookAuthorized, codeOf, creditOrder } = require('./_pay');
const done = res => res.status(200).json({ success: true });

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ success: false });
  if (!hookAuthorized(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};
  const db = kv();
  if (!db) return res.status(503).json({ success: false });
  try {
    if (b.transferType !== 'in') return done(res);
    const acc = cfg().acc;
    if (acc && b.accountNumber && String(b.accountNumber).replace(/\s+/g, '') !== acc && String(b.subAccount || '') === '') return done(res);
    const code = codeOf(b.code) || codeOf(b.content) || codeOf(b.description);
    if (!code) return done(res);
    if (b.id !== undefined && b.id !== null) {
      const first = await db(['SET', 'pay:tx:' + b.id, code, 'NX', 'EX', 90 * 86400]);
      if (first === null) return done(res);                       // same transaction again
      try {
        const r = await creditOrder(db, code, b.transferAmount);
        if (r.short) console.error('sepayhook: amount too small', code, b.transferAmount);
        if (r.unknown) console.error('sepayhook: unknown order', code);
      } catch (e) { await db(['DEL', 'pay:tx:' + b.id]); throw e; }
    } else {
      await creditOrder(db, code, b.transferAmount);
    }
    return done(res);
  } catch (e) {
    console.error('sepayhook', e);
    return res.status(500).json({ success: false });
  }
};
