# Solar Overlay

A lightweight Hypixel **Bedwars** overlay — Cubelify-style, but fully self-hosted and configurable.
Zero runtime dependencies (just Electron), live Hypixel stats, a self-hosted **sniper/threat score**,
**Urchin blacklist** integration with support for your own extra data sources, screen-capture hiding,
and a full settings + admin UI. Every column can be added, removed, reordered, and re-sourced —
nothing about the layout is fixed.

---

## Quick start

```bash
cd solar-overlay
cp src/main/secrets.example.js src/main/secrets.js   # then paste your keys into it
npm install        # installs Electron only
npm start          # launches the overlay
npm test           # runs the stat-math unit tests
```

> **Keys / secrets.** `src/main/secrets.js` is **gitignored** and holds your Hypixel + Urchin
> keys. It never gets committed. You can skip this file entirely and just paste keys in-app under
> **Settings → API Keys** (those save to Electron's `userData`, also outside the repo). The
> overlay works before you set any keys at all — the bundled blacklist and log-based player
> detection don't need one; a Hypixel key just unlocks live stats.

On first launch the overlay appears top-left. Drag it by the title bar. It also lives in your
system tray.

**Global shortcuts**

| Key | Action |
|-----|--------|
| `Alt+B` | Show / hide the overlay |
| `Alt+X` | Toggle click-through (mouse passes to the game) |
| `Alt+C` | Clear the player list |
| `Alt+S` | Open settings |

---

## First-time setup (Settings — `Alt+S` or the ⚙ button)

1. **General → Your IGN.** Set your username so the overlay knows who "you" are (mentions, hide-self).
2. **Log & Detection → Log file path.** Point it at your client log and click *Browse…*.
   Default guesses cover Lunar (`.lunarclient/profiles/<version>/logs/latest.log`, 1.8 first), vanilla, and Badlion.
   Players are auto-added when you `/who`, join a party, get invites/DMs, get mentioned in chat,
   or final-kill/get final-killed — all of that is on by default, nothing to flip on manually.
3. **API Keys → Hypixel key.** Paste your key and hit **Test** to confirm it.
   (Personal keys allow 300 req / 5 min — the app rate-limits itself to stay under that. If you
   have an approved app key, paste it here; raise the cap in code via `hypixel.setRateLimit`.)
4. **Connections → Urchin.** On by default. Its endpoint/key/sources live under **API Keys → Urchin**;
   toggle it off in Connections if you'd rather run only your own data sources.

---

## Features

### Stats columns
`Tag · Lvl(★) · Player · FKDR · WLR · F.Kills · Wins · WS · M.FKDR · Sniper · Last Login · BL` by default —
but every one of these, Player included, can be removed and added back in **Settings → Columns**.
Nothing is pinned.

- **Click a header** to sort. **Drag headers** to reorder. **Right-click a header** to toggle columns.
- Hover any row for a full breakdown tooltip (finals, games, network level, monthly finals tracked, all tags).

### Custom & catalog columns
Beyond the defaults, **Settings → Columns** lets you:
- **Add any stat as a column** by dot-path into the raw Hypixel player object (e.g.
  `stats.Bedwars.beds_broken_bedwars`), with your own label.
- **Flip on a curated catalog** of extra stats grouped by gamemode (Bedwars, Skywars, Duels,
  Murder Mystery, general account info) without needing to know the raw API field names — all off
  by default, one toggle each.
- **Map any column to a Connection** instead of its normal source, under "Column data sources" —
  point `Tag`/`BL` at a specific connection's tags only, or pull a stat like `M.FKDR` straight from
  your own tracker's response instead of Hypixel's.

### Monthly FKDR
Hypixel has no native monthly stat, so the app stores one **snapshot per player per day** and computes
the delta over the last ~30 days. It shows `—` until enough history accrues (a day or two of seeing a player).

### Sniper / Threat score (your own evaluation)
A transparent 0–100 blend of FKDR, star, WLR, win streak, **recent-sweat trend** (monthly vs lifetime
FKDR), **account plausibility** (high star + low network level = likely alt), a **fresh-account
signal** (an account that's already good despite joining recently — the classic smurf tell),
**recent login**, and **blacklist tags**. FKDR, blacklist tags, and the account-plausibility signals
carry the most weight by default, since those are the strongest "real threat" indicators.
Labels: `CHILL → DECENT → SWEAT → TRYHARD → DANGER → SNIPER`. Every weight is a slider in
**Settings → Sniper Score**.

### Row highlight
Flags an entire row once a chosen stat clears a threshold — FKDR ≥ 8 by default, but any column
(built-in, custom, or catalog) can be picked instead, in **Settings → Appearance**.

### Urchin blacklist + bundled local import
- Live lookups hit your fully-configurable Urchin endpoint and render tags as colored chips.
- A bundled local blacklist import (`legit_sniper`/`caution`/`account`/`info` tags) ships at
  `data/blacklist.json` — **9,014 UUIDs / 9,349 tags** — and merges into every lookup, tagged `[local-import]`.
- Right-click a player → add a personal local `info` tag, or flag them to your watchlist.

### Connections (Settings → Connections)
Every tag/blacklist source in one place. Urchin ships built-in and on by default, but is just a
toggle away from being turned off. Add your own endpoints with the same
`{id} {uuid} {name} {key} {sources}` placeholder scheme, then map any of them onto a column under
**Settings → Columns → Column data sources**.

### Blacklist Admin (⚑) — for accounts with add-tag perms
Look up a player, then submit a tag (`cheater / sniper / caution / info / toxic / custom`) with a reason,
`hide_username`, and `overwrite` options. Posts to `{{adminBase}}/admin/add-tag`. Needs an admin key.

### Auto-triggers (Settings → Triggers)
Auto-flag players to your local watchlist when they: **say your name in chat**, **join your party**,
**invite you**, **DM you**, **friend-request you**, or **final-kill you**. All six are **on by
default** — the overlay is meant to work out of the box — but each is an independent toggle if you
want it quieter.

### Hide from screen capture
`Settings → Appearance → Hide from screen capture` uses Electron's `setContentProtection`
(→ `WDA_EXCLUDEFROMCAPTURE` on Windows), so the overlay is invisible to OBS, Discord screen-share,
and screenshots while still visible to you. On by default.

### Appearance
Six built-in themes plus full custom colors, window opacity, font size, row height, always-on-top,
click-through, and the row highlight settings above.

---

## Project layout

```
solar-overlay/
├─ package.json
├─ data/blacklist.json         # bundled local blacklist import, keyed by UUID
├─ assets/icon.png
├─ test/stats.test.js          # pure stat-math tests (npm test)
└─ src/
   ├─ main/
   │  ├─ main.js               # windows, capture-hiding, IPC, triggers, tray, shortcuts
   │  ├─ config.js             # all settings + defaults (persisted to userData/config.json)
   │  ├─ hypixel.js            # Hypixel + Mojang, cache, rate-limit, daily snapshots
   │  ├─ stats.js              # star/FKDR/WLR/monthly + sniper score (pure, tested)
   │  ├─ urchin.js             # Urchin + Connections + local blacklist merge + admin add-tag
   │  ├─ logWatcher.js         # tails the client log, parses chat events
   │  ├─ roster.js             # combines everything into the live player list
   │  └─ preload.js            # secure IPC bridge
   └─ renderer/
      ├─ overlay/              # the overlay window
      ├─ settings/             # tabbed settings
      └─ blacklist/            # admin add-tag UI
```

## Contributing / pushing changes

Before committing or pushing, sanity-check that no key is staged:

```bash
git ls-files | grep -i secret                          # should show ONLY secrets.example.js
git grep -nE "key=[0-9a-fA-F]{8}-" $(git rev-parse HEAD) || echo "no embedded keys — good"
```

## Notes
- Keys are stored locally in Electron's `userData/config.json`. Change them anytime in Settings.
- Double-check the Urchin tag shape on your own machine — the parser is defensive and follows the
  documented `{ score:{value,mode}, tags:[…] }` format, but if your instance returns extra fields
  you want shown, they're easy to surface in `urchin.js → _parseTag`.
- To package a Windows `.exe` later: add `electron-builder`, a `build` block, and run `electron-builder`.
- Log formats vary by client. If detection misses something, paste a sample line and the regexes in
  `logWatcher.js` are straightforward to extend.
