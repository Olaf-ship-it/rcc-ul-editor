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
  { key: "mitarbeiter", label: "Mitarbeiter-Entwicklung", icon: "\ud83d\udc64" },
];

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

function trackHasMilestones(areaKey, track) {
  const keyPrefix = "P1||" + areaKey + "||" + p1TrackMeasureId(areaKey, track) + "||";
  return Object.keys(plan.measures || {}).some(function (k) {
    return k.indexOf(keyPrefix) === 0 && (plan.measures[k] || []).length > 0;
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
      if (p1IsCategorizedArea(areaKey)) {
        m.category = newTrack.category;
        m.subcategory = newTrack.subcategory;
        if (newTrack.phase1Id) m.phase1Id = newTrack.phase1Id;
        if (newTrack.itemId) m.itemId = newTrack.itemId;
        if (newTrack.skillItemId) m.skillItemId = newTrack.skillItemId;
        if (newTrack.orgItemId) m.orgItemId = newTrack.orgItemId;
        if (newTrack.skillEntryId) m.skillEntryId = newTrack.skillEntryId;
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
  if (plan.meta.p1Tracks != null) return;

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
      _hasPhase1: true,
    });
  }
  return {
    subcategory: track.subcategory,
    label: track.subcategory || "\u2013",
    source: track.source,
    orgItemId: track.orgItemId,
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
      };
    }),
    softSkills: soft.map(function (s) {
      return {
        kind: "soft",
        kategorie: String(s.kategorie || "Sonstiges").trim(),
        level: Number.isFinite(Number(s.level)) ? Number(s.level) : null,
      };
    }),
  };
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

function getP1Entries(area, track, yr) {
  const canonical = canonicalP1Track(area, track);
  const key = p1Key(area, canonical, yr);
  let v = plan.measures[key];
  if (!v && track) {
    const legacyId = p1TrackMeasureId(area, track);
    const canonId = p1TrackMeasureId(area, canonical);
    if (legacyId !== canonId) {
      const legacyKey = p1Key(area, legacyId, yr);
      v = plan.measures[legacyKey];
      if (v) {
        plan.measures[key] = v;
        delete plan.measures[legacyKey];
      }
    }
  }
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
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
    ziel_quartal: "",
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
  return base;
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
  return Boolean(
    String(ms?.kategorie || "").trim()
      || String(ms?.technologie || "").trim()
      || String(ms?.kompetenz || "").trim()
      || ms?.ziel_skill_level_min != null
  );
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
  if (ms.skillEntryId) {
    const emp = (_p1SummaryCache?.employees || []).find(function (e) {
      return String(e.skillEntryId) === String(ms.skillEntryId);
    });
    if (emp && ms.skillPlanKind === "tech") {
      const match = (emp.skills || []).find(function (s) {
        const sameKat = String(s.kategorie || "").trim() === String(ms.kategorie || "").trim();
        const tech = String(ms.technologie || "").trim();
        const sTech = String(s.technologie || "").trim();
        return sameKat && (!tech || !sTech || tech === sTech);
      });
      if (match && match.skillItemId) ms.skillItemId = match.skillItemId;
    }
  }
  ms.bezeichnung = p1EmployeeSkillPlanTitle(ms);
  return ms;
}

function p1KpiFields(area) {
  if (area === "portfolio") return [["ziel_umsatz_teur", "Ziel-Umsatz (TEUR)", "number"]];
  if (area === "gliederungen") return [["ziel_headcount", "Ziel-Headcount", "number"], ["ziel_umsatz_teur", "Ziel-Umsatz (TEUR)", "number"]];
  if (area === "rollen") return [["ziel_anzahl", "Ziel-Anzahl", "number"]];
  if (area === "mitarbeiter") return [["ziel_skill_level_min", "Ziel-\u00d8-Level (1\u20135)", "number"]];
  return [];
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

function p1YearMilestoneCountText(count, area) {
  if (area === "mitarbeiter") return count ? count + " Skill(s)" : "leer";
  return count ? count + " Meilenstein(e)" : "leer";
}

function countP1TrackMilestones(area, track) {
  let total = 0;
  YEARS.forEach(function (yr) {
    total += getP1Entries(area, track, yr).length;
  });
  return total;
}

function removeP1TrackMeasures(area, track) {
  const prefix = "P1||" + area + "||" + p1TrackMeasureId(area, track) + "||";
  Object.keys(plan.measures || {}).forEach(function (key) {
    if (key.indexOf(prefix) === 0) delete plan.measures[key];
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

function p1MilestoneTitle(ms) {
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

function p1MilestoneHasContent(ms) {
  return Boolean(String(ms?.bezeichnung || "").trim() || String(ms?.ergebnis || "").trim());
}

function p1FlushMilestoneFieldsFromDom(area, track, yr, idx, ms) {
  const idPart = p1TrackMeasureId(area, track).replace(/[^a-zA-Z0-9]/g, "_");
  const eid = "p1_" + area + "_" + idPart + "_" + yr + "_" + idx;
  const bez = document.getElementById(eid + "_bezeichnung");
  const erg = document.getElementById(eid + "_ergebnis");
  if (bez) ms.bezeichnung = bez.value;
  if (erg) ms.ergebnis = erg.value;
  const ver = document.getElementById(eid + "_verantwortlich");
  if (ver) ms.verantwortlich = ver.value;
  const quartal = document.getElementById(eid + "_ziel_quartal");
  if (quartal) ms.ziel_quartal = quartal.value;
  p1KpiFields(area).forEach(function (f) {
    const el = document.getElementById(eid + "_" + f[0]);
    if (!el) return;
    const v = el.value.trim();
    ms[f[0]] = v === "" ? null : Number(v);
  });
  ms.updatedAt = new Date().toISOString();
}

function p1FlushTrackFormToPlan(area, track) {
  const canonical = canonicalP1Track(area, track);
  YEARS.forEach(function (yr) {
    const entries = getP1Entries(area, canonical, yr);
    entries.forEach(function (ms, idx) {
      p1FlushMilestoneFieldsFromDom(area, canonical, yr, idx, ms);
    });
    if (entries.length) setP1Entries(area, canonical, yr, entries);
  });
  ensureP1Tracks();
  const list = plan.meta.p1Tracks[area];
  if (list) {
    plan.meta.p1Tracks[area] = list.map(function (t) {
      if (!p1TracksMatch(area, t, track) && !p1TracksMatch(area, t, canonical)) return t;
      return p1TrackMetaFromCanonical(area, t);
    });
  }
}

function renderP1MilestoneForm(area, track, yr, idx, ms, forceOpen) {
  const fields = p1KpiFields(area);
  const ref = encodeP1TrackRef(area, track);
  const idPart = p1TrackMeasureId(area, track).replace(/[^a-zA-Z0-9]/g, "_");
  const eid = "p1_" + area + "_" + idPart + "_" + yr + "_" + idx;
  const mid = p1MilestoneDomId(area, track, yr, idx);
  const title = p1MilestoneTitle(ms);
  const hasContent = p1MilestoneHasContent(ms);
  const bodyOpen = forceOpen || !hasContent;
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
    html += '<div class="p1-ms__field p1-ms__field--kpi"><label>' + escAttr(f[1]) + '</label>';
    html += '<input type="number" step="any" id="' + eid + "_" + f[0] + '" value="' + (val != null ? val : "") + '" oninput="updP1Num(this,\'' + escAttr(ref) + '\',' + yr + ',' + idx + ',\'' + f[0] + '\')" onchange="updP1Num(this,\'' + escAttr(ref) + '\',' + yr + ',' + idx + ',\'' + f[0] + '\')">';
    html += '</div>';
  });
  html += '<div class="p1-ms__field p1-ms__field--kpi"><label>Quartal</label>';
  html += '<select id="' + eid + '_ziel_quartal" onchange="updP1(this,\'' + escAttr(ref) + '\',' + yr + ',' + idx + ',\'ziel_quartal\')">';
  html += '<option value="">--</option>';
  ["Q1","Q2","Q3","Q4"].forEach(function(q) {
    html += '<option value="' + q + '"' + (ms.ziel_quartal === q ? ' selected' : '') + '>' + q + '</option>';
  });
  html += '</select></div>';
  html += '<div class="p1-ms__field p1-ms__field--kpi"><label>Verantwortlich</label>';
  html += '<input type="text" id="' + eid + '_verantwortlich" value="' + escAttr(ms.verantwortlich || "") + '" onchange="updP1(this,\'' + escAttr(ref) + '\',' + yr + ',' + idx + ',\'verantwortlich\')">';
  html += '</div>';
  html += '</div>';
  html += '</div></div>';
  return html;
}

function renderP1EmployeeSkillPlanForm(area, track, yr, idx, ms, forceOpen) {
  const ref = encodeP1TrackRef(area, track);
  const idPart = p1TrackMeasureId(area, track).replace(/[^a-zA-Z0-9]/g, "_");
  const eid = "p1_" + area + "_" + idPart + "_" + yr + "_" + idx;
  const mid = p1MilestoneDomId(area, track, yr, idx);
  const employeeItem = findEmployeePhase1Item(track);
  const istLevel = findEmployeeIstSkillLevel(employeeItem, ms);
  const title = p1EmployeeSkillPlanTitle(ms);
  const hasContent = p1EmployeeSkillPlanHasContent(ms);
  const bodyOpen = forceOpen || !hasContent;
  const titleCls = hasContent ? "p1-ms__title" : "p1-ms__title p1-ms__title--empty";
  const bodyCls = bodyOpen ? "p1-ms__body" : "p1-ms__body closed";
  const wrapCls = bodyOpen ? "p1-ms p1-ms--open" : "p1-ms";
  const isTech = ms.skillPlanKind === "tech";
  const kindLabel = isTech ? "Fachskill" : "Soft Skill";

  let html = '<div class="' + wrapCls + ' p1-ms--employee-skill" data-ref="' + escAttr(ref) + '" data-yr="' + yr + '" data-idx="' + idx + '">';
  html += '<div class="p1-ms__head" onclick="toggleP1Ms(\'' + mid + '\')" role="button" tabindex="0" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();toggleP1Ms(\'' + mid + '\')}">';
  html += '<span class="p1-ms__chev" aria-hidden="true"></span>';
  html += '<span class="p1-ms__kind-badge p1-ms__kind-badge--' + (isTech ? "tech" : "soft") + '">' + kindLabel + "</span>";
  html += '<span class="' + titleCls + '" id="' + mid + '_title">' + escAttr(title) + "</span>";
  if (istLevel != null) {
    html += '<span class="p1-ms__ist-level">IST Lvl ' + escAttr(String(istLevel)) + "</span>";
  }
  html += '<span class="p1-ms__actions" onclick="event.stopPropagation()">';
  html += p1SaveBtn("saveP1Milestone('" + escAttr(ref) + "'," + yr + "," + idx + ")");
  html += p1TrashBtn("delP1Entry('" + escAttr(ref) + "'," + yr + "," + idx + ")", "L\u00f6schen");
  html += "</span></div>";

  html += '<div id="' + mid + '" class="' + bodyCls + '">';
  html += '<div class="p1-employee-skill-plan">';
  html += '<div class="p1-ms__field"><label>' + (isTech ? "Skill-Kategorie" : "Soft-Skill-Kategorie") + "</label>";
  html += '<select onchange="updP1SkillCategory(this,\'' + escAttr(ref) + '\',' + yr + "," + idx + ')\">';
  html += p1SkillCategoryOptions(ms.skillPlanKind, ms.kategorie_id, ms.kategorie);
  html += "</select></div>";

  if (isTech) {
    html += '<div class="p1-ms__field"><label>Technologie / Details</label>';
    html += '<input type="text" value="' + escAttr(ms.technologie || "") + '" placeholder="z.\u00a0B. AWS, SAP BTP" oninput="p1SyncEmployeeSkillPlanTitle(\'' + escAttr(ref) + '\',' + yr + "," + idx + ')" onchange="updP1(this,\'' + escAttr(ref) + '\',' + yr + "," + idx + ",\'technologie\')\">";
    html += "</div>";
  } else {
    html += '<div class="p1-ms__field"><label>Weitere Details</label>';
    html += '<input type="text" value="' + escAttr(ms.kompetenz || "") + '" placeholder="Weitere Details" oninput="p1SyncEmployeeSkillPlanTitle(\'' + escAttr(ref) + '\',' + yr + "," + idx + ')" onchange="updP1(this,\'' + escAttr(ref) + '\',' + yr + "," + idx + ",\'kompetenz\')\">";
    html += "</div>";
  }

  html += '<div class="p1-ms__kpi-grid">';
  html += '<div class="p1-ms__field p1-ms__field--kpi"><label>Ziel-Level (1\u20135)</label>';
  html += '<select onchange="updP1SkillLevel(this,\'' + escAttr(ref) + '\',' + yr + "," + idx + ")\">";
  html += p1SkillLevelOptions(ms.ziel_skill_level_min);
  html += "</select></div>";
  html += '<div class="p1-ms__field p1-ms__field--kpi"><label>Quartal</label>';
  html += '<select onchange="updP1(this,\'' + escAttr(ref) + '\',' + yr + "," + idx + ",\'ziel_quartal\')\">";
  html += '<option value="">--</option>';
  ["Q1", "Q2", "Q3", "Q4"].forEach(function (q) {
    html += '<option value="' + q + '"' + (ms.ziel_quartal === q ? " selected" : "") + ">" + q + "</option>";
  });
  html += "</select></div>";
  html += '<div class="p1-ms__field p1-ms__field--kpi"><label>Verantwortlich</label>';
  html += '<input type="text" value="' + escAttr(ms.verantwortlich || "") + '" onchange="updP1(this,\'' + escAttr(ref) + '\',' + yr + "," + idx + ",\'verantwortlich\')\">";
  html += "</div></div>";

  html += '<div class="p1-ms__field"><label>Bemerkungen</label>';
  html += '<textarea id="' + eid + '_ergebnis" rows="2" onchange="updP1(this,\'' + escAttr(ref) + '\',' + yr + "," + idx + ",\'ergebnis\')\">" + escAttr(ms.ergebnis || "") + "</textarea>";
  html += "</div></div></div></div>";
  return html;
}

function renderP1MitarbeiterYearEntry(area, track, yr, idx, ms, forceOpen) {
  if (ms && (ms.skillPlanKind === "tech" || ms.skillPlanKind === "soft")) {
    return renderP1EmployeeSkillPlanForm(area, track, yr, idx, ms, forceOpen);
  }
  return renderP1MilestoneForm(area, track, yr, idx, ms, forceOpen);
}

function renderP1YearAccordion(area, track, yr, isFirst, openMsIdx) {
  const entries = getP1Entries(area, track, yr);
  const count = entries.length;
  const ref = encodeP1TrackRef(area, track);
  const openCls = isFirst ? " p1-acc--open" : "";
  const isMitarbeiter = area === "mitarbeiter";
  let html = '<div class="p1-acc' + openCls + '" data-yr="' + yr + '">';
  html += '<div class="p1-acc__head" onclick="this.parentElement.classList.toggle(\'p1-acc--open\')">';
  html += '<span class="p1-acc__yr">' + yr + '</span>';
  html += '<span class="p1-acc__count">' + p1YearMilestoneCountText(count, area) + '</span>';
  if (count) {
    html += '<span class="p1-acc__actions" onclick="event.stopPropagation()">';
    html += p1TrashBtn(
      "delP1YearEntries('" + escAttr(ref) + "'," + yr + ")",
      isMitarbeiter ? "Alle Skills f\u00fcr " + yr + " l\u00f6schen" : "Alle Meilensteine f\u00fcr " + yr + " l\u00f6schen"
    );
    html += '</span>';
  }
  html += '</div>';
  html += '<div class="p1-acc__body">';
  entries.forEach(function(ms, idx) {
    if (isMitarbeiter) {
      html += renderP1MitarbeiterYearEntry(area, track, yr, idx, ms, openMsIdx === idx);
    } else {
      html += renderP1MilestoneForm(area, track, yr, idx, ms, openMsIdx === idx);
    }
  });
  if (isMitarbeiter) {
    html += '<div class="p1-employee-plan-add">';
    html += '<button type="button" class="btn btn-sm btn-outline p1-add-btn" onclick="event.stopPropagation();addP1EmployeeSkillEntry(\'' + escAttr(ref) + '\',' + yr + ',\'tech\')">+ Fachskill</button>';
    html += '<button type="button" class="btn btn-sm btn-outline p1-add-btn" onclick="event.stopPropagation();addP1EmployeeSkillEntry(\'' + escAttr(ref) + '\',' + yr + ',\'soft\')">+ Soft Skill</button>';
    html += "</div>";
  } else {
    html += '<button type="button" class="btn btn-sm btn-outline p1-add-btn" onclick="event.stopPropagation();addP1Entry(\'' + escAttr(ref) + '\',' + yr + ')">+ Meilenstein</button>';
  }
  html += '</div></div>';
  return html;
}

function renderP1EmployeeSkillList(item) {
  const tech = item.skills || [];
  const soft = item.softSkills || [];
  if (!tech.length && !soft.length) {
    return '<p class="bc-muted p1-employee-ist__empty">Keine Skills in Phase 1 erfasst.</p>';
  }
  let html = '<div class="p1-employee-ist">';
  html += '<div class="p1-employee-ist__head">IST-Skills aus Phase 1</div>';
  html += '<ul class="p1-employee-skill-list">';
  tech.forEach(function (s) {
    const label = (s.kategorie ? s.kategorie + " \u00b7 " : "") + (s.technologie || "\u2013");
    html += '<li class="p1-employee-skill p1-employee-skill--tech">';
    html += '<span class="p1-employee-skill__kind">Fach</span>';
    html += '<span class="p1-employee-skill__label">' + escAttr(label) + "</span>";
    if (s.level != null) html += '<span class="p1-employee-skill__level">Lvl ' + escAttr(String(s.level)) + "</span>";
    html += "</li>";
  });
  soft.forEach(function (s) {
    html += '<li class="p1-employee-skill p1-employee-skill--soft">';
    html += '<span class="p1-employee-skill__kind">Soft</span>';
    html += '<span class="p1-employee-skill__label">' + escAttr(s.kategorie || "Soft Skill") + "</span>";
    if (s.level != null) html += '<span class="p1-employee-skill__level">Lvl ' + escAttr(String(s.level)) + "</span>";
    html += "</li>";
  });
  html += "</ul></div>";
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
  });
  const label = item.label || item.subcategory;
  const blockId = p1BlockDomId(area, track);
  const ref = encodeP1TrackRef(area, track);
  const msCount = countP1TrackMilestones(area, track);
  const movePos = moveCtx || p1TrackMovePosition(area, track);

  let html = '<details class="p1-subcat" id="' + escAttr(blockId) + '">';
  html += '<summary class="p1-subcat__head">';
  html += '<span class="p1-subcat__label">' + escAttr(label) + '</span>';
  html += '<span class="p1-subcat__count">' + p1YearMilestoneCountText(msCount, area) + '</span>';
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
  if (area !== "mitarbeiter") {
    html += p1SaveBtn("saveP1Track('" + escAttr(ref) + "')", "Speichern");
  }
  if (area === "portfolio") {
    html += p1EditBtn("openP1RenameTrack('" + escAttr(ref) + "')", "Bezeichnung \u00e4ndern");
  }
  html += p1TrashBtn("delP1Track('" + escAttr(ref) + "')", "Meilenstein l\u00f6schen");
  html += '</span>';
  html += '</summary>';
  html += '<div class="p1-subcat__body">';
  if (area === "mitarbeiter") {
    html += renderP1EmployeeSkillList(item);
  }
  YEARS.forEach(function(yr, i) {
    html += renderP1YearAccordion(area, track, yr, i === 0);
  });
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
  html += '<div class="card" style="margin-bottom:.75rem"><h3 style="margin:0;color:var(--rc-accent2)">Planung NEW \u00b7 Phase-1-basiert</h3>';
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

  if (focusTarget && focusTarget.idx != null && focusTarget.idx >= 0 && focusTarget.track) {
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

  const notice = document.getElementById("bcUnitSaveNoticeNew");
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
    if (unit) await ensureP1SummaryEmployees(unit);
    await loadP1SkillCategories();
  }

  ensureP1Tracks();
  const normalized = normalizeP1TracksInMeta();
  const synced = syncP1TracksFromPhase1(["gliederungen", "rollen"]);
  const seeded = ensureP1TrackYearCoverage();
  if ((normalized || synced > 0 || seeded > 0) && typeof savePlan === "function") {
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
  return renderP1OrgAddModalBody("gliederungen");
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
  if (areaKey === "gliederungen" || areaKey === "rollen") {
    body.innerHTML = areaKey === "gliederungen" ? renderP1GliederungAddModalBody() : renderP1RolleAddModalBody();
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
  } else if (areaKey === "gliederungen" || areaKey === "rollen") {
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

window.addP1EmployeeSkillEntry = function(ref, yr, skillPlanKind) {
  if (!requireBcSaveUnit()) return;
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved || resolved.area !== "mitarbeiter") return;
  const openState = collectP1OpenState();
  const entries = getP1Entries(resolved.area, resolved.track, yr);
  entries.unshift(p1EmployeeSkillPlanTemplate(resolved.area, resolved.track, yr, skillPlanKind));
  setP1Entries(resolved.area, resolved.track, yr, entries);
  initPlanungNew({
    skipFetch: true,
    openState: openState,
    focusTarget: { area: resolved.area, track: resolved.track, yr: yr, idx: 0 },
  });
};

window.delP1Entry = function(ref, yr, idx) {
  if (!confirm("Meilenstein l\u00f6schen?")) return;
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved) return;
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
    ? "Alle " + entries.length + " Skill(s) f\u00fcr " + yr + " l\u00f6schen?"
    : "Alle " + entries.length + " Meilenstein(e) f\u00fcr " + yr + " l\u00f6schen?";
  if (!confirm(deleteLabel)) return;
  if (!requireBcSaveUnit()) return;
  const openState = collectP1OpenState();
  setP1Entries(resolved.area, resolved.track, yr, []);
  seedP1TrackMilestonesForAllYears(resolved.area, resolved.track);
  await savePlan({ allowIncomplete: true });
  initPlanungNew({
    skipFetch: true,
    openState: openState,
    focusTarget: { area: resolved.area, track: resolved.track, yr: yr },
  });
};

window.delP1Track = async function (ref) {
  if (!confirm("Meilenstein und alle Jahres-Eintr\u00e4ge l\u00f6schen?")) return;
  if (!requireBcSaveUnit()) return;
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved) return;
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
  const entries = getP1Entries(resolved.area, resolved.track, yr);
  if (!entries[idx]) return;
  entries[idx][field] = el.value;
  if (entries[idx].skillPlanKind) p1NormalizeEmployeeSkillPlanEntry(entries[idx]);
  entries[idx].updatedAt = new Date().toISOString();
  setP1Entries(resolved.area, resolved.track, yr, entries);
  if (field === "bezeichnung") {
    const mid = p1MilestoneDomId(resolved.area, resolved.track, yr, idx);
    const titleEl = document.getElementById(mid + "_title");
    if (titleEl) {
      titleEl.textContent = p1MilestoneTitle(entries[idx]);
      titleEl.classList.toggle("p1-ms__title--empty", !String(el.value || "").trim());
    }
  }
};

window.updP1Num = function(el, ref, yr, idx, field) {
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved) return;
  const entries = getP1Entries(resolved.area, resolved.track, yr);
  if (!entries[idx]) return;
  const v = el.value.trim();
  entries[idx][field] = v === "" ? null : Number(v);
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
  entries[idx].ziel_skill_level_min = v === "" ? null : Number(v);
  p1NormalizeEmployeeSkillPlanEntry(entries[idx]);
  entries[idx].updatedAt = new Date().toISOString();
  setP1Entries(resolved.area, resolved.track, yr, entries);
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

window.saveP1Track = async function(ref) {
  if (!requireBcSaveUnit()) return;
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved) return;
  p1FlushTrackFormToPlan(resolved.area, resolved.track);
  const openState = collectP1OpenState();
  const ok = await savePlan({ allowIncomplete: true });
  if (!ok) return;
  if (typeof toast === "function") toast("Gespeichert");
  initPlanungNew({
    skipFetch: true,
    openState: openState,
    focusTarget: { area: resolved.area, track: resolved.track },
  });
};

window.saveP1Milestone = async function(ref, yr, idx) {
  const resolved = p1ResolveTrackRef(ref);
  if (!resolved) return;
  const entries = getP1Entries(resolved.area, resolved.track, yr);
  const ms = entries[idx];
  if (!ms) return;
  if (ms.skillPlanKind) {
    if (!String(ms.kategorie || "").trim()) {
      alert("Bitte eine Skill-Kategorie ausw\u00e4hlen.");
      return;
    }
    if (ms.ziel_skill_level_min == null || !Number.isFinite(Number(ms.ziel_skill_level_min))) {
      alert("Bitte ein Ziel-Level (1\u20135) angeben.");
      return;
    }
    p1NormalizeEmployeeSkillPlanEntry(ms);
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
      if (m && m.kind === "p1Year") m.subcategory = name;
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
