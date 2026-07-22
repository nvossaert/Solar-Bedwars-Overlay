# Solar Overlay

A custom, lightweight Hypixel **Bedwars** overlay — Cubelify-style, but yours. Zero runtime
dependencies (just Electron), live Hypixel stats, a self-hosted **sniper/threat score**,
**Urchin blacklist** integration, screen-capture hiding, and a full settings + admin UI.

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
> keys. It never gets committed. You can also just paste keys in-app under **Settings → API Keys**
> (those save to Electron's `userData`, also outside the repo). The committed code contains **no keys**.

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
   Players are auto-added when you `/who`, join a party, get invites/DMs, etc.
3. **API Keys → Hypixel key.** Your personal key is pre-filled. Hit **Test** to confirm it.
   (Personal keys allow 300 req / 5 min — the app rate-limits itself to stay under that. When your
   **app key** is approved, just paste it here and the limit lifts automatically once you raise the
   cap in code, see `hypixel.setRateLimit`.)
4. **API Keys → Urchin.** Your custom endpoint is pre-filled with `{id} {uuid} {name} {sources}`
   placeholders. Add your **Admin key** only if you want to submit tags from the Blacklist tab.

---

## Features

### Stats columns
`Tag · Lvl(★) · Player · FKDR · WLR · F.Kills · Wins · WS · M.FKDR · Sniper · Last Login · BL`

- **Click a header** to sort. **Drag headers** to reorder. **Right-click a header** to toggle columns.
- Everything is also configurable in **Settings → Columns**.
- Hover any row for a full breakdown tooltip (finals, games, network level, monthly finals tracked, all tags).

### Monthly FKDR
Hypixel has no native monthly stat, so the app stores one **snapshot per player per day** and computes
the delta over the last ~30 days. It shows `—` until enough history accrues (a day or two of seeing a player).

### Sniper / Threat score (your own evaluation)
A transparent 0–100 blend of FKDR, star, WLR, win streak, **recent-sweat trend** (monthly vs lifetime
FKDR — a smurf/sniper signal), **account plausibility** (high star + low network level = likely alt),
**recent login**, and **blacklist tags**. Labels: `CHILL → DECENT → SWEAT → TRYHARD → DANGER → SNIPER`.
Every weight is a slider in **Settings → Sniper Score**.

### Urchin blacklist + custom imported CSV
- Live lookups hit your fully-configurable Urchin endpoint and render tags as colored chips.
- Your uploaded CSVs (`legit_sniper`/`caution`/`account`/`info` tags) are bundled at
  `data/blacklist.json` — **9,014 UUIDs / 9,349 tags** — and merged into every lookup, tagged `[local-import]`.
- Right-click a player → add a personal local `info` tag, or flag them to your watchlist.

### Blacklist Admin (⚑) — you have add-tag perms
Look up a player, then submit a tag (`cheater / sniper / caution / info / toxic / custom`) with a reason,
`hide_username`, and `overwrite` options. Posts to `{{adminBase}}/admin/add-tag`. Needs your admin key.

### Auto-triggers (Settings → Triggers)
Auto-flag players to your local watchlist when they: **say your name in chat**, **join your party**,
**invite you**, **DM you**, **friend-request you**, or **final-kill you**. Each is an independent toggle.

### Hide from screen capture
`Settings → Appearance → Hide from screen capture` uses Electron's `setContentProtection`
(→ `WDA_EXCLUDEFROMCAPTURE` on Windows), so the overlay is invisible to OBS, Discord screen-share,
and screenshots while still visible to you. On by default.

### Appearance
Six built-in themes plus full custom colors, window opacity, font size, row height, always-on-top,
and click-through.

---

## Project layout

```
solar-overlay/
├─ package.json
├─ data/blacklist.json         # your CSV, imported & keyed by UUID
├─ assets/icon.png
├─ test/stats.test.js          # pure stat-math tests (npm test)
└─ src/
   ├─ main/
   │  ├─ main.js               # windows, capture-hiding, IPC, triggers, tray, shortcuts
   │  ├─ config.js             # all settings + defaults (persisted to userData/config.json)
   │  ├─ hypixel.js            # Hypixel + Mojang, cache, rate-limit, daily snapshots
   │  ├─ stats.js              # star/FKDR/WLR/monthly + sniper score (pure, tested)
   │  ├─ urchin.js             # Urchin endpoint + local blacklist merge + admin add-tag
   │  ├─ logWatcher.js         # tails the client log, parses chat events
   │  ├─ roster.js             # combines everything into the live player list
   │  └─ preload.js            # secure IPC bridge
   └─ renderer/
      ├─ overlay/              # the overlay window
      ├─ settings/             # tabbed settings
      └─ blacklist/            # admin add-tag UI
```

## Push to GitHub

Secrets are already scrubbed (`secrets.js` is gitignored), so it's safe to push.

```bash
cd solar-overlay
git init
git add .
git commit -m "Initial commit: Solar Bedwars Overlay"
git branch -M main
git remote add origin https://github.com/nvossaert/Solar-Bedwars-Overlay.git
git push -u origin main
```

If GitHub rejects the push because the repo already has a commit (e.g. an auto-created README),
either pull first:

```bash
git pull origin main --rebase --allow-unrelated-histories
git push -u origin main
```

…or, if the remote is empty except for that auto file and you don't need it, overwrite it:

```bash
git push -u origin main --force
```

Before pushing, sanity-check that no key is staged:

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
