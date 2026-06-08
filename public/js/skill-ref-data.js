/* Referenzdaten aus Mitarbeiter_Skill_Assessment.xlsx */

const SELECT_SONSTIGES = "__sonstiges__";

const DEFAULT_SKILL_CATEGORIES = [
  {
    id: "cloud",
    name: "Cloud & Infrastructure",
    beschreibung: "Cloud-Plattformen, Container-Orchestrierung, Infrastructure as Code, Netzwerk und Betrieb.",
    beispielTechnologien: "AWS, Azure, GCP, Kubernetes, Docker, Terraform, CloudFormation, Ansible",
  },
  {
    id: "data",
    name: "Data & Analytics",
    beschreibung: "Datenbanken, Data Warehousing, BI-Tools, ETL/ELT-Prozesse und Datenanalyse.",
    beispielTechnologien: "SQL, PostgreSQL, MongoDB, Snowflake, dbt, Power BI, Tableau, Spark",
  },
  {
    id: "dev",
    name: "Development & Automation",
    beschreibung: "Programmierung, API-Entwicklung, CI/CD, Scripting und Automatisierung.",
    beispielTechnologien: "Python, JavaScript, TypeScript, Java, Go, REST APIs, GraphQL, GitHub Actions",
  },
  {
    id: "ai",
    name: "AI & Machine Learning",
    beschreibung: "LLMs, Machine Learning, Prompt Engineering, AI-Integration in Anwendungen.",
    beispielTechnologien: "Azure OpenAI, ChatGPT, LangChain, TensorFlow, PyTorch, Hugging Face",
  },
  {
    id: "security",
    name: "Security & Compliance",
    beschreibung: "IT-Sicherheit, Datenschutz, Governance, Audit und Compliance.",
    beispielTechnologien: "Zero Trust, IAM, DSGVO, ISO 27001, SIEM, Penetration Testing",
  },
  {
    id: "business",
    name: "Business Tools & Plattformen",
    beschreibung: "ERP, CRM, Collaboration-Suites und unternehmensweite Plattformen.",
    beispielTechnologien: "SAP S/4HANA, Microsoft Dynamics, Salesforce, Microsoft 365",
  },
  {
    id: "integration",
    name: "Integration & Middleware",
    beschreibung: "System-Integration, Event-Streaming, Message Queues und Middleware.",
    beispielTechnologien: "REST/SOAP APIs, Apache Kafka, RabbitMQ, Azure Service Bus, MuleSoft",
  },
  {
    id: "lowcode",
    name: "Low-Code / No-Code",
    beschreibung: "Visuelle Entwicklungsplattformen, Workflow-Automatisierung ohne klassische Programmierung.",
    beispielTechnologien: "Power Platform (Power Apps, Power Automate), Airtable, OutSystems",
  },
  {
    id: "emerging",
    name: "Emerging Tech",
    beschreibung: "Zukunftstechnologien je nach Branche und Innovationsfokus.",
    beispielTechnologien: "Blockchain, IoT, Edge Computing, Quantum Computing, AR/VR",
  },
  {
    id: "soft",
    name: "Soft Skills & Methodik",
    beschreibung: "Agile Methoden, Architektur-Frameworks, Kommunikation und Zusammenarbeit.",
    beispielTechnologien: "Scrum, Kanban, DevOps-Kultur, TOGAF, Solution Architecture",
  },
];

let SKILL_CATEGORIES = DEFAULT_SKILL_CATEGORIES.map((c) => ({ ...c }));

function setSkillCategories(categories) {
  SKILL_CATEGORIES = (categories || []).map((c) => ({
    id: c.id != null ? String(c.id) : c.slug || c.name,
    name: c.name,
    beschreibung: c.beschreibung || "",
    beispielTechnologien: c.beispielTechnologien || c.beispiel || "",
  }));
}

const SKILL_LEVELS = [
  {
    level: 1,
    bezeichnung: "Grundkenntnisse",
    definition: "Hat theoretisches Wissen oder erste Beruehrungspunkte. Kann mit Anleitung einfache Aufgaben ausfuehren.",
    typischeAufgaben: "Grundlegende Konzepte verstehen, einfache Tutorials nachvollziehen, unter Anleitung mitarbeiten.",
  },
  {
    level: 2,
    bezeichnung: "Basiskompetenz",
    definition: "Kann eigenstaendig einfache bis mittlere Aufgaben loesen. Braucht bei komplexen Themen noch Unterstuetzung.",
    typischeAufgaben: "Standard-Setups durchfuehren, dokumentierte Prozesse anwenden, Routine-Aufgaben selbststaendig erledigen.",
  },
  {
    level: 3,
    bezeichnung: "Fortgeschritten",
    definition: "Arbeitet produktiv und selbststaendig. Kann komplexe Probleme in bekannten Kontexten loesen.",
    typischeAufgaben: "Architektur-Entscheidungen im eigenen Bereich treffen, komplexe Implementierungen umsetzen, andere unterstuetzen.",
  },
  {
    level: 4,
    bezeichnung: "Experte",
    definition: "Tiefes Fachwissen und langjaehrige Praxis-Erfahrung. Kann andere Mitarbeiter anleiten und Standards setzen.",
    typischeAufgaben: "Komplexe Systeme designen, Architektur-Reviews, Mentoring, technische Fuehrung.",
  },
  {
    level: 5,
    bezeichnung: "Thought Leader",
    definition: "Branchenweite Expertise. Praegt Best Practices und Standards in der Organisation oder Branche.",
    typischeAufgaben: "Strategische Technologie-Roadmaps entwickeln, externe Vortraege, Innovationsprojekte leiten.",
  },
];

const SKILL_EXAMPLES = [
  {
    mitarbeiterId: "MA001",
    nachname: "Mueller",
    vorname: "Thomas",
    rolle: "DevOps Engineer",
    workstream: "Skills & Mindset",
    skills: [
      {
        kategorie: "Cloud & Infrastructure",
        technologie: "AWS, Terraform, Kubernetes",
        level: 4,
        bemerkungen: "Schwerpunkt IaC",
      },
    ],
  },
  {
    mitarbeiterId: "MA002",
    nachname: "Schmidt",
    vorname: "Sarah",
    rolle: "Data Engineer",
    workstream: "Skills & Mindset",
    skills: [
      {
        kategorie: "Data & Analytics",
        technologie: "Python, SQL, Snowflake, dbt",
        level: 3,
        bemerkungen: "Interesse an ML-Integration",
      },
    ],
  },
  {
    mitarbeiterId: "MA003",
    nachname: "Weber",
    vorname: "Michael",
    rolle: "Solution Architect",
    workstream: "Skills & Mindset",
    skills: [
      {
        kategorie: "AI & Machine Learning",
        technologie: "Azure OpenAI, Prompt Engineering, LangChain",
        level: 2,
        bemerkungen: "Noch in Lernphase",
      },
    ],
  },
];

function getCategoryByName(name) {
  return SKILL_CATEGORIES.find((c) => c.name === name) || null;
}

function getCategoryById(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  return SKILL_CATEGORIES.find((c) => Number(c.id) === n) || null;
}

function getLevelDef(level) {
  const n = parseInt(level, 10);
  return SKILL_LEVELS.find((l) => l.level === n) || null;
}

function formatLevel(level) {
  const def = getLevelDef(level);
  return def ? `${def.level} – ${def.bezeichnung}` : String(level || "–");
}

function parseLevelFromLabel(label) {
  if (!label) return null;
  const m = String(label).match(/^(\d)/);
  return m ? parseInt(m[1], 10) : null;
}

function isKnownCategory(name) {
  return !!getCategoryByName(name);
}

function isKnownCategoryId(id) {
  return !!getCategoryById(id);
}

function isKnownLevel(level) {
  return !!getLevelDef(level);
}

function resolveCategorySelect(kategorie, kategorieId) {
  const id = Number(kategorieId);
  if (Number.isInteger(id) && id > 0 && isKnownCategoryId(id)) {
    return { value: String(id), other: "" };
  }
  if (!kategorie) return { value: "", other: "" };
  const byName = getCategoryByName(kategorie);
  if (byName) return { value: String(byName.id), other: "" };
  return { value: SELECT_SONSTIGES, other: kategorie };
}

function resolveLevelSelect(level, levelCustom) {
  if (level != null && level !== "" && isKnownLevel(level)) {
    return { value: String(level), other: "" };
  }
  if (levelCustom) return { value: SELECT_SONSTIGES, other: levelCustom };
  return { value: "", other: "" };
}

function buildCategoryOptions(selected, selectedId) {
  const resolved = resolveCategorySelect(selected, selectedId);
  let html = '<option value="">– Kategorie waehlen –</option>';
  SKILL_CATEGORIES.forEach((c) => {
    const id = Number(c.id);
    if (!Number.isInteger(id) || id <= 0) return;
    const sel = String(id) === String(resolved.value) ? " selected" : "";
    html += `<option value="${id}"${sel}>${c.name.replace(/"/g, "&quot;")}</option>`;
  });
  const osel = resolved.value === SELECT_SONSTIGES ? " selected" : "";
  html += `<option value="${SELECT_SONSTIGES}"${osel}>Sonstiges (manuelle Eingabe)</option>`;
  return html;
}

function buildLevelOptions(selected, levelCustom) {
  const resolved = resolveLevelSelect(selected, levelCustom);
  let html = '<option value="">– Level waehlen –</option>';
  SKILL_LEVELS.forEach((l) => {
    const val = String(l.level);
    const sel = resolved.value === val ? " selected" : "";
    html += `<option value="${val}"${sel}>${l.level} – ${l.bezeichnung}</option>`;
  });
  const osel = resolved.value === SELECT_SONSTIGES ? " selected" : "";
  html += `<option value="${SELECT_SONSTIGES}"${osel}>Sonstiges (manuelle Eingabe)</option>`;
  return html;
}

function buildSimpleOptions(values, selected, labels) {
  let html = '<option value="">–</option>';
  values.forEach((v, i) => {
    const label = labels ? labels[i] : v;
    const sel = v === selected ? " selected" : "";
    html += `<option value="${v.replace(/"/g, "&quot;")}"${sel}>${label}</option>`;
  });
  const isKnown = values.includes(selected);
  const osel = selected && !isKnown ? " selected" : selected === SELECT_SONSTIGES ? " selected" : "";
  html += `<option value="${SELECT_SONSTIGES}"${osel}>Sonstiges (manuelle Eingabe)</option>`;
  return html;
}

function resolveSimpleSelect(value, knownValues) {
  if (!value) return { value: "", other: "" };
  if (knownValues.includes(value)) return { value, other: "" };
  return { value: SELECT_SONSTIGES, other: value };
}
