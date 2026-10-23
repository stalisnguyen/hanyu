// Anonymous daily activity for the beta numbers: each browser sends a random device id at most once a day.
// Also remembers the first day anything was counted (<app>:since), so the chart can tell 'not measured' from 0.
// Stores which devices were active on which day and the first day each device was seen. No names or content.
const { APP, kvp, vnDay } = require('./_lib');
const KEEP = 120 * 86400;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const p = kvp();
  if (!p) return res.status(200).json({ ok: false });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const d = String((body || {}).d || '');
  if (!/^[a-f0-9]{16,40}$/.test(d)) return res.status(400).json({ error: 'id' });
  const day = vnDay();
  try {
    const [, , isNew] = await p([['SADD', APP + ':dau:' + day, d], ['EXPIRE', APP + ':dau:' + day, KEEP],
                                 ['SET', APP + ':first:' + d, day, 'NX', 'EX', KEEP], ['SET', APP + ':since', day, 'NX']]);
    if (isNew === 'OK') await p([['SADD', APP + ':new:' + day, d], ['EXPIRE', APP + ':new:' + day, KEEP]]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false });
  }
};
