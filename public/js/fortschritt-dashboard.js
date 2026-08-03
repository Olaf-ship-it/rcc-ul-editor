/**
 * Management-Dashboard: IST (Phase 1) vs. SOLL (Backcasting)
 */

let demoDatenInitDone = false;
let fortschrittTipDocBound = false;
let demoLoadPanelState = null;

async function afterDemoDataChanged(options) {
  const opts =
    typeof options === "string"
      ? { filterMode: "unit", unit: options }
      : options && typeof options === "object"
        ? options
        : {};
  const filterMode = opts.filterMode || (opts.unit ? "unit" : null);
  const unit = String(opts.unit || "").trim();

  await refreshEntries();
  await refreshFortschrittDemoStatus();

  if (filterMode === "all") {
    focusFilterAfterDemoLoad("all");
  } else if (filterMode === "unit" && unit) {
    focusFilterAfterDemoLoad(unit);
  } else {
    refreshPhase1ViewsAfterDataChange();
  }

  if (opts.showFortschritt === true) {
    const fortschrittUnit =
      filterMode === "unit" ? unit : resolveDemoFortschrittUnitFromPanel();
    await openFortschrittAfterDemoLoad(fortschrittUnit);
  } else if (document.getElementById("page-gesamtfortschritt")?.classList.contains("active")) {
    if (typeof initGesamtfortschrittNew === "function") initGesamtfortschrittNew();
  } else if (document.getElementById("page-fortschritt")?.classList.contains("active")) {
    if (typeof initFortschrittNew === "function") initFortschrittNew();
  }
}

function resolveDemoFortschrittUnitFromPanel() {
  if (demoLoadPanelState?.units?.length) {
    const done = demoLoadPanelState.units.find((row) => row.status === "done");
    if (done?.unit) return done.unit;
  }
  return STANDARD_DEMO_UNITS[0] || "";
}

async function openFortschrittAfterDemoLoad(unit) {
  if (typeof isMitarbeiter !== "undefined" && isMitarbeiter) return;
  if (typeof userModules !== "undefined" && !userModules?.fortschritt && typeof isAdmin !== "undefined" && !isAdmin) {
    return;
  }
  const targetUnit = String(unit || resolveDemoFortschrittUnitFromPanel() || "").trim();
  if (!targetUnit) return;
  focusFilterAfterDemoLoad(targetUnit);
  if (typeof switchTab === "function") {
    switchTab("fortschritt");
  }
  if (typeof initFortschrittNew === "function") initFortschrittNew();
}

function ftEscAttr(s) {
  if (typeof escAttr === "function") return escAttr(s);
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function fortschrittSectionHeader(title, ariaLabel, bodyHtml) {
  return `<div class="ft-tip-title-row ft-has-tip" tabindex="0" role="button" aria-expanded="false" aria-label="${ftEscAttr(ariaLabel)}">
    <span class="ft-stat-tip-icon" aria-hidden="true">i</span>
    <h3 style="margin:0">${typeof esc === "function" ? esc(title) : title}</h3>
    <div class="ft-stat-tooltip ft-stat-tooltip--title" role="dialog" aria-label="${ftEscAttr(ariaLabel)}">
      <button type="button" class="ft-stat-tip-close" aria-label="Schließen">×</button>
      ${bodyHtml}
    </div>
  </div>`;
}

const FORTSCHRITT_TIPS = {
  kontext: `<strong>Kontext & Datenstand</strong>
    <p>Zeigt die Rahmendaten für den aktuellen Vergleich.</p>
    <ul>
      <li><b>Unit</b> – im Filter gewählte Organisationseinheit (kein Sammel-„Alle Units“)</li>
      <li><b>Jahr</b> – Planjahr; filtert Meilensteine und Soll-KPIs</li>
      <li><b>Stichtag</b> – Erfassungsdatum aus Phase&nbsp;1 Organisation</li>
      <li><b>Plan</b> – Bereichsname aus Backcasting-Metadaten</li>
      <li><b>Meilensteine</b> – Anzahl Plan-Meilensteine für dieses Jahr</li>
    </ul>`,
  kennzahlen: `<strong>IST vs. SOLL – Kennzahlen</strong>
    <p>Kacheln vergleichen harmonisierte Kennzahlen aus Phase&nbsp;1 (IST) mit aggregierten Zielwerten aus Plan-Meilensteinen (SOLL).</p>
    <ul>
      <li><b>Umsatz (TEUR)</b> – Summe Portfolio-<em>jahresumsatz_teur</em> vs. Summe <em>ziel_umsatz_teur</em></li>
      <li><b>Headcount</b> – Summe Gliederungs-Headcounts vs. höchstes <em>ziel_headcount</em></li>
      <li><b>Zertifizierungsquote</b> – Anteil „ja“ in der Skill-Matrix vs. <em>ziel_anteil_prozent</em></li>
    </ul>
    <p>Status: <em>auf Plan</em> (Abweichung ≥ −5&nbsp;%), <em>leicht hinter Plan</em> (−5 bis −15&nbsp;%), <em>kritisch</em> (&lt; −15&nbsp;% bzw. bei Zertifizierung unter Ziel).</p>`,
  portfolio: `<strong>Portfolio-Umsatzmix (IST)</strong>
    <p>Visualisiert die Umsatzverteilung aus Phase&nbsp;1 Portfolio-Einträgen.</p>
    <p>Jede Position liefert <em>jahresumsatz_teur</em> und eine Kategorie (Produkte, Services, Lösungen, …). Der Balken zeigt den prozentualen Anteil am Gesamtumsatz; die Legende listet TEUR-Werte und Prozentanteile.</p>`,
  orgSkills: `<strong>Organisation & Skills (IST)</strong>
    <p>Aktuelle Erfassungswerte aus Phase&nbsp;1 – ohne Soll-Vergleich in dieser Kachel.</p>
    <ul>
      <li><b>Headcount</b> – Summe der Headcounts in technologischen Gliederungen (Klammer: Plan-Zielheadcount, falls vorhanden)</li>
      <li><b>Mitarbeiter Skill-Matrix</b> – Anzahl erfasster Mitarbeitenden mit Skills</li>
      <li><b>Zertifizierungsquote</b> – Anteil Mitarbeitender mit <em>zertifiziert = ja</em></li>
    </ul>`,
  skillGaps: `<strong>Skill-Lücken (IST vs. Plan)</strong>
    <p>Vergleicht durchschnittliche Skill-Level aus der Phase&nbsp;1-Matrix mit Mindestanforderungen aus Plan-Meilensteinen (<em>ziel_skill_kategorie</em>, <em>ziel_skill_level_min</em>).</p>
    <p><b>Gap</b> = Ø Level IST − Mindest-Level SOLL. Status: <em>auf Plan</em> (Gap ≥ 0), <em>leicht hinter Plan</em> (−0,5 bis 0), <em>kritisch</em> (&lt; −0,5).</p>`,
  meilensteine: `<strong>Plan-Meilensteine</strong>
    <p>Meilensteine aus dem Backcasting-Plan für das gewählte Jahr (Workstream × Jahr).</p>
    <p>Tags zeigen strukturierte Zielwerte (<em>ziel_umsatz_teur</em>, <em>ziel_headcount</em>). Der Text ist ein Auszug aus Ergebnis/KPIs des Meilensteins – maximal acht Einträge.</p>`,
};

function ftPlanningYears() {
  return window._rcPlanningYears || [2026, 2027, 2028, 2029];
}

function ftZeitstrahlTip(years, mode) {
  const y0 = years[0];
  const yN = years[years.length - 1];
  const yr = y0 + "\u2013" + yN;
  if (mode === "p1") {
    return `<strong>Zeitstrahl ${yr} \u00b7 Planung NEW</strong>
      <p>Zeigt den Planverlauf der drei Kern-KPIs \u00fcber die Jahre ${y0} bis ${yN} auf Basis der Planung NEW.</p>
      <ul>
        <li><b>SOLL (durchgezogene Linie)</b> \u2013 j\u00e4hrliche Zielwerte aus <em>p1Year</em>-Meilensteinen (Portfolio, Organisation, Skills)</li>
        <li><b>IST (gestrichelte Linie)</b> \u2013 projizierter Verlauf vom Ist-Stand ${y0} linear zum Soll-Ziel ${yN}</li>
        <li>Bei <b>Alle Units</b> werden alle Standard-Units farblich \u00fcberlagert; die Legende zeigt Linienart und Unit-Farben getrennt</li>
      </ul>
      <p>Meilensteine stammen aus dem Register <em>Planung NEW</em> (Backcasting Phase&nbsp;2), nicht aus der klassischen Workstream-Planung.</p>`;
  }
  return `<strong>Zeitstrahl ${yr}</strong>
    <p>Zeigt den Planverlauf aller drei Kern-KPIs \u00fcber die Jahre ${y0} bis ${yN}.</p>
    <ul>
      <li><b>SOLL (durchgezogene Linie)</b> \u2013 j\u00e4hrliche Zielwerte aus Backcasting-Meilensteinen</li>
      <li><b>IST (gestrichelte Linie)</b> \u2013 projizierter Verlauf vom Ist-Stand ${y0} linear zum Soll-Ziel ${yN}</li>
      <li>Bei <b>Alle Units</b> werden alle Standard-Units farblich \u00fcberlagert; die Legende zeigt Linienart und Unit-Farben getrennt</li>
    </ul>
    <p>Ausf\u00fchrliche Feldzuordnung Phase&nbsp;1 \u2194 Backcasting: Register <em>Erl\u00e4uterung Berechnung</em>.</p>`;
}

const FORTSCHRITT_FIELD_MAPPINGS = [
  {
    kpi: "Umsatz (TEUR)",
    views: ["Gesamtfortschritt", "Fortschritt"],
    phase1: {
      area: "Portfolio · Status",
      fields: ["jahresumsatz_teur"],
      agg: "Summe über alle Portfolio-Positionen der Unit",
    },
    phase2: {
      area: "Meilenstein · Planung",
      fields: ["ziel_umsatz_teur"],
      agg: "Summe aller Meilensteine (kind = wsYear) für das Jahr",
    },
    calc: "IST = Jahresabschluss Ende Jahr (oder Start-IST am Planungsstartjahr im Zeitstrahl); kein linearer Verlauf mehr",
    example: {
      phase1Items: [
        { label: "AMS Copilot (Produkte)", field: "jahresumsatz_teur", value: "120" },
        { label: "Managed Ops (Services)", field: "jahresumsatz_teur", value: "80" },
      ],
      phase1Calc: "120 + 80",
      phase1Result: "200 TEUR",
      phase2Items: [
        { label: "Meilenstein WS A · 2027", field: "ziel_umsatz_teur", value: "130" },
        { label: "Meilenstein WS B · 2027", field: "ziel_umsatz_teur", value: "90" },
      ],
      phase2Calc: "130 + 90",
      phase2Result: "220 TEUR",
      steps: [
        "<b>Detail:</b> Δ = SOLL − IST = 220 − 200 = <b>+20 TEUR</b>",
        "Δ% = 20 ÷ 220 × 100 ≈ <b>9,1&nbsp;%</b> → Status: <em>auf Plan</em> (≥ −5&nbsp;%)",
        "<b>Zeitstrahl 2027:</b> IST-Start 2026 = 200; SOLL 2029 = 280 → linear: 200 + (280−200) × ⅓ ≈ <b>227 TEUR</b>",
      ],
      outcome: "IST 200 TEUR · SOLL 220 TEUR · Δ +9,1&nbsp;%",
    },
  },
  {
    kpi: "Headcount",
    views: ["Gesamtfortschritt", "Fortschritt"],
    phase1: {
      area: "Organisation · Status",
      fields: ["gliederungen[].headcount", "rollen[].anzahl (Fallback)"],
      agg: "Summe Headcount in technologischen Gliederungen",
    },
    phase2: {
      area: "Meilenstein · Planung",
      fields: ["ziel_headcount"],
      agg: "Maximum über alle Meilensteine des Jahres",
    },
    calc: "IST = Jahresabschluss Headcount; Zeitstrahl aus echten Jahres-IST-Punkten",
    example: {
      phase1Items: [
        { label: "Gliederung Data &amp; AI", field: "headcount", value: "12" },
        { label: "Gliederung Cloud", field: "headcount", value: "8" },
      ],
      phase1Calc: "12 + 8",
      phase1Result: "20 MA",
      phase2Items: [
        { label: "Meilenstein WS A · 2027", field: "ziel_headcount", value: "22" },
        { label: "Meilenstein WS B · 2027", field: "ziel_headcount", value: "25" },
      ],
      phase2Calc: "max(22, 25)",
      phase2Result: "25 MA",
      steps: [
        "<b>Detail:</b> Δ = SOLL − IST = 25 − 20 = <b>+5 MA</b>",
        "Δ% = 5 ÷ 25 × 100 = <b>20&nbsp;%</b> → Status: <em>auf Plan</em>",
        "<b>Zeitstrahl 2028:</b> IST-Start 2026 = 20; SOLL 2029 = 28 → linear: 20 + (28−20) × ⅔ ≈ <b>25 MA</b>",
      ],
      outcome: "IST 20 MA · SOLL 25 MA · Δ +20&nbsp;%",
    },
  },
  {
    kpi: "Zertifizierungsquote (%)",
    views: ["Gesamtfortschritt", "Fortschritt"],
    phase1: {
      area: "Skills · Status",
      fields: ["zertifiziert = „ja“"],
      agg: "Anteil zertifizierter Mitarbeitender an allen Skill-Einträgen",
    },
    phase2: {
      area: "Meilenstein · Planung",
      fields: ["ziel_anteil_prozent"],
      agg: "Höchster Anteil (max) über Meilensteine des Jahres",
    },
    calc: "Detail: IST ≥ SOLL = auf Plan; Zeitstrahl aus Jahresabschlüssen",
    example: {
      phase1Items: [
        { label: "Mitarbeiter A", field: "zertifiziert", value: "ja" },
        { label: "Mitarbeiter B", field: "zertifiziert", value: "ja" },
        { label: "Mitarbeiter C", field: "zertifiziert", value: "nein" },
      ],
      phase1Calc: "2 ÷ 3 × 100",
      phase1Result: "66,7 %",
      phase2Items: [
        { label: "Meilenstein WS A · 2027", field: "ziel_anteil_prozent", value: "70" },
        { label: "Meilenstein WS B · 2027", field: "ziel_anteil_prozent", value: "75" },
      ],
      phase2Calc: "max(70, 75)",
      phase2Result: "75 %",
      steps: [
        "<b>Detail:</b> Δ = IST − SOLL = 66,7 − 75 = <b>−8,3&nbsp;Pp</b>",
        "66,7&nbsp;% &lt; 75&nbsp;% → Status: <em>leicht hinter Plan</em> (≥ SOLL − 10&nbsp;%)",
        "<b>Zeitstrahl 2028:</b> IST-Start 66,7&nbsp;%; SOLL 2029 = 85&nbsp;% → linear ≈ <b>78,8&nbsp;%</b>",
      ],
      outcome: "IST 66,7&nbsp;% · SOLL 75&nbsp;% · leicht hinter Plan",
    },
  },
  {
    kpi: "Skill-Lücken",
    views: ["Fortschritt"],
    phase1: {
      area: "Skills · Status",
      fields: ["skills[].level", "skills[].kategorie"],
      agg: "Ø Skill-Level je Kategorie in der Unit",
    },
    phase2: {
      area: "Meilenstein · Planung",
      fields: ["ziel_skill_kategorie", "ziel_skill_level_min", "ziel_anteil_prozent (optional)"],
      agg: "Je gesetztem Skill-Ziel im Meilenstein",
    },
    calc: "Gap = Ø Level IST − Mindest-Level SOLL (nur Fortschritt, nicht im Zeitstrahl)",
    example: {
      phase1Items: [
        { label: "MA 1 · Cloud", field: "level", value: "2" },
        { label: "MA 2 · Cloud", field: "level", value: "3" },
        { label: "MA 3 · Cloud", field: "level", value: "4" },
      ],
      phase1Calc: "(2 + 3 + 4) ÷ 3",
      phase1Result: "Ø 3,0",
      phase2Items: [
        { label: "Meilenstein WS Cloud · 2027", field: "ziel_skill_kategorie", value: "Cloud" },
        { label: "gleicher Meilenstein", field: "ziel_skill_level_min", value: "3,5" },
      ],
      phase2Calc: "Mindest-Level SOLL",
      phase2Result: "3,5",
      steps: [
        "<b>Gap</b> = Ø Level IST − Mindest-Level SOLL = 3,0 − 3,5 = <b>−0,5</b>",
        "−0,5 ≥ −0,5 → Status: <em>leicht hinter Plan</em>",
      ],
      outcome: "IST Ø 3,0 · SOLL min. 3,5 · Gap −0,5",
    },
  },
  {
    kpi: "Mitarbeiter-Entwicklung (Fortschritt)",
    views: ["Fortschritt"],
    phase1: {
      area: "Skills · Status · pro Mitarbeiter",
      fields: ["skills[].kategorie", "skills[].technologie", "skills[].level", "softSkills[].kategorie", "softSkills[].level"],
      agg: "IST-Level je Fach- und Soft-Skill pro skillEntryId",
    },
    phase2: {
      area: "Planung NEW · Mitarbeiter · Skill-Plan",
      fields: ["skillPlanKind", "kategorie", "technologie", "kompetenz", "ziel_skill_level_min", "ziel_quartal"],
      agg: "Je Skill-Eintrag pro Mitarbeiter und Jahr ein Ziel-Level",
    },
    calc: "Pro Mitarbeiter Heatmap: Skills \u00d7 Planungsjahre, Zellenfarbe = geplantes Ziel-Level (1\u20135)",
    example: {
      phase1Items: [
        { label: "MA Müller · Cloud · AWS", field: "level", value: "2" },
        { label: "MA Müller · Soft · Kommunikation", field: "level", value: "3" },
      ],
      phase1Calc: "Direkt je Skill-Zeile",
      phase1Result: "IST 2 / 3",
      phase2Items: [
        { label: "Skill-Plan Cloud · AWS · 2027", field: "ziel_skill_level_min", value: "4" },
        { label: "Skill-Plan Kommunikation · 2027", field: "ziel_skill_level_min", value: "4" },
      ],
      phase2Calc: "Ziel-Level je Skill und Jahr",
      phase2Result: "SOLL Level 4 in 2027",
      steps: [
        "<b>Heatmap-Zelle</b> „Cloud · 2027“: geplantes Level <b>4</b> (Erfahren)",
        "<b>Entwicklungspfad</b>: Level je Skill \u00fcber die Planungsjahre 2026\u20132030",
      ],
      outcome: "Pro Mitarbeiter Skill\u00d7Jahr-Heatmap (Fach + Soft)",
    },
  },
];

let fortschrittErlaeuterungRendered = false;

function ftCodeList(fields) {
  return (fields || [])
    .map((f) => `<code>${f}</code>`)
    .join(", ");
}

function renderFortschrittExampleItem(item) {
  return `<li class="ft-methodik-example__row">
    <span class="ft-methodik-example__label">${item.label}</span>
    <code class="ft-methodik-example__field">${item.field}</code>
    <span class="ft-methodik-example__value">= ${item.value}</span>
  </li>`;
}

function renderFortschrittMappingExample(row) {
  const ex = row.example;
  if (!ex) return "";

  const phase1List = (ex.phase1Items || []).map(renderFortschrittExampleItem).join("");
  const phase2List = (ex.phase2Items || []).map(renderFortschrittExampleItem).join("");
  const steps = (ex.steps || []).map((s) => `<li>${s}</li>`).join("");

  return `<div class="ft-methodik-example" aria-label="Beispiel ${ftEscAttr(row.kpi)}">
    <div class="ft-methodik-example__title">Beispielrechnung</div>
    <div class="ft-methodik-example__grid">
      <div class="ft-methodik-example__col ft-methodik-example__col--p1">
        <div class="ft-methodik-example__col-head">Phase 1 · Quelldaten</div>
        <ul class="ft-methodik-example__list">${phase1List}</ul>
        <div class="ft-methodik-example__formula">${ex.phase1Calc} → <strong>IST ${ex.phase1Result}</strong></div>
      </div>
      <div class="ft-methodik-example__col ft-methodik-example__col--p2">
        <div class="ft-methodik-example__col-head">Phase 2 · Quelldaten (Jahr 2027)</div>
        <ul class="ft-methodik-example__list">${phase2List}</ul>
        <div class="ft-methodik-example__formula">${ex.phase2Calc} → <strong>SOLL ${ex.phase2Result}</strong></div>
      </div>
    </div>
    <div class="ft-methodik-example__calc">
      <div class="ft-methodik-example__col-head">Berechnung &amp; Ergebnis</div>
      <ol class="ft-methodik-example__steps">${steps}</ol>
      <div class="ft-methodik-example__outcome">${ex.outcome}</div>
    </div>
  </div>`;
}

function renderFortschrittMappingRow(row) {
  const views = (row.views || [])
    .map((v) => `<span>${v}</span>`)
    .join("");
  return `<div class="ft-methodik-flow" role="group" aria-label="${ftEscAttr(row.kpi)}">
    <div class="ft-methodik-flow__step ft-methodik-flow__step--p1">
      <div class="ft-methodik-flow__label">Phase 1 · Status</div>
      <div class="ft-methodik-flow__title">${row.phase1.area}</div>
      <p class="ft-methodik-flow__fields">Felder: ${ftCodeList(row.phase1.fields)}</p>
      <div class="ft-methodik-flow__agg">${row.phase1.agg}</div>
    </div>
    <div class="ft-methodik-flow__arrow" aria-hidden="true">→</div>
    <div class="ft-methodik-flow__step ft-methodik-flow__step--kpi">
      <div class="ft-methodik-flow__label">KPI</div>
      <div class="ft-methodik-flow__title">${row.kpi}</div>
      <div class="ft-methodik-views">${views}</div>
    </div>
    <div class="ft-methodik-flow__arrow" aria-hidden="true">←</div>
    <div class="ft-methodik-flow__step ft-methodik-flow__step--p2">
      <div class="ft-methodik-flow__label">Phase 2 · Backcasting</div>
      <div class="ft-methodik-flow__title">${row.phase2.area}</div>
      <p class="ft-methodik-flow__fields">Felder: ${ftCodeList(row.phase2.fields)}</p>
      <div class="ft-methodik-flow__agg">${row.phase2.agg}</div>
    </div>
  </div>
  <p class="ft-methodik-note" style="margin-top:.35rem;margin-bottom:.45rem">${row.calc}</p>
  ${renderFortschrittMappingExample(row)}`;
}

function renderFortschrittErlaeuterungHtml() {
  const mappingRows = FORTSCHRITT_FIELD_MAPPINGS.map(renderFortschrittMappingRow).join("");

  const pipelineGesamt = `<div class="ft-methodik-pipeline">
    <div class="ft-methodik-pipeline__item"><strong>1 · Daten laden</strong>Unit-Filter → API <code>/api/dashboard/timeline</code></div>
    <div class="ft-methodik-pipeline__item"><strong>2 · IST aggregieren</strong>Phase-1-Einträge (<code>entries</code>) je Unit</div>
    <div class="ft-methodik-pipeline__item"><strong>3 · SOLL aggregieren</strong>Backcasting-Plan (<code>backcasting_plans</code>) je Jahr 2026–2029</div>
    <div class="ft-methodik-pipeline__item"><strong>4 · Zeitstrahl</strong>SOLL = Ziel je Jahr; IST = linear von IST-Start zu SOLL 2029</div>
  </div>`;

  const pipelineDetail = `<div class="ft-methodik-pipeline">
    <div class="ft-methodik-pipeline__item"><strong>1 · Daten laden</strong>Unit + Jahr → API <code>/api/dashboard/snapshot</code></div>
    <div class="ft-methodik-pipeline__item"><strong>2 · Vergleich</strong>IST-Stand Phase 1 vs. aggregierte Meilenstein-Ziele des Jahres</div>
    <div class="ft-methodik-pipeline__item"><strong>3 · Ampel</strong>Abweichung: grün ≥ −5&nbsp;%, gelb −5 bis −15&nbsp;%, rot darunter (Zertifizierung: eigene Schwellen)</div>
  </div>`;

  return `<div class="card ft-methodik-card ft-methodik-card--page">
    <div class="ft-methodik-body">
      <h4>Ablauf Gesamtfortschritt (Zeitstrahl)</h4>
      ${pipelineGesamt}
      <h4>Ablauf Fortschritt (IST vs. SOLL)</h4>
      ${pipelineDetail}
      <h4>Feldzuordnung je Kennzahl</h4>
      <p style="color:var(--rc-muted);font-size:.72rem;margin:0 0 .5rem">
        Links: Erfassungsfelder aus der <strong>Statusaufnahme (Phase 1)</strong>.
        Rechts: Ziel-Felder in <strong>Plan-Meilensteinen (Phase 2)</strong> (<code>kind = wsYear</code>, gefiltert nach <code>jahr</code>).
      </p>
      ${mappingRows}
      <p class="ft-methodik-note">
        Gemeinsame Server-Logik: <code>server/dashboard-service.js</code> (<code>aggregatePhase1Entries</code>, <code>aggregatePlanForYear</code>, <code>buildDashboardTimeline</code> / <code>buildDashboardSnapshot</code>).
        Zeitstrahl: Register <em>Gesamtfortschritt</em>. IST/SOLL-Details und Skill-Lücken: Register <em>Fortschritt</em>.
      </p>
    </div>
  </div>`;
}

function renderFortschrittErlaeuterungPage() {
  const mount = document.getElementById("fortschrittErlaeuterungMount");
  if (!mount) return;
  if (!fortschrittErlaeuterungRendered) {
    mount.innerHTML = renderFortschrittErlaeuterungHtml();
    fortschrittErlaeuterungRendered = true;
  }
}

function fortschrittTipPageIds() {
  return ["page-gesamtfortschritt"];
}

function closeFortschrittTipPopovers(exceptCard) {
  fortschrittTipPageIds().forEach((pageId) => {
    document.querySelectorAll(`#${pageId} .ft-has-tip`).forEach((card) => {
      if (exceptCard && card === exceptCard) return;
      card.classList.remove("ft-tip-open");
      card.setAttribute("aria-expanded", "false");
    });
  });
}

function initFortschrittTipPopovers() {
  fortschrittTipPageIds().forEach((pageId) => {
    const root = document.getElementById(pageId);
    if (!root) return;

    root.querySelectorAll(".ft-has-tip").forEach((card) => {
      if (card.dataset.ftTipBound) return;
      card.dataset.ftTipBound = "1";

      card.addEventListener("click", (e) => {
        if (e.target.closest(".ft-stat-tip-close")) return;
        if (e.target.closest(".ft-stat-tooltip") && card.classList.contains("ft-tip-open")) {
          e.stopPropagation();
          return;
        }
        const open = card.classList.contains("ft-tip-open");
        closeFortschrittTipPopovers();
        if (!open) {
          card.classList.add("ft-tip-open");
          card.setAttribute("aria-expanded", "true");
        }
        e.stopPropagation();
      });

      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          card.click();
        }
        if (e.key === "Escape") closeFortschrittTipPopovers();
      });

      card.querySelector(".ft-stat-tip-close")?.addEventListener("click", (e) => {
        closeFortschrittTipPopovers();
        e.stopPropagation();
      });
    });
  });

  if (!fortschrittTipDocBound) {
    fortschrittTipDocBound = true;
    document.addEventListener("click", () => closeFortschrittTipPopovers());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeFortschrittTipPopovers();
    });
  }
}

function fortschrittUnit() {
  return typeof getSaveUnit === "function" ? String(getSaveUnit() || "").trim() : "";
}

function isFortschrittAllUnitsMode() {
  return typeof isSuperAdminViewAll === "function" && isSuperAdminViewAll();
}

const FORTSCHRITT_UNIT_COLORS = ["#0f3460", "#3498db", "#27ae60", "#e67e22"];

function ftFormatTimelineTick(value, unit) {
  if (value == null || !Number.isFinite(value)) return "–";
  if (unit === "TEUR") {
    if (value >= 1000) return Math.round(value / 100) / 10 + "k";
    return String(Math.round(value));
  }
  if (unit === "%") return Math.round(value) + "%";
  return String(Math.round(value));
}

function ftFormatTimelineTooltipValue(value, unit) {
  if (value == null || !Number.isFinite(value)) return "–";
  if (unit === "TEUR") return String(Math.round(value * 10) / 10);
  if (unit === "%") return Math.round(value) + "%";
  return String(Math.round(value));
}

function ftQuarterPointTooltip(slot, value, unit, kind) {
  const year = slot?.year ?? "";
  const quarter = slot?.label || (slot?.quarter ? "Q" + slot.quarter : "");
  const kindLabel = kind === "ist" ? "IST" : "SOLL";
  const val = ftFormatTimelineTooltipValue(value, unit);
  return `${year} ${quarter} · ${kindLabel} ${val} ${unit}`.trim();
}

function ftQuarterChartDot(cx, cy, color, tooltip, kind) {
  const x = Number(cx).toFixed(1);
  const y = Number(cy).toFixed(1);
  const dotCls = kind === "ist" ? "ft-tl-dot ft-tl-dot--ist" : "ft-tl-dot ft-tl-dot--soll";
  const dot =
    kind === "ist"
      ? `<circle class="${dotCls}" cx="${x}" cy="${y}" r="2.5" fill="#fff" stroke="${color}" stroke-width="1.5" pointer-events="none"/>`
      : `<circle class="${dotCls}" cx="${x}" cy="${y}" r="3" fill="${color}" pointer-events="none"/>`;
  return `<g class="ft-tl-dot-group" role="presentation">
    <title>${ftEscAttr(tooltip)}</title>
    <circle class="ft-tl-dot-hit" cx="${x}" cy="${y}" r="9" fill="transparent"/>
    ${dot}
  </g>`;
}

function ftTimelineSeriesForKpi(timelineData, kpiKey, allUnits) {
  if (allUnits && timelineData?.units) {
    return timelineData.units
      .map((row, index) => {
        const kpi = (row.kpis || []).find((k) => k.key === kpiKey);
        if (!kpi?.hasData) return null;
        return {
          unit: row.unit,
          color: FORTSCHRITT_UNIT_COLORS[index % FORTSCHRITT_UNIT_COLORS.length],
          soll: kpi.soll,
          ist: kpi.ist,
        };
      })
      .filter(Boolean);
  }
  const kpi = (timelineData?.kpis || []).find((k) => k.key === kpiKey);
  if (!kpi?.hasData) return [];
  return [
    {
      unit: timelineData.unit || fortschrittUnit(),
      color: FORTSCHRITT_UNIT_COLORS[0],
      soll: kpi.soll,
      ist: kpi.ist,
    },
  ];
}

function ftTimelineLineSwatch(kind, color = "#334155") {
  const dash = kind === "ist" ? ' stroke-dasharray="8 5"' : "";
  return `<svg class="ft-tl-legend-line" width="40" height="14" viewBox="0 0 40 14" aria-hidden="true">
    <line x1="2" y1="7" x2="38" y2="7" stroke="${color}" stroke-width="3.5" stroke-linecap="round"${dash}/>
  </svg>`;
}

function renderFortschrittTimelineStyleLegend(color = "#334155", extraClass = "", opts = {}) {
  const years = ftPlanningYears();
  const y0 = years[0];
  const yN = years.slice(-1)[0];
  const sollLabel = opts.mode === "p1" ? "Planung NEW (p1Year)" : "Plan-Meilensteine";
  const cls = extraClass ? `fortschritt-timeline-style ${extraClass}` : "fortschritt-timeline-style";
  return `<div class="${cls}">
    <span class="fortschritt-timeline-legend-item ft-tl-legend-item--soll">
      ${ftTimelineLineSwatch("soll", color)}
      <span><strong>SOLL</strong> \u00b7 ${sollLabel} <span class="ft-tl-legend-hint">(durchgezogen)</span></span>
    </span>
    <span class="fortschritt-timeline-legend-item ft-tl-legend-item--ist">
      ${ftTimelineLineSwatch("ist", color)}
      <span><strong>IST</strong> \u00b7 projiziert ${y0}\u2192${yN} <span class="ft-tl-legend-hint">(gestrichelt)</span></span>
    </span>
  </div>`;
}

function ftBuildTimelinePath(values, years, xAt, yAt) {
  let d = "";
  values.forEach((value, index) => {
    if (value == null || !Number.isFinite(value)) return;
    const cmd = d ? "L" : "M";
    d += `${cmd}${xAt(index).toFixed(1)},${yAt(value).toFixed(1)} `;
  });
  return d.trim();
}

function renderFortschrittTimelineSvg(kpi, years, seriesList) {
  if (!seriesList.length) {
    return '<p class="fortschritt-empty">Keine Plan-Daten für diese Kennzahl.</p>';
  }

  const W = 960;
  const H = 260;
  const pad = { l: 44, r: 10, t: 14, b: 30 };
  const allValues = [];
  seriesList.forEach((series) => {
    series.soll.forEach((v) => {
      if (v != null && Number.isFinite(v)) allValues.push(v);
    });
    series.ist.forEach((v) => {
      if (v != null && Number.isFinite(v)) allValues.push(v);
    });
  });
  if (!allValues.length) {
    return '<p class="fortschritt-empty">Keine Plan-Daten für diese Kennzahl.</p>';
  }

  let min = Math.min(...allValues);
  let max = Math.max(...allValues);
  if (min === max) {
    min -= min * 0.1 || 1;
    max += max * 0.1 || 1;
  }
  const range = max - min || 1;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const xAt = (index) => pad.l + (index / Math.max(years.length - 1, 1)) * innerW;
  const yAt = (value) => pad.t + (1 - (value - min) / range) * innerH;

  const yTicks = [min, min + range / 2, max];
  const gridLines = yTicks
    .map((tick) => {
      const y = yAt(tick).toFixed(1);
      return `<line class="ft-tl-grid" x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}"/>`;
    })
    .join("");

  const yLabels = yTicks
    .map((tick) => {
      const y = yAt(tick).toFixed(1);
      return `<text class="ft-tl-axis-label" x="${pad.l - 6}" y="${y}" text-anchor="end" dominant-baseline="middle">${ftFormatTimelineTick(tick, kpi.unit)}</text>`;
    })
    .join("");

  const xLabels = years
    .map((year, index) => {
      const x = xAt(index).toFixed(1);
      return `<text class="ft-tl-axis-label" x="${x}" y="${H - 8}" text-anchor="middle">${year}</text>`;
    })
    .join("");

  const paths = seriesList
    .map((series) => {
      const sollD = ftBuildTimelinePath(series.soll, years, xAt, yAt);
      const istD = ftBuildTimelinePath(series.ist, years, xAt, yAt);
      let html = "";
      if (sollD) {
        html += `<path class="ft-tl-line ft-tl-line--soll" stroke="${series.color}" d="${sollD}"/>`;
      }
      if (istD) {
        html += `<path class="ft-tl-line ft-tl-line--ist" stroke="${series.color}" d="${istD}"/>`;
      }
      return html;
    })
    .join("");

  const dots = seriesList
    .flatMap((series) =>
      years.map((year, index) => {
        const soll = series.soll[index];
        const parts = [];
        if (soll != null && Number.isFinite(soll)) {
          parts.push(
            `<circle class="ft-tl-dot ft-tl-dot--soll" cx="${xAt(index).toFixed(1)}" cy="${yAt(soll).toFixed(1)}" r="3" fill="${series.color}"/>`
          );
        }
        const ist = series.ist[index];
        if (ist != null && Number.isFinite(ist)) {
          parts.push(
            `<circle class="ft-tl-dot ft-tl-dot--ist" cx="${xAt(index).toFixed(1)}" cy="${yAt(ist).toFixed(1)}" r="2.5" fill="#fff" stroke="${series.color}" stroke-width="1.5"/>`
          );
        }
        return parts.join("");
      })
    )
    .join("");

  return `<svg class="ft-tl-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ftEscAttr(kpi.label)} Zeitstrahl">
    ${gridLines}
    <line class="ft-tl-axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H - pad.b}"/>
    <line class="ft-tl-axis" x1="${pad.l}" y1="${H - pad.b}" x2="${W - pad.r}" y2="${H - pad.b}"/>
    ${yLabels}
    ${xLabels}
    ${paths}
    ${dots}
  </svg>`;
}

function renderFortschrittQuarterChartSvg(meta, slots, seriesList) {
  const quarters = slots || [];
  const unit = meta?.unit || "TEUR";
  const yAxisLabel = meta?.yAxisLabel || "Umsatz (TEUR)";
  const xAxisLabel = meta?.xAxisLabel || "Zeit";
  const slotCount = quarters.length;

  const W = 560;
  const H = 200;
  const pad = { l: 48, r: 10, t: 16, b: 46 };

  if (!slotCount) {
    return '<p class="fortschritt-empty">Keine Plan-Daten für diese Kennzahl.</p>';
  }

  const allValues = [];
  (seriesList || []).forEach((series) => {
    (series.soll || []).forEach((v) => {
      if (v != null && Number.isFinite(v)) allValues.push(v);
    });
    (series.ist || []).forEach((v) => {
      if (v != null && Number.isFinite(v)) allValues.push(v);
    });
  });

  const hasValues = allValues.length > 0;
  let min = hasValues ? Math.min(...allValues) : 0;
  let max = hasValues ? Math.max(...allValues) : 1;
  if (!hasValues) {
    min = 0;
    max = 1;
  } else if (min === max) {
    min -= min * 0.1 || 1;
    max += max * 0.1 || 1;
  }
  const range = max - min || 1;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const xAt = (index) => pad.l + (index / Math.max(slotCount - 1, 1)) * innerW;
  const yAt = (value) => pad.t + (1 - (value - min) / range) * innerH;

  const yTicks = [min, min + range / 2, max];
  const gridLines = yTicks
    .map((tick) => {
      const y = yAt(tick).toFixed(1);
      return `<line class="ft-tl-grid" x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}"/>`;
    })
    .join("");

  const yLabels = yTicks
    .map((tick) => {
      const y = yAt(tick).toFixed(1);
      return `<text class="ft-tl-axis-label" font-size="10" x="${pad.l - 6}" y="${y}" text-anchor="end" dominant-baseline="middle">${ftFormatTimelineTick(tick, unit)}</text>`;
    })
    .join("");

  const yTitleX = 12;
  const yTitleY = (pad.t + (H - pad.b)) / 2;
  const yTitle = `<text class="ft-tl-axis-title" font-size="10" x="${yTitleX}" y="${yTitleY}" transform="rotate(-90 ${yTitleX} ${yTitleY})" text-anchor="middle">${ftEscAttr(yAxisLabel)}</text>`;

  const xQuarterLabels = quarters
    .map((slot, index) => {
      const x = xAt(index).toFixed(1);
      return `<text class="ft-tl-axis-label ft-tl-x-q-label" font-size="8" x="${x}" y="${H - pad.b + 12}" text-anchor="middle">${slot.label || "Q" + slot.quarter}</text>`;
    })
    .join("");

  const yearsSeen = {};
  const xYearLabels = quarters
    .map((slot, index) => {
      if (yearsSeen[slot.year]) return "";
      yearsSeen[slot.year] = true;
      const yearStart = quarters.findIndex((s) => s.year === slot.year);
      const yearEnd = quarters.length - 1 - [...quarters].reverse().findIndex((s) => s.year === slot.year);
      const x = ((xAt(yearStart) + xAt(yearEnd)) / 2).toFixed(1);
      return `<text class="ft-tl-axis-label ft-tl-x-year-label" font-size="10" x="${x}" y="${H - 4}" text-anchor="middle">${slot.year}</text>`;
    })
    .join("");

  const yearDividers = quarters
    .map((slot, index) => {
      if (index === 0 || quarters[index - 1].year === slot.year) return "";
      const x = xAt(index).toFixed(1);
      return `<line class="ft-tl-grid ft-tl-grid--year" x1="${x}" y1="${pad.t}" x2="${x}" y2="${H - pad.b}"/>`;
    })
    .join("");

  const xTitle = `<text class="ft-tl-axis-title ft-tl-axis-title--x" font-size="10" x="${(pad.l + W - pad.r) / 2}" y="${H - 1}" text-anchor="middle">${ftEscAttr(xAxisLabel)}</text>`;

  const paths = (seriesList || [])
    .map((series) => {
      const sollD = ftBuildTimelinePath(series.soll || [], quarters, xAt, yAt);
      const istD = ftBuildTimelinePath(series.ist || [], quarters, xAt, yAt);
      let html = "";
      if (sollD) {
        html += `<path class="ft-tl-line ft-tl-line--soll" stroke="${series.color}" d="${sollD}"/>`;
      }
      if (istD) {
        html += `<path class="ft-tl-line ft-tl-line--ist" stroke="${series.color}" d="${istD}"/>`;
      }
      return html;
    })
    .join("");

  const dots = (seriesList || [])
    .flatMap((series) =>
      quarters.map((slot, index) => {
        const soll = (series.soll || [])[index];
        const ist = (series.ist || [])[index];
        let html = "";
        if (soll != null && Number.isFinite(soll)) {
          html += ftQuarterChartDot(
            xAt(index),
            yAt(soll),
            series.color,
            ftQuarterPointTooltip(slot, soll, unit, "soll"),
            "soll"
          );
        }
        if (ist != null && Number.isFinite(ist)) {
          html += ftQuarterChartDot(
            xAt(index),
            yAt(ist),
            series.color,
            ftQuarterPointTooltip(slot, ist, unit, "ist"),
            "ist"
          );
        }
        return html;
      })
    )
    .join("");

  const emptyHint = hasValues
    ? ""
    : `<text class="ft-tl-empty-hint" x="${(pad.l + W - pad.r) / 2}" y="${(pad.t + H - pad.b) / 2}" text-anchor="middle">Noch keine Umsatzwerte (TEUR) erfasst</text>`;

  const ariaLabel = meta?.label || yAxisLabel;
  return `<svg class="ft-tl-svg ft-tl-svg--quarter" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ftEscAttr(ariaLabel)}">
    ${gridLines}
    ${yearDividers}
    <line class="ft-tl-axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H - pad.b}"/>
    <line class="ft-tl-axis" x1="${pad.l}" y1="${H - pad.b}" x2="${W - pad.r}" y2="${H - pad.b}"/>
    ${yLabels}
    ${yTitle}
    ${xQuarterLabels}
    ${xYearLabels}
    ${xTitle}
    ${paths}
    ${dots}
    ${emptyHint}
  </svg>`;
}

const FT_STACKED_YEAR_COLORS = [
  "#2563eb", "#7c3aed", "#0f766e", "#c05621", "#334155", "#db2777", "#0891b2", "#65a30d",
];

function renderFortschrittStackedYearChartSvg(meta, years, segments) {
  const yearList = years || [];
  const seriesList = segments || [];
  const unit = meta?.unit || "";
  const yAxisLabel = meta?.yAxisLabel || "";
  const xAxisLabel = meta?.xAxisLabel || "Jahr";

  if (!yearList.length) {
    return '<p class="fortschritt-empty">Keine Plan-Daten f\u00fcr diese Kennzahl.</p>';
  }

  const W = 560;
  const H = 190;
  const pad = { l: 48, r: 10, t: 16, b: 36 };
  const totals = yearList.map((_, yi) =>
    seriesList.reduce((sum, seg) => sum + (seg.values?.[yi] || 0), 0)
  );
  const showIstMarkers = meta?.showIstMarkers !== false;
  const istTotalValue = meta?.istTotalValue;
  const showIstTotal = meta?.showIstTotal === true && istTotalValue != null && Number.isFinite(istTotalValue);
  const istRefs = showIstMarkers
    ? seriesList.flatMap((seg) => {
      const fromArray = (seg.istValues || []).filter((v) => v != null && Number.isFinite(v));
      const single = seg.istValue != null && Number.isFinite(seg.istValue) ? [seg.istValue] : [];
      return [...fromArray, ...single];
    })
    : showIstTotal
      ? [istTotalValue]
      : [];
  const hasValues = totals.some((t) => t > 0) || istRefs.length > 0;
  let max = hasValues ? Math.max(...totals, ...istRefs, 1) : 1;
  if (max <= 0) max = 1;

  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const yearCount = yearList.length;
  const slotW = innerW / Math.max(yearCount, 1);
  const barW = Math.min(slotW * 0.58, 42);
  const xCenter = (index) => pad.l + slotW * index + slotW / 2;
  const yAt = (value) => pad.t + (1 - value / max) * innerH;
  const baseY = pad.t + innerH;

  const yTicks = [0, max / 2, max];
  const gridLines = yTicks
    .map((tick) => {
      const y = yAt(tick).toFixed(1);
      return `<line class="ft-tl-grid" x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}"/>`;
    })
    .join("");

  const yLabels = yTicks
    .map((tick) => {
      const y = yAt(tick).toFixed(1);
      return `<text class="ft-tl-axis-label" font-size="10" x="${pad.l - 6}" y="${y}" text-anchor="end" dominant-baseline="middle">${ftFormatTimelineTick(tick, unit)}</text>`;
    })
    .join("");

  const yTitleX = 12;
  const yTitleY = (pad.t + (H - pad.b)) / 2;
  const yTitle = yAxisLabel
    ? `<text class="ft-tl-axis-title" font-size="10" x="${yTitleX}" y="${yTitleY}" transform="rotate(-90 ${yTitleX} ${yTitleY})" text-anchor="middle">${ftEscAttr(yAxisLabel)}</text>`
    : "";

  const xLabels = yearList
    .map((year, index) => {
      const x = xCenter(index).toFixed(1);
      return `<text class="ft-tl-axis-label" font-size="10" x="${x}" y="${H - 10}" text-anchor="middle">${year}</text>`;
    })
    .join("");

  const xTitle = `<text class="ft-tl-axis-title ft-tl-axis-title--x" font-size="10" x="${(pad.l + W - pad.r) / 2}" y="${H - 1}" text-anchor="middle">${ftEscAttr(xAxisLabel)}</text>`;

  let bars = "";
  let istMarkers = "";
  yearList.forEach((year, yi) => {
    let stackBottom = baseY;
    const yearHasSoll = totals[yi] > 0;
    seriesList.forEach((seg, si) => {
      const val = seg.values?.[yi];
      const color = seg.color || FT_STACKED_YEAR_COLORS[si % FT_STACKED_YEAR_COLORS.length];
      const x = xCenter(yi) - barW / 2;
      if (val != null && val > 0) {
        const h = (val / max) * innerH;
        const y = stackBottom - h;
        const tooltip = `${seg.label} \u00b7 ${year} \u00b7 SOLL ${ftFormatTimelineTooltipValue(val, unit)} ${unit}`;
        bars += `<rect class="ft-year-stack-segment" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(h, 0.5).toFixed(1)}" fill="${color}"><title>${ftEscAttr(tooltip)}</title></rect>`;
        stackBottom = y;
      }
      const istVal = showIstMarkers
        ? (seg.istValues?.[yi] ?? (yearHasSoll ? seg.istValue : null))
        : null;
      if (istVal != null && Number.isFinite(istVal)) {
        const istY = yAt(istVal).toFixed(1);
        const istTip = `${seg.label} \u00b7 ${year} \u00b7 IST ${ftFormatTimelineTooltipValue(istVal, unit)} ${unit}`;
        istMarkers += `<line class="ft-year-stack-ist" x1="${x.toFixed(1)}" y1="${istY}" x2="${(x + barW).toFixed(1)}" y2="${istY}"><title>${ftEscAttr(istTip)}</title></line>`;
      }
    });
    if (totals[yi] > 0) {
      bars += `<text class="ft-year-stack-total" font-size="10" x="${xCenter(yi).toFixed(1)}" y="${(yAt(totals[yi]) - 3).toFixed(1)}" text-anchor="middle">${ftFormatTimelineTick(totals[yi], unit)}</text>`;
    }
    if (showIstTotal && totals[yi] > 0) {
      const x = xCenter(yi) - barW / 2;
      const istY = yAt(istTotalValue).toFixed(1);
      const istTip = `${year} \u00b7 IST gesamt ${ftFormatTimelineTooltipValue(istTotalValue, unit)} ${unit}`;
      istMarkers += `<line class="ft-year-stack-ist ft-year-stack-ist--total" x1="${x.toFixed(1)}" y1="${istY}" x2="${(x + barW).toFixed(1)}" y2="${istY}"><title>${ftEscAttr(istTip)}</title></line>`;
    }
  });

  const emptyHint = hasValues
    ? ""
    : `<text class="ft-tl-empty-hint" x="${(pad.l + W - pad.r) / 2}" y="${(pad.t + H - pad.b) / 2}" text-anchor="middle">Noch keine SOLL-Werte erfasst</text>`;

  const ariaLabel = meta?.label || yAxisLabel || "Jahresverlauf";
  return `<svg class="ft-tl-svg ft-tl-svg--year-stack" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ftEscAttr(ariaLabel)}">
    ${gridLines}
    <line class="ft-tl-axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H - pad.b}"/>
    <line class="ft-tl-axis" x1="${pad.l}" y1="${H - pad.b}" x2="${W - pad.r}" y2="${H - pad.b}"/>
    ${yLabels}
    ${yTitle}
    ${xLabels}
    ${xTitle}
    ${bars}
    ${istMarkers}
    ${emptyHint}
  </svg>`;
}

function renderFortschrittSollIstYearChartSvg(meta, years, sollByYear, istByYear, opts) {
  opts = opts || {};
  const yearList = years || [];
  const soll = sollByYear || [];
  const ist = istByYear || [];
  const unit = meta?.unit || "TEUR";
  const yAxisLabel = meta?.yAxisLabel || "Umsatz (TEUR)";
  const xAxisLabel = meta?.xAxisLabel || "Jahr";
  const sollColor = opts.sollColor || "#2563eb";
  const istColor = opts.istColor || "#0f766e";

  if (!yearList.length) {
    return '<p class="fortschritt-empty">Keine Daten f\u00fcr diese Kennzahl.</p>';
  }

  const allNums = [];
  yearList.forEach((_, yi) => {
    if (soll[yi] != null && soll[yi] > 0) allNums.push(soll[yi]);
    if (ist[yi] != null && Number.isFinite(ist[yi])) allNums.push(ist[yi]);
  });
  if (!allNums.length) {
    return '<p class="fortschritt-empty">Noch keine SOLL- oder IST-Werte erfasst.</p>';
  }

  const W = 560;
  const H = 210;
  const pad = { l: 48, r: 10, t: 28, b: 36 };
  let max = Math.max(...allNums, 1);
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const yearCount = yearList.length;
  const slotW = innerW / Math.max(yearCount, 1);
  const pairGap = 3;
  const barW = Math.min((slotW - pairGap - 8) / 2, 22);
  const groupW = barW * 2 + pairGap;
  const xCenter = (index) => pad.l + slotW * index + slotW / 2;
  const yAt = (value) => pad.t + (1 - value / max) * innerH;
  const baseY = pad.t + innerH;

  const yTicks = [0, max / 2, max];
  const gridLines = yTicks
    .map((tick) => {
      const y = yAt(tick).toFixed(1);
      return `<line class="ft-tl-grid" x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}"/>`;
    })
    .join("");

  const yLabels = yTicks
    .map((tick) => {
      const y = yAt(tick).toFixed(1);
      return `<text class="ft-tl-axis-label" font-size="10" x="${pad.l - 6}" y="${y}" text-anchor="end" dominant-baseline="middle">${ftFormatTimelineTick(tick, unit)}</text>`;
    })
    .join("");

  const yTitleX = 12;
  const yTitleY = (pad.t + (H - pad.b)) / 2;
  const yTitle = `<text class="ft-tl-axis-title" font-size="10" x="${yTitleX}" y="${yTitleY}" transform="rotate(-90 ${yTitleX} ${yTitleY})" text-anchor="middle">${ftEscAttr(yAxisLabel)}</text>`;

  const xLabels = yearList
    .map((year, index) => {
      const x = xCenter(index).toFixed(1);
      return `<text class="ft-tl-axis-label" font-size="10" x="${x}" y="${H - 10}" text-anchor="middle">${year}</text>`;
    })
    .join("");

  const xTitle = `<text class="ft-tl-axis-title ft-tl-axis-title--x" font-size="10" x="${(pad.l + W - pad.r) / 2}" y="${H - 1}" text-anchor="middle">${ftEscAttr(xAxisLabel)}</text>`;

  const legend = `<g class="ft-soll-ist-legend" transform="translate(${pad.l}, 6)">
    <rect x="0" y="-4" width="10" height="10" rx="1" fill="${sollColor}"/>
    <text class="ft-tl-axis-label" font-size="10" x="14" y="4">SOLL (Plan)</text>
    <rect x="88" y="-4" width="10" height="10" rx="1" fill="${istColor}"/>
    <text class="ft-tl-axis-label" font-size="10" x="102" y="4">IST (Jahresabschluss)</text>
  </g>`;

  let bars = "";
  yearList.forEach((year, yi) => {
    const cx = xCenter(yi);
    const xSoll = cx - groupW / 2;
    const xIst = xSoll + barW + pairGap;
    const sollVal = soll[yi];
    const istVal = ist[yi];

    if (sollVal != null && sollVal > 0) {
      const h = (sollVal / max) * innerH;
      const y = baseY - h;
      const tip = `${year} \u00b7 SOLL ${ftFormatTimelineTooltipValue(sollVal, unit)} ${unit}`;
      bars += `<rect class="ft-soll-ist-bar ft-soll-ist-bar--soll" x="${xSoll.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(h, 0.5).toFixed(1)}" fill="${sollColor}"><title>${ftEscAttr(tip)}</title></rect>`;
      bars += `<text class="ft-soll-ist-bar__label" font-size="9" x="${(xSoll + barW / 2).toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="middle">${ftFormatTimelineTick(sollVal, unit)}</text>`;
    }

    if (istVal != null && Number.isFinite(istVal)) {
      if (istVal > 0) {
        const h = (istVal / max) * innerH;
        const y = baseY - h;
        const tip = `${year} \u00b7 IST ${ftFormatTimelineTooltipValue(istVal, unit)} ${unit}`;
        bars += `<rect class="ft-soll-ist-bar ft-soll-ist-bar--ist" x="${xIst.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(h, 0.5).toFixed(1)}" fill="${istColor}"><title>${ftEscAttr(tip)}</title></rect>`;
        bars += `<text class="ft-soll-ist-bar__label" font-size="9" x="${(xIst + barW / 2).toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="middle">${ftFormatTimelineTick(istVal, unit)}</text>`;
      } else {
        const tip = `${year} \u00b7 IST 0 ${unit}`;
        bars += `<line class="ft-soll-ist-bar__zero" x1="${xIst.toFixed(1)}" y1="${baseY.toFixed(1)}" x2="${(xIst + barW).toFixed(1)}" y2="${baseY.toFixed(1)}" stroke="${istColor}" stroke-width="2"><title>${ftEscAttr(tip)}</title></line>`;
        bars += `<text class="ft-soll-ist-bar__label ft-soll-ist-bar__label--zero" font-size="9" x="${(xIst + barW / 2).toFixed(1)}" y="${(baseY - 4).toFixed(1)}" text-anchor="middle">0</text>`;
      }
    }
  });

  const ariaLabel = meta?.label || "SOLL vs. IST je Jahr";
  return `<svg class="ft-tl-svg ft-tl-svg--soll-ist" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ftEscAttr(ariaLabel)}">
    ${gridLines}
    <line class="ft-tl-axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H - pad.b}"/>
    <line class="ft-tl-axis" x1="${pad.l}" y1="${H - pad.b}" x2="${W - pad.r}" y2="${H - pad.b}"/>
    ${yLabels}
    ${yTitle}
    ${legend}
    ${xLabels}
    ${xTitle}
    ${bars}
  </svg>`;
}

const FT_ORG_HC_COLOR = "#2563eb";
const FT_ORG_TEUR_COLOR = "#0f766e";

function ftOrgShortLabel(label, maxLen) {
  const text = String(label || "");
  if (text.length <= maxLen) return text;
  return text.slice(0, Math.max(1, maxLen - 1)) + "\u2026";
}

function renderFortschrittOrgDualMetricYearChartSvg(meta, years, segments) {
  const yearList = years || [];
  const segmentList = (segments || []).filter((seg) => {
    const hasHc = (seg.hcValues || []).some((v) => v != null && v > 0) || (seg.istHc != null && seg.istHc > 0);
    const hasTeur = (seg.teurValues || []).some((v) => v != null && v > 0) || (seg.istTeur != null && seg.istTeur > 0);
    return hasHc || hasTeur;
  });

  if (!yearList.length || !segmentList.length) {
    return '<p class="fortschritt-empty">Keine Plan-Daten f\u00fcr diese Kennzahl.</p>';
  }

  const hcNums = segmentList.flatMap((seg) => [
    ...(seg.hcValues || []).filter((v) => v != null && v > 0),
    seg.istHc,
  ].filter((v) => v != null && v > 0));
  const teurNums = segmentList.flatMap((seg) => [
    ...(seg.teurValues || []).filter((v) => v != null && v > 0),
    seg.istTeur,
  ].filter((v) => v != null && v > 0));
  const maxHc = hcNums.length ? Math.max(...hcNums, 1) : 1;
  const maxTeur = teurNums.length ? Math.max(...teurNums, 1) : 1;

  const W = 580;
  const H = 220;
  const pad = { l: 46, r: 46, t: 18, b: 52 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const yearCount = yearList.length;
  const segCount = segmentList.length;
  const slotW = innerW / Math.max(yearCount, 1);
  const clusterW = slotW * 0.86;
  const groupW = clusterW / Math.max(segCount, 1);
  const pairGap = 3;
  const barW = Math.max(4, Math.min((groupW - pairGap) / 2, 16));
  const baseY = pad.t + innerH;
  const yAtHc = (value) => pad.t + (1 - value / maxHc) * innerH;
  const yAtTeur = (value) => pad.t + (1 - value / maxTeur) * innerH;

  const yTicksHc = [0, maxHc / 2, maxHc];
  const yTicksTeur = [0, maxTeur / 2, maxTeur];
  const gridLines = yTicksHc
    .map((tick) => {
      const y = yAtHc(tick).toFixed(1);
      return `<line class="ft-tl-grid" x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}"/>`;
    })
    .join("");

  const yLabelsLeft = yTicksHc
    .map((tick) => {
      const y = yAtHc(tick).toFixed(1);
      return `<text class="ft-tl-axis-label ft-tl-axis-label--left" font-size="10" x="${pad.l - 6}" y="${y}" text-anchor="end" dominant-baseline="middle">${ftFormatTimelineTick(tick, "HC")}</text>`;
    })
    .join("");

  const yLabelsRight = yTicksTeur
    .map((tick) => {
      const y = yAtTeur(tick).toFixed(1);
      return `<text class="ft-tl-axis-label ft-tl-axis-label--right" font-size="10" x="${W - pad.r + 6}" y="${y}" text-anchor="start" dominant-baseline="middle">${ftFormatTimelineTick(tick, "TEUR")}</text>`;
    })
    .join("");

  const yTitleLeft = `<text class="ft-tl-axis-title" font-size="10" x="12" y="${(pad.t + baseY) / 2}" transform="rotate(-90 12 ${(pad.t + baseY) / 2})" text-anchor="middle">Headcount</text>`;
  const yTitleRight = `<text class="ft-tl-axis-title" font-size="10" x="${W - 10}" y="${(pad.t + baseY) / 2}" transform="rotate(90 ${W - 10} ${(pad.t + baseY) / 2})" text-anchor="middle">Umsatz (TEUR)</text>`;

  let bars = "";
  let istMarkers = "";
  let subLabels = "";

  yearList.forEach((year, yi) => {
    const slotLeft = pad.l + slotW * yi;
    const clusterLeft = slotLeft + (slotW - clusterW) / 2;
    segmentList.forEach((seg, si) => {
      const groupCenter = clusterLeft + groupW * si + groupW / 2;
      const hcX = groupCenter - barW - pairGap / 2;
      const teurX = groupCenter + pairGap / 2;
      const hcVal = seg.hcValues?.[yi];
      const teurVal = seg.teurValues?.[yi];
      const hasHcSoll = hcVal != null && hcVal > 0;
      const hasTeurSoll = teurVal != null && teurVal > 0;

      if (hasHcSoll) {
        const h = (hcVal / maxHc) * innerH;
        const y = baseY - h;
        const tip = `${seg.label} \u00b7 ${year} \u00b7 SOLL ${ftFormatTimelineTooltipValue(hcVal, "HC")} HC`;
        bars += `<rect class="ft-org-dual-bar ft-org-dual-bar--hc" x="${hcX.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(h, 0.5).toFixed(1)}" fill="${FT_ORG_HC_COLOR}"><title>${ftEscAttr(tip)}</title></rect>`;
        if (seg.istHc != null && seg.istHc > 0) {
          const istY = yAtHc(seg.istHc).toFixed(1);
          const istTip = `${seg.label} \u00b7 ${year} \u00b7 IST ${ftFormatTimelineTooltipValue(seg.istHc, "HC")} HC`;
          istMarkers += `<line class="ft-org-dual-ist ft-org-dual-ist--hc" x1="${hcX.toFixed(1)}" y1="${istY}" x2="${(hcX + barW).toFixed(1)}" y2="${istY}"><title>${ftEscAttr(istTip)}</title></line>`;
        }
      } else if (seg.istHc != null && seg.istHc > 0 && meta?.istFallback) {
        const h = (seg.istHc / maxHc) * innerH;
        const y = baseY - h;
        const tip = `${seg.label} \u00b7 ${year} \u00b7 IST ${ftFormatTimelineTooltipValue(seg.istHc, "HC")} HC`;
        bars += `<rect class="ft-org-dual-bar ft-org-dual-bar--hc ft-org-dual-bar--ist" x="${hcX.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(h, 0.5).toFixed(1)}" fill="${FT_ORG_HC_COLOR}" opacity="0.45"><title>${ftEscAttr(tip)}</title></rect>`;
      }

      if (hasTeurSoll) {
        const h = (teurVal / maxTeur) * innerH;
        const y = baseY - h;
        const tip = `${seg.label} \u00b7 ${year} \u00b7 SOLL ${ftFormatTimelineTooltipValue(teurVal, "TEUR")} TEUR`;
        bars += `<rect class="ft-org-dual-bar ft-org-dual-bar--teur" x="${teurX.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(h, 0.5).toFixed(1)}" fill="${FT_ORG_TEUR_COLOR}"><title>${ftEscAttr(tip)}</title></rect>`;
        if (seg.istTeur != null && seg.istTeur > 0) {
          const istY = yAtTeur(seg.istTeur).toFixed(1);
          const istTip = `${seg.label} \u00b7 ${year} \u00b7 IST ${ftFormatTimelineTooltipValue(seg.istTeur, "TEUR")} TEUR`;
          istMarkers += `<line class="ft-org-dual-ist ft-org-dual-ist--teur" x1="${teurX.toFixed(1)}" y1="${istY}" x2="${(teurX + barW).toFixed(1)}" y2="${istY}"><title>${ftEscAttr(istTip)}</title></line>`;
        }
      } else if (seg.istTeur != null && seg.istTeur > 0 && meta?.istFallback) {
        const h = (seg.istTeur / maxTeur) * innerH;
        const y = baseY - h;
        const tip = `${seg.label} \u00b7 ${year} \u00b7 IST ${ftFormatTimelineTooltipValue(seg.istTeur, "TEUR")} TEUR`;
        bars += `<rect class="ft-org-dual-bar ft-org-dual-bar--teur ft-org-dual-bar--ist" x="${teurX.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(h, 0.5).toFixed(1)}" fill="${FT_ORG_TEUR_COLOR}" opacity="0.45"><title>${ftEscAttr(tip)}</title></rect>`;
      }

      if (segCount > 1) {
        const short = ftOrgShortLabel(seg.label, segCount > 2 ? 8 : 12);
        subLabels += `<text class="ft-org-dual-sublabel" font-size="8" x="${groupCenter.toFixed(1)}" y="${H - 28}" text-anchor="middle">${ftEscAttr(short)}</text>`;
      }
    });

    const yearX = (slotLeft + slotW / 2).toFixed(1);
    subLabels += `<text class="ft-tl-axis-label ft-org-dual-year" font-size="10" font-weight="600" x="${yearX}" y="${H - 12}" text-anchor="middle">${year}</text>`;
  });

  const ariaLabel = meta?.label || "Headcount und Umsatz je Jahr";
  return `<svg class="ft-tl-svg ft-tl-svg--org-dual" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ftEscAttr(ariaLabel)}">
    ${gridLines}
    <line class="ft-tl-axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${baseY}"/>
    <line class="ft-tl-axis" x1="${W - pad.r}" y1="${pad.t}" x2="${W - pad.r}" y2="${baseY}"/>
    <line class="ft-tl-axis" x1="${pad.l}" y1="${baseY}" x2="${W - pad.r}" y2="${baseY}"/>
    ${yLabelsLeft}
    ${yLabelsRight}
    ${yTitleLeft}
    ${yTitleRight}
    ${bars}
    ${istMarkers}
    ${subLabels}
  </svg>`;
}

const FT_HEATMAP_CELL_COLORS = {
  ok: "#bbf7d0",
  warn: "#fde68a",
  risk: "#fecaca",
  neutral: "#dbeafe",
  empty: "#ffffff",
};

function ftHeatmapCellColor(status) {
  return FT_HEATMAP_CELL_COLORS[status] || FT_HEATMAP_CELL_COLORS.empty;
}

function ftHeatmapColLines(label, maxChars) {
  const text = String(label || "").trim();
  if (!text) return ["?"];
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach(function (word) {
    const next = line ? line + " " + word : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function ftHeatmapCellLabel(cell) {
  if (!cell) return "";
  if (cell.gap != null && Number.isFinite(Number(cell.gap))) {
    const g = Number(cell.gap);
    return (g > 0 ? "+" : "") + String(g);
  }
  if (cell.sollLevel != null && Number.isFinite(Number(cell.sollLevel))) {
    return "\u2192" + cell.sollLevel;
  }
  return "Plan";
}

function renderFortschrittSkillHeatmapSvg(meta, heatmap) {
  if (!heatmap || !heatmap.hasData) {
    return '<p class="p1f-heatmap__empty">Keine Skill-Planungen f\u00fcr die Heatmap vorhanden.</p>';
  }

  const rows = heatmap.rows || [];
  const columns = heatmap.columns || [];
  const cells = heatmap.cells || [];

  const labelW = 156;
  const headerH = 58;
  const cellW = 76;
  const cellH = 32;
  const padR = 12;
  const padB = 8;
  const W = labelW + columns.length * cellW + padR;
  const H = headerH + rows.length * cellH + padB;

  let headerCols = "";
  columns.forEach(function (col, ci) {
    const x = labelW + ci * cellW + cellW / 2;
    const kindHint = col.kind === "soft" ? "Soft" : "Fach";
    const title = (col.label || "") + " (" + kindHint + ")";
    const lines = ftHeatmapColLines(col.label, 11);
    headerCols +=
      '<text class="p1f-heatmap__col-label" x="' + x.toFixed(1) + '" y="12" text-anchor="middle" data-kind="' + ftEscAttr(col.kind || "") + '">' +
      "<title>" + ftEscAttr(title) + "</title>" +
      '<tspan class="p1f-heatmap__col-kind" x="' + x.toFixed(1) + '" dy="0">' + ftEscAttr(kindHint) + "</tspan>";
    lines.forEach(function (line, li) {
      headerCols += '<tspan class="p1f-heatmap__col-name" x="' + x.toFixed(1) + '" dy="' + (li === 0 ? "11" : "10") + '">' + ftEscAttr(line) + "</tspan>";
    });
    headerCols += "</text>";
  });

  let body = "";
  rows.forEach(function (row, ri) {
    const y = headerH + ri * cellH;
    const rowLabel = String(row.label || "").length > 20
      ? String(row.label).slice(0, 19) + "\u2026"
      : (row.label || "");
    body +=
      '<text class="p1f-heatmap__row-label" x="' + (labelW - 8) + '" y="' + (y + cellH / 2).toFixed(1) + '" text-anchor="end" dominant-baseline="middle">' +
      "<title>" + ftEscAttr(row.label || "") + "</title>" +
      ftEscAttr(rowLabel) + "</text>";
    columns.forEach(function (col, ci) {
      const cell = (cells[ri] && cells[ri][ci]) || null;
      const x = labelW + ci * cellW;
      const status = cell ? (cell.status || "neutral") : "empty";
      const fill = ftHeatmapCellColor(status);
      const ist = cell && cell.istLevel != null ? cell.istLevel : "\u2013";
      const soll = cell && cell.sollLevel != null ? cell.sollLevel : "\u2013";
      const gap = cell && cell.gap != null ? cell.gap : "\u2013";
      const tip = cell
        ? row.label + " \u00b7 " + col.label + ": IST " + ist + " \u2192 SOLL " + soll + " (\u0394 " + gap + ")"
        : row.label + " \u00b7 " + col.label + ": nicht geplant";
      const cellLabel = ftHeatmapCellLabel(cell);
      body +=
        '<rect class="p1f-heatmap__cell p1f-heatmap__cell--' + status + '" x="' + x + '" y="' + y + '" width="' + cellW + '" height="' + cellH + '" fill="' + fill + '" stroke="#cbd5e1" stroke-width="1" data-kind="' + ftEscAttr(col.kind || "") + '" data-row="' + ri + '" data-status="' + ftEscAttr(status) + '">' +
        "<title>" + ftEscAttr(tip) + "</title></rect>";
      if (cellLabel) {
        body +=
          '<text class="p1f-heatmap__cell-text p1f-heatmap__cell-text--' + status + '" x="' + (x + cellW / 2).toFixed(1) + '" y="' + (y + cellH / 2).toFixed(1) + '" text-anchor="middle" dominant-baseline="middle">' +
          ftEscAttr(cellLabel) + "</text>";
      }
    });
  });

  const ariaLabel = meta?.label || "Skill-Heatmap";
  return (
    '<svg class="p1f-heatmap__svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + ftEscAttr(ariaLabel) + '">' +
    '<line class="p1f-heatmap__axis" x1="' + labelW + '" y1="' + headerH + '" x2="' + W + '" y2="' + headerH + '"/>' +
    headerCols +
    body +
    "</svg>"
  );
}

const FT_SKILL_LEVEL_COLORS = {
  1: "#F0F0F0",
  2: "#C6DBEF",
  3: "#6BAED6",
  4: "#3182BD",
  5: "#08519C",
};

const FT_SKILL_LEVEL_LABELS = {
  1: "Grundlagen",
  2: "Anwender",
  3: "Fortgeschritten",
  4: "Erfahren",
  5: "Experte",
};

function ftSkillLevelColor(level) {
  const n = Number(level);
  return FT_SKILL_LEVEL_COLORS[n] || FT_SKILL_LEVEL_COLORS[1];
}

function ftSkillLevelTextColor(level) {
  return Number(level) >= 3 ? "#ffffff" : "#1e293b";
}

function renderFortschrittSkillLevelLegend() {
  let items = "";
  [1, 2, 3, 4, 5].forEach(function (lvl) {
    items +=
      '<span class="p1f-skill-level-legend__item">' +
      '<span class="p1f-skill-level-legend__swatch" style="background:' + ftSkillLevelColor(lvl) + '"></span>' +
      "<span>" + lvl + " " + ftEscAttr(FT_SKILL_LEVEL_LABELS[lvl]) + "</span></span>";
  });
  return '<div class="p1f-skill-level-legend">' + items + "</div>";
}

function renderFortschrittSkillLevelHeatmapSvg(meta, heatmap) {
  if (!heatmap || !heatmap.hasData) {
    return '<p class="p1f-heatmap__empty">Keine Skill-Planungen vorhanden.</p>';
  }

  const rows = heatmap.rows || [];
  const columns = heatmap.columns || [];
  const cells = heatmap.cells || [];

  const labelW = 148;
  const headerH = 24;
  const cellW = 42;
  const cellH = 28;
  const padR = 10;
  const padB = 8;
  const fontRow = 10;
  const fontCol = 10;
  const fontCell = 11;
  const W = labelW + columns.length * cellW + padR;
  const H = headerH + rows.length * cellH + padB;

  let headerCols = "";
  columns.forEach(function (col, ci) {
    const x = labelW + ci * cellW + cellW / 2;
    headerCols +=
      '<text class="p1f-skill-level-heatmap__col-label" font-size="' + fontCol + '" x="' + x.toFixed(1) + '" y="17" text-anchor="middle">' +
      ftEscAttr(col.label || String(col.key || "")) + "</text>";
  });

  let body = "";
  rows.forEach(function (row, ri) {
    const y = headerH + ri * cellH;
    const rowLabel = String(row.label || "").length > 22
      ? String(row.label).slice(0, 21) + "\u2026"
      : (row.label || "");
    body +=
      '<text class="p1f-skill-level-heatmap__row-label" font-size="' + fontRow + '" x="' + (labelW - 8) + '" y="' + (y + cellH / 2).toFixed(1) + '" text-anchor="end" dominant-baseline="middle">' +
      "<title>" + ftEscAttr(row.label || "") + "</title>" +
      ftEscAttr(rowLabel) + "</text>";
    columns.forEach(function (col, ci) {
      const cell = (cells[ri] && cells[ri][ci]) || null;
      const x = labelW + ci * cellW;
      const level = cell && cell.level != null ? Number(cell.level) : null;
      const fill = level != null ? ftSkillLevelColor(level) : "#ffffff";
      const textColor = level != null ? ftSkillLevelTextColor(level) : "";
      const levelLabel = level != null ? (FT_SKILL_LEVEL_LABELS[level] || "") : "";
      const tip = level != null
        ? row.label + " \u00b7 " + col.label + ": Level " + level + " (" + levelLabel + ")"
        : row.label + " \u00b7 " + col.label + ": nicht geplant";
      body +=
        '<rect class="p1f-skill-level-heatmap__cell" x="' + x + '" y="' + y + '" width="' + cellW + '" height="' + cellH + '" fill="' + fill + '" stroke="#cbd5e1" stroke-width="1">' +
        "<title>" + ftEscAttr(tip) + "</title></rect>";
      if (level != null) {
        body +=
          '<text class="p1f-skill-level-heatmap__cell-text" font-size="' + fontCell + '" font-weight="600" fill="' + textColor + '" x="' + (x + cellW / 2).toFixed(1) + '" y="' + (y + cellH / 2).toFixed(1) + '" text-anchor="middle" dominant-baseline="middle">' +
          ftEscAttr(String(level)) + "</text>";
      }
    });
  });

  const ariaLabel = meta?.label || "Skill-Level-Heatmap";
  return (
    '<svg class="p1f-skill-level-heatmap__svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + ftEscAttr(ariaLabel) + '">' +
    '<line class="p1f-skill-level-heatmap__axis" x1="' + labelW + '" y1="' + headerH + '" x2="' + W + '" y2="' + headerH + '"/>' +
    headerCols +
    body +
    "</svg>"
  );
}

function renderFortschrittAllUnitsLegend(timelineData) {
  const items = (timelineData?.units || [])
    .map((row, index) => {
      if (!row.hasData) return "";
      const color = FORTSCHRITT_UNIT_COLORS[index % FORTSCHRITT_UNIT_COLORS.length];
      return `<span class="fortschritt-timeline-legend-item"><i class="ft-tl-unit-dot" style="background:${color}"></i>${esc(row.unit)}</span>`;
    })
    .filter(Boolean)
    .join("");
  if (!items) return "";
  return `<div class="fortschritt-timeline-legend fortschritt-timeline-legend--global"><span class="ft-tl-legend-units-label">Units:</span>${items}</div>`;
}

function renderFortschrittTimeline(timelineData, allUnits, opts = {}) {
  const isP1 = opts.mode === "p1";
  const years = timelineData?.years || ftPlanningYears();
  const kpiKeys = ["umsatz", "headcount", "zertifizierung"];
  const kpiLabels = {
    umsatz: "Umsatz (TEUR)",
    headcount: "Headcount",
    zertifizierung: "Zertifizierungsquote (%)",
  };

  const charts = kpiKeys
    .map((key) => {
      const seriesList = ftTimelineSeriesForKpi(timelineData, key, allUnits);
      const kpiMeta = (timelineData.kpis || []).find((k) => k.key === key) || {
        key,
        label: kpiLabels[key],
        unit: key === "umsatz" ? "TEUR" : key === "zertifizierung" ? "%" : "MA",
      };
      return `<div class="fortschritt-timeline-chart">
        <h4 class="fortschritt-timeline-chart__title">${esc(kpiMeta.label || kpiLabels[key])}</h4>
        ${renderFortschrittTimelineSvg(kpiMeta, years, seriesList)}
      </div>`;
    })
    .join("");

  const yr = years[0] + "\u2013" + years[years.length - 1];
  const y0 = years[0];
  const yN = years[years.length - 1];
  const sollSource = isP1 ? "Planung NEW (p1Year-Meilensteine)" : "Plan-Meilensteinen";
  const subtitle = allUnits
    ? "Alle Standard-Units \u00b7 SOLL aus " + sollSource + ", IST linear " + y0 + "\u2192" + yN
    : `Unit: ${esc(timelineData.unit || fortschrittUnit())} \u00b7 SOLL aus ${sollSource}, IST linear ${y0}\u2192${yN}`;
  const legendColor = allUnits ? "#334155" : FORTSCHRITT_UNIT_COLORS[0];
  const title = isP1 ? "Zeitstrahl \u00b7 Planung NEW " + yr : "Zeitstrahl \u00b7 Unit-Planung " + yr;
  const tip = ftZeitstrahlTip(years, isP1 ? "p1" : "classic");

  return `<div class="card fortschritt-timeline-card">
    ${fortschrittSectionHeader(title, "Zeitstrahl \u2013 Klicken f\u00fcr Erkl\u00e4rung", tip)}
    <p class="fortschritt-hint">${subtitle}</p>
    ${renderFortschrittTimelineStyleLegend(legendColor, "fortschritt-timeline-style--global", opts)}
    ${allUnits ? renderFortschrittAllUnitsLegend(timelineData) : ""}
    <div class="fortschritt-timeline-grid">${charts}</div>
  </div>`;
}

const STANDARD_DEMO_UNITS = [
  "SAP Infrastructure",
  "SAP Engineers",
  "SAP Integration",
  "SAP Architecture",
];

async function fetchDemoUnitNames() {
  try {
    const data = await api("/api/demo/status?all=true");
    if (Array.isArray(data?.demoUnits) && data.demoUnits.length) {
      return data.demoUnits;
    }
    if (Array.isArray(data?.units) && data.units.length) {
      return data.units.map((row) => row.unit).filter(Boolean);
    }
  } catch (_e) {
    /* fallback below */
  }
  return [...STANDARD_DEMO_UNITS];
}

function isAdminDemoBulkEnabled() {
  return Boolean(typeof isAdmin !== "undefined" && isAdmin);
}

function isDemoAllUnitsOverviewMode() {
  return typeof isSuperAdminViewAll === "function" && isSuperAdminViewAll();
}

async function fetchDemoStatusForCurrentView() {
  if (isDemoAllUnitsOverviewMode()) {
    const data = await api("/api/demo/status?all=true");
    if (data?.all !== true) {
      throw new Error("Ungültige Demo-Status-Antwort (keine Gesamtübersicht).");
    }
    return { mode: "all", data };
  }
  const unit = fortschrittUnit();
  if (!unit) {
    return { mode: "none", data: null };
  }
  const data = await api(`/api/demo/status?unit=${encodeURIComponent(unit)}`);
  return { mode: "unit", unit, data };
}

function demoAllUnitsStatusSummary(data) {
  const units = Array.isArray(data?.units) ? data.units : [];
  const activeCount =
    typeof data?.activeCount === "number"
      ? data.activeCount
      : units.filter((row) => row.active).length;
  const totalUnits =
    typeof data?.totalUnits === "number"
      ? data.totalUnits
      : units.length || (Array.isArray(data?.demoUnits) ? data.demoUnits.length : 0);
  return { activeCount, totalUnits, units };
}

function updateFortschrittDemoControls() {
  const isAdmin = isAdminDemoBulkEnabled();
  const onAll = isDemoAllUnitsOverviewMode();
  const loadBtn = document.getElementById("btnFortschrittDemoLoad");
  const loadAllBtn = document.getElementById("btnFortschrittDemoLoadAll");
  const removeBtn = document.getElementById("btnFortschrittDemoRemove");
  const removeAllBtn = document.getElementById("btnFortschrittDemoRemoveAll");
  if (loadBtn) loadBtn.style.display = !isAdmin || !onAll ? "" : "none";
  if (loadAllBtn) loadAllBtn.style.display = isAdmin && onAll ? "" : "none";
  if (removeBtn) removeBtn.style.display = !isAdmin || !onAll ? "" : "none";
  if (removeAllBtn) removeAllBtn.style.display = isAdmin && onAll ? "" : "none";
}

function demoPhase1Breakdown(data) {
  const portfolio = data.portfolioEntries ?? 0;
  const organisation = data.organisationEntries ?? 0;
  const skill = data.skillEntries ?? 0;
  const total = data.phase1DemoEntries ?? portfolio + organisation + skill;
  return { portfolio, organisation, skill, total };
}

function demoPhaseExtras(data) {
  return {
    planCount: data.planCount ?? (data.backcastingDemoPlan ? 1 : 0),
    milestoneCount: data.milestoneCount ?? 0,
    phase3Year: data.phase3Year ?? 2026,
    phase3KpiCount: data.phase3KpiCount ?? 0,
    phase3SkillGapCount: data.phase3SkillGapCount ?? 0,
    phase3Evaluations: data.phase3Evaluations ?? 0,
  };
}

function demoMetaLineParts(data, options = {}) {
  const breakdown = demoPhase1Breakdown(data);
  const phase2 = demoPhaseExtras(data);
  const parts = [`${breakdown.total} Phase-1-Einträge`];
  if (options.includeBreakdown) {
    parts.push(`Portfolio ${breakdown.portfolio}`, `Org. ${breakdown.organisation}`, `Skills ${breakdown.skill}`);
  }
  parts.push(
    `${phase2.planCount} Plan${phase2.planCount === 1 ? "" : "e"}`,
    `${phase2.milestoneCount} Meilensteine`,
    `${phase2.phase3Evaluations} Phase-3-Auswertungen (${phase2.phase3Year})`
  );
  return parts.join(" · ");
}

function demoLoadStatusLabel(status) {
  if (status === "loading") return "Lädt…";
  if (status === "done") return "✓ Geladen";
  if (status === "error") return "Fehler";
  return "Wartet";
}

function demoLoadStatusClass(status) {
  return `demo-load-status demo-load-status--${status || "pending"}`;
}

function setDemoLoadProgress(title, units) {
  demoLoadPanelState = { phase: "loading", title, units: units.map((row) => ({ ...row })) };
  paintDemoLoadPanelUI();
}

function finalizeDemoLoadPanel(title, units) {
  demoLoadPanelState = { phase: "done", title, units: units.map((row) => ({ ...row })) };
  paintDemoLoadPanelUI();
}

function applyDemoLoadResultToRow(row, result) {
  Object.assign(row, result, {
    status: "done",
    loadStatus: "done",
    entryCount: result.phase1DemoEntries ?? result.entryCount ?? 0,
    phase1DemoEntries: result.phase1DemoEntries ?? result.entryCount ?? 0,
  });
}

function normalizeDemoLoadRow(row, status = {}) {
  const merged = { ...row, ...status, unit: row.unit || status.unit };
  const breakdown = demoPhase1Breakdown(merged);
  const phase2 = demoPhaseExtras(merged);
  return {
    ...merged,
    ...breakdown,
    phase1DemoEntries: merged.phase1DemoEntries ?? merged.entryCount ?? breakdown.total,
    portfolioEntries: merged.portfolioEntries ?? breakdown.portfolio,
    organisationEntries: merged.organisationEntries ?? breakdown.organisation,
    skillEntries: merged.skillEntries ?? breakdown.skill,
    planCount: phase2.planCount,
    milestoneCount: phase2.milestoneCount,
    phase3Year: phase2.phase3Year,
    phase3KpiCount: phase2.phase3KpiCount,
    phase3SkillGapCount: phase2.phase3SkillGapCount,
    phase3Evaluations: phase2.phase3Evaluations,
    status: merged.status || "done",
    loadStatus: merged.loadStatus || merged.status || "done",
  };
}

async function refreshDemoLoadRowFromStatus(row) {
  if (row.status !== "done" || !row.unit) return row;
  try {
    const data = await api(`/api/demo/status?unit=${encodeURIComponent(row.unit)}`);
    if (!data || data.error) return row;
    return normalizeDemoLoadRow(row, data);
  } catch (_e) {
    return row;
  }
}

async function syncDemoLoadPanelFromStatus() {
  if (!demoLoadPanelState?.units?.length) return;
  const rows = demoLoadPanelState.units;
  if (rows.length > 1 && isAdminDemoBulkEnabled()) {
    try {
      const data = await api("/api/demo/status?all=true");
      if (data?.all === true && Array.isArray(data.units)) {
        demoLoadPanelState.units = rows.map((row) => {
          if (row.status !== "done") return row;
          const status = data.units.find((item) => item.unit === row.unit);
          return status ? normalizeDemoLoadRow(row, status) : row;
        });
        return;
      }
    } catch (_e) {
      /* Einzelabruf unten */
    }
  }
  demoLoadPanelState.units = await Promise.all(rows.map((row) => refreshDemoLoadRowFromStatus(row)));
}

async function finalizeDemoLoadPanelFromStatus(title, units) {
  demoLoadPanelState = { phase: "done", title, units: units.map((row) => ({ ...row })) };
  await syncDemoLoadPanelFromStatus();
  paintDemoLoadPanelUI();
}

function clearDemoLoadPanel() {
  demoLoadPanelState = null;
  const root = document.getElementById("demoDatenLoadStatus");
  if (!root) return;
  root.className = "demo-daten-load-status demo-daten-load-status--empty";
  root.innerHTML = `<div class="demo-daten-load-status__inner">
    <p class="demo-daten-load-status__title">Keine Demo-Daten geladen</p>
    <p class="demo-daten-load-status__meta">Demo-Daten wurden entfernt.</p>
  </div>`;
}

function buildDemoLoadProgressHtml(progress) {
  const rows = (progress.units || []).map((row) => normalizeDemoLoadRow(row));
  const doneCount = (progress.units || []).filter((row) => row.status === "done").length;
  const total = progress.units?.length || 0;
  const meta =
    total > 0
      ? `${doneCount}/${total} Units abgeschlossen · Phase 1 + Phase 2 je Unit`
      : "";
  const doneHint =
    progress.phase === "done"
      ? `<p class="demo-daten-load-status__meta">Register <strong>Fortschritt</strong> zeigt den IST/SOLL-Vergleich auf Basis der Phase-1-Planung.</p>`
      : "";
  return `<div class="demo-daten-load-status__inner">
    <p class="demo-daten-load-status__title">${esc(progress.title || "Demo-Daten werden geladen…")}</p>
    ${meta ? `<p class="demo-daten-load-status__meta">${esc(meta)}</p>` : ""}
    ${doneHint}
    ${renderDemoUnitsBreakdownTable(rows, { showLoadStatus: true })}
  </div>`;
}

function paintDemoLoadPanelUI() {
  if (!demoLoadPanelState) return;
  const isDone = demoLoadPanelState.phase === "done";
  const innerHtml = buildDemoLoadProgressHtml(demoLoadPanelState);
  const statusClass = isDone ? "demo-daten-load-status--active" : "demo-daten-load-status--loading";

  const root = document.getElementById("demoDatenLoadStatus");
  if (root) {
    root.className = `demo-daten-load-status ${statusClass}`;
    root.innerHTML = innerHtml;
  }
}

function buildDemoStatusInnerHtml(data, options = {}) {
  const { mode, unit } = options;

  if (mode === "all" && data) {
    const { activeCount, totalUnits, units } = demoAllUnitsStatusSummary(data);
    const totals = data.totals || {};
    const phase1 =
      totals.phase1DemoEntries ?? units.reduce((sum, row) => sum + (row.phase1DemoEntries || 0), 0);
    const phase2 = {
      plans: totals.planCount ?? units.reduce((sum, row) => sum + (row.planCount || 0), 0),
      milestones: totals.milestoneCount ?? units.reduce((sum, row) => sum + (row.milestoneCount || 0), 0),
      phase3: totals.phase3Evaluations ?? units.reduce((sum, row) => sum + (row.phase3Evaluations || 0), 0),
      phase3Kpis: totals.phase3KpiCount ?? units.reduce((sum, row) => sum + (row.phase3KpiCount || 0), 0),
      phase3SkillGaps:
        totals.phase3SkillGapCount ?? units.reduce((sum, row) => sum + (row.phase3SkillGapCount || 0), 0),
      phase3Year: units.find((row) => row.phase3Year)?.phase3Year ?? 2026,
    };

    if (!data.active) {
      return {
        className: "demo-daten-load-status demo-daten-load-status--empty",
        html: `<div class="demo-daten-load-status__inner">
          <p class="demo-daten-load-status__title">Keine Demo-Daten geladen</p>
          <p class="demo-daten-load-status__meta">0/${totalUnits || units.length || 0} Standard-Units · 0 Einträge · 0 Meilensteine · 0 Phase-3-Auswertungen</p>
          ${renderDemoUnitsBreakdownTable(units)}
        </div>`,
      };
    }

    return {
      className: "demo-daten-load-status demo-daten-load-status--active",
      html: `<div class="demo-daten-load-status__inner">
        <p class="demo-daten-load-status__title">Demo-Daten geladen · Alle Units</p>
        <p class="demo-daten-load-status__meta">${activeCount}/${totalUnits} Standard-Units · ${phase1} Phase-1-Einträge · ${phase2.milestones} Meilensteine · ${phase2.phase3} Phase-3-Auswertungen (${phase2.phase3Year})</p>
        ${renderDemoLoadStatGrid({
          phase1,
          portfolio: totals.portfolioEntries ?? 0,
          organisation: totals.organisationEntries ?? 0,
          skill: totals.skillEntries ?? 0,
          plans: phase2.plans,
          milestones: phase2.milestones,
          phase3Evaluations: phase2.phase3,
          phase3Kpis: phase2.phase3Kpis,
          phase3SkillGaps: phase2.phase3SkillGaps,
          phase3Year: phase2.phase3Year,
        })}
        ${renderDemoUnitsBreakdownTable(units)}
      </div>`,
    };
  }

  if (mode === "none" || !unit) {
    return {
      className: "demo-daten-load-status demo-daten-load-status--empty",
      html: `<div class="demo-daten-load-status__inner">
        <p class="demo-daten-load-status__title">Keine Unit gewählt</p>
        <p class="demo-daten-load-status__meta">Bitte im Filter oben eine Unit auswählen, um den Demo-Stand zu sehen.</p>
      </div>`,
    };
  }

  const breakdown = demoPhase1Breakdown(data);
  const phase2 = demoPhaseExtras(data);

  if (!data?.active) {
    return {
      className: "demo-daten-load-status demo-daten-load-status--empty",
      html: `<div class="demo-daten-load-status__inner">
        <p class="demo-daten-load-status__title">Keine Demo-Daten für „${esc(unit)}“</p>
        <p class="demo-daten-load-status__meta">0 Phase-1-Einträge · 0 Meilensteine · 0 Phase-3-Auswertungen</p>
      </div>`,
    };
  }

  return {
    className: "demo-daten-load-status demo-daten-load-status--active",
    html: `<div class="demo-daten-load-status__inner">
      <p class="demo-daten-load-status__title">Demo-Daten geladen · ${esc(unit)}</p>
      <p class="demo-daten-load-status__meta">${demoMetaLineParts(data)}</p>
      ${renderDemoLoadStatGrid({
        phase1: breakdown.total,
        portfolio: breakdown.portfolio,
        organisation: breakdown.organisation,
        skill: breakdown.skill,
        plans: phase2.planCount,
        milestones: phase2.milestoneCount,
        phase3Evaluations: phase2.phase3Evaluations,
        phase3Kpis: phase2.phase3KpiCount,
        phase3SkillGaps: phase2.phase3SkillGapCount,
        phase3Year: phase2.phase3Year,
      })}
      ${renderDemoUnitsBreakdownTable([{ unit, ...data }])}
    </div>`,
  };
}

function renderDemoLoadStatGrid(stats) {
  const year = stats.phase3Year ?? 2026;
  return `<div class="demo-daten-load-status__grid">
    <div class="demo-daten-load-status__stat"><b>${stats.phase1}</b><span>Phase 1 · Einträge gesamt</span></div>
    <div class="demo-daten-load-status__stat"><b>${stats.portfolio}</b><span>Phase 1 · Portfolio</span></div>
    <div class="demo-daten-load-status__stat"><b>${stats.organisation}</b><span>Phase 1 · Organisation</span></div>
    <div class="demo-daten-load-status__stat"><b>${stats.skill}</b><span>Phase 1 · Skills</span></div>
    <div class="demo-daten-load-status__stat"><b>${stats.plans}</b><span>Phase 2 · Pläne</span></div>
    <div class="demo-daten-load-status__stat"><b>${stats.milestones}</b><span>Phase 2 · Meilensteine</span></div>
    <div class="demo-daten-load-status__stat"><b>${stats.phase3Evaluations}</b><span>Phase 3 · Auswertungen (${year})</span></div>
    <div class="demo-daten-load-status__stat"><b>${stats.phase3Kpis}</b><span>Phase 3 · KPI-Vergleiche</span></div>
    <div class="demo-daten-load-status__stat"><b>${stats.phase3SkillGaps}</b><span>Phase 3 · Skill-Gaps</span></div>
  </div>`;
}

function renderDemoUnitsBreakdownTable(units, options = {}) {
  const showLoadStatus = Boolean(options.showLoadStatus);
  const rows = units
    .map((row) => {
      const normalized = normalizeDemoLoadRow(row);
      const phase2 = demoPhaseExtras(normalized);
      const progressCell = showLoadStatus
        ? `<td class="${demoLoadStatusClass(row.loadStatus)}" title="${esc(row.loadError || "")}">${esc(demoLoadStatusLabel(row.loadStatus))}${row.loadError ? ` · ${esc(row.loadError)}` : ""}</td>`
        : `<td>${row.active ? "✓" : "–"}</td>`;
      return `<tr>
        <td>${esc(row.unit)}</td>
        ${progressCell}
        <td>${row.phase1DemoEntries ?? row.total ?? 0}</td>
        <td>${row.portfolioEntries ?? row.portfolio ?? 0}</td>
        <td>${row.organisationEntries ?? row.organisation ?? 0}</td>
        <td>${row.skillEntries ?? row.skill ?? 0}</td>
        <td>${phase2.planCount}</td>
        <td>${phase2.milestoneCount}</td>
        <td>${phase2.phase3Evaluations}</td>
        <td>${phase2.phase3KpiCount}</td>
        <td>${phase2.phase3SkillGapCount}</td>
      </tr>`;
    })
    .join("");
  const progressHead = showLoadStatus ? '<th rowspan="2">Fortschritt</th>' : '<th rowspan="2">Aktiv</th>';
  return `<div class="demo-daten-load-status__table-wrap">
    <table class="demo-daten-table">
      <thead>
        <tr>
          <th rowspan="2">Unit</th>
          ${progressHead}
          <th colspan="4">Phase 1</th>
          <th colspan="2">Phase 2</th>
          <th colspan="3">Phase 3</th>
        </tr>
        <tr>
          <th>Ges.</th>
          <th>Portfolio</th>
          <th>Org.</th>
          <th>Skills</th>
          <th>Pläne</th>
          <th>Meilensteine</th>
          <th>Auswert.</th>
          <th>KPIs</th>
          <th>Skill-Gaps</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

async function renderDemoDatenLoadStatus() {
  const root = document.getElementById("demoDatenLoadStatus");
  if (!root) return;
  if (demoLoadPanelState) {
    if (demoLoadPanelState.phase === "done") {
      await syncDemoLoadPanelFromStatus();
    }
    paintDemoLoadPanelUI();
    return;
  }

  try {
    const { mode, unit, data } = await fetchDemoStatusForCurrentView();
    let allUnitsNote = "";

    if (mode === "unit" && unit && isAdminDemoBulkEnabled()) {
      try {
        const allData = await api("/api/demo/status?all=true");
        if (allData?.all === true && allData.active) {
          const { activeCount, totalUnits } = demoAllUnitsStatusSummary(allData);
          if (totalUnits > 0) {
            allUnitsNote = `<p class="demo-daten-load-status__meta">Gesamt über alle Standard-Units: ${activeCount}/${totalUnits} mit Demo-Daten.</p>`;
          }
        }
      } catch (_e) {
        /* ignore */
      }
    }

    const panel = buildDemoStatusInnerHtml(data, { mode, unit });
    root.className = panel.className;
    root.innerHTML =
      mode === "unit" && unit && data?.active
        ? panel.html.replace("</div>", `${allUnitsNote}</div>`)
        : mode === "unit" && unit && !data?.active
          ? panel.html.replace("</div>", `${allUnitsNote}</div>`)
          : panel.html;
  } catch (_e) {
    /* Panel unverändert lassen */
  }
}

async function refreshFortschrittDemoStatus() {
  updateFortschrittDemoControls();

  if (document.getElementById("demoDatenLoadStatus")) {
    await renderDemoDatenLoadStatus();
  }
}

async function loadDemoUnitsSequential(demoUnits) {
  const progress = demoUnits.map((unit) => ({ unit, status: "pending" }));
  setDemoLoadProgress("Demo-Daten werden vorbereitet…", progress);

  const results = [];
  for (const unit of demoUnits) {
    const row = progress.find((item) => item.unit === unit);
    if (!row) continue;
    row.status = "loading";
    setDemoLoadProgress(`Lade Demo-Daten für „${unit}"…`, progress);
    try {
      const result = await api("/api/demo/load", {
        method: "POST",
        body: JSON.stringify({ unit }),
      });
      applyDemoLoadResultToRow(row, result);
      Object.assign(row, await refreshDemoLoadRowFromStatus(row));
      results.push(result);
    } catch (error) {
      row.status = "error";
      row.error = error.message || "Fehler";
    }
    setDemoLoadProgress(`Demo-Daten für „${unit}" ${row.status === "done" ? "geladen" : "fehlgeschlagen"}…`, progress);
  }

  return { results, progress };
}

