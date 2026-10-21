// Shared helpers for the serverless functions.
const crypto = require('crypto');
const APP = 'hanyu'; // key prefix in Redis

const sha = s => crypto.createHash('sha256').update(String(s)).digest();

const same = (pass, got) => !!pass && !!got && crypto.timingSafeEqual(sha(pass), sha(got));
// The group password (APP_PASSWORD) or the owner's admin password (ADMIN_PASSWORD), both set in Vercel.
function isMaster(req) {
  const got = String(req.headers['x-app-key'] || '');
  return same(process.env.APP_PASSWORD || '', got) || same(process.env.ADMIN_PASSWORD || '', got);
}
// Only the owner: manages the invite code. Off until ADMIN_PASSWORD is set.
function isAdmin(req) {
  return same(process.env.ADMIN_PASSWORD || '', String(req.headers['x-app-key'] || ''));
}

// Access: the group password, or a personal access key issued when someone redeemed an invite code (api/ref).
async function checkKey(req) {
  if (isMaster(req)) return true;
  const got = String(req.headers['x-app-key'] || '');
  if (!process.env.APP_PASSWORD || !/^[a-f0-9]{40}$/.test(got)) return false;
  const db = kv(); if (!db) return false;
  try { return !!(await db(['EXISTS', APP + ':tok:' + sha(got).toString('hex')])); } catch (e) { return false; }
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

module.exports = { APP, sha, isMaster, isAdmin, checkKey, kv, userOf };
