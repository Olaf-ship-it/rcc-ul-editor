const crypto = require("crypto");

const GLOBAL_ID = "global";
const SEED_EMAIL = "system@seed";

function normalizeGuidelineIds(guidelines) {
  if (!Array.isArray(guidelines)) return [];
  return guidelines.map((g) => ({
    ...g,
    id: g?.id && String(g.id).trim() ? String(g.id).trim() : crypto.randomUUID(),
  }));
}

async function ensureGuidelinesSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gf_guidelines (
      id TEXT PRIMARY KEY DEFAULT 'global',
      payload JSONB NOT NULL,
      version INT NOT NULL DEFAULT 1,
      updated_by_email TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function seedGuidelinesIfEmpty(pool) {
  const { rows } = await pool.query("SELECT id FROM gf_guidelines WHERE id = $1", [GLOBAL_ID]);
  if (rows.length) return false;
  const guidelines = normalizeGuidelineIds([]);
  await pool.query(
    `INSERT INTO gf_guidelines (id, payload, version, updated_by_email)
     VALUES ($1, $2::jsonb, 1, $3)`,
    [GLOBAL_ID, JSON.stringify(guidelines), SEED_EMAIL]
  );
  return true;
}

function mapGuidelinesRow(row) {
  const payload = row.payload;
  const guidelines = normalizeGuidelineIds(Array.isArray(payload) ? payload : []);
  return {
    guidelines,
    version: row.version,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by_email,
  };
}

async function getGuidelines(pool) {
  await seedGuidelinesIfEmpty(pool);
  const { rows } = await pool.query(
    `SELECT payload, version, updated_at, updated_by_email
     FROM gf_guidelines
     WHERE id = $1`,
    [GLOBAL_ID]
  );
  if (!rows.length) {
    throw new Error("gf_guidelines global row missing after seed");
  }
  return mapGuidelinesRow(rows[0]);
}

async function updateGuidelines(pool, { guidelines, version, updatedByEmail, force = false }) {
  if (!Array.isArray(guidelines)) {
    return { error: "guidelines muss ein Array sein." };
  }
  const normalized = normalizeGuidelineIds(guidelines);
  await seedGuidelinesIfEmpty(pool);

  if (force) {
    const { rows } = await pool.query(
      `UPDATE gf_guidelines
       SET payload = $1::jsonb, version = version + 1, updated_by_email = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING payload, version, updated_at, updated_by_email`,
      [JSON.stringify(normalized), updatedByEmail, GLOBAL_ID]
    );
    if (!rows.length) {
      return { error: "Leitplanken konnten nicht gespeichert werden." };
    }
    return { ok: true, ...mapGuidelinesRow(rows[0]) };
  }

  const { rows } = await pool.query(
    `UPDATE gf_guidelines
     SET payload = $1::jsonb, version = version + 1, updated_by_email = $2, updated_at = NOW()
     WHERE id = $3 AND version = $4
     RETURNING payload, version, updated_at, updated_by_email`,
    [JSON.stringify(normalized), updatedByEmail, GLOBAL_ID, version]
  );

  if (rows.length) {
    return { ok: true, ...mapGuidelinesRow(rows[0]) };
  }

  const current = await getGuidelines(pool);
  return { conflict: true, ...current };
}

module.exports = {
  ensureGuidelinesSchema,
  seedGuidelinesIfEmpty,
  getGuidelines,
  updateGuidelines,
};
