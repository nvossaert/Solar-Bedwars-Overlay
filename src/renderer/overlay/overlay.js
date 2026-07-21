'use strict';
const api = window.solarBridge;

const COLMETA = {
  tag:     { label: 'Tag',        num: false },
  star:    { label: 'Lvl',        num: true  },
  name:    { label: 'Player',     num: false },
  fkdr:    { label: 'FKDR',       num: true  },
  wlr:     { label: 'WLR',        num: true  },
  finals:  { label: 'F.Kills',    num: true  },
  wins:    { label: 'Wins',       num: true  },
  ws:      { label: 'WS',         num: true  },
  mfkdr:   { label: 'M.FKDR',     num: true  },
  sniper:  { label: 'Sniper',     num: true  },
  lastseen:{ label: 'Last Login', num: true  },
  bl:      { label: 'BL',         num: true  },
};
const RANKCOLOR = {
  SUPERSTAR: '#ffaa00', MVP_PLUS: '#55ffff', MVP: '#55ffff', SUPERSTAR_PLUS: '#ffaa00',
  VIP_PLUS: '#55ff55', VIP: '#55ff55', YOUTUBER: '#ff5555', ADMIN: '#ff5555', HELPER: '#5555ff',
  MODERATOR: '#00aa00', GAME_MASTER: '#00aa00', NONE: 'var(--text)',
};

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
  return (cfg.columns || []).slice().sort((a,b)=>a.order-b.order).filter(c=>c.visible && COLMETA[c.key]);
}

function renderHead(){
  const head = $('#headRow'); head.innerHTML='';
  for(const col of orderedColumns()){
    const meta = COLMETA[col.key];
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
  for(const key of Object.keys(COLMETA)){
    const c = cfg.columns.find(k=>k.key===key) || {key,visible:true,order:99};
    const it = el('div','item');
    it.innerHTML = `<span>${esc(COLMETA[key].label)}</span><span>${c.visible?'✓':''}</span>`;
    it.onclick = ()=>{ const cols = cfg.columns.map(k=>k.key===key?{...k,visible:!k.visible}:k);
      hideCtx(); save({ columns: cols }); };
    menu.appendChild(it);
  }
  showCtx(x,y);
}

// ---------------- sorting ----------------
function sortVal(row, key){
  const s = row.stats||{}, sn = row.sniper||{}, u = row.urchin||{};
  switch(key){
    case 'name': return (row.name||'').toLowerCase();
    case 'star': return s.star||0;
    case 'fkdr': return s.fkdr||0;
    case 'wlr': return s.wlr||0;
    case 'finals': return s.finalKills||0;
    case 'wins': return s.wins||0;
    case 'ws': return s.winstreak||0;
    case 'mfkdr': return s.mfkdr==null?-1:s.mfkdr;
    case 'sniper': return sn.score||0;
    case 'lastseen': return s.lastLogin||0;
    case 'tag': return u.severity||0;
    case 'bl': return blCount(row);
    default: return 0;
  }
}
function blCount(row){ const u=row.urchin; if(!u)return 0; return (u.tags||[]).filter(t=>t.source==='local-import'||t.source==='local'||t.source==='trigger').length; }

function sorted(){
  const key = cfg.sortBy, dir = cfg.sortDir==='desc'?-1:1;
  return rows.slice().sort((a,b)=>{
    // loading/nicked rows sink
    const av=sortVal(a,key), bv=sortVal(b,key);
    if(av<bv)return -1*dir; if(av>bv)return 1*dir;
    return (a.name||'').localeCompare(b.name||'');
  });
}

// ---------------- row rendering ----------------
function cell(row, key){
  const td = el('td'); const s = row.stats, sn = row.sniper, u = row.urchin;
  if(row.loading && !s && key!=='name'){ td.innerHTML='<span class="loading">…</span>'; return td; }
  switch(key){
    case 'tag':{
      const p = u && u.primary;
      if(p){ td.innerHTML = `<span class="tagchip" style="background:${p.color}">${esc(p.label || (p.type||'').slice(0,4).toUpperCase())}</span>`; }
      return td;
    }
    case 'star':{
      if(!s){ td.textContent=''; return td; }
      td.innerHTML = `<span class="star" style="color:${s.starColorHex}">${s.star}✫</span>`; return td;
    }
    case 'name':{
      td.className='name';
      if(row.nicked){ td.innerHTML=`<span class="nick">${esc(row.name)} (nick?)</span>`; return td; }
      if(row.apiError){ td.innerHTML=`${esc(row.name)} <span class="err">${esc(row.apiError)}</span>`; return td; }
      const col = RANKCOLOR[(s&&s.rank)||'NONE']||'var(--text)';
      td.innerHTML=`<span style="color:${col}">${esc(row.name)}</span>` + (row.loading?' <span class="loading">…</span>':'');
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
    case 'bl':{ const n=blCount(row); td.className='mono'; td.innerHTML=n?`<span class="blnum">${n}</span>`:'<span class="dim">·</span>'; return td; }
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
  for(const row of list){
    const tr = el('tr');
    if(blCount(row)>0) tr.classList.add('bl');
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
  if(!s && !(u&&u.tags&&u.tags.length)) return;
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
      html += `<div class="row"><span class="tagchip" style="background:${t.color}">${esc(t.type)}</span> ${esc((t.reason||'').slice(0,90))} <span class="dim">[${esc(t.source)}]</span></div>`;
    }
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
