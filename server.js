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
  { email: "olaf.glebsattel@realcore.de", name: "Glebsattel, Olaf", role: "admin" },
  { email: "max.mustermann@realcore.de", name: "Mustermann, Max", role: "unit_lead" },
  { email: "anna.beispiel@realcore.de", name: "Beispiel, Anna", role: "unit_lead" },
  { email: "thomas.schmidt@realcore.de", name: "Schmidt, Thomas", role: "unit_lead" },
  { email: "lisa.weber@realcore.de", name: "Weber, Lisa", role: "unit_lead" },
];

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'unit_lead',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

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
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)`,
      [user.email, user.name, bcrypt.hashSync("ChangeMe123!", 10), user.role]
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
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Nur Admin erlaubt." });
  }
  return next();
}

function canAccessUnit(req, entryUnit) {
  return req.user.role === "admin" || req.user.unit === entryUnit;
}

app.post("/api/auth/login", async (req, res) => {
  const { email, password, unit } = req.body || {};
  if (!email || !password || !unit) {
    return res.status(400).json({ error: "E-Mail, Passwort und Unit sind erforderlich." });
  }

  const result = await pool.query(
    "SELECT id, email, name, role, password_hash FROM users WHERE email = $1",
    [String(email).trim().toLowerCase()]
  );
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "E-Mail-Adresse nicht bekannt." });
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Falsches Passwort." });
  }

  const token = signToken(user, String(unit));
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
    unit: String(unit),
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
    req.user.role === "admin"
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

app.post("/api/entries", auth, async (req, res) => {
  const { type, entry } = req.body || {};
  if (!["status", "team", "skill"].includes(type)) {
    return res.status(400).json({ error: "Ungueltiger Typ." });
  }
  if (!entry || !entry.workstream || !entry.unit) {
    return res.status(400).json({ error: "Entry unvollstaendig." });
  }
  if (!canAccessUnit(req, entry.unit)) {
    return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
  }

  const id = entry.id || crypto.randomUUID();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO entries (id, type, unit, workstream, payload, created_by_email, updated_by_email, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6, $7, $7)`,
    [
      id,
      type,
      entry.unit,
      entry.workstream || "",
      JSON.stringify({ ...entry, id, type }),
      req.user.email,
      now,
    ]
  );
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
  if (!entry) return res.status(400).json({ error: "Eintrag fehlt." });

  await pool.query(
    `UPDATE entries
     SET workstream = $1,
         payload = $2::jsonb,
         updated_by_email = $3,
         updated_at = $4
     WHERE id = $5`,
    [
      entry.workstream || "",
      JSON.stringify({ ...entry, id, type: existing.type }),
      req.user.email,
      new Date().toISOString(),
      id,
    ]
  );

  return res.json({ ok: true });
});

app.delete("/api/entries/:id", auth, async (req, res) => {
  const { id } = req.params;
  const existingResult = await pool.query("SELECT unit FROM entries WHERE id = $1", [id]);
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: "Eintrag nicht gefunden." });
  if (!canAccessUnit(req, existing.unit)) {
    return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
  }
  await pool.query("DELETE FROM entries WHERE id = $1", [id]);
  return res.json({ ok: true });
});

app.delete("/api/entries", auth, async (req, res) => {
  if (req.user.role === "admin") {
    await pool.query("DELETE FROM entries");
  } else {
    await pool.query("DELETE FROM entries WHERE unit = $1", [req.user.unit]);
  }
  return res.json({ ok: true });
});

app.get("/api/admin/users", auth, requireAdmin, async (_req, res) => {
  const result = await pool.query(
    "SELECT id, email, name, role, created_at, updated_at FROM users ORDER BY email"
  );
  return res.json(result.rows);
});

app.post("/api/admin/users", auth, requireAdmin, async (req, res) => {
  const { email, name, role, password } = req.body || {};
  if (!email || !name || !password) return res.status(400).json({ error: "Pflichtfelder fehlen." });
  const safeRole = role === "admin" ? "admin" : "unit_lead";
  try {
    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        String(email).trim().toLowerCase(),
        String(name).trim(),
        bcrypt.hashSync(String(password), 10),
        safeRole,
      ]
    );
    return res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    return res.status(400).json({ error: "Benutzer konnte nicht angelegt werden." });
  }
});

app.put("/api/admin/users/:id", auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, role, password } = req.body || {};
  const userResult = await pool.query("SELECT id, email FROM users WHERE id = $1", [id]);
  const user = userResult.rows[0];
  if (!user) return res.status(404).json({ error: "Benutzer nicht gefunden." });

  const updates = [];
  const params = [];
  if (name) {
    params.push(String(name).trim());
    updates.push(`name = $${params.length}`);
  }
  if (role) {
    params.push(role === "admin" ? "admin" : "unit_lead");
    updates.push(`role = $${params.length}`);
  }
  if (password) {
    params.push(bcrypt.hashSync(String(password), 10));
    updates.push(`password_hash = $${params.length}`);
  }
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
