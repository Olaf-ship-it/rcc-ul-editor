/**
 * Fortschritt NEW -- Phase-1-basierter IST/SOLL-Vergleich
 * Nutzt p1Year-Meilensteine aus "Planung NEW" (Phase 2)
 */

let _fnYear = new Date().getFullYear();
let _fnYearAll = false;
let _fnInitDone = false;
let _fnSnapshot = null;

const FN_AREAS = [
  { key: "portfolio", label: "Portfolio", icon: "\ud83d\udcbc" },
  { key: "gliederungen", label: "Organisation \u00b7 Gliederungen", icon: "\ud83c\udfe2" },
  { key: "rollen", label: "Organisation \u00b7 Rollen", icon: "\ud83d\udc54" },
  { key: "skills", label: "Skills", icon: "\ud83e\udde0" },
];

function fnEsc(s) {
  return String(s ?? "").replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function fnStatusClass(status) {
  if (status === "ok") return "fortschritt-kpi--ok";
  if (status === "warn") return "fortschritt-kpi--warn";
  if (status === "risk") return "fortschritt-kpi--risk";
  return "";
}

function fnStatusLabel(status) {
  if (status === "ok") return "Im Plan";
  if (status === "warn") return "Leichte Abweichung";
  if (status === "risk") return "Kritisch";
  return "Keine Daten";
}

function fnStatusIcon(status) {
  if (status === "ok") return "\u2705";
  if (status === "warn") return "\u26a0\ufe0f";
  if (status === "risk") return "\ud83d\udd34";
  return "\u2796";
}

function fnBarPct(ist, soll) {
  if (soll == null || soll <= 0 || ist == null) return 0;
  return Math.min(Math.round((ist / soll) * 100), 150);
}

function fnBarColor(status) {
  if (status === "ok") return "var(--rc-green, #22c55e)";
  if (status === "warn") return "var(--rc-orange, #f59e0b)";
  if (status === "risk") return "var(--rc-red, #ef4444)";
  return "var(--rc-muted, #94a3b8)";
}

function fnFormatNum(v) {
  if (v == null) return "\u2013";
  return String(Math.round(v * 10) / 10);
}

function fnParseNum(v) {
  if (v == null || v === "") return null;
  var n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function fnStatusFromDeltaPct(deltaPct) {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return "neutral";
  var d = -deltaPct;
  if (d >= -5) return "ok";
  if (d >= -15) return "warn";
  return "risk";
}

function fnCardTitle(item, ms) {
  var base = item.label || item.subcategory || "";
  var text = String(ms && ms.ergebnis || "").trim();
  return text ? base + " \u00b7 " + text : base;
}

function fnExpandItemToMilestoneCards(item, areaKey, planYear) {
  var msList = item.milestones && item.milestones.length ? item.milestones : [{}];
  return msList.map(function (ms) {
    var card = {
      subcategory: item.subcategory,
      label: fnCardTitle(item, ms),
      milestones: [ms],
      planYear: planYear,
    };
    if (areaKey === "portfolio") {
      var soll = fnParseNum(ms.ziel_umsatz_teur);
      var delta = soll != null ? item.istTeur - soll : null;
      var deltaPct = soll > 0 ? (delta / soll) * 100 : null;
      card.istTeur = item.istTeur;
      card.sollTeur = soll;
      card.delta = delta != null ? Math.round(delta * 10) / 10 : null;
      card.deltaPct = deltaPct;
      card.status = soll != null ? fnStatusFromDeltaPct(deltaPct) : "neutral";
    } else if (areaKey === "gliederungen") {
      var sollHc = fnParseNum(ms.ziel_headcount);
      var sollTeur = fnParseNum(ms.ziel_umsatz_teur);
      var hcDeltaPct = sollHc > 0 ? ((item.istHc - sollHc) / sollHc) * 100 : null;
      var teurDeltaPct = sollTeur > 0 ? ((item.istTeur - sollTeur) / sollTeur) * 100 : null;
      var worst = [hcDeltaPct, teurDeltaPct].filter(function (v) { return v != null; });
      var worstPct = worst.length ? Math.min.apply(null, worst) : null;
      card.istHc = item.istHc;
      card.istTeur = item.istTeur;
      card.sollHc = sollHc;
      card.sollTeur = sollTeur;
      card.status = worstPct != null ? fnStatusFromDeltaPct(worstPct) : "neutral";
    } else if (areaKey === "rollen") {
      var sollAnzahl = fnParseNum(ms.ziel_anzahl);
      var rolleDeltaPct = sollAnzahl > 0 ? ((item.istAnzahl - sollAnzahl) / sollAnzahl) * 100 : null;
      card.istAnzahl = item.istAnzahl;
      card.sollAnzahl = sollAnzahl;
      card.status = sollAnzahl != null ? fnStatusFromDeltaPct(rolleDeltaPct) : "neutral";
    } else if (areaKey === "skills") {
      var sollMin = fnParseNum(ms.ziel_skill_level_min);
      var sollAnteil = fnParseNum(ms.ziel_anteil_prozent);
      var gap = item.istAvg != null && sollMin != null ? item.istAvg - sollMin : null;
      card.istAvg = item.istAvg;
      card.sollMin = sollMin;
      card.sollAnteil = sollAnteil;
      card.gap = gap;
      card.status = gap == null ? "neutral" : gap >= 0 ? "ok" : gap >= -0.5 ? "warn" : "risk";
    }
    return card;
  });
}

function fnCollectAllYearsAreaItems(data, areaKey) {
  var items = [];
  (data.byYear || []).forEach(function (row) {
    ((row.p1Plan && row.p1Plan[areaKey]) || []).forEach(function (item) {
      fnExpandItemToMilestoneCards(item, areaKey, row.year).forEach(function (card) {
        items.push(card);
      });
    });
  });
  return items;
}

function fnSummaryFromItems(items) {
  var summary = { totalComparisons: items.length, milestoneCount: items.length, ok: 0, warn: 0, risk: 0, neutral: 0 };
  items.forEach(function (item) {
    summary[item.status || "neutral"] = (summary[item.status || "neutral"] || 0) + 1;
  });
  return summary;
}

function renderFnBar(ist, soll, status) {
  var pct = fnBarPct(ist, soll);
  var color = fnBarColor(status);
  var label = pct > 0 ? pct + "%" : "";
  return '<div class="p1f-bar">' +
    '<div class="p1f-bar__track">' +
    '<div class="p1f-bar__fill" style="width:' + Math.min(pct, 100) + '%;background:' + color + '"></div>' +
    '</div>' +
    '<span class="p1f-bar__label">' + label + '</span>' +
    '</div>';
}

function renderFnMilestones(milestones) {
  if (!milestones || !milestones.length) return "";
  var html = '<div class="p1f-milestones">';
  milestones.forEach(function (m) {
    html += '<div class="p1f-milestone">';
    html += '<span class="p1f-milestone__q">' + fnEsc(m.ziel_quartal || "\u2013") + '</span>';
    html += '<span class="p1f-milestone__text">' + fnEsc((m.ergebnis || "").slice(0, 120)) + '</span>';
    if (m.verantwortlich) html += '<span class="p1f-milestone__who">' + fnEsc(m.verantwortlich) + '</span>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function renderFnPortfolioCard(item) {
  var html = '<div class="p1f-card stat-card ' + fnStatusClass(item.status) + '">';
  html += '<div class="p1f-card__head">';
  html += '<span class="p1f-card__status">' + fnStatusIcon(item.status) + '</span>';
  html += '<span class="p1f-card__label">' + fnEsc(item.label || item.subcategory) + '</span>';
  if (item.planYear) html += '<span class="p1f-card__year">' + fnEsc(item.planYear) + '</span>';
  html += '</div>';
  html += '<div class="p1f-card__values">';
  html += '<span>IST <b>' + fnFormatNum(item.istTeur) + ' TEUR</b></span>';
  html += '<span>SOLL <b>' + fnFormatNum(item.sollTeur) + ' TEUR</b></span>';
  html += '</div>';
  html += renderFnBar(item.istTeur, item.sollTeur, item.status);
  html += '<div class="p1f-card__meta">' + fnEsc(fnStatusLabel(item.status));
  if (item.delta != null) html += ' \u00b7 \u0394 ' + (item.delta > 0 ? "+" : "") + fnFormatNum(item.delta) + ' TEUR';
  html += '</div>';
  html += renderFnMilestones(item.milestones);
  html += '</div>';
  return html;
}

function renderFnGliederungCard(item) {
  var html = '<div class="p1f-card stat-card ' + fnStatusClass(item.status) + '">';
  html += '<div class="p1f-card__head">';
  html += '<span class="p1f-card__status">' + fnStatusIcon(item.status) + '</span>';
  html += '<span class="p1f-card__label">' + fnEsc(item.subcategory) + '</span>';
  if (item.planYear) html += '<span class="p1f-card__year">' + fnEsc(item.planYear) + '</span>';
  html += '</div>';
  html += '<div class="p1f-card__values">';
  if (item.sollHc != null) {
    html += '<span>IST <b>' + fnFormatNum(item.istHc) + ' HC</b></span>';
    html += '<span>SOLL <b>' + fnFormatNum(item.sollHc) + ' HC</b></span>';
  }
  if (item.sollTeur != null) {
    html += '<span>IST <b>' + fnFormatNum(item.istTeur) + ' TEUR</b></span>';
    html += '<span>SOLL <b>' + fnFormatNum(item.sollTeur) + ' TEUR</b></span>';
  }
  html += '</div>';
  if (item.sollHc != null) html += renderFnBar(item.istHc, item.sollHc, item.status);
  html += '<div class="p1f-card__meta">' + fnEsc(fnStatusLabel(item.status)) + '</div>';
  html += renderFnMilestones(item.milestones);
  html += '</div>';
  return html;
}

function renderFnRolleCard(item) {
  var html = '<div class="p1f-card stat-card ' + fnStatusClass(item.status) + '">';
  html += '<div class="p1f-card__head">';
  html += '<span class="p1f-card__status">' + fnStatusIcon(item.status) + '</span>';
  html += '<span class="p1f-card__label">' + fnEsc(item.subcategory) + '</span>';
  if (item.planYear) html += '<span class="p1f-card__year">' + fnEsc(item.planYear) + '</span>';
  html += '</div>';
  html += '<div class="p1f-card__values">';
  html += '<span>IST <b>' + fnFormatNum(item.istAnzahl) + '</b></span>';
  html += '<span>SOLL <b>' + fnFormatNum(item.sollAnzahl) + '</b></span>';
  html += '</div>';
  html += renderFnBar(item.istAnzahl, item.sollAnzahl, item.status);
  html += '<div class="p1f-card__meta">' + fnEsc(fnStatusLabel(item.status)) + '</div>';
  html += renderFnMilestones(item.milestones);
  html += '</div>';
  return html;
}

function renderFnSkillCard(item) {
  var html = '<div class="p1f-card stat-card ' + fnStatusClass(item.status) + '">';
  html += '<div class="p1f-card__head">';
  html += '<span class="p1f-card__status">' + fnStatusIcon(item.status) + '</span>';
  html += '<span class="p1f-card__label">' + fnEsc(item.subcategory) + '</span>';
  if (item.planYear) html += '<span class="p1f-card__year">' + fnEsc(item.planYear) + '</span>';
  html += '</div>';
  html += '<div class="p1f-card__values">';
  html += '<span>\u00d8 Level IST <b>' + fnFormatNum(item.istAvg) + '</b></span>';
  html += '<span>Min. Level SOLL <b>' + fnFormatNum(item.sollMin) + '</b></span>';
  if (item.sollAnteil != null) html += '<span>Ziel-Anteil <b>' + fnFormatNum(item.sollAnteil) + '%</b></span>';
  html += '</div>';
  if (item.sollMin != null && item.istAvg != null) {
    html += renderFnBar(item.istAvg, item.sollMin, item.status);
  }
  html += '<div class="p1f-card__meta">' + fnEsc(fnStatusLabel(item.status));
  if (item.gap != null) html += ' \u00b7 Gap ' + (item.gap >= 0 ? "+" : "") + fnFormatNum(item.gap);
  html += '</div>';
  html += renderFnMilestones(item.milestones);
  html += '</div>';
  return html;
}

function renderFnArea(areaDef, items) {
  if (!items || !items.length) return "";
  var msCount = items.reduce(function (n, item) { return n + ((item.milestones && item.milestones.length) || 0); }, 0);
  var html = '<details class="p1f-area" open>';
  html += '<summary class="p1f-area__head">';
  html += '<span class="p1f-area__icon">' + areaDef.icon + '</span>';
  html += '<span class="p1f-area__label">' + fnEsc(areaDef.label) + '</span>';
  html += '<span class="p1f-area__count">' + items.length + ' Eintr\u00e4ge \u00b7 ' + msCount + ' Meilensteine</span>';
  html += '</summary>';
  html += '<div class="p1f-area__body fortschritt-kpi-grid">';
  items.forEach(function (item) {
    if (areaDef.key === "portfolio") html += renderFnPortfolioCard(item);
    else if (areaDef.key === "gliederungen") html += renderFnGliederungCard(item);
    else if (areaDef.key === "rollen") html += renderFnRolleCard(item);
    else if (areaDef.key === "skills") html += renderFnSkillCard(item);
  });
  html += '</div></details>';
  return html;
}

function renderFnSummary(summary) {
  var count = summary && (summary.milestoneCount || summary.totalComparisons || 0);
  if (!summary || count === 0) {
    return '<div class="card"><p class="fortschritt-empty">Keine Phase-1-basierten Plan-Meilensteine f\u00fcr ' + (_fnYearAll ? "die gew\u00e4hlten Jahre" : "dieses Jahr") + ' vorhanden.</p></div>';
  }
  var html = '<div class="p1f-summary card">';
  html += '<div class="p1f-summary__title">\u00dcbersicht \u00b7 ' + count + ' Meilensteine';
  if (summary.milestoneCount && summary.totalComparisons && summary.milestoneCount !== summary.totalComparisons) {
    html += ' (' + summary.totalComparisons + ' Unterkategorien)';
  }
  html += '</div>';
  html += '<div class="p1f-summary__grid">';
  html += '<span class="p1f-summary__chip p1f-summary__chip--ok">\u2705 ' + (summary.ok || 0) + ' Im Plan</span>';
  html += '<span class="p1f-summary__chip p1f-summary__chip--warn">\u26a0\ufe0f ' + (summary.warn || 0) + ' Abweichung</span>';
  html += '<span class="p1f-summary__chip p1f-summary__chip--risk">\ud83d\udd34 ' + (summary.risk || 0) + ' Kritisch</span>';
  if (summary.neutral) html += '<span class="p1f-summary__chip">\u2796 ' + summary.neutral + ' Keine Daten</span>';
  html += '</div></div>';
  return html;
}

function renderFnIstOverview(p1Ist) {
  if (!p1Ist) return "";
  var html = '<details class="p1f-area"><summary class="p1f-area__head">';
  html += '<span class="p1f-area__icon">\ud83d\udcca</span>';
  html += '<span class="p1f-area__label">Phase-1 IST-\u00dcbersicht (aktuelle Erfassung)</span>';
  html += '</summary><div class="p1f-area__body">';

  if (p1Ist.portfolio && p1Ist.portfolio.length) {
    html += '<div class="p1f-ist-section"><strong>Portfolio</strong><ul class="fortschritt-facts">';
    p1Ist.portfolio.forEach(function (p) {
      html += '<li>' + fnEsc(p.label || p.subcategory) + ': <b>' + fnFormatNum(p.umsatz_teur) + ' TEUR</b></li>';
    });
    html += '</ul></div>';
  }
  if (p1Ist.gliederungen && p1Ist.gliederungen.length) {
    html += '<div class="p1f-ist-section"><strong>Organisation \u00b7 Gliederungen</strong><ul class="fortschritt-facts">';
    p1Ist.gliederungen.forEach(function (g) {
      html += '<li>' + fnEsc(g.subcategory) + ': <b>' + fnFormatNum(g.headcount) + ' HC</b> \u00b7 ' + fnFormatNum(g.umsatz_teur) + ' TEUR</li>';
    });
    html += '</ul></div>';
  }
  if (p1Ist.rollen && p1Ist.rollen.length) {
    html += '<div class="p1f-ist-section"><strong>Organisation \u00b7 Rollen</strong><ul class="fortschritt-facts">';
    p1Ist.rollen.forEach(function (r) {
      html += '<li>' + fnEsc(r.subcategory) + ': <b>' + fnFormatNum(r.anzahl) + ' MA</b></li>';
    });
    html += '</ul></div>';
  }
  if (p1Ist.skills && p1Ist.skills.length) {
    html += '<div class="p1f-ist-section"><strong>Skills</strong><ul class="fortschritt-facts">';
    p1Ist.skills.forEach(function (s) {
      html += '<li>' + fnEsc(s.subcategory) + ': \u00d8 Level <b>' + fnFormatNum(s.avgLevel) + '</b> (' + (s.count || 0) + ' Bewertungen)</li>';
    });
    html += '</ul></div>';
  }

  html += '</div></details>';
  return html;
}

function fnYearLabel() {
  if (_fnYearAll) {
    var years = window._rcPlanningYears || [2026, 2027, 2028, 2029];
    return "Alle (" + years[0] + "\u2013" + years[years.length - 1] + ")";
  }
  return String(_fnYear);
}

function readFnYearSelect() {
  var yearEl = document.getElementById("fortschrittNewYear");
  if (!yearEl) return;
  _fnYearAll = yearEl.value === "all";
  if (!_fnYearAll) {
    _fnYear = parseInt(yearEl.value, 10) || _fnYear;
  }
}

function renderFnDashboardAllYears(data, unit) {
  var html = '<div class="p1f-dashboard">';
  var allItems = [];

  html += '<div class="p1f-context card">';
  html += '<div><strong>Unit:</strong> ' + fnEsc(unit) + ' \u00b7 <strong>Jahr:</strong> ' + fnEsc(fnYearLabel()) + '</div>';
  html += '</div>';

  FN_AREAS.forEach(function (areaDef) {
    allItems = allItems.concat(fnCollectAllYearsAreaItems(data, areaDef.key));
  });

  html += renderFnSummary(fnSummaryFromItems(allItems));

  var hasComparisons = false;
  FN_AREAS.forEach(function (areaDef) {
    var items = fnCollectAllYearsAreaItems(data, areaDef.key);
    if (items.length) hasComparisons = true;
    html += renderFnArea(areaDef, items);
  });

  if (!hasComparisons && data.p1Ist) {
    html += renderFnIstOverview(data.p1Ist);
  }

  html += '</div>';
  return html;
}

function renderFnDashboard(data, unit) {
  if (data.allYears) {
    return renderFnDashboardAllYears(data, unit);
  }

  var html = '<div class="p1f-dashboard">';

  html += '<div class="p1f-context card">';
  html += '<div><strong>Unit:</strong> ' + fnEsc(unit) + ' \u00b7 <strong>Jahr:</strong> ' + fnEsc(fnYearLabel()) + '</div>';
  html += '</div>';

  html += renderFnSummary(data.summary);

  var hasComparisons = false;
  FN_AREAS.forEach(function (areaDef) {
    var items = (data.p1Plan && data.p1Plan[areaDef.key]) || [];
    if (items.length) hasComparisons = true;
    html += renderFnArea(areaDef, items);
  });

  if (!hasComparisons && data.p1Ist) {
    html += renderFnIstOverview(data.p1Ist);
  }

  html += '</div>';
  return html;
}

function fnPopulateYearSelect() {
  var sel = document.getElementById("fortschrittNewYear");
  if (!sel) return;
  var prev = sel.value;
  var years = window._rcPlanningYears || [2026, 2027, 2028, 2029];
  sel.innerHTML = "";
  var allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "Alle Jahre (" + years[0] + "\u2013" + years[years.length - 1] + ")";
  sel.appendChild(allOpt);
  years.forEach(function (y) {
    var opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    sel.appendChild(opt);
  });
  if (prev && Array.prototype.some.call(sel.options, function (o) { return o.value === prev; })) {
    sel.value = prev;
  } else if (years.indexOf(_fnYear) >= 0) {
    sel.value = String(_fnYear);
  } else {
    sel.value = String(years[0]);
  }
  readFnYearSelect();
}

async function loadFortschrittNewDashboard() {
  var unit = typeof fortschrittUnit === "function" ? fortschrittUnit() : "";
  var root = document.getElementById("fortschrittNewContent");
  if (!root) return;

  readFnYearSelect();

  if (!unit) {
    root.innerHTML = '<div class="card"><p class="fortschritt-empty">Bitte im <strong>Filter</strong> oben eine konkrete Unit w\u00e4hlen (nicht \u201eAlle Units\u201c), um den Phase-1-basierten Fortschritt zu sehen.</p></div>';
    return;
  }

  root.innerHTML = '<div class="card"><p class="fortschritt-empty">Lade Vergleichsdaten\u2026</p></div>';

  try {
    var yearQuery = _fnYearAll ? "all" : String(_fnYear);
    var data = await api("/api/dashboard/p1-snapshot?unit=" + encodeURIComponent(unit) + "&year=" + encodeURIComponent(yearQuery));
    _fnSnapshot = data;
    root.innerHTML = renderFnDashboard(data, unit);
  } catch (e) {
    root.innerHTML = '<div class="card"><p class="fortschritt-empty" style="color:var(--rc-red)">' + fnEsc(e.message || "Laden fehlgeschlagen") + '</p></div>';
  }
}

async function initFortschrittNew() {
  if (typeof loadPlanningYears === "function") {
    await loadPlanningYears();
  }
  fnPopulateYearSelect();
  if (!_fnInitDone) {
    _fnInitDone = true;
    var yearEl = document.getElementById("fortschrittNewYear");
    if (yearEl) yearEl.addEventListener("change", function () { void loadFortschrittNewDashboard(); });
    var reloadBtn = document.getElementById("btnFortschrittNewReload");
    if (reloadBtn) reloadBtn.addEventListener("click", function () { void loadFortschrittNewDashboard(); });
  }
  void loadFortschrittNewDashboard();
}

/* ===== Gesamtfortschritt NEW (Timeline) ===== */

let _gfnInitDone = false;

async function loadP1Timeline() {
  var unit = typeof fortschrittUnit === "function" ? fortschrittUnit() : "";
  var allUnits = typeof isFortschrittAllUnitsMode === "function" && isFortschrittAllUnitsMode();
  var url = allUnits ? "/api/dashboard/p1-timeline?all=true" : "/api/dashboard/p1-timeline?unit=" + encodeURIComponent(unit);
  return await api(url);
}

async function loadGesamtfortschrittNewDashboard() {
  var unit = typeof fortschrittUnit === "function" ? fortschrittUnit() : "";
  var allUnits = typeof isFortschrittAllUnitsMode === "function" && isFortschrittAllUnitsMode();
  var root = document.getElementById("gesamtfortschrittNewContent");
  if (!root) return;

  var emptyMsg = '<div class="card"><p class="fortschritt-empty">Bitte im <strong>Filter</strong> oben eine Unit w\u00e4hlen oder \u201eAlle Units\u201c (Admin), um den Zeitstrahl anzuzeigen.</p></div>';

  if (!unit && !allUnits) {
    root.innerHTML = emptyMsg;
    return;
  }

  root.innerHTML = '<div class="card"><p class="fortschritt-empty">Lade Zeitstrahl\u2026</p></div>';

  try {
    var timelineData = await loadP1Timeline();
    if (timelineData && typeof renderFortschrittTimeline === "function") {
      root.innerHTML = renderFortschrittTimeline(timelineData, allUnits, { mode: "p1" });
      if (typeof initFortschrittTipPopovers === "function") initFortschrittTipPopovers();
    } else {
      root.innerHTML = emptyMsg;
    }
  } catch (e) {
    root.innerHTML = '<div class="card"><p class="fortschritt-empty" style="color:var(--rc-red)">' + fnEsc(e.message || "Zeitstrahl laden fehlgeschlagen") + '</p></div>';
  }
}

function initGesamtfortschrittNew() {
  if (!_gfnInitDone) {
    _gfnInitDone = true;
    var reloadBtn = document.getElementById("btnGesamtfortschrittNewReload");
    if (reloadBtn) reloadBtn.addEventListener("click", function () { void loadGesamtfortschrittNewDashboard(); });
  }
  void loadGesamtfortschrittNewDashboard();
}
