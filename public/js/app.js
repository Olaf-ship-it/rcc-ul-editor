// ===== CATEGORIES =====
const KATEGORIE_ALIASES = {
  "Ergebnisse / Artefakte": "Produkte / Services / Lösungen",
  "Messbare KPIs / Markterfolg": "Verteilung / Anteile / KPIs",
};
function displayKategorie(k) {
  return KATEGORIE_ALIASES[k] || k;
}

const CATS = [
  {k:"Produkte / Services / Lösungen", q:"Welche Produkte, Services, Loesungen, Strukturen oder Programme existieren bereits?",
   info:"Erfassen Sie alle bestehenden Produkte, Services, Tools, Prozesse und Programme. Auch Teilresultate und Piloten zaehlen.",
   ex_pm:"SAP S/4HANA Retail (CAR, POSDM) ist Kernprodukt. AMS-Managed-Services fuer 15+ Retailkunden aktiv. Erste KI-PoCs (AMS Copilot) in Pilotphase.",
   ex_sm:"SAP BTP Einfuehrungskurse fuer 2 Teams durchgefuehrt. Lernplattform in Pilotphase (50 TN). Change Story v1 kommuniziert.",
   ex_or:"KI Integration Hub in Gruendungsphase (2 MA). Open Source Guild: Charter v1 verabschiedet. CoP Retail monatlich, 15 TN.",
   ex_pe:"SAP Diamant-Partnerschaft Retail aktiv. Microsoft Gold-Partnerschaft aktiv. Co-Sell Draft mit SAP unterzeichnet."},
  {k:"Verteilung / Anteile / KPIs", q:"Welche Verteilungen, Anteile und messbaren Kennzahlen liegen aktuell vor?",
   info:"Nennen Sie konkrete Zahlen und Anteile: Umsatzverteilung, Conversion Rates, Nutzerzahlen, Pipeline-Werte, NPS etc.",
   ex_pm:"70% Umsatz aus klassischen SAP-Projekten. 25% aus AMS. 2 aktive KI-Piloten, Pipeline 200T EUR.",
   ex_sm:"150 MA mit mind. 1 Training. Lernzeit 2h/Monat (Ziel: 4h). Employee NPS: +32.",
   ex_or:"6 offene Rollen (2 kritisch). 70% Projekte Cross-Unit. RACI-Abdeckung ~50%.",
   ex_pe:"2 strategische Partnergespraeche/Quartal. 0 Co-Sell-Deals. 0 Marketplace Listings."},
  {k:"Voraussetzungen / Ressourcen", q:"Welche organisatorischen, technischen oder finanziellen Voraussetzungen bestehen?",
   info:"Budget, Personal, Tools, Infrastruktur, Lizenzen – alles was als Grundlage vorhanden ist oder fehlt.",
   ex_pm:"SAP Diamant-Partner Retail (einziger DACH). MS Gold-Partner. Product Owner benannt. Budget in Pruefung.",
   ex_sm:"Trainingsbudget 80T EUR genehmigt. 2 externe Trainer. Zeitfreigabe nur in 3/8 Teams. Kein Learning Manager.",
   ex_or:"Rollenprofile 80% definiert. Collaboration-Tools aktiv. Budget fuer Hub in GF-Diskussion.",
   ex_pe:"Partnervertraege aktiv. 1 Alliance Manager (50%). Marketing-Material in Erstellung."},
  {k:"Abhaengigkeiten (intern / extern)", q:"Von welchen anderen Bereichen, Teams oder externen Partnern haengt der Fortschritt ab?",
   info:"Identifizieren Sie Abhaengigkeiten zu anderen Units, Workstreams, externen Partnern, Freigaben etc.",
   ex_pm:"Skills: API-/KI-Expertise fehlt teilweise. Org: Product-Team nicht vollstaendig. Partner: SAP Co-Sell ausstehend.",
   ex_sm:"Org: Rollenbeschreibungen nicht aktualisiert. HR: Karrierepfade nicht mit Skills verknuepft.",
   ex_or:"Skills: KI-Integratoren fehlen. Portfolio: Pilotprojekte als Praxis. HR: Recruiting-Kapazitaet begrenzt.",
   ex_pe:"Portfolio: Module muessen marktreif sein. Org: Alliance-Rolle muss Vollzeit werden."},
  {k:"Risiken / Blocker", q:"Welche konkreten Hindernisse oder Verzoegerungen bestehen aktuell?",
   info:"Benennen Sie konkrete Risiken, Blocker, Verzoegerungen – intern wie extern.",
   ex_pm:"Kein standardisiertes Pricing fuer KI-Module. Legal-Prozess >6 Wochen. Konkurrenz durch SAP-eigene KI-Features.",
   ex_sm:"Hohe Delivery-Auslastung (>90%) verhindert Lernzeit. KI-Skepsis bei erfahrenen Beratern.",
   ex_or:"Silodenken zwischen Delivery und Innovation. Widerstand mittleres Management.",
   ex_pe:"SAP Partner-Team wechselt Ansprechpartner haeufig. Kein lokaler Referenzcase."},
  {k:"Verantwortliche / Team", q:"Wer treibt das Thema aktuell? Welche Rollen sind beteiligt?",
   info:"Nennen Sie Rollen und ggf. Namen der Verantwortlichen. Identifizieren Sie fehlende Rollen.",
   ex_pm:"Portfolio Lead KI, Sales Lead Retail, Product Owner AMS Copilot, CTO als Sponsor.",
   ex_sm:"People & Culture Lead, Change Coach (extern), HR Director als Sponsor, 12 Teamleads als Mentoren.",
   ex_or:"COO: Hub-Setup. CTO: Governance. HR: Recruiting. Transformation PMO (0,5 FTE).",
   ex_pe:"Alliance Manager (50%), Sales Lead Retail, Marketing Lead, COO: Sign-off."},
  {k:"Staerken / Best Practices", q:"Was laeuft besonders gut? Was koennen andere Bereiche uebernehmen?",
   info:"Heben Sie hervor, was funktioniert – als Basis fuer Skalierung und Wissenstransfer.",
   ex_pm:"Einziger SAP Diamant-Partner Retail DACH. Tiefe Branchenexpertise. AMS-Delivery als Vertrauensbasis.",
   ex_sm:"Hohe Lernbereitschaft bei Junioren. SAP-Expertise auf hohem Niveau. Peer-Learning gut angenommen.",
   ex_or:"Flache Hierarchien, kurze Entscheidungswege. CoP Retail als funktionierendes Format.",
   ex_pe:"Diamant-Status oeffnet Tueren. Persoenliche SAP-Kontakte. Langjahrige Branchenreputation."},
  {k:"Handlungsfelder (0-6 Monate)", q:"Welche konkreten naechsten Schritte sind aus Ihrer Sicht notwendig?",
   info:"Definieren Sie 3-5 konkrete Massnahmen fuer die naechsten 6 Monate mit klarer Prioritaet.",
   ex_pm:"AMS Copilot Pilot finalisieren. Pricing Blueprint erstellen. SAP Co-Sell Antrag einreichen. 3 Pilotkunden ansprechen.",
   ex_sm:"Learning Manager einstellen. Zeitfreigabe durchsetzen. Badge-System pilotieren. KI-Basics als Pflichttraining.",
   ex_or:"KI-Manager einstellen (Prio 1). Hub-Budget freigeben. RACI erstellen. Guild Output steigern.",
   ex_pe:"Alliance Manager auf 100%. SAP Co-Sell Meeting organisieren. Referenzcase dokumentieren. Marketplace Listing."}
];

const WS_KEYS = ["Portfolio & Markt", "Skills & Mindset", "Organisation & Rollen", "Partner & Ecosystem"];
const WS_ICONS = {"Portfolio & Markt":"📊","Skills & Mindset":"🧠","Organisation & Rollen":"🏗️","Partner & Ecosystem":"🤝"};
const EX_KEYS = {
  "Portfolio & Markt":"ex_pm","Skills & Mindset":"ex_sm",
  "Organisation & Rollen":"ex_or","Partner & Ecosystem":"ex_pe"
};

// ===== SESSION + API =====
let currentUnit = "";
let currentName = "";
let currentEmail = "";
let isAdmin = false;
let isSuperAdmin = false;
let superAdminViewUnit = "all";
let masterUnitsCache = [];
let entryStore = { status: [], team: [], skill: [] };

function today(){return new Date().toISOString().slice(0,10)}
function toast(m,c,ms){const t=document.getElementById('toast');if(!t)return;t.textContent=m;t.style.background=c||'#27ae60';t.classList.add('show');clearTimeout(t._toastTimer);t._toastTimer=setTimeout(()=>t.classList.remove('show'),ms||2500)}

function isElementVisible(el) {
  if (!el) return false;
  let node = el;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
    node = node.parentElement;
  }
  return true;
}

function cleanFieldLabel(text) {
  return String(text || "")
    .replace(/\s*\*?\s*$/, "")
    .trim();
}

function getFieldLabel(el) {
  if (!el) return "Pflichtfeld";
  if (el.id) {
    const lab = document.querySelector(`label[for="${el.id}"]`);
    if (lab) return cleanFieldLabel(lab.textContent);
  }
  if (el.previousElementSibling?.tagName === "LABEL") {
    return cleanFieldLabel(el.previousElementSibling.textContent);
  }
  const parentLab = el.parentElement?.querySelector("label");
  if (parentLab) return cleanFieldLabel(parentLab.textContent);
  return el.placeholder || "Pflichtfeld";
}

function isRequiredFieldEmpty(el) {
  if (!el || el.disabled) return false;
  if (el.type === "checkbox" || el.type === "radio") return !el.checked;
  if (el.tagName === "SELECT") return !String(el.value).trim();
  if (el.type === "number") return el.value === "" || el.value === null;
  return !String(el.value).trim();
}

function clearFormFieldErrors(form) {
  (form || document).querySelectorAll(".field-invalid").forEach((el) => el.classList.remove("field-invalid"));
}

function reportFieldError(el, message) {
  if (el?.form) clearFormFieldErrors(el.form);
  else clearFormFieldErrors();
  if (el) {
    el.classList.add("field-invalid");
    el.focus({ preventScroll: false });
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  toast(message || `Bitte „${getFieldLabel(el)}“ ausfüllen.`, "#e74c3c", 4000);
  return false;
}

function validateFormRequired(form) {
  if (!form) return true;
  for (const el of form.querySelectorAll("[required]")) {
    if (!isElementVisible(el)) continue;
    if (isRequiredFieldEmpty(el)) {
      return reportFieldError(el, `Bitte „${getFieldLabel(el)}“ ausfüllen.`);
    }
  }
  clearFormFieldErrors(form);
  return true;
}

function isAssessmentRowEmpty(row, prefix) {
  if (prefix === "sk") {
    const kategorie = readSelectWithOther(row, ".sk-kategorie", ".sk-kategorie-other");
    const technologie = row.querySelector(".sk-technologie")?.value.trim() || "";
    const levelSel = row.querySelector(".sk-level")?.value || "";
    const levelOther = row.querySelector(".sk-level-other")?.value.trim() || "";
    return !kategorie && !technologie && !levelSel && !levelOther;
  }
  const kategorie = readSelectWithOther(row, ".ss-kategorie", ".ss-kategorie-other");
  const kompetenz = row.querySelector(".ss-kompetenz")?.value.trim() || "";
  const levelSel = row.querySelector(".ss-level")?.value || "";
  const levelOther = row.querySelector(".ss-level-other")?.value.trim() || "";
  return !kategorie && !kompetenz && !levelSel && !levelOther;
}

function focusSelectOrOther(row, selectClass, otherClass) {
  const sel = row.querySelector(selectClass);
  if (!sel) return null;
  if (sel.value === SELECT_SONSTIGES) {
    const other = row.querySelector(otherClass);
    if (other && isElementVisible(other)) return other;
  }
  return sel;
}

function isSelectOrOtherEmpty(row, selectClass, otherClass) {
  const sel = row.querySelector(selectClass);
  if (!sel || !String(sel.value).trim()) return true;
  if (sel.value === SELECT_SONSTIGES) {
    return !String(row.querySelector(otherClass)?.value || "").trim();
  }
  return false;
}

function isLevelFieldEmpty(row, levelClass, levelOtherClass) {
  const sel = row.querySelector(levelClass);
  if (!sel) return true;
  const levelSel = sel.value;
  const levelOther = row.querySelector(levelOtherClass)?.value.trim() || "";
  if (!levelSel && !levelOther) return true;
  if (levelSel === SELECT_SONSTIGES && !levelOther) return true;
  return false;
}

function validateTechSkillRowsDOM() {
  const rows = document.querySelectorAll("#sk_assessment_rows .skill-assessment-row");
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (isAssessmentRowEmpty(row, "sk")) continue;
    setSkillKind("tech");
    const suffix = rows.length > 1 ? ` (Fachskill-Zeile ${i + 1})` : "";
    if (isSelectOrOtherEmpty(row, ".sk-kategorie", ".sk-kategorie-other")) {
      return reportFieldError(
        focusSelectOrOther(row, ".sk-kategorie", ".sk-kategorie-other"),
        `Bitte „${getFieldLabel(row.querySelector(".sk-kategorie"))}“${suffix} ausfüllen.`
      );
    }
    if (!row.querySelector(".sk-technologie")?.value.trim()) {
      return reportFieldError(
        row.querySelector(".sk-technologie"),
        `Bitte „${getFieldLabel(row.querySelector(".sk-technologie"))}“${suffix} ausfüllen.`
      );
    }
    if (isLevelFieldEmpty(row, ".sk-level", ".sk-level-other")) {
      const el = focusSelectOrOther(row, ".sk-level", ".sk-level-other");
      return reportFieldError(el, `Bitte „Level“${suffix} ausfüllen (Liste oder Sonstiges).`);
    }
  }
  return true;
}

function validateSoftSkillRowsDOM() {
  const rows = document.querySelectorAll("#ss_assessment_rows .skill-assessment-row");
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (isAssessmentRowEmpty(row, "ss")) continue;
    setSkillKind("soft");
    const suffix = rows.length > 1 ? ` (Soft-Skill-Zeile ${i + 1})` : "";
    if (isSelectOrOtherEmpty(row, ".ss-kategorie", ".ss-kategorie-other")) {
      return reportFieldError(
        focusSelectOrOther(row, ".ss-kategorie", ".ss-kategorie-other"),
        `Bitte „${getFieldLabel(row.querySelector(".ss-kategorie"))}“${suffix} ausfüllen.`
      );
    }
    if (!row.querySelector(".ss-kompetenz")?.value.trim()) {
      return reportFieldError(
        row.querySelector(".ss-kompetenz"),
        `Bitte „${getFieldLabel(row.querySelector(".ss-kompetenz"))}“${suffix} ausfüllen.`
      );
    }
    if (isLevelFieldEmpty(row, ".ss-level", ".ss-level-other")) {
      const el = focusSelectOrOther(row, ".ss-level", ".ss-level-other");
      return reportFieldError(el, `Bitte „Level“${suffix} ausfüllen (Liste oder Sonstiges).`);
    }
  }
  return true;
}

function validateSkillEmployeeFields() {
  const fields = [
    document.getElementById("sk_nachname"),
    document.getElementById("sk_vorname"),
    document.getElementById("sk_rolle"),
  ];
  for (const el of fields) {
    if (isRequiredFieldEmpty(el)) {
      return reportFieldError(el, `Bitte „${getFieldLabel(el)}“ ausfüllen.`);
    }
  }
  clearFormFieldErrors(document.getElementById("skillForm"));
  return true;
}

function validateSkillFormFields() {
  if (!validateSkillEmployeeFields()) return false;
  if (!validateTechSkillRowsDOM()) return false;
  if (!validateSoftSkillRowsDOM()) return false;
  return true;
}

document.addEventListener("input", (e) => {
  if (e.target.classList?.contains("field-invalid")) e.target.classList.remove("field-invalid");
});
document.addEventListener("change", (e) => {
  if (e.target.classList?.contains("field-invalid")) e.target.classList.remove("field-invalid");
});
function ampelEmoji(v){
  if(v==='green')return'🟩';
  if(v==='orange')return'🟧';
  if(v==='blue')return'🟦';
  if(v==='red')return'🟥';
  return'–';
}
function ampelHTML(v){
  if(v==='green')return'<span class="ampel ampel-green" title="Etabliert"></span>';
  if(v==='orange')return'<span class="ampel ampel-orange" title="Teilweise"></span>';
  if(v==='blue')return'<span class="ampel ampel-blue" title="In Planung"></span>';
  if(v==='red')return'<span class="ampel ampel-red" title="Kritisch"></span>';
  return'–';
}
function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML}

async function api(url, opts = {}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    let msg = "Anfrage fehlgeschlagen.";
    try { msg = (await res.json()).error || msg; } catch (_e) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

function load(type) {
  const all = entryStore[type] || [];
  if (!isSuperAdmin) return all;
  if (superAdminViewUnit === "all") return all;
  return all.filter((e) => e.unit === superAdminViewUnit);
}

function getViewUnitLabel() {
  if (isSuperAdmin && superAdminViewUnit === "all") return "Alle Units";
  if (isSuperAdmin && superAdminViewUnit !== "all") return superAdminViewUnit;
  return currentUnit;
}

function getSaveUnit() {
  if (isSuperAdmin) {
    if (superAdminViewUnit === "all") return "";
    return superAdminViewUnit;
  }
  return currentUnit;
}

function getExportUnitSlug() {
  return getViewUnitLabel().replace(/\W/g, "_");
}

function isSuperAdminViewAll() {
  return isSuperAdmin && superAdminViewUnit === "all";
}

function userMatchesSuperAdminView(u) {
  if (!isSuperAdmin || superAdminViewUnit === "all") return true;
  if (Array.isArray(u.units) && u.units.includes(superAdminViewUnit)) return true;
  return false;
}

function updateHeaderUnitDisplay() {
  const label = getViewUnitLabel();
  const badge = document.getElementById("headerUnit");
  const ovLabel = document.getElementById("ovUnitLabel");
  if (badge) badge.textContent = label;
  if (ovLabel) ovLabel.textContent = label;
}

function updateSuperAdminFormMode() {
  const block = isSuperAdminViewAll();
  const hint = document.getElementById("superAdminViewHint");
  if (hint) hint.style.display = block ? "" : "none";
  document
    .querySelectorAll(
      "#statusForm button[type=submit], #teamForm button[type=submit], #skillForm button[type=submit], #btnSkillExamplesLoad"
    )
    .forEach((btn) => {
      btn.disabled = block;
      btn.title = block ? "Bitte zuerst eine Unit oben auswählen" : "";
    });
}

async function renderHeaderUnitSwitcher() {
  const bar = document.getElementById("headerUnitSwitcher");
  const tabs = document.getElementById("headerUnitTabs");
  if (!bar || !tabs) return;
  if (!isSuperAdmin) {
    bar.style.display = "none";
    return;
  }
  await loadMasterUnitsCache();
  const units = masterUnitsCache.map((u) => u.name);
  bar.style.display = "flex";
  const items = [{ id: "all", label: "Alle Units" }, ...units.map((name) => ({ id: name, label: name }))];
  tabs.innerHTML = items
    .map(
      (item) =>
        `<button type="button" class="header-unit-tab${superAdminViewUnit === item.id ? " active" : ""}" data-unit="${esc(item.id)}" role="tab" aria-selected="${superAdminViewUnit === item.id}">${esc(item.label)}</button>`
    )
    .join("");
  tabs.querySelectorAll("[data-unit]").forEach((btn) => {
    btn.addEventListener("click", () => setSuperAdminViewUnit(btn.getAttribute("data-unit")));
  });
}

function refreshSuperAdminViews() {
  updateHeaderUnitDisplay();
  updateSuperAdminFormMode();
  renderNavStatus();
  renderNavTeam();
  renderSkillEmployeeNav();
  updateSkillDeleteButton();
  renderOverview();
  renderExportStats();
  if (isAdmin) renderAdminUsers();
}

function setSuperAdminViewUnit(unit) {
  superAdminViewUnit = unit || "all";
  renderHeaderUnitSwitcher();
  refreshSuperAdminViews();
}

function requireSaveUnit() {
  const unit = getSaveUnit();
  if (!unit) {
    toast("Bitte oben eine Unit auswählen, um Daten zu erfassen.", "#e74c3c", 4000);
    return false;
  }
  return true;
}

async function refreshEntries() {
  const all = await api("/api/entries");
  entryStore = { status: [], team: [], skill: [] };
  all.forEach((e) => {
    if (entryStore[e.type]) entryStore[e.type].push(e);
  });
  renderSkillEmployeeNav();
}

async function saveEntry(type, entry) {
  const payload = {
    ...entry,
    type,
    unit: String(entry.unit || getSaveUnit() || "").trim(),
  };
  if (!payload.unit) {
    throw new Error("Unit fehlt – bitte erneut anmelden.");
  }
  if (type !== "skill" && !String(payload.workstream || "").trim()) {
    throw new Error("Workstream fehlt.");
  }
  if (payload.id) {
    await api(`/api/entries/${payload.id}`, {
      method: "PUT",
      body: JSON.stringify({ entry: payload }),
    });
    return payload.id;
  }
  const result = await api("/api/entries", {
    method: "POST",
    body: JSON.stringify({ type, entry: payload }),
  });
  if (!result?.id) {
    throw new Error("Speichern fehlgeschlagen – keine ID vom Server erhalten.");
  }
  return result.id;
}

function isAdminSession(role) {
  return role === "admin" || role === "super_admin";
}

function isUnitScopedSession(role) {
  return role === "unit_lead" || role === "mitarbeiter";
}

function roleLabel(role) {
  const labels = {
    super_admin: "Super Admin",
    admin: "Admin",
    unit_lead: "Unit Lead",
    mitarbeiter: "Mitarbeiter",
  };
  return labels[role] || role;
}

function updateAdminUnitsFieldVisibility() {
  const role = document.getElementById("adm_role")?.value || "unit_lead";
  const needsUnits = isUnitScopedSession(role);
  const label = document.getElementById("adm_units_label");
  const hint = document.getElementById("adm_units_hint");
  const box = document.getElementById("adm_units_select");
  if (label) label.style.display = needsUnits ? "" : "none";
  if (hint) hint.style.display = needsUnits ? "" : "none";
  if (box) box.style.display = needsUnits ? "" : "none";
}

function renderAdminUnitCheckboxes(containerId, selected) {
  const box = document.getElementById(containerId);
  if (!box) return;
  const picked = new Set(selected || []);
  if (!masterUnitsCache.length) {
    box.innerHTML = '<p class="unit-checkbox-empty">Noch keine Units angelegt. Super Admin muss zuerst Units anlegen.</p>';
    return;
  }
  box.innerHTML = masterUnitsCache
    .map(
      (u) =>
        `<label class="unit-checkbox-item"><input type="checkbox" value="${escAttr(u.name)}"${
          picked.has(u.name) ? " checked" : ""
        }> ${esc(u.name)}</label>`
    )
    .join("");
}

function getSelectedAdminUnits(containerId) {
  const box = document.getElementById(containerId);
  if (!box) return [];
  return [...box.querySelectorAll('input[type="checkbox"]:checked')].map((el) => el.value);
}

async function loadMasterUnitsCache() {
  try {
    if (isAdmin) {
      masterUnitsCache = await api("/api/admin/units");
    } else {
      const res = await fetch("/api/auth/units");
      const data = await res.json();
      masterUnitsCache = (data.units || []).map((name) => ({ id: null, name }));
    }
  } catch (_e) {
    masterUnitsCache = [];
  }
  renderAdminUnitCheckboxes("adm_units_select", []);
}

function pickUnitsFromMaster(preselected) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("admUnitPicker");
    if (!overlay) {
      resolve(preselected || []);
      return;
    }
    renderAdminUnitCheckboxes("admUnitPickerList", preselected || []);
    overlay.style.display = "flex";
    const okBtn = document.getElementById("admUnitPickerOk");
    const cancelBtn = document.getElementById("admUnitPickerCancel");
    const finish = (value) => {
      overlay.style.display = "none";
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      resolve(value);
    };
    const onOk = () => finish(getSelectedAdminUnits("admUnitPickerList"));
    const onCancel = () => finish(null);
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
  });
}

function populateLoginUnitSelect(units, selected) {
  const sel = document.getElementById("loginUnit");
  if (!sel) return;
  const list = [...new Set((units || []).map((u) => String(u).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "de")
  );
  sel.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  if (!list.length) {
    sel.disabled = true;
    placeholder.textContent = "– Keine Units verfügbar –";
    sel.appendChild(placeholder);
    return;
  }
  sel.disabled = false;
  placeholder.textContent = "– bitte wählen –";
  sel.appendChild(placeholder);
  list.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u;
    opt.textContent = u;
    sel.appendChild(opt);
  });
  if (selected && list.includes(selected)) sel.value = selected;
  else if (list.length === 1) sel.value = list[0];
}

async function loadPublicLoginUnits() {
  try {
    const res = await fetch("/api/auth/units");
    if (!res.ok) return;
    const data = await res.json();
    populateLoginUnitSelect(data.units || []);
  } catch (_e) {}
}

async function resolveLoginUnits() {
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  const hint = document.getElementById("loginUnitHint");
  if (!email || !password) {
    populateLoginUnitSelect([]);
    if (hint) hint.textContent = "Units werden nach Eingabe der Zugangsdaten geladen.";
    return;
  }
  try {
    const res = await fetch("/api/auth/resolve-units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      populateLoginUnitSelect([]);
      if (hint) hint.textContent = data.error || "Zugangsdaten prüfen.";
      return;
    }
    populateLoginUnitSelect(data.units || []);
    if (hint) {
      hint.textContent =
        data.units.length === 1
          ? "Ihre Unit wurde automatisch ausgewählt."
          : `${data.units.length} Units verfügbar (distinct).`;
    }
  } catch (_e) {
    populateLoginUnitSelect([]);
    if (hint) hint.textContent = "Units konnten nicht geladen werden.";
  }
}

async function doLogin(){
  const email=document.getElementById('loginEmail').value.trim().toLowerCase();
  const password=document.getElementById('loginPassword').value;
  let unit=document.getElementById('loginUnit').value;
  const errEl=document.getElementById('loginError');
  errEl.style.display='none';
  if (email && password && !unit) {
    await resolveLoginUnits();
    unit = document.getElementById("loginUnit").value;
  }
  if(!email||!password||!unit){errEl.textContent='Bitte alle Felder ausfuellen.';errEl.style.display='block';return}
  if (document.getElementById("loginUnit").disabled) {
    await resolveLoginUnits();
    unit = document.getElementById('loginUnit').value;
    if (!unit) {
      errEl.textContent = 'Bitte zuerst gültige Zugangsdaten eingeben und Unit wählen.';
      errEl.style.display = 'block';
      return;
    }
  }
  try {
    const session = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password, unit }) });
    currentUnit = session.unit;
    currentName = session.name;
    currentEmail = session.email;
    isAdmin = isAdminSession(session.role);
    isSuperAdmin = session.role === "super_admin";
    await showApp();
  } catch (error) {
    errEl.textContent = error.message;
    errEl.style.display = "block";
  }
}

async function doLogout(){
  try { await api("/api/auth/logout", { method: "POST" }); } catch (_e) {}
  currentUnit='';currentName='';currentEmail='';isAdmin=false;isSuperAdmin=false;superAdminViewUnit='all';
  entryStore = { status: [], team: [], skill: [] };
  document.getElementById('loginOverlay').style.display='flex';document.getElementById('appHeader').style.display='none';
  document.getElementById('tabs').style.display='none';document.getElementById('appMain').style.display='none';
}

async function showApp(){
  await refreshEntries();
  document.getElementById('loginOverlay').style.display='none';document.getElementById('appHeader').style.display='flex';
  document.getElementById('tabs').style.display='flex';document.getElementById('appMain').style.display='block';
  document.getElementById('headerName').textContent=currentName+' ('+currentEmail+')';
  if (isSuperAdmin) superAdminViewUnit = "all";
  await renderHeaderUnitSwitcher();
  updateHeaderUnitDisplay();
  updateSuperAdminFormMode();
  checkAdmin();renderNavStatus();renderNavTeam();renderSkillEmployeeNav();updateSkillDeleteButton();renderOverview();if(isAdmin){await loadMasterUnitsCache();await renderAdminUsers();if(isSuperAdmin)await renderSuperAdminUnits();}
}

async function bootSession() {
  try {
    const me = await api("/api/auth/me");
    currentUnit = me.unit;
    currentName = me.name;
    currentEmail = me.email;
    isAdmin = isAdminSession(me.role);
    isSuperAdmin = me.role === "super_admin";
    await showApp();
  } catch (_e) {}
}

// ===== TABS =====
document.querySelectorAll('.tab').forEach(t=>{t.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');document.getElementById('page-'+t.dataset.page).classList.add('active');
  if(t.dataset.page==='overview')renderOverview();if(t.dataset.page==='export')renderExportStats();if(t.dataset.page==='admin'){loadMasterUnitsCache().then(()=>{renderAdminUsers();if(isSuperAdmin)renderSuperAdminUnits();});}
  if(t.dataset.page==='skills'){renderSkillEmployeeNav();updateSkillDeleteButton();}
})});

function switchTab(p){document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.page===p));
  document.querySelectorAll('.page').forEach(pg=>pg.classList.toggle('active',pg.id==='page-'+p));}

// ===== NAV PANELS =====
function renderNavStatus(){
  const ws=document.getElementById('s_workstream').value;
  const kat=document.getElementById('s_kategorie').value;
  let h='';
  WS_KEYS.forEach(w=>{const cls=w===ws?'nav-pill ws-active':(ws?'nav-pill dim':'nav-pill');
    h+=`<div class="${cls}" onclick="document.getElementById('s_workstream').value='${w}';document.getElementById('s_workstream').dispatchEvent(new Event('change'))">${WS_ICONS[w]} ${w}</div>`;
  });
  document.getElementById('navWS_status').innerHTML=h;
  let kh='';
  if(ws){CATS.forEach(c=>{const cls=c.k===kat?'nav-pill active':(kat?'nav-pill dim':'nav-pill');
    kh+=`<div class="${cls}" onclick="document.getElementById('s_kategorie').value='${c.k}';document.getElementById('s_kategorie').dispatchEvent(new Event('change'))">${c.k}</div>`;
  })}else{kh='<div style="color:var(--rc-muted);font-size:.75rem;font-style:italic">Erst Workstream waehlen</div>'}
  document.getElementById('navKat_status').innerHTML=kh;
}

function renderNavTeam(){
  const ws=document.getElementById('t_workstream').value;let h='';
  WS_KEYS.forEach(w=>{const cls=w===ws?'nav-pill ws-active':'nav-pill';
    h+=`<div class="${cls}" onclick="document.getElementById('t_workstream').value='${w}';document.getElementById('t_workstream').dispatchEvent(new Event('change'))">${WS_ICONS[w]} ${w}</div>`;
  });document.getElementById('navWS_team').innerHTML=h;
}
// ===== INFO PANEL =====
function renderInfoStatus(){
  const ws=document.getElementById('s_workstream').value;
  const kat=document.getElementById('s_kategorie').value;
  const box=document.getElementById('infoContentStatus');
  if(!ws||!kat){box.innerHTML='<p style="font-style:italic">Waehlen Sie Workstream + Kategorie fuer Erlaeuterungen und Beispiele.</p>';return}
  const c=CATS.find(x=>x.k===kat);if(!c)return;
  const exKey=EX_KEYS[ws];
  box.innerHTML=`
    <div class="info-title">${esc(c.k)}</div>
    <p>${esc(c.info)}</p>
    <div class="info-hint">💡 <strong>Leitfrage:</strong> ${esc(c.q)}</div>
    <div class="info-example"><strong>Beispiel – ${WS_ICONS[ws]} ${esc(ws)}:</strong><br>${esc(c[exKey]||'')}</div>
    <table>
      <tr><th>Ampel</th><th>Bedeutung</th></tr>
      <tr><td>🟩</td><td>Etabliert / funktioniert</td></tr>
      <tr><td>🟧</td><td>Begonnen / teilweise</td></tr>
      <tr><td>🟦</td><td>In Planung</td></tr>
      <tr><td>🟥</td><td>Fehlt / kritisch</td></tr>
    </table>
  `;
}

// ===== IST-STATUS BEISPIELDATEN =====
let statusSubtabMode = "erfassung";

function formatStandBullets(stand) {
  const items = Array.isArray(stand) ? stand : stand ? [stand] : [];
  if (!items.length) return "";
  return "<ul>" + items.map((t) => `<li>${esc(t)}</li>`).join("") + "</ul>";
}

function renderStatusExamples() {
  const ws = document.getElementById("statusExamplesWS").value;
  const box = document.getElementById("statusExamplesContent");
  if (!box) return;
  const data = STATUS_EXAMPLES_BY_WS[ws];
  if (!data || !data.rows || !data.rows.length) {
    box.innerHTML =
      '<p class="status-examples-empty">Fuer diesen Workstream liegen noch keine Beispieldaten vor.</p>';
    return;
  }
  const theme = data.headerTheme || "blue";
  let html = `<p class="status-examples-disclaimer">${esc(STATUS_EXAMPLES_DISCLAIMER)}</p>`;
  if (data.title) html += `<p style="font-weight:700;color:var(--rc-accent2);margin-bottom:.6rem;font-size:.85rem">${esc(data.title)}</p>`;
  html += '<div class="tbl-wrap"><table class="status-examples-table"><thead class="theme-' + theme + '"><tr>';
  html +=
    "<th>Kategorie</th><th>Beispiel: Aktueller Stand (realcore)</th><th class=\"col-ampel\">Ampel</th><th>Beispiel: Kommentar / Nachweis</th></tr></thead><tbody>";
  data.rows.forEach((row) => {
    html += "<tr>";
    html += `<td><strong>${esc(displayKategorie(row.kategorie))}</strong></td>`;
    html += `<td>${formatStandBullets(row.stand)}</td>`;
    html += `<td class="col-ampel">${ampelHTML(row.ampel)}</td>`;
    html += `<td>${esc(row.kommentar || "")}</td>`;
    html += "</tr>";
  });
  html += "</tbody></table></div>";
  box.innerHTML = html;
}

function setStatusSubtab(mode) {
  statusSubtabMode = mode;
  const isBeispiele = mode === "beispiele";
  document.getElementById("statusPanelErfassung").style.display = isBeispiele ? "none" : "";
  document.getElementById("statusPanelBeispiele").style.display = isBeispiele ? "" : "none";
  document.getElementById("btnStatusSubtabErfassung").classList.toggle("active", !isBeispiele);
  document.getElementById("btnStatusSubtabBeispiele").classList.toggle("active", isBeispiele);
  document.getElementById("page-status").classList.toggle("status-examples-mode", isBeispiele);
  if (isBeispiele) renderStatusExamples();
}

document.getElementById("btnStatusSubtabErfassung").addEventListener("click", () => setStatusSubtab("erfassung"));
document.getElementById("btnStatusSubtabBeispiele").addEventListener("click", () => setStatusSubtab("beispiele"));
document.getElementById("statusExamplesWS").addEventListener("change", renderStatusExamples);

// ===== STATUS FORM =====
const sWS=document.getElementById('s_workstream'),sKat=document.getElementById('s_kategorie');
sWS.addEventListener('change',()=>{
  sKat.innerHTML='<option value="">– waehlen –</option>';
  if(sWS.value){CATS.forEach(c=>{sKat.innerHTML+=`<option value="${c.k}">${c.k}</option>`})}
  document.getElementById('s_leitfrageBox').style.display='none';
  renderNavStatus();renderInfoStatus();
});
sKat.addEventListener('change',()=>{
  const c=CATS.find(x=>x.k===sKat.value);
  if(c){document.getElementById('s_leitfrage').textContent=c.q;document.getElementById('s_leitfrageBox').style.display='block'}
  else{document.getElementById('s_leitfrageBox').style.display='none'}
  renderNavStatus();renderInfoStatus();
});
document.getElementById('t_workstream').addEventListener('change',renderNavTeam);

// ===== TEAM BEISPIELDATEN =====
function formatRollenmixBullets(rollenmix) {
  return formatStandBullets(rollenmix);
}

function renderTeamExamples() {
  const box = document.getElementById("teamExamplesContent");
  if (!box) return;
  const data = TEAM_EXAMPLES;
  if (!data || !data.rows || !data.rows.length) {
    box.innerHTML =
      '<p class="status-examples-empty">Noch keine Beispieldaten vorhanden.</p>';
    return;
  }
  const theme = data.headerTheme || "blue";
  let html = `<p class="status-examples-disclaimer">${esc(TEAM_EXAMPLES_DISCLAIMER)}</p>`;
  if (data.title) {
    html += `<p style="font-weight:700;color:var(--rc-accent2);margin-bottom:.6rem;font-size:.85rem">${esc(data.title)}</p>`;
  }
  html += '<div class="tbl-wrap"><table class="status-examples-table"><thead class="theme-' + theme + '"><tr>';
  html +=
    "<th>Bereich / Team</th><th>Headcount (aktuell)</th><th>Rollenmix (% Verteilung)</th><th>Schwerpunkt / Hauptfokus</th><th>Offene Stellen</th><th>Geplanter Ausbau +12M</th><th class=\"col-ampel\">Status</th><th>Bemerkungen</th></tr></thead><tbody>";
  data.rows.forEach((row) => {
    html += "<tr>";
    html += `<td><strong>${esc(row.bereich)}</strong></td>`;
    html += `<td>${esc(String(row.headcount ?? ""))}</td>`;
    html += `<td>${formatRollenmixBullets(row.rollenmix)}</td>`;
    html += `<td>${esc(row.schwerpunkt || "")}</td>`;
    html += `<td>${esc(String(row.offen ?? "–"))}</td>`;
    html += `<td>${esc(row.ausbau || "–")}</td>`;
    html += `<td class="col-ampel">${ampelHTML(row.status)}</td>`;
    html += `<td>${esc(row.bemerkung || "")}</td>`;
    html += "</tr>";
  });
  html += "</tbody></table></div>";
  box.innerHTML = html;
}

function setTeamSubtab(mode) {
  const isBeispiele = mode === "beispiele";
  document.getElementById("teamPanelErfassung").style.display = isBeispiele ? "none" : "";
  document.getElementById("teamPanelBeispiele").style.display = isBeispiele ? "" : "none";
  document.getElementById("btnTeamSubtabErfassung").classList.toggle("active", !isBeispiele);
  document.getElementById("btnTeamSubtabBeispiele").classList.toggle("active", isBeispiele);
  document.getElementById("page-team").classList.toggle("team-examples-mode", isBeispiele);
  if (isBeispiele) renderTeamExamples();
}

document.getElementById("btnTeamSubtabErfassung").addEventListener("click", () => setTeamSubtab("erfassung"));
document.getElementById("btnTeamSubtabBeispiele").addEventListener("click", () => setTeamSubtab("beispiele"));

// ===== SKILL-MATRIX BEISPIELDATEN =====
let skillMatrixExampleKind = "technologie";

function formatSkillCellLines(lines) {
  return formatStandBullets(lines);
}

function renderSkillMatrixExamples() {
  const box = document.getElementById("skillMatrixExamplesContent");
  if (!box) return;
  const data = SKILL_MATRIX_EXAMPLES_BY_KIND[skillMatrixExampleKind];
  if (!data || !data.rows || !data.rows.length) {
    box.innerHTML = '<p class="status-examples-empty">Noch keine Beispieldaten vorhanden.</p>';
    return;
  }
  const theme = data.headerTheme || "blue";
  let html = `<p class="status-examples-disclaimer">${esc(SKILL_MATRIX_EXAMPLES_DISCLAIMER)}</p>`;
  if (data.title) {
    html += `<p style="font-weight:700;color:var(--rc-accent2);margin-bottom:.6rem;font-size:.85rem">${esc(data.title)}</p>`;
  }
  html += '<div class="tbl-wrap"><table class="status-examples-table"><thead class="theme-' + theme + '"><tr>';
  html +=
    "<th>Mitarbeiter (Name)</th><th>Rolle / Team</th><th>Technologie-Skills<br><span style=\"font-weight:400;font-size:.7rem\">(Thema + Stufe 1–5)</span></th><th>Prozess / Methodik<br><span style=\"font-weight:400;font-size:.7rem\">(Thema + Stufe 1–5)</span></th><th>Soft Skills<br><span style=\"font-weight:400;font-size:.7rem\">(Thema + Stufe 1–5)</span></th><th>Zertifikate / Nachweise</th><th>Entwicklungsziel 2026</th></tr></thead><tbody>";
  data.rows.forEach((row) => {
    html += "<tr>";
    html += `<td><strong>${esc(row.name)}</strong></td>`;
    html += `<td>${esc(row.rolle)}</td>`;
    html += `<td>${formatSkillCellLines(row.technologie)}</td>`;
    html += `<td>${formatSkillCellLines(row.methodik)}</td>`;
    html += `<td>${formatSkillCellLines(row.soft)}</td>`;
    html += `<td>${esc(row.zertifikate || "")}</td>`;
    html += `<td>${esc(row.ziel || "")}</td>`;
    html += "</tr>";
  });
  html += "</tbody></table></div>";
  box.innerHTML = html;
}

function setSkillMatrixExampleKind(kind) {
  skillMatrixExampleKind = kind;
  document.getElementById("btnSkillExampleTech").classList.toggle("active", kind === "technologie");
  document.getElementById("btnSkillExampleSoft").classList.toggle("active", kind === "softskill");
  renderSkillMatrixExamples();
}

function setSkillSubtab(mode) {
  const isBeispiele = mode === "beispiele";
  document.getElementById("skillPanelErfassung").style.display = isBeispiele ? "none" : "";
  document.getElementById("skillPanelBeispiele").style.display = isBeispiele ? "" : "none";
  document.getElementById("btnSkillSubtabErfassung").classList.toggle("active", !isBeispiele);
  document.getElementById("btnSkillSubtabBeispiele").classList.toggle("active", isBeispiele);
  document.getElementById("page-skills").classList.toggle("skills-examples-mode", isBeispiele);
  if (isBeispiele) renderSkillMatrixExamples();
}

document.getElementById("btnSkillSubtabErfassung").addEventListener("click", () => setSkillSubtab("erfassung"));
document.getElementById("btnSkillSubtabBeispiele").addEventListener("click", () => setSkillSubtab("beispiele"));
document.getElementById("btnSkillExampleTech").addEventListener("click", () => setSkillMatrixExampleKind("technologie"));
document.getElementById("btnSkillExampleSoft").addEventListener("click", () => setSkillMatrixExampleKind("softskill"));

document.getElementById('statusForm').addEventListener('submit',async e=>{e.preventDefault();
  if(!validateFormRequired(e.target))return;
  if(!requireSaveUnit()) return;
  const saveUnit = getSaveUnit();
  const id=document.getElementById('s_editId').value||Date.now().toString();
  const entry={id,workstream:sWS.value,kategorie:sKat.value,titel:document.getElementById('s_titel').value.trim(),ampel:document.getElementById('s_ampel').value,
    stand:document.getElementById('s_stand').value,kommentar:document.getElementById('s_kommentar').value,
    datum:document.getElementById('s_datum').value||today(),erfasser:currentName,unit:saveUnit,type:'status'};
  const eId=document.getElementById('s_editId').value; if (!eId) delete entry.id;
  try {
    await saveEntry("status", entry);
    await refreshEntries();
    document.getElementById('statusForm').reset();document.getElementById('s_editId').value='';
    document.getElementById('s_leitfrageBox').style.display='none';document.getElementById('btnStatusCancel').style.display='none';
    renderNavStatus();renderInfoStatus();toast('Unit Übersicht gespeichert!');
  } catch (err) {
    toast(err.message || 'Speichern fehlgeschlagen.', '#e74c3c', 4000);
  }
});
function cancelStatusEdit(){document.getElementById('statusForm').reset();document.getElementById('s_editId').value='';
  document.getElementById('btnStatusCancel').style.display='none';document.getElementById('s_leitfrageBox').style.display='none';renderNavStatus();renderInfoStatus()}

// ===== TEAM FORM =====
document.getElementById('teamForm').addEventListener('submit',async e=>{e.preventDefault();
  if(!validateFormRequired(e.target))return;
  if(!requireSaveUnit()) return;
  const saveUnit = getSaveUnit();
  const id=document.getElementById('t_editId').value||Date.now().toString();
  const entry={id,workstream:document.getElementById('t_workstream').value,bereich:document.getElementById('t_bereich').value,
    headcount:document.getElementById('t_headcount').value,offen:document.getElementById('t_offen').value,
    ausbau:document.getElementById('t_ausbau').value,status:document.getElementById('t_status').value,
    rollenmix:document.getElementById('t_rollenmix').value,schwerpunkt:document.getElementById('t_schwerpunkt').value,
    bemerkung:document.getElementById('t_bemerkung').value,erfasser:currentName,unit:saveUnit,type:'team'};
  const eId=document.getElementById('t_editId').value; if (!eId) delete entry.id;
  try {
    await saveEntry("team", entry);
    await refreshEntries();
    document.getElementById('teamForm').reset();document.getElementById('t_editId').value='';
    document.getElementById('btnTeamCancel').style.display='none';renderNavTeam();toast('Team Übersicht gespeichert!');
  } catch (err) {
    toast(err.message || 'Speichern fehlgeschlagen.', '#e74c3c', 4000);
  }
});
function cancelTeamEdit(){document.getElementById('teamForm').reset();document.getElementById('t_editId').value='';document.getElementById('btnTeamCancel').style.display='none';renderNavTeam()}


// ===== SKILL ASSESSMENT (Excel-Vorlage, 1:n) =====
function escAttr(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function isLegacySkillEntry(e) {
  if (Array.isArray(e.softSkills) && e.softSkills.length > 0) return false;
  if (Array.isArray(e.skills) && e.skills.length > 0) return false;
  return !!(e.tech || e.methodik || e.soft || e.zertifikate || e.ziel);
}

function skillEmployeeLabel(e) {
  if (e.nachname && e.vorname) return `${e.nachname}, ${e.vorname}`;
  return e.name || "–";
}

function legacySkillSummary(e) {
  const parts = [];
  [["tech", "Tech"], ["methodik", "Methodik"], ["soft", "Soft"]].forEach(([key, label]) => {
    let arr = e[key];
    if (typeof arr === "string") {
      try { arr = JSON.parse(arr); } catch (_x) { arr = []; }
    }
    if (Array.isArray(arr) && arr.length) {
      parts.push(label + ": " + arr.map((s) => `${s.skill} (${s.stufe})`).join(", "));
    }
  });
  if (e.zertifikate) parts.push("Zert: " + e.zertifikate);
  if (e.ziel) parts.push("Ziel: " + e.ziel);
  return parts.join(" | ") || "Legacy-Eintrag";
}

function formatSkillLevel(s) {
  if (s.levelCustom && !isKnownLevel(s.level)) return s.levelCustom;
  if (s.level) return formatLevel(s.level);
  return "–";
}

function formatSoftSkillLevel(s) {
  if (s.levelCustom && !isKnownSoftLevel(s.level)) return s.levelCustom;
  if (s.level) return formatSoftLevel(s.level);
  return "–";
}

function skillOverviewDetail(e) {
  if (isLegacySkillEntry(e)) return esc(legacySkillSummary(e));
  const nTech = Array.isArray(e.skills) ? e.skills.length : 0;
  const nSoft = Array.isArray(e.softSkills) ? e.softSkills.length : 0;
  const bits = [];
  if (nTech) bits.push(`${nTech} Fachskill(s)`);
  if (nSoft) bits.push(`${nSoft} Soft Skill(s)`);
  if (!bits.length) return "–";
  return esc(bits.join(", "));
}

let currentSkillKind = "tech";

function setSkillKind(kind) {
  currentSkillKind = kind;
  document.getElementById("sk_assessment_section").style.display = kind === "tech" ? "" : "none";
  document.getElementById("ss_assessment_section").style.display = kind === "soft" ? "" : "none";
  document.getElementById("btnSkillKindTech").classList.toggle("active", kind === "tech");
  document.getElementById("btnSkillKindSoft").classList.toggle("active", kind === "soft");
  refreshSkillInfoPanel();
}

function refreshSkillInfoPanel() {
  if (currentSkillKind === "tech") {
    const row = document.querySelector("#sk_assessment_rows .skill-assessment-row");
    if (!row) {
      renderSkillInfo("", "");
      return;
    }
    const kat = readSelectWithOther(row, ".sk-kategorie", ".sk-kategorie-other");
    let lvl = readSelectWithOther(row, ".sk-level", ".sk-level-other");
    const parsedLvl = parseInt(lvl, 10);
    if (parsedLvl >= 1 && parsedLvl <= 5) lvl = parsedLvl;
    renderSkillInfo(kat, lvl);
  } else {
    const row = document.querySelector("#ss_assessment_rows .skill-assessment-row");
    if (!row) {
      renderSoftSkillInfo("", "");
      return;
    }
    const kat = readSelectWithOther(row, ".ss-kategorie", ".ss-kategorie-other");
    let lvl = readSelectWithOther(row, ".ss-level", ".ss-level-other");
    const parsedLvl = parseInt(lvl, 10);
    if (parsedLvl >= 1 && parsedLvl <= 5) lvl = parsedLvl;
    renderSoftSkillInfo(kat, lvl);
  }
}

function readSelectWithOther(row, selectClass, otherClass) {
  const sel = row.querySelector(selectClass);
  const other = row.querySelector(otherClass);
  if (sel.value === SELECT_SONSTIGES) return other.value.trim();
  return sel.value;
}

function syncSonstigesFieldsInRow(row, prefix) {
  const p = prefix || "sk";
  const pairs = [
    [`.${p}-kategorie`, `.${p}-kategorie-other`],
    [`.${p}-level`, `.${p}-level-other`],
    [`.${p}-nachweise`, `.${p}-nachweise-other`],
    [`.${p}-entwicklung`, `.${p}-entwicklung-other`],
  ];
  if (p === "sk") {
    pairs[2] = [".sk-zertifikat", ".sk-zertifikat-other"];
    pairs[3] = [".sk-interesse", ".sk-interesse-other"];
  }
  pairs.forEach(([selCls, otherCls]) => {
    const sel = row.querySelector(selCls);
    const other = row.querySelector(otherCls);
    if (!sel || !other) return;
    const isOther = sel.value === SELECT_SONSTIGES;
    other.classList.toggle("visible", isOther);
    other.required = isOther;
    if (!isOther) other.value = "";
  });
}

function renderSkillInfo(kategorie, level) {
  const box = document.getElementById("skillInfoContent");
  if (!box) return;
  let html = "";
  if (kategorie) {
    const cat = getCategoryByName(kategorie);
    if (cat) {
      html += `<div class="info-title">${esc(cat.name)}</div>`;
      html += `<p>${esc(cat.beschreibung)}</p>`;
      html += `<div class="info-example"><strong>Beispiel-Technologien:</strong><br>${esc(cat.beispielTechnologien)}</div>`;
    }
  }
  html += `<div class="info-title" style="margin-top:.6rem">Level-Definitionen</div><table>`;
  html += "<tr><th>Level</th><th>Bezeichnung</th><th>Definition</th></tr>";
  SKILL_LEVELS.forEach((l) => {
    const hl = String(level) === String(l.level) ? " style=\"background:#f0f7f0\"" : "";
    html += `<tr${hl}><td><strong>${l.level}</strong></td><td>${esc(l.bezeichnung)}</td><td>${esc(l.definition)}</td></tr>`;
  });
  html += "</table>";
  if (level) {
    const def = getLevelDef(level);
    if (def) {
      html += `<div class="info-hint" style="margin-top:.5rem"><strong>Typische Aufgaben (Level ${def.level}):</strong><br>${esc(def.typischeAufgaben)}</div>`;
    }
  }
  html += `<div class="info-hint" style="margin-top:.5rem">Erfassen Sie pro Mitarbeiter alle relevanten Skills als eigene Zeilen.</div>`;
  box.innerHTML = html;
}

function onSkillAssessmentChange(ev) {
  const row = ev.target.closest(".skill-assessment-row");
  if (!row) return;
  syncSonstigesFieldsInRow(row);
  if (ev.target.classList.contains("sk-kategorie")) {
    const katVal = readSelectWithOther(row, ".sk-kategorie", ".sk-kategorie-other");
    const cat = getCategoryByName(katVal);
    const tech = row.querySelector(".sk-technologie");
    if (cat && tech && !tech.value.trim()) tech.placeholder = cat.beispielTechnologien;
    else if (tech && row.querySelector(".sk-kategorie").value === SELECT_SONSTIGES) tech.placeholder = "Technologien manuell eingeben";
  }
  const kat = readSelectWithOther(row, ".sk-kategorie", ".sk-kategorie-other");
  let lvl = readSelectWithOther(row, ".sk-level", ".sk-level-other");
  const parsedLvl = parseInt(lvl, 10);
  if (parsedLvl >= 1 && parsedLvl <= 5) lvl = parsedLvl;
  if (currentSkillKind === "tech") renderSkillInfo(kat, lvl);
}

function renderSoftSkillInfo(kategorie, level) {
  const box = document.getElementById("skillInfoContent");
  if (!box) return;
  let html = "";
  if (kategorie) {
    const cat = getSoftCategoryByName(kategorie);
    if (cat) {
      html += `<div class="info-title">${esc(cat.name)}</div>`;
      html += `<p>${esc(cat.beschreibung)}</p>`;
      html += `<div class="info-example"><strong>Beispiel-Kompetenzen:</strong><br>${esc(cat.beispielKompetenzen)}</div>`;
    }
  }
  html += `<div class="info-title" style="margin-top:.6rem">Level-Definitionen (Soft Skills)</div><table>`;
  html += "<tr><th>Level</th><th>Bezeichnung</th><th>Definition</th></tr>";
  SOFT_SKILL_LEVELS.forEach((l) => {
    const hl = String(level) === String(l.level) ? " style=\"background:#f0f7f0\"" : "";
    html += `<tr${hl}><td><strong>${l.level}</strong></td><td>${esc(l.bezeichnung)}</td><td>${esc(l.definition)}</td></tr>`;
  });
  html += "</table>";
  if (level) {
    const def = getSoftLevelDef(level);
    if (def) {
      html += `<div class="info-hint" style="margin-top:.5rem"><strong>Verhaltens-Indikatoren (Level ${def.level}):</strong><br>${esc(def.verhaltensIndikatoren)}</div>`;
    }
  }
  html += `<div class="info-hint" style="margin-top:.5rem">Erfassen Sie pro Mitarbeiter alle relevanten Soft Skills als eigene Zeilen.</div>`;
  box.innerHTML = html;
}

function onSoftSkillAssessmentChange(ev) {
  const row = ev.target.closest(".skill-assessment-row");
  if (!row) return;
  syncSonstigesFieldsInRow(row, "ss");
  if (ev.target.classList.contains("ss-kategorie")) {
    const katVal = readSelectWithOther(row, ".ss-kategorie", ".ss-kategorie-other");
    const cat = getSoftCategoryByName(katVal);
    const komp = row.querySelector(".ss-kompetenz");
    if (cat && komp && !komp.value.trim()) komp.placeholder = cat.beispielKompetenzen;
    else if (komp && row.querySelector(".ss-kategorie").value === SELECT_SONSTIGES) komp.placeholder = "Kompetenzen manuell eingeben";
  }
  const kat = readSelectWithOther(row, ".ss-kategorie", ".ss-kategorie-other");
  let lvl = readSelectWithOther(row, ".ss-level", ".ss-level-other");
  const parsedLvl = parseInt(lvl, 10);
  if (parsedLvl >= 1 && parsedLvl <= 5) lvl = parsedLvl;
  if (currentSkillKind === "soft") renderSoftSkillInfo(kat, lvl);
}

function addSkillAssessmentRow(data) {
  const d = data || {};
  const catR = resolveCategorySelect(d.kategorie);
  const lvlR = resolveLevelSelect(d.level, d.levelCustom);
  const zertR = resolveSimpleSelect(d.zertifikatVorhanden, ["Ja", "Nein"]);
  const intR = resolveSimpleSelect(d.interesseWeiterbildung, ["Niedrig", "Mittel", "Hoch"]);
  const container = document.getElementById("sk_assessment_rows");
  const row = document.createElement("div");
  row.className = "skill-assessment-row";
  row.innerHTML = `
    <button type="button" class="sk-row-remove" title="Zeile entfernen">✕</button>
    <div class="skill-assessment-grid">
      <div class="span2"><label>Skill-Kategorie</label>
        <select class="sk-kategorie">${buildCategoryOptions(d.kategorie)}</select>
        <input type="text" class="sk-kategorie-other sk-sonstiges-input${catR.value === SELECT_SONSTIGES ? " visible" : ""}" placeholder="Kategorie manuell eingeben" value="${escAttr(catR.other)}">
      </div>
      <div class="span2"><label>Spezifische Technologie</label>
        <input type="text" class="sk-technologie" placeholder="Technologien" value="${escAttr(d.technologie)}"></div>
      <div><label>Level</label>
        <select class="sk-level">${buildLevelOptions(d.level, d.levelCustom)}</select>
        <input type="text" class="sk-level-other sk-sonstiges-input${lvlR.value === SELECT_SONSTIGES ? " visible" : ""}" placeholder="z.B. 3 oder eigene Level-Bezeichnung" value="${escAttr(lvlR.other)}">
      </div>
      <div><label>Zertifikat vorhanden</label>
        <select class="sk-zertifikat">${buildSimpleOptions(["Ja", "Nein"], zertR.value)}</select>
        <input type="text" class="sk-zertifikat-other sk-sonstiges-input${zertR.value === SELECT_SONSTIGES ? " visible" : ""}" placeholder="Manuelle Eingabe" value="${escAttr(zertR.other)}">
      </div>
      <div class="span2"><label>Zertifikat Details</label>
        <input type="text" class="sk-zertifikat-details" value="${escAttr(d.zertifikatDetails)}"></div>
      <div><label>Interesse Weiterbildung</label>
        <select class="sk-interesse">${buildSimpleOptions(["Niedrig", "Mittel", "Hoch"], intR.value)}</select>
        <input type="text" class="sk-interesse-other sk-sonstiges-input${intR.value === SELECT_SONSTIGES ? " visible" : ""}" placeholder="Manuelle Eingabe" value="${escAttr(intR.other)}">
      </div>
      <div><label>Letzte Anwendung</label>
        <input type="date" class="sk-letzte" value="${escAttr(d.letzteAnwendung)}"></div>
      <div class="span2"><label>Projekt-Beispiel</label>
        <input type="text" class="sk-projekt" value="${escAttr(d.projektBeispiel)}"></div>
      <div class="span2"><label>Bemerkungen</label>
        <textarea class="sk-bemerkung" style="min-height:45px">${esc(d.bemerkung || d.bemerkungen || "")}</textarea></div>
    </div>`;
  container.appendChild(row);
  row.querySelectorAll(".sk-kategorie, .sk-level, .sk-zertifikat, .sk-interesse").forEach((el) => {
    el.addEventListener("change", onSkillAssessmentChange);
  });
  row.querySelectorAll(".sk-kategorie-other, .sk-level-other").forEach((el) => {
    el.addEventListener("input", onSkillAssessmentChange);
  });
  syncSonstigesFieldsInRow(row);
  const katVal = readSelectWithOther(row, ".sk-kategorie", ".sk-kategorie-other");
  const cat = getCategoryByName(katVal);
  const tech = row.querySelector(".sk-technologie");
  if (cat && tech) tech.placeholder = cat.beispielTechnologien;
}

function getSkillAssessmentData() {
  const rows = document.querySelectorAll("#sk_assessment_rows .skill-assessment-row");
  const result = [];
  rows.forEach((r) => {
    const kategorie = readSelectWithOther(r, ".sk-kategorie", ".sk-kategorie-other");
    const technologie = r.querySelector(".sk-technologie").value.trim();
    const levelSel = r.querySelector(".sk-level").value;
    const levelOther = r.querySelector(".sk-level-other").value.trim();
    if (!kategorie && !technologie && !levelSel && !levelOther) return;

    let level = null;
    let levelCustom = "";
    if (levelSel === SELECT_SONSTIGES) {
      levelCustom = levelOther;
      const parsed = parseInt(levelOther, 10);
      if (parsed >= 1 && parsed <= 5) level = parsed;
    } else if (levelSel) {
      level = parseInt(levelSel, 10);
    }

    result.push({
      kategorie,
      technologie,
      level,
      levelCustom,
      zertifikatVorhanden: readSelectWithOther(r, ".sk-zertifikat", ".sk-zertifikat-other"),
      zertifikatDetails: r.querySelector(".sk-zertifikat-details").value.trim(),
      interesseWeiterbildung: readSelectWithOther(r, ".sk-interesse", ".sk-interesse-other"),
      letzteAnwendung: r.querySelector(".sk-letzte").value,
      projektBeispiel: r.querySelector(".sk-projekt").value.trim(),
      bemerkungen: r.querySelector(".sk-bemerkung").value.trim(),
    });
  });
  return result;
}

function setSkillAssessmentData(skills) {
  document.getElementById("sk_assessment_rows").innerHTML = "";
  if (!skills || !skills.length) {
    addSkillAssessmentRow();
  } else {
    skills.forEach((s) => addSkillAssessmentRow(s));
  }
  if (currentSkillKind === "tech") refreshSkillInfoPanel();
}

function addSoftSkillAssessmentRow(data) {
  const d = data || {};
  const catR = resolveSoftCategorySelect(d.kategorie);
  const lvlR = resolveSoftLevelSelect(d.level, d.levelCustom);
  const nachR = resolveSoftSimpleSelect(d.nachweise, ["Ja", "Nein"]);
  const entR = resolveSoftSimpleSelect(d.entwicklungsinteresse, ["Niedrig", "Mittel", "Hoch"]);
  const container = document.getElementById("ss_assessment_rows");
  const row = document.createElement("div");
  row.className = "skill-assessment-row";
  row.innerHTML = `
    <button type="button" class="ss-row-remove" title="Zeile entfernen">✕</button>
    <div class="skill-assessment-grid">
      <div class="span2"><label>Soft Skill Kategorie</label>
        <select class="ss-kategorie">${buildSoftCategoryOptions(d.kategorie)}</select>
        <input type="text" class="ss-kategorie-other sk-sonstiges-input${catR.value === SELECT_SONSTIGES ? " visible" : ""}" placeholder="Kategorie manuell eingeben" value="${escAttr(catR.other)}">
      </div>
      <div class="span2"><label>Spezifische Kompetenz</label>
        <input type="text" class="ss-kompetenz" placeholder="Kompetenzen" value="${escAttr(d.kompetenz)}"></div>
      <div><label>Level</label>
        <select class="ss-level">${buildSoftLevelOptions(d.level, d.levelCustom)}</select>
        <input type="text" class="ss-level-other sk-sonstiges-input${lvlR.value === SELECT_SONSTIGES ? " visible" : ""}" placeholder="z.B. 3 oder eigene Level-Bezeichnung" value="${escAttr(lvlR.other)}">
      </div>
      <div><label>Nachweise/Zertifikate</label>
        <select class="ss-nachweise">${buildSimpleOptions(["Ja", "Nein"], nachR.value)}</select>
        <input type="text" class="ss-nachweise-other sk-sonstiges-input${nachR.value === SELECT_SONSTIGES ? " visible" : ""}" placeholder="Manuelle Eingabe" value="${escAttr(nachR.other)}">
      </div>
      <div class="span2"><label>Zertifikat Details</label>
        <input type="text" class="ss-zertifikat-details" value="${escAttr(d.zertifikatDetails)}"></div>
      <div><label>Entwicklungsinteresse</label>
        <select class="ss-entwicklung">${buildSimpleOptions(["Niedrig", "Mittel", "Hoch"], entR.value)}</select>
        <input type="text" class="ss-entwicklung-other sk-sonstiges-input${entR.value === SELECT_SONSTIGES ? " visible" : ""}" placeholder="Manuelle Eingabe" value="${escAttr(entR.other)}">
      </div>
      <div><label>Letzte Anwendung</label>
        <input type="date" class="ss-letzte" value="${escAttr(d.letzteAnwendung)}"></div>
      <div class="span2"><label>Kontext/Beispiel</label>
        <input type="text" class="ss-kontext" value="${escAttr(d.kontextBeispiel)}"></div>
      <div class="span2"><label>Bemerkungen</label>
        <textarea class="ss-bemerkung" style="min-height:45px">${esc(d.bemerkung || d.bemerkungen || "")}</textarea></div>
    </div>`;
  container.appendChild(row);
  row.querySelectorAll(".ss-kategorie, .ss-level, .ss-nachweise, .ss-entwicklung").forEach((el) => {
    el.addEventListener("change", onSoftSkillAssessmentChange);
  });
  row.querySelectorAll(".ss-kategorie-other, .ss-level-other").forEach((el) => {
    el.addEventListener("input", onSoftSkillAssessmentChange);
  });
  syncSonstigesFieldsInRow(row, "ss");
  const katVal = readSelectWithOther(row, ".ss-kategorie", ".ss-kategorie-other");
  const cat = getSoftCategoryByName(katVal);
  const komp = row.querySelector(".ss-kompetenz");
  if (cat && komp) komp.placeholder = cat.beispielKompetenzen;
}

function getSoftSkillAssessmentData() {
  const rows = document.querySelectorAll("#ss_assessment_rows .skill-assessment-row");
  const result = [];
  rows.forEach((r) => {
    const kategorie = readSelectWithOther(r, ".ss-kategorie", ".ss-kategorie-other");
    const kompetenz = r.querySelector(".ss-kompetenz").value.trim();
    const levelSel = r.querySelector(".ss-level").value;
    const levelOther = r.querySelector(".ss-level-other").value.trim();
    if (!kategorie && !kompetenz && !levelSel && !levelOther) return;

    let level = null;
    let levelCustom = "";
    if (levelSel === SELECT_SONSTIGES) {
      levelCustom = levelOther;
      const parsed = parseInt(levelOther, 10);
      if (parsed >= 1 && parsed <= 5) level = parsed;
    } else if (levelSel) {
      level = parseInt(levelSel, 10);
    }

    result.push({
      kategorie,
      kompetenz,
      level,
      levelCustom,
      nachweise: readSelectWithOther(r, ".ss-nachweise", ".ss-nachweise-other"),
      zertifikatDetails: r.querySelector(".ss-zertifikat-details").value.trim(),
      entwicklungsinteresse: readSelectWithOther(r, ".ss-entwicklung", ".ss-entwicklung-other"),
      letzteAnwendung: r.querySelector(".ss-letzte").value,
      kontextBeispiel: r.querySelector(".ss-kontext").value.trim(),
      bemerkungen: r.querySelector(".ss-bemerkung").value.trim(),
    });
  });
  return result;
}

function setSoftSkillAssessmentData(softSkills) {
  document.getElementById("ss_assessment_rows").innerHTML = "";
  if (!softSkills || !softSkills.length) {
    addSoftSkillAssessmentRow();
  } else {
    softSkills.forEach((s) => addSoftSkillAssessmentRow(s));
  }
  if (currentSkillKind === "soft") refreshSkillInfoPanel();
}

function resetSkillForm() {
  document.getElementById("skillForm").reset();
  document.getElementById("sk_editId").value = "";
  setSkillAssessmentData([]);
  setSoftSkillAssessmentData([]);
  setSkillKind("tech");
}

function fillSkillEmployeeFields(e) {
  document.getElementById("sk_mitarbeiter_id").value = e.mitarbeiterId || "";
  document.getElementById("sk_nachname").value = e.nachname || (e.name || "").split(", ")[0] || "";
  document.getElementById("sk_vorname").value = e.vorname || (e.name || "").split(", ")[1] || "";
  document.getElementById("sk_rolle").value = e.rolle || "";
  document.getElementById("sk_email").value = e.email || "";
}

function updateSkillDeleteButton() {
  const btn = document.getElementById("btnSkillDelete");
  const editId = document.getElementById("sk_editId")?.value || "";
  if (!btn) return;
  btn.disabled = !editId;
  btn.title = editId ? "Ausgewählten Mitarbeiter löschen" : "Mitarbeiter aus Liste wählen oder speichern";
}

function isSkillExampleEntry(e) {
  if (e.isExample) return true;
  const examples = buildMergedSkillExamples();
  if (e.mitarbeiterId && examples.some((ex) => ex.mitarbeiterId === e.mitarbeiterId)) return true;
  return examples.some((ex) => ex.nachname === e.nachname && ex.vorname === e.vorname);
}

async function deleteSkillEmployee(id) {
  const entry = load("skill").find((x) => String(x.id) === String(id));
  if (!entry) return;
  const label = skillEmployeeLabel(entry);
  if (!confirm(`Mitarbeiter „${label}“ wirklich löschen?`)) return;
  await deleteEntry("skill", id, { skipConfirm: true });
}

async function removeSkillExamples() {
  if (!currentUnit && !isSuperAdmin) {
    toast("Bitte zuerst anmelden.", "#e74c3c");
    return;
  }
  const toDelete = load("skill").filter(isSkillExampleEntry);
  if (!toDelete.length) {
    toast("Keine Beispiel-Mitarbeiter gefunden.", "#e74c3c");
    return;
  }
  if (!confirm(`${toDelete.length} Beispiel-Mitarbeiter entfernen?`)) return;
  for (const e of toDelete) {
    await api(`/api/entries/${e.id}`, { method: "DELETE" });
  }
  const activeId = document.getElementById("sk_editId").value;
  if (toDelete.some((e) => String(e.id) === String(activeId))) {
    resetSkillForm();
    document.getElementById("btnSkillCancel").style.display = "none";
    document.getElementById("skillSaveSuccess").style.display = "none";
  }
  await refreshEntries();
  renderSkillEmployeeNav();
  renderOverview();
  updateSkillDeleteButton();
  toast(`${toDelete.length} Beispiel-Mitarbeiter entfernt.`, "#27ae60", 4500);
}

function loadSkillEmployeeEntry(entry) {
  if (!entry) return;
  setSkillSubtab("erfassung");
  document.getElementById("sk_editId").value = entry.id;
  fillSkillEmployeeFields(entry);
  if (isLegacySkillEntry(entry)) {
    setSkillAssessmentData([]);
    setSoftSkillAssessmentData([]);
    toast("Legacy-Eintrag: bitte Skills neu im neuen Format erfassen.", "#f39c12");
  } else {
    setSkillAssessmentData(entry.skills || []);
    setSoftSkillAssessmentData(entry.softSkills || []);
  }
  document.getElementById("btnSkillCancel").style.display = "";
  updateSkillDeleteButton();
  renderSkillEmployeeNav();
}

function showSkillSaveConfirmation(label) {
  const msg = `${label} wurde gespeichert.`;
  toast(`✓ ${msg}`, "#27ae60", 4500);
  const banner = document.getElementById("skillSaveSuccess");
  if (banner) {
    banner.textContent = `✓ ${msg} Der Mitarbeiter steht links in der Liste.`;
    banner.style.display = "block";
    clearTimeout(banner._hideTimer);
    banner._hideTimer = setTimeout(() => {
      banner.style.display = "none";
    }, 6000);
  }
}

function renderSkillEmployeeNav(highlightId) {
  const box = document.getElementById("navSkillEmployees");
  const empty = document.getElementById("navSkillEmployeesEmpty");
  if (!box) return;
  const entries = load("skill")
    .slice()
    .sort((a, b) => skillEmployeeLabel(a).localeCompare(skillEmployeeLabel(b), "de"));
  const activeId =
    highlightId != null && highlightId !== ""
      ? String(highlightId)
      : String(document.getElementById("sk_editId").value || "");
  if (!entries.length) {
    box.innerHTML = "";
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";
  let h = "";
  entries.forEach((e) => {
    const cls = String(e.id) === activeId ? "nav-pill active" : "nav-pill";
    const idPart = e.mitarbeiterId
      ? `<span style="opacity:.75;font-weight:400"> (${esc(e.mitarbeiterId)})</span>`
      : "";
    const subDetail = isLegacySkillEntry(e) ? "Legacy" : skillOverviewDetail(e);
    const unitPart = isSuperAdminViewAll() && e.unit ? esc(e.unit) + " · " : "";
    const sub = unitPart + subDetail;
    h += `<div class="${cls}" data-skill-id="${e.id}" role="button" tabindex="0">${esc(skillEmployeeLabel(e))}${idPart}<span class="nav-pill-sub">${sub}</span></div>`;
  });
  box.innerHTML = h;
  box.querySelectorAll("[data-skill-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-skill-id");
      const entry = load("skill").find((x) => String(x.id) === String(id));
      if (entry) loadSkillEmployeeEntry(entry);
    });
  });
  const activeEl = box.querySelector(".nav-pill.active");
  if (activeEl) activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function newSkillEmployee() {
  resetSkillForm();
  document.getElementById("btnSkillCancel").style.display = "none";
  updateSkillDeleteButton();
  renderSkillEmployeeNav();
}

document.getElementById("btnSkillEmployeeNew")?.addEventListener("click", newSkillEmployee);
document.getElementById("btnSkillExamplesLoad")?.addEventListener("click", loadSkillExamples);
document.getElementById("btnSkillExamplesRemove")?.addEventListener("click", removeSkillExamples);
document.getElementById("btnSkillDelete")?.addEventListener("click", () => {
  const id = document.getElementById("sk_editId").value;
  if (id) deleteSkillEmployee(id);
});

function buildMergedSkillExamples() {
  const byId = {};
  for (const ex of SKILL_EXAMPLES) {
    byId[ex.mitarbeiterId] = {
      mitarbeiterId: ex.mitarbeiterId,
      nachname: ex.nachname,
      vorname: ex.vorname,
      rolle: ex.rolle,
      skills: [...ex.skills],
      softSkills: [],
    };
  }
  for (const ex of SOFT_SKILL_EXAMPLES) {
    if (!byId[ex.mitarbeiterId]) {
      byId[ex.mitarbeiterId] = {
        mitarbeiterId: ex.mitarbeiterId,
        nachname: ex.nachname,
        vorname: ex.vorname,
        rolle: ex.rolle,
        skills: [],
        softSkills: [],
      };
    }
    byId[ex.mitarbeiterId].softSkills = [...ex.softSkills];
  }
  return Object.values(byId);
}

async function loadSkillExamples() {
  if (!requireSaveUnit()) {
    return;
  }
  const saveUnit = getSaveUnit();
  const existing = load("skill");
  if (existing.length && !confirm("Es existieren bereits Skill-Eintraege. Trotzdem Beispieldaten zusaetzlich anlegen?")) return;
  const merged = buildMergedSkillExamples();
  for (const ex of merged) {
    const entry = {
      mitarbeiterId: ex.mitarbeiterId,
      nachname: ex.nachname,
      vorname: ex.vorname,
      rolle: ex.rolle,
      skills: ex.skills,
      softSkills: ex.softSkills,
      name: `${ex.nachname}, ${ex.vorname}`,
      erfasser: currentName,
      unit: saveUnit,
      type: "skill",
      isExample: true,
    };
    await saveEntry("skill", entry);
  }
  await refreshEntries();
  renderSkillEmployeeNav();
  renderOverview();
  toast(`${merged.length} Beispiel-Mitarbeiter (Fach- + Soft Skills) angelegt.`, "#27ae60", 4500);
}

document.getElementById("sk_assessment_rows").addEventListener("change", onSkillAssessmentChange);
document.getElementById("sk_assessment_rows").addEventListener("click", (ev) => {
  if (ev.target.classList.contains("sk-row-remove")) {
    ev.target.closest(".skill-assessment-row").remove();
    refreshSkillInfoPanel();
  }
});

document.getElementById("ss_assessment_rows").addEventListener("change", onSoftSkillAssessmentChange);
document.getElementById("ss_assessment_rows").addEventListener("click", (ev) => {
  if (ev.target.classList.contains("ss-row-remove")) {
    ev.target.closest(".skill-assessment-row").remove();
    refreshSkillInfoPanel();
  }
});

document.getElementById("btnSkillKindTech").addEventListener("click", () => setSkillKind("tech"));
document.getElementById("btnSkillKindSoft").addEventListener("click", () => setSkillKind("soft"));

document.getElementById("skillForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireSaveUnit()) {
    return;
  }
  const saveUnit = getSaveUnit();
  if (!validateSkillFormFields()) return;
  const skills = getSkillAssessmentData();
  const softSkills = getSoftSkillAssessmentData();
  const nachname = document.getElementById("sk_nachname").value.trim();
  const vorname = document.getElementById("sk_vorname").value.trim();
  const entry = {
    nachname,
    vorname,
    rolle: document.getElementById("sk_rolle").value.trim(),
    name: `${nachname}, ${vorname}`,
    skills,
    softSkills,
    erfasser: currentName,
    unit: saveUnit,
    type: "skill",
  };
  const mitarbeiterId = document.getElementById("sk_mitarbeiter_id").value.trim();
  if (mitarbeiterId) entry.mitarbeiterId = mitarbeiterId;
  const email = document.getElementById("sk_email").value.trim().toLowerCase();
  if (email) entry.email = email;
  const label = skillEmployeeLabel(entry);
  const eId = document.getElementById("sk_editId").value;
  if (eId) entry.id = eId;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  try {
    setSkillSubtab("erfassung");
    switchTab("skills");
    const savedId = await saveEntry("skill", entry);
    document.getElementById("sk_editId").value = savedId;
    await refreshEntries();
    renderSkillEmployeeNav(savedId);
    document.getElementById("btnSkillCancel").style.display = "";
    updateSkillDeleteButton();
    showSkillSaveConfirmation(label);
  } catch (err) {
    toast(err.message || "Speichern fehlgeschlagen.", "#e74c3c", 4000);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

function cancelSkillEdit() {
  const banner = document.getElementById("skillSaveSuccess");
  if (banner) banner.style.display = "none";
  resetSkillForm();
  document.getElementById("btnSkillCancel").style.display = "none";
  updateSkillDeleteButton();
  renderSkillEmployeeNav();
}

setSkillAssessmentData([]);
setSoftSkillAssessmentData([]);

// ===== OVERVIEW =====
function getAll(){return[...load('status').map(e=>({...e,_type:'status'})),...load('team').map(e=>({...e,_type:'team'})),...load('skill').map(e=>({...e,_type:'skill'}))]}
function renderOverview(){
  const all=getAll();const fT=document.getElementById('ov_filterType').value;const fW=document.getElementById('ov_filterWS').value;
  const fS=document.getElementById('ov_filterSearch').value.toLowerCase();
  const showUnitCol = isSuperAdminViewAll();
  const head = document.getElementById('overviewHead');
  if (head) {
    head.innerHTML = showUnitCol
      ? '<tr><th>Unit</th><th>Typ</th><th>WS</th><th>Kategorie/Name</th><th>Ampel</th><th>Detail</th><th>Aktionen</th></tr>'
      : '<tr><th>Typ</th><th>WS</th><th>Kategorie/Name</th><th>Ampel</th><th>Detail</th><th>Aktionen</th></tr>';
  }
  const f=all.filter(e=>{if(fT&&e._type!==fT)return false;if(fW&&e.workstream!==fW)return false;
    if(fS&&!JSON.stringify(e).toLowerCase().includes(fS))return false;return true});
  const sc=all.filter(e=>e._type==='status').length,tc=all.filter(e=>e._type==='team').length,skc=all.filter(e=>e._type==='skill').length;
  document.getElementById('overviewStats').innerHTML=`
    <div class="stat-card"><div class="num">${all.length}</div><div class="lbl">Gesamt</div></div>
    <div class="stat-card"><div class="num">${sc}</div><div class="lbl">Unit Übersicht</div></div>
    <div class="stat-card"><div class="num">${tc}</div><div class="lbl">Team Übersicht</div></div>
    <div class="stat-card"><div class="num">${skc}</div><div class="lbl">Skill-Übersicht</div></div>`;
  const tb=document.getElementById('overviewBody'),no=document.getElementById('noOverview');
  if(!f.length){tb.innerHTML='';no.style.display='block';return}no.style.display='none';
  const tl={status:'📊 Unit Übersicht',team:'👥 Team Übersicht',skill:'🧠 Skill-Übersicht'};
  tb.innerHTML=f.map(e=>{let k='',a='',d='';
    if(e._type==='status'){const kat=displayKategorie(e.kategorie);k=e.titel?esc(e.titel):esc(kat);a=ampelHTML(e.ampel);d=e.titel?esc(kat)+' | '+esc((e.stand||'').substring(0,80)):esc((e.stand||'').substring(0,80))}
    else if(e._type==='team'){k=e.bereich;a=ampelHTML(e.status);d='HC:'+e.headcount+' | '+esc(e.schwerpunkt||'')}
    else{
      const idLabel=e.mitarbeiterId?` (${e.mitarbeiterId})`:'';
      k=esc(skillEmployeeLabel(e))+idLabel;
      a='–';
      const nSkills=Array.isArray(e.skills)?e.skills.length:0;
      const nSoft=Array.isArray(e.softSkills)?e.softSkills.length:0;
      d=esc(e.rolle)+(nSkills||nSoft?` | ${skillOverviewDetail(e)}`:isLegacySkillEntry(e)?' | Legacy':'');
    }
    const unitCell = showUnitCol ? `<td><strong>${esc(e.unit || '–')}</strong></td>` : '';
    return`<tr>${unitCell}<td>${tl[e._type]}</td><td>${esc(e.workstream||'–')}</td><td>${esc(k)}</td><td>${a}</td><td style="max-width:220px">${d}</td>
    <td style="white-space:nowrap"><button class="btn btn-sm btn-outline" onclick="editEntry('${e._type}','${e.id}')">✏️</button> <button class="btn btn-sm btn-danger" onclick="deleteEntry('${e._type}','${e.id}')">🗑️</button></td></tr>`}).join('');
}
['ov_filterType','ov_filterWS'].forEach(id=>document.getElementById(id).addEventListener('change',renderOverview));
document.getElementById('ov_filterSearch').addEventListener('input',renderOverview);

function switchSuperAdminViewForEntry(entry) {
  if (!isSuperAdmin || !entry?.unit || superAdminViewUnit === entry.unit) return;
  superAdminViewUnit = entry.unit;
  renderHeaderUnitSwitcher();
  updateHeaderUnitDisplay();
  updateSuperAdminFormMode();
  renderSkillEmployeeNav(entry.id);
  renderOverview();
  renderExportStats();
  if (isAdmin) renderAdminUsers();
}

function editEntry(type,id){
  const store = entryStore[type] || [];
  const e = (isSuperAdminViewAll() ? store : load(type)).find((x) => x.id === id);
  if(!e)return;
  switchSuperAdminViewForEntry(e);
  if(type==='status'){
    document.getElementById('s_editId').value=e.id;document.getElementById('s_workstream').value=e.workstream;
    sWS.dispatchEvent(new Event('change'));
    setTimeout(()=>{document.getElementById('s_kategorie').value=displayKategorie(e.kategorie);sKat.dispatchEvent(new Event('change'));
      document.getElementById('s_ampel').value=e.ampel;document.getElementById('s_titel').value=e.titel||'';
      document.getElementById('s_stand').value=e.stand;document.getElementById('s_kommentar').value=e.kommentar;
      document.getElementById('s_datum').value=e.datum;
      document.getElementById('btnStatusCancel').style.display='';},50);switchTab('status');
  }else if(type==='team'){
    document.getElementById('t_editId').value=e.id;document.getElementById('t_workstream').value=e.workstream;
    document.getElementById('t_bereich').value=e.bereich;document.getElementById('t_headcount').value=e.headcount;
    document.getElementById('t_offen').value=e.offen;document.getElementById('t_ausbau').value=e.ausbau;
    document.getElementById('t_status').value=e.status;document.getElementById('t_rollenmix').value=e.rollenmix;
    document.getElementById('t_schwerpunkt').value=e.schwerpunkt;document.getElementById('t_bemerkung').value=e.bemerkung;
    document.getElementById('btnTeamCancel').style.display='';renderNavTeam();switchTab('team');
  }else{
    switchTab('skills');
    loadSkillEmployeeEntry(e);
  }
}
async function deleteEntry(type, id, opts = {}) {
  if (!opts.skipConfirm && !confirm("Eintrag löschen?")) return;
  await api(`/api/entries/${id}`, { method: "DELETE" });
  if (type === "skill" && String(document.getElementById("sk_editId").value) === String(id)) {
    resetSkillForm();
    document.getElementById("btnSkillCancel").style.display = "none";
    document.getElementById("skillSaveSuccess").style.display = "none";
    updateSkillDeleteButton();
  }
  await refreshEntries();
  renderSkillEmployeeNav();
  renderOverview();
  toast("Gelöscht.", "#e74c3c");
}

// ===== EXPORT =====
function renderExportStats(){const a=getAll();const unitLabel=getViewUnitLabel();document.getElementById('exportStats').innerHTML=`<strong>${a.length}</strong> Eintraege – Unit: <strong>${esc(unitLabel)}</strong> (${load('status').length} Status, ${load('team').length} Teams, ${load('skill').length} Skills)`}
function exportJSON(){const a=getAll();if(!a.length){toast('Keine Daten.','#e74c3c');return}
  const unitLabel=getViewUnitLabel();
  const b=new Blob([JSON.stringify({unit:unitLabel,erfasser:currentName,export:new Date().toISOString(),entries:a},null,2)],{type:'application/json'});
  dl(b,'Unitleiter_'+getExportUnitSlug()+'_'+today()+'.json');toast('JSON exportiert!')}
function exportCSV(){const a=getAll();if(!a.length){toast('Keine Daten.','#e74c3c');return}
  const ks=[...new Set(a.flatMap(e=>Object.keys(e)))];const q=v=>'"'+String(v||'').replace(/"/g,'""')+'"';
  let csv=ks.map(q).join(';')+'\n';a.forEach(e=>{csv+=ks.map(k=>q(e[k])).join(';')+'\n'});
  const b=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  dl(b,'Unitleiter_'+getExportUnitSlug()+'_'+today()+'.csv');toast('CSV exportiert!')}
function flattenSkillsForExport(entries) {
  const rows = [];
  entries.filter((e) => e._type === "skill").forEach((e) => {
    if (isLegacySkillEntry(e)) {
      rows.push({
        mitarbeiterId: e.mitarbeiterId || "",
        name: skillEmployeeLabel(e),
        vorname: e.vorname || "",
        rolle: e.rolle || "",
        workstream: e.workstream || "",
        skillKategorie: "Legacy",
        technologie: legacySkillSummary(e),
        level: "",
        zertifikatVorhanden: "",
        zertifikatDetails: e.zertifikate || "",
        interesseWeiterbildung: "",
        letzteAnwendung: "",
        projektBeispiel: "",
        bemerkungen: e.ziel || "",
      });
      return;
    }
    e.skills.forEach((s) => {
      rows.push({
        skillArt: "Fachskill",
        mitarbeiterId: e.mitarbeiterId || "",
        name: e.nachname || skillEmployeeLabel(e).split(", ")[0],
        vorname: e.vorname || "",
        rolle: e.rolle || "",
        workstream: e.workstream || "",
        skillKategorie: s.kategorie,
        technologie: s.technologie,
        level: formatSkillLevel(s),
        zertifikatVorhanden: s.zertifikatVorhanden || "",
        zertifikatDetails: s.zertifikatDetails || "",
        interesseWeiterbildung: s.interesseWeiterbildung || "",
        letzteAnwendung: s.letzteAnwendung || "",
        projektBeispiel: s.projektBeispiel || "",
        bemerkungen: s.bemerkungen || "",
      });
    });
  });
  return rows;
}

function flattenSoftSkillsForExport(entries) {
  const rows = [];
  entries.filter((e) => e._type === "skill").forEach((e) => {
    if (isLegacySkillEntry(e) || !Array.isArray(e.softSkills)) return;
    e.softSkills.forEach((s) => {
      rows.push({
        skillArt: "Soft Skill",
        mitarbeiterId: e.mitarbeiterId || "",
        name: e.nachname || skillEmployeeLabel(e).split(", ")[0],
        vorname: e.vorname || "",
        rolle: e.rolle || "",
        workstream: e.workstream || "",
        softSkillKategorie: s.kategorie,
        kompetenz: s.kompetenz,
        level: formatSoftSkillLevel(s),
        nachweise: s.nachweise || "",
        zertifikatDetails: s.zertifikatDetails || "",
        entwicklungsinteresse: s.entwicklungsinteresse || "",
        letzteAnwendung: s.letzteAnwendung || "",
        kontextBeispiel: s.kontextBeispiel || "",
        bemerkungen: s.bemerkungen || "",
      });
    });
  });
  return rows;
}
function exportMD(){const a=getAll();if(!a.length){toast('Keine Daten.','#e74c3c');return}
  const unit=getViewUnitLabel(),name=currentName,dt=new Date().toISOString().slice(0,16).replace('T',' ');
  let md='# Unitleiter-Erfassung: '+unit+'\n\n';
  md+='**Erfasser:** '+name+'  \n**Export:** '+dt+'  \n**Eintraege:** '+a.length+'\n\n---\n\n';
  // Status
  const st=a.filter(e=>e._type==='status');
  if(st.length){
    md+='## IST-Statusaufnahme\n\n';
    const wsGroups={};st.forEach(e=>{if(!wsGroups[e.workstream])wsGroups[e.workstream]=[];wsGroups[e.workstream].push(e)});
    Object.keys(wsGroups).forEach(ws=>{
      md+='### '+ws+'\n\n';
      md+='| Bezeichnung / Name | Kategorie | Ampel | Beschreibung / Erlaeuterung | Kommentar |\n';
      md+='|--------------|-----------|-------|---------------------------|----------|\n';
      wsGroups[ws].forEach(e=>{
        const amp=ampelEmoji(e.ampel);
        const titel=(e.titel||'').replace(/\|/g,'/').replace(/\n/g,' ');
        const stand=(e.stand||'').replace(/\|/g,'/').replace(/\n/g,' ');
        const kom=(e.kommentar||'').replace(/\|/g,'/').replace(/\n/g,' ');
        md+='| '+titel+' | '+displayKategorie(e.kategorie)+' | '+amp+' | '+stand+' | '+kom+' |\n';
      });
      md+='\n';
    });
  }
  // Team
  const tm=a.filter(e=>e._type==='team');
  if(tm.length){
    md+='## Teamuebersicht\n\n';
    md+='| Workstream | Bereich | HC | Offen | Ausbau | Status | Rollenmix | Schwerpunkt | Bemerkung |\n';
    md+='|------------|---------|---:|------:|--------|--------|-----------|-------------|-----------|\n';
    tm.forEach(e=>{
      const amp=ampelEmoji(e.status);
      md+='| '+e.workstream+' | '+e.bereich+' | '+e.headcount+' | '+(e.offen||'–')+' | '+(e.ausbau||'–')+' | '+amp+' | '+(e.rollenmix||'').replace(/\|/g,'/')+' | '+(e.schwerpunkt||'')+' | '+(e.bemerkung||'').replace(/\|/g,'/').replace(/\n/g,' ')+' |\n';
    });
    md+='\n';
  }
  const cleanMd = (v) => String(v || "").replace(/\|/g, "/").replace(/\n/g, " ");
  const skRows = flattenSkillsForExport(a);
  if (skRows.length) {
    md += "## Fachskill-Assessment\n\n";
    md += "| Mitarbeiter ID | Name | Vorname | Rolle | Workstream | Skill-Kategorie | Technologie | Level | Zertifikat | Zertifikat Details | Interesse | Letzte Anwendung | Projekt | Bemerkungen |\n";
    md += "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n";
    skRows.forEach((r) => {
      md += `| ${cleanMd(r.mitarbeiterId)} | ${cleanMd(r.name)} | ${cleanMd(r.vorname)} | ${cleanMd(r.rolle)} | ${cleanMd(r.workstream)} | ${cleanMd(r.skillKategorie)} | ${cleanMd(r.technologie)} | ${cleanMd(r.level)} | ${cleanMd(r.zertifikatVorhanden)} | ${cleanMd(r.zertifikatDetails)} | ${cleanMd(r.interesseWeiterbildung)} | ${cleanMd(r.letzteAnwendung)} | ${cleanMd(r.projektBeispiel)} | ${cleanMd(r.bemerkungen)} |\n`;
    });
    md += "\n";
  }
  const ssRows = flattenSoftSkillsForExport(a);
  if (ssRows.length) {
    md += "## Soft-Skill-Assessment\n\n";
    md += "| Mitarbeiter ID | Name | Vorname | Rolle | Workstream | Soft Skill Kategorie | Kompetenz | Level | Nachweise | Zertifikat Details | Entwicklungsinteresse | Letzte Anwendung | Kontext/Beispiel | Bemerkungen |\n";
    md += "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n";
    ssRows.forEach((r) => {
      md += `| ${cleanMd(r.mitarbeiterId)} | ${cleanMd(r.name)} | ${cleanMd(r.vorname)} | ${cleanMd(r.rolle)} | ${cleanMd(r.workstream)} | ${cleanMd(r.softSkillKategorie)} | ${cleanMd(r.kompetenz)} | ${cleanMd(r.level)} | ${cleanMd(r.nachweise)} | ${cleanMd(r.zertifikatDetails)} | ${cleanMd(r.entwicklungsinteresse)} | ${cleanMd(r.letzteAnwendung)} | ${cleanMd(r.kontextBeispiel)} | ${cleanMd(r.bemerkungen)} |\n`;
    });
    md += "\n";
  }
  md+='---\n*Generiert aus Unitleiter-Erfassung realcore · Transformation 2026–2029*\n';
  const b=new Blob([md],{type:'text/markdown;charset=utf-8'});
  dl(b,'Unitleiter_'+getExportUnitSlug()+'_'+today()+'.md');toast('Markdown exportiert!');}
async function clearAll(){
  if(!confirm('ALLE Eintraege dieser Unit loeschen?'))return;
  await api("/api/entries", { method: "DELETE" });
  await refreshEntries();
  renderOverview();
  renderExportStats();
  toast('Geloescht.','#e74c3c');
}
function dl(b,n){const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;a.click();URL.revokeObjectURL(a.href)}


function checkAdmin(){
  document.getElementById('tabAdmin').style.display = isAdmin ? '' : 'none';
  const superCard = document.getElementById('superAdminUnitsCard');
  if (superCard) superCard.style.display = isSuperAdmin ? '' : 'none';
}

async function renderSuperAdminUnits() {
  if (!isSuperAdmin) return;
  const units = await api("/api/admin/units");
  masterUnitsCache = units;
  renderAdminUnitCheckboxes("adm_units_select", getSelectedAdminUnits("adm_units_select"));
  const tbody = document.getElementById("admUnitsBody");
  if (!tbody) return;
  if (!units.length) {
    tbody.innerHTML = '<tr><td colspan="2" style="color:var(--rc-muted);font-style:italic">Noch keine Units angelegt.</td></tr>';
    return;
  }
  tbody.innerHTML = units
    .map(
      (u) =>
        `<tr><td>${esc(u.name)}</td><td><button type="button" class="btn btn-sm btn-danger" data-unit-id="${u.id}">🗑️ Entfernen</button></td></tr>`
    )
    .join("");
  tbody.querySelectorAll("[data-unit-id]").forEach((btn) => {
    btn.addEventListener("click", () => adminDeleteMasterUnit(btn.getAttribute("data-unit-id")));
  });
}

async function adminAddMasterUnit() {
  const name = document.getElementById("adm_unit_name").value.trim();
  const errEl = document.getElementById("admUnitError");
  errEl.style.display = "none";
  if (!name) {
    errEl.textContent = "Bitte Unit-Namen eingeben.";
    errEl.style.display = "block";
    return;
  }
  try {
    await api("/api/admin/units", { method: "POST", body: JSON.stringify({ name }) });
    document.getElementById("adm_unit_name").value = "";
    await loadMasterUnitsCache();
    await renderSuperAdminUnits();
    await renderHeaderUnitSwitcher();
    toast("Unit angelegt.");
  } catch (error) {
    errEl.textContent = error.message;
    errEl.style.display = "block";
  }
}

async function adminDeleteMasterUnit(id) {
  const unit = masterUnitsCache.find((u) => String(u.id) === String(id));
  if (!unit) return;
  if (!confirm(`Unit „${unit.name}“ wirklich entfernen?`)) return;
  try {
    await api(`/api/admin/units/${id}`, { method: "DELETE" });
    if (superAdminViewUnit === unit.name) superAdminViewUnit = "all";
    await loadMasterUnitsCache();
    await renderSuperAdminUnits();
    await renderHeaderUnitSwitcher();
    refreshSuperAdminViews();
    toast("Unit entfernt.", "#e74c3c");
  } catch (error) {
    toast(error.message, "#e74c3c");
  }
}

async function renderAdminUsers(){
  if(!isAdmin) return;
  await loadMasterUnitsCache();
  const users = (await api("/api/admin/users")).filter(userMatchesSuperAdminView);
  document.getElementById('admUserCount').textContent = users.length;
  const tbody = document.getElementById('admUsersBody');
  tbody.innerHTML = users.map(u => {
    const isProtected = u.email === currentEmail;
    const unitsLabel = Array.isArray(u.units) && u.units.length ? esc(u.units.join(', ')) : '–';
    return '<tr>'
      + '<td>' + esc(u.email) + '</td>'
      + '<td>' + esc(u.name) + '</td>'
      + '<td>' + esc(roleLabel(u.role)) + '</td>'
      + '<td>' + unitsLabel + '</td>'
      + '<td style="white-space:nowrap">'
      + '<button class="btn btn-sm btn-outline" data-action="edit" data-user-id="' + u.id + '">✏️</button> '
      + (isProtected ? '' : '<button class="btn btn-sm btn-danger" data-action="delete" data-user-id="' + u.id + '">🗑️</button>')
      + '</td></tr>';
  }).join('');
  tbody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const user = users.find((u) => String(u.id) === String(btn.getAttribute('data-user-id')));
      if (user) adminEditUser(user);
    });
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => adminDeleteUser(btn.getAttribute('data-user-id')));
  });
}

async function adminAddUser(){
  const email = document.getElementById('adm_email').value.trim().toLowerCase();
  const nn = document.getElementById('adm_nachname').value.trim();
  const vn = document.getElementById('adm_vorname').value.trim();
  const pw = document.getElementById('adm_pw').value;
  const role = document.getElementById('adm_role').value;
  const units = getSelectedAdminUnits("adm_units_select");
  const errEl = document.getElementById('admError');
  const okEl = document.getElementById('admSuccess');
  errEl.style.display='none'; okEl.style.display='none';

  if(!email||!nn||!vn||!pw){errEl.textContent='Bitte alle Felder ausfuellen.';errEl.style.display='block';return}
  if(!email.includes('@')){errEl.textContent='Bitte gueltige E-Mail eingeben.';errEl.style.display='block';return}
  if(isUnitScopedSession(role) && !units.length){errEl.textContent='Mindestens eine Unit aus der Liste waehlen.';errEl.style.display='block';return}

  try {
    await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, name: nn + ', ' + vn, password: pw, role, units })
    });
  } catch (error) {
    errEl.textContent = error.message;
    errEl.style.display = "block";
    return;
  }

  document.getElementById('adm_email').value='';
  document.getElementById('adm_nachname').value='';
  document.getElementById('adm_vorname').value='';
  document.getElementById('adm_pw').value='';
  document.getElementById('adm_role').value='unit_lead';
  updateAdminUnitsFieldVisibility();
  renderAdminUnitCheckboxes("adm_units_select", []);
  okEl.textContent='Benutzer ' + email + ' angelegt.';okEl.style.display='block';
  await renderAdminUsers();
  if (isSuperAdmin) await renderSuperAdminUnits();
  toast('Benutzer angelegt!');
}

async function adminDeleteUser(id){
  if(!confirm('Benutzer wirklich loeschen?')) return;
  await api('/api/admin/users/' + id, { method: "DELETE" });
  await renderAdminUsers();
  toast('Benutzer geloescht.');
}

async function adminEditUser(user){
  const newPw = prompt('Neues Passwort fuer ' + user.email + ' (leer lassen fuer unveraendert):', '');
  if(newPw === null) return;
  const nameParts = user.name.split(', ');
  const newNn = prompt('Nachname:', nameParts[0] || '');
  if(newNn === null) return;
  const newVn = prompt('Vorname:', nameParts[1]||'');
  if(newVn === null) return;
  const newRole = prompt(
    'Rolle (admin, unit_lead oder mitarbeiter):',
    user.role || 'unit_lead'
  );
  if(newRole === null) return;
  const normalizedRole = ["admin", "unit_lead", "mitarbeiter"].includes(newRole) ? newRole : user.role;
  let newUnits = user.units || [];
  if (isUnitScopedSession(normalizedRole)) {
    const picked = await pickUnitsFromMaster(user.units || []);
    if (picked === null) return;
    newUnits = picked;
    if (!newUnits.length) {
      toast('Mindestens eine Unit erforderlich.', '#e74c3c');
      return;
    }
  } else {
    newUnits = [];
  }

  await api('/api/admin/users/' + user.id, {
    method: "PUT",
    body: JSON.stringify({
      name: newNn + ', ' + newVn,
      role: normalizedRole,
      password: newPw || undefined,
      units: newUnits,
    })
  });
  await renderAdminUsers();
  toast('Benutzer aktualisiert!');
}

async function adminExportUsers(){
  const users = await api("/api/admin/users");
  const blob = new Blob([JSON.stringify(users, null, 2)], {type:'application/json'});
  dl(blob, 'realcore_benutzer_' + today() + '.json');
  toast('Benutzer exportiert!');
}

function adminResetUsers(){
  toast('Reset wurde aus Sicherheitsgruenden entfernt.','#e74c3c');
}

document.getElementById("btnAdminAddUnit")?.addEventListener("click", adminAddMasterUnit);
document.getElementById("adm_role")?.addEventListener("change", updateAdminUnitsFieldVisibility);

// Init
document.getElementById('s_datum').value=today();
updateAdminUnitsFieldVisibility();
loadPublicLoginUnits();
document.getElementById("loginEmail")?.addEventListener("blur", resolveLoginUnits);
document.getElementById("loginPassword")?.addEventListener("blur", resolveLoginUnits);
document.getElementById("loginPassword")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") resolveLoginUnits();
});
bootSession();

window.doLogin = doLogin;
window.doLogout = doLogout;
window.cancelStatusEdit = cancelStatusEdit;
window.cancelTeamEdit = cancelTeamEdit;
window.cancelSkillEdit = cancelSkillEdit;
window.addSkillAssessmentRow = addSkillAssessmentRow;
window.loadSkillExamples = loadSkillExamples;
window.removeSkillExamples = removeSkillExamples;
window.deleteSkillEmployee = deleteSkillEmployee;
window.editEntry = editEntry;
window.deleteEntry = deleteEntry;
window.exportJSON = exportJSON;
window.exportCSV = exportCSV;
window.exportMD = exportMD;
window.clearAll = clearAll;
window.adminAddUser = adminAddUser;
window.adminDeleteUser = adminDeleteUser;
window.adminEditUser = adminEditUser;
window.adminExportUsers = adminExportUsers;
window.adminResetUsers = adminResetUsers;
window.adminAddMasterUnit = adminAddMasterUnit;
