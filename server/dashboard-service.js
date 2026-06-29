/**
 * IST/SOLL-Aggregation für Management-Dashboard
 */

const PORTFOLIO_CATEGORY_LABELS = {
  produkte: "Produkte",
  services: "Services",
  loesungen: "Lösungen",
  partnergeschaeft: "Partnergeschäft",
  projektgeschaeft: "Projektgeschäft",
};

function parseTeur(value) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function statusFromDelta(deltaPct, invert) {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return "neutral";
  const d = invert ? -deltaPct : deltaPct;
  if (d >= -5) return "ok";
  if (d >= -15) return "warn";
  return "risk";
}

function organisationEntryScore(entry) {
  let score = 0;
  if (entry?.is_demo) score += 1000;
  if (entry?.hatTechnologischeGliederung) score += 10;
  score += (entry?.gliederungen?.length || 0) * 5;
  score += (entry?.rollen?.length || 0) * 2;
  if (entry?.stichtag) score += 1;
  return score;
}

function pickOrganisationEntry(entries) {
  const orgs = entries.filter(
    (e) => e.type === "organisation" || e.hatTechnologischeGliederung != null
  );
  if (!orgs.length) return null;
  return orgs.reduce((best, entry) =>
    organisationEntryScore(entry) > organisationEntryScore(best) ? entry : best
  );
}

function aggregatePhase1Entries(entries) {
  const portfolio = entries.filter((e) => e.type === "portfolio" || (!e.type && e.category));
  const organisation = pickOrganisationEntry(entries);
  const skills = entries.filter((e) => e.type === "skill" || (e.skills && e.nachname));

  const byCategory = {};
  let portfolioTotalTeur = 0;
  portfolio.forEach((p) => {
    const cat = p.category || "sonstiges";
    const teur = parseTeur(p.jahresumsatz_teur) ?? 0;
    byCategory[cat] = (byCategory[cat] || 0) + teur;
    portfolioTotalTeur += teur;
  });

  const mix = Object.entries(byCategory).map(([cat, teur]) => ({
    category: cat,
    label: PORTFOLIO_CATEGORY_LABELS[cat] || cat,
    teur,
    pct: portfolioTotalTeur > 0 ? Math.round((teur / portfolioTotalTeur) * 1000) / 10 : 0,
  }));

  let headcount = 0;
  const headcountByBereich = [];
  const umsatzByBereich = [];
  const rollenByRolle = [];
  if (organisation) {
    (organisation.gliederungen || []).forEach((g) => {
      const hc = Number(g.headcount) || 0;
      const teur = parseTeur(g.umsatz_teur) ?? 0;
      headcount += hc;
      if (g.bereich) {
        headcountByBereich.push({ bereich: g.bereich, headcount: hc });
        umsatzByBereich.push({ bereich: g.bereich, teur });
      }
    });
    (organisation.rollen || []).forEach((r) => {
      if (!r.rolle) return;
      rollenByRolle.push({ rolle: r.rolle, anzahl: Number(r.anzahl) || 0 });
    });
    if (!headcount && rollenByRolle.length) {
      headcount = rollenByRolle.reduce((s, r) => s + r.anzahl, 0);
    }
  }

  const skillLevels = {};
  const skillCounts = {};
  skills.forEach((emp) => {
    (emp.skills || []).forEach((s) => {
      const cat = s.kategorie || "Sonstiges";
      const lvl = Number(s.level);
      if (!Number.isFinite(lvl)) return;
      skillLevels[cat] = (skillLevels[cat] || 0) + lvl;
      skillCounts[cat] = (skillCounts[cat] || 0) + 1;
    });
  });
  const avgSkillByCategory = Object.keys(skillLevels).map((cat) => ({
    category: cat,
    avgLevel: Math.round((skillLevels[cat] / skillCounts[cat]) * 10) / 10,
    count: skillCounts[cat],
  }));

  const zertTotal = skills.length;
  const zertJa = skills.filter((e) => String(e.zertifiziert || "").toLowerCase() === "ja").length;

  return {
    stichtag: organisation?.stichtag || null,
    erfassungsjahr: organisation?.erfassungsjahr || null,
    portfolio: { byCategory, totalTeur: portfolioTotalTeur, mix, count: portfolio.length },
    organisation: { headcount, headcountByBereich, umsatzByBereich, rollenByRolle, rollenCount: organisation?.rollen?.length || 0 },
    skills: {
      employeeCount: skills.length,
      zertifiziertQuote: zertTotal ? Math.round((zertJa / zertTotal) * 1000) / 10 : null,
      zertifiziert: zertJa,
      avgSkillByCategory,
    },
  };
}

function aggregatePlanForYear(planPayload, year) {
  const measures = planPayload?.measures || {};
  const milestones = [];
  Object.values(measures).forEach((list) => {
    (list || []).forEach((m) => {
      if (m && m.kind === "wsYear" && Number(m.jahr) === Number(year)) milestones.push(m);
    });
  });

  let zielUmsatzTeur = 0;
  let zielHeadcount = 0;
  let hasUmsatz = false;
  let hasHc = false;
  const skillTargets = [];
  let maxAnteil = null;

  milestones.forEach((m) => {
    const u = parseTeur(m.ziel_umsatz_teur);
    if (u != null) {
      zielUmsatzTeur += u;
      hasUmsatz = true;
    }
    const hc = parseTeur(m.ziel_headcount);
    if (hc != null) {
      zielHeadcount = Math.max(zielHeadcount, hc);
      hasHc = true;
    }
    if (m.ziel_skill_kategorie && m.ziel_skill_level_min != null) {
      skillTargets.push({
        category: m.ziel_skill_kategorie,
        minLevel: Number(m.ziel_skill_level_min),
        anteilProzent: m.ziel_anteil_prozent != null ? Number(m.ziel_anteil_prozent) : null,
        workstream: m.workstream,
      });
    }
    if (m.ziel_anteil_prozent != null) {
      const a = Number(m.ziel_anteil_prozent);
      if (Number.isFinite(a)) maxAnteil = maxAnteil == null ? a : Math.max(maxAnteil, a);
    }
  });

  return {
    year: Number(year),
    milestoneCount: milestones.length,
    milestones,
    zielUmsatzTeur: hasUmsatz ? zielUmsatzTeur : null,
    zielHeadcount: hasHc ? zielHeadcount : null,
    zielZertifizierungProzent: maxAnteil,
    skillTargets,
  };
}

function buildComparison(phase1, planYear) {
  const comparisons = [];

  if (planYear.zielUmsatzTeur != null) {
    const ist = phase1.portfolio.totalTeur;
    const soll = planYear.zielUmsatzTeur;
    const delta = soll - ist;
    const deltaPct = soll > 0 ? (delta / soll) * 100 : null;
    comparisons.push({
      key: "umsatz",
      label: "Umsatz (TEUR)",
      ist,
      soll,
      delta,
      deltaPct: deltaPct != null ? Math.round(deltaPct * 10) / 10 : null,
      status: statusFromDelta(deltaPct, false),
    });
  }

  if (planYear.zielHeadcount != null) {
    const ist = phase1.organisation.headcount;
    const soll = planYear.zielHeadcount;
    const delta = soll - ist;
    const deltaPct = soll > 0 ? (delta / soll) * 100 : null;
    comparisons.push({
      key: "headcount",
      label: "Headcount",
      ist,
      soll,
      delta,
      deltaPct: deltaPct != null ? Math.round(deltaPct * 10) / 10 : null,
      status: statusFromDelta(deltaPct, false),
    });
  }

  if (planYear.zielZertifizierungProzent != null && phase1.skills.zertifiziertQuote != null) {
    const ist = phase1.skills.zertifiziertQuote;
    const soll = planYear.zielZertifizierungProzent;
    const delta = ist - soll;
    comparisons.push({
      key: "zertifizierung",
      label: "Zertifizierungsquote (%)",
      ist,
      soll,
      delta: Math.round(delta * 10) / 10,
      deltaPct: null,
      status: ist >= soll ? "ok" : ist >= soll - 10 ? "warn" : "risk",
    });
  }

  const skillGaps = planYear.skillTargets.map((target) => {
    const row = phase1.skills.avgSkillByCategory.find((s) => s.category === target.category);
    const istAvg = row?.avgLevel ?? null;
    const gap = istAvg != null ? istAvg - target.minLevel : null;
    return {
      category: target.category,
      workstream: target.workstream,
      istAvg,
      sollMin: target.minLevel,
      sollAnteil: target.anteilProzent,
      gap,
      status: gap == null ? "neutral" : gap >= 0 ? "ok" : gap >= -0.5 ? "warn" : "risk",
    };
  });

  return { kpis: comparisons, skillGaps };
}

function buildDashboardSnapshot(entries, planPayload, year) {
  const phase1 = aggregatePhase1Entries(entries);
  const planYear = aggregatePlanForYear(planPayload, year);
  const comparison = buildComparison(phase1, planYear);
  return {
    year: Number(year),
    phase1,
    plan: planYear,
    comparison,
    planMeta: planPayload?.meta || null,
  };
}

function buildDashboardSnapshotAllYears(entries, planPayload, years) {
  const phase1 = aggregatePhase1Entries(entries);
  const byYear = years.map((year) => {
    const planYear = aggregatePlanForYear(planPayload, year);
    const comparison = buildComparison(phase1, planYear);
    return { year: Number(year), plan: planYear, comparison };
  });
  const totalMilestones = byYear.reduce((sum, row) => sum + (row.plan?.milestoneCount || 0), 0);
  return {
    allYears: true,
    years: [...years],
    phase1,
    planMeta: planPayload?.meta || null,
    byYear,
    totalMilestones,
  };
}

const DEFAULT_TIMELINE_YEARS = [2026, 2027, 2028, 2029];

function buildLinearIstSeries(years, istStart, sollEnd) {
  if (istStart == null || sollEnd == null || !years.length) {
    return years.map(() => null);
  }
  const y0 = years[0];
  const yEnd = years[years.length - 1];
  const span = yEnd - y0 || 1;
  return years.map((y) => {
    const t = (y - y0) / span;
    const value = istStart + (sollEnd - istStart) * t;
    return Math.round(value * 10) / 10;
  });
}

function buildKpiTimelineSeries(years, phase1, planByYear, kpiDef) {
  const soll = years.map((y) => {
    const planYear = planByYear[y];
    const value = planYear ? planYear[kpiDef.planKey] : null;
    return value != null ? value : null;
  });
  const istStart = kpiDef.getIst(phase1);
  const sollEnd = soll[soll.length - 1];
  const hasSoll = soll.some((v) => v != null);
  if (!hasSoll || istStart == null) {
    return {
      key: kpiDef.key,
      label: kpiDef.label,
      unit: kpiDef.unit,
      soll,
      ist: years.map(() => null),
      hasData: false,
    };
  }
  const ist = buildLinearIstSeries(years, istStart, sollEnd);
  return {
    key: kpiDef.key,
    label: kpiDef.label,
    unit: kpiDef.unit,
    soll,
    ist,
    hasData: true,
  };
}

function buildDashboardTimeline(entries, planPayload, years = DEFAULT_TIMELINE_YEARS) {
  const phase1 = aggregatePhase1Entries(entries);
  const planByYear = {};
  years.forEach((y) => {
    planByYear[y] = aggregatePlanForYear(planPayload, y);
  });

  const kpiDefs = [
    {
      key: "umsatz",
      label: "Umsatz (TEUR)",
      unit: "TEUR",
      planKey: "zielUmsatzTeur",
      getIst: (p1) => p1.portfolio.totalTeur,
    },
    {
      key: "headcount",
      label: "Headcount",
      unit: "MA",
      planKey: "zielHeadcount",
      getIst: (p1) => p1.organisation.headcount,
    },
    {
      key: "zertifizierung",
      label: "Zertifizierungsquote (%)",
      unit: "%",
      planKey: "zielZertifizierungProzent",
      getIst: (p1) => p1.skills.zertifiziertQuote,
    },
  ];

  const kpis = kpiDefs.map((def) => buildKpiTimelineSeries(years, phase1, planByYear, def));
  return {
    years: [...years],
    kpis,
    hasData: kpis.some((k) => k.hasData),
  };
}

function aggregateP1PlanForYear(planPayload, year) {
  const measures = planPayload?.measures || {};
  const byAreaSub = {};
  Object.values(measures).forEach((list) => {
    (list || []).forEach((m) => {
      if (m && m.kind === "p1Year" && Number(m.jahr) === Number(year)) {
        const key = m.area + "||" + m.subcategory;
        if (!byAreaSub[key]) byAreaSub[key] = { area: m.area, subcategory: m.subcategory, milestones: [] };
        byAreaSub[key].milestones.push(m);
      }
    });
  });
  return byAreaSub;
}

function buildP1Comparison(phase1, p1Plan) {
  const portfolio = [];
  const gliederungen = [];
  const rollen = [];
  const skills = [];

  Object.values(p1Plan).forEach((entry) => {
    const { area, subcategory, milestones } = entry;
    if (area === "portfolio") {
      const istTeur = phase1.portfolio.byCategory[subcategory] ?? 0;
      let sollTeur = 0;
      let hasSoll = false;
      milestones.forEach((m) => {
        const v = parseTeur(m.ziel_umsatz_teur);
        if (v != null) { sollTeur += v; hasSoll = true; }
      });
      if (!milestones.length) return;
      const delta = hasSoll ? istTeur - sollTeur : null;
      const deltaPct = hasSoll && sollTeur > 0 ? (delta / sollTeur) * 100 : null;
      portfolio.push({
        subcategory,
        label: PORTFOLIO_CATEGORY_LABELS[subcategory] || subcategory,
        istTeur, sollTeur: hasSoll ? sollTeur : null,
        delta: delta != null ? Math.round(delta * 10) / 10 : null,
        deltaPct: deltaPct != null ? Math.round(deltaPct * 10) / 10 : null,
        status: hasSoll ? statusFromDelta(deltaPct, true) : "neutral",
        milestones,
      });
    } else if (area === "gliederungen") {
      const hcRow = phase1.organisation.headcountByBereich.find((b) => b.bereich === subcategory);
      const teurRow = phase1.organisation.umsatzByBereich.find((b) => b.bereich === subcategory);
      const istHc = hcRow?.headcount ?? 0;
      const istTeur = teurRow?.teur ?? 0;
      let sollHc = 0, sollTeur = 0, hasHc = false, hasTeur = false;
      milestones.forEach((m) => {
        const hc = parseTeur(m.ziel_headcount);
        if (hc != null) { sollHc = Math.max(sollHc, hc); hasHc = true; }
        const t = parseTeur(m.ziel_umsatz_teur);
        if (t != null) { sollTeur += t; hasTeur = true; }
      });
      const hcDeltaPct = hasHc && sollHc > 0 ? ((istHc - sollHc) / sollHc) * 100 : null;
      const teurDeltaPct = hasTeur && sollTeur > 0 ? ((istTeur - sollTeur) / sollTeur) * 100 : null;
      const worst = [hcDeltaPct, teurDeltaPct].filter((v) => v != null);
      const worstPct = worst.length ? Math.min(...worst) : null;
      gliederungen.push({
        subcategory,
        istHc, sollHc: hasHc ? sollHc : null,
        istTeur, sollTeur: hasTeur ? sollTeur : null,
        status: statusFromDelta(worstPct, true),
        milestones,
      });
    } else if (area === "rollen") {
      const rolleRow = phase1.organisation.rollenByRolle.find((r) => r.rolle === subcategory);
      const istAnzahl = rolleRow?.anzahl ?? 0;
      let sollAnzahl = 0, hasSoll = false;
      milestones.forEach((m) => {
        const v = parseTeur(m.ziel_anzahl);
        if (v != null) { sollAnzahl = Math.max(sollAnzahl, v); hasSoll = true; }
      });
      if (!milestones.length) return;
      const deltaPct = hasSoll && sollAnzahl > 0 ? ((istAnzahl - sollAnzahl) / sollAnzahl) * 100 : null;
      rollen.push({
        subcategory,
        istAnzahl, sollAnzahl: hasSoll ? sollAnzahl : null,
        status: hasSoll ? statusFromDelta(deltaPct, true) : "neutral",
        milestones,
      });
    } else if (area === "skills") {
      const row = phase1.skills.avgSkillByCategory.find((s) => s.category === subcategory);
      const istAvg = row?.avgLevel ?? null;
      let sollMin = null, sollAnteil = null;
      milestones.forEach((m) => {
        if (m.ziel_skill_level_min != null) {
          const v = Number(m.ziel_skill_level_min);
          if (Number.isFinite(v)) sollMin = sollMin == null ? v : Math.max(sollMin, v);
        }
        if (m.ziel_anteil_prozent != null) {
          const v = Number(m.ziel_anteil_prozent);
          if (Number.isFinite(v)) sollAnteil = sollAnteil == null ? v : Math.max(sollAnteil, v);
        }
      });
      const gap = istAvg != null && sollMin != null ? istAvg - sollMin : null;
      skills.push({
        subcategory,
        istAvg, sollMin, sollAnteil, gap,
        status: gap == null ? "neutral" : gap >= 0 ? "ok" : gap >= -0.5 ? "warn" : "risk",
        milestones,
      });
    }
  });

  const all = [...portfolio, ...gliederungen, ...rollen, ...skills];
  const summary = { totalComparisons: all.length, milestoneCount: countP1Milestones({ portfolio, gliederungen, rollen, skills }), ok: 0, warn: 0, risk: 0, neutral: 0 };
  all.forEach((item) => { summary[item.status] = (summary[item.status] || 0) + 1; });

  return { portfolio, gliederungen, rollen, skills, summary };
}

function buildP1DashboardSnapshot(entries, planPayload, year) {
  const phase1 = aggregatePhase1Entries(entries);
  const p1Plan = aggregateP1PlanForYear(planPayload, year);
  const comparison = buildP1Comparison(phase1, p1Plan);
  const p1Ist = {
    portfolio: Object.entries(phase1.portfolio.byCategory).map(([cat, teur]) => ({
      subcategory: cat,
      label: PORTFOLIO_CATEGORY_LABELS[cat] || cat,
      umsatz_teur: teur,
    })),
    gliederungen: phase1.organisation.headcountByBereich.map((b) => {
      const tRow = phase1.organisation.umsatzByBereich.find((u) => u.bereich === b.bereich);
      return { subcategory: b.bereich, headcount: b.headcount, umsatz_teur: tRow?.teur ?? 0 };
    }),
    rollen: phase1.organisation.rollenByRolle.map((r) => ({
      subcategory: r.rolle, anzahl: r.anzahl,
    })),
    skills: phase1.skills.avgSkillByCategory.map((s) => ({
      subcategory: s.category, avgLevel: s.avgLevel, count: s.count,
    })),
  };
  return {
    year: Number(year),
    phase1,
    p1Ist,
    p1Plan: comparison,
    summary: comparison.summary,
    planMeta: planPayload?.meta || null,
  };
}

function mergeP1Summaries(byYear) {
  const summary = { totalComparisons: 0, milestoneCount: 0, ok: 0, warn: 0, risk: 0, neutral: 0 };
  byYear.forEach((row) => {
    const s = row.summary;
    if (!s) return;
    summary.totalComparisons += s.totalComparisons || 0;
    summary.milestoneCount += s.milestoneCount || 0;
    summary.ok += s.ok || 0;
    summary.warn += s.warn || 0;
    summary.risk += s.risk || 0;
    summary.neutral += s.neutral || 0;
  });
  return summary;
}

function countP1Milestones(comparison) {
  let count = 0;
  ["portfolio", "gliederungen", "rollen", "skills"].forEach((key) => {
    (comparison[key] || []).forEach((item) => {
      count += (item.milestones || []).length;
    });
  });
  return count;
}

function buildP1DashboardSnapshotAllYears(entries, planPayload, years) {
  const phase1 = aggregatePhase1Entries(entries);
  const p1Ist = {
    portfolio: Object.entries(phase1.portfolio.byCategory).map(([cat, teur]) => ({
      subcategory: cat,
      label: PORTFOLIO_CATEGORY_LABELS[cat] || cat,
      umsatz_teur: teur,
    })),
    gliederungen: phase1.organisation.headcountByBereich.map((b) => {
      const tRow = phase1.organisation.umsatzByBereich.find((u) => u.bereich === b.bereich);
      return { subcategory: b.bereich, headcount: b.headcount, umsatz_teur: tRow?.teur ?? 0 };
    }),
    rollen: phase1.organisation.rollenByRolle.map((r) => ({
      subcategory: r.rolle, anzahl: r.anzahl,
    })),
    skills: phase1.skills.avgSkillByCategory.map((s) => ({
      subcategory: s.category, avgLevel: s.avgLevel, count: s.count,
    })),
  };
  const byYear = years.map((year) => {
    const p1Plan = aggregateP1PlanForYear(planPayload, year);
    const comparison = buildP1Comparison(phase1, p1Plan);
    return { year: Number(year), p1Plan: comparison, summary: comparison.summary };
  });
  return {
    allYears: true,
    years: [...years],
    phase1,
    p1Ist,
    byYear,
    summary: mergeP1Summaries(byYear),
    planMeta: planPayload?.meta || null,
  };
}

function aggregateP1PlanKpisForYear(planPayload, year) {
  const measures = planPayload?.measures || {};
  let zielUmsatzTeur = 0, zielHeadcount = 0;
  let hasUmsatz = false, hasHc = false;
  let maxAnteil = null;
  Object.values(measures).forEach((list) => {
    (list || []).forEach((m) => {
      if (!m || m.kind !== "p1Year" || Number(m.jahr) !== Number(year)) return;
      if (m.area === "portfolio") {
        const v = parseTeur(m.ziel_umsatz_teur);
        if (v != null) { zielUmsatzTeur += v; hasUmsatz = true; }
      } else if (m.area === "gliederungen") {
        const v = parseTeur(m.ziel_umsatz_teur);
        if (v != null) { zielUmsatzTeur += v; hasUmsatz = true; }
        const hc = parseTeur(m.ziel_headcount);
        if (hc != null) { zielHeadcount = Math.max(zielHeadcount, hc); hasHc = true; }
      }
      if (m.ziel_anteil_prozent != null) {
        const a = Number(m.ziel_anteil_prozent);
        if (Number.isFinite(a)) maxAnteil = maxAnteil == null ? a : Math.max(maxAnteil, a);
      }
    });
  });
  return {
    zielUmsatzTeur: hasUmsatz ? zielUmsatzTeur : null,
    zielHeadcount: hasHc ? zielHeadcount : null,
    zielZertifizierungProzent: maxAnteil,
  };
}

function buildP1DashboardTimeline(entries, planPayload, years = DEFAULT_TIMELINE_YEARS) {
  const phase1 = aggregatePhase1Entries(entries);
  const planByYear = {};
  years.forEach((y) => {
    planByYear[y] = aggregateP1PlanKpisForYear(planPayload, y);
  });

  const kpiDefs = [
    { key: "umsatz", label: "Umsatz (TEUR)", unit: "TEUR", planKey: "zielUmsatzTeur", getIst: (p1) => p1.portfolio.totalTeur },
    { key: "headcount", label: "Headcount", unit: "MA", planKey: "zielHeadcount", getIst: (p1) => p1.organisation.headcount },
    { key: "zertifizierung", label: "Zertifizierungsquote (%)", unit: "%", planKey: "zielZertifizierungProzent", getIst: (p1) => p1.skills.zertifiziertQuote },
  ];

  const kpis = kpiDefs.map((def) => buildKpiTimelineSeries(years, phase1, planByYear, def));
  return {
    years: [...years],
    kpis,
    hasData: kpis.some((k) => k.hasData),
  };
}

function countAllPlanMilestones(planPayload) {
  const measures = planPayload?.measures || {};
  let count = 0;
  Object.values(measures).forEach((list) => {
    (list || []).forEach((m) => {
      if (m && m.kind === "wsYear") count += 1;
    });
  });
  return count;
}

function buildDemoEvaluationSummary(entries, planPayload, year = new Date().getFullYear()) {
  const snapshot = buildDashboardSnapshot(entries, planPayload, year);
  const kpiCount = snapshot.comparison?.kpis?.length || 0;
  const skillGapCount = snapshot.comparison?.skillGaps?.length || 0;
  const milestoneCountYear = snapshot.plan?.milestoneCount || 0;
  return {
    year: Number(year),
    kpiCount,
    skillGapCount,
    milestoneCountYear,
    phase3Evaluations: kpiCount + skillGapCount,
    milestoneCountTotal: countAllPlanMilestones(planPayload),
  };
}

module.exports = {
  buildDashboardSnapshot,
  buildDashboardSnapshotAllYears,
  buildDashboardTimeline,
  buildP1DashboardTimeline,
  aggregatePhase1Entries,
  aggregatePlanForYear,
  aggregateP1PlanForYear,
  buildP1DashboardSnapshot,
  buildP1DashboardSnapshotAllYears,
  countAllPlanMilestones,
  buildDemoEvaluationSummary,
  DEFAULT_TIMELINE_YEARS,
};
