/**
 * Fortschritt NEW -- Phase-1-basierter IST/SOLL-Vergleich
 * Nutzt p1Year-Meilensteine aus "Planung NEW" (Phase 2)
 */

let _fnYear = new Date().getFullYear();
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
  var html = '<details class="p1f-area" open>';
  html += '<summary class="p1f-area__head">';
  html += '<span class="p1f-area__icon">' + areaDef.icon + '</span>';
  html += '<span class="p1f-area__label">' + fnEsc(areaDef.label) + '</span>';
  html += '<span class="p1f-area__count">' + items.length + ' Vergleiche</span>';
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
  if (!summary || summary.totalComparisons === 0) {
    return '<div class="card"><p class="fortschritt-empty">Keine Phase-1-basierten Plan-Meilensteine f\u00fcr dieses Jahr vorhanden.</p></div>';
  }
  var html = '<div class="p1f-summary card">';
  html += '<div class="p1f-summary__title">\u00dcbersicht \u00b7 ' + summary.totalComparisons + ' Vergleiche</div>';
  html += '<div class="p1f-summary__grid">';
  html += '<span class="p1f-summary__chip p1f-summary__chip--ok">\u2705 ' + (summary.ok || 0) + ' Im Plan</span>';
  html += '<span class="p1f-summary__chip p1f-summary__chip--warn">\u26a0\ufe0f ' + (summary.warn || 0) + ' Abweichung</span>';
  html += '<span class="p1f-summary__chip p1f-summary__chip--risk">\ud83d\udd34 ' + (summary.risk || 0) + ' Kritisch</span>';
  if (summary.neutral) html += '<span class="p1f-summary__chip">\u2796 ' + summary.neutral + ' Keine Daten</span>';
  html += '</div></div>';
  return html;
}

function renderFnDashboard(data, unit) {
  var html = '<div class="p1f-dashboard">';

  html += '<div class="p1f-context card">';
  html += '<div><strong>Unit:</strong> ' + fnEsc(unit) + ' \u00b7 <strong>Jahr:</strong> ' + _fnYear + '</div>';
  html += '</div>';

  html += renderFnSummary(data.summary);

  FN_AREAS.forEach(function (areaDef) {
    var items = (data.p1Plan && data.p1Plan[areaDef.key]) || [];
    html += renderFnArea(areaDef, items);
  });

  html += '</div>';
  return html;
}

function fnPopulateYearSelect() {
  var sel = document.getElementById("fortschrittNewYear");
  if (!sel) return;
  var years = window._rcPlanningYears || [2026, 2027, 2028, 2029];
  sel.innerHTML = "";
  years.forEach(function (y) {
    var opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    if (y === _fnYear) opt.selected = true;
    sel.appendChild(opt);
  });
}

async function loadFortschrittNewDashboard() {
  var unit = typeof fortschrittUnit === "function" ? fortschrittUnit() : "";
  var root = document.getElementById("fortschrittNewContent");
  if (!root) return;

  var yearEl = document.getElementById("fortschrittNewYear");
  if (yearEl) _fnYear = parseInt(yearEl.value, 10) || _fnYear;

  if (!unit) {
    root.innerHTML = '<div class="card"><p class="fortschritt-empty">Bitte im <strong>Filter</strong> oben eine konkrete Unit w\u00e4hlen (nicht \u201eAlle Units\u201c), um den Phase-1-basierten Fortschritt zu sehen.</p></div>';
    return;
  }

  root.innerHTML = '<div class="card"><p class="fortschritt-empty">Lade Vergleichsdaten\u2026</p></div>';

  try {
    var data = await api("/api/dashboard/p1-snapshot?unit=" + encodeURIComponent(unit) + "&year=" + _fnYear);
    _fnSnapshot = data;
    root.innerHTML = renderFnDashboard(data, unit);
  } catch (e) {
    root.innerHTML = '<div class="card"><p class="fortschritt-empty" style="color:var(--rc-red)">' + fnEsc(e.message || "Laden fehlgeschlagen") + '</p></div>';
  }
}

function initFortschrittNew() {
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
