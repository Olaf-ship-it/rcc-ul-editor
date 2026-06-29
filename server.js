const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
require("dotenv").config();
const {
  DEMO_UNIT,
  DEMO_UNITS,
  DEMO_REFERENCE_YEAR,
  buildDemoDataForUnit,
  buildDemoStatusSummary,
} = require("./server/demo-data");
const { buildDashboardSnapshot, buildDashboardSnapshotAllYears, buildDashboardTimeline, buildP1DashboardSnapshot, buildP1DashboardSnapshotAllYears, buildP1DashboardTimeline, DEFAULT_TIMELINE_YEARS } = require("./server/dashboard-service");
const {
  ensureGuidelinesSchema,
  seedGuidelinesIfEmpty,
  getGuidelines,
  updateGuidelines,
} = require("./server/guidelines-service");
const {
  ensurePresenceSchema,
  upsertHeartbeat,
  listOnlineUsers,
  removePresence,
} = require("./server/presence-service");
const { execSync } = require("child_process");

const SERVER_STARTED_AT = new Date().toISOString();
let _deployInfoCache = null;

function collectLocalGitInfo() {
  const SEP = "\x1f";
  const parseBranch = (refs) =>
    (refs || "").replace(/.*HEAD -> /, "").split(",")[0].trim() || "";
  try {
    const fmt = ["%H", "%s", "%an", "%aI", "%D"].join(SEP);
    const raw = execSync(`git log -10 --format=${fmt}`, {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    const lines = raw.split("\n").filter(Boolean);
    let branch = "";
    const commits = lines.map((line) => {
      const parts = line.split(SEP);
      if (!branch && parts[4]) branch = parseBranch(parts[4]);
      return {
        sha: (parts[0] || "").slice(0, 8),
        message: parts[1] || "",
        author: parts[2] || "",
        date: parts[3] || "",
      };
    });
    return { deployedAt: SERVER_STARTED_AT, source: "git", branch, commits };
  } catch (_e) {
    return null;
  }
}

async function fetchGitHubCommits(owner, repo, branch) {
  const https = require("https");
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=10`;
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { "User-Agent": "rcc-ul-editor", Accept: "application/vnd.github+json" }, timeout: 5000 }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => {
        try {
          if (res.statusCode !== 200) return resolve(null);
          const data = JSON.parse(body);
          if (!Array.isArray(data)) return resolve(null);
          resolve(data.map((c) => ({
            sha: (c.sha || "").slice(0, 8),
            message: c.commit?.message?.split("\n")[0] || "",
            author: c.commit?.author?.name || c.author?.login || "",
            date: c.commit?.author?.date || "",
          })));
        } catch (_e) { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

async function getDeployInfo() {
  if (_deployInfoCache) return _deployInfoCache;

  const local = collectLocalGitInfo();
  if (local && local.commits.length > 1) {
    _deployInfoCache = local;
    return _deployInfoCache;
  }

  const env = process.env;
  const owner = env.VERCEL_GIT_REPO_OWNER;
  const repo = env.VERCEL_GIT_REPO_SLUG;
  const branch = env.VERCEL_GIT_COMMIT_REF || "main";

  if (owner && repo) {
    const ghCommits = await fetchGitHubCommits(owner, repo, branch);
    if (ghCommits && ghCommits.length) {
      _deployInfoCache = { deployedAt: SERVER_STARTED_AT, source: "vercel", branch, commits: ghCommits };
      return _deployInfoCache;
    }
  }

  if (local) {
    _deployInfoCache = local;
    return _deployInfoCache;
  }

  if (env.VERCEL_GIT_COMMIT_SHA) {
    _deployInfoCache = {
      deployedAt: SERVER_STARTED_AT,
      source: "vercel",
      branch,
      commits: [{
        sha: (env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 8),
        message: env.VERCEL_GIT_COMMIT_MESSAGE || "",
        author: env.VERCEL_GIT_COMMIT_AUTHOR_NAME || "",
        date: SERVER_STARTED_AT,
      }],
    };
    return _deployInfoCache;
  }

  _deployInfoCache = { deployedAt: SERVER_STARTED_AT, source: "unknown", branch: "", commits: [] };
  return _deployInfoCache;
}

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_COOKIE = "rc_ul_token";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 60 * 60 * 1000,
  };
}
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
];

const DEMO_USER_EMAILS = [
  "maria.geschaeft@realcore.de",
  "klaus.regional@realcore.de",
  "petra.regional@realcore.de",
  "stefan.regional@realcore.de",
  "julia.regional@realcore.de",
  "max.mustermann@realcore.de",
  "anna.beispiel@realcore.de",
  "thomas.schmidt@realcore.de",
  "lisa.weber@realcore.de",
  "olaf.glebsattel.2@realcore.de",
  "peter.testmann@realcore.de",
];

async function removeDemoUsers() {
  if (DEMO_USER_EMAILS.length) {
    await pool.query(`DELETE FROM users WHERE email = ANY($1::text[])`, [DEMO_USER_EMAILS]);
  }
  await pool.query(`DELETE FROM users WHERE email LIKE 'test.%@realcore.de'`);
}

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

const USER_STANDORTE = ["Essen", "Bremen"];

function normalizeUserStandort(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const match = USER_STANDORTE.find((s) => s.toLowerCase() === trimmed.toLowerCase());
  return match || null;
}

const SUPER_ADMIN_GRANT_PASSWORD =
  process.env.SUPER_ADMIN_GRANT_PASSWORD || "234";

function validateSuperAdminGrant(nextRoles, currentRoles, superAdminGrantPassword) {
  const wantsSuperAdmin = normalizeUserRoles(nextRoles).includes("super_admin");
  const hadSuperAdmin = normalizeUserRoles(currentRoles).includes("super_admin");
  if (!wantsSuperAdmin || hadSuperAdmin) return null;
  if (String(superAdminGrantPassword || "") !== SUPER_ADMIN_GRANT_PASSWORD) {
    return "Super Admin erfordert das korrekte Freischalt-Passwort.";
  }
  return null;
}

const ROLE_PRIORITY = [
  "super_admin",
  "admin",
  "unit_lead",
  "mitarbeiter",
  "regionalleiter",
  "geschaeftsfuehrung",
  "backcasting",
  "fortschritt",
];

const APP_MODULE_ROLES = ["backcasting", "fortschritt"];

function normalizeUserRoles(roles, fallbackRole = null) {
  const list = Array.isArray(roles) ? roles : roles ? [roles] : [];
  const normalized = list
    .map((role) => normalizeAssignableRole(role))
    .filter((role) => role && ROLE_PRIORITY.includes(role));
  if (!normalized.length && fallbackRole) {
    const safe = normalizeAssignableRole(fallbackRole);
    if (safe) normalized.push(safe);
  }
  return [...new Set(normalized)];
}

function getUserRoles(user) {
  if (!user) return [];
  if (Array.isArray(user.roles) && user.roles.length) {
    return normalizeUserRoles(user.roles, user.role);
  }
  return normalizeUserRoles([user.role].filter(Boolean));
}

function userHasRole(user, role) {
  return getUserRoles(user).includes(role);
}

function userHasAnyRole(user, ...roles) {
  const userRoles = getUserRoles(user);
  return roles.some((role) => userRoles.includes(role));
}

function primaryRoleFromRoles(roles) {
  const normalized = normalizeUserRoles(roles);
  for (const role of ROLE_PRIORITY) {
    if (normalized.includes(role)) return role;
  }
  return normalized[0] || "unit_lead";
}

function isAdminRole(roleOrUser) {
  if (roleOrUser && typeof roleOrUser === "object") {
    return userHasAnyRole(roleOrUser, "admin", "super_admin");
  }
  return roleOrUser === "admin" || roleOrUser === "super_admin";
}

function isSuperAdminRole(roleOrUser) {
  if (roleOrUser && typeof roleOrUser === "object") {
    return userHasRole(roleOrUser, "super_admin");
  }
  return roleOrUser === "super_admin";
}

function isUnitScopedRole(roleOrUser) {
  if (roleOrUser && typeof roleOrUser === "object") {
    return userHasAnyRole(roleOrUser, "unit_lead", "mitarbeiter");
  }
  return roleOrUser === "unit_lead" || roleOrUser === "mitarbeiter";
}

function isMitarbeiterRole(roleOrUser) {
  if (roleOrUser && typeof roleOrUser === "object") {
    return userHasRole(roleOrUser, "mitarbeiter");
  }
  return roleOrUser === "mitarbeiter";
}

function hasElevatedUnitAccess(roleOrUser) {
  if (roleOrUser && typeof roleOrUser === "object") {
    return userHasAnyRole(
      roleOrUser,
      "unit_lead",
      "admin",
      "super_admin",
      "regionalleiter",
      "geschaeftsfuehrung"
    );
  }
  return (
    roleOrUser === "unit_lead" ||
    roleOrUser === "admin" ||
    roleOrUser === "super_admin" ||
    roleOrUser === "regionalleiter" ||
    roleOrUser === "geschaeftsfuehrung"
  );
}

/** Mitarbeiter ohne Unit-Lead-/Admin-Rechte – eingeschränkter Zugriff nur auf eigenes Skill-Profil */
function isPureMitarbeiterRole(roleOrUser) {
  return isMitarbeiterRole(roleOrUser) && !hasElevatedUnitAccess(roleOrUser);
}

function isOrgHierarchyRole(roleOrUser) {
  if (roleOrUser && typeof roleOrUser === "object") {
    return userHasAnyRole(roleOrUser, "geschaeftsfuehrung", "regionalleiter");
  }
  return roleOrUser === "geschaeftsfuehrung" || roleOrUser === "regionalleiter";
}

function isBackcastingModuleEnabled() {
  return process.env.BACKCASTING_ENABLED !== "false";
}

function canAccessBackcasting(roleOrUser) {
  if (!isBackcastingModuleEnabled()) return false;
  if (isAdminRole(roleOrUser)) return true;
  if (roleOrUser && typeof roleOrUser === "object") {
    return userHasRole(roleOrUser, "backcasting");
  }
  return roleOrUser === "backcasting";
}

function canReadGuidelines(user) {
  return canAccessBackcasting(user) || isAdminRole(user);
}

function canAccessFortschritt(roleOrUser) {
  if (isAdminRole(roleOrUser)) return true;
  if (roleOrUser && typeof roleOrUser === "object") {
    return userHasRole(roleOrUser, "fortschritt");
  }
  return roleOrUser === "fortschritt";
}

function buildUserModules(user) {
  return {
    backcasting: canAccessBackcasting(user),
    fortschritt: canAccessFortschritt(user),
  };
}

function normalizeAssignableRole(role, fallback = "unit_lead") {
  if (role === "super_admin") return "super_admin";
  if (role === "admin") return "admin";
  if (role === "geschaeftsfuehrung") return "geschaeftsfuehrung";
  if (role === "regionalleiter") return "regionalleiter";
  if (role === "mitarbeiter") return "mitarbeiter";
  if (role === "unit_lead") return "unit_lead";
  if (role === "backcasting") return "backcasting";
  if (role === "fortschritt") return "fortschritt";
  return fallback;
}

async function validateUnitsForRoles(roles, units) {
  const safeRoles = normalizeUserRoles(roles);
  if (!safeRoles.some((role) => isUnitScopedRole(role))) return { units: [] };
  const normalized = normalizeUnits(units);
  if (!normalized.length) {
    return { error: "Mindestens eine Unit erforderlich." };
  }
  if (safeRoles.includes("mitarbeiter") && normalized.length > 1) {
    return { error: "Mitarbeiter koennen nur einer Unit zugewiesen werden." };
  }
  return validateUnitsAgainstMaster(normalized);
}

async function validateUnitsForRole(role, units) {
  return validateUnitsForRoles([role], units);
}

function normalizeStringArray(values) {
  if (!values) return [];
  const list = Array.isArray(values) ? values : String(values).split(",");
  return [...new Set(list.map((v) => String(v).trim()).filter(Boolean))];
}

function normalizeBigIntArray(values) {
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

function filterToAllowedNames(names, allowedList) {
  const allowed = new Set(allowedList);
  return normalizeStringArray(names).filter((name) => allowed.has(name));
}

async function fetchCatalogRoleNames() {
  const result = await pool.query("SELECT name FROM app_roles ORDER BY sort_order, name");
  return result.rows.map((row) => row.name);
}

async function fetchCatalogPositionNames() {
  const result = await pool.query("SELECT name FROM app_positions ORDER BY sort_order, name");
  return result.rows.map((row) => row.name);
}

async function fetchCatalogLookup(table) {
  const safeTable = table === "app_positions" ? "app_positions" : "app_roles";
  const result = await pool.query(
    `SELECT id, name FROM ${safeTable} ORDER BY sort_order, name`
  );
  const byId = new Map();
  const byName = new Map();
  const names = [];
  for (const row of result.rows) {
    const id = Number(row.id);
    const name = String(row.name);
    byId.set(id, name);
    byName.set(name, id);
    names.push(name);
  }
  return { byId, byName, names };
}

function resolveCatalogNamesFromIds(byId, ids) {
  return normalizeBigIntArray(ids)
    .map((id) => byId.get(id))
    .filter(Boolean);
}

function resolveCatalogIdsFromInput(catalog, names, explicitIds) {
  const byId = catalog?.byId || new Map();
  const byName = catalog?.byName || new Map();
  if (explicitIds !== undefined && explicitIds !== null) {
    return normalizeBigIntArray(explicitIds).filter((id) => byId.has(id));
  }
  const allowedNames = [...byName.keys()];
  return filterToAllowedNames(names, allowedNames)
    .map((name) => byName.get(name))
    .filter((id) => Number.isInteger(id) && id > 0);
}

async function validateUserCatalogAssignments(
  userOrgRoles,
  userPositions,
  userOrgRoleIds,
  userPositionIds
) {
  const roleCatalog = await fetchCatalogLookup("app_roles");
  const positionCatalog = await fetchCatalogLookup("app_positions");
  const orgRoleIds = resolveCatalogIdsFromInput(roleCatalog, userOrgRoles, userOrgRoleIds);
  const positionIds = resolveCatalogIdsFromInput(positionCatalog, userPositions, userPositionIds);
  return {
    userOrgRoleIds: orgRoleIds,
    userOrgRoles: resolveCatalogNamesFromIds(roleCatalog.byId, orgRoleIds),
    userPositionIds: positionIds,
    userPositions: resolveCatalogNamesFromIds(positionCatalog.byId, positionIds),
  };
}

async function backfillUserCatalogIds() {
  const roleCatalog = await fetchCatalogLookup("app_roles");
  const positionCatalog = await fetchCatalogLookup("app_positions");
  const users = await pool.query(
    `SELECT id, user_org_roles, user_positions, user_org_role_ids, user_position_ids FROM users`
  );
  for (const row of users.rows) {
    const orgIds = normalizeStringArray(row.user_org_roles)
      .map((name) => roleCatalog.byName.get(name))
      .filter((id) => Number.isInteger(id) && id > 0);
    const positionIds = normalizeStringArray(row.user_positions)
      .map((name) => positionCatalog.byName.get(name))
      .filter((id) => Number.isInteger(id) && id > 0);
    const existingOrgIds = normalizeBigIntArray(row.user_org_role_ids);
    const existingPosIds = normalizeBigIntArray(row.user_position_ids);
    const nextOrgIds = existingOrgIds.length ? existingOrgIds : orgIds;
    const nextPosIds = existingPosIds.length ? existingPosIds : positionIds;
    if (
      nextOrgIds.length !== existingOrgIds.length ||
      nextPosIds.length !== existingPosIds.length ||
      (nextOrgIds.length && !existingOrgIds.length) ||
      (nextPosIds.length && !existingPosIds.length)
    ) {
      await pool.query(
        `UPDATE users SET user_org_role_ids = $1, user_position_ids = $2 WHERE id = $3`,
        [nextOrgIds, nextPosIds, row.id]
      );
    }
  }
}

function enrichUserCatalogFields(user, roleCatalog, positionCatalog) {
  const roles = roleCatalog || { byId: new Map(), byName: new Map() };
  const positions = positionCatalog || { byId: new Map(), byName: new Map() };
  let orgIds = normalizeBigIntArray(user.userOrgRoleIds);
  let positionIds = normalizeBigIntArray(user.userPositionIds);
  if (!orgIds.length && user.userOrgRoles?.length) {
    orgIds = user.userOrgRoles
      .map((name) => roles.byName.get(name))
      .filter((id) => Number.isInteger(id) && id > 0);
  }
  if (!positionIds.length && user.userPositions?.length) {
    positionIds = user.userPositions
      .map((name) => positions.byName.get(name))
      .filter((id) => Number.isInteger(id) && id > 0);
  }
  const userOrgRoles = resolveCatalogNamesFromIds(roles.byId, orgIds);
  const userPositions = resolveCatalogNamesFromIds(positions.byId, positionIds);
  return {
    ...user,
    userOrgRoleIds: orgIds,
    userPositionIds: positionIds,
    userOrgRoles: userOrgRoles.length ? userOrgRoles : user.userOrgRoles || [],
    userPositions: userPositions.length ? userPositions : user.userPositions || [],
  };
}

async function enrichUsersCatalog(users) {
  const roleCatalog = await fetchCatalogLookup("app_roles");
  const positionCatalog = await fetchCatalogLookup("app_positions");
  return users.map((user) => enrichUserCatalogFields(user, roleCatalog, positionCatalog));
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

const POSITION_TO_HIERARCHY_ROLE = {
  geschaeftsfuehrer: "geschaeftsfuehrung",
  "regional leiter": "regionalleiter",
  "unit leiter": "unit_lead",
  mitarbeiter: "mitarbeiter",
  berater: "mitarbeiter",
  "cc leiter": "unit_lead",
};

function deriveHierarchyRolesFromPositions(positions) {
  const roles = [];
  for (const position of normalizeStringArray(positions)) {
    const role = POSITION_TO_HIERARCHY_ROLE[normalizePositionKey(position)];
    if (role && !roles.includes(role)) roles.push(role);
  }
  return roles;
}

function userEligibleForAppModules(inputRoles, positions) {
  const privilege = normalizeUserRoles(inputRoles);
  if (privilege.some((role) => role === "admin" || role === "super_admin")) return true;
  const hierarchy = deriveHierarchyRolesFromPositions(positions);
  if (hierarchy.includes("unit_lead") || hierarchy.includes("regionalleiter")) return true;
  if (userHasDeputyUnitLeaderPosition(positions)) return true;
  return false;
}

function mergeUserRolesFromInput(inputRoles, positions) {
  const privilege = normalizeUserRoles(inputRoles).filter(
    (role) => role === "admin" || role === "super_admin" || APP_MODULE_ROLES.includes(role)
  );
  const adminRoles = privilege.filter((role) => role === "admin" || role === "super_admin");
  const appModules = userEligibleForAppModules(inputRoles, positions)
    ? privilege.filter((role) => APP_MODULE_ROLES.includes(role))
    : [];
  return normalizeUserRoles([...deriveHierarchyRolesFromPositions(positions), ...adminRoles, ...appModules]);
}

const ORG_HIERARCHY_ROLES = ["geschaeftsfuehrung", "regionalleiter", "unit_lead", "mitarbeiter"];

function getEffectiveHierarchyRoles(user) {
  const fromPositions = deriveHierarchyRolesFromPositions(
    normalizeStringArray(user?.user_positions)
  );
  const fromRoles = getUserRoles(user).filter((role) => ORG_HIERARCHY_ROLES.includes(role));
  return [...new Set([...fromPositions, ...fromRoles])];
}

function userHasEffectiveHierarchyRole(user, hierarchyRole) {
  return getEffectiveHierarchyRoles(user).includes(hierarchyRole);
}

function resolveGeschaeftsfuehrungIdsFromRow(row) {
  const ids = normalizeBigIntArray(row?.geschaeftsfuehrung_ids);
  if (ids.length) return ids;
  if (row?.geschaeftsfuehrung_id) return [Number(row.geschaeftsfuehrung_id)];
  return [];
}

function mapUserRow(row) {
  const roles = getUserRoles(row);
  const geschaeftsfuehrungIds = resolveGeschaeftsfuehrungIdsFromRow(row);
  return {
    ...row,
    roles,
    role: primaryRoleFromRoles(roles) || row.role,
    units: normalizeUnits(row.units),
    standort: row.standort || "",
    regionalleiter_id: row.regionalleiter_id || null,
    regionalleiterName: row.regionalleiter_name ? String(row.regionalleiter_name) : null,
    geschaeftsfuehrung_id: geschaeftsfuehrungIds[0] || row.geschaeftsfuehrung_id || null,
    geschaeftsfuehrung_ids: geschaeftsfuehrungIds,
    geschaeftsfuehrungIds,
    geschaeftsfuehrungName: row.geschaeftsfuehrung_name ? String(row.geschaeftsfuehrung_name) : null,
    unit_lead_id: row.unit_lead_id || null,
    unitLeadName: row.unit_lead_name ? String(row.unit_lead_name) : null,
    personalnummer: row.personalnummer ? String(row.personalnummer) : "",
    userOrgRoles: normalizeStringArray(row.user_org_roles),
    userPositions: normalizeStringArray(row.user_positions),
    userOrgRoleIds: normalizeBigIntArray(row.user_org_role_ids),
    userPositionIds: normalizeBigIntArray(row.user_position_ids),
    loginBlocked: Boolean(row.login_blocked),
  };
}

async function validateUserRolesAndOrg(
  roles,
  { standort, regionalleiterId, geschaeftsfuehrungId, geschaeftsfuehrungIds, unitLeadId, units },
  excludeUserId = null
) {
  const safeRoles = normalizeUserRoles(roles);
  if (!safeRoles.length) {
    return { error: "Mindestens eine Rolle erforderlich." };
  }

  const unitCheck = await validateUnitsForRoles(safeRoles, units);
  if (unitCheck.error) return { error: unitCheck.error };

  let safeStandort = null;
  let safeRegionalleiterId = null;
  let safeGeschaeftsfuehrungId = null;
  let safeGeschaeftsfuehrungIds = [];
  let safeUnitLeadId = null;

  if (safeRoles.includes("regionalleiter")) {
    safeStandort = normalizeUserStandort(standort);
    if (!safeStandort) {
      return {
        error: standort
          ? "Standort muss Essen oder Bremen sein."
          : "Standort ist fuer Regionalleiter erforderlich.",
      };
    }
    const requestedGfIds = normalizeBigIntArray(geschaeftsfuehrungIds);
    if (!requestedGfIds.length && geschaeftsfuehrungId) {
      requestedGfIds.push(Number(geschaeftsfuehrungId));
    }
    const uniqueGfIds = [...new Set(requestedGfIds.filter((id) => Number.isInteger(id) && id > 0))];
    for (const gid of uniqueGfIds) {
      const gfResult = await pool.query(
        `SELECT id FROM users
         WHERE id = $1
           AND (role = 'geschaeftsfuehrung' OR 'geschaeftsfuehrung' = ANY(roles))`,
        [gid]
      );
      if (!gfResult.rows[0]) {
        return { error: "Ungueltige Geschaeftsfuehrung." };
      }
      if (excludeUserId && String(gid) === String(excludeUserId)) {
        return { error: "Regionalleiter kann sich nicht selbst als Geschaeftsfuehrung zuweisen." };
      }
      safeGeschaeftsfuehrungIds.push(gid);
    }
    safeGeschaeftsfuehrungId = safeGeschaeftsfuehrungIds[0] || null;
  }

  if (safeRoles.includes("unit_lead")) {
    const rid = regionalleiterId ? Number(regionalleiterId) : null;
    if (!rid) {
      return { error: "Regionalleiter-Zuweisung ist fuer Unit Leads erforderlich." };
    }
    const rlResult = await pool.query(
      `SELECT id FROM users
       WHERE id = $1
         AND (role = 'regionalleiter' OR 'regionalleiter' = ANY(roles))`,
      [rid]
    );
    if (!rlResult.rows[0]) {
      return { error: "Ungueltiger Regionalleiter." };
    }
    safeRegionalleiterId = rid;
  }

  if (safeRoles.includes("mitarbeiter")) {
    const mitarbeiterUnits = unitCheck.units || [];
    let ulid = unitLeadId ? Number(unitLeadId) : null;
    if (!ulid && mitarbeiterUnits.length) {
      const unitRow = await pool.query(
        `SELECT unit_lead_id FROM units WHERE name = $1 AND unit_lead_id IS NOT NULL`,
        [mitarbeiterUnits[0]]
      );
      ulid = unitRow.rows[0]?.unit_lead_id ? Number(unitRow.rows[0].unit_lead_id) : null;
    }
    if (!ulid) {
      return {
        error: mitarbeiterUnits.length
          ? "Fuer die gewaehlte Unit ist kein Unit Leiter hinterlegt (Units verwalten)."
          : "Unit ist fuer Mitarbeiter erforderlich.",
      };
    }
    const ulResult = await pool.query(
      `SELECT id, units FROM users
       WHERE id = $1
         AND (role = 'unit_lead' OR 'unit_lead' = ANY(roles))`,
      [ulid]
    );
    if (!ulResult.rows[0]) {
      return { error: "Ungueltiger Unit Lead." };
    }
    if (excludeUserId && String(ulid) === String(excludeUserId)) {
      return { error: "Mitarbeiter kann sich nicht selbst als Unit Lead zuweisen." };
    }
    const leadUnits = normalizeUnits(ulResult.rows[0].units);
    if (
      mitarbeiterUnits.length &&
      leadUnits.length &&
      !mitarbeiterUnits.some((unit) => leadUnits.includes(unit))
    ) {
      const assignedToUnit = await pool.query(
        "SELECT id FROM units WHERE name = $1 AND unit_lead_id = $2",
        [mitarbeiterUnits[0], ulid]
      );
      if (!assignedToUnit.rows.length) {
        return {
          error: "Der Unit Leiter der gewaehlten Unit ist nicht gueltig.",
        };
      }
    }
    safeUnitLeadId = ulid;
  }

  return {
    roles: safeRoles,
    role: primaryRoleFromRoles(safeRoles),
    standort: safeStandort,
    regionalleiterId: safeRegionalleiterId,
    geschaeftsfuehrungId: safeGeschaeftsfuehrungId,
    geschaeftsfuehrungIds: safeGeschaeftsfuehrungIds,
    unitLeadId: safeUnitLeadId,
    units: unitCheck.units || [],
  };
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
  if (
    DEMO_USER_EMAILS.includes(email) ||
    (email.startsWith("test.") && email.endsWith("@realcore.de"))
  ) {
    return null;
  }
  const unitName = String(unit || entry.unit || "").trim();
  if (!unitName) return null;

  const validated = await validateUnitsAgainstMaster([unitName]);
  const units = validated.units || [unitName];

  const linked = await pool.query(
    "SELECT id FROM users WHERE skill_entry_id = $1",
    [entryId]
  );
  const personalnummer =
    String(entry.personalnummer || entry.mitarbeiterId || "").trim() || null;

  if (linked.rows.length) {
    await pool.query(
      `UPDATE users
       SET email = $1, name = $2, role = 'mitarbeiter', units = $3,
           personalnummer = COALESCE($4, personalnummer),
           updated_at = NOW()
       WHERE skill_entry_id = $5`,
      [email, name, units, personalnummer, entryId]
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
         SET name = $1, role = 'mitarbeiter', units = $2, skill_entry_id = $3,
             personalnummer = COALESCE($4, personalnummer),
             updated_at = NOW()
         WHERE id = $5`,
        [name, units, entryId, personalnummer, existing.id]
      );
      return existing.id;
    }
    email = `mitarbeiter.${entryId}@realcore.de`;
  }

  const passwordHash = bcrypt.hashSync(DEFAULT_MITARBEITER_PASSWORD, 10);
  try {
    const inserted = await pool.query(
      `INSERT INTO users (email, name, password_hash, role, units, skill_entry_id, personalnummer)
       VALUES ($1, $2, $3, 'mitarbeiter', $4, $5, $6)
       RETURNING id`,
      [email, name, passwordHash, units, entryId, personalnummer]
    );
    return inserted.rows[0].id;
  } catch (error) {
    if (error.code !== "23505") throw error;
    const fallbackEmail = `mitarbeiter.${entryId}@realcore.de`;
    const inserted = await pool.query(
      `INSERT INTO users (email, name, password_hash, role, units, skill_entry_id, personalnummer)
       VALUES ($1, $2, $3, 'mitarbeiter', $4, $5, $6)
       RETURNING id`,
      [fallbackEmail, name, passwordHash, units, entryId, personalnummer]
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

  const mitarbeiterUsers = await pool.query(
    `SELECT id, email, name, role, units, skill_entry_id FROM users WHERE role = 'mitarbeiter'`
  );
  for (const user of mitarbeiterUsers.rows) {
    await ensureMitarbeiterSkillProfile(user);
  }
}

async function ensureMitarbeiterSkillProfile(user) {
  if (!user || !isMitarbeiterRole(user)) return user?.skill_entry_id || null;
  if (user.skill_entry_id) return user.skill_entry_id;

  const units = normalizeUnits(user.units);
  const unit = units[0];
  if (!unit) return null;

  const email = String(user.email || "").trim().toLowerCase();
  const byEmail = await pool.query(
    `SELECT id FROM entries
     WHERE type = 'skill' AND unit = $1 AND lower(COALESCE(payload->>'email', '')) = $2
     LIMIT 1`,
    [unit, email]
  );
  if (byEmail.rows[0]) {
    await pool.query(`UPDATE users SET skill_entry_id = $1, updated_at = NOW() WHERE id = $2`, [
      byEmail.rows[0].id,
      user.id,
    ]);
    return byEmail.rows[0].id;
  }

  const nameParts = String(user.name || "").split(", ");
  const nachname = (nameParts[0] || "").trim();
  const vorname = (nameParts[1] || "").trim();
  if (nachname && vorname) {
    const byName = await pool.query(
      `SELECT id FROM entries
       WHERE type = 'skill' AND unit = $1
         AND payload->>'nachname' = $2 AND payload->>'vorname' = $3
       LIMIT 1`,
      [unit, nachname, vorname]
    );
    if (byName.rows[0]) {
      await pool.query(`UPDATE users SET skill_entry_id = $1, updated_at = NOW() WHERE id = $2`, [
        byName.rows[0].id,
        user.id,
      ]);
      return byName.rows[0].id;
    }
  }

  const entryId = crypto.randomUUID();
  const now = new Date().toISOString();
  const entry = {
    id: entryId,
    type: "skill",
    nachname: nachname || user.name,
    vorname,
    name: user.name,
    rolle: "",
    position_id: null,
    org_role_ids: [],
    org_roles: [],
    position_ids: [],
    positions: [],
    email,
    skills: [],
    softSkills: [],
    unit,
  };
  await pool.query(
    `INSERT INTO entries (id, type, unit, workstream, payload, created_by_email, updated_by_email, created_at, updated_at)
     VALUES ($1, 'skill', $2, '', $3::jsonb, $4, $4, $5, $5)`,
    [entryId, unit, JSON.stringify(entry), email || "system", now]
  );
  await pool.query(`UPDATE users SET skill_entry_id = $1, updated_at = NOW() WHERE id = $2`, [
    entryId,
    user.id,
  ]);
  return entryId;
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

const ENTRY_TYPES = ["skill", "portfolio", "organisation"];
const LEGACY_ENTRY_TYPES = ["status", "team"];

async function purgeLegacyEntryTypes() {
  const result = await pool.query(
    `DELETE FROM entries WHERE type = ANY($1::text[]) RETURNING id`,
    [LEGACY_ENTRY_TYPES]
  );
  if (result.rowCount > 0) {
    console.log(`Removed ${result.rowCount} legacy entries (status/team).`);
  }
}

async function ensureEntriesTypeConstraint() {
  const allowed = ENTRY_TYPES.map((t) => `'${t}'`).join(", ");
  await pool.query(`
    ALTER TABLE entries
    DROP CONSTRAINT IF EXISTS entries_type_check
  `);
  await pool.query(`
    ALTER TABLE entries
    ADD CONSTRAINT entries_type_check CHECK (type IN (${allowed}))
  `);
}

async function ensureDemoSchema() {
  await pool.query(`
    ALTER TABLE entries
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS backcasting_plans (
      id TEXT PRIMARY KEY,
      unit TEXT NOT NULL,
      payload JSONB NOT NULL,
      is_demo BOOLEAN NOT NULL DEFAULT false,
      created_by_email TEXT NOT NULL,
      updated_by_email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_backcasting_plans_unit ON backcasting_plans(unit)
  `);
}

function backcastingPlanIdForUnit(unit, isDemo = false) {
  const slug = String(unit || "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return isDemo ? `demo-plan-${slug}` : `plan-${slug}`;
}

function resolveDashboardUnit(req, requestedUnit) {
  const unit = String(requestedUnit || "").trim();
  if (isAdminRole(req.user)) {
    if (unit) return { unit };
    const fallback = req.user.unit || normalizeUnits(req.user.units)[0] || DEMO_UNIT;
    return { unit: fallback };
  }
  if (isPureMitarbeiterRole(req.user)) {
    return { error: "Kein Zugriff." };
  }
  const userUnits = normalizeUnits(req.user.units);
  const userUnit = req.user.unit || userUnits[0] || "";
  if (unit && userUnit && unit !== userUnit && !userUnits.includes(unit)) {
    return { error: "Kein Zugriff auf diese Unit." };
  }
  return { unit: unit || userUnit };
}

async function fetchEntriesForUnit(unit) {
  const result = await pool.query(
    `SELECT id, type, unit, payload, is_demo, updated_at
     FROM entries
     WHERE unit = $1 AND type = ANY($2::text[])
     ORDER BY updated_at DESC`,
    [unit, ENTRY_TYPES]
  );
  return result.rows.map((row) => ({
    ...(row.payload || {}),
    id: row.id,
    type: row.type,
    unit: row.unit,
    is_demo: row.is_demo,
    updatedAt: row.updated_at,
  }));
}

function backcastingPlanHasMeasures(payload) {
  const measures = payload?.measures || {};
  return Object.values(measures).some((list) => Array.isArray(list) && list.length > 0);
}

function mapBackcastingPlanRow(row) {
  return {
    id: row.id,
    unit: row.unit,
    is_demo: row.is_demo,
    updatedAt: row.updated_at,
    ...(row.payload || {}),
  };
}

async function fetchBackcastingPlanForUnit(unit) {
  const real = await pool.query(
    `SELECT id, unit, payload, is_demo, updated_at
     FROM backcasting_plans
     WHERE unit = $1 AND is_demo = false
     ORDER BY updated_at DESC
     LIMIT 1`,
    [unit]
  );
  const demo = await pool.query(
    `SELECT id, unit, payload, is_demo, updated_at
     FROM backcasting_plans
     WHERE unit = $1 AND is_demo = true
     ORDER BY updated_at DESC
     LIMIT 1`,
    [unit]
  );
  const realRow = real.rows[0];
  const demoRow = demo.rows[0];
  if (realRow && backcastingPlanHasMeasures(realRow.payload)) {
    return mapBackcastingPlanRow(realRow);
  }
  if (demoRow) {
    return mapBackcastingPlanRow(demoRow);
  }
  if (realRow) {
    return mapBackcastingPlanRow(realRow);
  }
  return null;
}

async function enrichBackcastingPlanMeta(unit, meta) {
  const trimmedUnit = String(unit || "").trim();
  const base = { ...(meta || {}), unit: trimmedUnit, bereich: trimmedUnit };
  if (!trimmedUnit) return base;
  const result = await pool.query(
    `SELECT ul.name AS unit_lead_name, ul.email AS unit_lead_email
     FROM units u
     LEFT JOIN users ul ON ul.id = u.unit_lead_id
     WHERE u.name = $1`,
    [trimmedUnit]
  );
  const row = result.rows[0];
  if (!row) return base;
  return {
    ...base,
    leiter: row.unit_lead_name || base.leiter || "",
    mail: row.unit_lead_email || base.mail || "",
  };
}

async function upsertBackcastingPlan(unit, payload, email, isDemo) {
  const id = backcastingPlanIdForUnit(unit, isDemo);
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO backcasting_plans (id, unit, payload, is_demo, created_by_email, updated_by_email, created_at, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, $5, $5, $6, $6)
     ON CONFLICT (id) DO UPDATE SET
       payload = EXCLUDED.payload,
       is_demo = EXCLUDED.is_demo,
       updated_by_email = EXCLUDED.updated_by_email,
       updated_at = EXCLUDED.updated_at`,
    [id, unit, JSON.stringify(payload), Boolean(isDemo), email, now]
  );
  return id;
}

async function removeDemoDataForUnit(unit) {
  await pool.query("DELETE FROM entries WHERE unit = $1 AND is_demo = true", [unit]);
  await pool.query("DELETE FROM backcasting_plans WHERE unit = $1 AND is_demo = true", [unit]);
}

const ENTRY_TYPE_LABELS = {
  skill: "Skill-Mitarbeiter",
  portfolio: "Portfolio-Einträge",
  organisation: "Organisations-Einträge",
};

async function getUnitDeletionBlockers(unitName) {
  const unit = String(unitName || "").trim();
  if (!unit) return [];
  const blockers = [];

  const entryStats = await pool.query(
    `SELECT type, is_demo, COUNT(*)::int AS count
     FROM entries WHERE unit = $1
     GROUP BY type, is_demo
     ORDER BY type, is_demo`,
    [unit]
  );
  for (const row of entryStats.rows) {
    const kind = ENTRY_TYPE_LABELS[row.type] || `Einträge (${row.type})`;
    const suffix = row.is_demo ? " (Demo)" : "";
    blockers.push(`${row.count}× ${kind}${suffix}`);
  }

  const planStats = await pool.query(
    `SELECT is_demo, COUNT(*)::int AS count
     FROM backcasting_plans WHERE unit = $1
     GROUP BY is_demo`,
    [unit]
  );
  for (const row of planStats.rows) {
    const suffix = row.is_demo ? " (Demo)" : "";
    blockers.push(`${row.count}× Backcasting-Plan${suffix}`);
  }

  const userCount = await pool.query(
    "SELECT COUNT(*)::int AS count FROM users WHERE $1 = ANY(units)",
    [unit]
  );
  if (userCount.rows[0].count > 0) {
    blockers.push(`${userCount.rows[0].count}× Benutzer mit Unit-Zuordnung`);
  }

  return blockers;
}

async function insertDemoEntries(entries, email) {
  const now = new Date().toISOString();
  for (const entry of entries) {
    const type = entry.type;
    if (!ENTRY_TYPES.includes(type)) continue;
    const payload = { ...entry, id: entry.id, type };
    await pool.query(
      `INSERT INTO entries (id, type, unit, workstream, payload, is_demo, created_by_email, updated_by_email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, true, $6, $6, $7, $7)
       ON CONFLICT (id) DO UPDATE SET
         type = EXCLUDED.type,
         unit = EXCLUDED.unit,
         workstream = EXCLUDED.workstream,
         payload = EXCLUDED.payload,
         is_demo = true,
         updated_by_email = EXCLUDED.updated_by_email,
         updated_at = EXCLUDED.updated_at`,
      [
        entry.id,
        type,
        entry.unit,
        entry.workstream || "",
        JSON.stringify(payload),
        email,
        now,
      ]
    );
  }
}

async function ensureUsersSchema() {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS units TEXT[] NOT NULL DEFAULT '{}'
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT '{}'
  `);

  await pool.query(`
    UPDATE users
    SET roles = ARRAY[role]::text[]
    WHERE cardinality(COALESCE(roles, '{}')) = 0
      AND role IS NOT NULL
      AND role <> ''
  `);

  await pool.query(`
    UPDATE users SET role = 'super_admin'
    WHERE email = 'olaf.glebsattel@realcore.de'
      AND role <> 'super_admin'
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS skill_entry_id TEXT UNIQUE
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS standort TEXT
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS regionalleiter_id BIGINT REFERENCES users(id) ON DELETE SET NULL
  `);

  await pool.query(`DROP INDEX IF EXISTS users_unit_lead_regionalleiter_unique`);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS geschaeftsfuehrung_id BIGINT REFERENCES users(id) ON DELETE SET NULL
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS geschaeftsfuehrung_ids BIGINT[] NOT NULL DEFAULT '{}'
  `);

  await pool.query(`
    UPDATE users
    SET geschaeftsfuehrung_ids = ARRAY[geschaeftsfuehrung_id]::BIGINT[]
    WHERE geschaeftsfuehrung_id IS NOT NULL
      AND (geschaeftsfuehrung_ids IS NULL OR geschaeftsfuehrung_ids = '{}')
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS personalnummer TEXT
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS login_blocked BOOLEAN NOT NULL DEFAULT false
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS unit_lead_id BIGINT REFERENCES users(id) ON DELETE SET NULL
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS user_org_roles TEXT[] NOT NULL DEFAULT '{}'
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS user_positions TEXT[] NOT NULL DEFAULT '{}'
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS user_org_role_ids BIGINT[] NOT NULL DEFAULT '{}'
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS user_position_ids BIGINT[] NOT NULL DEFAULT '{}'
  `);

  await backfillUserCatalogIds();
  await backfillSkillEmployeeUsers();
  await removeDemoUsers();
}

async function ensureMasterUnitsSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS units (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE units
    ADD COLUMN IF NOT EXISTS unit_lead_id BIGINT REFERENCES users(id) ON DELETE SET NULL
  `);
  await pool.query(`
    ALTER TABLE units
    ADD COLUMN IF NOT EXISTS deputy_lead_id BIGINT REFERENCES users(id) ON DELETE SET NULL
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

  await backfillUnitLeadershipFromUsers();
}

async function backfillUnitLeadershipFromUsers() {
  const units = await pool.query(
    "SELECT id, name FROM units WHERE unit_lead_id IS NULL ORDER BY name"
  );
  for (const unit of units.rows) {
    const leads = await pool.query(
      `SELECT id FROM users
       WHERE (role = 'unit_lead' OR 'unit_lead' = ANY(roles))
         AND $1 = ANY(units)
       ORDER BY name`,
      [unit.name]
    );
    if (!leads.rows.length) continue;
    const unitLeadId = leads.rows[0].id;
    const deputyLeadId = leads.rows[1]?.id || null;
    await pool.query(
      "UPDATE units SET unit_lead_id = $1, deputy_lead_id = $2 WHERE id = $3",
      [unitLeadId, deputyLeadId, unit.id]
    );
  }
}

function mapUnitLeadPerson(row, idKey, nameKey, emailKey) {
  const id = row[idKey];
  if (!id) return null;
  return {
    id,
    name: row[nameKey] ? String(row[nameKey]) : "",
    email: row[emailKey] ? String(row[emailKey]) : "",
  };
}

async function validateUnitLeadUserId(userId) {
  const id = normalizeUserId(userId);
  if (!id) return null;
  const result = await pool.query(
    `SELECT id, role, roles, user_positions, user_position_ids FROM users WHERE id = $1`,
    [id]
  );
  const row = result.rows[0];
  if (!row) throw new Error("INVALID_UNIT_LEAD");
  const positions = await resolveUserPositionNames(row);
  if (!userIsUnitLeaderCandidate({ ...row, user_positions: positions })) {
    throw new Error("INVALID_UNIT_LEAD");
  }
  return id;
}

async function validateDeputyLeadUserId(userId) {
  const id = normalizeUserId(userId);
  if (!id) return null;
  const result = await pool.query(
    `SELECT id, user_positions, user_position_ids FROM users WHERE id = $1`,
    [id]
  );
  const row = result.rows[0];
  const positions = await resolveUserPositionNames(row);
  if (!row || !userHasDeputyUnitLeaderPosition(positions)) {
    throw new Error("INVALID_DEPUTY_LEAD");
  }
  return id;
}

async function ensureUserHasUnitAssignment(userId, unitName) {
  const row = await pool.query("SELECT units FROM users WHERE id = $1", [userId]);
  if (!row.rows[0]) return;
  const current = normalizeUnits(row.rows[0].units);
  if (current.includes(unitName)) return;
  await pool.query("UPDATE users SET units = $1, updated_at = NOW() WHERE id = $2", [
    [...current, unitName],
    userId,
  ]);
}

async function removeUnitFromFormerLead(userId, unitName, unitId) {
  const stillAssigned = await pool.query(
    `SELECT id FROM units
     WHERE name = $1
       AND id <> $2
       AND (unit_lead_id = $3 OR deputy_lead_id = $3)`,
    [unitName, unitId, userId]
  );
  if (stillAssigned.rows.length) return;

  const row = await pool.query("SELECT units FROM users WHERE id = $1", [userId]);
  if (!row.rows[0]) return;
  const next = normalizeUnits(row.rows[0].units).filter((u) => u !== unitName);
  await pool.query("UPDATE users SET units = $1, updated_at = NOW() WHERE id = $2", [next, userId]);
}

async function assignUnitLeadership(unitId, unitName, { unitLeadId, deputyLeadId }) {
  const leadId = await validateUnitLeadUserId(unitLeadId);
  if (!leadId) {
    throw new Error("UNIT_LEAD_REQUIRED");
  }
  let deputyId = null;
  if (deputyLeadId !== undefined && deputyLeadId !== null && String(deputyLeadId).trim() !== "") {
    deputyId = await validateDeputyLeadUserId(deputyLeadId);
    if (deputyId === leadId) {
      throw new Error("DEPUTY_SAME_AS_LEAD");
    }
  }

  const prev = await pool.query(
    "SELECT unit_lead_id, deputy_lead_id FROM units WHERE id = $1",
    [unitId]
  );
  const prevLead = prev.rows[0]?.unit_lead_id || null;
  const prevDeputy = prev.rows[0]?.deputy_lead_id || null;

  await pool.query(
    "UPDATE units SET unit_lead_id = $1, deputy_lead_id = $2 WHERE id = $3",
    [leadId, deputyId, unitId]
  );

  const assigneeIds = [leadId, deputyId].map(normalizeUserId).filter(Boolean);
  const prevIds = [prevLead, prevDeputy].map(normalizeUserId).filter(Boolean);

  for (const userId of prevIds) {
    if (!assigneeIds.includes(userId)) {
      await removeUnitFromFormerLead(userId, unitName, unitId);
    }
  }
  for (const userId of assigneeIds) {
    await ensureUserHasUnitAssignment(userId, unitName);
  }
}

const DEFAULT_TECH_SKILL_CATEGORIES = [
  { name: "Cloud & Infrastructure", beschreibung: "Cloud-Plattformen, Container-Orchestrierung, Infrastructure as Code, Netzwerk und Betrieb.", beispiel: "AWS, Azure, GCP, Kubernetes, Docker, Terraform, CloudFormation, Ansible" },
  { name: "Data & Analytics", beschreibung: "Datenbanken, Data Warehousing, BI-Tools, ETL/ELT-Prozesse und Datenanalyse.", beispiel: "SQL, PostgreSQL, MongoDB, Snowflake, dbt, Power BI, Tableau, Spark" },
  { name: "Development & Automation", beschreibung: "Programmierung, API-Entwicklung, CI/CD, Scripting und Automatisierung.", beispiel: "Python, JavaScript, TypeScript, Java, Go, REST APIs, GraphQL, GitHub Actions" },
  { name: "AI & Machine Learning", beschreibung: "LLMs, Machine Learning, Prompt Engineering, AI-Integration in Anwendungen.", beispiel: "Azure OpenAI, ChatGPT, LangChain, TensorFlow, PyTorch, Hugging Face" },
  { name: "Security & Compliance", beschreibung: "IT-Sicherheit, Datenschutz, Governance, Audit und Compliance.", beispiel: "Zero Trust, IAM, DSGVO, ISO 27001, SIEM, Penetration Testing" },
  { name: "Business Tools & Plattformen", beschreibung: "ERP, CRM, Collaboration-Suites und unternehmensweite Plattformen.", beispiel: "SAP S/4HANA, Microsoft Dynamics, Salesforce, Microsoft 365" },
  { name: "Integration & Middleware", beschreibung: "System-Integration, Event-Streaming, Message Queues und Middleware.", beispiel: "REST/SOAP APIs, Apache Kafka, RabbitMQ, Azure Service Bus, MuleSoft" },
  { name: "Low-Code / No-Code", beschreibung: "Visuelle Entwicklungsplattformen, Workflow-Automatisierung ohne klassische Programmierung.", beispiel: "Power Platform (Power Apps, Power Automate), Airtable, OutSystems" },
  { name: "Emerging Tech", beschreibung: "Zukunftstechnologien je nach Branche und Innovationsfokus.", beispiel: "Blockchain, IoT, Edge Computing, Quantum Computing, AR/VR" },
  { name: "Soft Skills & Methodik", beschreibung: "Agile Methoden, Architektur-Frameworks, Kommunikation und Zusammenarbeit.", beispiel: "Scrum, Kanban, DevOps-Kultur, TOGAF, Solution Architecture" },
];

const DEFAULT_SOFT_SKILL_CATEGORIES = [
  { name: "Kommunikation & Präsentation", beschreibung: "Fähigkeit, Informationen klar und überzeugend zu vermitteln – mündlich, schriftlich, visuell", beispiel: "Präsentationstechniken, Storytelling, Executive Communication, Dokumentation, Visualization, Public Speaking" },
  { name: "Vertrieb & Akquise", beschreibung: "Neukundengewinnung, Beziehungsaufbau, Verkaufsabschluss, Account-Pflege", beispiel: "B2B/B2C Sales, Cold Calling, Lead Qualification, Proposal Writing, Closing Techniques, Cross-Selling, CRM" },
  { name: "Leadership & People Management", beschreibung: "Teams führen, entwickeln und motivieren; strategische Ausrichtung vermitteln", beispiel: "Mitarbeiterführung, 1:1s, Performance Management, Delegation, Coaching, Change Management, Talent Development" },
  { name: "Projektmanagement & Organisation", beschreibung: "Projekte planen, steuern und erfolgreich abschließen; Stakeholder koordinieren", beispiel: "Agile/Waterfall PM, Roadmapping, Ressourcenplanung, Risk Management, Reporting, Stakeholder Management" },
  { name: "Problemlösung & Analytisches Denken", beschreibung: "Komplexe Probleme strukturieren, Ursachen identifizieren, fundierte Entscheidungen treffen", beispiel: "Root Cause Analysis, Structured Thinking, Data-Driven Decision Making, Critical Thinking, Troubleshooting" },
  { name: "Kreativität & Innovation", beschreibung: "Neue Ideen entwickeln, Prozesse hinterfragen, Innovationen vorantreiben", beispiel: "Design Thinking, Brainstorming, Prototyping, Lateral Thinking, Experimentation, Business Model Innovation" },
  { name: "Teamarbeit & Kollaboration", beschreibung: "Effektiv mit anderen zusammenarbeiten, Wissen teilen, gemeinsame Ziele erreichen", beispiel: "Cross-Functional Collaboration, Active Listening, Feedback geben/nehmen, Remote Collaboration, Empathie" },
  { name: "Kundenorientierung & Service", beschreibung: "Kundenbedürfnisse verstehen, Erwartungen übertreffen, langfristige Beziehungen aufbauen", beispiel: "Customer Success, User Empathy, Service Excellence, Complaint Handling, Relationship Management" },
  { name: "Verhandlung & Konfliktlösung", beschreibung: "Win-Win-Lösungen erarbeiten, Interessenskonflikte auflösen, schwierige Gespräche führen", beispiel: "Negotiation Techniques, Mediation, Difficult Conversations, Diplomacy, De-escalation, Consensus Building" },
  { name: "Zeitmanagement & Priorisierung", beschreibung: "Aufgaben effektiv planen, Deadlines einhalten, Wichtiges von Dringendem unterscheiden", beispiel: "Eisenhower-Matrix, Time Blocking, Delegation, Focus Management, Productivity Methods (GTD, Pomodoro)" },
];

function mapSkillCategoryRow(row) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    beschreibung: row.beschreibung || "",
    beispiel: row.beispiel || "",
    sortOrder: row.sort_order,
  };
}

async function ensureSkillCategoriesSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS skill_categories (
      id BIGSERIAL PRIMARY KEY,
      kind TEXT NOT NULL CHECK(kind IN ('tech', 'soft')),
      name TEXT NOT NULL,
      beschreibung TEXT NOT NULL DEFAULT '',
      beispiel TEXT NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(kind, name)
    )
  `);

  const countResult = await pool.query("SELECT COUNT(*)::int AS count FROM skill_categories");
  if (countResult.rows[0].count > 0) return;

  let order = 0;
  for (const cat of DEFAULT_TECH_SKILL_CATEGORIES) {
    await pool.query(
      `INSERT INTO skill_categories (kind, name, beschreibung, beispiel, sort_order)
       VALUES ('tech', $1, $2, $3, $4)`,
      [cat.name, cat.beschreibung, cat.beispiel, order++]
    );
  }
  order = 0;
  for (const cat of DEFAULT_SOFT_SKILL_CATEGORIES) {
    await pool.query(
      `INSERT INTO skill_categories (kind, name, beschreibung, beispiel, sort_order)
       VALUES ('soft', $1, $2, $3, $4)`,
      [cat.name, cat.beschreibung, cat.beispiel, order++]
    );
  }
}

/** Rollen in der Unit (Organisation) – ohne Hierarchie-Positionen (die liegen in app_positions). */
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

/** Positionen in der Skill-Matrix (Mitarbeiter) */
const DEFAULT_APP_POSITIONS = [
  "Geschäftsführer",
  "Regional Leiter",
  "Unit Leiter",
  "Stellv. Unit Leiter",
  "Mitarbeiter",
  "CC Leiter",
];

/** Gehoeren in Positionen (Skill-Matrix), nicht in Organisations-Rollen. */
const HIERARCHY_NAMES_NOT_ORG_ROLES = [
  "Unit Lead",
  "Unit Leiter",
  "Regionalleiter",
  "Regional Leiter",
  "Geschaeftsfuehrung",
  "Geschäftsführer",
];

const DEPUTY_UNIT_LEADER_POSITION = "Stellv. Unit Leiter";
const DEPUTY_UNIT_LEADER_POSITION_KEY = normalizePositionKey(DEPUTY_UNIT_LEADER_POSITION);
const UNIT_LEADER_POSITION = "Unit Leiter";
const UNIT_LEADER_POSITION_KEY = normalizePositionKey(UNIT_LEADER_POSITION);

function normalizeUserId(id) {
  if (id === undefined || id === null || id === "") return null;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function userHasDeputyUnitLeaderPosition(userPositions) {
  return normalizeStringArray(userPositions).some(
    (name) => normalizePositionKey(name) === DEPUTY_UNIT_LEADER_POSITION_KEY
  );
}

function userHasUnitLeaderPosition(userPositions) {
  return normalizeStringArray(userPositions).some(
    (name) => normalizePositionKey(name) === UNIT_LEADER_POSITION_KEY
  );
}

function userIsUnitLeaderCandidate(row) {
  if (!row) return false;
  const roles = getUserRoles(row);
  if (roles.includes("unit_lead")) return true;
  return userHasUnitLeaderPosition(row.user_positions);
}

function mapCatalogNameRow(row) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
  };
}

async function ensureAppRolesSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_roles (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function ensureAppPositionsSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_positions (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function upsertCatalogNames(table, names) {
  let order = 0;
  for (const name of names) {
    await pool.query(
      `INSERT INTO ${table} (name, sort_order) VALUES ($1, $2)
       ON CONFLICT (name) DO NOTHING`,
      [name, order++]
    );
  }
}

async function insertMissingCatalogNames(table, names) {
  const maxResult = await pool.query(
    `SELECT COALESCE(MAX(sort_order), -1)::int AS max_order FROM ${table}`
  );
  let order = maxResult.rows[0].max_order + 1;
  for (const name of names) {
    const exists = await pool.query(`SELECT 1 FROM ${table} WHERE name = $1`, [name]);
    if (!exists.rows.length) {
      await pool.query(`INSERT INTO ${table} (name, sort_order) VALUES ($1, $2)`, [name, order++]);
    }
  }
}

async function getCatalogNameById(table, id) {
  const safeTable = table === "app_positions" ? "app_positions" : "app_roles";
  const result = await pool.query(`SELECT name FROM ${safeTable} WHERE id = $1`, [id]);
  return result.rows[0]?.name || null;
}

async function moveCatalogItem(table, id, direction) {
  const safeTable = table === "app_positions" ? "app_positions" : "app_roles";
  const dir = direction === "up" ? "up" : direction === "down" ? "down" : null;
  if (!dir) return { error: "invalid_direction" };

  const targetId = Number(id);
  if (!Number.isInteger(targetId) || targetId <= 0) return { error: "not_found" };

  await pool.query("BEGIN");
  try {
    const { rows } = await pool.query(
      `SELECT id, sort_order FROM ${safeTable} ORDER BY sort_order, name`
    );
    const idx = rows.findIndex((row) => Number(row.id) === targetId);
    if (idx < 0) {
      await pool.query("ROLLBACK");
      return { error: "not_found" };
    }
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= rows.length) {
      await pool.query("ROLLBACK");
      return { error: "boundary" };
    }
    const current = rows[idx];
    const neighbor = rows[swapIdx];
    await pool.query(`UPDATE ${safeTable} SET sort_order = $1, updated_at = NOW() WHERE id = $2`, [
      neighbor.sort_order,
      current.id,
    ]);
    await pool.query(`UPDATE ${safeTable} SET sort_order = $1, updated_at = NOW() WHERE id = $2`, [
      current.sort_order,
      neighbor.id,
    ]);
    await pool.query("COMMIT");
    return { ok: true };
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

async function listCatalogNameRows(table) {
  const safeTable = table === "app_positions" ? "app_positions" : "app_roles";
  const result = await pool.query(
    `SELECT id, name, sort_order FROM ${safeTable} ORDER BY sort_order, name`
  );
  return result.rows.map(mapCatalogNameRow);
}

async function moveSkillCategoryItem(pool, id, direction) {
  const dir = direction === "up" ? "up" : direction === "down" ? "down" : null;
  if (!dir) return { error: "invalid_direction" };

  const targetId = Number(id);
  if (!Number.isInteger(targetId) || targetId <= 0) return { error: "not_found" };

  const existing = await pool.query("SELECT id, kind FROM skill_categories WHERE id = $1", [targetId]);
  const kind = existing.rows[0]?.kind;
  if (!kind) return { error: "not_found" };

  await pool.query("BEGIN");
  try {
    const { rows } = await pool.query(
      `SELECT id, sort_order FROM skill_categories WHERE kind = $1 ORDER BY sort_order, name`,
      [kind]
    );
    const idx = rows.findIndex((row) => Number(row.id) === targetId);
    if (idx < 0) {
      await pool.query("ROLLBACK");
      return { error: "not_found" };
    }
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= rows.length) {
      await pool.query("ROLLBACK");
      return { error: "boundary" };
    }
    const current = rows[idx];
    const neighbor = rows[swapIdx];
    await pool.query(
      `UPDATE skill_categories SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
      [neighbor.sort_order, current.id]
    );
    await pool.query(
      `UPDATE skill_categories SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
      [current.sort_order, neighbor.id]
    );
    await pool.query("COMMIT");
    return { ok: true, kind };
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

async function listSkillCategoryRows(pool, kind) {
  const result = await pool.query(
    `SELECT id, kind, name, beschreibung, beispiel, sort_order
     FROM skill_categories
     WHERE kind = $1
     ORDER BY sort_order, name`,
    [kind]
  );
  return result.rows.map(mapSkillCategoryRow);
}

async function cascadeUserCatalogArrayRename(column, oldName, newName) {
  if (!oldName || !newName || oldName === newName) return 0;
  const safeColumn = column === "user_positions" ? "user_positions" : "user_org_roles";
  const result = await pool.query(
    `UPDATE users SET ${safeColumn} = array_replace(${safeColumn}, $1, $2)
     WHERE $1 = ANY(${safeColumn})`,
    [oldName, newName]
  );
  return result.rowCount || 0;
}

async function cascadeUserCatalogArrayRemoveById(column, catalogId) {
  const id = Number(catalogId);
  if (!Number.isInteger(id) || id <= 0) return 0;
  const safeColumn = column === "user_position_ids" ? "user_position_ids" : "user_org_role_ids";
  const result = await pool.query(
    `UPDATE users SET ${safeColumn} = array_remove(${safeColumn}, $1::bigint)
     WHERE $1::bigint = ANY(${safeColumn})`,
    [id]
  );
  return result.rowCount || 0;
}

async function syncUserCatalogNameArraysFromIds(userId, orgRoleIds, positionIds) {
  const stored = await pool.query(
    `SELECT user_org_role_ids, user_position_ids FROM users WHERE id = $1`,
    [userId]
  );
  const row = stored.rows[0];
  if (!row) return;
  const orgIds = normalizeBigIntArray(orgRoleIds).length
    ? normalizeBigIntArray(orgRoleIds)
    : normalizeBigIntArray(row.user_org_role_ids);
  const posIds =
    positionIds !== undefined && positionIds !== null
      ? normalizeBigIntArray(positionIds)
      : normalizeBigIntArray(row.user_position_ids);
  const roleCatalog = await fetchCatalogLookup("app_roles");
  const positionCatalog = await fetchCatalogLookup("app_positions");
  await pool.query(
    `UPDATE users
     SET user_org_roles = $1, user_positions = $2
     WHERE id = $3`,
    [
      resolveCatalogNamesFromIds(roleCatalog.byId, orgIds),
      resolveCatalogNamesFromIds(positionCatalog.byId, posIds),
      userId,
    ]
  );
}

async function refreshUserCatalogNameArraysByCatalogId(column, catalogId) {
  const id = Number(catalogId);
  if (!Number.isInteger(id) || id <= 0) return 0;
  const idColumn = column === "user_position_ids" ? "user_position_ids" : "user_org_role_ids";
  const users = await pool.query(
    `SELECT id, user_org_role_ids, user_position_ids FROM users WHERE $1::bigint = ANY(${idColumn})`,
    [id]
  );
  for (const row of users.rows) {
    await syncUserCatalogNameArraysFromIds(
      row.id,
      row.user_org_role_ids,
      row.user_position_ids
    );
  }
  return users.rows.length;
}

async function resolveUserPositionNames(row) {
  if (!row) return [];
  const ids = normalizeBigIntArray(row.user_position_ids);
  if (ids.length) {
    const catalog = await fetchCatalogLookup("app_positions");
    return resolveCatalogNamesFromIds(catalog.byId, ids);
  }
  return normalizeStringArray(row.user_positions);
}

async function cascadeOrgRoleNameInEntries(oldName, newName) {
  if (!oldName || !newName || oldName === newName) return 0;
  const rows = await pool.query(`SELECT id, payload FROM entries WHERE type = 'organisation'`);
  let updated = 0;
  for (const row of rows.rows) {
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    if (!Array.isArray(payload.rollen)) continue;
    let changed = false;
    const nextRollen = payload.rollen.map((item) => {
      if (item && String(item.rolle || "") === oldName) {
        changed = true;
        return { ...item, rolle: newName };
      }
      return item;
    });
    if (!changed) continue;
    await pool.query(
      `UPDATE entries SET payload = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [{ ...payload, rollen: nextRollen }, row.id]
    );
    updated += 1;
  }
  return updated;
}

function normalizeSkillPositionId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function resolveCatalogIdArrayFromInput(catalog, names, explicitIds) {
  const byId = catalog?.byId || new Map();
  const byName = catalog?.byName || new Map();
  const fromIds = normalizeBigIntArray(explicitIds).filter((id) => byId.has(id));
  if (fromIds.length) return fromIds;
  return filterToAllowedNames(names, [...byName.keys()])
    .map((name) => byName.get(name))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function enrichSkillEntryCatalog(entry, roleCatalog, positionCatalog) {
  const roles = roleCatalog || { byId: new Map(), byName: new Map() };
  const positions = positionCatalog || { byId: new Map(), byName: new Map() };
  const legacyRolle = String(entry.rolle || "").trim();

  let orgRoleIds = resolveCatalogIdArrayFromInput(
    roles,
    entry.org_roles,
    entry.org_role_ids ?? entry.orgRoleIds
  );
  if (!orgRoleIds.length && legacyRolle && roles.byName.has(legacyRolle) && !positions.byName.has(legacyRolle)) {
    orgRoleIds = [roles.byName.get(legacyRolle)];
  }

  let positionIds = resolveCatalogIdArrayFromInput(
    positions,
    entry.positions,
    entry.position_ids ?? entry.positionIds
  );
  const legacyPosId = normalizeSkillPositionId(entry.position_id ?? entry.positionId);
  if (!positionIds.length && legacyPosId && positions.byId.has(legacyPosId)) {
    positionIds = [legacyPosId];
  }
  if (!positionIds.length && legacyRolle && positions.byName.has(legacyRolle)) {
    positionIds = [positions.byName.get(legacyRolle)];
  }

  const orgRoles = resolveCatalogNamesFromIds(roles.byId, orgRoleIds);
  const posNames = resolveCatalogNamesFromIds(positions.byId, positionIds);

  return {
    ...entry,
    org_role_ids: orgRoleIds,
    org_roles: orgRoles,
    position_ids: positionIds,
    positions: posNames,
    rolle: posNames[0] || legacyRolle,
    position_id: positionIds[0] || null,
  };
}

function enrichSkillEntryPosition(entry, positionCatalog) {
  const roleCatalog = { byId: new Map(), byName: new Map() };
  return enrichSkillEntryCatalog(entry, roleCatalog, positionCatalog);
}

async function fetchSkillCategoryLookup(kind) {
  const safeKind = kind === "soft" ? "soft" : "tech";
  const result = await pool.query(
    `SELECT id, name FROM skill_categories WHERE kind = $1 ORDER BY sort_order, name`,
    [safeKind]
  );
  const byId = new Map();
  const byName = new Map();
  for (const row of result.rows) {
    const id = Number(row.id);
    const name = String(row.name);
    byId.set(id, name);
    byName.set(name, id);
  }
  return { byId, byName, kind: safeKind };
}

function normalizeSkillCategoryId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function enrichSkillAssessmentItem(item, categoryCatalog) {
  const catalog = categoryCatalog || { byId: new Map(), byName: new Map() };
  const categoryId = normalizeSkillCategoryId(item.kategorie_id ?? item.kategorieId);
  const kategorieText = String(item.kategorie || "").trim();
  if (categoryId && catalog.byId.has(categoryId)) {
    return {
      ...item,
      kategorie_id: categoryId,
      kategorie: catalog.byId.get(categoryId),
    };
  }
  if (kategorieText && catalog.byName.has(kategorieText)) {
    const fromName = catalog.byName.get(kategorieText);
    return {
      ...item,
      kategorie_id: fromName,
      kategorie: catalog.byId.get(fromName) || kategorieText,
    };
  }
  return {
    ...item,
    kategorie_id: categoryId,
    kategorie: kategorieText,
  };
}

function enrichSkillEntryAssessmentLists(entry, techCatalog, softCatalog) {
  const skills = Array.isArray(entry.skills)
    ? entry.skills.map((item) => enrichSkillAssessmentItem(item, techCatalog))
    : entry.skills;
  const softSkills = Array.isArray(entry.softSkills)
    ? entry.softSkills.map((item) => enrichSkillAssessmentItem(item, softCatalog))
    : entry.softSkills;
  return { ...entry, skills, softSkills };
}

async function enrichSkillEntries(entries) {
  const roleCatalog = await fetchCatalogLookup("app_roles");
  const positionCatalog = await fetchCatalogLookup("app_positions");
  const techCatalog = await fetchSkillCategoryLookup("tech");
  const softCatalog = await fetchSkillCategoryLookup("soft");
  return entries.map((entry) => {
    if (entry.type !== "skill") return entry;
    let enriched = enrichSkillEntryCatalog(entry, roleCatalog, positionCatalog);
    enriched = enrichSkillEntryAssessmentLists(enriched, techCatalog, softCatalog);
    return enriched;
  });
}

async function normalizeSkillEntryPayload(entry) {
  const roleCatalog = await fetchCatalogLookup("app_roles");
  const positionCatalog = await fetchCatalogLookup("app_positions");
  const techCatalog = await fetchSkillCategoryLookup("tech");
  const softCatalog = await fetchSkillCategoryLookup("soft");
  let normalized = enrichSkillEntryCatalog(entry, roleCatalog, positionCatalog);
  normalized = enrichSkillEntryAssessmentLists(normalized, techCatalog, softCatalog);
  return normalized;
}

async function normalizeSkillPositionPayload(entry) {
  return normalizeSkillEntryPayload(entry);
}

async function backfillSkillEntryPositionIds() {
  const roleCatalog = await fetchCatalogLookup("app_roles");
  const positionCatalog = await fetchCatalogLookup("app_positions");
  const rows = await pool.query(`SELECT id, payload FROM entries WHERE type = 'skill'`);
  for (const row of rows.rows) {
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    const enriched = enrichSkillEntryCatalog(payload, roleCatalog, positionCatalog);
    const prev = JSON.stringify({
      org_role_ids: payload.org_role_ids,
      org_roles: payload.org_roles,
      position_ids: payload.position_ids,
      positions: payload.positions,
      position_id: payload.position_id,
      rolle: payload.rolle,
    });
    const next = JSON.stringify({
      org_role_ids: enriched.org_role_ids,
      org_roles: enriched.org_roles,
      position_ids: enriched.position_ids,
      positions: enriched.positions,
      position_id: enriched.position_id,
      rolle: enriched.rolle,
    });
    if (prev === next) continue;
    await pool.query(
      `UPDATE entries SET payload = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [
        {
          ...payload,
          org_role_ids: enriched.org_role_ids,
          org_roles: enriched.org_roles,
          position_ids: enriched.position_ids,
          positions: enriched.positions,
          position_id: enriched.position_id,
          rolle: enriched.rolle,
        },
        row.id,
      ]
    );
  }
}

function employeePayloadMatchesOrgRoleId(payload, roleId) {
  const id = Number(roleId);
  if (!Number.isInteger(id) || id <= 0) return false;
  const ids = normalizeBigIntArray(payload.org_role_ids ?? payload.orgRoleIds);
  return ids.includes(id);
}

function employeePayloadMatchesPositionId(payload, positionId) {
  const id = Number(positionId);
  if (!Number.isInteger(id) || id <= 0) return false;
  const ids = normalizeBigIntArray(payload.position_ids ?? payload.positionIds);
  if (ids.includes(id)) return true;
  return normalizeSkillPositionId(payload.position_id ?? payload.positionId) === id;
}

function renameIdInArray(ids, catalogId, newId) {
  const id = Number(catalogId);
  const nextId = Number(newId);
  return normalizeBigIntArray(ids).map((item) => (item === id ? nextId || item : item));
}

function renameNameInArray(names, oldName, newName) {
  const safeOld = String(oldName || "").trim();
  const safeNew = String(newName || "").trim();
  return normalizeStringArray(names).map((name) => (name === safeOld ? safeNew : name));
}

async function cascadeSkillOrgRoleRenameInEmployeeEntries(catalogId, oldName, newName) {
  if (!oldName || !newName || oldName === newName) return 0;
  const id = Number(catalogId);
  const rows = await pool.query(`SELECT id, payload FROM entries WHERE type = 'skill'`);
  let updated = 0;
  for (const row of rows.rows) {
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    const matchesId = employeePayloadMatchesOrgRoleId(payload, id);
    const orgRoles = normalizeStringArray(payload.org_roles);
    const matchesLegacyName = !matchesId && orgRoles.includes(oldName);
    if (!matchesId && !matchesLegacyName) continue;
    const nextOrgRoleIds = matchesId ? renameIdInArray(payload.org_role_ids, id, id) : normalizeBigIntArray(payload.org_role_ids);
    const nextOrgRoles = renameNameInArray(orgRoles, oldName, newName);
    await pool.query(
      `UPDATE entries SET payload = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [
        JSON.stringify({
          ...payload,
          org_role_ids: nextOrgRoleIds,
          org_roles: nextOrgRoles,
        }),
        row.id,
      ]
    );
    updated += 1;
  }
  return updated;
}

async function cascadeSkillOrgRoleRemoveInEmployeeEntries(catalogId, removedName) {
  const id = Number(catalogId);
  if (!Number.isInteger(id) || id <= 0) return 0;
  const safeName = removedName ? String(removedName).trim() : "";
  const rows = await pool.query(`SELECT id, payload FROM entries WHERE type = 'skill'`);
  let updated = 0;
  for (const row of rows.rows) {
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    if (!employeePayloadMatchesOrgRoleId(payload, id)) continue;
    const orgRoleIds = normalizeBigIntArray(payload.org_role_ids).filter((item) => item !== id);
    const orgRoles = normalizeStringArray(payload.org_roles).filter(
      (name) => name !== safeName
    );
    await pool.query(
      `UPDATE entries SET payload = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [{ ...payload, org_role_ids: orgRoleIds, org_roles: orgRoles }, row.id]
    );
    updated += 1;
  }
  return updated;
}

async function backfillSkillEntryCategoryIds() {
  const techCatalog = await fetchSkillCategoryLookup("tech");
  const softCatalog = await fetchSkillCategoryLookup("soft");
  const rows = await pool.query(`SELECT id, payload FROM entries WHERE type = 'skill'`);
  for (const row of rows.rows) {
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    const enriched = enrichSkillEntryAssessmentLists(payload, techCatalog, softCatalog);
    const prevPayload = JSON.stringify({
      skills: payload.skills,
      softSkills: payload.softSkills,
    });
    const nextPayload = JSON.stringify({
      skills: enriched.skills,
      softSkills: enriched.softSkills,
    });
    if (prevPayload === nextPayload) continue;
    await pool.query(
      `UPDATE entries SET payload = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [{ ...payload, skills: enriched.skills, softSkills: enriched.softSkills }, row.id]
    );
  }
}

function assessmentItemMatchesCategory(item, categoryId, oldName) {
  const id = normalizeSkillCategoryId(item.kategorie_id ?? item.kategorieId);
  const matchesId = Number.isInteger(categoryId) && categoryId > 0 && id === categoryId;
  const matchesLegacyName =
    !id && String(item.kategorie || "").trim() === oldName;
  return matchesId || matchesLegacyName;
}

async function cascadeSkillCategoryRenameInEntries(categoryId, kind, oldName, newName) {
  if (!oldName || !newName || oldName === newName) return 0;
  const id = Number(categoryId);
  const field = kind === "soft" ? "softSkills" : "skills";
  const rows = await pool.query(`SELECT id, payload FROM entries WHERE type = 'skill'`);
  let updated = 0;
  for (const row of rows.rows) {
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    const list = Array.isArray(payload[field]) ? payload[field] : [];
    let changed = false;
    const nextList = list.map((item) => {
      if (!assessmentItemMatchesCategory(item, id, oldName)) return item;
      changed = true;
      return {
        ...item,
        kategorie_id: id,
        kategorie: newName,
      };
    });
    if (!changed) continue;
    await pool.query(
      `UPDATE entries SET payload = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [{ ...payload, [field]: nextList }, row.id]
    );
    updated += 1;
  }
  return updated;
}

async function cascadeSkillCategoryRemoveInEntries(categoryId, kind, removedName) {
  const id = Number(categoryId);
  if (!Number.isInteger(id) || id <= 0) return 0;
  const safeName = removedName ? String(removedName).trim() : "";
  const field = kind === "soft" ? "softSkills" : "skills";
  const rows = await pool.query(`SELECT id, payload FROM entries WHERE type = 'skill'`);
  let updated = 0;
  for (const row of rows.rows) {
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    const list = Array.isArray(payload[field]) ? payload[field] : [];
    let changed = false;
    const nextList = list.map((item) => {
      const itemId = normalizeSkillCategoryId(item.kategorie_id ?? item.kategorieId);
      if (itemId !== id) return item;
      changed = true;
      const kategorie = String(item.kategorie || "").trim();
      const nextKategorie = safeName && kategorie === safeName ? "" : kategorie;
      return { ...item, kategorie_id: null, kategorie: nextKategorie };
    });
    if (!changed) continue;
    await pool.query(
      `UPDATE entries SET payload = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [{ ...payload, [field]: nextList }, row.id]
    );
    updated += 1;
  }
  return updated;
}

async function cascadePositionNameInSkillEntries(catalogId, oldName, newName) {
  if (!oldName || !newName || oldName === newName) return 0;
  const id = Number(catalogId);
  const rows = await pool.query(`SELECT id, payload FROM entries WHERE type = 'skill'`);
  let updated = 0;
  for (const row of rows.rows) {
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    const matchesId = employeePayloadMatchesPositionId(payload, id);
    const positions = normalizeStringArray(payload.positions);
    const matchesLegacyName =
      !matchesId &&
      (positions.includes(oldName) || String(payload.rolle || "").trim() === oldName);
    if (!matchesId && !matchesLegacyName) continue;
    const nextPositionIds = matchesId
      ? normalizeBigIntArray(payload.position_ids).map((item) => item)
      : normalizeBigIntArray(payload.position_ids);
    const nextPositions = renameNameInArray(
      positions.length ? positions : normalizeStringArray([payload.rolle]),
      oldName,
      newName
    );
    await pool.query(
      `UPDATE entries SET payload = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [
        JSON.stringify({
          ...payload,
          position_ids: nextPositionIds.length ? nextPositionIds : matchesId ? [id] : [],
          positions: nextPositions,
          position_id: nextPositionIds[0] || null,
          rolle: nextPositions[0] || "",
        }),
        row.id,
      ]
    );
    updated += 1;
  }
  return updated;
}

async function cascadePositionRemoveInSkillEntries(catalogId, removedName) {
  const id = Number(catalogId);
  if (!Number.isInteger(id) || id <= 0) return 0;
  const safeName = removedName ? String(removedName).trim() : "";
  const rows = await pool.query(`SELECT id, payload FROM entries WHERE type = 'skill'`);
  let updated = 0;
  for (const row of rows.rows) {
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    if (!employeePayloadMatchesPositionId(payload, id)) continue;
    const positionIds = normalizeBigIntArray(payload.position_ids).filter((item) => item !== id);
    const positions = normalizeStringArray(payload.positions).filter((name) => name !== safeName);
    await pool.query(
      `UPDATE entries SET payload = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [
        {
          ...payload,
          position_ids: positionIds,
          positions,
          position_id: positionIds[0] || null,
          rolle: positions[0] || "",
        },
        row.id,
      ]
    );
    updated += 1;
  }
  return updated;
}

async function renameAppRoleWithCascade(id, newName) {
  const oldName = await getCatalogNameById("app_roles", id);
  if (!oldName) return null;
  const safeName = String(newName).trim();
  const result = await pool.query(
    `UPDATE app_roles SET name = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, name, sort_order`,
    [safeName, id]
  );
  if (!result.rows[0]) return null;
  if (oldName !== safeName) {
    await cascadeUserCatalogArrayRename("user_org_roles", oldName, safeName);
    await cascadeOrgRoleNameInEntries(oldName, safeName);
    await cascadeSkillOrgRoleRenameInEmployeeEntries(id, oldName, safeName);
    await refreshUserCatalogNameArraysByCatalogId("user_org_role_ids", id);
  }
  return result.rows[0];
}

async function renameAppPositionWithCascade(id, newName) {
  const oldName = await getCatalogNameById("app_positions", id);
  if (!oldName) return null;
  const safeName = String(newName).trim();
  const result = await pool.query(
    `UPDATE app_positions SET name = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, name, sort_order`,
    [safeName, id]
  );
  if (!result.rows[0]) return null;
  if (oldName !== safeName) {
    await cascadeUserCatalogArrayRename("user_positions", oldName, safeName);
    await cascadePositionNameInSkillEntries(id, oldName, safeName);
    await refreshUserCatalogNameArraysByCatalogId("user_position_ids", id);
  }
  return result.rows[0];
}

async function migrateBeraterPositionToMitarbeiter() {
  const beraterRow = await pool.query(`SELECT id FROM app_positions WHERE name = $1`, ["Berater"]);
  if (!beraterRow.rows.length) return;

  await cascadeUserCatalogArrayRename("user_positions", "Berater", "Mitarbeiter");
  await cascadePositionNameInSkillEntries(
    beraterRow.rows[0].id,
    "Berater",
    "Mitarbeiter"
  );

  const mitarbeiterRow = await pool.query(`SELECT id FROM app_positions WHERE name = $1`, ["Mitarbeiter"]);
  if (mitarbeiterRow.rows.length) {
    await pool.query(`DELETE FROM app_positions WHERE name = $1`, ["Berater"]);
  } else {
    await pool.query(
      `UPDATE app_positions SET name = $1, updated_at = NOW() WHERE name = $2`,
      ["Mitarbeiter", "Berater"]
    );
  }
}

async function syncAppRolesAndPositionsCatalog() {
  await ensureAppRolesSchema();
  await ensureAppPositionsSchema();

  await upsertCatalogNames("app_positions", DEFAULT_APP_POSITIONS);
  await migrateBeraterPositionToMitarbeiter();
  await pool.query(`DELETE FROM app_roles WHERE name = ANY($1::text[])`, [
    [...DEFAULT_APP_POSITIONS, ...HIERARCHY_NAMES_NOT_ORG_ROLES],
  ]);

  const roleCount = await pool.query("SELECT COUNT(*)::int AS count FROM app_roles");
  if (roleCount.rows[0].count === 0) {
    await upsertCatalogNames("app_roles", DEFAULT_ORG_ROLLEN);
  }
}

const DEFAULT_PLANNING_YEARS = { startYear: 2026, endYear: 2029 };

async function ensureAppConfigSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_config (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const existing = await pool.query("SELECT id FROM app_config WHERE id = 'planning_years'");
  if (!existing.rows.length) {
    await pool.query(
      `INSERT INTO app_config (id, payload) VALUES ('planning_years', $1::jsonb)`,
      [JSON.stringify(DEFAULT_PLANNING_YEARS)]
    );
  }
}

async function getPlanningYears() {
  try {
    const { rows } = await pool.query(
      "SELECT payload FROM app_config WHERE id = 'planning_years'"
    );
    if (rows.length) {
      const p = rows[0].payload;
      const start = Number(p.startYear) || DEFAULT_PLANNING_YEARS.startYear;
      const end = Number(p.endYear) || DEFAULT_PLANNING_YEARS.endYear;
      if (end >= start) {
        const years = [];
        for (let y = start; y <= end; y++) years.push(y);
        return { startYear: start, endYear: end, years };
      }
    }
  } catch (_e) { /* fallback */ }
  const years = [];
  for (let y = DEFAULT_PLANNING_YEARS.startYear; y <= DEFAULT_PLANNING_YEARS.endYear; y++) years.push(y);
  return { ...DEFAULT_PLANNING_YEARS, years };
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
  await ensureSkillCategoriesSchema();
  await syncAppRolesAndPositionsCatalog();

  await ensureEntriesSchema();
  await purgeLegacyEntryTypes();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('skill', 'portfolio', 'organisation')),
      unit TEXT NOT NULL,
      workstream TEXT,
      payload JSONB NOT NULL,
      created_by_email TEXT NOT NULL,
      updated_by_email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await ensureEntriesTypeConstraint();
  await ensureDemoSchema();
  await ensureGuidelinesSchema(pool);
  await seedGuidelinesIfEmpty(pool);
  await ensurePresenceSchema(pool);
  await ensureAppConfigSchema();
  await backfillSkillEntryPositionIds();
  await backfillSkillEntryCategoryIds();

  const { rows } = await pool.query("SELECT COUNT(*)::int as count FROM users");
  if (rows[0].count > 0) return;

  for (const user of seedUsers) {
    const roles = normalizeUserRoles(user.roles || [user.role]);
    await pool.query(
      `INSERT INTO users (email, name, password_hash, role, roles, units, standort)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user.email,
        user.name,
        bcrypt.hashSync("ChangeMe123!", 10),
        primaryRoleFromRoles(roles),
        roles,
        user.units || [],
        user.standort || null,
      ]
    );
  }
}

app.use(express.json());
app.use(cookieParser());
app.use("/vendor/xlsx", express.static(path.join(__dirname, "node_modules/xlsx/dist")));

function isBackcastingPageRequest(req) {
  const p = String(req.path || "").replace(/\/+$/, "") || "/";
  return p === "/backcasting" || p === "/backcasting/index.html";
}

function isBackcastingPublicAsset(req) {
  const p = String(req.path || "");
  if (p === "/backcasting/forbidden.html" || p === "/backcasting/shell.js") return true;
  if (p === "/backcasting/styles.css") return true;
  if (p.startsWith("/backcasting/js/")) return true;
  return false;
}

async function backcastingPageGuard(req, res, next) {
  if (!String(req.path || "").startsWith("/backcasting")) return next();
  if (isBackcastingPublicAsset(req)) return next();
  if (!isBackcastingPageRequest(req)) return next();
  if (!isBackcastingModuleEnabled()) {
    return res.status(404).type("text/plain").send("Not found");
  }
  const token = req.cookies[TOKEN_COOKIE];
  if (!token) {
    const ret = encodeURIComponent(req.originalUrl || "/backcasting/");
    return res.redirect(`/?module=backcasting&return=${ret}`);
  }
  try {
    const jwtUser = jwt.verify(token, JWT_SECRET);
    const result = await pool.query("SELECT role, roles FROM users WHERE id = $1", [jwtUser.sub]);
    const user = result.rows[0];
    if (!user || !canAccessBackcasting(user)) {
      return res.redirect("/backcasting/forbidden.html");
    }
    return next();
  } catch (_error) {
    const ret = encodeURIComponent(req.originalUrl || "/backcasting/");
    return res.redirect(`/?module=backcasting&return=${ret}`);
  }
}

app.use(backcastingPageGuard);
app.use(express.static(path.join(__dirname, "public")));

function signToken(user, unit) {
  const roles = getUserRoles(user);
  const role = primaryRoleFromRoles(roles) || user.role;
  const units = normalizeUnits(user.units);
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role,
      roles,
      unit,
      units,
      skillEntryId: user.skill_entry_id || null,
    },
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
  if (!isAdminRole(req.user)) {
    return res.status(403).json({ error: "Nur Admin erlaubt." });
  }
  return next();
}

function requireSuperAdmin(req, res, next) {
  if (!isSuperAdminRole(req.user)) {
    return res.status(403).json({ error: "Nur Super Admin erlaubt." });
  }
  return next();
}

function canAccessUnit(req, entryUnit) {
  if (isPureMitarbeiterRole(req.user)) {
    return req.user.unit === entryUnit;
  }
  if (isAdminRole(req.user)) return true;
  if (req.user.unit === entryUnit) return true;
  const jwtUnits = normalizeUnits(req.user.units);
  if (jwtUnits.includes(entryUnit)) return true;
  return false;
}

async function getUserSkillEntryId(req) {
  if (req.user.skillEntryId) return req.user.skillEntryId;
  const result = await pool.query("SELECT skill_entry_id FROM users WHERE id = $1", [req.user.sub]);
  return result.rows[0]?.skill_entry_id || null;
}

async function canAccessEntry(req, entry) {
  if (!entry) return false;
  if (isAdminRole(req.user)) return true;
  if (isPureMitarbeiterRole(req.user)) {
    if (entry.type !== "skill") return false;
    const skillEntryId = await getUserSkillEntryId(req);
    return skillEntryId && entry.id === skillEntryId && req.user.unit === entry.unit;
  }
  return req.user.unit === entry.unit;
}

function restrictSkillEntryForMitarbeiter(existingPayload, incomingEntry) {
  return {
    ...existingPayload,
    ...incomingEntry,
    id: existingPayload.id,
    type: "skill",
    unit: existingPayload.unit,
    nachname: existingPayload.nachname,
    vorname: existingPayload.vorname,
    name: existingPayload.name,
    rolle: existingPayload.rolle,
    position_id: existingPayload.position_id ?? existingPayload.positionId ?? null,
    org_role_ids: existingPayload.org_role_ids ?? existingPayload.orgRoleIds ?? [],
    org_roles: existingPayload.org_roles ?? [],
    position_ids: existingPayload.position_ids ?? existingPayload.positionIds ?? [],
    positions: existingPayload.positions ?? [],
    mitarbeiterId: existingPayload.mitarbeiterId,
    personalnummer: existingPayload.personalnummer,
    email: existingPayload.email,
    skills: incomingEntry.skills ?? existingPayload.skills ?? [],
    softSkills: incomingEntry.softSkills ?? existingPayload.softSkills ?? [],
  };
}

async function resolveLoginUnitForUser(user) {
  const userUnits = normalizeUnits(user.units);
  if (isUnitScopedRole(user)) {
    if (!userUnits.length) return "";
    const validated = await validateUnitsAgainstMaster(userUnits);
    const units = validated.units || userUnits;
    return units.sort((a, b) => a.localeCompare(b, "de"))[0] || "";
  }
  if (isAdminRole(user) || isOrgHierarchyRole(user)) {
    const master = await getMasterUnitNames();
    return master[0] || "";
  }
  return "";
}

app.get("/api/auth/units", async (_req, res) => {
  const units = await getMasterUnitNames();
  return res.json({ units });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "E-Mail und Passwort sind erforderlich." });
  }

  const result = await pool.query(
    "SELECT id, email, name, role, roles, password_hash, units, skill_entry_id, personalnummer, login_blocked FROM users WHERE email = $1",
    [String(email).trim().toLowerCase()]
  );
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "E-Mail-Adresse nicht bekannt." });
  if (user.login_blocked) {
    return res.status(403).json({ error: "Login fuer diesen Benutzer ist gesperrt." });
  }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Falsches Passwort." });
  }

  if (isMitarbeiterRole(user)) {
    user.skill_entry_id = await ensureMitarbeiterSkillProfile(user);
  }

  const selectedUnit = await resolveLoginUnitForUser(user);
  const userUnits = normalizeUnits(user.units);
  if (isUnitScopedRole(user) && selectedUnit && !userUnits.includes(selectedUnit)) {
    return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
  }

  const token = signToken(user, selectedUnit);
  const roles = getUserRoles(user);
  res.cookie(TOKEN_COOKIE, token, cookieOptions());
  return res.json({
    email: user.email,
    name: user.name,
    role: primaryRoleFromRoles(roles) || user.role,
    roles,
    unit: selectedUnit,
    skillEntryId: user.skill_entry_id || null,
    personalnummer: user.personalnummer ? String(user.personalnummer) : "",
    modules: buildUserModules(user),
  });
});

app.post("/api/auth/logout", (req, res) => {
  const token = req.cookies[TOKEN_COOKIE];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      void removePresence(pool, decoded.sub);
    } catch (_error) {
      /* ignore invalid token */
    }
  }
  res.clearCookie(TOKEN_COOKIE, { ...cookieOptions(), maxAge: 0 });
  return res.json({ ok: true });
});

app.post("/api/presence/heartbeat", auth, async (req, res) => {
  try {
    await upsertHeartbeat(pool, req.user, req.body || {});
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Heartbeat fehlgeschlagen." });
  }
});

app.get("/api/admin/presence", auth, requireAdmin, async (_req, res) => {
  try {
    const users = await listOnlineUsers(pool);
    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Presence konnte nicht geladen werden." });
  }
});

app.get("/api/admin/deploy-info", auth, requireAdmin, async (_req, res) => {
  return res.json(await getDeployInfo());
});

app.get("/api/config/planning-years", auth, async (_req, res) => {
  try {
    return res.json(await getPlanningYears());
  } catch (error) {
    return res.status(500).json({ error: "Planungszeitraum konnte nicht geladen werden." });
  }
});

app.put("/api/admin/config/planning-years", auth, requireAdmin, async (req, res) => {
  const { startYear, endYear } = req.body || {};
  const s = Number(startYear);
  const e = Number(endYear);
  if (!Number.isInteger(s) || !Number.isInteger(e)) {
    return res.status(400).json({ error: "Start- und Endjahr muessen ganze Zahlen sein." });
  }
  if (s < 2025 || s > 2035) {
    return res.status(400).json({ error: "Startjahr muss zwischen 2025 und 2035 liegen." });
  }
  if (e < s + 1 || e > 2040) {
    return res.status(400).json({ error: "Endjahr muss mindestens 1 Jahr nach dem Startjahr liegen (max. 2040)." });
  }
  try {
    await pool.query(
      `INSERT INTO app_config (id, payload, updated_at)
       VALUES ('planning_years', $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET payload = $1::jsonb, updated_at = NOW()`,
      [JSON.stringify({ startYear: s, endYear: e })]
    );
    return res.json(await getPlanningYears());
  } catch (error) {
    return res.status(500).json({ error: "Planungszeitraum konnte nicht gespeichert werden." });
  }
});

app.get("/api/auth/me", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT id, email, name, role, roles, skill_entry_id, units, personalnummer FROM users WHERE id = $1",
    [req.user.sub]
  );
  let user = result.rows[0];
  if (!user) return res.status(401).json({ error: "Benutzer nicht gefunden." });
  if (isMitarbeiterRole(user)) {
    const skillEntryId = await ensureMitarbeiterSkillProfile(user);
    user = { ...user, skill_entry_id: skillEntryId };
  }
  const roles = getUserRoles(user);
  const dbUnits = normalizeUnits(user.units);
  const unit = isSuperAdminRole(user)
    ? String(req.user.unit || "").trim()
    : resolveSessionUnitFromDb(req.user.unit, dbUnits);
  return res.json({
    ...user,
    roles,
    role: primaryRoleFromRoles(roles) || user.role,
    unit,
    units: dbUnits,
    skillEntryId: user.skill_entry_id || null,
    personalnummer: user.personalnummer ? String(user.personalnummer) : "",
    modules: buildUserModules(user),
  });
});

app.get("/api/auth/unit-context", auth, async (req, res) => {
  const userResult = await pool.query("SELECT role, roles, units FROM users WHERE id = $1", [
    req.user.sub,
  ]);
  const user = userResult.rows[0];
  const dbUnits = normalizeUnits(user?.units);
  let unit = isSuperAdminRole(req.user)
    ? String(req.user.unit || "").trim()
    : resolveSessionUnitFromDb(req.user.unit, dbUnits);
  if (!unit && isMitarbeiterRole(req.user)) {
    unit = dbUnits[0] || "";
  }
  if (isAdminRole(req.user)) {
    const requested = String(req.query.unit || "").trim();
    if (requested && requested !== "all") {
      unit = requested;
      const unitRow = await pool.query("SELECT name FROM units WHERE name = $1", [requested]);
      if (unitRow.rows.length) {
        unit = unitRow.rows[0].name;
      }
    }
  }
  if (!unit) {
    return res.json({ unit: null, unitLead: null, deputyLead: null, unitLeads: [] });
  }

  const unitRow = await pool.query(
    `SELECT u.unit_lead_id, u.deputy_lead_id,
            ul.name AS unit_lead_name, ul.email AS unit_lead_email,
            dl.name AS deputy_name, dl.email AS deputy_email
     FROM units u
     LEFT JOIN users ul ON ul.id = u.unit_lead_id
     LEFT JOIN users dl ON dl.id = u.deputy_lead_id
     WHERE u.name = $1`,
    [unit]
  );
  const row = unitRow.rows[0];
  let unitLead = row
    ? mapUnitLeadPerson(row, "unit_lead_id", "unit_lead_name", "unit_lead_email")
    : null;
  let deputyLead = row
    ? mapUnitLeadPerson(row, "deputy_lead_id", "deputy_name", "deputy_email")
    : null;

  if (!unitLead) {
    const fallback = await pool.query(
      `SELECT name, email FROM users
       WHERE (role = 'unit_lead' OR 'unit_lead' = ANY(roles))
         AND $1 = ANY(units)
       ORDER BY name
       LIMIT 1`,
      [unit]
    );
    if (fallback.rows[0]) {
      unitLead = { name: fallback.rows[0].name, email: fallback.rows[0].email };
    }
  }

  const unitLeads = [];
  if (unitLead) unitLeads.push({ ...unitLead, role: "Unit Leiter" });
  if (deputyLead) unitLeads.push({ ...deputyLead, role: "Stellvertreter" });

  return res.json({
    unit,
    unitLead,
    deputyLead,
    unitLeads,
  });
});

app.get("/api/entries", auth, async (req, res) => {
  let result;
  if (isPureMitarbeiterRole(req.user)) {
    const skillEntryId = await getUserSkillEntryId(req);
    if (!skillEntryId) {
      return res.json([]);
    }
    result = await pool.query(
      "SELECT * FROM entries WHERE id = $1 AND type = 'skill' AND unit = $2",
      [skillEntryId, req.user.unit]
    );
  } else if (isAdminRole(req.user)) {
    result = await pool.query(
      "SELECT * FROM entries WHERE type = ANY($1::text[]) ORDER BY updated_at DESC",
      [ENTRY_TYPES]
    );
  } else {
    result = await pool.query(
      "SELECT * FROM entries WHERE unit = $1 AND type = ANY($2::text[]) ORDER BY updated_at DESC",
      [req.user.unit, ENTRY_TYPES]
    );
  }
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
  const withPersonalnummer = await attachPersonalnummerToSkillEntries(parsed);
  const enriched = await enrichSkillEntries(withPersonalnummer);
  return res.json(enriched);
});

app.get("/api/skill-personalnummer-lookup", auth, async (req, res) => {
  if (isPureMitarbeiterRole(req.user)) {
    return res.status(403).json({ error: "Kein Zugriff." });
  }
  const result = await pool.query(
    `SELECT skill_entry_id, LOWER(TRIM(email)) AS email, name, personalnummer, units
     FROM users
     WHERE personalnummer IS NOT NULL AND TRIM(personalnummer) <> ''`
  );
  let rows = result.rows;
  if (!isAdminRole(req.user)) {
    const unit = String(req.user.unit || "").trim();
    rows = rows.filter((r) => normalizeUnits(r.units).includes(unit));
  }
  return res.json(
    rows.map((r) => ({
      skillEntryId: r.skill_entry_id ? String(r.skill_entry_id) : "",
      email: r.email ? String(r.email) : "",
      name: r.name ? String(r.name) : "",
      personalnummer: String(r.personalnummer).trim(),
    }))
  );
});

function skillEntryNameKeys(entry) {
  const keys = [];
  const full = String(entry.name || "").trim().toLowerCase();
  if (full) keys.push(full);
  const nach = String(entry.nachname || "").trim();
  const vor = String(entry.vorname || "").trim();
  if (nach && vor) {
    keys.push(`${nach}, ${vor}`.toLowerCase());
    keys.push(`${vor} ${nach}`.toLowerCase());
  }
  return keys;
}

async function attachPersonalnummerToSkillEntries(entries) {
  const skillEntries = entries.filter((e) => e.type === "skill");
  if (!skillEntries.length) return entries;

  const skillIds = skillEntries.map((e) => e.id);
  const emails = [
    ...new Set(
      skillEntries.map((e) => String(e.email || "").trim().toLowerCase()).filter(Boolean)
    ),
  ];

  const userRows = [];
  if (skillIds.length) {
    const bySkill = await pool.query(
      `SELECT skill_entry_id, LOWER(TRIM(email)) AS email, name, personalnummer
       FROM users WHERE skill_entry_id = ANY($1::text[])`,
      [skillIds]
    );
    userRows.push(...bySkill.rows);
  }
  if (emails.length) {
    const byEmail = await pool.query(
      `SELECT skill_entry_id, LOWER(TRIM(email)) AS email, name, personalnummer
       FROM users
       WHERE LOWER(TRIM(email)) = ANY($1::text[])
         AND personalnummer IS NOT NULL AND TRIM(personalnummer) <> ''`,
      [emails]
    );
    userRows.push(...byEmail.rows);
  }

  const byEntryId = new Map();
  const byEmail = new Map();
  const byName = new Map();
  for (const r of userRows) {
    const pn = r.personalnummer ? String(r.personalnummer).trim() : "";
    if (!pn) continue;
    if (r.skill_entry_id) byEntryId.set(r.skill_entry_id, pn);
    if (r.email) byEmail.set(r.email, pn);
    if (r.name) byName.set(String(r.name).trim().toLowerCase(), pn);
  }

  return entries.map((e) => {
    if (e.type !== "skill") return e;
    const fromPayload = String(e.personalnummer || e.mitarbeiterId || "").trim();
    if (fromPayload) return { ...e, personalnummer: fromPayload };

    let fromUser = byEntryId.get(e.id) || "";
    if (!fromUser && e.email) {
      fromUser = byEmail.get(String(e.email).trim().toLowerCase()) || "";
    }
    if (!fromUser) {
      for (const key of skillEntryNameKeys(e)) {
        if (byName.has(key)) {
          fromUser = byName.get(key);
          break;
        }
      }
    }
    if (!fromUser) return e;
    return { ...e, personalnummer: fromUser };
  });
}

async function resolvePersonalnummerFromUser(entryId, entry) {
  const fromEntry = String(entry?.personalnummer || entry?.mitarbeiterId || "").trim();
  if (fromEntry) return fromEntry;
  const enriched = await attachPersonalnummerToSkillEntries([
    { ...entry, id: entryId, type: "skill" },
  ]);
  return enriched[0]?.personalnummer ? String(enriched[0].personalnummer).trim() : "";
}

async function normalizeEntryForSave(type, entry, reqUser) {
  if (!entry || typeof entry !== "object") {
    return { error: "Eintrag fehlt." };
  }
  const unit = String(entry.unit || reqUser.unit || "").trim();
  if (!unit) {
    return { error: "Unit fehlt. Bitte erneut anmelden." };
  }
  const workstream = String(entry.workstream || "").trim();
  if (type !== "skill" && type !== "portfolio" && type !== "organisation" && !workstream) {
    return { error: "Workstream fehlt." };
  }
  const ws =
    type === "portfolio" || type === "organisation" ? "" : workstream;
  let normalizedEntry = { ...entry, unit, workstream: ws, type };
  if (type === "skill") {
    normalizedEntry = await normalizeSkillEntryPayload(normalizedEntry);
  }
  return {
    entry: normalizedEntry,
    unit,
    workstream,
  };
}

app.post("/api/entries", auth, async (req, res) => {
  const { type, entry } = req.body || {};
  if (isPureMitarbeiterRole(req.user)) {
    return res.status(403).json({ error: "Mitarbeiter duerfen keine neuen Eintraege anlegen." });
  }
  if (!ENTRY_TYPES.includes(type)) {
    return res.status(400).json({ error: "Ungueltiger Typ." });
  }
  const normalized = await normalizeEntryForSave(type, entry, req.user);
  if (normalized.error) {
    return res.status(400).json({ error: normalized.error });
  }
  const { entry: safeEntry, unit, workstream } = normalized;
  if (!canAccessUnit(req, unit)) {
    return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
  }

  const id = safeEntry.id || crypto.randomUUID();
  const now = new Date().toISOString();
  try {
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
  } catch (error) {
    if (error.code === "23514" && String(error.message || "").includes("entries_type_check")) {
      await ensureEntriesTypeConstraint();
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
    } else {
      throw error;
    }
  }
  if (type === "skill") {
    await syncSkillEmployeeUser(id, safeEntry, unit);
    const pn = await resolvePersonalnummerFromUser(id, safeEntry);
    if (pn) {
      const payload = { ...safeEntry, id, type, unit, personalnummer: pn };
      await pool.query(
        `UPDATE entries SET payload = $1::jsonb, updated_at = $2 WHERE id = $3`,
        [JSON.stringify(payload), now, id]
      );
    }
  }
  return res.status(201).json({ id });
});

app.put("/api/entries/:id", auth, async (req, res) => {
  const { id } = req.params;
  const existingResult = await pool.query("SELECT id, unit, type, payload FROM entries WHERE id = $1", [id]);
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: "Eintrag nicht gefunden." });
  if (LEGACY_ENTRY_TYPES.includes(existing.type)) {
    return res.status(404).json({ error: "Eintrag nicht gefunden." });
  }
  if (!(await canAccessEntry(req, existing))) {
    return res.status(403).json({ error: "Kein Zugriff auf diesen Eintrag." });
  }
  const { entry } = req.body || {};
  const normalized = await normalizeEntryForSave(existing.type, entry, req.user);
  if (normalized.error) {
    return res.status(400).json({ error: normalized.error });
  }
  let { entry: safeEntry, workstream } = normalized;
  if (isPureMitarbeiterRole(req.user)) {
    safeEntry = restrictSkillEntryForMitarbeiter(existing.payload || {}, safeEntry);
    workstream = safeEntry.workstream || workstream || "";
  }

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
    const pn = await resolvePersonalnummerFromUser(id, safeEntry);
    if (pn) {
      const now = new Date().toISOString();
      const payload = {
        ...safeEntry,
        id,
        type: existing.type,
        unit: existing.unit,
        personalnummer: pn,
      };
      await pool.query(
        `UPDATE entries SET payload = $1::jsonb, updated_at = $2 WHERE id = $3`,
        [JSON.stringify(payload), now, id]
      );
    }
  }

  return res.json({ ok: true });
});

app.delete("/api/entries/:id", auth, async (req, res) => {
  const { id } = req.params;
  const existingResult = await pool.query("SELECT id, unit, type FROM entries WHERE id = $1", [id]);
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: "Eintrag nicht gefunden." });
  if (LEGACY_ENTRY_TYPES.includes(existing.type)) {
    return res.status(404).json({ error: "Eintrag nicht gefunden." });
  }
  if (isPureMitarbeiterRole(req.user)) {
    return res.status(403).json({ error: "Mitarbeiter duerfen keine Eintraege loeschen." });
  }
  if (!(await canAccessEntry(req, existing))) {
    return res.status(403).json({ error: "Kein Zugriff auf diesen Eintrag." });
  }
  if (existing.type === "skill") {
    await deleteSkillEmployeeUser(id);
  }
  await pool.query("DELETE FROM entries WHERE id = $1", [id]);
  return res.json({ ok: true });
});

app.get("/api/dashboard/snapshot", auth, async (req, res) => {
  if (!canAccessFortschritt(req.user)) {
    return res.status(403).json({ error: "Kein Zugriff auf Phase 3 · Fortschritt." });
  }
  const resolved = resolveDashboardUnit(req, req.query.unit);
  if (resolved.error) return res.status(403).json({ error: resolved.error });
  const unit = resolved.unit;
  if (!unit) return res.status(400).json({ error: "Unit fehlt." });
  if (!(await canAccessUnit(req, unit))) {
    return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
  }
  const yearParam = req.query.year;
  const entries = await fetchEntriesForUnit(unit);
  const planRow = await fetchBackcastingPlanForUnit(unit);
  const planPayload = planRow || { measures: {}, meta: {} };

  if (yearParam === "all") {
    const planningConfig = await getPlanningYears();
    const snapshot = buildDashboardSnapshotAllYears(entries, planPayload, planningConfig.years);
    const demoEntries = entries.filter((e) => e.is_demo).length;
    const demoPlan = Boolean(planRow?.is_demo);
    return res.json({
      unit,
      demo: { entries: demoEntries, plan: demoPlan, active: demoEntries > 0 || demoPlan },
      ...snapshot,
    });
  }

  const year = parseInt(yearParam, 10) || new Date().getFullYear();
  const snapshot = buildDashboardSnapshot(entries, planPayload, year);
  const demoEntries = entries.filter((e) => e.is_demo).length;
  const demoPlan = Boolean(planRow?.is_demo);
  return res.json({
    unit,
    demo: { entries: demoEntries, plan: demoPlan, active: demoEntries > 0 || demoPlan },
    ...snapshot,
  });
});

app.get("/api/dashboard/p1-snapshot", auth, async (req, res) => {
  if (!canAccessFortschritt(req.user)) {
    return res.status(403).json({ error: "Kein Zugriff auf Phase 3 \u00b7 Fortschritt." });
  }
  const resolved = resolveDashboardUnit(req, req.query.unit);
  if (resolved.error) return res.status(403).json({ error: resolved.error });
  const unit = resolved.unit;
  if (!unit) return res.status(400).json({ error: "Unit fehlt." });
  if (!(await canAccessUnit(req, unit))) {
    return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
  }
  const yearParam = req.query.year;
  const entries = await fetchEntriesForUnit(unit);
  const planRow = await fetchBackcastingPlanForUnit(unit);
  const planPayload = planRow || { measures: {}, meta: {} };

  if (yearParam === "all") {
    const planningConfig = await getPlanningYears();
    const snapshot = buildP1DashboardSnapshotAllYears(entries, planPayload, planningConfig.years);
    return res.json({ unit, ...snapshot });
  }

  const year = parseInt(yearParam, 10) || new Date().getFullYear();
  const snapshot = buildP1DashboardSnapshot(entries, planPayload, year);
  return res.json({ unit, ...snapshot });
});

app.get("/api/dashboard/p1-timeline", auth, async (req, res) => {
  if (!canAccessFortschritt(req.user)) {
    return res.status(403).json({ error: "Kein Zugriff auf Phase 3 \u00b7 Fortschritt." });
  }
  const planningConfig = await getPlanningYears();
  const years = planningConfig.years;

  if (req.query.all === "true") {
    if (!isAdminRole(req.user)) {
      return res.status(403).json({ error: "Zeitstrahl f\u00fcr alle Units nur f\u00fcr Admins." });
    }
    const units = [];
    for (const demoUnit of DEMO_UNITS) {
      if (!(await canAccessUnit(req, demoUnit))) continue;
      const entries = await fetchEntriesForUnit(demoUnit);
      const planRow = await fetchBackcastingPlanForUnit(demoUnit);
      const timeline = buildP1DashboardTimeline(entries, planRow || { measures: {}, meta: {} }, years);
      units.push({ unit: demoUnit, ...timeline });
    }
    return res.json({ all: true, years, units, totalUnits: DEMO_UNITS.length });
  }

  const resolved = resolveDashboardUnit(req, req.query.unit);
  if (resolved.error) return res.status(403).json({ error: resolved.error });
  const unit = resolved.unit;
  if (!unit) return res.status(400).json({ error: "Unit fehlt oder all=true verwenden." });
  if (!(await canAccessUnit(req, unit))) {
    return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
  }
  const entries = await fetchEntriesForUnit(unit);
  const planRow = await fetchBackcastingPlanForUnit(unit);
  const timeline = buildP1DashboardTimeline(entries, planRow || { measures: {}, meta: {} }, years);
  return res.json({ unit, ...timeline });
});

app.get("/api/dashboard/timeline", auth, async (req, res) => {
  if (!canAccessFortschritt(req.user)) {
    return res.status(403).json({ error: "Kein Zugriff auf Phase 3 · Fortschritt." });
  }

  const planningConfig = await getPlanningYears();
  const years = planningConfig.years;

  if (req.query.all === "true") {
    if (!isAdminRole(req.user)) {
      return res.status(403).json({ error: "Zeitstrahl für alle Units nur für Admins." });
    }
    const units = [];
    for (const demoUnit of DEMO_UNITS) {
      if (!(await canAccessUnit(req, demoUnit))) continue;
      const entries = await fetchEntriesForUnit(demoUnit);
      const planRow = await fetchBackcastingPlanForUnit(demoUnit);
      const timeline = buildDashboardTimeline(entries, planRow || { measures: {}, meta: {} }, years);
      units.push({ unit: demoUnit, ...timeline });
    }
    return res.json({
      all: true,
      years,
      units,
      totalUnits: DEMO_UNITS.length,
    });
  }

  const resolved = resolveDashboardUnit(req, req.query.unit);
  if (resolved.error) return res.status(403).json({ error: resolved.error });
  const unit = resolved.unit;
  if (!unit) return res.status(400).json({ error: "Unit fehlt oder all=true verwenden." });
  if (!(await canAccessUnit(req, unit))) {
    return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
  }
  const entries = await fetchEntriesForUnit(unit);
  const planRow = await fetchBackcastingPlanForUnit(unit);
  const timeline = buildDashboardTimeline(entries, planRow || { measures: {}, meta: {} }, years);
  return res.json({
    unit,
    ...timeline,
  });
});

async function fetchDemoEntriesForUnit(unit) {
  const result = await pool.query(
    `SELECT id, type, unit, payload, is_demo
     FROM entries
     WHERE unit = $1 AND is_demo = true`,
    [unit]
  );
  return result.rows.map((row) => ({
    ...(row.payload || {}),
    id: row.id,
    type: row.type,
    unit: row.unit,
    is_demo: row.is_demo,
  }));
}

async function fetchDemoPlanPayloadForUnit(unit) {
  const result = await pool.query(
    `SELECT payload
     FROM backcasting_plans
     WHERE unit = $1 AND is_demo = true
     ORDER BY updated_at DESC
     LIMIT 1`,
    [unit]
  );
  return result.rows[0]?.payload || null;
}

function emptyDemoPhaseExtras() {
  return {
    milestoneCount: 0,
    milestoneYears: [],
    phase3Year: DEMO_REFERENCE_YEAR,
    phase3KpiCount: 0,
    phase3SkillGapCount: 0,
    phase3MilestoneCount: 0,
    phase3Evaluations: 0,
  };
}

async function enrichDemoStatusWithPhaseSummary(status) {
  if (!status.active) {
    return { ...status, ...emptyDemoPhaseExtras() };
  }
  const planPayload = await fetchDemoPlanPayloadForUnit(status.unit);
  const storedSummary = planPayload?.meta?.demoSummary;
  if (storedSummary && typeof storedSummary === "object") {
    return {
      ...status,
      ...storedSummary,
      unit: status.unit,
      active: status.active,
      backcastingDemoPlan: storedSummary.backcastingDemoPlan ?? status.backcastingDemoPlan,
      planCount: storedSummary.planCount ?? status.planCount,
    };
  }
  const entries = await fetchDemoEntriesForUnit(status.unit);
  if (!entries.length && !planPayload) {
    return { ...status, ...emptyDemoPhaseExtras() };
  }
  const summary = buildDemoStatusSummary(entries, planPayload || { measures: {}, meta: {} });
  return {
    ...status,
    phase1DemoEntries: summary.phase1DemoEntries,
    portfolioEntries: summary.portfolioEntries,
    organisationEntries: summary.organisationEntries,
    skillEntries: summary.skillEntries,
    planCount: summary.planCount,
    backcastingDemoPlan: summary.backcastingDemoPlan,
    milestoneCount: summary.milestoneCount,
    milestoneYears: summary.milestoneYears,
    phase3Year: summary.phase3Year,
    phase3KpiCount: summary.phase3KpiCount,
    phase3SkillGapCount: summary.phase3SkillGapCount,
    phase3MilestoneCount: summary.phase3MilestoneCount,
    phase3Evaluations: summary.phase3Evaluations,
  };
}

async function fetchDemoStatusForUnit(unit) {
  const typeCounts = await pool.query(
    `SELECT type, COUNT(*)::int AS count
     FROM entries
     WHERE unit = $1 AND is_demo = true
     GROUP BY type`,
    [unit]
  );
  const counts = { portfolio: 0, organisation: 0, skill: 0 };
  typeCounts.rows.forEach((row) => {
    if (counts[row.type] != null) counts[row.type] = row.count;
  });
  const planResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM backcasting_plans WHERE unit = $1 AND is_demo = true`,
    [unit]
  );
  const planCount = planResult.rows[0]?.count || 0;
  const phase1DemoEntries = counts.portfolio + counts.organisation + counts.skill;
  const base = {
    unit,
    phase1DemoEntries,
    portfolioEntries: counts.portfolio,
    organisationEntries: counts.organisation,
    skillEntries: counts.skill,
    backcastingDemoPlan: planCount > 0,
    planCount,
    active: phase1DemoEntries > 0 || planCount > 0,
  };
  return enrichDemoStatusWithPhaseSummary(base);
}

app.get("/api/demo/status", auth, async (req, res) => {
  if (!canAccessFortschritt(req.user) && !canAccessBackcasting(req.user) && !isAdminRole(req.user)) {
    return res.status(403).json({ error: "Kein Zugriff." });
  }

  if (req.query.all === "true") {
    if (!isAdminRole(req.user)) {
      return res.status(403).json({ error: "Status für alle Units nur für Admins." });
    }
    const units = [];
    for (const demoUnit of DEMO_UNITS) {
      units.push(await fetchDemoStatusForUnit(demoUnit));
    }
    const activeCount = units.filter((row) => row.active).length;
    const totals = {
      phase1DemoEntries: units.reduce((sum, row) => sum + row.phase1DemoEntries, 0),
      portfolioEntries: units.reduce((sum, row) => sum + row.portfolioEntries, 0),
      organisationEntries: units.reduce((sum, row) => sum + row.organisationEntries, 0),
      skillEntries: units.reduce((sum, row) => sum + row.skillEntries, 0),
      planCount: units.reduce((sum, row) => sum + row.planCount, 0),
      milestoneCount: units.reduce((sum, row) => sum + (row.milestoneCount || 0), 0),
      phase3Evaluations: units.reduce((sum, row) => sum + (row.phase3Evaluations || 0), 0),
      phase3KpiCount: units.reduce((sum, row) => sum + (row.phase3KpiCount || 0), 0),
      phase3SkillGapCount: units.reduce((sum, row) => sum + (row.phase3SkillGapCount || 0), 0),
    };
    return res.json({
      all: true,
      units,
      totals,
      activeCount,
      totalUnits: DEMO_UNITS.length,
      demoUnits: DEMO_UNITS,
      active: activeCount > 0,
    });
  }

  const requestedUnit = String(req.query.unit || "").trim();
  if (!requestedUnit) {
    return res.status(400).json({ error: "Unit fehlt oder all=true verwenden." });
  }
  const resolved = resolveDashboardUnit(req, requestedUnit);
  if (resolved.error) return res.status(403).json({ error: resolved.error });
  const unit = resolved.unit;
  if (!unit) return res.status(400).json({ error: "Unit fehlt." });
  if (!(await canAccessUnit(req, unit))) {
    return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
  }
  return res.json({
    ...(await fetchDemoStatusForUnit(unit)),
    demoUnits: DEMO_UNITS,
  });
});

async function loadDemoDataForUnit(unit, email) {
  await removeDemoDataForUnit(unit);
  const planningCfg = await getPlanningYears();
  const { entries, plan, summary } = buildDemoDataForUnit(unit, {
    milestoneYears: planningCfg.years,
    referenceYear: planningCfg.startYear,
  });
  await insertDemoEntries(entries, email);
  await upsertBackcastingPlan(
    unit,
    { meta: { ...plan.meta, demoSummary: summary }, measures: plan.measures },
    email,
    true
  );
  return {
    unit,
    entryCount: summary.phase1DemoEntries,
    ...summary,
  };
}

app.get("/api/demo/units", auth, async (req, res) => {
  if (isPureMitarbeiterRole(req.user)) {
    return res.status(403).json({ error: "Kein Zugriff." });
  }
  return res.json({ units: DEMO_UNITS, defaultUnit: DEMO_UNIT });
});

app.post("/api/demo/load", auth, async (req, res) => {
  if (isPureMitarbeiterRole(req.user)) {
    return res.status(403).json({ error: "Kein Zugriff." });
  }
  if (
    !isAdminRole(req.user) &&
    !canAccessBackcasting(req.user) &&
    !canAccessFortschritt(req.user)
  ) {
    return res.status(403).json({ error: "Kein Zugriff auf Demo-Daten." });
  }

  const loadAll = Boolean(req.body?.allUnits);
  if (loadAll) {
    if (!isAdminRole(req.user)) {
      return res.status(403).json({ error: "Demo für alle Units nur für Admins." });
    }
    const loaded = [];
    for (const unit of DEMO_UNITS) {
      loaded.push(await loadDemoDataForUnit(unit, req.user.email));
    }
    const totalEntries = loaded.reduce((sum, row) => sum + (row.phase1DemoEntries || 0), 0);
    const totalMilestones = loaded.reduce((sum, row) => sum + (row.milestoneCount || 0), 0);
    const totalPhase3 = loaded.reduce((sum, row) => sum + (row.phase3Evaluations || 0), 0);
    return res.json({
      ok: true,
      units: loaded,
      message: `Demo-Daten für ${loaded.length} Units geladen (${totalEntries} Phase-1-Einträge, ${totalMilestones} Meilensteine, ${totalPhase3} Phase-3-Auswertungen).`,
    });
  }

  const requestedUnit = req.body?.unit || DEMO_UNIT;
  const resolved = resolveDashboardUnit(req, requestedUnit);
  if (resolved.error) return res.status(403).json({ error: resolved.error });
  const unit = resolved.unit || DEMO_UNIT;
  if (!(await canAccessUnit(req, unit))) {
    return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
  }

  const result = await loadDemoDataForUnit(unit, req.user.email);
  return res.json({
    ok: true,
    unit: result.unit,
    phase1DemoEntries: result.phase1DemoEntries,
    portfolioEntries: result.portfolioEntries,
    organisationEntries: result.organisationEntries,
    skillEntries: result.skillEntries,
    backcastingDemoPlan: result.backcastingDemoPlan,
    planCount: result.planCount,
    milestoneCount: result.milestoneCount,
    milestoneYears: result.milestoneYears,
    phase3Year: result.phase3Year,
    phase3KpiCount: result.phase3KpiCount,
    phase3SkillGapCount: result.phase3SkillGapCount,
    phase3MilestoneCount: result.phase3MilestoneCount,
    phase3Evaluations: result.phase3Evaluations,
    message: `Demo-Daten für ${unit} geladen (Phase 1: ${result.phase1DemoEntries} Einträge, Phase 2: ${result.milestoneCount} Meilensteine, Phase 3: ${result.phase3Evaluations} Auswertungen).`,
  });
});

function isDemoRemoveAllUnitsFlag(value) {
  return value === true || value === "true" || value === "1" || value === 1;
}

async function handleDemoRemove(req, res) {
  if (isPureMitarbeiterRole(req.user)) {
    return res.status(403).json({ error: "Kein Zugriff." });
  }
  if (
    !isAdminRole(req.user) &&
    !canAccessBackcasting(req.user) &&
    !canAccessFortschritt(req.user)
  ) {
    return res.status(403).json({ error: "Kein Zugriff auf Demo-Daten." });
  }
  const loadAll =
    isDemoRemoveAllUnitsFlag(req.body?.allUnits) || isDemoRemoveAllUnitsFlag(req.query?.allUnits);
  if (loadAll) {
    if (!isAdminRole(req.user)) {
      return res.status(403).json({ error: "Demo für alle Units nur für Admins." });
    }
    let removedEntries = 0;
    let removedPlans = 0;
    for (const demoUnit of DEMO_UNITS) {
      const delEntries = await pool.query(
        "DELETE FROM entries WHERE unit = $1 AND is_demo = true RETURNING id",
        [demoUnit]
      );
      const delPlans = await pool.query(
        "DELETE FROM backcasting_plans WHERE unit = $1 AND is_demo = true RETURNING id",
        [demoUnit]
      );
      removedEntries += delEntries.rowCount;
      removedPlans += delPlans.rowCount;
    }
    return res.json({
      ok: true,
      units: DEMO_UNITS,
      removedEntries,
      removedPlans,
    });
  }

  const requestedUnit = String(req.body?.unit || req.query?.unit || "").trim();
  const resolved = resolveDashboardUnit(req, requestedUnit);
  if (resolved.error) return res.status(403).json({ error: resolved.error });
  const unit = resolved.unit;
  if (!unit) {
    return res.status(400).json({
      error: requestedUnit
        ? "Unit konnte nicht aufgelöst werden."
        : "Unit fehlt. Bitte eine Unit wählen oder allUnits=true verwenden.",
    });
  }
  if (!(await canAccessUnit(req, unit))) {
    return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
  }

  const delEntries = await pool.query(
    "DELETE FROM entries WHERE unit = $1 AND is_demo = true RETURNING id",
    [unit]
  );
  const delPlans = await pool.query(
    "DELETE FROM backcasting_plans WHERE unit = $1 AND is_demo = true RETURNING id",
    [unit]
  );
  return res.json({
    ok: true,
    unit,
    removedEntries: delEntries.rowCount,
    removedPlans: delPlans.rowCount,
  });
}

app.delete("/api/demo/remove", auth, handleDemoRemove);
app.post("/api/demo/remove", auth, handleDemoRemove);

app.get("/api/guidelines", auth, async (req, res) => {
  if (!canReadGuidelines(req.user)) {
    return res.status(403).json({ error: "Kein Zugriff auf Leitplanken." });
  }
  try {
    const data = await getGuidelines(pool);
    return res.json(data);
  } catch (error) {
    console.error("GET /api/guidelines", error);
    return res.status(500).json({ error: "Leitplanken konnten nicht geladen werden." });
  }
});

app.put("/api/admin/guidelines", auth, requireAdmin, async (req, res) => {
  const { guidelines, version, force } = req.body || {};
  if (!Number.isInteger(version) || version < 1) {
    return res.status(400).json({ error: "version fehlt oder ist ungültig." });
  }
  if (!Array.isArray(guidelines)) {
    return res.status(400).json({ error: "guidelines muss ein Array sein." });
  }
  if (force && !isSuperAdminRole(req.user)) {
    return res.status(403).json({ error: "Nur Super-Admin darf Änderungen erzwingen." });
  }
  try {
    const result = await updateGuidelines(pool, {
      guidelines,
      version,
      updatedByEmail: req.user.email,
      force: Boolean(force),
    });
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    if (result.conflict) {
      return res.status(409).json({
        error: "Konflikt: Leitplanken wurden zwischenzeitlich geändert.",
        guidelines: result.guidelines,
        version: result.version,
        updatedAt: result.updatedAt,
        updatedBy: result.updatedBy,
      });
    }
    return res.json({
      ok: true,
      guidelines: result.guidelines,
      version: result.version,
      updatedAt: result.updatedAt,
      updatedBy: result.updatedBy,
    });
  } catch (error) {
    console.error("PUT /api/admin/guidelines", error);
    return res.status(500).json({ error: "Speichern fehlgeschlagen." });
  }
});

app.get("/api/backcasting/phase1-summary", auth, async (req, res) => {
  if (!canAccessBackcasting(req.user)) {
    return res.status(403).json({ error: "Kein Zugriff auf Backcasting." });
  }
  const resolved = resolveDashboardUnit(req, req.query.unit);
  if (resolved.error) return res.status(403).json({ error: resolved.error });
  const unit = resolved.unit;
  if (!unit) return res.status(400).json({ error: "Unit fehlt." });
  if (!(await canAccessUnit(req, unit))) {
    return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
  }
  try {
    const entries = await fetchEntriesForUnit(unit);
    const portfolioEntries = entries.filter((e) => e.type === "portfolio" || (!e.type && e.category));
    const orgEntry = entries.find((e) => e.type === "organisation");
    const skillEntries = entries.filter((e) => e.type === "skill" || (e.skills && e.nachname));

    const catLabels = { produkte: "Produkte", services: "Services", loesungen: "L\u00f6sungen", partnergeschaeft: "Partnergesch\u00e4ft", projektgeschaeft: "Projektgesch\u00e4ft" };
    const portfolioByCat = {};
    portfolioEntries.forEach((p) => {
      const cat = p.category || "sonstiges";
      if (!portfolioByCat[cat]) portfolioByCat[cat] = { subcategory: cat, label: catLabels[cat] || cat, count: 0, umsatz_teur: 0 };
      portfolioByCat[cat].count++;
      portfolioByCat[cat].umsatz_teur += Number(p.jahresumsatz_teur) || 0;
    });
    Object.keys(catLabels).forEach((k) => {
      if (!portfolioByCat[k]) portfolioByCat[k] = { subcategory: k, label: catLabels[k], count: 0, umsatz_teur: 0 };
    });

    const gliederungen = (orgEntry?.gliederungen || []).filter((g) => g.bereich).map((g) => ({
      subcategory: g.bereich, headcount: Number(g.headcount) || 0, umsatz_teur: Number(g.umsatz_teur) || 0,
    }));
    const rollen = (orgEntry?.rollen || []).filter((r) => r.rolle).map((r) => ({
      subcategory: r.rolle, anzahl: Number(r.anzahl) || 0,
    }));

    const skillAgg = {};
    skillEntries.forEach((emp) => {
      (emp.skills || []).forEach((s) => {
        const cat = s.kategorie || "Sonstiges";
        if (!skillAgg[cat]) skillAgg[cat] = { sum: 0, count: 0, employees: new Set() };
        const lvl = Number(s.level);
        if (Number.isFinite(lvl)) { skillAgg[cat].sum += lvl; skillAgg[cat].count++; }
        skillAgg[cat].employees.add(emp.id || emp.email);
      });
    });
    const skillsSummary = Object.entries(skillAgg).map(([cat, v]) => ({
      subcategory: cat, avgLevel: v.count ? Math.round((v.sum / v.count) * 10) / 10 : 0, employeeCount: v.employees.size,
    }));

    const zertTotal = skillEntries.length;
    const zertJa = skillEntries.filter((e) => String(e.zertifiziert || "").toLowerCase() === "ja").length;

    return res.json({
      portfolio: Object.values(portfolioByCat),
      gliederungen,
      rollen,
      skills: skillsSummary,
      zertifiziertQuote: zertTotal ? Math.round((zertJa / zertTotal) * 1000) / 10 : null,
    });
  } catch (error) {
    return res.status(500).json({ error: "Phase-1-Zusammenfassung konnte nicht geladen werden." });
  }
});

app.get("/api/backcasting/plan", auth, async (req, res) => {
  if (!canAccessBackcasting(req.user)) {
    return res.status(403).json({ error: "Kein Zugriff auf Backcasting." });
  }
  const resolved = resolveDashboardUnit(req, req.query.unit);
  if (resolved.error) return res.status(403).json({ error: resolved.error });
  const unit = resolved.unit;
  if (!unit) return res.status(400).json({ error: "Unit fehlt." });
  if (!(await canAccessUnit(req, unit))) {
    return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
  }
  const plan = await fetchBackcastingPlanForUnit(unit);
  if (!plan) return res.json({ unit, plan: null });
  return res.json({
    unit,
    plan: {
      meta: plan.meta || {},
      measures: plan.measures || {},
      is_demo: plan.is_demo,
      updatedAt: plan.updatedAt,
    },
  });
});

app.put("/api/backcasting/plan", auth, async (req, res) => {
  if (!canAccessBackcasting(req.user)) {
    return res.status(403).json({ error: "Kein Zugriff auf Backcasting." });
  }
  if (isPureMitarbeiterRole(req.user)) {
    return res.status(403).json({ error: "Kein Zugriff." });
  }
  const { unit: bodyUnit, meta, measures, is_demo: isDemoBody } = req.body || {};
  const resolved = resolveDashboardUnit(req, bodyUnit || meta?.unit);
  if (resolved.error) return res.status(403).json({ error: resolved.error });
  const unit = resolved.unit || String(meta?.unit || "").trim();
  if (!unit) return res.status(400).json({ error: "Unit fehlt." });
  if (!(await canAccessUnit(req, unit))) {
    return res.status(403).json({ error: "Kein Zugriff auf diese Unit." });
  }
  const enrichedMeta = await enrichBackcastingPlanMeta(unit, meta || {});
  const payload = {
    meta: enrichedMeta,
    measures: measures || {},
  };
  const isDemo = Boolean(isDemoBody);
  const id = await upsertBackcastingPlan(unit, payload, req.user.email, isDemo);
  return res.json({ ok: true, id, unit, is_demo: isDemo });
});

app.delete("/api/entries", auth, async (req, res) => {
  if (isPureMitarbeiterRole(req.user)) {
    return res.status(403).json({ error: "Mitarbeiter duerfen keine Eintraege loeschen." });
  }
  if (isAdminRole(req.user)) {
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
  const result = await pool.query(
    `SELECT u.id, u.name, u.created_at, u.unit_lead_id, u.deputy_lead_id,
            ul.name AS unit_lead_name, ul.email AS unit_lead_email,
            dl.name AS deputy_name, dl.email AS deputy_email
     FROM units u
     LEFT JOIN users ul ON ul.id = u.unit_lead_id
     LEFT JOIN users dl ON dl.id = u.deputy_lead_id
     ORDER BY u.name`
  );
  const rows = result.rows.map((unit) => {
    const unitLead = mapUnitLeadPerson(
      unit,
      "unit_lead_id",
      "unit_lead_name",
      "unit_lead_email"
    );
    const deputyLead = mapUnitLeadPerson(unit, "deputy_lead_id", "deputy_name", "deputy_email");
    return {
      id: unit.id,
      name: unit.name,
      created_at: unit.created_at,
      unitLead,
      deputyLead,
      unitLeads: [unitLead, deputyLead].filter(Boolean),
    };
  });
  return res.json(rows);
});

function resolveSessionUnitFromDb(tokenUnit, dbUnits) {
  const normalized = normalizeUnits(dbUnits);
  const fromToken = String(tokenUnit || "").trim();
  if (!normalized.length) return fromToken;
  if (normalized.length === 1) return normalized[0];
  if (fromToken && normalized.includes(fromToken)) return fromToken;
  return fromToken || normalized[0];
}

async function renameMasterUnit(unitId, oldName, newName) {
  const trimmed = String(newName || "").trim();
  if (!trimmed || trimmed === oldName) return trimmed || oldName;

  const duplicate = await pool.query("SELECT id FROM units WHERE name = $1 AND id <> $2", [
    trimmed,
    unitId,
  ]);
  if (duplicate.rows.length) {
    throw new Error("UNIT_NAME_TAKEN");
  }

  await pool.query(
    `UPDATE entries
     SET unit = $1,
         payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{unit}', to_jsonb($1::text), true),
         updated_at = NOW()
     WHERE unit = $2`,
    [trimmed, oldName]
  );
  await pool.query(
    `UPDATE entries
     SET unit = $1,
         payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{unit}', to_jsonb($1::text), true),
         updated_at = NOW()
     WHERE payload->>'unit' = $2 AND unit IS DISTINCT FROM $1`,
    [trimmed, oldName]
  );

  const usersWithUnit = await pool.query("SELECT id, units FROM users WHERE $1 = ANY(units)", [
    oldName,
  ]);
  for (const row of usersWithUnit.rows) {
    const nextUnits = normalizeUnits(row.units).map((u) => (u === oldName ? trimmed : u));
    await pool.query("UPDATE users SET units = $1, updated_at = NOW() WHERE id = $2", [
      nextUnits,
      row.id,
    ]);
  }
  await pool.query("UPDATE units SET name = $1 WHERE id = $2", [trimmed, unitId]);
  return trimmed;
}

app.post("/api/admin/units", auth, requireSuperAdmin, async (req, res) => {
  const { name, unitLeadId, deputyLeadId } = req.body || {};
  const unitName = String(name || "").trim();
  if (!unitName) return res.status(400).json({ error: "Unit-Name fehlt." });
  try {
    const result = await pool.query(
      `INSERT INTO units (name) VALUES ($1) RETURNING id, name, created_at`,
      [unitName]
    );
    const created = result.rows[0];
    if (unitLeadId !== undefined) {
      await assignUnitLeadership(created.id, unitName, { unitLeadId, deputyLeadId });
    }
    return res.status(201).json(created);
  } catch (error) {
    if (error.message === "UNIT_LEAD_REQUIRED") {
      return res.status(400).json({ error: "Unit Leiter ist erforderlich." });
    }
    if (error.message === "INVALID_UNIT_LEAD") {
      return res.status(400).json({ error: "Ungueltiger Unit Leiter." });
    }
    if (error.message === "INVALID_DEPUTY_LEAD") {
      return res.status(400).json({
        error: `Ungueltiger Stellvertreter. Nur Benutzer mit Position „${DEPUTY_UNIT_LEADER_POSITION}“.`,
      });
    }
    if (error.message === "DEPUTY_SAME_AS_LEAD") {
      return res.status(400).json({ error: "Stellvertreter darf nicht identisch mit Unit Leiter sein." });
    }
    return res.status(400).json({ error: "Unit konnte nicht angelegt werden (evtl. bereits vorhanden)." });
  }
});

app.put("/api/admin/units/:id", auth, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, unitLeadId, deputyLeadId } = req.body || {};
  const unitResult = await pool.query("SELECT id, name FROM units WHERE id = $1", [id]);
  const unit = unitResult.rows[0];
  if (!unit) return res.status(404).json({ error: "Unit nicht gefunden." });

  try {
    let unitName = unit.name;
    if (name !== undefined) {
      const nextName = String(name).trim();
      if (!nextName) return res.status(400).json({ error: "Unit-Name fehlt." });
      unitName = await renameMasterUnit(unit.id, unit.name, nextName);
    }
    if (unitLeadId !== undefined && unitLeadId !== null) {
      await assignUnitLeadership(unit.id, unitName, { unitLeadId, deputyLeadId });
    }
    const refreshed = await pool.query(
      `SELECT u.id, u.name, u.created_at, u.unit_lead_id, u.deputy_lead_id,
              ul.name AS unit_lead_name, ul.email AS unit_lead_email,
              dl.name AS deputy_name, dl.email AS deputy_email
       FROM units u
       LEFT JOIN users ul ON ul.id = u.unit_lead_id
       LEFT JOIN users dl ON dl.id = u.deputy_lead_id
       WHERE u.id = $1`,
      [unit.id]
    );
    const row = refreshed.rows[0];
    const unitLead = row
      ? mapUnitLeadPerson(row, "unit_lead_id", "unit_lead_name", "unit_lead_email")
      : null;
    const deputyLead = row
      ? mapUnitLeadPerson(row, "deputy_lead_id", "deputy_name", "deputy_email")
      : null;
    return res.json({
      ok: true,
      id: unit.id,
      name: unitName,
      unitLead,
      deputyLead,
    });
  } catch (error) {
    if (error.message === "UNIT_NAME_TAKEN") {
      return res.status(400).json({ error: "Unit-Name ist bereits vergeben." });
    }
    if (error.message === "UNIT_LEAD_REQUIRED") {
      return res.status(400).json({ error: "Unit Leiter ist erforderlich." });
    }
    if (error.message === "INVALID_UNIT_LEAD") {
      return res.status(400).json({ error: "Ungueltiger Unit Leiter." });
    }
    if (error.message === "INVALID_DEPUTY_LEAD") {
      return res.status(400).json({
        error: `Ungueltiger Stellvertreter. Nur Benutzer mit Position „${DEPUTY_UNIT_LEADER_POSITION}“.`,
      });
    }
    if (error.message === "DEPUTY_SAME_AS_LEAD") {
      return res.status(400).json({ error: "Stellvertreter darf nicht identisch mit Unit Leiter sein." });
    }
    throw error;
  }
});

app.get("/api/admin/units/:id/deletion-blockers", auth, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const unitResult = await pool.query("SELECT id, name FROM units WHERE id = $1", [id]);
  const unit = unitResult.rows[0];
  if (!unit) return res.status(404).json({ error: "Unit nicht gefunden." });
  const blockers = await getUnitDeletionBlockers(unit.name);
  return res.json({ unit: unit.name, blockers, deletable: blockers.length === 0 });
});

app.delete("/api/admin/units/:id", auth, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const unitResult = await pool.query("SELECT id, name FROM units WHERE id = $1", [id]);
  const unit = unitResult.rows[0];
  if (!unit) return res.status(404).json({ error: "Unit nicht gefunden." });

  const blockers = await getUnitDeletionBlockers(unit.name);
  if (blockers.length > 0) {
    const blockerLines = blockers.map((item) => `• ${item}`).join("\n");
    return res.status(400).json({
      error:
        "Unit kann nicht gelöscht werden, solange noch verknüpfte Daten vorhanden sind.\n\n" +
        `Noch vorhanden:\n${blockerLines}`,
      blockers,
    });
  }

  await pool.query(
    `UPDATE users SET units = array_remove(units, $1) WHERE $1 = ANY(units)`,
    [unit.name]
  );
  await pool.query("DELETE FROM units WHERE id = $1", [id]);
  return res.json({ ok: true });
});

app.get("/api/skill-categories", auth, async (_req, res) => {
  const result = await pool.query(
    "SELECT id, kind, name, beschreibung, beispiel, sort_order FROM skill_categories ORDER BY kind, sort_order, name"
  );
  const tech = [];
  const soft = [];
  for (const row of result.rows) {
    const mapped = mapSkillCategoryRow(row);
    if (row.kind === "tech") tech.push(mapped);
    else soft.push(mapped);
  }
  return res.json({ tech, soft });
});

app.get("/api/admin/skill-categories", auth, requireAdmin, async (_req, res) => {
  const result = await pool.query(
    "SELECT id, kind, name, beschreibung, beispiel, sort_order FROM skill_categories ORDER BY kind, sort_order, name"
  );
  return res.json(result.rows.map(mapSkillCategoryRow));
});

app.post("/api/admin/skill-categories", auth, requireAdmin, async (req, res) => {
  const { kind, name, beschreibung, beispiel } = req.body || {};
  const safeKind = kind === "soft" ? "soft" : "tech";
  const safeName = String(name || "").trim();
  if (!safeName) return res.status(400).json({ error: "Kategorie-Name fehlt." });

  const maxOrder = await pool.query(
    "SELECT COALESCE(MAX(sort_order), -1)::int AS max_order FROM skill_categories WHERE kind = $1",
    [safeKind]
  );
  const sortOrder = maxOrder.rows[0].max_order + 1;

  try {
    const result = await pool.query(
      `INSERT INTO skill_categories (kind, name, beschreibung, beispiel, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, kind, name, beschreibung, beispiel, sort_order`,
      [safeKind, safeName, String(beschreibung || "").trim(), String(beispiel || "").trim(), sortOrder]
    );
    return res.status(201).json(mapSkillCategoryRow(result.rows[0]));
  } catch (error) {
    return res.status(400).json({ error: "Kategorie konnte nicht angelegt werden (evtl. bereits vorhanden)." });
  }
});

app.put("/api/admin/skill-categories/:id", auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, beschreibung, beispiel } = req.body || {};
  const existing = await pool.query("SELECT id, kind, name FROM skill_categories WHERE id = $1", [id]);
  const row = existing.rows[0];
  if (!row) return res.status(404).json({ error: "Kategorie nicht gefunden." });

  const oldName = row.name;
  const safeName = name !== undefined ? String(name).trim() : row.name;
  if (!safeName) return res.status(400).json({ error: "Kategorie-Name fehlt." });

  const current = await pool.query(
    "SELECT beschreibung, beispiel FROM skill_categories WHERE id = $1",
    [id]
  );
  const currentRow = current.rows[0];

  try {
    const result = await pool.query(
      `UPDATE skill_categories
       SET name = $1,
           beschreibung = $2,
           beispiel = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, kind, name, beschreibung, beispiel, sort_order`,
      [
        safeName,
        beschreibung !== undefined ? String(beschreibung).trim() : currentRow.beschreibung,
        beispiel !== undefined ? String(beispiel).trim() : currentRow.beispiel,
        id,
      ]
    );
    if (oldName !== safeName) {
      await cascadeSkillCategoryRenameInEntries(id, row.kind, oldName, safeName);
    }
    return res.json(mapSkillCategoryRow(result.rows[0]));
  } catch (error) {
    return res.status(400).json({ error: "Kategorie konnte nicht aktualisiert werden (evtl. Name bereits vergeben)." });
  }
});

app.post("/api/admin/skill-categories/:id/move", auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const direction = String(req.body?.direction || "").trim().toLowerCase();
  try {
    const result = await moveSkillCategoryItem(pool, id, direction);
    if (result.error === "not_found") {
      return res.status(404).json({ error: "Kategorie nicht gefunden." });
    }
    if (result.error === "invalid_direction") {
      return res.status(400).json({ error: "Ungueltige Richtung." });
    }
    if (result.error === "boundary") {
      return res.status(400).json({ error: "Kategorie kann in diese Richtung nicht verschoben werden." });
    }
    return res.json({
      kind: result.kind,
      items: await listSkillCategoryRows(pool, result.kind),
    });
  } catch (_error) {
    return res.status(500).json({ error: "Reihenfolge konnte nicht geaendert werden." });
  }
});

app.delete("/api/admin/skill-categories/:id", auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const existing = await pool.query("SELECT id, kind, name FROM skill_categories WHERE id = $1", [id]);
  const row = existing.rows[0];
  if (!row) return res.status(404).json({ error: "Kategorie nicht gefunden." });
  await cascadeSkillCategoryRemoveInEntries(id, row.kind, row.name);
  await pool.query("DELETE FROM skill_categories WHERE id = $1", [id]);
  return res.json({ ok: true });
});

app.get("/api/app-roles", auth, async (_req, res) => {
  const result = await pool.query(
    "SELECT id, name, sort_order FROM app_roles ORDER BY sort_order, name"
  );
  return res.json(result.rows.map(mapCatalogNameRow));
});

app.get("/api/app-positions", auth, async (_req, res) => {
  const result = await pool.query(
    "SELECT id, name, sort_order FROM app_positions ORDER BY sort_order, name"
  );
  return res.json(result.rows.map(mapCatalogNameRow));
});

app.get("/api/admin/app-roles", auth, requireAdmin, async (_req, res) => {
  const result = await pool.query(
    "SELECT id, name, sort_order FROM app_roles ORDER BY sort_order, name"
  );
  return res.json(result.rows.map(mapCatalogNameRow));
});

app.post("/api/admin/app-roles", auth, requireAdmin, async (req, res) => {
  const safeName = String(req.body?.name || "").trim();
  if (!safeName) return res.status(400).json({ error: "Rollenname fehlt." });

  const maxOrder = await pool.query("SELECT COALESCE(MAX(sort_order), -1)::int AS max_order FROM app_roles");
  const sortOrder = maxOrder.rows[0].max_order + 1;

  try {
    const result = await pool.query(
      `INSERT INTO app_roles (name, sort_order)
       VALUES ($1, $2)
       RETURNING id, name, sort_order`,
      [safeName, sortOrder]
    );
    return res.status(201).json(mapCatalogNameRow(result.rows[0]));
  } catch (error) {
    return res.status(400).json({ error: "Rolle konnte nicht angelegt werden (evtl. bereits vorhanden)." });
  }
});

app.put("/api/admin/app-roles/:id", auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const safeName = String(req.body?.name || "").trim();
  if (!safeName) return res.status(400).json({ error: "Rollenname fehlt." });

  try {
    const row = await renameAppRoleWithCascade(id, safeName);
    if (!row) return res.status(404).json({ error: "Rolle nicht gefunden." });
    return res.json(mapCatalogNameRow(row));
  } catch (error) {
    return res.status(400).json({ error: "Rolle konnte nicht aktualisiert werden (evtl. Name bereits vergeben)." });
  }
});

app.post("/api/admin/app-roles/:id/move", auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const direction = String(req.body?.direction || "").trim().toLowerCase();
  try {
    const result = await moveCatalogItem("app_roles", id, direction);
    if (result.error === "not_found") {
      return res.status(404).json({ error: "Rolle nicht gefunden." });
    }
    if (result.error === "invalid_direction") {
      return res.status(400).json({ error: "Ungueltige Richtung." });
    }
    if (result.error === "boundary") {
      return res.status(400).json({ error: "Rolle kann in diese Richtung nicht verschoben werden." });
    }
    return res.json({ items: await listCatalogNameRows("app_roles") });
  } catch (_error) {
    return res.status(500).json({ error: "Reihenfolge konnte nicht geaendert werden." });
  }
});

app.delete("/api/admin/app-roles/:id", auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const name = await getCatalogNameById("app_roles", id);
  const existing = await pool.query("SELECT id FROM app_roles WHERE id = $1", [id]);
  if (!existing.rows[0]) return res.status(404).json({ error: "Rolle nicht gefunden." });
  await cascadeUserCatalogArrayRemoveById("user_org_role_ids", id);
  await cascadeSkillOrgRoleRemoveInEmployeeEntries(id, name);
  if (name) {
    await pool.query(
      `UPDATE users SET user_org_roles = array_remove(user_org_roles, $1)
       WHERE $1 = ANY(user_org_roles)`,
      [name]
    );
  }
  await pool.query("DELETE FROM app_roles WHERE id = $1", [id]);
  return res.json({ ok: true });
});

app.get("/api/admin/app-positions", auth, requireAdmin, async (_req, res) => {
  const result = await pool.query(
    "SELECT id, name, sort_order FROM app_positions ORDER BY sort_order, name"
  );
  return res.json(result.rows.map(mapCatalogNameRow));
});

app.post("/api/admin/app-positions", auth, requireAdmin, async (req, res) => {
  const safeName = String(req.body?.name || "").trim();
  if (!safeName) return res.status(400).json({ error: "Positionsname fehlt." });

  const maxOrder = await pool.query(
    "SELECT COALESCE(MAX(sort_order), -1)::int AS max_order FROM app_positions"
  );
  const sortOrder = maxOrder.rows[0].max_order + 1;

  try {
    const result = await pool.query(
      `INSERT INTO app_positions (name, sort_order)
       VALUES ($1, $2)
       RETURNING id, name, sort_order`,
      [safeName, sortOrder]
    );
    return res.status(201).json(mapCatalogNameRow(result.rows[0]));
  } catch (error) {
    return res.status(400).json({ error: "Position konnte nicht angelegt werden (evtl. bereits vorhanden)." });
  }
});

app.put("/api/admin/app-positions/:id", auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const safeName = String(req.body?.name || "").trim();
  if (!safeName) return res.status(400).json({ error: "Positionsname fehlt." });

  try {
    const row = await renameAppPositionWithCascade(id, safeName);
    if (!row) return res.status(404).json({ error: "Position nicht gefunden." });
    return res.json(mapCatalogNameRow(row));
  } catch (error) {
    return res.status(400).json({ error: "Position konnte nicht aktualisiert werden (evtl. Name bereits vergeben)." });
  }
});

app.post("/api/admin/app-positions/:id/move", auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const direction = String(req.body?.direction || "").trim().toLowerCase();
  try {
    const result = await moveCatalogItem("app_positions", id, direction);
    if (result.error === "not_found") {
      return res.status(404).json({ error: "Position nicht gefunden." });
    }
    if (result.error === "invalid_direction") {
      return res.status(400).json({ error: "Ungueltige Richtung." });
    }
    if (result.error === "boundary") {
      return res.status(400).json({ error: "Position kann in diese Richtung nicht verschoben werden." });
    }
    return res.json({ items: await listCatalogNameRows("app_positions") });
  } catch (_error) {
    return res.status(500).json({ error: "Reihenfolge konnte nicht geaendert werden." });
  }
});

app.delete("/api/admin/app-positions/:id", auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const name = await getCatalogNameById("app_positions", id);
  const existing = await pool.query("SELECT id FROM app_positions WHERE id = $1", [id]);
  if (!existing.rows[0]) return res.status(404).json({ error: "Position nicht gefunden." });
  await cascadeUserCatalogArrayRemoveById("user_position_ids", id);
  await cascadePositionRemoveInSkillEntries(id, name);
  if (name) {
    await pool.query(
      `UPDATE users SET user_positions = array_remove(user_positions, $1)
       WHERE $1 = ANY(user_positions)`,
      [name]
    );
  }
  await pool.query("DELETE FROM app_positions WHERE id = $1", [id]);
  return res.json({ ok: true });
});

app.get("/api/admin/org-chart", auth, requireAdmin, async (_req, res) => {
  const usersResult = await pool.query(
    `SELECT id, email, name, role, roles, units, standort, regionalleiter_id, geschaeftsfuehrung_id, geschaeftsfuehrung_ids, unit_lead_id, user_positions
     FROM users ORDER BY name`
  );
  const users = usersResult.rows.map((row) => ({
    ...row,
    roles: getUserRoles(row),
    units: normalizeUnits(row.units),
    standort: row.standort || "",
    user_positions: normalizeStringArray(row.user_positions),
  }));
  const userById = new Map(users.map((u) => [Number(u.id), u]));

  const unitsResult = await pool.query(
    `SELECT name, unit_lead_id, deputy_lead_id FROM units ORDER BY name`
  );
  const masterUnits = unitsResult.rows;

  const mapPerson = (u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: primaryRoleFromRoles(getUserRoles(u)) || u.role,
    roles: getUserRoles(u),
  });

  const userAppearsAsMitarbeiterInOrg = (user) => {
    if (!user) return false;
    const positions = normalizeStringArray(user.user_positions);
    if (
      positions.some((name) => {
        const key = normalizePositionKey(name);
        return key === "mitarbeiter" || key === "berater";
      })
    ) {
      return true;
    }
    return userHasEffectiveHierarchyRole(user, "mitarbeiter");
  };

  const collectDeputyLeadsForUnitNames = (unitNames) => {
    const nameSet = new Set((unitNames || []).filter(Boolean));
    const deputies = new Map();
    for (const row of masterUnits) {
      if (!nameSet.has(row.name) || !row.deputy_lead_id) continue;
      const user = userById.get(Number(row.deputy_lead_id));
      if (user) deputies.set(Number(user.id), mapPerson(user));
    }
    for (const user of users) {
      if (!userHasDeputyUnitLeaderPosition(user.user_positions)) continue;
      if (!normalizeUnits(user.units).some((unitName) => nameSet.has(unitName))) continue;
      deputies.set(Number(user.id), mapPerson(user));
    }
    return [...deputies.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
  };

  const attachDeputyLeadsToBranch = (branch) => {
    const unitNames = new Set((branch.units || []).map((unit) => unit.name).filter(Boolean));
    if (!unitNames.size && branch.name) {
      String(branch.name)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((name) => unitNames.add(name));
    }
    branch.deputyLeads = collectDeputyLeadsForUnitNames([...unitNames]);
    return branch;
  };

  const mergeDeputyLeadLists = (left = [], right = []) => {
    const map = new Map();
    [...left, ...right].forEach((person) => {
      if (person?.id != null) map.set(Number(person.id), person);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
  };

  const isUserInRegionalSubtree = (user, rId) => {
    if (Number(user.regionalleiter_id) === rId) return true;
    if (user.unit_lead_id) {
      const lead = userById.get(Number(user.unit_lead_id));
      if (lead && Number(lead.regionalleiter_id) === rId) return true;
    }
    return false;
  };

  const collectUnitNamesForRegionalleiter = (r) => {
    const rId = Number(r.id);
    const unitNames = new Set(normalizeUnits(r.units));

    for (const user of users) {
      if (!isUserInRegionalSubtree(user, rId)) continue;
      normalizeUnits(user.units).forEach((name) => unitNames.add(name));
    }

    const unitLeadUsers = users.filter(
      (u) =>
        userHasEffectiveHierarchyRole(u, "unit_lead") && Number(u.regionalleiter_id) === rId
    );
    const unitLeadIds = new Set(unitLeadUsers.map((u) => Number(u.id)));

    for (const ul of unitLeadUsers) {
      normalizeUnits(ul.units).forEach((name) => unitNames.add(name));
    }
    for (const row of masterUnits) {
      if (row.unit_lead_id && unitLeadIds.has(Number(row.unit_lead_id))) {
        unitNames.add(row.name);
      }
    }

    return unitNames;
  };

  const mitarbeiterForUnitInRegionalSubtree = (unitName, rId) =>
    users
      .filter((m) => {
        if (!userAppearsAsMitarbeiterInOrg(m)) return false;
        if (!normalizeUnits(m.units).includes(unitName)) return false;
        return isUserInRegionalSubtree(m, rId);
      })
      .map(mapPerson)
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

  const unitNamesForUnitLead = (ul) => {
    const unitNames = new Set(normalizeUnits(ul.units));
    for (const row of masterUnits) {
      if (Number(row.unit_lead_id) === Number(ul.id)) {
        unitNames.add(row.name);
      }
    }
    return unitNames;
  };

  const resolveUnitLeadForUnitName = (unitName, unitLeadUsers) =>
    unitLeadUsers.find((ul) => normalizeUnits(ul.units).includes(unitName)) ||
    unitLeadUsers.find((ul) => {
      const masterRow = masterUnits.find(
        (row) => row.name === unitName && Number(row.unit_lead_id) === Number(ul.id)
      );
      return Boolean(masterRow);
    }) ||
    (() => {
      const masterRow = masterUnits.find((row) => row.name === unitName && row.unit_lead_id);
      return masterRow
        ? unitLeadUsers.find((ul) => Number(ul.id) === Number(masterRow.unit_lead_id))
        : null;
    })() ||
    null;

  const buildUnitLeadBranchesForRegionalleiter = (r) => {
    const rId = Number(r.id);
    const unitLeadUsers = users
      .filter(
        (u) =>
          userHasEffectiveHierarchyRole(u, "unit_lead") && Number(u.regionalleiter_id) === rId
      )
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

    const branches = unitLeadUsers.map((ul) => {
      const branch = {
        branchType: "unit_lead",
        regionalleiterId: rId,
        unitLead: mapPerson(ul),
        units: [...unitNamesForUnitLead(ul)]
          .sort((a, b) => a.localeCompare(b, "de"))
          .map((unitName) => ({
            name: unitName,
            mitarbeiter: mitarbeiterForUnitInRegionalSubtree(unitName, rId),
          })),
      };
      return attachDeputyLeadsToBranch(branch);
    });

    const coveredUnitNames = new Set();
    for (const branch of branches) {
      for (const unit of branch.units) {
        coveredUnitNames.add(unit.name);
      }
    }

    const orphanUnits = [...collectUnitNamesForRegionalleiter(r)]
      .filter((unitName) => !coveredUnitNames.has(unitName))
      .sort((a, b) => a.localeCompare(b, "de"))
      .map((unitName) => {
        const unitLeadUser = resolveUnitLeadForUnitName(unitName, unitLeadUsers);
        return {
          name: unitName,
          mitarbeiter: mitarbeiterForUnitInRegionalSubtree(unitName, rId),
          unitLead: unitLeadUser ? mapPerson(unitLeadUser) : null,
        };
      });

    if (orphanUnits.length) {
      const orphansByLead = new Map();
      const withoutLead = [];
      for (const unit of orphanUnits) {
        const leadId = unit.unitLead?.id;
        if (leadId) {
          if (!orphansByLead.has(leadId)) {
            orphansByLead.set(leadId, {
              branchType: "unit_lead",
              regionalleiterId: rId,
              unitLead: unit.unitLead,
              units: [],
              deputyLeads: [],
            });
          }
          orphansByLead.get(leadId).units.push({
            name: unit.name,
            mitarbeiter: unit.mitarbeiter,
          });
        } else {
          withoutLead.push({ name: unit.name, mitarbeiter: unit.mitarbeiter });
        }
      }

      for (const branch of orphansByLead.values()) {
        const existing = branches.find(
          (b) => b.unitLead && Number(b.unitLead.id) === Number(branch.unitLead.id)
        );
        if (existing) {
          existing.units.push(...branch.units);
          existing.units.sort((a, b) => a.name.localeCompare(b.name, "de"));
          existing.deputyLeads = mergeDeputyLeadLists(
            existing.deputyLeads,
            attachDeputyLeadsToBranch({ ...branch, regionalleiterId: rId }).deputyLeads
          );
        } else {
          branches.push(attachDeputyLeadsToBranch({ ...branch, regionalleiterId: rId }));
        }
      }

      if (withoutLead.length) {
        branches.push(
          attachDeputyLeadsToBranch({
            branchType: "orphan_units",
            regionalleiterId: rId,
            unitLead: null,
            units: withoutLead,
          })
        );
      }
    }

    return branches
      .map((branch) =>
        branch.deputyLeads ? branch : attachDeputyLeadsToBranch({ ...branch, regionalleiterId: rId })
      )
      .filter((branch) => branch.unitLead || branch.units?.length)
      .sort((a, b) => {
        const an = a.unitLead?.name || "";
        const bn = b.unitLead?.name || "";
        return an.localeCompare(bn, "de");
      });
  };

  const buildSupervisorBranchesForRegionalleiter = (r) => {
    const rId = Number(r.id);
    const unitLeadUsers = users
      .filter(
        (u) =>
          userHasEffectiveHierarchyRole(u, "unit_lead") && Number(u.regionalleiter_id) === rId
      )
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
    const unitLeadIds = new Set(unitLeadUsers.map((u) => Number(u.id)));

    const branches = unitLeadUsers.map((ul) => {
      const unitLabel = normalizeUnits(ul.units).filter(Boolean).join(", ");
      return attachDeputyLeadsToBranch({
        name: unitLabel || ul.name,
        branchType: "unit_lead",
        regionalleiterId: rId,
        unitLead: mapPerson(ul),
        units: [],
        mitarbeiter: users
          .filter(
            (m) =>
              userAppearsAsMitarbeiterInOrg(m) && Number(m.unit_lead_id) === Number(ul.id)
          )
          .map(mapPerson)
          .sort((a, b) => a.name.localeCompare(b.name, "de")),
      });
    });

    const directMitarbeiter = users
      .filter((m) => {
        if (!userAppearsAsMitarbeiterInOrg(m)) return false;
        if (Number(m.regionalleiter_id) !== rId) return false;
        if (m.unit_lead_id && unitLeadIds.has(Number(m.unit_lead_id))) return false;
        return true;
      })
      .map(mapPerson)
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

    if (directMitarbeiter.length) {
      branches.push({
        name: "Direkt der Regionalleitung",
        branchType: "direct",
        unitLead: null,
        mitarbeiter: directMitarbeiter,
      });
    }

    return branches;
  };

  const buildRegionalleiterNode = (r) => {
    const unitLeadBranches = buildUnitLeadBranchesForRegionalleiter(r);
    const hasUnitStructure = unitLeadBranches.some((branch) => branch.units?.length);
    if (!hasUnitStructure) {
      return {
        ...mapPerson(r),
        standort: r.standort || "",
        layout: "supervisors",
        unitLeads: buildSupervisorBranchesForRegionalleiter(r).map((branch) => ({
          branchType: branch.branchType,
          unitLead: branch.unitLead,
          deputyLeads: branch.deputyLeads || [],
          units: [],
          mitarbeiter: branch.mitarbeiter,
          name: branch.name,
        })),
      };
    }
    return {
      ...mapPerson(r),
      standort: r.standort || "",
      layout: "unit_leads",
      unitLeads: unitLeadBranches,
    };
  };

  const gfUsers = users.filter((u) => userHasEffectiveHierarchyRole(u, "geschaeftsfuehrung"));
  const soleGeschaeftsfuehrungId =
    gfUsers.length === 1 ? Number(gfUsers[0].id) : null;

  const regionalleiterForGeschaeftsfuehrung = (gfId) =>
    users
      .filter((u) => {
        if (!userHasEffectiveHierarchyRole(u, "regionalleiter")) return false;
        const gfIds = resolveGeschaeftsfuehrungIdsFromRow(u);
        if (gfIds.includes(Number(gfId))) return true;
        if (!gfIds.length && soleGeschaeftsfuehrungId === Number(gfId)) return true;
        return false;
      })
      .map(buildRegionalleiterNode)
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

  const geschaeftsfuehrung = gfUsers
    .map((gf) => ({
      ...mapPerson(gf),
      regionalleiter: regionalleiterForGeschaeftsfuehrung(gf.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  return res.json({ geschaeftsfuehrung });
});

app.get("/api/admin/users", auth, requireAdmin, async (_req, res) => {
  const result = await pool.query(
    `SELECT u.id, u.email, u.name, u.role, u.roles, u.units, u.standort,
            u.regionalleiter_id, u.geschaeftsfuehrung_id, u.geschaeftsfuehrung_ids, u.unit_lead_id, u.personalnummer,
            u.skill_entry_id, u.login_blocked,
            u.user_org_roles, u.user_positions, u.user_org_role_ids, u.user_position_ids,
            u.created_at, u.updated_at,
            rl.name AS regionalleiter_name,
            gf.name AS geschaeftsfuehrung_name,
            ul.name AS unit_lead_name
     FROM users u
     LEFT JOIN users rl ON rl.id = u.regionalleiter_id
     LEFT JOIN users gf ON gf.id = u.geschaeftsfuehrung_id
     LEFT JOIN users ul ON ul.id = u.unit_lead_id
     ORDER BY u.email`
  );
  const users = result.rows.map((row) => mapUserRow(row));
  return res.json(await enrichUsersCatalog(users));
});

app.post("/api/admin/users", auth, requireAdmin, async (req, res) => {
  const {
    email,
    name,
    role,
    roles,
    password,
    units,
    standort,
    regionalleiterId,
    geschaeftsfuehrungId,
    geschaeftsfuehrungIds,
    unitLeadId,
    superAdminGrantPassword,
    personalnummer,
    userOrgRoles,
    userPositions,
    userOrgRoleIds,
    userPositionIds,
    minimalAccount,
  } = req.body || {};
  if (!email || !name || !password) return res.status(400).json({ error: "Pflichtfelder fehlen." });
  const catalog = await validateUserCatalogAssignments(
    userOrgRoles,
    userPositions,
    userOrgRoleIds,
    userPositionIds
  );
  const inputRoles = Array.isArray(roles) && roles.length ? roles : role ? [role] : [];
  const mergedRoles = mergeUserRolesFromInput(inputRoles, catalog.userPositions);
  const createMinimalAccount =
    minimalAccount === true ||
    (!mergedRoles.length && !catalog.userOrgRoles.length && !catalog.userPositions.length);

  let validated;
  if (createMinimalAccount) {
    validated = {
      role: "mitarbeiter",
      roles: ["mitarbeiter"],
      units: [],
      standort: null,
      regionalleiterId: null,
      geschaeftsfuehrungId: null,
      geschaeftsfuehrungIds: [],
      unitLeadId: null,
    };
  } else {
    if (!mergedRoles.length) {
      return res.status(400).json({
        error: "Mindestens eine Position oder eine Administration-Rolle erforderlich.",
      });
    }
    const superAdminError = validateSuperAdminGrant(mergedRoles, [], superAdminGrantPassword);
    if (superAdminError) return res.status(400).json({ error: superAdminError });
    validated = await validateUserRolesAndOrg(
      mergedRoles,
      { standort, regionalleiterId, geschaeftsfuehrungId, geschaeftsfuehrungIds, unitLeadId, units },
      null
    );
    if (validated.error) return res.status(400).json({ error: validated.error });
  }
  try {
    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, role, roles, units, standort, regionalleiter_id, geschaeftsfuehrung_id, geschaeftsfuehrung_ids, unit_lead_id, personalnummer, user_org_roles, user_positions, user_org_role_ids, user_position_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id`,
      [
        String(email).trim().toLowerCase(),
        String(name).trim(),
        bcrypt.hashSync(String(password), 10),
        validated.role,
        validated.roles,
        validated.units,
        validated.standort,
        validated.regionalleiterId,
        validated.geschaeftsfuehrungId,
        validated.geschaeftsfuehrungIds || [],
        validated.unitLeadId,
        personalnummer !== undefined ? String(personalnummer).trim() || null : null,
        catalog.userOrgRoles,
        catalog.userPositions,
        catalog.userOrgRoleIds,
        catalog.userPositionIds,
      ]
    );
    return res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({ error: "E-Mail ist bereits vergeben." });
    }
    return res.status(400).json({ error: "Benutzer konnte nicht angelegt werden." });
  }
});

app.post("/api/admin/users/bulk-login-block", auth, requireAdmin, async (req, res) => {
  const { userIds, loginBlocked } = req.body || {};
  const ids = normalizeBigIntArray(userIds);
  if (!ids.length) {
    return res.status(400).json({ error: "Mindestens einen Benutzer auswaehlen." });
  }
  if (typeof loginBlocked !== "boolean") {
    return res.status(400).json({ error: "loginBlocked (true/false) erforderlich." });
  }
  const selfId = Number(req.user?.sub);
  const targetIds = ids.filter((id) => !selfId || id !== selfId);
  if (!targetIds.length) {
    return res.status(400).json({ error: "Der eigene Benutzer kann nicht gesperrt werden." });
  }
  const now = new Date().toISOString();
  const result = await pool.query(
    `UPDATE users SET login_blocked = $1, updated_at = $2 WHERE id = ANY($3::bigint[]) RETURNING id`,
    [loginBlocked, now, targetIds]
  );
  return res.json({ ok: true, updated: result.rowCount });
});

app.put("/api/admin/users/:id", auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    name,
    role,
    roles,
    password,
    units,
    email,
    standort,
    regionalleiterId,
    geschaeftsfuehrungId,
    geschaeftsfuehrungIds,
    unitLeadId,
    superAdminGrantPassword,
    personalnummer,
    userOrgRoles,
    userPositions,
    userOrgRoleIds,
    userPositionIds,
    loginBlocked,
  } = req.body || {};
  const userFull = await pool.query(
    `SELECT id, email, role, roles, standort, regionalleiter_id, geschaeftsfuehrung_id, geschaeftsfuehrung_ids, unit_lead_id, units, personalnummer, user_org_roles, user_positions, user_org_role_ids, user_position_ids
     FROM users WHERE id = $1`,
    [id]
  );
  const cur = userFull.rows[0];
  if (!cur) return res.status(404).json({ error: "Benutzer nicht gefunden." });

  const updates = [];
  const params = [];
  if (email !== undefined) {
    const newEmail = String(email).trim().toLowerCase();
    if (!newEmail || !newEmail.includes("@")) {
      return res.status(400).json({ error: "Gueltige E-Mail erforderlich." });
    }
    if (newEmail !== cur.email) {
      const duplicate = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND id <> $2",
        [newEmail, id]
      );
      if (duplicate.rows.length) {
        return res.status(400).json({ error: "E-Mail ist bereits vergeben." });
      }
      params.push(newEmail);
      updates.push(`email = $${params.length}`);
    }
  }
  if (name) {
    params.push(String(name).trim());
    updates.push(`name = $${params.length}`);
  }

  if (personalnummer !== undefined) {
    if (!isAdminRole(req.user)) {
      return res.status(403).json({ error: "Personalnummer nur durch Admin aenderbar." });
    }
    params.push(String(personalnummer).trim() || null);
    updates.push(`personalnummer = $${params.length}`);
  }

  const rolesChanged =
    Array.isArray(roles) ||
    role ||
    userPositions !== undefined ||
    userOrgRoles !== undefined ||
    userPositionIds !== undefined ||
    userOrgRoleIds !== undefined;
  if (rolesChanged) {
    const catalogForRoles =
      userPositions !== undefined ||
      userOrgRoles !== undefined ||
      userPositionIds !== undefined ||
      userOrgRoleIds !== undefined
        ? await validateUserCatalogAssignments(
            userOrgRoles !== undefined ? userOrgRoles : cur.user_org_roles,
            userPositions !== undefined ? userPositions : cur.user_positions,
            userOrgRoleIds !== undefined ? userOrgRoleIds : cur.user_org_role_ids,
            userPositionIds !== undefined ? userPositionIds : cur.user_position_ids
          )
        : {
            userOrgRoles: normalizeStringArray(cur.user_org_roles),
            userPositions: normalizeStringArray(cur.user_positions),
            userOrgRoleIds: normalizeBigIntArray(cur.user_org_role_ids),
            userPositionIds: normalizeBigIntArray(cur.user_position_ids),
          };
    const inputRoles =
      Array.isArray(roles) && roles.length
        ? roles
        : role
          ? [role]
          : getUserRoles(cur);
    const mergedRoles = mergeUserRolesFromInput(inputRoles, catalogForRoles.userPositions);
    if (!mergedRoles.length) {
      return res.status(400).json({
        error: "Mindestens eine Position oder eine Administration-Rolle erforderlich.",
      });
    }
    const superAdminError = validateSuperAdminGrant(
      mergedRoles,
      getUserRoles(cur),
      superAdminGrantPassword
    );
    if (superAdminError) return res.status(400).json({ error: superAdminError });
    const validated = await validateUserRolesAndOrg(
      mergedRoles,
      {
        standort: standort !== undefined ? standort : cur.standort,
        regionalleiterId:
          regionalleiterId !== undefined ? regionalleiterId : cur.regionalleiter_id,
        geschaeftsfuehrungId:
          geschaeftsfuehrungId !== undefined ? geschaeftsfuehrungId : cur.geschaeftsfuehrung_id,
        geschaeftsfuehrungIds:
          geschaeftsfuehrungIds !== undefined
            ? geschaeftsfuehrungIds
            : resolveGeschaeftsfuehrungIdsFromRow(cur),
        unitLeadId: unitLeadId !== undefined ? unitLeadId : cur.unit_lead_id,
        units: units !== undefined ? units : normalizeUnits(cur.units),
      },
      id
    );
    if (validated.error) return res.status(400).json({ error: validated.error });
    params.push(validated.role);
    updates.push(`role = $${params.length}`);
    params.push(validated.roles);
    updates.push(`roles = $${params.length}`);
    params.push(validated.units);
    updates.push(`units = $${params.length}`);
    params.push(validated.standort);
    updates.push(`standort = $${params.length}`);
    params.push(validated.regionalleiterId);
    updates.push(`regionalleiter_id = $${params.length}`);
    params.push(validated.geschaeftsfuehrungId);
    updates.push(`geschaeftsfuehrung_id = $${params.length}`);
    params.push(validated.geschaeftsfuehrungIds || []);
    updates.push(`geschaeftsfuehrung_ids = $${params.length}`);
    params.push(validated.unitLeadId);
    updates.push(`unit_lead_id = $${params.length}`);
  } else {
    if (units !== undefined) {
      const validated = await validateUserRolesAndOrg(
        getUserRoles(cur),
        {
          standort: cur.standort,
          regionalleiterId: cur.regionalleiter_id,
          geschaeftsfuehrungId: cur.geschaeftsfuehrung_id,
          geschaeftsfuehrungIds: resolveGeschaeftsfuehrungIdsFromRow(cur),
          unitLeadId: cur.unit_lead_id,
          units,
        },
        id
      );
      if (validated.error) return res.status(400).json({ error: validated.error });
      params.push(validated.units);
      updates.push(`units = $${params.length}`);
    }
    if (
      standort !== undefined ||
      regionalleiterId !== undefined ||
      geschaeftsfuehrungId !== undefined ||
      geschaeftsfuehrungIds !== undefined ||
      unitLeadId !== undefined
    ) {
      const validated = await validateUserRolesAndOrg(
        getUserRoles(cur),
        {
          standort: standort !== undefined ? standort : cur.standort,
          regionalleiterId:
            regionalleiterId !== undefined ? regionalleiterId : cur.regionalleiter_id,
          geschaeftsfuehrungId:
            geschaeftsfuehrungId !== undefined ? geschaeftsfuehrungId : cur.geschaeftsfuehrung_id,
          geschaeftsfuehrungIds:
            geschaeftsfuehrungIds !== undefined
              ? geschaeftsfuehrungIds
              : resolveGeschaeftsfuehrungIdsFromRow(cur),
          unitLeadId: unitLeadId !== undefined ? unitLeadId : cur.unit_lead_id,
          units: normalizeUnits(cur.units),
        },
        id
      );
      if (validated.error) return res.status(400).json({ error: validated.error });
      params.push(validated.standort);
      updates.push(`standort = $${params.length}`);
      params.push(validated.regionalleiterId);
      updates.push(`regionalleiter_id = $${params.length}`);
      params.push(validated.geschaeftsfuehrungId);
      updates.push(`geschaeftsfuehrung_id = $${params.length}`);
      params.push(validated.geschaeftsfuehrungIds || []);
      updates.push(`geschaeftsfuehrung_ids = $${params.length}`);
      params.push(validated.unitLeadId);
      updates.push(`unit_lead_id = $${params.length}`);
    }
  }

  if (
    userOrgRoles !== undefined ||
    userPositions !== undefined ||
    userOrgRoleIds !== undefined ||
    userPositionIds !== undefined
  ) {
    const catalog = await validateUserCatalogAssignments(
      userOrgRoles !== undefined ? userOrgRoles : cur.user_org_roles,
      userPositions !== undefined ? userPositions : cur.user_positions,
      userOrgRoleIds !== undefined ? userOrgRoleIds : cur.user_org_role_ids,
      userPositionIds !== undefined ? userPositionIds : cur.user_position_ids
    );
    params.push(catalog.userOrgRoles);
    updates.push(`user_org_roles = $${params.length}`);
    params.push(catalog.userPositions);
    updates.push(`user_positions = $${params.length}`);
    params.push(catalog.userOrgRoleIds);
    updates.push(`user_org_role_ids = $${params.length}`);
    params.push(catalog.userPositionIds);
    updates.push(`user_position_ids = $${params.length}`);
  }

  if (password) {
    params.push(bcrypt.hashSync(String(password), 10));
    updates.push(`password_hash = $${params.length}`);
  }
  if (loginBlocked !== undefined) {
    const blocked = Boolean(loginBlocked);
    if (blocked && String(id) === String(req.user?.sub)) {
      return res.status(400).json({ error: "Der eigene Benutzer kann nicht gesperrt werden." });
    }
    params.push(blocked);
    updates.push(`login_blocked = $${params.length}`);
  }
  if (!updates.length) return res.status(400).json({ error: "Keine Aenderungen." });
  params.push(new Date().toISOString());
  updates.push(`updated_at = $${params.length}`);
  params.push(id);

  try {
    await pool.query(`UPDATE users SET ${updates.join(", ")} WHERE id = $${params.length}`, params);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({ error: "E-Mail ist bereits vergeben." });
    }
    throw error;
  }
  return res.json({ ok: true });
});

function parseImportList(value) {
  return String(value || "")
    .split(/[;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

async function lookupUserIdByEmail(email) {
  const safeEmail = String(email || "").trim().toLowerCase();
  if (!safeEmail || !safeEmail.includes("@")) return null;
  const result = await pool.query("SELECT id FROM users WHERE email = $1", [safeEmail]);
  const id = result.rows[0]?.id;
  return id != null ? Number(id) : null;
}

async function lookupUserIdsByEmailList(emailList) {
  const ids = [];
  for (const email of parseImportList(emailList)) {
    const id = await lookupUserIdByEmail(email);
    if (id) ids.push(id);
  }
  return [...new Set(ids)];
}

function isFullUserImportRow(row) {
  return !!(
    row.positionen?.length ||
    row.rollenOrganisation?.length ||
    row.units?.length ||
    row.administration?.length ||
    row.standort ||
    row.regionalleiterEmail ||
    row.geschaeftsfuehrungEmail
  );
}

async function applyLegacyUserImportRow(row, results) {
  const rowNum = row.rowNum;
  const email = row.email;
  const vorname = row.vorname;
  const nachname = row.nachname;
  const personalnummer = row.personalnummer || null;
  const name = `${nachname}, ${vorname}`;

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE users SET name = $1, personalnummer = $2, updated_at = $3 WHERE id = $4`,
      [name, personalnummer, new Date().toISOString(), existing.rows[0].id]
    );
    results.updated += 1;
    return;
  }
  await pool.query(
    `INSERT INTO users (email, name, password_hash, role, roles, units, personalnummer)
     VALUES ($1, $2, $3, 'mitarbeiter', ARRAY['mitarbeiter']::text[], '{}', $4)`,
    [email, name, bcrypt.hashSync(DEFAULT_MITARBEITER_PASSWORD, 10), personalnummer]
  );
  results.created += 1;
}

async function applyFullUserImportRow(row, results) {
  const rowNum = row.rowNum;
  const email = row.email;
  const vorname = row.vorname;
  const nachname = row.nachname;
  const personalnummer = row.personalnummer || null;
  const name = `${nachname}, ${vorname}`;
  const units = row.units || [];
  const userOrgRoles = row.rollenOrganisation || [];
  const userPositions = row.positionen || [];
  const administration = (row.administration || []).filter((role) =>
    ["admin", "super_admin", ...APP_MODULE_ROLES].includes(role)
  );

  if (administration.includes("super_admin")) {
    const existingCheck = await pool.query(
      `SELECT roles FROM users WHERE email = $1`,
      [email]
    );
    const existingRoles = getUserRoles(existingCheck.rows[0] || {});
    if (!existingRoles.includes("super_admin")) {
      results.errors.push({
        row: rowNum,
        email,
        message: "Super Admin nur in der Oberflaeche vergeben (Freischalt-Passwort).",
      });
      return;
    }
  }

  const catalog = await validateUserCatalogAssignments(
    userOrgRoles,
    userPositions,
    null,
    null
  );
  const mergedRoles = mergeUserRolesFromInput(administration, catalog.userPositions);
  if (!mergedRoles.length) {
    results.errors.push({
      row: rowNum,
      email,
      message: "Mindestens eine Position oder Administration-Rolle erforderlich.",
    });
    return;
  }

  const regionalleiterId = await lookupUserIdByEmail(row.regionalleiterEmail);
  const geschaeftsfuehrungIds = await lookupUserIdsByEmailList(row.geschaeftsfuehrungEmail);
  const geschaeftsfuehrungId = geschaeftsfuehrungIds[0] || null;
  const existing = await pool.query(
    `SELECT id, roles FROM users WHERE email = $1`,
    [email]
  );
  const userId = existing.rows[0]?.id || null;

  const validated = await validateUserRolesAndOrg(
    mergedRoles,
    {
      standort: row.standort || "",
      regionalleiterId,
      geschaeftsfuehrungId,
      geschaeftsfuehrungIds,
      unitLeadId: null,
      units,
    },
    userId
  );
  if (validated.error) {
    results.errors.push({ row: rowNum, email, message: validated.error });
    return;
  }

  const now = new Date().toISOString();
  if (userId) {
    await pool.query(
      `UPDATE users SET
         name = $1,
         role = $2,
         roles = $3,
         units = $4,
         standort = $5,
         regionalleiter_id = $6,
         geschaeftsfuehrung_id = $7,
         geschaeftsfuehrung_ids = $8,
         unit_lead_id = $9,
         personalnummer = $10,
         user_org_roles = $11,
         user_positions = $12,
         user_org_role_ids = $13,
         user_position_ids = $14,
         updated_at = $15
       WHERE id = $16`,
      [
        name,
        validated.role,
        validated.roles,
        validated.units,
        validated.standort,
        validated.regionalleiterId,
        validated.geschaeftsfuehrungId,
        validated.geschaeftsfuehrungIds || [],
        validated.unitLeadId,
        personalnummer,
        catalog.userOrgRoles,
        catalog.userPositions,
        catalog.userOrgRoleIds,
        catalog.userPositionIds,
        now,
        userId,
      ]
    );
    results.updated += 1;
    return;
  }

  await pool.query(
    `INSERT INTO users (email, name, password_hash, role, roles, units, standort, regionalleiter_id, geschaeftsfuehrung_id, geschaeftsfuehrung_ids, unit_lead_id, personalnummer, user_org_roles, user_positions, user_org_role_ids, user_position_ids)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      email,
      name,
      bcrypt.hashSync(DEFAULT_MITARBEITER_PASSWORD, 10),
      validated.role,
      validated.roles,
      validated.units,
      validated.standort,
      validated.regionalleiterId,
      validated.geschaeftsfuehrungId,
      validated.geschaeftsfuehrungIds || [],
      validated.unitLeadId,
      personalnummer,
      catalog.userOrgRoles,
      catalog.userPositions,
      catalog.userOrgRoleIds,
      catalog.userPositionIds,
    ]
  );
  results.created += 1;
}

async function importSkillCategoriesFromRows(rows) {
  const results = { created: 0, updated: 0, errors: [] };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || {};
    const rowNum = Number(row.rowNum) || i + 2;
    const kind = row.kind === "soft" ? "soft" : "tech";
    const name = String(row.name || "").trim();
    const beschreibung = String(row.beschreibung || "").trim();
    const beispiel = String(row.beispiel || "").trim();
    const rawSort = row.sort_order;
    const sortOrder =
      rawSort !== undefined && rawSort !== null && String(rawSort).trim() !== ""
        ? Number(rawSort)
        : null;

    if (!name) {
      results.errors.push({ row: rowNum, name: "", message: "Kategorie-Name fehlt." });
      continue;
    }

    const rawId = row.id;
    const id =
      rawId !== undefined && rawId !== null && String(rawId).trim() !== "" ? Number(rawId) : null;

    try {
      let existing = null;
      if (Number.isFinite(id) && id > 0) {
        const byId = await pool.query(
          "SELECT id, kind, name FROM skill_categories WHERE id = $1",
          [id]
        );
        existing = byId.rows[0] || null;
      }
      if (!existing) {
        const byName = await pool.query(
          "SELECT id, kind, name FROM skill_categories WHERE kind = $1 AND name = $2",
          [kind, name]
        );
        existing = byName.rows[0] || null;
      }

      if (existing) {
        const oldName = existing.name;
        const current = await pool.query(
          "SELECT beschreibung, beispiel, sort_order FROM skill_categories WHERE id = $1",
          [existing.id]
        );
        const currentRow = current.rows[0];
        const nextSort =
          sortOrder !== null && Number.isFinite(sortOrder)
            ? sortOrder
            : currentRow.sort_order;
        await pool.query(
          `UPDATE skill_categories
           SET name = $1,
               beschreibung = $2,
               beispiel = $3,
               sort_order = $4,
               updated_at = NOW()
           WHERE id = $5`,
          [
            name,
            beschreibung || currentRow.beschreibung,
            beispiel || currentRow.beispiel,
            nextSort,
            existing.id,
          ]
        );
        if (oldName !== name) {
          await cascadeSkillCategoryRenameInEntries(
            existing.id,
            existing.kind,
            oldName,
            name
          );
        }
        results.updated += 1;
      } else {
        const maxOrder = await pool.query(
          "SELECT COALESCE(MAX(sort_order), -1)::int AS max_order FROM skill_categories WHERE kind = $1",
          [kind]
        );
        const nextSort =
          sortOrder !== null && Number.isFinite(sortOrder)
            ? sortOrder
            : maxOrder.rows[0].max_order + 1;
        await pool.query(
          `INSERT INTO skill_categories (kind, name, beschreibung, beispiel, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [kind, name, beschreibung, beispiel, nextSort]
        );
        results.created += 1;
      }
    } catch (error) {
      if (error.code === "23505") {
        results.errors.push({
          row: rowNum,
          name,
          message: "Kategorie existiert bereits (kind+name).",
        });
      } else {
        results.errors.push({
          row: rowNum,
          name,
          message: error.message || "Import fehlgeschlagen.",
        });
      }
    }
  }
  return results;
}

async function importCatalogNameRows(table, rows, renameWithCascade) {
  const results = { created: 0, updated: 0, errors: [] };
  const safeTable = table === "app_positions" ? "app_positions" : "app_roles";

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || {};
    const rowNum = Number(row.rowNum) || i + 2;
    const name = String(row.name || "").trim();
    const rawSort = row.sort_order;
    const sortOrder =
      rawSort !== undefined && rawSort !== null && String(rawSort).trim() !== ""
        ? Number(rawSort)
        : null;
    const rawId = row.id;
    const id =
      rawId !== undefined && rawId !== null && String(rawId).trim() !== "" ? Number(rawId) : null;

    if (!name) {
      results.errors.push({ row: rowNum, name: "", message: "Name fehlt." });
      continue;
    }

    try {
      let existing = null;
      if (Number.isFinite(id) && id > 0) {
        const byId = await pool.query(
          `SELECT id, name, sort_order FROM ${safeTable} WHERE id = $1`,
          [id]
        );
        existing = byId.rows[0] || null;
      }
      if (!existing) {
        const byName = await pool.query(
          `SELECT id, name, sort_order FROM ${safeTable} WHERE name = $1`,
          [name]
        );
        existing = byName.rows[0] || null;
      }

      if (existing) {
        if (existing.name !== name) {
          const renamed = await renameWithCascade(existing.id, name);
          if (!renamed) {
            results.errors.push({ row: rowNum, name, message: "Eintrag nicht gefunden." });
            continue;
          }
        }
        if (sortOrder !== null && Number.isFinite(sortOrder) && sortOrder !== existing.sort_order) {
          await pool.query(
            `UPDATE ${safeTable} SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
            [sortOrder, existing.id]
          );
        }
        results.updated += 1;
      } else {
        const maxOrder = await pool.query(
          `SELECT COALESCE(MAX(sort_order), -1)::int AS max_order FROM ${safeTable}`
        );
        const nextSort =
          sortOrder !== null && Number.isFinite(sortOrder)
            ? sortOrder
            : maxOrder.rows[0].max_order + 1;
        await pool.query(
          `INSERT INTO ${safeTable} (name, sort_order) VALUES ($1, $2)`,
          [name, nextSort]
        );
        results.created += 1;
      }
    } catch (error) {
      if (error.code === "23505") {
        results.errors.push({
          row: rowNum,
          name,
          message: "Name ist bereits vergeben.",
        });
      } else {
        results.errors.push({
          row: rowNum,
          name,
          message: error.message || "Import fehlgeschlagen.",
        });
      }
    }
  }
  return results;
}

app.post("/api/admin/skill-categories/import", auth, requireAdmin, async (req, res) => {
  const { rows } = req.body || {};
  if (!Array.isArray(rows) || !rows.length) {
    return res.status(400).json({ error: "Keine Importdaten vorhanden." });
  }
  const results = await importSkillCategoriesFromRows(rows);
  return res.json(results);
});

app.post("/api/admin/catalogs/import", auth, requireAdmin, async (req, res) => {
  const { roles, positions } = req.body || {};
  const roleRows = Array.isArray(roles) ? roles : [];
  const positionRows = Array.isArray(positions) ? positions : [];
  if (!roleRows.length && !positionRows.length) {
    return res.status(400).json({ error: "Keine Importdaten vorhanden." });
  }
  const roleResults = roleRows.length
    ? await importCatalogNameRows("app_roles", roleRows, renameAppRoleWithCascade)
    : { created: 0, updated: 0, errors: [] };
  const positionResults = positionRows.length
    ? await importCatalogNameRows("app_positions", positionRows, renameAppPositionWithCascade)
    : { created: 0, updated: 0, errors: [] };
  return res.json({
    roles: roleResults,
    positions: positionResults,
    created: roleResults.created + positionResults.created,
    updated: roleResults.updated + positionResults.updated,
    errors: [...roleResults.errors, ...positionResults.errors],
  });
});

async function importAdminUsersFromRows(rows) {
  const results = { created: 0, updated: 0, errors: [] };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || {};
    const rowNum = Number(row.rowNum) || i + 2;
    const email = String(row.email || "")
      .trim()
      .toLowerCase();
    const vorname = String(row.vorname || "").trim();
    const nachname = String(row.nachname || "").trim();
    const personalnummer = String(row.personalnummer || "").trim() || null;

    if (!email || !email.includes("@")) {
      results.errors.push({ row: rowNum, email, message: "Ungueltige E-Mail." });
      continue;
    }
    if (!nachname || !vorname) {
      results.errors.push({ row: rowNum, email, message: "Nachname und Vorname erforderlich." });
      continue;
    }

    const normalizedRow = {
      rowNum,
      email,
      vorname,
      nachname,
      personalnummer,
      positionen: parseImportList(row.positionen),
      rollenOrganisation: parseImportList(row.rollenOrganisation),
      units: parseImportList(row.units),
      standort: normalizeUserStandort(row.standort),
      regionalleiterEmail: String(row.regionalleiterEmail || "").trim().toLowerCase(),
      geschaeftsfuehrungEmail: String(row.geschaeftsfuehrungEmail || "").trim().toLowerCase(),
      administration: parseImportList(row.administration)
        .map((role) => role.toLowerCase().replace(/\s+/g, "_"))
        .filter((role) => role === "admin" || role === "super_admin" || APP_MODULE_ROLES.includes(role)),
    };

    try {
      if (isFullUserImportRow(normalizedRow)) {
        await applyFullUserImportRow(normalizedRow, results);
      } else {
        await applyLegacyUserImportRow(normalizedRow, results);
      }
    } catch (error) {
      if (error.code === "23505") {
        results.errors.push({ row: rowNum, email, message: "E-Mail ist bereits vergeben." });
      } else {
        results.errors.push({
          row: rowNum,
          email,
          message: error.message || "Import fehlgeschlagen.",
        });
      }
    }
  }
  return results;
}

app.post("/api/admin/users/import", auth, requireAdmin, async (req, res) => {
  const { rows } = req.body || {};
  if (!Array.isArray(rows) || !rows.length) {
    return res.status(400).json({ error: "Keine Importdaten vorhanden." });
  }
  const results = await importAdminUsersFromRows(rows);
  return res.json(results);
});

app.post("/api/admin/users/import-mitarbeiter", auth, requireAdmin, async (req, res) => {
  const { rows } = req.body || {};
  if (!Array.isArray(rows) || !rows.length) {
    return res.status(400).json({ error: "Keine Importdaten vorhanden." });
  }
  const results = await importAdminUsersFromRows(rows);
  return res.json(results);
});

app.delete("/api/admin/users/:id", auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (String(id) === String(req.user.sub)) {
    return res.status(400).json({ error: "Eigenen Admin-Benutzer nicht loeschen." });
  }
  await pool.query("DELETE FROM users WHERE id = $1", [id]);
  return res.json({ ok: true });
});

app.get(/.*/, (req, res, next) => {
  if (String(req.path || "").startsWith("/backcasting")) return next();
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
