'use strict';
const api = window.solarBridge;
let cfg = null;

const $ = (s) => document.querySelector(s);
const el = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function getPath(o, p) { return p.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
function patchOf(path, val) {
  const parts = path.split('.'); const root = {}; let cur = root;
  for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = {}; cur = cur[parts[i]]; }
  cur[parts[parts.length - 1]] = val; return root;
}
async function set(path, val) { cfg = await api.setConfig(patchOf(path, val)); }

const COLLABELS = { tag: 'Tag', star: 'Lvl', name: 'Player', fkdr: 'FKDR', wlr: 'WLR', finals: 'F.Kills', wins: 'Wins', ws: 'WS', mfkdr: 'M.FKDR', sniper: 'Sniper', lastseen: 'Last Login', bl: 'BL' };

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

function panelConnections(p) {
  p.appendChild(header('Connections', 'Extra blacklist/tag APIs on top of the built-in Urchin one above. Same {id} {uuid} {name} {key} {sources} placeholders. Each response should look like { "tags": [...] } (or just a bare array) — tags can be either the { tag_type, reason, added_by } shape or the { icon, color, tooltip } shape.'));
  const list = cfg.connections || [];
  const box = el('div');
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
}

function panelColumns(p) {
  p.appendChild(header('Columns', 'Toggle, and reorder with the arrows. You can also drag headers and click to sort in the overlay.'));
  const cols = (cfg.columns || []).slice().sort((a, b) => a.order - b.order);
  const custom = cfg.customColumns || [];
  const labelOf = (key) => COLLABELS[key] || (custom.find((c) => c.key === key) || {}).label || key;
  const box = el('div');
  cols.forEach((c, idx) => {
    const r = el('div', 'colrow');
    const sw = toggle('__col_' + c.key); // custom handled below
    sw.querySelector('input').checked = c.visible;
    sw.querySelector('input').onchange = async (e) => { c.visible = e.target.checked; await set('columns', cols); };
    const nm = el('span', 'cname'); nm.textContent = labelOf(c.key);
    const up = el('button'); up.textContent = '▲'; const dn = el('button'); dn.textContent = '▼';
    up.onclick = async () => { if (idx > 0) { swap(cols, idx, idx - 1); cols.forEach((x, i) => x.order = i); await set('columns', cols); rerender(); } };
    dn.onclick = async () => { if (idx < cols.length - 1) { swap(cols, idx, idx + 1); cols.forEach((x, i) => x.order = i); await set('columns', cols); rerender(); } };
    r.appendChild(sw); r.appendChild(nm); r.appendChild(up); r.appendChild(dn);
    if (custom.some((cc) => cc.key === c.key)) {
      const rm = el('button'); rm.textContent = '✕'; rm.title = 'Remove custom column';
      rm.onclick = async () => {
        cfg = await api.setConfig({ columns: cols.filter((x) => x.key !== c.key), customColumns: custom.filter((x) => x.key !== c.key) });
        rerender();
      };
      r.appendChild(rm);
    }
    box.appendChild(r);
  });
  p.appendChild(box);
  const sortKeys = Object.keys(COLLABELS).concat(custom.map((c) => c.key));
  p.appendChild(fieldRow('Default sort column', '', select('sortBy', sortKeys.map((k) => ({ v: k, l: labelOf(k) })))));
  p.appendChild(fieldRow('Sort direction', '', select('sortDir', [{ v: 'desc', l: 'High → Low' }, { v: 'asc', l: 'Low → High' }])));

  p.appendChild(header('Custom columns', 'Pull any stat straight off your Hypixel player object by dot-path, e.g. stats.Bedwars.beds_broken_bedwars.'));
  const form = el('div'); form.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px';
  const lbl = el('input'); lbl.type = 'text'; lbl.placeholder = 'Column label (e.g. Beds Broken)'; lbl.style.width = '190px';
  const pth = el('input'); pth.type = 'text'; pth.placeholder = 'stats.Bedwars.beds_broken_bedwars'; pth.style.width = '260px';
  const addBtn = el('button', 'act'); addBtn.textContent = 'Add column';
  addBtn.onclick = async () => {
    const label = lbl.value.trim(), path = pth.value.trim();
    if (!label || !path) { toast('Need both a label and a stat path', 'err'); return; }
    const key = 'custom:' + path.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase() + '_' + Date.now().toString(36);
    const nextCustom = [...custom, { key, label, path }];
    const nextCols = [...cols, { key, visible: true, order: cols.length }];
    cfg = await api.setConfig({ customColumns: nextCustom, columns: nextCols });
    toast('Column added: ' + label, 'ok'); rerender();
  };
  form.appendChild(lbl); form.appendChild(pth); form.appendChild(addBtn);
  p.appendChild(form);
  const hint = el('div', 'kv');
  hint.textContent = 'A few common paths: stats.Bedwars.winstreak · stats.Bedwars.beds_broken_bedwars · achievements.bedwars_level · networkExp · karma';
  p.appendChild(hint);
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
  ];
  for (const [k, l] of w) p.appendChild(fieldRow(l, '', range(k, 0, 40, 1, 1)));
  const info = el('div', 'kv'); info.textContent = 'Weights are relative — the final score is normalized to 0–100.';
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
