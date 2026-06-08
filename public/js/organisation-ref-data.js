// Vordefinierte technologische Bereiche und Rollen fuer Register Organisation

const ORG_TECH_BEREICHE = [
  "Cloud & Infrastructure",
  "Data & Analytics",
  "SAP / ERP",
  "Integration & APIs",
  "AI & Machine Learning",
  "Security & Compliance",
  "Development & Automation",
  "Low-Code / No-Code",
  "Microsoft 365 / Collaboration",
  "Emerging Tech",
];

/** Rollen in der Unit (Organisation – Rollen in der Unit) */
const DEFAULT_ORG_ROLLEN = [
  "Partner Manager",
  "Alliance Manager",
  "Trainer / Coach",
  "Solution Architect",
  "Delivery Manager",
  "Projektmanager",
  "Sales Manager",
  "Consultant / Berater",
  "Developer / Engineer",
  "Product Owner",
  "Scrum Master",
  "HR / People & Culture",
  "Marketing",
  "Operations / PMO",
];

/** Positionen (Skill-Matrix – Rolle / Position je Mitarbeiter) */
const DEFAULT_APP_POSITIONS = [
  "Geschäftsführer",
  "Regional Leiter",
  "Unit Leiter",
  "Mitarbeiter",
  "CC Leiter",
];

let ORG_ROLLEN = [...DEFAULT_ORG_ROLLEN];
let APP_POSITIONS = [...DEFAULT_APP_POSITIONS];

function buildOrgSelectOptions(knownValues, selected) {
  return buildSimpleOptions(knownValues, selected);
}

function resolveOrgSelect(value, knownValues) {
  return resolveSimpleSelect(value, knownValues);
}
