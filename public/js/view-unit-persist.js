/**
 * Gemeinsamer Unit-Filter über Phase 1, Phase 2 (Backcasting) und Phase 3.
 */
(function (global) {
  const STORAGE_KEY = "rc_view_unit";

  function readViewUnitFromUrl() {
    try {
      const raw = new URLSearchParams(window.location.search).get("unit");
      if (raw == null || raw === "") return "";
      return raw === "all" ? "all" : String(raw).trim();
    } catch (_e) {
      return "";
    }
  }

  function readPersistedViewUnit() {
    const fromUrl = readViewUnitFromUrl();
    if (fromUrl) {
      try {
        sessionStorage.setItem(STORAGE_KEY, fromUrl);
      } catch (_e) {
        /* ignore */
      }
      return fromUrl;
    }
    try {
      return sessionStorage.getItem(STORAGE_KEY) || "";
    } catch (_e) {
      return "";
    }
  }

  function writePersistedViewUnit(unit) {
    const value = unit == null || unit === "" ? "all" : String(unit).trim();
    try {
      sessionStorage.setItem(STORAGE_KEY, value);
    } catch (_e) {
      /* ignore */
    }
  }

  function clearPersistedViewUnit() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (_e) {
      /* ignore */
    }
  }

  function resolveViewUnitForSession(persisted, context) {
    const {
      isSuperAdmin = false,
      isAdmin = false,
      userUnits = [],
      currentUnit = "",
    } = context || {};

    const fallback = () => {
      if (isSuperAdmin || isAdmin) return "all";
      if (userUnits.length === 1) return userUnits[0];
      if (userUnits.length > 1) return currentUnit || userUnits[0] || "";
      return currentUnit || "";
    };

    const raw = String(persisted || "").trim();
    if (!raw) return fallback();

    if (raw === "all") {
      if (isSuperAdmin || isAdmin) return "all";
      return fallback();
    }

    if (!isSuperAdmin && !isAdmin) {
      const allowed = new Set(userUnits.map((u) => String(u).trim()));
      if (!allowed.has(raw)) return fallback();
    }

    return raw;
  }

  function appendViewUnitToUrl(path, unit) {
    const value = String(unit ?? "").trim();
    if (!value) return path;
    const url = new URL(path, window.location.origin);
    url.searchParams.set("unit", value);
    return url.pathname + url.search;
  }

  global.rcViewUnitPersist = {
    readPersistedViewUnit,
    writePersistedViewUnit,
    clearPersistedViewUnit,
    resolveViewUnitForSession,
    appendViewUnitToUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);
