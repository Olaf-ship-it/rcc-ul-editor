/**
 * Phase 2 · Jahresabschluss – erreichte IST-Werte pro Planjahr erfassen
 */
(function () {
  const PORTFOLIO_LABELS = {
    produkte: "Produkte",
    services: "Services",
    loesungen: "Lösungen",
    partnergeschaeft: "Partnergeschäft",
    projektgeschaeft: "Projektgeschäft",
  };

  let _ycYears = [];
  let _ycYear = null;
  let _ycPayload = { portfolio: [], organisation: null, skills: [], meta: {} };
  let _ycPlanHints = { portfolio: [], gliederungen: [], rollen: [], mitarbeiter: [] };
  let _ycStatus = null;
  let _ycStichtag = "";
  let _ycClosedAt = null;
  let _ycInitDone = false;

  function ycEsc(s) {
    return (s == null ? "" : String(s))
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function ycUnit() {
    if (typeof getBcSaveUnit === "function") return getBcSaveUnit();
    return typeof getBcViewUnit === "function" ? getBcViewUnit() : "";
  }

  function ycCanEdit() {
    if (typeof isBcViewAll === "function" && isBcViewAll()) return false;
    if (_ycStatus === "closed") {
      return typeof bcIsAdmin !== "undefined" && bcIsAdmin;
    }
    return true;
  }

  function ycStatusLabel() {
    if (_ycStatus === "closed") return { text: "Abgeschlossen", cls: "yc-status--closed" };
    if (_ycStatus === "draft") return { text: "Entwurf", cls: "yc-status--draft" };
    return { text: "Noch nicht begonnen", cls: "yc-status--open" };
  }

  async function ycApi(path, opts) {
    const resp = await fetch(path, { credentials: "include", ...(opts || {}) });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || "Anfrage fehlgeschlagen.");
    return data;
  }

  function ycEmptyOrg() {
    return {
      hatTechnologischeGliederung: "nein",
      gliederungen: [],
      rollen: [],
      stichtag: _ycStichtag || "",
      erfassungsjahr: _ycYear,
    };
  }

  function ycNormalizePayload(raw) {
    const p = raw || {};
    return {
      portfolio: Array.isArray(p.portfolio) ? p.portfolio : [],
      organisation: p.organisation && typeof p.organisation === "object" ? p.organisation : null,
      skills: Array.isArray(p.skills) ? p.skills : [],
      meta: p.meta && typeof p.meta === "object" ? p.meta : {},
    };
  }

  function ycMergePortfolioFromHints() {
    const hints = _ycPlanHints.portfolio || [];
    const existing = _ycPayload.portfolio || [];
    const byKey = {};
    existing.forEach((item) => {
      const key = item.phase1Id || item.id || item.category + "||" + (item.subcategory || item.bezeichnung);
      byKey[key] = { ...item };
    });
    hints.forEach((h) => {
      const key = h.phase1Id || h.category + "||" + (h.subcategory || h.label);
      if (!byKey[key]) {
        byKey[key] = {
          category: h.category,
          subcategory: h.subcategory || h.label,
          bezeichnung: h.label || h.subcategory,
          phase1Id: h.phase1Id,
          jahresumsatz_teur: null,
          ampel: "",
        };
      }
    });
    _ycPayload.portfolio = Object.values(byKey);
  }

  function ycMergeOrgFromHints() {
    if (!_ycPayload.organisation) _ycPayload.organisation = ycEmptyOrg();
    const org = _ycPayload.organisation;
    (_ycPlanHints.gliederungen || []).forEach((h) => {
      const id = h.orgItemId || h.phase1Id;
      let row = org.gliederungen.find((g) => g.id === id || g.bereich === h.subcategory);
      if (!row) {
        row = { id: id || "g" + Date.now() + Math.random().toString(36).slice(2, 5), bereich: h.subcategory || h.label, headcount: null, umsatz_teur: null };
        org.gliederungen.push(row);
      }
    });
    (_ycPlanHints.rollen || []).forEach((h) => {
      const id = h.orgItemId || h.phase1Id;
      let row = org.rollen.find((r) => r.id === id || r.rolle === h.subcategory);
      if (!row) {
        row = { id: id || "r" + Date.now() + Math.random().toString(36).slice(2, 5), rolle: h.subcategory || h.label, anzahl: null };
        org.rollen.push(row);
      }
    });
  }

  function ycMergeSkillsFromHints() {
    const hints = _ycPlanHints.mitarbeiter || [];
    const existing = _ycPayload.skills || [];
    const byId = {};
    existing.forEach((s) => {
      const key = s.id || s.skillEntryId;
      if (key) byId[key] = { ...s };
    });
    hints.forEach((h) => {
      const key = h.skillEntryId;
      if (!key || byId[key]) return;
      byId[key] = {
        id: key,
        skillEntryId: key,
        nachname: h.subcategory || h.label || "Mitarbeiter",
        vorname: "",
        skills: [],
        zertifiziert: "",
      };
    });
    _ycPayload.skills = Object.values(byId);
  }

  function ycHintSollPortfolio(item) {
    const hints = (_ycPlanHints.portfolio || []).filter((h) => {
      if (item.phase1Id && h.phase1Id) return h.phase1Id === item.phase1Id;
      return h.category === item.category && (h.subcategory === item.subcategory || h.label === item.bezeichnung);
    });
    let sum = 0;
    let has = false;
    hints.forEach((h) => {
      const v = parseFloat(h.ziel_umsatz_teur);
      if (Number.isFinite(v)) { sum += v; has = true; }
    });
    return has ? sum : "–";
  }

  function ycHintSollGliederung(row) {
    const hints = (_ycPlanHints.gliederungen || []).filter((h) => h.orgItemId === row.id || h.subcategory === row.bereich);
    let hc = null;
    let teur = null;
    hints.forEach((h) => {
      if (h.ziel_headcount != null) hc = Math.max(hc || 0, Number(h.ziel_headcount));
      if (h.ziel_umsatz_teur != null) teur = (teur || 0) + Number(h.ziel_umsatz_teur);
    });
    return { hc: hc != null ? hc : "–", teur: teur != null ? teur : "–" };
  }

  function ycHintSollRolle(row) {
    const hints = (_ycPlanHints.rollen || []).filter((h) => h.orgItemId === row.id || h.subcategory === row.rolle);
    let max = null;
    hints.forEach((h) => {
      if (h.ziel_anzahl != null) max = Math.max(max || 0, Number(h.ziel_anzahl));
    });
    return max != null ? max : "–";
  }

  function ycHintSollSkill(emp) {
    const key = emp.id || emp.skillEntryId;
    const hints = (_ycPlanHints.mitarbeiter || []).filter((h) => h.skillEntryId === key);
    let min = null;
    hints.forEach((h) => {
      if (h.ziel_skill_level_min != null) min = Math.max(min || 0, Number(h.ziel_skill_level_min));
    });
    return min != null ? min : "–";
  }

  function ycRenderToolbar() {
    const st = ycStatusLabel();
    const yearOpts = _ycYears
      .filter((y) => y <= new Date().getFullYear())
      .map((y) => `<option value="${y}"${y === _ycYear ? " selected" : ""}>${y}</option>`)
      .join("");
    const disabled = !ycCanEdit() ? " disabled" : "";
    return `
      <div class="card yc-toolbar" style="margin-bottom:1rem;border-left-color:var(--rc-accent2)">
        <div class="yc-toolbar-row">
          <div>
            <label>Planjahr (Abschluss)</label>
            <select id="ycYearSelect">${yearOpts}</select>
          </div>
          <div>
            <label>Stichtag *</label>
            <input type="date" id="ycStichtag" value="${ycEsc(_ycStichtag)}"${disabled}>
          </div>
          <div class="yc-status-wrap">
            <span class="yc-status ${st.cls}">${ycEsc(st.text)}</span>
            ${_ycClosedAt ? `<span class="bc-muted yc-closed-at">abgeschlossen ${ycEsc(_ycClosedAt.slice(0, 10))}</span>` : ""}
          </div>
        </div>
        <p class="bc-muted" style="margin:.5rem 0 0;font-size:.78rem">
          Erfassen Sie den <strong>tatsächlich erreichten Stand</strong> am Jahresende. Die Ausgangslage (Phase 1) bleibt unverändert.
        </p>
        <div class="btn-group" style="margin-top:.75rem">
          <button type="button" class="btn btn-outline btn-sm" id="ycBtnPrefill"${disabled}>Vorbelegung laden</button>
          <button type="button" class="btn btn-primary btn-sm" id="ycBtnSave"${disabled}>Speichern (Entwurf)</button>
          <button type="button" class="btn btn-primary btn-sm" id="ycBtnClose"${disabled}>Abschließen</button>
        </div>
      </div>`;
  }

  function ycRenderPortfolio() {
    const items = _ycPayload.portfolio || [];
    if (!items.length) {
      return `<div class="card yc-section"><h4>Portfolio</h4><p class="bc-muted">Keine Planpositionen für dieses Jahr. Planung NEW prüfen oder Vorbelegung laden.</p></div>`;
    }
    const rows = items.map((item, idx) => {
      const catLabel = PORTFOLIO_LABELS[item.category] || item.category || "Portfolio";
      const soll = ycHintSollPortfolio(item);
      const dis = !ycCanEdit() ? " disabled" : "";
      return `<tr>
        <td>${ycEsc(catLabel)} · ${ycEsc(item.bezeichnung || item.subcategory || "–")}</td>
        <td class="yc-soll">${ycEsc(String(soll))} TEUR</td>
        <td><input type="number" min="0" step="1" data-yc-portfolio="${idx}" data-field="jahresumsatz_teur" value="${item.jahresumsatz_teur != null ? ycEsc(item.jahresumsatz_teur) : ""}"${dis}></td>
        <td><select data-yc-portfolio="${idx}" data-field="ampel"${dis}>
          <option value="">–</option>
          <option value="green"${item.ampel === "green" ? " selected" : ""}>🟩</option>
          <option value="orange"${item.ampel === "orange" ? " selected" : ""}>🟧</option>
          <option value="blue"${item.ampel === "blue" ? " selected" : ""}>🟦</option>
          <option value="red"${item.ampel === "red" ? " selected" : ""}>🟥</option>
        </select></td>
      </tr>`;
    }).join("");
    return `<div class="card yc-section"><h4>Portfolio</h4>
      <div class="tbl-wrap"><table class="entries yc-split-table">
        <thead><tr><th>Position</th><th>SOLL (Plan)</th><th>IST Umsatz (TEUR)</th><th>Ampel</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div>`;
  }

  function ycRenderOrg() {
    const org = _ycPayload.organisation || ycEmptyOrg();
    const gRows = (org.gliederungen || []).map((g, idx) => {
      const soll = ycHintSollGliederung(g);
      const dis = !ycCanEdit() ? " disabled" : "";
      return `<tr>
        <td>${ycEsc(g.bereich)}</td>
        <td class="yc-soll">${ycEsc(String(soll.hc))} MA · ${ycEsc(String(soll.teur))} TEUR</td>
        <td><input type="number" min="0" step="1" data-yc-glied="${idx}" data-field="headcount" value="${g.headcount != null ? ycEsc(g.headcount) : ""}"${dis}></td>
        <td><input type="number" min="0" step="1" data-yc-glied="${idx}" data-field="umsatz_teur" value="${g.umsatz_teur != null ? ycEsc(g.umsatz_teur) : ""}"${dis}></td>
      </tr>`;
    }).join("");
    const rRows = (org.rollen || []).map((r, idx) => {
      const soll = ycHintSollRolle(r);
      const dis = !ycCanEdit() ? " disabled" : "";
      return `<tr>
        <td>${ycEsc(r.rolle)}</td>
        <td class="yc-soll">${ycEsc(String(soll))}</td>
        <td><input type="number" min="0" step="1" data-yc-rolle="${idx}" data-field="anzahl" value="${r.anzahl != null ? ycEsc(r.anzahl) : ""}"${dis}></td>
      </tr>`;
    }).join("");
    return `<div class="card yc-section"><h4>Organisation</h4>
      <h5 class="yc-subhead">Gliederungen</h5>
      <div class="tbl-wrap"><table class="entries yc-split-table">
        <thead><tr><th>Bereich</th><th>SOLL (Plan)</th><th>IST Headcount</th><th>IST Umsatz TEUR</th></tr></thead>
        <tbody>${gRows || "<tr><td colspan='4' class='bc-muted'>Keine Gliederungen</td></tr>"}</tbody>
      </table></div>
      <h5 class="yc-subhead">Rollen</h5>
      <div class="tbl-wrap"><table class="entries yc-split-table">
        <thead><tr><th>Rolle</th><th>SOLL Anzahl</th><th>IST Anzahl</th></tr></thead>
        <tbody>${rRows || "<tr><td colspan='3' class='bc-muted'>Keine Rollen</td></tr>"}</tbody>
      </table></div></div>`;
  }

  function ycRenderSkills() {
    const items = _ycPayload.skills || [];
    if (!items.length) {
      return `<div class="card yc-section"><h4>Mitarbeiter / Skills</h4><p class="bc-muted">Keine Mitarbeiter-Planung für dieses Jahr.</p></div>`;
    }
    const rows = items.map((emp, idx) => {
      const name = [emp.nachname, emp.vorname].filter(Boolean).join(", ") || emp.name || "Mitarbeiter";
      const soll = ycHintSollSkill(emp);
      const avg = (emp.skills || []).length
        ? Math.round((emp.skills.reduce((s, sk) => s + (Number(sk.level) || 0), 0) / emp.skills.length) * 10) / 10
        : "";
      const dis = !ycCanEdit() ? " disabled" : "";
      return `<tr>
        <td>${ycEsc(name)}</td>
        <td class="yc-soll">Ø Level ≥ ${ycEsc(String(soll))}</td>
        <td><input type="number" min="1" max="5" step="0.1" data-yc-skill="${idx}" data-field="avgLevel" value="${avg !== "" ? ycEsc(avg) : ""}" placeholder="Ø Level"${dis}></td>
        <td><select data-yc-skill="${idx}" data-field="zertifiziert"${dis}>
          <option value="">–</option>
          <option value="ja"${emp.zertifiziert === "ja" ? " selected" : ""}>ja</option>
          <option value="nein"${emp.zertifiziert === "nein" ? " selected" : ""}>nein</option>
        </select></td>
      </tr>`;
    }).join("");
    return `<div class="card yc-section"><h4>Mitarbeiter / Skills</h4>
      <div class="tbl-wrap"><table class="entries yc-split-table">
        <thead><tr><th>Mitarbeiter</th><th>SOLL (Plan)</th><th>IST Ø Skill-Level</th><th>Zertifiziert</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div>`;
  }

  function ycCollectFromDom() {
    document.querySelectorAll("[data-yc-portfolio]").forEach((el) => {
      const idx = Number(el.getAttribute("data-yc-portfolio"));
      const field = el.getAttribute("data-field");
      if (!Number.isFinite(idx) || !field) return;
      const item = _ycPayload.portfolio[idx];
      if (!item) return;
      if (field === "jahresumsatz_teur") {
        const v = el.value === "" ? null : Number(el.value);
        item.jahresumsatz_teur = Number.isFinite(v) ? v : null;
      } else {
        item[field] = el.value;
      }
    });
    if (!_ycPayload.organisation) _ycPayload.organisation = ycEmptyOrg();
    document.querySelectorAll("[data-yc-glied]").forEach((el) => {
      const idx = Number(el.getAttribute("data-yc-glied"));
      const field = el.getAttribute("data-field");
      const row = _ycPayload.organisation.gliederungen[idx];
      if (!row || !field) return;
      const v = el.value === "" ? null : Number(el.value);
      row[field] = Number.isFinite(v) ? v : null;
    });
    document.querySelectorAll("[data-yc-rolle]").forEach((el) => {
      const idx = Number(el.getAttribute("data-yc-rolle"));
      const row = _ycPayload.organisation.rollen[idx];
      if (!row) return;
      const v = el.value === "" ? null : Number(el.value);
      row.anzahl = Number.isFinite(v) ? v : null;
    });
    document.querySelectorAll("[data-yc-skill]").forEach((el) => {
      const idx = Number(el.getAttribute("data-yc-skill"));
      const field = el.getAttribute("data-field");
      const emp = _ycPayload.skills[idx];
      if (!emp || !field) return;
      if (field === "avgLevel") {
        const v = el.value === "" ? null : Number(el.value);
        if (Number.isFinite(v)) {
          if (!emp.skills || !emp.skills.length) emp.skills = [{ kategorie: "Gesamt", level: v }];
          else emp.skills[0].level = v;
        }
      } else {
        emp[field] = el.value;
      }
    });
    _ycStichtag = document.getElementById("ycStichtag")?.value || _ycStichtag;
    if (_ycPayload.organisation) {
      _ycPayload.organisation.stichtag = _ycStichtag;
      _ycPayload.organisation.erfassungsjahr = _ycYear;
    }
  }

  function ycRender() {
    const root = document.getElementById("ycRoot");
    if (!root) return;
    const unit = ycUnit();
    const notice = document.getElementById("ycUnitSaveNotice");
    if (notice) notice.style.display = !unit ? "" : "none";
    if (!unit) {
      root.innerHTML = "<p class='bc-muted'>Bitte eine Unit im Filter wählen.</p>";
      return;
    }
    root.innerHTML =
      ycRenderToolbar() +
      ycRenderPortfolio() +
      ycRenderOrg() +
      ycRenderSkills();
    ycBindEvents();
  }

  function ycBindEvents() {
    document.getElementById("ycYearSelect")?.addEventListener("change", async (e) => {
      _ycYear = Number(e.target.value);
      await ycLoadYear();
      ycRender();
    });
    document.getElementById("ycBtnPrefill")?.addEventListener("click", () => ycPrefill());
    document.getElementById("ycBtnSave")?.addEventListener("click", () => ycSave(false));
    document.getElementById("ycBtnClose")?.addEventListener("click", () => ycSave(true));
  }

  async function ycLoadYears() {
    try {
      const cfg = await ycApi("/api/config/planning-years");
      _ycYears = Array.isArray(cfg.years) && cfg.years.length ? cfg.years : [2026, 2027, 2028, 2029];
      if (_ycYear == null) {
        const now = new Date().getFullYear();
        const eligible = _ycYears.filter((y) => y <= now);
        _ycYear = eligible.length ? eligible[eligible.length - 1] : _ycYears[0];
      }
    } catch (_e) {
      _ycYears = [2026, 2027, 2028, 2029];
      _ycYear = _ycYear || 2026;
    }
  }

  async function ycLoadYear() {
    const unit = ycUnit();
    if (!unit || !_ycYear) return;
    try {
      const data = await ycApi(
        "/api/year-snapshots/" + _ycYear + "?unit=" + encodeURIComponent(unit)
      );
      _ycPlanHints = data.planHints || _ycPlanHints;
      if (data.snapshot) {
        _ycPayload = ycNormalizePayload(data.snapshot.payload);
        _ycStatus = data.snapshot.status;
        _ycStichtag = data.snapshot.stichtag || "";
        _ycClosedAt = data.snapshot.closedAt;
      } else {
        _ycStatus = null;
        _ycStichtag = "";
        _ycClosedAt = null;
        _ycPayload = { portfolio: [], organisation: null, skills: [], meta: {} };
      }
      ycMergePortfolioFromHints();
      ycMergeOrgFromHints();
      ycMergeSkillsFromHints();
    } catch (e) {
      if (typeof toast === "function") toast(e.message);
    }
  }

  async function ycPrefill() {
    const unit = ycUnit();
    if (!unit) return;
    try {
      const data = await ycApi(
        "/api/year-snapshots/" + _ycYear + "?unit=" + encodeURIComponent(unit) + "&prefill=1"
      );
      _ycPlanHints = data.planHints || _ycPlanHints;
      _ycPayload = ycNormalizePayload(data.prefill);
      ycMergePortfolioFromHints();
      ycMergeOrgFromHints();
      ycMergeSkillsFromHints();
      if (typeof toast === "function") toast("Vorbelegung geladen (" + (data.prefilledFrom || "") + ")");
      ycRender();
    } catch (e) {
      if (typeof toast === "function") toast(e.message);
    }
  }

  async function ycSave(closeAfter) {
    const unit = ycUnit();
    if (!unit) return;
    ycCollectFromDom();
    if (!_ycStichtag) {
      if (typeof toast === "function") toast("Bitte Stichtag setzen.");
      return;
    }
    try {
      await ycApi("/api/year-snapshots/" + _ycYear + "?unit=" + encodeURIComponent(unit), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit, payload: _ycPayload, stichtag: _ycStichtag }),
      });
      if (closeAfter) {
        if (!window.confirm("Jahresabschluss " + _ycYear + " abschließen? Die Baseline (Phase 1) wird fixiert.")) return;
        await ycApi("/api/year-snapshots/" + _ycYear + "/close?unit=" + encodeURIComponent(unit), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unit, payload: _ycPayload, stichtag: _ycStichtag }),
        });
        if (typeof toast === "function") toast("Jahresabschluss " + _ycYear + " abgeschlossen.");
      } else {
        if (typeof toast === "function") toast("Entwurf gespeichert.");
      }
      await ycLoadYear();
      ycRender();
    } catch (e) {
      if (typeof toast === "function") toast(e.message);
    }
  }

  async function initYearClose() {
    const unit = ycUnit();
    const notice = document.getElementById("ycUnitSaveNotice");
    if (notice) notice.style.display = !unit ? "" : "none";
    await ycLoadYears();
    await ycLoadYear();
    ycRender();
    _ycInitDone = true;
  }

  window.initYearClose = initYearClose;
})();
