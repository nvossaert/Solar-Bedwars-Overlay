'use strict';
const { app, BrowserWindow, ipcMain, globalShortcut, dialog, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const config = require('./config');
const { Hypixel } = require('./hypixel');
const { Urchin } = require('./urchin');
const { Roster } = require('./roster');
const { LogWatcher } = require('./logWatcher');

let overlayWin = null, settingsWin = null, blacklistWin = null, splashWin = null, tray = null;
let hypixel, urchin, roster, watcher;
let refreshTimer = null;
let lastLogStatus = { ok: false, msg: 'not started' };
// The last known raw server code (e.g. "mini116CN", "dynamiclobby25G", "limbo") - undefined until
// something's actually been observed this launch. "mini*" is your real, small match instance;
// "dynamiclobby*" is BedWars' shared matchmaking staging pool, which turned out to be just as
// noisy as the hub despite technically being gametype BEDWARS (see logWatcher.js) - so
// inBedwarsMatch() below, not a plain gametype check, is what actually gates lobbyJoin/chatSpeaker.
let currentServer;
function inBedwarsMatch() { return typeof currentServer === 'string' && /^mini/i.test(currentServer); }

const getConfig = () => config.load();

// ---------------- windows ----------------
function createOverlay() {
  const cfg = getConfig();
  overlayWin = new BrowserWindow({
    x: cfg.window.x, y: cfg.window.y, width: cfg.window.width, height: cfg.window.height,
    minWidth: 320, minHeight: 120,
    frame: false, transparent: true, resizable: true, movable: true, fullscreenable: false,
    alwaysOnTop: cfg.alwaysOnTop, skipTaskbar: false, backgroundColor: '#00000000',
    hasShadow: false, title: 'Solar Overlay', show: false,
    icon: path.join(__dirname, '..', '..', 'assets', 'icon-256.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  overlayWin.setAlwaysOnTop(cfg.alwaysOnTop, 'screen-saver');
  applyCapture();
  applyClickThrough();
  overlayWin.setOpacity(cfg.window.opacity ?? 0.94);
  overlayWin.loadFile(path.join(__dirname, '..', 'renderer', 'overlay', 'overlay.html'));
  blockFullscreenKey(overlayWin);

  const persist = () => { const b = overlayWin.getBounds(); config.save({ window: { ...getConfig().window, x: b.x, y: b.y, width: b.width, height: b.height } }); };
  overlayWin.on('moved', persist);
  overlayWin.on('resized', persist);
  overlayWin.on('closed', () => { overlayWin = null; });
}

// A short, one-time-per-launch animated title card. It owns its own ~5.5s timing (see
// splash.js) and reports back over IPC when it's done rather than main.js guessing a
// delay, so the hand-off to the real overlay always matches what actually played out.
function createSplash() {
  splashWin = new BrowserWindow({
    width: 460, height: 300, frame: false, transparent: true, resizable: false, movable: false,
    fullscreenable: false, alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#00000000',
    hasShadow: false, show: false, center: true,
    icon: path.join(__dirname, '..', '..', 'assets', 'icon-256.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  splashWin.once('ready-to-show', () => splashWin.show());
  splashWin.loadFile(path.join(__dirname, '..', 'renderer', 'splash', 'splash.html'));
  splashWin.on('closed', () => { splashWin = null; });
}

function applyCapture() {
  if (!overlayWin) return;
  overlayWin.setContentProtection(!!getConfig().hideFromCapture); // WDA_EXCLUDEFROMCAPTURE on Windows
}
function applyClickThrough() {
  if (!overlayWin) return;
  overlayWin.setIgnoreMouseEvents(!!getConfig().clickThrough, { forward: true });
}

// The overlay is frameless and meant to sit as a small always-on-top strip, so an
// accidental F11 blowing it up to fullscreen is just disruptive, not useful — block it.
function blockFullscreenKey(win) {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') event.preventDefault();
  });
}

function childWindow(file, opts = {}) {
  const win = new BrowserWindow({
    width: opts.width || 760, height: opts.height || 620, frame: false, resizable: true, fullscreenable: false,
    backgroundColor: '#0d1117', title: opts.title || 'Solar',
    icon: path.join(__dirname, '..', '..', 'assets', 'icon-256.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(file);
  blockFullscreenKey(win);
  return win;
}

// Bring an existing child window back to front, undoing minimize/hide state.
// A plain .focus() is a no-op on a minimized Windows BrowserWindow, which used
// to make Settings look "stuck closed" once it had been minimized at any point.
function wake(win) {
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
}
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { wake(settingsWin); return; }
  settingsWin = childWindow(path.join(__dirname, '..', 'renderer', 'settings', 'settings.html'), { title: 'Settings', width: 820, height: 700 });
  settingsWin.on('closed', () => { settingsWin = null; });
}
function openBlacklist() {
  if (blacklistWin && !blacklistWin.isDestroyed()) { wake(blacklistWin); return; }
  blacklistWin = childWindow(path.join(__dirname, '..', 'renderer', 'blacklist', 'blacklist.html'), { title: 'Blacklist Admin', width: 720, height: 640 });
  blacklistWin.on('closed', () => { blacklistWin = null; });
}

function broadcast(channel, payload) {
  for (const w of [overlayWin, settingsWin, blacklistWin]) if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
}
function toast(msg, kind = 'info') { broadcast('toast', { msg, kind, ts: Date.now() }); }

// ---------------- log watcher wiring ----------------
function startWatcher() {
  const cfg = getConfig();
  watcher.setSelfNames([cfg.selfName, ...(cfg.reactNames || [])]);
  if (cfg.logEnabled) watcher.start(cfg.logPath); else watcher.stop();
}

async function watchlistAdd(name, reason, kind) {
  try {
    const r = await hypixel.resolveUuid(name);
    if (!r) return;
    const cfg = getConfig();
    const wl = { ...(cfg.watchlist || {}) };
    wl[r.id] = { name: r.name, reason, added_on: new Date().toISOString() };
    config.save({ watchlist: wl });
    roster.addNames([r.name], kind || 'trigger');
    toast(`Flagged ${r.name}: ${reason}`, 'warn');
  } catch (_) {}
}

function wireWatcher() {
  // "ONLINE: a, b, c" is the full-lobby list a client dumps on load (via /who or auto-who) —
  // clearOnLobbyJoin wipes stale entries right before repopulating from that fresh list, a
  // safety net for when serverChange's own detection doesn't fire first.
  watcher.on('who', (names) => { if (getConfig().clearOnLobbyJoin) roster.clear(); roster.addNames(names, 'GAME'); });
  // Both of these are passive background noise-pickers, not a deliberate action like /who - so
  // both require inBedwarsMatch() (your actual small match instance), not just "somewhere
  // Bedwars-flagged" - the shared matchmaking staging lobby is also gametype BEDWARS but is just
  // as noisy as the hub, see currentServer's comment above.
  watcher.on('lobbyJoin', (n) => { if (inBedwarsMatch()) roster.addNames([n], 'GAME'); });
  // Opt-in (see trackChatSpeakers in Settings) on top of that - some people still don't want
  // random match-lobby chatter added even once scoped correctly.
  watcher.on('chatSpeaker', (n) => { if (getConfig().trackChatSpeakers && inBedwarsMatch()) roster.addNames([n], 'GAME'); });
  watcher.on('partyList', (names) => roster.addNames(names, 'PARTY'));
  watcher.on('quit', (n) => { /* keep in list; optional removal */ });
  // Housing fires its own serverChange twice in a row - once for the housing lobby, once more
  // for the actual house instance right after the teleport message names its owner - so a plain
  // clear-on-serverChange would wipe the owner right back out the moment they're added. Re-add
  // them once, but only if that second serverChange lands within a few seconds of the teleport;
  // past that it's a stale value from some earlier, unrelated house and shouldn't leak forward.
  let pendingHouseOwner = null, pendingHouseOwnerTs = 0;
  watcher.on('houseEntered', (owner) => {
    pendingHouseOwner = owner; pendingHouseOwnerTs = Date.now();
    roster.addNames([owner], 'house');
  });
  watcher.on('serverChange', (info) => {
    // undefined means "changed servers, but we don't actually know which one" (the plain-text
    // fallback patterns can't tell) - leave currentServer alone rather than guessing. Any real
    // string (including "limbo") is an actual answer from the JSON status blob and overwrites it.
    if (info && info.server !== undefined) currentServer = info.server;
    if (getConfig().clearOnServerChange) roster.clear();
    if (pendingHouseOwner && Date.now() - pendingHouseOwnerTs < 8000) roster.addNames([pendingHouseOwner], 'house');
    pendingHouseOwner = null;
  });

  // Each trigger passes its own "kind" through to the roster row so the overlay can show
  // a distinct badge for how a player was actually detected (party, mention, DM, ...),
  // not just a generic "flagged" marker.
  watcher.on('partyJoin', (names) => {
    roster.addNames(names, 'PARTY');
    if (getConfig().triggers.onPartyJoin) names.forEach((n) => watchlistAdd(n, 'joined your party', 'PARTY'));
  });
  watcher.on('partyInvite', (n) => {
    if (getConfig().triggers.onPartyInvite) watchlistAdd(n, 'party invite', 'partyInvite');
    toast(`Party invite from ${n}`, 'info');
  });
  watcher.on('friendRequest', (n) => { if (getConfig().triggers.onFriendRequest) watchlistAdd(n, 'friend request', 'friendRequest'); });
  watcher.on('dmFrom', (n, text) => {
    if (getConfig().triggers.onDirectMessage) watchlistAdd(n, 'DM: ' + (text || '').slice(0, 40), 'dm');
    toast(`DM from ${n}`, 'info');
  });
  watcher.on('mention', ({ by, text }) => {
    if (getConfig().triggers.onNameInChat) watchlistAdd(by, 'said your name: ' + (text || '').slice(0, 40), 'mention');
    toast(`${by} mentioned you`, 'warn');
  });
  watcher.on('killedYou', (n) => { if (getConfig().triggers.onKilledYou) watchlistAdd(n, 'final-killed you', 'kill'); });
  // Housing has none of Bedwars' lobby-fill/kill-feed chatter, so the house owner (from the
  // teleport message) is the one useful thing to auto-track there.
  watcher.on('houseEntered', (owner) => roster.addNames([owner], 'house'));
  // De-nick attempt: match the killer's reported lifetime final-kill count against players this
  // app has already seen stats for (see hypixel.findByFinalKills — there's no way to search
  // Hypixel-wide, only what's locally cached). Only useful when it points somewhere other than
  // the name already on-screen.
  watcher.on('finalKillCount', ({ killer, count }) => {
    const candidates = hypixel.findByFinalKills(count, 2).filter((c) => c.name.toLowerCase() !== killer.toLowerCase());
    if (!candidates.length) return;
    roster.setDenickHint(killer, { count, candidates, ts: Date.now() });
    if (candidates.length === 1) toast(`Possible nick: ${killer} -> ${candidates[0].name}?`, 'warn');
  });
  // Cached so a renderer that (re)loads after this has already fired at least once - which is
  // the usual case, since the overlay's own script takes a moment to load and register its
  // onLogStatus listener after createOverlay() kicks off startWatcher() - can still ask for the
  // current status instead of being stuck showing whatever the logdot's default markup was until
  // the next actual change (which might be a long time, or never).
  watcher.on('status', (s) => { lastLogStatus = s; broadcast('log:status', s); });
}

// ---------------- refresh loop ----------------
function applyRefreshTimer() {
  if (refreshTimer) clearInterval(refreshTimer);
  const s = getConfig().refreshSeconds || 0;
  if (s > 0) refreshTimer = setInterval(() => roster.refreshAll(), s * 1000);
}

// ---------------- IPC ----------------
function registerIpc() {
  ipcMain.handle('config:get', () => getConfig());
  ipcMain.handle('config:reset', () => { const c = config.reset(); afterConfigChange(); broadcast('config:changed', c); return c; });
  ipcMain.handle('config:set', (_e, patch) => {
    const c = config.save(patch || {});
    afterConfigChange(patch);
    broadcast('config:changed', c);
    return c;
  });

  ipcMain.handle('roster:get', () => roster.list());
  ipcMain.handle('roster:add', (_e, name) => { roster.addNames([name], 'MANUAL'); return true; });
  ipcMain.handle('roster:remove', (_e, id) => { id.length === 32 ? roster.removeByUuid(id) : roster.removeByName(id); return true; });
  ipcMain.handle('roster:clear', () => { roster.clear(); return true; });
  ipcMain.handle('roster:refresh', () => { roster.refreshAll(); return true; });

  ipcMain.handle('overlay:setClickThrough', (_e, v) => { config.save({ clickThrough: !!v }); applyClickThrough(); return v; });
  ipcMain.handle('window:min', () => BrowserWindow.getFocusedWindow()?.minimize());
  ipcMain.handle('window:close', () => { const w = BrowserWindow.getFocusedWindow(); if (w === overlayWin) app.quit(); else w?.close(); });
  ipcMain.handle('open:settings', () => openSettings());
  ipcMain.handle('open:blacklist', () => openBlacklist());
  ipcMain.handle('app:quit', () => app.quit());
  ipcMain.handle('splash:done', () => {
    if (splashWin && !splashWin.isDestroyed()) splashWin.close();
    if (overlayWin) overlayWin.show();
    return true;
  });

  ipcMain.handle('urchin:addTag', (_e, payload) => urchin.addTag(payload));
  ipcMain.handle('urchin:addLocal', (_e, uuid, tag) => { urchin.addLocalTag(uuid, tag); roster.refreshAll(); return true; });
  ipcMain.handle('watchlist:add', (_e, name, reason) => watchlistAdd(name, reason || 'manual', 'MANUAL'));

  ipcMain.handle('lookup:name', async (_e, name) => {
    const r = await hypixel.resolveUuid(name);
    if (!r) return { ok: false, error: 'not found (nicked or invalid)' };
    const ur = await urchin.lookup(r.id, r.name).catch(() => null);
    return { ok: true, uuid: r.id, name: r.name, urchin: ur };
  });

  ipcMain.handle('key:test', async () => {
    // /v2/key used to be how you checked a key, but Hypixel removed it - it now 404s
    // ("Unknown endpoint") even for a perfectly valid key. Rate-limit info comes back as
    // headers on any real call now, so ping a tiny no-target endpoint instead and read those.
    try {
      const r = await fetch('https://api.hypixel.net/v2/punishmentstats', { headers: { 'API-Key': getConfig().hypixelKey } });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.success) {
        const limit = r.headers.get('ratelimit-limit');
        return { ok: true, record: { limit: limit ? Number(limit) : null } };
      }
      return { ok: false, error: j.cause || ('HTTP ' + r.status) };
    } catch (e) { return { ok: false, error: String(e.message || e) }; }
  });

  ipcMain.handle('log:pick', async () => {
    const r = await dialog.showOpenDialog({ title: 'Select latest.log', properties: ['openFile'], filters: [{ name: 'Log', extensions: ['log', 'txt'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    config.save({ logPath: r.filePaths[0] }); startWatcher(); broadcast('config:changed', getConfig());
    return r.filePaths[0];
  });

  ipcMain.handle('link:open', (_e, url) => shell.openExternal(url));
  ipcMain.handle('log:getStatus', () => lastLogStatus);
}

function applySelf() { const cfg = getConfig(); roster.setSelf(cfg.selfName, cfg.hideSelf); }

function afterConfigChange(patch = {}) {
  if (overlayWin) {
    overlayWin.setAlwaysOnTop(getConfig().alwaysOnTop, 'screen-saver');
    overlayWin.setOpacity(getConfig().window.opacity ?? 0.94);
    applyCapture(); applyClickThrough();
  }
  if (patch.logPath !== undefined || patch.logEnabled !== undefined || patch.selfName !== undefined || patch.reactNames !== undefined) startWatcher();
  if (patch.selfName !== undefined || patch.hideSelf !== undefined) applySelf();
  if (patch.refreshSeconds !== undefined) applyRefreshTimer();
}

// ---------------- tray + shortcuts ----------------
function buildTray() {
  try {
    const img = nativeImage.createFromPath(path.join(__dirname, '..', '..', 'assets', 'icon.png'));
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
    tray.setToolTip('Solar Overlay');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show / Hide Overlay', click: toggleOverlay },
      { label: 'Settings', click: openSettings },
      { label: 'Blacklist Admin', click: openBlacklist },
      { type: 'separator' },
      { label: 'Toggle Click-Through', click: () => { config.save({ clickThrough: !getConfig().clickThrough }); applyClickThrough(); } },
      { label: 'Quit', click: () => app.quit() },
    ]));
    tray.on('double-click', toggleOverlay);
  } catch (_) {}
}
function toggleOverlay() { if (!overlayWin) { createOverlay(); overlayWin.show(); return; } overlayWin.isVisible() ? overlayWin.hide() : overlayWin.show(); }

function registerShortcuts() {
  globalShortcut.register('Alt+B', toggleOverlay);
  globalShortcut.register('Alt+X', () => { config.save({ clickThrough: !getConfig().clickThrough }); applyClickThrough(); toast('Click-through ' + (getConfig().clickThrough ? 'ON' : 'OFF')); });
  globalShortcut.register('Alt+C', () => roster.clear());
  globalShortcut.register('Alt+S', openSettings);
}

// ---------------- boot ----------------
app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // no menu bar on this app, and it's what binds F11 -> fullscreen by default
  hypixel = new Hypixel(getConfig);
  urchin = new Urchin(getConfig);
  roster = new Roster(hypixel, urchin, getConfig);
  watcher = new LogWatcher();

  roster.on('update', (list) => broadcast('roster:update', list));
  wireWatcher();
  registerIpc();
  createSplash();
  createOverlay(); // stays hidden (show:false) until the splash reports done, see ipcMain 'splash:done'
  buildTray();
  registerShortcuts();
  startWatcher();
  applyRefreshTimer();
  applySelf(); // your own IGN, if configured, is in the list from the moment the app starts

  app.on('activate', () => { if (!overlayWin) { createOverlay(); overlayWin.show(); } });
});

app.on('window-all-closed', () => {}); // stay alive in tray
app.on('will-quit', () => globalShortcut.unregisterAll());
