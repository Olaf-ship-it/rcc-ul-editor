/**
 * Fortschritt -- Phase-1-basierter IST/SOLL-Vergleich
 * Nutzt p1Year-Meilensteine aus der Backcasting-Planung (Phase 2)
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

const FN_ORG_COLORS = [
  "#2563eb", "#7c3aed", "#0f766e", "#c05621", "#334155", "#db2777", "#0891b2", "#65a30d",
];

const FN_TOP_AREAS = [
  { key: "portfolio", label: "Portfolio", icon: "\ud83d\udcbc" },
  { key: "organisation", label: "Organisation", icon: "\ud83c\udfe2", sections: FN_ORG_SECTIONS },
  { key: "mitarbeiter", label: "Skills", icon: "\ud83d\udc64" },
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

function fnStatusTooltip(status) {
  if (status === "ok") {
    return "Im Plan: IST erreicht oder \u00fcbertrifft das SOLL-Ziel.";
  }
  if (status === "warn") {
    return "Leichte Abweichung: IST liegt knapp unter dem Planziel.";
  }
  if (status === "risk") {
    return "Kritisch: deutlicher Abstand zwischen IST und SOLL.";
  }
  return "Keine Daten: kein IST-Wert vorhanden oder Vergleich nicht m\u00f6glich.";
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
  if (areaKey === "mitarbeiter" && item.skillComparisons && item.skillComparisons.length) {
    return item.skillComparisons.map(function (sc) {
      return {
        subcategory: item.subcategory,
        label: item.label || item.subcategory,
        skillEntryId: item.skillEntryId,
        skillPlanKind: sc.skillPlanKind,
        kategorie: sc.kategorie,
        technologie: sc.technologie,
        kompetenz: sc.kompetenz,
        istLevel: sc.istLevel,
        sollLevel: sc.sollLevel,
        gap: sc.gap,
        status: sc.status,
        planYear: sc.planYear || planYear,
        planQuarter: sc.planQuarter,
        milestones: item.milestones,
      };
    });
  }
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
      var sollMinMa = fnResolvedSkillSollLevel(ms);
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
        phase1Id: item.phase1Id || null,
        itemId: item.itemId || null,
        entityRef: item.entityRef || null,
        istTeur: item.istTeur,
        sollTeur: item.sollTeur,
        status: item.status,
        delta: item.delta,
        milestones: [],
        allYearMilestones: item.allYearMilestones || null,
      };
    }
    if (!map[k].phase1Id && item.phase1Id) map[k].phase1Id = item.phase1Id;
    if (!map[k].itemId && item.itemId) map[k].itemId = item.itemId;
    if (!map[k].entityRef && item.entityRef) map[k].entityRef = item.entityRef;
    if (!map[k].category && item.category) map[k].category = item.category;
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

function fnPortfolioProductColor(index) {
  return FN_ORG_COLORS[index % FN_ORG_COLORS.length];
}

function fnPortfolioProductKey(item) {
  if (!item) return "";
  if (item.entityRef && item.entityRef.id) return "portfolio||" + item.entityRef.id;
  if (item.phase1Id) return "portfolio||" + item.phase1Id;
  if (item.itemId) return "portfolio||" + item.itemId;
  var cat = item.category || "";
  var sub = item.subcategory || item.label || "";
  return "portfolio||" + cat + "||" + sub;
}

function fnPortfolioIstValuesFromByYear(data, item, years) {
  var key = fnPortfolioProductKey(item);
  var result = years.map(function () { return null; });
  if (!data || !data.byYear) return result;
  data.byYear.forEach(function (row) {
    var yi = years.findIndex(function (y) { return Number(y) === Number(row.year); });
    if (yi < 0) return;
    ((row.p1Plan && row.p1Plan.portfolio) || []).forEach(function (pi) {
      if (fnPortfolioProductKey(pi) === key && pi.istTeur != null && Number.isFinite(pi.istTeur)) {
        result[yi] = pi.istTeur;
      }
    });
  });
  return result;
}

function fnPortfolioIstValuesForItem(item, years, lookup, data) {
  var result = years.map(function () { return null; });
  var key = fnPortfolioProductKey(item);
  var row = lookup && lookup[key];
  if (row && row.istByYear && row.istByYear.length) {
    years.forEach(function (_y, yi) {
      if (yi < row.istByYear.length && row.istByYear[yi] != null && Number.isFinite(row.istByYear[yi])) {
        result[yi] = row.istByYear[yi];
      }
    });
  }
  fnPortfolioIstValuesFromByYear(data, item, years).forEach(function (v, yi) {
    if (v != null) result[yi] = v;
  });
  if (!_fnYearAll && item.istTeur != null && Number.isFinite(item.istTeur)) {
    years.forEach(function (y, yi) {
      if (Number(y) === Number(_fnYear) && result[yi] == null) {
        result[yi] = item.istTeur;
      }
    });
  }
  return result;
}

function fnBuildPortfolioProductSollByYear(item, years) {
  return (years || []).map(function (year) {
    var sum = 0;
    var has = false;
    fnItemMilestonesForChart(item).forEach(function (m) {
      var y = Number(m._planYear != null ? m._planYear : m.jahr);
      if (y !== Number(year)) return;
      var v = fnParseNum(m.ziel_umsatz_teur);
      if (v != null) {
        sum += v;
        has = true;
      }
    });
    return has ? Math.round(sum * 10) / 10 : 0;
  });
}

function fnBuildPortfolioCategoryTotals(displayItems, years, istLookup, data) {
  var soll = years.map(function () { return 0; });
  var ist = years.map(function () { return null; });
  (displayItems || []).forEach(function (item) {
    var s = fnBuildPortfolioProductSollByYear(item, years);
    var i = fnPortfolioIstValuesForItem(item, years, istLookup, data);
    s.forEach(function (v, yi) {
      if (v > 0) soll[yi] += v;
    });
    i.forEach(function (v, yi) {
      if (v != null && Number.isFinite(v)) {
        ist[yi] = (ist[yi] || 0) + v;
      }
    });
  });
  soll = soll.map(function (v) { return v > 0 ? Math.round(v * 10) / 10 : 0; });
  ist = ist.map(function (v) { return v != null ? Math.round(v * 10) / 10 : null; });
  return { soll: soll, ist: ist };
}

function renderFnPortfolioCategoryChart(sectionDef, timeline, displayItems, data) {
  if (!timeline || !timeline.hasData) {
    return '<p class="p1f-category-dashboard__empty">Keine Plan-Meilensteine f\u00fcr diese Kategorie.</p>';
  }
  var color = FN_PORTFOLIO_COLORS[sectionDef.key] || "#334155";
  var years = timeline.years || [];
  var istLookup = (data && data.portfolioProductIstByYear) || {};
  var totals = fnBuildPortfolioCategoryTotals(displayItems, years, istLookup, data);
  var lastSoll = null;
  var lastSollYear = null;
  for (var i = totals.soll.length - 1; i >= 0; i -= 1) {
    if (totals.soll[i] > 0) {
      lastSoll = totals.soll[i];
      lastSollYear = years[i] || null;
      break;
    }
  }
  var delta = lastSoll != null && timeline.istStart != null ? timeline.istStart - lastSoll : null;
  var chartHtml = "";
  if (typeof renderFortschrittSollIstYearChartSvg === "function") {
    chartHtml = renderFortschrittSollIstYearChartSvg(
      {
        label: sectionDef.label + " \u00b7 SOLL vs. IST (TEUR)",
        unit: timeline.unit || "TEUR",
        yAxisLabel: timeline.yAxisLabel || "Umsatz (TEUR)",
        xAxisLabel: timeline.xAxisLabel || "Jahr",
      },
      years,
      totals.soll,
      totals.ist,
      { sollColor: color }
    );
  }
  var legend = "";
  (displayItems || []).forEach(function (item, index) {
    legend += '<span class="p1f-category-dashboard__legend-item">';
    legend += '<span class="p1f-category-dashboard__swatch" style="background:' + fnPortfolioProductColor(index) + '"></span>';
    legend += fnEsc(item.label || item.subcategory);
    legend += "</span>";
  });
  var html = '<div class="p1f-category-dashboard">';
  html += '<h4 class="p1f-category-dashboard__title">' + fnEsc(sectionDef.label) + ' \u00b7 SOLL vs. IST je Jahr</h4>';
  html += '<p class="p1f-category-dashboard__hint">Pro Jahr zwei S\u00e4ulen: SOLL (Plan) und IST (Jahresabschluss).</p>';
  html += '<div class="p1f-category-dashboard__wrap">' + chartHtml + "</div>";
  if (legend) html += '<div class="p1f-category-dashboard__legend p1f-category-dashboard__legend--products">' + legend + "</div>";
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
  var years = fnPlanningYearsFromData(data);
  var istLookup = (data && data.portfolioProductIstByYear) || {};
  var sollByYear = fnBuildPortfolioProductSollByYear(item, years);
  var istByYear = fnPortfolioIstValuesForItem(item, years, istLookup, data);
  var hasYearCompare = sollByYear.some(function (v) { return v > 0; })
    || istByYear.some(function (v) { return v != null && Number.isFinite(v); });
  if (hasYearCompare && typeof renderFortschrittSollIstYearChartSvg === "function") {
    var itemColor = (sectionDef && FN_PORTFOLIO_COLORS[sectionDef.key]) || "#64748b";
    html += '<div class="p1f-item-chart">';
    html += renderFortschrittSollIstYearChartSvg(
      {
        label: (item.label || item.subcategory) + " \u00b7 SOLL vs. IST (TEUR)",
        unit: "TEUR",
        yAxisLabel: "Umsatz (TEUR)",
        xAxisLabel: "Jahr",
      },
      years,
      sollByYear,
      istByYear,
      { sollColor: itemColor }
    );
    html += "</div>";
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

function fnOrgSectionPanelLabel(areaKey) {
  if (areaKey === "rollen") return "Rollen in der Unit";
  if (areaKey === "gliederungen") return "Organisatorische Gliederung";
  return "Vergleichsdetails";
}

function fnPrepareOrgTableItems(items) {
  if (!items || !items.length) return [];
  var byKey = {};
  items.forEach(function (item) {
    var label = item.subcategory || String(item.label || "").split(" \u00b7 ")[0] || "";
    var key = label + "\0" + (item.planYear || "");
    if (!byKey[key]) {
      byKey[key] = Object.assign({}, item, { label: label });
      return;
    }
    var prev = byKey[key];
    var prevHasSoll = prev.sollAnzahl != null || prev.sollHc != null || prev.sollTeur != null;
    var nextHasSoll = item.sollAnzahl != null || item.sollHc != null || item.sollTeur != null;
    if (!prevHasSoll && nextHasSoll) {
      byKey[key] = Object.assign({}, item, { label: label });
    }
  });
  return Object.keys(byKey).map(function (k) { return byKey[k]; }).sort(function (a, b) {
    var la = String(a.label || "").localeCompare(String(b.label || ""), "de");
    if (la !== 0) return la;
    return Number(a.planYear || 0) - Number(b.planYear || 0);
  });
}

function renderFnOrgComparisonTable(areaKey, items) {
  var tableItems = fnPrepareOrgTableItems(items);
  if (!tableItems.length) return "";
  var showYear = _fnYearAll || tableItems.some(function (item) { return item.planYear; });
  var labelCol = areaKey === "rollen" ? "Rolle" : "Bereich";
  var head = "<tr><th>" + labelCol + "</th>";
  if (showYear) head += "<th>Jahr</th>";
  if (areaKey === "gliederungen") {
    head += "<th>IST HC</th><th>SOLL HC</th><th>IST TEUR</th><th>SOLL TEUR</th>";
  } else if (areaKey === "rollen") {
    head += "<th>IST MA</th><th>SOLL MA</th>";
  }
  head += "<th>Status</th></tr>";
  var rows = "";
  tableItems.forEach(function (item) {
    rows += '<tr class="' + fnStatusClass(item.status) + '">';
    rows += "<td>" + fnEsc(item.label || item.subcategory) + "</td>";
    if (showYear) rows += "<td>" + fnEsc(item.planYear || "\u2013") + "</td>";
    if (areaKey === "gliederungen") {
      rows += "<td>" + fnEsc(item.istHc != null ? fnFormatNum(item.istHc) : "\u2013") + "</td>";
      rows += "<td>" + fnEsc(item.sollHc != null ? fnFormatNum(item.sollHc) : "\u2013") + "</td>";
      rows += "<td>" + fnEsc(item.istTeur != null ? fnFormatNum(item.istTeur) : "\u2013") + "</td>";
      rows += "<td>" + fnEsc(item.sollTeur != null ? fnFormatNum(item.sollTeur) : "\u2013") + "</td>";
    } else if (areaKey === "rollen") {
      rows += "<td>" + fnEsc(item.istAnzahl != null ? fnFormatNum(item.istAnzahl) : "\u2013") + "</td>";
      rows += "<td>" + fnEsc(item.sollAnzahl != null ? fnFormatNum(item.sollAnzahl) : "\u2013") + "</td>";
    }
    rows += "<td>" + fnStatusIcon(item.status) + " " + fnEsc(fnStatusLabel(item.status)) + "</td>";
    rows += "</tr>";
  });
  return (
    '<div class="tbl-wrap p1f-org-table-wrap">' +
    '<table class="entries fortschritt-table p1f-org-table">' +
    "<thead>" + head + "</thead><tbody>" + rows + "</tbody></table></div>"
  );
}

function renderFnOrgComparisonPanel(areaKey, items) {
  var tableItems = fnPrepareOrgTableItems(items);
  if (!tableItems.length) return "";
  return (
    '<details class="p1f-milestones-panel p1f-org-details">' +
    '<summary class="p1f-milestones-panel__head">' +
    fnEsc(fnOrgSectionPanelLabel(areaKey)) + " \u00b7 Vergleichsdetails (" + tableItems.length + ")</summary>" +
    '<div class="p1f-org-details__body">' +
    renderFnOrgComparisonTable(areaKey, items) +
    "</div></details>"
  );
}

function renderFnGliederungCard(item) {
  var html = '<div class="p1f-card stat-card ' + fnStatusClass(item.status) + '">';
  html += '<div class="p1f-card__head">';
  html += '<span class="p1f-card__status">' + fnStatusIcon(item.status) + '</span>';
  html += '<span class="p1f-card__label">' + fnEsc(item.subcategory) + '</span>';
  if (item.planYear) html += '<span class="p1f-card__year">' + fnEsc(item.planYear) + '</span>';
  html += '</div>';
  html += '<div class="p1f-card__values">';
  if (item.istHc != null || item.sollHc != null) {
    if (item.istHc != null) html += '<span>IST <b>' + fnFormatNum(item.istHc) + ' HC</b></span>';
    if (item.sollHc != null) html += '<span>SOLL <b>' + fnFormatNum(item.sollHc) + ' HC</b></span>';
  }
  if (item.istTeur != null || item.sollTeur != null) {
    if (item.istTeur != null) html += '<span>IST <b>' + fnFormatNum(item.istTeur) + ' TEUR</b></span>';
    if (item.sollTeur != null) html += '<span>SOLL <b>' + fnFormatNum(item.sollTeur) + ' TEUR</b></span>';
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

function fnOrgTimelineWithColors(timeline) {
  if (!timeline || !timeline.segments) return timeline;
  return Object.assign({}, timeline, {
    segments: timeline.segments.map(function (seg, i) {
      return Object.assign({}, seg, { color: seg.color || FN_ORG_COLORS[i % FN_ORG_COLORS.length] });
    }),
  });
}

function fnOrgTimelineSpec(timelineKey) {
  if (timelineKey === "gliederungenUmsatz") {
    return {
      areaKey: "gliederungen",
      valueField: "sollTeur",
      istValueField: "istTeur",
      combine: "sum",
      unit: "TEUR",
      yAxisLabel: "Umsatz (SOLL)",
      istYAxisLabel: "Umsatz (IST)",
    };
  }
  if (timelineKey === "rollen") {
    return {
      areaKey: "rollen",
      valueField: "sollAnzahl",
      istValueField: "istAnzahl",
      combine: "max",
      unit: "MA",
      yAxisLabel: "Personen (SOLL)",
      istYAxisLabel: "Personen (IST)",
    };
  }
  return {
    areaKey: "gliederungen",
    valueField: "sollHc",
    istValueField: "istHc",
    combine: "max",
    unit: "HC",
    yAxisLabel: "Headcount (SOLL)",
    istYAxisLabel: "Headcount (IST)",
  };
}

function fnOrgSectionChartSpecs(sectionKey) {
  if (sectionKey === "gliederungen") {
    return [{ timelineKey: "gliederungenCombined", combined: true }];
  }
  return [{ timelineKey: sectionKey, title: null }];
}

function fnMergeGliederungenTimelines(hcTimeline, teurTimeline) {
  var years = (hcTimeline && hcTimeline.years) || (teurTimeline && teurTimeline.years) || [];
  if (!years.length) years = window._rcPlanningYears || [2026, 2027, 2028, 2029, 2030];
  var keyMap = {};
  var milestoneCount = 0;

  function ensureSeg(seg) {
    var k = seg.key || seg.label || "?";
    if (!keyMap[k]) {
      keyMap[k] = {
        key: k,
        label: seg.label || k,
        hcValues: years.map(function () { return null; }),
        teurValues: years.map(function () { return null; }),
        istHc: null,
        istTeur: null,
      };
    }
    return keyMap[k];
  }

  function absorb(timeline, kind) {
    if (!timeline) return;
    milestoneCount = Math.max(milestoneCount, timeline.milestoneCount || 0);
    (timeline.segments || []).forEach(function (seg) {
      var row = ensureSeg(seg);
      if (seg.label) row.label = seg.label;
      (seg.values || []).forEach(function (v, yi) {
        if (v == null || v <= 0) return;
        if (kind === "hc") row.hcValues[yi] = v;
        else row.teurValues[yi] = v;
      });
      if (kind === "hc" && seg.istValue != null && seg.istValue > 0) row.istHc = seg.istValue;
      if (kind === "teur" && seg.istValue != null && seg.istValue > 0) row.istTeur = seg.istValue;
    });
  }

  absorb(hcTimeline, "hc");
  absorb(teurTimeline, "teur");

  var segments = Object.keys(keyMap).map(function (k) { return keyMap[k]; }).filter(function (seg) {
    return seg.hcValues.some(function (v) { return v != null && v > 0; })
      || seg.teurValues.some(function (v) { return v != null && v > 0; })
      || (seg.istHc != null && seg.istHc > 0)
      || (seg.istTeur != null && seg.istTeur > 0);
  }).sort(function (a, b) { return String(a.label).localeCompare(String(b.label), "de"); });

  var hasSoll = segments.some(function (seg) {
    return seg.hcValues.some(function (v) { return v != null && v > 0; })
      || seg.teurValues.some(function (v) { return v != null && v > 0; });
  });
  var istFallback = !hasSoll && milestoneCount > 0 && segments.length > 0;
  var hasIstReference = segments.some(function (seg) {
    return (seg.istHc != null && seg.istHc > 0) || (seg.istTeur != null && seg.istTeur > 0);
  });

  return {
    key: "gliederungenCombined",
    years: years.slice(),
    segments: segments,
    milestoneCount: milestoneCount,
    hasData: hasSoll || istFallback,
    hasIstReference: hasIstReference,
    istFallback: istFallback,
    combined: true,
  };
}

function fnBuildOrgTimelineFromByYear(data, timelineKey) {
  var spec = fnOrgTimelineSpec(timelineKey);
  var years = data.years || (data.byYear || []).map(function (row) { return row.year; });
  if (!years.length) years = window._rcPlanningYears || [2026, 2027, 2028, 2029];
  var segmentMap = {};
  var milestoneCount = 0;
  var usedIstFallback = false;

  function absorb(items, yearIdx) {
    (items || []).forEach(function (item) {
      var label = item.label || item.subcategory || "?";
      var key = (item.entityRef && item.entityRef.id) || label;
      if (!segmentMap[key]) {
        segmentMap[key] = { key: key, label: label, values: years.map(function () { return null; }), istValue: null };
      }
      var istVal = item[spec.istValueField];
      if (istVal != null && istVal > 0) {
        segmentMap[key].istValue = istVal;
      }
      var val = item[spec.valueField];
      if (val == null || val <= 0) {
        if (segmentMap[key].istValue != null) {
          val = segmentMap[key].istValue;
          if (val != null && val > 0) usedIstFallback = true;
        }
      }
      if (val == null || val <= 0) return;
      var cur = segmentMap[key].values[yearIdx];
      if (spec.combine === "sum") {
        segmentMap[key].values[yearIdx] = (cur || 0) + val;
      } else {
        segmentMap[key].values[yearIdx] = cur == null ? val : Math.max(cur, val);
      }
      milestoneCount += (item.milestones || []).length;
    });
  }

  if (data.allYears && data.byYear) {
    data.byYear.forEach(function (row) {
      var yi = years.indexOf(row.year);
      if (yi < 0) return;
      absorb(row.p1Plan && row.p1Plan[spec.areaKey], yi);
    });
  } else if (data.p1Plan) {
    var yi = years.indexOf(data.year);
    if (yi >= 0) absorb(data.p1Plan[spec.areaKey], yi);
  }

  var segments = Object.keys(segmentMap).map(function (k) { return segmentMap[k]; }).filter(function (seg) {
    return seg.values.some(function (v) { return v != null && v > 0; });
  }).sort(function (a, b) { return String(a.label).localeCompare(String(b.label), "de"); });

  var totals = years.map(function (_, yi) {
    return segments.reduce(function (sum, seg) { return sum + (seg.values[yi] || 0); }, 0);
  });

  return {
    key: timelineKey,
    years: years.slice(),
    segments: segments,
    totals: totals,
    milestoneCount: milestoneCount,
    hasData: totals.some(function (t) { return t > 0; }),
    hasIstReference: segments.some(function (seg) { return seg.istValue != null && seg.istValue > 0; }),
    istFallback: usedIstFallback && !segments.some(function (seg) {
      return seg.values.some(function (v, yi) { return v != null && v > 0 && seg.istValue != null && seg.istValue !== v; });
    }),
    unit: spec.unit,
    yAxisLabel: usedIstFallback ? spec.istYAxisLabel : spec.yAxisLabel,
    xAxisLabel: "Jahr",
  };
}

function fnResolveOrgSectionTimeline(data, timelineKey) {
  if (timelineKey === "gliederungenCombined") {
    var hc = fnResolveOrgSectionTimeline(data, "gliederungen");
    var teur = fnResolveOrgSectionTimeline(data, "gliederungenUmsatz");
    return fnMergeGliederungenTimelines(hc, teur);
  }
  var apiTimeline = data && data.orgSectionTimelines ? data.orgSectionTimelines[timelineKey] : null;
  if (apiTimeline && apiTimeline.hasData) return apiTimeline;
  var built = fnBuildOrgTimelineFromByYear(data || {}, timelineKey);
  if (built.hasData) return built;
  return apiTimeline || built;
}

function renderFnOrgSectionCharts(sectionDef, data) {
  var specs = fnOrgSectionChartSpecs(sectionDef.key);
  if (specs.length === 1 && specs[0].combined) {
    var combined = fnResolveOrgSectionTimeline(data, specs[0].timelineKey);
    return renderFnOrgCombinedChart(sectionDef, combined);
  }
  var rows = specs.map(function (chartSpec) {
    return {
      chartSpec: chartSpec,
      timeline: fnResolveOrgSectionTimeline(data, chartSpec.timelineKey),
    };
  });
  var hasAny = rows.some(function (row) { return row.timeline && row.timeline.hasData; });
  if (!hasAny) {
    return renderFnOrgSectionChart(sectionDef, rows[0].timeline);
  }
  return rows
    .filter(function (row) { return row.timeline && row.timeline.hasData; })
    .map(function (row) {
      var label = row.chartSpec.title
        ? sectionDef.label + " \u00b7 " + row.chartSpec.title
        : sectionDef.label;
      return renderFnOrgSectionChart({ label: label }, row.timeline);
    })
    .join("");
}

function fnCombinedTotalIst(segments, metric) {
  var sum = 0;
  var has = false;
  (segments || []).forEach(function (seg) {
    var v = metric === "hc" ? seg.istHc : seg.istTeur;
    if (v != null && Number.isFinite(v) && v > 0) {
      sum += v;
      has = true;
    }
  });
  return has ? Math.round(sum * 10) / 10 : null;
}

function fnCombinedSegmentsToStacked(segments, metric) {
  return (segments || []).map(function (seg, i) {
    var values = metric === "hc" ? seg.hcValues : seg.teurValues;
    return {
      label: seg.label,
      color: FN_ORG_COLORS[i % FN_ORG_COLORS.length],
      values: (values || []).map(function (v) { return v != null && v > 0 ? v : 0; }),
    };
  }).filter(function (seg) {
    return seg.values.some(function (v) { return v > 0; });
  });
}

function fnCombinedSegmentsToLineSeries(segments, years, metric, showIst) {
  return (segments || []).map(function (seg, i) {
    var raw = metric === "hc" ? seg.hcValues : seg.teurValues;
    var istVal = metric === "hc" ? seg.istHc : seg.istTeur;
    var soll = (raw || []).map(function (v) { return v != null && v > 0 ? v : null; });
    var ist = showIst && istVal != null && istVal > 0
      ? years.map(function () { return istVal; })
      : years.map(function () { return null; });
    return {
      label: seg.label,
      color: FN_ORG_COLORS[i % FN_ORG_COLORS.length],
      soll: soll,
      ist: ist,
    };
  }).filter(function (row) {
    return row.soll.some(function (v) { return v != null; })
      || row.ist.some(function (v) { return v != null; });
  });
}

function fnOrgSegmentLegendHtml(segments) {
  var legend = "";
  (segments || []).forEach(function (seg, i) {
    var color = FN_ORG_COLORS[i % FN_ORG_COLORS.length];
    legend += '<span class="p1f-org-chart__legend-item">';
    legend += '<span class="p1f-org-chart__swatch" style="background:' + color + '"></span>';
    legend += fnEsc(seg.label);
    legend += "</span>";
  });
  return legend;
}

function fnBindOrgChartViewToggles() {
  document.querySelectorAll(".p1f-org-chart--combined[data-org-chart]").forEach(function (root) {
    if (root.dataset.bound === "1") return;
    root.dataset.bound = "1";
    root.querySelectorAll(".p1f-org-chart__view-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var view = btn.getAttribute("data-view");
        root.querySelectorAll(".p1f-org-chart__view-btn").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });
        root.querySelectorAll(".p1f-org-chart__panel").forEach(function (panel) {
          var active = panel.getAttribute("data-panel") === view;
          panel.classList.toggle("is-active", active);
          panel.hidden = !active;
        });
        var noteBars = root.querySelector(".p1f-org-chart__note--bars");
        var noteLines = root.querySelector(".p1f-org-chart__note--lines");
        if (noteBars) noteBars.hidden = view !== "bars";
        if (noteLines) noteLines.hidden = view !== "lines";
      });
    });
  });
}

function renderFnOrgCombinedChart(sectionDef, timeline) {
  if (!timeline || !timeline.hasData) {
    return '<p class="p1f-org-chart__empty">Keine Plan-Meilensteine f\u00fcr ' + fnEsc(sectionDef.label) + ".</p>";
  }
  var years = timeline.years || [];
  var segments = timeline.segments || [];
  var showIst = timeline.hasIstReference && !timeline.istFallback;
  var hcStacked = fnCombinedSegmentsToStacked(segments, "hc");
  var teurStacked = fnCombinedSegmentsToStacked(segments, "teur");
  var hcLines = fnCombinedSegmentsToLineSeries(segments, years, "hc", showIst);
  var teurLines = fnCombinedSegmentsToLineSeries(segments, years, "teur", showIst);

  function stackedBlock(title, unit, yLabel, stackedSegs, metric) {
    if (!stackedSegs.length || typeof renderFortschrittStackedYearChartSvg !== "function") {
      return '<p class="p1f-org-chart__empty">' + fnEsc(title) + ": keine Werte.</p>";
    }
    var istTotal = showIst ? fnCombinedTotalIst(segments, metric) : null;
    return (
      '<div class="p1f-org-chart__metric">' +
      '<h5 class="p1f-org-chart__metric-title">' + fnEsc(title) + "</h5>" +
      '<div class="p1f-org-chart__wrap">' +
      renderFortschrittStackedYearChartSvg(
        {
          label: title,
          unit: unit,
          yAxisLabel: yLabel,
          xAxisLabel: "Jahr",
          showIstMarkers: false,
          showIstTotal: istTotal != null,
          istTotalValue: istTotal,
        },
        years,
        stackedSegs
      ) +
      "</div></div>"
    );
  }

  function lineBlock(title, unit, series) {
    if (!series.length || typeof renderFortschrittTimelineSvg !== "function") {
      return '<p class="p1f-org-chart__empty">' + fnEsc(title) + ": keine Werte.</p>";
    }
    return (
      '<div class="p1f-org-chart__metric">' +
      '<h5 class="p1f-org-chart__metric-title">' + fnEsc(title) + "</h5>" +
      '<div class="p1f-org-chart__wrap p1f-org-chart__wrap--wide">' +
      renderFortschrittTimelineSvg({ label: title, unit: unit }, years, series) +
      "</div></div>"
    );
  }

  var barsPanel =
    '<div class="p1f-org-chart__metrics">' +
    stackedBlock("Headcount (SOLL je Bereich)", "HC", "Headcount (SOLL)", hcStacked, "hc") +
    stackedBlock("Umsatz (SOLL je Bereich)", "TEUR", "Umsatz (TEUR)", teurStacked, "teur") +
    "</div>";

  var linesPanel =
    '<div class="p1f-org-chart__metrics">' +
    lineBlock("Headcount \u00b7 Entwicklung", "HC", hcLines) +
    lineBlock("Umsatz \u00b7 Entwicklung", "TEUR", teurLines) +
    "</div>";

  if (showIst && typeof renderFortschrittTimelineStyleLegend === "function") {
    linesPanel +=
      '<div class="p1f-org-chart__line-legend">' +
      renderFortschrittTimelineStyleLegend(FN_ORG_COLORS[0], "p1f-org-chart__line-legend-inner") +
      "</div>";
  }

  var legend = fnOrgSegmentLegendHtml(segments);
  if (showIst) {
    legend += '<span class="p1f-org-chart__legend-item p1f-org-chart__legend-item--ist">';
    legend += '<span class="p1f-org-chart__swatch p1f-org-chart__swatch--ist"></span>';
    legend += "IST gesamt (Jahresabschluss)";
    legend += "</span>";
  }

  var html = '<div class="p1f-org-chart p1f-org-chart--combined" data-org-chart="gliederungen">';
  html += '<div class="p1f-org-chart__headrow">';
  html += '<h4 class="p1f-org-chart__title">' + fnEsc(sectionDef.label) + " \u00fcber alle Jahre</h4>";
  html += '<div class="p1f-org-chart__view-toggle" role="tablist" aria-label="Diagrammansicht">';
  html += '<button type="button" class="p1f-org-chart__view-btn is-active" data-view="bars" role="tab" aria-selected="true">S\u00e4ulen</button>';
  html += '<button type="button" class="p1f-org-chart__view-btn" data-view="lines" role="tab" aria-selected="false">Entwicklung</button>';
  html += "</div></div>";
  if (timeline.istFallback) {
    html += '<p class="p1f-org-chart__note">Keine SOLL-Werte in Meilensteinen \u2013 Anzeige aus Phase-1-IST.</p>';
  } else {
    html += '<p class="p1f-org-chart__note p1f-org-chart__note--bars">Gestapelte S\u00e4ulen = SOLL je Bereich. Eine gestrichelte Linie = <strong>IST gesamt</strong> (Summe aller Bereiche). Je Bereich \u2192 Ansicht Entwicklung.</p>';
    html += '<p class="p1f-org-chart__note p1f-org-chart__note--lines" hidden>Je Bereich eine Linie (SOLL). Gestrichelt = IST je Bereich.</p>';
  }
  html += '<div class="p1f-org-chart__panel is-active" data-panel="bars">' + barsPanel + "</div>";
  html += '<div class="p1f-org-chart__panel" data-panel="lines" hidden>' + linesPanel + "</div>";
  if (legend) html += '<div class="p1f-org-chart__legend p1f-org-chart__legend--segments">' + legend + "</div>";
  html += "</div>";
  return html;
}

function renderFnOrgSectionChart(sectionDef, timeline) {
  if (!timeline || !timeline.hasData) {
    return '<p class="p1f-org-chart__empty">Keine Plan-Meilensteine f\u00fcr ' + fnEsc(sectionDef.label) + ".</p>";
  }
  var colored = fnOrgTimelineWithColors(timeline);
  var chartHtml = "";
  if (typeof renderFortschrittStackedYearChartSvg === "function") {
    chartHtml = renderFortschrittStackedYearChartSvg(
      {
        label: sectionDef.label + " \u00b7 " + (timeline.yAxisLabel || ""),
        unit: timeline.unit || "",
        yAxisLabel: timeline.yAxisLabel || "",
        xAxisLabel: timeline.xAxisLabel || "Jahr",
        showIstMarkers: false,
      },
      colored.years || [],
      colored.segments || []
    );
  }
  var legend = "";
  (colored.segments || []).forEach(function (seg) {
    legend += '<span class="p1f-org-chart__legend-item">';
    legend += '<span class="p1f-org-chart__swatch" style="background:' + seg.color + '"></span>';
    legend += fnEsc(seg.label);
    legend += "</span>";
  });
  if (timeline.hasIstReference && !timeline.istFallback) {
    legend += '<span class="p1f-org-chart__legend-item p1f-org-chart__legend-item--ist">';
    legend += '<span class="p1f-org-chart__swatch p1f-org-chart__swatch--ist"></span>';
    legend += "IST \u2192 Tabelle";
    legend += "</span>";
  }
  var html = '<div class="p1f-org-chart">';
  html += '<h4 class="p1f-org-chart__title">' + fnEsc(sectionDef.label) + " \u00fcber alle Jahre</h4>";
  if (timeline.istFallback) {
    html += '<p class="p1f-org-chart__note">Keine SOLL-Werte in Meilensteinen \u2013 Anzeige aus Phase-1-IST (konstant \u00fcber alle Jahre).</p>';
  } else if (timeline.hasIstReference) {
    html += '<p class="p1f-org-chart__note">S\u00e4ulen = SOLL aus Planung. IST-Vergleich in der Tabelle unten.</p>';
  }
  html += '<div class="p1f-org-chart__wrap">' + chartHtml + "</div>";
  if (legend) html += '<div class="p1f-org-chart__legend">' + legend + "</div>";
  html += "</div>";
  return html;
}

function renderFnOrgSection(sectionDef, items, data) {
  var chartSpecs = fnOrgSectionChartSpecs(sectionDef.key);
  var hasTimeline = chartSpecs.some(function (spec) {
    var tl = fnResolveOrgSectionTimeline(data, spec.timelineKey);
    return tl && tl.hasData;
  });
  var hasItems = items && items.length;
  if (!hasItems && !hasTimeline) return "";
  var primaryTimeline = fnResolveOrgSectionTimeline(data, chartSpecs[0].timelineKey);
  var msCount = hasTimeline
    ? Math.max.apply(null, chartSpecs.map(function (spec) {
      var tl = fnResolveOrgSectionTimeline(data, spec.timelineKey);
      return (tl && tl.milestoneCount) || 0;
    }))
    : items.reduce(function (n, item) { return n + ((item.milestones && item.milestones.length) || 0); }, 0);
  var itemCount = hasItems ? items.length : ((primaryTimeline && primaryTimeline.segments) ? primaryTimeline.segments.length : 0);
  var html = '<details class="p1f-org-section">';
  html += '<summary class="p1f-org-section__head">';
  html += '<span class="p1f-org-section__label">' + fnEsc(sectionDef.label) + '</span>';
  html += '<span class="p1f-org-section__count">' + itemCount + ' Eintr\u00e4ge \u00b7 ' + msCount + ' Meilensteine</span>';
  html += '</summary>';
  html += '<div class="p1f-org-section__body">';
  if (sectionDef.hint) {
    html += '<p class="p1f-org-section__hint">' + fnEsc(sectionDef.hint) + '</p>';
  }
  html += renderFnOrgSectionCharts(sectionDef, data);
  if (hasItems) {
    html += renderFnOrgComparisonPanel(sectionDef.key, items);
  }
  html += '</div></details>';
  return html;
}

var _fnMaDashboardData = null;
var _fnMaFilterSearch = "";
var _fnMaFilterKind = "all";
var _fnMaFilterCritical = false;

function fnMaFilterState() {
  return {
    search: _fnMaFilterSearch,
    kind: _fnMaFilterKind,
    critical: _fnMaFilterCritical,
  };
}

function fnMaSkillPlanRowKey(ms) {
  if (!ms) return "";
  if (ms.skillPlanKind === "tech") {
    if (ms.skillItemId) return "tech:id:" + ms.skillItemId;
    return "tech:" + String(ms.kategorie || "").trim() + "|" + String(ms.technologie || "").trim();
  }
  if (ms.skillPlanKind === "soft") {
    if (ms.kategorie_id != null) return "soft:id:" + ms.kategorie_id;
    return "soft:" + String(ms.kategorie || "").trim() + "|" + String(ms.kompetenz || "").trim();
  }
  return "";
}

function fnMaSkillPlanRowLabel(ms) {
  if (!ms) return "?";
  var kat = String(ms.kategorie || "").trim();
  if (ms.skillPlanKind === "tech") {
    var tech = String(ms.technologie || "").trim();
    if (tech) return tech;
    if (kat) return kat;
    return "?";
  }
  var detail = String(ms.kompetenz || "").trim();
  if (kat && detail) return kat + " \u00b7 " + detail;
  return kat || detail || "?";
}

function fnGetFortschrittSkillCatalog(kind) {
  var cats =
    kind === "soft"
      ? typeof SOFT_SKILL_CATEGORIES !== "undefined"
        ? SOFT_SKILL_CATEGORIES
        : []
      : typeof SKILL_CATEGORIES !== "undefined"
        ? SKILL_CATEGORIES
        : [];
  return (cats || [])
    .map(function (c) {
      return { id: Number(c.id), name: String(c.name || "").trim() };
    })
    .filter(function (c) {
      return Number.isInteger(c.id) && c.id > 0 && c.name;
    });
}

function fnCatalogSkillKey(kind, catId) {
  return (kind === "soft" ? "soft" : "tech") + ":id:" + catId;
}

function fnResolveMilestoneCatalogKey(m, kind) {
  if (!m || m.skillPlanKind !== kind) return null;
  if (m.kategorie_id != null) {
    var id = Number(m.kategorie_id);
    if (Number.isInteger(id) && id > 0) return fnCatalogSkillKey(kind, id);
  }
  var kat = String(m.kategorie || "").trim();
  if (!kat) return null;
  var catalog = fnGetFortschrittSkillCatalog(kind);
  var cat = catalog.find(function (c) {
    return c.name === kat;
  });
  return cat ? fnCatalogSkillKey(kind, cat.id) : null;
}

function fnSortHeatmapRows(rows, kind) {
  var catalog = fnGetFortschrittSkillCatalog(kind);
  var order = {};
  catalog.forEach(function (cat, index) {
    order[fnCatalogSkillKey(kind, cat.id)] = index;
  });
  return (rows || []).slice().sort(function (a, b) {
    var ao = Object.prototype.hasOwnProperty.call(order, a.key) ? order[a.key] : 10000;
    var bo = Object.prototype.hasOwnProperty.call(order, b.key) ? order[b.key] : 10000;
    if (ao !== bo) return ao - bo;
    return String(a.label || "").localeCompare(String(b.label || ""), "de");
  });
}

function fnFindIstLevelForCatalog(employeeRow, kind, cat) {
  if (!employeeRow || !cat) return null;
  if (kind === "soft") {
    var matchSoft = (employeeRow.softSkills || []).find(function (s) {
      if (s.kategorie_id != null) return Number(s.kategorie_id) === cat.id;
      return String(s.kategorie || "").trim() === cat.name;
    });
    return matchSoft && matchSoft.level != null ? Number(matchSoft.level) : null;
  }
  var matchTech = (employeeRow.skills || []).find(function (s) {
    if (s.kategorie_id != null) return Number(s.kategorie_id) === cat.id;
    return String(s.kategorie || "").trim() === cat.name;
  });
  return matchTech && matchTech.level != null ? Number(matchTech.level) : null;
}

function fnCountHeatmapPlannedRows(heatmaps) {
  var n = 0;
  ["tech", "soft"].forEach(function (kind) {
    var hm = heatmaps && heatmaps[kind];
    if (!hm || !hm.rows) return;
    hm.rows.forEach(function (_row, ri) {
      var cells = (hm.cells && hm.cells[ri]) || [];
      if (cells.some(function (c) { return c && c.level != null; })) n += 1;
    });
  });
  return n;
}

function fnIsSkillLevelExplicit(ms) {
  if (!ms) return false;
  if (ms.skill_level_explicit === true) return true;
  var n = Number(ms.ziel_skill_level_min);
  return Number.isFinite(n) && n >= 2 && n <= 5;
}

function fnResolvedSkillSollLevel(ms) {
  if (!fnIsSkillLevelExplicit(ms)) return null;
  var n = fnParseNum(ms.ziel_skill_level_min);
  return n != null && Number.isFinite(n) ? n : null;
}

function fnBuildEmployeeSkillYearHeatmapKind(milestones, kind, years) {
  var yearList = (years || []).map(function (y) { return Number(y); });
  var rowMap = {};
  var levelMap = {};

  fnGetFortschrittSkillCatalog(kind).forEach(function (cat) {
    var key = fnCatalogSkillKey(kind, cat.id);
    rowMap[key] = { key: key, label: cat.name, catalogId: cat.id };
  });

  (milestones || []).forEach(function (m) {
    if (!m || m.skillPlanKind !== kind) return;
    var level = fnResolvedSkillSollLevel(m);
    if (!Number.isFinite(level) || level < 1 || level > 5) return;
    var key = fnResolveMilestoneCatalogKey(m, kind) || fnMaSkillPlanRowKey(m);
    if (!key) return;
    if (!rowMap[key]) {
      rowMap[key] = { key: key, label: fnMaSkillPlanRowLabel(m) };
    }
    var year = m.jahr != null ? Number(m.jahr) : null;
    if (year == null || yearList.indexOf(year) < 0) return;
    if (!levelMap[key]) levelMap[key] = {};
    var existing = levelMap[key][year];
    if (existing == null || level > existing) levelMap[key][year] = level;
  });

  var rows = fnSortHeatmapRows(
    Object.keys(rowMap).map(function (k) { return rowMap[k]; }),
    kind
  );
  var columns = yearList.map(function (y) { return { key: y, label: String(y) }; });
  var cells = rows.map(function (row) {
    return columns.map(function (col) {
      var level = levelMap[row.key] && levelMap[row.key][col.key];
      return level != null ? { level: level } : null;
    });
  });

  return {
    rows: rows,
    columns: columns,
    cells: cells,
    hasData: rows.length > 0 && columns.length > 0,
  };
}

function fnBuildEmployeeSkillYearHeatmap(item, years) {
  var milestones = item.allYearMilestones || item.milestones || [];
  return {
    tech: fnBuildEmployeeSkillYearHeatmapKind(milestones, "tech", years),
    soft: fnBuildEmployeeSkillYearHeatmapKind(milestones, "soft", years),
  };
}

function fnCollectAllYearsMitarbeiter(data) {
  var merged = [];
  (data.byYear || []).forEach(function (row) {
    ((row.p1Plan && row.p1Plan.mitarbeiter) || []).forEach(function (item) {
      var bucket = null;
      for (var i = 0; i < merged.length; i++) {
        if (fnEmployeeItemsMatch(merged[i], item)) {
          bucket = merged[i];
          break;
        }
      }
      if (!bucket) {
        bucket = Object.assign({}, item, {
          skillComparisons: [],
          allYearMilestones: [],
          milestones: [],
        });
        merged.push(bucket);
      }
      (item.skillComparisons || []).forEach(function (sc) {
        var exists = bucket.skillComparisons.some(function (x) {
          return x.skillKey === sc.skillKey && x.milestoneId === sc.milestoneId;
        });
        if (!exists) bucket.skillComparisons.push(sc);
      });
      (item.allYearMilestones || item.milestones || []).forEach(function (m) {
        var exists = bucket.allYearMilestones.some(function (x) {
          return x.id && m.id && x.id === m.id;
        });
        if (!exists) bucket.allYearMilestones.push(m);
      });
      if (!bucket.skillEntryId && item.skillEntryId) bucket.skillEntryId = item.skillEntryId;
      if (!bucket.label && item.label) bucket.label = item.label;
      if ((item.plannedSkillCount || 0) > (bucket.plannedSkillCount || 0)) {
        bucket.plannedSkillCount = item.plannedSkillCount;
        bucket.status = item.status || bucket.status;
      }
    });
  });
  return merged.map(function (item) {
    if (!item.milestones || !item.milestones.length) item.milestones = item.allYearMilestones || [];
    return item;
  });
}

function fnStatusFromSkillGap(gap) {
  if (gap == null || !Number.isFinite(gap)) return "neutral";
  if (gap >= 0) return "ok";
  if (gap >= -0.5) return "warn";
  return "risk";
}

function fnFindEmployeeIstSkillLevelClient(employeeRow, ms) {
  if (!employeeRow || !ms) return null;
  if (ms.skillPlanKind === "soft") {
    var matchSoft = (employeeRow.softSkills || []).find(function (s) {
      if (ms.kategorie_id != null && s.kategorie_id != null) {
        return Number(s.kategorie_id) === Number(ms.kategorie_id);
      }
      return String(s.kategorie || "").trim() === String(ms.kategorie || "").trim();
    });
    return matchSoft && matchSoft.level != null ? Number(matchSoft.level) : null;
  }
  if (ms.skillPlanKind === "tech") {
    var matchTech = (employeeRow.skills || []).find(function (s) {
      if (ms.skillItemId && s.skillItemId) return String(s.skillItemId) === String(ms.skillItemId);
      var sameKat = String(s.kategorie || "").trim() === String(ms.kategorie || "").trim();
      var tech = String(ms.technologie || "").trim();
      var sTech = String(s.technologie || "").trim();
      return sameKat && (!tech || !sTech || tech === sTech);
    });
    return matchTech && matchTech.level != null ? Number(matchTech.level) : null;
  }
  return null;
}

function fnEmployeeSkillCategoryKeyClient(ms) {
  if (!ms) return "unknown";
  var kind = ms.skillPlanKind === "soft" ? "soft" : "tech";
  if (ms.kategorie_id != null) {
    var id = Number(ms.kategorie_id);
    if (Number.isInteger(id) && id > 0) return fnCatalogSkillKey(kind, id);
  }
  var kat = String(ms.kategorie || "").trim();
  if (kat) {
    var catalog = fnGetFortschrittSkillCatalog(kind);
    var cat = catalog.find(function (c) { return c.name === kat; });
    if (cat) return fnCatalogSkillKey(kind, cat.id);
  }
  return kind + ":" + (kat || "Sonstiges");
}

function fnNormalizeComparisonKey(sc) {
  var kind = sc.skillPlanKind === "soft" ? "soft" : "tech";
  if (sc.kategorie_id != null) {
    var id = Number(sc.kategorie_id);
    if (Number.isInteger(id) && id > 0) return fnCatalogSkillKey(kind, id);
  }
  var kat = String(sc.kategorie || "").trim();
  if (kat) {
    var catalog = fnGetFortschrittSkillCatalog(kind);
    var cat = catalog.find(function (c) { return c.name === kat; });
    if (cat) return fnCatalogSkillKey(kind, cat.id);
  }
  return sc.skillKey || fnEmployeeSkillCategoryKeyClient(sc);
}

function fnSeedCatalogHeatmapColumns(columnMap, kind) {
  fnGetFortschrittSkillCatalog(kind).forEach(function (cat) {
    var key = fnCatalogSkillKey(kind, cat.id);
    if (!columnMap[key]) {
      columnMap[key] = {
        key: key,
        label: cat.name,
        kind: kind === "soft" ? "soft" : "tech",
        catalogId: cat.id,
      };
    }
  });
}

function fnFindComparisonForCatalog(skillComparisons, kind, cat) {
  return (skillComparisons || []).find(function (sc) {
    if (sc.skillPlanKind && sc.skillPlanKind !== kind) return false;
    if (sc.kategorie_id != null && Number(sc.kategorie_id) === cat.id) return true;
    if (String(sc.kategorie || "").trim() === cat.name) return true;
    return fnNormalizeComparisonKey(sc) === fnCatalogSkillKey(kind, cat.id);
  });
}

function fnSortHeatmapColumns(columns) {
  var techOrder = {};
  var softOrder = {};
  fnGetFortschrittSkillCatalog("tech").forEach(function (cat, index) {
    techOrder[fnCatalogSkillKey("tech", cat.id)] = index;
  });
  fnGetFortschrittSkillCatalog("soft").forEach(function (cat, index) {
    softOrder[fnCatalogSkillKey("soft", cat.id)] = index;
  });
  return (columns || []).slice().sort(function (a, b) {
    var orderA = a.kind === "soft" ? softOrder[a.key] : techOrder[a.key];
    var orderB = b.kind === "soft" ? softOrder[b.key] : techOrder[b.key];
    var rankA = orderA != null ? orderA : 10000;
    var rankB = orderB != null ? orderB : 10000;
    if (a.kind !== b.kind) {
      return a.kind === "tech" ? -1 : 1;
    }
    if (rankA !== rankB) return rankA - rankB;
    var ka = String(a.label).localeCompare(String(b.label), "de");
    if (ka !== 0) return ka;
    return String(a.kind).localeCompare(String(b.kind));
  });
}

function fnFillCatalogIstCells(cellMap, employeeRow) {
  ["tech", "soft"].forEach(function (kind) {
    fnGetFortschrittSkillCatalog(kind).forEach(function (cat) {
      var key = fnCatalogSkillKey(kind, cat.id);
      if (cellMap[key]) return;
      var ist = fnFindIstLevelForCatalog(employeeRow, kind, cat);
      if (ist != null) {
        cellMap[key] = {
          istLevel: ist,
          sollLevel: null,
          gap: null,
          status: "neutral",
        };
      }
    });
  });
}

function fnBuildSkillComparisonsFromMilestones(item, employeeRow) {
  var milestones = item.allYearMilestones || item.milestones || [];
  var comparisons = [];
  var skillPlans = milestones.filter(function (m) {
    return m && (m.skillPlanKind === "tech" || m.skillPlanKind === "soft");
  });
  var legacy = milestones.filter(function (m) { return m && !m.skillPlanKind; });

  skillPlans.forEach(function (m) {
    var sollLevel = fnResolvedSkillSollLevel(m);
    var istLevel = fnFindEmployeeIstSkillLevelClient(employeeRow, m);
    var gap = istLevel != null && sollLevel != null && Number.isFinite(sollLevel)
      ? istLevel - sollLevel
      : null;
    comparisons.push({
      skillKey: fnEmployeeSkillCategoryKeyClient(m),
      skillPlanKind: m.skillPlanKind,
      kategorie: String(m.kategorie || "").trim(),
      kategorie_id: m.kategorie_id != null ? Number(m.kategorie_id) : null,
      technologie: String(m.technologie || "").trim(),
      kompetenz: String(m.kompetenz || "").trim(),
      istLevel: istLevel,
      sollLevel: Number.isFinite(sollLevel) ? sollLevel : null,
      gap: gap != null ? Math.round(gap * 10) / 10 : null,
      status: fnStatusFromSkillGap(gap),
      planYear: m.jahr != null ? Number(m.jahr) : null,
      planQuarter: m.ziel_quartal || null,
      milestoneId: m.id || null,
    });
  });

  if (!skillPlans.length && legacy.length) {
    var sollMin = null;
    legacy.forEach(function (m) {
      var v = fnResolvedSkillSollLevel(m);
      if (v != null) sollMin = sollMin == null ? v : Math.max(sollMin, v);
    });
    var istAvg = employeeRow && employeeRow.avgLevel != null
      ? employeeRow.avgLevel
      : (item.istAvg != null ? item.istAvg : null);
    var legacyGap = istAvg != null && sollMin != null ? istAvg - sollMin : null;
    comparisons.push({
      skillKey: "legacy:general",
      skillPlanKind: null,
      kategorie: "Allgemeines Ziel",
      technologie: "",
      kompetenz: "",
      istLevel: istAvg,
      sollLevel: sollMin,
      gap: legacyGap != null ? Math.round(legacyGap * 10) / 10 : null,
      status: fnStatusFromSkillGap(legacyGap),
      planYear: legacy[0] && legacy[0].jahr != null ? Number(legacy[0].jahr) : null,
      planQuarter: (legacy[0] && legacy[0].ziel_quartal) || null,
      milestoneId: null,
    });
  }

  return comparisons;
}

function fnNormalizeMitarbeiterItem(item, phase1) {
  if (!item) return item;
  var employeeRow = fnFindEmployeePhase1Row(phase1, item);
  var skillComparisons = item.skillComparisons;
  if (!skillComparisons || !skillComparisons.length) {
    skillComparisons = fnBuildSkillComparisonsFromMilestones(item, employeeRow);
  }
  var status = item.status || "neutral";
  var criticalGapCount = item.criticalGapCount || 0;
  if (skillComparisons.length && (!item.skillComparisons || !item.skillComparisons.length)) {
    status = "neutral";
    criticalGapCount = 0;
    skillComparisons.forEach(function (sc) {
      var rank = { risk: 3, warn: 2, ok: 1, neutral: 0 };
      if ((rank[sc.status] || 0) >= (rank[status] || 0)) status = sc.status;
      if (sc.status === "risk" || sc.status === "warn") criticalGapCount += 1;
    });
  }
  return Object.assign({}, item, {
    skillComparisons: skillComparisons,
    plannedSkillCount: skillComparisons.length,
    status: status,
    criticalGapCount: criticalGapCount,
    skillCount: employeeRow && employeeRow.skillCount != null ? employeeRow.skillCount : item.skillCount,
  });
}

function fnHasPhase1Skills(phase1) {
  if (!phase1 || !phase1.skills) return false;
  if (phase1.skills.employees && phase1.skills.employees.length) return true;
  if (phase1.skills.avgSkillByCategory && phase1.skills.avgSkillByCategory.length) return true;
  return false;
}

function fnBootstrapMitarbeiterFromPhase1(phase1, items) {
  var list = (items || []).slice();
  var employees = (phase1 && phase1.skills && phase1.skills.employees) || [];
  if (!employees.length) return list;
  employees.forEach(function (emp) {
    var existing = list.find(function (item) {
      return fnEmployeeItemsMatch(item, { skillEntryId: emp.skillEntryId, label: emp.name, subcategory: emp.name });
    });
    if (existing) {
      if (!existing.skillEntryId && emp.skillEntryId) existing.skillEntryId = emp.skillEntryId;
      if (!existing.label) existing.label = emp.name;
      if (!existing.subcategory) existing.subcategory = emp.name;
      if (existing.skillCount == null && emp.skillCount != null) existing.skillCount = emp.skillCount;
      if (existing.istAvg == null && emp.avgLevel != null) existing.istAvg = emp.avgLevel;
      return;
    }
    list.push({
      subcategory: emp.name,
      label: emp.name,
      skillEntryId: emp.skillEntryId,
      istAvg: emp.avgLevel,
      skillCount: emp.skillCount,
      zertifiziert: emp.zertifiziert,
      status: "neutral",
      criticalGapCount: 0,
      plannedSkillCount: 0,
      skillComparisons: [],
      milestones: [],
    });
  });
  return list;
}

function fnNormalizeMitarbeiterList(items, phase1) {
  return (items || []).map(function (item) {
    return fnNormalizeMitarbeiterItem(item, phase1);
  }).filter(function (item) {
    if (item.skillComparisons && item.skillComparisons.length) return true;
    if (item.milestones && item.milestones.length) return true;
    if (item.allYearMilestones && item.allYearMilestones.length) return true;
    if (item.skillEntryId || (item.skillCount != null && item.skillCount > 0)) return true;
    return false;
  });
}

function fnResolveMitarbeiterDashboardData(data) {
  if (!data) return { mitarbeiter: [], phase1: null, years: [] };
  var phase1 = data.phase1 || null;
  var mitarbeiter = [];
  var years = data.years || [];

  if (data.allYears && data.byYear) {
    if (_fnYearAll) {
      mitarbeiter = fnCollectAllYearsMitarbeiter(data);
    } else {
      var yearRow = (data.byYear || []).find(function (r) { return Number(r.year) === Number(_fnYear); });
      if (yearRow) {
        mitarbeiter = (yearRow.p1Plan && yearRow.p1Plan.mitarbeiter) || [];
      } else {
        mitarbeiter = fnCollectAllYearsMitarbeiter(data);
      }
    }
  } else {
    mitarbeiter = (data.p1Plan && data.p1Plan.mitarbeiter) || [];
  }

  if (data.mitarbeiterPlanAllYears && data.mitarbeiterPlanAllYears.length) {
    mitarbeiter = mitarbeiter.concat(data.mitarbeiterPlanAllYears);
  }

  mitarbeiter = fnBootstrapMitarbeiterFromPhase1(phase1, mitarbeiter);
  mitarbeiter = fnMergeMitarbeiterItems(mitarbeiter);
  mitarbeiter = fnNormalizeMitarbeiterList(mitarbeiter, phase1);
  return { mitarbeiter: mitarbeiter, phase1: phase1, years: years };
}

function fnFilterMaItems(mitarbeiter, filters) {
  var search = String(filters.search || "").toLowerCase().trim();
  return (mitarbeiter || []).filter(function (item) {
    if (search && String(item.label || item.subcategory || "").toLowerCase().indexOf(search) < 0) return false;
    if (filters.critical && item.status !== "risk") return false;
    return true;
  });
}

function fnEmployeeNameKeys(name) {
  var raw = String(name || "").trim().toLowerCase();
  if (!raw) return [];
  var keys = [raw];
  var comma = raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  if (comma.length === 2) {
    keys.push(comma[1] + " " + comma[0]);
    keys.push(comma[0] + ", " + comma[1]);
  }
  var parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 2) {
    keys.push(parts[1] + ", " + parts[0]);
    keys.push(parts[0] + " " + parts[1]);
  }
  return keys.filter(function (k, i, arr) { return arr.indexOf(k) === i; });
}

function fnEmployeeItemsMatch(a, b) {
  if (!a || !b) return false;
  if (a.skillEntryId && b.skillEntryId && a.skillEntryId === b.skillEntryId) return true;
  var keysA = fnEmployeeNameKeys(a.label || a.subcategory);
  var keysB = fnEmployeeNameKeys(b.label || b.subcategory);
  if (!keysA.length || !keysB.length) return false;
  return keysA.some(function (ka) { return keysB.indexOf(ka) >= 0; });
}

function fnMergeMitarbeiterItems(items) {
  var out = [];
  (items || []).forEach(function (item) {
    var matchIdx = -1;
    for (var i = 0; i < out.length; i++) {
      if (fnEmployeeItemsMatch(out[i], item)) {
        matchIdx = i;
        break;
      }
    }
    if (matchIdx < 0) {
      out.push(Object.assign({}, item));
      return;
    }
    var base = out[matchIdx];
    var ms = (base.allYearMilestones || base.milestones || []).slice();
    (item.allYearMilestones || item.milestones || []).forEach(function (m) {
      var exists = ms.some(function (x) { return x.id && m.id && x.id === m.id; });
      if (!exists) ms.push(m);
    });
    var sc = (base.skillComparisons || []).slice();
    (item.skillComparisons || []).forEach(function (s) {
      var exists = sc.some(function (x) {
        return x.skillKey === s.skillKey && x.milestoneId === s.milestoneId;
      });
      if (!exists) sc.push(s);
    });
    var merged = Object.assign({}, base, item, {
      skillEntryId: base.skillEntryId || item.skillEntryId,
      label: base.label || item.label,
      subcategory: base.subcategory || item.subcategory,
      allYearMilestones: ms,
      milestones: ms,
      skillComparisons: sc.length ? sc : (base.skillComparisons || item.skillComparisons || []),
    });
    if ((item.plannedSkillCount || 0) > (base.plannedSkillCount || 0)) {
      merged.plannedSkillCount = item.plannedSkillCount;
      merged.status = item.status || merged.status;
      merged.criticalGapCount = item.criticalGapCount != null ? item.criticalGapCount : merged.criticalGapCount;
    }
    out[matchIdx] = merged;
  });
  return out;
}

function fnFindEmployeePhase1Row(phase1, item) {
  var employees = phase1 && phase1.skills && phase1.skills.employees;
  if (!employees || !item) return null;
  if (item.skillEntryId) {
    var byId = employees.find(function (e) { return e.skillEntryId === item.skillEntryId; });
    if (byId) return byId;
  }
  var labelKeys = fnEmployeeNameKeys(item.label || item.subcategory);
  if (!labelKeys.length) return null;
  return employees.find(function (e) {
    var empKeys = fnEmployeeNameKeys(e.name);
    return labelKeys.some(function (lk) { return empKeys.indexOf(lk) >= 0; });
  }) || null;
}

function renderFnMaEmployeeSkillHeatmaps(item, years) {
  var heatmaps = fnBuildEmployeeSkillYearHeatmap(item, years);
  var catalogTech = fnGetFortschrittSkillCatalog("tech");
  var catalogSoft = fnGetFortschrittSkillCatalog("soft");
  var yearList = (years || []).filter(function (y) { return y != null && y !== ""; });
  var showYearTech = catalogTech.length > 0 && yearList.length > 0;
  var showYearSoft = catalogSoft.length > 0 && yearList.length > 0;
  var html = '<div class="p1f-ma-skill-heatmaps">';

  if (showYearTech || showYearSoft) {
    html += '<div class="p1f-ma-skill-heatmaps__row">';
    if (showYearTech) {
      html += '<div class="p1f-ma-skill-heatmap-section" data-ma-kind="tech">';
      html += '<h5 class="p1f-ma-skill-heatmap__title">Fachliche Skills \u00b7 SOLL je Jahr</h5>';
      html += '<div class="p1f-heatmap-wrap">';
      if (typeof renderFortschrittSkillLevelHeatmapSvg === "function") {
        html += renderFortschrittSkillLevelHeatmapSvg({ label: "Fachliche Skills" }, heatmaps.tech);
      }
      html += "</div></div>";
    }
    if (showYearSoft) {
      html += '<div class="p1f-ma-skill-heatmap-section" data-ma-kind="soft">';
      html += '<h5 class="p1f-ma-skill-heatmap__title">Soft Skills \u00b7 SOLL je Jahr</h5>';
      html += '<div class="p1f-heatmap-wrap">';
      if (typeof renderFortschrittSkillLevelHeatmapSvg === "function") {
        html += renderFortschrittSkillLevelHeatmapSvg({ label: "Soft Skills" }, heatmaps.soft);
      }
      html += "</div></div>";
    }
    html += "</div>";
    if (typeof renderFortschrittSkillLevelLegend === "function") {
      html += renderFortschrittSkillLevelLegend();
    }
  } else {
    var phase1 = _fnMaDashboardData && _fnMaDashboardData.phase1;
    var cmpHeatmap = fnBuildEmployeeSkillHeatmapFromItems([item], phase1);
    if (cmpHeatmap && cmpHeatmap.hasData && typeof renderFortschrittSkillHeatmapSvg === "function") {
      html += '<div class="p1f-ma-skill-heatmap-section">';
      html += '<h5 class="p1f-ma-skill-heatmap__title">Skills \u00b7 IST vs. SOLL</h5>';
      html += '<div class="p1f-heatmap-wrap">' + renderFortschrittSkillHeatmapSvg({ label: item.label || item.subcategory }, cmpHeatmap) + "</div>";
      html += "</div>";
    } else {
      html += '<p class="bc-muted p1f-ma-skill-heatmap__empty">Keine Skill-Planungen vorhanden.</p>';
    }
  }

  html += "</div>";
  return html;
}

function renderFnMaOverviewTable(items) {
  if (!items || !items.length) return "";
  var head = "<tr><th>Mitarbeiter</th><th>Skills IST</th><th>Geplant</th><th>Kritische Gaps</th><th>Status</th></tr>";
  var rows = "";
  items.forEach(function (item) {
    rows += '<tr class="' + fnStatusClass(item.status) + '" data-ma-row="' + fnEsc(item.skillEntryId || item.label || "") + '">';
    rows += "<td>" + fnEsc(item.label || item.subcategory) + "</td>";
    rows += "<td>" + fnEsc(item.skillCount != null ? item.skillCount : "\u2013") + "</td>";
    rows += "<td>" + fnEsc(item.plannedSkillCount != null ? item.plannedSkillCount : "\u2013") + "</td>";
    rows += "<td>" + fnEsc(item.criticalGapCount != null ? item.criticalGapCount : 0) + "</td>";
    rows += "<td>" + fnStatusIcon(item.status) + " " + fnEsc(fnStatusLabel(item.status)) + "</td>";
    rows += "</tr>";
  });
  return (
    '<details class="p1f-milestones-panel p1f-ma-details">' +
    '<summary class="p1f-milestones-panel__head">Mitarbeiter \u00b7 Vergleichsdetails (' + items.length + ")</summary>" +
    '<div class="p1f-ma-details__body">' +
    '<div class="tbl-wrap p1f-ma-table-wrap">' +
    '<table class="entries fortschritt-table p1f-ma-table">' +
    "<thead>" + head + "</thead><tbody>" + rows + "</tbody></table></div></div></details>"
  );
}

function fnResolvePhase1SkillsView(data) {
  var phase1 = (data && data.phase1) || null;
  var skills = phase1 && phase1.skills ? phase1.skills : null;
  var cats = (skills && skills.avgSkillByCategory) || [];
  var employees = (skills && skills.employees) || [];
  var zertQuote = skills && skills.zertifiziertQuote != null ? skills.zertifiziertQuote : null;
  var employeeCount = skills && skills.employeeCount != null ? skills.employeeCount : null;

  if (!cats.length && !employees.length && data && data.p1Ist && data.p1Ist.skills && data.p1Ist.skills.length) {
    cats = data.p1Ist.skills.map(function (s) {
      return { category: s.subcategory, avgLevel: s.avgLevel, count: s.count };
    });
  }

  return { phase1: phase1, cats: cats, employees: employees, zertifiziertQuote: zertQuote, employeeCount: employeeCount };
}

function renderFnPhase1SkillsSummary(data) {
  var view = fnResolvePhase1SkillsView(data);
  if (!view.cats.length && !view.employees.length) return "";

  var html = '<div class="p1f-heatmap" style="margin-bottom:.65rem">';
  html += '<h4 class="p1f-heatmap__title">Skills \u00b7 IST-Stand (Phase 1)</h4>';
  if (view.zertifiziertQuote != null) {
    html += '<p class="p1f-heatmap__hint">Zertifizierungsquote: <b>' + fnFormatNum(view.zertifiziertQuote) + '%</b>';
    if (view.employeeCount) html += ' \u00b7 ' + view.employeeCount + ' Mitarbeiter in der Skill-Matrix';
    html += '</p>';
  } else if (view.employeeCount) {
    html += '<p class="p1f-heatmap__hint">' + view.employeeCount + ' Mitarbeiter in der Skill-Matrix</p>';
  }
  if (view.cats.length) {
    html += '<ul class="fortschritt-facts" style="margin:.35rem 0 0">';
    view.cats.forEach(function (s) {
      html += '<li>' + fnEsc(s.category) + ': <b>\u00d8 Level ' + fnFormatNum(s.avgLevel) + '</b>';
      var maCount = s.employeeCount != null ? s.employeeCount : s.count;
      if (maCount != null) html += ' (' + fnFormatNum(maCount) + ' MA)';
      html += '</li>';
    });
    html += '</ul>';
  }
  html += '</div>';
  return html;
}

function renderFnMaEmployeeIstSkills(item, phase1) {
  var emp = fnFindEmployeePhase1Row(phase1, item);
  if (!emp) return "";
  var tech = emp.skills || [];
  var soft = emp.softSkills || [];
  if (!tech.length && !soft.length) return "";

  var html = '<div class="p1f-ma-ist">';
  html += '<div class="p1f-ma-ist__head">Skills IST (Phase 1)</div>';
  html += '<ul class="p1f-ma-skill-list">';
  tech.forEach(function (s) {
    var label = String(s.kategorie || "").trim();
    if (s.technologie) label += (label ? " \u00b7 " : "") + String(s.technologie).trim();
    html += '<li class="p1f-ma-skill"><span class="p1f-ma-skill__label">' + fnEsc(label || "Fach-Skill") + '</span>';
    html += '<span class="p1f-ma-skill__level">Level ' + fnEsc(s.level != null ? s.level : "\u2013") + "</span></li>";
  });
  soft.forEach(function (s) {
    var label = String(s.kategorie || s.competenz || "Soft Skill").trim();
    html += '<li class="p1f-ma-skill"><span class="p1f-ma-skill__label">' + fnEsc(label) + '</span>';
    html += '<span class="p1f-ma-skill__level">Level ' + fnEsc(s.level != null ? s.level : "\u2013") + "</span></li>";
  });
  html += "</ul></div>";
  return html;
}

function renderFnMaEmployeeSubcat(item, years) {
  var statusCls = fnStatusClass(item.status);
  var heatmaps = fnBuildEmployeeSkillYearHeatmap(item, years);
  var planned = fnCountHeatmapPlannedRows(heatmaps);
  var phase1 = _fnMaDashboardData && _fnMaDashboardData.phase1;
  var html = '<details class="p1f-subcat p1f-ma-subcat ' + statusCls + '" data-ma-subcat="' + fnEsc(item.skillEntryId || item.label || "") + '">';
  html += '<summary class="p1f-subcat__head">';
  html += '<span class="p1f-subcat__label">' + fnEsc(item.label || item.subcategory) + "</span>";
  html += '<span class="p1f-subcat__count">';
  if (planned) {
    html += planned + " Skills geplant \u00b7 ";
  } else if (item.skillCount != null) {
    html += fnFormatNum(item.skillCount) + " Skills IST \u00b7 ";
  }
  html += fnEsc(fnStatusLabel(item.status)) + "</span>";
  html += "</summary>";
  html += '<div class="p1f-subcat__body">';
  html += renderFnMaEmployeeIstSkills(item, phase1);
  html += renderFnMaEmployeeSkillHeatmaps(item, years);
  html += "</div></details>";
  return html;
}

function renderFnMaFilters() {
  return (
    '<div class="p1f-ma-filters">' +
    '<div class="p1f-ma-filters__field">' +
    '<span class="p1f-ma-filters__label">Suche</span>' +
    '<input type="search" class="p1f-ma-filters__control" id="p1fMaFilterSearch" placeholder="Name\u2026" value="' + fnEsc(_fnMaFilterSearch) + '">' +
    "</div>" +
    '<div class="p1f-ma-filters__field">' +
    '<span class="p1f-ma-filters__label">Art</span>' +
    '<select class="p1f-ma-filters__control" id="p1fMaFilterKind">' +
    '<option value="all"' + (_fnMaFilterKind === "all" ? " selected" : "") + ">Alle</option>" +
    '<option value="tech"' + (_fnMaFilterKind === "tech" ? " selected" : "") + ">Fach</option>" +
    '<option value="soft"' + (_fnMaFilterKind === "soft" ? " selected" : "") + ">Soft</option>" +
    "</select></div>" +
    '<label class="p1f-ma-filters__field p1f-ma-filters__field--check">' +
    '<input type="checkbox" id="p1fMaFilterCritical"' + (_fnMaFilterCritical ? " checked" : "") + ">" +
    '<span class="p1f-ma-filters__label">Nur kritische</span></label>' +
    "</div>"
  );
}

function fnRefreshMaFilteredView() {
  if (!_fnMaDashboardData) return;
  var filters = fnMaFilterState();
  var filtered = fnFilterMaItems(_fnMaDashboardData.mitarbeiter, filters);

  document.querySelectorAll(".p1f-ma-subcat").forEach(function (el) {
    var key = el.getAttribute("data-ma-subcat") || "";
    var visible = filtered.some(function (item) {
      return String(item.skillEntryId || item.label || "") === key;
    });
    el.style.display = visible ? "" : "none";
  });

  document.querySelectorAll(".p1f-ma-skill-heatmap-section[data-ma-kind]").forEach(function (el) {
    var kind = el.getAttribute("data-ma-kind") || "";
    var showKind = filters.kind === "all" || filters.kind === kind;
    var parent = el.closest(".p1f-ma-subcat");
    var parentVisible = !parent || parent.style.display !== "none";
    el.style.display = showKind && parentVisible ? "" : "none";
  });

  document.querySelectorAll(".p1f-ma-table tbody tr[data-ma-row]").forEach(function (tr) {
    var key = tr.getAttribute("data-ma-row") || "";
    var visible = filtered.some(function (item) {
      return String(item.skillEntryId || item.label || "") === key;
    });
    tr.style.display = visible ? "" : "none";
  });
}

function fnBindMitarbeiterFilters() {
  var searchEl = document.getElementById("p1fMaFilterSearch");
  var kindEl = document.getElementById("p1fMaFilterKind");
  var critEl = document.getElementById("p1fMaFilterCritical");
  if (!searchEl && !kindEl && !critEl) return;

  if (searchEl && !searchEl._fnMaBound) {
    searchEl._fnMaBound = true;
    searchEl.addEventListener("input", function () {
      _fnMaFilterSearch = searchEl.value || "";
      fnRefreshMaFilteredView();
    });
  }
  if (kindEl && !kindEl._fnMaBound) {
    kindEl._fnMaBound = true;
    kindEl.addEventListener("change", function () {
      _fnMaFilterKind = kindEl.value || "all";
      fnRefreshMaFilteredView();
    });
  }
  if (critEl && !critEl._fnMaBound) {
    critEl._fnMaBound = true;
    critEl.addEventListener("change", function () {
      _fnMaFilterCritical = critEl.checked;
      fnRefreshMaFilteredView();
    });
  }
  fnRefreshMaFilteredView();
}

function fnSkillComparisonColumnLabel(sc) {
  var kat = String(sc.kategorie || "").trim();
  var tech = String(sc.technologie || "").trim();
  var komp = String(sc.kompetenz || "").trim();
  if (kat && tech) return kat + " \u00b7 " + tech;
  if (kat && komp) return kat + " \u00b7 " + komp;
  return kat || tech || komp || "Skill";
}

function fnBuildEmployeeSkillHeatmapFromItems(mitarbeiterItems, phase1) {
  var rows = [];
  var columnMap = {};
  var rowCellMaps = [];

  fnSeedCatalogHeatmapColumns(columnMap, "tech");
  fnSeedCatalogHeatmapColumns(columnMap, "soft");

  (mitarbeiterItems || []).forEach(function (item) {
    var skillComparisons = (item.skillComparisons || []).filter(function (sc) {
      return sc && (sc.skillKey || sc.kategorie);
    });
    var employeeRow = fnFindEmployeePhase1Row(phase1, item);

    rows.push({
      skillEntryId: item.skillEntryId || null,
      label: item.label || item.subcategory || "\u2013",
    });
    var cellMap = {};

    skillComparisons.forEach(function (sc) {
      var catKey = fnNormalizeComparisonKey(sc);
      if (!columnMap[catKey]) {
        columnMap[catKey] = {
          key: catKey,
          label: fnSkillComparisonColumnLabel(sc),
          kind: sc.skillPlanKind === "soft" ? "soft" : "tech",
        };
      }
      var existing = cellMap[catKey];
      if (!existing) {
        cellMap[catKey] = {
          istLevel: sc.istLevel,
          sollLevel: sc.sollLevel,
          gap: sc.gap,
          status: sc.status,
        };
        return;
      }
      if (sc.sollLevel != null && (existing.sollLevel == null || sc.sollLevel > existing.sollLevel)) {
        existing.sollLevel = sc.sollLevel;
      }
      if (sc.gap != null && (existing.gap == null || sc.gap < existing.gap)) {
        existing.istLevel = sc.istLevel;
        existing.gap = sc.gap;
        existing.status = sc.status;
      }
    });

    fnFillCatalogIstCells(cellMap, employeeRow);
    rowCellMaps.push(cellMap);
  });

  var columns = fnSortHeatmapColumns(
    Object.keys(columnMap).map(function (k) { return columnMap[k]; })
  );
  var cells = rowCellMaps.map(function (cellMap) {
    return columns.map(function (col) { return cellMap[col.key] || null; });
  });

  return {
    rows: rows,
    columns: columns,
    cells: cells,
    hasData: rows.length > 0 && columns.length > 0,
  };
}

function renderFnMitarbeiterAreaEmpty(areaDef) {
  var html = '<details class="p1f-area p1f-area--ma">';
  html += '<summary class="p1f-area__head">';
  html += '<span class="p1f-area__icon">' + areaDef.icon + "</span>";
  html += '<span class="p1f-area__label">' + fnEsc(areaDef.label) + "</span>";
  html += '<span class="p1f-area__count">Keine Daten</span>';
  html += "</summary>";
  html += '<div class="p1f-area__body p1f-area__body--ma">';
  html += '<p class="fortschritt-empty" style="margin:0">Noch keine Skill-Daten in Phase&nbsp;1 und keine Mitarbeiter-Meilensteine in der Backcasting-Planung.</p>';
  html += '<p class="bc-muted" style="margin:.5rem 0 0;font-size:.8rem">Skill-Matrix in Phase&nbsp;1 erfassen oder in Phase&nbsp;2 unter Planung Mitarbeiter-Tracks anlegen.</p>';
  html += "</div></details>";
  return html;
}

function renderFnMitarbeiterArea(data, areaDef) {
  var resolved = fnResolveMitarbeiterDashboardData(data);
  var mitarbeiter = resolved.mitarbeiter || [];
  var phase1Summary = renderFnPhase1SkillsSummary(data);
  if (!mitarbeiter.length && !phase1Summary) {
    return renderFnMitarbeiterAreaEmpty(areaDef);
  }

  var years = resolved.years && resolved.years.length ? resolved.years : (data.years || []);

  _fnMaDashboardData = {
    mitarbeiter: mitarbeiter.slice(),
    phase1: resolved.phase1,
    years: years.slice(),
  };

  var skillCount = mitarbeiter.reduce(function (n, item) {
    var hm = fnBuildEmployeeSkillYearHeatmap(item, years);
    return n + hm.tech.rows.length + hm.soft.rows.length;
  }, 0);
  if (!skillCount) {
    skillCount = mitarbeiter.reduce(function (n, item) {
      return n + (item.skillComparisons || []).length;
    }, 0);
  }
  if (!skillCount) {
    var skillsView = fnResolvePhase1SkillsView(data);
    if (skillsView.employees.length) skillCount = skillsView.employees.length;
    else if (skillsView.cats.length) skillCount = skillsView.cats.length;
  }

  var html = '<details class="p1f-area p1f-area--ma">';
  html += '<summary class="p1f-area__head">';
  html += '<span class="p1f-area__icon">' + areaDef.icon + "</span>";
  html += '<span class="p1f-area__label">' + fnEsc(areaDef.label) + "</span>";
  var countLabel = mitarbeiter.length ? mitarbeiter.length + " MA \u00b7 " : "";
  html += '<span class="p1f-area__count">' + countLabel + skillCount + " Skills</span>";
  html += "</summary>";
  html += '<div class="p1f-area__body p1f-area__body--ma">';
  html += phase1Summary;
  if (mitarbeiter.length) {
    html += renderFnMaFilters();
    html += renderFnMaOverviewTable(mitarbeiter);
    html += '<div class="p1f-ma-employees">';
    mitarbeiter.forEach(function (item) {
      html += renderFnMaEmployeeSubcat(item, years);
    });
    html += "</div>";
  } else {
    html += '<p class="bc-muted" style="margin:.35rem 0 0">Keine einzelnen Mitarbeiter-Pläne \u2013 nur Gesamt\u00fcbersicht oben.</p>';
  }
  html += "</div></details>";
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

  var html = '<details class="p1f-org-section p1f-category-section">';
  html += '<summary class="p1f-org-section__head">';
  html += '<span class="p1f-org-section__label">' + fnEsc(sectionDef.label) + '</span>';
  html += '<span class="p1f-org-section__count">' + itemCount + ' Items \u00b7 ' + msCount + ' Meilensteine</span>';
  html += '</summary>';
  html += '<div class="p1f-org-section__body">';
  if (areaKey === "portfolio") {
    html += renderFnPortfolioCategoryChart(sectionDef, timeline, displayItems, data);
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

  var html = '<details class="p1f-area">';
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

  var html = '<details class="p1f-area">';
  html += '<summary class="p1f-area__head">';
  html += '<span class="p1f-area__icon">' + areaDef.icon + '</span>';
  html += '<span class="p1f-area__label">' + fnEsc(areaDef.label) + '</span>';
  html += '<span class="p1f-area__count">' + totalItems + ' Meilensteine</span>';
  html += '</summary>';
  html += '<div class="p1f-area__body">' + sectionsHtml + '</div></details>';
  return html;
}

function renderFnOrganisationArea(data) {
  var p1Plan = data && data.p1Plan;
  var gliItems = (p1Plan && p1Plan.gliederungen) || [];
  var rolItems = (p1Plan && p1Plan.rollen) || [];
  var orgDef = FN_TOP_AREAS.find(function (a) { return a.key === "organisation"; });
  var sectionsHtml = "";
  var totalItems = 0;
  orgDef.sections.forEach(function (sectionDef) {
    var items = sectionDef.key === "gliederungen" ? gliItems : rolItems;
    var sectionHtml = renderFnOrgSection(sectionDef, items, data);
    if (sectionHtml) {
      totalItems += items.length;
      sectionsHtml += sectionHtml;
    }
  });
  if (!sectionsHtml) return "";

  var html = '<details class="p1f-area p1f-area--org">';
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
    sectionsHtml += renderFnOrgSection(sectionDef, items, data);
  });
  if (!sectionsHtml) return "";

  var html = '<details class="p1f-area p1f-area--org">';
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
  var html = '<details class="p1f-area">';
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

function renderFnSummaryChip(status, count, compact, labelSuffix) {
  var cls = "p1f-summary__chip";
  if (status === "ok" || status === "warn" || status === "risk") {
    cls += " p1f-summary__chip--" + status;
  }
  return (
    '<span class="' + cls + '" title="' + fnEsc(fnStatusTooltip(status)) + '">' +
    fnStatusIcon(status) + " " + count + (compact ? "" : " " + labelSuffix) +
    "</span>"
  );
}

function renderFnSummaryChips(summary, compact) {
  if (!summary) return "";
  var count = summary.milestoneCount || summary.totalComparisons || 0;
  if (!count) return "";
  var gridCls = compact ? "p1f-summary__grid p1f-summary__grid--compact" : "p1f-summary__grid";
  var html = '<div class="' + gridCls + '">';
  html += renderFnSummaryChip("ok", summary.ok || 0, compact, "Im Plan");
  html += renderFnSummaryChip("warn", summary.warn || 0, compact, "Abweichung");
  html += renderFnSummaryChip("risk", summary.risk || 0, compact, "Kritisch");
  if (summary.neutral) {
    html += renderFnSummaryChip("neutral", summary.neutral, compact, "Keine Daten");
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
  html += '<span class="p1f-dashbar__filter"><select id="fortschrittYear"></select></span>';
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
  if (p1Ist.skills && p1Ist.skills.length) {
    html += '<div class="p1f-ist-section"><strong>Skills \u00b7 \u00d8 Level je Kategorie</strong><ul class="fortschritt-facts">';
    p1Ist.skills.forEach(function (s) {
      html += '<li>' + fnEsc(s.subcategory) + ': <b>\u00d8 ' + fnFormatNum(s.avgLevel);
      if (s.count != null) html += ' (' + fnFormatNum(s.count) + ' MA)';
      html += '</b></li>';
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
  var yearEl = document.getElementById("fortschrittYear");
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
      var maHtml = renderFnMitarbeiterArea(data, areaDef);
      if (maHtml) {
        hasComparisons = true;
        html += maHtml;
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

let _fnYearSnapshots = [];

function fnRenderIstMissingBanner(data) {
  if (!data || data.allYears) return "";
  var meta = data.istMeta;
  if (!meta || meta.source !== "missing") return "";
  var year = data.year != null ? data.year : _fnYear;
  var statusText = meta.yearSnapshotStatus === "draft" ? "Entwurf (nicht abgeschlossen)" : "nicht erfasst";
  return '<div class="card" style="border-left:4px solid var(--rc-orange);margin-bottom:1rem"><p style="margin:0;font-size:.85rem"><strong>IST ' +
    fnEsc(String(year)) + ":</strong> Jahresabschluss " + statusText +
    '. <a href="/backcasting/?tab=jahresabschluss">Jetzt erfassen</a></p></div>';
}

function renderFnDashboard(data, unit) {
  if (data.allYears) {
    return renderFnDashboardAllYears(data, unit);
  }

  var html = '<div class="p1f-dashboard">';
  html += fnRenderIstMissingBanner(data);
  html += renderFnDashboardPanel(unit, data.summary);

  var hasComparisons = false;
  FN_TOP_AREAS.forEach(function (areaDef) {
    if (areaDef.key === "organisation") {
      var orgHtml = renderFnOrganisationArea(data);
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
      var maHtmlSingle = renderFnMitarbeiterArea(data, areaDef);
      if (maHtmlSingle) {
        hasComparisons = true;
        html += maHtmlSingle;
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
  var sel = document.getElementById("fortschrittYear");
  if (!sel) return;
  var prev = sel.value;
  var years = window._rcPlanningYears || [2026, 2027, 2028, 2029];
  var snapshots = _fnYearSnapshots.length ? _fnYearSnapshots : (_fnSnapshot && _fnSnapshot.yearSnapshots) || [];
  sel.innerHTML = "";
  var allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "Alle Jahre (" + years[0] + "\u2013" + years[years.length - 1] + ")";
  sel.appendChild(allOpt);
  years.forEach(function (y) {
    var opt = document.createElement("option");
    opt.value = y;
    var st = snapshots.find(function (s) { return Number(s.year) === Number(y); });
    var suffix = " \u00b7 offen";
    if (st && st.status === "closed") suffix = " \u00b7 abgeschlossen";
    else if (st && st.status === "draft") suffix = " \u00b7 Entwurf";
    opt.textContent = y + suffix;
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
  var root = document.getElementById("fortschrittContent");
  if (!root) return;

  readFnYearSelect();
  var yearQuery = _fnYearAll ? "all" : String(_fnYear);

  if (!unit) {
    root.innerHTML = '<div class="card"><p class="fortschritt-empty">Bitte im <strong>Filter</strong> oben eine konkrete Unit w\u00e4hlen (nicht \u201eAlle Units\u201c), um den Phase-1-basierten Fortschritt zu sehen.</p></div>';
    return;
  }

  root.innerHTML = '<div class="card"><p class="fortschritt-empty">Lade Vergleichsdaten\u2026</p></div>';

  try {
    if (typeof loadSkillCategoriesFromApi === "function") {
      await loadSkillCategoriesFromApi();
    }
    if (unit) {
      try {
        var snapList = await api("/api/year-snapshots?unit=" + encodeURIComponent(unit));
        _fnYearSnapshots = snapList.snapshots || [];
      } catch (_e2) {
        _fnYearSnapshots = [];
      }
    }
    var data = await api("/api/dashboard/p1-snapshot?unit=" + encodeURIComponent(unit) + "&year=" + encodeURIComponent(yearQuery));
    _fnSnapshot = data;
    if (data.yearSnapshots) _fnYearSnapshots = data.yearSnapshots;
    root.innerHTML = renderFnDashboard(data, unit);
    fnPopulateYearSelect();
    fnBindOrgChartViewToggles();
    if (document.getElementById("p1fMaFilterSearch")) fnBindMitarbeiterFilters();
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
    var page = document.getElementById("page-fortschritt");
    if (page) {
      page.addEventListener("change", function (e) {
        if (e.target && e.target.id === "fortschrittYear") void loadFortschrittNewDashboard();
      });
    }
  }
  void loadFortschrittNewDashboard();
}

/* ===== Gesamtfortschritt (Timeline, Phase-1-basiert) ===== */

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
  var root = document.getElementById("gesamtfortschrittContent");
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
    var reloadBtn = document.getElementById("btnGesamtfortschrittReload");
    if (reloadBtn) reloadBtn.addEventListener("click", function () { void loadGesamtfortschrittNewDashboard(); });
  }
  void loadGesamtfortschrittNewDashboard();
}
