// Study-group board: weekly XP, streak and rank of every learner. Group password required.
const { checkKey, kv } = require('./_lib');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const db = kv();
  if (!db) return res.status(503).json({ error: 'no_store' });
  if (!process.env.APP_PASSWORD) return res.status(503).json({ error: 'no_password' });
  if (!checkKey(req)) return res.status(401).json({ error: 'auth' });
  try {
    const flat = (await db(['HGETALL', 'hanyu:board'])) || [];
    const list = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      try { list.push(Object.assign({ slug: flat[i] }, JSON.parse(flat[i + 1]))); } catch (e) {}
    }
    return res.status(200).json({ list });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'store' });
  }
};
