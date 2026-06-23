/* Gemeinsame Felder/Utilities für IST (Phase 1) ↔ SOLL (Phase 2) Vergleich */

const HARM_SKILL_CATEGORY_NAMES = [
  "Cloud & Infrastructure",
  "Data & Analytics",
  "Development & Automation",
  "AI & Machine Learning",
  "Security & Compliance",
  "Business Tools & Plattformen",
  "Integration & Middleware",
  "Low-Code / No-Code",
  "Emerging Tech",
  "Soft Skills & Methodik",
];

const AMPEL_SCORE_MAP = { red: 1, blue: 2, orange: 3, green: 4 };

function ampelToScore(ampel) {
  if (!ampel) return null;
  const n = AMPEL_SCORE_MAP[String(ampel).toLowerCase()];
  return Number.isFinite(n) ? n : null;
}

function scoreToAmpel(score) {
  const n = parseInt(score, 10);
  if (n === 1) return "red";
  if (n === 2) return "blue";
  if (n === 3) return "orange";
  if (n === 4) return "green";
  return "";
}

/** Parst Freitext-Umsatz → EUR (z. B. „1,2 Mio. EUR“ → 1200000) */
function parseUmsatzTextToEur(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  let s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/€|eur/g, "");
  let mult = 1;
  if (/mio|million|mill\.?/.test(s)) {
    mult = 1e6;
    s = s.replace(/(mio\.?|million|mill\.?)/g, "");
  } else if (/mrd|milliard/.test(s)) {
    mult = 1e9;
    s = s.replace(/(mrd\.?|milliard)/g, "");
  } else if (/tsd|tausend|teur/.test(s)) {
    mult = 1e3;
    s = s.replace(/(tsd\.?|tausend|teur)/g, "");
  } else if (/k$/.test(s)) {
    mult = 1e3;
    s = s.replace(/k$/, "");
  }
  const numMatch = s.match(/[\d.,]+/);
  if (!numMatch) return null;
  let numStr = numMatch[0];
  if (numStr.includes(",") && numStr.includes(".")) {
    if (numStr.lastIndexOf(",") > numStr.lastIndexOf(".")) {
      numStr = numStr.replace(/\./g, "").replace(",", ".");
    } else {
      numStr = numStr.replace(/,/g, "");
    }
  } else if (numStr.includes(",")) {
    const parts = numStr.split(",");
    if (parts[1]?.length === 3 && parts[0].length <= 3) {
      numStr = parts.join("");
    } else {
      numStr = numStr.replace(",", ".");
    }
  }
  const n = parseFloat(numStr);
  if (!Number.isFinite(n) || n < 0) return null;
  return n * mult;
}

function eurToTeur(eur) {
  if (eur == null || !Number.isFinite(eur)) return null;
  return Math.round((eur / 1000) * 10) / 10;
}

function teurToEur(teur) {
  if (teur == null || !Number.isFinite(teur)) return null;
  return teur * 1000;
}

function parseUmsatzToTeur(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const eur = parseUmsatzTextToEur(raw);
  return eur != null ? eurToTeur(eur) : null;
}

function formatUmsatzTeur(teur) {
  if (teur == null || !Number.isFinite(teur)) return "–";
  const n = Number(teur);
  if (n >= 1000) {
    return `${(n / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mio. EUR`;
  }
  return `${n.toLocaleString("de-DE", { maximumFractionDigits: 0 })} TEUR`;
}

function readTeurInputValue(el) {
  if (!el) return null;
  const raw = String(el.value ?? "").trim();
  if (!raw) return null;
  const n = parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function enrichPortfolioUmsatz(entry) {
  const out = { ...entry };
  let teur = out.jahresumsatz_teur;
  if (teur != null && teur !== "") {
    teur = parseFloat(teur);
    if (!Number.isFinite(teur)) teur = null;
  } else {
    teur = null;
  }
  if (teur == null && out.jahresumsatz) {
    teur = parseUmsatzToTeur(out.jahresumsatz);
  }
  out.jahresumsatz_teur = teur;
  if (teur != null && !out.jahresumsatz) {
    out.jahresumsatz = formatUmsatzTeur(teur);
  }
  if (out.ampel) out.ampel_score = ampelToScore(out.ampel);
  return out;
}

function enrichOrgGliederungUmsatz(row) {
  const out = { ...row };
  let teur = out.umsatz_teur;
  if (teur != null && teur !== "") {
    teur = parseFloat(teur);
    if (!Number.isFinite(teur)) teur = null;
  } else {
    teur = null;
  }
  if (teur == null && out.umsatz) {
    teur = parseUmsatzToTeur(out.umsatz);
  }
  out.umsatz_teur = teur;
  if (teur != null && !out.umsatz) {
    out.umsatz = formatUmsatzTeur(teur);
  }
  return out;
}

function buildHarmSkillCategoryOptions(selected) {
  let html = '<option value="">– Kategorie –</option>';
  HARM_SKILL_CATEGORY_NAMES.forEach((name) => {
    const sel = name === selected ? " selected" : "";
    html += `<option value="${name.replace(/"/g, "&quot;")}"${sel}>${name}</option>`;
  });
  return html;
}

function parseOptionalInt(val) {
  if (val == null || val === "") return null;
  const n = parseInt(String(val), 10);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalFloat(val) {
  if (val == null || val === "") return null;
  const n = parseFloat(String(val).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
