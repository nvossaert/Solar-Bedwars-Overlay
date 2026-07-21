'use strict';
/*
 * Pure stat math. No I/O here so it can be unit-tested (see test/stats.test.js).
 * Given a raw Hypixel player object, produce the numbers the overlay shows plus
 * the self-hosted "sniper" (threat) score.
 */

// ---- Bedwars star / level from EXP (official leveling curve) ----
const EASY_XP = [500, 1000, 2000, 3500];         // xp for levels 1..4 of each prestige
const XP_PER_PRESTIGE = 96 * 5000 + 7000;        // 487000

function expForLevel(level) {
  const r = level % 100;
  if (r === 0) return 0;
  if (r <= 4) return EASY_XP[r - 1];
  return 5000;
}

function starFromExp(exp) {
  exp = Math.max(0, +exp || 0);
  const prestiges = Math.floor(exp / XP_PER_PRESTIGE);
  let level = prestiges * 100;
  let rem = exp - prestiges * XP_PER_PRESTIGE;
  for (let i = 1; i <= 4; i++) {
    const need = expForLevel(i);
    if (rem < need) return level;
    level++; rem -= need;
  }
  return level + Math.floor(rem / 5000);
}

function ratio(a, b) {
  a = +a || 0; b = +b || 0;
  if (b === 0) return a; // Hypixel convention: divide-by-zero -> numerator
  return a / b;
}

function round(n, d = 2) {
  const p = Math.pow(10, d);
  return Math.round((+n || 0) * p) / p;
}

// ---- Star prestige color (Bedwars "star colors") for the overlay ----
function starColor(star) {
  const p = Math.floor(star / 100);
  const table = {
    0: '#aaaaaa', 1: '#ffffff', 2: '#ffd500', 3: '#55ffff', 4: '#00aa00',
    5: '#00aaaa', 6: '#aa00aa', 7: '#5555ff', 8: '#aa0000', 9: '#000000',
  };
  if (p >= 10) return '#ff5555'; // rainbow tier -> hot red-ish, renderer may animate
  return table[p] || '#aaaaaa';
}

/*
 * Extract a clean stats object from a raw Hypixel player payload.
 * `snapshot` is an optional { finalKills, finalDeaths, wins, losses, ts } captured >= ~30d ago
 * used to compute monthly (session-tracked) FKDR.
 */
function extract(player, snapshot) {
  if (!player) return null;
  const bw = ((player.stats || {}).Bedwars) || {};
  const finalKills = +bw.final_kills_bedwars || 0;
  const finalDeaths = +bw.final_deaths_bedwars || 0;
  const wins = +bw.wins_bedwars || 0;
  const losses = +bw.losses_bedwars || 0;
  const kills = +bw.kills_bedwars || 0;
  const deaths = +bw.deaths_bedwars || 0;
  const bedsBroken = +bw.beds_broken_bedwars || 0;
  const bedsLost = +bw.beds_lost_bedwars || 0;
  const gamesPlayed = +bw.games_played_bedwars || 0;
  const exp = +bw.Experience || +bw.Experience_new || 0;
  const winstreak = (bw.winstreak == null) ? null : +bw.winstreak; // null => hidden by API

  const star = starFromExp(exp);
  const fkdr = ratio(finalKills, finalDeaths);
  const wlr = ratio(wins, losses);
  const kdr = ratio(kills, deaths);
  const bblr = ratio(bedsBroken, bedsLost);

  // Monthly / tracked FKDR from snapshot delta
  let mfkdr = null, mFinals = null;
  if (snapshot && (finalKills - snapshot.finalKills) >= 0) {
    const dFk = finalKills - snapshot.finalKills;
    const dFd = finalDeaths - snapshot.finalDeaths;
    if (dFk + dFd > 0) { mfkdr = ratio(dFk, dFd); mFinals = dFk; }
  }

  return {
    star, exp,
    finalKills, finalDeaths, fkdr: round(fkdr),
    wins, losses, wlr: round(wlr),
    kills, deaths, kdr: round(kdr),
    bedsBroken, bedsLost, bblr: round(bblr),
    gamesPlayed, winstreak,
    mfkdr: mfkdr == null ? null : round(mfkdr),
    mFinals,
    starColorHex: starColor(star),
    lastLogin: +player.lastLogin || null,
    lastLogout: +player.lastLogout || null,
    firstLogin: +player.firstLogin || null,
    networkLevel: networkLevel(+player.networkExp || 0),
    rank: hypixelRank(player),
  };
}

// Hypixel network level (for alt/sniper detection: high BW star + low network level = sus)
function networkLevel(exp) {
  return round((Math.sqrt(2 * exp + 30625) / 50) - 2.5, 1);
}

function hypixelRank(p) {
  if (!p) return 'NONE';
  if (p.rank && !['NORMAL', 'PLAYER'].includes(p.rank)) return p.rank; // ADMIN/YOUTUBER etc
  const pkg = p.newPackageRank || p.packageRank;
  if (p.monthlyPackageRank && p.monthlyPackageRank !== 'NONE') return 'SUPERSTAR'; // MVP++
  return pkg || 'NONE';
}

/*
 * Sniper / threat score: 0-100 + a label.
 * Transparent, weighted blend of skill, experience, recent-sweat trend, account
 * plausibility and blacklist tags. Weights come from config so they're tunable.
 * Returns { score, label, color, breakdown }.
 */
function sniperScore(s, opts = {}) {
  const w = opts.weights || {};
  const tagWeight = opts.tagSeverity || 0; // 0..1 from urchin/local tags
  const now = opts.now || Date.now();
  if (!s) return { score: 0, label: '—', color: '#8b949e', breakdown: {} };

  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  // Each sub-signal normalized to 0..1
  const fFkdr = clamp01((s.fkdr || 0) / 10);                 // 10+ fkdr ~ maxed
  const fStar = clamp01((s.star || 0) / 600);               // 600★ ~ maxed
  const fWlr  = clamp01((s.wlr || 0) / 6);                  // 6+ wlr ~ maxed
  const fWs   = clamp01((s.winstreak || 0) / 30);           // 30 ws ~ maxed
  // Recent sweat: monthly fkdr notably above lifetime fkdr -> actively grinding / sniping
  let fTrend = 0;
  if (s.mfkdr != null && s.fkdr > 0) fTrend = clamp01((s.mfkdr - s.fkdr) / (s.fkdr + 1) + 0.25);
  // Account plausibility: high BW star but low network level => likely alt/sniper account
  let fAcct = 0;
  if (s.networkLevel != null && s.star > 100) {
    const expectedNet = 20 + s.star * 0.35;
    if (s.networkLevel < expectedNet) fAcct = clamp01((expectedNet - s.networkLevel) / expectedNet);
  }
  // Logged in very recently => currently active threat
  let fRecent = 0;
  if (s.lastLogin) {
    const hrs = (now - s.lastLogin) / 3.6e6;
    fRecent = clamp01(1 - hrs / 24);
  }

  const parts = {
    fkdr: fFkdr * (w.fkdr || 0),
    star: fStar * (w.star || 0),
    wlr: fWlr * (w.wlr || 0),
    winstreak: fWs * (w.winstreak || 0),
    monthlyTrend: fTrend * (w.monthlyTrend || 0),
    accountAge: fAcct * (w.accountAge || 0),
    recentLogin: fRecent * (w.recentLogin || 0),
    tags: tagWeight * (w.tags || 0),
  };
  let score = Math.round(Object.values(parts).reduce((a, b) => a + b, 0));
  score = Math.max(0, Math.min(100, score));

  let label, color;
  if (score >= 85)      { label = 'SNIPER';  color = '#ff2d55'; }
  else if (score >= 70) { label = 'DANGER';  color = '#ff6b35'; }
  else if (score >= 55) { label = 'TRYHARD'; color = '#ffb454'; }
  else if (score >= 38) { label = 'SWEAT';   color = '#e3e327'; }
  else if (score >= 20) { label = 'DECENT';  color = '#7ee787'; }
  else                  { label = 'CHILL';   color = '#56d364'; }

  return { score, label, color, breakdown: parts };
}

function relativeTime(ts, now = Date.now()) {
  if (!ts) return '—';
  const s = Math.floor((now - ts) / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60); if (m < 60) return m + 'm';
  const h = Math.floor(m / 60); if (h < 24) return h + 'h';
  const d = Math.floor(h / 24); if (d < 30) return d + 'd';
  const mo = Math.floor(d / 30); if (mo < 12) return mo + 'mo';
  return Math.floor(mo / 12) + 'y';
}

module.exports = {
  starFromExp, expForLevel, ratio, round, starColor,
  extract, sniperScore, networkLevel, hypixelRank, relativeTime,
};
