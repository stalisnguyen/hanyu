// Beta numbers for the owner, computed from api/ping and the usage counters. Called from api/ref (action 'stats').
const { APP, kv, kvp, vnDay } = require('./_lib');

async function stats() {
  const p = kvp(), db = kv();
  const days = Array.from({ length: 14 }, (_, i) => vnDay(-i));           // today first
  const cmds = [];
  for (const d of days) cmds.push(['SCARD', APP + ':dau:' + d], ['SCARD', APP + ':new:' + d], ['SCARD', APP + ':useu:' + d],
    ['GET', APP + ':use:ai:' + d], ['GET', APP + ':use:stt:' + d], ['GET', APP + ':use:tts:' + d]);
  const week = Array.from({ length: 7 }, (_, i) => APP + ':dau:' + vnDay(-i));
  cmds.push(['SUNION', ...week]);
  // retention: devices first seen on day c that were active again on day c+n, over cohorts from the last 45 days
  const ret = { 1: [0, 0], 7: [0, 0], 30: [0, 0] };
  const cohortCmds = [];
  for (const n of [1, 7, 30]) for (let c = n; c <= 45; c++)
    cohortCmds.push([n, ['SCARD', APP + ':new:' + vnDay(-c)], ['SINTER', APP + ':new:' + vnDay(-c), APP + ':dau:' + vnDay(-c + n)]]);
  const r = await p(cmds.concat(cohortCmds.flatMap(x => [x[1], x[2]])));
  const daily = days.map((d, i) => {
    const o = r.slice(i * 6, i * 6 + 6).map(x => +(Array.isArray(x) ? x.length : x) || 0);
    return { day: d, active: o[0], fresh: o[1], aiUsers: o[2], ai: o[3], stt: o[4], tts: o[5] };
  });
  const active7 = (r[days.length * 6] || []).length;
  let k = days.length * 6 + 1;
  for (const [n] of cohortCmds) { const size = +r[k] || 0, back = (r[k + 1] || []).length; ret[n][0] += back; ret[n][1] += size; k += 2; }
  // learners with synced progress
  let cursor = '0', learners = 0, guard = 0;
  do { const [nx, keys] = await db(['SCAN', cursor, 'MATCH', APP + ':p:*', 'COUNT', 500]); cursor = String(nx); learners += keys.length; } while (cursor !== '0' && ++guard < 50);
  return { daily, active7, learners, retention: Object.fromEntries(Object.entries(ret).map(([n, [b, s]]) => [n, { back: b, of: s }])) };
}
module.exports = { stats };
