'use strict';
/*
 * Hypixel + Mojang client.
 *  - Resolves username -> UUID (Mojang, cached to disk).
 *  - Fetches Hypixel player object with an in-memory TTL cache.
 *  - Simple token-bucket rate limiter tuned for the 300 req / 5 min personal key.
 *  - Persists daily snapshots per UUID so stats.js can compute "monthly" FKDR.
 * Uses global fetch (Electron 31 / Node 20) — zero runtime dependencies.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let dataDir = null;
function dir() {
  if (!dataDir) { dataDir = app.getPath('userData'); try { fs.mkdirSync(dataDir, { recursive: true }); } catch (_) {} }
  return dataDir;
}

// ---------- tiny JSON disk store ----------
function readJson(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(dir(), name), 'utf8')); } catch (_) { return fallback; }
}
function writeJson(name, obj) {
  try { fs.writeFileSync(path.join(dir(), name), JSON.stringify(obj)); } catch (e) { console.error('write', name, e); }
}

// ---------- rate limiter (token bucket) ----------
function makeLimiter(maxPerWindow, windowMs) {
  let tokens = maxPerWindow;
  let last = Date.now();
  const queue = [];
  function refill() {
    const now = Date.now();
    tokens = Math.min(maxPerWindow, tokens + (now - last) * (maxPerWindow / windowMs));
    last = now;
  }
  function pump() {
    refill();
    while (queue.length && tokens >= 1) { tokens -= 1; queue.shift()(); }
    if (queue.length) setTimeout(pump, Math.ceil(windowMs / maxPerWindow) + 20);
  }
  return () => new Promise((res) => { queue.push(res); pump(); });
}

class Hypixel {
  constructor(getConfig) {
    this.getConfig = getConfig;
    this.uuidCache = readJson('uuid-cache.json', {});    // name(lower) -> {id,name,ts}
    this.playerCache = new Map();                        // uuid -> {ts,data}
    this.snapshots = readJson('snapshots.json', {});     // uuid -> [{ts,fk,fd,w,l}]
    // 300 / 5min personal key -> leave headroom. Bump automatically if app key set.
    this.limiter = makeLimiter(240, 5 * 60 * 1000);
  }

  setRateLimit(maxPer5min) { this.limiter = makeLimiter(maxPer5min, 5 * 60 * 1000); }

  async resolveUuid(name) {
    const key = name.toLowerCase();
    const hit = this.uuidCache[key];
    if (hit && Date.now() - hit.ts < 24 * 3600 * 1000) return hit;
    try {
      const r = await fetch('https://api.mojang.com/users/profiles/minecraft/' + encodeURIComponent(name));
      if (r.status === 204 || r.status === 404) return null; // nicked / nonexistent
      if (!r.ok) throw new Error('mojang ' + r.status);
      const j = await r.json();
      const rec = { id: j.id.toLowerCase(), name: j.name, ts: Date.now() };
      this.uuidCache[key] = rec;
      writeJson('uuid-cache.json', this.uuidCache);
      return rec;
    } catch (e) { return null; }
  }

  async fetchPlayer(uuid) {
    const cfg = this.getConfig();
    const ttl = (cfg.cacheMinutes || 3) * 60 * 1000;
    const c = this.playerCache.get(uuid);
    if (c && Date.now() - c.ts < ttl) return c.data;

    await this.limiter();
    const url = 'https://api.hypixel.net/v2/player?uuid=' + uuid;
    const r = await fetch(url, { headers: { 'API-Key': cfg.hypixelKey } });
    if (r.status === 429) { const e = new Error('RATE_LIMIT'); e.code = 429; throw e; }
    if (r.status === 403) { const e = new Error('BAD_KEY'); e.code = 403; throw e; }
    if (!r.ok) throw new Error('hypixel ' + r.status);
    const j = await r.json();
    if (!j.success) throw new Error(j.cause || 'hypixel error');
    const data = j.player; // may be null for players who never logged into Hypixel
    this.playerCache.set(uuid, { ts: Date.now(), data });
    this.recordSnapshot(uuid, data);
    return data;
  }

  // Keep one snapshot per UTC day; retain ~45 days for the monthly window.
  recordSnapshot(uuid, player) {
    if (!player) return;
    const bw = ((player.stats || {}).Bedwars) || {};
    const snap = {
      ts: Date.now(),
      fk: +bw.final_kills_bedwars || 0,
      fd: +bw.final_deaths_bedwars || 0,
      w: +bw.wins_bedwars || 0,
      l: +bw.losses_bedwars || 0,
    };
    const arr = this.snapshots[uuid] || [];
    const dayMs = 24 * 3600 * 1000;
    const last = arr[arr.length - 1];
    if (last && snap.ts - last.ts < dayMs) { arr[arr.length - 1] = snap; }
    else arr.push(snap);
    // prune >45d
    const cutoff = Date.now() - 45 * dayMs;
    this.snapshots[uuid] = arr.filter((x) => x.ts >= cutoff);
    // debounce disk writes a touch
    clearTimeout(this._snapTimer);
    this._snapTimer = setTimeout(() => writeJson('snapshots.json', this.snapshots), 1500);
  }

  // Oldest snapshot within the last 30 days -> used as the monthly baseline.
  monthlyBaseline(uuid) {
    const arr = this.snapshots[uuid] || [];
    if (arr.length < 2) return null;
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    const inWindow = arr.filter((x) => x.ts >= cutoff);
    const base = inWindow.length ? inWindow[0] : arr[0];
    return { finalKills: base.fk, finalDeaths: base.fd, wins: base.w, losses: base.l, ts: base.ts };
  }
}

module.exports = { Hypixel };
