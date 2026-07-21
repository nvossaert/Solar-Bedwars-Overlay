'use strict';
/*
 * Config store. Persists to <userData>/config.json.
 * Everything toggleable lives here so the Settings window is just a view of this object.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

// Secrets are kept OUT of version control (see .gitignore + secrets.example.js).
// Copy secrets.example.js -> secrets.js and fill in your keys. Missing file = empty
// defaults, and you can still paste keys in Settings (they save to userData, not the repo).
let secrets = {};
try { secrets = require('./secrets'); } catch (_) {}

function guessLogPath() {
  // Sensible Windows defaults. User can override in Settings.
  const home = os.homedir();
  const candidates = [
    // Lunar Client 1.8 (most common for Bedwars sweats)
    path.join(home, '.lunarclient', 'offline', 'multiver', 'logs', 'latest.log'),
    path.join(home, '.lunarclient', 'offline', '1.8', 'logs', 'latest.log'),
    // Vanilla / MultiMC-style
    path.join(process.env.APPDATA || home, '.minecraft', 'logs', 'latest.log'),
    // Badlion
    path.join(process.env.APPDATA || home, '.minecraft', 'logs', 'blclient', 'minecraft', 'latest.log'),
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch (_) {}
  }
  return candidates[0];
}

const ALL_COLUMNS = [
  { key: 'tag',      label: 'Tag',       width: 46,  always: false },
  { key: 'star',     label: 'Lvl',       width: 58,  always: false },
  { key: 'name',     label: 'Player',    width: 130, always: true  },
  { key: 'fkdr',     label: 'FKDR',      width: 62,  always: false },
  { key: 'wlr',      label: 'WLR',       width: 58,  always: false },
  { key: 'finals',   label: 'F.Kills',   width: 70,  always: false },
  { key: 'wins',     label: 'Wins',      width: 62,  always: false },
  { key: 'ws',       label: 'WS',        width: 46,  always: false },
  { key: 'mfkdr',    label: 'M.FKDR',    width: 64,  always: false },
  { key: 'sniper',   label: 'Sniper',    width: 66,  always: false },
  { key: 'lastseen', label: 'Last Login',width: 92,  always: false },
  { key: 'bl',       label: 'BL',        width: 40,  always: false },
];

function defaults() {
  return {
    version: 1,

    // ---- API keys (loaded from gitignored secrets.js; also editable in Settings) ----
    hypixelKey: secrets.hypixelKey || '',
    // Urchin: fully-configurable endpoint. {id} {uuid} {name} {key} {sources} placeholders
    // are substituted. Cubelify-style {{id}} double braces also work. The key comes from urchinKey.
    urchinKey: secrets.urchinKey || '',
    urchinEndpoint: 'https://api.urchin.gg/v3/cubelify?uuid={id}&key={key}&name={name}&sources={sources}',
    urchinAdminKey: secrets.urchinAdminKey || '', // required only for the "Add to blacklist" admin tab
    urchinSources: 'GAME,PARTY,PARTY_INVITES,CHAT,CHAT_MENTIONS,MANUAL,ME',
    urchinAdminBase: 'https://api.urchin.gg/v3',

    // ---- Identity ----
    selfName: '',   // your IGN — the name the overlay reacts to
    reactNames: [], // extra aliases the overlay should react to

    // ---- Log detection ----
    logEnabled: true,
    logPath: guessLogPath(),
    clearOnServerChange: true,
    clearOnLobbyJoin: true,

    // ---- Auto-blacklist / watchlist triggers ----
    triggers: {
      onNameInChat: false,
      onPartyJoin: false,
      onPartyInvite: false,
      onDirectMessage: false,
      onFriendRequest: false,
      onKilledYou: false,
    },
    autoTagType: 'info',
    watchlist: {}, // { uuid: {reason, added_on, name} } local-only soft flags

    // ---- Refresh / performance ----
    refreshSeconds: 0,  // 0 = only fetch on detection (lightweight)
    concurrency: 4,
    cacheMinutes: 3,

    // ---- Overlay window ----
    window: { x: 60, y: 60, width: 720, height: 380, opacity: 0.94 },
    alwaysOnTop: true,
    hideFromCapture: true, // setContentProtection -> invisible to OBS/Discord/screenshots
    clickThrough: false,
    lockPosition: false,
    fontSize: 13,
    rowHeight: 22,
    compact: false,

    // ---- Columns ----
    columns: ALL_COLUMNS.map((c, i) => ({ key: c.key, visible: true, order: i })),
    sortBy: 'sniper',
    sortDir: 'desc',
    hideNicked: false,
    hideSelf: false,

    // ---- Theme ----
    theme: {
      name: 'midnight',
      bg: '#0d1117',
      headerBg: '#161b22',
      text: '#e6edf3',
      accent: '#58a6ff',
      grid: '#21262d',
    },

    // ---- Sniper / threat score weights (transparent & tunable) ----
    sniperWeights: {
      fkdr: 26,
      star: 14,
      wlr: 14,
      winstreak: 6,
      monthlyTrend: 16,
      accountAge: 10,
      recentLogin: 4,
      tags: 10,
    },
  };
}

let cache = null;
let filePath = null;

function file() {
  if (!filePath) filePath = path.join(app.getPath('userData'), 'config.json');
  return filePath;
}

function deepMerge(base, over) {
  if (Array.isArray(base) || Array.isArray(over)) return over === undefined ? base : over;
  if (typeof base !== 'object' || base === null) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k], over[k]);
    } else {
      out[k] = over[k];
    }
  }
  return out;
}

function load() {
  if (cache) return cache;
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch (_) {}
  cache = deepMerge(defaults(), saved);
  return cache;
}

function save(patch) {
  cache = deepMerge(load(), patch || {});
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(cache, null, 2));
  } catch (e) { console.error('config save failed', e); }
  return cache;
}

function reset() {
  cache = defaults();
  save({});
  return cache;
}

module.exports = { load, save, reset, defaults, ALL_COLUMNS };
