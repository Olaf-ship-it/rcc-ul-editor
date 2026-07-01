/**
 * IST/SOLL-Aggregation für Management-Dashboard
 */

const {
  buildSkillItemsFromRegistry,
  employeeDisplayName,
  employeeSkillSummary,
  employeeSkillRows,
  employeeSkillCategoryKey,
  findEmployeeIstSkillLevel,
  ensureOrgRowIds,
} = require("./entity-ids");

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

function aggregatePhase1Entries(entries, registry) {
  const portfolio = entries.filter((e) => e.type === "portfolio" || (!e.type && e.category));
  const organisationRaw = pickOrganisationEntry(entries);
  const organisation = organisationRaw ? ensureOrgRowIds(organisationRaw) : null;
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
  const gliederungItems = [];
  const rollenItems = [];
  if (organisation) {
    (organisation.gliederungen || []).forEach((g) => {
      const hc = Number(g.headcount) || 0;
      const teur = parseTeur(g.umsatz_teur) ?? 0;
      headcount += hc;
      if (g.bereich) {
        headcountByBereich.push({ id: g.id, bereich: g.bereich, headcount: hc });
        umsatzByBereich.push({ id: g.id, bereich: g.bereich, teur });
        gliederungItems.push({ id: g.id, subcategory: g.bereich, headcount: hc, umsatz_teur: teur });
      }
    });
    (organisation.rollen || []).forEach((r) => {
      if (!r.rolle) return;
      rollenByRolle.push({ id: r.id, rolle: r.rolle, anzahl: Number(r.anzahl) || 0 });
      rollenItems.push({ id: r.id, subcategory: r.rolle, anzahl: Number(r.anzahl) || 0 });
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

  const portfolioItems = portfolio
    .filter((p) => p.bezeichnung || p.id)
    .map((p) => ({
      id: p.id,
      category: p.category || "sonstiges",
      bezeichnung: String(p.bezeichnung || "").trim() || "–",
      umsatz_teur: parseTeur(p.jahresumsatz_teur) ?? 0,
      ampel: p.ampel || "",
    }));

  const reg = registry || { items: [] };
  let skillItems = buildSkillItemsFromRegistry(reg, skills);
  if (!skillItems.length) {
    const skillItemAgg = {};
    skills.forEach((emp) => {
      const empKey = String(emp.personalnummer || emp.id || emp.email || "").trim();
      (emp.skills || []).forEach((s) => {
        const cat = s.kategorie || "Sonstiges";
        const tech = String(s.technologie || "").trim();
        if (!tech) return;
        const aggKey = s.skillItemId || `${cat}\0${tech}`;
        if (!skillItemAgg[aggKey]) {
          skillItemAgg[aggKey] = {
            skillItemId: s.skillItemId || null,
            category: cat,
            technologie: tech,
            sum: 0,
            count: 0,
            employees: new Set(),
          };
        }
        const lvl = Number(s.level);
        if (Number.isFinite(lvl)) {
          skillItemAgg[aggKey].sum += lvl;
          skillItemAgg[aggKey].count++;
        }
        if (empKey) skillItemAgg[aggKey].employees.add(empKey);
      });
    });
    skillItems = Object.values(skillItemAgg).map((v) => ({
      skillItemId: v.skillItemId,
      category: v.category,
      technologie: v.technologie,
      avgLevel: v.count ? Math.round((v.sum / v.count) * 10) / 10 : 0,
      employeeCount: v.employees.size,
      assessmentCount: v.count,
    }));
  }

  const employees = skills
    .filter((e) => e.id && (e.nachname || e.vorname || e.name))
    .map((e) => {
      const { skillCount, avgLevel } = employeeSkillSummary(e);
      const { skills: techSkills, softSkills } = employeeSkillRows(e);
      return {
        skillEntryId: e.id,
        personalnummer: String(e.personalnummer || "").trim() || null,
        name: employeeDisplayName(e),
        skillCount,
        avgLevel,
        zertifiziert: e.zertifiziert || "",
        skills: techSkills,
        softSkills,
      };
    });

  return {
    stichtag: organisation?.stichtag || null,
    erfassungsjahr: organisation?.erfassungsjahr || null,
    portfolio: { byCategory, totalTeur: portfolioTotalTeur, mix, count: portfolio.length, items: portfolioItems },
    organisation: {
      headcount,
      headcountByBereich,
      umsatzByBereich,
      rollenByRolle,
      rollenCount: organisation?.rollen?.length || 0,
      gliederungItems,
      rollenItems,
    },
    skills: {
      employeeCount: skills.length,
      zertifiziertQuote: zertTotal ? Math.round((zertJa / zertTotal) * 1000) / 10 : null,
      zertifiziert: zertJa,
      avgSkillByCategory,
      items: skillItems,
      employees,
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

function buildLinearIstSeriesForSlotCount(slotCount, istStart, sollEnd) {
  if (istStart == null || sollEnd == null || !slotCount) {
    return Array(slotCount).fill(null);
  }
  const span = slotCount - 1 || 1;
  return Array.from({ length: slotCount }, (_, i) => {
    const t = i / span;
    const value = istStart + (sollEnd - istStart) * t;
    return Math.round(value * 10) / 10;
  });
}

function parseP1Quarter(zielQuartal) {
  const q = String(zielQuartal || "").trim().toUpperCase();
  if (q === "Q1") return 1;
  if (q === "Q2") return 2;
  if (q === "Q3") return 3;
  if (q === "Q4") return 4;
  return null;
}

function buildQuarterTimelineSlots(years) {
  const slots = [];
  (years || []).forEach((year) => {
    for (let quarter = 1; quarter <= 4; quarter += 1) {
      slots.push({
        year: Number(year),
        quarter,
        key: `${year}-Q${quarter}`,
        label: `Q${quarter}`,
      });
    }
  });
  return slots;
}

function aggregateP1PortfolioSollByQuarter(planPayload, years, filterFn) {
  const quarters = buildQuarterTimelineSlots(years);
  const sums = quarters.map(() => 0);
  const hasValue = quarters.map(() => false);
  let milestoneCount = 0;

  Object.values(planPayload?.measures || {}).forEach((list) => {
    (list || []).forEach((m) => {
      if (!m || m.kind !== "p1Year" || m.area !== "portfolio") return;
      if (!filterFn(m)) return;
      milestoneCount += 1;
      const v = parseTeur(m.ziel_umsatz_teur);
      if (v == null) return;
      const year = Number(m.jahr);
      let quarter = parseP1Quarter(m.ziel_quartal);
      if (quarter == null) quarter = 4;
      const idx = quarters.findIndex((s) => s.year === year && s.quarter === quarter);
      if (idx < 0) return;
      sums[idx] += v;
      hasValue[idx] = true;
    });
  });

  const sollByQuarter = sums.map((v, i) => (hasValue[i] ? Math.round(v * 10) / 10 : null));
  return { quarters, sollByQuarter, milestoneCount };
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

function p1EntityIdFromPlanEntry(entry) {
  if (!entry) return null;
  if (entry.entityRef && entry.entityRef.id) return String(entry.entityRef.id);
  if (entry.area === "portfolio" && entry.phase1Id) return String(entry.phase1Id);
  if (entry.itemId) return String(entry.itemId);
  if (entry.skillItemId) return String(entry.skillItemId);
  if (entry.skillEntryId) return String(entry.skillEntryId);
  if (entry.orgItemId) return String(entry.orgItemId);
  return null;
}

function p1PlanEntryKey(m) {
  if (!m || !m.area) return "";
  const entityId = p1EntityIdFromPlanEntry(m);
  if (entityId) return `${m.area}||${entityId}`;
  if (m.area === "portfolio" && m.phase1Id) return `${m.area}||${m.phase1Id}`;
  if (m.area === "portfolio") {
    return `${m.area}||${m.category || ""}||${m.subcategory || ""}`;
  }
  return `${m.area}||${m.subcategory || ""}`;
}

function collectPortfolioMilestonesAllYears(planPayload, item) {
  const targetKey = p1PlanEntryKey({
    area: "portfolio",
    category: item.category,
    subcategory: item.subcategory,
    entityRef: item.entityRef,
    phase1Id: item.phase1Id,
    itemId: item.itemId,
  });
  const milestones = [];
  Object.values(planPayload?.measures || {}).forEach((list) => {
    (list || []).forEach((m) => {
      if (m && m.kind === "p1Year" && m.area === "portfolio" && p1PlanEntryKey(m) === targetKey) {
        milestones.push(m);
      }
    });
  });
  return milestones;
}

function collectMitarbeiterMilestonesAllYears(planPayload, item) {
  const targetKey = p1PlanEntryKey({
    area: "mitarbeiter",
    subcategory: item.subcategory,
    entityRef: item.entityRef,
    skillEntryId: item.skillEntryId,
  });
  const milestones = [];
  Object.values(planPayload?.measures || {}).forEach((list) => {
    (list || []).forEach((m) => {
      if (m && m.kind === "p1Year" && m.area === "mitarbeiter" && p1PlanEntryKey(m) === targetKey) {
        milestones.push(m);
      }
    });
  });
  return milestones;
}

function enrichPortfolioAllYearMilestones(planPayload, comparison) {
  if (!comparison || !planPayload) return comparison;
  comparison.portfolio = (comparison.portfolio || []).map((item) => ({
    ...item,
    allYearMilestones: collectPortfolioMilestonesAllYears(planPayload, item),
  }));
  comparison.mitarbeiter = (comparison.mitarbeiter || []).map((item) => ({
    ...item,
    allYearMilestones: collectMitarbeiterMilestonesAllYears(planPayload, item),
  }));
  return comparison;
}

function aggregateP1PlanForYear(planPayload, year) {
  const measures = planPayload?.measures || {};
  const byAreaSub = {};
  Object.values(measures).forEach((list) => {
    (list || []).forEach((m) => {
      if (m && m.kind === "p1Year" && Number(m.jahr) === Number(year)) {
        const key = p1PlanEntryKey(m);
        if (!byAreaSub[key]) {
          byAreaSub[key] = {
            area: m.area,
            category: m.category || null,
            subcategory: m.subcategory,
            entityRef: m.entityRef || null,
            phase1Id: m.phase1Id || null,
            itemId: m.itemId || null,
            skillItemId: m.skillItemId || null,
            skillEntryId: m.skillEntryId || null,
            orgItemId: m.orgItemId || null,
            milestones: [],
          };
        }
        byAreaSub[key].milestones.push(m);
      }
    });
  });
  return byAreaSub;
}

function resolvePortfolioLabel(phase1, entry) {
  const items = phase1.portfolio?.items || [];
  const id = entry.phase1Id || (entry.entityRef?.kind === "portfolio" ? entry.entityRef.id : null);
  if (id) {
    const row = items.find((p) => p.id === id);
    if (row) return row.bezeichnung;
  }
  return entry.subcategory || "–";
}

function resolveSkillLabel(phase1, entry) {
  const items = phase1.skills?.items || [];
  const skillItemId = entry.skillItemId || (entry.entityRef?.kind === "skillItem" ? entry.entityRef.id : null);
  if (skillItemId) {
    const row = items.find((s) => s.skillItemId === skillItemId);
    if (row) return row.technologie;
  }
  return entry.subcategory || "–";
}

function resolveOrgLabel(phase1, entry, kind) {
  const orgItemId = entry.orgItemId || (entry.entityRef?.id) || null;
  const items = kind === "gliederungen"
    ? phase1.organisation?.gliederungItems || []
    : phase1.organisation?.rollenItems || [];
  if (orgItemId) {
    const row = items.find((i) => i.id === orgItemId);
    if (row) return row.subcategory;
  }
  return entry.subcategory || "–";
}

function findPortfolioIstTeur(phase1, entry) {
  const items = phase1.portfolio?.items || [];
  const entityId = p1EntityIdFromPlanEntry(entry);
  if (entityId) {
    const byId = items.find((p) => p.id === entityId);
    if (byId) return byId.umsatz_teur ?? 0;
  }
  if (entry.category) {
    const byName = items.find(
      (p) => p.category === entry.category && p.bezeichnung === entry.subcategory
    );
    if (byName) return byName.umsatz_teur ?? 0;
  }
  if (entry.subcategory && phase1.portfolio?.byCategory) {
    return phase1.portfolio.byCategory[entry.subcategory] ?? 0;
  }
  return 0;
}

function findSkillIst(phase1, entry) {
  const items = phase1.skills?.items || [];
  const skillItemId = entry.skillItemId || (entry.entityRef?.kind === "skillItem" ? entry.entityRef.id : null);
  if (skillItemId) {
    const row = items.find((s) => s.skillItemId === skillItemId);
    if (row) return { istAvg: row.avgLevel ?? null, employeeCount: row.employeeCount ?? 0 };
  }
  if (entry.category && entry.subcategory) {
    const row = items.find(
      (s) => s.category === entry.category && s.technologie === entry.subcategory
    );
    if (row) return { istAvg: row.avgLevel ?? null, employeeCount: row.employeeCount ?? 0 };
  }
  const catRow = phase1.skills?.avgSkillByCategory?.find((s) => s.category === entry.subcategory);
  return { istAvg: catRow?.avgLevel ?? null, employeeCount: catRow?.count ?? 0 };
}

function findEmployeeIst(phase1, entry) {
  const employees = phase1.skills?.employees || [];
  const skillEntryId = entry.skillEntryId || (entry.entityRef?.kind === "employee" ? entry.entityRef.id : null);
  if (skillEntryId) {
    const row = employees.find((e) => e.skillEntryId === skillEntryId);
    if (row) {
      return {
        istAvg: row.avgLevel ?? null,
        skillCount: row.skillCount ?? 0,
        zertifiziert: row.zertifiziert || "",
        name: row.name || entry.subcategory,
      };
    }
  }
  return { istAvg: null, skillCount: 0, zertifiziert: "", name: entry.subcategory || "–" };
}

function statusFromSkillGap(gap) {
  if (gap == null || !Number.isFinite(gap)) return "neutral";
  if (gap >= 0) return "ok";
  if (gap >= -0.5) return "warn";
  return "risk";
}

function worstStatus(a, b) {
  const rank = { risk: 3, warn: 2, ok: 1, neutral: 0 };
  return (rank[a] || 0) >= (rank[b] || 0) ? a : b;
}

function findEmployeePhase1Row(phase1, entry) {
  const employees = phase1.skills?.employees || [];
  const skillEntryId = entry.skillEntryId || (entry.entityRef?.kind === "employee" ? entry.entityRef.id : null);
  if (skillEntryId) {
    const byId = employees.find((e) => e.skillEntryId === skillEntryId);
    if (byId) return byId;
  }
  const label = String(entry.subcategory || entry.label || "").trim().toLowerCase();
  if (!label) return null;
  return employees.find((e) => String(e.name || "").trim().toLowerCase() === label) || null;
}

function buildEmployeeSkillComparisons(employeeRow, milestones) {
  const comparisons = [];
  const skillPlanMilestones = (milestones || []).filter(
    (m) => m && (m.skillPlanKind === "tech" || m.skillPlanKind === "soft")
  );
  const legacyMilestones = (milestones || []).filter((m) => m && !m.skillPlanKind);

  skillPlanMilestones.forEach((m) => {
    const sollLevel = m.ziel_skill_level_min != null ? Number(m.ziel_skill_level_min) : null;
    const istLevel = findEmployeeIstSkillLevel(employeeRow, m);
    const gap = istLevel != null && sollLevel != null && Number.isFinite(sollLevel)
      ? istLevel - sollLevel
      : null;
    comparisons.push({
      skillKey: employeeSkillCategoryKey(m),
      skillPlanKind: m.skillPlanKind,
      kategorie: String(m.kategorie || "").trim(),
      technologie: String(m.technologie || "").trim(),
      kompetenz: String(m.kompetenz || "").trim(),
      istLevel: istLevel != null ? istLevel : null,
      sollLevel: Number.isFinite(sollLevel) ? sollLevel : null,
      gap: gap != null ? Math.round(gap * 10) / 10 : null,
      status: statusFromSkillGap(gap),
      planYear: m.jahr != null ? Number(m.jahr) : null,
      planQuarter: m.ziel_quartal || null,
      milestoneId: m.id || null,
    });
  });

  if (legacyMilestones.length) {
    let sollMin = null;
    legacyMilestones.forEach((m) => {
      if (m.ziel_skill_level_min != null) {
        const v = Number(m.ziel_skill_level_min);
        if (Number.isFinite(v)) sollMin = sollMin == null ? v : Math.max(sollMin, v);
      }
    });
    const istAvg = employeeRow?.avgLevel ?? null;
    const gap = istAvg != null && sollMin != null ? istAvg - sollMin : null;
    const first = legacyMilestones[0];
    comparisons.push({
      skillKey: "legacy:general",
      skillPlanKind: null,
      kategorie: "Allgemeines Ziel",
      technologie: "",
      kompetenz: "",
      istLevel: istAvg,
      sollLevel: sollMin,
      gap: gap != null ? Math.round(gap * 10) / 10 : null,
      status: statusFromSkillGap(gap),
      planYear: first?.jahr != null ? Number(first.jahr) : null,
      planQuarter: first?.ziel_quartal || null,
      milestoneId: null,
    });
  }

  return comparisons;
}

function buildEmployeeSkillHeatmap(mitarbeiterItems) {
  const rows = [];
  const columnMap = {};
  const rowCellMaps = [];

  (mitarbeiterItems || []).forEach((item) => {
    const skillComparisons = (item.skillComparisons || []).filter(
      (sc) => sc.skillKey && sc.skillKey !== "legacy:general" && sc.kategorie
    );
    if (!skillComparisons.length) return;

    rows.push({
      skillEntryId: item.skillEntryId || null,
      label: item.label || item.subcategory || "–",
    });
    const cellMap = {};

    skillComparisons.forEach((sc) => {
      const catKey = sc.skillKey || employeeSkillCategoryKey(sc);
      if (!columnMap[catKey]) {
        columnMap[catKey] = {
          key: catKey,
          label: sc.kategorie || "–",
          kind: sc.skillPlanKind === "soft" ? "soft" : "tech",
        };
      }
      const existing = cellMap[catKey];
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
    rowCellMaps.push(cellMap);
  });

  const columns = Object.values(columnMap).sort((a, b) => {
    const ka = String(a.label).localeCompare(String(b.label), "de");
    if (ka !== 0) return ka;
    return String(a.kind).localeCompare(String(b.kind));
  });

  const cells = rowCellMaps.map((cellMap) =>
    columns.map((col) => cellMap[col.key] || null)
  );

  return {
    rows,
    columns,
    cells,
    hasData: rows.length > 0 && columns.length > 0,
  };
}

function findGliederungIst(phase1, entry) {
  const label = resolveOrgLabel(phase1, entry, "gliederungen");
  const orgItemId = entry.orgItemId || entry.entityRef?.id;
  const hcRows = phase1.organisation?.headcountByBereich || [];
  const teurRows = phase1.organisation?.umsatzByBereich || [];
  let hcRow = orgItemId ? hcRows.find((b) => b.id === orgItemId) : null;
  let teurRow = orgItemId ? teurRows.find((b) => b.id === orgItemId) : null;
  if (!hcRow) hcRow = hcRows.find((b) => b.bereich === label || b.bereich === entry.subcategory);
  if (!teurRow) teurRow = teurRows.find((b) => b.bereich === label || b.bereich === entry.subcategory);
  return { istHc: hcRow?.headcount ?? 0, istTeur: teurRow?.teur ?? 0, label };
}

function findRolleIst(phase1, entry) {
  const label = resolveOrgLabel(phase1, entry, "rollen");
  const orgItemId = entry.orgItemId || entry.entityRef?.id;
  const rows = phase1.organisation?.rollenByRolle || [];
  let rolleRow = orgItemId ? rows.find((r) => r.id === orgItemId) : null;
  if (!rolleRow) rolleRow = rows.find((r) => r.rolle === label || r.rolle === entry.subcategory);
  return { istAnzahl: rolleRow?.anzahl ?? 0, label };
}

function buildP1Comparison(phase1, p1Plan) {
  const portfolio = [];
  const gliederungen = [];
  const rollen = [];
  const mitarbeiter = [];

  Object.values(p1Plan).forEach((entry) => {
    const { area, category, subcategory, milestones } = entry;
    if (area === "portfolio") {
      const label = resolvePortfolioLabel(phase1, entry);
      const istTeur = findPortfolioIstTeur(phase1, entry);
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
        category,
        subcategory,
        label,
        categoryLabel: category ? (PORTFOLIO_CATEGORY_LABELS[category] || category) : null,
        entityRef: entry.entityRef || null,
        phase1Id: entry.phase1Id || null,
        itemId: entry.itemId || null,
        istTeur, sollTeur: hasSoll ? sollTeur : null,
        delta: delta != null ? Math.round(delta * 10) / 10 : null,
        deltaPct: deltaPct != null ? Math.round(deltaPct * 10) / 10 : null,
        status: hasSoll ? statusFromDelta(deltaPct, true) : "neutral",
        milestones,
      });
    } else if (area === "gliederungen") {
      const { istHc, istTeur, label } = findGliederungIst(phase1, entry);
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
        label,
        entityRef: entry.entityRef || null,
        istHc, sollHc: hasHc ? sollHc : null,
        istTeur, sollTeur: hasTeur ? sollTeur : null,
        status: statusFromDelta(worstPct, true),
        milestones,
      });
    } else if (area === "rollen") {
      const { istAnzahl, label } = findRolleIst(phase1, entry);
      let sollAnzahl = 0, hasSoll = false;
      milestones.forEach((m) => {
        const v = parseTeur(m.ziel_anzahl);
        if (v != null) { sollAnzahl = Math.max(sollAnzahl, v); hasSoll = true; }
      });
      const deltaPct = hasSoll && sollAnzahl > 0 ? ((istAnzahl - sollAnzahl) / sollAnzahl) * 100 : null;
      rollen.push({
        subcategory,
        label,
        entityRef: entry.entityRef || null,
        istAnzahl, sollAnzahl: hasSoll ? sollAnzahl : null,
        status: hasSoll ? statusFromDelta(deltaPct, true) : "neutral",
        milestones,
      });
    } else if (area === "mitarbeiter") {
      const employeeRow = findEmployeePhase1Row(phase1, entry);
      const ist = findEmployeeIst(phase1, entry);
      const skillComparisons = buildEmployeeSkillComparisons(employeeRow, milestones);
      const skillEntryId = entry.skillEntryId
        || (entry.entityRef?.kind === "employee" ? entry.entityRef.id : null);

      let status = "neutral";
      let criticalGapCount = 0;
      let sollMin = null;
      skillComparisons.forEach((sc) => {
        status = worstStatus(status, sc.status || "neutral");
        if (sc.status === "risk" || sc.status === "warn") criticalGapCount += 1;
        if (sc.sollLevel != null) {
          sollMin = sollMin == null ? sc.sollLevel : Math.max(sollMin, sc.sollLevel);
        }
      });
      const gap = ist.istAvg != null && sollMin != null ? ist.istAvg - sollMin : null;
      if (!skillComparisons.length) {
        status = gap == null ? "neutral" : statusFromSkillGap(gap);
      }

      mitarbeiter.push({
        subcategory,
        label: ist.name || subcategory,
        skillEntryId,
        entityRef: entry.entityRef || null,
        istAvg: ist.istAvg,
        skillCount: ist.skillCount,
        zertifiziert: ist.zertifiziert,
        sollMin,
        gap: gap != null ? Math.round(gap * 10) / 10 : null,
        status,
        criticalGapCount,
        plannedSkillCount: skillComparisons.length,
        skillComparisons,
        milestones,
      });
    }
  });

  const all = [...portfolio, ...gliederungen, ...rollen, ...mitarbeiter];
  let skillComparisonCount = 0;
  mitarbeiter.forEach((m) => {
    skillComparisonCount += (m.skillComparisons || []).length;
  });
  const summary = {
    totalComparisons: all.length,
    milestoneCount: countP1Milestones({ portfolio, gliederungen, rollen, mitarbeiter }),
    skillComparisonCount,
    ok: 0, warn: 0, risk: 0, neutral: 0,
  };
  all.forEach((item) => { summary[item.status] = (summary[item.status] || 0) + 1; });

  return { portfolio, gliederungen, rollen, mitarbeiter, summary };
}

function aggregateP1PortfolioCategorySollForYear(planPayload, year, categoryKey) {
  const measures = planPayload?.measures || {};
  let sum = 0;
  let has = false;
  let milestoneCount = 0;
  Object.values(measures).forEach((list) => {
    (list || []).forEach((m) => {
      if (!m || m.kind !== "p1Year" || Number(m.jahr) !== Number(year)) return;
      if (m.area !== "portfolio") return;
      if ((m.category || "") !== categoryKey) return;
      milestoneCount += 1;
      const v = parseTeur(m.ziel_umsatz_teur);
      if (v != null) {
        sum += v;
        has = true;
      }
    });
  });
  return { soll: has ? sum : null, milestoneCount };
}

function buildP1PortfolioCategoryTimelines(planPayload, phase1, years = DEFAULT_TIMELINE_YEARS) {
  const timelines = {};
  Object.keys(PORTFOLIO_CATEGORY_LABELS).forEach((categoryKey) => {
    const yearly = years.map((y) => aggregateP1PortfolioCategorySollForYear(planPayload, y, categoryKey));
    const soll = yearly.map((row) => row.soll);
    const quarterAgg = aggregateP1PortfolioSollByQuarter(
      planPayload,
      years,
      (m) => (m.category || "") === categoryKey
    );
    const milestoneCount = quarterAgg.milestoneCount;
    const istStart = phase1.portfolio?.byCategory?.[categoryKey] ?? 0;
    let lastSoll = null;
    for (let i = quarterAgg.sollByQuarter.length - 1; i >= 0; i -= 1) {
      if (quarterAgg.sollByQuarter[i] != null) {
        lastSoll = quarterAgg.sollByQuarter[i];
        break;
      }
    }
    if (lastSoll == null) {
      for (let i = soll.length - 1; i >= 0; i -= 1) {
        if (soll[i] != null) {
          lastSoll = soll[i];
          break;
        }
      }
    }
    const hasQuarterSoll = quarterAgg.sollByQuarter.some((v) => v != null);
    const hasSoll = soll.some((v) => v != null) || hasQuarterSoll;
    const ist = hasSoll && istStart != null && lastSoll != null
      ? buildLinearIstSeries(years, istStart, lastSoll)
      : years.map(() => null);
    const istByQuarter = hasSoll && istStart != null && lastSoll != null
      ? buildLinearIstSeriesForSlotCount(quarterAgg.quarters.length, istStart, lastSoll)
      : quarterAgg.quarters.map(() => null);
    timelines[categoryKey] = {
      key: categoryKey,
      label: PORTFOLIO_CATEGORY_LABELS[categoryKey] || categoryKey,
      years: [...years],
      soll,
      ist,
      istStart,
      milestoneCount,
      hasData: milestoneCount > 0 || hasQuarterSoll,
      quarters: quarterAgg.quarters,
      sollByQuarter: quarterAgg.sollByQuarter,
      istByQuarter,
      unit: "TEUR",
      yAxisLabel: "Umsatz (TEUR)",
      xAxisLabel: "Zeit",
    };
  });
  return timelines;
}

const ORG_SECTION_META = {
  gliederungen: {
    label: "Organisatorische Gliederung",
    unit: "HC",
    yAxisLabel: "Headcount (SOLL)",
    xAxisLabel: "Jahr",
  },
  gliederungenUmsatz: {
    label: "Organisatorische Gliederung",
    unit: "TEUR",
    yAxisLabel: "Umsatz (TEUR)",
    xAxisLabel: "Jahr",
  },
  rollen: {
    label: "Rollen",
    unit: "MA",
    yAxisLabel: "Personen (SOLL)",
    xAxisLabel: "Jahr",
  },
};

const ORG_SECTION_TIMELINE_DEFS = [
  { key: "gliederungen", areaKey: "gliederungen", field: "ziel_headcount", combine: "max" },
  { key: "gliederungenUmsatz", areaKey: "gliederungen", field: "ziel_umsatz_teur", combine: "sum" },
  { key: "rollen", areaKey: "rollen", field: "ziel_anzahl", combine: "max" },
];

function aggregateP1OrgSegmentForYear(planPayload, phase1, year, areaKey, opts = {}) {
  const field = opts.field || "ziel_headcount";
  const combine = opts.combine || "max";
  const measures = planPayload?.measures || {};
  const segments = new Map();
  let milestoneCount = 0;

  Object.values(measures).forEach((list) => {
    (list || []).forEach((m) => {
      if (!m || m.kind !== "p1Year" || Number(m.jahr) !== Number(year)) return;
      if (m.area !== areaKey) return;
      milestoneCount += 1;

      const key = p1PlanEntryKey(m);
      const entry = {
        area: m.area,
        subcategory: m.subcategory,
        orgItemId: m.orgItemId || null,
        entityRef: m.entityRef || null,
      };
      const label = resolveOrgLabel(phase1, entry, areaKey);
      const value = parseTeur(m[field]);

      if (!segments.has(key)) {
        segments.set(key, { key, label, value: null });
      }
      const seg = segments.get(key);
      if (label && label !== "–") seg.label = label;
      if (value != null) {
        if (combine === "sum") {
          seg.value = (seg.value || 0) + value;
        } else {
          seg.value = seg.value == null ? value : Math.max(seg.value, value);
        }
      }
    });
  });

  return { segments, milestoneCount };
}

function buildP1OrgIstFallbackSegments(phase1, years, def) {
  const segments = [];
  if (def.areaKey === "gliederungen" && def.field === "ziel_headcount") {
    (phase1.organisation?.headcountByBereich || []).forEach((b) => {
      const hc = Number(b.headcount) || 0;
      if (hc <= 0) return;
      segments.push({
        key: String(b.id || b.bereich),
        label: b.bereich,
        values: years.map(() => hc),
      });
    });
  } else if (def.areaKey === "gliederungen" && def.field === "ziel_umsatz_teur") {
    (phase1.organisation?.umsatzByBereich || []).forEach((b) => {
      const teur = Number(b.teur) || 0;
      if (teur <= 0) return;
      segments.push({
        key: String(b.id || b.bereich),
        label: b.bereich,
        values: years.map(() => teur),
      });
    });
  } else if (def.areaKey === "rollen" && def.field === "ziel_anzahl") {
    (phase1.organisation?.rollenByRolle || []).forEach((r) => {
      const n = Number(r.anzahl) || 0;
      if (n <= 0) return;
      segments.push({
        key: String(r.id || r.rolle),
        label: r.rolle,
        values: years.map(() => n),
      });
    });
  }
  return segments.sort((a, b) => String(a.label).localeCompare(String(b.label), "de"));
}

function buildP1OrgSectionTimelineEntry(planPayload, phase1, years, def) {
  const meta = ORG_SECTION_META[def.key];
  const yearlyAggs = years.map((y) =>
    aggregateP1OrgSegmentForYear(planPayload, phase1, y, def.areaKey, {
      field: def.field,
      combine: def.combine,
    })
  );
  const milestoneCount = yearlyAggs.reduce((sum, row) => sum + row.milestoneCount, 0);
  const segmentMap = new Map();

  yearlyAggs.forEach((row, yearIndex) => {
    row.segments.forEach((seg, key) => {
      if (!segmentMap.has(key)) {
        segmentMap.set(key, { key, label: seg.label, values: years.map(() => null) });
      }
      const stored = segmentMap.get(key);
      if (seg.label) stored.label = seg.label;
      if (seg.value != null && seg.value > 0) {
        const cur = stored.values[yearIndex];
        stored.values[yearIndex] = def.combine === "sum"
          ? (cur || 0) + seg.value
          : cur == null ? seg.value : Math.max(cur, seg.value);
      }
    });
  });

  const segments = [...segmentMap.values()]
    .filter((seg) => seg.values.some((v) => v != null && v > 0))
    .sort((a, b) => String(a.label).localeCompare(String(b.label), "de"));

  const totals = years.map((_, yearIndex) =>
    segments.reduce((sum, seg) => sum + (seg.values[yearIndex] || 0), 0)
  );
  const hasData = milestoneCount > 0 && totals.some((t) => t > 0);

  if (!hasData && milestoneCount > 0) {
    const istSegments = buildP1OrgIstFallbackSegments(phase1, years, def);
    const istTotals = years.map((_, yearIndex) =>
      istSegments.reduce((sum, seg) => sum + (seg.values[yearIndex] || 0), 0)
    );
    if (istTotals.some((t) => t > 0)) {
      return {
        key: def.key,
        label: meta.label,
        years: [...years],
        segments: istSegments,
        totals: istTotals,
        milestoneCount,
        hasData: true,
        istFallback: true,
        unit: meta.unit,
        yAxisLabel: meta.yAxisLabel.replace("(SOLL)", "(IST)"),
        xAxisLabel: meta.xAxisLabel,
      };
    }
  }

  return {
    key: def.key,
    label: meta.label,
    years: [...years],
    segments,
    totals,
    milestoneCount,
    hasData,
    unit: meta.unit,
    yAxisLabel: meta.yAxisLabel,
    xAxisLabel: meta.xAxisLabel,
  };
}

function buildP1OrgSectionTimelines(planPayload, phase1, years = DEFAULT_TIMELINE_YEARS) {
  const timelines = {};
  ORG_SECTION_TIMELINE_DEFS.forEach((def) => {
    timelines[def.key] = buildP1OrgSectionTimelineEntry(planPayload, phase1, years, def);
  });
  return timelines;
}

function buildP1DashboardSnapshot(entries, planPayload, year, registry, timelineYears = DEFAULT_TIMELINE_YEARS) {
  const phase1 = aggregatePhase1Entries(entries, registry);
  const p1Plan = aggregateP1PlanForYear(planPayload, year);
  const comparison = enrichPortfolioAllYearMilestones(
    planPayload,
    buildP1Comparison(phase1, p1Plan)
  );
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
    years: [...timelineYears],
    phase1,
    p1Ist,
    p1Plan: comparison,
    summary: comparison.summary,
    planMeta: planPayload?.meta || null,
    portfolioCategoryTimelines: buildP1PortfolioCategoryTimelines(planPayload, phase1, timelineYears),
    orgSectionTimelines: buildP1OrgSectionTimelines(planPayload, phase1, timelineYears),
    employeeSkillHeatmap: buildEmployeeSkillHeatmap(comparison.mitarbeiter),
  };
}

function mergeP1Summaries(byYear) {
  const summary = {
    totalComparisons: 0,
    milestoneCount: 0,
    skillComparisonCount: 0,
    ok: 0, warn: 0, risk: 0, neutral: 0,
  };
  byYear.forEach((row) => {
    const s = row.summary;
    if (!s) return;
    summary.totalComparisons += s.totalComparisons || 0;
    summary.milestoneCount += s.milestoneCount || 0;
    summary.skillComparisonCount += s.skillComparisonCount || 0;
    summary.ok += s.ok || 0;
    summary.warn += s.warn || 0;
    summary.risk += s.risk || 0;
    summary.neutral += s.neutral || 0;
  });
  return summary;
}

function countP1Milestones(comparison) {
  let count = 0;
  ["portfolio", "gliederungen", "rollen", "mitarbeiter"].forEach((key) => {
    (comparison[key] || []).forEach((item) => {
      count += (item.milestones || []).length;
    });
  });
  return count;
}

function buildP1DashboardSnapshotAllYears(entries, planPayload, years, registry) {
  const phase1 = aggregatePhase1Entries(entries, registry);
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
    const comparison = enrichPortfolioAllYearMilestones(
      planPayload,
      buildP1Comparison(phase1, p1Plan)
    );
    return {
      year: Number(year),
      p1Plan: comparison,
      summary: comparison.summary,
      employeeSkillHeatmap: buildEmployeeSkillHeatmap(comparison.mitarbeiter),
    };
  });
  return {
    allYears: true,
    years: [...years],
    phase1,
    p1Ist,
    byYear,
    summary: mergeP1Summaries(byYear),
    planMeta: planPayload?.meta || null,
    portfolioCategoryTimelines: buildP1PortfolioCategoryTimelines(planPayload, phase1, years),
    orgSectionTimelines: buildP1OrgSectionTimelines(planPayload, phase1, years),
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

function buildP1DashboardTimeline(entries, planPayload, years = DEFAULT_TIMELINE_YEARS, registry) {
  const phase1 = aggregatePhase1Entries(entries, registry);
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
  buildP1PortfolioCategoryTimelines,
  buildP1OrgSectionTimelines,
  buildEmployeeSkillHeatmap,
  countAllPlanMilestones,
  buildDemoEvaluationSummary,
  DEFAULT_TIMELINE_YEARS,
};
