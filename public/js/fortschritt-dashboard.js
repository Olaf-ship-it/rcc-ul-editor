/**
 * Management-Dashboard: IST (Phase 1) vs. SOLL (Backcasting)
 */

let fortschrittYear = new Date().getFullYear();
let fortschrittYearAll = true;
let fortschrittSnapshot = null;
let fortschrittInitDone = false;
let gesamtfortschrittInitDone = false;
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
    await loadGesamtfortschrittDashboard();
  } else if (document.getElementById("page-fortschritt")?.classList.contains("active")) {
    if (filterMode !== "all") {
      await ensureFortschrittViewUnit();
    }
    await loadFortschrittDashboard();
    await refreshFortschrittDemoStatus();
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
  await prepareFortschrittView();
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
    views: ["Gesamtfortschritt", "Detail"],
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
    calc: "IST = ein aktueller Gesamtumsatz; Zeitstrahl: lineare Projektion 2026→2029 zum SOLL 2029",
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
    views: ["Gesamtfortschritt", "Detail"],
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
    calc: "IST = aktueller Headcount; Zeitstrahl: lineare Projektion zum SOLL 2029",
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
    views: ["Gesamtfortschritt", "Detail"],
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
    calc: "Detail: IST ≥ SOLL = auf Plan; Zeitstrahl: lineare Projektion der Quote",
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
    views: ["Detail"],
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
    calc: "Gap = Ø Level IST − Mindest-Level SOLL (nur Detailfortschritt, nicht im Zeitstrahl)",
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
      <h4>Ablauf Detailfortschritt (IST vs. SOLL)</h4>
      ${pipelineDetail}
      <h4>Feldzuordnung je Kennzahl</h4>
      <p style="color:var(--rc-muted);font-size:.72rem;margin:0 0 .5rem">
        Links: Erfassungsfelder aus der <strong>Statusaufnahme (Phase 1)</strong>.
        Rechts: Ziel-Felder in <strong>Plan-Meilensteinen (Phase 2)</strong> (<code>kind = wsYear</code>, gefiltert nach <code>jahr</code>).
      </p>
      ${mappingRows}
      <p class="ft-methodik-note">
        Gemeinsame Server-Logik: <code>server/dashboard-service.js</code> (<code>aggregatePhase1Entries</code>, <code>aggregatePlanForYear</code>, <code>buildDashboardTimeline</code> / <code>buildDashboardSnapshot</code>).
        Zeitstrahl: Register <em>Gesamtfortschritt</em>. IST/SOLL-Details und Skill-Lücken: Register <em>Detailfortschritt</em>.
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
  return ["page-fortschritt", "page-gesamtfortschritt"];
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

  const W = 960;
  const H = 300;
  const pad = { l: 58, r: 14, t: 16, b: 52 };

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
      return `<text class="ft-tl-axis-label" x="${pad.l - 8}" y="${y}" text-anchor="end" dominant-baseline="middle">${ftFormatTimelineTick(tick, unit)}</text>`;
    })
    .join("");

  const yTitleX = 14;
  const yTitleY = (pad.t + (H - pad.b)) / 2;
  const yTitle = `<text class="ft-tl-axis-title" x="${yTitleX}" y="${yTitleY}" transform="rotate(-90 ${yTitleX} ${yTitleY})" text-anchor="middle">${ftEscAttr(yAxisLabel)}</text>`;

  const xQuarterLabels = quarters
    .map((slot, index) => {
      const x = xAt(index).toFixed(1);
      return `<text class="ft-tl-axis-label ft-tl-x-q-label" x="${x}" y="${H - pad.b + 14}" text-anchor="middle">${slot.label || "Q" + slot.quarter}</text>`;
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
      return `<text class="ft-tl-axis-label ft-tl-x-year-label" x="${x}" y="${H - 6}" text-anchor="middle">${slot.year}</text>`;
    })
    .join("");

  const yearDividers = quarters
    .map((slot, index) => {
      if (index === 0 || quarters[index - 1].year === slot.year) return "";
      const x = xAt(index).toFixed(1);
      return `<line class="ft-tl-grid ft-tl-grid--year" x1="${x}" y1="${pad.t}" x2="${x}" y2="${H - pad.b}"/>`;
    })
    .join("");

  const xTitle = `<text class="ft-tl-axis-title ft-tl-axis-title--x" x="${(pad.l + W - pad.r) / 2}" y="${H - 2}" text-anchor="middle">${ftEscAttr(xAxisLabel)}</text>`;

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
  return `<svg class="ft-tl-svg ft-tl-svg--quarter" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ftEscAttr(ariaLabel)}">
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

async function loadFortschrittTimeline() {
  if (isFortschrittAllUnitsMode()) {
    return api("/api/dashboard/timeline?all=true");
  }
  const unit = fortschrittUnit();
  if (!unit) return null;
  return api(`/api/dashboard/timeline?unit=${encodeURIComponent(unit)}`);
}

function fortschrittStatusClass(status) {
  if (status === "ok") return "fortschritt-status--ok";
  if (status === "warn") return "fortschritt-status--warn";
  if (status === "risk") return "fortschritt-status--risk";
  return "fortschritt-status--neutral";
}

function fortschrittStatusLabel(status) {
  if (status === "ok") return "auf Plan";
  if (status === "warn") return "leicht hinter Plan";
  if (status === "risk") return "kritisch";
  return "–";
}

function renderFortschrittPortfolioBars(mix, totalTeur) {
  if (!mix?.length || !totalTeur) {
    return '<p class="fortschritt-empty">Keine Portfolio-Umsätze erfasst.</p>';
  }
  const colors = ["#3498db", "#9b59b6", "#1abc9c", "#e67e22", "#e74c3c", "#95a5a6"];
  const bars = mix
    .map((m, i) => {
      const w = totalTeur > 0 ? (m.teur / totalTeur) * 100 : 0;
      return `<div class="fortschritt-bar-seg" style="width:${w}%;background:${colors[i % colors.length]}" title="${esc(m.label)}: ${formatUmsatzTeur(m.teur)}"></div>`;
    })
    .join("");
  const legend = mix
    .map(
      (m, i) =>
        `<div class="fortschritt-legend-item"><span class="fortschritt-swatch" style="background:${colors[i % colors.length]}"></span>${esc(m.label)} · ${formatUmsatzTeur(m.teur)} (${m.pct}%)</div>`
    )
    .join("");
  return `<div class="fortschritt-bar">${bars}</div><div class="fortschritt-legend">${legend}</div>`;
}

function renderFortschrittKpiCards(comparison) {
  const kpis = comparison?.kpis || [];
  if (!kpis.length) {
    return '<p class="fortschritt-empty">Keine vergleichbaren Ziel-KPIs im Plan für dieses Jahr.</p>';
  }
  return `<div class="fortschritt-kpi-grid">${kpis
    .map((k) => {
      const istLabel = k.key === "zertifizierung" ? `${k.ist}%` : k.ist;
      const sollLabel = k.key === "zertifizierung" ? `${k.soll}%` : k.soll;
      const delta =
        k.deltaPct != null
          ? `${k.deltaPct > 0 ? "+" : ""}${k.deltaPct}% vs. Ziel`
          : k.delta != null
            ? `${k.delta > 0 ? "+" : ""}${k.delta} vs. Ziel`
            : "";
      return `<div class="stat-card fortschritt-kpi ${fortschrittStatusClass(k.status)}">
        <div class="fortschritt-kpi-label">${esc(k.label)}</div>
        <div class="fortschritt-kpi-values"><span>IST <b>${esc(String(istLabel))}</b></span><span>SOLL <b>${esc(String(sollLabel))}</b></span></div>
        <div class="fortschritt-kpi-meta">${esc(delta)} · ${esc(fortschrittStatusLabel(k.status))}</div>
      </div>`;
    })
    .join("")}</div>`;
}

function renderFortschrittSkillGaps(gaps) {
  if (!gaps?.length) {
    return '<p class="fortschritt-empty">Keine Skill-Zielvorgaben im Plan für dieses Jahr.</p>';
  }
  const rows = gaps
    .map(
      (g) => `<tr class="${fortschrittStatusClass(g.status)}">
      <td>${esc(g.category)}</td>
      <td>${g.istAvg != null ? esc(String(g.istAvg)) : "–"}</td>
      <td>${esc(String(g.sollMin))}</td>
      <td>${g.gap != null ? esc(String(g.gap)) : "–"}</td>
      <td>${esc(fortschrittStatusLabel(g.status))}</td>
    </tr>`
    )
    .join("");
  return `<div class="tbl-wrap"><table class="entries fortschritt-table">
    <thead><tr><th>Kategorie</th><th>Ø Level IST</th><th>Min. Level SOLL</th><th>Gap</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderFortschrittMilestones(milestones) {
  if (!milestones?.length) {
    return '<p class="fortschritt-empty">Keine Meilensteine im Plan für dieses Jahr.</p>';
  }
  return milestones
    .slice(0, 8)
    .map(
      (m) => `<div class="fortschritt-milestone">
      <div class="fortschritt-milestone-head"><b>${esc(m.workstream || "–")}</b>
        ${m.ziel_umsatz_teur != null ? `<span class="fortschritt-tag">${formatUmsatzTeur(m.ziel_umsatz_teur)}</span>` : ""}
        ${m.ziel_headcount != null ? `<span class="fortschritt-tag">${esc(String(m.ziel_headcount))} HC</span>` : ""}
      </div>
      <div class="fortschritt-milestone-body">${esc((m.bezeichnung || m.ergebnis || m.kpis || "–").slice(0, 120))}${(m.bezeichnung || m.ergebnis || "").length > 120 ? "…" : ""}</div>
    </div>`
    )
    .join("");
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

async function ensureFortschrittViewUnit() {
  if (fortschrittUnit()) return fortschrittUnit();
  if (isDemoAllUnitsOverviewMode()) return "";

  try {
    if (isAdminDemoBulkEnabled()) {
      const data = await api("/api/demo/status?all=true");
      const firstActive = (data.units || []).find((row) => row.active);
      if (firstActive?.unit) {
        focusFilterAfterDemoLoad(firstActive.unit);
        return firstActive.unit;
      }
    } else {
      const unit = String(
        (typeof getSaveUnit === "function" ? getSaveUnit() : "") || currentUnit || ""
      ).trim();
      if (unit) {
        const data = await api(`/api/demo/status?unit=${encodeURIComponent(unit)}`);
        if (data.active) return unit;
      }
    }
  } catch (_e) {
    /* ignore */
  }
  return "";
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
      ? `<p class="demo-daten-load-status__meta">Register <strong>Detailfortschritt</strong> zeigt den IST/SOLL-Vergleich aus Phase 1 (Erfassung) und Phase 2 (Backcasting-Plan).</p>`
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

function fortschrittYearLabel() {
  if (fortschrittYearAll) {
    const years = window._rcPlanningYears || [2026, 2027, 2028, 2029];
    return "Alle (" + years[0] + "\u2013" + years[years.length - 1] + ")";
  }
  return String(fortschrittYear);
}

function readFortschrittYearSelect() {
  const yearEl = document.getElementById("fortschrittYear");
  if (!yearEl) return;
  fortschrittYearAll = yearEl.value === "all";
  if (!fortschrittYearAll) {
    fortschrittYear = parseInt(yearEl.value, 10) || fortschrittYear;
  }
}

function renderFortschrittYearBlock(year, plan, comparison) {
  const kpiCount = comparison?.kpis?.length || 0;
  const msCount = plan?.milestoneCount || 0;
  return `<details class="ft-year-section" open>
    <summary class="ft-year-section__head"><strong>Jahr ${year}</strong>
      <span class="ft-year-section__meta">${kpiCount} KPIs · ${msCount} Meilensteine</span>
    </summary>
    <div class="ft-year-section__body">
      <div class="card">
        ${fortschrittSectionHeader("IST vs. SOLL – Kennzahlen", "Kennzahlen – Klicken für Erklärung", FORTSCHRITT_TIPS.kennzahlen)}
        ${renderFortschrittKpiCards(comparison)}
      </div>
      <div class="card">
        ${fortschrittSectionHeader("Skill-Lücken (IST vs. Plan)", "Skill-Lücken – Klicken für Erklärung", FORTSCHRITT_TIPS.skillGaps)}
        ${renderFortschrittSkillGaps(comparison?.skillGaps)}
      </div>
      <div class="card">
        ${fortschrittSectionHeader(`Plan-Meilensteine ${year}`, "Plan-Meilensteine – Klicken für Erklärung", FORTSCHRITT_TIPS.meilensteine)}
        ${renderFortschrittMilestones(plan?.milestones)}
      </div>
    </div>
  </details>`;
}

function renderFortschrittSnapshotAllYears(data, unit) {
  const p1 = data.phase1 || {};
  const stichtag = p1.stichtag ? `Stichtag: ${p1.stichtag}` : "Kein Stichtag";
  const planTitle = data.planMeta?.bereich ? data.planMeta.bereich : "Kein Plan";
  const demoTag = data.demo?.active
    ? ' · <span style="color:#b7791f;font-weight:600">Demo-Daten aktiv</span>'
    : "";
  const byYear = data.byYear || [];
  const yearBlocks = byYear.map((row) => renderFortschrittYearBlock(row.year, row.plan, row.comparison)).join("");

  return `
    <div class="fortschritt-meta card">
      ${fortschrittSectionHeader("Kontext & Datenstand", "Kontext – Klicken für Erklärung", FORTSCHRITT_TIPS.kontext)}
      <div><strong>Unit:</strong> ${esc(unit)} · <strong>Jahr:</strong> ${esc(fortschrittYearLabel())}</div>
      <div class="fortschritt-meta-sub">${esc(stichtag)} · Plan: ${esc(planTitle)} · ${data.totalMilestones || 0} Meilensteine gesamt${demoTag}</div>
    </div>

    <div class="fortschritt-two-col">
      <div class="card">
        ${fortschrittSectionHeader("Portfolio-Umsatzmix (IST)", "Portfolio-Umsatzmix – Klicken für Erklärung", FORTSCHRITT_TIPS.portfolio)}
        <p class="fortschritt-hint">Gesamt: ${formatUmsatzTeur(p1.portfolio?.totalTeur || 0)} · ${p1.portfolio?.count || 0} Positionen</p>
        ${renderFortschrittPortfolioBars(p1.portfolio?.mix, p1.portfolio?.totalTeur)}
      </div>
      <div class="card">
        ${fortschrittSectionHeader("Organisation & Skills (IST)", "Organisation & Skills – Klicken für Erklärung", FORTSCHRITT_TIPS.orgSkills)}
        <ul class="fortschritt-facts">
          <li>Headcount: <b>${p1.organisation?.headcount ?? "–"}</b></li>
          <li>Mitarbeiter Skill-Matrix: <b>${p1.skills?.employeeCount ?? 0}</b></li>
          <li>Zertifizierungsquote: <b>${p1.skills?.zertifiziertQuote != null ? p1.skills.zertifiziertQuote + "%" : "–"}</b></li>
        </ul>
      </div>
    </div>

    ${yearBlocks || '<div class="card"><p class="fortschritt-empty">Keine Plan-Daten für die gewählten Jahre vorhanden.</p></div>'}`;
}

function renderFortschrittSnapshotDetails(data, unit) {
  const p1 = data.phase1 || {};
  const plan = data.plan || {};
  const stichtag = p1.stichtag ? `Stichtag: ${p1.stichtag}` : "Kein Stichtag";
  const planTitle = data.planMeta?.bereich ? data.planMeta.bereich : "Kein Plan";
  const demoTag = data.demo?.active
    ? ' · <span style="color:#b7791f;font-weight:600">Demo-Daten aktiv</span>'
    : "";

  return `
    <div class="fortschritt-meta card">
      ${fortschrittSectionHeader("Kontext & Datenstand", "Kontext – Klicken für Erklärung", FORTSCHRITT_TIPS.kontext)}
      <div><strong>Unit:</strong> ${esc(unit)} · <strong>Jahr:</strong> ${esc(fortschrittYearLabel())}</div>
      <div class="fortschritt-meta-sub">${esc(stichtag)} · Plan: ${esc(planTitle)} · ${plan.milestoneCount || 0} Meilensteine${demoTag}</div>
    </div>

    <div class="card">
      ${fortschrittSectionHeader("IST vs. SOLL – Kennzahlen", "Kennzahlen – Klicken für Erklärung", FORTSCHRITT_TIPS.kennzahlen)}
      ${renderFortschrittKpiCards(data.comparison)}
    </div>

    <div class="fortschritt-two-col">
      <div class="card">
        ${fortschrittSectionHeader("Portfolio-Umsatzmix (IST)", "Portfolio-Umsatzmix – Klicken für Erklärung", FORTSCHRITT_TIPS.portfolio)}
        <p class="fortschritt-hint">Gesamt: ${formatUmsatzTeur(p1.portfolio?.totalTeur || 0)} · ${p1.portfolio?.count || 0} Positionen</p>
        ${renderFortschrittPortfolioBars(p1.portfolio?.mix, p1.portfolio?.totalTeur)}
      </div>
      <div class="card">
        ${fortschrittSectionHeader("Organisation & Skills (IST)", "Organisation & Skills – Klicken für Erklärung", FORTSCHRITT_TIPS.orgSkills)}
        <ul class="fortschritt-facts">
          <li>Headcount: <b>${p1.organisation?.headcount ?? "–"}</b>${plan.zielHeadcount != null ? ` (Ziel ${plan.zielHeadcount})` : ""}</li>
          <li>Mitarbeiter Skill-Matrix: <b>${p1.skills?.employeeCount ?? 0}</b></li>
          <li>Zertifizierungsquote: <b>${p1.skills?.zertifiziertQuote != null ? p1.skills.zertifiziertQuote + "%" : "–"}</b></li>
        </ul>
      </div>
    </div>

    <div class="card">
      ${fortschrittSectionHeader("Skill-Lücken (IST vs. Plan)", "Skill-Lücken – Klicken für Erklärung", FORTSCHRITT_TIPS.skillGaps)}
      ${renderFortschrittSkillGaps(data.comparison?.skillGaps)}
    </div>

    <div class="card">
      ${fortschrittSectionHeader(`Plan-Meilensteine ${fortschrittYear}`, "Plan-Meilensteine – Klicken für Erklärung", FORTSCHRITT_TIPS.meilensteine)}
      ${renderFortschrittMilestones(plan.milestones)}
    </div>`;
}

async function loadGesamtfortschrittDashboard() {
  const unit = fortschrittUnit();
  const allUnits = isFortschrittAllUnitsMode();
  const root = document.getElementById("gesamtfortschrittContent");
  if (!root) return;

  const emptyMsg =
    '<div class="card"><p class="fortschritt-empty">Bitte im <strong>Filter</strong> oben eine Unit wählen oder „Alle Units“ (Admin), um den Zeitstrahl anzuzeigen.</p></div>';

  if (!unit && !allUnits) {
    root.innerHTML = emptyMsg;
    initFortschrittTipPopovers();
    return;
  }

  root.innerHTML = '<div class="card"><p class="fortschritt-empty">Lade Zeitstrahl…</p></div>';

  try {
    const timelineData = await loadFortschrittTimeline();
    root.innerHTML = timelineData ? renderFortschrittTimeline(timelineData, allUnits) : emptyMsg;
    initFortschrittTipPopovers();
  } catch (error) {
    root.innerHTML = `<div class="card"><p class="fortschritt-empty" style="color:var(--rc-red)">${esc(error.message || "Zeitstrahl laden fehlgeschlagen")}</p></div>`;
    initFortschrittTipPopovers();
  }
}

async function loadFortschrittDashboard() {
  const unit = fortschrittUnit();
  readFortschrittYearSelect();

  const root = document.getElementById("fortschrittContent");
  if (!root) return;

  const _yr = (window._rcPlanningYears||[2026,2029]);
  const _yrRange = _yr[0] + "–" + _yr.slice(-1)[0];
  const emptyDetailsMsg =
    '<div class="card"><p class="fortschritt-empty">Bitte im <strong>Filter</strong> oben eine konkrete Unit wählen (nicht „Alle Units“), um IST/SOLL-Details zu vergleichen.<br><span style="font-size:.78rem;color:var(--rc-muted)">Den Zeitstrahl ' + _yrRange + ' finden Sie im Register <strong>Gesamtfortschritt</strong>. Demo-Daten pflegen Admins im Admin-Bereich unter dem Register <strong>Demo-Daten</strong>.</span></p></div>';

  if (!unit) {
    root.innerHTML = emptyDetailsMsg;
    initFortschrittTipPopovers();
    return;
  }

  root.innerHTML = '<div class="card"><p class="fortschritt-empty">Lade Vergleichsdaten…</p></div>';

  try {
    const yearQuery = fortschrittYearAll ? "all" : String(fortschrittYear);
    const data = await api(
      `/api/dashboard/snapshot?unit=${encodeURIComponent(unit)}&year=${encodeURIComponent(yearQuery)}`
    );
    fortschrittSnapshot = data;
    root.innerHTML = data.allYears
      ? renderFortschrittSnapshotAllYears(data, unit)
      : renderFortschrittSnapshotDetails(data, unit);
    initFortschrittTipPopovers();
  } catch (error) {
    root.innerHTML = `<div class="card"><p class="fortschritt-empty" style="color:var(--rc-red)">${esc(error.message || "Laden fehlgeschlagen")}</p></div>`;
    initFortschrittTipPopovers();
  }
}

async function loadFortschrittDemoDataAll() {
  if (!isAdminDemoBulkEnabled()) return;
  if (!isDemoAllUnitsOverviewMode()) {
    toast('Bitte im Filter oben „Alle Units“ wählen, um Demo-Daten für alle Standard-Units zu laden.', "#e74c3c", 5000);
    document.getElementById("headerUnitSwitcher")?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    return;
  }
  if (
    !confirm(
      "Demo-Daten für alle Standard-Units laden?\n\nSAP Infrastructure, SAP Engineers, SAP Integration, SAP Architecture\n\nBestehende Demo-Einträge dieser Units werden ersetzt."
    )
  ) {
    return;
  }
  try {
    const demoUnits = await fetchDemoUnitNames();
    const { progress } = await loadDemoUnitsSequential(demoUnits);
    const failed = progress.some((row) => row.status === "error");
    await finalizeDemoLoadPanelFromStatus(
      failed ? "Demo-Daten teilweise geladen" : "Demo-Daten geladen · Phase 1 + Phase 2 · Alle Units",
      progress
    );
    await afterDemoDataChanged({ filterMode: "all" });
    if (failed) {
      toast("Einige Demo-Daten konnten nicht geladen werden.", "#e74c3c", 5000);
    }
  } catch (error) {
    if (demoLoadPanelState?.units?.length) {
      await finalizeDemoLoadPanelFromStatus("Demo-Laden fehlgeschlagen", demoLoadPanelState.units);
    }
    toast(error.message || "Demo laden fehlgeschlagen.", "#e74c3c", 4000);
  }
}

async function removeFortschrittDemoDataAll() {
  if (!isAdminDemoBulkEnabled()) return;
  if (
    !confirm(
      "Alle Demo-Daten für die Standard-Units entfernen?\n\nEchte Erfassungen und Planungen bleiben erhalten."
    )
  ) {
    return;
  }
  try {
    await api("/api/demo/remove?allUnits=true", { method: "DELETE" });
    clearDemoLoadPanel();
    await afterDemoDataChanged({
      filterMode: "all",
      showFortschritt: false,
    });
  } catch (error) {
    toast(error.message || "Demo entfernen fehlgeschlagen.", "#e74c3c", 4000);
  }
}

async function loadFortschrittDemoData() {
  const unit = fortschrittUnit();
  if (!unit) {
    if (isAdminDemoBulkEnabled()) {
      toast(
        "Im Filter ist „Alle Units“ aktiv. Nutzen Sie „Demo alle Units laden“ oder wählen Sie eine konkrete Unit.",
        "#e74c3c",
        5000
      );
    } else {
      toast("Bitte zuerst eine Unit im Filter wählen.", "#e74c3c", 4000);
    }
    return;
  }
  if (!confirm(`Demo-Daten für „${unit}“ laden? Bestehende Demo-Einträge dieser Unit werden ersetzt.`)) return;
  setDemoLoadProgress(`Lade Demo-Daten für „${unit}"…`, [{ unit, status: "loading" }]);
  try {
    const result = await api("/api/demo/load", {
      method: "POST",
      body: JSON.stringify({ unit }),
    });
    await finalizeDemoLoadPanelFromStatus(`Demo-Daten geladen · Phase 1 + Phase 2 · ${unit}`, [
      {
        unit,
        status: "done",
        ...result,
        entryCount: result.phase1DemoEntries ?? result.entryCount ?? 0,
        phase1DemoEntries: result.phase1DemoEntries ?? result.entryCount ?? 0,
      },
    ]);
    await afterDemoDataChanged({ filterMode: "unit", unit });
  } catch (error) {
    await finalizeDemoLoadPanelFromStatus(`Demo-Laden fehlgeschlagen · ${unit}`, [
      { unit, status: "error", error: error.message || "Fehler" },
    ]);
    toast(error.message || "Demo laden fehlgeschlagen.", "#e74c3c", 4000);
  }
}

async function removeFortschrittDemoData() {
  const unit = fortschrittUnit();
  if (!unit) {
    toast("Bitte zuerst eine Unit wählen.", "#e74c3c", 4000);
    return;
  }
  if (!confirm(`Alle Demo-Daten für „${unit}“ entfernen? Echte Erfassungen bleiben erhalten.`)) return;
  try {
    await api(`/api/demo/remove?unit=${encodeURIComponent(unit)}`, { method: "DELETE" });
    clearDemoLoadPanel();
    await afterDemoDataChanged({
      filterMode: "unit",
      unit,
      showFortschritt: false,
    });
  } catch (error) {
    toast(error.message || "Demo entfernen fehlgeschlagen.", "#e74c3c", 4000);
  }
}

function initDemoDatenPage() {
  if (!demoDatenInitDone) {
    demoDatenInitDone = true;
    document.getElementById("btnFortschrittDemoLoad")?.addEventListener("click", () => loadFortschrittDemoData());
    document.getElementById("btnFortschrittDemoLoadAll")?.addEventListener("click", () => loadFortschrittDemoDataAll());
    document.getElementById("btnFortschrittDemoRemove")?.addEventListener("click", () => removeFortschrittDemoData());
    document.getElementById("btnFortschrittDemoRemoveAll")?.addEventListener("click", () => removeFortschrittDemoDataAll());
  }
  updateFortschrittDemoControls();
  void refreshFortschrittDemoStatus();
}

function renderDemoDatenPage() {
  initDemoDatenPage();
}

async function prepareGesamtfortschrittView() {
  if (!gesamtfortschrittInitDone) {
    gesamtfortschrittInitDone = true;
    document.getElementById("btnGesamtfortschrittReload")?.addEventListener("click", () => void prepareGesamtfortschrittView());
  }
  initFortschrittTipPopovers();
  await refreshEntries();
  await loadGesamtfortschrittDashboard();
}

function renderGesamtfortschrittDashboard() {
  void prepareGesamtfortschrittView();
}

async function populateFortschrittYearSelect() {
  const sel = document.getElementById("fortschrittYear");
  if (!sel) return;
  const prev = sel.value;
  try {
    const cfg = typeof loadPlanningYears === "function"
      ? await loadPlanningYears()
      : await fetch("/api/config/planning-years", { credentials: "include" }).then(r => r.json());
    const years = cfg?.years || [2026, 2027, 2028, 2029];
    window._rcPlanningYears = years;
    sel.innerHTML = "";
    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = "Alle Jahre (" + years[0] + "\u2013" + years[years.length - 1] + ")";
    sel.appendChild(allOpt);
    years.forEach(y => {
      const o = document.createElement("option");
      o.value = y; o.textContent = y;
      sel.appendChild(o);
    });
    if (prev && [...sel.options].some((o) => o.value === prev)) {
      sel.value = prev;
    } else {
      sel.value = "all";
    }
    readFortschrittYearSelect();
  } catch (_e) {
    if (!sel.children.length) {
      const allOpt = document.createElement("option");
      allOpt.value = "all";
      allOpt.textContent = "Alle Jahre";
      sel.appendChild(allOpt);
      [2026, 2027, 2028, 2029].forEach(y => {
        const o = document.createElement("option");
        o.value = y; o.textContent = y; sel.appendChild(o);
      });
    }
  }
}

async function prepareFortschrittView() {
  if (!fortschrittInitDone) {
    fortschrittInitDone = true;
    await populateFortschrittYearSelect();
    const yearEl = document.getElementById("fortschrittYear");
    if (yearEl) yearEl.addEventListener("change", () => void prepareFortschrittView());
    document.getElementById("btnFortschrittReload")?.addEventListener("click", () => void prepareFortschrittView());
  }
  await refreshEntries();
  await ensureFortschrittViewUnit();
  await loadFortschrittDashboard();
  await refreshFortschrittDemoStatus();
}

function renderFortschrittDashboard() {
  void prepareFortschrittView();
}
