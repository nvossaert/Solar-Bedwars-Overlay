'use strict';
const api = window.solarBridge;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let cfg = null;
function norm(u) { return String(u || '').replace(/[^0-9a-fA-F]/g, '').toLowerCase(); }

// Same tiny glyph set as the overlay's tag chips (see overlay.js) — kept alongside the label
// text here since this admin window has room for both, unlike the compact overlay grid.
const TAG_ICON_SVG = {
  burst: '<svg viewBox="0 0 16 16" width="11" height="11"><path d="M14,10.49 L10.49,14 L5.51,14 L2,10.49 L2,5.51 L5.51,2 L10.49,2 L14,5.51 Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><rect x="7.3" y="4.6" width="1.4" height="4.4" rx="0.7" fill="currentColor"/><circle cx="8" cy="11.2" r="0.85" fill="currentColor"/></svg>',
  triangle: '<svg viewBox="0 0 16 16" width="11" height="11"><path d="M8,2.2 L14.4,13.6 L1.6,13.6 Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><rect x="7.3" y="7" width="1.4" height="3.6" rx="0.7" fill="currentColor"/><circle cx="8" cy="11.7" r="0.8" fill="currentColor"/></svg>',
  person: '<svg viewBox="0 0 16 16" width="11" height="11"><circle cx="8" cy="5.4" r="3" fill="currentColor"/><path d="M2.2,14c0-3.2,2.4-5.4,5.8-5.4s5.8,2.2,5.8,5.4" fill="currentColor"/></svg>',
  panel: '<svg viewBox="0 0 16 16" width="11" height="11"><rect x="1.8" y="2.6" width="12.4" height="10.4" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="1.8" y="2.6" width="12.4" height="3" rx="1.3" fill="currentColor"/></svg>',
  dot: '<svg viewBox="0 0 16 16" width="9" height="9"><circle cx="8" cy="8" r="3.4" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 16 16" width="11" height="11"><path d="M2.6,8.4 L6.2,12 L13.4,4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
function tagIcon(t){
  if(t && t.image) return `<img src="../../../assets/${t.image}" width="13" height="13" alt="" style="display:block">`;
  return TAG_ICON_SVG[t && t.icon] || TAG_ICON_SVG.dot;
}
// See overlay.js's tagChip() — same reasoning: real artwork already carries its own color, so a
// colored chip behind it only hurts contrast (e.g. yellow icon on a yellow chip).
function tagChip(t, title){
  const hasImg = !!(t && t.image);
  const style = hasImg ? '' : ` style="background:${t.color || '#58a6ff'}"`;
  return `<span class="tagchip${hasImg?' plain':''}"${style} title="${esc(title)}">${tagIcon(t)}</span>`;
}

async function refreshWarn() { cfg = await api.getConfig(); $('#warn').classList.toggle('hidden', !!cfg.urchinAdminKey); }

$('#fType').onchange = (e) => { $('#fTypeCustom').classList.toggle('hidden', e.target.value !== '__custom'); };

$('#lookBtn').onclick = doLookup;
$('#lookName').onkeydown = (e) => { if (e.key === 'Enter') doLookup(); };

async function doLookup() {
  const q = $('#lookName').value.trim(); if (!q) return;
  const box = $('#lookResult'); box.innerHTML = '<span class="dim">looking up…</span>';
  const r = await api.lookupName(q);
  if (!r.ok) { box.innerHTML = `<span style="color:#f85149">${esc(r.error)}</span>`; return; }
  $('#fUuid').value = r.uuid;
  const u = r.urchin || { tags: [] };
  let html = `<div class="card"><div class="nm">${esc(r.name)} <span class="dim">${esc(r.uuid)}</span></div>`;
  if (!u.tags || !u.tags.length) html += `<div class="dim" style="margin-top:6px">No tags found.</div>`;
  else for (const t of u.tags) {
    html += `<div class="tagline">${tagChip(t, t.label || t.type)}
      <span><b>${esc(t.label || t.type)}</b> ${esc(t.reason || '')} <span class="dim">[${esc(t.source || '')}]</span></span></div>`;
  }
  html += '</div>';
  box.innerHTML = html;
}

$('#submit').onclick = async () => {
  const uuid = norm($('#fUuid').value);
  let tag_type = $('#fType').value;
  if (tag_type === '__custom') tag_type = $('#fTypeCustom').value.trim();
  const reason = $('#fReason').value.trim();
  const res = $('#result');
  if (uuid.length !== 32) { res.innerHTML = '<span style="color:#f85149">Enter a valid UUID (look up a player first).</span>'; return; }
  if (!tag_type) { res.innerHTML = '<span style="color:#f85149">Tag type required.</span>'; return; }
  if (!reason) { res.innerHTML = '<span style="color:#f85149">Reason required.</span>'; return; }
  res.innerHTML = '<span class="dim">submitting…</span>';
  try {
    const r = await api.adminAddTag({ uuid, tag_type, reason, hide_username: $('#fHide').checked, overwrite: $('#fOver').checked });
    res.innerHTML = `<span style="color:#3fb950">✓ ${esc(r.message || 'Tag added.')}</span>`;
    toast('Tag added', 'ok');
  } catch (e) {
    res.innerHTML = `<span style="color:#f85149">✕ ${esc(e.message || e)}</span>`;
  }
};

function toast(msg, kind) { const d = document.createElement('div'); d.className = 'toast ' + (kind || ''); d.textContent = msg; $('#toasts').appendChild(d); setTimeout(() => d.remove(), 2500); }

$('#min').onclick = () => api.minimize();
$('#close').onclick = () => api.close();
refreshWarn();
