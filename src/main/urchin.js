'use strict';
/*
 * Urchin blacklist integration + local imported blacklist DB.
 *  - lookup(): hits the fully-configurable Urchin endpoint, parses tags + score,
 *    then merges in the bundled local import (data/blacklist.json), any local
 *    manually-added tags, and the soft "watchlist" from auto-triggers.
 *  - addTag(): admin-only POST /admin/add-tag (needs the admin key).
 * All tag parsing is defensive because the Cubelify tag shape is loosely typed.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Tag severity -> feeds the sniper score and picks a color.
const SEVERITY = {
  cheater: 1.0, hacker: 1.0, sniper: 0.95, blatant: 1.0, closet: 0.85,
  cheating: 1.0, autoclicker: 0.7, caution: 0.6, sus: 0.55, suspicious: 0.55,
  toxic: 0.4, annoying: 0.3, info: 0.2, note: 0.15, legit: 0.0, safe: 0.0,
};
const COLORS = {
  cheater: '#ff2d55', hacker: '#ff2d55', blatant: '#ff2d55', cheating: '#ff2d55',
  sniper: '#ff5b8a', closet: '#ff6b35', caution: '#ffb454', sus: '#ffb454',
  suspicious: '#ffb454', autoclicker: '#ffb454', toxic: '#e3e327', annoying: '#e3e327',
  info: '#58a6ff', note: '#8b949e', legit: '#56d364', safe: '#56d364', watchlist: '#bc8cff',
};

function severityOf(type) {
  const t = String(type || '').toLowerCase();
  if (SEVERITY[t] != null) return SEVERITY[t];
  for (const k of Object.keys(SEVERITY)) if (t.includes(k)) return SEVERITY[k];
  return 0.25;
}
function colorOf(type) {
  const t = String(type || '').toLowerCase();
  if (COLORS[t]) return COLORS[t];
  for (const k of Object.keys(COLORS)) if (t.includes(k)) return COLORS[k];
  return '#58a6ff';
}

function norm(u) { return String(u || '').replace(/[^0-9a-fA-F]/g, '').toLowerCase(); }

class Urchin {
  constructor(getConfig) {
    this.getConfig = getConfig;
    this.local = this._loadBundled();          // { uuid: [tag,...] }
    this.localTags = this._loadUserTags();     // user-added local tags, persisted
  }

  _loadBundled() {
    try {
      const p = path.join(app.getAppPath(), 'data', 'blacklist.json');
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      return j.players || {};
    } catch (e) { console.error('bundled blacklist load failed', e); return {}; }
  }
  _userTagsFile() { return path.join(app.getPath('userData'), 'local-tags.json'); }
  _loadUserTags() { try { return JSON.parse(fs.readFileSync(this._userTagsFile(), 'utf8')); } catch (_) { return {}; } }
  _saveUserTags() { try { fs.writeFileSync(this._userTagsFile(), JSON.stringify(this.localTags, null, 2)); } catch (_) {} }

  addLocalTag(uuid, tag) {
    const u = norm(uuid);
    (this.localTags[u] = this.localTags[u] || []).push({
      tag_type: tag.tag_type || 'info', reason: tag.reason || '', added_by: 'me', added_on: new Date().toISOString(), local: true,
    });
    this._saveUserTags();
  }

  _buildUrl(id, name) {
    const cfg = this.getConfig();
    const sources = encodeURIComponent(cfg.urchinSources || '');
    return (cfg.urchinEndpoint || '')
      .replace(/\{\{?id\}?\}/gi, id)
      .replace(/\{\{?uuid\}?\}/gi, id)
      .replace(/\{\{?name\}?\}/gi, encodeURIComponent(name || ''))
      .replace(/\{\{?key\}?\}/gi, encodeURIComponent(cfg.urchinKey || ''))
      .replace(/\{\{?sources\}?\}/gi, sources);
  }

  // Parse a loosely-typed tag object from the Urchin/Cubelify response.
  _parseTag(t) {
    if (t == null) return null;
    if (typeof t === 'string') return { type: 'info', text: t, reason: t };
    const type = t.tag_type || t.type || t.category || t.name || 'info';
    const reason = t.reason || t.tag_reason || t.text || t.description || '';
    const by = t.added_by || t.addedBy || t.author || '';
    return { type, text: reason || type, reason, added_by: by, source: t.source || 'urchin' };
  }

  async lookup(id, name) {
    const u = norm(id);
    const out = { tags: [], score: 0, scoreMode: 'add', severity: 0, sources: [] };

    // 1) live Urchin endpoint
    try {
      const url = this._buildUrl(id, name);
      if (url) {
        const r = await fetch(url, { headers: { Accept: 'application/json' } });
        if (r.ok) {
          const j = await r.json().catch(() => ({}));
          if (j && j.score) { out.score = +j.score.value || 0; out.scoreMode = j.score.mode || 'add'; }
          const arr = Array.isArray(j.tags) ? j.tags : [];
          for (const t of arr) {
            const p = this._parseTag(t);
            if (p) out.tags.push(p);
          }
          if (arr.length) out.sources.push('urchin');
        } else if (r.status === 401 || r.status === 403) {
          out.error = 'urchin key ' + r.status;
        }
      }
    } catch (e) { out.error = 'urchin unreachable'; }

    // 2) bundled local import (info tags removed from the API)
    for (const t of (this.local[u] || [])) {
      out.tags.push({ type: t.tag_type || 'info', text: t.reason, reason: t.reason, added_by: t.added_by, source: 'local-import' });
    }
    if (this.local[u]) out.sources.push('local-import');

    // 3) user-added local tags
    for (const t of (this.localTags[u] || [])) {
      out.tags.push({ type: t.tag_type || 'info', text: t.reason, reason: t.reason, added_by: 'me', source: 'local' });
    }

    // 4) soft watchlist from auto-triggers
    const wl = (this.getConfig().watchlist || {})[u];
    if (wl) out.tags.push({ type: 'watchlist', text: wl.reason, reason: wl.reason, source: 'trigger' });

    // decorate + compute severity (max)
    let sev = 0;
    for (const t of out.tags) {
      t.severity = severityOf(t.type);
      t.color = t.type === 'watchlist' ? COLORS.watchlist : colorOf(t.type);
      if (t.severity > sev) sev = t.severity;
    }
    out.severity = sev;
    // pick the single highest-severity tag as the compact "Tag" cell
    out.primary = out.tags.slice().sort((a, b) => (b.severity || 0) - (a.severity || 0))[0] || null;
    return out;
  }

  // Admin: add a tag to the real Urchin DB.
  async addTag({ uuid, tag_type, reason, hide_username = false, overwrite = false }) {
    const cfg = this.getConfig();
    if (!cfg.urchinAdminKey) throw new Error('No admin key set (Settings → Urchin).');
    const url = cfg.urchinAdminBase.replace(/\/$/, '') + '/admin/add-tag?key=' + encodeURIComponent(cfg.urchinAdminKey);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid: norm(uuid), tag_type, reason, hide_username, overwrite }),
    });
    const body = await r.json().catch(() => ({}));
    if (r.status === 200) return { ok: true, message: body.message || 'Tag added.' };
    const msgs = { 400: 'Invalid tag type', 401: 'Invalid API key', 403: 'Admin access required', 409: 'Tag already exists (enable overwrite)' };
    throw new Error((msgs[r.status] || ('HTTP ' + r.status)) + (body.message ? ': ' + body.message : ''));
  }
}

module.exports = { Urchin, severityOf, colorOf, SEVERITY, COLORS };
