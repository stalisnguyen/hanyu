// Shared helpers for the serverless functions.
const crypto = require('crypto');

function checkKey(req) {
  const pass = process.env.APP_PASSWORD || '';
  const got = String(req.headers['x-app-key'] || '');
  if (!pass || !got) return false;
  const a = crypto.createHash('sha256').update(pass).digest();
  const b = crypto.createHash('sha256').update(got).digest();
  return crypto.timingSafeEqual(a, b);
}

// Upstash Redis REST (Vercel Marketplace sets KV_REST_API_* or UPSTASH_REDIS_REST_*)
function kv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return async (command) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error || 'kv ' + r.status);
    return j.result;
  };
}

// Learner profile from headers: slug is lowercase a-z, 0-9, dash (built client side from the name)
function userOf(req) {
  const slug = String(req.headers['x-user'] || '').toLowerCase();
  if (!/^[a-z0-9-]{1,30}$/.test(slug)) return null;
  return { slug, pin: String(req.headers['x-user-pin'] || '').slice(0, 20) };
}

module.exports = { checkKey, kv, userOf };
