/* Referenzdaten aus Mitarbeiter_Soft_Skill_Assessment.xlsx */

const DEFAULT_SOFT_SKILL_CATEGORIES = [
  {
    id: "kommunikation",
    name: "Kommunikation & Präsentation",
    beschreibung: "Fähigkeit, Informationen klar und überzeugend zu vermitteln – mündlich, schriftlich, visuell",
    beispielKompetenzen: "Präsentationstechniken, Storytelling, Executive Communication, Dokumentation, Visualization, Public Speaking",
  },
  {
    id: "vertrieb",
    name: "Vertrieb & Akquise",
    beschreibung: "Neukundengewinnung, Beziehungsaufbau, Verkaufsabschluss, Account-Pflege",
    beispielKompetenzen: "B2B/B2C Sales, Cold Calling, Lead Qualification, Proposal Writing, Closing Techniques, Cross-Selling, CRM",
  },
  {
    id: "leadership",
    name: "Leadership & People Management",
    beschreibung: "Teams führen, entwickeln und motivieren; strategische Ausrichtung vermitteln",
    beispielKompetenzen: "Mitarbeiterführung, 1:1s, Performance Management, Delegation, Coaching, Change Management, Talent Development",
  },
  {
    id: "pm",
    name: "Projektmanagement & Organisation",
    beschreibung: "Projekte planen, steuern und erfolgreich abschließen; Stakeholder koordinieren",
    beispielKompetenzen: "Agile/Waterfall PM, Roadmapping, Ressourcenplanung, Risk Management, Reporting, Stakeholder Management",
  },
  {
    id: "analytik",
    name: "Problemlösung & Analytisches Denken",
    beschreibung: "Komplexe Probleme strukturieren, Ursachen identifizieren, fundierte Entscheidungen treffen",
    beispielKompetenzen: "Root Cause Analysis, Structured Thinking, Data-Driven Decision Making, Critical Thinking, Troubleshooting",
  },
  {
    id: "kreativ",
    name: "Kreativität & Innovation",
    beschreibung: "Neue Ideen entwickeln, Prozesse hinterfragen, Innovationen vorantreiben",
    beispielKompetenzen: "Design Thinking, Brainstorming, Prototyping, Lateral Thinking, Experimentation, Business Model Innovation",
  },
  {
    id: "team",
    name: "Teamarbeit & Kollaboration",
    beschreibung: "Effektiv mit anderen zusammenarbeiten, Wissen teilen, gemeinsame Ziele erreichen",
    beispielKompetenzen: "Cross-Functional Collaboration, Active Listening, Feedback geben/nehmen, Remote Collaboration, Empathie",
  },
  {
    id: "kunde",
    name: "Kundenorientierung & Service",
    beschreibung: "Kundenbedürfnisse verstehen, Erwartungen übertreffen, langfristige Beziehungen aufbauen",
    beispielKompetenzen: "Customer Success, User Empathy, Service Excellence, Complaint Handling, Relationship Management",
  },
  {
    id: "verhandlung",
    name: "Verhandlung & Konfliktlösung",
    beschreibung: "Win-Win-Lösungen erarbeiten, Interessenskonflikte auflösen, schwierige Gespräche führen",
    beispielKompetenzen: "Negotiation Techniques, Mediation, Difficult Conversations, Diplomacy, De-escalation, Consensus Building",
  },
  {
    id: "zeit",
    name: "Zeitmanagement & Priorisierung",
    beschreibung: "Aufgaben effektiv planen, Deadlines einhalten, Wichtiges von Dringendem unterscheiden",
    beispielKompetenzen: "Eisenhower-Matrix, Time Blocking, Delegation, Focus Management, Productivity Methods (GTD, Pomodoro)",
  },
];

let SOFT_SKILL_CATEGORIES = DEFAULT_SOFT_SKILL_CATEGORIES.map((c) => ({ ...c }));

function setSoftSkillCategories(categories) {
  SOFT_SKILL_CATEGORIES = (categories || []).map((c) => ({
    id: c.id != null ? String(c.id) : c.slug || c.name,
    name: c.name,
    beschreibung: c.beschreibung || "",
    beispielKompetenzen: c.beispielKompetenzen || c.beispiel || "",
  }));
}

const SOFT_SKILL_LEVELS = [
  {
    level: 1,
    bezeichnung: "Entwicklungsbedarf",
    definition: "Zeigt noch signifikante Lücken in dieser Kompetenz. Benötigt intensive Begleitung und Entwicklung.",
    verhaltensIndikatoren: "Vermeidet Situationen, die diese Kompetenz erfordern; macht häufig Fehler; benötigt ständige Anleitung; Feedback wird nicht umgesetzt",
  },
  {
    level: 2,
    bezeichnung: "Grundkompetenz",
    definition: "Zeigt erste Ansätze, kann einfache Situationen mit Unterstützung bewältigen. Ausbaufähig.",
    verhaltensIndikatoren: "Kommt in Standardsituationen zurecht; benötigt gelegentlich Hilfe; setzt Feedback um; zeigt Lernbereitschaft",
  },
  {
    level: 3,
    bezeichnung: "Kompetent",
    definition: "Zeigt diese Kompetenz zuverlässig im Arbeitsalltag. Erfüllt die Erwartungen der Rolle.",
    verhaltensIndikatoren: "Arbeitet selbstständig; bewältigt auch anspruchsvolle Situationen; wird von Kollegen als kompetent wahrgenommen; sucht aktiv Feedback",
  },
  {
    level: 4,
    bezeichnung: "Sehr kompetent",
    definition: "Übertrifft regelmäßig Erwartungen. Wird als Vorbild wahrgenommen und unterstützt andere.",
    verhaltensIndikatoren: "Meistert auch komplexe/kritische Situationen souverän; dient als Ansprechperson für Kollegen; gibt konstruktives Feedback; treibt Verbesserungen voran",
  },
  {
    level: 5,
    bezeichnung: "Vorbildlich / Coach",
    definition: "Exzellenz in dieser Kompetenz. Prägt Unternehmenskultur, coacht andere, entwickelt Standards.",
    verhaltensIndikatoren: "Wird unternehmens- oder branchenweit als Experte wahrgenommen; entwickelt Trainings/Frameworks; mentort regelmäßig; setzt neue Maßstäbe",
  },
];

const SOFT_SKILL_EXAMPLES = [
  {
    mitarbeiterId: "MA001",
    nachname: "Mueller",
    vorname: "Thomas",
    rolle: "Sales Manager",
    workstream: "Skills & Mindset",
    softSkills: [
      {
        kategorie: "Vertrieb & Akquise",
        kompetenz: "B2B-Vertrieb, Cold Calling, Account Management",
        level: 4,
        bemerkungen: "Stärke: Beziehungsaufbau",
      },
    ],
  },
  {
    mitarbeiterId: "MA002",
    nachname: "Schmidt",
    vorname: "Sarah",
    rolle: "Product Owner",
    workstream: "Skills & Mindset",
    softSkills: [
      {
        kategorie: "Kommunikation & Präsentation",
        kompetenz: "Stakeholder-Präsentationen, Workshop-Moderation",
        level: 3,
        bemerkungen: "Möchte Storytelling vertiefen",
      },
    ],
  },
  {
    mitarbeiterId: "MA003",
    nachname: "Weber",
    vorname: "Michael",
    rolle: "Team Lead Engineering",
    workstream: "Skills & Mindset",
    softSkills: [
      {
        kategorie: "Leadership & People Management",
        kompetenz: "Mitarbeiterführung, 1:1s, Feedback-Kultur",
        level: 3,
        bemerkungen: "Noch wenig Erfahrung mit Konflikt-Eskalationen",
      },
    ],
  },
];

function getSoftCategoryByName(name) {
  return SOFT_SKILL_CATEGORIES.find((c) => c.name === name) || null;
}

function getSoftCategoryById(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  return SOFT_SKILL_CATEGORIES.find((c) => Number(c.id) === n) || null;
}

function getSoftLevelDef(level) {
  const n = parseInt(level, 10);
  return SOFT_SKILL_LEVELS.find((l) => l.level === n) || null;
}

function formatSoftLevel(level) {
  const def = getSoftLevelDef(level);
  return def ? `${def.level} – ${def.bezeichnung}` : String(level || "–");
}

function isKnownSoftCategory(name) {
  return !!getSoftCategoryByName(name);
}

function isKnownSoftCategoryId(id) {
  return !!getSoftCategoryById(id);
}

function isKnownSoftLevel(level) {
  return !!getSoftLevelDef(level);
}

function resolveSoftCategorySelect(kategorie, kategorieId) {
  const id = Number(kategorieId);
  if (Number.isInteger(id) && id > 0 && isKnownSoftCategoryId(id)) {
    return { value: String(id), other: "" };
  }
  if (!kategorie) return { value: "", other: "" };
  const byName = getSoftCategoryByName(kategorie);
  if (byName) return { value: String(byName.id), other: "" };
  return { value: SELECT_SONSTIGES, other: kategorie };
}

function resolveSoftLevelSelect(level, levelCustom) {
  if (level != null && level !== "" && isKnownSoftLevel(level)) {
    return { value: String(level), other: "" };
  }
  if (levelCustom) return { value: SELECT_SONSTIGES, other: levelCustom };
  return { value: "", other: "" };
}

function buildSoftCategoryOptions(selected, selectedId) {
  const resolved = resolveSoftCategorySelect(selected, selectedId);
  let html = '<option value="">– Kategorie waehlen –</option>';
  SOFT_SKILL_CATEGORIES.forEach((c) => {
    const id = Number(c.id);
    if (!Number.isInteger(id) || id <= 0) return;
    const sel = String(id) === String(resolved.value) ? " selected" : "";
    html += `<option value="${id}"${sel}>${c.name.replace(/"/g, "&quot;")}</option>`;
  });
  const osel = resolved.value === SELECT_SONSTIGES ? " selected" : "";
  html += `<option value="${SELECT_SONSTIGES}"${osel}>Sonstiges (manuelle Eingabe)</option>`;
  return html;
}

function buildSoftLevelOptions(selected, levelCustom) {
  const resolved = resolveSoftLevelSelect(selected, levelCustom);
  let html = '<option value="">– Level waehlen –</option>';
  SOFT_SKILL_LEVELS.forEach((l) => {
    const val = String(l.level);
    const sel = resolved.value === val ? " selected" : "";
    html += `<option value="${val}"${sel}>${l.level} – ${l.bezeichnung}</option>`;
  });
  const osel = resolved.value === SELECT_SONSTIGES ? " selected" : "";
  html += `<option value="${SELECT_SONSTIGES}"${osel}>Sonstiges (manuelle Eingabe)</option>`;
  return html;
}

function resolveSoftSimpleSelect(value, knownValues) {
  if (!value) return { value: "", other: "" };
  if (knownValues.includes(value)) return { value, other: "" };
  return { value: SELECT_SONSTIGES, other: value };
}
