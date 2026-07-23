'use strict';
const api = window.solarBridge;
let cfg = null;

const $ = (s) => document.querySelector(s);
const el = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function getPath(o, p) { return p.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
function patchOf(path, val) {
  const parts = path.split('.'); const root = {}; let cur = root;
  if (parts.some((p) => p === '__proto__' || p === 'constructor' || p === 'prototype')) return root;
  for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = {}; cur = cur[parts[i]]; }
  cur[parts[parts.length - 1]] = val; return root;
}
async function set(path, val) { cfg = await api.setConfig(patchOf(path, val)); }

const COLLABELS = { source: 'Source', tag: 'Tag', star: 'Lvl', name: 'Player', fkdr: 'FKDR', wlr: 'WLR', finals: 'F.Kills', wins: 'Wins', ws: 'WS', hws: 'Peak WS', mfkdr: 'M.FKDR', sniper: 'Sniper', lastseen: 'Last Login', bl: 'BL' };

// A curated set of extra Hypixel stats, grouped by gamemode, that a user can flip on
// as columns without having to know the raw API field names themselves. All off by
// default. These just become ordinary custom columns under the hood (same dot-path
// mechanism as the "add your own" box below), keyed with a stable 'cat:' prefix so
// toggling one back on doesn't create a duplicate.
const STAT_CATALOG = {
  General: [
    { key: 'cat:networkExp', label: 'Network XP', path: 'networkExp' },
    { key: 'cat:karma', label: 'Karma', path: 'karma' },
    { key: 'cat:achievementPoints', label: 'Achievement Points', path: 'achievementPoints' },
    { key: 'cat:mostRecentGame', label: 'Last Game Played', path: 'mostRecentGameType' },
  ],
  Bedwars: [
    { key: 'cat:bw_kills', label: 'Kills', path: 'stats.Bedwars.kills_bedwars' },
    { key: 'cat:bw_deaths', label: 'Deaths', path: 'stats.Bedwars.deaths_bedwars' },
    { key: 'cat:bw_beds_broken', label: 'Beds Broken', path: 'stats.Bedwars.beds_broken_bedwars' },
    { key: 'cat:bw_beds_lost', label: 'Beds Lost', path: 'stats.Bedwars.beds_lost_bedwars' },
    { key: 'cat:bw_games', label: 'Games Played', path: 'stats.Bedwars.games_played_bedwars' },
    { key: 'cat:bw_coins', label: 'Coins', path: 'stats.Bedwars.coins' },
    { key: 'cat:bw_solo_wins', label: 'Solo Wins', path: 'stats.Bedwars.eight_one_wins_bedwars' },
    { key: 'cat:bw_solo_finals', label: 'Solo Final Kills', path: 'stats.Bedwars.eight_one_final_kills_bedwars' },
    { key: 'cat:bw_doubles_wins', label: 'Doubles Wins', path: 'stats.Bedwars.eight_two_wins_bedwars' },
    { key: 'cat:bw_doubles_finals', label: 'Doubles Final Kills', path: 'stats.Bedwars.eight_two_final_kills_bedwars' },
    { key: 'cat:bw_3v3_wins', label: '3v3 Wins', path: 'stats.Bedwars.four_three_wins_bedwars' },
    { key: 'cat:bw_4v4_wins', label: '4v4 Wins', path: 'stats.Bedwars.four_four_wins_bedwars' },
  ],
  Skywars: [
    { key: 'cat:sw_kills', label: 'Kills', path: 'stats.SkyWars.kills' },
    { key: 'cat:sw_deaths', label: 'Deaths', path: 'stats.SkyWars.deaths' },
    { key: 'cat:sw_wins', label: 'Wins', path: 'stats.SkyWars.wins' },
    { key: 'cat:sw_losses', label: 'Losses', path: 'stats.SkyWars.losses' },
    { key: 'cat:sw_winstreak', label: 'Win Streak', path: 'stats.SkyWars.win_streak' },
    { key: 'cat:sw_souls', label: 'Souls', path: 'stats.SkyWars.souls' },
    { key: 'cat:sw_coins', label: 'Coins', path: 'stats.SkyWars.coins' },
  ],
  Duels: [
    { key: 'cat:du_wins', label: 'Wins', path: 'stats.Duels.wins' },
    { key: 'cat:du_losses', label: 'Losses', path: 'stats.Duels.losses' },
    { key: 'cat:du_kills', label: 'Kills', path: 'stats.Duels.kills' },
    { key: 'cat:du_deaths', label: 'Deaths', path: 'stats.Duels.deaths' },
    { key: 'cat:du_winstreak', label: 'Win Streak', path: 'stats.Duels.current_winstreak' },
    { key: 'cat:du_best_winstreak', label: 'Best Win Streak', path: 'stats.Duels.best_overall_winstreak' },
    { key: 'cat:du_coins', label: 'Coins', path: 'stats.Duels.coins' },
  ],
  'Murder Mystery': [
    { key: 'cat:mm_wins', label: 'Wins', path: 'stats.MurderMystery.wins' },
    { key: 'cat:mm_kills', label: 'Kills', path: 'stats.MurderMystery.kills' },
    { key: 'cat:mm_murderer_wins', label: 'Murderer Wins', path: 'stats.MurderMystery.murderer_wins' },
    { key: 'cat:mm_detective_wins', label: 'Detective Wins', path: 'stats.MurderMystery.detective_wins' },
    { key: 'cat:mm_coins', label: 'Coins', path: 'stats.MurderMystery.coins' },
  ],
};

const THEMES = {
  midnight: { bg: '#0d1117', headerBg: '#161b22', text: '#e6edf3', accent: '#58a6ff', grid: '#21262d' },
  obsidian: { bg: '#000000', headerBg: '#0a0a0a', text: '#f0f0f0', accent: '#8b5cf6', grid: '#1a1a1a' },
  ocean:    { bg: '#0b1e2d', headerBg: '#0f2a3d', text: '#dbeafe', accent: '#22d3ee', grid: '#1e3a4d' },
  forest:   { bg: '#0c1a12', headerBg: '#10241a', text: '#dcfce7', accent: '#4ade80', grid: '#1a3325' },
  rose:     { bg: '#1a0d14', headerBg: '#24121c', text: '#fce7f3', accent: '#f472b6', grid: '#33202b' },
  light:    { bg: '#f6f8fa', headerBg: '#eaeef2', text: '#1f2328', accent: '#0969da', grid: '#d0d7de' },
};

// ---------- field factory ----------
function fieldRow(label, help, control) {
  const f = el('div', 'field');
  const l = el('div', 'l');
  l.innerHTML = `<div class="name">${esc(label)}</div>` + (help ? `<div class="help">${esc(help)}</div>` : '');
  const c = el('div', 'c'); c.appendChild(control);
  f.appendChild(l); f.appendChild(c); return f;
}
function toggle(path) {
  const w = el('label', 'sw'); const i = el('input'); i.type = 'checkbox'; i.checked = !!getPath(cfg, path);
  const s = el('span', 'slider'); w.appendChild(i); w.appendChild(s);
  i.onchange = () => set(path, i.checked);
  return w;
}
function text(path, ph, wide) {
  const i = el('input'); i.type = 'text'; i.value = getPath(cfg, path) ?? ''; if (ph) i.placeholder = ph;
  if (wide) i.style.width = '340px';
  i.onchange = () => set(path, i.value);
  return i;
}
// Secret fields (API keys): hidden by default, revealed only while the eye is held/toggled on.
function secretText(path, ph, wide) {
  const wrap = el('div', 'secret-wrap' + (wide ? ' wide' : ''));
  const i = el('input'); i.type = 'password'; i.autocomplete = 'off'; i.spellcheck = false;
  i.value = getPath(cfg, path) ?? ''; if (ph) i.placeholder = ph;
  i.onchange = () => set(path, i.value);
  const eye = el('button', 'eye-toggle'); eye.type = 'button'; eye.textContent = '👁'; eye.title = 'Show/hide key';
  eye.onclick = (e) => {
    e.preventDefault();
    const showing = i.type === 'text';
    i.type = showing ? 'password' : 'text';
    eye.classList.toggle('on', !showing);
  };
  wrap.appendChild(i); wrap.appendChild(eye);
  wrap.inputEl = i;
  return wrap;
}
function number(path, min, max, step) {
  const i = el('input'); i.type = 'number'; i.value = getPath(cfg, path) ?? 0;
  if (min != null) i.min = min; if (max != null) i.max = max; if (step != null) i.step = step;
  i.onchange = () => set(path, +i.value);
  return i;
}
function range(path, min, max, step, mul = 1) {
  const wrap = el('div'); wrap.style.display = 'flex'; wrap.style.alignItems = 'center'; wrap.style.gap = '8px';
  const i = el('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = getPath(cfg, path) * mul;
  const v = el('span', 'rangeval'); v.textContent = (getPath(cfg, path)).toString();
  i.oninput = () => { v.textContent = (i.value / mul).toString(); };
  i.onchange = () => set(path, +i.value / mul);
  wrap.appendChild(i); wrap.appendChild(v); return wrap;
}
function select(path, opts) {
  const s = el('select'); for (const o of opts) { const op = el('option'); op.value = o.v; op.textContent = o.l; if (getPath(cfg, path) == o.v) op.selected = true; s.appendChild(op); }
  s.onchange = () => set(path, s.value);
  return s;
}
function color(path) {
  const i = el('input'); i.type = 'color'; i.value = (getPath(cfg, path) || '#000000').slice(0, 7);
  i.onchange = () => set(path, i.value);
  return i;
}

// ---------- tabs ----------
const TABS = {
  General: panelGeneral,
  'Log & Detection': panelLog,
  Triggers: panelTriggers,
  'API Keys': panelApi,
  Connections: panelConnections,
  Appearance: panelAppearance,
  Columns: panelColumns,
  'Sniper Score': panelSniper,
  Performance: panelPerf,
  About: panelAbout,
};

function panelGeneral(p) {
  p.appendChild(header('General', 'Who the overlay is and how it identifies you.'));
  p.appendChild(fieldRow('Your IGN', 'The name the overlay reacts to (mentions, "hide self", etc.)', text('selfName', 'your username')));
  const aliases = el('input'); aliases.type = 'text'; aliases.style.width = '240px';
  aliases.value = (cfg.reactNames || []).join(', '); aliases.placeholder = 'alt1, alt2';
  aliases.onchange = () => set('reactNames', aliases.value.split(',').map((s) => s.trim()).filter(Boolean));
  p.appendChild(fieldRow('Extra alias names', 'Comma-separated. Overlay also reacts to these.', aliases));
  p.appendChild(fieldRow('Hide yourself from the list', '', toggle('hideSelf')));
  p.appendChild(fieldRow('Hide nicked / unresolved players', '', toggle('hideNicked')));
}

function panelLog(p) {
  p.appendChild(header('Log & Detection', 'Read your client log to auto-detect players in games, parties, chat.'));
  p.appendChild(fieldRow('Enable log watcher', '', toggle('logEnabled')));
  const row = el('div'); row.style.display = 'flex'; row.style.gap = '8px'; row.style.alignItems = 'center';
  const t = text('logPath', '', true); const b = el('button', 'ghost'); b.textContent = 'Browse…';
  b.onclick = async () => { const r = await api.pickLog(); if (r) { t.value = r; cfg.logPath = r; toast('Log path set', 'ok'); } };
  row.appendChild(t); row.appendChild(b);
  p.appendChild(fieldRow('Log file path', 'e.g. Lunar 1.8: .lunarclient/profiles/1.8/logs/latest.log', row));
  p.appendChild(fieldRow('Clear list on server change', 'Wipe the list when you leave/join a game.', toggle('clearOnServerChange')));
  p.appendChild(fieldRow('Clear on lobby join', '', toggle('clearOnLobbyJoin')));
}

function panelTriggers(p) {
  p.appendChild(header('Triggers', 'Auto-flag players to your local watchlist when these happen. They also show live in the list.'));
  const t = [
    ['triggers.onNameInChat', 'Someone says your name in chat', 'Flags whoever mentions your IGN.'],
    ['triggers.onPartyJoin', 'A player joins your party', ''],
    ['triggers.onPartyInvite', 'A player invites you to a party', ''],
    ['triggers.onDirectMessage', 'A player DMs you (/msg)', ''],
    ['triggers.onFriendRequest', 'A player friend-requests you', ''],
    ['triggers.onKilledYou', 'A player final-kills you', 'Best-effort from kill messages.'],
  ];
  for (const [k, l, h] of t) p.appendChild(fieldRow(l, h, toggle(k)));
  p.appendChild(fieldRow('Watchlist tag type', 'Label applied to auto-flagged players.', select('autoTagType', [
    { v: 'info', l: 'info' }, { v: 'caution', l: 'caution' }, { v: 'sniper', l: 'sniper' }, { v: 'toxic', l: 'toxic' },
  ])));
  const clear = el('button', 'ghost'); clear.textContent = 'Clear local watchlist';
  clear.onclick = async () => { await set('watchlist', {}); toast('Watchlist cleared', 'ok'); };
  p.appendChild(fieldRow('Reset watchlist', 'Remove all locally auto-flagged players.', clear));
}

function panelApi(p) {
  p.appendChild(header('API Keys', 'Your keys live here — easy to change. Nothing is shared externally except to the APIs themselves.'));
  const row = el('div'); row.style.display = 'flex'; row.style.gap = '8px'; row.style.alignItems = 'center';
  const t = secretText('hypixelKey', 'Hypixel API key', true); const b = el('button', 'act'); b.textContent = 'Test';
  const res = el('span'); res.style.fontSize = '11px';
  b.onclick = async () => { await set('hypixelKey', t.inputEl.value); res.textContent = 'testing…'; res.className = '';
    const r = await api.testKey();
    if (r.ok) { res.innerHTML = `<span class="ok">valid</span> · ${r.record && r.record.limit ? r.record.limit + '/min' : 'ok'}`; }
    else { res.innerHTML = `<span class="bad">${esc(r.error)}</span>`; } };
  row.appendChild(t); row.appendChild(b); row.appendChild(res);
  p.appendChild(fieldRow('Hypixel API key', 'From developer.hypixel.net. Personal key = 300 req / 5 min.', row));

  p.appendChild(header('Urchin', 'Custom blacklist endpoint. Placeholders {id} {uuid} {name} {sources} are substituted per player.'));
  const ep = el('textarea'); ep.value = cfg.urchinEndpoint || ''; ep.style.width = '360px';
  ep.onchange = () => set('urchinEndpoint', ep.value);
  p.appendChild(fieldRow('Cubelify endpoint URL', 'Placeholders {id} {uuid} {name} {key} {sources} are substituted per player.', ep));
  p.appendChild(fieldRow('Urchin key', 'Substituted into {key} in the endpoint above.', secretText('urchinKey', 'urchin key')));
  p.appendChild(fieldRow('Sources', 'Comma-separated Urchin sources.', text('urchinSources', '', true)));
  p.appendChild(fieldRow('Admin base URL', 'Base for admin add-tag (Blacklist tab).', text('urchinAdminBase', '', true)));
  p.appendChild(fieldRow('Admin key', 'Only needed for the Blacklist Admin tab (adding tags).', secretText('urchinAdminKey', 'admin key')));
}

// Every place a column's value can come from: Hypixel's own player object, or one of
// the user's Connections (the built-in Urchin one included, if it's switched on).
function availableSources() {
  const opts = [{ v: 'hypixel', l: 'Hypixel player stats' }];
  if (cfg.urchinEnabled !== false) opts.push({ v: 'urchin', l: 'Urchin (built-in)' });
  for (const conn of (cfg.connections || [])) opts.push({ v: conn.id, l: conn.name || conn.id });
  return opts;
}

function panelConnections(p) {
  p.appendChild(header('Connections', 'Every blacklist/tag source that feeds the overlay, in one place. Same {id} {uuid} {name} {key} {sources} placeholders everywhere. Each response should look like { "tags": [...] } (or just a bare array) — tags can be either the { tag_type, reason, added_by } shape or the { icon, color, tooltip } shape. Once a connection is added here, head to the Columns tab to map it onto Tag, M.FKDR, or any other column.'));
  const box = el('div');

  // Urchin ships built-in and on by default — listed here like any other connection
  // so it's obvious it's running, but it's just a toggle away from being turned off.
  const ub = el('div', 'colrow');
  const usw = toggle('urchinEnabled');
  const unm = el('span', 'cname'); unm.textContent = 'Urchin (built-in)';
  const uedit = el('button'); uedit.textContent = '✎'; uedit.title = 'Endpoint / key / sources live under API Keys';
  uedit.onclick = () => { active = 'API Keys'; rerender(); };
  ub.appendChild(usw); ub.appendChild(unm); ub.appendChild(uedit);
  box.appendChild(ub);

  const list = cfg.connections || [];
  list.forEach((conn, idx) => {
    const row = el('div', 'colrow');
    const sw = el('label', 'sw'); const i = el('input'); i.type = 'checkbox'; i.checked = conn.enabled !== false;
    const sl = el('span', 'slider'); sw.appendChild(i); sw.appendChild(sl);
    i.onchange = async () => { const next = list.slice(); next[idx] = { ...conn, enabled: i.checked }; await set('connections', next); };
    const nm = el('span', 'cname'); nm.textContent = conn.name || conn.id;
    const edit = el('button'); edit.textContent = '✎'; edit.title = 'Edit';
    edit.onclick = () => openConnEditor(conn, idx);
    const rm = el('button'); rm.textContent = '✕'; rm.title = 'Remove';
    rm.onclick = async () => { const next = list.filter((_, j) => j !== idx); await set('connections', next); rerender(); };
    row.appendChild(sw); row.appendChild(nm); row.appendChild(edit); row.appendChild(rm);
    box.appendChild(row);
  });
  p.appendChild(box);
  const add = el('button', 'act'); add.textContent = '+ Add connection';
  add.style.marginTop = '8px';
  add.onclick = () => openConnEditor(null, -1);
  p.appendChild(add);
}

function openConnEditor(conn, idx) {
  const back = el('div'); back.style.cssText = 'position:fixed;inset:0;background:#0008;z-index:80;display:flex;align-items:center;justify-content:center';
  const box = el('div'); box.style.cssText = 'background:var(--header);border:1px solid var(--grid);border-radius:8px;padding:14px;width:380px';
  const inputCss = 'width:100%;margin-bottom:6px;padding:6px;background:var(--bg);border:1px solid var(--grid);color:var(--text);border-radius:5px;box-sizing:border-box;font-family:inherit';
  box.innerHTML = `<div style="font-weight:600;margin-bottom:8px">${conn ? 'Edit' : 'Add'} connection</div>`;
  const name = el('input'); name.type = 'text'; name.placeholder = 'Name (e.g. MyBlacklist)'; name.style.cssText = inputCss;
  name.value = (conn && conn.name) || '';
  const endpoint = el('textarea'); endpoint.placeholder = 'https://example.com/api?uuid={id}&key={key}'; endpoint.style.cssText = inputCss + ';height:60px;resize:vertical';
  endpoint.value = (conn && conn.endpoint) || '';
  const key = el('input'); key.type = 'password'; key.placeholder = 'API key (optional, fills {key})'; key.style.cssText = inputCss + ';margin-bottom:10px';
  key.value = (conn && conn.key) || '';
  box.appendChild(name); box.appendChild(endpoint); box.appendChild(key);
  const btns = el('div'); btns.style.cssText = 'display:flex;gap:6px;justify-content:flex-end';
  const cancel = el('button', 'ghost'); cancel.textContent = 'Cancel';
  const saveBtn = el('button', 'act'); saveBtn.textContent = 'Save';
  cancel.onclick = () => back.remove();
  saveBtn.onclick = async () => {
    if (!name.value.trim() || !endpoint.value.trim()) { toast('Name and endpoint are both required', 'err'); return; }
    const list = (cfg.connections || []).slice();
    const entry = {
      id: (conn && conn.id) || ('conn_' + Date.now().toString(36)),
      name: name.value.trim(), endpoint: endpoint.value.trim(), key: key.value,
      enabled: conn ? conn.enabled !== false : true,
    };
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    cfg = await api.setConfig({ connections: list });
    back.remove(); rerender(); toast('Connection saved', 'ok');
  };
  btns.appendChild(cancel); btns.appendChild(saveBtn); box.appendChild(btns);
  back.appendChild(box); document.body.appendChild(back);
  back.onclick = (e) => { if (e.target === back) back.remove(); };
}

function panelAppearance(p) {
  p.appendChild(header('Appearance', 'Look and window behavior.'));
  const presets = el('div', 'presets');
  for (const [name, th] of Object.entries(THEMES)) {
    const d = el('div', 'preset'); d.innerHTML = `<span class="dot" style="background:${th.accent}"></span>${name}`;
    d.onclick = async () => { cfg = await api.setConfig({ theme: { name, ...th } }); toast('Theme: ' + name, 'ok'); };
    presets.appendChild(d);
  }
  p.appendChild(presets);
  p.appendChild(fieldRow('Background', '', color('theme.bg')));
  p.appendChild(fieldRow('Header', '', color('theme.headerBg')));
  p.appendChild(fieldRow('Text', '', color('theme.text')));
  p.appendChild(fieldRow('Accent', '', color('theme.accent')));
  p.appendChild(fieldRow('Grid lines', '', color('theme.grid')));
  p.appendChild(fieldRow('Window opacity', '', range('window.opacity', 0.3, 1, 0.02, 1)));
  p.appendChild(fieldRow('Font size (px)', '', number('fontSize', 9, 22, 1)));
  p.appendChild(fieldRow('Row height (px)', '', number('rowHeight', 16, 40, 1)));
  p.appendChild(header('Window', ''));
  p.appendChild(fieldRow('Always on top', '', toggle('alwaysOnTop')));
  p.appendChild(fieldRow('Hide from screen capture', 'Invisible to OBS / Discord share / screenshots (Windows).', toggle('hideFromCapture')));
  p.appendChild(fieldRow('Click-through', 'Mouse passes through to the game. Toggle with Alt+X.', toggle('clickThrough')));

  p.appendChild(header('Row Highlight', 'Flag a whole row once a stat clears a threshold, so a nasty FKDR (or whatever you pick) jumps out without having to scan the column.'));
  p.appendChild(fieldRow('Enable highlight', '', toggle('highlightEnabled')));
  const custom = cfg.customColumns || [];
  const labelOf = (key) => COLLABELS[key] || (custom.find((c) => c.key === key) || {}).label || key;
  const statKeys = Object.keys(COLLABELS).filter((k) => k !== 'name' && k !== 'tag').concat(custom.map((c) => c.key));
  p.appendChild(fieldRow('Stat to watch', 'FKDR by default, but any column works.', select('highlightStat', statKeys.map((k) => ({ v: k, l: labelOf(k) })))));
  p.appendChild(fieldRow('Threshold', 'Row lights up once this stat is at or above the value.', number('highlightThreshold', 0, 1000000, 0.1)));
}

function panelColumns(p) {
  p.appendChild(header('Columns', 'Every column here is fully yours — add, remove, hide, and reorder any of them, built-in ones included.'));
  const cols = (cfg.columns || []).slice().sort((a, b) => a.order - b.order);
  const custom = cfg.customColumns || [];
  const labelOf = (key) => COLLABELS[key] || (custom.find((c) => c.key === key) || {}).label || key;
  const box = el('div');
  cols.forEach((c, idx) => {
    const r = el('div', 'colrow');
    const sw = toggle('__col_' + c.key); // visibility only — actual persistence happens below
    sw.querySelector('input').checked = c.visible;
    sw.querySelector('input').onchange = async (e) => { c.visible = e.target.checked; await set('columns', cols); };
    const nm = el('span', 'cname'); nm.textContent = labelOf(c.key);
    const up = el('button'); up.textContent = '▲'; const dn = el('button'); dn.textContent = '▼';
    up.onclick = async () => { if (idx > 0) { swap(cols, idx, idx - 1); cols.forEach((x, i) => x.order = i); await set('columns', cols); rerender(); } };
    dn.onclick = async () => { if (idx < cols.length - 1) { swap(cols, idx, idx + 1); cols.forEach((x, i) => x.order = i); await set('columns', cols); rerender(); } };
    const rm = el('button'); rm.textContent = '✕'; rm.title = 'Remove column';
    rm.onclick = async () => {
      cfg = await api.setConfig({
        columns: cols.filter((x) => x.key !== c.key),
        customColumns: custom.filter((x) => x.key !== c.key), // no-op for built-ins, drops the definition otherwise
      });
      rerender();
    };
    r.appendChild(sw); r.appendChild(nm); r.appendChild(up); r.appendChild(dn); r.appendChild(rm);
    box.appendChild(r);
  });
  p.appendChild(box);

  // Bring back a built-in column you removed earlier.
  const missingBuiltins = Object.keys(COLLABELS).filter((k) => !cols.some((c) => c.key === k));
  if (missingBuiltins.length) {
    const row = el('div'); row.style.cssText = 'display:flex;gap:8px;align-items:center;margin:6px 0 12px';
    const pick = el('select'); for (const k of missingBuiltins) { const o = el('option'); o.value = k; o.textContent = COLLABELS[k]; pick.appendChild(o); }
    const addBackBtn = el('button', 'ghost'); addBackBtn.textContent = '+ Add back';
    addBackBtn.onclick = async () => {
      cfg = await api.setConfig({ columns: [...cols, { key: pick.value, visible: true, order: cols.length }] });
      rerender();
    };
    row.appendChild(pick); row.appendChild(addBackBtn);
    p.appendChild(row);
  }

  const sortKeys = Object.keys(COLLABELS).concat(custom.map((c) => c.key));
  p.appendChild(fieldRow('Default sort column', '', select('sortBy', sortKeys.map((k) => ({ v: k, l: labelOf(k) })))));
  p.appendChild(fieldRow('Sort direction', '', select('sortDir', [{ v: 'desc', l: 'High → Low' }, { v: 'asc', l: 'Low → High' }])));

  p.appendChild(header('Custom columns', 'Pull a stat off your Hypixel player object, or off one of your Connections, by dot-path.'));
  const form = el('div'); form.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;align-items:center';
  const lbl = el('input'); lbl.type = 'text'; lbl.placeholder = 'Column label (e.g. Beds Broken)'; lbl.style.width = '180px';
  const srcSel = el('select'); for (const o of availableSources()) { const op = el('option'); op.value = o.v; op.textContent = o.l; srcSel.appendChild(op); }
  const pth = el('input'); pth.type = 'text'; pth.placeholder = 'stats.Bedwars.beds_broken_bedwars'; pth.style.width = '220px';
  const addBtn = el('button', 'act'); addBtn.textContent = 'Add column';
  addBtn.onclick = async () => {
    const label = lbl.value.trim(), path = pth.value.trim(), source = srcSel.value;
    if (!label || !path) { toast('Need both a label and a stat path', 'err'); return; }
    const key = 'custom:' + path.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase() + '_' + Date.now().toString(36);
    const nextCustom = [...custom, { key, label, path, source }];
    const nextCols = [...cols, { key, visible: true, order: cols.length }];
    cfg = await api.setConfig({ customColumns: nextCustom, columns: nextCols });
    toast('Column added: ' + label, 'ok'); rerender();
  };
  form.appendChild(lbl); form.appendChild(srcSel); form.appendChild(pth); form.appendChild(addBtn);
  p.appendChild(form);
  const hint = el('div', 'kv');
  hint.textContent = 'Hypixel examples: stats.Bedwars.winstreak · stats.Bedwars.beds_broken_bedwars · networkExp · karma. For a Connection source, the path is relative to that connection\'s own JSON response.';
  p.appendChild(hint);

  catalogSection(p, custom);
  columnSourceSection(p, cols, custom, labelOf);
}

// Rewire an existing column (built-in or custom) to pull from a Connection instead of its
// normal source. Tag/BL just filter to that connection's tags; everything else needs a
// JSON path into that connection's response.
function columnSourceSection(p, cols, custom, labelOf) {
  p.appendChild(header('Column data sources', 'Map any column to one of your Connections — e.g. point Tag at just the Urchin endpoint, or pull M.FKDR/Winstreak from your own tracker instead of Hypixel.'));
  const mapped = cfg.columnSources || {};
  const allKeys = cols.map((c) => c.key);
  const mappedKeys = Object.keys(mapped).filter((k) => allKeys.includes(k));
  const connOpts = availableSources().filter((o) => o.v !== 'hypixel');

  const box = el('div');
  for (const key of mappedKeys) {
    const src = mapped[key] || {};
    const row = el('div', 'colrow');
    const nm = el('span', 'cname'); nm.textContent = labelOf(key);
    const srcSel = el('select');
    for (const o of connOpts) { const op = el('option'); op.value = o.v; op.textContent = o.l; if (src.source === o.v) op.selected = true; srcSel.appendChild(op); }
    srcSel.onchange = async () => {
      const next = { ...mapped, [key]: { ...mapped[key], source: srcSel.value } };
      cfg = await api.setConfig({ columnSources: next });
    };
    row.appendChild(nm); row.appendChild(srcSel);
    if (key !== 'tag' && key !== 'bl') {
      const pathInput = el('input'); pathInput.type = 'text'; pathInput.placeholder = 'json.path.in.response'; pathInput.style.width = '170px';
      pathInput.value = src.path || '';
      pathInput.onchange = async () => {
        const next = { ...mapped, [key]: { ...mapped[key], path: pathInput.value.trim() } };
        cfg = await api.setConfig({ columnSources: next });
      };
      row.appendChild(pathInput);
    }
    const rm = el('button'); rm.textContent = '✕'; rm.title = 'Remove mapping';
    rm.onclick = async () => { const next = { ...mapped }; delete next[key]; cfg = await api.setConfig({ columnSources: next }); rerender(); };
    row.appendChild(rm);
    box.appendChild(row);
  }
  p.appendChild(box);

  if (!connOpts.length) {
    const msg = el('div', 'kv'); msg.textContent = 'Add a Connection first (Connections tab) before mapping a column to it.';
    p.appendChild(msg);
    return;
  }
  const unmapped = allKeys.filter((k) => !mappedKeys.includes(k));
  if (!unmapped.length) return;

  const form = el('div'); form.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px';
  const colSel = el('select'); for (const k of unmapped) { const op = el('option'); op.value = k; op.textContent = labelOf(k); colSel.appendChild(op); }
  const connSel = el('select'); for (const o of connOpts) { const op = el('option'); op.value = o.v; op.textContent = o.l; connSel.appendChild(op); }
  const pathIn = el('input'); pathIn.type = 'text'; pathIn.placeholder = 'json.path (not needed for Tag/BL)'; pathIn.style.width = '200px';
  const addMapBtn = el('button', 'act'); addMapBtn.textContent = '+ Map column';
  addMapBtn.onclick = async () => {
    if (colSel.value !== 'tag' && colSel.value !== 'bl' && !pathIn.value.trim()) { toast('Need a JSON path for this column', 'err'); return; }
    const next = { ...mapped, [colSel.value]: { source: connSel.value, path: pathIn.value.trim() } };
    cfg = await api.setConfig({ columnSources: next });
    toast('Mapped ' + labelOf(colSel.value), 'ok'); rerender();
  };
  form.appendChild(colSel); form.appendChild(connSel); form.appendChild(pathIn); form.appendChild(addMapBtn);
  p.appendChild(form);
}

// Pre-built stat toggles, grouped by gamemode — flip one on/off and it's added to
// or pulled from customColumns + columns exactly like a hand-typed custom column.
function catalogSection(p, custom) {
  p.appendChild(header('More stats (by gamemode)', 'Off by default — turn on whatever you want to see. These read straight off the raw Hypixel player object, so a field only shows a value if Hypixel actually returns it for that account.'));
  for (const [game, items] of Object.entries(STAT_CATALOG)) {
    const gh = el('div'); gh.style.cssText = 'font-weight:600;margin:10px 0 2px;font-size:12px;color:var(--muted)'; gh.textContent = game;
    p.appendChild(gh);
    for (const item of items) {
      const active = custom.some((c) => c.key === item.key);
      const row = el('div', 'field');
      const l = el('div', 'l'); l.innerHTML = `<div class="name">${esc(item.label)}</div>`;
      const c = el('div', 'c');
      const sw = el('label', 'sw'); const i = el('input'); i.type = 'checkbox'; i.checked = active;
      const sl = el('span', 'slider'); sw.appendChild(i); sw.appendChild(sl);
      i.onchange = async () => {
        const nextCustom = (cfg.customColumns || []).slice();
        const nextCols = (cfg.columns || []).slice();
        if (i.checked) {
          if (!nextCustom.some((x) => x.key === item.key)) nextCustom.push({ key: item.key, label: item.label, path: item.path });
          if (!nextCols.some((x) => x.key === item.key)) nextCols.push({ key: item.key, visible: true, order: nextCols.length });
        } else {
          const ci = nextCustom.findIndex((x) => x.key === item.key); if (ci >= 0) nextCustom.splice(ci, 1);
          const oi = nextCols.findIndex((x) => x.key === item.key); if (oi >= 0) nextCols.splice(oi, 1);
        }
        cfg = await api.setConfig({ customColumns: nextCustom, columns: nextCols });
        rerender();
      };
      c.appendChild(sw); row.appendChild(l); row.appendChild(c);
      p.appendChild(row);
    }
  }
}
function swap(a, i, j) { const t = a[i]; a[i] = a[j]; a[j] = t; }

function panelSniper(p) {
  p.appendChild(header('Sniper / Threat Score', 'Your own 0–100 evaluation. Tune what feeds it. Higher weight = more influence.'));
  p.appendChild(el('div', 'sub')).textContent = 'CHILL < 20 · DECENT · SWEAT · TRYHARD · DANGER · SNIPER ≥ 85';
  const w = [
    ['sniperWeights.fkdr', 'FKDR (raw skill)'],
    ['sniperWeights.star', 'Bedwars star / level'],
    ['sniperWeights.wlr', 'Win/Loss ratio'],
    ['sniperWeights.winstreak', 'Current win streak'],
    ['sniperWeights.monthlyTrend', 'Recent sweat spike (monthly vs lifetime FKDR)'],
    ['sniperWeights.accountAge', 'Alt/sniper account signal (high star, low network level)'],
    ['sniperWeights.recentLogin', 'Logged in recently (actively playing)'],
    ['sniperWeights.tags', 'Blacklist / Urchin tags'],
    ['sniperWeights.freshAccount', 'Fresh account already performing well (classic smurf/alt signal)'],
  ];
  for (const [k, l] of w) p.appendChild(fieldRow(l, '', range(k, 0, 40, 1, 1)));
  const info = el('div', 'kv'); info.textContent = 'Weights are relative, not required to add up to 100 — the final score is capped there. Tags, account signals, and FKDR are weighted heaviest by default.';
  p.appendChild(info);
}

function panelPerf(p) {
  p.appendChild(header('Performance', 'Keep it lightweight. Fetches are cached and rate-limited for your key.'));
  p.appendChild(fieldRow('Auto-refresh (seconds)', '0 = only fetch when a new player is detected (lightest).', number('refreshSeconds', 0, 600, 5)));
  p.appendChild(fieldRow('Parallel lookups', 'How many players to fetch at once.', number('concurrency', 1, 10, 1)));
  p.appendChild(fieldRow('Stat cache (minutes)', 'Reuse fetched stats for this long.', number('cacheMinutes', 1, 30, 1)));
}

function panelAbout(p) {
  p.appendChild(header('About & Shortcuts', ''));
  const s = el('div'); s.innerHTML = `
    <div class="kv" style="font-size:12px;line-height:1.9">
      <span class="pill">Alt+B</span> show/hide overlay &nbsp;
      <span class="pill">Alt+X</span> click-through &nbsp;
      <span class="pill">Alt+C</span> clear list &nbsp;
      <span class="pill">Alt+S</span> settings<br>
      Right-click a column header → toggle columns. Drag headers to reorder. Click header to sort.<br>
      Right-click a player row → Plancke, copy, local tag, watchlist, remove.<br>
      Bundled local blacklist: <b>9,014 UUIDs / 9,349 tags</b> (info, caution, legit_sniper, account) imported from local exports.
    </div>`;
  p.appendChild(s);
  const reset = el('button', 'ghost'); reset.textContent = 'Reset all settings to defaults';
  reset.style.marginTop = '16px';
  reset.onclick = async () => { cfg = await api.resetConfig(); rerender(); toast('Settings reset', 'ok'); };
  p.appendChild(reset);
}

function header(t, sub) { const d = el('div'); d.innerHTML = `<h2>${esc(t)}</h2>` + (sub ? `<div class="sub">${esc(sub)}</div>` : ''); return d; }

// ---------- shell ----------
let active = 'General';
function buildTabs() {
  const nav = $('#tabs'); nav.innerHTML = '';
  for (const name of Object.keys(TABS)) {
    const t = el('div', 'tab' + (name === active ? ' active' : '')); t.textContent = name;
    t.onclick = () => { active = name; rerender(); };
    nav.appendChild(t);
  }
}
function rerender() { buildTabs(); const p = $('#panel'); p.innerHTML = ''; TABS[active](p); }

function toast(msg, kind) { const d = el('div', 'toast ' + (kind || '')); d.textContent = msg; $('#toasts').appendChild(d); setTimeout(() => d.remove(), 2500); }

$('#min').onclick = () => api.minimize();
$('#close').onclick = () => api.close();

(async () => { cfg = await api.getConfig(); rerender(); api.onConfigChanged((c) => { cfg = c; }); })();
