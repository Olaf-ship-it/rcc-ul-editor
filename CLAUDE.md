# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RCC Unit-Leiter Editor — an internal tool for tracking a "Skill/Organisation Transformation" across three phases:

1. **Phase 1 · Status Aufnahme** (`/`) — capture the current-state baseline (Portfolio, Organisation, Skills, Übersicht, Export).
2. **Phase 2 · Backcasting-Planung** (`/backcasting/`) — plan target state (SOLL) per planning year, milestones, guidelines.
3. **Phase 3 · Fortschritt** (`/`, own tab bar) — compare planned SOLL against actually-achieved IST (from yearly closes) and visualize progress.

No frontend build step and no framework: server-rendered `index.html` + plain script tags, vanilla JS in `public/js/*.js`. Backend is a single Express app (`server.js`) plus a few service modules in `server/`.

## Commands

```bash
npm install
npm start        # node server.js, serves on http://localhost:3000
```

There is no lint/build/test tooling configured (`npm test` is a no-op placeholder). Verify changes by running the app and exercising the relevant tab/page in a browser.

### Environment

Requires a Postgres (Neon) database and a JWT secret; the server throws on boot if either is missing.

```bash
cp .env.example .env
# then fill in:
# DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
# JWT_SECRET=<long-random-secret>
```

Deploys to Vercel (`vercel.json` routes everything through `server.js` as a single serverless function).

Optional: `BACKCASTING_ENABLED=false` disables the Phase 2 module server-side (`isBackcastingModuleEnabled`) regardless of user roles.

`data.sqlite*` files at the repo root are stale/unused local artifacts (gitignored, not referenced anywhere in code) — Postgres via `DATABASE_URL` is the only real datastore. Don't treat them as a source of truth.

## Architecture

### Backend: one monolith + focused services

`server.js` (~6000 lines) owns Express setup, auth, all `/api/*` routes, and Postgres schema bootstrap (`ensure*Schema()` functions run at startup via `initDb()`, each `CREATE TABLE IF NOT EXISTS`-ing and lazily migrating its own table — there is no separate migrations folder). Business logic that's substantial or reused is pulled into `server/`:

- `server/dashboard-service.js` — Phase 3 progress calculations (`resolveIstForYear`, `buildDashboardSnapshot*`, `buildDashboardTimeline*`). This is where "the numbers don't match" bugs get fixed, not in `server.js`.
- `server/year-snapshot-service.js` — yearly IST close (`year_snapshots` table): draft/close workflow, baseline lock/unlock, prefill from prior year.
- `server/guidelines-service.js` — Phase 2 Leitplanken (guardrails/constraints) storage.
- `server/entity-ids.js` — stable entity IDs for Organisation/Skill rows across edits, and the "skill registry" dedup/lookup used to link a Mitarbeiter user to their Phase‑1 skill entry.
- `server/demo-data.js` — synthetic demo units/data for trying out the app without touching real units.
- `server/presence-service.js` — "who's online" heartbeat tracking.

**Data model / phase relationship** (see `docs/jahresabschluss-konzept.md` for the full picture):

| Layer | Table | Meaning |
|---|---|---|
| Phase 1 | `entries` | One-time starting baseline; locked (`baseline_locked`) after kickoff, admin-editable only after that |
| Phase 2 | `backcasting_plans` | Target/SOLL per planning year (milestones keyed by `p1Year`) |
| Jahresabschluss | `year_snapshots` | Achieved/IST per closed year, per unit, status `draft`/`closed` |
| Phase 3 | dashboard APIs | Compares SOLL[year] against IST from the closed year snapshot |

### Auth & roles

Cookie-based JWT session (`rc_ul_token`, httpOnly). `auth` middleware (server.js) verifies the cookie; `requireAdmin`/`requireSuperAdmin` gate admin routes. Users can hold multiple roles (`ROLE_PRIORITY` array in server.js: `super_admin > admin > unit_lead > mitarbeiter > regionalleiter > geschaeftsfuehrung > backcasting > fortschritt`). `backcasting` and `fortschritt` are **module-access roles**, not org-hierarchy roles — they gate access to Phase 2/Phase 3 UI independent of org position. A plain `mitarbeiter` with no elevated role (`isPureMitarbeiterRole`) only sees/edits their own skill entry, matched via `skillEntryId` on the user row. Unit access is enforced server-side per request via `canAccessUnit`/`canAccessEntry` — never trust the client for unit scoping.

For the full role × phase permission matrix, `public/js/roles-permissions-doc.js` is a static doc rendered in Admin → "Rollen & Berechtigungen" that explicitly mirrors the access logic in `server.js`/`app.js` — check it before re-deriving permission rules from scratch, but verify against `server.js` if it's been a while since either was touched (it's hand-maintained, not generated).

### Frontend: two separate vanilla-JS apps sharing the auth cookie

- **Main app** (`public/index.html` + `public/js/app.js`, ~7900 lines): Phase 1 tabs (Portfolio/Organisation/Skills/Übersicht/Export) and Phase 3 (Fortschritt), plus Admin. Single-page, tab-switched (`switchTab`), no router/bundler — it's one big script split into per-register sections. `public/js/fortschritt-new.js` and `fortschritt-dashboard.js` hold Phase 3 logic split out from `app.js` (`initFortschrittNew`, `initGesamtfortschrittNew`, `renderFortschrittErlaeuterungPage`).
- **Backcasting app** (`public/backcasting/`, its own `index.html`/`styles.css`): Phase 2, structured as tabbed registers (① Planung `planning-new.js` ~3100 lines, ② Review in `app.js`, ③ Leitplanken `guidelines.js`, ④ Export in `app.js`, ⑤ Jahresabschluss `year-close.js`). `shell.js` handles its own session bootstrap/redirect independent of the main app's session code — it just relies on the same cookie via `/api/auth/me`.
- Reference/catalog data (skill catalogs, org roles, harmonization mapping between Phase 1 and Phase 2 fields) lives in standalone data files under `public/js/` (e.g. `skill-ref-data.js`, `organisation-ref-data.js`, `harmonization-data.js`) and is loaded as plain `<script>` tags.
- `index.html` loads `/vendor/xlsx/xlsx.full.min.js` for Excel import/export, but there is no `public/vendor/` directory on disk — `server.js` maps that path to `node_modules/xlsx/dist` via `app.use("/vendor/xlsx", express.static(...))`. If Excel import/export ever 404s, check that route/the `xlsx` dependency, not the filesystem.

No bundler and no build step: every script is a manual `<script src="...">` tag in `index.html`/`backcasting/index.html`, several with a `?v=YYYYMMDDx` cache-busting query string. When you edit one of those files for a change that needs to show up past any CDN/browser cache in the deployed app, bump its `?v=` suffix in the corresponding HTML file — there's no automatic hashing.

### Token-efficient file selection

**`docs/phasen-dateien.md` is a maintained map of exactly which files to open for a given change** (by phase/register, with line ranges in the large files). Consult it before grepping through `server.js`/`app.js` blind — both are large multi-feature files where only a small section is usually relevant, and the doc explicitly calls out what *not* to attach (e.g. full `server.js`, full `app.js`, both Fortschritt files at once). If you touch a register whose line ranges shift meaningfully, consider updating that doc.
