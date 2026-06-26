const ONLINE_TTL_SEC = 90;

const VALID_CONTEXTS = new Set(["phase1", "backcasting", "fortschritt", "admin"]);

function normalizeContext(context) {
  const value = String(context || "phase1").trim().toLowerCase();
  return VALID_CONTEXTS.has(value) ? value : "phase1";
}

async function ensurePresenceSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_presence (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      unit TEXT,
      context TEXT NOT NULL DEFAULT 'phase1',
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence(last_seen_at)
  `);
}

async function upsertHeartbeat(pool, sessionUser, body = {}) {
  const userId = Number(sessionUser.sub);
  if (!Number.isFinite(userId)) {
    throw new Error("Ungueltige Session.");
  }

  const email = String(sessionUser.email || "").trim().toLowerCase();
  const name = String(sessionUser.name || email || "Unbekannt").trim();
  const role = String(sessionUser.role || "unit_lead").trim();
  const unit = String(body.unit ?? sessionUser.unit ?? "").trim() || null;
  const context = normalizeContext(body.context);

  await pool.query(
    `INSERT INTO user_presence (user_id, email, name, role, unit, context, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       email = EXCLUDED.email,
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       unit = EXCLUDED.unit,
       context = EXCLUDED.context,
       last_seen_at = NOW()`,
    [userId, email, name, role, unit, context]
  );

  return { ok: true };
}

async function listOnlineUsers(pool) {
  const { rows } = await pool.query(
    `SELECT user_id, email, name, role, unit, context, last_seen_at
     FROM user_presence
     WHERE last_seen_at > NOW() - ($1::int * INTERVAL '1 second')
     ORDER BY name ASC, email ASC`,
    [ONLINE_TTL_SEC]
  );

  return rows.map((row) => ({
    userId: Number(row.user_id),
    email: row.email,
    name: row.name,
    role: row.role,
    unit: row.unit || "",
    context: row.context,
    lastSeenAt: row.last_seen_at,
  }));
}

async function removePresence(pool, userId) {
  const id = Number(userId);
  if (!Number.isFinite(id)) return;
  await pool.query("DELETE FROM user_presence WHERE user_id = $1", [id]);
}

module.exports = {
  ONLINE_TTL_SEC,
  ensurePresenceSchema,
  upsertHeartbeat,
  listOnlineUsers,
  removePresence,
};
