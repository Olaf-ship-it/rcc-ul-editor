/**
 * Management-Dashboard: IST (Phase 1) vs. SOLL (Backcasting)
 */

let fortschrittYear = new Date().getFullYear();
let fortschrittSnapshot = null;
let fortschrittInitDone = false;
let demoDatenInitDone = false;
let fortschrittTipDocBound = false;

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
  await refreshFortschrittDemoInfoStatus();

  if (filterMode === "all") {
    focusFilterAfterDemoLoad("all");
  } else if (filterMode === "unit" && unit) {
    focusFilterAfterDemoLoad(unit);
  } else {
    refreshPhase1ViewsAfterDataChange();
  }

  if (document.getElementById("page-fortschritt")?.classList.contains("active")) {
    if (filterMode !== "all") {
      await ensureFortschrittViewUnit();
    }
    await loadFortschrittDashboard();
    await refreshFortschrittDemoStatus();
  }
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

function closeFortschrittTipPopovers(exceptCard) {
  document.querySelectorAll("#page-fortschritt .ft-has-tip").forEach((card) => {
    if (exceptCard && card === exceptCard) return;
    card.classList.remove("ft-tip-open");
    card.setAttribute("aria-expanded", "false");
  });
}

function initFortschrittTipPopovers() {
  const root = document.getElementById("page-fortschritt");
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
      <div class="fortschritt-milestone-body">${esc((m.ergebnis || m.kpis || "–").slice(0, 120))}${(m.ergebnis || "").length > 120 ? "…" : ""}</div>
    </div>`
    )
    .join("");
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

function formatDemoAllUnitsBadge(data) {
  if (!data?.all) return "Demo-Status unbekannt";
  if (!data.active) return "Keine Demo-Daten (alle Units)";
  const { activeCount, totalUnits } = demoAllUnitsStatusSummary(data);
  return `Demo aktiv in ${activeCount}/${totalUnits} Standard-Units`;
}

function formatDemoUnitBadge(data, unit) {
  if (!data?.active) return "Keine Demo-Daten";
  const entries = data.phase1DemoEntries ?? 0;
  const plan = data.backcastingDemoPlan ? ", Plan" : "";
  const label = unit || data.unit || "";
  return label
    ? `Demo aktiv · ${label} (${entries} Einträge${plan})`
    : `Demo aktiv (${entries} Einträge${plan})`;
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

function renderDemoLoadStatGrid(stats) {
  return `<div class="demo-daten-load-status__grid">
    <div class="demo-daten-load-status__stat"><b>${stats.phase1}</b><span>Phase-1 Einträge</span></div>
    <div class="demo-daten-load-status__stat"><b>${stats.portfolio}</b><span>Portfolio</span></div>
    <div class="demo-daten-load-status__stat"><b>${stats.organisation}</b><span>Organisation</span></div>
    <div class="demo-daten-load-status__stat"><b>${stats.skill}</b><span>Skills</span></div>
    <div class="demo-daten-load-status__stat"><b>${stats.plans}</b><span>Backcasting-Pläne</span></div>
  </div>`;
}

function renderDemoUnitsBreakdownTable(units) {
  const rows = units
    .map((row) => {
      const breakdown = demoPhase1Breakdown(row);
      const plans = row.planCount ?? (row.backcastingDemoPlan ? 1 : 0);
      return `<tr>
        <td>${esc(row.unit)}</td>
        <td>${row.active ? "✓" : "–"}</td>
        <td>${breakdown.total}</td>
        <td>${breakdown.portfolio}</td>
        <td>${breakdown.organisation}</td>
        <td>${breakdown.skill}</td>
        <td>${plans}</td>
      </tr>`;
    })
    .join("");
  return `<div class="demo-daten-load-status__table-wrap">
    <table class="demo-daten-table">
      <thead>
        <tr>
          <th>Unit</th>
          <th>Aktiv</th>
          <th>Phase 1</th>
          <th>Portfolio</th>
          <th>Org.</th>
          <th>Skills</th>
          <th>Pläne</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

async function renderDemoDatenLoadStatus() {
  const root = document.getElementById("demoDatenLoadStatus");
  if (!root) return;

  try {
    const { mode, unit, data } = await fetchDemoStatusForCurrentView();

    if (mode === "all" && data) {
      const { activeCount, totalUnits, units } = demoAllUnitsStatusSummary(data);
      const totals = data.totals || {};
      const phase1 =
        totals.phase1DemoEntries ?? units.reduce((sum, row) => sum + (row.phase1DemoEntries || 0), 0);
      const plans = totals.planCount ?? units.reduce((sum, row) => sum + (row.planCount || 0), 0);

      root.className = `demo-daten-load-status${data.active ? " demo-daten-load-status--active" : " demo-daten-load-status--empty"}`;

      if (!data.active) {
        root.innerHTML = `<div class="demo-daten-load-status__inner">
          <p class="demo-daten-load-status__title">Keine Demo-Daten geladen</p>
          <p class="demo-daten-load-status__meta">0/${totalUnits || units.length || 0} Standard-Units · 0 Einträge · 0 Pläne</p>
        </div>`;
        return;
      }

      root.innerHTML = `<div class="demo-daten-load-status__inner">
        <p class="demo-daten-load-status__title">Demo-Daten geladen · Alle Units</p>
        <p class="demo-daten-load-status__meta">${activeCount}/${totalUnits} Standard-Units · ${phase1} Phase-1-Einträge · ${plans} Backcasting-Plan${plans === 1 ? "" : "e"}</p>
        ${renderDemoLoadStatGrid({
          phase1,
          portfolio: totals.portfolioEntries ?? 0,
          organisation: totals.organisationEntries ?? 0,
          skill: totals.skillEntries ?? 0,
          plans,
        })}
        ${renderDemoUnitsBreakdownTable(units)}
      </div>`;
      return;
    }

    if (mode === "none" || !unit) {
      root.className = "demo-daten-load-status demo-daten-load-status--empty";
      root.innerHTML = `<div class="demo-daten-load-status__inner">
        <p class="demo-daten-load-status__title">Keine Unit gewählt</p>
        <p class="demo-daten-load-status__meta">Bitte im Filter oben eine Unit auswählen, um den Demo-Stand zu sehen.</p>
      </div>`;
      return;
    }

    const breakdown = demoPhase1Breakdown(data);
    const plans = data.planCount ?? (data.backcastingDemoPlan ? 1 : 0);
    let allUnitsNote = "";
    if (isAdminDemoBulkEnabled()) {
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

    root.className = `demo-daten-load-status${data?.active ? " demo-daten-load-status--active" : " demo-daten-load-status--empty"}`;

    if (!data?.active) {
      root.innerHTML = `<div class="demo-daten-load-status__inner">
        <p class="demo-daten-load-status__title">Keine Demo-Daten für „${esc(unit)}“</p>
        <p class="demo-daten-load-status__meta">0 Phase-1-Einträge · 0 Backcasting-Pläne</p>
        ${allUnitsNote}
      </div>`;
      return;
    }

    root.innerHTML = `<div class="demo-daten-load-status__inner">
      <p class="demo-daten-load-status__title">Demo-Daten geladen · ${esc(unit)}</p>
      <p class="demo-daten-load-status__meta">${breakdown.total} Phase-1-Einträge · ${plans} Backcasting-Plan${plans === 1 ? "" : "e"}</p>
      ${allUnitsNote}
      ${renderDemoLoadStatGrid({
        phase1: breakdown.total,
        portfolio: breakdown.portfolio,
        organisation: breakdown.organisation,
        skill: breakdown.skill,
        plans,
      })}
    </div>`;
  } catch (_e) {
    root.className = "demo-daten-load-status";
    root.innerHTML =
      '<div class="demo-daten-load-status__inner">Demo-Status konnte nicht geladen werden.</div>';
  }
}

async function refreshFortschrittDemoInfoStatus() {
  const box = document.getElementById("fortschrittDemoInfoStatus");
  if (!box) return;

  try {
    const { mode, unit, data } = await fetchDemoStatusForCurrentView();
    if (mode === "all" && data) {
      if (!data.active) {
        box.className = "fortschritt-demo-info__status";
        box.innerHTML = "<strong>Aktueller Status:</strong> Keine Demo-Daten in den Standard-Units.";
        return;
      }
      const { activeCount, totalUnits, units } = demoAllUnitsStatusSummary(data);
      const rows = units
        .map(
          (row) =>
            `<li><b>${esc(row.unit)}</b>: ${row.active ? `${row.phase1DemoEntries} Phase-1-Einträge${row.backcastingDemoPlan ? ", Backcasting-Plan" : ""}` : "keine Demo-Daten"}</li>`
        )
        .join("");
      box.className = "fortschritt-demo-info__status fortschritt-demo-info__status--active";
      box.innerHTML = `<strong>Aktueller Status:</strong> Demo aktiv in ${activeCount}/${totalUnits} Standard-Units.<ul>${rows}</ul>`;
      return;
    }

    if (mode === "none" || !unit) {
      box.className = "fortschritt-demo-info__status";
      box.innerHTML =
        "<strong>Aktueller Status:</strong> Keine Unit gewählt – bitte im Filter oben eine Unit auswählen.";
      return;
    }

    if (!data?.active) {
      box.className = "fortschritt-demo-info__status";
      box.innerHTML = `<strong>Aktueller Status für „${esc(unit)}“:</strong> Keine Demo-Daten.`;
      return;
    }
    box.className = "fortschritt-demo-info__status fortschritt-demo-info__status--active";
    box.innerHTML = `<strong>Aktueller Status für „${esc(unit)}“:</strong> Demo aktiv – ${data.phase1DemoEntries} Phase-1-Einträge${data.backcastingDemoPlan ? ", Backcasting-Plan vorhanden" : ""}.`;
  } catch (_e) {
    box.className = "fortschritt-demo-info__status";
    box.textContent = "Status konnte nicht geladen werden.";
  }
}

async function refreshFortschrittDemoStatus() {
  const badge = document.getElementById("fortschrittDemoBadge");
  updateFortschrittDemoControls();

  if (badge) {
    try {
      const { mode, unit, data } = await fetchDemoStatusForCurrentView();
      if (mode === "all" && data) {
        badge.textContent = formatDemoAllUnitsBadge(data);
        badge.classList.toggle("fortschritt-demo-active", Boolean(data.active));
      } else if (mode === "unit" && data) {
        badge.textContent = formatDemoUnitBadge(data, unit);
        badge.classList.toggle("fortschritt-demo-active", Boolean(data.active));
      } else {
        badge.textContent = "Keine Unit gewählt";
        badge.classList.remove("fortschritt-demo-active");
      }
    } catch (_e) {
      badge.textContent = "Demo-Status unbekannt";
      badge.classList.remove("fortschritt-demo-active");
    }
  }

  if (document.getElementById("demoDatenLoadStatus")) {
    await renderDemoDatenLoadStatus();
  }

  const infoPanel = document.getElementById("page-demo-daten");
  if (infoPanel?.classList.contains("active")) {
    await refreshFortschrittDemoInfoStatus();
  }
}

async function loadFortschrittDashboard() {
  const unit = fortschrittUnit();
  const yearEl = document.getElementById("fortschrittYear");
  if (yearEl) fortschrittYear = parseInt(yearEl.value, 10) || fortschrittYear;

  const root = document.getElementById("fortschrittContent");
  if (!root) return;

  if (!unit) {
    root.innerHTML =
      '<div class="card"><p class="fortschritt-empty">Bitte im <strong>Filter</strong> oben eine konkrete Unit wählen (nicht „Alle Units“), um IST/SOLL zu vergleichen.<br><span style="font-size:.78rem;color:var(--rc-muted)">Demo-Daten werden nicht gelöscht – sie bleiben im Register <strong>Demo-Daten</strong> erhalten.</span></p></div>';
    initFortschrittTipPopovers();
    return;
  }

  root.innerHTML = '<div class="card"><p class="fortschritt-empty">Lade Vergleichsdaten…</p></div>';

  try {
    const data = await api(
      `/api/dashboard/snapshot?unit=${encodeURIComponent(unit)}&year=${fortschrittYear}`
    );
    fortschrittSnapshot = data;

    const p1 = data.phase1 || {};
    const plan = data.plan || {};
    const stichtag = p1.stichtag ? `Stichtag: ${p1.stichtag}` : "Kein Stichtag";
    const planTitle = data.planMeta?.bereich ? data.planMeta.bereich : "Kein Plan";

    const demoTag = data.demo?.active
      ? ' · <span style="color:#b7791f;font-weight:600">Demo-Daten aktiv</span>'
      : "";

    root.innerHTML = `
      <div class="fortschritt-meta card">
        ${fortschrittSectionHeader("Kontext & Datenstand", "Kontext – Klicken für Erklärung", FORTSCHRITT_TIPS.kontext)}
        <div><strong>Unit:</strong> ${esc(unit)} · <strong>Jahr:</strong> ${fortschrittYear}</div>
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
    const result = await api("/api/demo/load", {
      method: "POST",
      body: JSON.stringify({ allUnits: true }),
    });
    await afterDemoDataChanged({ filterMode: "all" });
    toast(
      (result.message || "Demo-Daten für alle Units geladen.") +
        " · Filter: Alle Units",
      "#27ae60",
      4500
    );
  } catch (error) {
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
    const result = await api("/api/demo/remove", {
      method: "DELETE",
      body: JSON.stringify({ allUnits: true }),
    });
    await afterDemoDataChanged();
    toast(
      `Demo entfernt (${result.removedEntries || 0} Einträge, ${result.removedPlans || 0} Pläne).`,
      "#27ae60",
      4500
    );
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
  try {
    const result = await api("/api/demo/load", {
      method: "POST",
      body: JSON.stringify({ unit }),
    });
    await afterDemoDataChanged({ filterMode: "unit", unit });
    toast((result.message || "Demo-Daten geladen.") + ` · Filter: ${unit}`, "#27ae60", 3500);
  } catch (error) {
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
    const result = await api("/api/demo/remove", {
      method: "DELETE",
      body: JSON.stringify({ unit }),
    });
    await afterDemoDataChanged();
    toast(
      `Demo entfernt (${result.removedEntries || 0} Einträge, ${result.removedPlans || 0} Pläne).`,
      "#27ae60",
      3500
    );
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

async function prepareFortschrittView() {
  if (!fortschrittInitDone) {
    fortschrittInitDone = true;
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
