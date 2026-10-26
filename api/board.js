// Study board: weekly XP, streak and rank of every learner. Any signed-in account (or an older group/invite key).
// me = this learner's profile, so the app can highlight the right row.
const { denySync, kv, userOf, getAcct } = require('./_lib');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const db = kv();
  if (!db) return res.status(503).json({ error: 'no_store' });
  if (!process.env.APP_PASSWORD) return res.status(503).json({ error: 'no_password' });
  if (await denySync(req, res)) return;
  try {
    const flat = (await db(['HGETALL', 'hanyu:board'])) || [];
    const list = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      try { list.push(Object.assign({ slug: flat[i] }, JSON.parse(flat[i + 1]))); } catch (e) {}
    }
    const k = req._k || {};
    const acct = k.sub ? await getAcct(db, k.sub) : null;
    const me = k.sub ? (acct && acct.slug) || '' : (userOf(req) || {}).slug || '';
    return res.status(200).json({ list, me });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'store' });
  }
};
