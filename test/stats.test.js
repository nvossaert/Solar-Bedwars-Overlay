'use strict';
// Lightweight assertions for the pure stat math. Run: npm test
const assert = require('assert');
const s = require('../src/main/stats');

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('FAIL  ' + name + ' -> ' + e.message); } }
const approx = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} !~= ${b}`);

// ---- star / level ----
t('level 0 at 0 xp', () => assert.strictEqual(s.starFromExp(0), 0));
t('level 1 at 500 xp', () => assert.strictEqual(s.starFromExp(500), 1));
t('level 2 at 1500 xp', () => assert.strictEqual(s.starFromExp(1500), 2));
t('level 4 at 7000 xp', () => assert.strictEqual(s.starFromExp(7000), 4));
t('level 5 at 12000 xp', () => assert.strictEqual(s.starFromExp(12000), 5));
t('prestige: 487000 xp = level 100', () => assert.strictEqual(s.starFromExp(487000), 100));
t('prestige: 974000 xp = level 200', () => assert.strictEqual(s.starFromExp(974000), 200));

// ---- ratios (Hypixel divide-by-zero convention) ----
t('fkdr normal', () => approx(s.ratio(100, 50), 2));
t('fkdr zero deaths -> numerator', () => assert.strictEqual(s.ratio(30, 0), 30));

// ---- extract ----
const fakePlayer = {
  displayname: 'Tester',
  lastLogin: Date.now() - 3600e3,
  firstLogin: Date.now() - 400 * 24 * 3600e3,
  networkExp: 50000,
  stats: { Bedwars: {
    Experience: 500000, final_kills_bedwars: 5000, final_deaths_bedwars: 1000,
    wins_bedwars: 900, losses_bedwars: 300, kills_bedwars: 8000, deaths_bedwars: 4000,
    beds_broken_bedwars: 1200, beds_lost_bedwars: 400, games_played_bedwars: 1500, winstreak: 12,
  } },
};
const baseline = { finalKills: 4800, finalDeaths: 960, wins: 860, losses: 290, ts: Date.now() - 30 * 24 * 3600e3 };
const ex = s.extract(fakePlayer, baseline);
t('extract star >= 100', () => assert.ok(ex.star >= 100));
t('extract fkdr = 5.0', () => approx(ex.fkdr, 5.0));
t('extract wlr = 3.0', () => approx(ex.wlr, 3.0));
t('extract monthly fkdr = 40/(1000-960)=5.0', () => approx(ex.mfkdr, 5.0));
t('extract monthly finals delta = 200', () => assert.strictEqual(ex.mFinals, 200));
t('winstreak passthrough', () => assert.strictEqual(ex.winstreak, 12));

// ---- sniper score ----
const weights = { fkdr: 26, star: 14, wlr: 14, winstreak: 6, monthlyTrend: 16, accountAge: 10, recentLogin: 4, tags: 10 };
const sn = s.sniperScore(ex, { weights, tagSeverity: 0 });
t('sniper score in 0..100', () => assert.ok(sn.score >= 0 && sn.score <= 100));
t('strong player scores > 40', () => assert.ok(sn.score > 40, 'got ' + sn.score));
t('sniper has a label', () => assert.ok(typeof sn.label === 'string' && sn.label.length));
const snTagged = s.sniperScore(ex, { weights, tagSeverity: 1 });
t('cheater tag raises score', () => assert.ok(snTagged.score >= sn.score));
const low = s.sniperScore(s.extract({ stats: { Bedwars: { Experience: 6000, final_kills_bedwars: 10, final_deaths_bedwars: 40, wins_bedwars: 5, losses_bedwars: 30 } } }, null), { weights });
t('weak player scores low', () => assert.ok(low.score < 25, 'got ' + low.score));
t('null player -> score 0', () => assert.strictEqual(s.sniperScore(null, { weights }).score, 0));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
