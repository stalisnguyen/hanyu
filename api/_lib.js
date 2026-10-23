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

// Access: the group password, an invite key, or a signed-in account that is active (see keyInfo below).
async function checkKey(req) { return (await keyInfo(req)).state === 'ok'; }

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

// Several Redis commands in one request (Upstash REST pipeline). Returns the results in order.
function kvp() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return async (commands) => {
    if (!commands.length) return [];
    const r = await fetch(url.replace(/\/$/, '') + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    });
    const j = await r.json();
    if (!r.ok || !Array.isArray(j)) throw new Error('kv pipeline ' + r.status);
    return j.map(x => (x && x.error ? null : x && x.result));
  };
}

// Calendar day in Vietnam time (UTC+7), e.g. "20261023"; offset in days.
function vnDay(offset = 0) {
  const d = new Date(Date.now() + 7 * 3600e3 + offset * 864e5);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}
const KEEP = 120 * 86400; // usage counters are kept for 120 days

// Count one paid-feature call (ai, stt, tts) for the beta numbers. Never throws.
async function track(kind, req) {
  try {
    const p = kvp(); if (!p) return;
    const day = vnDay(), who = sha(String(req.headers['x-app-key'] || '')).toString('hex').slice(0, 16);
    await p([['INCR', APP + ':use:' + kind + ':' + day], ['EXPIRE', APP + ':use:' + kind + ':' + day, KEEP],
             ['SADD', APP + ':useu:' + day, who], ['EXPIRE', APP + ':useu:' + day, KEEP]]);
  } catch (e) {}
}

// ---- accounts (Google sign-in) ----
// Public OAuth client ID of the "Stalis Study Apps" Google project (not a secret).
const GOOGLE_CLIENT_ID = '764861746953-4nsjobj6ca8cm8tpt5srgo03u18hpjs2.apps.googleusercontent.com';
const normCode = c => String(c || '').trim().toUpperCase().replace(/\s+/g, '');
// An account can use AI and sync while it is a beta member (invite code or group password), on trial, or paid.
const isActive = a => !!a && (!!a.beta || (a.trialEnd || 0) > Date.now() || (a.paidUntil || 0) > Date.now());
async function getAcct(db, sub) {
  try { const raw = await db(['GET', APP + ':acct:' + sub]); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
async function putAcct(db, sub, a) {
  await db(['SET', APP + ':acct:' + sub, JSON.stringify(a)]);
  await db(['SADD', APP + ':accts', sub]);
}
// What the key on this request is: {state:'ok'|'none'|'inactive', master?, tok?, sub?, acct?}
async function keyInfo(req) {
  if (isMaster(req)) return { state: 'ok', master: true };
  const got = String(req.headers['x-app-key'] || '');
  if (!process.env.APP_PASSWORD || !/^[a-f0-9]{40}$/.test(got)) return { state: 'none' };
  const db = kv(); if (!db) return { state: 'none' };
  try {
    const raw = await db(['GET', APP + ':tok:' + sha(got).toString('hex')]);
    if (!raw) return { state: 'none' };
    let tok = {}; try { tok = JSON.parse(raw) || {}; } catch (e) {}
    if (!tok.sub) return { state: 'ok', tok };
    const acct = await getAcct(db, tok.sub);
    if (!acct) return { state: 'none' };
    return { state: isActive(acct) ? 'ok' : 'inactive', tok, sub: tok.sub, acct };
  } catch (e) { return { state: 'none' }; }
}
// Sends 401 (no valid key) or 402 (signed in, but no beta, trial or paid plan) and returns true when access is refused.
async function deny(req, res) {
  const k = await keyInfo(req);
  if (k.state === 'ok') return false;
  if (k.state === 'inactive') res.status(402).json({ error: 'inactive' });
  else res.status(401).json({ error: 'auth' });
  return true;
}
// 20 tries per hour per IP for anything that guesses a code.
async function tooMany(db, req) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const rl = APP + ':rl:' + sha(ip).toString('hex').slice(0, 16);
  const tries = await db(['INCR', rl]);
  if (tries === 1) await db(['EXPIRE', rl, 3600]);
  return tries > 20;
}
// Takes one place of the current invite code. -> {n, max, code} | {full:true, max} | {invalid:true}
async function takeInvite(db, given) {
  const K = s => APP + ':ref:' + s;
  const [code, maxRaw] = await Promise.all([db(['GET', K('code')]), db(['GET', K('max')])]);
  const max = +maxRaw || 50;
  given = normCode(given);
  if (!code || !given || given.length !== code.length ||
      !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(code))) return { invalid: true };
  const n = await db(['INCR', K('used:' + code)]);
  if (n > max) { await db(['DECR', K('used:' + code)]); return { full: true, max }; }
  await db(['INCR', K('issued')]);
  return { n, max, code };
}
// The owner: ADMIN_PASSWORD on this request, or a signed-in account marked as owner.
async function isOwner(req) {
  if (isAdmin(req)) return true;
  const k = await keyInfo(req);
  return !!(k.acct && k.acct.owner);
}

module.exports = { APP, sha, isMaster, isAdmin, checkKey, kv, kvp, vnDay, track, userOf, keyInfo, deny, isActive, getAcct, putAcct, tooMany, takeInvite, normCode, GOOGLE_CLIENT_ID, isOwner };
