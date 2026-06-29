// ===== SESSION + API =====
let currentUnit = "";
let currentName = "";
let currentEmail = "";
let isAdmin = false;
let isSuperAdmin = false;
let isMitarbeiter = false;
let userModules = { backcasting: false, fortschritt: false };
let currentSkillEntryId = null;
let currentPersonalnummer = "";
let skillPersonalnummerRows = [];
let unitContextPanelFetchGen = 0;
let headerUnitSwitcherBound = false;
let superAdminViewUnit = "all";
let userUnits = [];
let masterUnitsCache = [];
let unitLeadCandidatesCache = [];
let deputyCandidatesCache = [];
const DEPUTY_UNIT_LEADER_POSITION = "Stellv. Unit Leiter";
let entryStore = { portfolio: [], organisation: [], skill: [] };

function today(){return new Date().toISOString().slice(0,10)}
function toast(m,c,ms){const t=document.getElementById('toast');if(!t)return;t.textContent=m;t.style.background=c||'#27ae60';t.classList.add('show');clearTimeout(t._toastTimer);t._toastTimer=setTimeout(()=>t.classList.remove('show'),ms||2500)}

const SAVE_BTN_LABEL_DEFAULT = "💾 Speichern";
const SAVE_BTN_LABEL_SUCCESS = "✓ Gespeichert";

function getSaveButtonFromForm(form) {
  if (!form) return null;
  return (
    form.querySelector('button[type="submit"].org-form-save-btn') ||
    form.querySelector('button[type="submit"].btn-primary') ||
    form.querySelector('button[type="submit"]')
  );
}

function getSaveButtonsFromForm(form) {
  if (!form) return [];
  const marked = [...form.querySelectorAll('button[type="submit"].org-form-save-btn')];
  if (marked.length) return marked;
  const one = getSaveButtonFromForm(form);
  return one ? [one] : [];
}

function captureElementsSnapshot(container) {
  if (!container) return "";
  const parts = [];
  container.querySelectorAll("input, select, textarea").forEach((el) => {
    if (el.type === "button" || el.type === "submit" || el.type === "file") return;
    if (el.type === "radio" && !el.checked) return;
    const key = el.id || el.name || el.className.split(/\s+/)[0] || "field";
    let val = el.type === "checkbox" ? (el.checked ? "1" : "0") : el.value;
    parts.push(`${key}=${String(val)}`);
  });
  return parts.sort().join("\n");
}

function setSaveButtonVisualState(btn, state) {
  if (!btn) return;
  btn.classList.remove("btn-save-dirty", "btn-save-success");
  clearTimeout(btn._saveSuccessTimer);
  const defaultLabel = btn.dataset.saveLabelDefault || SAVE_BTN_LABEL_DEFAULT;
  if (state === "dirty") {
    btn.classList.add("btn-save-dirty");
    btn.textContent = defaultLabel;
  } else if (state === "saved") {
    btn.classList.add("btn-save-success");
    btn.textContent = SAVE_BTN_LABEL_SUCCESS;
    btn._saveSuccessTimer = setTimeout(() => {
      if (btn._saveTracker) btn._saveTracker.commitBaseline(false);
      else setSaveButtonVisualState(btn, "default");
    }, 3500);
  } else {
    btn.textContent = defaultLabel;
  }
}

function initFormSaveButtonTracker(root, options = {}) {
  const container = root;
  const buttons =
    options.buttons ||
    (root?.tagName === "FORM" ? getSaveButtonsFromForm(root) : options.button ? [options.button] : []);
  const btn = buttons[0] || null;
  if (!container || !btn) return null;
  if (btn._saveTracker) {
    btn._saveTracker.resetBaseline();
    return btn._saveTracker;
  }
  buttons.forEach((b) => {
    if (!b.dataset.saveLabelDefault) {
      b.dataset.saveLabelDefault = b.textContent.trim() || SAVE_BTN_LABEL_DEFAULT;
    }
  });
  const watchContainers = options.watchContainers || [];
  const getSnapshot = () => {
    let snap = captureElementsSnapshot(container);
    watchContainers.forEach((c) => {
      if (c) snap += "\n" + captureElementsSnapshot(c);
    });
    return snap;
  };
  let baseline = getSnapshot();
  const syncButtons = (state) => {
    buttons.forEach((b) => setSaveButtonVisualState(b, state));
  };
  const update = () => {
    syncButtons(getSnapshot() === baseline ? "default" : "dirty");
  };
  const tracker = {
    container,
    btn,
    buttons,
    commitBaseline(showSaved) {
      baseline = getSnapshot();
      syncButtons(showSaved ? "saved" : "default");
    },
    resetBaseline() {
      baseline = getSnapshot();
      syncButtons("default");
    },
    markDirty() {
      syncButtons("dirty");
    },
  };
  buttons.forEach((b) => {
    b._saveTracker = tracker;
  });
  container.addEventListener("input", update);
  container.addEventListener("change", update);
  watchContainers.forEach((c) => {
    if (!c) return;
    c.addEventListener("input", update);
    c.addEventListener("change", update);
  });
  if (watchContainers.length) {
    const mo = new MutationObserver(() => update());
    watchContainers.forEach((c) => {
      if (c) mo.observe(c, { childList: true, subtree: true });
    });
    tracker._observer = mo;
  }
  setSaveButtonVisualState(btn, "default");
  return tracker;
}

function resetFormSaveButtonTracker(formOrContainer) {
  const tracker =
    formOrContainer?._saveTracker ||
    (formOrContainer?.tagName === "FORM" ? getSaveButtonFromForm(formOrContainer)?._saveTracker : null);
  tracker?.resetBaseline();
}

function notifyFormSaveSuccess(formOrBtn, message) {
  const btn =
    formOrBtn?._saveTracker?.btn ||
    (formOrBtn?.tagName === "FORM" ? getSaveButtonFromForm(formOrBtn) : formOrBtn);
  const tracker = btn?._saveTracker;
  if (tracker) tracker.commitBaseline(true);
  else if (btn) setSaveButtonVisualState(btn, "saved");
  if (message) toast(`✓ ${message}`, "#27ae60", 4000);
}

function initAllSaveButtonTrackers() {
  initFormSaveButtonTracker(document.getElementById("skillForm"), {
    watchContainers: [
      document.getElementById("sk_assessment_rows"),
      document.getElementById("ss_assessment_rows"),
    ],
  });
  initFormSaveButtonTracker(document.getElementById("organisationForm"), {
    watchContainers: [
      document.getElementById("org_gliederung_rows"),
      document.getElementById("org_rollen_rows"),
    ],
  });
  [
    "portfolioProdukteForm",
    "portfolioServicesForm",
    "portfolioLoesungenForm",
    "portfolioPartnergeschaeftForm",
    "portfolioProjektgeschaeftForm",
  ].forEach((id) => initFormSaveButtonTracker(document.getElementById(id)));
  const adminUserCard = document.getElementById("adm_email")?.closest(".card");
  const adminAddBtn = document.getElementById("btnAdminAddUser");
  if (adminUserCard && adminAddBtn) {
    initFormSaveButtonTracker(adminUserCard, { button: adminAddBtn });
  }
}

function initModalSaveButtonTracker(modalOverlayId, saveButtonId) {
  const overlay = document.getElementById(modalOverlayId);
  const btn = document.getElementById(saveButtonId);
  const box = overlay?.querySelector(".login-box");
  if (!box || !btn) return null;
  if (btn._saveTracker && btn._saveTracker.container === box) {
    btn._saveTracker.resetBaseline();
    return btn._saveTracker;
  }
  return initFormSaveButtonTracker(box, { button: btn });
}

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

function openSkillDetailsForField(el) {
  if (!el) return;
  if (el.closest("#sk_assessment_rows")) {
    const details = document.getElementById("skillDetailsTech");
    if (details && !details.open) details.open = true;
    setSkillKind("tech");
  }
  if (el.closest("#ss_assessment_rows")) {
    const details = document.getElementById("skillDetailsSoft");
    if (details && !details.open) details.open = true;
    setSkillKind("soft");
  }
}

function reportFieldError(el, message) {
  if (el?.form) clearFormFieldErrors(el.form);
  else clearFormFieldErrors();
  openSkillDetailsForField(el);
  if (el) {
    el.classList.add("field-invalid");
    el.focus({ preventScroll: false });
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  toast(message || `Bitte „${getFieldLabel(el)}“ ausfüllen.`, "#e74c3c", 4000);
  return false;
}

function getSkillEntryPersonalnummer(entry) {
  if (!entry) return "";
  return String(entry.personalnummer || entry.mitarbeiterId || "").trim();
}

function lookupPersonalnummerFromUsers(entry) {
  if (!entry) return "";
  const entryId = entry.id ? String(entry.id) : "";
  const email = String(entry.email || currentEmail || "")
    .trim()
    .toLowerCase();
  const nameKeys = new Set();
  const full = String(entry.name || "").trim().toLowerCase();
  if (full) nameKeys.add(full);
  const nach = String(entry.nachname || "").trim();
  const vor = String(entry.vorname || "").trim();
  if (nach && vor) {
    nameKeys.add(`${nach}, ${vor}`.toLowerCase());
    nameKeys.add(`${vor} ${nach}`.toLowerCase());
  }
  const sources = [
    ...adminUsersCache,
    ...skillPersonalnummerRows.map((r) => ({
      personalnummer: r.personalnummer,
      skill_entry_id: r.skillEntryId,
      email: r.email,
      name: r.name,
    })),
  ];
  for (const u of sources) {
    const pn = String(u.personalnummer || "").trim();
    if (!pn) continue;
    const skillId = u.skill_entry_id || u.skillEntryId;
    if (entryId && skillId && String(skillId) === entryId) return pn;
    if (email && String(u.email || "").trim().toLowerCase() === email) return pn;
    const uname = String(u.name || "").trim().toLowerCase();
    if (uname && nameKeys.has(uname)) return pn;
  }
  return "";
}

async function loadSkillPersonalnummerLookup() {
  if (isMitarbeiter) return;
  try {
    skillPersonalnummerRows = await api("/api/skill-personalnummer-lookup");
  } catch (_e) {
    skillPersonalnummerRows = [];
  }
}

async function fillSkillEmployeeFieldsWithLookup(entry) {
  if (!isMitarbeiter && !resolveSkillFormPersonalnummer(entry)) {
    await loadSkillPersonalnummerLookup();
  }
  await ensureSkillEmployeeCatalogsLoaded();
  let data = entry;
  if (
    !resolveSkillEntryOrgRoleIds(data).length &&
    !resolveSkillEntryPositionIds(data).length
  ) {
    const user = findUserForSkillEntry(data);
    if (user) {
      data = {
        ...data,
        org_role_ids: resolveUserOrgRoleIds(user),
        org_roles: user.userOrgRoles || [],
        position_ids: resolveUserPositionIds(user),
        positions: user.userPositions || [],
      };
    }
  }
  fillSkillEmployeeFields(data);
}

function resolveSkillFormPersonalnummer(entry) {
  return (
    getSkillEntryPersonalnummer(entry) ||
    lookupPersonalnummerFromUsers(entry) ||
    currentPersonalnummer ||
    ""
  );
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

function isSkillRowEditing(row) {
  return row?.classList.contains("skill-assessment-row--editing");
}

function isTechSkillPayloadEmpty(data) {
  if (!data) return true;
  return !data.kategorie && data.level == null && !data.levelCustom;
}

function isSoftSkillPayloadEmpty(data) {
  if (!data) return true;
  return !data.kategorie && data.level == null && !data.levelCustom;
}

function readSkillCategoryFromRow(row, kind) {
  const isSoft = kind === "soft";
  const sel = row.querySelector(isSoft ? ".ss-kategorie" : ".sk-kategorie");
  const other = row.querySelector(isSoft ? ".ss-kategorie-other" : ".sk-kategorie-other");
  if (!sel) return { kategorie_id: null, kategorie: "" };
  if (sel.value === SELECT_SONSTIGES) {
    return { kategorie_id: null, kategorie: other?.value.trim() || "" };
  }
  const id = Number(sel.value);
  if (Number.isInteger(id) && id > 0) {
    const cat = isSoft ? getSoftCategoryById(id) : getCategoryById(id);
    return { kategorie_id: id, kategorie: cat?.name || "" };
  }
  const legacyName = String(sel.value || "").trim();
  const cat = isSoft ? getSoftCategoryByName(legacyName) : getCategoryByName(legacyName);
  if (cat) return { kategorie_id: Number(cat.id), kategorie: cat.name };
  return { kategorie_id: null, kategorie: legacyName };
}

function skillItemCategoryId(data) {
  return Number(data?.kategorie_id ?? data?.kategorieId);
}

function enrichTechSkillItemClient(data) {
  const base = data && typeof data === "object" ? { ...data } : {};
  const id = skillItemCategoryId(base);
  if (Number.isInteger(id) && id > 0) {
    const cat = getCategoryById(id);
    if (cat) return { ...base, kategorie_id: id, kategorie: cat.name };
  }
  const byName = getCategoryByName(base.kategorie);
  if (byName) {
    return { ...base, kategorie_id: Number(byName.id), kategorie: byName.name };
  }
  return base;
}

function enrichSoftSkillItemClient(data) {
  const base = data && typeof data === "object" ? { ...data } : {};
  const id = skillItemCategoryId(base);
  if (Number.isInteger(id) && id > 0) {
    const cat = getSoftCategoryById(id);
    if (cat) return { ...base, kategorie_id: id, kategorie: cat.name };
  }
  const byName = getSoftCategoryByName(base.kategorie);
  if (byName) {
    return { ...base, kategorie_id: Number(byName.id), kategorie: byName.name };
  }
  return base;
}

function enrichTechSkillList(skills) {
  return (Array.isArray(skills) ? skills : []).map((s) => enrichTechSkillItemClient(s));
}

function enrichSoftSkillList(softSkills) {
  return (Array.isArray(softSkills) ? softSkills : []).map((s) => enrichSoftSkillItemClient(s));
}

function upsertSkillEntryInStore(entry) {
  if (!entry || entry.type !== "skill") return;
  if (!entryStore.skill) entryStore.skill = [];
  const idx = entryStore.skill.findIndex((e) => String(e.id) === String(entry.id));
  if (idx >= 0) entryStore.skill[idx] = entry;
  else entryStore.skill.push(entry);
}

async function resolveSkillEmployeeEntry(entry) {
  if (!entry?.id) return entry;
  try {
    const all = await api("/api/entries");
    const fresh = all.find((e) => e.type === "skill" && String(e.id) === String(entry.id));
    if (fresh) {
      upsertSkillEntryInStore(fresh);
      return fresh;
    }
  } catch (_e) {
    /* lokaler Cache als Fallback */
  }
  return entry;
}

function readTechSkillPayloadFromForm(row) {
  const category = readSkillCategoryFromRow(row, "tech");
  const technologie = row.querySelector(".sk-technologie")?.value.trim() || "";
  const levelSel = row.querySelector(".sk-level")?.value || "";
  const levelOther = row.querySelector(".sk-level-other")?.value.trim() || "";
  let level = null;
  let levelCustom = "";
  if (levelSel === SELECT_SONSTIGES) {
    levelCustom = levelOther;
    const parsed = parseInt(levelOther, 10);
    if (parsed >= 1 && parsed <= 5) level = parsed;
  } else if (levelSel) {
    level = parseInt(levelSel, 10);
  }
  return {
    kategorie: category.kategorie,
    kategorie_id: category.kategorie_id,
    technologie,
    level,
    levelCustom,
    bemerkungen: row.querySelector(".sk-bemerkung")?.value.trim() || "",
  };
}

function readSoftSkillPayloadFromForm(row) {
  const category = readSkillCategoryFromRow(row, "soft");
  const kompetenz = row.querySelector(".ss-kompetenz")?.value.trim() || "";
  const levelSel = row.querySelector(".ss-level")?.value || "";
  const levelOther = row.querySelector(".ss-level-other")?.value.trim() || "";
  let level = null;
  let levelCustom = "";
  if (levelSel === SELECT_SONSTIGES) {
    levelCustom = levelOther;
    const parsed = parseInt(levelOther, 10);
    if (parsed >= 1 && parsed <= 5) level = parsed;
  } else if (levelSel) {
    level = parseInt(levelSel, 10);
  }
  return {
    kategorie: category.kategorie,
    kategorie_id: category.kategorie_id,
    kompetenz,
    level,
    levelCustom,
    bemerkungen: row.querySelector(".ss-bemerkung")?.value.trim() || "",
  };
}

function readTechSkillPayloadFromRow(row) {
  if (isSkillRowEditing(row)) return readTechSkillPayloadFromForm(row);
  try {
    return enrichTechSkillItemClient(JSON.parse(row.dataset.skillPayload || "{}"));
  } catch (_e) {
    return {};
  }
}

function readSoftSkillPayloadFromRow(row) {
  if (isSkillRowEditing(row)) return readSoftSkillPayloadFromForm(row);
  try {
    return enrichSoftSkillItemClient(JSON.parse(row.dataset.skillPayload || "{}"));
  } catch (_e) {
    return {};
  }
}

function storeTechSkillPayloadOnRow(row, data) {
  row.dataset.skillPayload = JSON.stringify(data || {});
}

function storeSoftSkillPayloadOnRow(row, data) {
  row.dataset.skillPayload = JSON.stringify(data || {});
}

function formatTechSkillListTitle(data) {
  return data.kategorie || "Ohne Kategorie";
}

function formatTechSkillListMeta(data) {
  const parts = [];
  if (data.technologie) parts.push(data.technologie);
  const lvl = formatSkillLevel(data);
  if (lvl && lvl !== "–") parts.push(`Level ${lvl}`);
  const bem = data.bemerkungen || data.bemerkung;
  if (bem) parts.push(bem);
  return parts.join(" · ") || "–";
}

function formatSoftSkillListTitle(data) {
  return data.kategorie || "Ohne Kategorie";
}

function formatSoftSkillListMeta(data) {
  const parts = [];
  if (data.kompetenz) parts.push(data.kompetenz);
  const lvl = formatSoftSkillLevel(data);
  if (lvl && lvl !== "–") parts.push(`Level ${lvl}`);
  const bem = data.bemerkungen || data.bemerkung;
  if (bem) parts.push(bem);
  return parts.join(" · ") || "–";
}

function updateSkillAssessmentListEmptyState(kind) {
  const isTech = kind !== "soft";
  const list = document.getElementById(isTech ? "sk_assessment_rows" : "ss_assessment_rows");
  const empty = document.getElementById(isTech ? "sk_assessment_empty" : "ss_assessment_empty");
  if (!list || !empty) return;
  const hasItems = list.querySelectorAll(".skill-assessment-row").length > 0;
  empty.style.display = hasItems ? "none" : "block";
}

function isAssessmentRowEmpty(row, prefix) {
  if (prefix === "sk") return isTechSkillPayloadEmpty(readTechSkillPayloadFromRow(row));
  return isSoftSkillPayloadEmpty(readSoftSkillPayloadFromRow(row));
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

function commitTechSkillRow(row, options = {}) {
  if (!row) return "Zeile nicht gefunden.";
  const data = readTechSkillPayloadFromForm(row);
  if (isTechSkillPayloadEmpty(data)) {
    if (options.allowEmpty) {
      row.remove();
      updateSkillAssessmentListEmptyState("tech");
      refreshSkillInfoPanel();
      return null;
    }
    return "Bitte Kategorie und Level ausfüllen.";
  }
  setSkillKind("tech");
  if (isSelectOrOtherEmpty(row, ".sk-kategorie", ".sk-kategorie-other")) {
    return "Bitte Skill-Kategorie ausfüllen.";
  }
  if (isLevelFieldEmpty(row, ".sk-level", ".sk-level-other")) {
    return "Bitte Level ausfüllen (Liste oder Sonstiges).";
  }
  storeTechSkillPayloadOnRow(row, data);
  renderTechSkillRowView(row, data);
  updateSkillAssessmentListEmptyState("tech");
  refreshSkillInfoPanel();
  return null;
}

function commitSoftSkillRow(row, options = {}) {
  if (!row) return "Zeile nicht gefunden.";
  const data = readSoftSkillPayloadFromForm(row);
  if (isSoftSkillPayloadEmpty(data)) {
    if (options.allowEmpty) {
      row.remove();
      updateSkillAssessmentListEmptyState("soft");
      refreshSkillInfoPanel();
      return null;
    }
    return "Bitte Kategorie und Level ausfüllen.";
  }
  setSkillKind("soft");
  if (isSelectOrOtherEmpty(row, ".ss-kategorie", ".ss-kategorie-other")) {
    return "Bitte Soft-Skill-Kategorie ausfüllen.";
  }
  if (isLevelFieldEmpty(row, ".ss-level", ".ss-level-other")) {
    return "Bitte Level ausfüllen (Liste oder Sonstiges).";
  }
  storeSoftSkillPayloadOnRow(row, data);
  renderSoftSkillRowView(row, data);
  updateSkillAssessmentListEmptyState("soft");
  refreshSkillInfoPanel();
  return null;
}

function commitAllEditingSkillRows() {
  const techRows = [...document.querySelectorAll("#sk_assessment_rows .skill-assessment-row--editing")];
  for (const row of techRows) {
    const err = commitTechSkillRow(row);
    if (err) {
      setSkillKind("tech");
      openSkillDetailsSection("tech");
      const el = focusSelectOrOther(row, ".sk-kategorie", ".sk-kategorie-other");
      if (el) reportFieldError(el, err);
      return err;
    }
  }
  const softRows = [...document.querySelectorAll("#ss_assessment_rows .skill-assessment-row--editing")];
  for (const row of softRows) {
    const err = commitSoftSkillRow(row);
    if (err) {
      setSkillKind("soft");
      openSkillDetailsSection("soft");
      const el = focusSelectOrOther(row, ".ss-kategorie", ".ss-kategorie-other");
      if (el) reportFieldError(el, err);
      return err;
    }
  }
  return null;
}

function validateTechSkillRowsDOM() {
  return !commitAllEditingSkillRows();
}

function validateSoftSkillRowsDOM() {
  return !commitAllEditingSkillRows();
}

let appPositionsCatalog = [];
let appRolesCatalog = [];

function catalogSortOrder(item) {
  const raw = item?.sortOrder ?? item?.sort_order;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function sortCatalogItems(items) {
  return [...(items || [])].sort(
    (a, b) =>
      catalogSortOrder(a) - catalogSortOrder(b) ||
      String(a?.name || "").localeCompare(String(b?.name || ""), "de")
  );
}

function getSkillOrgRolesCatalog() {
  if (adminAppRolesCache.length) return sortCatalogItems(adminAppRolesCache);
  if (appRolesCatalog.length) return sortCatalogItems(appRolesCatalog);
  return [];
}

function getSkillPositionsCatalog() {
  const source = adminAppPositionsCache.length
    ? adminAppPositionsCache
    : appPositionsCatalog.length
      ? appPositionsCatalog
      : (APP_POSITIONS || []).map((name, index) => ({ id: index + 1, name, sortOrder: index }));
  return sortCatalogItems(source)
    .map((p) => ({ id: Number(p.id), name: p.name, sortOrder: catalogSortOrder(p) }))
    .filter((p) => Number.isInteger(p.id) && p.id > 0);
}

function resolveSkillEntryOrgRoleIds(entry) {
  const ids = normalizeBigIntArrayClient(entry?.org_role_ids ?? entry?.orgRoleIds);
  if (ids.length) return ids;
  const names = entry?.org_roles || [];
  const catalog = getSkillOrgRolesCatalog();
  return [
    ...new Set(
      names
        .map((name) => catalog.find((r) => r.name === name)?.id)
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ];
}

function resolveSkillEntryPositionIds(entry) {
  const ids = normalizeBigIntArrayClient(entry?.position_ids ?? entry?.positionIds);
  if (ids.length) return ids;
  const legacyId = normalizeBigIntArrayClient([entry?.position_id ?? entry?.positionId])[0];
  if (legacyId) return [legacyId];
  const names = entry?.positions || [];
  const catalog = getSkillPositionsCatalog();
  const fromNames = names
    .map((name) => catalog.find((p) => p.name === name)?.id)
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (fromNames.length) return [...new Set(fromNames)];
  const legacyRolle = String(entry?.rolle || "").trim();
  if (legacyRolle) {
    const byName = catalog.find((p) => p.name === legacyRolle);
    if (byName) return [Number(byName.id)].filter((id) => Number.isInteger(id) && id > 0);
  }
  return [];
}

function skillEmployeeCatalogSummary(entry) {
  if (!entry || typeof entry !== "object") return "–";
  const roles = entry.org_roles || [];
  const positions = entry.positions || [];
  const parts = [];
  if (roles.length) parts.push(roles.join(", "));
  if (positions.length) parts.push(positions.join(", "));
  if (!parts.length && entry.rolle) return String(entry.rolle);
  return parts.join(" · ") || "–";
}

function updateSkillUnitDisplay(entry) {
  const el = document.getElementById("sk_unit_display");
  if (!el) return;
  const unit = resolveSkillEntryUnit(entry) || "";
  el.textContent = unit || "–";
}

function setSkillEmployeeCatalogFields(orgRoleIds, positionIds) {
  const orgSet = new Set(normalizeBigIntArrayClient(orgRoleIds).map((id) => String(id)));
  const posSet = new Set(normalizeBigIntArrayClient(positionIds).map((id) => String(id)));
  document
    .getElementById("sk_org_roles")
    ?.querySelectorAll("input[data-skill-org-role-id]")
    .forEach((el) => {
      el.checked = orgSet.has(el.getAttribute("data-skill-org-role-id"));
    });
  document
    .getElementById("sk_positions")
    ?.querySelectorAll("input[data-skill-position-id]")
    .forEach((el) => {
      el.checked = posSet.has(el.getAttribute("data-skill-position-id"));
    });
}

function renderSkillEmployeeCatalogCheckboxes(entry) {
  const roles = getSkillOrgRolesCatalog();
  const positions = getSkillPositionsCatalog();
  const orgRoleIds = entry ? resolveSkillEntryOrgRoleIds(entry) : [];
  const positionIds = entry ? resolveSkillEntryPositionIds(entry) : [];
  const orgBox = document.getElementById("sk_org_roles");
  const posBox = document.getElementById("sk_positions");
  if (orgBox) {
    orgBox.innerHTML = roles.length
      ? roles
          .map((item) => {
            const id = Number(item.id);
            const name = item.name || "";
            if (!Number.isInteger(id) || id <= 0) return "";
            return `<label class="unit-checkbox-item"><input type="checkbox" data-skill-org-role-id="${id}"> ${esc(name)}</label>`;
          })
          .join("")
      : '<p style="color:var(--rc-muted);font-size:.75rem;margin:0">Keine Rollen im Katalog.</p>';
  }
  if (posBox) {
    posBox.innerHTML = positions.length
      ? positions
          .map((item) => {
            const id = Number(item.id);
            const name = item.name || "";
            if (!Number.isInteger(id) || id <= 0) return "";
            return `<label class="unit-checkbox-item"><input type="checkbox" data-skill-position-id="${id}"> ${esc(name)}</label>`;
          })
          .join("")
      : '<p style="color:var(--rc-muted);font-size:.75rem;margin:0">Keine Positionen im Katalog.</p>';
  }
  setSkillEmployeeCatalogFields(orgRoleIds, positionIds);
  applySkillEmployeeCatalogReadonly();
}

function getSkillFormOrgRoleIds() {
  return getCheckedFromContainer("sk_org_roles", "data-skill-org-role-id")
    .map((id) => Number(id))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function getSkillFormPositionIds() {
  return getCheckedFromContainer("sk_positions", "data-skill-position-id")
    .map((id) => Number(id))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function getSkillFormCatalogData() {
  const org_role_ids = getSkillFormOrgRoleIds();
  const position_ids = getSkillFormPositionIds();
  const rolesCatalog = getSkillOrgRolesCatalog();
  const posCatalog = getSkillPositionsCatalog();
  const org_roles = org_role_ids
    .map((id) => rolesCatalog.find((r) => Number(r.id) === id)?.name)
    .filter(Boolean);
  const positions = position_ids
    .map((id) => posCatalog.find((p) => Number(p.id) === id)?.name)
    .filter(Boolean);
  return {
    org_role_ids,
    org_roles,
    position_ids,
    positions,
    rolle: positions[0] || org_roles[0] || "",
    position_id: position_ids[0] || null,
  };
}

function applySkillEmployeeCatalogReadonly() {
  const readonly = isMitarbeiter;
  ["sk_org_roles", "sk_positions"].forEach((id) => {
    document.getElementById(id)?.querySelectorAll("input[type=checkbox]").forEach((el) => {
      el.disabled = readonly;
    });
  });
}

async function ensureSkillEmployeeCatalogsLoaded() {
  if (!getSkillOrgRolesCatalog().length || !getSkillPositionsCatalog().length) {
    await loadAppRolePositionCatalogFromApi();
  }
}

function findUserForSkillEntry(entry) {
  if (!entry) return null;
  const email = String(entry.email || currentEmail || "")
    .trim()
    .toLowerCase();
  const entryId = entry.id ? String(entry.id) : "";
  const nameKeys = new Set();
  const full = String(entry.name || "").trim().toLowerCase();
  if (full) nameKeys.add(full);
  const nach = String(entry.nachname || "").trim();
  const vor = String(entry.vorname || "").trim();
  if (nach && vor) {
    nameKeys.add(`${nach}, ${vor}`.toLowerCase());
    nameKeys.add(`${vor} ${nach}`.toLowerCase());
  }
  for (const u of adminUsersCache) {
    if (entryId && u.skillEntryId && String(u.skillEntryId) === entryId) return u;
    if (email && String(u.email || "").trim().toLowerCase() === email) return u;
    const uname = String(u.name || "").trim().toLowerCase();
    if (uname && nameKeys.has(uname)) return u;
  }
  return null;
}

function refreshOrgRolleSelects() {
  document.querySelectorAll("#org_rollen_rows .org-rolle-row").forEach((row) => {
    const current = readSelectWithOther(row, ".org-rol-select", ".org-rol-other");
    const resolved = resolveOrgSelect(current, ORG_ROLLEN);
    const sel = row.querySelector(".org-rol-select");
    if (!sel) return;
    sel.innerHTML = buildOrgSelectOptions(ORG_ROLLEN, resolved.value);
    const other = row.querySelector(".org-rol-other");
    if (resolved.value === SELECT_SONSTIGES) {
      sel.value = SELECT_SONSTIGES;
      if (other) other.value = resolved.other || "";
    } else if (resolved.value) {
      sel.value = resolved.value;
    }
    syncOrgSonstigesInRow(row, "org-rol");
    updateOrgRolleRowSummary(row);
  });
}

function validateSkillEmployeeFields() {
  const fields = [document.getElementById("sk_nachname"), document.getElementById("sk_vorname")];
  for (const el of fields) {
    if (isRequiredFieldEmpty(el)) {
      return reportFieldError(el, `Bitte „${getFieldLabel(el)}“ ausfüllen.`);
    }
  }
  const catalogData = getSkillFormCatalogData();
  if (!catalogData.org_role_ids.length && !catalogData.position_ids.length) {
    const el = document.getElementById("sk_org_roles") || document.getElementById("sk_positions");
    return reportFieldError(el, "Bitte mindestens eine Rolle oder eine Position auswählen.");
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
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  if (!res.ok) {
    let msg = "Anfrage fehlgeschlagen.";
    if (isJson) {
      try {
        const payload = await res.json();
        msg = payload.error || msg;
        if (Array.isArray(payload.blockers) && payload.blockers.length && !String(msg).includes("Noch vorhanden:")) {
          msg += `\n\nNoch vorhanden:\n${payload.blockers.map((item) => `• ${item}`).join("\n")}`;
        }
      } catch (_e) {}
    } else if (res.status === 401 || res.status === 403) {
      msg = "Session abgelaufen – bitte neu anmelden.";
    } else {
      msg = `Serverfehler (${res.status}). Bitte Seite neu laden.`;
    }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  if (!isJson) {
    throw new Error("Unerwartete Server-Antwort. Bitte Seite neu laden oder Server neu starten.");
  }
  return res.json();
}

function normalizeUserUnits(units) {
  return Array.isArray(units) ? units.map((u) => String(u).trim()).filter(Boolean) : [];
}

function shouldShowHeaderUnitSwitcher() {
  return isSuperAdmin || isAdmin || userUnits.length > 1;
}

function initHeaderViewUnit() {
  const persisted = rcViewUnitPersist?.readPersistedViewUnit?.() || "";
  superAdminViewUnit =
    rcViewUnitPersist?.resolveViewUnitForSession?.(persisted, {
      isSuperAdmin,
      isAdmin,
      userUnits,
      currentUnit,
    }) ??
    (() => {
      if (isSuperAdmin || isAdmin) return "all";
      if (userUnits.length === 1) return userUnits[0];
      if (userUnits.length > 1) return currentUnit || userUnits[0] || "";
      return currentUnit || "";
    })();
  rcViewUnitPersist?.writePersistedViewUnit?.(superAdminViewUnit);
}

function resetAppViewToDefaults() {
  if (isMitarbeiter) return;
  if (isSuperAdmin || isAdmin) {
    superAdminViewUnit = "all";
    rcViewUnitPersist?.writePersistedViewUnit?.("all");
  }
  switchTab("portfolio");
  updateAppModuleNavActive("portfolio");
}

function load(type) {
  const all = entryStore[type] || [];
  const unit = getSaveUnit();
  if (unit) return all.filter((e) => e.unit === unit);
  return all;
}

function refreshPhase1ViewsAfterDataChange() {
  if (isMitarbeiter) return;
  renderPortfolio();
  renderOrganisation();
  renderSkillEmployeeNav();
  updateSkillDeleteButton();
  renderOverview();
  renderExportStats();
  void refreshUnitContextPanels();
}

function focusFilterAfterDemoLoad(target) {
  const value = String(target || "").trim();
  if (!value) {
    refreshPhase1ViewsAfterDataChange();
    return false;
  }
  if (!shouldShowHeaderUnitSwitcher()) {
    refreshPhase1ViewsAfterDataChange();
    return false;
  }
  const next = value === "all" ? "all" : value;
  if (superAdminViewUnit !== next) {
    setSuperAdminViewUnit(next);
    return true;
  }
  refreshPhase1ViewsAfterDataChange();
  return false;
}

function getViewUnitLabel() {
  if ((isSuperAdmin || isAdmin) && superAdminViewUnit === "all") return "Alle Units";
  if (superAdminViewUnit && superAdminViewUnit !== "all") return superAdminViewUnit;
  return currentUnit;
}

function getSaveUnit() {
  if (isSuperAdmin || isAdmin) {
    if (superAdminViewUnit === "all") return "";
    return String(superAdminViewUnit || "").trim();
  }
  if (userUnits.length > 1) {
    return String(superAdminViewUnit || currentUnit || "").trim();
  }
  return String(currentUnit || "").trim();
}

function getExportUnitSlug() {
  return getViewUnitLabel().replace(/\W/g, "_");
}

function isSuperAdminViewAll() {
  return (isSuperAdmin || isAdmin) && superAdminViewUnit === "all";
}

function userMatchesSuperAdminView(u) {
  if (!shouldShowHeaderUnitSwitcher() || superAdminViewUnit === "all") return true;
  if (Array.isArray(u.units) && u.units.includes(superAdminViewUnit)) return true;
  return false;
}

function getAdminUserListFilters() {
  return {
    name: document.getElementById("admUserFilterName")?.value.trim().toLowerCase() || "",
    unit: document.getElementById("admUserFilterUnit")?.value || "",
    position: document.getElementById("admUserFilterPosition")?.value || "",
    orgRole: document.getElementById("admUserFilterOrgRole")?.value || "",
  };
}

function userMatchesAdminUserFilters(u, filters) {
  if (filters.name) {
    const haystack = String(u.name || "").toLowerCase();
    if (!haystack.includes(filters.name)) return false;
  }
  if (filters.unit) {
    const units = Array.isArray(u.units) ? u.units : [];
    if (!units.includes(filters.unit)) return false;
  }
  if (filters.position) {
    const positions = Array.isArray(u.userPositions) ? u.userPositions : [];
    if (!positions.includes(filters.position)) return false;
  }
  if (filters.orgRole) {
    const orgRoles = Array.isArray(u.userOrgRoles) ? u.userOrgRoles : [];
    if (!orgRoles.includes(filters.orgRole)) return false;
  }
  return true;
}

function populateAdminUserSelectFilterOptions(selectId, emptyLabel, catalogItems, userValueGetter) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const current = select.value;
  const names = new Set();
  const orderedFromCatalog = sortCatalogItems(catalogItems || [])
    .map((item) => item?.name)
    .filter(Boolean);
  orderedFromCatalog.forEach((name) => names.add(name));
  adminUsersCache.forEach((u) => {
    (userValueGetter(u) || []).forEach((name) => {
      if (name) names.add(name);
    });
  });
  const extras = [...names]
    .filter((name) => !orderedFromCatalog.includes(name))
    .sort((a, b) => a.localeCompare(b, "de"));
  const sorted = [...orderedFromCatalog.filter((name) => names.has(name)), ...extras];
  select.innerHTML =
    `<option value="">${esc(emptyLabel)}</option>` +
    sorted
      .map(
        (name) =>
          `<option value="${escAttr(name)}"${current === name ? " selected" : ""}>${esc(name)}</option>`
      )
      .join("");
}

function populateAdminUserUnitFilterOptions() {
  populateAdminUserSelectFilterOptions(
    "admUserFilterUnit",
    "Alle Units",
    masterUnitsCache.map((u) => u?.name).filter(Boolean),
    (u) => (Array.isArray(u.units) ? u.units : [])
  );
}

function populateAdminUserPositionFilterOptions() {
  populateAdminUserSelectFilterOptions(
    "admUserFilterPosition",
    "Alle Positionen",
    adminAppPositionsCache,
    (u) => (Array.isArray(u.userPositions) ? u.userPositions : [])
  );
}

function populateAdminUserOrgRoleFilterOptions() {
  populateAdminUserSelectFilterOptions(
    "admUserFilterOrgRole",
    "Alle Rollen",
    adminAppRolesCache,
    (u) => (Array.isArray(u.userOrgRoles) ? u.userOrgRoles : [])
  );
}

function getVisibleAdminUsers() {
  const filters = getAdminUserListFilters();
  return adminUsersCache
    .filter(userMatchesSuperAdminView)
    .filter((u) => userMatchesAdminUserFilters(u, filters));
}

function isAdminUserProtected(user) {
  return String(user?.email || "").trim().toLowerCase() === String(currentEmail || "").trim().toLowerCase();
}

function adminUserLoginBadge(user) {
  if (user?.loginBlocked) {
    return '<span class="adm-user-login-badge adm-user-login-badge--blocked">Gesperrt</span>';
  }
  return '<span class="adm-user-login-badge adm-user-login-badge--active">Aktiv</span>';
}

function updateAdminUserBulkToolbar(visibleUsers) {
  const bar = document.getElementById("admUserBulkBar");
  const countEl = document.getElementById("admUserBulkCount");
  const selectAllEl = document.getElementById("admUserSelectAllVisible");
  const selectedCount = adminUserSelection.size;
  if (countEl) {
    countEl.textContent =
      selectedCount === 1 ? "1 Benutzer ausgewählt" : `${selectedCount} Benutzer ausgewählt`;
  }
  if (bar) bar.style.display = selectedCount ? "" : "none";
  if (selectAllEl && visibleUsers) {
    const selectable = visibleUsers.filter((u) => !isAdminUserProtected(u));
    const selectedVisible = selectable.filter((u) => adminUserSelection.has(String(u.id))).length;
    selectAllEl.checked = selectable.length > 0 && selectedVisible === selectable.length;
    selectAllEl.indeterminate =
      selectedVisible > 0 && selectedVisible < selectable.length;
    selectAllEl.disabled = !selectable.length;
  }
}

function toggleAdminUserSelection(userId, checked) {
  const key = String(userId);
  if (checked) adminUserSelection.add(key);
  else adminUserSelection.delete(key);
  updateAdminUserBulkToolbar(getVisibleAdminUsers());
}

function selectAllVisibleAdminUsers() {
  getVisibleAdminUsers().forEach((u) => {
    if (!isAdminUserProtected(u)) adminUserSelection.add(String(u.id));
  });
  renderAdminUsersTableBody();
}

function clearAdminUserSelection() {
  adminUserSelection.clear();
  renderAdminUsersTableBody();
}

async function adminBulkSetLoginBlocked(blocked) {
  const ids = [...adminUserSelection]
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length) return;
  const action = blocked ? "sperren" : "freigeben";
  const users = ids
    .map((id) => adminUsersCache.find((u) => String(u.id) === String(id)))
    .filter(Boolean);
  const names = users
    .slice(0, 3)
    .map((u) => u.name || u.email)
    .join(", ");
  const suffix = users.length > 3 ? ` und ${users.length - 3} weitere` : "";
  if (
    !confirm(
      `Login fuer ${users.length} Benutzer ${action}?\n\n${names}${suffix}`
    )
  ) {
    return;
  }
  try {
    const result = await api("/api/admin/users/bulk-login-block", {
      method: "POST",
      body: JSON.stringify({ userIds: ids, loginBlocked: blocked }),
    });
    adminUserSelection.clear();
    await renderAdminUsers();
    toast(
      blocked
        ? `Login fuer ${result.updated} Benutzer gesperrt.`
        : `Login fuer ${result.updated} Benutzer freigegeben.`,
      blocked ? "#e67e22" : "#27ae60"
    );
  } catch (error) {
    toast(error.message, "#e74c3c");
  }
}

function renderAdminUsersTableBody() {
  const filters = getAdminUserListFilters();
  const users = getVisibleAdminUsers();
  const total = adminUsersCache.filter(userMatchesSuperAdminView).length;
  const displayed = users.length;
  const hasFilters = Boolean(
    filters.name || filters.unit || filters.position || filters.orgRole
  );
  const countEl = document.getElementById("admUserCount");
  if (countEl) countEl.textContent = String(displayed);
  const listCountEl = document.getElementById("admUserListCount");
  if (listCountEl) {
    if (hasFilters && displayed !== total) {
      listCountEl.textContent = `${displayed} von ${total} Benutzern angezeigt`;
    } else if (displayed === 1) {
      listCountEl.textContent = "1 Benutzer angezeigt";
    } else {
      listCountEl.textContent = `${displayed} Benutzer angezeigt`;
    }
  }
  const tbody = document.getElementById("admUsersBody");
  if (!tbody) return;
  updateAdminUserBulkToolbar(users);
  if (!users.length) {
    tbody.innerHTML =
      '<tr><td colspan="12" style="color:var(--rc-muted);font-style:italic">' +
      (hasFilters
        ? "Keine Benutzer passen zu den Filterkriterien."
        : "Keine Benutzer vorhanden.") +
      "</td></tr>";
    return;
  }
  tbody.innerHTML = users
    .map((u) => {
      const isProtected = isAdminUserProtected(u);
      const userId = String(u.id);
      const isSelected = adminUserSelection.has(userId);
      const rowClass = u.loginBlocked ? " class=\"adm-user-row--blocked\"" : "";
      const unitsLabel = Array.isArray(u.units) && u.units.length ? esc(u.units.join(", ")) : "–";
      return (
        "<tr" +
        rowClass +
        ">" +
        '<td class="adm-users-td-check">' +
        (isProtected
          ? '<span title="Eigener Benutzer">–</span>'
          : `<input type="checkbox" data-user-select="${escAttr(userId)}"${
              isSelected ? " checked" : ""
            } aria-label="Benutzer auswählen">`) +
        "</td>" +
        "<td>" +
        (u.personalnummer ? esc(u.personalnummer) : "-") +
        "</td>" +
        "<td>" +
        esc(u.email) +
        "</td>" +
        "<td>" +
        esc(u.name) +
        "</td>" +
        "<td>" +
        esc(userPositionsLabel(u)) +
        "</td>" +
        "<td>" +
        esc(systemPrivilegeRolesLabel(u)) +
        "</td>" +
        "<td>" +
        esc(systemAppModuleRolesLabel(u)) +
        "</td>" +
        "<td>" +
        esc(userOrgRolesLabel(u)) +
        "</td>" +
        "<td>" +
        userSupervisorLabel(u, adminUsersCache) +
        "</td>" +
        "<td>" +
        unitsLabel +
        "</td>" +
        "<td>" +
        adminUserLoginBadge(u) +
        "</td>" +
        '<td style="white-space:nowrap">' +
        '<button type="button" class="btn btn-sm btn-outline" data-action="edit" data-user-id="' +
        u.id +
        '" title="Bearbeiten">✏️ Bearbeiten</button> ' +
        (isProtected
          ? ""
          : '<button class="btn btn-sm btn-danger" data-action="delete" data-user-id="' +
            u.id +
            '">🗑️</button>') +
        "</td></tr>"
      );
    })
    .join("");
  tbody.querySelectorAll("[data-user-select]").forEach((input) => {
    input.addEventListener("change", () => {
      toggleAdminUserSelection(input.getAttribute("data-user-select"), input.checked);
    });
  });
  tbody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const user = adminUsersCache.find(
        (u) => String(u.id) === String(btn.getAttribute("data-user-id"))
      );
      if (user) adminEditUser(user);
    });
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", () => adminDeleteUser(btn.getAttribute("data-user-id")));
  });
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
  document.querySelectorAll("#page-portfolio .unit-save-notice, #page-organisation .unit-save-notice").forEach((el) => {
    el.style.display = block ? "" : "none";
  });
  document
    .querySelectorAll("#organisationForm button[type=submit]")
    .forEach((btn) => {
      btn.disabled = block;
      btn.title = block ? "Bitte zuerst eine Unit oben auswählen" : "";
    });
}

function resolveSkillEntryUnit(entry) {
  const editId = entry?.id || document.getElementById("sk_editId")?.value || "";
  if (editId) {
    const existing = (entryStore.skill || []).find((e) => String(e.id) === String(editId));
    if (existing?.unit) return String(existing.unit).trim();
  }
  if (entry?.unit) return String(entry.unit).trim();
  const fromView = getSaveUnit();
  if (fromView) return fromView;
  const email = String(entry?.email || document.getElementById("sk_email")?.value || "")
    .trim()
    .toLowerCase();
  if (email && adminUsersCache.length) {
    const u = adminUsersCache.find((x) => String(x.email || "").trim().toLowerCase() === email);
    const units = Array.isArray(u?.units) ? u.units : [];
    if (units.length) return String(units[0]).trim();
  }
  return String(currentUnit || "").trim();
}

function initHeaderUnitSwitcher() {
  if (headerUnitSwitcherBound) return;
  const tabs = document.getElementById("headerUnitTabs");
  if (!tabs) return;
  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-unit]");
    if (!btn) return;
    e.preventDefault();
    setSuperAdminViewUnit(btn.getAttribute("data-unit"));
  });
  headerUnitSwitcherBound = true;
}

async function renderHeaderUnitSwitcher() {
  const bar = document.getElementById("headerUnitSwitcher");
  const tabs = document.getElementById("headerUnitTabs");
  if (!bar || !tabs) return;
  if (!shouldShowHeaderUnitSwitcher()) {
    bar.style.display = "none";
    return;
  }
  await loadMasterUnitsCache();
  let items;
  if (isSuperAdmin || isAdmin) {
    const units = masterUnitsCache.map((u) => u.name);
    items = [{ id: "all", label: "Alle Units" }, ...units.map((name) => ({ id: name, label: name }))];
  } else {
    items = userUnits.map((name) => ({ id: name, label: name }));
  }
  bar.style.display = "flex";
  tabs.innerHTML = items
    .map(
      (item) =>
        `<button type="button" class="header-unit-tab${superAdminViewUnit === item.id ? " active" : ""}" data-unit="${escAttr(item.id)}" role="tab" aria-selected="${superAdminViewUnit === item.id}">${esc(item.label)}</button>`
    )
    .join("");
}

function refreshSuperAdminViews() {
  updateHeaderUnitDisplay();
  updateSuperAdminFormMode();
  refreshUnitContextPanels();
  renderSkillEmployeeNav();
  updateSkillDeleteButton();
  renderPortfolio();
  renderOrganisation();
  renderOverview();
  renderExportStats();
  if (isAdmin) renderAdminUsers();
  if (document.getElementById("page-gesamtfortschritt")?.classList.contains("active")) {
    renderGesamtfortschrittDashboard();
  }
  if (document.getElementById("page-fortschritt")?.classList.contains("active")) {
    renderFortschrittDashboard();
  }
  if (document.getElementById("page-fortschritt-new")?.classList.contains("active") && typeof initFortschrittNew === "function") {
    initFortschrittNew();
  }
  if (isDemoDatenViewActive()) {
    renderDemoDatenPage();
  }
}

function setSuperAdminViewUnit(unit) {
  superAdminViewUnit = unit || "all";
  rcViewUnitPersist?.writePersistedViewUnit?.(superAdminViewUnit);
  updateHeaderUnitDisplay();
  updateSuperAdminFormMode();
  void refreshUnitContextPanels();
  void renderHeaderUnitSwitcher();
  renderSkillEmployeeNav();
  updateSkillDeleteButton();
  renderPortfolio();
  renderOrganisation();
  renderOverview();
  renderExportStats();
  if (isAdmin) renderAdminUsers();
  if (document.getElementById("page-gesamtfortschritt")?.classList.contains("active")) {
    renderGesamtfortschrittDashboard();
  }
  if (document.getElementById("page-fortschritt")?.classList.contains("active")) {
    renderFortschrittDashboard();
  }
  if (document.getElementById("page-fortschritt-new")?.classList.contains("active") && typeof initFortschrittNew === "function") {
    initFortschrittNew();
  }
  if (isDemoDatenViewActive()) {
    renderDemoDatenPage();
  } else if (typeof updateFortschrittDemoControls === "function") {
    updateFortschrittDemoControls();
  }
  refreshPresenceTracking();
}

function requireSaveUnit() {
  const unit = getSaveUnit();
  if (!unit) {
    toast("Bitte oben eine konkrete Unit wählen (nicht „Alle Units“), um zu speichern.", "#e74c3c", 5000);
    document.getElementById("headerUnitSwitcher")?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    return false;
  }
  return true;
}

async function refreshEntries() {
  const all = await api("/api/entries");
  entryStore = { portfolio: [], organisation: [], skill: [] };
  all.forEach((e) => {
    if (entryStore[e.type]) entryStore[e.type].push(e);
  });
  renderSkillEmployeeNav();
}

async function saveEntry(type, entry) {
  if (isMitarbeiter && type !== "skill") {
    throw new Error("Kein Zugriff.");
  }
  if (isMitarbeiter && type === "skill" && entry.id && currentSkillEntryId && entry.id !== currentSkillEntryId) {
    throw new Error("Sie duerfen nur Ihr eigenes Skill-Profil bearbeiten.");
  }
  const payload = {
    ...entry,
    type,
    unit: String(
      (type === "skill" ? resolveSkillEntryUnit(entry) : "") || entry.unit || getSaveUnit() || ""
    ).trim(),
  };
  if (!payload.unit) {
    throw new Error("Unit fehlt – bitte erneut anmelden.");
  }
  if (type !== "skill" && type !== "portfolio" && type !== "organisation" && !String(payload.workstream || "").trim()) {
    throw new Error("Workstream fehlt.");
  }
  if (type === "portfolio" || type === "organisation") {
    payload.workstream = "";
  }
  if (payload.id) {
    await api(`/api/entries/${payload.id}`, {
      method: "PUT",
      body: JSON.stringify({ entry: payload }),
    });
    return payload.id;
  }
  if (isMitarbeiter) {
    throw new Error("Kein Skill-Profil zum Speichern vorhanden.");
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

function canEditPersonalnummer() {
  return isAdmin;
}

function setPersonalnummerFieldEditable(editable) {
  const el = document.getElementById("adm_edit_personalnummer");
  const hint = document.getElementById("adm_edit_personalnummer_hint");
  if (el) {
    el.readOnly = !editable;
    el.classList.toggle("field-readonly", !editable);
  }
  if (hint) hint.style.display = editable ? "none" : "";
}

function isAdminSession(role) {
  return role === "admin" || role === "super_admin";
}

function userIsAdminFromSession(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (roles.includes("admin") || roles.includes("super_admin")) return true;
  return isAdminSession(user.role);
}

function isUnitScopedSession(role) {
  return role === "unit_lead" || role === "mitarbeiter";
}

function isMitarbeiterSession(role) {
  return role === "mitarbeiter";
}

const ELEVATED_UNIT_ROLES = ["unit_lead", "admin", "super_admin", "regionalleiter", "geschaeftsfuehrung"];

function isPureMitarbeiterUser(userOrRole) {
  if (typeof userOrRole === "string") {
    return userOrRole === "mitarbeiter";
  }
  const user = userOrRole || {};
  const roles = getUserRolesList(user);
  if (!roles.includes("mitarbeiter")) return false;
  return !roles.some((role) => ELEVATED_UNIT_ROLES.includes(role));
}

function getActiveAppPage() {
  const el = document.querySelector(".page.active");
  return el ? el.id.replace(/^page-/, "") : "portfolio";
}

const PHASE1_TAB_PAGES = ["portfolio", "organisation", "skills", "overview", "export"];
const PHASE3_TAB_PAGES = ["gesamtfortschritt", "fortschritt", "fortschritt-new", "fortschritt-erlaeuterung"];
const ADMIN_SUBTAB_MODES = ["users", "skills", "roles", "leitplanken", "permissions", "org", "demo", "settings"];

function resolvePresenceContext() {
  if (isMitarbeiter) return "phase1";
  const page = getActiveAppPage();
  if (page === "admin") return "admin";
  if (PHASE3_TAB_PAGES.includes(page)) return "fortschritt";
  return "phase1";
}

function resolvePresenceUnit() {
  if (typeof isSuperAdminViewAll === "function" && isSuperAdminViewAll()) return "Alle Units";
  if (typeof getSaveUnit === "function") {
    const unit = String(getSaveUnit() || "").trim();
    if (unit) return unit;
  }
  return String(currentUnit || "").trim();
}

function startPresenceTracking() {
  if (typeof window.rcPresence?.init !== "function") return;
  window.rcPresence.init({
    email: currentEmail,
    isAdmin,
    getContext: resolvePresenceContext,
    getUnit: resolvePresenceUnit,
  });
}

function refreshPresenceTracking() {
  window.rcPresence?.refresh?.();
  if (isAdmin) window.rcPresence?.refreshList?.();
}

function isDemoDatenViewActive() {
  return getActiveAppPage() === "admin" && adminSubtab === "demo";
}

function getAdminTabFromQuery() {
  const tab = new URLSearchParams(window.location.search).get("adminTab");
  return ADMIN_SUBTAB_MODES.includes(tab) ? tab : "";
}

function clearAppPageQueryFromUrl() {
  if (!window.history?.replaceState) return;
  const params = new URLSearchParams(window.location.search);
  params.delete("page");
  params.delete("adminTab");
  const qs = params.toString();
  window.history.replaceState({}, "", qs ? `/?${qs}` : "/");
}

function openAdminDemoDatenTab() {
  if (!isAdmin) return;
  adminSubtab = "demo";
  switchTab("admin");
  void initAdminPage();
}

function isPhase3AppPage(page) {
  return PHASE3_TAB_PAGES.includes(page);
}

function canAccessDemoDaten() {
  return isAdmin;
}

function canAccessPhase3Area() {
  return Boolean(userModules?.fortschritt) || isAdmin;
}

function isPhase3PageActive() {
  return isPhase3AppPage(getActiveAppPage());
}

function updateMainTabsBar(page) {
  const tabsBar = document.getElementById("tabsBar");
  const tabs = document.getElementById("tabs");
  const phase1Nav = document.getElementById("tabsNavPhase1");
  const phase3Nav = document.getElementById("tabsNavPhase3");
  if (!tabs && !tabsBar) return;
  if (isMitarbeiter) {
    if (tabsBar) tabsBar.style.display = "none";
    return;
  }
  const onPhase3 = isPhase3AppPage(page);
  const onPhase1 = PHASE1_TAB_PAGES.includes(page);
  const show = onPhase3 || onPhase1;
  if (tabsBar) tabsBar.style.display = show ? "flex" : "none";
  if (tabs) tabs.style.display = show ? "flex" : "none";
  if (phase1Nav) phase1Nav.style.display = onPhase1 ? "flex" : "none";
  if (phase3Nav) phase3Nav.style.display = onPhase3 ? "flex" : "none";
}

function applyMitarbeiterLayout() {
  document.body.classList.toggle("mitarbeiter-mode", isMitarbeiter);

  updateMainTabsBar(getActiveAppPage());

  const subtitleEl = document.getElementById("appHeaderSubtitle");
  if (subtitleEl) {
    subtitleEl.textContent = isMitarbeiter
      ? "Meine Fachskills und Soft Skills pflegen"
      : "Portfolio, Organisation & Skill-Matrix \u00b7 Transformation " + planningYearRange();
  }

  const readonlyFields = ["sk_personalnummer", "sk_nachname", "sk_vorname", "sk_email"];
  readonlyFields.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.readOnly = isMitarbeiter;
    el.classList.toggle("field-readonly", isMitarbeiter);
  });
  applySkillEmployeeCatalogReadonly();

  const skillCardText = document.querySelector("#skillPanelErfassung .card > p");
  if (skillCardText) {
    skillCardText.textContent = isMitarbeiter
      ? "Pflegen Sie hier Ihre Fachskills und Soft Skills. Stammdaten werden von Ihrem Unit Lead gepflegt."
      : "Pro Mitarbeiter Fachskills und Soft Skills (1:n) gemaess den Assessment-Vorlagen erfassen.";
  }

  if (isMitarbeiter) {
    activateSkillsPageOnly();
  } else {
    const unitPanel = document.getElementById("navPanelMitarbeiterUnit");
    if (unitPanel) unitPanel.style.display = "none";
  }
}

function activateSkillsPageOnly() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.page === "skills");
  });
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === "page-skills");
  });
  collapseSkillDetailsSections();
}

function buildUnitContextPanelHtml(unitName, unitLead, deputyLead) {
  let html = `<div class="unit-context-name">${unitName ? esc(unitName) : "Kein Unit zugewiesen"}</div>`;
  html += '<div class="unit-context-label">Unit Leiter</div>';
  if (!unitLead?.name) {
    html += '<p class="nav-empty-hint">Kein Unit Leiter zugewiesen</p>';
  } else {
    html +=
      '<p class="unit-lead-line"><span class="unit-lead-name">' +
      esc(unitLead.name) +
      '</span><span class="unit-lead-email">' +
      esc(unitLead.email || "") +
      "</span></p>";
  }
  html += '<div class="unit-context-label" style="margin-top:.45rem">Stellvertreter</div>';
  if (!deputyLead?.name) {
    html += '<p class="nav-empty-hint">Kein Stellvertreter zugewiesen</p>';
  } else {
    html +=
      '<p class="unit-lead-line"><span class="unit-lead-name">' +
      esc(deputyLead.name) +
      '</span><span class="unit-lead-email">' +
      esc(deputyLead.email || "") +
      "</span></p>";
  }
  return html;
}

async function fetchUnitContextForViewUnit() {
  const unit = getSaveUnit();
  if (!unit) return null;
  return api(`/api/auth/unit-context?unit=${encodeURIComponent(unit)}`);
}

function getUnitLeadershipFromCache(unitName) {
  const name = String(unitName || "").trim();
  if (!name) return { unitLead: null, deputyLead: null };
  const row = masterUnitsCache.find((u) => String(u.name || "") === name);
  if (!row) return { unitLead: null, deputyLead: null };
  return {
    unitLead: row.unitLead || null,
    deputyLead: row.deputyLead || null,
  };
}

const UNIT_CONTEXT_PANEL_IDS = ["portfolioUnitContext", "orgUnitContext"];

function setAllUnitContextPanelsHtml(html) {
  UNIT_CONTEXT_PANEL_IDS.forEach((id) => {
    const box = document.getElementById(id);
    if (box) box.innerHTML = html;
  });
}

async function refreshUnitContextPanels() {
  const fetchGen = ++unitContextPanelFetchGen;
  const unitLabel = getViewUnitLabel();

  if (isSuperAdminViewAll()) {
    setAllUnitContextPanelsHtml(
      '<p class="nav-empty-hint">Bitte oben im Bereich <strong>Filter</strong> eine konkrete Unit wählen.</p>'
    );
    return;
  }

  const saveUnit = getSaveUnit();

  if (isAdmin) {
    await loadMasterUnitsCache();
    if (fetchGen !== unitContextPanelFetchGen) return;
    const { unitLead, deputyLead } = getUnitLeadershipFromCache(saveUnit);
    setAllUnitContextPanelsHtml(buildUnitContextPanelHtml(unitLabel, unitLead, deputyLead));
    return;
  }

  setAllUnitContextPanelsHtml('<p class="nav-empty-hint">Wird geladen…</p>');

  try {
    const data = (await fetchUnitContextForViewUnit()) || {};
    if (fetchGen !== unitContextPanelFetchGen) return;
    setAllUnitContextPanelsHtml(
      buildUnitContextPanelHtml(unitLabel, data.unitLead, data.deputyLead)
    );
  } catch (_error) {
    if (fetchGen !== unitContextPanelFetchGen) return;
    setAllUnitContextPanelsHtml(buildUnitContextPanelHtml(unitLabel, null, null));
  }
}

function renderOrganisationUnitPanel() {
  return refreshUnitContextPanels();
}

function renderPortfolioUnitPanel() {
  return refreshUnitContextPanels();
}

async function renderMitarbeiterUnitPanel() {
  const box = document.getElementById("mitarbeiterUnitContext");
  const panel = document.getElementById("navPanelMitarbeiterUnit");
  if (!box || !panel || !isMitarbeiter) return;
  panel.style.display = "";
  box.innerHTML = '<p class="nav-empty-hint">Wird geladen…</p>';
  try {
    const data = await api("/api/auth/unit-context");
    const unitName = String(data.unit || currentUnit || "").trim();
    box.innerHTML = buildUnitContextPanelHtml(unitName, data.unitLead, data.deputyLead);
  } catch (error) {
    box.innerHTML =
      '<div class="unit-context-name">Kein Unit zugewiesen</div>' +
      '<div class="unit-context-label">Unit Lead</div>' +
      '<p class="nav-empty-hint">Kein Unit Leiter zugewiesen</p>';
  }
}

async function initMitarbeiterSkillView() {
  if (!isMitarbeiter) return;
  activateSkillsPageOnly();
  await renderMitarbeiterUnitPanel();
  const skills = load("skill");
  if (skills.length >= 1) {
    loadSkillEmployeeEntry(skills[0]);
  } else {
    await refreshEntries();
    const refreshed = load("skill");
    if (refreshed.length >= 1) {
      loadSkillEmployeeEntry(refreshed[0]);
    } else {
      toast("Kein Skill-Profil zugeordnet. Bitte Ihren Unit Lead kontaktieren.", "#e74c3c", 6000);
      resetSkillForm();
      updateSkillDeleteButton();
    }
  }
}

function roleLabel(role) {
  const labels = {
    super_admin: "Super Admin",
    admin: "Admin",
    geschaeftsfuehrung: "Geschaeftsfuehrung",
    regionalleiter: "Regionalleiter",
    unit_lead: "Unit Lead",
    mitarbeiter: "Mitarbeiter",
    backcasting: "Phase 2 · Backcasting-Planung",
    fortschritt: "Phase 3 · Fortschritt",
  };
  return labels[role] || role;
}

let editingUserUnits = [];
let adminUsersCache = [];
const adminUserSelection = new Set();
let editingUserHadSuperAdmin = false;
let editingUserSnapshot = null;

function getUserRolesList(user) {
  if (!user) return [];
  if (Array.isArray(user.roles) && user.roles.length) return user.roles;
  return user.role ? [user.role] : [];
}

function userHasRoleClient(user, role) {
  return getUserRolesList(user).includes(role);
}

function userIsUnitLeaderCandidate(user) {
  if (!user) return false;
  if (userHasRoleClient(user, "unit_lead")) return true;
  const key = normalizePositionKey("Unit Leiter");
  return (user.userPositions || []).some((position) => normalizePositionKey(position) === key);
}

const SYSTEM_HIERARCHY_ROLES = ["geschaeftsfuehrung", "regionalleiter", "unit_lead", "mitarbeiter"];
const SYSTEM_PRIVILEGE_ROLES = ["admin", "super_admin"];
const SYSTEM_APP_MODULE_ROLES = ["backcasting", "fortschritt"];
const USER_STANDORTE = ["Essen", "Bremen"];

function normalizeUserStandort(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return USER_STANDORTE.find((s) => s.toLowerCase() === trimmed.toLowerCase()) || "";
}

function setAdminStandortSelect(selectId, value) {
  const el = document.getElementById(selectId);
  if (!el) return;
  el.value = normalizeUserStandort(value);
}

const POSITION_TO_HIERARCHY_ROLE = {
  geschaeftsfuehrer: "geschaeftsfuehrung",
  "regional leiter": "regionalleiter",
  "unit leiter": "unit_lead",
  mitarbeiter: "mitarbeiter",
  berater: "mitarbeiter",
  "cc leiter": "unit_lead",
};

const HIERARCHY_ROLE_TO_POSITION = {
  geschaeftsfuehrung: "Geschäftsführer",
  regionalleiter: "Regional Leiter",
  unit_lead: "Unit Leiter",
  mitarbeiter: "Mitarbeiter",
};

function defaultPositionsForUser(user) {
  const fromCatalog = user?.userPositions || [];
  if (fromCatalog.length) return fromCatalog;
  const inferred = [];
  for (const role of getUserRolesList(user)) {
    const position = HIERARCHY_ROLE_TO_POSITION[role];
    if (position && !inferred.includes(position)) inferred.push(position);
  }
  return inferred;
}

function normalizePositionKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

function deriveHierarchyRolesFromPositions(positions) {
  const roles = [];
  for (const position of positions || []) {
    const role = POSITION_TO_HIERARCHY_ROLE[normalizePositionKey(position)];
    if (role && !roles.includes(role)) roles.push(role);
  }
  return roles;
}

function getEffectiveHierarchyRolesForUser(user) {
  const fromPositions = deriveHierarchyRolesFromPositions(user?.userPositions || []);
  const fromRoles = getUserRolesList(user).filter((role) => SYSTEM_HIERARCHY_ROLES.includes(role));
  return [...new Set([...fromPositions, ...fromRoles])];
}

function userHasEffectiveHierarchyRole(user, hierarchyRole) {
  return getEffectiveHierarchyRolesForUser(user).includes(hierarchyRole);
}

function rolesLabelForUser(user) {
  const labels = getUserRolesList(user).map(roleLabel);
  return labels.length ? labels.join(", ") : "–";
}

function systemPrivilegeRolesLabel(user) {
  const labels = getUserRolesList(user)
    .filter((role) => SYSTEM_PRIVILEGE_ROLES.includes(role))
    .map(roleLabel);
  return labels.length ? labels.join(", ") : "–";
}

function systemAppModuleRolesLabel(user) {
  const labels = getUserRolesList(user)
    .filter((role) => SYSTEM_APP_MODULE_ROLES.includes(role))
    .map(roleLabel);
  if (isAdminRoleClient(user)) {
    return labels.length ? `${labels.join(", ")} (Admin)` : "alle (Admin)";
  }
  return labels.length ? labels.join(", ") : "–";
}

function isAdminRoleClient(user) {
  return getUserRolesList(user).some((role) => SYSTEM_PRIVILEGE_ROLES.includes(role));
}

function userOrgRolesLabel(user) {
  const list = user?.userOrgRoles || [];
  return list.length ? list.join(", ") : "–";
}

function userPositionsLabel(user) {
  const list = user?.userPositions || [];
  return list.length ? list.join(", ") : "–";
}

function adminPrivilegeRolesContainerId(prefix) {
  return prefix === "adm_" ? "adm_privilege_roles_select" : "adm_edit_privilege_roles_select";
}

function adminAppModuleRolesContainerId(prefix) {
  return prefix === "adm_" ? "adm_app_module_roles_select" : "adm_edit_app_module_roles_select";
}

function adminUserOrgRolesContainerId(prefix) {
  return prefix === "adm_" ? "adm_user_org_roles_select" : "adm_edit_user_org_roles_select";
}

function adminUserPositionsContainerId(prefix) {
  return prefix === "adm_" ? "adm_user_positions_select" : "adm_edit_user_positions_select";
}

function getCheckedFromContainer(containerId, dataAttr) {
  const box = document.getElementById(containerId);
  if (!box) return [];
  return [...box.querySelectorAll(`input[${dataAttr}]:checked`)]
    .map((el) => el.getAttribute(dataAttr))
    .filter(Boolean);
}

function getAdminPrivilegeRoles(prefix) {
  return getCheckedFromContainer(adminPrivilegeRolesContainerId(prefix), "data-admin-role");
}

function getAdminAppModuleRoles(prefix) {
  if (!adminFormEligibleForAppModules(prefix)) return [];
  if (adminFormHasPrivilegeAdmin(prefix)) return [...SYSTEM_APP_MODULE_ROLES];
  return getCheckedFromContainer(adminAppModuleRolesContainerId(prefix), "data-app-module");
}

function getAdminFormRoles(prefix) {
  const privilege = getAdminPrivilegeRoles(prefix);
  const appModules = getAdminAppModuleRoles(prefix);
  const hierarchy = deriveHierarchyRolesFromPositions(getAdminUserPositionNames(prefix));
  return [...hierarchy, ...privilege, ...appModules];
}

function resolveUserOrgRoleIds(user) {
  const ids = normalizeBigIntArrayClient(user?.userOrgRoleIds);
  if (ids.length) return ids;
  return (user?.userOrgRoles || [])
    .map((name) => adminAppRolesCache.find((r) => r.name === name)?.id)
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function resolveUserPositionIds(user) {
  const ids = normalizeBigIntArrayClient(user?.userPositionIds);
  if (ids.length) return ids;
  return (user?.userPositions || [])
    .map((name) => adminAppPositionsCache.find((p) => p.name === name)?.id)
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function normalizeBigIntArrayClient(values) {
  if (!values) return [];
  const list = Array.isArray(values) ? values : [values];
  return [
    ...new Set(
      list
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];
}

function getAdminRolesCatalogForForm() {
  if (adminAppRolesCache.length) return sortCatalogItems(adminAppRolesCache);
  if (appRolesCatalog.length) return sortCatalogItems(appRolesCatalog);
  return getCatalogRoleNamesForUserForm().map((name) => ({ id: name, name }));
}

function getAdminPositionsCatalogForForm() {
  if (adminAppPositionsCache.length) return sortCatalogItems(adminAppPositionsCache);
  if (appPositionsCatalog.length) return sortCatalogItems(appPositionsCatalog);
  return getCatalogPositionNamesForUserForm().map((name) => ({ id: name, name }));
}

function resolveAdminOrgRoleIdsFromNames(names) {
  const catalog = getAdminRolesCatalogForForm();
  return [
    ...new Set(
      (names || [])
        .map((name) => {
          const item = catalog.find((r) => (r.name || r) === name);
          return Number(item?.id);
        })
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];
}

function resolveAdminPositionIdsFromNames(names) {
  const catalog = getAdminPositionsCatalogForForm();
  return [
    ...new Set(
      (names || [])
        .map((name) => {
          const item = catalog.find((p) => (p.name || p) === name);
          return Number(item?.id);
        })
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];
}

function getAdminUserOrgRoleIds(prefix) {
  const containerId = adminUserOrgRolesContainerId(prefix);
  const fromIds = getCheckedFromContainer(containerId, "data-user-org-role-id")
    .map((id) => Number(id))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (fromIds.length) return fromIds;
  return resolveAdminOrgRoleIdsFromNames(
    getCheckedFromContainer(containerId, "data-user-org-role")
  );
}

function getAdminUserPositionIds(prefix) {
  const containerId = adminUserPositionsContainerId(prefix);
  const fromIds = getCheckedFromContainer(containerId, "data-user-position-id")
    .map((id) => Number(id))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (fromIds.length) return fromIds;
  return resolveAdminPositionIdsFromNames(
    getCheckedFromContainer(containerId, "data-user-position")
  );
}

function getAdminUserPositionNames(prefix) {
  const ids = getAdminUserPositionIds(prefix);
  return ids
    .map((id) => getAdminPositionsCatalogForForm().find((p) => Number(p.id) === id)?.name)
    .filter(Boolean);
}

function getAdminUserOrgRoleNames(prefix) {
  const ids = getAdminUserOrgRoleIds(prefix);
  return ids
    .map((id) => getAdminRolesCatalogForForm().find((r) => Number(r.id) === id)?.name)
    .filter(Boolean);
}

function hasMitarbeiterPosition(prefix) {
  return getAdminUserPositionNames(prefix).some(
    (position) => POSITION_TO_HIERARCHY_ROLE[normalizePositionKey(position)] === "mitarbeiter"
  );
}

function hasUnitLeadPosition(prefix) {
  return getAdminUserPositionNames(prefix).some(
    (position) => POSITION_TO_HIERARCHY_ROLE[normalizePositionKey(position)] === "unit_lead"
  );
}

function hasRegionalleiterPosition(prefix) {
  return getAdminUserPositionNames(prefix).some(
    (position) => POSITION_TO_HIERARCHY_ROLE[normalizePositionKey(position)] === "regionalleiter"
  );
}

function adminFormRequiresRegionalleiter(prefix) {
  const roles = getAdminFormRoles(prefix);
  return roles.includes("unit_lead") || hasUnitLeadPosition(prefix);
}

function adminFormRequiresRegionalleiterFields(prefix) {
  const roles = getAdminFormRoles(prefix);
  return roles.includes("regionalleiter") || hasRegionalleiterPosition(prefix);
}

function resolveUnitLeadFromMasterUnit(unitName) {
  if (!unitName) return { id: null, name: null };
  const row = masterUnitsCache.find((u) => u.name === unitName);
  const lead = row?.unitLead;
  return { id: lead?.id || null, name: lead?.name || null };
}

function updateMitarbeiterUnitLeadAutoHint(prefix) {
  const hint = document.getElementById(
    prefix === "adm_edit_" ? "adm_edit_unit_lead_auto_hint" : "adm_unit_lead_auto_hint"
  );
  if (!hint) return;
  const isMitarbeiter =
    getAdminFormRoles(prefix).includes("mitarbeiter") || hasMitarbeiterPosition(prefix);
  if (!isMitarbeiter) {
    hint.style.display = "none";
    return;
  }
  const units = getSelectedAdminUnits(
    prefix === "adm_edit_" ? "adm_edit_units_select" : "adm_units_select"
  );
  const unitName = units[0] || "";
  hint.style.display = "";
  if (!unitName) {
    hint.textContent =
      "Vorgesetzter (Unit Leiter) wird automatisch aus der gewaehlten Unit übernommen.";
    return;
  }
  const { name } = resolveUnitLeadFromMasterUnit(unitName);
  hint.textContent = name
    ? `Vorgesetzter (Unit Leiter): ${name} (automatisch aus Unit „${unitName}“)`
    : `Fuer Unit „${unitName}“ ist noch kein Unit Leiter hinterlegt (unter Units verwalten).`;
}

function resolveMitarbeiterUnitLeadId(prefix, units) {
  const manual =
    document.getElementById(prefix === "adm_edit_" ? "adm_edit_unit_lead_id" : "adm_unit_lead_id")
      ?.value || "";
  if (manual) return Number(manual);
  const unitName = Array.isArray(units) && units.length ? units[0] : "";
  return resolveUnitLeadFromMasterUnit(unitName).id;
}

function needsSuperAdminGrantPassword(prefix, hadSuperAdmin = false) {
  return getAdminFormRoles(prefix).includes("super_admin") && !hadSuperAdmin;
}

function getSuperAdminGrantPassword(prefix) {
  const id = prefix === "adm_" ? "adm_super_admin_pw" : "adm_edit_super_admin_pw";
  return document.getElementById(id)?.value || "";
}

function updateSuperAdminPasswordField(prefix, hadSuperAdmin = false) {
  const wrapId = prefix === "adm_" ? "adm_super_admin_pw_wrap" : "adm_edit_super_admin_pw_wrap";
  const inputId = prefix === "adm_" ? "adm_super_admin_pw" : "adm_edit_super_admin_pw";
  const wrap = document.getElementById(wrapId);
  const input = document.getElementById(inputId);
  const needsPassword = needsSuperAdminGrantPassword(prefix, hadSuperAdmin);
  if (wrap) wrap.style.display = needsPassword ? "" : "none";
  if (input && !needsPassword) input.value = "";
}

function validateSuperAdminGrantPassword(prefix, hadSuperAdmin, errEl) {
  if (!needsSuperAdminGrantPassword(prefix, hadSuperAdmin)) return true;
  if (getSuperAdminGrantPassword(prefix) !== "234") {
    if (errEl) {
      errEl.textContent = "Super Admin erfordert das korrekte Freischalt-Passwort.";
      errEl.style.display = "block";
    }
    return false;
  }
  return true;
}

function setAdminSystemRoles(prefix, roles) {
  const list = new Set(Array.isArray(roles) ? roles : []);
  const box = document.getElementById(adminPrivilegeRolesContainerId(prefix));
  box?.querySelectorAll("input[data-admin-role]").forEach((el) => {
    el.checked = list.has(el.getAttribute("data-admin-role"));
    el.disabled = false;
  });
  updateSuperAdminPasswordField(prefix, prefix === "adm_edit_" ? editingUserHadSuperAdmin : false);
}

function setAdminAppModuleRoles(prefix, roles) {
  const list = new Set(Array.isArray(roles) ? roles : []);
  const box = document.getElementById(adminAppModuleRolesContainerId(prefix));
  box?.querySelectorAll("input[data-app-module]").forEach((el) => {
    el.checked = list.has(el.getAttribute("data-app-module"));
  });
  syncAdminAppModuleRolesState(prefix);
}

function hasDeputyUnitLeaderPosition(prefix) {
  const key = normalizePositionKey(DEPUTY_UNIT_LEADER_POSITION);
  return getAdminUserPositionNames(prefix).some((position) => normalizePositionKey(position) === key);
}

function adminFormEligibleForAppModules(prefix) {
  if (adminFormHasPrivilegeAdmin(prefix)) return true;
  const hierarchy = deriveHierarchyRolesFromPositions(getAdminUserPositionNames(prefix));
  if (hierarchy.includes("unit_lead") || hierarchy.includes("regionalleiter")) return true;
  if (hasDeputyUnitLeaderPosition(prefix)) return true;
  return false;
}

function updateAdminAppModuleSection(prefix) {
  const section = document.getElementById(
    prefix === "adm_edit_" ? "adm_edit_app_module_section" : "adm_app_module_section"
  );
  if (section) section.style.display = adminFormEligibleForAppModules(prefix) ? "" : "none";
  syncAdminAppModuleRolesState(prefix);
}

function syncAdminAppModuleRolesState(prefix) {
  const box = document.getElementById(adminAppModuleRolesContainerId(prefix));
  if (!box) return;
  const eligible = adminFormEligibleForAppModules(prefix);
  const forceAll = adminFormHasPrivilegeAdmin(prefix);
  const stored = editingUserSnapshot?.appModuleRoles || [];
  box.querySelectorAll("input[data-app-module]").forEach((el) => {
    const mod = el.getAttribute("data-app-module");
    if (!eligible) {
      el.checked = false;
      el.disabled = true;
    } else if (forceAll) {
      el.checked = true;
      el.disabled = true;
    } else {
      el.disabled = false;
      if (prefix === "adm_edit_" && editingUserSnapshot) {
        el.checked = stored.includes(mod);
      }
    }
  });
}

function adminFormHasPrivilegeAdmin(prefix) {
  return getAdminPrivilegeRoles(prefix).some((role) => SYSTEM_PRIVILEGE_ROLES.includes(role));
}

function setAdminFormRoles(prefix, roles) {
  setAdminSystemRoles(prefix, roles);
  setAdminAppModuleRoles(prefix, roles);
}

function setAdminUserCatalogFields(prefix, userOrgRoleIds, userPositionIds) {
  const orgIds = normalizeBigIntArrayClient(userOrgRoleIds);
  const posIds = normalizeBigIntArrayClient(userPositionIds);
  const orgSet = new Set(orgIds.map((id) => String(id)));
  const posSet = new Set(posIds.map((id) => String(id)));
  const orgNames = new Set(
    orgIds
      .map((id) => getAdminRolesCatalogForForm().find((r) => Number(r.id) === id)?.name)
      .filter(Boolean)
  );
  const posNames = new Set(
    posIds
      .map((id) => getAdminPositionsCatalogForForm().find((p) => Number(p.id) === id)?.name)
      .filter(Boolean)
  );
  const orgBox = document.getElementById(adminUserOrgRolesContainerId(prefix));
  const posBox = document.getElementById(adminUserPositionsContainerId(prefix));
  orgBox?.querySelectorAll("input[data-user-org-role-id]").forEach((el) => {
    el.checked = orgSet.has(el.getAttribute("data-user-org-role-id"));
  });
  orgBox?.querySelectorAll("input[data-user-org-role]").forEach((el) => {
    el.checked = orgNames.has(el.getAttribute("data-user-org-role"));
  });
  posBox?.querySelectorAll("input[data-user-position-id]").forEach((el) => {
    el.checked = posSet.has(el.getAttribute("data-user-position-id"));
  });
  posBox?.querySelectorAll("input[data-user-position]").forEach((el) => {
    el.checked = posNames.has(el.getAttribute("data-user-position"));
  });
}

function getCatalogRoleNamesForUserForm() {
  if (adminAppRolesCache.length) return adminAppRolesCache.map((r) => r.name);
  return typeof ORG_ROLLEN !== "undefined" ? ORG_ROLLEN : [];
}

function getCatalogPositionNamesForUserForm() {
  if (adminAppPositionsCache.length) return adminAppPositionsCache.map((p) => p.name);
  return typeof APP_POSITIONS !== "undefined" ? APP_POSITIONS : [];
}

async function ensureAdminUserFormCatalogs() {
  if (!appRolesCatalog.length || !appPositionsCatalog.length) {
    await loadAppRolePositionCatalogFromApi();
  }
  if (!adminAppRolesCache.length || !adminAppPositionsCache.length) {
    await Promise.all([loadAdminAppRolesCache(), loadAdminAppPositionsCache()]);
  }
}

function renderAdminUserCatalogCheckboxes(prefix, selectedOrgRoleIds = null, selectedPositionIds = null) {
  const roles = getAdminRolesCatalogForForm();
  const positions = getAdminPositionsCatalogForForm();
  const orgId = adminUserOrgRolesContainerId(prefix);
  const posId = adminUserPositionsContainerId(prefix);
  const orgSelected =
    selectedOrgRoleIds !== null
      ? normalizeBigIntArrayClient(selectedOrgRoleIds)
      : getAdminUserOrgRoleIds(prefix);
  const posSelected =
    selectedPositionIds !== null
      ? normalizeBigIntArrayClient(selectedPositionIds)
      : getAdminUserPositionIds(prefix);
  const orgBox = document.getElementById(orgId);
  const posBox = document.getElementById(posId);
  if (orgBox) {
    orgBox.innerHTML = roles.length
      ? roles
          .map((item) => {
            const id = Number(item.id);
            const name = item.name || item;
            if (!Number.isInteger(id) || id <= 0) {
              return `<label class="unit-checkbox-item"><input type="checkbox" data-user-org-role="${escAttr(name)}"> ${esc(name)}</label>`;
            }
            return `<label class="unit-checkbox-item"><input type="checkbox" data-user-org-role-id="${id}"> ${esc(name)}</label>`;
          })
          .join("")
      : '<p style="color:var(--rc-muted);font-size:.75rem;margin:0">Keine Rollen im Katalog.</p>';
  }
  if (posBox) {
    posBox.innerHTML = positions.length
      ? positions
          .map((item) => {
            const id = Number(item.id);
            const name = item.name || item;
            if (!Number.isInteger(id) || id <= 0) {
              return `<label class="unit-checkbox-item"><input type="checkbox" data-user-position="${escAttr(name)}"> ${esc(name)}</label>`;
            }
            return `<label class="unit-checkbox-item"><input type="checkbox" data-user-position-id="${id}"> ${esc(name)}</label>`;
          })
          .join("")
      : '<p style="color:var(--rc-muted);font-size:.75rem;margin:0">Keine Positionen im Katalog.</p>';
  }
  setAdminUserCatalogFields(prefix, orgSelected, posSelected);
}

function adminGeschaeftsfuehrungContainerId(prefix) {
  return prefix === "adm_" ? "adm_geschaeftsfuehrung_select" : "adm_edit_geschaeftsfuehrung_select";
}

function resolveGeschaeftsfuehrungIds(user) {
  const ids = normalizeBigIntArrayClient(user?.geschaeftsfuehrungIds || user?.geschaeftsfuehrung_ids);
  if (ids.length) return ids;
  if (user?.geschaeftsfuehrung_id) return [Number(user.geschaeftsfuehrung_id)];
  return [];
}

function getAdminGeschaeftsfuehrungIds(prefix) {
  const box = document.getElementById(adminGeschaeftsfuehrungContainerId(prefix));
  if (!box) return [];
  return [...box.querySelectorAll('input[data-geschaeftsfuehrung-id]:checked')]
    .map((el) => Number(el.getAttribute("data-geschaeftsfuehrung-id")))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function renderGeschaeftsfuehrungCheckboxes(prefix, selectedIds, excludeUserId) {
  const box = document.getElementById(adminGeschaeftsfuehrungContainerId(prefix));
  if (!box) return;
  const selected = new Set(normalizeBigIntArrayClient(selectedIds));
  const options = adminUsersCache
    .filter(
      (u) =>
        userHasEffectiveHierarchyRole(u, "geschaeftsfuehrung") &&
        String(u.id) !== String(excludeUserId || "")
    )
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "de"));
  box.innerHTML = options.length
    ? options
        .map((gf) => {
          const id = Number(gf.id);
          const checked = selected.has(id) ? " checked" : "";
          return (
            `<label class="unit-checkbox-item">` +
            `<input type="checkbox" data-geschaeftsfuehrung-id="${id}"${checked}> ` +
            `${esc(gf.name)}` +
            `</label>`
          );
        })
        .join("")
    : '<p style="color:var(--rc-muted);font-size:.75rem;margin:0">Keine Geschaeftsfuehrung im System.</p>';
}

function renderRegionalleiterSelect(selectId, selectedId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const options = adminUsersCache.filter((u) => userHasEffectiveHierarchyRole(u, "regionalleiter"));
  const selected = selectedId ? String(selectedId) : "";
  sel.innerHTML =
    '<option value="">– Regionalleiter waehlen –</option>' +
    options
      .map((r) => {
        const label = r.standort ? `${r.name} (${r.standort})` : r.name;
        return `<option value="${r.id}"${
          String(r.id) === selected ? " selected" : ""
        }>${esc(label)}</option>`;
      })
      .join("");
}

function renderUnitLeadSelect(selectId, selectedId, preferredUnits = []) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const units = Array.isArray(preferredUnits) ? preferredUnits.filter(Boolean) : [];
  let options = adminUsersCache.filter((u) => userHasEffectiveHierarchyRole(u, "unit_lead"));
  if (units.length) {
    const matched = options.filter((ul) =>
      (ul.units || []).some((unit) => units.includes(unit))
    );
    if (matched.length) options = matched;
  }
  const selected = selectedId ? String(selectedId) : "";
  sel.innerHTML =
    '<option value="">– Unit Lead waehlen –</option>' +
    options
      .map((ul) => {
        const unitLabel = (ul.units || []).join(", ") || "ohne Unit";
        const rl = adminUsersCache.find((u) => String(u.id) === String(ul.regionalleiter_id));
        const region = rl?.standort ? `, Region ${rl.standort}` : "";
        const label = `${ul.name} (${unitLabel}${region})`;
        return `<option value="${ul.id}"${
          String(ul.id) === selected ? " selected" : ""
        }>${esc(label)}</option>`;
      })
      .join("");
}

function userSupervisorLabel(user, allUsers) {
  const roles = getEffectiveHierarchyRolesForUser(user);
  const users = Array.isArray(allUsers) ? allUsers : [];

  if (roles.includes("mitarbeiter")) {
    if (user.unitLeadName) return esc(user.unitLeadName);
    const lead = users.find((u) => String(u.id) === String(user.unit_lead_id));
    return lead?.name ? esc(lead.name) : "–";
  }

  if (roles.includes("unit_lead")) {
    if (user.regionalleiterName) return esc(user.regionalleiterName);
    const rl = users.find((u) => String(u.id) === String(user.regionalleiter_id));
    return rl?.name ? esc(rl.name) : "–";
  }

  if (roles.includes("regionalleiter")) {
    const gfIds = resolveGeschaeftsfuehrungIds(user);
    const gfNames = gfIds
      .map((id) => users.find((u) => String(u.id) === String(id))?.name)
      .filter(Boolean);
    if (gfNames.length) return esc(gfNames.join(", "));
    if (user.geschaeftsfuehrungName) return esc(user.geschaeftsfuehrungName);
    return "–";
  }

  return "–";
}

function updateAdminRoleFieldsVisibility(prefix = "adm_") {
  const roles = getAdminFormRoles(prefix);
  const needsUnits = roles.some((role) => isUnitScopedSession(role));
  const label = document.getElementById(prefix === "adm_" ? "adm_units_label" : "adm_edit_units_label");
  const hint = document.getElementById(prefix === "adm_" ? "adm_units_hint" : "adm_edit_units_hint");
  const box = document.getElementById(prefix === "adm_" ? "adm_units_select" : "adm_edit_units_select");
  const standortWrap = document.getElementById(prefix === "adm_" ? "adm_standort_wrap" : "adm_edit_standort_wrap");
  const gfWrap = document.getElementById(
    prefix === "adm_" ? "adm_geschaeftsfuehrung_wrap" : "adm_edit_geschaeftsfuehrung_wrap"
  );
  const regionalWrap = document.getElementById(
    prefix === "adm_" ? "adm_regionalleiter_wrap" : "adm_edit_regionalleiter_wrap"
  );
  const unitLeadWrap = document.getElementById(
    prefix === "adm_" ? "adm_unit_lead_wrap" : "adm_edit_unit_lead_wrap"
  );
  if (label) label.style.display = needsUnits ? "" : "none";
  if (hint) {
    hint.style.display = needsUnits ? "" : "none";
    if (needsUnits) {
      hint.textContent = roles.includes("mitarbeiter")
        ? "Genau eine Unit auswaehlen."
        : "Mehrere Units auswaehlen. Pro Unit kann es mehrere Unit Leads und Mitarbeiter geben.";
    }
  }
  if (box) box.style.display = needsUnits ? "" : "none";
  if (standortWrap) standortWrap.style.display = adminFormRequiresRegionalleiterFields(prefix) ? "" : "none";
  if (gfWrap) gfWrap.style.display = adminFormRequiresRegionalleiterFields(prefix) ? "" : "none";
  if (regionalWrap) regionalWrap.style.display = adminFormRequiresRegionalleiter(prefix) ? "" : "none";
  if (unitLeadWrap) unitLeadWrap.style.display = "none";
}

function updateAdminUnitsFieldVisibility() {
  updateAdminRoleFieldsVisibility("adm_");
}

async function onAdminAddRolesChange() {
  const roles = getAdminFormRoles("adm_");
  const preserved = getSelectedAdminUnits("adm_units_select");
  updateAdminRoleFieldsVisibility("adm_");
  updateSuperAdminPasswordField("adm_", false);
  if (adminFormRequiresRegionalleiterFields("adm_")) {
    renderGeschaeftsfuehrungCheckboxes("adm_", [], null);
  }
  if (adminFormRequiresRegionalleiter("adm_")) {
    renderRegionalleiterSelect("adm_regionalleiter_id", null);
  }
  updateMitarbeiterUnitLeadAutoHint("adm_");
  if (!roles.some((role) => isUnitScopedSession(role))) return;
  const pick = roles.includes("mitarbeiter") && preserved.length > 1 ? [preserved[0]] : preserved;
  await refreshAdminUnitCheckboxes("adm_units_select", pick);
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

function onAdminUnitsSelectionChange(event) {
  const box = event.target.closest("#adm_units_select, #adm_edit_units_select");
  if (!box || event.target.type !== "checkbox") return;
  if (box.id === "adm_units_select") updateMitarbeiterUnitLeadAutoHint("adm_");
  if (box.id === "adm_edit_units_select") updateMitarbeiterUnitLeadAutoHint("adm_edit_");
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
}

async function refreshAdminUnitCheckboxes(containerId, selected) {
  await loadMasterUnitsCache();
  renderAdminUnitCheckboxes(containerId, selected || []);
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

function setSessionBootState(state) {
  const body = document.body;
  if (!body) return;
  body.classList.toggle("session-booting", state === "booting");
  body.classList.toggle("session-unauthenticated", state === "unauthenticated");
  const splash = document.getElementById("sessionBootSplash");
  if (splash) splash.style.display = state === "booting" ? "" : "none";
}

function showLoginScreen() {
  setSessionBootState("unauthenticated");
  setLoginPasswordVisible(false);
  const login = document.getElementById("loginOverlay");
  if (login) login.style.display = "flex";
  const header = document.getElementById("appHeader");
  const tabsBar = document.getElementById("tabsBar");
  const tabs = document.getElementById("tabs");
  const main = document.getElementById("appMain");
  if (header) header.style.display = "none";
  if (tabsBar) tabsBar.style.display = "none";
  if (tabs) tabs.style.display = "none";
  if (main) main.style.display = "none";
}

function setLoginPasswordVisible(visible) {
  const input = document.getElementById("loginPassword");
  const btn = document.getElementById("loginPasswordToggle");
  if (!input || !btn) return;
  input.type = visible ? "text" : "password";
  const label = visible ? "Passwort verbergen" : "Passwort anzeigen";
  btn.setAttribute("aria-label", label);
  btn.setAttribute("aria-pressed", visible ? "true" : "false");
  btn.title = label;
  btn.querySelector(".login-form__eye--show")?.toggleAttribute("hidden", visible);
  btn.querySelector(".login-form__eye--hide")?.toggleAttribute("hidden", !visible);
}

function initLoginPasswordToggle() {
  document.getElementById("loginPasswordToggle")?.addEventListener("click", () => {
    const input = document.getElementById("loginPassword");
    if (!input) return;
    setLoginPasswordVisible(input.type === "password");
  });
}

async function doLogin(){
  const email=document.getElementById('loginEmail').value.trim().toLowerCase();
  const password=document.getElementById('loginPassword').value;
  const errEl=document.getElementById('loginError');
  errEl.textContent='';
  if(!email||!password){errEl.textContent='Bitte E-Mail und Passwort ausfuellen.';return}
  try {
    const session = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    currentUnit = session.unit;
    currentName = session.name;
    currentEmail = session.email;
    isAdmin = userIsAdminFromSession(session);
    isSuperAdmin = session.role === "super_admin";
    isMitarbeiter = isPureMitarbeiterUser(session);
    currentSkillEntryId = session.skillEntryId || null;
    currentPersonalnummer = session.personalnummer || "";
    userUnits = normalizeUserUnits(session.units);
    userModules = session.modules || { backcasting: false, fortschritt: false };
    if (await maybeRedirectToReturnUrl(userModules)) return;
    await showApp({ fromLogin: true });
  } catch (error) {
    errEl.textContent = error.message;
  }
}

async function doLogout(){
  const wasMitarbeiter = document.body.classList.contains("mitarbeiter-mode");
  window.rcPresence?.stop?.();
  try { await api("/api/auth/logout", { method: "POST" }); } catch (_e) {}
  currentUnit='';currentName='';currentEmail='';isAdmin=false;isSuperAdmin=false;isMitarbeiter=false;userModules={ backcasting: false, fortschritt: false };currentSkillEntryId=null;currentPersonalnummer='';superAdminViewUnit='all';userUnits=[];
  rcViewUnitPersist?.clearPersistedViewUnit?.();
  document.body.classList.remove("mitarbeiter-mode");
  entryStore = { portfolio: [], organisation: [], skill: [] };
  if (!wasMitarbeiter) {
    switchTab("portfolio");
    updateAppModuleNavActive("portfolio");
  }
  showLoginScreen();
}

function getDirectNavPageFromQuery() {
  if (isMitarbeiter) return "";
  const page = new URLSearchParams(window.location.search).get("page");
  if ((page === "admin" || page === "demo-daten") && isAdmin) return "admin";
  if (PHASE3_TAB_PAGES.includes(page) && canAccessPhase3Area()) return page;
  return "";
}

function revealAuthenticatedAppShell() {
  const login = document.getElementById("loginOverlay");
  const header = document.getElementById("appHeader");
  const main = document.getElementById("appMain");
  const nameEl = document.getElementById("headerName");
  if (login) login.style.display = "none";
  if (header) header.style.display = "flex";
  if (main) main.style.display = "block";
  if (nameEl) nameEl.textContent = `${currentName} (${currentEmail})`;
  setSessionBootState("authenticated");
}

async function showApp(options = {}){
  const fromLogin = Boolean(options.fromLogin);
  const directPage = fromLogin ? "" : getDirectNavPageFromQuery();
  const lightBoot = Boolean(directPage);

  initHeaderViewUnit();
  revealAuthenticatedAppShell();
  applyMitarbeiterLayout();
  initHeaderUnitSwitcher();
  updateHeaderUnitDisplay();
  updateSuperAdminFormMode();
  checkAdmin();
  initDeployInfo();
  updateAppModuleLauncher(userModules);

  const bootTasks = [renderHeaderUnitSwitcher(), loadPlanningYears()];
  if (!lightBoot) {
    bootTasks.push(
      loadSkillCategoriesFromApi(),
      loadAppRolePositionCatalogFromApi(),
      refreshEntries()
    );
    if (!isMitarbeiter) bootTasks.push(loadSkillPersonalnummerLookup());
  }
  await Promise.all(bootTasks);

  if (fromLogin) {
    resetAppViewToDefaults();
    await renderHeaderUnitSwitcher();
  }

  if (isMitarbeiter) {
    await initMitarbeiterSkillView();
  } else if (!lightBoot) {
    renderPortfolio();
    renderOrganisation();
    initAllSaveButtonTrackers();
    renderSkillEmployeeNav();
    updateSkillDeleteButton();
    renderOverview();
  }

  collapseAllCollapsibleSections(document.getElementById("appMain"));
  applyPageFromQuery({ skipFortschritt: fromLogin });

  if (!lightBoot) {
    if (isAdmin) void initAdminPage();
    if (!isMitarbeiter) void refreshUnitContextPanels();
  }
  startPresenceTracking();
}

function applyPageFromQuery(options = {}) {
  if (isMitarbeiter) return;
  const page = new URLSearchParams(window.location.search).get("page");
  if (page === "admin" && isAdmin) {
    const adminTab = getAdminTabFromQuery();
    if (adminTab) adminSubtab = adminTab;
    switchTab("admin");
    initAdminPage();
    clearAppPageQueryFromUrl();
    return;
  }
  if (options.skipFortschritt) {
    if (window.history && window.history.replaceState) {
      const params = new URLSearchParams(window.location.search);
      if (params.has("page")) {
        params.delete("page");
        params.delete("adminTab");
        const qs = params.toString();
        window.history.replaceState({}, "", qs ? `/?${qs}` : "/");
      }
    }
    return;
  }
  if (page === "demo-daten") {
    if (!canAccessDemoDaten()) return;
    adminSubtab = "demo";
    switchTab("admin");
    initAdminPage();
    clearAppPageQueryFromUrl();
    return;
  }
  if (PHASE3_TAB_PAGES.includes(page)) {
    if (!canAccessPhase3Area()) return;
    switchTab(page);
    if (page === "gesamtfortschritt") renderGesamtfortschrittDashboard();
    else if (page === "fortschritt") renderFortschrittDashboard();
    else renderFortschrittErlaeuterungPage();
    clearAppPageQueryFromUrl();
  }
}

async function bootSession() {
  setSessionBootState("booting");
  try {
    const me = await api("/api/auth/me");
    currentUnit = me.unit;
    currentName = me.name;
    currentEmail = me.email;
    isAdmin = userIsAdminFromSession(me);
    isSuperAdmin = me.role === "super_admin";
    isMitarbeiter = isPureMitarbeiterUser(me);
    currentSkillEntryId = me.skillEntryId || null;
    currentPersonalnummer = me.personalnummer || "";
    userUnits = normalizeUserUnits(me.units);
    userModules = me.modules || { backcasting: false, fortschritt: false };
    if (await maybeRedirectToReturnUrl(userModules)) return;
    await showApp();
  } catch (_e) {
    showLoginScreen();
  }
}

function getPostLoginRedirectUrl() {
  const params = new URLSearchParams(window.location.search);
  const ret = params.get("return");
  if (!ret || !ret.startsWith("/") || ret.startsWith("//")) return "";
  return ret;
}

async function maybeRedirectToReturnUrl(modules) {
  const ret = getPostLoginRedirectUrl();
  if (!ret) return false;
  if (ret.startsWith("/backcasting") && !modules?.backcasting) return false;
  window.location.replace(ret);
  return true;
}

function updateAppModuleLauncher(modules) {
  const phasesBar = document.getElementById("headerPhasesBar");
  const link = document.getElementById("launcherBackcasting");
  const fsLink = document.getElementById("launcherFortschritt");
  if (!phasesBar) return;
  const showBackcasting = Boolean(modules?.backcasting) || isAdmin;
  const showFortschritt = (Boolean(modules?.fortschritt) || isAdmin) && !isMitarbeiter;
  const showNav = showBackcasting || showFortschritt;
  phasesBar.style.display = showNav ? "" : "none";
  if (link) link.style.display = showBackcasting ? "" : "none";
  if (fsLink) fsLink.style.display = showFortschritt ? "" : "none";
}

function bindAppModuleNavClicks() {
  document.getElementById("launcherBackcasting")?.addEventListener("click", (e) => {
    const appMain = document.getElementById("appMain");
    if (!appMain || appMain.style.display === "none") return;
    e.preventDefault();
    const target = rcViewUnitPersist?.appendViewUnitToUrl?.("/backcasting/", superAdminViewUnit) || "/backcasting/";
    window.location.assign(target);
  });
  document.getElementById("launcherFortschritt")?.addEventListener("click", (e) => {
    const appMain = document.getElementById("appMain");
    if (!appMain || appMain.style.display === "none") return;
    if (isMitarbeiter || !canAccessPhase3Area()) return;
    e.preventDefault();
    switchTab("gesamtfortschritt");
    renderGesamtfortschrittDashboard();
  });
  document.getElementById("launcherPhase1")?.addEventListener("click", (e) => {
    const appMain = document.getElementById("appMain");
    if (!appMain || appMain.style.display === "none") return;
    if (isMitarbeiter) return;
    e.preventDefault();
    const active = getActiveAppPage();
    if (active === "portfolio") return;
    switchTab("portfolio");
    renderPortfolio();
    void refreshUnitContextPanels();
  });
  document.getElementById("launcherAdmin")?.addEventListener("click", (e) => {
    const appMain = document.getElementById("appMain");
    if (!appMain || appMain.style.display === "none") return;
    if (!isAdmin) return;
    e.preventDefault();
    switchTab("admin");
    void initAdminPage();
  });
}

// ===== TABS =====
document.querySelectorAll("#tabs .tab").forEach((t) => {
  t.addEventListener("click", () => {
  if (isMitarbeiter && t.dataset.page !== "skills") return;
  const p = t.dataset.page;
  switchTab(p);
  if (p === "overview") renderOverview();
  if (p === "export") renderExportStats();
  if (p === "admin") initAdminPage();
  if (p === "gesamtfortschritt") renderGesamtfortschrittDashboard();
  if (p === "fortschritt") renderFortschrittDashboard();
  if (p === "fortschritt-new" && typeof initFortschrittNew === "function") initFortschrittNew();
  if (p === "fortschritt-erlaeuterung") renderFortschrittErlaeuterungPage();
  if (p === "portfolio") {
    renderPortfolio();
    refreshUnitContextPanels();
  }
  if (p === "organisation") {
    renderOrganisation();
    refreshUnitContextPanels();
  }
  if (p === "skills") {
    loadSkillPersonalnummerLookup().then(() => {
      renderSkillEmployeeNav();
      updateSkillDeleteButton();
    });
  }
});
});

function updateAppModuleNavActive(page) {
  const phase1 = document.getElementById("launcherPhase1");
  const bcLink = document.getElementById("launcherBackcasting");
  const fsLink = document.getElementById("launcherFortschritt");
  const adminLink = document.getElementById("launcherAdmin");
  const onPhase3 = isPhase3AppPage(page);
  if (phase1) {
    phase1.classList.toggle("is-active", !onPhase3 && page !== "admin");
    if (onPhase3 || page === "admin") phase1.removeAttribute("aria-current");
    else phase1.setAttribute("aria-current", "page");
  }
  if (bcLink) bcLink.classList.remove("is-active");
  if (fsLink) fsLink.classList.toggle("is-active", onPhase3);
  if (adminLink) adminLink.classList.toggle("is-active", page === "admin");
  const subtitleEl = document.getElementById("appHeaderSubtitle");
  if (subtitleEl && !isMitarbeiter) {
    if (page === "admin" && adminSubtab === "demo") {
      subtitleEl.textContent = "Demo-Datensätze für IST/SOLL-Tests je Unit";
    } else if (onPhase3) {
      if (page === "gesamtfortschritt") {
        subtitleEl.textContent = "Zeitstrahl " + planningYearRange() + " \u00b7 Umsatz, Headcount & Zertifizierung";
      } else if (page === "fortschritt-new") {
        subtitleEl.textContent = "Phase-1-basierter Fortschritt \u00b7 IST vs. SOLL (Planung NEW)";
      } else if (page === "fortschritt-erlaeuterung") {
        subtitleEl.textContent = "Methodik & Feldzuordnung Phase 1 ↔ Phase 2";
      } else {
        subtitleEl.textContent = "Detailfortschritt \u00b7 IST vs. SOLL je Unit und Jahr";
      }
    } else if (page === "admin") {
      subtitleEl.textContent = "Benutzer, Kataloge, Leitplanken und Organigramm";
    } else {
      subtitleEl.textContent =
        "Portfolio, Organisation & Skill-Matrix \u00b7 Transformation " + planningYearRange();
    }
  }
}

function switchTab(p){
  if (isMitarbeiter && p !== "skills") return;
  if (isPhase3AppPage(p) && !canAccessPhase3Area()) return;
  const prevPage = getActiveAppPage();
  document.querySelectorAll("#tabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.page === p));
  document.querySelectorAll("#appMain .page").forEach((pg) => pg.classList.toggle("active", pg.id === "page-" + p));
  updateMainTabsBar(p);
  updateAppModuleNavActive(p);
  const page = document.getElementById("page-" + p);
  if (page && prevPage !== p) collapseAllCollapsibleSections(page);
  refreshPresenceTracking();
}

// ===== PORTFOLIO =====
function portfolioDomForCategory(category) {
  if (category === "produkte") {
    return {
      formId: "portfolioProdukteForm",
      editId: "pf_prod_editId",
      bezeichnung: "pf_prod_bezeichnung",
      beschreibung: "pf_prod_beschreibung",
      hinweis: "pf_prod_hinweis",
      jahresumsatz_teur: "pf_prod_jahresumsatz_teur",
      jahresumsatz: "pf_prod_jahresumsatz",
      ampel: "pf_prod_ampel",
      cancelBtn: "btnPfProdCancel",
      list: "pf_prod_list",
      empty: "pf_prod_empty",
    };
  }
  if (category === "services") {
    return {
      formId: "portfolioServicesForm",
      editId: "pf_srv_editId",
      bezeichnung: "pf_srv_bezeichnung",
      beschreibung: "pf_srv_beschreibung",
      hinweis: "pf_srv_hinweis",
      jahresumsatz_teur: "pf_srv_jahresumsatz_teur",
      jahresumsatz: "pf_srv_jahresumsatz",
      ampel: "pf_srv_ampel",
      cancelBtn: "btnPfSrvCancel",
      list: "pf_srv_list",
      empty: "pf_srv_empty",
    };
  }
  if (category === "loesungen") {
    return {
      formId: "portfolioLoesungenForm",
      editId: "pf_sol_editId",
      bezeichnung: "pf_sol_bezeichnung",
      beschreibung: "pf_sol_beschreibung",
      hinweis: "pf_sol_hinweis",
      jahresumsatz_teur: "pf_sol_jahresumsatz_teur",
      jahresumsatz: "pf_sol_jahresumsatz",
      ampel: "pf_sol_ampel",
      cancelBtn: "btnPfSolCancel",
      list: "pf_sol_list",
      empty: "pf_sol_empty",
    };
  }
  if (category === "partnergeschaeft") {
    return {
      formId: "portfolioPartnergeschaeftForm",
      editId: "pf_pgs_editId",
      bezeichnung: "pf_pgs_bezeichnung",
      beschreibung: "pf_pgs_beschreibung",
      hinweis: "pf_pgs_hinweis",
      jahresumsatz_teur: "pf_pgs_jahresumsatz_teur",
      jahresumsatz: "pf_pgs_jahresumsatz",
      ampel: "pf_pgs_ampel",
      cancelBtn: "btnPfPgsCancel",
      list: "pf_pgs_list",
      empty: "pf_pgs_empty",
    };
  }
  return {
    formId: "portfolioProjektgeschaeftForm",
    editId: "pf_pjg_editId",
    bezeichnung: "pf_pjg_bezeichnung",
    beschreibung: "pf_pjg_beschreibung",
    hinweis: "pf_pjg_hinweis",
    jahresumsatz_teur: "pf_pjg_jahresumsatz_teur",
    jahresumsatz: "pf_pjg_jahresumsatz",
    ampel: "pf_pjg_ampel",
    cancelBtn: "btnPfPjgCancel",
    list: "pf_pjg_list",
    empty: "pf_pjg_empty",
  };
}

const PORTFOLIO_CATEGORY_LABELS = {
  produkte: "Produkt",
  services: "Service",
  loesungen: "Lösung",
  partnergeschaeft: "Partnergeschäft",
  projektgeschaeft: "Projektgeschäft",
};

function portfolioModalDom() {
  return {
    formId: "portfolioEditForm",
    editId: "portfolioEdit_editId",
    bezeichnung: "portfolioEdit_bezeichnung",
    beschreibung: "portfolioEdit_beschreibung",
    hinweis: "portfolioEdit_hinweis",
    jahresumsatz_teur: "portfolioEdit_jahresumsatz_teur",
    jahresumsatz: "portfolioEdit_jahresumsatz",
    ampel: "portfolioEdit_ampel",
  };
}

function fillPortfolioForm(dom, entry) {
  if (!entry || !dom) return;
  const enriched = enrichPortfolioUmsatz(entry);
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? "";
  };
  set(dom.editId, enriched.id || "");
  set(dom.bezeichnung, enriched.bezeichnung || "");
  set(dom.beschreibung, enriched.beschreibung || "");
  set(dom.hinweis, enriched.hinweis || "");
  set(dom.jahresumsatz_teur, enriched.jahresumsatz_teur != null ? enriched.jahresumsatz_teur : "");
  set(dom.jahresumsatz, enriched.jahresumsatz || "");
  set(dom.ampel, enriched.ampel || "");
}

async function submitPortfolioForm(dom, category, form, options = {}) {
  if (!requireSaveUnit()) return false;
  if (!validateFormRequired(form)) return false;
  const id = document.getElementById(dom.editId)?.value || "";
  const bezeichnung = document.getElementById(dom.bezeichnung)?.value.trim() || "";
  const beschreibung = document.getElementById(dom.beschreibung)?.value.trim() || "";
  const hinweis = document.getElementById(dom.hinweis)?.value.trim() || "";
  const jahresumsatzText = document.getElementById(dom.jahresumsatz)?.value.trim() || "";
  const jahresumsatzTeur = readTeurInputValue(document.getElementById(dom.jahresumsatz_teur));
  const ampel = document.getElementById(dom.ampel)?.value || "";
  const entry = enrichPortfolioUmsatz({
    id: id || undefined,
    category,
    bezeichnung,
    beschreibung,
    hinweis,
    jahresumsatz_teur: jahresumsatzTeur,
    jahresumsatz: jahresumsatzText || (jahresumsatzTeur != null ? formatUmsatzTeur(jahresumsatzTeur) : ""),
    ampel,
    ampel_score: ampelToScore(ampel),
  });
  try {
    await saveEntry("portfolio", entry);
    await refreshEntries();
    renderPortfolio();
    if (options.resetInlineForm) resetPortfolioForm(category);
    return true;
  } catch (error) {
    toast(error.message || "Speichern fehlgeschlagen.", "#e74c3c", 4000);
    return false;
  }
}

function openPortfolioEditModal(entry) {
  if (!entry) return;
  const enriched = enrichPortfolioUmsatz(entry);
  const category = String(enriched.category || "").trim();
  if (!category) return;
  const overlay = document.getElementById("portfolioEditModal");
  const titleEl = document.getElementById("portfolioEditTitle");
  const categoryEl = document.getElementById("portfolioEdit_category");
  const form = document.getElementById("portfolioEditForm");
  if (!overlay || !form) return;
  if (categoryEl) categoryEl.value = category;
  if (titleEl) {
    const label = PORTFOLIO_CATEGORY_LABELS[category] || "Eintrag";
    titleEl.textContent = `${label} bearbeiten`;
  }
  fillPortfolioForm(portfolioModalDom(), enriched);
  resetFormSaveButtonTracker(form);
  overlay.style.display = "flex";
  document.getElementById("portfolioEdit_bezeichnung")?.focus();
}

function closePortfolioEditModal() {
  const overlay = document.getElementById("portfolioEditModal");
  if (overlay) overlay.style.display = "none";
  document.getElementById("portfolioEditForm")?.reset();
  const categoryEl = document.getElementById("portfolioEdit_category");
  if (categoryEl) categoryEl.value = "";
}

function resetPortfolioForm(category) {
  const dom = portfolioDomForCategory(category);
  const form = document.getElementById(dom.formId);
  if (form) form.reset();
  const idEl = document.getElementById(dom.editId);
  if (idEl) idEl.value = "";
  const cancel = document.getElementById(dom.cancelBtn);
  if (cancel) cancel.style.display = "none";
  resetFormSaveButtonTracker(form);
}

async function onSubmitPortfolio(category, event) {
  event?.preventDefault?.();
  const dom = portfolioDomForCategory(category);
  const form = document.getElementById(dom.formId);
  const ok = await submitPortfolioForm(dom, category, form, { resetInlineForm: true });
  if (ok) notifyFormSaveSuccess(form, "Portfolio gespeichert!");
}

async function onSubmitPortfolioModal(event) {
  event?.preventDefault?.();
  const category = document.getElementById("portfolioEdit_category")?.value || "";
  if (!category) return;
  const dom = portfolioModalDom();
  const form = document.getElementById(dom.formId);
  const ok = await submitPortfolioForm(dom, category, form);
  if (!ok) return;
  closePortfolioEditModal();
  notifyFormSaveSuccess(form, "Portfolio gespeichert!");
}

function renderPortfolioCategory(category) {
  const dom = portfolioDomForCategory(category);
  const listEl = document.getElementById(dom.list);
  const emptyEl = document.getElementById(dom.empty);
  if (!listEl) return;

  const items = load("portfolio")
    .filter((e) => String(e.category || "") === category)
    .slice()
    .sort((a, b) =>
      String(a.bezeichnung || "").localeCompare(String(b.bezeichnung || ""), "de")
    );

  if (emptyEl) emptyEl.style.display = items.length ? "none" : "block";

  listEl.innerHTML = items
    .map((e) => {
      const enriched = enrichPortfolioUmsatz(e);
      const desc = esc((enriched.beschreibung || "").slice(0, 80));
      const descMore = (enriched.beschreibung || "").length > 80 ? "…" : "";
      const hint = esc((enriched.hinweis || "").slice(0, 60));
      const hintMore = (enriched.hinweis || "").length > 60 ? "…" : "";
      const umsatzLabel =
        enriched.jahresumsatz_teur != null
          ? formatUmsatzTeur(enriched.jahresumsatz_teur)
          : enriched.jahresumsatz || "–";
      return (
        "<tr>" +
        `<td>${esc(enriched.bezeichnung || "–")}</td>` +
        `<td style="text-align:center">${ampelHTML(enriched.ampel)}</td>` +
        `<td>${esc(umsatzLabel)}</td>` +
        `<td style="max-width:280px">${desc}${descMore}</td>` +
        `<td style="max-width:200px">${hint || "–"}${hintMore}</td>` +
        `<td style="white-space:nowrap">` +
        `<button class="btn btn-sm btn-outline" onclick="editEntry('portfolio','${escAttr(e.id)}')">✏️</button> ` +
        `<button class="btn btn-sm btn-danger" onclick="deleteEntry('portfolio','${escAttr(e.id)}')">🗑️</button>` +
        `</td>` +
        "</tr>"
      );
    })
    .join("");
}

function renderPortfolio() {
  renderPortfolioCategory("produkte");
  renderPortfolioCategory("services");
  renderPortfolioCategory("loesungen");
  renderPortfolioCategory("partnergeschaeft");
  renderPortfolioCategory("projektgeschaeft");
}

function loadPortfolioEntry(entry) {
  openPortfolioEditModal(entry);
}

function cancelPortfolioEdit(category) {
  resetPortfolioForm(category);
}

// ===== ORGANISATION (Aufbau & Rollen je Unit) =====
function syncOrgSonstigesInRow(row, prefix) {
  const sel = row.querySelector(`.${prefix}-select`);
  const other = row.querySelector(`.${prefix}-other`);
  if (!sel || !other) return;
  const isOther = sel.value === SELECT_SONSTIGES;
  other.classList.toggle("visible", isOther);
  other.required = isOther;
  if (!isOther) other.value = "";
}

const ORG_PIE_COLORS = [
  "#27ae60",
  "#0f3460",
  "#3498db",
  "#f39c12",
  "#9b59b6",
  "#e74c3c",
  "#1abc9c",
  "#34495e",
  "#d35400",
  "#7f8c8d",
];

function parseOrgUmsatzText(raw) {
  return parseUmsatzTextToEur(raw);
}

function formatOrgUmsatzValue(n) {
  if (n >= 1e9) return `${(n / 1e9).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mrd.`;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mio.`;
  if (n >= 1e3) return `${(n / 1e3).toLocaleString("de-DE", { maximumFractionDigits: 0 })} Tsd.`;
  return n.toLocaleString("de-DE");
}

function orgPieSlicePath(cx, cy, r, startAngle, endAngle) {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

function renderOrgPieChart(container, slices, opts) {
  if (!container) return;
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (!slices.length || total <= 0) {
    container.innerHTML = `<p class="org-pie-empty">${esc(opts.emptyLabel || "Keine auswertbaren Werte")}</p>`;
    return;
  }
  const cx = 100;
  const cy = 100;
  const r = 88;
  let angle = -Math.PI / 2;
  const paths = slices
    .map((slice, i) => {
      const share = slice.value / total;
      const start = angle;
      const end = angle + share * Math.PI * 2;
      angle = end;
      if (share >= 0.9999) {
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ORG_PIE_COLORS[i % ORG_PIE_COLORS.length]}" data-label="${escAttr(slice.label)}"></circle>`;
      }
      return `<path d="${orgPieSlicePath(cx, cy, r, start, end)}" fill="${ORG_PIE_COLORS[i % ORG_PIE_COLORS.length]}" data-label="${escAttr(slice.label)}"></path>`;
    })
    .join("");
  const legend = slices
    .map((slice, i) => {
      const pct = ((slice.value / total) * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 });
      const val = opts.formatValue(slice.value);
      return `<div class="org-pie-legend-item">
        <span class="org-pie-swatch" style="background:${ORG_PIE_COLORS[i % ORG_PIE_COLORS.length]}"></span>
        <span class="org-pie-legend-label">${esc(slice.label)}</span>
        <span class="org-pie-legend-meta">${esc(val)} (${pct}%)</span>
      </div>`;
    })
    .join("");
  container.innerHTML = `<div class="org-pie-chart">
    <svg class="org-pie-svg" viewBox="0 0 200 200" role="img" aria-label="${escAttr(opts.ariaLabel || "Tortendiagramm")}">
      ${paths}
    </svg>
    <div class="org-pie-legend">${legend}
      <div class="org-pie-total">Gesamt: ${esc(opts.formatValue(total))}</div>
    </div>
  </div>`;
}

function collectOrgGliederungChartRows() {
  const rows = [];
  document.querySelectorAll("#org_gliederung_rows .org-gliederung-row").forEach((r) => {
    const bereich = readSelectWithOther(r, ".org-gli-select", ".org-gli-other") || "Ohne Bezeichnung";
    const hcRaw = r.querySelector(".org-gli-hc")?.value;
    const hc = hcRaw === "" ? null : parseInt(hcRaw, 10);
    const umsatzTeur = readTeurInputValue(r.querySelector(".org-gli-umsatz-teur"));
    const umsatzText = r.querySelector(".org-gli-umsatz")?.value.trim() || "";
    const umsatzEur =
      umsatzTeur != null
        ? teurToEur(umsatzTeur)
        : parseOrgUmsatzText(umsatzText);
    rows.push({
      label: bereich,
      headcount: Number.isFinite(hc) && hc > 0 ? hc : 0,
      umsatz: umsatzEur != null && umsatzEur > 0 ? umsatzEur : 0,
    });
  });
  return rows;
}

function aggregateOrgChartSlices(rows, key) {
  const map = new Map();
  rows.forEach((row) => {
    const v = row[key];
    if (v > 0) map.set(row.label, (map.get(row.label) || 0) + v);
  });
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function renderOrgGliederungCharts() {
  const chartsWrap = document.getElementById("org_gliederung_charts");
  const hat = document.getElementById("org_hat_gliederung")?.value === "ja";
  if (!chartsWrap || !hat) {
    if (chartsWrap) chartsWrap.hidden = true;
    return;
  }
  const rows = collectOrgGliederungChartRows();
  const hcSlices = aggregateOrgChartSlices(rows, "headcount");
  const umsatzSlices = aggregateOrgChartSlices(rows, "umsatz");
  const hasChartData = hcSlices.length > 0 || umsatzSlices.length > 0;
  chartsWrap.hidden = !hasChartData;
  renderOrgPieChart(document.getElementById("org_chart_headcount"), hcSlices, {
    emptyLabel: "Headcount in den Bereichen erfassen (Zahlen > 0).",
    ariaLabel: "Headcount nach organisatorischem Bereich",
    formatValue: (n) => `${n.toLocaleString("de-DE")} MA`,
  });
  renderOrgPieChart(document.getElementById("org_chart_umsatz"), umsatzSlices, {
    emptyLabel: "Umsatz in den Bereichen erfassen (z. B. 1,2 Mio.).",
    ariaLabel: "Umsatz nach organisatorischem Bereich",
    formatValue: formatOrgUmsatzValue,
  });
}

function collectOrgRollenChartRows() {
  const rows = [];
  document.querySelectorAll("#org_rollen_rows .org-rolle-row").forEach((r) => {
    const rolle = readSelectWithOther(r, ".org-rol-select", ".org-rol-other") || "Ohne Bezeichnung";
    const anzahlRaw = r.querySelector(".org-rol-anzahl")?.value;
    const anzahl = anzahlRaw === "" ? null : parseInt(anzahlRaw, 10);
    rows.push({
      label: rolle,
      anzahl: Number.isFinite(anzahl) && anzahl > 0 ? anzahl : 0,
    });
  });
  return rows;
}

function renderOrgRollenCharts() {
  const chartsWrap = document.getElementById("org_rollen_charts");
  if (!chartsWrap) return;
  const slices = aggregateOrgChartSlices(collectOrgRollenChartRows(), "anzahl");
  chartsWrap.hidden = slices.length === 0;
  renderOrgPieChart(document.getElementById("org_chart_rollen"), slices, {
    emptyLabel: "Anzahl pro Rolle erfassen (Zahlen > 0).",
    ariaLabel: "Personen nach Rolle in der Unit",
    formatValue: (n) => `${n.toLocaleString("de-DE")} Pers.`,
  });
}

function orgRowRemoveButtonHtml(title) {
  return `<button type="button" class="row-remove-btn" title="${escAttr(title)}" aria-label="${escAttr(title)}">
    <svg class="row-remove-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
    </svg>
  </button>`;
}

function updateOrgGliederungSectionVisibility() {
  const hat = document.getElementById("org_hat_gliederung")?.value || "";
  const section = document.getElementById("org_gliederung_section");
  if (section) section.style.display = hat === "ja" ? "" : "none";
  if (hat !== "ja") {
    const chartsWrap = document.getElementById("org_gliederung_charts");
    if (chartsWrap) chartsWrap.hidden = true;
  } else {
    renderOrgGliederungCharts();
  }
}

function getOrgGliederungRowBereichLabel(row) {
  return readSelectWithOther(row, ".org-gli-select", ".org-gli-other");
}

function updateOrgGliederungRowSummary(row) {
  const summary = row.querySelector(".org-gli-header-summary");
  if (!summary) return;
  const label = getOrgGliederungRowBereichLabel(row);
  if (label) {
    summary.textContent = label;
    summary.classList.remove("is-placeholder");
  } else {
    summary.textContent = "– noch nicht gewählt –";
    summary.classList.add("is-placeholder");
  }
}

function setOrgGliederungRowOpen(row, open) {
  row.classList.toggle("is-collapsed", !open);
  const toggle = row.querySelector(".org-gli-toggle");
  if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function toggleOrgGliederungRow(row) {
  setOrgGliederungRowOpen(row, row.classList.contains("is-collapsed"));
}

function bindOrgGliederungRow(row, opts = {}) {
  const startOpen = opts.startOpen !== false;
  setOrgGliederungRowOpen(row, startOpen);
  updateOrgGliederungRowSummary(row);

  row.querySelector(".org-gli-toggle")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleOrgGliederungRow(row);
  });
  row.querySelector(".org-gli-header")?.addEventListener("click", (e) => {
    if (e.target.closest(".row-remove-btn")) return;
    toggleOrgGliederungRow(row);
  });
  row.querySelector(".org-gli-select")?.addEventListener("change", () => {
    syncOrgSonstigesInRow(row, "org-gli");
    updateOrgGliederungRowSummary(row);
    renderOrgGliederungCharts();
  });
  row.querySelector(".org-gli-other")?.addEventListener("input", () => {
    updateOrgGliederungRowSummary(row);
    renderOrgGliederungCharts();
  });
  row.querySelector(".row-remove-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    row.remove();
    renderOrgGliederungCharts();
  });
  syncOrgSonstigesInRow(row, "org-gli");
}

function addOrgGliederungRow(data) {
  const d = enrichOrgGliederungUmsatz(data || {});
  const bereichR = resolveOrgSelect(d.bereich, ORG_TECH_BEREICHE);
  const container = document.getElementById("org_gliederung_rows");
  if (!container) return;
  const hasBereich =
    !!String(d.bereich || "").trim() ||
    (!!bereichR.value && bereichR.value !== SELECT_SONSTIGES) ||
    (bereichR.value === SELECT_SONSTIGES && !!String(bereichR.other || "").trim());
  const row = document.createElement("div");
  row.className = "skill-assessment-row org-gliederung-row";
  row.innerHTML = `
    ${orgRowRemoveButtonHtml("Bereich entfernen")}
    <div class="org-gli-header">
      <button type="button" class="org-gli-toggle" aria-expanded="true" aria-label="Bereich auf- oder zuklappen">
        <svg class="org-gli-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <div class="org-gli-header-text">
        <span class="org-gli-header-label">Organisatorischer Bereich</span>
        <span class="org-gli-header-summary is-placeholder">– noch nicht gewählt –</span>
      </div>
    </div>
    <div class="org-gli-body">
      <div class="skill-assessment-grid">
        <div class="span2">
          <div class="org-gli-field-label">Kategorie / Bereich</div>
          <select class="org-gli-select">${buildOrgSelectOptions(ORG_TECH_BEREICHE, bereichR.value)}</select>
          <input type="text" class="org-gli-other sk-sonstiges-input${bereichR.value === SELECT_SONSTIGES ? " visible" : ""}" placeholder="Bereich manuell eingeben" value="${escAttr(bereichR.other)}">
        </div>
        <div class="span2"><label>Beschreibung / Erlaeuterung</label>
          <textarea class="org-gli-beschreibung" style="min-height:45px">${esc(d.beschreibung || "")}</textarea></div>
        <div><label>Headcount</label>
          <input type="number" class="org-gli-hc" min="0" value="${d.headcount != null && d.headcount !== "" ? escAttr(d.headcount) : ""}"></div>
        <div><label>Umsatz (TEUR)</label>
          <input type="number" class="org-gli-umsatz-teur" min="0" step="1" value="${d.umsatz_teur != null && d.umsatz_teur !== "" ? escAttr(d.umsatz_teur) : ""}"></div>
        <div class="span2"><label>Umsatz-Hinweis (optional)</label>
          <input type="text" class="org-gli-umsatz" placeholder="Erlaeuterung oder Legacy-Angabe" value="${escAttr(d.umsatz || "")}"></div>
      </div>
    </div>`;
  container.appendChild(row);
  bindOrgGliederungRow(row, { startOpen: !hasBereich });
}

function getOrgRolleRowLabel(row) {
  return readSelectWithOther(row, ".org-rol-select", ".org-rol-other");
}

function updateOrgRolleRowSummary(row) {
  const summary = row.querySelector(".org-rol-header-summary");
  if (!summary) return;
  const label = getOrgRolleRowLabel(row);
  if (label) {
    summary.textContent = label;
    summary.classList.remove("is-placeholder");
  } else {
    summary.textContent = "– noch nicht gewählt –";
    summary.classList.add("is-placeholder");
  }
}

function setOrgRolleRowOpen(row, open) {
  row.classList.toggle("is-collapsed", !open);
  const toggle = row.querySelector(".org-rol-toggle");
  if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function toggleOrgRolleRow(row) {
  setOrgRolleRowOpen(row, row.classList.contains("is-collapsed"));
}

function bindOrgRolleRow(row, opts = {}) {
  const startOpen = opts.startOpen !== false;
  setOrgRolleRowOpen(row, startOpen);
  updateOrgRolleRowSummary(row);

  row.querySelector(".org-rol-toggle")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleOrgRolleRow(row);
  });
  row.querySelector(".org-rol-header")?.addEventListener("click", (e) => {
    if (e.target.closest(".row-remove-btn")) return;
    toggleOrgRolleRow(row);
  });
  row.querySelector(".org-rol-select")?.addEventListener("change", () => {
    syncOrgSonstigesInRow(row, "org-rol");
    updateOrgRolleRowSummary(row);
    renderOrgRollenCharts();
  });
  row.querySelector(".org-rol-other")?.addEventListener("input", () => {
    updateOrgRolleRowSummary(row);
    renderOrgRollenCharts();
  });
  row.querySelector(".org-rol-anzahl")?.addEventListener("input", () => renderOrgRollenCharts());
  row.querySelector(".row-remove-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    row.remove();
    renderOrgRollenCharts();
  });
  syncOrgSonstigesInRow(row, "org-rol");
}

function addOrgRolleRow(data) {
  const d = data || {};
  const rolleR = resolveOrgSelect(d.rolle, ORG_ROLLEN);
  const container = document.getElementById("org_rollen_rows");
  if (!container) return;
  const hasRolle =
    !!String(d.rolle || "").trim() ||
    (!!rolleR.value && rolleR.value !== SELECT_SONSTIGES) ||
    (rolleR.value === SELECT_SONSTIGES && !!String(rolleR.other || "").trim());
  const row = document.createElement("div");
  row.className = "skill-assessment-row org-rolle-row";
  row.innerHTML = `
    ${orgRowRemoveButtonHtml("Rolle entfernen")}
    <div class="org-rol-header">
      <button type="button" class="org-rol-toggle" aria-expanded="true" aria-label="Rolle auf- oder zuklappen">
        <svg class="org-rol-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <div class="org-rol-header-text">
        <span class="org-rol-header-label">Rolle</span>
        <span class="org-rol-header-summary is-placeholder">– noch nicht gewählt –</span>
      </div>
    </div>
    <div class="org-rol-body">
      <div class="skill-assessment-grid">
        <div class="span2">
          <div class="org-rol-field-label">Kategorie / Rolle</div>
          <select class="org-rol-select">${buildOrgSelectOptions(ORG_ROLLEN, rolleR.value)}</select>
          <input type="text" class="org-rol-other sk-sonstiges-input${rolleR.value === SELECT_SONSTIGES ? " visible" : ""}" placeholder="Rolle manuell eingeben" value="${escAttr(rolleR.other)}">
        </div>
        <div><label>Anzahl</label>
          <input type="number" class="org-rol-anzahl" min="0" value="${d.anzahl != null && d.anzahl !== "" ? escAttr(d.anzahl) : ""}"></div>
        <div class="span2"><label>Bemerkung</label>
          <input type="text" class="org-rol-bemerkung" value="${escAttr(d.bemerkung || "")}" placeholder="Optional"></div>
      </div>
    </div>`;
  container.appendChild(row);
  bindOrgRolleRow(row, { startOpen: !hasRolle });
}

function resetOrgGliederungRows(rows) {
  const container = document.getElementById("org_gliederung_rows");
  if (!container) return;
  container.innerHTML = "";
  const list = rows && rows.length ? rows : [{}];
  list.forEach((r) => addOrgGliederungRow(r));
  renderOrgGliederungCharts();
}

function resetOrgRollenRows(rows) {
  const container = document.getElementById("org_rollen_rows");
  if (!container) return;
  container.innerHTML = "";
  const list = rows && rows.length ? rows : [{}];
  list.forEach((r) => addOrgRolleRow(r));
  renderOrgRollenCharts();
}

function getOrganisationFormData() {
  const hat = document.getElementById("org_hat_gliederung")?.value || "";
  const stichtag = document.getElementById("org_stichtag")?.value || "";
  const erfassungsjahrRaw = document.getElementById("org_erfassungsjahr")?.value;
  let erfassungsjahr =
    erfassungsjahrRaw === "" || erfassungsjahrRaw == null
      ? stichtag
        ? parseInt(stichtag.slice(0, 4), 10)
        : null
      : parseInt(erfassungsjahrRaw, 10);
  if (!Number.isFinite(erfassungsjahr)) erfassungsjahr = null;
  const gliederungen = [];
  if (hat === "ja") {
    document.querySelectorAll("#org_gliederung_rows .org-gliederung-row").forEach((r) => {
      const bereich = readSelectWithOther(r, ".org-gli-select", ".org-gli-other");
      const beschreibung = r.querySelector(".org-gli-beschreibung")?.value.trim() || "";
      const hcRaw = r.querySelector(".org-gli-hc")?.value;
      const umsatzText = r.querySelector(".org-gli-umsatz")?.value.trim() || "";
      const umsatzTeur = readTeurInputValue(r.querySelector(".org-gli-umsatz-teur"));
      if (!bereich && !beschreibung && hcRaw === "" && umsatzTeur == null && !umsatzText) return;
      gliederungen.push(
        enrichOrgGliederungUmsatz({
          bereich,
          beschreibung,
          headcount: hcRaw === "" ? null : parseInt(hcRaw, 10),
          umsatz_teur: umsatzTeur,
          umsatz: umsatzText,
        })
      );
    });
  }
  const rollen = [];
  document.querySelectorAll("#org_rollen_rows .org-rolle-row").forEach((r) => {
    const rolle = readSelectWithOther(r, ".org-rol-select", ".org-rol-other");
    const anzahlRaw = r.querySelector(".org-rol-anzahl")?.value;
    const bemerkung = r.querySelector(".org-rol-bemerkung")?.value.trim() || "";
    if (!rolle && anzahlRaw === "" && !bemerkung) return;
    rollen.push({
      rolle,
      anzahl: anzahlRaw === "" ? null : parseInt(anzahlRaw, 10),
      bemerkung,
    });
  });
  return {
    stichtag,
    erfassungsjahr,
    hatTechnologischeGliederung: hat,
    gliederungen,
    rollen,
  };
}

function validateOrganisationForm() {
  const stichtag = document.getElementById("org_stichtag");
  if (!stichtag?.value) {
    toast("Bitte einen Stichtag für die Statusaufnahme angeben.", "#e74c3c", 4000);
    stichtag?.focus();
    return false;
  }
  const hat = document.getElementById("org_hat_gliederung");
  if (!hat?.value) {
    toast("Bitte angeben, ob eine organisatorische Unterteilung existiert.", "#e74c3c", 4000);
    hat?.focus();
    return false;
  }
  if (hat.value === "ja") {
    const data = getOrganisationFormData();
    if (!data.gliederungen.length) {
      toast("Bitte mindestens einen organisatorischen Bereich erfassen.", "#e74c3c", 4000);
      return false;
    }
    for (const g of data.gliederungen) {
      if (!g.bereich) {
        toast("Bitte fuer jeden organisatorischen Bereich eine Bezeichnung waehlen oder eingeben.", "#e74c3c", 4000);
        return false;
      }
    }
  }
  const rollen = getOrganisationFormData().rollen;
  for (const r of rollen) {
    if (r.rolle && (r.anzahl == null || Number.isNaN(r.anzahl))) {
      toast("Bitte fuer jede erfasste Rolle eine Anzahl angeben.", "#e74c3c", 4000);
      return false;
    }
    if (!r.rolle && r.anzahl != null) {
      toast("Bitte fuer jede Anzahl auch eine Rolle waehlen oder eingeben.", "#e74c3c", 4000);
      return false;
    }
  }
  return true;
}

function loadOrganisationEntry(entry) {
  if (!entry) return;
  document.getElementById("org_editId").value = entry.id || "";
  const stichtagEl = document.getElementById("org_stichtag");
  const jahrEl = document.getElementById("org_erfassungsjahr");
  if (stichtagEl) stichtagEl.value = entry.stichtag || "";
  if (jahrEl) {
    jahrEl.value =
      entry.erfassungsjahr != null
        ? entry.erfassungsjahr
        : entry.stichtag
          ? entry.stichtag.slice(0, 4)
          : "";
  }
  document.getElementById("org_hat_gliederung").value = entry.hatTechnologischeGliederung || "";
  updateOrgGliederungSectionVisibility();
  resetOrgGliederungRows(entry.hatTechnologischeGliederung === "ja" ? entry.gliederungen || [] : []);
  resetOrgRollenRows(entry.rollen || []);
  resetFormSaveButtonTracker(document.getElementById("organisationForm"));
}

function resetOrganisationForm() {
  const form = document.getElementById("organisationForm");
  if (form) form.reset();
  document.getElementById("org_editId").value = "";
  const today = new Date().toISOString().slice(0, 10);
  const stichtagEl = document.getElementById("org_stichtag");
  const jahrEl = document.getElementById("org_erfassungsjahr");
  if (stichtagEl) stichtagEl.value = today;
  if (jahrEl) jahrEl.value = String(new Date().getFullYear());
  updateOrgGliederungSectionVisibility();
  resetOrgGliederungRows([]);
  resetOrgRollenRows([]);
  resetFormSaveButtonTracker(document.getElementById("organisationForm"));
}

function findOrganisationEntryForUnit(entries, preferredId) {
  const list = entries || [];
  if (preferredId) {
    const byId = list.find((e) => String(e.id) === String(preferredId));
    if (byId) return byId;
  }
  const unit = getSaveUnit();
  if (unit) {
    return list.find((e) => e.unit === unit) || null;
  }
  return null;
}

function renderOrganisation() {
  const preferredId = document.getElementById("org_editId")?.value || "";
  const entry = findOrganisationEntryForUnit(load("organisation"), preferredId);
  if (entry) {
    loadOrganisationEntry(entry);
  } else {
    resetOrganisationForm();
  }
}

function organisationOverviewDetail(e) {
  const hat = e.hatTechnologischeGliederung === "ja" ? "Ja" : e.hatTechnologischeGliederung === "nein" ? "Nein" : "–";
  const nGli = Array.isArray(e.gliederungen) ? e.gliederungen.length : 0;
  const nRol = Array.isArray(e.rollen) ? e.rollen.length : 0;
  const rollenSum = (e.rollen || [])
    .map((r) => (r.anzahl != null ? `${r.rolle || "?"}: ${r.anzahl}` : r.rolle))
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");
  return `Gliederung: ${hat} (${nGli} Bereiche) | Rollen: ${nRol}${rollenSum ? " – " + rollenSum : ""}`;
}

async function onSubmitOrganisation(event) {
  event?.preventDefault?.();
  if (!requireSaveUnit()) return;
  if (!validateOrganisationForm()) return;
  const saveUnit = getSaveUnit();
  const existing = load("organisation");
  const preferred = findOrganisationEntryForUnit(
    existing,
    document.getElementById("org_editId")?.value || ""
  );
  const editId = preferred?.id || "";
  const data = getOrganisationFormData();
  const entry = { id: editId || undefined, unit: saveUnit, workstream: "", ...data };
  try {
    const savedId = await saveEntry("organisation", entry);
    document.getElementById("org_editId").value = savedId;
    await refreshEntries();
    const saved = findOrganisationEntryForUnit(load("organisation"), savedId);
    if (saved) loadOrganisationEntry(saved);
    notifyFormSaveSuccess(document.getElementById("organisationForm"), "Organisation gespeichert!");
  } catch (error) {
    toast(error.message || "Speichern fehlgeschlagen.", "#e74c3c", 4000);
  }
}

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

function collapseAllCollapsibleSections(root) {
  const scope = root || document;
  scope.querySelectorAll("details[open]").forEach((el) => el.removeAttribute("open"));
}

function openCollapsibleSectionForElement(el) {
  const details = el?.closest?.("details");
  if (details) details.setAttribute("open", "");
}

function openPortfolioSection(category) {
  const dom = portfolioDomForCategory(category);
  openCollapsibleSectionForElement(document.getElementById(dom.formId));
}

function collapseSkillDetailsSections() {
  ["skillDetailsTech", "skillDetailsSoft"].forEach((id) => {
    document.getElementById(id)?.removeAttribute("open");
  });
}

function openSkillDetailsSection(kind) {
  const id = kind === "soft" ? "skillDetailsSoft" : "skillDetailsTech";
  document.getElementById(id)?.setAttribute("open", "");
  setSkillKind(kind);
}

function setSkillKind(kind) {
  currentSkillKind = kind === "soft" ? "soft" : "tech";
  refreshSkillInfoPanel();
}

function refreshSkillInfoPanel() {
  const softOpen = document.getElementById("skillDetailsSoft")?.open;
  const techOpen = document.getElementById("skillDetailsTech")?.open;
  const kind =
    currentSkillKind === "soft" || (softOpen && !techOpen) ? "soft" : "tech";
  if (kind === "tech") {
    const row =
      document.querySelector("#sk_assessment_rows .skill-assessment-row--editing") ||
      document.querySelector("#sk_assessment_rows .skill-assessment-row");
    if (!row) {
      renderSkillInfo("", "");
      return;
    }
    const data = readTechSkillPayloadFromRow(row);
    let lvl = data.level;
    if (lvl == null && data.levelCustom) {
      const parsedLvl = parseInt(data.levelCustom, 10);
      if (parsedLvl >= 1 && parsedLvl <= 5) lvl = parsedLvl;
    }
    renderSkillInfo(data.kategorie || "", lvl ?? "");
  } else {
    const row =
      document.querySelector("#ss_assessment_rows .skill-assessment-row--editing") ||
      document.querySelector("#ss_assessment_rows .skill-assessment-row");
    if (!row) {
      renderSoftSkillInfo("", "");
      return;
    }
    const data = readSoftSkillPayloadFromRow(row);
    let lvl = data.level;
    if (lvl == null && data.levelCustom) {
      const parsedLvl = parseInt(data.levelCustom, 10);
      if (parsedLvl >= 1 && parsedLvl <= 5) lvl = parsedLvl;
    }
    renderSoftSkillInfo(data.kategorie || "", lvl ?? "");
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
  ];
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
    const katData = readSkillCategoryFromRow(row, "tech");
    const cat = getCategoryById(katData.kategorie_id) || getCategoryByName(katData.kategorie);
    const tech = row.querySelector(".sk-technologie");
    if (cat && tech && !tech.value.trim()) tech.placeholder = cat.beispielTechnologien;
    else if (tech && row.querySelector(".sk-kategorie").value === SELECT_SONSTIGES) tech.placeholder = "Weitere Details manuell eingeben";
  }
  const katData = readSkillCategoryFromRow(row, "tech");
  const kat = katData.kategorie;
  let lvl = readSelectWithOther(row, ".sk-level", ".sk-level-other");
  const parsedLvl = parseInt(lvl, 10);
  if (parsedLvl >= 1 && parsedLvl <= 5) lvl = parsedLvl;
  if (row.closest("#sk_assessment_rows") && currentSkillKind === "tech") renderSkillInfo(kat, lvl);
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
    const katData = readSkillCategoryFromRow(row, "soft");
    const cat = getSoftCategoryById(katData.kategorie_id) || getSoftCategoryByName(katData.kategorie);
    const komp = row.querySelector(".ss-kompetenz");
    if (cat && komp && !komp.value.trim()) komp.placeholder = cat.beispielKompetenzen;
    else if (komp && row.querySelector(".ss-kategorie").value === SELECT_SONSTIGES) komp.placeholder = "Weitere Details manuell eingeben";
  }
  const katData = readSkillCategoryFromRow(row, "soft");
  const kat = katData.kategorie;
  let lvl = readSelectWithOther(row, ".ss-level", ".ss-level-other");
  const parsedLvl = parseInt(lvl, 10);
  if (parsedLvl >= 1 && parsedLvl <= 5) lvl = parsedLvl;
  if (row.closest("#ss_assessment_rows") && currentSkillKind === "soft") renderSoftSkillInfo(kat, lvl);
}

function bindTechSkillRowEditEvents(row) {
  row.querySelectorAll(".sk-kategorie, .sk-level").forEach((el) => {
    el.addEventListener("change", onSkillAssessmentChange);
  });
  row.querySelectorAll(".sk-kategorie-other, .sk-level-other").forEach((el) => {
    el.addEventListener("input", onSkillAssessmentChange);
  });
}

function bindSoftSkillRowEditEvents(row) {
  row.querySelectorAll(".ss-kategorie, .ss-level").forEach((el) => {
    el.addEventListener("change", onSoftSkillAssessmentChange);
  });
  row.querySelectorAll(".ss-kategorie-other, .ss-level-other").forEach((el) => {
    el.addEventListener("input", onSoftSkillAssessmentChange);
  });
}

function renderTechSkillRowView(row, data) {
  const d = enrichTechSkillItemClient(data || {});
  storeTechSkillPayloadOnRow(row, d);
  row.className = "skill-assessment-row skill-assessment-row--view";
  row.innerHTML = `
    <div class="skill-list-item">
      <div class="skill-list-item__main">
        <div class="skill-list-item__title">${esc(formatTechSkillListTitle(d))}</div>
        <div class="skill-list-item__meta">${esc(formatTechSkillListMeta(d))}</div>
      </div>
      <div class="skill-list-item__actions">
        <button type="button" class="btn btn-sm btn-outline sk-row-edit">Bearbeiten</button>
        <button type="button" class="btn btn-sm btn-danger btn-outline sk-row-delete">Löschen</button>
      </div>
    </div>`;
}

function renderTechSkillRowEdit(row, data) {
  const d = data || {};
  const catR = resolveCategorySelect(d.kategorie, d.kategorie_id);
  const lvlR = resolveLevelSelect(d.level, d.levelCustom);
  row.className = "skill-assessment-row skill-assessment-row--editing";
  row.innerHTML = `
    <div class="skill-assessment-grid">
      <div class="span2"><label>Skill-Kategorie</label>
        <select class="sk-kategorie">${buildCategoryOptions(d.kategorie, d.kategorie_id)}</select>
        <input type="text" class="sk-kategorie-other sk-sonstiges-input${catR.value === SELECT_SONSTIGES ? " visible" : ""}" placeholder="Kategorie manuell eingeben" value="${escAttr(catR.other)}">
      </div>
      <div class="span2"><label>Weitere Details</label>
        <input type="text" class="sk-technologie" placeholder="Weitere Details" value="${escAttr(d.technologie)}"></div>
      <div><label>Level</label>
        <select class="sk-level">${buildLevelOptions(d.level, d.levelCustom)}</select>
        <input type="text" class="sk-level-other sk-sonstiges-input${lvlR.value === SELECT_SONSTIGES ? " visible" : ""}" placeholder="z.B. 3 oder eigene Level-Bezeichnung" value="${escAttr(lvlR.other)}">
      </div>
      <div class="span2"><label>Bemerkungen</label>
        <textarea class="sk-bemerkung" style="min-height:45px">${esc(d.bemerkung || d.bemerkungen || "")}</textarea></div>
    </div>
    <div class="skill-assessment-row-actions">
      <button type="button" class="btn btn-sm btn-primary sk-row-save">Übernehmen</button>
      <button type="button" class="btn btn-sm btn-outline sk-row-cancel">Abbrechen</button>
    </div>`;
  bindTechSkillRowEditEvents(row);
  syncSonstigesFieldsInRow(row);
  const katData = readSkillCategoryFromRow(row, "tech");
  const cat = getCategoryById(katData.kategorie_id) || getCategoryByName(katData.kategorie);
  const tech = row.querySelector(".sk-technologie");
  if (cat && tech) tech.placeholder = cat.beispielTechnologien;
}

function enterTechSkillRowEdit(row) {
  const data = readTechSkillPayloadFromRow(row);
  row.dataset.skillPayloadBackup = row.dataset.skillPayload || "";
  renderTechSkillRowEdit(row, data);
  setSkillKind("tech");
  refreshSkillInfoPanel();
  row.querySelector(".sk-kategorie")?.focus();
}

function cancelTechSkillRowEdit(row) {
  const hadBackup = row.dataset.skillPayloadBackup != null && row.dataset.skillPayloadBackup !== "";
  if (!hadBackup) {
    row.remove();
    updateSkillAssessmentListEmptyState("tech");
    refreshSkillInfoPanel();
    return;
  }
  try {
    const data = JSON.parse(row.dataset.skillPayloadBackup || "{}");
    renderTechSkillRowView(row, data);
  } catch (_e) {
    row.remove();
  }
  delete row.dataset.skillPayloadBackup;
  refreshSkillInfoPanel();
}

function deleteTechSkillRow(row) {
  const title = formatTechSkillListTitle(readTechSkillPayloadFromRow(row));
  if (!confirm(`Fachskill „${title}“ wirklich löschen?`)) return;
  row.remove();
  updateSkillAssessmentListEmptyState("tech");
  refreshSkillInfoPanel();
}

function addSkillAssessmentRow(data, options = {}) {
  const editing = options.editing !== false;
  const container = document.getElementById("sk_assessment_rows");
  const row = document.createElement("li");
  row.className = "skill-assessment-row";
  if (editing) {
    renderTechSkillRowEdit(row, data || {});
    row.dataset.skillPayloadBackup = data ? JSON.stringify(data) : "";
  } else {
    renderTechSkillRowView(row, data || {});
  }
  container.appendChild(row);
  updateSkillAssessmentListEmptyState("tech");
  if (editing) {
    setSkillKind("tech");
    refreshSkillInfoPanel();
    row.querySelector(".sk-kategorie")?.focus();
  }
  return row;
}

function addSkillAssessmentRowFromButton() {
  addSkillAssessmentRow({}, { editing: true });
  openSkillDetailsSection("tech");
}

function getSkillAssessmentData() {
  const rows = document.querySelectorAll("#sk_assessment_rows .skill-assessment-row");
  const result = [];
  rows.forEach((r) => {
    const data = readTechSkillPayloadFromRow(r);
    if (isTechSkillPayloadEmpty(data)) return;
    result.push({
      kategorie: data.kategorie,
      kategorie_id: data.kategorie_id ?? null,
      technologie: data.technologie || "",
      level: data.level,
      levelCustom: data.levelCustom || "",
      bemerkungen: data.bemerkungen || "",
    });
  });
  return result;
}

function setSkillAssessmentData(skills) {
  const container = document.getElementById("sk_assessment_rows");
  container.innerHTML = "";
  enrichTechSkillList(skills).forEach((s) => addSkillAssessmentRow(s, { editing: false }));
  updateSkillAssessmentListEmptyState("tech");
  if (currentSkillKind === "tech") refreshSkillInfoPanel();
}

function renderSoftSkillRowView(row, data) {
  const d = enrichSoftSkillItemClient(data || {});
  storeSoftSkillPayloadOnRow(row, d);
  row.className = "skill-assessment-row skill-assessment-row--view";
  row.innerHTML = `
    <div class="skill-list-item">
      <div class="skill-list-item__main">
        <div class="skill-list-item__title">${esc(formatSoftSkillListTitle(d))}</div>
        <div class="skill-list-item__meta">${esc(formatSoftSkillListMeta(d))}</div>
      </div>
      <div class="skill-list-item__actions">
        <button type="button" class="btn btn-sm btn-outline ss-row-edit">Bearbeiten</button>
        <button type="button" class="btn btn-sm btn-danger btn-outline ss-row-delete">Löschen</button>
      </div>
    </div>`;
}

function renderSoftSkillRowEdit(row, data) {
  const d = data || {};
  const catR = resolveSoftCategorySelect(d.kategorie, d.kategorie_id);
  const lvlR = resolveSoftLevelSelect(d.level, d.levelCustom);
  row.className = "skill-assessment-row skill-assessment-row--editing";
  row.innerHTML = `
    <div class="skill-assessment-grid">
      <div class="span2"><label>Soft Skill Kategorie</label>
        <select class="ss-kategorie">${buildSoftCategoryOptions(d.kategorie, d.kategorie_id)}</select>
        <input type="text" class="ss-kategorie-other sk-sonstiges-input${catR.value === SELECT_SONSTIGES ? " visible" : ""}" placeholder="Kategorie manuell eingeben" value="${escAttr(catR.other)}">
      </div>
      <div class="span2"><label>Weitere Details</label>
        <input type="text" class="ss-kompetenz" placeholder="Weitere Details" value="${escAttr(d.kompetenz)}"></div>
      <div><label>Level</label>
        <select class="ss-level">${buildSoftLevelOptions(d.level, d.levelCustom)}</select>
        <input type="text" class="ss-level-other sk-sonstiges-input${lvlR.value === SELECT_SONSTIGES ? " visible" : ""}" placeholder="z.B. 3 oder eigene Level-Bezeichnung" value="${escAttr(lvlR.other)}">
      </div>
      <div class="span2"><label>Bemerkungen</label>
        <textarea class="ss-bemerkung" style="min-height:45px">${esc(d.bemerkung || d.bemerkungen || "")}</textarea></div>
    </div>
    <div class="skill-assessment-row-actions">
      <button type="button" class="btn btn-sm btn-primary ss-row-save">Übernehmen</button>
      <button type="button" class="btn btn-sm btn-outline ss-row-cancel">Abbrechen</button>
    </div>`;
  bindSoftSkillRowEditEvents(row);
  syncSonstigesFieldsInRow(row, "ss");
  const katData = readSkillCategoryFromRow(row, "soft");
  const cat = getSoftCategoryById(katData.kategorie_id) || getSoftCategoryByName(katData.kategorie);
  const komp = row.querySelector(".ss-kompetenz");
  if (cat && komp) komp.placeholder = cat.beispielKompetenzen;
}

function enterSoftSkillRowEdit(row) {
  const data = readSoftSkillPayloadFromRow(row);
  row.dataset.skillPayloadBackup = row.dataset.skillPayload || "";
  renderSoftSkillRowEdit(row, data);
  setSkillKind("soft");
  refreshSkillInfoPanel();
  row.querySelector(".ss-kategorie")?.focus();
}

function cancelSoftSkillRowEdit(row) {
  const hadBackup = row.dataset.skillPayloadBackup != null && row.dataset.skillPayloadBackup !== "";
  if (!hadBackup) {
    row.remove();
    updateSkillAssessmentListEmptyState("soft");
    refreshSkillInfoPanel();
    return;
  }
  try {
    const data = JSON.parse(row.dataset.skillPayloadBackup || "{}");
    renderSoftSkillRowView(row, data);
  } catch (_e) {
    row.remove();
  }
  delete row.dataset.skillPayloadBackup;
  refreshSkillInfoPanel();
}

function deleteSoftSkillRow(row) {
  const title = formatSoftSkillListTitle(readSoftSkillPayloadFromRow(row));
  if (!confirm(`Soft Skill „${title}“ wirklich löschen?`)) return;
  row.remove();
  updateSkillAssessmentListEmptyState("soft");
  refreshSkillInfoPanel();
}

function addSoftSkillAssessmentRow(data, options = {}) {
  const editing = options.editing !== false;
  const container = document.getElementById("ss_assessment_rows");
  const row = document.createElement("li");
  row.className = "skill-assessment-row";
  if (editing) {
    renderSoftSkillRowEdit(row, data || {});
    row.dataset.skillPayloadBackup = data ? JSON.stringify(data) : "";
  } else {
    renderSoftSkillRowView(row, data || {});
  }
  container.appendChild(row);
  updateSkillAssessmentListEmptyState("soft");
  if (editing) {
    setSkillKind("soft");
    refreshSkillInfoPanel();
    row.querySelector(".ss-kategorie")?.focus();
  }
  return row;
}

function addSoftSkillAssessmentRowFromButton() {
  addSoftSkillAssessmentRow({}, { editing: true });
  openSkillDetailsSection("soft");
}

function getSoftSkillAssessmentData() {
  const rows = document.querySelectorAll("#ss_assessment_rows .skill-assessment-row");
  const result = [];
  rows.forEach((r) => {
    const data = readSoftSkillPayloadFromRow(r);
    if (isSoftSkillPayloadEmpty(data)) return;
    result.push({
      kategorie: data.kategorie,
      kategorie_id: data.kategorie_id ?? null,
      kompetenz: data.kompetenz || "",
      level: data.level,
      levelCustom: data.levelCustom || "",
      bemerkungen: data.bemerkungen || "",
    });
  });
  return result;
}

function setSoftSkillAssessmentData(softSkills) {
  const container = document.getElementById("ss_assessment_rows");
  container.innerHTML = "";
  enrichSoftSkillList(softSkills).forEach((s) => addSoftSkillAssessmentRow(s, { editing: false }));
  updateSkillAssessmentListEmptyState("soft");
  if (currentSkillKind === "soft") refreshSkillInfoPanel();
}

function handleTechSkillListClick(ev) {
  const row = ev.target.closest(".skill-assessment-row");
  if (!row || !row.closest("#sk_assessment_rows")) return;
  if (ev.target.closest(".sk-row-delete")) {
    ev.preventDefault();
    deleteTechSkillRow(row);
    return;
  }
  if (ev.target.closest(".sk-row-edit")) {
    ev.preventDefault();
    enterTechSkillRowEdit(row);
    return;
  }
  if (ev.target.closest(".sk-row-save")) {
    ev.preventDefault();
    const err = commitTechSkillRow(row);
    if (err) {
      const el = focusSelectOrOther(row, ".sk-kategorie", ".sk-kategorie-other");
      if (el) reportFieldError(el, err);
    } else {
      delete row.dataset.skillPayloadBackup;
    }
    return;
  }
  if (ev.target.closest(".sk-row-cancel")) {
    ev.preventDefault();
    cancelTechSkillRowEdit(row);
  }
}

function handleSoftSkillListClick(ev) {
  const row = ev.target.closest(".skill-assessment-row");
  if (!row || !row.closest("#ss_assessment_rows")) return;
  if (ev.target.closest(".ss-row-delete")) {
    ev.preventDefault();
    deleteSoftSkillRow(row);
    return;
  }
  if (ev.target.closest(".ss-row-edit")) {
    ev.preventDefault();
    enterSoftSkillRowEdit(row);
    return;
  }
  if (ev.target.closest(".ss-row-save")) {
    ev.preventDefault();
    const err = commitSoftSkillRow(row);
    if (err) {
      const el = focusSelectOrOther(row, ".ss-kategorie", ".ss-kategorie-other");
      if (el) reportFieldError(el, err);
    } else {
      delete row.dataset.skillPayloadBackup;
    }
    return;
  }
  if (ev.target.closest(".ss-row-cancel")) {
    ev.preventDefault();
    cancelSoftSkillRowEdit(row);
  }
}

function resetSkillForm() {
  document.getElementById("skillForm").reset();
  document.getElementById("sk_editId").value = "";
  renderSkillEmployeeCatalogCheckboxes(null);
  updateSkillUnitDisplay(null);
  setSkillAssessmentData([]);
  setSoftSkillAssessmentData([]);
  collapseSkillDetailsSections();
  setSkillKind("tech");
  resetFormSaveButtonTracker(document.getElementById("skillForm"));
}

function fillSkillEmployeeFields(e) {
  const pnEl = document.getElementById("sk_personalnummer");
  if (pnEl) pnEl.value = resolveSkillFormPersonalnummer(e);
  document.getElementById("sk_nachname").value = e.nachname || (e.name || "").split(", ")[0] || "";
  document.getElementById("sk_vorname").value = e.vorname || (e.name || "").split(", ")[1] || "";
  renderSkillEmployeeCatalogCheckboxes(e);
  updateSkillUnitDisplay(e);
  document.getElementById("sk_email").value = e.email || "";
  const zertEl = document.getElementById("sk_zertifikate");
  const zertFlagEl = document.getElementById("sk_zertifiziert");
  if (zertEl) zertEl.value = e.zertifikate || "";
  if (zertFlagEl) zertFlagEl.value = e.zertifiziert || "";
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

async function loadSkillEmployeeEntry(entry) {
  if (!entry) return;
  await loadSkillCategoriesFromApi();
  const freshEntry = await resolveSkillEmployeeEntry(entry);
  collapseSkillDetailsSections();
  document.getElementById("sk_editId").value = freshEntry.id;
  await fillSkillEmployeeFieldsWithLookup(freshEntry);
  if (isLegacySkillEntry(freshEntry)) {
    setSkillAssessmentData([]);
    setSoftSkillAssessmentData([]);
    toast("Legacy-Eintrag: bitte Skills neu im neuen Format erfassen.", "#f39c12");
  } else {
    setSkillAssessmentData(freshEntry.skills || []);
    setSoftSkillAssessmentData(freshEntry.softSkills || []);
  }
  document.getElementById("btnSkillCancel").style.display = "";
  updateSkillDeleteButton();
  renderSkillEmployeeNav();
  resetFormSaveButtonTracker(document.getElementById("skillForm"));
}

function showSkillSaveConfirmation(label) {
  const msg = `${label} wurde gespeichert.`;
  notifyFormSaveSuccess(document.getElementById("skillForm"), msg);
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
    const pn = getSkillEntryPersonalnummer(e);
    const idPart = pn
      ? `<span style="opacity:.75;font-weight:400"> (${esc(pn)})</span>`
      : "";
    const catPart = skillEmployeeCatalogSummary(e);
    const skillsPart = isLegacySkillEntry(e) ? "Legacy" : skillOverviewDetail(e);
    const subDetail =
      catPart !== "–" && skillsPart !== "–"
        ? `${catPart} · ${skillsPart}`
        : catPart !== "–"
          ? catPart
          : skillsPart;
    const unitPart = e.unit ? esc(e.unit) + " · " : "";
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

async function newSkillEmployee() {
  await ensureSkillEmployeeCatalogsLoaded();
  resetSkillForm();
  document.getElementById("btnSkillCancel").style.display = "none";
  updateSkillDeleteButton();
  renderSkillEmployeeNav();
}

document.getElementById("btnSkillEmployeeNew")?.addEventListener("click", () => {
  newSkillEmployee();
});
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

document.getElementById("sk_assessment_rows")?.addEventListener("change", onSkillAssessmentChange);
document.getElementById("sk_assessment_rows")?.addEventListener("click", handleTechSkillListClick);

document.getElementById("ss_assessment_rows")?.addEventListener("change", onSoftSkillAssessmentChange);
document.getElementById("ss_assessment_rows")?.addEventListener("click", handleSoftSkillListClick);

document.getElementById("skillDetailsTech")?.addEventListener("toggle", async () => {
  if (document.getElementById("skillDetailsTech")?.open) {
    await loadSkillCategoriesFromApi();
    refreshSkillAssessmentCategoryLabels();
    setSkillKind("tech");
  }
  refreshSkillInfoPanel();
});
document.getElementById("skillDetailsSoft")?.addEventListener("toggle", async () => {
  if (document.getElementById("skillDetailsSoft")?.open) {
    await loadSkillCategoriesFromApi();
    refreshSkillAssessmentCategoryLabels();
    setSkillKind("soft");
  }
  refreshSkillInfoPanel();
});

document.getElementById("skillForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (isMitarbeiter && !document.getElementById("sk_editId").value) {
    toast("Kein Skill-Profil zugeordnet. Bitte Ihren Unit Lead kontaktieren.", "#e74c3c", 5000);
    return;
  }
  if (!validateSkillFormFields()) return;
  const skills = getSkillAssessmentData();
  const softSkills = getSoftSkillAssessmentData();
  const nachname = document.getElementById("sk_nachname").value.trim();
  const vorname = document.getElementById("sk_vorname").value.trim();
  const catalogData = getSkillFormCatalogData();
  const entry = {
    nachname,
    vorname,
    org_role_ids: catalogData.org_role_ids,
    org_roles: catalogData.org_roles,
    position_ids: catalogData.position_ids,
    positions: catalogData.positions,
    rolle: catalogData.rolle,
    position_id: catalogData.position_id,
    name: `${nachname}, ${vorname}`,
    skills,
    softSkills,
    erfasser: currentName,
    type: "skill",
  };
  const email = document.getElementById("sk_email").value.trim().toLowerCase();
  if (email) entry.email = email;
  const saveUnit = resolveSkillEntryUnit(entry);
  if (!saveUnit) {
    toast(
      "Unit fehlt beim Mitarbeiter. Bitte Unit in der Benutzerverwaltung zuweisen oder einen bestehenden Mitarbeiter bearbeiten.",
      "#e74c3c",
      5000
    );
    return;
  }
  entry.unit = saveUnit;
  const personalnummer = document.getElementById("sk_personalnummer")?.value.trim() || "";
  if (personalnummer) entry.personalnummer = personalnummer;
  const zertifikate = document.getElementById("sk_zertifikate")?.value.trim() || "";
  const zertifiziert = document.getElementById("sk_zertifiziert")?.value || "";
  if (zertifikate) entry.zertifikate = zertifikate;
  if (zertifiziert) entry.zertifiziert = zertifiziert;
  const label = skillEmployeeLabel(entry);
  const eId = document.getElementById("sk_editId").value;
  if (eId) entry.id = eId;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  try {
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
function getAll(){
  return [
    ...load("portfolio").map((e) => ({ ...e, _type: "portfolio" })),
    ...load("organisation").map((e) => ({ ...e, _type: "organisation" })),
    ...load("skill").map((e) => ({ ...e, _type: "skill" })),
  ];
}
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
  const pc=all.filter(e=>e._type==='portfolio').length,oc=all.filter(e=>e._type==='organisation').length,skc=all.filter(e=>e._type==='skill').length;
  document.getElementById('overviewStats').innerHTML=`
    <div class="stat-card"><div class="num">${all.length}</div><div class="lbl">Gesamt</div></div>
    <div class="stat-card"><div class="num">${pc}</div><div class="lbl">Portfolio</div></div>
    <div class="stat-card"><div class="num">${oc}</div><div class="lbl">Organisation</div></div>
    <div class="stat-card"><div class="num">${skc}</div><div class="lbl">Skills</div></div>`;
  const tb=document.getElementById('overviewBody'),no=document.getElementById('noOverview');
  if(!f.length){tb.innerHTML='';no.style.display='block';return}no.style.display='none';
  const tl={portfolio:'🧩 Portfolio',organisation:'🏢 Organisation',skill:'🧠 Skills'};
  tb.innerHTML=f.map(e=>{let k='',a='',d='';
    if(e._type==='portfolio'){k=esc(e.bezeichnung||'–');a=ampelHTML(e.ampel);d=esc((e.beschreibung||'').substring(0,50))+(e.jahresumsatz?' | Umsatz: '+esc(e.jahresumsatz):'')+(e.hinweis?' | Hinweis: '+esc((e.hinweis||'').substring(0,30)):'')}
    else if(e._type==='organisation'){k='Organisatorischer Aufbau';a='–';d=esc(organisationOverviewDetail(e))}
    else{
      const pnOv=getSkillEntryPersonalnummer(e);
      const idLabel=pnOv?` (${pnOv})`:'';
      k=esc(skillEmployeeLabel(e))+idLabel;
      a='–';
      const nSkills=Array.isArray(e.skills)?e.skills.length:0;
      const nSoft=Array.isArray(e.softSkills)?e.softSkills.length:0;
      d=esc(skillEmployeeCatalogSummary(e))+(nSkills||nSoft?` | ${skillOverviewDetail(e)}`:isLegacySkillEntry(e)?' | Legacy':'');
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
  rcViewUnitPersist?.writePersistedViewUnit?.(superAdminViewUnit);
  renderHeaderUnitSwitcher();
  updateHeaderUnitDisplay();
  updateSuperAdminFormMode();
  refreshUnitContextPanels();
  renderSkillEmployeeNav(entry.id);
  renderOverview();
  renderExportStats();
  if (isAdmin) renderAdminUsers();
  if (document.getElementById("page-gesamtfortschritt")?.classList.contains("active")) {
    renderGesamtfortschrittDashboard();
  }
  if (document.getElementById("page-fortschritt")?.classList.contains("active")) {
    renderFortschrittDashboard();
  }
  if (document.getElementById("page-fortschritt-new")?.classList.contains("active") && typeof initFortschrittNew === "function") {
    initFortschrittNew();
  }
  if (isDemoDatenViewActive()) {
    renderDemoDatenPage();
  }
}

function editEntry(type,id){
  const store = entryStore[type] || [];
  const e = (isSuperAdminViewAll() ? store : load(type)).find((x) => x.id === id);
  if(!e)return;
  switchSuperAdminViewForEntry(e);
  if(type==='portfolio'){
    switchTab('portfolio');
    openPortfolioEditModal(e);
  }else if(type==='organisation'){
    switchTab('organisation');
    loadOrganisationEntry(e);
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
  if (type === "organisation") renderOrganisation();
  renderSkillEmployeeNav();
  renderOverview();
  toast("Gelöscht.", "#e74c3c");
}

// ===== EXPORT =====
function renderExportStats(){const a=getAll();const unitLabel=getViewUnitLabel();document.getElementById('exportStats').innerHTML=`<strong>${a.length}</strong> Eintraege – Unit: <strong>${esc(unitLabel)}</strong> (${load('portfolio').length} Portfolio, ${load('organisation').length} Organisation, ${load('skill').length} Skills)`}
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
        personalnummer: getSkillEntryPersonalnummer(e),
        name: skillEmployeeLabel(e),
        vorname: e.vorname || "",
        rolle: e.rolle || "",
        workstream: e.workstream || "",
        skillKategorie: "Legacy",
        technologie: legacySkillSummary(e),
        level: "",
        bemerkungen: [e.ziel, e.zertifikate].filter(Boolean).join(" | ") || "",
      });
      return;
    }
    e.skills.forEach((s) => {
      rows.push({
        skillArt: "Fachskill",
        personalnummer: getSkillEntryPersonalnummer(e),
        name: e.nachname || skillEmployeeLabel(e).split(", ")[0],
        vorname: e.vorname || "",
        rolle: e.rolle || "",
        workstream: e.workstream || "",
        skillKategorie: s.kategorie,
        technologie: s.technologie,
        level: formatSkillLevel(s),
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
        personalnummer: getSkillEntryPersonalnummer(e),
        name: e.nachname || skillEmployeeLabel(e).split(", ")[0],
        vorname: e.vorname || "",
        rolle: e.rolle || "",
        workstream: e.workstream || "",
        softSkillKategorie: s.kategorie,
        kompetenz: s.kompetenz,
        level: formatSoftSkillLevel(s),
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
  const orgEntries=a.filter(e=>e._type==='organisation');
  if(orgEntries.length){
    md+='## Organisation (Aufbau & Rollen)\n\n';
    orgEntries.forEach(e=>{
      const hat=e.hatTechnologischeGliederung==='ja'?'Ja':e.hatTechnologischeGliederung==='nein'?'Nein':'–';
      md+=`**Organisatorische Unterteilung:** ${hat}\n\n`;
      if(Array.isArray(e.gliederungen)&&e.gliederungen.length){
        md+='| Bereich | Headcount | Umsatz | Beschreibung |\n|---|---:|---|---|\n';
        e.gliederungen.forEach(g=>{
          md+=`| ${String(g.bereich||'').replace(/\|/g,'/')} | ${g.headcount!=null?g.headcount:'–'} | ${String(g.umsatz||'').replace(/\|/g,'/')||'–'} | ${String(g.beschreibung||'').replace(/\|/g,'/').replace(/\n/g,' ')} |\n`;
      });
      md+='\n';
      }
      if(Array.isArray(e.rollen)&&e.rollen.length){
        md+='| Rolle | Anzahl | Bemerkung |\n|---|---:|---|\n';
        e.rollen.forEach(r=>{
          md+=`| ${String(r.rolle||'').replace(/\|/g,'/')} | ${r.anzahl!=null?r.anzahl:'–'} | ${String(r.bemerkung||'').replace(/\|/g,'/')} |\n`;
    });
    md+='\n';
  }
      if(e.bemerkung)md+=`**Bemerkung:** ${String(e.bemerkung).replace(/\n/g,' ')}\n\n`;
    });
  }
  const cleanMd = (v) => String(v || "").replace(/\|/g, "/").replace(/\n/g, " ");
  const skRows = flattenSkillsForExport(a);
  if (skRows.length) {
    md += "## Fachskill-Assessment\n\n";
    md += "| Personalnummer | Name | Vorname | Rolle | Workstream | Skill-Kategorie | Weitere Details | Level | Bemerkungen |\n";
    md += "|---|---|---|---|---|---|---|---|---|---|\n";
    skRows.forEach((r) => {
      md += `| ${cleanMd(r.personalnummer)} | ${cleanMd(r.name)} | ${cleanMd(r.vorname)} | ${cleanMd(r.rolle)} | ${cleanMd(r.workstream)} | ${cleanMd(r.skillKategorie)} | ${cleanMd(r.technologie)} | ${cleanMd(r.level)} | ${cleanMd(r.bemerkungen)} |\n`;
    });
    md += "\n";
  }
  const ssRows = flattenSoftSkillsForExport(a);
  if (ssRows.length) {
    md += "## Soft-Skill-Assessment\n\n";
    md += "| Personalnummer | Name | Vorname | Rolle | Workstream | Soft Skill Kategorie | Weitere Details | Level | Bemerkungen |\n";
    md += "|---|---|---|---|---|---|---|---|---|---|\n";
    ssRows.forEach((r) => {
      md += `| ${cleanMd(r.personalnummer)} | ${cleanMd(r.name)} | ${cleanMd(r.vorname)} | ${cleanMd(r.rolle)} | ${cleanMd(r.workstream)} | ${cleanMd(r.softSkillKategorie)} | ${cleanMd(r.kompetenz)} | ${cleanMd(r.level)} | ${cleanMd(r.bemerkungen)} |\n`;
    });
    md += "\n";
  }
  md+='---\n*Generiert aus Unitleiter-Erfassung realcore \u00b7 Transformation ' + planningYearRange() + '*\n';
  const b=new Blob([md],{type:'text/markdown;charset=utf-8'});
  dl(b,'Unitleiter_'+getExportUnitSlug()+'_'+today()+'.md');toast('Markdown exportiert!');}
async function clearAll(){
  if(!confirm('ALLE Eintraege dieser Unit loeschen?'))return;
  await api("/api/entries", { method: "DELETE" });
  await refreshEntries();
  renderOrganisation();
  renderOverview();
  renderExportStats();
  toast('Geloescht.','#e74c3c');
}
function dl(b,n){const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;a.click();URL.revokeObjectURL(a.href)}


function checkAdmin(){
  const adminHeaderBtn = document.getElementById('launcherAdmin');
  if (adminHeaderBtn) adminHeaderBtn.style.display = isAdmin ? '' : 'none';
  const superCard = document.getElementById('superAdminUnitsCard');
  if (superCard) superCard.style.display = isSuperAdmin ? '' : 'none';
  const deployBtn = document.getElementById("btnDeployInfo");
  if (deployBtn) deployBtn.style.display = isAdmin ? "" : "none";
}

let deployInfoCache = null;

function formatDeployDate(iso) {
  if (!iso) return "\u2013";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      ", " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  } catch (_e) { return iso; }
}

function renderDeployPopover(data) {
  const pop = document.getElementById("deployInfoPopover");
  if (!pop) return;
  const esc = (s) => { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; };
  const srcLabel = data.source === "vercel" ? "Vercel" : data.source === "git" ? "Lokal (git)" : "Unbekannt";

  const commits = Array.isArray(data.commits) ? data.commits : [];
  let listHtml = "";
  commits.forEach((c, i) => {
    const shortMsg = esc(c.message || "\u2013");
    const summary = '<span class="di-commit__sha">' + esc(c.sha) + '</span> ' +
      '<span class="di-commit__msg-preview">' + shortMsg + '</span>';
    listHtml +=
      '<details class="di-commit"' + (i === 0 ? " open" : "") + '>' +
        '<summary class="di-commit__summary">' + summary + '</summary>' +
        '<div class="di-commit__body">' +
          '<div class="di-commit__detail"><span class="di-commit__lbl">Autor</span> ' + esc(c.author) + '</div>' +
          '<div class="di-commit__detail"><span class="di-commit__lbl">Datum</span> ' + formatDeployDate(c.date) + '</div>' +
          '<div class="di-commit__detail"><span class="di-commit__lbl">\u00c4nderung</span> ' + shortMsg + '</div>' +
        '</div>' +
      '</details>';
  });

  pop.innerHTML =
    '<div class="deploy-info-popover__title">\u{1F680} Letzte \u00c4nderungen</div>' +
    '<div class="deploy-info-popover__meta">' +
      '<span>' + esc(data.branch || "\u2013") + '</span> \u00b7 ' +
      '<span>' + srcLabel + '</span> \u00b7 ' +
      '<span>Server ' + formatDeployDate(data.deployedAt) + '</span>' +
    '</div>' +
    (listHtml || '<div class="deploy-info-popover__row">Keine Commits verf\u00fcgbar</div>');
}

async function toggleDeployInfo() {
  const pop = document.getElementById("deployInfoPopover");
  if (!pop) return;
  if (!pop.hidden) { pop.hidden = true; return; }
  if (!deployInfoCache) {
    try {
      deployInfoCache = await api("/api/admin/deploy-info");
    } catch (_e) {
      deployInfoCache = { deployedAt: "", source: "unknown", branch: "", commits: [] };
    }
  }
  renderDeployPopover(deployInfoCache);
  pop.hidden = false;
}

function initDeployInfo() {
  const btn = document.getElementById("btnDeployInfo");
  if (!btn) return;
  btn.addEventListener("click", (e) => { e.stopPropagation(); toggleDeployInfo(); });
  document.addEventListener("click", (e) => {
    const pop = document.getElementById("deployInfoPopover");
    if (pop && !pop.hidden && !pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      pop.hidden = true;
    }
  });
}

let _planningYearsCache = null;

function planningYearRange() {
  const c = _planningYearsCache;
  const s = c?.startYear || 2026;
  const e = c?.endYear || 2029;
  return s + "\u2013" + e;
}

async function loadPlanningYears(force) {
  if (_planningYearsCache && !force) return _planningYearsCache;
  try {
    const data = await api("/api/config/planning-years");
    _planningYearsCache = data;
    window._rcPlanningYears = data.years;
    document.querySelectorAll(".planning-yr-range").forEach(el => {
      el.textContent = data.startYear + "\u2013" + data.endYear;
    });
    return data;
  } catch (_e) {
    return _planningYearsCache || { startYear: 2026, endYear: 2029, years: [2026, 2027, 2028, 2029] };
  }
}

function initAdminSettings() {
  loadPlanningYears().then((cfg) => {
    const selStart = document.getElementById("settingsStartYear");
    const selEnd = document.getElementById("settingsEndYear");
    if (!selStart || !selEnd) return;
    selStart.innerHTML = "";
    for (let y = 2025; y <= 2035; y++) {
      const o = document.createElement("option");
      o.value = y; o.textContent = y;
      if (y === cfg.startYear) o.selected = true;
      selStart.appendChild(o);
    }
    const fillEnd = () => {
      const s = Number(selStart.value);
      const prevEnd = Number(selEnd.value) || cfg.endYear;
      selEnd.innerHTML = "";
      for (let y = s + 1; y <= 2040; y++) {
        const o = document.createElement("option");
        o.value = y; o.textContent = y;
        if (y === prevEnd) o.selected = true;
        selEnd.appendChild(o);
      }
    };
    fillEnd();
    selStart.onchange = fillEnd;
  });
}

window.savePlanningYears = async function savePlanningYears() {
  const status = document.getElementById("settingsPlanningStatus");
  const s = Number(document.getElementById("settingsStartYear")?.value);
  const e = Number(document.getElementById("settingsEndYear")?.value);
  if (!s || !e) return;
  if (status) status.textContent = "Speichern…";
  try {
    const result = await api("/api/admin/config/planning-years", {
      method: "PUT",
      body: JSON.stringify({ startYear: s, endYear: e }),
    });
    _planningYearsCache = result;
    if (status) { status.textContent = "Gespeichert. Seite neu laden, damit alle Bereiche aktualisiert werden."; status.style.color = "var(--rc-accent)"; }
  } catch (err) {
    if (status) { status.textContent = err.message || "Fehler beim Speichern."; status.style.color = "var(--rc-danger)"; }
  }
};

let adminSubtab = "users";

function collapseAdminPanelDetails(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.querySelectorAll("details.admin-collapsible[open]").forEach((el) => {
    el.removeAttribute("open");
  });
}

function setAdminSubtab(mode) {
  adminSubtab = ADMIN_SUBTAB_MODES.includes(mode) ? mode : "users";
  [
    "adminPanelUsers",
    "adminPanelSkills",
    "adminPanelRoles",
    "adminPanelLeitplanken",
    "adminPanelPermissions",
    "adminPanelOrg",
    "adminPanelDemo",
    "adminPanelSettings",
  ].forEach(collapseAdminPanelDetails);
  document.getElementById("btnAdminSubtabUsers")?.classList.toggle("active", adminSubtab === "users");
  document.getElementById("btnAdminSubtabSkills")?.classList.toggle("active", adminSubtab === "skills");
  document.getElementById("btnAdminSubtabRoles")?.classList.toggle("active", adminSubtab === "roles");
  document
    .getElementById("btnAdminSubtabLeitplanken")
    ?.classList.toggle("active", adminSubtab === "leitplanken");
  document
    .getElementById("btnAdminSubtabPermissions")
    ?.classList.toggle("active", adminSubtab === "permissions");
  document.getElementById("btnAdminSubtabOrg")?.classList.toggle("active", adminSubtab === "org");
  document.getElementById("btnAdminSubtabDemo")?.classList.toggle("active", adminSubtab === "demo");
  document.getElementById("btnAdminSubtabSettings")?.classList.toggle("active", adminSubtab === "settings");
  const usersPanel = document.getElementById("adminPanelUsers");
  const skillsPanel = document.getElementById("adminPanelSkills");
  const rolesPanel = document.getElementById("adminPanelRoles");
  const leitplankenPanel = document.getElementById("adminPanelLeitplanken");
  const permissionsPanel = document.getElementById("adminPanelPermissions");
  const orgPanel = document.getElementById("adminPanelOrg");
  const demoPanel = document.getElementById("adminPanelDemo");
  const settingsPanel = document.getElementById("adminPanelSettings");
  if (usersPanel) usersPanel.style.display = adminSubtab === "users" ? "" : "none";
  if (skillsPanel) skillsPanel.style.display = adminSubtab === "skills" ? "" : "none";
  if (rolesPanel) rolesPanel.style.display = adminSubtab === "roles" ? "" : "none";
  if (leitplankenPanel) leitplankenPanel.style.display = adminSubtab === "leitplanken" ? "" : "none";
  if (permissionsPanel) permissionsPanel.style.display = adminSubtab === "permissions" ? "" : "none";
  if (orgPanel) orgPanel.style.display = adminSubtab === "org" ? "" : "none";
  if (demoPanel) demoPanel.style.display = adminSubtab === "demo" ? "" : "none";
  if (settingsPanel) settingsPanel.style.display = adminSubtab === "settings" ? "" : "none";
  if (adminSubtab === "skills") renderAdminSkillCategories();
  if (adminSubtab === "roles") renderAdminRolesAndPositions();
  if (adminSubtab === "leitplanken" && typeof initAdminLeitplanken === "function") {
    initAdminLeitplanken();
  }
  if (adminSubtab === "permissions" && typeof renderAdminRolesPermissionsDoc === "function") {
    renderAdminRolesPermissionsDoc();
  }
  if (adminSubtab === "org") renderAdminOrgChart();
  if (adminSubtab === "demo" && typeof renderDemoDatenPage === "function") {
    renderDemoDatenPage();
  }
  if (adminSubtab === "settings") initAdminSettings();
  if (getActiveAppPage() === "admin") updateAppModuleNavActive("admin");
}

async function initAdminPage() {
  await loadMasterUnitsCache();
  await loadSkillCategoriesFromApi();
  await ensureAdminUserFormCatalogs();
  renderAdminUserCatalogCheckboxes("adm_edit_");
  await renderAdminUsers();
  if (isSuperAdmin) await renderSuperAdminUnits();
  setAdminSubtab(adminSubtab);
}

async function loadUnitLeadCandidatesCache() {
  try {
    const users = await api("/api/admin/users");
    unitLeadCandidatesCache = users
      .filter(userIsUnitLeaderCandidate)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "de"));
  } catch (_e) {
    unitLeadCandidatesCache = [];
  }
}

function userHasDeputyUnitLeaderPosition(user) {
  const positions = user?.userPositions || [];
  const key = normalizePositionKey(DEPUTY_UNIT_LEADER_POSITION);
  return positions.some((position) => normalizePositionKey(position) === key);
}

async function loadDeputyCandidatesCache() {
  try {
    const users = await api("/api/admin/users");
    deputyCandidatesCache = users
      .filter(userHasDeputyUnitLeaderPosition)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "de"));
  } catch (_e) {
    deputyCandidatesCache = [];
  }
}

function renderUnitLeadSelect(selectId, selectedId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const picked = selectedId ? String(selectedId) : "";
  if (!unitLeadCandidatesCache.length) {
    select.innerHTML =
      '<option value="">Keine Unit Leiter vorhanden (Position „Unit Leiter“ oder Rolle Unit Lead)</option>';
    select.disabled = true;
    return;
  }
  select.disabled = false;
  select.innerHTML =
    '<option value="">– Unit Leiter waehlen –</option>' +
    unitLeadCandidatesCache
      .map(
        (lead) =>
          `<option value="${lead.id}"${picked === String(lead.id) ? " selected" : ""}>${esc(
            lead.name
          )} (${esc(lead.email)})</option>`
      )
      .join("");
}

function renderDeputyLeadSelect(selectedId, unitName) {
  const select = document.getElementById("adm_unit_edit_deputy_id");
  const hint = document.getElementById("adm_unit_edit_deputy_hint");
  if (!select) return;
  const picked = selectedId ? String(selectedId) : "";
  let candidates = [...deputyCandidatesCache];
  const unitFilter = String(unitName || "").trim();
  if (unitFilter) {
    const onUnit = candidates.filter(
      (user) => Array.isArray(user.units) && user.units.includes(unitFilter)
    );
    if (onUnit.length) candidates = onUnit;
  }
  if (picked) {
    const selected = deputyCandidatesCache.find((user) => String(user.id) === picked);
    if (selected && !candidates.some((user) => String(user.id) === picked)) {
      candidates = [selected, ...candidates];
    }
  }
  if (hint) {
    if (!deputyCandidatesCache.length) {
      hint.textContent = `Keine Benutzer mit Position „${DEPUTY_UNIT_LEADER_POSITION}“ vorhanden. Position in der Rollen-Pflege anlegen und Benutzern zuweisen.`;
    } else if (unitFilter && candidates.length) {
      hint.textContent = `Stellvertreter mit Position „${DEPUTY_UNIT_LEADER_POSITION}“ für Unit „${unitFilter}“. Optional, darf nicht identisch mit Unit Leiter sein.`;
    } else if (unitFilter) {
      hint.textContent = `Kein Stellvertreter für Unit „${unitFilter}“ gefunden. Alle Benutzer mit Position „${DEPUTY_UNIT_LEADER_POSITION}“ werden angeboten.`;
    } else {
      hint.textContent = `Benutzer mit Position „${DEPUTY_UNIT_LEADER_POSITION}“. Optional, darf nicht identisch mit Unit Leiter sein.`;
    }
  }
  if (!deputyCandidatesCache.length) {
    select.innerHTML = '<option value="">Keine Stellvertreter vorhanden</option>';
    select.disabled = true;
    return;
  }
  select.disabled = false;
  select.innerHTML =
    '<option value="">– optional –</option>' +
    candidates
      .map((user) => {
        const unitsLabel =
          Array.isArray(user.units) && user.units.length
            ? ` · ${user.units.map((unit) => esc(unit)).join(", ")}`
            : "";
        return `<option value="${user.id}"${picked === String(user.id) ? " selected" : ""}>${esc(
          user.name
        )} (${esc(user.email)}${unitsLabel})</option>`;
      })
      .join("");
}

function closeAdminEditUnit() {
  const overlay = document.getElementById("admUnitEdit");
  if (overlay) overlay.style.display = "none";
  const errEl = document.getElementById("admUnitEditError");
  if (errEl) errEl.style.display = "none";
}

async function openAdminEditUnit(unit) {
  if (!unit) return;
  await loadUnitLeadCandidatesCache();
  await loadDeputyCandidatesCache();
  document.getElementById("adm_unit_edit_id").value = unit.id;
  document.getElementById("adm_unit_edit_name").value = unit.name || "";
  renderUnitLeadSelect("adm_unit_edit_lead_id", unit.unitLead?.id || "");
  renderDeputyLeadSelect(unit.deputyLead?.id || "", unit.name || "");
  document.getElementById("admUnitEditError").style.display = "none";
  document.getElementById("admUnitEdit").style.display = "flex";
  document.getElementById("adm_unit_edit_name").focus();
  initModalSaveButtonTracker("admUnitEdit", "admUnitEditSave");
}

async function saveAdminEditUnit() {
  const id = document.getElementById("adm_unit_edit_id").value;
  const name = document.getElementById("adm_unit_edit_name").value.trim();
  const unitLeadId = document.getElementById("adm_unit_edit_lead_id")?.value || "";
  const deputyLeadId = document.getElementById("adm_unit_edit_deputy_id")?.value || "";
  const errEl = document.getElementById("admUnitEditError");
  errEl.style.display = "none";

  if (!id || !name) {
    errEl.textContent = "Bitte Unit-Namen eingeben.";
    errEl.style.display = "block";
    return;
  }
  if (!unitLeadId) {
    errEl.textContent = "Bitte einen Unit Leiter zuweisen.";
    errEl.style.display = "block";
    return;
  }
  if (deputyLeadId && deputyLeadId === unitLeadId) {
    errEl.textContent = "Stellvertreter darf nicht identisch mit Unit Leiter sein.";
    errEl.style.display = "block";
    return;
  }

  try {
    const oldUnit = masterUnitsCache.find((u) => String(u.id) === String(id));
    await api(`/api/admin/units/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name,
        unitLeadId: Number(unitLeadId),
        deputyLeadId: deputyLeadId ? Number(deputyLeadId) : null,
      }),
    });
    if (oldUnit && superAdminViewUnit === oldUnit.name && name !== oldUnit.name) {
      superAdminViewUnit = name;
    }
  } catch (error) {
    errEl.textContent = error.message;
    errEl.style.display = "block";
    return;
  }

  const saveBtn = document.getElementById("admUnitEditSave");
  notifyFormSaveSuccess(saveBtn, "Unit aktualisiert!");
  setTimeout(async () => {
    closeAdminEditUnit();
    await loadMasterUnitsCache();
    await renderSuperAdminUnits();
    await renderHeaderUnitSwitcher();
    await renderAdminUsers();
    refreshSuperAdminViews();
  }, 450);
}

async function renderSuperAdminUnits() {
  if (!isSuperAdmin) return;
  const units = await api("/api/admin/units");
  masterUnitsCache = units;
  renderAdminUnitCheckboxes("adm_units_select", getSelectedAdminUnits("adm_units_select"));
  const tbody = document.getElementById("admUnitsBody");
  if (!tbody) return;
  if (!units.length) {
    tbody.innerHTML =
      '<tr><td colspan="4" style="color:var(--rc-muted);font-style:italic">Noch keine Units angelegt.</td></tr>';
    return;
  }
  const personLabel = (person, emptyText) =>
    person?.name
      ? esc(person.name)
      : `<span style="color:var(--rc-muted);font-style:italic">${emptyText}</span>`;
  tbody.innerHTML = units
    .map((u) => {
      return (
        `<tr><td>${esc(u.name)}</td><td>${personLabel(u.unitLead, "Kein Unit Leiter")}</td>` +
        `<td>${personLabel(u.deputyLead, "Kein Stellvertreter")}</td>` +
        `<td style="white-space:nowrap">` +
        `<button type="button" class="btn btn-sm btn-outline" data-action="edit-unit" data-unit-id="${u.id}">✏️ Bearbeiten</button> ` +
        `<button type="button" class="btn btn-sm btn-danger" data-unit-id="${u.id}">🗑️ Entfernen</button>` +
        `</td></tr>`
      );
    })
    .join("");
  tbody.querySelectorAll("[data-action=\"edit-unit\"]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const unit = units.find((u) => String(u.id) === String(btn.getAttribute("data-unit-id")));
      if (unit) openAdminEditUnit(unit);
    });
  });
  tbody.querySelectorAll("button.btn-danger[data-unit-id]").forEach((btn) => {
    btn.addEventListener("click", () => adminDeleteMasterUnit(btn.getAttribute("data-unit-id")));
  });
  if (adminSubtab === "org") renderAdminOrgChart();
}

async function adminAddMasterUnit() {
  const name = document.getElementById("adm_unit_name").value.trim();
  const errEl = document.getElementById("admUnitError");
  clearAdminUnitError();
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

function parseBlockersFromErrorText(errorText) {
  const match = String(errorText || "").match(/Noch vorhanden:\s*\n([\s\S]+)/);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => line.replace(/^[•\-]\s*/, "").trim())
    .filter(Boolean);
}

async function loadUnitDeletionBlockers(unitId) {
  try {
    const res = await fetch(`/api/admin/units/${encodeURIComponent(unitId)}/deletion-blockers`, {
      credentials: "include",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.blockers) ? data.blockers : [];
  } catch (_e) {
    return [];
  }
}

function showAdminUnitDeleteBlockers(unitName, data = {}) {
  const errEl = document.getElementById("admUnitError");
  if (!errEl) return;
  let blockers = Array.isArray(data.blockers) ? data.blockers : [];
  if (!blockers.length) blockers = parseBlockersFromErrorText(data.error);
  const oldGeneric = /Unit hat noch Eintraege/i.test(String(data.error || ""));
  const headline = oldGeneric || !data.error
    ? `Unit „${unitName}“ kann nicht gelöscht werden, solange noch verknüpfte Daten vorhanden sind.`
    : String(data.error).split("\n\n")[0];
  if (!blockers.length) {
    errEl.textContent = headline;
  } else {
    errEl.innerHTML =
      `${esc(headline)}` +
      `<ul class="adm-unit-blocker-list">${blockers.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
  }
  errEl.style.display = "block";
  errEl.closest("details")?.setAttribute("open", "");
  errEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearAdminUnitError() {
  const errEl = document.getElementById("admUnitError");
  if (!errEl) return;
  errEl.textContent = "";
  errEl.innerHTML = "";
  errEl.style.display = "none";
}

async function adminDeleteMasterUnit(id) {
  const unit = masterUnitsCache.find((u) => String(u.id) === String(id));
  if (!unit) return;
  if (!confirm(`Unit „${unit.name}“ wirklich entfernen?`)) return;
  clearAdminUnitError();
  try {
    const res = await fetch(`/api/admin/units/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    let data = {};
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        data = await res.json();
      } catch (_e) {
        data = {};
      }
    }
    if (!res.ok) {
      if (!data.blockers?.length) {
        data.blockers = await loadUnitDeletionBlockers(id);
      }
      showAdminUnitDeleteBlockers(unit.name, data);
      return;
    }
    if (superAdminViewUnit === unit.name) superAdminViewUnit = "all";
    await loadMasterUnitsCache();
    await renderSuperAdminUnits();
    await renderHeaderUnitSwitcher();
    refreshSuperAdminViews();
    toast("Unit entfernt.", "#e74c3c");
  } catch (error) {
    showAdminUnitDeleteBlockers(unit.name, { error: error.message });
  }
}

async function renderAdminUsers(){
  if(!isAdmin) return;
  await loadMasterUnitsCache();
  await ensureAdminUserFormCatalogs();
  adminUsersCache = await api("/api/admin/users");
  populateAdminUserUnitFilterOptions();
  populateAdminUserPositionFilterOptions();
  populateAdminUserOrgRoleFilterOptions();
  renderAdminUsersTableBody();
  if (adminSubtab === "org") renderAdminOrgChart();
}

async function adminAddUser(){
  const email = document.getElementById('adm_email').value.trim().toLowerCase();
  const nn = document.getElementById('adm_nachname').value.trim();
  const vn = document.getElementById('adm_vorname').value.trim();
  const pw = document.getElementById('adm_pw').value;
  const errEl = document.getElementById('admError');
  const okEl = document.getElementById('admSuccess');
  errEl.style.display='none'; okEl.style.display='none';

  if(!email||!nn||!vn||!pw){errEl.textContent='Bitte alle Felder ausfuellen.';errEl.style.display='block';return}
  if(!email.includes('@')){errEl.textContent='Bitte gueltige E-Mail eingeben.';errEl.style.display='block';return}

  try {
    await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email,
        name: nn + ', ' + vn,
        password: pw,
        personalnummer: document.getElementById("adm_personalnummer")?.value.trim() || "",
        minimalAccount: true,
      }),
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
  document.getElementById('adm_personalnummer').value='';
  okEl.textContent='Benutzer ' + email + ' angelegt.';okEl.style.display='block';
  await renderAdminUsers();
  if (isSuperAdmin) await renderSuperAdminUnits();
  const adminCard = document.getElementById("adm_email")?.closest(".card");
  resetFormSaveButtonTracker(adminCard);
  notifyFormSaveSuccess(document.getElementById("btnAdminAddUser"), "Benutzer angelegt!");
}

async function adminDeleteUser(id){
  if(!confirm('Benutzer wirklich loeschen?')) return;
  await api('/api/admin/users/' + id, { method: "DELETE" });
  await renderAdminUsers();
  toast('Benutzer geloescht.');
}

function normalizeImportHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

function findImportColumnIndex(headers, candidates) {
  for (const candidate of candidates) {
    const idx = headers.indexOf(normalizeImportHeader(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
}

const ADMIN_USER_EXPORT_HEADERS = [
  "personalnummer",
  "nachname",
  "vorname",
  "email",
  "positionen",
  "rollen_organisation",
  "units",
  "standort",
  "regionalleiter_email",
  "geschaeftsfuehrung_email",
  "administration",
  "login_gesperrt",
];

function joinImportList(values) {
  return (values || []).filter(Boolean).join("; ");
}

function userToAdminExportRow(user) {
  const nameParts = String(user.name || "").split(", ");
  const nachname = (nameParts[0] || "").trim();
  const vorname = (nameParts[1] || "").trim();
  const rl = adminUsersCache.find((u) => String(u.id) === String(user.regionalleiter_id));
  const gfEmails = resolveGeschaeftsfuehrungIds(user)
    .map((id) => adminUsersCache.find((u) => String(u.id) === String(id))?.email)
    .filter(Boolean);
  const administration = (user.roles || []).filter((role) =>
    SYSTEM_PRIVILEGE_ROLES.includes(role) || SYSTEM_APP_MODULE_ROLES.includes(role)
  );
  return [
    user.personalnummer || "",
    nachname,
    vorname,
    user.email || "",
    joinImportList(user.userPositions),
    joinImportList(user.userOrgRoles),
    joinImportList(user.units),
    user.standort || "",
    rl?.email || "",
    joinImportList(gfEmails),
    joinImportList(administration),
    user.loginBlocked ? "ja" : "nein",
  ];
}

async function adminExportUsers() {
  if (typeof XLSX === "undefined") {
    toast("Excel-Bibliothek nicht geladen.", "#e74c3c");
    return;
  }
  await renderAdminUsers();
  if (!adminUsersCache.length) {
    toast("Keine Benutzer zum Exportieren.", "#e74c3c");
    return;
  }
  const matrix = [ADMIN_USER_EXPORT_HEADERS, ...adminUsersCache.map(userToAdminExportRow)];
  const sheet = XLSX.utils.aoa_to_sheet(matrix);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Benutzer");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `benutzer-export-${stamp}.xlsx`);
  toast(`${adminUsersCache.length} Benutzer exportiert.`, "#27ae60");
}

function parseAdminUsersImportWorkbook(workbook) {
  if (!workbook?.SheetNames?.length) {
    throw new Error("Die Excel-Datei enthaelt keine Tabellen.");
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!matrix.length) throw new Error("Die Excel-Datei ist leer.");

  const headers = matrix[0].map((cell) => normalizeImportHeader(cell));
  const idxNr = findImportColumnIndex(headers, ["nr", "personalnummer", "personal-nr", "personalnr"]);
  const idxVorname = findImportColumnIndex(headers, ["vorname", "vornamem", "vornamen"]);
  const idxNachname = findImportColumnIndex(headers, ["nachname", "nachnamen"]);
  const idxMail = findImportColumnIndex(headers, ["mail", "email", "e-mail", "emailadresse"]);
  const idxPositionen = findImportColumnIndex(headers, ["positionen", "position", "userpositions"]);
  const idxOrgRoles = findImportColumnIndex(headers, [
    "rollen_organisation",
    "rollenorganisation",
    "org_rollen",
    "userorgroles",
  ]);
  const idxUnits = findImportColumnIndex(headers, ["units", "unit"]);
  const idxStandort = findImportColumnIndex(headers, ["standort"]);
  const idxRlMail = findImportColumnIndex(headers, [
    "regionalleiter_email",
    "regionalleitermail",
    "regionalleiter",
  ]);
  const idxGfMail = findImportColumnIndex(headers, [
    "geschaeftsfuehrung_email",
    "geschaeftsfuehrungmail",
    "geschaeftsfuehrung",
  ]);
  const idxAdmin = findImportColumnIndex(headers, ["administration", "admin", "privileg"]);

  if (idxVorname < 0 || idxNachname < 0 || idxMail < 0) {
    throw new Error("Erste Zeile muss mindestens vorname, nachname und email (mail) enthalten.");
  }

  const rows = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const line = matrix[i] || [];
    const email = String(line[idxMail] || "").trim();
    const vorname = String(line[idxVorname] || "").trim();
    const nachname = String(line[idxNachname] || "").trim();
    const personalnummer = idxNr >= 0 ? String(line[idxNr] || "").trim() : "";
    if (!email && !vorname && !nachname && !personalnummer) continue;
    rows.push({
      rowNum: i + 1,
      email,
      vorname,
      nachname,
      personalnummer,
      positionen: idxPositionen >= 0 ? String(line[idxPositionen] || "").trim() : "",
      rollenOrganisation: idxOrgRoles >= 0 ? String(line[idxOrgRoles] || "").trim() : "",
      units: idxUnits >= 0 ? String(line[idxUnits] || "").trim() : "",
      standort: idxStandort >= 0 ? String(line[idxStandort] || "").trim() : "",
      regionalleiterEmail: idxRlMail >= 0 ? String(line[idxRlMail] || "").trim() : "",
      geschaeftsfuehrungEmail: idxGfMail >= 0 ? String(line[idxGfMail] || "").trim() : "",
      administration: idxAdmin >= 0 ? String(line[idxAdmin] || "").trim() : "",
    });
  }

  if (!rows.length) {
    throw new Error("Keine Datenzeilen in der Excel-Datei gefunden.");
  }
  return rows;
}

function readAdminUsersImportFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        if (typeof XLSX === "undefined") {
          reject(new Error("Excel-Bibliothek nicht geladen."));
          return;
        }
        const workbook = XLSX.read(event.target.result, { type: "array" });
        resolve(parseAdminUsersImportWorkbook(workbook));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsArrayBuffer(file);
  });
}

const SKILL_CATEGORY_EXPORT_HEADERS = [
  "id",
  "kind",
  "name",
  "beschreibung",
  "beispiel",
  "sort_order",
];

const CATALOG_EXPORT_HEADERS = ["id", "name", "sort_order"];

function skillCategoryToExportRow(cat) {
  return [
    cat.id,
    cat.kind,
    cat.name || "",
    cat.beschreibung || "",
    cat.beispiel || "",
    cat.sortOrder ?? cat.sort_order ?? "",
  ];
}

function catalogItemToExportRow(item) {
  return [item.id, item.name || "", item.sortOrder ?? item.sort_order ?? ""];
}

function getWorkbookSheet(workbook, preferredNames, { fallbackFirst = true } = {}) {
  if (!workbook?.SheetNames?.length) return null;
  for (const name of preferredNames) {
    if (workbook.Sheets[name]) return workbook.Sheets[name];
  }
  return fallbackFirst ? workbook.Sheets[workbook.SheetNames[0]] : null;
}

function parseMatrixImportRows(matrix, mapRow) {
  if (!matrix.length) throw new Error("Die Excel-Datei ist leer.");
  const headers = matrix[0].map((cell) => normalizeImportHeader(cell));
  const idxId = findImportColumnIndex(headers, ["id"]);
  const idxName = findImportColumnIndex(headers, ["name", "bezeichnung"]);
  const idxSort = findImportColumnIndex(headers, ["sort_order", "sortorder", "reihenfolge"]);
  if (idxName < 0) {
    throw new Error("Erste Zeile muss mindestens name enthalten.");
  }
  const rows = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const line = matrix[i] || [];
    const name = String(line[idxName] || "").trim();
    const id = idxId >= 0 ? String(line[idxId] || "").trim() : "";
    const sort_order = idxSort >= 0 ? String(line[idxSort] || "").trim() : "";
    if (!name && !id) continue;
    rows.push(
      mapRow({
        rowNum: i + 1,
        id,
        name,
        sort_order,
        line,
        headers,
        idxId,
        idxName,
        idxSort,
      })
    );
  }
  if (!rows.length) throw new Error("Keine Datenzeilen in der Excel-Datei gefunden.");
  return rows;
}

function parseSkillCategoriesImportWorkbook(workbook) {
  const sheet = getWorkbookSheet(workbook, ["skill_kategorien", "kategorien"]);
  if (!sheet) throw new Error("Die Excel-Datei enthaelt keine Tabellen.");
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!matrix.length) throw new Error("Die Excel-Datei ist leer.");

  const headers = matrix[0].map((cell) => normalizeImportHeader(cell));
  const idxId = findImportColumnIndex(headers, ["id"]);
  const idxKind = findImportColumnIndex(headers, ["kind", "art", "typ"]);
  const idxName = findImportColumnIndex(headers, ["name", "kategorie", "kategoriename"]);
  const idxBesch = findImportColumnIndex(headers, ["beschreibung", "description"]);
  const idxBeispiel = findImportColumnIndex(headers, ["beispiel", "example"]);
  const idxSort = findImportColumnIndex(headers, ["sort_order", "sortorder", "reihenfolge"]);

  if (idxName < 0) {
    throw new Error("Erste Zeile muss mindestens name enthalten.");
  }

  const rows = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const line = matrix[i] || [];
    const name = String(line[idxName] || "").trim();
    const rawKind = idxKind >= 0 ? String(line[idxKind] || "").trim().toLowerCase() : "tech";
    const kind = rawKind === "soft" ? "soft" : "tech";
    const id = idxId >= 0 ? String(line[idxId] || "").trim() : "";
    const beschreibung = idxBesch >= 0 ? String(line[idxBesch] || "").trim() : "";
    const beispiel = idxBeispiel >= 0 ? String(line[idxBeispiel] || "").trim() : "";
    const sort_order = idxSort >= 0 ? String(line[idxSort] || "").trim() : "";
    if (!name && !id) continue;
    rows.push({
      rowNum: i + 1,
      id: id || undefined,
      kind,
      name,
      beschreibung,
      beispiel,
      sort_order: sort_order || undefined,
    });
  }
  if (!rows.length) throw new Error("Keine Datenzeilen in der Excel-Datei gefunden.");
  return rows;
}

function parseCatalogSheetRows(sheet, sheetLabel) {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (matrix.length < 2) return [];
  try {
    return parseMatrixImportRows(matrix, ({ rowNum, id, name, sort_order }) => ({
      rowNum,
      id: id || undefined,
      name,
      sort_order: sort_order || undefined,
      sheet: sheetLabel,
    }));
  } catch (error) {
    if (error.message === "Keine Datenzeilen in der Excel-Datei gefunden.") return [];
    throw error;
  }
}

function parseCatalogsImportWorkbook(workbook) {
  if (!workbook?.SheetNames?.length) {
    throw new Error("Die Excel-Datei enthaelt keine Tabellen.");
  }
  const rolesSheet = getWorkbookSheet(workbook, ["rollen_organisation", "rollen", "org_rollen"], {
    fallbackFirst: false,
  });
  const positionsSheet = getWorkbookSheet(workbook, ["positionen", "positions"], {
    fallbackFirst: false,
  });
  const roles = rolesSheet ? parseCatalogSheetRows(rolesSheet, "rollen_organisation") : [];
  const positions = positionsSheet ? parseCatalogSheetRows(positionsSheet, "positionen") : [];

  if (!roles.length && !positions.length) {
    const fallback = workbook.Sheets[workbook.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(fallback, { header: 1, defval: "" });
    const headers = (matrix[0] || []).map((cell) => normalizeImportHeader(cell));
    const idxTyp = findImportColumnIndex(headers, ["typ", "type", "art"]);
    if (idxTyp < 0) {
      throw new Error(
        "Erwartet Blaetter rollen_organisation und positionen, oder eine Spalte typ."
      );
    }
    const idxId = findImportColumnIndex(headers, ["id"]);
    const idxName = findImportColumnIndex(headers, ["name"]);
    const idxSort = findImportColumnIndex(headers, ["sort_order", "sortorder"]);
    if (idxName < 0) throw new Error("Erste Zeile muss name und typ enthalten.");
    for (let i = 1; i < matrix.length; i += 1) {
      const line = matrix[i] || [];
      const typ = String(line[idxTyp] || "").trim().toLowerCase();
      const name = String(line[idxName] || "").trim();
      if (!name) continue;
      const entry = {
        rowNum: i + 1,
        id: idxId >= 0 ? String(line[idxId] || "").trim() || undefined : undefined,
        name,
        sort_order:
          idxSort >= 0 ? String(line[idxSort] || "").trim() || undefined : undefined,
      };
      if (typ === "position" || typ === "positionen") positions.push(entry);
      else roles.push(entry);
    }
  }
  if (!roles.length && !positions.length) {
    throw new Error("Keine Rollen- oder Positionszeilen gefunden.");
  }
  return { roles, positions };
}

function readImportWorkbookFromFile(file, parser) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        if (typeof XLSX === "undefined") {
          reject(new Error("Excel-Bibliothek nicht geladen."));
          return;
        }
        const workbook = XLSX.read(event.target.result, { type: "array" });
        resolve(parser(workbook));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsArrayBuffer(file);
  });
}

function formatImportResultMessage(result, label) {
  const parts = [];
  if (result.created) parts.push(`${result.created} neu`);
  if (result.updated) parts.push(`${result.updated} aktualisiert`);
  let text = parts.length ? `${label}: ${parts.join(", ")}.` : `${label}: keine Aenderungen.`;
  if (result.errors?.length) {
    const details = result.errors
      .slice(0, 5)
      .map((entry) => {
        const ref = entry.name || entry.email || "–";
        const sheet = entry.sheet ? ` [${entry.sheet}]` : "";
        return `Zeile ${entry.row}${sheet} (${ref}): ${entry.message}`;
      })
      .join(" | ");
    text += ` Fehler: ${details}${result.errors.length > 5 ? " …" : ""}`;
  }
  return text;
}

async function adminExportSkillCategories() {
  if (typeof XLSX === "undefined") {
    toast("Excel-Bibliothek nicht geladen.", "#e74c3c");
    return;
  }
  await loadAdminCategoriesCache();
  if (!adminCategoriesCache.length) {
    toast("Keine Kategorien zum Exportieren.", "#e74c3c");
    return;
  }
  const matrix = [
    SKILL_CATEGORY_EXPORT_HEADERS,
    ...adminCategoriesCache.map(skillCategoryToExportRow),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(matrix);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "skill_kategorien");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `skill-kategorien-export-${stamp}.xlsx`);
  toast(`${adminCategoriesCache.length} Kategorien exportiert.`, "#27ae60");
}

async function adminImportSkillCategories() {
  const fileInput = document.getElementById("adm_skill_categories_import_file");
  const errEl = document.getElementById("admSkillCatImportError");
  const okEl = document.getElementById("admSkillCatImportSuccess");
  const file = fileInput?.files?.[0];
  errEl.style.display = "none";
  okEl.style.display = "none";

  if (!file) {
    errEl.textContent = "Bitte eine Excel-Datei auswaehlen.";
    errEl.style.display = "block";
    return;
  }

  let rows;
  try {
    rows = await readImportWorkbookFromFile(file, parseSkillCategoriesImportWorkbook);
  } catch (error) {
    errEl.textContent = error.message || "Excel-Datei konnte nicht gelesen werden.";
    errEl.style.display = "block";
    return;
  }

  try {
    const result = await api("/api/admin/skill-categories/import", {
      method: "POST",
      body: JSON.stringify({ rows }),
    });
    okEl.textContent = formatImportResultMessage(result, "Kategorien-Import");
    okEl.style.display = "block";
    if (fileInput) fileInput.value = "";
    await loadAdminCategoriesCache();
    renderAdminSkillCategories();
    await loadSkillCategoriesFromApi();
    toast("Skill-Kategorien-Import abgeschlossen!");
  } catch (error) {
    errEl.textContent = error.message;
    errEl.style.display = "block";
  }
}

async function adminExportCatalogs() {
  if (typeof XLSX === "undefined") {
    toast("Excel-Bibliothek nicht geladen.", "#e74c3c");
    return;
  }
  await loadAdminAppRolesCache();
  await loadAdminAppPositionsCache();
  if (!adminAppRolesCache.length && !adminAppPositionsCache.length) {
    toast("Keine Rollen oder Positionen zum Exportieren.", "#e74c3c");
    return;
  }
  const workbook = XLSX.utils.book_new();
  const rolesSheet = XLSX.utils.aoa_to_sheet([
    CATALOG_EXPORT_HEADERS,
    ...adminAppRolesCache.map(catalogItemToExportRow),
  ]);
  const positionsSheet = XLSX.utils.aoa_to_sheet([
    CATALOG_EXPORT_HEADERS,
    ...adminAppPositionsCache.map(catalogItemToExportRow),
  ]);
  XLSX.utils.book_append_sheet(workbook, rolesSheet, "rollen_organisation");
  XLSX.utils.book_append_sheet(workbook, positionsSheet, "positionen");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `rollen-positionen-export-${stamp}.xlsx`);
  toast(
    `${adminAppRolesCache.length} Rollen, ${adminAppPositionsCache.length} Positionen exportiert.`,
    "#27ae60"
  );
}

async function adminImportCatalogs() {
  const fileInput = document.getElementById("adm_catalogs_import_file");
  const errEl = document.getElementById("admCatalogImportError");
  const okEl = document.getElementById("admCatalogImportSuccess");
  const file = fileInput?.files?.[0];
  errEl.style.display = "none";
  okEl.style.display = "none";

  if (!file) {
    errEl.textContent = "Bitte eine Excel-Datei auswaehlen.";
    errEl.style.display = "block";
    return;
  }

  let payload;
  try {
    payload = await readImportWorkbookFromFile(file, parseCatalogsImportWorkbook);
  } catch (error) {
    errEl.textContent = error.message || "Excel-Datei konnte nicht gelesen werden.";
    errEl.style.display = "block";
    return;
  }

  try {
    const result = await api("/api/admin/catalogs/import", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const parts = [];
    if (result.roles) parts.push(formatImportResultMessage(result.roles, "Rollen"));
    if (result.positions) parts.push(formatImportResultMessage(result.positions, "Positionen"));
    okEl.textContent = parts.length ? parts.join(" ") : formatImportResultMessage(result, "Import");
    okEl.style.display = "block";
    if (fileInput) fileInput.value = "";
    await loadAppRolePositionCatalogFromApi();
    await loadAdminAppRolesCache();
    await loadAdminAppPositionsCache();
    renderAdminRolesAndPositions();
    toast("Rollen- und Positions-Import abgeschlossen!");
  } catch (error) {
    errEl.textContent = error.message;
    errEl.style.display = "block";
  }
}

async function adminImportUsers() {
  const fileInput = document.getElementById("adm_users_import_file");
  const errEl = document.getElementById("admImportError");
  const okEl = document.getElementById("admImportSuccess");
  const file = fileInput?.files?.[0];
  errEl.style.display = "none";
  okEl.style.display = "none";

  if (!file) {
    errEl.textContent = "Bitte eine Excel-Datei auswaehlen.";
    errEl.style.display = "block";
    return;
  }

  let rows;
  try {
    rows = await readAdminUsersImportFile(file);
  } catch (error) {
    errEl.textContent = error.message || "Excel-Datei konnte nicht gelesen werden.";
    errEl.style.display = "block";
    return;
  }

  try {
    const result = await api("/api/admin/users/import", {
      method: "POST",
      body: JSON.stringify({ rows }),
    });
    const parts = [];
    if (result.created) parts.push(`${result.created} neu angelegt`);
    if (result.updated) parts.push(`${result.updated} aktualisiert`);
    okEl.textContent = parts.length
      ? `Import abgeschlossen: ${parts.join(", ")}.`
      : "Import abgeschlossen: keine Aenderungen.";
    if (result.errors?.length) {
      const details = result.errors
        .slice(0, 5)
        .map((entry) => `Zeile ${entry.row} (${entry.email || "–"}): ${entry.message}`)
        .join(" | ");
      okEl.textContent += ` Fehler: ${details}${result.errors.length > 5 ? " …" : ""}`;
    }
    okEl.style.display = "block";
    if (fileInput) fileInput.value = "";
    await renderAdminUsers();
    toast("Benutzer-Import abgeschlossen!");
  } catch (error) {
    errEl.textContent = error.message;
    errEl.style.display = "block";
  }
}

function updateAdminEditUnitsVisibility() {
  const roles = getAdminFormRoles("adm_edit_");
  const unitsHint = document.getElementById("adm_edit_units_hint");
  const standortWrap = document.getElementById("adm_edit_standort_wrap");
  const gfWrap = document.getElementById("adm_edit_geschaeftsfuehrung_wrap");
  const regionalWrap = document.getElementById("adm_edit_regionalleiter_wrap");
  const unitLeadWrap = document.getElementById("adm_edit_unit_lead_wrap");
  if (unitsHint) {
    unitsHint.textContent = roles.includes("mitarbeiter")
      ? "Genau eine Unit auswaehlen. Pflicht bei Position Mitarbeiter."
      : roles.some((role) => isUnitScopedSession(role))
        ? "Mindestens eine Unit erforderlich. Mehrere Units moeglich."
        : "Optional, sofern keine unitbezogene Position gewaehlt ist.";
  }
  updateSuperAdminPasswordField("adm_edit_", editingUserHadSuperAdmin);
  if (standortWrap) standortWrap.style.display = adminFormRequiresRegionalleiterFields("adm_edit_") ? "" : "none";
  if (gfWrap) gfWrap.style.display = adminFormRequiresRegionalleiterFields("adm_edit_") ? "" : "none";
  if (regionalWrap) regionalWrap.style.display = adminFormRequiresRegionalleiter("adm_edit_") ? "" : "none";
  if (unitLeadWrap) unitLeadWrap.style.display = "none";
  updateMitarbeiterUnitLeadAutoHint("adm_edit_");
}

async function onAdminEditRolesChange() {
  const roles = getAdminFormRoles("adm_edit_");
  const preserved = getSelectedAdminUnits("adm_edit_units_select");
  const fallback = editingUserUnits || [];
  const selected = preserved.length ? preserved : fallback;
  updateAdminEditUnitsVisibility();
  const userId = document.getElementById("adm_edit_id")?.value || "";
  if (adminFormRequiresRegionalleiterFields("adm_edit_")) {
    const currentGfIds = getAdminGeschaeftsfuehrungIds("adm_edit_");
    const fallbackGfIds = resolveGeschaeftsfuehrungIds(editingUserSnapshot || {});
    renderGeschaeftsfuehrungCheckboxes(
      "adm_edit_",
      currentGfIds.length ? currentGfIds : fallbackGfIds,
      userId
    );
  }
  if (adminFormRequiresRegionalleiter("adm_edit_")) {
    const currentRl = document.getElementById("adm_edit_regionalleiter_id")?.value || "";
    renderRegionalleiterSelect("adm_edit_regionalleiter_id", currentRl);
  }
  updateMitarbeiterUnitLeadAutoHint("adm_edit_");
  updateAdminAppModuleSection("adm_edit_");
  const pick = roles.includes("mitarbeiter") && selected.length > 1 ? [selected[0]] : selected;
  await refreshAdminUnitCheckboxes("adm_edit_units_select", pick);
}

function closeAdminEditUser() {
  const overlay = document.getElementById("admUserEdit");
  if (overlay) overlay.style.display = "none";
  const errEl = document.getElementById("admEditError");
  if (errEl) errEl.style.display = "none";
}

async function openAdminEditUser(user) {
  if (!user) return;
  await ensureAdminUserFormCatalogs();
  editingUserHadSuperAdmin = getUserRolesList(user).includes("super_admin");
  editingUserSnapshot = {
    standort: user.standort || "",
    geschaeftsfuehrung_id: user.geschaeftsfuehrung_id || "",
    geschaeftsfuehrungIds: resolveGeschaeftsfuehrungIds(user),
    regionalleiter_id: user.regionalleiter_id || "",
    unit_lead_id: user.unit_lead_id || "",
    appModuleRoles: getUserRolesList(user).filter((role) => SYSTEM_APP_MODULE_ROLES.includes(role)),
  };
  editingUserUnits = Array.isArray(user.units) ? [...user.units] : [];
  const editOrgRoleIds = resolveUserOrgRoleIds(user);
  const editPositionIds = resolveUserPositionIds(user);
  await loadMasterUnitsCache();
  await refreshAdminUnitCheckboxes("adm_edit_units_select", editingUserUnits);
  const nameParts = String(user.name || "").split(", ");
  document.getElementById("adm_edit_id").value = user.id;
  document.getElementById("adm_edit_email").value = user.email || "";
  document.getElementById("adm_edit_nachname").value = nameParts[0] || "";
  document.getElementById("adm_edit_vorname").value = nameParts[1] || "";
  document.getElementById("adm_edit_pw").value = "";
  document.getElementById("adm_edit_super_admin_pw").value = "";
  const loginBlockedEl = document.getElementById("adm_edit_login_blocked");
  if (loginBlockedEl) {
    loginBlockedEl.checked = Boolean(user.loginBlocked);
    loginBlockedEl.disabled = isAdminUserProtected(user);
  }
  const personalnummerEl = document.getElementById("adm_edit_personalnummer");
  if (personalnummerEl) personalnummerEl.value = user.personalnummer || "";
  setPersonalnummerFieldEditable(canEditPersonalnummer());
  renderAdminUserCatalogCheckboxes("adm_edit_", editOrgRoleIds, editPositionIds);
  setAdminFormRoles(
    "adm_edit_",
    getUserRolesList(user).filter(
      (role) => SYSTEM_PRIVILEGE_ROLES.includes(role) || SYSTEM_APP_MODULE_ROLES.includes(role)
    )
  );
  setAdminUserCatalogFields("adm_edit_", editOrgRoleIds, editPositionIds);
  setAdminStandortSelect("adm_edit_standort", user.standort);
  renderGeschaeftsfuehrungCheckboxes("adm_edit_", resolveGeschaeftsfuehrungIds(user), user.id);
  renderRegionalleiterSelect(
    "adm_edit_regionalleiter_id",
    user.regionalleiter_id || ""
  );
  const autoLead = resolveUnitLeadFromMasterUnit(editingUserUnits[0] || "");
  const leadSelect = document.getElementById("adm_edit_unit_lead_id");
  if (leadSelect) leadSelect.value = String(autoLead.id || user.unit_lead_id || "");
  await onAdminEditRolesChange();
  document.getElementById("admEditError").style.display = "none";
  document.getElementById("admUserEdit").style.display = "flex";
  document.getElementById("adm_edit_nachname").focus();
  initModalSaveButtonTracker("admUserEdit", "admUserEditSave");
}

async function saveAdminEditUser() {
  const id = document.getElementById("adm_edit_id").value;
  const email = document.getElementById("adm_edit_email").value.trim().toLowerCase();
  const nn = document.getElementById("adm_edit_nachname").value.trim();
  const vn = document.getElementById("adm_edit_vorname").value.trim();
  const pw = document.getElementById("adm_edit_pw").value;
  const roles = getAdminFormRoles("adm_edit_");
  const units = getSelectedAdminUnits("adm_edit_units_select");
  const errEl = document.getElementById("admEditError");
  errEl.style.display = "none";

  if (!id || !email || !nn || !vn) {
    errEl.textContent = "Bitte alle Pflichtfelder ausfuellen.";
    errEl.style.display = "block";
    return;
  }
  if (!email.includes("@")) {
    errEl.textContent = "Bitte gueltige E-Mail eingeben.";
    errEl.style.display = "block";
    return;
  }
  const positions = getAdminUserPositionIds("adm_edit_");
  const privilege = getAdminPrivilegeRoles("adm_edit_");
  const appModules = getAdminAppModuleRoles("adm_edit_");
  if (!positions.length && !privilege.length && !appModules.length) {
    errEl.textContent =
      "Mindestens eine Position, Administration-Rolle oder Anwendungszugriff auswaehlen.";
    errEl.style.display = "block";
    return;
  }
  if (roles.some((role) => isUnitScopedSession(role)) && !units.length) {
    errEl.textContent = "Mindestens eine Unit aus der Liste waehlen.";
    errEl.style.display = "block";
    return;
  }
  if (roles.includes("mitarbeiter") && units.length > 1) {
    errEl.textContent = "Mitarbeiter koennen nur einer Unit zugewiesen werden.";
    errEl.style.display = "block";
    return;
  }
  const standort = normalizeUserStandort(
    document.getElementById("adm_edit_standort")?.value ||
      editingUserSnapshot?.standort ||
      ""
  );
  const geschaeftsfuehrungIds = adminFormRequiresRegionalleiterFields("adm_edit_")
    ? getAdminGeschaeftsfuehrungIds("adm_edit_")
    : resolveGeschaeftsfuehrungIds(editingUserSnapshot || {});
  const regionalleiterId =
    document.getElementById("adm_edit_regionalleiter_id")?.value ||
    editingUserSnapshot?.regionalleiter_id ||
    "";
  const isMitarbeiterUser =
    roles.includes("mitarbeiter") || hasMitarbeiterPosition("adm_edit_");
  let unitLeadId = isMitarbeiterUser
    ? resolveMitarbeiterUnitLeadId("adm_edit_", units)
    : document.getElementById("adm_edit_unit_lead_id")?.value ||
      editingUserSnapshot?.unit_lead_id ||
      "";
  if (adminFormRequiresRegionalleiterFields("adm_edit_") && !standort) {
    errEl.textContent = "Bitte Standort Essen oder Bremen waehlen.";
    errEl.style.display = "block";
    return;
  }
  if (adminFormRequiresRegionalleiter("adm_edit_") && !regionalleiterId) {
    errEl.textContent = "Bitte einen Regionalleiter zuweisen.";
    errEl.style.display = "block";
    return;
  }
  if (isMitarbeiterUser && units.length && !unitLeadId) {
    errEl.textContent =
      "Fuer die gewaehlte Unit ist kein Unit Leiter hinterlegt. Bitte unter Units verwalten zuweisen.";
    errEl.style.display = "block";
    return;
  }
  if (!validateSuperAdminGrantPassword("adm_edit_", editingUserHadSuperAdmin, errEl)) return;

  try {
    const payload = {
      email,
      name: nn + ", " + vn,
      password: pw || undefined,
      roles,
      units,
      userOrgRoleIds: getAdminUserOrgRoleIds("adm_edit_"),
      userOrgRoles: getAdminUserOrgRoleNames("adm_edit_"),
      userPositionIds: getAdminUserPositionIds("adm_edit_"),
      userPositions: getAdminUserPositionNames("adm_edit_"),
    };
    if (adminFormRequiresRegionalleiterFields("adm_edit_")) {
      payload.standort = standort;
      payload.geschaeftsfuehrungIds = geschaeftsfuehrungIds;
    }
    if (adminFormRequiresRegionalleiter("adm_edit_")) {
      payload.regionalleiterId = regionalleiterId;
    }
    if (isMitarbeiterUser && unitLeadId) {
      payload.unitLeadId = unitLeadId;
    }
    if (needsSuperAdminGrantPassword("adm_edit_", editingUserHadSuperAdmin)) {
      payload.superAdminGrantPassword = getSuperAdminGrantPassword("adm_edit_");
    }
    if (canEditPersonalnummer()) {
      payload.personalnummer =
        document.getElementById("adm_edit_personalnummer")?.value.trim() || "";
    }
    const loginBlockedEl = document.getElementById("adm_edit_login_blocked");
    if (loginBlockedEl && !loginBlockedEl.disabled) {
      payload.loginBlocked = loginBlockedEl.checked;
    }
    await api("/api/admin/users/" + id, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    errEl.textContent = error.message;
    errEl.style.display = "block";
    return;
  }

  const saveBtn = document.getElementById("admUserEditSave");
  notifyFormSaveSuccess(saveBtn, "Benutzer aktualisiert!");
  setTimeout(async () => {
    closeAdminEditUser();
    await renderAdminUsers();
  }, 450);
}

async function adminEditUser(user) {
  await openAdminEditUser(user);
}

let adminCategoryKind = "tech";
let adminCategoriesCache = [];
let adminAppRolesCache = [];
let adminAppPositionsCache = [];

function setOrgRollen(names) {
  const list = Array.isArray(names) ? names.map((n) => String(n).trim()).filter(Boolean) : [];
  if (typeof ORG_ROLLEN !== "undefined") {
    ORG_ROLLEN.length = 0;
    ORG_ROLLEN.push(...(list.length ? list : DEFAULT_ORG_ROLLEN));
  }
}

function setOrgRollenFromCatalog(items) {
  setOrgRollen(sortCatalogItems(items).map((item) => item.name).filter(Boolean));
}

function setAppPositions(names) {
  const list = Array.isArray(names) ? names.map((n) => String(n).trim()).filter(Boolean) : [];
  if (typeof APP_POSITIONS !== "undefined") {
    APP_POSITIONS.length = 0;
    APP_POSITIONS.push(...(list.length ? list : DEFAULT_APP_POSITIONS));
  }
}

function setAppPositionsFromCatalog(items) {
  setAppPositions(sortCatalogItems(items).map((item) => item.name).filter(Boolean));
}

async function loadAppRolesFromApi() {
  try {
    const roles = await api("/api/app-roles");
    appRolesCatalog = sortCatalogItems(roles || [])
      .map((r) => ({ id: Number(r.id), name: r.name, sortOrder: catalogSortOrder(r) }))
      .filter((r) => Number.isInteger(r.id) && r.id > 0);
    setOrgRollenFromCatalog(appRolesCatalog);
    refreshOrgRolleSelects();
    return roles;
  } catch (_e) {
    appRolesCatalog = [];
    setOrgRollen(DEFAULT_ORG_ROLLEN);
    return null;
  }
}

async function loadAppPositionsFromApi() {
  try {
    const positions = await api("/api/app-positions");
    appPositionsCatalog = sortCatalogItems(positions || [])
      .map((p) => ({ id: Number(p.id), name: p.name, sortOrder: catalogSortOrder(p) }))
      .filter((p) => Number.isInteger(p.id) && p.id > 0);
    setAppPositionsFromCatalog(appPositionsCatalog);
    if (document.getElementById("sk_org_roles")) {
      const editId = document.getElementById("sk_editId")?.value;
      const entry = editId
        ? load("skill").find((x) => String(x.id) === String(editId))
        : null;
      renderSkillEmployeeCatalogCheckboxes(entry || null);
    }
    return positions;
  } catch (_e) {
    appPositionsCatalog = [];
    setAppPositions(DEFAULT_APP_POSITIONS);
    return null;
  }
}

async function loadAppRolePositionCatalogFromApi() {
  await Promise.all([loadAppRolesFromApi(), loadAppPositionsFromApi()]);
  if (document.getElementById("adm_edit_user_org_roles_select")) {
    renderAdminUserCatalogCheckboxes("adm_edit_");
  }
}

async function loadAdminAppRolesCache() {
  try {
    const roles = await api("/api/admin/app-roles");
    applyAdminAppRolesCache(Array.isArray(roles) ? roles : []);
  } catch (error) {
    adminAppRolesCache = [];
    console.error("Rollen laden fehlgeschlagen:", error);
    toast(error.message || "Rollen konnten nicht geladen werden.", "#e74c3c", 5000);
  }
}

async function loadAdminAppPositionsCache() {
  try {
    const positions = await api("/api/admin/app-positions");
    applyAdminAppPositionsCache(Array.isArray(positions) ? positions : []);
  } catch (error) {
    adminAppPositionsCache = [];
    console.error("Positionen laden fehlgeschlagen:", error);
    toast(error.message || "Positionen konnten nicht geladen werden.", "#e74c3c", 5000);
  }
}

function renderAdminCatalogTable({
  tbodyId,
  emptyId,
  items,
  editAction,
  deleteAction,
  moveUpAction,
  moveDownAction,
  onEdit,
  onDelete,
  onMove,
}) {
  const tbody = document.getElementById(tbodyId);
  const empty = document.getElementById(emptyId);
  const sortedItems = sortCatalogItems(items);
  if (!tbody) return;
  if (!sortedItems.length) {
    tbody.innerHTML = "";
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";
  tbody.innerHTML = sortedItems
    .map((item, index) => {
      const isFirst = index === 0;
      const isLast = index === sortedItems.length - 1;
      return (
        `<tr>` +
        `<td><strong>${esc(item.name)}</strong></td>` +
        `<td style="white-space:nowrap">` +
        `<div class="admin-catalog-actions">` +
        `<button type="button" class="admin-catalog-order__btn" data-action="${moveUpAction}" data-item-id="${item.id}" aria-label="Nach oben"${isFirst ? " disabled" : ""}>↑</button>` +
        `<button type="button" class="btn btn-sm btn-outline" data-action="${editAction}" data-item-id="${item.id}">✏️ Bearbeiten</button>` +
        `<button type="button" class="admin-catalog-order__btn" data-action="${moveDownAction}" data-item-id="${item.id}" aria-label="Nach unten"${isLast ? " disabled" : ""}>↓</button>` +
        `<button type="button" class="btn btn-sm btn-danger" data-action="${deleteAction}" data-item-id="${item.id}">🗑️</button>` +
        `</div>` +
        `</td></tr>`
      );
    })
    .join("");
  tbody.querySelectorAll(`[data-action="${editAction}"]`).forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = sortedItems.find((r) => String(r.id) === String(btn.getAttribute("data-item-id")));
      if (item) onEdit(item);
    });
  });
  tbody.querySelectorAll(`[data-action="${deleteAction}"]`).forEach((btn) => {
    btn.addEventListener("click", () => onDelete(btn.getAttribute("data-item-id")));
  });
  if (onMove) {
    tbody.querySelectorAll(`[data-action="${moveUpAction}"]`).forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        onMove(btn.getAttribute("data-item-id"), "up");
      });
    });
    tbody.querySelectorAll(`[data-action="${moveDownAction}"]`).forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        onMove(btn.getAttribute("data-item-id"), "down");
      });
    });
  }
}

async function refreshAdminCatalogDependents() {
  refreshOrgRolleSelects();
  populateAdminUserPositionFilterOptions();
  populateAdminUserOrgRoleFilterOptions();
  if (document.getElementById("adm_edit_user_org_roles_select")) {
    renderAdminUserCatalogCheckboxes("adm_edit_");
  }
  const editId = document.getElementById("sk_editId")?.value;
  const skillEntry = editId ? load("skill").find((x) => String(x.id) === String(editId)) : null;
  if (document.getElementById("sk_org_roles")) {
    renderSkillEmployeeCatalogCheckboxes(skillEntry || null);
  }
}

function applyAdminAppRolesCache(items) {
  adminAppRolesCache = sortCatalogItems(items || []);
  appRolesCatalog = adminAppRolesCache
    .map((r) => ({ id: Number(r.id), name: r.name, sortOrder: catalogSortOrder(r) }))
    .filter((r) => Number.isInteger(r.id) && r.id > 0);
  setOrgRollenFromCatalog(adminAppRolesCache);
}

function applyAdminAppPositionsCache(items) {
  adminAppPositionsCache = sortCatalogItems(items || []);
  appPositionsCatalog = adminAppPositionsCache
    .map((p) => ({ id: Number(p.id), name: p.name, sortOrder: catalogSortOrder(p) }))
    .filter((p) => Number.isInteger(p.id) && p.id > 0);
  setAppPositionsFromCatalog(adminAppPositionsCache);
}

async function moveAdminAppRole(id, direction) {
  try {
    const result = await api(`/api/admin/app-roles/${id}/move`, {
      method: "POST",
      body: JSON.stringify({ direction }),
    });
    applyAdminAppRolesCache(result.items || []);
    await renderAdminRolesAndPositions();
    await refreshAdminCatalogDependents();
  } catch (error) {
    toast(error.message || "Reihenfolge konnte nicht geändert werden.", "#e74c3c", 5000);
  }
}

async function moveAdminAppPosition(id, direction) {
  try {
    const result = await api(`/api/admin/app-positions/${id}/move`, {
      method: "POST",
      body: JSON.stringify({ direction }),
    });
    applyAdminAppPositionsCache(result.items || []);
    await renderAdminRolesAndPositions();
    await refreshAdminCatalogDependents();
  } catch (error) {
    toast(error.message || "Reihenfolge konnte nicht geändert werden.", "#e74c3c", 5000);
  }
}

async function renderAdminRolesAndPositions() {
  if (!isAdmin) return;
  await loadAdminAppRolesCache();
  await loadAdminAppPositionsCache();
  renderAdminCatalogTable({
    tbodyId: "admRolesBody",
    emptyId: "admRolesEmpty",
    items: adminAppRolesCache,
    editAction: "edit-role",
    deleteAction: "delete-role",
    moveUpAction: "move-role-up",
    moveDownAction: "move-role-down",
    onEdit: openAdminRoleEdit,
    onDelete: deleteAdminAppRole,
    onMove: moveAdminAppRole,
  });
  renderAdminCatalogTable({
    tbodyId: "admPositionsBody",
    emptyId: "admPositionsEmpty",
    items: adminAppPositionsCache,
    editAction: "edit-position",
    deleteAction: "delete-position",
    moveUpAction: "move-position-up",
    moveDownAction: "move-position-down",
    onEdit: openAdminPositionEdit,
    onDelete: deleteAdminAppPosition,
    onMove: moveAdminAppPosition,
  });
}

function closeAdminRoleEdit() {
  document.getElementById("admRoleEdit").style.display = "none";
  document.getElementById("admRoleEditError").style.display = "none";
}

function openAdminRoleEdit(role) {
  const isNew = !role;
  document.getElementById("admRoleEditTitle").textContent = isNew ? "Neue Rolle" : "Rolle bearbeiten";
  document.getElementById("adm_role_edit_id").value = isNew ? "" : role.id;
  document.getElementById("adm_role_name").value = isNew ? "" : role.name || "";
  document.getElementById("admRoleEditError").style.display = "none";
  document.getElementById("admRoleEdit").style.display = "flex";
  document.getElementById("adm_role_name").focus();
  initModalSaveButtonTracker("admRoleEdit", "admRoleEditSave");
}

async function saveAdminRoleEdit() {
  const errEl = document.getElementById("admRoleEditError");
  errEl.style.display = "none";
  const id = document.getElementById("adm_role_edit_id").value;
  const name = document.getElementById("adm_role_name").value.trim();
  if (!name) {
    errEl.textContent = "Bitte einen Namen eingeben.";
    errEl.style.display = "block";
    return;
  }
  try {
    if (id) {
      await api(`/api/admin/app-roles/${id}`, { method: "PUT", body: JSON.stringify({ name }) });
    } else {
      await api("/api/admin/app-roles", { method: "POST", body: JSON.stringify({ name }) });
    }
  } catch (error) {
    errEl.textContent = error.message;
    errEl.style.display = "block";
    return;
  }
  const saveBtn = document.getElementById("admRoleEditSave");
  notifyFormSaveSuccess(saveBtn, "Rolle gespeichert.");
  setTimeout(async () => {
    closeAdminRoleEdit();
    await loadAppRolePositionCatalogFromApi();
    await renderAdminRolesAndPositions();
    if (isAdmin) await renderAdminUsers();
    await refreshAdminCatalogDependents();
  }, 450);
}

async function deleteAdminAppRole(id) {
  const role = adminAppRolesCache.find((r) => String(r.id) === String(id));
  if (!role) return;
  if (!confirm(`Rolle „${role.name}“ wirklich loeschen?`)) return;
  await api(`/api/admin/app-roles/${id}`, { method: "DELETE" });
  await loadAppRolePositionCatalogFromApi();
  await renderAdminRolesAndPositions();
  await refreshAdminCatalogDependents();
  toast("Rolle geloescht.", "#e74c3c");
}

function closeAdminPositionEdit() {
  document.getElementById("admPositionEdit").style.display = "none";
  document.getElementById("admPositionEditError").style.display = "none";
}

function openAdminPositionEdit(position) {
  const isNew = !position;
  document.getElementById("admPositionEditTitle").textContent = isNew
    ? "Neue Position"
    : "Position bearbeiten";
  document.getElementById("adm_position_edit_id").value = isNew ? "" : position.id;
  document.getElementById("adm_position_name").value = isNew ? "" : position.name || "";
  document.getElementById("admPositionEditError").style.display = "none";
  document.getElementById("admPositionEdit").style.display = "flex";
  document.getElementById("adm_position_name").focus();
  initModalSaveButtonTracker("admPositionEdit", "admPositionEditSave");
}

async function saveAdminPositionEdit() {
  const errEl = document.getElementById("admPositionEditError");
  errEl.style.display = "none";
  const id = document.getElementById("adm_position_edit_id").value;
  const name = document.getElementById("adm_position_name").value.trim();
  if (!name) {
    errEl.textContent = "Bitte einen Namen eingeben.";
    errEl.style.display = "block";
    return;
  }
  try {
    if (id) {
      await api(`/api/admin/app-positions/${id}`, { method: "PUT", body: JSON.stringify({ name }) });
    } else {
      await api("/api/admin/app-positions", { method: "POST", body: JSON.stringify({ name }) });
    }
  } catch (error) {
    errEl.textContent = error.message;
    errEl.style.display = "block";
    return;
  }
  const saveBtn = document.getElementById("admPositionEditSave");
  notifyFormSaveSuccess(saveBtn, "Position gespeichert.");
  setTimeout(async () => {
    closeAdminPositionEdit();
    await loadAppRolePositionCatalogFromApi();
    await renderAdminRolesAndPositions();
    if (isAdmin) await renderAdminUsers();
    await refreshAdminCatalogDependents();
  }, 450);
}

async function deleteAdminAppPosition(id) {
  const position = adminAppPositionsCache.find((p) => String(p.id) === String(id));
  if (!position) return;
  if (!confirm(`Position „${position.name}“ wirklich loeschen?`)) return;
  await api(`/api/admin/app-positions/${id}`, { method: "DELETE" });
  await loadAppRolePositionCatalogFromApi();
  await renderAdminRolesAndPositions();
  await refreshAdminCatalogDependents();
  toast("Position geloescht.", "#e74c3c");
}

async function loadSkillCategoriesFromApi() {
  try {
    const data = await api("/api/skill-categories");
    setSkillCategories(
      (data.tech || []).map((c) => ({
        ...c,
        beispielTechnologien: c.beispiel,
      }))
    );
    setSoftSkillCategories(
      (data.soft || []).map((c) => ({
        ...c,
        beispielKompetenzen: c.beispiel,
      }))
    );
    return data;
  } catch (_e) {
    return null;
  }
}

async function loadAdminCategoriesCache() {
  try {
    const data = await api("/api/admin/skill-categories");
    adminCategoriesCache = sortCatalogItems(Array.isArray(data) ? data : []);
  } catch (_e) {
    adminCategoriesCache = [];
  }
}

function normalizeAdminCategoryKind(kind) {
  return kind === "soft" ? "soft" : "tech";
}

function applyAdminSkillCategoriesForKind(kind, items) {
  const safeKind = normalizeAdminCategoryKind(kind);
  const sorted = sortCatalogItems(items || []);
  adminCategoriesCache = [
    ...adminCategoriesCache.filter((c) => c.kind !== safeKind),
    ...sorted,
  ];
}

async function moveAdminSkillCategory(id, direction) {
  try {
    const result = await api(`/api/admin/skill-categories/${id}/move`, {
      method: "POST",
      body: JSON.stringify({ direction }),
    });
    applyAdminSkillCategoriesForKind(result.kind, result.items || []);
    await loadSkillCategoriesFromApi();
    renderAdminCategoryTable(result.kind);
    refreshOpenSkillCategorySelects();
    refreshSkillAssessmentCategoryLabels();
    refreshSkillInfoPanel();
  } catch (error) {
    toast(error.message || "Reihenfolge konnte nicht geändert werden.", "#e74c3c", 5000);
  }
}

function renderAdminCategoryTable(kind) {
  const safeKind = normalizeAdminCategoryKind(kind);
  const suffix = safeKind === "soft" ? "Soft" : "Tech";
  const tbody = document.getElementById(`admCategoriesBody${suffix}`);
  const empty = document.getElementById(`admCategoriesEmpty${suffix}`);
  const countEl = document.getElementById(`adm${suffix}CatCount`);
  if (!tbody) return;

  const rows = sortCatalogItems(adminCategoriesCache.filter((c) => c.kind === safeKind));
  if (countEl) countEl.textContent = String(rows.length);
  if (!rows.length) {
    tbody.innerHTML = "";
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";

  tbody.innerHTML = rows
    .map((c, index) => {
      const isFirst = index === 0;
      const isLast = index === rows.length - 1;
      return (
        `<tr>` +
        `<td><strong>${esc(c.name)}</strong></td>` +
        `<td>${esc(c.beschreibung || "–")}</td>` +
        `<td>${esc(c.beispiel || "–")}</td>` +
        `<td style="white-space:nowrap">` +
        `<div class="admin-catalog-actions">` +
        `<button type="button" class="admin-catalog-order__btn" data-action="move-cat-up" data-cat-id="${c.id}" aria-label="Nach oben"${isFirst ? " disabled" : ""}>↑</button>` +
        `<button type="button" class="btn btn-sm btn-outline" data-action="edit-cat" data-cat-id="${c.id}">✏️ Bearbeiten</button>` +
        `<button type="button" class="admin-catalog-order__btn" data-action="move-cat-down" data-cat-id="${c.id}" aria-label="Nach unten"${isLast ? " disabled" : ""}>↓</button>` +
        `<button type="button" class="btn btn-sm btn-danger" data-action="delete-cat" data-cat-id="${c.id}">🗑️</button>` +
        `</div>` +
        `</td></tr>`
      );
    })
    .join("");

  tbody.querySelectorAll('[data-action="edit-cat"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = adminCategoriesCache.find((c) => String(c.id) === String(btn.getAttribute("data-cat-id")));
      if (cat) openAdminCategoryEdit(cat);
    });
  });
  tbody.querySelectorAll('[data-action="delete-cat"]').forEach((btn) => {
    btn.addEventListener("click", () => deleteAdminCategory(btn.getAttribute("data-cat-id")));
  });
  tbody.querySelectorAll('[data-action="move-cat-up"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      void moveAdminSkillCategory(btn.getAttribute("data-cat-id"), "up");
    });
  });
  tbody.querySelectorAll('[data-action="move-cat-down"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      void moveAdminSkillCategory(btn.getAttribute("data-cat-id"), "down");
    });
  });
}

function refreshSkillAssessmentCategoryLabels() {
  document.querySelectorAll("#sk_assessment_rows .skill-assessment-row--view").forEach((row) => {
    const data = enrichTechSkillItemClient(JSON.parse(row.dataset.skillPayload || "{}"));
    renderTechSkillRowView(row, data);
  });
  document.querySelectorAll("#ss_assessment_rows .skill-assessment-row--view").forEach((row) => {
    const data = enrichSoftSkillItemClient(JSON.parse(row.dataset.skillPayload || "{}"));
    renderSoftSkillRowView(row, data);
  });
}

async function reloadOpenSkillEmployeeAfterCatalogChange() {
  await refreshEntries();
  const editId = document.getElementById("sk_editId")?.value || "";
  if (!editId) return;
  const entry = load("skill").find((x) => String(x.id) === String(editId));
  if (entry) await loadSkillEmployeeEntry(entry);
}

function refreshOpenSkillCategorySelects() {
  document
    .querySelectorAll("#sk_assessment_rows .skill-assessment-row--editing")
    .forEach((row) => {
      const data = readTechSkillPayloadFromForm(row);
      const sel = row.querySelector(".sk-kategorie");
      if (!sel) return;
      sel.innerHTML = buildCategoryOptions(data.kategorie, data.kategorie_id);
      const resolved = resolveCategorySelect(data.kategorie, data.kategorie_id);
      sel.value = resolved.value;
      const other = row.querySelector(".sk-kategorie-other");
      if (other) other.value = resolved.other || "";
      syncSonstigesFieldsInRow(row);
    });
  document
    .querySelectorAll("#ss_assessment_rows .skill-assessment-row--editing")
    .forEach((row) => {
      const data = readSoftSkillPayloadFromForm(row);
      const sel = row.querySelector(".ss-kategorie");
      if (!sel) return;
      sel.innerHTML = buildSoftCategoryOptions(data.kategorie, data.kategorie_id);
      const resolved = resolveSoftCategorySelect(data.kategorie, data.kategorie_id);
      sel.value = resolved.value;
      const other = row.querySelector(".ss-kategorie-other");
      if (other) other.value = resolved.other || "";
      syncSonstigesFieldsInRow(row, "ss");
    });
  refreshSkillAssessmentCategoryLabels();
  refreshSkillInfoPanel();
}

async function renderAdminSkillCategories() {
  if (!isAdmin) return;
  await loadAdminCategoriesCache();
  renderAdminCategoryTable("tech");
  renderAdminCategoryTable("soft");
}

function updateAdminCategoryEditLabels() {
  const label = document.getElementById("adm_cat_beispiel_label");
  const kind = normalizeAdminCategoryKind(
    document.getElementById("adm_cat_edit_kind")?.value || adminCategoryKind
  );
  if (label) {
    label.textContent = kind === "soft" ? "Beispiel-Kompetenzen" : "Beispiel-Technologien";
  }
}

function closeAdminCategoryEdit() {
  document.getElementById("admCategoryEdit").style.display = "none";
  document.getElementById("admCategoryEditError").style.display = "none";
}

function openAdminCategoryEdit(category, kindOverride = null) {
  const isNew = !category;
  const kind = normalizeAdminCategoryKind(category?.kind || kindOverride || adminCategoryKind);
  document.getElementById("admCategoryEditTitle").textContent = isNew
    ? "Neue Kategorie"
    : "Kategorie bearbeiten";
  document.getElementById("adm_cat_edit_id").value = isNew ? "" : category.id;
  document.getElementById("adm_cat_edit_kind").value = kind;
  document.getElementById("adm_cat_name").value = isNew ? "" : category.name || "";
  document.getElementById("adm_cat_beschreibung").value = isNew ? "" : category.beschreibung || "";
  document.getElementById("adm_cat_beispiel").value = isNew ? "" : category.beispiel || "";
  document.getElementById("admCategoryEditError").style.display = "none";
  adminCategoryKind = kind;
  updateAdminCategoryEditLabels();
  document.getElementById("admCategoryEdit").style.display = "flex";
  document.getElementById("adm_cat_name").focus();
  initModalSaveButtonTracker("admCategoryEdit", "admCategoryEditSave");
}

async function saveAdminCategoryEdit() {
  const errEl = document.getElementById("admCategoryEditError");
  errEl.style.display = "none";

  const id = document.getElementById("adm_cat_edit_id").value;
  const kind = document.getElementById("adm_cat_edit_kind").value || adminCategoryKind;
  const name = document.getElementById("adm_cat_name").value.trim();
  const beschreibung = document.getElementById("adm_cat_beschreibung").value.trim();
  const beispiel = document.getElementById("adm_cat_beispiel").value.trim();

  if (!name) {
    errEl.textContent = "Bitte Kategorie-Namen eingeben.";
    errEl.style.display = "block";
    return;
  }

  const payload = { name, beschreibung, beispiel };
  try {
    if (id) {
      await api(`/api/admin/skill-categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await api("/api/admin/skill-categories", {
        method: "POST",
        body: JSON.stringify({ ...payload, kind }),
      });
    }
  } catch (error) {
    errEl.textContent = error.message;
    errEl.style.display = "block";
    return;
  }

  const saveBtn = document.getElementById("admCategoryEditSave");
  notifyFormSaveSuccess(saveBtn, "Kategorie gespeichert.");
  setTimeout(async () => {
    closeAdminCategoryEdit();
    await loadSkillCategoriesFromApi();
    await renderAdminSkillCategories();
    refreshOpenSkillCategorySelects();
    await reloadOpenSkillEmployeeAfterCatalogChange();
  }, 450);
}

async function deleteAdminCategory(id) {
  const cat = adminCategoriesCache.find((c) => String(c.id) === String(id));
  if (!cat) return;
  if (!confirm(`Kategorie „${cat.name}“ wirklich loeschen?`)) return;
  await api(`/api/admin/skill-categories/${id}`, { method: "DELETE" });
  await loadSkillCategoriesFromApi();
  await renderAdminSkillCategories();
  refreshOpenSkillCategorySelects();
  await reloadOpenSkillEmployeeAfterCatalogChange();
  toast("Kategorie geloescht.", "#e74c3c");
}

function mergeOrgDeputyLeadLists(left = [], right = []) {
  const map = new Map();
  [...left, ...right].forEach((person) => {
    if (person?.id != null) map.set(String(person.id), person);
  });
  return [...map.values()].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "de")
  );
}

function groupFlatOrgUnitsByLead(units) {
  const byLead = new Map();
  const withoutLead = [];
  for (const unit of units || []) {
    const lead = unit.unitLead;
    const unitNode = {
      name: unit.name,
      mitarbeiter: unit.mitarbeiter || [],
    };
    const unitDeputies = unit.deputyLead ? [unit.deputyLead] : unit.deputyLeads || [];
    if (lead?.id) {
      const leadId = String(lead.id);
      if (!byLead.has(leadId)) {
        byLead.set(leadId, {
          branchType: "unit_lead",
          unitLead: lead,
          deputyLeads: [],
          units: [],
        });
      }
      const branch = byLead.get(leadId);
      branch.units.push(unitNode);
      branch.deputyLeads = mergeOrgDeputyLeadLists(branch.deputyLeads, unitDeputies);
    } else {
      withoutLead.push(unitNode);
    }
  }
  const unitLeads = [...byLead.values()].sort((a, b) =>
    String(a.unitLead?.name || "").localeCompare(String(b.unitLead?.name || ""), "de")
  );
  if (withoutLead.length) {
    unitLeads.push({ branchType: "orphan_units", unitLead: null, deputyLeads: [], units: withoutLead });
  }
  return unitLeads;
}

function normalizeOrgChartRegionalleiter(reg) {
  if (!reg) return reg;
  if (Array.isArray(reg.unitLeads)) {
    return {
      ...reg,
      layout: reg.layout || (reg.unitLeads.length ? "unit_leads" : "supervisors"),
      unitLeads: reg.unitLeads,
    };
  }
  if (Array.isArray(reg.units) && reg.units.length) {
    const isSupervisorShape = reg.units.some(
      (branch) => branch.branchType === "unit_lead" || branch.branchType === "direct" || branch.mitarbeiter
    );
    if (isSupervisorShape && reg.layout === "supervisors") {
      return {
        ...reg,
        layout: "supervisors",
        unitLeads: reg.units.map((branch) => ({
          branchType: branch.branchType,
          unitLead: branch.unitLead,
          deputyLeads: branch.deputyLeads || [],
          units: [],
          mitarbeiter: branch.mitarbeiter || [],
          name: branch.name,
        })),
      };
    }
    return {
      ...reg,
      layout: "unit_leads",
      unitLeads: groupFlatOrgUnitsByLead(reg.units),
    };
  }
  return { ...reg, layout: "supervisors", unitLeads: [] };
}

function normalizeOrgChartData(data) {
  if (!data?.geschaeftsfuehrung) return data;
  return {
    geschaeftsfuehrung: data.geschaeftsfuehrung.map((gf) => ({
      ...gf,
      regionalleiter: (gf.regionalleiter || []).map(normalizeOrgChartRegionalleiter),
    })),
  };
}

function orgNodeHtml(person, cssClass, roleText, extraHtml) {
  return (
    `<div class="org-node ${cssClass}">` +
    `<div class="org-node-role">${esc(roleText)}</div>` +
    `<div class="org-node-name">${esc(person.name)}</div>` +
    (extraHtml || "") +
    `<div class="org-node-email">${esc(person.email)}</div>` +
    `</div>`
  );
}

function orgEmptyHtml(text) {
  return `<div class="org-empty-hint">${esc(text)}</div>`;
}

function renderOrgUnitLeadHead(unitLead, deputyLeads, extraHtml) {
  const deputies = deputyLeads || [];
  if (!unitLead) return "";
  if (!deputies.length) {
    return (
      `<div class="org-node org-node--lead org-node--lead-compact">` +
      (extraHtml || "") +
      `<div class="org-node-name">${esc(unitLead.name)}</div>` +
      `<div class="org-node-email">${esc(unitLead.email)}</div>` +
      `</div>`
    );
  }
  const entries = [
    { role: "Unit Lead", name: unitLead.name, email: unitLead.email },
    ...deputies.map((dep) => ({
      role: "Stellv. Unit Leiter",
      name: dep.name,
      email: dep.email,
    })),
  ];
  const peopleHtml = entries
    .map(
      (entry) =>
        `<div class="org-lead-person">` +
        `<div class="org-lead-person-role">${esc(entry.role)}</div>` +
        `<div class="org-lead-person-name">${esc(entry.name)}</div>` +
        `<div class="org-lead-person-email">${esc(entry.email)}</div>` +
        `</div>`
    )
    .join("");
  return (
    `<div class="org-node org-node--lead org-node--lead-group">` +
    (extraHtml || "") +
    `<div class="org-lead-person-list">${peopleHtml}</div>` +
    `</div>`
  );
}

function renderOrgUnitWithStaff(unit) {
  const staffHtml = unit.mitarbeiter?.length
    ? unit.mitarbeiter.map((p) => orgNodeHtml(p, "org-node--mitarbeiter", "Mitarbeiter")).join("")
    : orgEmptyHtml("Keine Mitarbeiter");

  return (
    `<div class="org-unit-column">` +
    `<div class="org-node org-node--unit">` +
    `<div class="org-node-role">Unit</div>` +
    `<div class="org-node-unit">${esc(unit.name)}</div>` +
    `</div>` +
    `<div class="org-connector-v"></div>` +
    `<div class="org-tier org-tier--mitarbeiter">` +
    `<div class="org-mitarbeiter-row">${staffHtml}</div>` +
    `</div>` +
    `</div>`
  );
}

function renderOrgUnitLeadColumnLabel(branch, layout) {
  if (!branch?.unitLead) return "";
  const text = layout === "supervisors" ? "Vorgesetzter" : "Unit Lead";
  return `<div class="org-tier-label org-unitlead-column-label">${text}</div>`;
}

function renderOrgUnitLeadRailDrop(showRailDrop) {
  return showRailDrop
    ? `<div class="org-connector-v org-connector-v--rail-drop" aria-hidden="true"></div>`
    : "";
}

function renderOrgUnitLeadDirectStaff(branch, layout, options = {}) {
  const showRailDrop = Boolean(options.showRailDrop);
  const staffHtml = branch.mitarbeiter?.length
    ? branch.mitarbeiter.map((p) => orgNodeHtml(p, "org-node--mitarbeiter", "Mitarbeiter")).join("")
    : orgEmptyHtml("Keine Mitarbeiter");

  let headHtml;
  if (branch.unitLead) {
    const unitsHint =
      branch.name && branch.name !== branch.unitLead.name
        ? `<div class="org-node-meta">${esc(branch.name)}</div>`
        : "";
    headHtml = renderOrgUnitLeadHead(branch.unitLead, branch.deputyLeads, unitsHint);
  } else {
    headHtml =
      `<div class="org-node org-node--unit org-node--team">` +
      `<div class="org-node-role">Team</div>` +
      `<div class="org-node-unit">${esc(branch.name || "Direkt der Regionalleitung")}</div>` +
      `</div>`;
  }

  return (
    `<div class="org-unitlead-column org-supervisor-column">` +
    renderOrgUnitLeadRailDrop(showRailDrop) +
    renderOrgUnitLeadColumnLabel(branch, layout) +
    headHtml +
    `<div class="org-connector-v"></div>` +
    `<div class="org-tier org-tier--mitarbeiter">` +
    `<div class="org-mitarbeiter-row">${staffHtml}</div>` +
    `</div>` +
    `</div>`
  );
}

function renderOrgUnitLeadBranch(branch, layout, options = {}) {
  const showRailDrop = Boolean(options.showRailDrop);
  if (!branch.units?.length) {
    return renderOrgUnitLeadDirectStaff(branch, layout, options);
  }

  const unitsHtml = branch.units.map((unit) => renderOrgUnitWithStaff(unit)).join("");

  let headHtml;
  if (branch.unitLead) {
    headHtml = renderOrgUnitLeadHead(branch.unitLead, branch.deputyLeads);
  } else {
    headHtml =
      `<div class="org-node org-node--unit org-node--team">` +
      `<div class="org-node-role">Units</div>` +
      `<div class="org-node-unit">Ohne Unit Lead</div>` +
      `</div>`;
  }

  return (
    `<div class="org-unitlead-column">` +
    renderOrgUnitLeadRailDrop(showRailDrop) +
    renderOrgUnitLeadColumnLabel(branch, layout) +
    headHtml +
    `<div class="org-connector-v"></div>` +
    `<div class="org-tier org-tier--units">` +
    `<div class="org-tier-label">Units</div>` +
    `<div class="org-tier-columns org-unit-columns org-unitlead-units">${unitsHtml}</div>` +
    `</div>` +
    `</div>`
  );
}

function renderOrgRegionalHead(reg) {
  const standortHtml = reg.standort
    ? `<div class="org-node-standort">${esc(reg.standort)}</div>`
    : "";
  return (
    `<div class="org-regional-head">` +
    `<div class="org-node org-node--regional">` +
    `<div class="org-node-role">Regionalleitung</div>` +
    `<div class="org-node-name">${esc(reg.name)}</div>` +
    standortHtml +
    `<div class="org-node-email">${esc(reg.email)}</div>` +
    `</div>` +
    `</div>`
  );
}

function renderOrgRegionalBranch(reg) {
  const useSupervisors = reg.layout === "supervisors";
  const tierLabel = useSupervisors ? "Vorgesetzte & Teams" : "";
  const emptyHint = useSupervisors
    ? "Keine Vorgesetzten oder Mitarbeiter zugewiesen"
    : "Keine Unit Leads oder Units zugewiesen";
  const unitLeads = reg.unitLeads || [];
  const leadCount = unitLeads.length;
  const isMulti = leadCount > 1;
  const rowClass = isMulti ? " org-unitleads-row--multi" : " org-unitleads-row--single";

  const branchesHtml = leadCount
    ? unitLeads.map((branch) =>
        renderOrgUnitLeadBranch(branch, reg.layout, { showRailDrop: isMulti })
      ).join("")
    : orgEmptyHtml(emptyHint);

  return (
    `<div class="org-unitleads-section${rowClass}">` +
    `<div class="org-connector-v" aria-hidden="true"></div>` +
    (isMulti ? `<div class="org-unitleads-rail" aria-hidden="true"></div>` : "") +
    `<div class="org-tier org-tier--units${useSupervisors ? " org-tier--supervisors" : " org-tier--unitleads"}">` +
    (tierLabel ? `<div class="org-tier-label">${tierLabel}</div>` : "") +
    `<div class="org-tier-columns org-unit-columns org-unitlead-columns">${branchesHtml}</div>` +
    `</div>` +
    `</div>`
  );
}

function sortOrgRegionalleiter(regionalleiter) {
  const standortOrder = { Essen: 0, Bremen: 1 };
  return [...(regionalleiter || [])].sort((a, b) => {
    const sa = standortOrder[a.standort] ?? 99;
    const sb = standortOrder[b.standort] ?? 99;
    if (sa !== sb) return sa - sb;
    return String(a.name || "").localeCompare(String(b.name || ""), "de");
  });
}

function sortOrgGeschaeftsfuehrung(geschaeftsfuehrung) {
  return [...(geschaeftsfuehrung || [])].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "de")
  );
}

function mergeRegionalleiterFromGeschaeftsfuehrung(gfList) {
  const byId = new Map();
  for (const gf of gfList || []) {
    for (const reg of gf.regionalleiter || []) {
      const key = String(reg.id);
      if (!byId.has(key)) byId.set(key, reg);
    }
  }
  return sortOrgRegionalleiter([...byId.values()]);
}

function renderOrgGfHeadGroup(gfList) {
  const peopleHtml = gfList
    .map(
      (gf) =>
        `<div class="org-gf-person">` +
        `<div class="org-gf-person-name">${esc(gf.name)}</div>` +
        `<div class="org-gf-person-email">${esc(gf.email)}</div>` +
        `</div>`
    )
    .join("");

  return (
    `<div class="org-gf-head org-gf-head--group">` +
    `<div class="org-node org-node--gf org-node--gf-group">` +
    `<div class="org-node-role">Geschaeftsfuehrung</div>` +
    `<div class="org-gf-person-list">${peopleHtml}</div>` +
    `</div>` +
    `</div>`
  );
}

function renderOrgRegionalTier(regionalList) {
  const regionalCount = regionalList.length;
  const forkMod =
    regionalCount > 1 ? " org-fork--multi" : regionalCount === 1 ? " org-fork--single" : "";

  const regionalHtml = regionalCount
    ? regionalList
        .map(
          (r) =>
            `<div class="org-regional-branch">` +
            renderOrgRegionalHead(r) +
            renderOrgRegionalBranch(r) +
            `</div>`
        )
        .join("")
    : `<div class="org-regional-branch org-regional-branch--empty">${orgEmptyHtml("Keine Regionalleiter zugewiesen")}</div>`;

  return (
    `<div class="org-fork org-fork--regional${forkMod}">` +
    `<div class="org-fork-stem" aria-hidden="true"></div>` +
    `<div class="org-tier org-tier--regional">` +
    `<div class="org-tier-label">Regionalleitung</div>` +
    `<div class="org-tier-columns org-regional-columns org-fork-branches">${regionalHtml}</div>` +
    `</div>` +
    `</div>`
  );
}

function renderOrgChartTree(geschaeftsfuehrung) {
  const gfList = sortOrgGeschaeftsfuehrung(geschaeftsfuehrung);
  if (!gfList.length) {
    return (
      `<section class="org-tree">` +
      `<div class="org-tier org-tier--geschaeftsfuehrung">` +
      `<div class="org-tier-label">Geschaeftsfuehrung</div>` +
      orgEmptyHtml("Geschaeftsfuehrung – Benutzer mit Rolle Geschaeftsfuehrung anlegen") +
      `</div>` +
      `</section>`
    );
  }

  const regionalList = mergeRegionalleiterFromGeschaeftsfuehrung(gfList);

  return (
    `<section class="org-tree org-tree--single-apex">` +
    `<div class="org-tier org-tier--geschaeftsfuehrung">` +
    `<div class="org-tier-label">Geschaeftsfuehrung</div>` +
    renderOrgGfHeadGroup(gfList) +
    `</div>` +
    renderOrgRegionalTier(regionalList) +
    `</section>`
  );
}

function renderAdminOrgChartHtml(data) {
  const tree = data.geschaeftsfuehrung?.length
    ? renderOrgChartTree(data.geschaeftsfuehrung)
    : orgEmptyHtml("Geschaeftsfuehrung – Benutzer mit Rolle Geschaeftsfuehrung anlegen");

  return `<div class="org-chart org-chart--hierarchy">${tree}</div>`;
}

function orgChartHasContent(data) {
  return data.geschaeftsfuehrung?.some((gf) => {
    if (!gf.regionalleiter?.length) return true;
    return gf.regionalleiter.some((r) =>
      (r.unitLeads || []).some(
        (b) =>
          b.unitLead ||
          b.units?.some((u) => u.mitarbeiter?.length || u.name) ||
          b.mitarbeiter?.length ||
          b.name
      )
    );
  });
}

async function renderAdminOrgChart() {
  if (!isAdmin) return;
  const box = document.getElementById("adminOrgChart");
  const empty = document.getElementById("adminOrgEmpty");
  if (!box) return;

  try {
    const data = normalizeOrgChartData(await api("/api/admin/org-chart"));
    const hasContent = orgChartHasContent(data) || data.geschaeftsfuehrung?.length;
    if (!hasContent) {
      box.innerHTML = "";
      box.style.display = "none";
      if (empty) empty.style.display = "block";
      return;
    }
    box.style.display = "";
    if (empty) empty.style.display = "none";
    box.innerHTML = renderAdminOrgChartHtml(data);
    box.scrollTop = 0;
    box.scrollLeft = 0;
  } catch (error) {
    box.innerHTML = `<p style="color:#c0392b;font-size:.82rem">${esc(error.message)}</p>`;
    if (empty) empty.style.display = "none";
  }
}

document.getElementById("admUserFilterName")?.addEventListener("input", renderAdminUsersTableBody);
document.getElementById("admUserFilterUnit")?.addEventListener("change", renderAdminUsersTableBody);
document.getElementById("admUserFilterPosition")?.addEventListener("change", renderAdminUsersTableBody);
document.getElementById("admUserFilterOrgRole")?.addEventListener("change", renderAdminUsersTableBody);
document.getElementById("admUserSelectAllVisible")?.addEventListener("change", (event) => {
  const checked = event.target.checked;
  getVisibleAdminUsers().forEach((u) => {
    if (isAdminUserProtected(u)) return;
    const key = String(u.id);
    if (checked) adminUserSelection.add(key);
    else adminUserSelection.delete(key);
  });
  renderAdminUsersTableBody();
});
document.getElementById("admUserSelectVisible")?.addEventListener("click", selectAllVisibleAdminUsers);
document.getElementById("admUserClearSelection")?.addEventListener("click", clearAdminUserSelection);
document.getElementById("admUserBulkBlockLogin")?.addEventListener("click", () => adminBulkSetLoginBlocked(true));
document.getElementById("admUserBulkUnblockLogin")?.addEventListener("click", () => adminBulkSetLoginBlocked(false));
document.getElementById("btnAdminExportUsers")?.addEventListener("click", adminExportUsers);
document.getElementById("btnAdminImportUsers")?.addEventListener("click", adminImportUsers);
document.getElementById("btnAdminExportSkillCategories")?.addEventListener("click", adminExportSkillCategories);
document.getElementById("btnAdminImportSkillCategories")?.addEventListener("click", adminImportSkillCategories);
document.getElementById("btnAdminExportCatalogs")?.addEventListener("click", adminExportCatalogs);
document.getElementById("btnAdminImportCatalogs")?.addEventListener("click", adminImportCatalogs);
document.getElementById("adminPanelUsers")?.addEventListener("change", onAdminUnitsSelectionChange);
document.getElementById("btnAdminAddUnit")?.addEventListener("click", adminAddMasterUnit);
document.getElementById("btnAdminSubtabUsers")?.addEventListener("click", () => setAdminSubtab("users"));
document.getElementById("btnAdminSubtabSkills")?.addEventListener("click", () => setAdminSubtab("skills"));
document.getElementById("btnAdminSubtabRoles")?.addEventListener("click", () => setAdminSubtab("roles"));
document
  .getElementById("btnAdminSubtabLeitplanken")
  ?.addEventListener("click", () => setAdminSubtab("leitplanken"));
document
  .getElementById("btnAdminSubtabPermissions")
  ?.addEventListener("click", () => setAdminSubtab("permissions"));
document.getElementById("btnAdminSubtabOrg")?.addEventListener("click", () => setAdminSubtab("org"));
document.getElementById("btnAdminSubtabDemo")?.addEventListener("click", () => setAdminSubtab("demo"));
document
  .getElementById("btnAdminSubtabSettings")
  ?.addEventListener("click", () => setAdminSubtab("settings"));
document.getElementById("btnAdminRoleNew")?.addEventListener("click", () => openAdminRoleEdit(null));
document.getElementById("btnAdminPositionNew")?.addEventListener("click", () => openAdminPositionEdit(null));
document.getElementById("admRoleEditCancel")?.addEventListener("click", closeAdminRoleEdit);
document.getElementById("admRoleEditSave")?.addEventListener("click", saveAdminRoleEdit);
document.getElementById("admPositionEditCancel")?.addEventListener("click", closeAdminPositionEdit);
document.getElementById("admPositionEditSave")?.addEventListener("click", saveAdminPositionEdit);
document.getElementById("btnAdminCatNewTech")?.addEventListener("click", () => openAdminCategoryEdit(null, "tech"));
document.getElementById("btnAdminCatNewSoft")?.addEventListener("click", () => openAdminCategoryEdit(null, "soft"));
document.getElementById("admCategoryEditCancel")?.addEventListener("click", closeAdminCategoryEdit);
document.getElementById("admCategoryEditSave")?.addEventListener("click", saveAdminCategoryEdit);
document.getElementById("admCategoryEdit")?.addEventListener("click", (e) => {
  if (e.target.id === "admCategoryEdit") closeAdminCategoryEdit();
});
document.getElementById("admUnitEditCancel")?.addEventListener("click", closeAdminEditUnit);
document.getElementById("admUnitEditSave")?.addEventListener("click", saveAdminEditUnit);
document.getElementById("admUnitEdit")?.addEventListener("click", (e) => {
  if (e.target.id === "admUnitEdit") closeAdminEditUnit();
});
function bindAdminRoleSectionChange(containerId, handler) {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.addEventListener("change", (e) => {
    if (e.target.matches("input[data-admin-role]")) handler();
  });
}
function bindAdminPositionsChange(containerId, handler) {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.addEventListener("change", (e) => {
    if (e.target.matches("input[data-user-position-id], input[data-user-position]")) handler();
  });
}
bindAdminRoleSectionChange("adm_edit_privilege_roles_select", onAdminEditRolesChange);
bindAdminPositionsChange("adm_edit_user_positions_select", onAdminEditRolesChange);
document.getElementById("admUserEditCancel")?.addEventListener("click", closeAdminEditUser);
document.getElementById("admUserEditSave")?.addEventListener("click", saveAdminEditUser);
document.getElementById("admUserEdit")?.addEventListener("click", (e) => {
  if (e.target.id === "admUserEdit") closeAdminEditUser();
});

// Portfolio forms
document.getElementById("portfolioProdukteForm")?.addEventListener("submit", (e) => onSubmitPortfolio("produkte", e));
document.getElementById("portfolioServicesForm")?.addEventListener("submit", (e) => onSubmitPortfolio("services", e));
document.getElementById("portfolioLoesungenForm")?.addEventListener("submit", (e) => onSubmitPortfolio("loesungen", e));
document.getElementById("portfolioPartnergeschaeftForm")?.addEventListener("submit", (e) => onSubmitPortfolio("partnergeschaeft", e));
document.getElementById("portfolioProjektgeschaeftForm")?.addEventListener("submit", (e) => onSubmitPortfolio("projektgeschaeft", e));
document.getElementById("portfolioEditForm")?.addEventListener("submit", onSubmitPortfolioModal);
document.getElementById("portfolioEditCancel")?.addEventListener("click", closePortfolioEditModal);
document.getElementById("portfolioEditClose")?.addEventListener("click", closePortfolioEditModal);
document.getElementById("portfolioEditModal")?.addEventListener("click", (e) => {
  if (e.target.id === "portfolioEditModal") closePortfolioEditModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("portfolioEditModal")?.style.display === "flex") {
    closePortfolioEditModal();
  }
});
document.getElementById("btnPfProdCancel")?.addEventListener("click", () => cancelPortfolioEdit("produkte"));
document.getElementById("btnPfSrvCancel")?.addEventListener("click", () => cancelPortfolioEdit("services"));
document.getElementById("btnPfSolCancel")?.addEventListener("click", () => cancelPortfolioEdit("loesungen"));
document.getElementById("btnPfPgsCancel")?.addEventListener("click", () => cancelPortfolioEdit("partnergeschaeft"));
document.getElementById("btnPfPjgCancel")?.addEventListener("click", () => cancelPortfolioEdit("projektgeschaeft"));

document.getElementById("organisationForm")?.addEventListener("submit", onSubmitOrganisation);
document.getElementById("org_hat_gliederung")?.addEventListener("change", () => {
  updateOrgGliederungSectionVisibility();
  if (document.getElementById("org_hat_gliederung")?.value === "ja") {
    const section = document.getElementById("orgSectionGliederung");
    if (section) section.open = true;
    const rows = document.querySelectorAll("#org_gliederung_rows .org-gliederung-row");
    if (!rows.length) addOrgGliederungRow();
    else renderOrgGliederungCharts();
  }
});
document.getElementById("btnOrgGliederungAdd")?.addEventListener("click", () => {
  const section = document.getElementById("orgSectionGliederung");
  if (section) section.open = true;
  addOrgGliederungRow();
  renderOrgGliederungCharts();
});
document.getElementById("org_gliederung_section")?.addEventListener("input", (e) => {
  if (e.target.matches(".org-gli-hc, .org-gli-umsatz-teur, .org-gli-umsatz, .org-gli-other, .org-gli-beschreibung")) {
    renderOrgGliederungCharts();
  }
});
document.getElementById("org_gliederung_section")?.addEventListener("change", (e) => {
  if (e.target.matches(".org-gli-select")) renderOrgGliederungCharts();
});
document.getElementById("btnOrgRolleAdd")?.addEventListener("click", () => {
  const section = document.getElementById("orgSectionRollen");
  if (section) section.open = true;
  addOrgRolleRow();
  renderOrgRollenCharts();
});
document.getElementById("org_rollen_rows")?.addEventListener("input", (e) => {
  if (e.target.matches(".org-rol-anzahl, .org-rol-other")) renderOrgRollenCharts();
});
document.getElementById("org_rollen_rows")?.addEventListener("change", (e) => {
  if (e.target.matches(".org-rol-select")) renderOrgRollenCharts();
});

// Init
updateAdminUnitsFieldVisibility();
initLoginPasswordToggle();
bindAppModuleNavClicks();
bootSession();

window.doLogin = doLogin;
window.doLogout = doLogout;
window.cancelSkillEdit = cancelSkillEdit;
window.addSkillAssessmentRow = addSkillAssessmentRow;
window.addSoftSkillAssessmentRow = addSoftSkillAssessmentRow;
window.addSkillAssessmentRowFromButton = addSkillAssessmentRowFromButton;
window.addSoftSkillAssessmentRowFromButton = addSoftSkillAssessmentRowFromButton;
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
window.adminAddMasterUnit = adminAddMasterUnit;
