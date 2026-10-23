// Google sign-in, redirect mode (phones and home-screen apps, where the popup cannot report back).
// Google posts {credential, g_csrf_token} here as a form. After checking the double-submit CSRF cookie,
// the credential is parked under a one-time code for 2 minutes and the browser goes back to the app with #gauth=<code>.
// The page then calls api/auth {action:'google', code} with its own x-app-key, exactly like the popup flow.
const crypto = require('crypto');
const { APP, kv } = require('./_lib');

const cookie = (req, name) => {
  const m = String(req.headers.cookie || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
};
const back = (res, hash) => { res.statusCode = 303; res.setHeader('Location', '/#' + hash); res.setHeader('Cache-Control', 'no-store'); res.end(); };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return back(res, 'settings');
  let body = req.body;
  if (typeof body === 'string') body = Object.fromEntries(new URLSearchParams(body));
  body = body || {};
  const csrf = String(body.g_csrf_token || ''), ck = cookie(req, 'g_csrf_token');
  if (!csrf || csrf !== ck) return back(res, 'gauth-error');
  const credential = String(body.credential || '');
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(credential)) return back(res, 'gauth-error');
  const db = kv();
  if (!db) return back(res, 'gauth-error');
  try {
    const code = crypto.randomBytes(16).toString('hex');
    await db(['SET', APP + ':gauth:' + code, credential, 'EX', 120]);
    return back(res, 'gauth=' + code);
  } catch (e) {
    return back(res, 'gauth-error');
  }
};
