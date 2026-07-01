/**
 * Stabile Entity-IDs für Phase-1-Einträge (Organisation, Skill-Registry).
 */

const crypto = require("crypto");

const SKILL_REGISTRY_TYPE = "skill_registry";

function newUuid() {
  return crypto.randomUUID();
}

function ensureOrgRowIds(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const next = { ...payload };
  if (Array.isArray(next.gliederungen)) {
    next.gliederungen = next.gliederungen.map((g) => ({
      ...g,
      id: g.id || newUuid(),
    }));
  }
  if (Array.isArray(next.rollen)) {
    next.rollen = next.rollen.map((r) => ({
      ...r,
      id: r.id || newUuid(),
    }));
  }
  return next;
}

const SKILL_REGISTRY_KEY_SEP = "\u001e";

function skillRegistryMatchKey(kategorie_id, kategorie, technologie) {
  const kid = kategorie_id != null ? Number(kategorie_id) : NaN;
  const katKey = Number.isFinite(kid) && kid > 0
    ? `id:${kid}`
    : `name:${String(kategorie || "Sonstiges").trim().toLowerCase()}`;
  const tech = String(technologie || "").trim().toLowerCase();
  return `${katKey}${SKILL_REGISTRY_KEY_SEP}${tech}`;
}

function normalizeRegistryItem(item) {
  if (!item || typeof item !== "object") return null;
  const kategorie_id = item.kategorie_id != null ? Number(item.kategorie_id) : null;
  const kategorie = String(item.kategorie || item.category || "Sonstiges").trim();
  const technologie = String(item.technologie || item.label || "").trim();
  const skillItemId = item.skillItemId || item.id;
  if (!skillItemId) return null;
  const matchKey = skillRegistryMatchKey(kategorie_id, kategorie, technologie);
  return {
    skillItemId: String(skillItemId),
    matchKey,
    kategorie_id: Number.isFinite(kategorie_id) ? kategorie_id : null,
    kategorie,
    technologie,
    label: technologie,
  };
}

async function fetchSkillRegistryEntry(pool, unit) {
  const result = await pool.query(
    `SELECT id, payload FROM entries WHERE unit = $1 AND type = $2 LIMIT 1`,
    [unit, SKILL_REGISTRY_TYPE]
  );
  if (!result.rows.length) return { entryId: null, items: [] };
  const row = result.rows[0];
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  const items = (Array.isArray(payload.items) ? payload.items : [])
    .map(normalizeRegistryItem)
    .filter(Boolean);
  return { entryId: row.id, items };
}

async function saveSkillRegistry(pool, unit, entryId, items) {
  const normalizedItems = items.map(normalizeRegistryItem).filter(Boolean);
  const id = entryId || newUuid();
  const payload = {
    id,
    type: SKILL_REGISTRY_TYPE,
    unit,
    workstream: "",
    items: normalizedItems,
  };
  const now = new Date().toISOString();
  if (entryId) {
    await pool.query(
      `UPDATE entries SET payload = $1::jsonb, updated_at = $2 WHERE id = $3`,
      [JSON.stringify(payload), now, id]
    );
    return id;
  }
  await pool.query(
    `INSERT INTO entries (id, type, unit, workstream, payload, created_by_email, updated_by_email, created_at, updated_at)
     VALUES ($1, $2, $3, '', $4::jsonb, $5, $5, $6, $6)`,
    [id, SKILL_REGISTRY_TYPE, unit, JSON.stringify(payload), "system@backfill", now]
  );
  return id;
}

function findRegistryItem(registry, { skillItemId, kategorie_id, kategorie, technologie }) {
  if (skillItemId) {
    const byId = registry.items.find((it) => it.skillItemId === String(skillItemId));
    if (byId) return byId;
  }
  const key = skillRegistryMatchKey(kategorie_id, kategorie, technologie);
  return registry.items.find((it) => {
    const itemKey = skillRegistryMatchKey(it.kategorie_id, it.kategorie, it.technologie);
    return itemKey === key || it.matchKey === key;
  }) || null;
}

function upsertRegistryItem(registry, { skillItemId, kategorie_id, kategorie, technologie }) {
  const label = String(technologie || "").trim();
  const kat = String(kategorie || "Sonstiges").trim();
  let item = findRegistryItem(registry, { skillItemId, kategorie_id, kategorie, technologie: label });
  if (item) {
    if (label) {
      item.label = label;
      item.technologie = label;
    }
    if (kat) item.kategorie = kat;
    if (kategorie_id != null && Number.isFinite(Number(kategorie_id))) {
      item.kategorie_id = Number(kategorie_id);
    }
    item.matchKey = skillRegistryMatchKey(item.kategorie_id, item.kategorie, item.technologie);
    return item.skillItemId;
  }
  const newItem = normalizeRegistryItem({
    skillItemId: skillItemId || newUuid(),
    kategorie_id,
    kategorie: kat,
    technologie: label,
    label,
    matchKey: skillRegistryMatchKey(kategorie_id, kat, label),
  });
  registry.items.push(newItem);
  return newItem.skillItemId;
}

async function enrichSkillEntryWithRegistry(pool, unit, entry) {
  if (!entry || typeof entry !== "object") return entry;
  const registry = await fetchSkillRegistryEntry(pool, unit);
  const skills = (entry.skills || []).map((s) => {
    const rowId = s.id || newUuid();
    const skillItemId = upsertRegistryItem(registry, {
      skillItemId: s.skillItemId,
      kategorie_id: s.kategorie_id,
      kategorie: s.kategorie,
      technologie: s.technologie,
    });
    return { ...s, id: rowId, skillItemId };
  });
  await saveSkillRegistry(pool, unit, registry.entryId, registry.items);
  return { ...entry, skills };
}

async function backfillOrganisationEntryIds(pool) {
  const rows = await pool.query(`SELECT id, payload FROM entries WHERE type = 'organisation'`);
  for (const row of rows.rows) {
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    const enriched = ensureOrgRowIds(payload);
    const prevG = JSON.stringify(payload.gliederungen || []);
    const nextG = JSON.stringify(enriched.gliederungen || []);
    const prevR = JSON.stringify(payload.rollen || []);
    const nextR = JSON.stringify(enriched.rollen || []);
    if (prevG === nextG && prevR === nextR) continue;
    await pool.query(
      `UPDATE entries SET payload = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [
        JSON.stringify({
          ...payload,
          gliederungen: enriched.gliederungen,
          rollen: enriched.rollen,
          id: row.id,
          type: "organisation",
        }),
        row.id,
      ]
    );
  }
}

async function backfillSkillRegistryForUnit(pool, unit, skillEntries) {
  const registry = await fetchSkillRegistryEntry(pool, unit);
  (skillEntries || []).forEach((emp) => {
    (emp.skills || []).forEach((s) => {
      upsertRegistryItem(registry, {
        skillItemId: s.skillItemId,
        kategorie_id: s.kategorie_id,
        kategorie: s.kategorie,
        technologie: s.technologie,
      });
    });
  });
  await saveSkillRegistry(pool, unit, registry.entryId, registry.items);
  for (const emp of skillEntries || []) {
    const enriched = await enrichSkillEntryWithRegistry(pool, unit, emp);
    const prev = JSON.stringify(emp.skills || []);
    const next = JSON.stringify(enriched.skills || []);
    if (prev === next) continue;
    await pool.query(
      `UPDATE entries SET payload = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [
        JSON.stringify({
          ...(emp.payload || emp),
          ...enriched,
          id: emp.id,
          type: "skill",
          unit,
        }),
        emp.id,
      ]
    );
  }
}

async function backfillAllSkillRegistries(pool) {
  const units = await pool.query(
    `SELECT DISTINCT unit FROM entries WHERE type = 'skill' AND unit IS NOT NULL AND unit <> ''`
  );
  for (const row of units.rows) {
    const unit = row.unit;
    const skills = await pool.query(
      `SELECT id, payload FROM entries WHERE type = 'skill' AND unit = $1`,
      [unit]
    );
    const entries = skills.rows.map((r) => ({
      ...(r.payload || {}),
      id: r.id,
      type: "skill",
      unit,
    }));
    await backfillSkillRegistryForUnit(pool, unit, entries);
  }
}

function buildSkillItemsFromRegistry(registry, skillEntries) {
  const agg = {};
  (skillEntries || []).forEach((emp) => {
    const empKey = String(emp.personalnummer || emp.id || emp.email || "").trim();
    if (!empKey) return;
    (emp.skills || []).forEach((s) => {
      const skillItemId = s.skillItemId;
      if (!skillItemId) return;
      if (!agg[skillItemId]) {
        agg[skillItemId] = {
          skillItemId,
          category: s.kategorie || "Sonstiges",
          technologie: String(s.technologie || "").trim(),
          sum: 0,
          count: 0,
          employees: new Set(),
        };
      }
      const lvl = Number(s.level);
      if (Number.isFinite(lvl)) {
        agg[skillItemId].sum += lvl;
        agg[skillItemId].count += 1;
      }
      agg[skillItemId].employees.add(empKey);
      const reg = registry.items.find((it) => it.skillItemId === skillItemId);
      if (reg && reg.technologie) agg[skillItemId].technologie = reg.technologie;
      if (reg && reg.kategorie) agg[skillItemId].category = reg.kategorie;
    });
  });
  return Object.values(agg).map((v) => ({
    skillItemId: v.skillItemId,
    category: v.category,
    technologie: v.technologie,
    avgLevel: v.count ? Math.round((v.sum / v.count) * 10) / 10 : 0,
    employeeCount: v.employees.size,
    assessmentCount: v.count,
  }));
}

function employeeDisplayName(emp) {
  const vor = String(emp.vorname || "").trim();
  const nach = String(emp.nachname || "").trim();
  if (nach && vor) return `${nach}, ${vor}`;
  return String(emp.name || nach || vor || "–").trim();
}

function employeeSkillSummary(emp) {
  const tech = Array.isArray(emp?.skills) ? emp.skills : [];
  const soft = Array.isArray(emp?.softSkills) ? emp.softSkills : [];
  const levels = [...tech, ...soft]
    .map((s) => Number(s.level))
    .filter((n) => Number.isFinite(n));
  const avgLevel = levels.length
    ? Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10
    : 0;
  return {
    skillCount: tech.length + soft.length,
    avgLevel,
  };
}

function employeeSkillRows(emp) {
  const tech = Array.isArray(emp?.skills) ? emp.skills : [];
  const soft = Array.isArray(emp?.softSkills) ? emp.softSkills : [];
  return {
    skills: tech.map((s) => ({
      kind: "tech",
      kategorie: String(s.kategorie || "Sonstiges").trim(),
      technologie: String(s.technologie || s.label || "").trim() || "–",
      level: Number.isFinite(Number(s.level)) ? Number(s.level) : null,
      skillItemId: s.skillItemId || null,
    })),
    softSkills: soft.map((s) => ({
      kind: "soft",
      kategorie: String(s.kategorie || "Sonstiges").trim(),
      level: Number.isFinite(Number(s.level)) ? Number(s.level) : null,
    })),
  };
}

module.exports = {
  SKILL_REGISTRY_TYPE,
  newUuid,
  ensureOrgRowIds,
  skillRegistryMatchKey,
  fetchSkillRegistryEntry,
  saveSkillRegistry,
  enrichSkillEntryWithRegistry,
  backfillOrganisationEntryIds,
  backfillAllSkillRegistries,
  backfillSkillRegistryForUnit,
  buildSkillItemsFromRegistry,
  employeeDisplayName,
  employeeSkillSummary,
  employeeSkillRows,
  normalizeRegistryItem,
};
