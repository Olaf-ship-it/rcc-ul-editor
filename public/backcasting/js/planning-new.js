/* planning-new.js -- Phase-1-basierte Meilensteinplanung */

let _p1SummaryCache = null;
let _p1SummaryRefreshFailed = false;
let _p1SkillCategoriesCache = null;

async function loadP1SkillCategories() {
  if (_p1SkillCategoriesCache) return _p1SkillCategoriesCache;
  try {
    const resp = await fetch("/api/skill-categories", { credentials: "include" });
    if (!resp.ok) {
      _p1SkillCategoriesCache = { tech: [], soft: [] };
      return _p1SkillCategoriesCache;
    }
    _p1SkillCategoriesCache = await resp.json();
    return _p1SkillCategoriesCache;
  } catch (_e) {
    _p1SkillCategoriesCache = { tech: [], soft: [] };
    return _p1SkillCategoriesCache;
  }
}

function p1SkillCategoryOptions(kind, selectedId, selectedName) {
  const cats = kind === "soft"
    ? (_p1SkillCategoriesCache?.soft || [])
    : (_p1SkillCategoriesCache?.tech || []);
  let html = '<option value="">\u2013 Bitte w\u00e4hlen \u2013</option>';
  cats.forEach(function (c) {
    const id = String(c.id || "");
    const name = String(c.name || "").trim();
    const selected = (selectedId && id === String(selectedId))
      || (!selectedId && name && name === String(selectedName || "").trim());
    html += '<option value="' + escAttr(id) + '" data-name="' + escAttr(name) + '"' + (selected ? " selected" : "") + ">" + escAttr(name) + "</option>";
  });
  return html;
}

function p1SkillLevelOptions(selected) {
  let html = '<option value="">\u2013</option>';
  for (let lvl = 1; lvl <= 5; lvl += 1) {
    html += '<option value="' + lvl + '"' + (Number(selected) === lvl ? " selected" : "") + ">" + lvl + "</option>";
  }
  return html;
}

const P1_QUARTER_OPTIONS = ["Q1", "Q2", "Q3", "Q4"];
const P1_DEFAULT_QUARTER = "Q1";

function p1EffectiveQuarter(value) {
  const q = String(value || "").trim();
  return P1_QUARTER_OPTIONS.includes(q) ? q : P1_DEFAULT_QUARTER;
}

function p1QuarterSelectOptions(selected) {
  const current = p1EffectiveQuarter(selected);
  return P1_QUARTER_OPTIONS.map(function (q) {
    return '<option value="' + q + '"' + (current === q ? " selected" : "") + ">" + q + "</option>";
  }).join("");
}

function p1SummaryUnit() {
  if (typeof getBcSaveUnit === "function") {
    const saveUnit = String(getBcSaveUnit() || "").trim();
    if (saveUnit) return saveUnit;
  }
  const viewUnit = typeof bcViewUnit !== "undefined" ? String(bcViewUnit || "").trim() : "";
  if (viewUnit && viewUnit !== "all") return viewUnit;
  return "";
}
let _p1Initialized = false;
let _p1OpenStateBound = false;

function p1OpenStateStorageKey() {
  const unit = typeof bcViewUnit !== "undefined" ? bcViewUnit : "";
  return "rc_bc_p1_open_" + String(unit || "default");
}

function readPersistedP1OpenState() {
  try {
    const raw = sessionStorage.getItem(p1OpenStateStorageKey());
    if (!raw) return {};
    const state = JSON.parse(raw);
    return normalizeP1OpenState(state && typeof state === "object" ? state : {});
  } catch (_e) {
    return {};
  }
}

function writePersistedP1OpenState(state) {
  try {
    sessionStorage.setItem(p1OpenStateStorageKey(), JSON.stringify(normalizeP1OpenState(state || {})));
  } catch (_e) {
    /* ignore */
  }
}

function normalizeP1OpenState(state) {
  const next = {
    areas: Array.isArray(state.areas) ? state.areas.slice() : [],
    subcats: Array.isArray(state.subcats) ? state.subcats.slice() : [],
    orgSections: Array.isArray(state.orgSections) ? state.orgSections.slice() : [],
    categorySections: Array.isArray(state.categorySections) ? state.categorySections.slice() : [],
    accs: Array.isArray(state.accs) ? state.accs.slice() : [],
    milestones: Array.isArray(state.milestones) ? state.milestones.slice() : [],
  };
  ["portfolio"].forEach(function (areaKey) {
    const prefix = "p1cat_" + areaKey + "_";
    const cats = next.categorySections.filter(function (id) { return id.indexOf(prefix) === 0; });
    if (cats.length > 1) {
      next.categorySections = next.categorySections.filter(function (id) { return id.indexOf(prefix) !== 0; });
      next.categorySections.push(cats[cats.length - 1]);
    }
  });
  const orgIds = next.orgSections.filter(function (id) {
    return id === "p1org_gliederungen" || id === "p1org_rollen";
  });
  if (orgIds.length > 1) {
    next.orgSections = next.orgSections.filter(function (id) {
      return id !== "p1org_gliederungen" && id !== "p1org_rollen";
    });
    next.orgSections.push(orgIds[orgIds.length - 1]);
  }
  return next;
}

const P1_ORG_SECTIONS = [
  { key: "gliederungen", label: "Organisatorische Gliederung" },
  { key: "rollen", label: "Rollen in der Unit", hint: "Wie viele Personen haben welche Rolle?" },
];

const P1_PORTFOLIO_LABELS = {
  produkte: "Produkte",
  services: "Services",
  loesungen: "L\u00f6sungen",
  partnergeschaeft: "Partnergesch\u00e4ft",
  projektgeschaeft: "Projektgesch\u00e4ft",
};

const P1_PORTFOLIO_SECTIONS = Object.keys(P1_PORTFOLIO_LABELS).map(function (key) {
  return { key: key, label: P1_PORTFOLIO_LABELS[key] };
});

function getP1PortfolioSections() {
  const fromCache = (_p1SummaryCache && _p1SummaryCache.portfolio) || [];
  const cacheByKey = {};
  fromCache.forEach(function (p) {
    if (p.subcategory) cacheByKey[p.subcategory] = p;
  });
  return P1_PORTFOLIO_SECTIONS.map(function (sec) {
    const p1 = cacheByKey[sec.key];
    return { key: sec.key, label: (p1 && p1.label) || sec.label };
  });
}

function p1AreaSectionCountLabel(areaKey, count) {
  if (areaKey === "portfolio") {
    return count + " Portfolio";
  }
  return count === 1 ? count + " Item" : count + " Items";
}

const P1_TOP_AREAS = [
  { key: "portfolio", label: "Portfolio", icon: "\ud83d\udcbc" },
  { key: "organisation", label: "Organisation", icon: "\ud83c\udfe2", sections: P1_ORG_SECTIONS },
  { key: "mitarbeiter", label: "Skills", icon: "\ud83d\udc64" },
];

const P1_FLAT_PLAN_AREAS = ["portfolio", "gliederungen", "rollen"];

function p1UsesFlatYearPlan(area) {
  return P1_FLAT_PLAN_AREAS.indexOf(area) >= 0;
}
const P1_TRACK_AREA_KEYS = ["portfolio", "gliederungen", "rollen", "mitarbeiter"];
const P1_CATEGORIZED_AREAS = ["portfolio"];

let _p1AddModalArea = null;
let _p1AddModalCategory = null;

function p1EmptyTracks() {
  return { portfolio: [], gliederungen: [], rollen: [], mitarbeiter: [] };
}

function p1AreaAddLabel(areaKey) {
  if (areaKey === "portfolio") return "Portfolio";
  if (areaKey === "gliederungen") return "Gliederung";
  if (areaKey === "rollen") return "Rolle";
  if (areaKey === "mitarbeiter") return "Mitarbeiter";
  return "Item";
}

function p1EntityKindForArea(area) {
  if (area === "portfolio") return "portfolio";
  if (area === "gliederungen") return "orgGliederung";
  if (area === "rollen") return "orgRolle";
  if (area === "mitarbeiter") return "employee";
  return "planItem";
}

function p1BuildEntityRef(area, track) {
  if (!track) return null;
  if (track.entityRef && track.entityRef.id) return track.entityRef;
  if (area === "portfolio") {
    if (track.phase1Id) return { kind: "portfolio", id: String(track.phase1Id) };
    if (track.itemId) return { kind: "planItem", id: String(track.itemId) };
  }
  if (area === "gliederungen" || area === "rollen") {
    if (track.orgItemId) return { kind: p1EntityKindForArea(area), id: String(track.orgItemId) };
  }
  if (area === "mitarbeiter" && track.skillEntryId) {
    return { kind: "employee", id: String(track.skillEntryId) };
  }
  return null;
}

function p1ApplyEntityRefToTrack(area, track) {
  const next = Object.assign({}, track || {});
  const entityRef = p1BuildEntityRef(area, next);
  if (entityRef) next.entityRef = entityRef;
  if (entityRef?.kind === "portfolio") next.phase1Id = entityRef.id;
  if (entityRef?.kind === "planItem") next.itemId = entityRef.id;
  if (entityRef?.kind === "orgGliederung" || entityRef?.kind === "orgRolle") next.orgItemId = entityRef.id;
  if (entityRef?.kind === "employee") next.skillEntryId = entityRef.id;
  return next;
}

function p1EntityIdFromTrack(area, track) {
  const ref = p1BuildEntityRef(area, track);
  if (ref && ref.id) return String(ref.id);
  if (area === "portfolio") {
    if (track.phase1Id) return String(track.phase1Id);
    if (track.itemId) return String(track.itemId);
    return "plan-" + p1Slug(track.category) + "-" + p1Slug(track.subcategory);
  }
  if (area === "mitarbeiter" && track.skillEntryId) return String(track.skillEntryId);
  if ((area === "gliederungen" || area === "rollen") && track.orgItemId) return String(track.orgItemId);
  return String(track.subcategory || "");
}

function resolveEntityLabel(area, track) {
  if (!track) return "\u2013";
  if (area === "portfolio") {
    const p1 = findPortfolioPhase1Item(track);
    if (p1) return p1.bezeichnung;
  } else if (area === "mitarbeiter") {
    const p1 = findEmployeePhase1Item(track);
    if (p1) return p1.name;
  } else if (area === "gliederungen" || area === "rollen") {
    const p1 = findOrgPhase1Item(area, track);
    if (p1) return p1.subcategory || track.subcategory;
  }
  return track.subcategory || "\u2013";
}

function p1IsCategorizedArea(areaKey) {
  return P1_CATEGORIZED_AREAS.indexOf(areaKey) >= 0;
}

function p1Slug(value) {
  return String(value || "").replace(/[^a-zA-Z0-9]/g, "_");
}

function p1TrackMeasureId(area, track) {
  return p1EntityIdFromTrack(area, track);
}

function p1Key(area, trackOrSub, yr) {
  if (typeof trackOrSub === "object" && trackOrSub) {
    return "P1||" + area + "||" + p1TrackMeasureId(area, trackOrSub) + "||" + yr;
  }
  return "P1||" + area + "||" + trackOrSub + "||" + yr;
}

function encodeP1TrackRef(area, track) {
  const t = p1ApplyEntityRefToTrack(area, track);
  return encodeURIComponent(JSON.stringify({
    a: area,
    c: t.category || "",
    s: t.subcategory || "",
    p: t.phase1Id || "",
    i: t.itemId || "",
    si: t.skillItemId || "",
    oi: t.orgItemId || "",
    se: t.skillEntryId || "",
    e: t.entityRef || null,
  }));
}

function decodeP1TrackRef(ref) {
  try {
    const o = JSON.parse(decodeURIComponent(ref));
    const track = {
      category: o.c || undefined,
      subcategory: o.s || "",
      phase1Id: o.p || undefined,
      itemId: o.i || undefined,
      skillItemId: o.si || undefined,
      orgItemId: o.oi || undefined,
      skillEntryId: o.se || undefined,
      entityRef: o.e || undefined,
      source: o.p || o.si || o.oi || o.se ? "phase1" : "plan",
    };
    return {
      area: o.a,
      track: p1ApplyEntityRefToTrack(o.a, track),
    };
  } catch (e) {
    return null;
  }
}

function portfolioTrackUsesPhase1Item(track, item) {
  if (!track || !item || !item.id) return false;
  if (track.phase1Id && String(track.phase1Id) === String(item.id)) return true;
  const ref = track.entityRef;
  return Boolean(ref && ref.kind === "portfolio" && String(ref.id) === String(item.id));
}

function p1TracksMatch(area, a, b) {
  if (!a || !b) return false;
  const aId = p1EntityIdFromTrack(area, a);
  const bId = p1EntityIdFromTrack(area, b);
  if (aId && bId) {
    if (aId !== bId) {
      if (area === "portfolio" || area === "mitarbeiter" || area === "gliederungen" || area === "rollen") {
        return false;
      }
    } else {
      if (area === "portfolio") {
        return (a.category || "") === (b.category || "");
      }
      return true;
    }
  }
  if (p1IsCategorizedArea(area)) {
    if (area === "portfolio") {
      if (a.phase1Id && b.phase1Id) return a.phase1Id === b.phase1Id;
      if (a.itemId && b.itemId) return a.itemId === b.itemId;
      return a.category === b.category && a.subcategory === b.subcategory;
    }
    if (a.itemId && b.itemId) return a.itemId === b.itemId;
    return a.category === b.category && a.subcategory === b.subcategory;
  }
  if (area === "mitarbeiter") {
    if (a.skillEntryId && b.skillEntryId) return a.skillEntryId === b.skillEntryId;
  }
  if ((area === "gliederungen" || area === "rollen") && a.orgItemId && b.orgItemId) {
    return a.orgItemId === b.orgItemId;
  }
  if (area === "gliederungen" || area === "rollen") {
    if (a.orgItemId && b.subcategory) {
      const p1 = findOrgPhase1Item(area, a);
      if (p1 && p1.subcategory === b.subcategory) return true;
    }
    if (b.orgItemId && a.subcategory) {
      const p1 = findOrgPhase1Item(area, b);
      if (p1 && p1.subcategory === a.subcategory) return true;
    }
  }
  return a.subcategory === b.subcategory;
}

function getP1Tracks(areaKey, categoryKey) {
  plan.meta = plan.meta || {};
  const tracks = plan.meta.p1Tracks;
  if (!tracks || !Array.isArray(tracks[areaKey])) return [];
  const list = tracks[areaKey];
  if (!categoryKey) return list;
  return list.filter(function (t) { return t.category === categoryKey; });
}

function getPortfolioItems(categoryKey) {
  return ((_p1SummaryCache && _p1SummaryCache.portfolioItems) || []).filter(function (item) {
    return item.category === categoryKey;
  });
}

function findPortfolioPhase1Item(track) {
  const items = _p1SummaryCache?.portfolioItems || [];
  if (track.phase1Id) {
    return items.find(function (i) { return i.id === track.phase1Id; });
  }
  return items.find(function (i) {
    return i.category === track.category && i.bezeichnung === track.subcategory;
  });
}

function findEmployeePhase1Item(track) {
  const items = _p1SummaryCache?.employees || [];
  if (track.skillEntryId) {
    return items.find(function (i) { return i.skillEntryId === track.skillEntryId; });
  }
  return items.find(function (i) { return i.name === track.subcategory; });
}

function findOrgPhase1Item(areaKey, track) {
  const items = _p1SummaryCache?.[areaKey] || [];
  if (track.orgItemId) {
    return items.find(function (i) { return i.id === track.orgItemId; });
  }
  return items.find(function (i) { return i.subcategory === track.subcategory; });
}

function collectMilestoneTracks(areaKey) {
  const tracks = [];
  const seen = [];
  Object.values(plan.measures || {}).forEach(function (list) {
    (list || []).forEach(function (m) {
      if (!m || m.kind !== "p1Year" || m.area !== areaKey) return;
      const track = p1ApplyEntityRefToTrack(areaKey, {
        category: m.category,
        subcategory: m.subcategory,
        phase1Id: m.phase1Id,
        itemId: m.itemId,
        skillItemId: m.skillItemId,
        orgItemId: m.orgItemId,
        skillEntryId: m.skillEntryId,
        entityRef: m.entityRef,
        personalnummer: m.personalnummer,
        source: m.phase1Id || m.skillItemId || m.orgItemId || m.skillEntryId ? "phase1" : "plan",
      });
      if (!seen.some(function (t) { return p1TracksMatch(areaKey, t, track); })) {
        seen.push(track);
        tracks.push(track);
      }
    });
  });
  return tracks;
}

function collectMeasureKeyTracks(areaKey) {
  const tracks = [];
  const seen = [];
  const prefix = "P1||" + areaKey + "||";
  Object.keys(plan.measures || {}).forEach(function (key) {
    if (key.indexOf(prefix) !== 0) return;
    const parts = key.split("||");
    if (parts.length < 4) return;
    const segmentId = parts[2];
    const entries = plan.measures[key] || [];
    const m = entries.find(function (row) { return row && row.kind === "p1Year"; }) || entries[0];
    let track;
    if (m) {
      track = p1ApplyEntityRefToTrack(areaKey, {
        category: m.category,
        subcategory: m.subcategory || segmentId,
        phase1Id: m.phase1Id,
        itemId: m.itemId,
        skillItemId: m.skillItemId,
        orgItemId: m.orgItemId,
        skillEntryId: m.skillEntryId,
        entityRef: m.entityRef,
        personalnummer: m.personalnummer,
        source: m.phase1Id || m.skillItemId || m.orgItemId || m.skillEntryId ? "phase1" : "plan",
      });
    } else {
      track = p1ApplyEntityRefToTrack(areaKey, {
        subcategory: segmentId,
        source: /^[0-9a-f-]{36}$/i.test(segmentId) ? "phase1" : "plan",
        orgItemId: /^[0-9a-f-]{36}$/i.test(segmentId) ? segmentId : undefined,
      });
    }
    if (!seen.some(function (t) { return p1TracksMatch(areaKey, t, track); })) {
      seen.push(track);
      tracks.push(track);
    }
  });
  return tracks;
}

function ensureP1TrackAreaArrays() {
  if (!plan.meta.p1Tracks) return;
  P1_TRACK_AREA_KEYS.forEach(function (areaKey) {
    if (!Array.isArray(plan.meta.p1Tracks[areaKey])) {
      plan.meta.p1Tracks[areaKey] = [];
    }
  });
}

function reconcileP1TracksFromMeasures(areaKeys) {
  ensureP1Tracks();
  let added = 0;
  (areaKeys || ["gliederungen", "rollen"]).forEach(function (areaKey) {
    const candidates = [];
    const seen = [];
    function addCandidate(track) {
      const applied = p1ApplyEntityRefToTrack(areaKey, track);
      if (!applied.subcategory && !applied.orgItemId) return;
      if (seen.some(function (t) { return p1TracksMatch(areaKey, t, applied); })) return;
      seen.push(applied);
      candidates.push(applied);
    }
    collectMilestoneTracks(areaKey).forEach(addCandidate);
    collectMeasureKeyTracks(areaKey).forEach(addCandidate);

    const hasMeasureKeys = Object.keys(plan.measures || {}).some(function (key) {
      return key.indexOf("P1||" + areaKey + "||") === 0;
    });
    const existing = plan.meta.p1Tracks[areaKey] || [];

    if (hasMeasureKeys && candidates.length && !existing.length) {
      plan.meta.p1Tracks[areaKey] = candidates.slice();
      added += candidates.length;
      candidates.forEach(function (track) {
        seedP1TrackMilestonesForAllYears(areaKey, track);
      });
      return;
    }

    candidates.forEach(function (track) {
      if (hasP1Track(areaKey, track)) return;
      plan.meta.p1Tracks[areaKey].push(track);
      seedP1TrackMilestonesForAllYears(areaKey, track);
      added++;
    });
  });
  return added;
}

function dedupeP1TracksArea(areaKey) {
  const list = plan.meta.p1Tracks?.[areaKey];
  if (!Array.isArray(list)) return;
  const next = [];
  list.forEach(function (track) {
    if (!next.some(function (t) { return p1TracksMatch(areaKey, t, track); })) {
      next.push(track);
    }
  });
  plan.meta.p1Tracks[areaKey] = next;
}

function p1LegacyMeasurePrefixes(areaKey, track) {
  const ids = new Set();
  const canonId = p1TrackMeasureId(areaKey, track);
  if (canonId) ids.add(String(canonId));
  if (track?.subcategory) ids.add(String(track.subcategory));
  if (track?.orgItemId) ids.add(String(track.orgItemId));
  return Array.from(ids).map(function (id) {
    return "P1||" + areaKey + "||" + id + "||";
  });
}

function trackHasMilestones(areaKey, track) {
  return p1LegacyMeasurePrefixes(areaKey, track).some(function (prefix) {
    return Object.keys(plan.measures || {}).some(function (k) {
      return k.indexOf(prefix) === 0 && (plan.measures[k] || []).length > 0;
    });
  });
}

function phase1ItemHasIstData(areaKey, item) {
  if (!item) return false;
  if (areaKey === "portfolio") {
    return (item.umsatz_teur || 0) > 0;
  }
  if (areaKey === "gliederungen" || areaKey === "rollen") {
    return Boolean(String(item.subcategory || "").trim());
  }
  if (areaKey === "mitarbeiter") {
    return Boolean(item && (item.skillEntryId || item.name));
  }
  return false;
}

function getPhase1SummaryItem(areaKey, subcategory) {
  return getPhase1SummaryItems(areaKey).find(function (item) {
    return item.subcategory === subcategory;
  });
}

function shouldKeepP1Track(areaKey, track) {
  if (track.source === "plan") return true;
  if (trackHasMilestones(areaKey, track)) return true;
  if (areaKey === "portfolio") return phase1ItemHasIstData(areaKey, findPortfolioPhase1Item(track));
  if (areaKey === "mitarbeiter") return phase1ItemHasIstData(areaKey, findEmployeePhase1Item(track));
  return phase1ItemHasIstData(areaKey, findOrgPhase1Item(areaKey, track) || getPhase1SummaryItem(areaKey, track.subcategory));
}

function trimP1TracksArea(tracks, areaKey) {
  if (!tracks[areaKey]) return;
  tracks[areaKey] = tracks[areaKey].filter(function (track) {
    return shouldKeepP1Track(areaKey, track);
  });
}

function isLegacyCategoryTrack(areaKey, track) {
  if (track.category) return false;
  if (areaKey === "portfolio") return Object.prototype.hasOwnProperty.call(P1_PORTFOLIO_LABELS, track.subcategory);
  return false;
}

function migrateLegacyMeasureKeys(areaKey, oldSub, newTrack) {
  const oldPrefix = "P1||" + areaKey + "||" + oldSub + "||";
  const newPrefix = "P1||" + areaKey + "||" + p1TrackMeasureId(areaKey, newTrack) + "||";
  Object.keys(plan.measures || {}).forEach(function (key) {
    if (key.indexOf(oldPrefix) !== 0) return;
    const yr = key.slice(oldPrefix.length);
    const entries = plan.measures[key] || [];
    delete plan.measures[key];
    const newKey = newPrefix + yr;
    entries.forEach(function (m) {
      if (!m || m.kind !== "p1Year") return;
      if (p1IsCategorizedArea(areaKey)) {
        m.category = newTrack.category;
        m.subcategory = newTrack.subcategory;
        if (newTrack.phase1Id) m.phase1Id = newTrack.phase1Id;
        if (newTrack.itemId) m.itemId = newTrack.itemId;
        if (newTrack.skillItemId) m.skillItemId = newTrack.skillItemId;
        if (newTrack.orgItemId) m.orgItemId = newTrack.orgItemId;
        if (newTrack.skillEntryId) m.skillEntryId = newTrack.skillEntryId;
        if (newTrack.entityRef) m.entityRef = newTrack.entityRef;
      } else if (areaKey === "gliederungen" || areaKey === "rollen") {
        if (newTrack.subcategory) m.subcategory = newTrack.subcategory;
        if (newTrack.orgItemId) m.orgItemId = newTrack.orgItemId;
        if (newTrack.entityRef) m.entityRef = newTrack.entityRef;
      }
    });
    plan.measures[newKey] = entries;
  });
}

function migratePortfolioToItemLevel(tracks) {
  const areaKey = "portfolio";
  if (!tracks[areaKey]) tracks[areaKey] = [];
  const next = [];
  tracks[areaKey].forEach(function (track) {
    if (!isLegacyCategoryTrack(areaKey, track)) {
      next.push(track);
      return;
    }
    const catKey = track.subcategory;
    const catLabel = P1_PORTFOLIO_LABELS[catKey] || catKey;
    const newTrack = {
      category: catKey,
      subcategory: "Gesamt " + catLabel,
      source: track.source || "plan",
      itemId: "legacy-" + p1Slug(catKey),
    };
    migrateLegacyMeasureKeys(areaKey, catKey, newTrack);
    if (trackHasMilestones(areaKey, newTrack) || track.source === "plan") {
      next.push(newTrack);
    }
  });
  tracks[areaKey] = next;
}

function seedP1TracksArea(tracks, seen, areaKey) {
  if (!tracks[areaKey]) tracks[areaKey] = [];
  if (!seen[areaKey]) seen[areaKey] = [];

  function trackSeen(track) {
    return seen[areaKey].some(function (t) { return p1TracksMatch(areaKey, t, track); });
  }

  function addTrack(track) {
    if (!track.subcategory || trackSeen(track)) return;
    seen[areaKey].push(track);
    tracks[areaKey].push(track);
  }

  collectMilestoneTracks(areaKey).forEach(function (track) {
    addTrack(track);
  });

  if (areaKey === "portfolio") {
    (_p1SummaryCache?.portfolioItems || []).forEach(function (item) {
      if (!phase1ItemHasIstData(areaKey, item)) return;
      addTrack({
        category: item.category,
        subcategory: item.bezeichnung,
        phase1Id: item.id,
        source: "phase1",
      });
    });
  } else if (areaKey === "mitarbeiter") {
    /* Mitarbeiter nur manuell über + Mitarbeiter aus Phase 1 übernehmen */
  } else {
    ((_p1SummaryCache && _p1SummaryCache[areaKey]) || []).forEach(function (item) {
      if (!phase1ItemHasIstData(areaKey, item)) return;
      addTrack(p1ApplyEntityRefToTrack(areaKey, {
        subcategory: item.subcategory,
        orgItemId: item.id,
        source: "phase1",
      }));
    });
  }
}

function syncP1TracksFromPhase1(areaKeys) {
  if (!_p1SummaryCache) return 0;
  ensureP1Tracks();
  let added = 0;
  (areaKeys || ["gliederungen", "rollen"]).forEach(function (areaKey) {
    if (areaKey === "portfolio") {
      (_p1SummaryCache.portfolioItems || []).forEach(function (item) {
        if (!phase1ItemHasIstData(areaKey, item)) return;
        const track = p1ApplyEntityRefToTrack(areaKey, {
          category: item.category,
          subcategory: item.bezeichnung,
          phase1Id: item.id,
          source: "phase1",
        });
        if (hasP1Track(areaKey, track)) return;
        if (!plan.meta.p1Tracks[areaKey]) plan.meta.p1Tracks[areaKey] = [];
        plan.meta.p1Tracks[areaKey].push(track);
        seedP1TrackMilestonesForAllYears(areaKey, track);
        added++;
      });
      return;
    }
    if (areaKey === "mitarbeiter") return;
    getPhase1SummaryItems(areaKey).forEach(function (item) {
      if (!phase1ItemHasIstData(areaKey, item)) return;
      const track = p1ApplyEntityRefToTrack(areaKey, {
        subcategory: item.subcategory,
        orgItemId: item.id,
        source: "phase1",
      });
      if (hasP1Track(areaKey, track)) return;
      if (!plan.meta.p1Tracks[areaKey]) plan.meta.p1Tracks[areaKey] = [];
      plan.meta.p1Tracks[areaKey].push(track);
      seedP1TrackMilestonesForAllYears(areaKey, track);
      added++;
    });
  });
  return added;
}

function migrateTrackEntityRef(areaKey, track) {
  const t = Object.assign({}, track);
  if (areaKey === "portfolio") {
    if (t.phase1Id && !t.entityRef) t.entityRef = { kind: "portfolio", id: String(t.phase1Id) };
    else if (t.itemId && !t.entityRef) t.entityRef = { kind: "planItem", id: String(t.itemId) };
  } else if (areaKey === "gliederungen" || areaKey === "rollen") {
    if (!t.orgItemId && _p1SummaryCache) {
      const item = (_p1SummaryCache[areaKey] || []).find(function (i) { return i.subcategory === t.subcategory; });
      if (item && item.id) t.orgItemId = item.id;
    }
    if (t.orgItemId && !t.entityRef) {
      t.entityRef = { kind: p1EntityKindForArea(areaKey), id: String(t.orgItemId) };
    }
  } else if (areaKey === "mitarbeiter") {
    if (!t.skillEntryId && _p1SummaryCache) {
      const item = (_p1SummaryCache.employees || []).find(function (i) { return i.name === t.subcategory; });
      if (item && item.skillEntryId) {
        t.skillEntryId = item.skillEntryId;
        t.personalnummer = item.personalnummer;
      }
    }
    if (t.skillEntryId && !t.entityRef) t.entityRef = { kind: "employee", id: String(t.skillEntryId) };
  }
  return p1ApplyEntityRefToTrack(areaKey, t);
}

function migrateP1TracksToEntityRefs() {
  const tracks = plan.meta.p1Tracks;
  if (!tracks) return;
  P1_TRACK_AREA_KEYS.forEach(function (areaKey) {
    if (!tracks[areaKey]) tracks[areaKey] = [];
    tracks[areaKey] = tracks[areaKey].map(function (track) {
      const oldId = p1TrackMeasureId(areaKey, track);
      const updated = migrateTrackEntityRef(areaKey, track);
      const newId = p1TrackMeasureId(areaKey, updated);
      if (oldId !== newId) migrateLegacyMeasureKeys(areaKey, oldId, updated);
      return updated;
    });
  });
  Object.keys(plan.measures || {}).forEach(function (key) {
    (plan.measures[key] || []).forEach(function (m) {
      if (!m || m.kind !== "p1Year") return;
      const updated = migrateTrackEntityRef(m.area, {
        category: m.category,
        subcategory: m.subcategory,
        phase1Id: m.phase1Id,
        itemId: m.itemId,
        skillItemId: m.skillItemId,
        orgItemId: m.orgItemId,
        skillEntryId: m.skillEntryId,
        entityRef: m.entityRef,
      });
      if (updated.entityRef) m.entityRef = updated.entityRef;
      if (updated.phase1Id) m.phase1Id = updated.phase1Id;
      if (updated.skillItemId) m.skillItemId = updated.skillItemId;
      if (updated.orgItemId) m.orgItemId = updated.orgItemId;
      if (updated.skillEntryId) m.skillEntryId = updated.skillEntryId;
    });
  });
}

function migrateP1TracksIfNeeded() {
  plan.meta = plan.meta || {};
  if (plan.meta.p1TracksMigration === "v7") return;

  if (!plan.meta.p1Tracks && plan.meta.p1OrgTracks) {
    plan.meta.p1Tracks = p1EmptyTracks();
    plan.meta.p1Tracks.gliederungen = (plan.meta.p1OrgTracks.gliederungen || []).slice();
    plan.meta.p1Tracks.rollen = (plan.meta.p1OrgTracks.rollen || []).slice();
  }

  if (plan.meta.p1TracksMigration !== "v4" && plan.meta.p1Tracks) {
    const tracks = plan.meta.p1Tracks;
    const seen = {};
    P1_TRACK_AREA_KEYS.forEach(function (areaKey) {
      trimP1TracksArea(tracks, areaKey);
      seen[areaKey] = (tracks[areaKey] || []).slice();
    });
    plan.meta.p1TracksMigration = "v4";
  }

  if (plan.meta.p1Tracks && plan.meta.p1TracksMigration !== "v5") {
    migratePortfolioToItemLevel(plan.meta.p1Tracks);
    const tracks = plan.meta.p1Tracks;
    const seen = {};
    P1_TRACK_AREA_KEYS.forEach(function (areaKey) {
      seen[areaKey] = (tracks[areaKey] || []).slice();
    });
    if (!tracks.portfolio || !tracks.portfolio.length) {
      seedP1TracksArea(tracks, seen, "portfolio");
    }
    plan.meta.p1TracksMigration = "v5";
  }

  if (!plan.meta.p1Tracks) {
    plan.meta.p1Tracks = p1EmptyTracks();
  }
  if (!plan.meta.p1Tracks.mitarbeiter) plan.meta.p1Tracks.mitarbeiter = [];

  if (plan.meta.p1TracksMigration !== "v6") {
    migrateP1TracksToEntityRefs();
    plan.meta.p1TracksMigration = "v6";
  }

  if (plan.meta.p1Tracks) {
    if (plan.meta.p1Tracks.skills) delete plan.meta.p1Tracks.skills;
    Object.keys(plan.measures || {}).forEach(function (key) {
      if (key.indexOf("P1||skills||") === 0) delete plan.measures[key];
    });
  }
  plan.meta.p1TracksMigration = "v7";
}

function ensureP1Tracks() {
  plan.meta = plan.meta || {};
  migrateP1TracksIfNeeded();
  if (plan.meta.p1Tracks != null) {
    ensureP1TrackAreaArrays();
    return;
  }

  const tracks = p1EmptyTracks();
  const seen = {};
  P1_TRACK_AREA_KEYS.forEach(function (areaKey) {
    seen[areaKey] = [];
    seedP1TracksArea(tracks, seen, areaKey);
  });

  plan.meta.p1Tracks = tracks;
}

function mergeTrackWithPhase1(areaKey, track) {
  if (areaKey === "portfolio") {
    const p1 = findPortfolioPhase1Item(track);
    if (p1) {
      return {
        category: track.category,
        subcategory: track.subcategory,
        label: p1.bezeichnung,
        source: track.source,
        phase1Id: track.phase1Id || p1.id,
        itemId: track.itemId,
        entityRef: track.entityRef || { kind: "portfolio", id: p1.id },
        verantwortlich: String(track.verantwortlich || "").trim(),
        _hasPhase1: true,
        umsatz_teur: p1.umsatz_teur || 0,
        ampel: p1.ampel || "",
      };
    }
    return {
      category: track.category,
      subcategory: track.subcategory,
      label: track.subcategory,
      source: track.source,
      phase1Id: track.phase1Id,
      itemId: track.itemId,
      verantwortlich: String(track.verantwortlich || "").trim(),
      _hasPhase1: false,
      umsatz_teur: 0,
    };
  }

  if (areaKey === "mitarbeiter") {
    const p1 = findEmployeePhase1Item(track);
    if (p1) {
      return {
        subcategory: track.subcategory,
        label: p1.name,
        source: track.source,
        skillEntryId: track.skillEntryId || p1.skillEntryId,
        personalnummer: p1.personalnummer,
        entityRef: track.entityRef || { kind: "employee", id: p1.skillEntryId },
        _hasPhase1: true,
        skillCount: p1.skillCount || 0,
        avgLevel: p1.avgLevel || 0,
        zertifiziert: p1.zertifiziert || "",
        skills: p1.skills || [],
        softSkills: p1.softSkills || [],
      };
    }
    return {
      subcategory: track.subcategory,
      label: track.subcategory || "\u2013",
      source: track.source,
      skillEntryId: track.skillEntryId,
      entityRef: track.entityRef,
      _hasPhase1: false,
      skillCount: 0,
      avgLevel: 0,
    };
  }

  const p1 = findOrgPhase1Item(areaKey, track);
  if (p1) {
    return Object.assign({}, p1, {
      label: p1.subcategory || track.subcategory,
      orgItemId: track.orgItemId || p1.id,
      entityRef: track.entityRef || (p1.id ? { kind: p1EntityKindForArea(areaKey), id: p1.id } : undefined),
      source: track.source,
      verantwortlich: String(track.verantwortlich || "").trim(),
      _hasPhase1: true,
    });
  }
  return {
    subcategory: track.subcategory,
    label: track.subcategory || "\u2013",
    source: track.source,
    orgItemId: track.orgItemId,
    verantwortlich: String(track.verantwortlich || "").trim(),
    entityRef: track.entityRef,
    _hasPhase1: false,
    count: 0,
    umsatz_teur: 0,
    headcount: 0,
    anzahl: 0,
    avgLevel: 0,
    employeeCount: 0,
  };
}

function canonicalP1Track(areaKey, track) {
  if (!track) return track;
  const merged = _p1SummaryCache ? mergeTrackWithPhase1(areaKey, track) : track;
  return p1ApplyEntityRefToTrack(areaKey, merged);
}

function p1TrackMetaFromCanonical(areaKey, track) {
  const c = canonicalP1Track(areaKey, track);
  const meta = {
    category: c.category,
    subcategory: c.subcategory,
    source: c.source || track.source || "plan",
  };
  if (c.phase1Id) meta.phase1Id = c.phase1Id;
  if (c.itemId) meta.itemId = c.itemId;
  if (c.entityRef) meta.entityRef = c.entityRef;
  if (c.orgItemId) meta.orgItemId = c.orgItemId;
  if (c.skillEntryId) meta.skillEntryId = c.skillEntryId;
  if (c.personalnummer) meta.personalnummer = c.personalnummer;
  if (c.skillItemId) meta.skillItemId = c.skillItemId;
  if (areaKey === "portfolio" || areaKey === "gliederungen" || areaKey === "rollen") {
    meta.verantwortlich = String(c.verantwortlich || track.verantwortlich || "").trim();
  }
  return meta;
}

function normalizeP1TracksInMeta() {
  if (!_p1SummaryCache) return false;
  ensureP1Tracks();
  let changed = false;
  P1_TRACK_AREA_KEYS.forEach(function (areaKey) {
    const list = plan.meta.p1Tracks[areaKey];
    if (!Array.isArray(list)) return;
    plan.meta.p1Tracks[areaKey] = list.map(function (track) {
      const oldId = p1TrackMeasureId(areaKey, track);
      const next = p1TrackMetaFromCanonical(areaKey, track);
      const newId = p1TrackMeasureId(areaKey, next);
      if (oldId !== newId) {
        migrateLegacyMeasureKeys(areaKey, oldId, next);
        changed = true;
      }
      return next;
    });
  });
  return changed;
}

function p1SameMoveGroup(areaKey, a, b) {
  if (areaKey === "portfolio") return (a.category || "") === (b.category || "");
  return true;
}

function p1MoveTrackInList(areaKey, track, delta) {
  ensureP1Tracks();
  const list = plan.meta.p1Tracks[areaKey];
  if (!Array.isArray(list) || !list.length) return false;
  const idx = list.findIndex(function (t) { return p1TracksMatch(areaKey, t, track); });
  if (idx < 0) return false;
  let swapIdx = -1;
  if (delta < 0) {
    for (let i = idx - 1; i >= 0; i -= 1) {
      if (p1SameMoveGroup(areaKey, list[idx], list[i])) {
        swapIdx = i;
        break;
      }
    }
  } else {
    for (let i = idx + 1; i < list.length; i += 1) {
      if (p1SameMoveGroup(areaKey, list[idx], list[i])) {
        swapIdx = i;
        break;
      }
    }
  }
  if (swapIdx < 0) return false;
  const tmp = list[idx];
  list[idx] = list[swapIdx];
  list[swapIdx] = tmp;
  return true;
}

function p1TrackMovePosition(areaKey, track) {
  ensureP1Tracks();
  const list = plan.meta.p1Tracks[areaKey] || [];
  const idx = list.findIndex(function (t) { return p1TracksMatch(areaKey, t, track); });
  if (idx < 0) return { index: -1, total: 0, canUp: false, canDown: false };
  let groupIndex = 0;
  let groupTotal = 0;
  list.forEach(function (t, i) {
    if (!p1SameMoveGroup(areaKey, list[idx], t)) return;
    groupTotal += 1;
    if (i === idx) groupIndex = groupTotal - 1;
  });
  return {
    index: groupIndex,
    total: groupTotal,
    canUp: groupIndex > 0,
    canDown: groupIndex >= 0 && groupIndex < groupTotal - 1,
  };
}

function getP1SectionItems(areaKey, categoryKey) {
  ensureP1Tracks();
  return getP1Tracks(areaKey, categoryKey).map(function (track) {
    return mergeTrackWithPhase1(areaKey, track);
  });
}

function getPhase1SummaryItems(areaKey) {
  return ((_p1SummaryCache && _p1SummaryCache[areaKey]) || []).filter(function (item) {
    return item.subcategory;
  });
}

function getPhase1CandidatesForAdoption(areaKey, categoryKey) {
  ensureP1Tracks();
  const adopted = getP1Tracks(areaKey, categoryKey);
  if (areaKey === "portfolio") {
    return getPortfolioItems(categoryKey).filter(function (item) {
      return !adopted.some(function (t) {
        return portfolioTrackUsesPhase1Item(t, item);
      });
    });
  }
  if (areaKey === "mitarbeiter") {
    return ((_p1SummaryCache && _p1SummaryCache.employees) || []).filter(function (item) {
      return !adopted.some(function (t) {
        return t.skillEntryId === item.skillEntryId || t.subcategory === item.name;
      });
    });
  }
  const adoptedIds = new Set(adopted.map(function (t) { return t.orgItemId || t.subcategory; }));
  return getPhase1SummaryItems(areaKey).filter(function (item) {
    return !adoptedIds.has(item.id) && !adoptedIds.has(item.subcategory);
  });
}

function hasP1Track(areaKey, track) {
  ensureP1Tracks();
  return getP1Tracks(areaKey).some(function (t) { return p1TracksMatch(areaKey, t, track); });
}

function addP1Track(areaKey, track) {
  if (!requireBcSaveUnit()) return false;
  ensureP1Tracks();
  const applied = p1ApplyEntityRefToTrack(areaKey, track);
  if (!applied.subcategory) return false;
  if (hasP1Track(areaKey, applied)) return false;
  if (!plan.meta.p1Tracks[areaKey]) plan.meta.p1Tracks[areaKey] = [];
  plan.meta.p1Tracks[areaKey].push(applied);
  if (p1ShouldSeedTrackYears(areaKey)) {
    seedP1TrackMilestonesForAllYears(areaKey, applied);
  }
  if (areaKey === "mitarbeiter") {
    seedP1EmployeeSkillYearsForTrack(areaKey, applied);
  }
  return true;
}

function normalizeP1EmployeeSkillRows(e) {
  const tech = Array.isArray(e?.skills) ? e.skills : [];
  const soft = Array.isArray(e?.softSkills) ? e.softSkills : [];
  return {
    skills: tech.map(function (s) {
      return {
        kind: "tech",
        kategorie: String(s.kategorie || "Sonstiges").trim(),
        technologie: String(s.technologie || s.label || "").trim() || "\u2013",
        level: Number.isFinite(Number(s.level)) ? Number(s.level) : null,
        skillItemId: s.skillItemId || null,
        kategorie_id: s.kategorie_id != null ? Number(s.kategorie_id) : null,
        bemerkungen: String(s.bemerkungen || s.bemerkung || "").trim(),
      };
    }),
    softSkills: soft.map(function (s) {
      return {
        kind: "soft",
        kategorie: String(s.kategorie || "Sonstiges").trim(),
        level: Number.isFinite(Number(s.level)) ? Number(s.level) : null,
        kategorie_id: s.kategorie_id != null ? Number(s.kategorie_id) : null,
        bemerkungen: String(s.bemerkungen || s.bemerkung || "").trim(),
      };
    }),
  };
}

function p1IstSkillRowHasContent(row) {
  if (!row) return false;
  const level = Number(row.level);
  return (Number.isFinite(level) && level >= 1) || String(row.bemerkungen || "").trim() !== "";
}

function p1IstSkillCatalogRowTemplate(cat, kind) {
  return {
    skillPlanKind: kind,
    kategorie_id: Number(cat.id),
    kategorie: String(cat.name || "").trim(),
    level: null,
    bemerkungen: "",
    technologie: "",
  };
}

function buildP1EmployeeIstSkillMatrix(employeeItem) {
  const techSaved = employeeItem?.skills || [];
  const softSaved = employeeItem?.softSkills || [];

  function mergeKind(catalog, kind, savedList) {
    const savedByCatId = new Map();
    const extras = [];

    savedList.forEach(function (s) {
      if (!s) return;
      const id = s.kategorie_id != null ? Number(s.kategorie_id) : null;
      const inCatalog = Number.isInteger(id) && id > 0 && catalog.some(function (c) {
        return Number(c.id) === id;
      });
      const normalized = {
        skillPlanKind: kind,
        kategorie_id: inCatalog ? id : null,
        kategorie: String(s.kategorie || "").trim(),
        level: Number.isFinite(Number(s.level)) ? Number(s.level) : null,
        bemerkungen: String(s.bemerkungen || s.bemerkung || "").trim(),
        technologie: String(s.technologie || "").trim(),
        _legacy: !inCatalog,
      };
      if (inCatalog) {
        if (!savedByCatId.has(id)) savedByCatId.set(id, normalized);
        else extras.push(normalized);
      } else if (p1IstSkillRowHasContent(normalized)) {
        extras.push(normalized);
      }
    });

    const matrix = catalog.map(function (cat) {
      return savedByCatId.get(Number(cat.id)) || p1IstSkillCatalogRowTemplate(cat, kind);
    });
    return matrix.concat(extras);
  }

  const techCats = _p1SkillCategoriesCache?.tech || [];
  const softCats = _p1SkillCategoriesCache?.soft || [];
  return mergeKind(techCats, "tech", techSaved).concat(mergeKind(softCats, "soft", softSaved));
}

function buildP1EmployeesFromSkillEntries(skillEntries) {
  return (skillEntries || [])
    .filter(function (e) {
      return e && e.id && (e.nachname || e.vorname || e.name || e.personalnummer);
    })
    .map(function (e) {
      const tech = Array.isArray(e.skills) ? e.skills : [];
      const soft = Array.isArray(e.softSkills) ? e.softSkills : [];
      const levels = tech.concat(soft)
        .map(function (s) { return Number(s.level); })
        .filter(function (n) { return Number.isFinite(n); });
      const avgLevel = levels.length
        ? Math.round((levels.reduce(function (a, b) { return a + b; }, 0) / levels.length) * 10) / 10
        : 0;
      const vor = String(e.vorname || "").trim();
      const nach = String(e.nachname || "").trim();
      const name = nach && vor ? nach + ", " + vor : String(e.name || nach || vor || "\u2013").trim();
      const skillRows = normalizeP1EmployeeSkillRows(e);
      return {
        skillEntryId: e.id,
        personalnummer: String(e.personalnummer || "").trim() || null,
        name: name,
        vorname: e.vorname || "",
        nachname: e.nachname || "",
        skillCount: tech.length + soft.length,
        avgLevel: avgLevel,
        zertifiziert: e.zertifiziert || "",
        skills: skillRows.skills,
        softSkills: skillRows.softSkills,
      };
    })
    .sort(function (a, b) { return String(a.name).localeCompare(String(b.name), "de"); });
}

async function supplementP1EmployeesFromEntries(unit) {
  try {
    const resp = await fetch("/api/entries", { credentials: "include" });
    if (!resp.ok) return [];
    const all = await resp.json();
    const skills = all.filter(function (e) {
      return e && e.type === "skill" && String(e.unit || "").trim() === unit;
    });
    return buildP1EmployeesFromSkillEntries(skills);
  } catch (_e) {
    return [];
  }
}

async function ensureP1SummaryEmployees(unit) {
  if (!_p1SummaryCache || typeof _p1SummaryCache !== "object") return;
  const employees = Array.isArray(_p1SummaryCache.employees) ? _p1SummaryCache.employees : [];
  const needsSkillDetails = employees.some(function (e) {
    return (e.skillCount || 0) > 0 && !(e.skills && e.skills.length) && !(e.softSkills && e.softSkills.length);
  });
  if (!employees.length || needsSkillDetails) {
    const supplement = await supplementP1EmployeesFromEntries(unit);
    if (!supplement.length) return;
    if (!employees.length) {
      _p1SummaryCache.employees = supplement;
      return;
    }
    const byId = new Map(supplement.map(function (e) { return [String(e.skillEntryId), e]; }));
    _p1SummaryCache.employees = employees.map(function (e) {
      const full = byId.get(String(e.skillEntryId));
      if (!full) return e;
      return Object.assign({}, e, {
        skills: full.skills || e.skills || [],
        softSkills: full.softSkills || e.softSkills || [],
      });
    });
  }
}

async function refreshP1SummaryCache() {
  const unit = p1SummaryUnit();
  if (!unit) {
    _p1SummaryRefreshFailed = true;
    return false;
  }
  try {
    const resp = await fetch("/api/backcasting/phase1-summary?unit=" + encodeURIComponent(unit), { credentials: "include" });
    if (!resp.ok) {
      _p1SummaryRefreshFailed = true;
      return false;
    }
    _p1SummaryCache = await resp.json();
    await ensureP1SummaryEmployees(unit);
    await loadP1SkillCategories();
    _p1SummaryRefreshFailed = false;
    return true;
  } catch (e) {
    _p1SummaryRefreshFailed = true;
    return false;
  }
}

function p1MilestoneHasPlanContent(ms, area) {
  if (!ms) return false;
  if (area === "mitarbeiter" && ms.skillPlanKind) {
    return p1IsSkillLevelExplicit(ms) || String(ms.ergebnis || "").trim() !== "";
  }
  if (!p1UsesFlatYearPlan(area) && String(ms.bezeichnung || "").trim()) return true;
  if (String(ms.ergebnis || "").trim()) return true;
  if (ms.ziel_headcount != null || ms.ziel_umsatz_teur != null || ms.ziel_anzahl != null) return true;
  if (String(ms.ziel_quartal || "").trim()) return true;
  if (!p1UsesFlatYearPlan(area) && String(ms.verantwortlich || "").trim()) return true;
  return false;
}

function measureListContentScore(list, area) {
  return (list || []).reduce(function (score, ms) {
    return score + (p1MilestoneHasPlanContent(ms, area) ? 10 : 1);
  }, 0);
}

function trackMatchesMeasureSegment(area, track, segmentId) {
  const seg = String(segmentId || "");
  if (!seg) return false;
  const prefixes = p1LegacyMeasurePrefixes(area, track).concat(p1LegacyMeasurePrefixes(area, canonicalP1Track(area, track)));
  return prefixes.some(function (prefix) {
    return prefix === "P1||" + area + "||" + seg + "||";
  });
}

function getP1EntriesFromMeasures(area, track, yr) {
  const canonical = canonicalP1Track(area, track);
  const canonicalKey = p1Key(area, canonical, yr);
  let bestKey = null;
  let bestList = null;
  let bestScore = -1;

  Object.keys(plan.measures || {}).forEach(function (key) {
    const parts = key.split("||");
    if (parts.length < 4 || parts[0] !== "P1" || parts[1] !== area || parts[3] !== String(yr)) return;
    if (!trackMatchesMeasureSegment(area, track, parts[2])) return;
    const list = plan.measures[key] || [];
    if (!list.length) return;
    const score = measureListContentScore(list, area);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
      bestList = list;
    }
  });

  if (!bestList) return [];

  if (bestKey !== canonicalKey) {
    plan.measures[canonicalKey] = bestList;
    if (bestKey) delete plan.measures[bestKey];
    Object.keys(plan.measures || {}).forEach(function (key) {
      if (key === canonicalKey) return;
      const parts = key.split("||");
      if (parts.length < 4 || parts[0] !== "P1" || parts[1] !== area || parts[3] !== String(yr)) return;
      if (!trackMatchesMeasureSegment(area, track, parts[2])) return;
      delete plan.measures[key];
    });
  }

  return Array.isArray(bestList) ? bestList.slice() : [bestList];
}

function getP1Entries(area, track, yr) {
  const list = getP1EntriesFromMeasures(area, track, yr);
  if (area !== "mitarbeiter") return list;
  return ensureP1EmployeeSkillCatalog(area, track, yr, list);
}

function setP1Entries(area, track, yr, arr) {
  if (!requireBcSaveUnit()) return;
  const canonical = canonicalP1Track(area, track);
  plan.measures[p1Key(area, canonical, yr)] = arr;
}

function p1MilestoneTemplate(area, track, yr) {
  const applied = p1ApplyEntityRefToTrack(area, track);
  const defaultBezeichnung = area === "portfolio"
    ? String(applied.subcategory || resolveEntityLabel(area, applied) || "").trim()
    : "";
  const base = {
    id: uid(),
    kind: "p1Year",
    area: area,
    subcategory: applied.subcategory,
    jahr: yr,
    bezeichnung: defaultBezeichnung,
    ergebnis: "",
    verantwortlich: "",
    ziel_quartal: P1_DEFAULT_QUARTER,
  };
  if (applied.entityRef) base.entityRef = applied.entityRef;
  if (p1IsCategorizedArea(area)) {
    base.category = applied.category;
    if (applied.phase1Id) base.phase1Id = applied.phase1Id;
    if (applied.itemId) base.itemId = applied.itemId;
    if (applied.skillItemId) base.skillItemId = applied.skillItemId;
  }
  if (applied.orgItemId) base.orgItemId = applied.orgItemId;
  if (applied.skillEntryId) base.skillEntryId = applied.skillEntryId;
  if (applied.personalnummer) base.personalnummer = applied.personalnummer;
  if (area === "portfolio") {
    base.ziel_umsatz_teur = null;
  } else if (area === "gliederungen") {
    base.ziel_headcount = null;
    base.ziel_umsatz_teur = null;
  } else if (area === "rollen") {
    base.ziel_anzahl = null;
  } else if (area === "mitarbeiter") {
    base.ziel_skill_level_min = null;
  }
  return base;
}

function p1ShouldSeedTrackYears(areaKey) {
  return areaKey === "portfolio" || areaKey === "gliederungen" || areaKey === "rollen";
}

function seedP1TrackMilestonesForAllYears(areaKey, track) {
  if (!p1ShouldSeedTrackYears(areaKey)) return 0;
  let added = 0;
  YEARS.forEach(function (yr) {
    const entries = getP1Entries(areaKey, track, yr);
    if (entries.length) return;
    setP1Entries(areaKey, track, yr, [p1MilestoneTemplate(areaKey, track, yr)]);
    added++;
  });
  return added;
}

function ensureP1TrackYearCoverage() {
  let total = 0;
  ensureP1Tracks();
  ["portfolio", "gliederungen", "rollen"].forEach(function (areaKey) {
    (getP1Tracks(areaKey) || []).forEach(function (track) {
      total += seedP1TrackMilestonesForAllYears(areaKey, track);
    });
  });
  return total;
}

function p1EmployeeSkillPlanTemplate(area, track, yr, skillPlanKind) {
  const base = p1MilestoneTemplate(area, track, yr);
  base.skillPlanKind = skillPlanKind === "soft" ? "soft" : "tech";
  base.kategorie = "";
  base.kategorie_id = null;
  base.technologie = "";
  base.kompetenz = "";
  base.bezeichnung = "";
  base.ergebnis = "";
  base.ziel_skill_level_min = 1;
  base.skill_level_explicit = false;
  return base;
}

function p1IsSkillLevelExplicit(ms) {
  if (!ms) return false;
  if (ms.skill_level_explicit === true) return true;
  const n = Number(ms.ziel_skill_level_min);
  return Number.isFinite(n) && n >= 2 && n <= 5;
}

function p1SkillLevelPickerState(ms) {
  return {
    level: p1EffectiveSkillLevel(ms),
    explicit: p1IsSkillLevelExplicit(ms),
  };
}

function p1NormalizeSkillLevelExplicit(ms) {
  if (!ms) return ms;
  ms.skill_level_explicit = p1IsSkillLevelExplicit(ms);
  return ms;
}

function p1EffectiveSkillLevel(ms) {
  const n = Number(ms?.ziel_skill_level_min);
  if (Number.isFinite(n) && n >= 1 && n <= 5) return Math.round(n);
  return 1;
}

function p1EmployeeSkillCatalogTemplate(area, track, yr, cat, kind) {
  const base = p1EmployeeSkillPlanTemplate(area, track, yr, kind);
  base.kategorie_id = Number(cat.id);
  base.kategorie = String(cat.name || "").trim();
  base.ziel_skill_level_min = 1;
  base.skill_level_explicit = false;
  base.bezeichnung = base.kategorie;
  return base;
}

function p1IsCatalogSkillEntry(ms, kind) {
  if (!ms || ms.skillPlanKind !== kind) return false;
  const id = Number(ms.kategorie_id);
  if (!Number.isInteger(id) || id <= 0) return false;
  const catalog = kind === "soft"
    ? (_p1SkillCategoriesCache?.soft || [])
    : (_p1SkillCategoriesCache?.tech || []);
  return catalog.some(function (c) { return Number(c.id) === id; });
}

function p1EmployeeSkillEntryHasLegacyContent(ms) {
  return Boolean(
    String(ms?.technologie || "").trim()
      || String(ms?.kompetenz || "").trim()
      || String(ms?.verantwortlich || "").trim()
      || String(ms?.ziel_quartal || "").trim()
      || p1IsSkillLevelExplicit(ms)
      || String(ms?.ergebnis || "").trim()
  );
}

function buildP1EmployeeSkillMatrix(savedEntries, area, track, yr) {
  const saved = Array.isArray(savedEntries) ? savedEntries : [];

  function mergeKind(catalog, kind) {
    const savedByCatId = new Map();
    const extras = [];

    saved.forEach(function (ms) {
      if (!ms || ms.skillPlanKind !== kind) return;
      if (p1IsCatalogSkillEntry(ms, kind)) {
        const id = Number(ms.kategorie_id);
        if (!savedByCatId.has(id)) {
          const copy = Object.assign({}, ms);
          copy.ziel_skill_level_min = p1EffectiveSkillLevel(copy);
          copy.kategorie = String(copy.kategorie || "").trim();
          copy.bezeichnung = copy.kategorie;
          p1NormalizeSkillLevelExplicit(copy);
          savedByCatId.set(id, copy);
        } else {
          extras.push(ms);
        }
        return;
      }
      if (p1EmployeeSkillEntryHasLegacyContent(ms)) {
        const legacy = Object.assign({}, ms);
        legacy._legacy = true;
        extras.push(legacy);
      }
    });

    const matrix = catalog.map(function (cat) {
      return savedByCatId.get(Number(cat.id)) || p1EmployeeSkillCatalogTemplate(area, track, yr, cat, kind);
    });
    return matrix.concat(extras);
  }

  const techCats = _p1SkillCategoriesCache?.tech || [];
  const softCats = _p1SkillCategoriesCache?.soft || [];
  return mergeKind(techCats, "tech").concat(mergeKind(softCats, "soft"));
}

function p1EmployeeSkillMatrixNeedsSync(saved, merged) {
  if (!Array.isArray(saved) || !Array.isArray(merged)) return true;
  if (saved.length !== merged.length) return true;
  for (let i = 0; i < merged.length; i += 1) {
    const a = merged[i];
    const b = saved[i];
    if (!b) return true;
    if (String(a.skillPlanKind || "") !== String(b.skillPlanKind || "")) return true;
    if (Number(a.kategorie_id) !== Number(b.kategorie_id)) return true;
    if (p1EffectiveSkillLevel(a) !== p1EffectiveSkillLevel(b)) return true;
    if (p1IsSkillLevelExplicit(a) !== p1IsSkillLevelExplicit(b)) return true;
    if (String(a.kategorie || "") !== String(b.kategorie || "")) return true;
  }
  return false;
}

function ensureP1EmployeeSkillCatalog(area, track, yr, currentList) {
  const saved = currentList != null ? currentList.slice() : getP1EntriesFromMeasures(area, track, yr);
  const merged = buildP1EmployeeSkillMatrix(saved, area, track, yr);
  if (p1EmployeeSkillMatrixNeedsSync(saved, merged) && requireBcSaveUnit()) {
    setP1Entries(area, track, yr, merged);
  }
  return merged;
}

function seedP1EmployeeSkillYearsForTrack(areaKey, track) {
  if (areaKey !== "mitarbeiter") return 0;
  let added = 0;
  YEARS.forEach(function (yr) {
    const before = getP1EntriesFromMeasures(areaKey, track, yr).length;
    ensureP1EmployeeSkillCatalog(areaKey, track, yr, []);
    const after = getP1EntriesFromMeasures(areaKey, track, yr).length;
    if (!before && after) added += 1;
  });
  return added;
}

function ensureP1EmployeeSkillCatalogAllYears() {
  let changed = 0;
  ensureP1Tracks();
  (getP1Tracks("mitarbeiter") || []).forEach(function (track) {
    YEARS.forEach(function (yr) {
      const before = JSON.stringify(getP1EntriesFromMeasures("mitarbeiter", track, yr));
      ensureP1EmployeeSkillCatalog("mitarbeiter", track, yr);
      const after = JSON.stringify(getP1EntriesFromMeasures("mitarbeiter", track, yr));
      if (before !== after) changed += 1;
    });
  });
  return changed;
}

function p1EmployeeSkillPlanTitle(ms) {
  if (!ms || !ms.skillPlanKind) return p1MilestoneTitle(ms);
  const kat = String(ms.kategorie || "").trim();
  if (ms.skillPlanKind === "tech") {
    const tech = String(ms.technologie || "").trim();
    if (kat && tech) return kat + " \u00b7 " + tech;
    if (kat || tech) return kat || tech;
    return "Fachskill ausw\u00e4hlen\u2026";
  }
  const detail = String(ms.kompetenz || "").trim();
  if (kat && detail) return kat + " \u00b7 " + detail;
  if (kat || detail) return kat || detail;
  return "Soft Skill ausw\u00e4hlen\u2026";
}

function p1EmployeeSkillPlanHasContent(ms) {
  return p1MilestoneHasPlanContent(ms, "mitarbeiter");
}

function findEmployeeIstSkillLevel(employeeItem, ms) {
  if (!employeeItem || !ms || !ms.skillPlanKind) return null;
  if (ms.skillPlanKind === "soft") {
    const match = (employeeItem.softSkills || []).find(function (s) {
      if (ms.kategorie_id && s.kategorie_id) return String(s.kategorie_id) === String(ms.kategorie_id);
      return String(s.kategorie || "").trim() === String(ms.kategorie || "").trim();
    });
    return match && match.level != null ? Number(match.level) : null;
  }
  const match = (employeeItem.skills || []).find(function (s) {
    if (ms.kategorie_id && s.kategorie_id) return String(s.kategorie_id) === String(ms.kategorie_id);
    if (ms.skillItemId && s.skillItemId) return String(s.skillItemId) === String(ms.skillItemId);
    const sameKat = String(s.kategorie || "").trim() === String(ms.kategorie || "").trim();
    const tech = String(ms.technologie || "").trim();
    const sTech = String(s.technologie || "").trim();
    return sameKat && (!tech || !sTech || tech === sTech);
  });
  return match && match.level != null ? Number(match.level) : null;
}

function p1NormalizeEmployeeSkillPlanEntry(ms) {
  if (!ms || !ms.skillPlanKind) return ms;
  ms.ziel_skill_level_min = p1EffectiveSkillLevel(ms);
  p1NormalizeSkillLevelExplicit(ms);
  if (ms.skillEntryId) {
    const emp = (_p1SummaryCache?.employees || []).find(function (e) {
      return String(e.skillEntryId) === String(ms.skillEntryId);
    });
    if (emp && ms.skillPlanKind === "tech") {
      const match = (emp.skills || []).find(function (s) {
        if (ms.kategorie_id && s.kategorie_id) return String(s.kategorie_id) === String(ms.kategorie_id);
        const sameKat = String(s.kategorie || "").trim() === String(ms.kategorie || "").trim();
        const tech = String(ms.technologie || "").trim();
        const sTech = String(s.technologie || "").trim();
        return sameKat && (!tech || !sTech || tech === sTech);
      });
      if (match && match.skillItemId) ms.skillItemId = match.skillItemId;
    }
  }
  ms.bezeichnung = String(ms.kategorie || p1EmployeeSkillPlanTitle(ms)).trim();
  return ms;
}

function p1KpiFields(area) {
  if (area === "portfolio") return [["ziel_umsatz_teur", "Ziel-Umsatz (TEUR)", "number"]];
  if (area === "gliederungen") return [["ziel_headcount", "Ziel-Headcount", "number"], ["ziel_umsatz_teur", "Ziel-Umsatz (TEUR)", "number"]];
  if (area === "rollen") return [["ziel_anzahl", "Ziel-Anzahl", "number"]];
  if (area === "mitarbeiter") return [["ziel_skill_level_min", "Ziel-\u00d8-Level (1\u20135)", "number"]];
  return [];
}

function p1NormalizeNumericFieldValue(field, rawValue) {
  const raw = String(rawValue == null ? "" : rawValue).trim();
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (field === "ziel_umsatz_teur" || field === "ziel_headcount" || field === "ziel_anzahl") {
    return Math.max(0, n);
  }
  return n;
}

function p1IstBadge(area, item) {
  if (area === "portfolio") {
    return Math.round(item.umsatz_teur || 0) + " TEUR";
  }
  if (area === "gliederungen") {
    return (item.headcount || 0) + " HC \u00b7 " + Math.round(item.umsatz_teur || 0) + " TEUR";
  }
  if (area === "rollen") return (item.anzahl || 0) + " MA";
  if (area === "mitarbeiter") {
    return (item.skillCount || 0) + " Skills \u00b7 \u00d8 " + (item.avgLevel || 0);
  }
  return "";
}

function p1BlockDomId(area, track) {
  const idPart = p1TrackMeasureId(area, track).replace(/[^a-zA-Z0-9]/g, "_");
  return "p1block_" + area + "_" + idPart;
}

function p1MilestoneDomId(area, track, yr, idx) {
  const idPart = p1TrackMeasureId(area, track).replace(/[^a-zA-Z0-9]/g, "_");
  return "p1ms_" + area + "_" + idPart + "_" + yr + "_" + idx;
}

function p1EmployeeSkillYearCountText(area, track, yr) {
  const entries = getP1Entries(area, track, yr);
  const total = entries.length;
  if (!total) return "leer";
  let filled = 0;
  entries.forEach(function (ms) {
    if (p1MilestoneHasPlanContent(ms, area)) filled += 1;
  });
  return filled + "/" + total + " bewertet";
}

function p1YearMilestoneCountText(count, area, track, yr) {
  if (area === "mitarbeiter" && track && yr != null) {
    return p1EmployeeSkillYearCountText(area, track, yr);
  }
  if (area === "mitarbeiter") return count ? count + " Skill(s)" : "leer";
  return count ? count + " Meilenstein(e)" : "leer";
}

function p1TrackMilestoneCountLabel(area, track) {
  let total = 0;
  let filled = 0;
  YEARS.forEach(function (yr) {
    getP1Entries(area, track, yr).forEach(function (ms) {
      total += 1;
      if (p1MilestoneHasPlanContent(ms, area)) filled += 1;
    });
  });
  if (!total) return p1YearMilestoneCountText(0, area);
  if (area === "mitarbeiter") {
    return filled + "/" + total + " bewertet";
  }
  if (filled > 0) return filled + " mit Planung \u00b7 " + total + " Jahr(e)";
  return total + " Jahr(e) \u00b7 noch ohne Planung";
}

function countP1TrackMilestones(area, track) {
  let total = 0;
  YEARS.forEach(function (yr) {
    total += getP1Entries(area, track, yr).length;
  });
  return total;
}

/* ---------- Planungsstatus-Übersicht (Register „Review“) ---------- */

const P1_OVERVIEW_AREAS = [
  { key: "portfolio", label: "Portfolio", mandatory: false },
  { key: "gliederungen", label: "Organisation · Gliederungen", mandatory: false },
  { key: "rollen", label: "Organisation · Rollen", mandatory: false },
  { key: "mitarbeiter", label: "Mitarbeiter · Skills", mandatory: true },
];

function p1OverviewYearState(areaKey, track, yr) {
  const entries = getP1Entries(areaKey, track, yr) || [];
  const total = entries.length;
  const filled = entries.filter(function (ms) { return p1MilestoneHasPlanContent(ms, areaKey); }).length;
  const complete = areaKey === "mitarbeiter" ? (total > 0 && filled === total) : filled > 0;
  return { total: total, filled: filled, complete: complete };
}

function p1OverviewMitarbeiterItems() {
  const tracks = getP1Tracks("mitarbeiter") || [];
  const trackByEntryId = {};
  tracks.forEach(function (t) {
    const id = t.skillEntryId || (t.entityRef && t.entityRef.kind === "employee" ? t.entityRef.id : null);
    if (id) trackByEntryId[String(id)] = t;
  });
  const employees = (_p1SummaryCache && _p1SummaryCache.employees) || [];
  return employees
    .map(function (emp) {
      const totalSkills = (emp.skills ? emp.skills.length : 0) + (emp.softSkills ? emp.softSkills.length : 0);
      if (!totalSkills) return null; // kein Skill-Profil in Phase 1 -> keine Basis, nicht zu planen
      const track = emp.skillEntryId ? trackByEntryId[String(emp.skillEntryId)] : null;
      const years = {};
      YEARS.forEach(function (yr) {
        years[yr] = track
          ? p1OverviewYearState("mitarbeiter", track, yr)
          : { total: totalSkills, filled: 0, complete: false };
      });
      return { track: track || null, label: emp.name || "–", years: years };
    })
    .filter(Boolean)
    .sort(function (a, b) { return String(a.label).localeCompare(String(b.label), "de"); });
}

function buildP1OverviewModel() {
  ensureP1Tracks();
  return P1_OVERVIEW_AREAS.map(function (def) {
    const items = def.key === "mitarbeiter"
      ? p1OverviewMitarbeiterItems()
      : (getP1Tracks(def.key) || []).map(function (track) {
          const years = {};
          YEARS.forEach(function (yr) { years[yr] = p1OverviewYearState(def.key, track, yr); });
          return { track: track, label: resolveEntityLabel(def.key, track) || "–", years: years };
        }).sort(function (a, b) { return String(a.label).localeCompare(String(b.label), "de"); });
    const yearTotals = {};
    YEARS.forEach(function (yr) {
      yearTotals[yr] = {
        planned: items.filter(function (it) { return it.years[yr].complete; }).length,
        total: items.length,
      };
    });
    const fullyPlanned = items.filter(function (it) {
      return YEARS.every(function (yr) { return it.years[yr].complete; });
    }).length;
    return Object.assign({}, def, { items: items, yearTotals: yearTotals, fullyPlanned: fullyPlanned });
  });
}

async function ensureP1OverviewDataLoaded() {
  if (isBcViewAll()) return false;
  if (!_p1SummaryCache) {
    await initPlanungNew();
  } else {
    ensureP1Tracks();
  }
  return Boolean(_p1SummaryCache);
}

function consolidateOrgMeasureKeys() {
  const before = JSON.stringify(plan.measures || {});
  ["gliederungen", "rollen"].forEach(function (areaKey) {
    (getP1Tracks(areaKey) || []).forEach(function (track) {
      YEARS.forEach(function (yr) {
        getP1Entries(areaKey, track, yr);
      });
    });
  });
  return JSON.stringify(plan.measures || {}) !== before;
}

function renderP1OrgIstHint(area, item) {
  if (!item || !item._hasPhase1) return "";
  let html = '<div class="p1-org-ist-hint">';
  html += '<span class="p1-org-ist-hint__label">Phase 1 IST</span> ';
  if (area === "gliederungen") {
    html += "<span><b>" + escAttr(String(item.headcount || 0)) + " HC</b></span>";
    if (item.umsatz_teur) {
      html += ' <span class="p1-org-ist-hint__sep">\u00b7</span> <span><b>' + escAttr(String(item.umsatz_teur)) + " TEUR</b></span>";
    }
  } else if (area === "rollen") {
    html += "<span><b>" + escAttr(String(item.anzahl || 0)) + " Personen</b></span>";
  }
  html += "</div>";
  return html;
}

function removeP1TrackMeasures(area, track) {
  Object.keys(plan.measures || {}).forEach(function (key) {
    const parts = key.split("||");
    if (parts.length < 4 || parts[0] !== "P1" || parts[1] !== area) return;
    if (!trackMatchesMeasureSegment(area, track, parts[2])) return;
    delete plan.measures[key];
  });
}

function p1MsIconBtn(className, title, onclick, svg) {
  const label = title || "";
  if (typeof bcMsIconBtn === "function") {
    return bcMsIconBtn(className, label, onclick, svg);
  }
  return (
    '<button type="button" class="bc-ms-icon-btn ' + className + ' no-print"' +
    ' title="' + escAttr(label) + '" aria-label="' + escAttr(label) + '"' +
    ' onclick="' + onclick + '">' + svg + "</button>"
  );
}

function p1SaveBtn(onclick, title) {
  const svg = typeof BC_SVG_SAVE !== "undefined" ? BC_SVG_SAVE
    : '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
  return p1MsIconBtn("bc-ms-icon-btn--save", title || "Speichern", onclick, svg);
}

function p1TrashBtn(onclick, title) {
  const label = title || "L\u00f6schen";
  const svg = typeof BC_SVG_TRASH !== "undefined" ? BC_SVG_TRASH
    : '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
  return p1MsIconBtn("bc-ms-icon-btn--delete", label, onclick, svg);
}

function p1EditBtn(onclick, title) {
  const label = title || "Bezeichnung \u00e4ndern";
  const svg = typeof BC_SVG_EDIT !== "undefined" ? BC_SVG_EDIT
    : '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  return p1MsIconBtn("bc-ms-icon-btn--edit", label, onclick, svg);
}

const P1_SVG_UP =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
const P1_SVG_DOWN =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

function p1MoveBtn(onclick, title, svg, disabled) {
  const label = title || "";
  if (typeof bcMsIconBtn === "function") {
    const btn = bcMsIconBtn("bc-ms-icon-btn--move", label, onclick, svg);
    if (disabled) {
      return btn.replace("<button ", '<button disabled aria-disabled="true" ');
    }
    return btn;
  }
  const dis = disabled ? ' disabled aria-disabled="true"' : "";
  return (
    '<button type="button" class="bc-ms-icon-btn bc-ms-icon-btn--move no-print"' +
    dis +
    ' title="' + escAttr(label) + '" aria-label="' + escAttr(label) + '"' +
    ' onclick="' + onclick + '">' + svg + "</button>"
  );
}

function p1PortfolioMilestoneTitle(ms, yr) {
  const text = String(ms?.ergebnis || "").trim();
  if (text) {
    const firstLine = text.split("\n")[0].trim();
    if (firstLine.length <= 96) return firstLine;
    return firstLine.slice(0, 93) + "\u2026";
  }
  return yr ? "Beschreibung f\u00fcr " + yr + "\u2026" : "Beschreibung eingeben\u2026";
}

function p1MilestoneTitle(ms, area, yr) {
  if (area === "portfolio") return p1PortfolioMilestoneTitle(ms, yr);
  const bez = String(ms?.bezeichnung || "").trim();
  if (bez) {
    return bez.length <= 96 ? bez : bez.slice(0, 93) + "\u2026";
  }
  const text = String(ms?.ergebnis || "").trim();
  if (!text) return "Bezeichnung eingeben\u2026";
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length <= 96) return firstLine;
  return firstLine.slice(0, 93) + "\u2026";
}

function p1TrackDomId(area, track) {
  return "p1_track_" + p1TrackMeasureId(area, track).replace(/[^a-zA-Z0-9]/g, "_");
}

function p1FlatTrackCountLabel(area, track) {
  let filled = 0;
  YEARS.forEach(function (yr) {
    getP1Entries(area, track, yr).forEach(function (ms) {
      if (p1MilestoneHasPlanContent(ms, area)) filled += 1;
    });
  });
  if (!filled) return YEARS.length + " Jahre \u00b7 noch offen";
  return filled + "/" + YEARS.length + " Jahre geplant";
}

function p1FlatTrackMetaTitle(area) {
  if (area === "portfolio") return "Produkt";
  if (area === "gliederungen") return "Bereich";
  if (area === "rollen") return "Rolle";
  return "Eintrag";
}

function p1FlatTrackDeleteLabel(area) {
  if (area === "portfolio") return "Produkt aus Planung entfernen";
  if (area === "gliederungen") return "Bereich aus Planung entfernen";
  if (area === "rollen") return "Rolle aus Planung entfernen";
  return "Eintrag aus Planung entfernen";
}

function p1FlatPlanColumns(area) {
  if (area === "portfolio") {
    return [
      { key: "desc", head: "Beschreibung", className: "p1-flat-plan__desc" },
      { key: "ziel_umsatz_teur", head: "Ziel-Umsatz (TEUR)", className: "p1-flat-plan__kpi p1-flat-plan__kpi--umsatz" },
      { key: "ziel_quartal", head: "Ziel-Quartal", className: "p1-flat-plan__quarter" },
    ];
  }
  if (area === "gliederungen") {
    return [
      { key: "desc", head: "Beschreibung", className: "p1-flat-plan__desc" },
      { key: "ziel_headcount", head: "Ziel-Headcount", className: "p1-flat-plan__kpi p1-flat-plan__kpi--hc" },
      { key: "ziel_umsatz_teur", head: "Ziel-Umsatz (TEUR)", className: "p1-flat-plan__kpi p1-flat-plan__kpi--umsatz" },
      { key: "ziel_quartal", head: "Ziel-Quartal", className: "p1-flat-plan__quarter" },
    ];
  }
  if (area === "rollen") {
    return [
      { key: "desc", head: "Beschreibung", className: "p1-flat-plan__desc" },
      { key: "ziel_anzahl", head: "Ziel-Anzahl", className: "p1-flat-plan__kpi p1-flat-plan__kpi--anzahl" },
      { key: "ziel_quartal", head: "Ziel-Quartal", className: "p1-flat-plan__quarter" },
    ];
  }
  return [];
}

function renderP1FlatTrackMeta(area, track, item) {
  const ref = encodeP1TrackRef(area, track);
  const domId = p1TrackDomId(area, track);
  const label = item.label || item.subcategory || "";
  const verantwortlich = item.verantwortlich || track.verantwortlich || "";
  const istBadge = item._hasPhase1 ? p1IstBadge(area, item) : "";
  let html = '<div class="p1-flat-track-meta">';
  html += '<div class="p1-flat-track-meta__head">';
  html += '<span class="p1-flat-track-meta__title">' + escAttr(p1FlatTrackMetaTitle(area)) + "</span>";
  if (istBadge) {
    html += '<span class="p1-flat-track-meta__ist">Phase 1 IST: <strong>' + escAttr(istBadge) + "</strong></span>";
  }
  html += "</div>";
  html += '<div class="p1-flat-track-meta__grid">';
  html += '<div class="p1-ms__field"><label for="' + domId + '_bezeichnung">Bezeichnung</label>';
  html += '<input type="text" id="' + domId + '_bezeichnung" value="' + escAttr(label) + '" onchange="updP1TrackField(this,\'' + escAttr(ref) + '\',\'bezeichnung\')">';
  html += '</div>';
  html += '<div class="p1-ms__field"><label for="' + domId + '_verantwortlich">Verantwortlich</label>';
  html += '<input type="text" id="' + domId + '_verantwortlich" value="' + escAttr(verantwortlich) + '" placeholder="z.\u00a0B. Unit Lead" onchange="updP1TrackField(this,\'' + escAttr(ref) + '\',\'verantwortlich\')">';
  html += "</div></div></div>";
  return html;
}

function renderP1FlatYearField(area, track, yr, ms, col, eid, ref) {
  if (col.key === "desc") {
    return '<div class="' + col.className + '">' +
      '<label class="p1-flat-plan__sr-only" for="' + eid + '_ergebnis">Beschreibung ' + yr + "</label>" +
      '<textarea id="' + eid + '_ergebnis" rows="2" placeholder="Ziel f\u00fcr ' + yr + ' beschreiben\u2026" onchange="updP1(this,\'' + escAttr(ref) + '\',' + yr + ',0,\'ergebnis\')">' + escAttr(ms.ergebnis || "") + "</textarea>" +
      "</div>";
  }
  if (col.key === "ziel_quartal") {
    return '<div class="' + col.className + '">' +
      '<label class="p1-flat-plan__sr-only" for="' + eid + '_ziel_quartal">Ziel-Quartal ' + yr + "</label>" +
      '<select id="' + eid + '_ziel_quartal" onchange="updP1(this,\'' + escAttr(ref) + '\',' + yr + ',0,\'ziel_quartal\')">' +
      p1QuarterSelectOptions(ms.ziel_quartal) +
      "</select></div>";
  }
  const val = ms[col.key];
  const minAttr = (col.key === "ziel_umsatz_teur" || col.key === "ziel_headcount" || col.key === "ziel_anzahl") ? ' min="0"' : "";
  const placeholder = col.key === "ziel_umsatz_teur" ? "TEUR" : col.key === "ziel_headcount" ? "HC" : "Anzahl";
  return '<div class="' + col.className + '">' +
    '<label class="p1-flat-plan__sr-only" for="' + eid + "_" + col.key + '">' + escAttr(col.head) + " " + yr + "</label>" +
    '<input type="number" step="1"' + minAttr + ' id="' + eid + "_" + col.key + '" value="' + (val != null ? val : "") + '" placeholder="' + placeholder + '" oninput="updP1Num(this,\'' + escAttr(ref) + '\',' + yr + ',0,\'' + col.key + '\')" onchange="updP1Num(this,\'' + escAttr(ref) + '\',' + yr + ',0,\'' + col.key + '\')">' +
    "</div>";
}

function renderP1FlatYearRow(area, track, yr) {
  const entries = getP1Entries(area, track, yr);
  const ms = entries[0] || p1MilestoneTemplate(area, track, yr);
  const ref = encodeP1TrackRef(area, track);
  const idPart = p1TrackMeasureId(area, track).replace(/[^a-zA-Z0-9]/g, "_");
  const eid = "p1_" + area + "_" + idPart + "_" + yr + "_0";
  const hasContent = p1MilestoneHasPlanContent(ms, area);
  const rowCls = hasContent
    ? "p1-flat-plan__row p1-flat-plan__row--filled"
    : "p1-flat-plan__row";
  const columns = p1FlatPlanColumns(area);

  let html = '<div class="' + rowCls + '" data-yr="' + yr + '">';
  html += '<div class="p1-flat-plan__yr">';
  html += '<span class="p1-flat-plan__yr-badge">' + yr + "</span>";
  html += '<span class="p1-flat-plan__status" title="' + (hasContent ? "Geplant" : "Noch offen") + '" aria-hidden="true"></span>';
  html += "</div>";
  columns.forEach(function (col) {
    html += renderP1FlatYearField(area, track, yr, ms, col, eid, ref);
  });
  html += "</div>";
  return html;
}

function renderP1FlatYearPlan(area, track) {
  const columns = p1FlatPlanColumns(area);
  let html = '<div class="p1-flat-plan p1-flat-plan--' + escAttr(area) + '">';
  html += '<div class="p1-flat-plan__intro">Jahresplanung \u2013 alle Planungsjahre auf einen Blick</div>';
  html += '<div class="p1-flat-plan__head p1-flat-plan__row" aria-hidden="true">';
  html += '<div class="p1-flat-plan__yr">Jahr</div>';
  columns.forEach(function (col) {
    html += '<div class="' + col.className + '">' + escAttr(col.head) + "</div>";
  });
  html += "</div>";
  html += '<div class="p1-flat-plan__body">';
  YEARS.forEach(function (yr) {
    html += renderP1FlatYearRow(area, track, yr);
  });
  html += "</div></div>";
  return html;
}

function p1ToggleFlatPlanRowFilled(el, area, ms) {
  const row = el.closest(".p1-flat-plan__row");
  if (row) row.classList.toggle("p1-flat-plan__row--filled", p1MilestoneHasPlanContent(ms, area));
}

function p1MilestoneHasContent(ms, area) {
  return p1MilestoneHasPlanContent(ms, area);
}

function p1FlushMilestoneFieldsFromDom(area, track, yr, idx, ms) {
  const idPart = p1TrackMeasureId(area, track).replace(/[^a-zA-Z0-9]/g, "_");
  const eid = "p1_" + area + "_" + idPart + "_" + yr + "_" + idx;
  const erg = document.getElementById(eid + "_ergebnis");
  if (p1UsesFlatYearPlan(area)) {
    ms.bezeichnung = resolveEntityLabel(area, track);
  } else {
    const bez = document.getElementById(eid + "_bezeichnung");
    if (bez) ms.bezeichnung = bez.value;
    const ver = document.getElementById(eid + "_verantwortlich");
    if (ver) ms.verantwortlich = ver.value;
  }
  if (erg) ms.ergebnis = erg.value;
  const quartal = document.getElementById(eid + "_ziel_quartal");
  if (quartal) ms.ziel_quartal = p1EffectiveQuarter(quartal.value);
  p1KpiFields(area).forEach(function (f) {
    const el = document.getElementById(eid + "_" + f[0]);
    if (!el) return;
    ms[f[0]] = p1NormalizeNumericFieldValue(f[0], el.value);
  });
  ms.updatedAt = new Date().toISOString();
}

function p1FlushEmployeeSkillPlanFromDom(area, track) {
  YEARS.forEach(function (yr) {
    const entries = getP1EntriesFromMeasures(area, track, yr);
    entries.forEach(function (ms, idx) {
      if (!ms || !ms.skillPlanKind) return;
      const idPart = p1TrackMeasureId(area, track).replace(/[^a-zA-Z0-9]/g, "_");
      const eid = "p1_" + area + "_" + idPart + "_" + yr + "_" + idx;
      const erg = document.getElementById(eid + "_ergebnis");
      if (erg) ms.ergebnis = erg.value;
      ms.ziel_skill_level_min = p1EffectiveSkillLevel(ms);
      p1NormalizeEmployeeSkillPlanEntry(ms);
      ms.updatedAt = new Date().toISOString();
    });
    if (entries.length) setP1Entries(area, track, yr, entries);
  });
}

function p1FlushTrackFormToPlan(area, track) {
  const canonical = canonicalP1Track(area, track);
  if (area === "mitarbeiter") {
    p1FlushEmployeeSkillPlanFromDom(area, canonical);
  } else {
    YEARS.forEach(function (yr) {
      const entries = getP1Entries(area, canonical, yr);
      entries.forEach(function (ms, idx) {
        p1FlushMilestoneFieldsFromDom(area, canonical, yr, idx, ms);
      });
      if (entries.length) setP1Entries(area, canonical, yr, entries);
    });
  }
  ensureP1Tracks();
  const list = plan.meta.p1Tracks[area];
  if (list) {
    plan.meta.p1Tracks[area] = list.map(function (t) {
      if (!p1TracksMatch(area, t, track) && !p1TracksMatch(area, t, canonical)) return t;
      return p1TrackMetaFromCanonical(area, t);
    });
  }
}

function renderP1PortfolioMilestoneForm(area, track, yr, idx, ms, forceOpen) {
  const fields = p1KpiFields(area);
  const ref = encodeP1TrackRef(area, track);
  const idPart = p1TrackMeasureId(area, track).replace(/[^a-zA-Z0-9]/g, "_");
  const eid = "p1_" + area + "_" + idPart + "_" + yr + "_" + idx;
  const mid = p1MilestoneDomId(area, track, yr, idx);
  const title = p1PortfolioMilestoneTitle(ms, yr);
  const hasContent = p1MilestoneHasContent(ms, area);
  const bodyOpen = !!forceOpen;
  const titleCls = hasContent ? "p1-ms__title" : "p1-ms__title p1-ms__title--empty";
  const bodyCls = bodyOpen ? "p1-ms__body" : "p1-ms__body closed";
  const wrapCls = bodyOpen ? "p1-ms p1-ms--open" : "p1-ms";

  let html = '<div class="' + wrapCls + '" data-ref="' + escAttr(ref) + '" data-yr="' + yr + '" data-idx="' + idx + '">';
  html += '<div class="p1-ms__head" onclick="toggleP1Ms(\'' + mid + '\')" role="button" tabindex="0" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();toggleP1Ms(\'' + mid + '\')}">';
  html += '<span class="p1-ms__chev" aria-hidden="true"></span>';
  html += '<span class="' + titleCls + '" id="' + mid + '_title">' + escAttr(title) + '</span>';
  html += '<span class="p1-ms__actions" onclick="event.stopPropagation()">';
  html += p1TrashBtn("delP1Entry('" + escAttr(ref) + "'," + yr + "," + idx + ")", "L\u00f6schen");
  html += '</span></div>';

  html += '<div id="' + mid + '" class="' + bodyCls + '">';
  html += '<div class="p1-ms__field"><label>Beschreibung</label>';
  html += '<textarea id="' + eid + '_ergebnis" rows="2" oninput="p1SyncPortfolioMsTitle(this)" onchange="updP1(this,\'' + escAttr(ref) + '\',' + yr + ',' + idx + ',\'ergebnis\')">' + escAttr(ms.ergebnis || "") + '</textarea></div>';

  html += '<div class="p1-ms__kpi-grid">';
  fields.forEach(function(f) {
    const val = ms[f[0]];
    const minAttr = (f[0] === "ziel_umsatz_teur" || f[0] === "ziel_headcount" || f[0] === "ziel_anzahl") ? ' min="0"' : "";
    html += '<div class="p1-ms__field p1-ms__field--kpi"><label>' + escAttr(f[1]) + '</label>';
    html += '<input type="number" step="any"' + minAttr + ' id="' + eid + "_" + f[0] + '" value="' + (val != null ? val : "") + '" oninput="updP1Num(this,\'' + escAttr(ref) + '\',' + yr + ',' + idx + ',\'' + f[0] + '\')" onchange="updP1Num(this,\'' + escAttr(ref) + '\',' + yr + ',' + idx + ',\'' + f[0] + '\')">';
    html += '</div>';
  });
  html += '<div class="p1-ms__field p1-ms__field--kpi"><label>ZIEL-QUARTAL</label>';
  html += '<select id="' + eid + '_ziel_quartal" onchange="updP1(this,\'' + escAttr(ref) + '\',' + yr + ',' + idx + ',\'ziel_quartal\')">';
  html += p1QuarterSelectOptions(ms.ziel_quartal);
  html += '</select></div>';
  html += '</div>';
  html += '</div></div>';
  return html;
}

function renderP1MilestoneForm(area, track, yr, idx, ms, forceOpen) {
  if (area === "portfolio") {
    return renderP1PortfolioMilestoneForm(area, track, yr, idx, ms, forceOpen);
  }
  const fields = p1KpiFields(area);
  const ref = encodeP1TrackRef(area, track);
  const idPart = p1TrackMeasureId(area, track).replace(/[^a-zA-Z0-9]/g, "_");
  const eid = "p1_" + area + "_" + idPart + "_" + yr + "_" + idx;
  const mid = p1MilestoneDomId(area, track, yr, idx);
  const title = p1MilestoneTitle(ms, area, yr);
  const hasContent = p1MilestoneHasContent(ms, area);
  const bodyOpen = !!forceOpen;
  const titleCls = hasContent ? "p1-ms__title" : "p1-ms__title p1-ms__title--empty";
  const bodyCls = bodyOpen ? "p1-ms__body" : "p1-ms__body closed";
  const wrapCls = bodyOpen ? "p1-ms p1-ms--open" : "p1-ms";

  let html = '<div class="' + wrapCls + '" data-ref="' + escAttr(ref) + '" data-yr="' + yr + '" data-idx="' + idx + '">';
  html += '<div class="p1-ms__head" onclick="toggleP1Ms(\'' + mid + '\')" role="button" tabindex="0" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();toggleP1Ms(\'' + mid + '\')}">';
  html += '<span class="p1-ms__chev" aria-hidden="true"></span>';
  html += '<span class="' + titleCls + '" id="' + mid + '_title">' + escAttr(title) + '</span>';
  html += '<span class="p1-ms__actions" onclick="event.stopPropagation()">';
  html += p1TrashBtn("delP1Entry('" + escAttr(ref) + "'," + yr + "," + idx + ")", "L\u00f6schen");
  html += '</span></div>';

  html += '<div id="' + mid + '" class="' + bodyCls + '">';
  html += '<div class="p1-ms__field"><label>Bezeichnung</label>';
  html += '<input type="text" id="' + eid + '_bezeichnung" value="' + escAttr(ms.bezeichnung || "") + '" oninput="p1SyncMsTitle(this)" onchange="updP1(this,\'' + escAttr(ref) + '\',' + yr + ',' + idx + ',\'bezeichnung\')">';
  html += '</div>';
  html += '<div class="p1-ms__field"><label>Beschreibung</label>';
  html += '<textarea id="' + eid + '_ergebnis" rows="2" onchange="updP1(this,\'' + escAttr(ref) + '\',' + yr + ',' + idx + ',\'ergebnis\')">' + escAttr(ms.ergebnis || "") + '</textarea></div>';

  html += '<div class="p1-ms__kpi-grid">';
  fields.forEach(function(f) {
    const val = ms[f[0]];
    const minAttr = (f[0] === "ziel_umsatz_teur" || f[0] === "ziel_headcount" || f[0] === "ziel_anzahl") ? ' min="0"' : "";
    html += '<div class="p1-ms__field p1-ms__field--kpi"><label>' + escAttr(f[1]) + '</label>';
    html += '<input type="number" step="any"' + minAttr + ' id="' + eid + "_" + f[0] + '" value="' + (val != null ? val : "") + '" oninput="updP1Num(this,\'' + escAttr(ref) + '\',' + yr + ',' + idx + ',\'' + f[0] + '\')" onchange="updP1Num(this,\'' + escAttr(ref) + '\',' + yr + ',' + idx + ',\'' + f[0] + '\')">';
    html += '</div>';
  });
  html += '<div class="p1-ms__field p1-ms__field--kpi"><label>ZIEL-QUARTAL</label>';
  html += '<select id="' + eid + '_ziel_quartal" onchange="updP1(this,\'' + escAttr(ref) + '\',' + yr + ',' + idx + ',\'ziel_quartal\')">';
  html += p1QuarterSelectOptions(ms.ziel_quartal);
  html += '</select></div>';
  html += '<div class="p1-ms__field p1-ms__field--kpi"><label>Verantwortlich</label>';
  html += '<input type="text" id="' + eid + '_verantwortlich" value="' + escAttr(ms.verantwortlich || "") + '" onchange="updP1(this,\'' + escAttr(ref) + '\',' + yr + ',' + idx + ',\'verantwortlich\')">';
  html += '</div>';
  html += '</div>';
  html += '</div></div>';
  return html;
}

function renderP1SkillLevelPicker(ref, yr, idx, ms) {
  const state = p1SkillLevelPickerState(ms);
  let html = '<div class="p1-skill-level-picker" role="group" aria-label="Ziel-Level 1 bis 5">';
  for (let lvl = 1; lvl <= 5; lvl += 1) {
    let cls = "p1-skill-level-btn";
    if (state.explicit && state.level === lvl) {
      cls += " p1-skill-level-btn--active";
    } else if (!state.explicit && lvl === 1) {
      cls += " p1-skill-level-btn--default";
    }
    const pressed = state.explicit && state.level === lvl ? ' aria-pressed="true"' : ' aria-pressed="false"';
    const title = !state.explicit && lvl === 1
      ? "Noch nicht best\u00e4tigt \u2013 Klick setzt Bewertung"
      : "Level " + lvl;
    html += '<button type="button" class="' + cls + '"' + pressed +
      ' onclick="setP1SkillLevel(\'' + escAttr(ref) + '\',' + yr + "," + idx + "," + lvl + ')"' +
      ' title="' + escAttr(title) + '">' + lvl + "</button>";
  }
  html += "</div>";
  return html;
}

function renderP1EmployeeSkillYearPlanRow(area, track, yr, idx, ms, employeeItem, ref) {
  const idPart = p1TrackMeasureId(area, track).replace(/[^a-zA-Z0-9]/g, "_");
  const eid = "p1_" + area + "_" + idPart + "_" + yr + "_" + idx;
  const istLevel = findEmployeeIstSkillLevel(employeeItem, ms);
  const hasContent = p1MilestoneHasPlanContent(ms, area);
  const rowCls = hasContent
    ? "p1-skill-plan__row p1-skill-plan__row--filled"
    : "p1-skill-plan__row";
  const isTech = ms.skillPlanKind === "tech";
  const legacyCls = ms._legacy ? " p1-skill-plan__row--legacy" : "";
  const label = String(ms.kategorie || ms.bezeichnung || "\u2013").trim();

  let html = '<div class="' + rowCls + legacyCls + '" data-idx="' + idx + '">';
  html += '<div class="p1-skill-plan__name">';
  html += '<span class="p1-ms__kind-badge p1-ms__kind-badge--' + (isTech ? "tech" : "soft") + '">' + (isTech ? "Fach" : "Soft") + "</span>";
  html += '<span class="p1-skill-plan__label">' + escAttr(label);
  if (ms._legacy) html += ' <span class="p1-skill-plan__legacy-tag">(Alt)</span>';
  html += "</span></div>";
  html += '<div class="p1-skill-plan__ist" title="IST aus Phase 1">' + (istLevel != null ? escAttr(String(istLevel)) : "\u2013") + "</div>";
  html += '<div class="p1-skill-plan__level">' + renderP1SkillLevelPicker(ref, yr, idx, ms) + "</div>";
  html += '<div class="p1-skill-plan__comment">';
  html += '<label class="p1-flat-plan__sr-only" for="' + eid + '_ergebnis">Kommentar ' + escAttr(label) + "</label>";
  html += '<input type="text" id="' + eid + '_ergebnis" value="' + escAttr(ms.ergebnis || "") + '" placeholder="Optional\u2026" onchange="updP1(this,\'' + escAttr(ref) + '\',' + yr + "," + idx + ",\'ergebnis\')\">";
  html += "</div></div>";
  return html;
}

function renderP1EmployeeSkillYearPlanSection(area, track, yr, entries, kind, sectionLabel, employeeItem, ref) {
  const rows = entries
    .map(function (ms, idx) { return { ms: ms, idx: idx }; })
    .filter(function (item) { return item.ms && item.ms.skillPlanKind === kind; });
  if (!rows.length) return "";

  let html = '<div class="p1-skill-plan__section">';
  html += '<div class="p1-skill-plan__section-title">' + escAttr(sectionLabel) + "</div>";
  html += '<div class="p1-skill-plan__head p1-skill-plan__row" aria-hidden="true">';
  html += '<div class="p1-skill-plan__name">Skill</div>';
  html += '<div class="p1-skill-plan__ist">IST</div>';
  html += '<div class="p1-skill-plan__level">Ziel-Level</div>';
  html += '<div class="p1-skill-plan__comment">Kommentar</div>';
  html += "</div>";
  rows.forEach(function (item) {
    html += renderP1EmployeeSkillYearPlanRow(area, track, yr, item.idx, item.ms, employeeItem, ref);
  });
  html += "</div>";
  return html;
}

function renderP1EmployeeSkillYearPlan(area, track, yr) {
  const entries = getP1Entries(area, track, yr);
  const employeeItem = findEmployeePhase1Item(track);
  const ref = encodeP1TrackRef(area, track);
  const techCats = (_p1SkillCategoriesCache?.tech || []).length;
  const softCats = (_p1SkillCategoriesCache?.soft || []).length;

  let html = '<div class="p1-skill-plan" data-yr="' + yr + '">';
  if (!techCats && !softCats) {
    html += '<p class="bc-muted p1-skill-plan__empty">Keine Skill-Kategorien im Admin hinterlegt.</p>';
  } else {
    html += '<div class="p1-skill-plan__columns">';
    html += renderP1EmployeeSkillYearPlanSection(area, track, yr, entries, "tech", "Fachskills", employeeItem, ref);
    html += renderP1EmployeeSkillYearPlanSection(area, track, yr, entries, "soft", "Soft Skills", employeeItem, ref);
    html += "</div>";
  }
  html += "</div>";
  return html;
}

function renderP1YearAccordion(area, track, yr) {
  const entries = getP1Entries(area, track, yr);
  const count = entries.length;
  const ref = encodeP1TrackRef(area, track);
  const isMitarbeiter = area === "mitarbeiter";
  let html = '<div class="p1-acc" data-yr="' + yr + '">';
  html += '<div class="p1-acc__head" onclick="this.parentElement.classList.toggle(\'p1-acc--open\')">';
  html += '<span class="p1-acc__yr">' + yr + '</span>';
  html += '<span class="p1-acc__count">' + p1YearMilestoneCountText(count, area, track, yr) + '</span>';
  if (count && isMitarbeiter) {
    html += '<span class="p1-acc__actions" onclick="event.stopPropagation()">';
    html += p1TrashBtn(
      "delP1YearEntries('" + escAttr(ref) + "'," + yr + ")",
      "Bewertungen f\u00fcr " + yr + " zur\u00fccksetzen"
    );
    html += "</span>";
  } else if (count && !isMitarbeiter) {
    html += '<span class="p1-acc__actions" onclick="event.stopPropagation()">';
    html += p1TrashBtn(
      "delP1YearEntries('" + escAttr(ref) + "'," + yr + ")",
      "Alle Meilensteine f\u00fcr " + yr + " l\u00f6schen"
    );
    html += "</span>";
  }
  html += '</div>';
  html += '<div class="p1-acc__body">';
  if (isMitarbeiter) {
    html += renderP1EmployeeSkillYearPlan(area, track, yr);
  } else {
    entries.forEach(function (ms, idx) {
      html += renderP1MilestoneForm(area, track, yr, idx, ms, false);
    });
    if (!p1UsesFlatYearPlan(area)) {
      html += '<button type="button" class="btn btn-sm btn-outline p1-add-btn" onclick="event.stopPropagation();addP1Entry(\'' + escAttr(ref) + '\',' + yr + ')">+ Meilenstein</button>';
    }
  }
  html += '</div></div>';
  return html;
}

function renderP1SkillLevelDisplay(level) {
  const n = Number(level);
  const activeLevel = Number.isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : null;
  let html = '<div class="p1-skill-level-picker p1-skill-level-picker--readonly" role="img" aria-label="';
  html += activeLevel != null ? "Level " + activeLevel : "Kein Level erfasst";
  html += '">';
  for (let lvl = 1; lvl <= 5; lvl += 1) {
    const active = activeLevel === lvl ? " p1-skill-level-btn--active" : "";
    html += '<span class="p1-skill-level-btn p1-skill-level-btn--readonly' + active + '" aria-hidden="true">' + lvl + "</span>";
  }
  html += "</div>";
  return html;
}

function renderP1EmployeeIstSkillRow(row) {
  const hasContent = p1IstSkillRowHasContent(row);
  const rowCls = hasContent
    ? "p1-skill-plan__row p1-skill-plan__row--filled"
    : "p1-skill-plan__row";
  const isTech = row.skillPlanKind === "tech";
  const legacyCls = row._legacy ? " p1-skill-plan__row--legacy" : "";
  const label = String(row.kategorie || "\u2013").trim();
  const comment = String(row.bemerkungen || "").trim();

  let html = '<div class="' + rowCls + legacyCls + '">';
  html += '<div class="p1-skill-plan__name">';
  html += '<span class="p1-ms__kind-badge p1-ms__kind-badge--' + (isTech ? "tech" : "soft") + '">' + (isTech ? "Fach" : "Soft") + "</span>";
  html += '<span class="p1-skill-plan__label">' + escAttr(label);
  if (row._legacy) html += ' <span class="p1-skill-plan__legacy-tag">(Alt)</span>';
  html += "</span></div>";
  html += '<div class="p1-skill-plan__level">' + renderP1SkillLevelDisplay(row.level) + "</div>";
  html += '<div class="p1-skill-plan__comment">';
  html += '<span class="p1-skill-plan__comment-text">' + escAttr(comment || "\u2013") + "</span>";
  html += "</div></div>";
  return html;
}

function renderP1EmployeeIstSkillSection(rows, kind, sectionLabel) {
  const sectionRows = rows.filter(function (row) { return row && row.skillPlanKind === kind; });
  if (!sectionRows.length) return "";

  let html = '<div class="p1-skill-plan__section">';
  html += '<div class="p1-skill-plan__section-title">' + escAttr(sectionLabel) + "</div>";
  html += '<div class="p1-skill-plan__head p1-skill-plan__row p1-skill-plan__row--ist-head" aria-hidden="true">';
  html += '<div class="p1-skill-plan__name">Skill</div>';
  html += '<div class="p1-skill-plan__level">Level</div>';
  html += '<div class="p1-skill-plan__comment">Kommentar</div>';
  html += "</div>";
  sectionRows.forEach(function (row) {
    html += renderP1EmployeeIstSkillRow(row);
  });
  html += "</div>";
  return html;
}

function p1EmployeeIstCountText(rows) {
  const total = (rows || []).length;
  if (!total) return "leer";
  let filled = 0;
  rows.forEach(function (row) {
    if (p1IstSkillRowHasContent(row)) filled += 1;
  });
  return filled + "/" + total + " erfasst";
}

function renderP1EmployeePhase1SkillPlan(item) {
  const employeeItem = item || {};
  const techCats = (_p1SkillCategoriesCache?.tech || []).length;
  const softCats = (_p1SkillCategoriesCache?.soft || []).length;
  const rows = buildP1EmployeeIstSkillMatrix(employeeItem);

  let html = '<div class="p1-acc p1-acc--ist" data-yr="ist">';
  html += '<div class="p1-acc__head" onclick="this.parentElement.classList.toggle(\'p1-acc--open\')">';
  html += '<span class="p1-acc__yr">IST-Skills aus Phase 1</span>';
  html += '<span class="p1-acc__count">' + p1EmployeeIstCountText(rows) + "</span>";
  html += "</div>";
  html += '<div class="p1-acc__body">';
  if (!techCats && !softCats) {
    html += '<p class="bc-muted p1-skill-plan__empty">Keine Skill-Kategorien im Admin hinterlegt.</p>';
  } else {
    html += '<div class="p1-skill-plan p1-skill-plan--ist">';
    html += '<div class="p1-skill-plan__columns">';
    html += renderP1EmployeeIstSkillSection(rows, "tech", "Fachskills");
    html += renderP1EmployeeIstSkillSection(rows, "soft", "Soft Skills");
    html += "</div></div>";
  }
  html += "</div></div>";
  return html;
}

function renderP1SubcategoryBlock(area, item, moveCtx) {
  const track = p1ApplyEntityRefToTrack(area, {
    category: item.category,
    subcategory: item.subcategory,
    phase1Id: item.phase1Id,
    itemId: item.itemId,
    skillItemId: item.skillItemId,
    orgItemId: item.orgItemId,
    skillEntryId: item.skillEntryId,
    personalnummer: item.personalnummer,
    entityRef: item.entityRef,
    source: item.source,
    verantwortlich: item.verantwortlich,
  });
  const label = item.label || item.subcategory;
  const blockId = p1BlockDomId(area, track);
  const ref = encodeP1TrackRef(area, track);
  const countLabel = p1UsesFlatYearPlan(area)
    ? p1FlatTrackCountLabel(area, track)
    : p1TrackMilestoneCountLabel(area, track);
  const movePos = moveCtx || p1TrackMovePosition(area, track);
  const subcatCls = p1UsesFlatYearPlan(area) || area === "mitarbeiter"
    ? "p1-subcat p1-subcat--flat p1-subcat--" + area
    : "p1-subcat";

  let html = '<details class="' + subcatCls + '" id="' + escAttr(blockId) + '">';
  html += '<summary class="p1-subcat__head">';
  html += '<span class="p1-subcat__label">' + escAttr(label) + '</span>';
  html += '<span class="p1-subcat__count">' + countLabel + '</span>';
  html += '<span class="p1-subcat__actions" onclick="event.preventDefault();event.stopPropagation()">';
  html += '<span class="p1-subcat__move">';
  html += p1MoveBtn(
    "moveP1Track('" + escAttr(ref) + "',-1)",
    "Nach oben",
    P1_SVG_UP,
    !movePos.canUp
  );
  html += p1MoveBtn(
    "moveP1Track('" + escAttr(ref) + "',1)",
    "Nach unten",
    P1_SVG_DOWN,
    !movePos.canDown
  );
  html += "</span>";
  html += p1SaveBtn("saveP1Track('" + escAttr(ref) + "')", "Speichern");
  html += p1TrashBtn(
    "delP1Track('" + escAttr(ref) + "')",
    p1UsesFlatYearPlan(area) ? p1FlatTrackDeleteLabel(area) : "Meilenstein l\u00f6schen"
  );
  html += '</span>';
  html += '</summary>';
  html += '<div class="p1-subcat__body">';
  if (p1UsesFlatYearPlan(area)) {
    html += renderP1FlatTrackMeta(area, track, item);
    html += renderP1FlatYearPlan(area, track);
  } else if (area === "mitarbeiter") {
    html += renderP1EmployeePhase1SkillPlan(item);
  }
  if (!p1UsesFlatYearPlan(area)) {
    YEARS.forEach(function(yr) {
      html += renderP1YearAccordion(area, track, yr);
    });
  }
  html += '</div></details>';
  return html;
}

function renderP1CategorySection(areaKey, sectionDef, items) {
  const sectionId = "p1cat_" + areaKey + "_" + p1Slug(sectionDef.key);
  const addLabel = p1AreaAddLabel(areaKey);
  let html = '<details class="p1-category-section p1-org-section" id="' + escAttr(sectionId) + '">';
  html += '<summary class="p1-org-section__head">';
  html += '<span class="p1-org-section__label">' + escAttr(sectionDef.label) + '</span>';
  html += '<span class="p1-org-section__count">' + p1AreaSectionCountLabel(areaKey, items.length) + '</span>';
  html += '<span class="p1-section__actions" onclick="event.preventDefault();event.stopPropagation()">';
  html += '<button type="button" class="p1-section__add btn btn-sm btn-outline" title="' + escAttr(addLabel + " hinzuf\u00fcgen") + '" onclick="openP1AddItemModal(\'' + escAttr(areaKey) + '\',\'' + escAttr(sectionDef.key) + '\')">+ ' + escAttr(addLabel) + '</button>';
  html += '</span>';
  html += '</summary>';
  html += '<div class="p1-org-section__body">';
  if (items.length) {
    items.forEach(function (item, idx) {
      html += renderP1SubcategoryBlock(areaKey, item, {
        index: idx,
        total: items.length,
        canUp: idx > 0,
        canDown: idx < items.length - 1,
      });
    });
  } else {
    html += '<p class="p1-org-section__empty bc-muted">Noch keine Items in der Planung. \u00dcber \u201e+ ' + escAttr(addLabel) + '\u201c aus Phase 1 \u00fcbernehmen oder neu anlegen.</p>';
  }
  html += '</div></details>';
  return html;
}

function renderP1OrgSection(sectionDef, items) {
  const sectionId = "p1org_" + sectionDef.key;
  const addLabel = p1AreaAddLabel(sectionDef.key);
  let html = '<details class="p1-org-section" id="' + escAttr(sectionId) + '">';
  html += '<summary class="p1-org-section__head">';
  html += '<span class="p1-org-section__label">' + escAttr(sectionDef.label) + '</span>';
  html += '<span class="p1-org-section__count">' + items.length + ' Unterkategorien</span>';
  html += '<span class="p1-section__actions" onclick="event.preventDefault();event.stopPropagation()">';
  html += '<button type="button" class="p1-section__add btn btn-sm btn-outline" title="' + escAttr(addLabel + " hinzuf\u00fcgen") + '" onclick="openP1AddItemModal(\'' + escAttr(sectionDef.key) + '\')">+ ' + escAttr(addLabel) + '</button>';
  html += '</span>';
  html += '</summary>';
  html += '<div class="p1-org-section__body">';
  if (sectionDef.hint) {
    html += '<p class="p1-org-section__hint">' + escAttr(sectionDef.hint) + '</p>';
  }
  if (items.length) {
    items.forEach(function (item, idx) {
      html += renderP1SubcategoryBlock(sectionDef.key, item, {
        index: idx,
        total: items.length,
        canUp: idx > 0,
        canDown: idx < items.length - 1,
      });
    });
  } else {
    html += '<p class="p1-org-section__empty bc-muted">Noch keine Eintr\u00e4ge in Phase 1 f\u00fcr diese Unit. \u00dcber \u201e+ ' + escAttr(addLabel) + '\u201c aus dem Katalog anlegen.</p>';
  }
  html += '</div></details>';
  return html;
}

function renderP1CategorizedArea(areaKey, areaDef, sections) {
  ensureP1Tracks();
  let totalItems = 0;
  sections.forEach(function (s) {
    totalItems += getP1SectionItems(areaKey, s.key).length;
  });
  let html = '<details class="p1-area' + (areaKey === "organisation" ? " p1-area--org" : "") + '" id="p1area_' + escAttr(areaKey) + '">';
  html += '<summary class="p1-area__head">';
  html += '<span class="p1-area__icon">' + areaDef.icon + '</span>';
  html += '<span class="p1-area__label">' + escAttr(areaDef.label) + '</span>';
  html += '<span class="p1-area__count">' + p1AreaSectionCountLabel(areaKey, totalItems) + '</span>';
  html += '</summary>';
  html += '<div class="p1-area__body">';
  sections.forEach(function (sectionDef) {
    const items = getP1SectionItems(areaKey, sectionDef.key);
    html += renderP1CategorySection(areaKey, sectionDef, items);
  });
  html += '</div></details>';
  return html;
}

function renderP1PortfolioArea() {
  const areaDef = P1_TOP_AREAS.find(function (a) { return a.key === "portfolio"; });
  return renderP1CategorizedArea("portfolio", areaDef, getP1PortfolioSections());
}

function renderP1MitarbeiterArea() {
  ensureP1Tracks();
  const items = getP1SectionItems("mitarbeiter");
  const areaDef = P1_TOP_AREAS.find(function (a) { return a.key === "mitarbeiter"; });
  let html = '<details class="p1-area" id="p1area_mitarbeiter">';
  html += '<summary class="p1-area__head">';
  html += '<span class="p1-area__icon">' + areaDef.icon + '</span>';
  html += '<span class="p1-area__label">' + escAttr(areaDef.label) + '</span>';
  html += '<span class="p1-area__count">' + items.length + " Mitarbeiter</span>";
  html += '</summary>';
  html += '<div class="p1-area__body">';
  if (!items.length) {
    html += '<p class="bc-muted p1-empty">Noch keine Mitarbeiter in der Planung. \u00dcber \u201e+ Mitarbeiter\u201c aus Phase 1 \u00fcbernehmen.</p>';
  }
  items.forEach(function (item, idx) {
    html += renderP1SubcategoryBlock("mitarbeiter", item, {
      index: idx,
      total: items.length,
      canUp: idx > 0,
      canDown: idx < items.length - 1,
    });
  });
  html += '<div class="p1-subcat-actions"><button type="button" class="btn btn-sm btn-outline" onclick="openP1AddItemModal(\'mitarbeiter\')">+ Mitarbeiter</button></div>';
  html += '</div></details>';
  return html;
}

function renderP1OrganisationArea() {
  ensureP1Tracks();
  const gliItems = getP1SectionItems("gliederungen");
  const rolItems = getP1SectionItems("rollen");
  const totalSub = gliItems.length + rolItems.length;
  const orgDef = P1_TOP_AREAS.find(function (a) { return a.key === "organisation"; });
  let html = '<details class="p1-area p1-area--org" id="p1area_organisation">';
  html += '<summary class="p1-area__head">';
  html += '<span class="p1-area__icon">' + orgDef.icon + '</span>';
  html += '<span class="p1-area__label">' + escAttr(orgDef.label) + '</span>';
  html += '<span class="p1-area__count">' + totalSub + ' Unterkategorien</span>';
  html += '</summary>';
  html += '<div class="p1-area__body">';
  orgDef.sections.forEach(function (sectionDef) {
    const items = sectionDef.key === "gliederungen" ? gliItems : rolItems;
    html += renderP1OrgSection(sectionDef, items);
  });
  html += '</div></details>';
  return html;
}

function renderPlanungNewHtml() {
  let html = '<div class="p1-planning">';
  html += '<div class="card" style="margin-bottom:.75rem"><h3 style="margin:0;color:var(--rc-accent2)">Planung \u00b7 Phase-1-basiert</h3>';
  html += '<p class="bc-muted" style="margin:.3rem 0 0">Meilensteinplanung auf Item-Ebene innerhalb der Phase-1-Kategorien.</p></div>';

  P1_TOP_AREAS.forEach(function (areaDef) {
    if (areaDef.key === "organisation") {
      html += renderP1OrganisationArea();
      return;
    }
    if (areaDef.key === "portfolio") {
      html += renderP1PortfolioArea();
      return;
    }
    if (areaDef.key === "mitarbeiter") {
      html += renderP1MitarbeiterArea();
      return;
    }
  });

  html += '</div>';
  return html;
}

function collectP1OpenState() {
  const state = { areas: [], subcats: [], orgSections: [], categorySections: [], accs: [], milestones: [] };
  document.querySelectorAll(".p1-area[open]").forEach(function (el) {
    if (el.id) state.areas.push(el.id);
  });
  document.querySelectorAll(".p1-subcat[open]").forEach(function (el) {
    if (el.id) state.subcats.push(el.id);
  });
  document.querySelectorAll(".p1-org-section[open]").forEach(function (el) {
    if (el.id) {
      if (el.id.indexOf("p1cat_") === 0) state.categorySections.push(el.id);
      else state.orgSections.push(el.id);
    }
  });
  document.querySelectorAll(".p1-acc.p1-acc--open").forEach(function (el) {
    const yr = el.dataset.yr;
    const subcat = el.closest(".p1-subcat")?.id;
    if (yr && subcat) state.accs.push({ subcat: subcat, yr: yr });
  });
  document.querySelectorAll(".p1-ms__body:not(.closed)").forEach(function (el) {
    if (el.id) state.milestones.push(el.id);
  });
  return normalizeP1OpenState(state);
}

function ensureP1OpenForNewTrack(state, areaKey, categoryKey, track) {
  const blockId = p1BlockDomId(areaKey, track);
  if (state.subcats.indexOf(blockId) < 0) state.subcats.push(blockId);
  state.accs = (state.accs || []).filter(function (a) { return a.subcat !== blockId; });
  state.accs.push({ subcat: blockId, yr: String(YEARS[0]) });

  if (areaKey === "gliederungen" || areaKey === "rollen") {
    if (state.areas.indexOf("p1area_organisation") < 0) state.areas.push("p1area_organisation");
    const orgId = "p1org_" + areaKey;
    state.orgSections = state.orgSections.filter(function (id) {
      return id !== "p1org_gliederungen" && id !== "p1org_rollen";
    });
    if (state.orgSections.indexOf(orgId) < 0) state.orgSections.push(orgId);
  } else if (p1IsCategorizedArea(areaKey)) {
    const areaId = "p1area_" + areaKey;
    if (state.areas.indexOf(areaId) < 0) state.areas.push(areaId);
    if (categoryKey) {
      const catId = "p1cat_" + areaKey + "_" + p1Slug(categoryKey);
      const prefix = "p1cat_" + areaKey + "_";
      state.categorySections = state.categorySections.filter(function (id) {
        return id.indexOf(prefix) !== 0;
      });
      if (state.categorySections.indexOf(catId) < 0) state.categorySections.push(catId);
    }
  } else if (areaKey === "mitarbeiter") {
    if (state.areas.indexOf("p1area_mitarbeiter") < 0) state.areas.push("p1area_mitarbeiter");
  }
  return normalizeP1OpenState(state);
}

function p1EnforceCategoryAccordion(areaKey, openCategoryId) {
  if (areaKey !== "portfolio") return;
  const root = document.getElementById("planungNewContent");
  if (!root || !openCategoryId) return;
  const prefix = "p1cat_" + areaKey + "_";
  root.querySelectorAll(".p1-category-section[id^='" + prefix + "']").forEach(function (other) {
    if (other.id !== openCategoryId) other.open = false;
  });
}

function p1EnforceOrgSectionAccordion(openOrgSectionId) {
  const root = document.getElementById("planungNewContent");
  if (!root || !openOrgSectionId) return;
  root.querySelectorAll(".p1-org-section:not(.p1-category-section)[id^='p1org_']").forEach(function (other) {
    if (other.id !== openOrgSectionId) other.open = false;
  });
}

function bindP1OpenStatePersistence() {
  const root = document.getElementById("planungNewContent");
  if (!root || _p1OpenStateBound) return;
  _p1OpenStateBound = true;
  root.addEventListener("toggle", function (e) {
    const el = e.target;
    if (!el || !el.closest("#planungNewContent")) return;
    if (!el.matches(".p1-area, .p1-org-section, .p1-category-section, .p1-subcat")) return;
    if (el.open && el.id) {
      if (el.id.indexOf("p1cat_portfolio_") === 0) p1EnforceCategoryAccordion("portfolio", el.id);
      if (el.id === "p1org_gliederungen" || el.id === "p1org_rollen") p1EnforceOrgSectionAccordion(el.id);
    }
    writePersistedP1OpenState(collectP1OpenState());
  }, true);
  root.addEventListener("click", function (e) {
    if (!e.target.closest(".p1-acc__head")) return;
    requestAnimationFrame(function () {
      writePersistedP1OpenState(collectP1OpenState());
    });
  });
}

function applyP1OpenState(state, focusTarget) {
  const areas = new Set(state?.areas || []);
  const subcats = new Set(state?.subcats || []);
  const orgSections = new Set(state?.orgSections || []);
  const categorySections = new Set(state?.categorySections || []);
  const accKeys = new Set((state?.accs || []).map(function (a) { return a.subcat + "||" + a.yr; }));
  const milestones = new Set(state?.milestones || []);

  if (focusTarget) {
    let blockId = focusTarget.blockId;
    if (!blockId && focusTarget.track) {
      blockId = p1BlockDomId(focusTarget.area, focusTarget.track);
    } else if (!blockId && focusTarget.sub) {
      blockId = "p1block_" + focusTarget.area + "_" + String(focusTarget.sub).replace(/[^a-zA-Z0-9]/g, "_");
    }
    if (blockId) subcats.add(blockId);
    if (focusTarget.area === "gliederungen" || focusTarget.area === "rollen") {
      orgSections.add("p1org_" + focusTarget.area);
      areas.add("p1area_organisation");
    }
    if (focusTarget.category && p1IsCategorizedArea(focusTarget.area)) {
      categorySections.add("p1cat_" + focusTarget.area + "_" + p1Slug(focusTarget.category));
      areas.add("p1area_" + focusTarget.area);
    }
    if (focusTarget.area && P1_TOP_AREAS.some(function (a) { return a.key === focusTarget.area; })) {
      areas.add("p1area_" + focusTarget.area);
    }
    if (blockId) accKeys.add(blockId + "||" + String(focusTarget.yr));
    if (focusTarget.track && focusTarget.idx != null) {
      milestones.add(p1MilestoneDomId(focusTarget.area, focusTarget.track, focusTarget.yr, focusTarget.idx));
    }
  }

  areas.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.open = true;
  });

  orgSections.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.open = true;
    if (id === "p1org_gliederungen" || id === "p1org_rollen") p1EnforceOrgSectionAccordion(id);
  });

  categorySections.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.open = true;
    if (id.indexOf("p1cat_portfolio_") === 0) p1EnforceCategoryAccordion("portfolio", id);
  });

  subcats.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.open = true;
  });

  accKeys.forEach(function (key) {
    const parts = key.split("||");
    const subcatId = parts[0];
    const yr = parts[1];
    const sub = document.getElementById(subcatId);
    const acc = sub?.querySelector('.p1-acc[data-yr="' + yr + '"]');
    if (acc) acc.classList.add("p1-acc--open");
  });

  milestones.forEach(function (id) {
    const body = document.getElementById(id);
    if (!body) return;
    body.classList.remove("closed");
    body.closest(".p1-ms")?.classList.add("p1-ms--open");
  });

  if (focusTarget && focusTarget.track && focusTarget.yr != null) {
    const idPart = p1TrackMeasureId(focusTarget.area, focusTarget.track).replace(/[^a-zA-Z0-9]/g, "_");
    const idx = focusTarget.idx != null ? focusTarget.idx : 0;
    const field = p1UsesFlatYearPlan(focusTarget.area) || focusTarget.area === "mitarbeiter"
      ? "ergebnis"
      : "bezeichnung";
    const input = document.getElementById(
      "p1_" + focusTarget.area + "_" + idPart + "_" + focusTarget.yr + "_" + idx + "_" + field
    );
    if (input) {
      requestAnimationFrame(function () { input.focus(); });
    }
  } else if (focusTarget && focusTarget.idx != null && focusTarget.idx >= 0 && focusTarget.track) {
    const idPart = p1TrackMeasureId(focusTarget.area, focusTarget.track).replace(/[^a-zA-Z0-9]/g, "_");
    const input = document.getElementById(
      "p1_" + focusTarget.area + "_" + idPart + "_" + focusTarget.yr + "_" + focusTarget.idx + "_bezeichnung"
    );
    if (input) {
      requestAnimationFrame(function () { input.focus(); });
    }
  }
}

function refreshPlanungNewUI(opts) {
  const root = document.getElementById("planungNewContent");
  if (!root || !_p1SummaryCache) return;
  const openState = opts?.openState || collectP1OpenState();
  root.innerHTML = renderPlanungNewHtml();
  applyP1OpenState(openState, opts?.focusTarget);
  writePersistedP1OpenState(collectP1OpenState());
}

async function initPlanungNew(opts) {
  const root = document.getElementById("planungNewContent");
  if (!root) return;

  const notice = document.getElementById("bcUnitSaveNotice");
  if (notice) notice.style.display = isBcViewAll() ? "" : "none";

  if (isBcViewAll()) {
    root.innerHTML = '<div class="card"><p class="bc-muted">Bitte eine konkrete Unit w\u00e4hlen, um die Phase-1-basierte Planung zu nutzen.</p></div>';
    return;
  }

  let openState = opts?.openState || null;
  if (!openState) {
    openState = opts?.skipFetch ? collectP1OpenState() : readPersistedP1OpenState();
  }

  if (!opts?.skipFetch) {
    root.innerHTML = '<div class="card"><p class="bc-muted">Lade Phase-1-Daten\u2026</p></div>';

    try {
      const unit = p1SummaryUnit();
      if (!unit) throw new Error("Bitte oben eine konkrete Unit w\u00e4hlen.");
      if (typeof loadPlanFromApi === "function") {
        await loadPlanFromApi();
      }
      const resp = await fetch("/api/backcasting/phase1-summary?unit=" + encodeURIComponent(unit), { credentials: "include" });
      if (!resp.ok) throw new Error("API-Fehler " + resp.status);
      _p1SummaryCache = await resp.json();
      _p1SummaryRefreshFailed = false;
      await ensureP1SummaryEmployees(unit);
      await loadP1SkillCategories();
    } catch (e) {
      root.innerHTML = '<div class="card"><p style="color:var(--rc-red)">Phase-1-Daten konnten nicht geladen werden: ' + escAttr(e.message) + '</p></div>';
      return;
    }
  } else if (!_p1SummaryCache) {
    return initPlanungNew();
  } else {
    const unit = p1SummaryUnit();
    if (unit && typeof loadPlanFromApi === "function") {
      await loadPlanFromApi();
    }
    if (unit) await ensureP1SummaryEmployees(unit);
    await loadP1SkillCategories();
  }

  ensureP1Tracks();
  const reconciled = reconcileP1TracksFromMeasures(["gliederungen", "rollen"]);
  const normalized = normalizeP1TracksInMeta();
  const synced = syncP1TracksFromPhase1(["gliederungen", "rollen"]);
  ["gliederungen", "rollen"].forEach(dedupeP1TracksArea);
  const measuresConsolidated = consolidateOrgMeasureKeys();
  const seeded = ensureP1TrackYearCoverage();
  const employeeCatalogSynced = ensureP1EmployeeSkillCatalogAllYears();
  if ((reconciled > 0 || normalized || synced > 0 || seeded > 0 || measuresConsolidated || employeeCatalogSynced > 0) && typeof savePlan === "function") {
    await savePlan({ allowIncomplete: true, silent: true });
  }

  root.innerHTML = renderPlanungNewHtml();
  applyP1OpenState(openState, opts?.focusTarget);
  bindP1OpenStatePersistence();
  writePersistedP1OpenState(collectP1OpenState());
  _p1Initialized = true;
}

function p1CategoryLabel(areaKey, categoryKey) {
  if (areaKey === "portfolio") return P1_PORTFOLIO_LABELS[categoryKey] || categoryKey;
  return categoryKey;
}

function renderP1MitarbeiterAddModalBody() {
  ensureP1Tracks();
  const adoptable = getPhase1CandidatesForAdoption("mitarbeiter");
  const allEmployees = (_p1SummaryCache && _p1SummaryCache.employees) || [];

  let html = '<div class="p1-add-modal p1-add-modal--mitarbeiter">';
  html += '<p class="bc-muted p1-add-modal__intro">Mitarbeiter aus Phase 1 (Skills) f\u00fcr die j\u00e4hrliche Entwicklungsplanung \u00fcbernehmen.</p>';

  if (_p1SummaryRefreshFailed) {
    html += '<p class="bc-muted p1-add-modal__empty" style="color:var(--rc-red)">Phase-1-Daten konnten nicht geladen werden. Bitte Unit pr\u00fcfen und erneut versuchen.</p>';
  } else if (!allEmployees.length) {
    const unitLabel = p1SummaryUnit() || "dieser Unit";
    html += '<p class="bc-muted p1-add-modal__empty">Noch keine Mitarbeiter in Phase 1 f\u00fcr <strong>' + escAttr(unitLabel) + '</strong> erfasst. Bitte unter <strong>Skills</strong> Mitarbeiter mit dieser Unit anlegen oder die Unit-Auswahl oben pr\u00fcfen (nicht \u201eAlle Units\u201c).</p>';
  } else if (!adoptable.length) {
    html += '<p class="bc-muted p1-add-modal__empty">Alle erfassten Mitarbeiter sind bereits in der Planung.</p>';
  } else {
    html += '<div class="p1-mitarbeiter-pick-list" role="radiogroup" aria-label="Mitarbeiter aus Phase 1">';
    html += '<div class="p1-mitarbeiter-pick-head">';
    html += "<span>Name</span><span>Pers.-Nr.</span><span>Skills</span><span>\u00d8 Level</span><span>Zert.</span>";
    html += "</div>";
    adoptable.forEach(function (item, idx) {
      const zert = String(item.zertifiziert || "").trim() || "\u2013";
      html += '<label class="p1-mitarbeiter-pick-row">';
      html += '<input type="radio" name="p1MitarbeiterPick" value="' + escAttr(item.skillEntryId) + '"' + (idx === 0 ? " checked" : "") + ">";
      html += '<span class="p1-mitarbeiter-pick-name">' + escAttr(item.name) + "</span>";
      html += '<span class="p1-mitarbeiter-pick-pnr">' + escAttr(item.personalnummer || "\u2013") + "</span>";
      html += '<span class="p1-mitarbeiter-pick-skills">' + String(item.skillCount || 0) + "</span>";
      html += '<span class="p1-mitarbeiter-pick-level">' + String(item.avgLevel != null ? item.avgLevel : 0) + "</span>";
      html += '<span class="p1-mitarbeiter-pick-zert">' + escAttr(zert) + "</span>";
      html += "</label>";
    });
    html += "</div>";
  }
  html += "</div>";
  return html;
}

function getP1AvailableOrgCatalog(areaKey) {
  const catalog = areaKey === "gliederungen"
    ? (typeof ORG_TECH_BEREICHE !== "undefined" ? ORG_TECH_BEREICHE : [])
    : (typeof ORG_ROLLEN !== "undefined" ? ORG_ROLLEN : []);
  const planned = new Set(getP1Tracks(areaKey).map(function (t) { return t.subcategory; }));
  return catalog.filter(function (v) { return !planned.has(v); });
}

function renderP1OrgAddModalBody(areaKey) {
  ensureP1Tracks();
  const isGli = areaKey === "gliederungen";
  const addLabel = p1AreaAddLabel(areaKey);
  const available = getP1AvailableOrgCatalog(areaKey);
  const intro = isGli
    ? "Weitere organisatorische Gliederung aus dem vordefinierten Katalog anlegen."
    : "Weitere Rolle in der Unit aus dem vordefinierten Katalog anlegen.";

  let html = '<div class="p1-add-modal p1-add-modal--org">';
  html += '<p class="bc-muted p1-add-modal__intro">' + intro + "</p>";
  html += '<p class="bc-muted p1-add-modal__hint" style="font-size:.8rem;margin:0 0 .75rem">Eintr\u00e4ge aus Phase 1 erscheinen automatisch in der Liste.</p>';

  if (_p1SummaryRefreshFailed) {
    html += '<p class="bc-muted p1-add-modal__empty" style="color:var(--rc-red)">Phase-1-Daten konnten nicht geladen werden.</p>';
  } else if (!available.length) {
    html += '<p class="bc-muted p1-add-modal__empty">Alle vordefinierten ' + (isGli ? "Bereiche" : "Rollen") + ' sind bereits in der Planung. Nutzen Sie \u201eSonstiges\u201c f\u00fcr eine eigene Bezeichnung.</p>';
  }

  html += '<label for="p1AddPlanSelect">' + escAttr(addLabel) + "</label>";
  html += '<select id="p1AddPlanSelect" class="p1-add-modal__select" onchange="syncP1AddPlanOther()">';
  if (typeof buildSimpleOptions === "function") {
    html += buildSimpleOptions(available, "");
  } else if (typeof buildOrgSelectOptions === "function") {
    html += buildOrgSelectOptions(available, "");
  } else {
    html += '<option value="">\u2013 Bitte w\u00e4hlen \u2013</option>';
    available.forEach(function (v) {
      html += '<option value="' + escAttr(v) + '">' + escAttr(v) + "</option>";
    });
    const sonstiges = typeof SELECT_SONSTIGES !== "undefined" ? SELECT_SONSTIGES : "__sonstiges__";
    html += '<option value="' + escAttr(sonstiges) + '">Sonstiges (manuelle Eingabe)</option>';
  }
  html += "</select>";
  html += '<div id="p1AddPlanOtherWrap" class="p1-add-modal__other" hidden>';
  html += '<label for="p1AddPlanOther">Eigene Bezeichnung</label>';
  html += '<input type="text" id="p1AddPlanOther" class="p1-add-modal__input" placeholder="Bezeichnung eingeben">';
  html += "</div>";
  html += "</div>";
  return html;
}

function renderP1GliederungAddModalBody() {
  ensureP1Tracks();
  const adoptable = getPhase1CandidatesForAdoption("gliederungen");
  const hasPhase1Data = getPhase1SummaryItems("gliederungen").length > 0;
  const defaultMode = adoptable.length ? "phase1" : "plan";

  let html = '<div class="p1-add-modal p1-add-modal--org">';
  html += '<p class="bc-muted p1-add-modal__intro">Organisatorische Gliederung f\u00fcr die Meilensteinplanung anlegen.</p>';
  html += '<p class="bc-muted p1-add-modal__hint" style="font-size:.8rem;margin:0 0 .75rem">Eintr\u00e4ge aus Phase 1 erscheinen automatisch in der Liste. Hier k\u00f6nnen weitere Bereiche aus Phase 1 \u00fcbernommen oder rein f\u00fcr die Planung neu angelegt werden.</p>';

  if (_p1SummaryRefreshFailed) {
    html += '<p class="bc-muted p1-add-modal__empty" style="color:var(--rc-red)">Phase-1-Daten konnten nicht geladen werden.</p>';
  }

  html += '<fieldset class="p1-add-modal__mode">';
  html += '<legend class="p1-add-modal__legend">Art der Anlage</legend>';
  html += '<label class="p1-add-modal__radio"><input type="radio" name="p1AddItemMode" value="phase1"' + (defaultMode === "phase1" ? ' checked' : '') + ' onchange="syncP1AddItemModalMode()"> Aus Phase 1 \u00fcbernehmen</label>';
  html += '<label class="p1-add-modal__radio"><input type="radio" name="p1AddItemMode" value="plan"' + (defaultMode === "plan" ? ' checked' : '') + ' onchange="syncP1AddItemModalMode()"> Neue Bezeichnung anlegen</label>';
  html += '</fieldset>';

  html += '<div id="p1AddPhase1Panel" class="p1-add-modal__panel"' + (defaultMode === "phase1" ? '' : ' hidden') + '>';
  if (adoptable.length) {
    html += '<label for="p1AddPhase1Select">Phase-1-Bereich w\u00e4hlen</label>';
    html += '<select id="p1AddPhase1Select" class="p1-add-modal__select">';
    html += '<option value="">\u2013 Bitte w\u00e4hlen \u2013</option>';
    adoptable.forEach(function (item) {
      const label = item.subcategory || item.label || item.id;
      const badge = p1IstBadge("gliederungen", item);
      html += '<option value="' + escAttr(item.id) + '">' + escAttr(label) + ' (IST: ' + escAttr(badge) + ')</option>';
    });
    html += '</select>';
  } else if (hasPhase1Data) {
    html += '<p class="bc-muted p1-add-modal__empty">Alle erfassten Phase-1-Bereiche sind bereits in der Planung. Nutzen Sie \u201eNeue Bezeichnung anlegen\u201c f\u00fcr zus\u00e4tzliche Planungseintr\u00e4ge.</p>';
  } else {
    html += '<p class="bc-muted p1-add-modal__empty">F\u00fcr diese Unit sind noch keine Bereiche in Phase 1 erfasst. Nutzen Sie \u201eNeue Bezeichnung anlegen\u201c oder erfassen Sie zuerst Phase-1-Daten.</p>';
  }
  html += '</div>';

  html += '<div id="p1AddPlanPanel" class="p1-add-modal__panel"' + (defaultMode === "plan" ? '' : ' hidden') + '>';
  html += '<label for="p1AddPlanOther">Bezeichnung</label>';
  html += '<input type="text" id="p1AddPlanOther" class="p1-add-modal__input" placeholder="z.\u00a0B. Custom Integration Team">';
  html += '<p class="bc-muted p1-add-modal__hint" style="font-size:.76rem;margin:.35rem 0 0">Reine Planung ohne Phase-1-IST. Die Verkn\u00fcpfung erh\u00e4lt eine eigene ID.</p>';
  html += '</div>';
  html += '</div>';
  return html;
}

function renderP1RolleAddModalBody() {
  return renderP1OrgAddModalBody("rollen");
}

function renderP1AddItemModalBody(areaKey, categoryKey) {
  ensureP1Tracks();
  const addLabel = p1AreaAddLabel(areaKey);
  const adoptable = categoryKey ? getPhase1CandidatesForAdoption(areaKey, categoryKey) : [];
  const hasPhase1Data = categoryKey
    ? (areaKey === "portfolio" ? getPortfolioItems(categoryKey).length : 0) > 0
    : false;
  const defaultMode = adoptable.length ? "phase1" : "plan";
  const catLabel = categoryKey ? p1CategoryLabel(areaKey, categoryKey) : "";

  let html = '<div class="p1-add-modal">';
  if (categoryKey) {
    html += '<p class="bc-muted p1-add-modal__intro">Neues Item in <strong>' + escAttr(catLabel) + '</strong> f\u00fcr die Meilensteinplanung anlegen.</p>';
  } else {
    html += '<p class="bc-muted p1-add-modal__intro">Neue ' + escAttr(addLabel.toLowerCase()) + ' f\u00fcr die Meilensteinplanung anlegen.</p>';
  }
  html += '<fieldset class="p1-add-modal__mode">';
  html += '<legend class="p1-add-modal__legend">Art der Anlage</legend>';
  html += '<label class="p1-add-modal__radio"><input type="radio" name="p1AddItemMode" value="phase1"' + (defaultMode === "phase1" ? ' checked' : '') + ' onchange="syncP1AddItemModalMode()"> Aus Phase 1 \u00fcbernehmen</label>';
  html += '<label class="p1-add-modal__radio"><input type="radio" name="p1AddItemMode" value="plan"' + (defaultMode === "plan" ? ' checked' : '') + ' onchange="syncP1AddItemModalMode()"> Neues Item anlegen</label>';
  html += '</fieldset>';

  html += '<div id="p1AddPhase1Panel" class="p1-add-modal__panel"' + (defaultMode === "phase1" ? '' : ' hidden') + '>';
  if (adoptable.length) {
    html += '<label for="p1AddPhase1Select">Phase-1-Eintrag w\u00e4hlen</label>';
    html += '<select id="p1AddPhase1Select" class="p1-add-modal__select">';
    html += '<option value="">– Bitte w\u00e4hlen –</option>';
    adoptable.forEach(function (item) {
      let optValue = "";
      let optLabel = "";
      let badge = "";
      if (areaKey === "portfolio") {
        optValue = item.id;
        optLabel = item.bezeichnung;
        badge = p1IstBadge(areaKey, item);
      } else {
        optValue = item.id || item.subcategory;
        optLabel = item.label || item.subcategory;
        badge = p1IstBadge(areaKey, item);
      }
      html += '<option value="' + escAttr(optValue) + '">' + escAttr(optLabel) + ' (IST: ' + escAttr(badge) + ')</option>';
    });
    html += '</select>';
  } else if (hasPhase1Data) {
    html += '<p class="bc-muted p1-add-modal__empty">Alle erfassten Phase-1-Eintr\u00e4ge in dieser Kategorie sind bereits in der Planung. W\u00e4hlen Sie \u201eNeues Item anlegen\u201c f\u00fcr zus\u00e4tzliche Bereiche.</p>';
  } else {
    html += '<p class="bc-muted p1-add-modal__empty">F\u00fcr diese Kategorie sind noch keine Eintr\u00e4ge in Phase 1 erfasst. Nutzen Sie \u201eNeues Item anlegen\u201c oder erfassen Sie zuerst Phase-1-Daten.</p>';
  }
  html += '</div>';

  html += '<div id="p1AddPlanPanel" class="p1-add-modal__panel"' + (defaultMode === "plan" ? '' : ' hidden') + '>';
  if (areaKey === "portfolio") {
    html += '<label for="p1AddPlanOther">Bezeichnung</label>';
    html += '<input type="text" id="p1AddPlanOther" class="p1-add-modal__input" placeholder="z.\u00a0B. Produktname eingeben">';
  }
  html += '</div>';
  html += '</div>';
  return html;
}

window.syncP1AddItemModalMode = function () {
  const mode = document.querySelector('input[name="p1AddItemMode"]:checked')?.value || "plan";
  const p1Panel = document.getElementById("p1AddPhase1Panel");
  const planPanel = document.getElementById("p1AddPlanPanel");
  if (p1Panel) p1Panel.hidden = mode !== "phase1";
  if (planPanel) planPanel.hidden = mode !== "plan";
};

window.syncP1AddPlanOther = function () {
  const sel = document.getElementById("p1AddPlanSelect");
  const wrap = document.getElementById("p1AddPlanOtherWrap");
  if (!sel || !wrap) return;
  wrap.hidden = sel.value !== (typeof SELECT_SONSTIGES !== "undefined" ? SELECT_SONSTIGES : "__sonstiges__");
};

window.openP1AddItemModal = async function (areaKey, categoryKey) {
  if (!requireBcSaveUnit()) return;
  _p1AddModalArea = areaKey;
  _p1AddModalCategory = categoryKey || null;
  const overlay = document.getElementById("p1AddItemModal");
  const body = document.getElementById("p1AddItemModalBody");
  const title = document.getElementById("p1AddItemModalTitle");
  const confirmBtn = overlay?.querySelector(".bc-modal-actions .btn-primary");
  const modalBox = overlay?.querySelector(".p1-add-modal-box");
  if (!overlay || !body) return;
  const catLabel = categoryKey ? p1CategoryLabel(areaKey, categoryKey) : "";
  if (modalBox) {
    modalBox.classList.toggle("p1-add-modal-box--mitarbeiter", areaKey === "mitarbeiter");
    modalBox.classList.toggle("p1-add-modal-box--org", areaKey === "gliederungen" || areaKey === "rollen");
  }
  if (title) {
    if (areaKey === "mitarbeiter") {
      title.textContent = "Mitarbeiter aus Phase 1 \u00fcbernehmen";
    } else {
      title.textContent = categoryKey
        ? "+ " + p1AreaAddLabel(areaKey) + " in " + catLabel + " anlegen"
        : "+ " + p1AreaAddLabel(areaKey) + " anlegen";
    }
  }
  if (confirmBtn) {
    confirmBtn.textContent = areaKey === "mitarbeiter" ? "\u00dcbernehmen" : "Anlegen";
    confirmBtn.disabled = false;
  }
  overlay.style.display = "";
  body.innerHTML = '<p class="bc-muted">Lade Phase-1-Daten\u2026</p>';
  const refreshed = await refreshP1SummaryCache();
  if (areaKey === "mitarbeiter") {
    body.innerHTML = renderP1MitarbeiterAddModalBody();
    const adoptable = getPhase1CandidatesForAdoption("mitarbeiter");
    if (confirmBtn) confirmBtn.disabled = !refreshed || !adoptable.length;
    return;
  }
  if (areaKey === "gliederungen") {
    body.innerHTML = renderP1GliederungAddModalBody();
    syncP1AddItemModalMode();
    return;
  }
  if (areaKey === "rollen") {
    body.innerHTML = renderP1RolleAddModalBody();
    syncP1AddPlanOther();
    return;
  }
  body.innerHTML = renderP1AddItemModalBody(areaKey, categoryKey);
  syncP1AddItemModalMode();
  syncP1AddPlanOther();
};

window.closeP1AddItemModal = function () {
  const overlay = document.getElementById("p1AddItemModal");
  if (overlay) overlay.style.display = "none";
  const modalBox = overlay?.querySelector(".p1-add-modal-box");
  if (modalBox) {
    modalBox.classList.remove("p1-add-modal-box--mitarbeiter");
    modalBox.classList.remove("p1-add-modal-box--org");
  }
  const confirmBtn = overlay?.querySelector(".bc-modal-actions .btn-primary");
  if (confirmBtn) confirmBtn.textContent = "Anlegen";
  _p1AddModalArea = null;
  _p1AddModalCategory = null;
};

window.confirmP1AddItem = async function () {
  const areaKey = _p1AddModalArea;
  const categoryKey = _p1AddModalCategory;
  if (!areaKey || !requireBcSaveUnit()) return;

  let track = { source: "plan" };

  if (areaKey === "mitarbeiter") {
    const selected = document.querySelector('input[name="p1MitarbeiterPick"]:checked')?.value || "";
    if (!selected) {
      alert("Bitte einen Mitarbeiter aus Phase 1 ausw\u00e4hlen.");
      return;
    }
    const item = ((_p1SummaryCache && _p1SummaryCache.employees) || []).find(function (i) {
      return String(i.skillEntryId) === String(selected);
    });
    if (!item) {
      alert("Mitarbeiter nicht gefunden.");
      return;
    }
    track = p1ApplyEntityRefToTrack(areaKey, {
      subcategory: item.name,
      skillEntryId: item.skillEntryId,
      personalnummer: item.personalnummer,
      source: "phase1",
    });
  } else if (areaKey === "gliederungen") {
    const mode = document.querySelector('input[name="p1AddItemMode"]:checked')?.value || "plan";
    if (mode === "phase1") {
      const selected = document.getElementById("p1AddPhase1Select")?.value || "";
      if (!selected) {
        alert("Bitte einen Phase-1-Bereich ausw\u00e4hlen.");
        return;
      }
      const item = getPhase1SummaryItems("gliederungen").find(function (i) {
        return String(i.id) === String(selected);
      });
      if (!item) {
        alert("Phase-1-Bereich nicht gefunden.");
        return;
      }
      track = p1ApplyEntityRefToTrack(areaKey, {
        subcategory: item.subcategory,
        orgItemId: item.id,
        source: "phase1",
      });
    } else {
      const name = String(document.getElementById("p1AddPlanOther")?.value || "").trim();
      if (!name) {
        alert("Bitte eine Bezeichnung eingeben.");
        document.getElementById("p1AddPlanOther")?.focus();
        return;
      }
      const planOrgId = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : uid();
      track = p1ApplyEntityRefToTrack(areaKey, {
        subcategory: name,
        orgItemId: planOrgId,
        source: "plan",
      });
    }
  } else if (areaKey === "rollen") {
    const sel = document.getElementById("p1AddPlanSelect");
    const other = document.getElementById("p1AddPlanOther");
    const sonstiges = typeof SELECT_SONSTIGES !== "undefined" ? SELECT_SONSTIGES : "__sonstiges__";
    if (!sel || !sel.value) {
      alert("Bitte eine Bezeichnung w\u00e4hlen oder eingeben.");
      return;
    }
    let subcategory = "";
    if (sel.value === sonstiges) {
      subcategory = String(other?.value || "").trim();
      if (!subcategory) {
        alert("Bitte eine eigene Bezeichnung eingeben.");
        other?.focus();
        return;
      }
    } else {
      subcategory = sel.value;
    }
    const p1Match = getPhase1SummaryItems(areaKey).find(function (i) {
      return i.subcategory === subcategory || i.id === subcategory;
    });
    track = p1ApplyEntityRefToTrack(areaKey, {
      subcategory: subcategory,
      orgItemId: p1Match ? p1Match.id : undefined,
      source: p1Match ? "phase1" : "plan",
    });
  } else {
  const mode = document.querySelector('input[name="p1AddItemMode"]:checked')?.value || "plan";

  if (mode === "phase1") {
    const selected = document.getElementById("p1AddPhase1Select")?.value || "";
    if (!selected) {
      alert("Bitte einen Phase-1-Eintrag ausw\u00e4hlen.");
      return;
    }
    if (areaKey === "portfolio") {
      const item = getPortfolioItems(categoryKey).find(function (i) { return i.id === selected; });
      if (!item) {
        alert("Phase-1-Eintrag nicht gefunden.");
        return;
      }
      track = p1ApplyEntityRefToTrack(areaKey, {
        category: categoryKey,
        subcategory: item.bezeichnung,
        phase1Id: item.id,
        source: "phase1",
      });
    } else {
      alert("Phase-1-Eintrag nicht gefunden.");
      return;
    }
  } else {
    if (areaKey === "portfolio") {
      const name = String(document.getElementById("p1AddPlanOther")?.value || "").trim();
      if (!name) {
        alert("Bitte eine Bezeichnung eingeben.");
        document.getElementById("p1AddPlanOther")?.focus();
        return;
      }
      track = p1ApplyEntityRefToTrack(areaKey, {
        category: categoryKey,
        subcategory: name,
        source: "plan",
        itemId: uid(),
      });
    }
  }
  }

  track = p1ApplyEntityRefToTrack(areaKey, track);

  if (hasP1Track(areaKey, track)) {
    alert("Dieser Eintrag ist bereits in der Planung vorhanden.");
    return;
  }

  if (!addP1Track(areaKey, track)) {
    alert("Eintrag konnte nicht angelegt werden.");
    return;
  }

  const openState = ensureP1OpenForNewTrack(collectP1OpenState(), areaKey, categoryKey, track);
  await savePlan({ allowIncomplete: true });
  closeP1AddItemModal();
  initPlanungNew({
    skipFetch: true,
    openState: openState,
    focusTarget: {
      area: areaKey,
      category: categoryKey,
      track: track,
      blockId: p1BlockDomId(areaKey, track),
      yr: YEARS[0],
    },
  });
};

window.openP1AddOrgItemModal = window.openP1AddItemModal;
window.closeP1AddOrgItemModal = window.closeP1AddItemModal;
window.confirmP1AddOrgItem = window.confirmP1AddItem;
window.syncP1AddOrgModalMode = window.syncP1AddItemModalMode;
window.syncP1AddOrgPlanOther = window.syncP1AddPlanOther;

window.toggleP1Ms = function (id) {
  const body = document.getElementById(id);
  if (!body) return;
  body.classList.toggle("closed");
  const wrap = body.closest(".p1-ms");
  if (wrap) wrap.classList.toggle("p1-ms--open", !body.classList.contains("closed"));
};

window.p1SyncMsTitle = function (el) {
  const wrap = el.closest(".p1-ms");
  const titleEl = wrap?.querySelector(".p1-ms__title");
  if (!titleEl) return;
  const text = String(el.value || "").trim();
  titleEl.textContent = text ? text.slice(0, 96) : "Bezeichnung eingeben\u2026";
  titleEl.classList.toggle("p1-ms__title--empty", !text);
};

function p1ResolveTrackRef(ref) {
  const decoded = decodeP1TrackRef(ref);
  if (!decoded) return null;
  ensureP1Tracks();
  const found = getP1Tracks(decoded.area).find(function (t) {
    return p1TracksMatch(decoded.area, t, decoded.track);
  });
  const base = found || decoded.track;
  return { area: decoded.area, track: canonicalP1Track(decoded.area, base) };
}

window.addP1Entry = function(ref, yr) {
  if (!requireBcSaveUnit()) return;
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved) return;
  if (resolved.area === "mitarbeiter") return;
  const openState = collectP1OpenState();
  const entries = getP1Entries(resolved.area, resolved.track, yr);
  entries.unshift(p1MilestoneTemplate(resolved.area, resolved.track, yr));
  setP1Entries(resolved.area, resolved.track, yr, entries);
  initPlanungNew({
    skipFetch: true,
    openState: openState,
    focusTarget: { area: resolved.area, track: resolved.track, yr: yr, idx: 0 },
  });
};

window.addP1EmployeeSkillEntry = function() {
  // Katalog-Skills werden automatisch angelegt; manuelles Hinzufügen entfällt.
};

window.delP1Entry = function(ref, yr, idx) {
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved) return;
  if (resolved.area === "mitarbeiter") return;
  if (!confirm("Meilenstein l\u00f6schen?")) return;
  const openState = collectP1OpenState();
  const entries = getP1Entries(resolved.area, resolved.track, yr);
  entries.splice(idx, 1);
  setP1Entries(resolved.area, resolved.track, yr, entries);
  const focusTarget = entries.length
    ? { area: resolved.area, track: resolved.track, yr: yr, idx: Math.min(idx, entries.length - 1) }
    : { area: resolved.area, track: resolved.track, yr: yr };
  initPlanungNew({ skipFetch: true, openState: openState, focusTarget: focusTarget });
};

window.delP1YearEntries = async function (ref, yr) {
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved) return;
  const entries = getP1Entries(resolved.area, resolved.track, yr);
  if (!entries.length) return;
  const deleteLabel = resolved.area === "mitarbeiter"
    ? "Alle Bewertungen f\u00fcr " + yr + " zur\u00fccksetzen?"
    : "Alle " + entries.length + " Meilenstein(e) f\u00fcr " + yr + " l\u00f6schen?";
  if (!confirm(deleteLabel)) return;
  if (!requireBcSaveUnit()) return;
  const openState = collectP1OpenState();
  if (resolved.area === "mitarbeiter") {
    ensureP1EmployeeSkillCatalog(resolved.area, resolved.track, yr, []);
  } else {
    setP1Entries(resolved.area, resolved.track, yr, []);
    seedP1TrackMilestonesForAllYears(resolved.area, resolved.track);
  }
  await savePlan({ allowIncomplete: true });
  initPlanungNew({
    skipFetch: true,
    openState: openState,
    focusTarget: { area: resolved.area, track: resolved.track, yr: yr },
  });
};

function ensureP1YearEntry(area, track, yr, idx) {
  let entries = getP1Entries(area, track, yr);
  if (!entries[idx]) {
    if (area === "mitarbeiter") {
      ensureP1EmployeeSkillCatalog(area, track, yr, entries);
    } else {
      entries = entries.slice();
      while (entries.length <= idx) {
        entries.push(p1MilestoneTemplate(area, track, yr));
      }
      setP1Entries(area, track, yr, entries);
    }
  }
  return getP1Entries(area, track, yr);
}

window.delP1Track = async function (ref) {
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved) return;
  const deleteLabel = p1UsesFlatYearPlan(resolved.area)
    ? p1FlatTrackDeleteLabel(resolved.area) + "?"
    : "Meilenstein und alle Jahres-Eintr\u00e4ge l\u00f6schen?";
  if (!confirm(deleteLabel)) return;
  if (!requireBcSaveUnit()) return;
  const openState = collectP1OpenState();
  removeP1TrackMeasures(resolved.area, resolved.track);
  ensureP1Tracks();
  const list = plan.meta.p1Tracks[resolved.area];
  if (list) {
    plan.meta.p1Tracks[resolved.area] = list.filter(function (t) {
      return !p1TracksMatch(resolved.area, t, resolved.track);
    });
  }
  await savePlan({ allowIncomplete: true });
  initPlanungNew({ skipFetch: true, openState: openState });
};

window.updP1 = function(el, ref, yr, idx, field) {
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved) return;
  const entries = ensureP1YearEntry(resolved.area, resolved.track, yr, idx);
  if (!entries[idx]) return;
  entries[idx][field] = el.value;
  if (entries[idx].skillPlanKind) p1NormalizeEmployeeSkillPlanEntry(entries[idx]);
  entries[idx].updatedAt = new Date().toISOString();
  setP1Entries(resolved.area, resolved.track, yr, entries);
  if (p1UsesFlatYearPlan(resolved.area) && (field === "ergebnis" || field === "ziel_quartal")) {
    p1ToggleFlatPlanRowFilled(el, resolved.area, entries[idx]);
  }
  if (resolved.area === "mitarbeiter" && field === "ergebnis") {
    const row = el.closest(".p1-skill-plan__row");
    if (row) {
      row.classList.toggle("p1-skill-plan__row--filled", p1MilestoneHasPlanContent(entries[idx], resolved.area));
    }
    const acc = el.closest(".p1-acc");
    const countEl = acc?.querySelector(".p1-acc__count");
    if (countEl) countEl.textContent = p1EmployeeSkillYearCountText(resolved.area, resolved.track, yr);
    const block = document.getElementById(p1BlockDomId(resolved.area, resolved.track));
    const trackCountEl = block?.querySelector(".p1-subcat__count");
    if (trackCountEl) trackCountEl.textContent = p1TrackMilestoneCountLabel(resolved.area, resolved.track);
  }
  if (field === "bezeichnung") {
    const mid = p1MilestoneDomId(resolved.area, resolved.track, yr, idx);
    const titleEl = document.getElementById(mid + "_title");
    if (titleEl) {
      titleEl.textContent = p1MilestoneTitle(entries[idx], resolved.area, yr);
      titleEl.classList.toggle("p1-ms__title--empty", !String(el.value || "").trim());
    }
  }
};

window.updP1Num = function(el, ref, yr, idx, field) {
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved) return;
  const entries = ensureP1YearEntry(resolved.area, resolved.track, yr, idx);
  if (!entries[idx]) return;
  const normalized = p1NormalizeNumericFieldValue(field, el.value);
  entries[idx][field] = normalized;
  if (el) {
    el.value = normalized == null ? "" : String(normalized);
  }
  if (p1UsesFlatYearPlan(resolved.area)) {
    p1ToggleFlatPlanRowFilled(el, resolved.area, entries[idx]);
  }
  if (entries[idx].skillPlanKind) p1NormalizeEmployeeSkillPlanEntry(entries[idx]);
  entries[idx].updatedAt = new Date().toISOString();
  setP1Entries(resolved.area, resolved.track, yr, entries);
};

window.updP1SkillCategory = function(el, ref, yr, idx) {
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved) return;
  const entries = getP1Entries(resolved.area, resolved.track, yr);
  if (!entries[idx]) return;
  const opt = el.options[el.selectedIndex];
  const id = String(opt?.value || "").trim();
  entries[idx].kategorie_id = id ? Number(id) : null;
  entries[idx].kategorie = String(opt?.getAttribute("data-name") || opt?.textContent || "").trim();
  p1NormalizeEmployeeSkillPlanEntry(entries[idx]);
  entries[idx].updatedAt = new Date().toISOString();
  setP1Entries(resolved.area, resolved.track, yr, entries);
  p1SyncEmployeeSkillPlanTitle(ref, yr, idx);
};

window.updP1SkillLevel = function(el, ref, yr, idx) {
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved) return;
  const entries = getP1Entries(resolved.area, resolved.track, yr);
  if (!entries[idx]) return;
  const v = el.value.trim();
  entries[idx].ziel_skill_level_min = v === "" ? 1 : Number(v);
  entries[idx].skill_level_explicit = true;
  p1NormalizeEmployeeSkillPlanEntry(entries[idx]);
  entries[idx].updatedAt = new Date().toISOString();
  setP1Entries(resolved.area, resolved.track, yr, entries);
};

window.setP1SkillLevel = function(ref, yr, idx, level) {
  if (!requireBcSaveUnit()) return;
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved || resolved.area !== "mitarbeiter") return;
  const entries = ensureP1YearEntry(resolved.area, resolved.track, yr, idx);
  if (!entries[idx]) return;
  const lvl = Math.max(1, Math.min(5, Number(level) || 1));
  entries[idx].ziel_skill_level_min = lvl;
  entries[idx].skill_level_explicit = true;
  p1NormalizeEmployeeSkillPlanEntry(entries[idx]);
  entries[idx].updatedAt = new Date().toISOString();
  setP1Entries(resolved.area, resolved.track, yr, entries);

  const block = document.getElementById(p1BlockDomId(resolved.area, resolved.track));
  const row = block?.querySelector(
    '.p1-skill-plan[data-yr="' + yr + '"] .p1-skill-plan__row[data-idx="' + idx + '"]'
  );
  if (row) {
    row.querySelectorAll(".p1-skill-level-btn").forEach(function (btn) {
      const n = Number(btn.textContent);
      const active = n === lvl;
      btn.classList.remove("p1-skill-level-btn--active", "p1-skill-level-btn--default");
      if (active) {
        btn.classList.add("p1-skill-level-btn--active");
      }
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    row.classList.toggle("p1-skill-plan__row--filled", p1MilestoneHasPlanContent(entries[idx], resolved.area));
    const acc = row.closest(".p1-acc");
    const countEl = acc?.querySelector(".p1-acc__count");
    if (countEl) countEl.textContent = p1EmployeeSkillYearCountText(resolved.area, resolved.track, yr);
    const block = document.getElementById(p1BlockDomId(resolved.area, resolved.track));
    const trackCountEl = block?.querySelector(".p1-subcat__count");
    if (trackCountEl) trackCountEl.textContent = p1TrackMilestoneCountLabel(resolved.area, resolved.track);
  }
};

window.p1SyncEmployeeSkillPlanTitle = function(ref, yr, idx) {
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved) return;
  const entries = getP1Entries(resolved.area, resolved.track, yr);
  const ms = entries[idx];
  if (!ms) return;
  p1NormalizeEmployeeSkillPlanEntry(ms);
  setP1Entries(resolved.area, resolved.track, yr, entries);
  const mid = p1MilestoneDomId(resolved.area, resolved.track, yr, idx);
  const titleEl = document.getElementById(mid + "_title");
  if (!titleEl) return;
  const title = p1EmployeeSkillPlanTitle(ms);
  titleEl.textContent = title;
  titleEl.classList.toggle("p1-ms__title--empty", !p1EmployeeSkillPlanHasContent(ms));
};

window.moveP1Track = async function (ref, delta) {
  if (!requireBcSaveUnit()) return;
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved) return;
  if (!p1MoveTrackInList(resolved.area, resolved.track, delta)) return;
  const openState = collectP1OpenState();
  await savePlan({ allowIncomplete: true, silent: true });
  initPlanungNew({
    skipFetch: true,
    openState: openState,
    focusTarget: {
      area: resolved.area,
      track: resolved.track,
      blockId: p1BlockDomId(resolved.area, resolved.track),
    },
  });
};

window.p1SyncPortfolioMsTitle = function (el) {
  const wrap = el.closest(".p1-ms");
  const titleEl = wrap?.querySelector(".p1-ms__title");
  if (!titleEl) return;
  const yr = wrap?.dataset?.yr;
  const text = String(el.value || "").trim();
  const firstLine = text.split("\n")[0].trim();
  if (firstLine) {
    titleEl.textContent = firstLine.length <= 96 ? firstLine : firstLine.slice(0, 93) + "\u2026";
    titleEl.classList.remove("p1-ms__title--empty");
  } else {
    titleEl.textContent = yr ? "Beschreibung f\u00fcr " + yr + "\u2026" : "Beschreibung eingeben\u2026";
    titleEl.classList.add("p1-ms__title--empty");
  }
};

function patchP1TrackInMeta(area, track, patch) {
  ensureP1Tracks();
  let updated = null;
  const list = plan.meta.p1Tracks[area] || [];
  plan.meta.p1Tracks[area] = list.map(function (t) {
    if (!p1TracksMatch(area, t, track)) return t;
    updated = p1ApplyEntityRefToTrack(area, Object.assign({}, t, patch));
    return updated;
  });
  return updated;
}

window.updP1TrackField = function (el, ref, field) {
  if (!requireBcSaveUnit()) return;
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved || !p1UsesFlatYearPlan(resolved.area)) return;
  const area = resolved.area;
  const value = String(el.value || "").trim();
  if (field === "bezeichnung") {
    const updated = patchP1TrackInMeta(area, resolved.track, { subcategory: value });
    syncTrackSubcategoryInPlan(area, resolved.track, value);
    const block = document.getElementById(p1BlockDomId(area, updated || resolved.track));
    const labelEl = block?.querySelector(".p1-subcat__label");
    if (labelEl) labelEl.textContent = value || "\u2013";
    YEARS.forEach(function (yr) {
      const entries = getP1Entries(area, resolved.track, yr);
      entries.forEach(function (ms) {
        ms.bezeichnung = value;
      });
      if (entries.length) setP1Entries(area, resolved.track, yr, entries);
    });
  } else if (field === "verantwortlich") {
    patchP1TrackInMeta(area, resolved.track, { verantwortlich: value });
  }
};

async function applyFlatTrackMetaFromDom(area, track) {
  const domId = p1TrackDomId(area, track);
  const bezEl = document.getElementById(domId + "_bezeichnung");
  const verEl = document.getElementById(domId + "_verantwortlich");
  const newName = bezEl ? String(bezEl.value || "").trim() : "";
  const verantwortlich = verEl ? String(verEl.value || "").trim() : "";
  const currentName = resolveEntityLabel(area, track);
  if (area === "portfolio") {
    const phase1Id = track.phase1Id || (track.entityRef?.kind === "portfolio" ? track.entityRef.id : null);
    if (phase1Id && newName && newName !== currentName) {
      await renamePortfolioPhase1Entry(phase1Id, newName);
      await refreshP1SummaryCache();
    }
  }
  if (newName) syncTrackSubcategoryInPlan(area, track, newName);
  return patchP1TrackInMeta(area, track, {
    subcategory: newName || track.subcategory,
    verantwortlich: verantwortlich,
  });
};

window.saveP1Track = async function(ref) {
  if (!requireBcSaveUnit()) return;
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved) return;
  let updatedTrack = resolved.track;
  if (p1UsesFlatYearPlan(resolved.area)) {
    try {
      updatedTrack = await applyFlatTrackMetaFromDom(resolved.area, resolved.track) || resolved.track;
    } catch (e) {
      alert(e.message || "Speichern fehlgeschlagen.");
      return;
    }
  }
  p1FlushTrackFormToPlan(resolved.area, updatedTrack);
  const openState = collectP1OpenState();
  const ok = await savePlan({ allowIncomplete: true });
  if (!ok) return;
  if (typeof toast === "function") toast("Gespeichert");
  initPlanungNew({
    skipFetch: true,
    openState: openState,
    focusTarget: { area: resolved.area, track: updatedTrack },
  });
};

window.saveP1Milestone = async function(ref, yr, idx) {
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved) return;
  const entries = getP1Entries(resolved.area, resolved.track, yr);
  const ms = entries[idx];
  if (!ms) return;
  if (ms.skillPlanKind) {
    p1NormalizeEmployeeSkillPlanEntry(ms);
    setP1Entries(resolved.area, resolved.track, yr, entries);
  } else if (p1UsesFlatYearPlan(resolved.area)) {
    p1FlushMilestoneFieldsFromDom(resolved.area, resolved.track, yr, idx, ms);
    if (!String(ms.ergebnis || "").trim()) {
      alert("Bitte das Feld \u201eBeschreibung\u201c ausf\u00fcllen.");
      return;
    }
    setP1Entries(resolved.area, resolved.track, yr, entries);
  } else {
    if (!String(ms.bezeichnung || "").trim()) {
      alert("Bitte das Feld \u201eBezeichnung\u201c ausf\u00fcllen.");
      return;
    }
    if (!String(ms.ergebnis || "").trim()) {
      alert("Bitte das Feld \u201eBeschreibung\u201c ausf\u00fcllen.");
      return;
    }
  }
  const openState = collectP1OpenState();
  const mid = p1MilestoneDomId(resolved.area, resolved.track, yr, idx);
  openState.milestones = (openState.milestones || []).filter(function (id) { return id !== mid; });
  const ok = await savePlan({ allowIncomplete: true });
  if (!ok) return;
  initPlanungNew({
    skipFetch: true,
    openState: openState,
    focusTarget: { area: resolved.area, track: resolved.track, yr: yr },
  });
};

let _p1RenameCtx = null;

function syncTrackSubcategoryInPlan(area, track, newSubcategory) {
  const name = String(newSubcategory || "").trim();
  if (!name) return null;
  ensureP1Tracks();
  const measureId = p1TrackMeasureId(area, track);
  const keyPrefix = "P1||" + area + "||" + measureId + "||";
  let updatedTrack = null;

  const list = plan.meta.p1Tracks[area] || [];
  plan.meta.p1Tracks[area] = list.map(function (t) {
    if (!p1TracksMatch(area, t, track)) return t;
    updatedTrack = p1ApplyEntityRefToTrack(area, Object.assign({}, t, { subcategory: name }));
    return updatedTrack;
  });

  Object.keys(plan.measures || {}).forEach(function (key) {
    if (key.indexOf(keyPrefix) !== 0) return;
    (plan.measures[key] || []).forEach(function (m) {
      if (!m || m.kind !== "p1Year") return;
      m.subcategory = name;
      if (p1UsesFlatYearPlan(area)) m.bezeichnung = name;
    });
  });

  return updatedTrack || p1ApplyEntityRefToTrack(area, Object.assign({}, track, { subcategory: name }));
}

async function renamePortfolioPhase1Entry(phase1Id, newBezeichnung) {
  const res = await fetch("/api/entries", { credentials: "include" });
  if (!res.ok) throw new Error("Phase-1-Daten konnten nicht geladen werden.");
  const entries = await res.json();
  const entry = entries.find(function (e) { return e.id === phase1Id; });
  if (!entry) throw new Error("Portfolio-Eintrag in Phase 1 nicht gefunden.");
  const payload = Object.assign({}, entry, {
    id: phase1Id,
    type: "portfolio",
    bezeichnung: newBezeichnung,
  });
  const putRes = await fetch("/api/entries/" + encodeURIComponent(phase1Id), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entry: payload }),
  });
  if (!putRes.ok) {
    const body = await putRes.json().catch(function () { return {}; });
    throw new Error(body.error || "Speichern in Phase 1 fehlgeschlagen.");
  }
}

window.openP1RenameTrack = function (ref) {
  if (!requireBcSaveUnit()) return;
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved || resolved.area !== "portfolio") return;
  const merged = mergeTrackWithPhase1(resolved.area, resolved.track);
  const currentLabel = merged.label || resolved.track.subcategory || "";
  _p1RenameCtx = { area: resolved.area, track: resolved.track, ref: ref };
  const overlay = document.getElementById("p1RenameModal");
  const input = document.getElementById("p1RenameInput");
  const hint = document.getElementById("p1RenameModalHint");
  if (!overlay || !input) return;
  if (hint) {
    if (resolved.track.phase1Id || resolved.track.entityRef?.kind === "portfolio") {
      hint.textContent = "Die Bezeichnung wird in Phase 1 (Statusaufnahme) ge\u00e4ndert und gilt damit in Planung und Fortschritt f\u00fcr alle Jahre.";
    } else {
      hint.textContent = "Plan-only-Eintrag: Die Bezeichnung wird nur in dieser Planung ge\u00e4ndert. F\u00fcr eine dauerhafte Verkn\u00fcpfung zuerst in Phase 1 erfassen und \u00fcbernehmen.";
    }
  }
  input.value = currentLabel;
  overlay.style.display = "";
  setTimeout(function () { input.focus(); input.select(); }, 50);
};

window.closeP1RenameModal = function () {
  const overlay = document.getElementById("p1RenameModal");
  if (overlay) overlay.style.display = "none";
  _p1RenameCtx = null;
};

window.confirmP1RenameTrack = async function () {
  if (!_p1RenameCtx || !requireBcSaveUnit()) return;
  const newName = String(document.getElementById("p1RenameInput")?.value || "").trim();
  if (!newName) {
    alert("Bitte eine Bezeichnung eingeben.");
    return;
  }
  const ctx = _p1RenameCtx;
  const openState = collectP1OpenState();
  try {
    const phase1Id = ctx.track.phase1Id
      || (ctx.track.entityRef?.kind === "portfolio" ? ctx.track.entityRef.id : null);
    if (phase1Id) {
      await renamePortfolioPhase1Entry(phase1Id, newName);
      await refreshP1SummaryCache();
    }
    const updatedTrack = syncTrackSubcategoryInPlan(ctx.area, ctx.track, newName);
    await savePlan({ allowIncomplete: true, silent: true });
    closeP1RenameModal();
    initPlanungNew({
      skipFetch: false,
      openState: openState,
      focusTarget: {
        area: ctx.area,
        category: updatedTrack?.category || ctx.track.category,
        track: updatedTrack || ctx.track,
        blockId: p1BlockDomId(ctx.area, updatedTrack || ctx.track),
      },
    });
    if (typeof toast === "function") {
      toast(phase1Id ? "Bezeichnung in Phase 1 gespeichert" : "Bezeichnung gespeichert");
    }
  } catch (e) {
    alert(e.message || "Umbenennen fehlgeschlagen.");
  }
};
