'use strict';
const api = window.solarBridge;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let cfg = null;
function norm(u) { return String(u || '').replace(/[^0-9a-fA-F]/g, '').toLowerCase(); }

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
    html += `<div class="tagline"><span class="tagchip" style="background:${t.color || '#58a6ff'}">${esc(t.type)}</span>
      <span>${esc(t.reason || '')} <span class="dim">[${esc(t.source || '')}]</span></span></div>`;
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
