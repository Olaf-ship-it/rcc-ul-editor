# Phasen-Datei-Übersicht (Token-sparend)

Kompakte Referenz: Welche Dateien du bei Änderungen an **Phase 1**, **Phase 2** oder **Phase 3** angeben solltest — statt ganzer Ordner oder Monolithen.

**Grundprinzip:** Nur die Datei des konkreten Registers/Features anhängen. Nicht `server.js` oder `app.js` komplett, wenn es geht.

---

## Die drei Phasen

| Phase | Name | URL / Ort |
|-------|------|-----------|
| **1** | Status Aufnahme | `/` — Tabs Portfolio, Organisation, Skills, Übersicht, Export |
| **2** | Backcasting-Planung | `/backcasting/` — eigene Mini-App |
| **3** | Fortschritt | wieder `/` — eigene Tab-Leiste |

---

## Phase 1 · Status Aufnahme

### Basis (fast immer)

| Datei | Zeilen | Wann |
|-------|--------|------|
| `public/js/app.js` | ~7.900 | Logik — **nur den relevanten Abschnitt** (siehe unten) |
| `public/index.html` | 113–732 | Markup der 5 Register |
| `public/styles.css` | ~930 | Layout/Styling |

### Register-spezifisch in `app.js`

| Register | ca. Zeilen in `app.js` | Zusätzlich |
|----------|------------------------|------------|
| Portfolio | 3187–3505 | — |
| Organisation | 3506–4111 | `public/js/organisation-ref-data.js` |
| Skills | 4112–4987 | `skill-ref-data.js`, `soft-skill-ref-data.js`, ggf. `skill-matrix-examples-data.js` |
| Übersicht | 4988–5101 | — |
| Export | 5102+ | — |

### Backend (nur bei API/Speicherlogik)

| Datei | Wann |
|-------|------|
| `server.js` **nur** Zeilen **3046–3370** (`/api/entries`) | CRUD Phase-1-Daten |
| `server/entity-ids.js` | stabile IDs für Organisation/Skills |

### Session/Navigation (nur bei Tab-Wechsel, Login, Unit-Filter)

- `public/js/app.js` Zeilen **1675–1723**, **3124+** (`switchTab`)
- `public/js/app.js` — `loadBaselineStatus`, `applyPhase1BaselineUI` (Baseline-Sperre)
- `public/js/view-unit-persist.js` (~100 Zeilen)

---

## Phase 2 · Backcasting-Planung

Eigene App unter `public/backcasting/` — **nicht** die große Phase-1-`app.js` anhängen.

### Basis

| Datei | Zeilen | Wann |
|-------|--------|------|
| `public/backcasting/index.html` | ~320 | Markup aller Register |
| `public/backcasting/js/app.js` | ~670 | Shell, Review/Export, Tab-Routing |
| `public/backcasting/styles.css` | ~980 | Styling |
| `public/backcasting/shell.js` | ~125 | Auth, Phasen-Navigation |

### Register-spezifisch

| Register | Primäre Datei | Abschnitt |
|----------|---------------|-----------|
| ① Planung | `backcasting/js/planning-new.js` | ~3.100 Zeilen — oft reicht diese Datei allein |
| ② Review | `backcasting/js/app.js` | Review-Block |
| ③ Leitplanken | `backcasting/js/guidelines.js` | ~560 Zeilen |
| ④ Export | `backcasting/js/app.js` | Export-Block |
| ⑤ Jahresabschluss | `backcasting/js/year-close.js` | Erfassung IST je Planjahr |

### Backend

| Datei | Wann |
|-------|------|
| `server/year-snapshot-service.js` | Jahres-IST-Snapshots, Baseline-Lock |
| `server.js` Zeilen **~4170–4320** | `/api/year-snapshots`, `/api/units/.../baseline` |
| `server/guidelines-service.js` | Leitplanken |
| `server.js` Zeilen **3850–3905** | `/api/guidelines` |
| `server.js` Zeilen **4052–4100** | `/api/backcasting/plan` |

### Geteilt mit Phase 1/3 (nur bei Feldabgleich)

- `public/js/harmonization-data.js` — IST (P1) ↔ SOLL (P2)
- `public/js/skill-ref-data.js`, `organisation-ref-data.js` — wenn Planung auf Kataloge referenziert

---

## Phase 3 · Fortschritt

Logik ist ausgelagert — gut für Tokens. `app.js` nur für Navigation/Session.

### Basis

| Datei | Zeilen | Wann |
|-------|--------|------|
| `public/index.html` | 628–715 | Markup der Fortschritt-Register |
| `public/styles.css` | relevante Abschnitte | Styling |

### Register-spezifisch

| Register | Primäre Datei | Einstieg |
|----------|---------------|----------|
| Fortschritt | `public/js/fortschritt-new.js` | `initFortschrittNew()` (~Zeile 1951) |
| Gesamtfortschritt | `public/js/fortschritt-new.js` | `initGesamtfortschrittNew()` (~Zeile 2006) |
| Erläuterung Berechnung | `public/js/fortschritt-dashboard.js` | `renderFortschrittErlaeuterungPage()` (~444) |

**Hinweis:** `fortschritt-new.js` (~2.000 Z.) und `fortschritt-dashboard.js` (~2.400 Z.) getrennt halten — nicht beide, wenn nur ein Register betroffen ist.

### Backend (Berechnungslogik)

| Datei | Wann |
|-------|------|
| `server/dashboard-service.js` | Kern — `resolveIstForYear`, IST/SOLL je Jahresabschluss |
| `server/year-snapshot-service.js` | Snapshot-Daten für Fortschritt |
| `server.js` Zeilen **3373–3590** | `/api/dashboard/*` |
| `public/js/harmonization-data.js` | Feldzuordnung P1↔P2 in der UI |

### Navigation (nur bei Tab-Umschaltung)

- `public/js/app.js` Zeilen **1675–1723** (`PHASE3_TAB_PAGES`, `runAppPageSideEffects`)

---

## Querschnitt — nur bei Bedarf

| Thema | Dateien |
|-------|---------|
| Admin (User, Demo, Leitplanken global) | `index.html` ab Zeile 733, `app.js` ab ~5336 |
| Berechtigungen Phase 2/3 | `roles-permissions-doc.js`, `server.js` Auth/Module |
| Planjahre 2026–2029 | `server.js` ~2914–2947, Admin-Settings in `app.js` |
| Demo-Daten | `server/demo-data.js` |
| Online-Anwesenheit | `presence.js`, `server/presence-service.js` |

---

## Nicht anhängen

| Datei | Grund |
|-------|-------|
| `server.js` komplett (~5.900 Z.) | Monolith — nur Route-Abschnitte oder `dashboard-service.js` |
| `public/js/app.js` komplett (~7.900 Z.) | Enthält P1 + Admin + Nav — Register-Abschnitt reicht |
| `public/index.html` komplett (~1.400 Z.) | Nur den `page-*`-Block des Registers |
| `vendor/xlsx/` | Nur bei Excel-Import/Export |
| Beide Fortschritt-JS-Dateien | Nur die für das betroffene Register (NEW vs. alt) |

---

## Beispiel-Prompts

**Portfolio-Ampel ändern:**

```
@public/js/app.js Zeilen 3187–3505, @public/index.html Zeilen 113–396 — Portfolio-Ampellogik anpassen
```

**Planung Meilenstein:**

```
@public/backcasting/js/planning-new.js, @public/backcasting/index.html #page-planung
```

**Gesamtfortschritt Berechnung:**

```
@server/dashboard-service.js, @public/js/fortschritt-new.js — KPI X stimmt nicht
```

**Nur CSS Phase 2:**

```
@public/backcasting/styles.css — Review-Tabelle
```

---

## Faustregeln

1. **Ein Register = 1–2 Frontend-Dateien + ggf. 1 Server-Datei**
2. **Phase 2** immer im Ordner `public/backcasting/` denken
3. **Phase 3 Berechnung** → `server/dashboard-service.js`, nicht `server.js` ganz
4. Im Prompt **Register-Namen** nennen (z. B. „Planung“, „Gesamtfortschritt“)
