/**
 * Fortschritt NEW -- Phase-1-basierter IST/SOLL-Vergleich
 * Nutzt p1Year-Meilensteine aus "Planung NEW" (Phase 2)
 */

let _fnYear = new Date().getFullYear();
let _fnYearAll = true;
let _fnInitDone = false;
let _fnSnapshot = null;

const FN_ORG_SECTIONS = [
  { key: "gliederungen", label: "Organisatorische Gliederung" },
  { key: "rollen", label: "Rollen in der Unit", hint: "Wie viele Personen haben welche Rolle?" },
];

const FN_PORTFOLIO_LABELS = {
  produkte: "Produkte",
  services: "Services",
  loesungen: "L\u00f6sungen",
  partnergeschaeft: "Partnergesch\u00e4ft",
  projektgeschaeft: "Projektgesch\u00e4ft",
};

const FN_PORTFOLIO_SECTIONS = Object.keys(FN_PORTFOLIO_LABELS).map(function (key) {
  return { key: key, label: FN_PORTFOLIO_LABELS[key] };
});

const FN_PORTFOLIO_COLORS = {
  produkte: "#2563eb",
  services: "#7c3aed",
  loesungen: "#0f766e",
  partnergeschaeft: "#c05621",
  projektgeschaeft: "#334155",
};

const FN_TOP_AREAS = [
  { key: "portfolio", label: "Portfolio", icon: "\ud83d\udcbc" },
  { key: "organisation", label: "Organisation", icon: "\ud83c\udfe2", sections: FN_ORG_SECTIONS },
  { key: "mitarbeiter", label: "Mitarbeiter-Entwicklung", icon: "\ud83d\udc64" },
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
  var bez = String(ms && ms.bezeichnung || "").trim();
  var text = String(ms && ms.ergebnis || "").trim();
  var title = bez || text;
  return title ? base + " \u00b7 " + title : base;
}

function fnExpandItemToMilestoneCards(item, areaKey, planYear) {
  var msList = item.milestones && item.milestones.length ? item.milestones : [{}];
  return msList.map(function (ms) {
    var card = {
      subcategory: item.subcategory,
      category: item.category || null,
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
    } else if (areaKey === "mitarbeiter") {
      var sollMinMa = fnParseNum(ms.ziel_skill_level_min);
      var gapMa = item.istAvg != null && sollMinMa != null ? item.istAvg - sollMinMa : null;
      card.istAvg = item.istAvg;
      card.skillCount = item.skillCount;
      card.sollMin = sollMinMa;
      card.gap = gapMa;
      card.status = gapMa == null ? "neutral" : gapMa >= 0 ? "ok" : gapMa >= -0.5 ? "warn" : "risk";
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

function renderFnMilestones(milestones, opts) {
  opts = opts || {};
  if (!milestones || !milestones.length) return "";
  var rows = "";
  milestones.forEach(function (m) {
    rows += '<div class="p1f-milestone">';
    if (m._planYear || m.jahr) {
      rows += '<span class="p1f-milestone__year">' + fnEsc(m._planYear || m.jahr) + "</span>";
    }
    rows += '<span class="p1f-milestone__q">' + fnEsc(m.ziel_quartal || "\u2013") + "</span>";
    rows += '<span class="p1f-milestone__text">' + fnEsc((m.bezeichnung || m.ergebnis || "").slice(0, 120)) + "</span>";
    if (m.ziel_umsatz_teur != null && m.ziel_umsatz_teur !== "") {
      rows += '<span class="p1f-milestone__kpi">' + fnFormatNum(fnParseNum(m.ziel_umsatz_teur)) + " TEUR</span>";
    }
    if (m.verantwortlich) rows += '<span class="p1f-milestone__who">' + fnEsc(m.verantwortlich) + "</span>";
    rows += "</div>";
  });
  var inner = '<div class="p1f-milestones">' + rows + "</div>";
  if (opts.collapsible) {
    var summary = opts.summaryLabel || "Meilensteine (" + milestones.length + ")";
    return (
      '<details class="p1f-milestones-panel">' +
      '<summary class="p1f-milestones-panel__head">' +
      fnEsc(summary) +
      "</summary>" +
      inner +
      "</details>"
    );
  }
  return inner;
}

function fnPortfolioCategoryTimeline(data, categoryKey) {
  var timelines = data && data.portfolioCategoryTimelines;
  return timelines && timelines[categoryKey] ? timelines[categoryKey] : null;
}

function fnPlanningYearsFromData(data) {
  if (data && data.years && data.years.length) return data.years;
  return window._rcPlanningYears || [2026, 2027, 2028, 2029];
}

function fnParseP1Quarter(zielQuartal) {
  var q = String(zielQuartal || "").trim().toUpperCase();
  if (q === "Q1") return 1;
  if (q === "Q2") return 2;
  if (q === "Q3") return 3;
  if (q === "Q4") return 4;
  return null;
}

function fnBuildQuarterSlots(years) {
  var slots = [];
  (years || []).forEach(function (year) {
    for (var quarter = 1; quarter <= 4; quarter += 1) {
      slots.push({
        year: Number(year),
        quarter: quarter,
        key: year + "-Q" + quarter,
        label: "Q" + quarter,
      });
    }
  });
  return slots;
}

function fnItemMilestonesForChart(item) {
  return item.allYearMilestones || item.milestones || [];
}

function fnSortMilestonesChronologically(list) {
  return (list || []).slice().sort(function (a, b) {
    var ya = Number(a._planYear != null ? a._planYear : a.jahr || 0);
    var yb = Number(b._planYear != null ? b._planYear : b.jahr || 0);
    if (ya !== yb) return ya - yb;
    return (fnParseP1Quarter(a.ziel_quartal) || 4) - (fnParseP1Quarter(b.ziel_quartal) || 4);
  });
}

function fnBuildItemQuarterSeries(item, years) {
  var quarters = fnBuildQuarterSlots(years);
  var sums = quarters.map(function () { return 0; });
  var hasValue = quarters.map(function () { return false; });
  var milestoneCount = 0;
  fnItemMilestonesForChart(item).forEach(function (m) {
    milestoneCount += 1;
    var v = fnParseNum(m.ziel_umsatz_teur);
    if (v == null) return;
    var year = Number(m._planYear != null ? m._planYear : m.jahr);
    var quarter = fnParseP1Quarter(m.ziel_quartal);
    if (quarter == null) quarter = 4;
    var idx = -1;
    for (var i = 0; i < quarters.length; i += 1) {
      if (quarters[i].year === year && quarters[i].quarter === quarter) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return;
    sums[idx] += v;
    hasValue[idx] = true;
  });
  var sollByQuarter = sums.map(function (v, i) {
    return hasValue[i] ? Math.round(v * 10) / 10 : null;
  });
  var hasQuarterSoll = sollByQuarter.some(function (v) { return v != null; });
  return {
    quarters: quarters,
    sollByQuarter: sollByQuarter,
    milestoneCount: milestoneCount,
    hasData: milestoneCount > 0 || hasQuarterSoll,
  };
}

function fnGroupPortfolioDisplayItems(items) {
  if (!items || !items.length) return [];
  var map = {};
  items.forEach(function (item) {
    var k = item.subcategory || item.label || "unknown";
    if (!map[k]) {
      var baseLabel = item.label || item.subcategory;
      if (baseLabel && baseLabel.indexOf(" \u00b7 ") >= 0) {
        baseLabel = baseLabel.split(" \u00b7 ")[0];
      }
      map[k] = {
        subcategory: item.subcategory,
        label: baseLabel,
        category: item.category,
        istTeur: item.istTeur,
        sollTeur: item.sollTeur,
        status: item.status,
        delta: item.delta,
        milestones: [],
        allYearMilestones: item.allYearMilestones || null,
      };
    }
    (item.milestones || []).forEach(function (ms) {
      var row = Object.assign({}, ms);
      if (item.planYear) row._planYear = item.planYear;
      map[k].milestones.push(row);
    });
    if (item.allYearMilestones && item.allYearMilestones.length) {
      map[k].allYearMilestones = item.allYearMilestones;
    }
    if (!_fnYearAll && item.sollTeur != null) {
      map[k].sollTeur = item.sollTeur;
      map[k].status = item.status;
      map[k].delta = item.delta;
    }
  });
  return Object.values(map);
}

function renderFnPortfolioCategoryChart(sectionDef, timeline) {
  if (!timeline || !timeline.hasData) {
    return '<p class="p1f-category-dashboard__empty">Keine Plan-Meilensteine f\u00fcr diese Kategorie.</p>';
  }
  var color = FN_PORTFOLIO_COLORS[sectionDef.key] || "#334155";
  var years = timeline.years || [];
  var quarters = timeline.quarters || [];
  var sollByQuarter = timeline.sollByQuarter || [];
  var lastSoll = null;
  var lastSollYear = null;
  for (var i = sollByQuarter.length - 1; i >= 0; i -= 1) {
    if (sollByQuarter[i] != null) {
      lastSoll = sollByQuarter[i];
      lastSollYear = quarters[i] ? quarters[i].year : null;
      break;
    }
  }
  if (lastSoll == null) {
    for (var j = (timeline.soll || []).length - 1; j >= 0; j -= 1) {
      if (timeline.soll[j] != null) {
        lastSoll = timeline.soll[j];
        lastSollYear = years[j] || null;
        break;
      }
    }
  }
  var delta = lastSoll != null && timeline.istStart != null ? timeline.istStart - lastSoll : null;
  var chartHtml = "";
  if (typeof renderFortschrittQuarterChartSvg === "function") {
    chartHtml = renderFortschrittQuarterChartSvg(
      {
        label: sectionDef.label + " \u00b7 Umsatz (TEUR)",
        unit: timeline.unit || "TEUR",
        yAxisLabel: timeline.yAxisLabel || "Umsatz (TEUR)",
        xAxisLabel: timeline.xAxisLabel || "Zeit",
      },
      quarters,
      [{ color: color, soll: sollByQuarter, ist: timeline.istByQuarter || [] }]
    );
  }
  var html = '<div class="p1f-category-dashboard">';
  html += '<h4 class="p1f-category-dashboard__title">' + fnEsc(sectionDef.label) + ' \u00b7 Umsatz \u00fcber alle Jahre</h4>';
  html += chartHtml;
  html += '<div class="p1f-category-dashboard__legend">';
  html += '<span class="p1f-category-dashboard__legend-item"><span class="p1f-category-dashboard__swatch p1f-category-dashboard__swatch--soll" style="background:' + color + '"></span>SOLL Planung NEW</span>';
  html += '<span class="p1f-category-dashboard__legend-item"><span class="p1f-category-dashboard__swatch p1f-category-dashboard__swatch--ist" style="color:' + color + ';border-color:' + color + '"></span>IST projiziert</span>';
  html += '</div>';
  html += '<div class="p1f-category-dashboard__kpis">';
  html += '<span>IST heute <b>' + fnFormatNum(timeline.istStart) + ' TEUR</b></span>';
  if (lastSoll != null) {
    var endLabel = lastSollYear != null ? String(lastSollYear) : (years.length ? String(years[years.length - 1]) : "");
    html += '<span>SOLL ' + fnEsc(endLabel) + ' <b>' + fnFormatNum(lastSoll) + ' TEUR</b></span>';
  }
  if (delta != null) {
    html += '<span>\u0394 <b>' + (delta > 0 ? "+" : "") + fnFormatNum(delta) + ' TEUR</b></span>';
  }
  html += '</div></div>';
  return html;
}

function renderFnPortfolioItemSubcat(item, sectionDef, data) {
  var statusCls = fnStatusClass(item.status);
  var msCount = (item.milestones && item.milestones.length) || 0;
  var html = '<details class="p1f-subcat ' + statusCls + '">';
  html += '<summary class="p1f-subcat__head">';
  html += '<span class="p1f-subcat__label">' + fnEsc(item.label || item.subcategory) + '</span>';
  html += '<span class="p1f-subcat__count">' + msCount + ' MS</span>';
  html += '</summary>';
  html += '<div class="p1f-subcat__body">';
  html += '<div class="p1f-card__values">';
  html += '<span>IST <b>' + fnFormatNum(item.istTeur) + ' TEUR</b></span>';
  if (!_fnYearAll && item.sollTeur != null) {
    html += '<span>SOLL <b>' + fnFormatNum(item.sollTeur) + ' TEUR</b></span>';
  }
  html += '</div>';
  if (!_fnYearAll && item.sollTeur != null) {
    html += renderFnBar(item.istTeur, item.sollTeur, item.status);
    html += '<div class="p1f-card__meta">' + fnEsc(fnStatusLabel(item.status));
    if (item.delta != null) html += " \u00b7 \u0394 " + (item.delta > 0 ? "+" : "") + fnFormatNum(item.delta) + " TEUR";
    html += "</div>";
  }
  var itemSeries = fnBuildItemQuarterSeries(item, fnPlanningYearsFromData(data));
  if (itemSeries.hasData) {
    var itemColor = (sectionDef && FN_PORTFOLIO_COLORS[sectionDef.key]) || "#64748b";
    var itemChartHtml = "";
    if (typeof renderFortschrittQuarterChartSvg === "function") {
      itemChartHtml = renderFortschrittQuarterChartSvg(
        {
          label: (item.label || item.subcategory) + " \u00b7 Umsatz (TEUR)",
          unit: "TEUR",
          yAxisLabel: "Umsatz (TEUR)",
          xAxisLabel: "Zeit",
        },
        itemSeries.quarters,
        [{ color: itemColor, soll: itemSeries.sollByQuarter, ist: [] }]
      );
    }
    html += '<div class="p1f-item-chart">' + itemChartHtml + "</div>";
  }
  var chartMilestones = fnSortMilestonesChronologically(fnItemMilestonesForChart(item));
  if (chartMilestones.length) {
    html += renderFnMilestones(chartMilestones, {
      collapsible: true,
      summaryLabel: "Meilensteine (" + chartMilestones.length + ")",
    });
  } else if (item.milestones && item.milestones.length) {
    html += renderFnMilestones(item.milestones, {
      collapsible: true,
      summaryLabel: "Meilensteine (" + item.milestones.length + ")",
    });
  }
  html += "</div></details>";
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

function renderFnMitarbeiterCard(item) {
  var html = '<div class="p1f-card stat-card ' + fnStatusClass(item.status) + '">';
  html += '<div class="p1f-card__head">';
  html += '<span class="p1f-card__status">' + fnStatusIcon(item.status) + '</span>';
  html += '<span class="p1f-card__label">' + fnEsc(item.label || item.subcategory) + '</span>';
  if (item.planYear) html += '<span class="p1f-card__year">' + fnEsc(item.planYear) + '</span>';
  html += '</div>';
  html += '<div class="p1f-card__values">';
  html += '<span>\u00d8 Level IST <b>' + fnFormatNum(item.istAvg) + '</b></span>';
  html += '<span>Skills <b>' + fnFormatNum(item.skillCount) + '</b></span>';
  html += '<span>Ziel-Level <b>' + fnFormatNum(item.sollMin) + '</b></span>';
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

function renderFnAreaCards(areaKey, items) {
  var html = "";
  items.forEach(function (item) {
    if (areaKey === "portfolio") html += renderFnPortfolioCard(item);
    else if (areaKey === "gliederungen") html += renderFnGliederungCard(item);
    else if (areaKey === "rollen") html += renderFnRolleCard(item);
    else if (areaKey === "mitarbeiter") html += renderFnMitarbeiterCard(item);
  });
  return html;
}

function renderFnOrgSection(sectionDef, items) {
  if (!items || !items.length) return "";
  var msCount = items.reduce(function (n, item) { return n + ((item.milestones && item.milestones.length) || 0); }, 0);
  var html = '<details class="p1f-org-section" open>';
  html += '<summary class="p1f-org-section__head">';
  html += '<span class="p1f-org-section__label">' + fnEsc(sectionDef.label) + '</span>';
  html += '<span class="p1f-org-section__count">' + items.length + ' Eintr\u00e4ge \u00b7 ' + msCount + ' Meilensteine</span>';
  html += '</summary>';
  html += '<div class="p1f-org-section__body">';
  if (sectionDef.hint) {
    html += '<p class="p1f-org-section__hint">' + fnEsc(sectionDef.hint) + '</p>';
  }
  html += '<div class="fortschritt-kpi-grid">' + renderFnAreaCards(sectionDef.key, items) + '</div>';
  html += '</div></details>';
  return html;
}

function fnItemsForCategory(items, categoryKey) {
  return (items || []).filter(function (item) {
    if (item.category) return item.category === categoryKey;
    return item.subcategory === categoryKey;
  });
}

function renderFnCategorySection(areaKey, sectionDef, items, data) {
  var timeline = areaKey === "portfolio" && data ? fnPortfolioCategoryTimeline(data, sectionDef.key) : null;
  var hasItems = items && items.length;
  var hasTimeline = timeline && timeline.hasData;
  if (!hasItems && !hasTimeline) return "";

  var msCount = hasTimeline ? timeline.milestoneCount : items.reduce(function (n, item) {
    return n + ((item.milestones && item.milestones.length) || 0);
  }, 0);
  var displayItems = areaKey === "portfolio" ? fnGroupPortfolioDisplayItems(items || []) : items;
  var itemCount = areaKey === "portfolio" ? displayItems.length : (items ? items.length : 0);

  var html = '<details class="p1f-org-section p1f-category-section" open>';
  html += '<summary class="p1f-org-section__head">';
  html += '<span class="p1f-org-section__label">' + fnEsc(sectionDef.label) + '</span>';
  html += '<span class="p1f-org-section__count">' + itemCount + ' Items \u00b7 ' + msCount + ' Meilensteine</span>';
  html += '</summary>';
  html += '<div class="p1f-org-section__body">';
  if (areaKey === "portfolio") {
    html += renderFnPortfolioCategoryChart(sectionDef, timeline);
    if (displayItems.length) {
      html += '<div class="p1f-category-items">';
      displayItems.forEach(function (item) {
        html += renderFnPortfolioItemSubcat(item, sectionDef, data);
      });
      html += '</div>';
    }
  } else {
    html += '<div class="fortschritt-kpi-grid">' + renderFnAreaCards(areaKey, items) + '</div>';
  }
  html += '</div></details>';
  return html;
}

function renderFnCategorizedArea(areaDef, items, sections, data) {
  var sectionsHtml = "";
  var totalItems = 0;
  sections.forEach(function (sectionDef) {
    var sectionItems = fnItemsForCategory(items, sectionDef.key);
    var timeline = data && data.portfolioCategoryTimelines && data.portfolioCategoryTimelines[sectionDef.key];
    if (!sectionItems.length && !(timeline && timeline.hasData)) return;
    totalItems += sectionItems.length || (timeline ? timeline.milestoneCount : 0);
    sectionsHtml += renderFnCategorySection(areaDef.key, sectionDef, sectionItems, data);
  });
  if (!sectionsHtml) return "";

  var html = '<details class="p1f-area" open>';
  html += '<summary class="p1f-area__head">';
  html += '<span class="p1f-area__icon">' + areaDef.icon + '</span>';
  html += '<span class="p1f-area__label">' + fnEsc(areaDef.label) + '</span>';
  html += '<span class="p1f-area__count">' + totalItems + ' Vergleiche</span>';
  html += '</summary>';
  html += '<div class="p1f-area__body">' + sectionsHtml + '</div></details>';
  return html;
}

function renderFnCategorizedAreaAllYears(data, areaDef, sections) {
  var sectionsHtml = "";
  var totalItems = 0;
  sections.forEach(function (sectionDef) {
    var items = fnCollectAllYearsAreaItems(data, areaDef.key).filter(function (item) {
      return item.category === sectionDef.key || (!item.category && item.subcategory === sectionDef.key);
    });
    var timeline = data.portfolioCategoryTimelines && data.portfolioCategoryTimelines[sectionDef.key];
    if (!items.length && !(timeline && timeline.hasData)) return;
    totalItems += items.length || (timeline ? timeline.milestoneCount : 0);
    sectionsHtml += renderFnCategorySection(areaDef.key, sectionDef, items, data);
  });
  if (!sectionsHtml) return "";

  var html = '<details class="p1f-area" open>';
  html += '<summary class="p1f-area__head">';
  html += '<span class="p1f-area__icon">' + areaDef.icon + '</span>';
  html += '<span class="p1f-area__label">' + fnEsc(areaDef.label) + '</span>';
  html += '<span class="p1f-area__count">' + totalItems + ' Meilensteine</span>';
  html += '</summary>';
  html += '<div class="p1f-area__body">' + sectionsHtml + '</div></details>';
  return html;
}

function renderFnOrganisationArea(p1Plan) {
  var gliItems = (p1Plan && p1Plan.gliederungen) || [];
  var rolItems = (p1Plan && p1Plan.rollen) || [];
  var orgDef = FN_TOP_AREAS.find(function (a) { return a.key === "organisation"; });
  var sectionsHtml = "";
  orgDef.sections.forEach(function (sectionDef) {
    var items = sectionDef.key === "gliederungen" ? gliItems : rolItems;
    sectionsHtml += renderFnOrgSection(sectionDef, items);
  });
  if (!sectionsHtml) return "";

  var totalItems = gliItems.length + rolItems.length;
  var html = '<details class="p1f-area p1f-area--org" open>';
  html += '<summary class="p1f-area__head">';
  html += '<span class="p1f-area__icon">' + orgDef.icon + '</span>';
  html += '<span class="p1f-area__label">' + fnEsc(orgDef.label) + '</span>';
  html += '<span class="p1f-area__count">' + totalItems + ' Vergleiche</span>';
  html += '</summary>';
  html += '<div class="p1f-area__body">' + sectionsHtml + '</div></details>';
  return html;
}

function fnCollectAllTopAreaItems(data) {
  var allItems = [];
  FN_TOP_AREAS.forEach(function (areaDef) {
    if (areaDef.key === "organisation") {
      areaDef.sections.forEach(function (sectionDef) {
        allItems = allItems.concat(fnCollectAllYearsAreaItems(data, sectionDef.key));
      });
    } else {
      allItems = allItems.concat(fnCollectAllYearsAreaItems(data, areaDef.key));
    }
  });
  return allItems;
}

function renderFnOrganisationAreaAllYears(data) {
  var orgDef = FN_TOP_AREAS.find(function (a) { return a.key === "organisation"; });
  var sectionsHtml = "";
  var totalItems = 0;
  orgDef.sections.forEach(function (sectionDef) {
    var items = fnCollectAllYearsAreaItems(data, sectionDef.key);
    totalItems += items.length;
    sectionsHtml += renderFnOrgSection(sectionDef, items);
  });
  if (!sectionsHtml) return "";

  var html = '<details class="p1f-area p1f-area--org" open>';
  html += '<summary class="p1f-area__head">';
  html += '<span class="p1f-area__icon">' + orgDef.icon + '</span>';
  html += '<span class="p1f-area__label">' + fnEsc(orgDef.label) + '</span>';
  html += '<span class="p1f-area__count">' + totalItems + ' Meilensteine</span>';
  html += '</summary>';
  html += '<div class="p1f-area__body">' + sectionsHtml + '</div></details>';
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
  html += renderFnAreaCards(areaDef.key, items);
  html += '</div></details>';
  return html;
}

function renderFnSummaryChips(summary, compact) {
  if (!summary) return "";
  var count = summary.milestoneCount || summary.totalComparisons || 0;
  if (!count) return "";
  var gridCls = compact ? "p1f-summary__grid p1f-summary__grid--compact" : "p1f-summary__grid";
  var html = '<div class="' + gridCls + '">';
  html += '<span class="p1f-summary__chip p1f-summary__chip--ok">\u2705 ' + (summary.ok || 0) + (compact ? "" : " Im Plan") + "</span>";
  html += '<span class="p1f-summary__chip p1f-summary__chip--warn">\u26a0\ufe0f ' + (summary.warn || 0) + (compact ? "" : " Abweichung") + "</span>";
  html += '<span class="p1f-summary__chip p1f-summary__chip--risk">\ud83d\udd34 ' + (summary.risk || 0) + (compact ? "" : " Kritisch") + "</span>";
  if (summary.neutral) {
    html += '<span class="p1f-summary__chip">\u2796 ' + summary.neutral + (compact ? "" : " Keine Daten") + "</span>";
  }
  html += "</div>";
  return html;
}

function renderFnDashboardPanel(unit, summary) {
  var count = summary && (summary.milestoneCount || summary.totalComparisons || 0);
  var html = '<div class="p1f-dashbar card">';
  html += '<span class="p1f-dashbar__meta">' + fnEsc(unit);
  if (count) html += " \u00b7 " + count + " MS";
  html += "</span>";
  if (count) {
    html += '<span class="p1f-dashbar__chips">' + renderFnSummaryChips(summary, true) + "</span>";
  } else {
    html += '<span class="p1f-dashbar__empty">Keine Meilensteine</span>';
  }
  html += '<span class="p1f-dashbar__filter"><select id="fortschrittNewYear"></select></span>';
  html += "</div>";
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
  html += renderFnSummaryChips(summary, false);
  html += '</div>';
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
  var allItems = fnCollectAllTopAreaItems(data);
  html += renderFnDashboardPanel(unit, fnSummaryFromItems(allItems));

  var hasComparisons = false;
  FN_TOP_AREAS.forEach(function (areaDef) {
    if (areaDef.key === "organisation") {
      var orgHtml = renderFnOrganisationAreaAllYears(data);
      if (orgHtml) {
        hasComparisons = true;
        html += orgHtml;
      }
      return;
    }
    if (areaDef.key === "portfolio") {
      var portHtml = renderFnCategorizedAreaAllYears(data, areaDef, FN_PORTFOLIO_SECTIONS);
      if (portHtml) {
        hasComparisons = true;
        html += portHtml;
      }
      return;
    }
    if (areaDef.key === "mitarbeiter") {
      var maItems = fnCollectAllYearsAreaItems(data, "mitarbeiter");
      if (maItems.length) {
        hasComparisons = true;
        html += renderFnArea(areaDef, maItems);
      }
      return;
    }
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
  html += renderFnDashboardPanel(unit, data.summary);

  var hasComparisons = false;
  FN_TOP_AREAS.forEach(function (areaDef) {
    if (areaDef.key === "organisation") {
      var orgHtml = renderFnOrganisationArea(data.p1Plan);
      if (orgHtml) {
        hasComparisons = true;
        html += orgHtml;
      }
      return;
    }
    if (areaDef.key === "portfolio") {
      var portItems = (data.p1Plan && data.p1Plan.portfolio) || [];
      var portHtml = renderFnCategorizedArea(areaDef, portItems, FN_PORTFOLIO_SECTIONS, data);
      if (portHtml) {
        hasComparisons = true;
        html += portHtml;
      }
      return;
    }
    if (areaDef.key === "mitarbeiter") {
      var maItems = (data.p1Plan && data.p1Plan.mitarbeiter) || [];
      if (maItems.length) {
        hasComparisons = true;
        html += renderFnArea(areaDef, maItems);
      }
      return;
    }
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
  } else {
    sel.value = "all";
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
    fnPopulateYearSelect();
  } catch (e) {
    root.innerHTML = '<div class="card"><p class="fortschritt-empty" style="color:var(--rc-red)">' + fnEsc(e.message || "Laden fehlgeschlagen") + '</p></div>';
  }
}

async function initFortschrittNew() {
  if (typeof loadPlanningYears === "function") {
    await loadPlanningYears();
  }
  if (!_fnInitDone) {
    _fnInitDone = true;
    var page = document.getElementById("page-fortschritt-new");
    if (page) {
      page.addEventListener("change", function (e) {
        if (e.target && e.target.id === "fortschrittNewYear") void loadFortschrittNewDashboard();
      });
    }
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
