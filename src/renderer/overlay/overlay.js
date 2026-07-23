'use strict';
const api = window.solarBridge;

// width here is actually applied now (via the <colgroup> renderHead() builds) instead of every
// column just splitting the window evenly, which is what was squeezing Player down to a sliver.
const COLMETA = {
  source:  { label: 'Source',     num: false, width: 44 },
  tag:     { label: 'Tag',        num: false, width: 46 },
  star:    { label: 'Lvl',        num: true,  width: 58 },
  name:    { label: 'Player',     num: false, width: 130 },
  fkdr:    { label: 'FKDR',       num: true,  width: 62 },
  wlr:     { label: 'WLR',        num: true,  width: 58 },
  finals:  { label: 'F.Kills',    num: true,  width: 70 },
  wins:    { label: 'Wins',       num: true,  width: 62 },
  ws:      { label: 'WS',         num: true,  width: 46 },
  mfkdr:   { label: 'M.FKDR',     num: true,  width: 64 },
  sniper:  { label: 'Sniper',     num: true,  width: 66 },
  lastseen:{ label: 'Last Login', num: true,  width: 92 },
  bl:      { label: 'BL',         num: true,  width: 40 },
};
const DEFAULT_COL_WIDTH = 70;
const RANKCOLOR = {
  SUPERSTAR: '#ffaa00', MVP_PLUS: '#55ffff', MVP: '#55ffff', SUPERSTAR_PLUS: '#ffaa00',
  VIP_PLUS: '#55ff55', VIP: '#55ff55', YOUTUBER: '#ff5555', ADMIN: '#ff5555', HELPER: '#5555ff',
  MODERATOR: '#00aa00', GAME_MASTER: '#00aa00', NONE: 'var(--text)',
};
// How a player actually ended up on the list — shown as a small badge next to their name so it's
// obvious at a glance whether this is just someone in your game, or someone who invited/DM'd/killed
// you specifically. GAME (plain lobby detection) is the common case and gets no badge on purpose.
const SOURCE_BADGE = {
  PARTY: { title: 'In your party', color: '#58a6ff',
    svg: '<svg viewBox="0 0 16 10" width="12" height="8"><circle cx="6" cy="5" r="4.2" fill="currentColor" opacity=".95"/><circle cx="11" cy="5" r="4.2" fill="currentColor" opacity=".55"/></svg>' },
  mention: { title: 'Said your name in chat', color: '#3fb950', text: '@' },
  partyInvite: { title: 'Invited you to a party', color: '#bc8cff',
    svg: '<svg viewBox="0 0 16 16" width="11" height="11"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.4v7.2M4.4 8h7.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' },
  dm: { title: 'Sent you a DM', color: '#58a6ff',
    svg: '<svg viewBox="0 0 16 12" width="13" height="10"><rect x=".7" y=".7" width="14.6" height="10.6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M1.3 1.3l6.7 5.7 6.7-5.7" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>' },
  friendRequest: { title: 'Sent you a friend request', color: '#3ddc97',
    svg: '<svg viewBox="0 0 16 16" width="12" height="12"><circle cx="6" cy="5" r="3" fill="currentColor"/><path d="M1 15c0-3 2.2-5 5-5s5 2 5 5" fill="currentColor"/><path d="M12 4v4M10 6h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' },
  kill: { title: 'Final-killed you', color: '#ff5555',
    svg: '<svg viewBox="0 0 16 16" width="12" height="12"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' },
  MANUAL: { title: 'Added manually', color: '#8b949e', text: '+' },
};
// Best-effort de-nick hint (see main.js/hypixel.findByFinalKills): the killer's own reported
// final-kill count matched someone this app has already seen stats for. Only a suggestion —
// there's no way to search all of Hypixel by stat, this is limited to previously-seen players.
function denickMark(row){
  const h = row.denickHint;
  if(!h || !h.candidates || !h.candidates.length) return '';
  const names = h.candidates.map((c)=>c.name).join(', ');
  return `<span class="denick" title="Final-kill count (#${h.count}) matches: ${esc(names)} — best-effort guess, not certain">≈?</span>`;
}
function sourceBadge(source){
  const b = SOURCE_BADGE[source];
  if(!b) return '';
  const inner = b.svg || esc(b.text);
  return `<span class="srcbadge" style="color:${b.color}" title="${esc(b.title)}">${inner}</span>`;
}

// Small glyphs for blacklist tag chips instead of text labels (CHEAT/SNIPE/etc.) — the chip's
// background color already carries severity, these just carry category at a glance. Drawn in
// currentColor so they inherit the chip's existing dark text color automatically.
const TAG_ICON_SVG = {
  burst: '<svg viewBox="0 0 16 16" width="11" height="11"><path d="M14,10.49 L10.49,14 L5.51,14 L2,10.49 L2,5.51 L5.51,2 L10.49,2 L14,5.51 Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><rect x="7.3" y="4.6" width="1.4" height="4.4" rx="0.7" fill="currentColor"/><circle cx="8" cy="11.2" r="0.85" fill="currentColor"/></svg>',
  triangle: '<svg viewBox="0 0 16 16" width="11" height="11"><path d="M8,2.2 L14.4,13.6 L1.6,13.6 Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><rect x="7.3" y="7" width="1.4" height="3.6" rx="0.7" fill="currentColor"/><circle cx="8" cy="11.7" r="0.8" fill="currentColor"/></svg>',
  person: '<svg viewBox="0 0 16 16" width="11" height="11"><circle cx="8" cy="5.4" r="3" fill="currentColor"/><path d="M2.2,14c0-3.2,2.4-5.4,5.8-5.4s5.8,2.2,5.8,5.4" fill="currentColor"/></svg>',
  panel: '<svg viewBox="0 0 16 16" width="11" height="11"><rect x="1.8" y="2.6" width="12.4" height="10.4" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="1.8" y="2.6" width="12.4" height="3" rx="1.3" fill="currentColor"/></svg>',
  dot: '<svg viewBox="0 0 16 16" width="9" height="9"><circle cx="8" cy="8" r="3.4" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 16 16" width="11" height="11"><path d="M2.6,8.4 L6.2,12 L13.4,4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
function tagIcon(t){ return TAG_ICON_SVG[t && t.icon] || TAG_ICON_SVG.dot; }

let cfg = null;
let rows = [];

const $ = (s) => document.querySelector(s);
const el = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };

function fkdrColor(v){ if(v>=10)return'#ff2d55'; if(v>=6)return'#ff6b35'; if(v>=3)return'#ffb454'; if(v>=1)return'#7ee787'; return'#8b949e'; }
function wlrColor(v){ if(v>=5)return'#ff6b35'; if(v>=2)return'#ffb454'; if(v>=1)return'#7ee787'; return'#8b949e'; }
function relTime(ts){ if(!ts)return'—'; const s=(Date.now()-ts)/1000;
  if(s<60)return Math.floor(s)+'s'; const m=s/60; if(m<60)return Math.floor(m)+'m';
  const h=m/60; if(h<24)return Math.floor(h)+'h'; const d=h/24; if(d<30)return Math.floor(d)+'d';
  const mo=d/30; if(mo<12)return Math.floor(mo)+'mo'; return Math.floor(mo/12)+'y'; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function getPath(o,p){ return String(p||'').split('.').reduce((a,k)=>(a==null?a:a[k]), o); }
// Custom columns (Settings -> Columns) pull an arbitrary stat off row.raw (the unmodified
// Hypixel player object) by dot-path, so they need their own column-meta lookup on top of COLMETA.
function colMeta(key){
  if (COLMETA[key]) return COLMETA[key];
  const c = (cfg.customColumns||[]).find((c)=>c.key===key);
  return c ? { label: c.label, num: true, width: Math.max(56, c.label.length * 7 + 24) } : null;
}
// A column's value normally comes from the computed stats (built-ins) or row.raw (custom
// columns), but Settings -> Connections lets the user rewire either kind to a specific
// Connection's raw response instead — 'hypixel' (or no source) means "leave it alone".
function sourceValue(row, source, path){
  if(!source || source==='hypixel') return getPath(row.raw, path);
  const raw = row.urchin && row.urchin.raw && row.urchin.raw[source];
  return getPath(raw, path);
}
function filteredTags(row, connId){
  const tags = (row.urchin && row.urchin.tags) || [];
  if(!connId || connId==='all') return tags;
  return tags.filter((t)=>t.connId===connId);
}

// ---------------- theme ----------------
function applyTheme(){
  const t = cfg.theme || {};
  const r = document.documentElement.style;
  r.setProperty('--bg', t.bg || '#0d1117');
  r.setProperty('--header', t.headerBg || '#161b22');
  r.setProperty('--text', t.text || '#e6edf3');
  r.setProperty('--accent', t.accent || '#58a6ff');
  r.setProperty('--grid', t.grid || '#21262d');
  r.setProperty('--font', (cfg.fontSize || 13) + 'px');
  r.setProperty('--row', (cfg.rowHeight || 22) + 'px');
  $('#btnClick').classList.toggle('on', !!cfg.clickThrough);
}

// ---------------- columns ----------------
function orderedColumns(){
  return (cfg.columns || []).slice().sort((a,b)=>a.order-b.order).filter(c=>c.visible && colMeta(c.key));
}

function renderHead(){
  const head = $('#headRow'); head.innerHTML='';
  const cols = orderedColumns();

  // Each column now gets its own real pixel width via <colgroup> instead of the table splitting
  // available space evenly across however many columns are visible — that equal-split is what
  // was squeezing Player down to a few characters once several columns were on.
  let colgroup = $('#tbl > colgroup');
  if(!colgroup){ colgroup = document.createElement('colgroup'); colgroup.id='colgroup'; $('#tbl').prepend(colgroup); }
  colgroup.innerHTML='';
  let totalWidth = 0;
  for(const col of cols){
    const w = colMeta(col.key).width || DEFAULT_COL_WIDTH;
    totalWidth += w;
    const c = document.createElement('col'); c.style.width = w+'px';
    colgroup.appendChild(c);
  }
  $('#tbl').style.width = totalWidth+'px';

  for(const col of cols){
    const meta = colMeta(col.key);
    const th = el('th');
    th.dataset.key = col.key;
    th.draggable = true;
    th.innerHTML = esc(meta.label) + (cfg.sortBy===col.key ? `<span class="arrow">${cfg.sortDir==='desc'?'▼':'▲'}</span>` : '');
    th.onclick = ()=>{ const d = cfg.sortBy===col.key ? (cfg.sortDir==='desc'?'asc':'desc') : (meta.num?'desc':'asc');
      save({ sortBy: col.key, sortDir: d }); };
    th.oncontextmenu = (e)=>{ e.preventDefault(); columnMenu(e.clientX, e.clientY); };
    // drag reorder
    th.ondragstart = (e)=>{ e.dataTransfer.setData('text/plain', col.key); };
    th.ondragover = (e)=>{ e.preventDefault(); th.classList.add('dragover'); };
    th.ondragleave = ()=> th.classList.remove('dragover');
    th.ondrop = (e)=>{ e.preventDefault(); th.classList.remove('dragover');
      const from = e.dataTransfer.getData('text/plain'); reorder(from, col.key); };
    head.appendChild(th);
  }
}

function reorder(fromKey, toKey){
  if(fromKey===toKey) return;
  const cols = cfg.columns.slice().sort((a,b)=>a.order-b.order);
  const fi = cols.findIndex(c=>c.key===fromKey), ti = cols.findIndex(c=>c.key===toKey);
  const [moved] = cols.splice(fi,1); cols.splice(ti,0,moved);
  cols.forEach((c,i)=>c.order=i);
  save({ columns: cols });
}

function columnMenu(x,y){
  const menu = $('#ctx'); menu.innerHTML='';
  const head = el('div','head'); head.textContent='Toggle columns'; menu.appendChild(head);
  const keys = Object.keys(COLMETA).concat((cfg.customColumns||[]).map(c=>c.key));
  for(const key of keys){
    const c = cfg.columns.find(k=>k.key===key) || {key,visible:true,order:99};
    const it = el('div','item');
    it.innerHTML = `<span>${esc(colMeta(key).label)}</span><span>${c.visible?'✓':''}</span>`;
    it.onclick = ()=>{ const cols = cfg.columns.some(k=>k.key===key) ? cfg.columns.map(k=>k.key===key?{...k,visible:!k.visible}:k) : [...cfg.columns, {key, visible:false, order:cfg.columns.length}];
      hideCtx(); save({ columns: cols }); };
    menu.appendChild(it);
  }
  showCtx(x,y);
}

// ---------------- sorting ----------------
function sortVal(row, key){
  const s = row.stats||{}, sn = row.sniper||{}, u = row.urchin||{};
  const override = (cfg.columnSources||{})[key];
  if(override && key!=='tag' && key!=='bl' && override.path){
    const v = sourceValue(row, override.source, override.path);
    return typeof v==='number' ? v : 0;
  }
  switch(key){
    case 'name': return (row.name||'').toLowerCase();
    case 'source': return row.source || '';
    case 'star': return s.star||0;
    case 'fkdr': return s.fkdr||0;
    case 'wlr': return s.wlr||0;
    case 'finals': return s.finalKills||0;
    case 'wins': return s.wins||0;
    case 'ws': return s.winstreak||0;
    case 'mfkdr': return s.mfkdr==null?-1:s.mfkdr;
    case 'sniper': return sn.score||0;
    case 'lastseen': return s.lastLogin||0;
    case 'tag':{
      if(override && override.source) return filteredTags(row, override.source).reduce((m,t)=>Math.max(m,t.severity||0),0);
      return u.severity||0;
    }
    case 'bl': return blCount(row, override && override.source);
    default:{
      const cc = (cfg.customColumns||[]).find(c=>c.key===key);
      if(cc){ const v = sourceValue(row, cc.source, cc.path); return typeof v==='number' ? v : 0; }
      return 0;
    }
  }
}
// Normally counts locally-sourced flags (local-import/local/trigger). When a Connection is
// mapped onto this column, it instead counts however many tags THAT connection contributed.
function blCount(row, connId){
  const tags = (row.urchin && row.urchin.tags) || [];
  if(connId && connId!=='all') return tags.filter((t)=>t.connId===connId).length;
  return tags.filter(t=>t.source==='local-import'||t.source==='local'||t.source==='trigger').length;
}

function sorted(){
  const key = cfg.sortBy, dir = cfg.sortDir==='desc'?-1:1;
  return rows.slice().sort((a,b)=>{
    // Party members always float to the top, ahead of the normal sort.
    const ap = a.source==='PARTY' ? 0 : 1, bp = b.source==='PARTY' ? 0 : 1;
    if(ap!==bp) return ap-bp;
    const av=sortVal(a,key), bv=sortVal(b,key);
    if(av<bv)return -1*dir; if(av>bv)return 1*dir;
    return (a.name||'').localeCompare(b.name||'');
  });
}

// ---------------- row rendering ----------------
function cell(row, key){
  const td = el('td'); const s = row.stats, sn = row.sniper, u = row.urchin;
  if(row.loading && !s && key!=='name' && key!=='source'){ td.innerHTML='<span class="loading">…</span>'; return td; }
  const override = (cfg.columnSources||{})[key];
  if(override && key!=='tag' && key!=='bl' && override.path){
    const v = sourceValue(row, override.source, override.path);
    td.className = 'mono';
    td.textContent = v==null ? '—' : (typeof v==='number' ? fmt(v) : String(v));
    return td;
  }
  switch(key){
    case 'tag':{
      let p = u && u.primary;
      if(override && override.source) p = filteredTags(row, override.source).slice().sort((a,b)=>(b.severity||0)-(a.severity||0))[0] || null;
      if(p){ td.innerHTML = `<span class="tagchip" style="background:${p.color}" title="${esc(p.label || (p.type||'').slice(0,4).toUpperCase())}">${tagIcon(p)}</span>`; }
      return td;
    }
    case 'star':{
      if(!s){ td.textContent=''; return td; }
      td.innerHTML = `<span class="star" style="color:${s.starColorHex}">${s.star}✫</span>`; return td;
    }
    case 'source':{
      td.className='center'; td.innerHTML = sourceBadge(row.source); return td;
    }
    case 'name':{
      td.className='name';
      const denick = denickMark(row);
      if(row.nicked){ td.innerHTML=`<span class="nick">${esc(row.name)} (nick?)</span>${denick}`; return td; }
      if(row.apiError){ td.innerHTML=`${esc(row.name)} <span class="err">${esc(row.apiError)}</span>${denick}`; return td; }
      const col = RANKCOLOR[(s&&s.rank)||'NONE']||'var(--text)';
      td.innerHTML=`<span style="color:${col}">${esc(row.name)}</span>${denick}` + (row.loading?' <span class="loading">…</span>':'');
      return td;
    }
    case 'fkdr':{ if(!s){td.textContent='';return td;} td.className='mono'; td.innerHTML=`<span style="color:${fkdrColor(s.fkdr)}">${s.fkdr.toFixed(2)}</span>`; return td; }
    case 'wlr':{ if(!s){td.textContent='';return td;} td.className='mono'; td.innerHTML=`<span style="color:${wlrColor(s.wlr)}">${s.wlr.toFixed(2)}</span>`; return td; }
    case 'finals':{ if(!s){td.textContent='';return td;} td.className='mono'; td.textContent=fmt(s.finalKills); return td; }
    case 'wins':{ if(!s){td.textContent='';return td;} td.className='mono'; td.textContent=fmt(s.wins); return td; }
    case 'ws':{ if(!s){td.textContent='';return td;} td.className='mono'; td.textContent=(s.winstreak==null?'—':s.winstreak); return td; }
    case 'mfkdr':{ if(!s){td.textContent='';return td;} td.className='mono';
      td.innerHTML = s.mfkdr==null?'<span class="dim">—</span>':`<span style="color:${fkdrColor(s.mfkdr)}">${s.mfkdr.toFixed(2)}</span>`; return td; }
    case 'sniper':{ if(!sn){td.textContent='';return td;} td.className='mono';
      td.innerHTML=`<span class="snlabel" style="color:${sn.color}">${sn.score}</span>`; return td; }
    case 'lastseen':{ if(!s){td.textContent='';return td;} td.className='mono dim'; td.textContent=relTime(s.lastLogin); return td; }
    case 'bl':{ const n=blCount(row, override && override.source); td.className='mono'; td.innerHTML=n?`<span class="blnum">${n}</span>`:'<span class="dim">·</span>'; return td; }
  }
  const cc = (cfg.customColumns||[]).find(c=>c.key===key);
  if(cc){
    const v = sourceValue(row, cc.source, cc.path);
    td.className = 'mono';
    td.textContent = v==null ? '—' : (typeof v==='number' ? fmt(v) : String(v));
    return td;
  }
  return td;
}
function fmt(n){ n=+n||0; return n>=100000?(n/1000).toFixed(0)+'k':n.toLocaleString(); }

function render(){
  if(!cfg) return;
  const body = $('#body'); body.innerHTML='';
  const list = sorted();
  $('#count').textContent = rows.length;
  $('#empty').classList.toggle('hidden', rows.length>0);
  const cols = orderedColumns();
  const hlStat = cfg.highlightEnabled !== false ? cfg.highlightStat : null;
  for(const row of list){
    const tr = el('tr');
    if(blCount(row)>0) tr.classList.add('bl');
    if(hlStat){
      const v = sortVal(row, hlStat);
      if(typeof v==='number' && v >= (cfg.highlightThreshold ?? Infinity)) tr.classList.add('highlight');
    }
    for(const c of cols) tr.appendChild(cell(row, c.key));
    tr.oncontextmenu = (e)=>{ e.preventDefault(); rowMenu(e.clientX,e.clientY,row); };
    tr.onmouseenter = (e)=> showTip(e,row);
    tr.onmousemove = (e)=> moveTip(e);
    tr.onmouseleave = hideTip;
    body.appendChild(tr);
  }
}

// ---------------- tooltip ----------------
let tipEl=null;
function showTip(e,row){
  hideTip();
  const s=row.stats, sn=row.sniper, u=row.urchin;
  if(!s && !(u&&u.tags&&u.tags.length) && !row.denickHint) return;
  tipEl = el('div','tip');
  let html = `<div class="row"><b>${esc(row.displayName||row.name)}</b></div>`;
  if(s){
    html += `<div class="row">${s.star}✫ · FKDR ${s.fkdr.toFixed(2)} · WLR ${s.wlr.toFixed(2)} · WS ${s.winstreak==null?'?':s.winstreak}</div>`;
    html += `<div class="row dim">Finals ${fmt(s.finalKills)}/${fmt(s.finalDeaths)} · Wins ${fmt(s.wins)} · Games ${fmt(s.gamesPlayed)}</div>`;
    if(s.mfkdr!=null) html += `<div class="row dim">Monthly FKDR ${s.mfkdr.toFixed(2)} (${fmt(s.mFinals)} finals tracked)</div>`;
    html += `<div class="row dim">Network Lv ${s.networkLevel} · Last login ${relTime(s.lastLogin)} ago</div>`;
    if(sn) html += `<div class="row"><b style="color:${sn.color}">${sn.label} ${sn.score}/100</b></div>`;
  }
  if(u && u.tags && u.tags.length){
    html += `<div class="row" style="margin-top:4px"><b>Blacklist tags</b></div>`;
    for(const t of u.tags.slice(0,6)){
      html += `<div class="row"><span class="tagchip" style="background:${t.color}" title="${esc(t.label || t.type)}">${tagIcon(t)}</span> <b>${esc(t.label || t.type)}</b> ${esc((t.reason||'').slice(0,90))} <span class="dim">[${esc(t.source)}]</span></div>`;
    }
  }
  if(row.denickHint && row.denickHint.candidates && row.denickHint.candidates.length){
    html += `<div class="row" style="margin-top:4px"><b>Possibly nicked</b></div>`;
    html += `<div class="row dim">Final-kill count #${row.denickHint.count} matches: ${esc(row.denickHint.candidates.map(c=>c.name).join(', '))} (not certain — right-click to add)</div>`;
  }
  tipEl.innerHTML = html;
  document.body.appendChild(tipEl);
  moveTip(e);
}
function moveTip(e){ if(!tipEl)return; const pad=14; let x=e.clientX+pad,y=e.clientY+pad;
  const r=tipEl.getBoundingClientRect();
  if(x+r.width>window.innerWidth) x=e.clientX-r.width-pad;
  if(y+r.height>window.innerHeight) y=window.innerHeight-r.height-4;
  tipEl.style.left=x+'px'; tipEl.style.top=y+'px'; }
function hideTip(){ if(tipEl){ tipEl.remove(); tipEl=null; } }

// ---------------- context menu ----------------
function showCtx(x,y){ const m=$('#ctx'); m.classList.remove('hidden'); m.style.left=x+'px'; m.style.top=y+'px';
  const r=m.getBoundingClientRect(); if(r.right>window.innerWidth)m.style.left=(x-r.width)+'px';
  if(r.bottom>window.innerHeight)m.style.top=(y-r.height)+'px'; }
function hideCtx(){ $('#ctx').classList.add('hidden'); }
window.addEventListener('click',hideCtx);

function rowMenu(x,y,row){
  hideTip();
  const m=$('#ctx'); m.innerHTML='';
  const head=el('div','head'); head.textContent=row.name; m.appendChild(head);
  const add=(label,fn)=>{ const it=el('div','item'); it.textContent=label; it.onclick=()=>{hideCtx();fn();}; m.appendChild(it); };
  add('Open on Plancke ↗', ()=> row.uuid && api.openLink('https://plancke.io/hypixel/player/stats/'+row.uuid));
  add('Open on Hypixel.net ↗', ()=> row.uuid && api.openLink('https://hypixel.net/'));
  add('Copy username', ()=> navigator.clipboard.writeText(row.name));
  m.appendChild(el('div','sep'));
  add('＋ Local info tag…', ()=> tagModal(row));
  add('⚑ Flag to watchlist', ()=> api.addWatchlist(row.name, 'manual flag'));
  if(row.uuid) add('⚑ Add to Urchin (admin)…', ()=> api.openBlacklist());
  if(row.denickHint && row.denickHint.candidates && row.denickHint.candidates.length){
    m.appendChild(el('div','sep'));
    for(const c of row.denickHint.candidates) add(`≈? Add suggested identity: ${c.name}`, ()=> api.addPlayer(c.name));
  }
  m.appendChild(el('div','sep'));
  add('✕ Remove from list', ()=> api.removePlayer(row.uuid||row.name));
  showCtx(x,y);
}

// ---------------- mini modal (Electron disables prompt) ----------------
function tagModal(row){
  const back = el('div'); back.style.cssText='position:fixed;inset:0;background:#0008;z-index:80;display:flex;align-items:center;justify-content:center';
  const box = el('div'); box.style.cssText='background:var(--header);border:1px solid var(--grid);border-radius:8px;padding:14px;width:280px';
  box.innerHTML = `<div style="font-weight:600;margin-bottom:8px">Local info tag — ${esc(row.name)}</div>
    <input id="mReason" placeholder="reason" style="width:100%;padding:6px;background:var(--bg);border:1px solid var(--grid);color:var(--text);border-radius:5px;outline:none">
    <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:10px">
      <button id="mCancel" style="padding:5px 10px">Cancel</button>
      <button id="mOk" style="padding:5px 10px;background:var(--accent);color:#fff;border:none;border-radius:5px">Add</button></div>`;
  back.appendChild(box); document.body.appendChild(back);
  const inp=box.querySelector('#mReason'); inp.focus();
  const close=()=>back.remove();
  box.querySelector('#mCancel').onclick=close;
  box.querySelector('#mOk').onclick=()=>{ if(row.uuid) api.addLocalTag(row.uuid,{tag_type:'info',reason:inp.value||'flagged'}); close(); };
  inp.onkeydown=(e)=>{ if(e.key==='Enter')box.querySelector('#mOk').click(); if(e.key==='Escape')close(); };
  back.onclick=(e)=>{ if(e.target===back)close(); };
}

// ---------------- toasts ----------------
function toast(t){
  const d=el('div','toast '+(t.kind==='warn'?'warn':t.kind==='err'?'err':''));
  d.textContent=t.msg; $('#toasts').appendChild(d);
  setTimeout(()=>{ d.style.opacity='0'; setTimeout(()=>d.remove(),300); }, 3200);
}

// ---------------- save/load ----------------
async function save(patch){ cfg = await api.setConfig(patch); applyAll(); }
function applyAll(){ applyTheme(); renderHead(); render(); }

// ---------------- wire ----------------
async function init(){
  cfg = await api.getConfig();
  rows = await api.getRoster();
  applyAll();

  api.onRoster((list)=>{ rows=list; render(); $('#count').textContent=rows.length; });
  api.onConfigChanged((c)=>{ cfg=c; applyAll(); });
  api.onToast(toast);
  api.onLogStatus((s)=> $('#logdot').classList.toggle('ok', !!s.ok));

  $('#btnSettings').onclick=()=>api.openSettings();
  $('#btnBlacklist').onclick=()=>api.openBlacklist();
  $('#btnClear').onclick=()=>api.clearRoster();
  $('#btnRefresh').onclick=()=>api.refreshRoster();
  $('#btnMin').onclick=()=>api.minimize();
  $('#btnClose').onclick=()=>api.quit();
  $('#btnClick').onclick=async ()=>{ await api.setClickThrough(!cfg.clickThrough); cfg.clickThrough=!cfg.clickThrough; $('#btnClick').classList.toggle('on',cfg.clickThrough); };

  const inp=$('#addInput');
  inp.onkeydown=(e)=>{ if(e.key==='Enter'&&inp.value.trim()){ api.addPlayer(inp.value.trim()); inp.value=''; } };
}
init();
