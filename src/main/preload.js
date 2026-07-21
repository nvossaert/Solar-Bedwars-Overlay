'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (ch, ...a) => ipcRenderer.invoke(ch, ...a);
const on = (ch, cb) => { const h = (_e, p) => cb(p); ipcRenderer.on(ch, h); return () => ipcRenderer.removeListener(ch, h); };

contextBridge.exposeInMainWorld('solarBridge', {
  // config
  getConfig: () => invoke('config:get'),
  setConfig: (patch) => invoke('config:set', patch),
  resetConfig: () => invoke('config:reset'),
  onConfigChanged: (cb) => on('config:changed', cb),

  // roster
  getRoster: () => invoke('roster:get'),
  addPlayer: (name) => invoke('roster:add', name),
  removePlayer: (id) => invoke('roster:remove', id),
  clearRoster: () => invoke('roster:clear'),
  refreshRoster: () => invoke('roster:refresh'),
  onRoster: (cb) => on('roster:update', cb),

  // overlay window
  setClickThrough: (v) => invoke('overlay:setClickThrough', v),
  minimize: () => invoke('window:min'),
  close: () => invoke('window:close'),
  openSettings: () => invoke('open:settings'),
  openBlacklist: () => invoke('open:blacklist'),
  quit: () => invoke('app:quit'),

  // urchin / blacklist
  adminAddTag: (payload) => invoke('urchin:addTag', payload),
  addLocalTag: (uuid, tag) => invoke('urchin:addLocal', uuid, tag),
  addWatchlist: (name, reason) => invoke('watchlist:add', name, reason),
  lookupName: (name) => invoke('lookup:name', name),

  // utils
  testKey: () => invoke('key:test'),
  pickLog: () => invoke('log:pick'),
  openLink: (url) => invoke('link:open', url),

  // events
  onToast: (cb) => on('toast', cb),
  onLogStatus: (cb) => on('log:status', cb),
});
