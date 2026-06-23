/**
 * Management-Dashboard: IST (Phase 1) vs. SOLL (Backcasting)
 */

let fortschrittYear = new Date().getFullYear();
let fortschrittSnapshot = null;
let fortschrittInitDone = false;
let demoDatenInitDone = false;
let fortschrittTipDocBound = false;

async function afterDemoDataChanged() {
  await refreshEntries();
  await refreshFortschrittDemoStatus();
  await refreshFortschrittDemoInfoStatus();
  if (document.getElementById("page-fortschritt")?.classList.contains("active")) {
    await loadFortschrittDashboard();
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

function canManageAllDemoUnits() {
  return typeof isAdmin !== "undefined" && isAdmin && typeof isSuperAdminViewAll === "function" && isSuperAdminViewAll();
}

function updateFortschrittDemoControls() {
  const showAll = canManageAllDemoUnits();
  const loadBtn = document.getElementById("btnFortschrittDemoLoad");
  const loadAllBtn = document.getElementById("btnFortschrittDemoLoadAll");
  const removeBtn = document.getElementById("btnFortschrittDemoRemove");
  const removeAllBtn = document.getElementById("btnFortschrittDemoRemoveAll");
  if (loadBtn) loadBtn.style.display = showAll ? "none" : "";
  if (loadAllBtn) loadAllBtn.style.display = showAll ? "" : "none";
  if (removeBtn) removeBtn.style.display = showAll ? "none" : "";
  if (removeAllBtn) removeAllBtn.style.display = showAll ? "" : "none";
}

async function refreshFortschrittDemoInfoStatus() {
  const box = document.getElementById("fortschrittDemoInfoStatus");
  if (!box) return;

  const unit = fortschrittUnit();
  if (!unit && canManageAllDemoUnits()) {
    try {
      const data = await api("/api/demo/status?all=true");
      if (!data.active) {
        box.className = "fortschritt-demo-info__status";
        box.innerHTML = "<strong>Aktueller Status:</strong> Keine Demo-Daten in den Standard-Units.";
        return;
      }
      const rows = (data.units || [])
        .map(
          (row) =>
            `<li><b>${esc(row.unit)}</b>: ${row.active ? `${row.phase1DemoEntries} Phase-1-Einträge${row.backcastingDemoPlan ? ", Backcasting-Plan" : ""}` : "keine Demo-Daten"}</li>`
        )
        .join("");
      box.className = "fortschritt-demo-info__status fortschritt-demo-info__status--active";
      box.innerHTML = `<strong>Aktueller Status:</strong> Demo aktiv in ${data.activeCount}/${data.totalUnits} Standard-Units.<ul>${rows}</ul>`;
    } catch (_e) {
      box.className = "fortschritt-demo-info__status";
      box.textContent = "Status konnte nicht geladen werden.";
    }
    return;
  }

  if (!unit) {
    box.className = "fortschritt-demo-info__status";
    box.innerHTML =
      "<strong>Aktueller Status:</strong> Keine Unit gewählt – bitte im Filter oben eine Unit auswählen.";
    return;
  }

  try {
    const data = await api(`/api/demo/status?unit=${encodeURIComponent(unit)}`);
    if (!data.active) {
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
  const unit = fortschrittUnit();
  const badge = document.getElementById("fortschrittDemoBadge");
  updateFortschrittDemoControls();

  if (badge) {
    if (!unit && canManageAllDemoUnits()) {
      try {
        const data = await api("/api/demo/status?all=true");
        badge.textContent = data.active
          ? `Demo aktiv in ${data.activeCount}/${data.totalUnits} Units`
          : "Keine Demo-Daten (alle Units)";
        badge.classList.toggle("fortschritt-demo-active", Boolean(data.active));
      } catch (_e) {
        badge.textContent = "Demo-Status unbekannt";
      }
    } else if (!unit) {
      badge.textContent = "Keine Unit gewählt";
      badge.classList.remove("fortschritt-demo-active");
    } else {
      try {
        const data = await api(`/api/demo/status?unit=${encodeURIComponent(unit)}`);
        badge.textContent = data.active
          ? `Demo aktiv (${data.phase1DemoEntries} Einträge${data.backcastingDemoPlan ? ", Plan" : ""})`
          : "Keine Demo-Daten";
        badge.classList.toggle("fortschritt-demo-active", Boolean(data.active));
      } catch (_e) {
        badge.textContent = "Demo-Status unbekannt";
      }
    }
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
      '<div class="card"><p class="fortschritt-empty">Bitte im <strong>Filter</strong> oben eine konkrete Unit wählen (nicht „Alle Units“), um IST/SOLL zu vergleichen.</p></div>';
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

    root.innerHTML = `
      <div class="fortschritt-meta card">
        ${fortschrittSectionHeader("Kontext & Datenstand", "Kontext – Klicken für Erklärung", FORTSCHRITT_TIPS.kontext)}
        <div><strong>Unit:</strong> ${esc(unit)} · <strong>Jahr:</strong> ${fortschrittYear}</div>
        <div class="fortschritt-meta-sub">${esc(stichtag)} · Plan: ${esc(planTitle)} · ${plan.milestoneCount || 0} Meilensteine</div>
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
  if (!canManageAllDemoUnits()) return;
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
    await afterDemoDataChanged();
    toast(result.message || "Demo-Daten für alle Units geladen.", "#27ae60", 4500);
  } catch (error) {
    toast(error.message || "Demo laden fehlgeschlagen.", "#e74c3c", 4000);
  }
}

async function removeFortschrittDemoDataAll() {
  if (!canManageAllDemoUnits()) return;
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
    toast("Bitte zuerst eine Unit wählen.", "#e74c3c", 4000);
    return;
  }
  if (!confirm(`Demo-Daten für „${unit}“ laden? Bestehende Demo-Einträge dieser Unit werden ersetzt.`)) return;
  try {
    const result = await api("/api/demo/load", {
      method: "POST",
      body: JSON.stringify({ unit }),
    });
    await afterDemoDataChanged();
    toast(result.message || "Demo-Daten geladen.", "#27ae60", 3500);
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
  void refreshFortschrittDemoInfoStatus();
}

function renderDemoDatenPage() {
  initDemoDatenPage();
}

function initFortschrittPage() {
  if (!fortschrittInitDone) {
    fortschrittInitDone = true;
    const yearEl = document.getElementById("fortschrittYear");
    if (yearEl) yearEl.addEventListener("change", () => loadFortschrittDashboard());
    document.getElementById("btnFortschrittReload")?.addEventListener("click", () => loadFortschrittDashboard());
  }
  initFortschrittTipPopovers();
  loadFortschrittDashboard();
}

function renderFortschrittDashboard() {
  initFortschrittPage();
}
