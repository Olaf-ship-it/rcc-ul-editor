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

function aggregatePhase1Entries(entries) {
  const portfolio = entries.filter((e) => e.type === "portfolio" || (!e.type && e.category));
  const organisation = entries.find((e) => e.type === "organisation" || e.hatTechnologischeGliederung != null);
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
    if (!headcount && Array.isArray(organisation.rollen)) {
      headcount = organisation.rollen.reduce((s, r) => s + (Number(r.anzahl) || 0), 0);
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
    organisation: { headcount, headcountByBereich, umsatzByBereich, rollenCount: organisation?.rollen?.length || 0 },
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

module.exports = {
  buildDashboardSnapshot,
  aggregatePhase1Entries,
  aggregatePlanForYear,
};
