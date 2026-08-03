const crypto = require("crypto");

function snapshotIdForUnitYear(unit, year) {
  const slug = String(unit || "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return `ys-${slug}-${year}`;
}

function normalizeSnapshotPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { portfolio: [], organisation: null, skills: [], meta: {} };
  }
  return {
    portfolio: Array.isArray(payload.portfolio) ? payload.portfolio : [],
    organisation: payload.organisation && typeof payload.organisation === "object" ? payload.organisation : null,
    skills: Array.isArray(payload.skills) ? payload.skills : [],
    meta: payload.meta && typeof payload.meta === "object" ? payload.meta : {},
  };
}

function payloadToEntries(payload) {
  const norm = normalizeSnapshotPayload(payload);
  const entries = [];
  norm.portfolio.forEach((p) => {
    entries.push({ ...p, type: "portfolio" });
  });
  if (norm.organisation) {
    entries.push({ ...norm.organisation, type: "organisation" });
  }
  norm.skills.forEach((s) => {
    entries.push({ ...s, type: "skill" });
  });
  return entries;
}

function entriesToPayload(entries) {
  const portfolio = [];
  let organisation = null;
  const skills = [];
  (entries || []).forEach((e) => {
    if (e.type === "portfolio" || (!e.type && e.category)) {
      const { type, ...rest } = e;
      portfolio.push(rest);
    } else if (e.type === "organisation" || e.hatTechnologischeGliederung != null) {
      const { type, ...rest } = e;
      organisation = rest;
    } else if (e.type === "skill" || (e.skills && e.nachname)) {
      const { type, ...rest } = e;
      skills.push(rest);
    }
  });
  return { portfolio, organisation, skills, meta: {} };
}

function mapYearSnapshotRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    unit: row.unit,
    year: Number(row.year),
    status: row.status,
    payload: normalizeSnapshotPayload(row.payload),
    stichtag: row.stichtag || null,
    closedAt: row.closed_at || null,
    closedBy: row.closed_by_email || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by_email,
    updatedBy: row.updated_by_email,
  };
}

async function ensureYearSnapshotsSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS year_snapshots (
      id                TEXT PRIMARY KEY,
      unit              TEXT NOT NULL,
      year              INT  NOT NULL,
      status            TEXT NOT NULL CHECK (status IN ('draft', 'closed')),
      payload           JSONB NOT NULL,
      stichtag          DATE,
      closed_at         TIMESTAMPTZ,
      closed_by_email   TEXT,
      created_by_email  TEXT NOT NULL,
      updated_by_email  TEXT NOT NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (unit, year)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_year_snapshots_unit ON year_snapshots(unit)
  `);
  await pool.query(`
    ALTER TABLE units
    ADD COLUMN IF NOT EXISTS baseline_locked_at TIMESTAMPTZ
  `);
  await pool.query(`
    ALTER TABLE units
    ADD COLUMN IF NOT EXISTS baseline_locked_by TEXT
  `);
}

async function getUnitBaselineStatus(pool, unit) {
  const trimmed = String(unit || "").trim();
  if (!trimmed) return { locked: false, lockedAt: null, lockedBy: null };
  const { rows } = await pool.query(
    `SELECT baseline_locked_at, baseline_locked_by FROM units WHERE name = $1`,
    [trimmed]
  );
  const row = rows[0];
  return {
    locked: Boolean(row?.baseline_locked_at),
    lockedAt: row?.baseline_locked_at || null,
    lockedBy: row?.baseline_locked_by || null,
  };
}

async function lockUnitBaseline(pool, unit, email) {
  const trimmed = String(unit || "").trim();
  if (!trimmed) return { error: "Unit fehlt." };
  const now = new Date().toISOString();
  const { rows } = await pool.query(
    `UPDATE units
     SET baseline_locked_at = COALESCE(baseline_locked_at, $2::timestamptz),
         baseline_locked_by = COALESCE(baseline_locked_by, $3)
     WHERE name = $1
     RETURNING baseline_locked_at, baseline_locked_by`,
    [trimmed, now, email]
  );
  if (!rows.length) return { error: "Unit nicht gefunden." };
  return {
    locked: true,
    lockedAt: rows[0].baseline_locked_at,
    lockedBy: rows[0].baseline_locked_by,
  };
}

async function unlockUnitBaseline(pool, unit) {
  const trimmed = String(unit || "").trim();
  if (!trimmed) return { error: "Unit fehlt." };
  const { rows } = await pool.query(
    `UPDATE units
     SET baseline_locked_at = NULL, baseline_locked_by = NULL
     WHERE name = $1
     RETURNING name`,
    [trimmed]
  );
  if (!rows.length) return { error: "Unit nicht gefunden." };
  return { locked: false, lockedAt: null, lockedBy: null };
}

async function listYearSnapshots(pool, unit) {
  const trimmed = String(unit || "").trim();
  const { rows } = await pool.query(
    `SELECT id, unit, year, status, stichtag, closed_at, closed_by_email, updated_at
     FROM year_snapshots
     WHERE unit = $1
     ORDER BY year ASC`,
    [trimmed]
  );
  return rows.map((r) => ({
    year: Number(r.year),
    status: r.status,
    stichtag: r.stichtag || null,
    closedAt: r.closed_at || null,
    closedBy: r.closed_by_email || null,
    updatedAt: r.updated_at,
  }));
}

async function fetchYearSnapshotsMap(pool, unit) {
  const trimmed = String(unit || "").trim();
  const { rows } = await pool.query(
    `SELECT * FROM year_snapshots WHERE unit = $1 ORDER BY year ASC`,
    [trimmed]
  );
  const map = {};
  rows.forEach((row) => {
    const snap = mapYearSnapshotRow(row);
    if (snap) map[snap.year] = snap;
  });
  return map;
}

async function getYearSnapshot(pool, unit, year) {
  const trimmed = String(unit || "").trim();
  const y = Number(year);
  const { rows } = await pool.query(
    `SELECT * FROM year_snapshots WHERE unit = $1 AND year = $2`,
    [trimmed, y]
  );
  return mapYearSnapshotRow(rows[0]);
}

async function buildPrefillPayload(pool, unit, year, fetchPhase1Entries) {
  const y = Number(year);
  const prev = await getYearSnapshot(pool, unit, y - 1);
  if (prev?.status === "closed" && prev.payload) {
    return {
      payload: {
        ...normalizeSnapshotPayload(prev.payload),
        meta: { prefilledFrom: `year:${y - 1}` },
      },
      prefilledFrom: `year:${y - 1}`,
    };
  }
  const entries = await fetchPhase1Entries(unit);
  const payload = entriesToPayload(entries);
  payload.meta = { prefilledFrom: "baseline" };
  return { payload, prefilledFrom: "baseline" };
}

function aggregatePlanHintsForYear(planPayload, year) {
  const hints = { portfolio: [], gliederungen: [], rollen: [], mitarbeiter: [] };
  const y = Number(year);
  Object.values(planPayload?.measures || {}).forEach((list) => {
    (list || []).forEach((m) => {
      if (!m || m.kind !== "p1Year" || Number(m.jahr) !== y) return;
      const area = m.area;
      const entry = {
        phase1Id: m.phase1Id || null,
        orgItemId: m.orgItemId || null,
        skillEntryId: m.skillEntryId || null,
        category: m.category || null,
        subcategory: m.subcategory || null,
        label: m.label || m.subcategory || null,
        ziel_umsatz_teur: m.ziel_umsatz_teur ?? null,
        ziel_headcount: m.ziel_headcount ?? null,
        ziel_anzahl: m.ziel_anzahl ?? null,
        ziel_skill_level_min: m.ziel_skill_level_min ?? null,
        ziel_quartal: m.ziel_quartal || null,
      };
      if (area === "portfolio") hints.portfolio.push(entry);
      else if (area === "gliederungen") hints.gliederungen.push(entry);
      else if (area === "rollen") hints.rollen.push(entry);
      else if (area === "mitarbeiter") hints.mitarbeiter.push(entry);
    });
  });
  return hints;
}

async function saveYearSnapshotDraft(pool, { unit, year, payload, stichtag, email, isAdmin }) {
  const trimmed = String(unit || "").trim();
  const y = Number(year);
  if (!trimmed || !Number.isFinite(y)) return { error: "Unit oder Jahr ungueltig." };

  const existing = await getYearSnapshot(pool, trimmed, y);
  if (existing?.status === "closed" && !isAdmin) {
    return { error: "Jahresabschluss ist abgeschlossen und kann nur von Admins bearbeitet werden." };
  }

  const norm = normalizeSnapshotPayload(payload);
  const id = existing?.id || snapshotIdForUnitYear(trimmed, y);
  const now = new Date().toISOString();

  if (existing) {
    await pool.query(
      `UPDATE year_snapshots
       SET payload = $1::jsonb, stichtag = $2, status = 'draft',
           updated_by_email = $3, updated_at = $4,
           closed_at = NULL, closed_by_email = NULL
       WHERE id = $5`,
      [JSON.stringify(norm), stichtag || null, email, now, id]
    );
  } else {
    await pool.query(
      `INSERT INTO year_snapshots
       (id, unit, year, status, payload, stichtag, created_by_email, updated_by_email, created_at, updated_at)
       VALUES ($1, $2, $3, 'draft', $4::jsonb, $5, $6, $6, $7, $7)`,
      [id, trimmed, y, JSON.stringify(norm), stichtag || null, email, now]
    );
  }

  return { snapshot: await getYearSnapshot(pool, trimmed, y) };
}

async function closeYearSnapshot(pool, { unit, year, email, lockBaseline }) {
  const trimmed = String(unit || "").trim();
  const y = Number(year);
  const existing = await getYearSnapshot(pool, trimmed, y);
  if (!existing) return { error: "Kein Jahresabschluss-Entwurf vorhanden." };
  if (!existing.stichtag) {
    return { error: "Stichtag fehlt." };
  }

  const now = new Date().toISOString();
  await pool.query(
    `UPDATE year_snapshots
     SET status = 'closed', closed_at = $1, closed_by_email = $2, updated_at = $1, updated_by_email = $2
     WHERE unit = $3 AND year = $4`,
    [now, email, trimmed, y]
  );

  if (typeof lockBaseline === "function") {
    await lockBaseline(pool, trimmed, email);
  } else {
    await lockUnitBaseline(pool, trimmed, email);
  }

  return { snapshot: await getYearSnapshot(pool, trimmed, y) };
}

module.exports = {
  snapshotIdForUnitYear,
  normalizeSnapshotPayload,
  payloadToEntries,
  entriesToPayload,
  ensureYearSnapshotsSchema,
  getUnitBaselineStatus,
  lockUnitBaseline,
  unlockUnitBaseline,
  listYearSnapshots,
  fetchYearSnapshotsMap,
  getYearSnapshot,
  buildPrefillPayload,
  aggregatePlanHintsForYear,
  saveYearSnapshotDraft,
  closeYearSnapshot,
};
