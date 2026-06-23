/**
 * Demo-Datensätze für IST/SOLL-Tests (Phase 1 + Backcasting) je Unit.
 * Alle Einträge werden mit is_demo=true in der DB gespeichert.
 */

const DEMO_UNITS = [
  "SAP Infrastructure",
  "SAP Engineers",
  "SAP Integration",
  "SAP Architecture",
];

const DEMO_UNIT = DEMO_UNITS[2];

function slugifyUnit(unit) {
  return String(unit || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function demoId(unit, suffix) {
  return `demo-${slugifyUnit(unit)}-${suffix}`;
}

const UNIT_PROFILES = {
  "SAP Integration": {
    leiter: "Demo Bereichsleiter Integration",
    mail: "demo.integration@realcore.de",
    stichtag: "2026-01-15",
    portfolio: [
      { cat: "produkte", name: "AMS Copilot", teur: 450, ampel: "green" },
      { cat: "services", name: "Managed Integration Operations", teur: 1200, ampel: "green" },
      { cat: "loesungen", name: "API Governance Package", teur: 380, ampel: "orange" },
      { cat: "partnergeschaeft", name: "SAP Co-Sell EVU", teur: 620, ampel: "green" },
      { cat: "projektgeschaeft", name: "S/4HANA Integrations-Rollouts", teur: 2800, ampel: "orange" },
    ],
    gliederungen: [
      { bereich: "SAP / ERP", headcount: 12, umsatz_teur: 1800 },
      { bereich: "Integration & APIs", headcount: 6, umsatz_teur: 900 },
      { bereich: "AI & Machine Learning", headcount: 4, umsatz_teur: 350 },
    ],
    rollen: [
      { rolle: "Solution Architect", anzahl: 3 },
      { rolle: "Consultant / Berater", anzahl: 8 },
      { rolle: "Developer / Engineer", anzahl: 5 },
      { rolle: "Delivery Manager", anzahl: 2 },
      { rolle: "Projektmanager", anzahl: 4 },
    ],
    employees: [
      { slug: "mueller", vorname: "Thomas", nachname: "Mueller", role: "Solution Architect", zert: "ja", skills: [["Integration & Middleware", 4], ["Cloud & Infrastructure", 3]] },
      { slug: "schmidt", vorname: "Sarah", nachname: "Schmidt", role: "Consultant / Berater", zert: "ja", skills: [["Data & Analytics", 3], ["AI & Machine Learning", 2]] },
      { slug: "weber", vorname: "Michael", nachname: "Weber", role: "Developer / Engineer", zert: "nein", skills: [["Development & Automation", 3], ["Business Tools & Plattformen", 2]] },
      { slug: "fischer", vorname: "Laura", nachname: "Fischer", role: "Delivery Manager", zert: "ja", skills: [["Security & Compliance", 3]] },
      { slug: "hoffmann", vorname: "Jan", nachname: "Hoffmann", role: "Projektmanager", zert: "nein", skills: [["Low-Code / No-Code", 2], ["Integration & Middleware", 2]] },
      { slug: "becker", vorname: "Nina", nachname: "Becker", role: "Consultant / Berater", zert: "ja", skills: [["AI & Machine Learning", 3], ["Cloud & Infrastructure", 3]] },
    ],
    planTargets: {
      2026: { umsatz: 5200, headcount: 22, zertPct: 100, skillCat: "Integration & Middleware", skillMin: 3 },
      2027: { umsatz: 5800, headcount: 24, zertPct: 50, skillCat: "AI & Machine Learning", skillMin: 3 },
      2028: { umsatz: 6400, headcount: 26, zertPct: 60, skillCat: "Cloud & Infrastructure", skillMin: 3 },
      2029: { umsatz: 7000, headcount: 28, zertPct: 70, skillCat: "Data & Analytics", skillMin: 3 },
    },
  },
  "SAP Infrastructure": {
    leiter: "Demo Bereichsleiter Infrastructure",
    mail: "demo.infrastructure@realcore.de",
    stichtag: "2026-02-01",
    portfolio: [
      { cat: "produkte", name: "Basis-Monitoring Suite", teur: 320, ampel: "green" },
      { cat: "services", name: "24/7 SAP Basis Operations", teur: 2100, ampel: "green" },
      { cat: "loesungen", name: "HANA Operations Framework", teur: 890, ampel: "green" },
      { cat: "partnergeschaeft", name: "Red Hat Co-Managed Ops", teur: 540, ampel: "orange" },
      { cat: "projektgeschaeft", name: "Rise with SAP Basis-Migrationen", teur: 1950, ampel: "orange" },
    ],
    gliederungen: [
      { bereich: "SAP Basis & HANA", headcount: 18, umsatz_teur: 3200 },
      { bereich: "Cloud Operations", headcount: 8, umsatz_teur: 1400 },
      { bereich: "Security Operations", headcount: 5, umsatz_teur: 600 },
    ],
    rollen: [
      { rolle: "Solution Architect", anzahl: 2 },
      { rolle: "Consultant / Berater", anzahl: 10 },
      { rolle: "Developer / Engineer", anzahl: 6 },
      { rolle: "Delivery Manager", anzahl: 3 },
      { rolle: "Projektmanager", anzahl: 5 },
    ],
    employees: [
      { slug: "braun", vorname: "Andreas", nachname: "Braun", role: "Solution Architect", zert: "ja", skills: [["Cloud & Infrastructure", 4], ["Security & Compliance", 3]] },
      { slug: "wagner", vorname: "Petra", nachname: "Wagner", role: "Consultant / Berater", zert: "nein", skills: [["Business Tools & Plattformen", 3], ["Integration & Middleware", 2]] },
      { slug: "koch", vorname: "Stefan", nachname: "Koch", role: "Developer / Engineer", zert: "nein", skills: [["Development & Automation", 3], ["Cloud & Infrastructure", 2]] },
      { slug: "richter", vorname: "Julia", nachname: "Richter", role: "Delivery Manager", zert: "ja", skills: [["Security & Compliance", 3]] },
      { slug: "wolf", vorname: "Markus", nachname: "Wolf", role: "Projektmanager", zert: "nein", skills: [["Low-Code / No-Code", 2]] },
    ],
    planTargets: {
      2026: { umsatz: 6200, headcount: 31, zertPct: 80, skillCat: "Cloud & Infrastructure", skillMin: 3 },
      2027: { umsatz: 6800, headcount: 33, zertPct: 60, skillCat: "Security & Compliance", skillMin: 3 },
      2028: { umsatz: 7200, headcount: 34, zertPct: 70, skillCat: "Business Tools & Plattformen", skillMin: 3 },
      2029: { umsatz: 7600, headcount: 35, zertPct: 75, skillCat: "Integration & Middleware", skillMin: 3 },
    },
  },
  "SAP Engineers": {
    leiter: "Demo Bereichsleiter Engineers",
    mail: "demo.engineers@realcore.de",
    stichtag: "2026-01-20",
    portfolio: [
      { cat: "produkte", name: "DevOps Accelerator Kit", teur: 280, ampel: "orange" },
      { cat: "services", name: "Continuous Delivery as a Service", teur: 980, ampel: "green" },
      { cat: "loesungen", name: "CAP/RAP Factory", teur: 720, ampel: "green" },
      { cat: "partnergeschaeft", name: "Microsoft Dev Co-Sell", teur: 410, ampel: "orange" },
      { cat: "projektgeschaeft", name: "Custom ABAP & BTP Extensions", teur: 1650, ampel: "orange" },
    ],
    gliederungen: [
      { bereich: "ABAP & BTP Development", headcount: 14, umsatz_teur: 2100 },
      { bereich: "DevOps & Automation", headcount: 7, umsatz_teur: 900 },
      { bereich: "Quality Engineering", headcount: 4, umsatz_teur: 400 },
    ],
    rollen: [
      { rolle: "Solution Architect", anzahl: 2 },
      { rolle: "Consultant / Berater", anzahl: 4 },
      { rolle: "Developer / Engineer", anzahl: 14 },
      { rolle: "Delivery Manager", anzahl: 2 },
      { rolle: "Projektmanager", anzahl: 3 },
    ],
    employees: [
      { slug: "lehmann", vorname: "Felix", nachname: "Lehmann", role: "Developer / Engineer", zert: "ja", skills: [["Development & Automation", 4], ["Business Tools & Plattformen", 4]] },
      { slug: "schwarz", vorname: "Anna", nachname: "Schwarz", role: "Developer / Engineer", zert: "ja", skills: [["Development & Automation", 4], ["AI & Machine Learning", 3]] },
      { slug: "zimmermann", vorname: "Paul", nachname: "Zimmermann", role: "Developer / Engineer", zert: "ja", skills: [["Low-Code / No-Code", 3], ["Cloud & Infrastructure", 3]] },
      { slug: "krueger", vorname: "Sophie", nachname: "Krueger", role: "Consultant / Berater", zert: "ja", skills: [["Data & Analytics", 3], ["Integration & Middleware", 3]] },
      { slug: "hartmann", vorname: "Lukas", nachname: "Hartmann", role: "Developer / Engineer", zert: "nein", skills: [["Development & Automation", 2], ["Business Tools & Plattformen", 2]] },
      { slug: "lange", vorname: "Mia", nachname: "Lange", role: "Solution Architect", zert: "ja", skills: [["Cloud & Infrastructure", 4], ["Security & Compliance", 3]] },
      { slug: "schmitz", vorname: "Jonas", nachname: "Schmitz", role: "Projektmanager", zert: "nein", skills: [["Integration & Middleware", 2]] },
    ],
    planTargets: {
      2026: { umsatz: 4800, headcount: 25, zertPct: 70, skillCat: "Development & Automation", skillMin: 4 },
      2027: { umsatz: 5400, headcount: 27, zertPct: 75, skillCat: "AI & Machine Learning", skillMin: 3 },
      2028: { umsatz: 5900, headcount: 28, zertPct: 80, skillCat: "Low-Code / No-Code", skillMin: 3 },
      2029: { umsatz: 6300, headcount: 29, zertPct: 85, skillCat: "Cloud & Infrastructure", skillMin: 4 },
    },
  },
  "SAP Architecture": {
    leiter: "Demo Bereichsleiter Architecture",
    mail: "demo.architecture@realcore.de",
    stichtag: "2026-01-28",
    portfolio: [
      { cat: "produkte", name: "Enterprise Architecture Blueprint", teur: 520, ampel: "green" },
      { cat: "services", name: "Architecture Review Office", teur: 760, ampel: "green" },
      { cat: "loesungen", name: "Target Landscape Design", teur: 1100, ampel: "green" },
      { cat: "partnergeschaeft", name: "SAP Signavio Co-Innovation", teur: 480, ampel: "orange" },
      { cat: "projektgeschaeft", name: "Transformation Architecture Programme", teur: 1420, ampel: "orange" },
    ],
    gliederungen: [
      { bereich: "Enterprise Architecture", headcount: 8, umsatz_teur: 1900 },
      { bereich: "Solution Architecture", headcount: 6, umsatz_teur: 1200 },
      { bereich: "Innovation & AI Strategy", headcount: 3, umsatz_teur: 580 },
    ],
    rollen: [
      { rolle: "Solution Architect", anzahl: 8 },
      { rolle: "Consultant / Berater", anzahl: 5 },
      { rolle: "Developer / Engineer", anzahl: 2 },
      { rolle: "Delivery Manager", anzahl: 1 },
      { rolle: "Projektmanager", anzahl: 2 },
    ],
    employees: [
      { slug: "neumann", vorname: "Claudia", nachname: "Neumann", role: "Solution Architect", zert: "ja", skills: [["Business Tools & Plattformen", 4], ["Integration & Middleware", 4]] },
      { slug: "schulz", vorname: "Daniel", nachname: "Schulz", role: "Solution Architect", zert: "ja", skills: [["Cloud & Infrastructure", 4], ["AI & Machine Learning", 3]] },
      { slug: "werner", vorname: "Elena", nachname: "Werner", role: "Consultant / Berater", zert: "ja", skills: [["Data & Analytics", 3], ["Security & Compliance", 3]] },
      { slug: "krause", vorname: "Martin", nachname: "Krause", role: "Solution Architect", zert: "nein", skills: [["Integration & Middleware", 3], ["Development & Automation", 2]] },
      { slug: "meier", vorname: "Sandra", nachname: "Meier", role: "Projektmanager", zert: "ja", skills: [["Low-Code / No-Code", 2]] },
    ],
    planTargets: {
      2026: { umsatz: 4600, headcount: 19, zertPct: 90, skillCat: "Business Tools & Plattformen", skillMin: 4 },
      2027: { umsatz: 5100, headcount: 20, zertPct: 85, skillCat: "Integration & Middleware", skillMin: 4 },
      2028: { umsatz: 5600, headcount: 21, zertPct: 90, skillCat: "AI & Machine Learning", skillMin: 3 },
      2029: { umsatz: 6000, headcount: 22, zertPct: 95, skillCat: "Cloud & Infrastructure", skillMin: 4 },
    },
  },
};

function getUnitProfile(unit) {
  return UNIT_PROFILES[unit] || UNIT_PROFILES[DEMO_UNIT];
}

function ampelScore(ampel) {
  if (ampel === "green") return 4;
  if (ampel === "orange") return 3;
  if (ampel === "red") return 2;
  return 3;
}

function formatTeur(value) {
  return `${Number(value).toLocaleString("de-DE")} TEUR`;
}

function buildPortfolioEntries(unit, profile) {
  return profile.portfolio.map((item, index) => ({
    id: demoId(unit, `pf-${item.cat}-${index}`),
    type: "portfolio",
    unit,
    workstream: "",
    category: item.cat,
    bezeichnung: item.name,
    beschreibung: `Demo-Portfolio für ${unit}.`,
    hinweis: "Demo-Datensatz",
    jahresumsatz_teur: item.teur,
    jahresumsatz: formatTeur(item.teur),
    ampel: item.ampel,
    ampel_score: ampelScore(item.ampel),
  }));
}

function buildOrganisationEntry(unit, profile) {
  return {
    id: demoId(unit, "organisation"),
    type: "organisation",
    unit,
    workstream: "",
    stichtag: profile.stichtag,
    erfassungsjahr: 2026,
    hatTechnologischeGliederung: "ja",
    gliederungen: profile.gliederungen.map((g) => ({
      bereich: g.bereich,
      beschreibung: `Demo-Gliederung ${unit}`,
      headcount: g.headcount,
      umsatz_teur: g.umsatz_teur,
      umsatz: formatTeur(g.umsatz_teur),
    })),
    rollen: profile.rollen.map((r) => ({ rolle: r.rolle, anzahl: r.anzahl, bemerkung: "" })),
  };
}

function buildSkillEntries(unit, profile) {
  const mailDomain = slugifyUnit(unit).replace(/-/g, "") + ".demo";
  return profile.employees.map((emp) => ({
    id: demoId(unit, `skill-${emp.slug}`),
    type: "skill",
    unit,
    nachname: emp.nachname,
    vorname: emp.vorname,
    name: `${emp.nachname}, ${emp.vorname}`,
    email: `${emp.vorname}.${emp.nachname}.${mailDomain}@realcore.de`.toLowerCase(),
    org_roles: [emp.role],
    positions: ["Mitarbeiter"],
    zertifikate: emp.zert === "ja" ? "SAP Zertifizierung (Demo)" : "",
    zertifiziert: emp.zert,
    skills: emp.skills.map(([kategorie, level]) => ({
      kategorie,
      technologie: kategorie,
      level,
      bemerkungen: "",
    })),
    softSkills: [
      {
        kategorie: "Teamarbeit & Kollaboration",
        kompetenz: "Zusammenarbeit",
        level: 3,
        bemerkungen: "",
      },
    ],
  }));
}

function buildPhase1DemoEntries(unit = DEMO_UNIT) {
  const profile = getUnitProfile(unit);
  const portfolio = buildPortfolioEntries(unit, profile);
  const organisation = buildOrganisationEntry(unit, profile);
  const skills = buildSkillEntries(unit, profile);
  return {
    unit,
    entries: [...portfolio, organisation, ...skills],
  };
}

function wsMeasureKey(ws, year) {
  return `WS||${ws}||${year}`;
}

const WORKSTREAM_MILESTONES = [
  {
    ws: "Portfolio & Markt",
    ergebnis: (year) => `Portfolio-Ziele ${year} priorisieren`,
    kpis: (year) => `Pipeline und Angebotsfokus ${year}`,
    zielUmsatz: (targets) => targets.umsatz,
    zielHeadcount: (targets) => targets.headcount,
    zielZert: null,
    skillCat: null,
    skillMin: null,
  },
  {
    ws: "Skills & Mindset",
    ergebnis: () => "Skill-Matrix und Zertifizierungspfad",
    kpis: () => "Bewertungsquote und Zertifizierungsquote",
    zielUmsatz: () => null,
    zielHeadcount: (targets) => targets.headcount,
    zielZert: (targets) => targets.zertPct,
    skillCat: (targets) => targets.skillCat,
    skillMin: (targets) => targets.skillMin,
  },
  {
    ws: "Organisation & Rollen",
    ergebnis: () => "Rollenlandkarte und Staffing-Modell",
    kpis: () => "Soll-Headcount und Cross-Unit-Anteil",
    zielUmsatz: () => null,
    zielHeadcount: (targets) => targets.headcount,
    zielZert: (targets) => Math.max(20, Math.round(targets.zertPct * 0.5)),
    skillCat: null,
    skillMin: null,
  },
  {
    ws: "Partner & Ecosystem",
    ergebnis: (year) => `Partner-Pipeline ${year}`,
    kpis: () => "Co-Sell und Ecosystem-Deals",
    zielUmsatz: (targets) => Math.round(targets.umsatz * 0.15),
    zielHeadcount: () => null,
    zielZert: null,
    skillCat: null,
    skillMin: null,
  },
];

function buildBackcastingDemoPlan(unit = DEMO_UNIT) {
  const profile = getUnitProfile(unit);
  const measures = {};
  const years = [2026, 2027, 2028, 2029];

  years.forEach((year) => {
    const targets = profile.planTargets[year] || profile.planTargets[2027];
    WORKSTREAM_MILESTONES.forEach((tpl, tplIndex) => {
      const key = wsMeasureKey(tpl.ws, year);
      if (!measures[key]) measures[key] = [];
      measures[key].push({
        id: demoId(unit, `ms-${slugifyUnit(tpl.ws)}-${year}-${tplIndex}`),
        kind: "wsYear",
        workstream: tpl.ws,
        jahr: year,
        ergebnis: tpl.ergebnis(year),
        kpis: tpl.kpis(year),
        voraussetzungen: "Demo-Planung",
        abhaengigkeiten: "Unit Lead",
        risiken: tplIndex % 2 === 0 ? "" : "Ressourcenengpass",
        verantwortlich: profile.leiter,
        ziel_umsatz_teur: tpl.zielUmsatz(targets),
        ziel_headcount: tpl.zielHeadcount(targets),
        ziel_quartal: year % 2 === 0 ? "Q4" : "Q3",
        ziel_skill_kategorie: tpl.skillCat ? tpl.skillCat(targets) : "",
        ziel_skill_level_min: tpl.skillMin ? tpl.skillMin(targets) : null,
        ziel_anteil_prozent: tpl.zielZert ? tpl.zielZert(targets) : null,
      });
    });
  });

  return {
    unit,
    meta: {
      bereich: unit,
      leiter: profile.leiter,
      mail: profile.mail,
      unit,
      datum: profile.stichtag,
      splitRatio: 60,
      is_demo: true,
    },
    measures,
  };
}

function buildDemoDataForUnit(unit) {
  const phase1 = buildPhase1DemoEntries(unit);
  const plan = buildBackcastingDemoPlan(unit);
  return {
    unit,
    entries: phase1.entries,
    plan,
  };
}

function buildDemoDataForAllUnits() {
  return DEMO_UNITS.map((unit) => buildDemoDataForUnit(unit));
}

module.exports = {
  DEMO_UNIT,
  DEMO_UNITS,
  DEMO_ID_PREFIX: "demo-",
  slugifyUnit,
  demoId,
  buildPhase1DemoEntries,
  buildBackcastingDemoPlan,
  buildDemoDataForUnit,
  buildDemoDataForAllUnits,
  wsMeasureKey,
};
