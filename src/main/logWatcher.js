'use strict';
// Tails whatever Minecraft log file the user points us at — Lunar, vanilla, Badlion,
// doesn't matter which — and turns the chat noise into the normalized events below.
// Also copes with the log getting rotated or truncated out from under us mid-read.
//
// What it emits:
//   who(names[])        - /who or accumulated pre-game lobby
//   lobbyJoin(name)     - "X has joined (n/m)!"
//   quit(name)          - "X has quit!"
//   partyJoin(names[])  - joined your party
//   partyList(names[])  - full party list
//   partyInvite(name)   - invited you
//   friendRequest(name) - friend request
//   dmFrom(name), dmTo(name)
//   mention({by,text})  - your name said in chat
//   killedYou(name)     - a final-kill message crediting a player
//   finalKillCount({killer,victim,count}) - a kill line carrying the killer's lifetime final-kill
//                         tally (e.g. "Victim was Killer's #3560 FINAL KILL!") — the only lead we
//                         get on a nicked killer's real identity, see hypixel.findByFinalKills()
//   serverChange()      - sent to a new server / game over
const fs = require('fs');
const { EventEmitter } = require('events');

const NAME = '[A-Za-z0-9_]{1,16}';
const stripColors = (s) => s.replace(/§[0-9a-fk-or]/gi, '').replace(/§[0-9a-fk-or]/gi, '');
const stripRank = (s) => s.trim().replace(/^(?:\[[^\]]+\]\s*)+/, '').replace(/[^A-Za-z0-9_].*$/, '').trim();
// Guild/Party/Officer chat lines put a "Guild > " style channel tag before the
// rank+name, e.g. "Guild > [VIP] Name: text" — strip it before matching the
// sender so mentions in those channels aren't missed (public chat has no tag).
const CHANNEL_PREFIX = /^(?:Guild|Party|Officer|Co-op|Alliance)\s*>\s*/i;

function chatOf(line) {
  const clean = stripColors(line);
  let i = clean.indexOf('[CHAT]');
  if (i >= 0) return clean.slice(i + 6).trim();
  i = clean.indexOf(']: ');
  if (i >= 0) return clean.slice(i + 3).trim();
  return clean.trim();
}
function validName(n) { return /^[A-Za-z0-9_]{1,16}$/.test(n); }

class LogWatcher extends EventEmitter {
  constructor() {
    super();
    this.path = null;
    this.pos = 0;
    this.watcher = null;
    this.timer = null;
    this.buffer = '';
    this.selfNames = [];
  }

  setSelfNames(names) { this.selfNames = (names || []).filter(Boolean).map((n) => n.toLowerCase()); }

  start(logPath) {
    this.stop();
    this.path = logPath;
    if (!logPath || !fs.existsSync(logPath)) { this.emit('status', { ok: false, msg: 'log not found' }); return; }
    try { this.pos = fs.statSync(logPath).size; } catch (_) { this.pos = 0; }
    // Poll (fs.watch is unreliable across clients/OSes). 400ms is plenty and cheap.
    this.timer = setInterval(() => this._poll(), 400);
    this.emit('status', { ok: true, msg: 'watching ' + logPath });
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null; this.buffer = '';
  }

  _poll() {
    let st;
    try { st = fs.statSync(this.path); } catch (_) { return; }
    if (st.size < this.pos) this.pos = 0; // rotated / truncated
    if (st.size === this.pos) return;
    const stream = fs.createReadStream(this.path, { start: this.pos, end: st.size });
    let chunk = '';
    // Minecraft/Lunar write logs in the JVM's platform charset (Latin-1 on Windows), not UTF-8 —
    // decoding as utf8 turns every §-color-code byte into a replacement char and silently breaks
    // all rank/name parsing in colored chat lines (which is most real chat).
    stream.on('data', (d) => { chunk += d.toString('latin1'); });
    stream.on('end', () => {
      this.pos = st.size;
      this.buffer += chunk;
      const lines = this.buffer.split(/\r?\n/);
      this.buffer = lines.pop(); // keep partial last line
      for (const l of lines) this._parse(l);
    });
    stream.on('error', () => {});
  }

  _parse(rawLine) {
    if (!rawLine) return;
    const msg = chatOf(rawLine);
    if (!msg) return;

    // ---- /who or auto-who: "ONLINE: a, b, c" ----
    let m = msg.match(/^ONLINE:\s*(.+)$/);
    if (m) {
      const names = m[1].split(',').map((s) => stripRank(s)).filter(validName);
      if (names.length) this.emit('who', names);
      return;
    }

    // ---- pre-game lobby fill: "Name has joined (1/16)!" ----
    m = msg.match(new RegExp('^(?:\\[[^\\]]+\\]\\s*)*(' + NAME + ') has joined \\(\\d+\\/\\d+\\)!'));
    if (m) { this.emit('lobbyJoin', m[1]); return; }

    // ---- quit: "Name has quit!" ----
    m = msg.match(new RegExp('^(?:\\[[^\\]]+\\]\\s*)*(' + NAME + ') has quit!'));
    if (m) { this.emit('quit', m[1]); return; }

    // ---- party invite: "X has invited you to join their party!" ----
    m = msg.match(new RegExp('(?:\\[[^\\]]+\\]\\s*)*(' + NAME + ') has invited you to join'));
    if (m) { this.emit('partyInvite', m[1]); return; }

    // ---- party join: "X joined the party." / "X has joined the party!" ----
    m = msg.match(new RegExp('(?:\\[[^\\]]+\\]\\s*)*(' + NAME + ') (?:has )?joined the party'));
    if (m) { this.emit('partyJoin', [m[1]]); return; }
    // "You'll be partying with: a, b, c"
    m = msg.match(/You'll be partying with:\s*(.+)$/);
    if (m) { const names = m[1].split(',').map(stripRank).filter(validName); if (names.length) this.emit('partyJoin', names); return; }

    // ---- party list lines: "Party Members: a b c" / "Party Leader: X" / "Party Moderators:" ----
    if (/^Party (Members|Leader|Moderators):/.test(msg)) {
      const names = (msg.split(':')[1] || '').split(/[\s,●]+/).map(stripRank).filter(validName);
      if (names.length) this.emit('partyList', names);
      return;
    }

    // ---- friend request: "X has sent you a friend request!" ----
    m = msg.match(new RegExp('(?:\\[[^\\]]+\\]\\s*)*(' + NAME + ') has sent you a friend request'));
    if (m) { this.emit('friendRequest', m[1]); return; }
    m = msg.match(/Friend request from (?:\[[^\]]+\]\s*)*(\w{1,16})/);
    if (m) { this.emit('friendRequest', m[1]); return; }

    // ---- direct messages: "From [rank] Name: text" / "To Name: text" ----
    m = msg.match(new RegExp('^From (?:\\[[^\\]]+\\]\\s*)*(' + NAME + '):\\s*(.*)$'));
    if (m) { this.emit('dmFrom', m[1], m[2]); return; }
    m = msg.match(new RegExp('^To (?:\\[[^\\]]+\\]\\s*)*(' + NAME + '):\\s*(.*)$'));
    if (m) { this.emit('dmTo', m[1]); return; }

    // ---- final kill crediting a player (best-effort): "... FINAL KILL! ... by Name" not standard;
    //      Hypixel uses "<victim> was killed by <killer>. FINAL KILL!" ----
    m = msg.match(new RegExp('was (?:final killed|killed) by (?:\\[[^\\]]+\\]\\s*)*(' + NAME + ')'));
    if (m && /FINAL KILL|final killed/i.test(msg)) { this.emit('killedYou', m[1]); /* fallthrough for mention */ }

    // ---- kill line carrying the killer's running lifetime final-kill count, e.g.
    //      "Victim was Killer's #3560 FINAL KILL!" — a possessive variant of the line above that
    //      some clients/servers show. This is speculative pending a real sample; the wording here
    //      matches what was described, so tune it once an actual log line is available.
    m = msg.match(new RegExp('^(?:\\[[^\\]]+\\]\\s*)*(' + NAME + ') was (?:\\[[^\\]]+\\]\\s*)*(' + NAME + ')\'s #?(\\d+)(?:st|nd|rd|th)?\\s+FINAL KILL', 'i'));
    if (m) { this.emit('finalKillCount', { victim: m[1], killer: m[2], count: parseInt(m[3], 10) }); }

    // ---- server / game change -> clear ----
    if (/^Sending you to /.test(msg) || /^ +Bed Wars$/i.test(msg) || /^\s*1st Killer/.test(msg) ||
        /You have respawned!/.test(msg) === false && /^You are now in /.test(msg)) {
      this.emit('serverChange');
      // don't return; a game-over line could still mention you
    }

    // ---- your name said in normal chat ("Rank Name: text" / "Rank Name [Guild tag]: text") ----
    if (this.selfNames.length) {
      const body = msg.replace(CHANNEL_PREFIX, '');
      const cm = body.match(new RegExp('^(?:\\[[^\\]]+\\]\\s*)*(' + NAME + ')(?:\\s*\\[[^\\]]+\\])*\\s*:\\s*(.*)$'));
      if (cm) {
        const speaker = cm[1].toLowerCase();
        const text = cm[2].toLowerCase();
        if (!this.selfNames.includes(speaker) && this.selfNames.some((n) => text.includes(n))) {
          this.emit('mention', { by: cm[1], text: cm[2] });
        }
      }
    }
  }
}

module.exports = { LogWatcher, stripRank, chatOf, validName };
