'use strict';
// Turns raw usernames into resolved, stat-loaded, tagged rows for the overlay.
// Lookups are queued and rate-limited so a big lobby doesn't hammer the APIs all
// at once, and every change fires 'update' with the full list so the overlay can
// just re-render rather than track deltas itself.
const { EventEmitter } = require('events');
const stats = require('./stats');

class Roster extends EventEmitter {
  constructor(hypixel, urchin, getConfig) {
    super();
    this.hy = hypixel;
    this.ur = urchin;
    this.getConfig = getConfig;
    this.players = new Map();   // lowerName -> row
    this._queue = [];
    this._active = 0;
  }

  list() { return [...this.players.values()]; }

  clear() { this.players.clear(); this._emit(); }

  removeByUuid(uuid) {
    for (const [k, v] of this.players) if (v.uuid === uuid) this.players.delete(k);
    this._emit();
  }
  removeByName(name) { this.players.delete(name.toLowerCase()); this._emit(); }

  addNames(names, source) {
    const cfg = this.getConfig();
    for (const raw of names) {
      const name = String(raw).trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (cfg.hideSelf && (cfg.selfName || '').toLowerCase() === key) continue;
      if (this.players.has(key)) { this.players.get(key).source = this.players.get(key).source || source; continue; }
      const row = { name, key, uuid: null, source, addedAt: Date.now(), loading: true };
      this.players.set(key, row);
      this._enqueue(row);
    }
    this._emit();
  }

  _enqueue(row) { this._queue.push(row); this._drain(); }

  _drain() {
    const cfg = this.getConfig();
    const limit = Math.max(1, cfg.concurrency || 4);
    while (this._active < limit && this._queue.length) {
      const row = this._queue.shift();
      this._active++;
      this._load(row).finally(() => { this._active--; this._drain(); });
    }
  }

  async _load(row) {
    const cfg = this.getConfig();
    try {
      const resolved = await this.hy.resolveUuid(row.name);
      if (!resolved) { row.loading = false; row.nicked = true; row.error = 'nicked'; this._emit(); return; }
      row.uuid = resolved.id;
      row.name = resolved.name; // fix casing

      const [player, urchin] = await Promise.all([
        this.hy.fetchPlayer(resolved.id).catch((e) => { row.apiError = e.code === 403 ? 'bad key' : (e.code === 429 ? 'rate limit' : 'api err'); return null; }),
        this.ur.lookup(resolved.id, resolved.name).catch(() => ({ tags: [], severity: 0, score: 0 })),
      ]);

      row.urchin = urchin;
      row.raw = player || null; // full Hypixel player object, kept around for user-defined custom columns
      if (player) {
        const baseline = this.hy.monthlyBaseline(resolved.id);
        const s = stats.extract(player, baseline);
        row.stats = s;
        row.sniper = stats.sniperScore(s, { weights: cfg.sniperWeights, tagSeverity: urchin.severity || 0 });
        row.displayName = player.displayname || resolved.name;
      } else {
        row.stats = null;
        row.sniper = stats.sniperScore(null, { weights: cfg.sniperWeights, tagSeverity: urchin.severity || 0 });
      }
      row.loading = false;
      this._emit();
    } catch (e) {
      row.loading = false; row.error = String(e.message || e); this._emit();
    }
  }

  // periodic re-fetch for open list (used when refreshSeconds > 0)
  refreshAll() {
    for (const row of this.players.values()) { row.loading = true; this._enqueue(row); }
    this._emit();
  }

  _emit() {
    clearTimeout(this._emitTimer);
    this._emitTimer = setTimeout(() => this.emit('update', this.list()), 60);
  }
}

module.exports = { Roster };
