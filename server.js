const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_COOKIE = "rc_ul_token";
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL ist nicht gesetzt. Lege eine .env mit DATABASE_URL=postgresql://... an oder exporte die Variable in deinem Terminal."
  );
}

if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET ist nicht gesetzt. Lege eine .env mit JWT_SECRET=<langes-secret> an oder exporte die Variable in deinem Terminal."
  );
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const seedUsers = [
  { email: "olaf.glebsattel@realcore.de", name: "Glebsattel, Olaf", role: "super_admin", units: [] },
  { email: "max.mustermann@realcore.de", name: "Mustermann, Max", role: "unit_lead", units: ["SAP Infrastructure"] },
  { email: "anna.beispiel@realcore.de", name: "Beispiel, Anna", role: "unit_lead", units: ["SAP Engineers"] },
  { email: "thomas.schmidt@realcore.de", name: "Schmidt, Thomas", role: "unit_lead", units: ["SAP Integration"] },
  { email: "lisa.weber@realcore.de", name: "Weber, Lisa", role: "unit_lead", units: ["SAP Architecture"] },
];

const DEFAULT_MASTER_UNITS = [
  "SAP Infrastructure",
  "SAP Engineers",
  "SAP Integration",
  "SAP Architecture",
];

function normalizeUnits(units) {
  if (!units) return [];
  const list = Array.isArray(units) ? units : String(units).split(",");
  return [...new Set(list.map((u) => String(u).trim()).filter(Boolean))];
}

function isAdminRole(role) {
  return role === "admin" || role === "super_admin";
}

function isSuperAdminRole(role) {
  return role === "super_admin";
}

function isUnitScopedRole(role) {
  return role === "unit_lead" || role === "mitarbeiter";
}

function normalizeAssignableRole(role, fallback = "unit_lead") {
  if (role === "admin") return "admin";
  if (role === "mitarbeiter") return "mitarbeiter";
  if (role === "unit_lead") return "unit_lead";
  return fallback;
}

async function validateUnitsForRole(role, units) {
  if (!isUnitScopedRole(role)) return { units: [] };
  const normalized = normalizeUnits(units);
  if (!normalized.length) {
    return { error: "Mindestens eine Unit erforderlich." };
  }
  return validateUnitsAgainstMaster(normalized);
}

const DEFAULT_MITARBEITER_PASSWORD =
  process.env.DEFAULT_MITARBEITER_PASSWORD || "ChangeMe123!";

function isSkillExamplePayload(entry) {
  if (!entry || entry.isExample) return true;
  const exampleIds = new Set(["MA001", "MA002", "MA003"]);
  const mitarbeiterId = String(entry.mitarbeiterId || "").trim().toUpperCase();
  return exampleIds.has(mitarbeiterId);
}

function slugifyEmailPart(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

async function generateSkillEmployeeEmail(entry, entryId) {
  const explicit = String(entry.email || "").trim().toLowerCase();
  if (explicit && explicit.includes("@")) return explicit;

  const vorname = slugifyEmailPart(entry.vorname);
  const nachname = slugifyEmailPart(entry.nachname);
  let base =
    vorname && nachname
      ? `${vorname}.${nachname}@realcore.de`
      : `mitarbeiter.${String(entryId).slice(0, 8)}@realcore.de`;

  let candidate = base;
  let suffix = 2;
  while (suffix <= 50) {
    const existing = await pool.query(
      "SELECT skill_entry_id FROM users WHERE email = $1",
      [candidate]
    );
    if (!existing.rows.length || existing.rows[0].skill_entry_id === entryId) {
      return candidate;
    }
    candidate = base.replace("@", `.${suffix}@`);
    suffix += 1;
  }
  return `mitarbeiter.${entryId}@realcore.de`;
}

async function syncSkillEmployeeUser(entryId, entry, unit) {
  if (!entry || isSkillExamplePayload(entry)) return null;

  const nachname = String(entry.nachname || "").trim();
  const vorname = String(entry.vorname || "").trim();
  if (!nachname || !vorname) return null;

  const name = String(entry.name || `${nachname}, ${vorname}`).trim();
  let email = await generateSkillEmployeeEmail(entry, entryId);
  const unitName = String(unit || entry.unit || "").trim();
  if (!unitName) return null;

  const validated = await validateUnitsAgainstMaster([unitName]);
  const units = validated.units || [unitName];

  const linked = await pool.query(
    "SELECT id FROM users WHERE skill_entry_id = $1",
    [entryId]
  );
  if (linked.rows.length) {
    await pool.query(
      `UPDATE users
       SET email = $1, name = $2, role = 'mitarbeiter', units = $3, updated_at = NOW()
       WHERE skill_entry_id = $4`,
      [email, name, units, entryId]
    );
    return linked.rows[0].id;
  }

  const byEmail = await pool.query(
    "SELECT id, role, skill_entry_id FROM users WHERE email = $1",
    [email]
  );
  if (byEmail.rows.length) {
    const existing = byEmail.rows[0];
    if (!existing.skill_entry_id && isUnitScopedRole(existing.role)) {
      await pool.query(
        `UPDATE users
         SET name = $1, role = 'mitarbeiter', units = $2, skill_entry_id = $3, updated_at = NOW()
         WHERE id = $4`,
        [name, units, entryId, existing.id]
      );
      return existing.id;
    }
    email = `mitarbeiter.${entryId}@realcore.de`;
  }

  const passwordHash = bcrypt.hashSync(DEFAULT_MITARBEITER_PASSWORD, 10);
  try {
    const inserted = await pool.query(
      `INSERT INTO users (email, name, password_hash, role, units, skill_entry_id)
       VALUES ($1, $2, $3, 'mitarbeiter', $4, $5)
       RETURNING id`,
      [email, name, passwordHash, units, entryId]
    );
    return inserted.rows[0].id;
  } catch (error) {
    if (error.code !== "23505") throw error;
    const fallbackEmail = `mitarbeiter.${entryId}@realcore.de`;
    const inserted = await pool.query(
      `INSERT INTO users (email, name, password_hash, role, units, skill_entry_id)
       VALUES ($1, $2, $3, 'mitarbeiter', $4, $5)
       RETURNING id`,
      [fallbackEmail, name, passwordHash, units, entryId]
    );
    return inserted.rows[0].id;
  }
}

async function deleteSkillEmployeeUser(entryId) {
  await pool.query(
    "DELETE FROM users WHERE skill_entry_id = $1 AND role = 'mitarbeiter'",
    [entryId]
  );
}

async function backfillSkillEmployeeUsers() {
  const result = await pool.query(
    "SELECT id, unit, payload FROM entries WHERE type = 'skill'"
  );
  for (const row of result.rows) {
    const payload = row.payload || {};
    if (isSkillExamplePayload(payload)) continue;
    await syncSkillEmployeeUser(row.id, payload, row.unit);
  }
}

async function getMasterUnitNames() {
  const result = await pool.query("SELECT name FROM units ORDER BY name");
  return result.rows.map((r) => r.name);
}

async function validateUnitsAgainstMaster(units) {
  const normalized = normalizeUnits(units);
  if (!normalized.length) return { units: [] };
  const master = await getMasterUnitNames();
  const invalid = normalized.filter((u) => !master.includes(u));
  if (invalid.length) {
    return { error: `Unbekannte Units: ${invalid.join(", ")}` };
  }
  return { units: normalized };
}

async function ensureEntriesSchema() {
  const { rows } = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'entries'
  `);
  if (!rows.length) return;

  const cols = new Set(rows.map((r) => r.column_name));
  if (cols.has("type") && cols.has("payload")) return;

  const legacyName = "entries_legacy_zielwert";
  const legacyCheck = await pool.query("SELECT to_regclass($1) AS reg", [`public.${legacyName}`]);
  if (!legacyCheck.rows[0].reg) {
    await pool.query(`ALTER TABLE entries RENAME TO ${legacyName}`);
  } else {
    await pool.query("DROP TABLE entries");
  }
}

async function ensureUsersSchema() {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS units TEXT[] NOT NULL DEFAULT '{}'
  `);

  const defaultUnitsByEmail = [
    ["max.mustermann@realcore.de", ["SAP Infrastructure"]],
    ["anna.beispiel@realcore.de", ["SAP Engineers"]],
    ["thomas.schmidt@realcore.de", ["SAP Integration"]],
    ["lisa.weber@realcore.de", ["SAP Architecture"]],
  ];
  for (const [email, units] of defaultUnitsByEmail) {
    await pool.query(
      `UPDATE users
       SET units = $2
       WHERE email = $1 AND (units IS NULL OR cardinality(units) = 0)`,
      [email, units]
    );
  }

  await pool.query(
    `UPDATE users SET role = 'super_admin' WHERE email = 'olaf.glebsattel@realcore.de'`
  );

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS skill_entry_id TEXT UNIQUE
  `);
  await backfillSkillEmployeeUsers();
}

async function ensureMasterUnitsSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS units (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const name of DEFAULT_MASTER_UNITS) {
    await pool.query(`INSERT INTO units (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [name]);
  }

  const legacy = await pool.query(`
    SELECT DISTINCT trim(u.unit_name) AS name
    FROM users usr
    CROSS JOIN LATERAL unnest(COALESCE(usr.units, '{}')) AS u(unit_name)
    WHERE trim(u.unit_name) <> ''
  `);
  for (const row of legacy.rows) {
    await pool.query(`INSERT INTO units (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [row.name]);
  }
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'unit_lead',
      units TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await ensureUsersSchema();
  await ensureMasterUnitsSchema();

  await ensureEntriesSchema();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('status', 'team', 'skill')),
      unit TEXT NOT NULL,
      workstream TEXT,
      payload JSONB NOT NULL,
      created_by_email TEXT NOT NULL,
      updated_by_email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const { rows } = await pool.query("SELECT COUNT(*)::int as count FROM users");
  if (rows[0].count > 0) return;

  for (const user of seedUsers) {
    await pool.query(
      `INSERT INTO users (email, name, password_hash, role, units)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.email, user.name, bcrypt.hashSync("ChangeMe123!", 10), user.role, user.units || []]
    );
  }
}

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

function signToken(user, unit) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role, unit },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
}

function auth(req, res, next) {
  const token = req.cookies[TOKEN_COOKIE];
  if (!token) return res.status(401).json({ error: "Nicht angemeldet." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Session ungueltig." });
  }
}

function requireAdmin(req, res, next) {
  if (!isAdminRole(req.user.role)) {
    return res.status(403).json({ error: "Nur Admin erlaubt." });
  }
  return next();
}

function requireSuperAdmin(req, res, next) {
  if (!isSuperAdminRole(req.user.role)) {
    return res.status(403).json({ error: "Nur Super Admin erlaubt." });
  }
  return next();
}

function canAccessUnit(req, entryUnit) {
  return isAdminRole(req.user.role) || req.user.unit === entryUnit;
}

app.get("/api/auth/units", async (_req, res) => {
  const units = await getMasterUnitNames();
  return res.json({ units });
});

app.post("/api/auth/resolve-units", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "E-Mail und Passwort erforderlich." });
  }
  const result = await pool.query(
    "SELECT id, email, name, role, password_hash, units FROM users WHERE email = $1",
    [String(email).trim().toLowerCase()]
  );
  const user = result.rows[0];
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: "E-Mail oder Passwort ungueltig." });
  }
  let units = normalizeUnits(user.units);
  if (isAdminRole(user.role)) {
    units = await getMasterUnitNames();
  } else {
    const validated = await validateUnitsAgainstMaster(units);
    units = validated.units || [];
  }
  return res.json({ units, role: user.role });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password, unit } = req.body || {};
  if (!email || !password || !unit) {
    return res.status(400).json({ error: "E-Mail, Passwort und Unit sind erforderlich." });
  }

  const result = await pool.query(
    "SELECT id, email, name, role, password_hash, units FROM users WHERE email = $1",
    [String(email).trim().toLowerCase()]
  );
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "E-Mail-Adresse nicht bekannt." });
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Falsches Passwort." });
  }

  const selectedUnit = String(unit).trim();
  const userUnits = normalizeUnits(user.units);
  if (isUnitScopedRole(user.role)) {
    if (!userUnits.includes(selectedUnit)) {
      return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
    }
  } else if (isAdminRole(user.role)) {
    const allUnits = await getMasterUnitNames();
    if (allUnits.length && !allUnits.includes(selectedUnit)) {
      return res.status(403).json({ error: "Unit ist nicht registriert." });
    }
  }

  const token = signToken(user, selectedUnit);
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60 * 1000,
  });
  return res.json({
    email: user.email,
    name: user.name,
    role: user.role,
    unit: selectedUnit,
  });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(TOKEN_COOKIE);
  return res.json({ ok: true });
});

app.get("/api/auth/me", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT id, email, name, role FROM users WHERE id = $1",
    [req.user.sub]
  );
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "Benutzer nicht gefunden." });
  return res.json({ ...user, unit: req.user.unit });
});

app.get("/api/entries", auth, async (req, res) => {
  const result =
    isAdminRole(req.user.role)
      ? await pool.query("SELECT * FROM entries ORDER BY updated_at DESC")
      : await pool.query("SELECT * FROM entries WHERE unit = $1 ORDER BY updated_at DESC", [req.user.unit]);
  const parsed = result.rows.map((row) => {
    const payload = row.payload || {};
    return {
      ...payload,
      id: row.id,
      type: row.type,
      unit: row.unit,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by_email,
      updatedBy: row.updated_by_email,
    };
  });
  return res.json(parsed);
});

function normalizeEntryForSave(type, entry, reqUser) {
  if (!entry || typeof entry !== "object") {
    return { error: "Eintrag fehlt." };
  }
  const unit = String(entry.unit || reqUser.unit || "").trim();
  if (!unit) {
    return { error: "Unit fehlt. Bitte erneut anmelden." };
  }
  const workstream = String(entry.workstream || "").trim();
  if (type !== "skill" && !workstream) {
    return { error: "Workstream fehlt." };
  }
  return {
    entry: { ...entry, unit, workstream, type },
    unit,
    workstream,
  };
}

app.post("/api/entries", auth, async (req, res) => {
  const { type, entry } = req.body || {};
  if (!["status", "team", "skill"].includes(type)) {
    return res.status(400).json({ error: "Ungueltiger Typ." });
  }
  const normalized = normalizeEntryForSave(type, entry, req.user);
  if (normalized.error) {
    return res.status(400).json({ error: normalized.error });
  }
  const { entry: safeEntry, unit, workstream } = normalized;
  if (!canAccessUnit(req, unit)) {
    return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
  }

  const id = safeEntry.id || crypto.randomUUID();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO entries (id, type, unit, workstream, payload, created_by_email, updated_by_email, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6, $7, $7)`,
    [
      id,
      type,
      unit,
      workstream,
      JSON.stringify({ ...safeEntry, id, type }),
      req.user.email,
      now,
    ]
  );
  if (type === "skill") {
    await syncSkillEmployeeUser(id, safeEntry, unit);
  }
  return res.status(201).json({ id });
});

app.put("/api/entries/:id", auth, async (req, res) => {
  const { id } = req.params;
  const existingResult = await pool.query("SELECT unit, type FROM entries WHERE id = $1", [id]);
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: "Eintrag nicht gefunden." });
  if (!canAccessUnit(req, existing.unit)) {
    return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
  }
  const { entry } = req.body || {};
  const normalized = normalizeEntryForSave(existing.type, entry, req.user);
  if (normalized.error) {
    return res.status(400).json({ error: normalized.error });
  }
  const { entry: safeEntry, workstream } = normalized;

  await pool.query(
    `UPDATE entries
     SET workstream = $1,
         payload = $2::jsonb,
         updated_by_email = $3,
         updated_at = $4
     WHERE id = $5`,
    [
      workstream,
      JSON.stringify({ ...safeEntry, id, type: existing.type, unit: existing.unit }),
      req.user.email,
      new Date().toISOString(),
      id,
    ]
  );

  if (existing.type === "skill") {
    await syncSkillEmployeeUser(id, safeEntry, existing.unit);
  }

  return res.json({ ok: true });
});

app.delete("/api/entries/:id", auth, async (req, res) => {
  const { id } = req.params;
  const existingResult = await pool.query("SELECT unit, type FROM entries WHERE id = $1", [id]);
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: "Eintrag nicht gefunden." });
  if (!canAccessUnit(req, existing.unit)) {
    return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
  }
  if (existing.type === "skill") {
    await deleteSkillEmployeeUser(id);
  }
  await pool.query("DELETE FROM entries WHERE id = $1", [id]);
  return res.json({ ok: true });
});

app.delete("/api/entries", auth, async (req, res) => {
  if (isAdminRole(req.user.role)) {
    const skills = await pool.query("SELECT id FROM entries WHERE type = 'skill'");
    for (const row of skills.rows) {
      await deleteSkillEmployeeUser(row.id);
    }
    await pool.query("DELETE FROM entries");
  } else {
    const skills = await pool.query(
      "SELECT id FROM entries WHERE type = 'skill' AND unit = $1",
      [req.user.unit]
    );
    for (const row of skills.rows) {
      await deleteSkillEmployeeUser(row.id);
    }
    await pool.query("DELETE FROM entries WHERE unit = $1", [req.user.unit]);
  }
  return res.json({ ok: true });
});

app.get("/api/admin/units", auth, requireAdmin, async (_req, res) => {
  const result = await pool.query("SELECT id, name, created_at FROM units ORDER BY name");
  return res.json(result.rows);
});

app.post("/api/admin/units", auth, requireSuperAdmin, async (req, res) => {
  const { name } = req.body || {};
  const unitName = String(name || "").trim();
  if (!unitName) return res.status(400).json({ error: "Unit-Name fehlt." });
  try {
    const result = await pool.query(
      `INSERT INTO units (name) VALUES ($1) RETURNING id, name, created_at`,
      [unitName]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(400).json({ error: "Unit konnte nicht angelegt werden (evtl. bereits vorhanden)." });
  }
});

app.delete("/api/admin/units/:id", auth, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const unitResult = await pool.query("SELECT id, name FROM units WHERE id = $1", [id]);
  const unit = unitResult.rows[0];
  if (!unit) return res.status(404).json({ error: "Unit nicht gefunden." });

  const entryCount = await pool.query("SELECT COUNT(*)::int AS count FROM entries WHERE unit = $1", [unit.name]);
  if (entryCount.rows[0].count > 0) {
    return res.status(400).json({ error: "Unit hat noch Eintraege und kann nicht geloescht werden." });
  }

  await pool.query(
    `UPDATE users SET units = array_remove(units, $1) WHERE $1 = ANY(units)`,
    [unit.name]
  );
  await pool.query("DELETE FROM units WHERE id = $1", [id]);
  return res.json({ ok: true });
});

app.get("/api/admin/users", auth, requireAdmin, async (_req, res) => {
  const result = await pool.query(
    "SELECT id, email, name, role, units, created_at, updated_at FROM users ORDER BY email"
  );
  return res.json(result.rows.map((row) => ({ ...row, units: normalizeUnits(row.units) })));
});

app.post("/api/admin/users", auth, requireAdmin, async (req, res) => {
  const { email, name, role, password, units } = req.body || {};
  if (!email || !name || !password) return res.status(400).json({ error: "Pflichtfelder fehlen." });
  const safeRole = normalizeAssignableRole(role);
  const unitCheck = await validateUnitsForRole(safeRole, units);
  if (unitCheck.error) return res.status(400).json({ error: unitCheck.error });
  const safeUnits = unitCheck.units || [];
  try {
    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, role, units)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        String(email).trim().toLowerCase(),
        String(name).trim(),
        bcrypt.hashSync(String(password), 10),
        safeRole,
        safeUnits,
      ]
    );
    return res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    return res.status(400).json({ error: "Benutzer konnte nicht angelegt werden." });
  }
});

app.put("/api/admin/users/:id", auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, role, password, units } = req.body || {};
  const userResult = await pool.query("SELECT id, email, role FROM users WHERE id = $1", [id]);
  const user = userResult.rows[0];
  if (!user) return res.status(404).json({ error: "Benutzer nicht gefunden." });

  const updates = [];
  const params = [];
  if (name) {
    params.push(String(name).trim());
    updates.push(`name = $${params.length}`);
  }
  if (role) {
    const safeRole =
      role === "super_admin" ? user.role : normalizeAssignableRole(role, user.role);
    params.push(safeRole);
    updates.push(`role = $${params.length}`);
  }
  if (units !== undefined) {
    const nextRole =
      role === "super_admin"
        ? user.role
        : role
          ? normalizeAssignableRole(role, user.role)
          : user.role;
    const unitCheck = await validateUnitsForRole(nextRole, units);
    if (unitCheck.error) return res.status(400).json({ error: unitCheck.error });
    const safeUnits = unitCheck.units || [];
    params.push(safeUnits);
    updates.push(`units = $${params.length}`);
  }
  if (password) {
    params.push(bcrypt.hashSync(String(password), 10));
    updates.push(`password_hash = $${params.length}`);
  }
  if (!updates.length) return res.status(400).json({ error: "Keine Aenderungen." });
  params.push(new Date().toISOString());
  updates.push(`updated_at = $${params.length}`);
  params.push(id);

  await pool.query(`UPDATE users SET ${updates.join(", ")} WHERE id = $${params.length}`, params);
  return res.json({ ok: true });
});

app.delete("/api/admin/users/:id", auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (String(id) === String(req.user.sub)) {
    return res.status(400).json({ error: "Eigenen Admin-Benutzer nicht loeschen." });
  }
  await pool.query("DELETE FROM users WHERE id = $1", [id]);
  return res.json({ ok: true });
});

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((error, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(error);
  return res.status(500).json({ error: "Interner Serverfehler." });
});

async function start() {
  await initDb();
  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Server laeuft auf http://localhost:${PORT}`);
    });
  }
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Fehler beim Start:", error);
  process.exit(1);
});

module.exports = app;
