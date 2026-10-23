// payOS webhook: called by payOS when a transfer arrives. The signature over `data` is checked with the
// checksum key; a paid order is credited once (see _pay.js). payOS also calls this once with test data
// when the webhook is registered; that gets a 200 too.
const { kv } = require('./_lib');
const { verifyHook, creditOrder } = require('./_pay');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  if (!verifyHook(body)) return res.status(400).json({ error: 'signature' });
  const db = kv();
  if (!db) return res.status(503).json({ error: 'no_kv' });
  const d = body.data;
  try {
    if (String(d.code || body.code) === '00') {
      const r = await creditOrder(db, Number(d.orderCode), d.amount);
      if (r.short) console.error('payhook: amount too small', d.orderCode, d.amount);
    }
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('payhook', e);
    return res.status(500).json({ error: 'server' });
  }
};
