/**
 * GF-Leitplanken (global, PostgreSQL via /api/guidelines) – gemeinsam für Backcasting & Admin.
 */
(function () {
  const LS_GUIDE = "rc_bc_guidelines";
  const LS_MIGRATED = "rc_bc_guidelines_migrated";
  const EMBEDDED = [];

  var guidelines = [];
  var guidelinesVersion = 1;
  var guidelinesDirty = false;
  var guidelinesUpdatedAt = null;
  var guidelinesUpdatedBy = null;

  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );
  }

  function escJs(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  function bcToast(m) {
    if (typeof toast === "function") toast(m);
    else {
      const t = document.getElementById("toast");
      if (t) {
        t.textContent = m;
        t.classList.add("show");
        setTimeout(() => t.classList.remove("show"), 1900);
      }
    }
  }

  function newGuidelineId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "g-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  }

  function normalizeGuidelineIds(list) {
    return (list || []).map((g) => ({
      ...g,
      id: g?.id && String(g.id).trim() ? String(g.id).trim() : newGuidelineId(),
      jahre: g?.jahre && typeof g.jahre === "object" ? g.jahre : {},
    }));
  }

  function applyGuidelinesPayload(data) {
    guidelines = normalizeGuidelineIds(Array.isArray(data?.guidelines) ? data.guidelines : []);
    guidelinesVersion = Number.isInteger(data?.version) ? data.version : 1;
    guidelinesUpdatedAt = data?.updatedAt || null;
    guidelinesUpdatedBy = data?.updatedBy || null;
    guidelinesDirty = false;
    updateGuideStatusLabels();
  }

  function isGuidelinesSuperAdmin() {
    if (typeof window.isSuperAdmin !== "undefined" && window.isSuperAdmin) return true;
    return document.body.dataset.rcIsSuperAdmin === "1";
  }

  function workstreams() {
    return [...new Set(guidelines.map((g) => g.workstream))];
  }

  async function loadGuideState() {
    try {
      const res = await fetch("/api/guidelines", { credentials: "include" });
      if (!res.ok) {
        throw new Error(res.status === 403 ? "Kein Zugriff" : "Laden fehlgeschlagen (" + res.status + ")");
      }
      const data = await res.json();
      applyGuidelinesPayload(data);
      return data;
    } catch (err) {
      console.warn("loadGuideState:", err);
      guidelines = normalizeGuidelineIds(EMBEDDED.slice());
      guidelinesVersion = 1;
      guidelinesDirty = false;
      updateGuideStatusLabels();
      return null;
    }
  }

  function markGuidelinesDirty() {
    guidelinesDirty = true;
    updateGuideStatusLabels();
  }

  function updateGuideStatusLabels() {
    let msg = "✓ " + guidelines.length + " Leitplanken aktiv";
    if (guidelinesDirty) msg += " (ungespeichert)";
    if (guidelinesUpdatedBy && !guidelinesDirty) {
      msg += " · v" + guidelinesVersion;
    }
    const cs = document.getElementById("csvStatus");
    if (cs) cs.textContent = msg;
    const pcs = document.getElementById("planCsvStatus");
    if (pcs) pcs.textContent = msg;
  }

  async function saveGuidelinesToServer(options) {
    const res = await fetch("/api/admin/guidelines", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: guidelinesVersion,
        guidelines: normalizeGuidelineIds(guidelines),
        force: Boolean(options && options.force),
      }),
    });
    if (res.status === 409) {
      const body = await res.json();
      return { conflict: true, body };
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Speichern fehlgeschlagen");
    }
    const data = await res.json();
    applyGuidelinesPayload(data);
    return { ok: true, data };
  }

  async function handleGuidelinesConflict(serverBody) {
    const who = serverBody.updatedBy || "einem anderen Nutzer";
    const msg =
      "Leitplanken wurden zwischenzeitlich von " +
      who +
      " geändert.\n\nServerstand laden? (Ihre lokalen Änderungen gehen verloren)";
    if (isGuidelinesSuperAdmin()) {
      const choice = confirm(
        "Leitplanken wurden zwischenzeitlich von " +
          who +
          " geändert.\n\nOK = Ihre Version erzwingen (Super-Admin)\nAbbrechen = Serverstand laden"
      );
      if (choice) {
        try {
          const result = await saveGuidelinesToServer({ force: true });
          if (result.conflict) {
            applyGuidelinesPayload(result.body);
            bcToast("Konflikt – Serverstand geladen");
          } else {
            bcToast("Leitplanken erzwungen gespeichert");
          }
          renderGuidelineEditor();
          initGuidelineSelectors();
          if (typeof initSelectors === "function") initSelectors();
          return;
        } catch (err) {
          bcToast(err.message || "Erzwingen fehlgeschlagen");
          return;
        }
      }
    }
    if (confirm(msg)) {
      applyGuidelinesPayload(serverBody);
      renderGuidelineEditor();
      initGuidelineSelectors();
      if (typeof initSelectors === "function") initSelectors();
      bcToast("Serverstand geladen");
    }
  }

  function parseCSV(text) {
    const firstLine = text.split(/\r?\n/)[0];
    const delim = firstLine.split(";").length >= firstLine.split(",").length ? ";" : ",";
    const rows = [];
    let cur = [],
      val = "",
      q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            val += '"';
            i++;
          } else q = false;
        } else val += c;
      } else {
        if (c === '"') q = true;
        else if (c === delim) {
          cur.push(val);
          val = "";
        } else if (c === "\n") {
          cur.push(val);
          rows.push(cur);
          cur = [];
          val = "";
        } else if (c !== "\r") val += c;
      }
    }
    if (val.length || cur.length) {
      cur.push(val);
      rows.push(cur);
    }
    return rows.filter((r) => r.some((x) => x && x.trim()));
  }

  function mapHeader(h) {
    const c = h.toLowerCase().trim();
    // Pro-Jahr-Spalten: "Ziel 2026" / "Quartal 2026" -> {year, sub}
    const zy = c.match(/^ziel\s+(\d{4})$/);
    if (zy) return { year: zy[1], sub: "ziel" };
    const qy = c.match(/^quartal\s+(\d{4})$/);
    if (qy) return { year: qy[1], sub: "quartal" };
    if (c.startsWith("workstream")) return "workstream";
    if (c.startsWith("vorgabe")) return "kategorie";
    if (c.startsWith("zieljahr")) return "zieljahr";
    if (c.startsWith("zielquartal")) return "zielquartal";
    if (c.startsWith("leitfrage")) return "leitfrage";
    if (c.startsWith("konkrete")) return "festlegung";
    if (c.startsWith("zielwert")) return "zielwert";
    if (c.startsWith("priorit")) return "prioritaet";
    if (c.startsWith("begr")) return "begruendung";
    if (c.startsWith("verantwort")) return "verantwortlich";
    if (c.startsWith("abh")) return "abhaengigkeiten";
    if (c.startsWith("auswirk")) return "auswirkungen";
    return null;
  }

  function loadCsv() {
    const f = document.getElementById("csvFile")?.files?.[0];
    if (!f) {
      bcToast("Bitte CSV wählen");
      return;
    }
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const rows = parseCSV(e.target.result);
        if (!rows.length) {
          bcToast("CSV ist leer oder konnte nicht gelesen werden");
          return;
        }
        const head = rows[0].map(mapHeader);
        const out = [];
        for (let i = 1; i < rows.length; i++) {
          const o = { id: newGuidelineId(), jahre: {} };
          rows[i].forEach((v, j) => {
            const hkey = head[j];
            if (!hkey) return;
            const val = v.trim();
            if (typeof hkey === "object" && hkey.year) {
              // Leere Zelle: keinen Phantom-Eintrag (mit fabriziertem Q1) anlegen.
              if (!val) return;
              if (!o.jahre[hkey.year]) o.jahre[hkey.year] = { ziel: "", quartal: "" };
              o.jahre[hkey.year][hkey.sub] = val;
            } else {
              o[hkey] = val;
            }
          });
          if (o.workstream && o.kategorie) {
            let p = (o.prioritaet || "").toUpperCase().trim();
            o.prioritaet = p && "HMN".includes(p[0]) ? p[0] : "";
            out.push(o);
          }
        }
        if (!out.length) {
          bcToast("Keine gültigen Zeilen erkannt");
          return;
        }
        guidelines = out;
        markGuidelinesDirty();
        initGuidelineSelectors();
        const msg = "✓ " + out.length + " Leitplanken geladen aus " + f.name + " (ungespeichert)";
        const cs = document.getElementById("csvStatus");
        if (cs) cs.textContent = msg;
        const pcs = document.getElementById("planCsvStatus");
        if (pcs) pcs.textContent = msg;
        bcToast(out.length + " Leitplanken geladen – bitte Speichern klicken");
      } catch (err) {
        bcToast("CSV-Fehler: " + err.message);
      }
    };
    r.readAsText(f, "utf-8");
  }

  function initGuidelineSelectors() {
    const wss = workstreams();
    const gpWs = document.getElementById("gpWs");
    if (gpWs) {
      gpWs.innerHTML =
        '<option value="">Alle</option>' + wss.map((w) => "<option>" + esc(w) + "</option>").join("");
    }
    if (document.getElementById("gpTable")) renderGuidelineEditor();
    updateGuideStatusLabels();
  }

  // Planjahre für die Pro-Jahr-Spalten: window._rcPlanningYears (Haupt-App) ->
  // globaler YEARS (Backcasting-App) -> Fallback. Immer ein Array aus Zahlen.
  function gpPlanningYears() {
    var src = null;
    if (Array.isArray(window._rcPlanningYears) && window._rcPlanningYears.length) {
      src = window._rcPlanningYears;
    } else if (typeof YEARS !== "undefined" && Array.isArray(YEARS) && YEARS.length) {
      src = YEARS;
    }
    if (!src) src = [2026, 2027, 2028, 2029];
    return src.map(function (y) { return Number(y); }).filter(function (y) { return !isNaN(y); });
  }

  function guidelineEmpty() {
    return {
      id: newGuidelineId(),
      workstream: "",
      kategorie: "",
      prioritaet: "",
      leitfrage: "",
      festlegung: "",
      zielwert: "",
      zieljahr: "",
      zielquartal: "",
      verantwortlich: "",
      abhaengigkeiten: "",
      begruendung: "",
      auswirkungen: "",
      jahre: {},
    };
  }

  function findGuidelineIndex(id) {
    return guidelines.findIndex((g) => g.id === id);
  }

  function addGuidelineRow() {
    guidelines.unshift(guidelineEmpty());
    markGuidelinesDirty();
    renderGuidelineEditor();
  }

  function dupGuidelineRow(id) {
    const i = findGuidelineIndex(id);
    if (i < 0) return;
    const copy = JSON.parse(JSON.stringify(guidelines[i]));
    copy.id = newGuidelineId();
    guidelines.splice(i + 1, 0, copy);
    markGuidelinesDirty();
    renderGuidelineEditor();
  }

  function delGuidelineRow(id) {
    const i = findGuidelineIndex(id);
    if (i < 0) return;
    if (!confirm("Leitplanke löschen?")) return;
    guidelines.splice(i, 1);
    markGuidelinesDirty();
    renderGuidelineEditor();
  }

  function gpInput(id, key, val) {
    const i = findGuidelineIndex(id);
    if (i < 0) return;
    guidelines[i][key] = val;
    markGuidelinesDirty();
    if (document.getElementById("lpTable") && typeof renderLeitplanken === "function") {
      renderLeitplanken();
    }
  }

  // Pro-Jahr-Zelle (Ziel-Text oder Quartal) einer Leitplanke setzen.
  function gpYearInput(id, year, field, val) {
    const i = findGuidelineIndex(id);
    if (i < 0) return;
    const y = String(year);
    if (!guidelines[i].jahre || typeof guidelines[i].jahre !== "object") guidelines[i].jahre = {};
    if (!guidelines[i].jahre[y]) guidelines[i].jahre[y] = { ziel: "", quartal: "Q1" };
    guidelines[i].jahre[y][field] = val;
    markGuidelinesDirty();
    if (document.getElementById("lpTable") && typeof renderLeitplanken === "function") {
      renderLeitplanken();
    }
  }

  function renderGuidelineEditor() {
    const wsF = document.getElementById("gpWs")?.value || "";
    const qRaw = document.getElementById("gpSearch")?.value || "";
    const q = qRaw.toLowerCase();
    const tb = document.querySelector("#gpTable tbody");
    if (!tb) return;
    tb.innerHTML = "";

    const cols = [
      ["workstream", "text"],
      ["kategorie", "text"],
      ["prioritaet", "prio"],
      ["leitfrage", "text"],
      ["festlegung", "text"],
      ["zielwert", "text"],
      ["zieljahr", "text"],
      ["zielquartal", "quartal"],
      ["verantwortlich", "text"],
      ["abhaengigkeiten", "text"],
      ["begruendung", "text"],
      ["auswirkungen", "text"],
    ];

    const years = gpPlanningYears();

    // Jahres-Spalten dynamisch in die (statische) Kopfzeile einfügen – vor "Aktion".
    const headRow = document.querySelector("#gpTable thead tr");
    if (headRow) {
      headRow.querySelectorAll("th.gp-year-col").forEach((th) => th.remove());
      const aktionTh = headRow.querySelector("th:last-child");
      years.forEach((y) => {
        const th = document.createElement("th");
        th.className = "gp-year-col";
        th.textContent = String(y);
        if (aktionTh) headRow.insertBefore(th, aktionTh);
        else headRow.appendChild(th);
      });
    }

    guidelines.forEach((g) => {
      if (wsF && (g.workstream || "") !== wsF) return;
      if (q) {
        const hay = [
          g.workstream,
          g.kategorie,
          g.prioritaet,
          g.leitfrage,
          g.festlegung,
          g.zielwert,
          g.zieljahr,
          g.zielquartal,
          g.verantwortlich,
          g.abhaengigkeiten,
          g.begruendung,
          g.auswirkungen,
          Object.values(g.jahre || {})
            .map((cell) => (cell && cell.ziel) || "")
            .join(" "),
        ]
          .map((x) => String(x ?? "").toLowerCase())
          .join(" | ");
        if (!hay.includes(q)) return;
      }

      const gid = escJs(g.id);
      const tr = document.createElement("tr");
      let h = "";
      cols.forEach(([k, t]) => {
        const v = g[k] ?? "";
        if (t === "prio") {
          h +=
            "<td><select onchange=\"gpInput('" +
            gid +
            "','" +
            k +
            "',this.value)\">" +
            '<option value=""></option><option' +
            (v === "H" ? " selected" : "") +
            ">H</option><option" +
            (v === "M" ? " selected" : "") +
            ">M</option><option" +
            (v === "N" ? " selected" : "") +
            ">N</option></select></td>";
        } else if (t === "quartal") {
          const qVal = v || "";
          h +=
            "<td><select onchange=\"gpInput('" +
            gid +
            "','" +
            k +
            "',this.value)\">" +
            '<option value=""' + (qVal === "" ? " selected" : "") + "></option>" +
            ["Q1", "Q2", "Q3", "Q4"]
              .map(function (q) {
                return "<option" + (qVal === q ? " selected" : "") + ">" + q + "</option>";
              })
              .join("") +
            "</select></td>";
        } else {
          const isLong = [
            "leitfrage",
            "festlegung",
            "zielwert",
            "abhaengigkeiten",
            "begruendung",
            "auswirkungen",
          ].includes(k);
          if (isLong) {
            h +=
              "<td><textarea oninput=\"gpInput('" +
              gid +
              "','" +
              k +
              '\',this.value)" style="min-height:46px">' +
              esc(v) +
              "</textarea></td>";
          } else {
            h +=
              '<td><input value="' +
              esc(v) +
              "\" oninput=\"gpInput('" +
              gid +
              "','" +
              k +
              '\',this.value)"></td>';
          }
        }
      });
      // Pro-Jahr-Zellen: Ziel-Text + Quartal (Q1–Q4)
      const jahre = g.jahre || {};
      years.forEach((y) => {
        const cell = jahre[y] || jahre[String(y)] || {};
        const zielVal = cell.ziel || "";
        const qVal = cell.quartal || "Q1";
        h +=
          '<td class="gp-year-cell">' +
          "<textarea class=\"gp-year-ziel\" oninput=\"gpYearInput('" +
          gid +
          "'," +
          y +
          ",'ziel',this.value)\" placeholder=\"Ziel " +
          y +
          '">' +
          esc(zielVal) +
          "</textarea>" +
          "<select class=\"gp-year-q\" onchange=\"gpYearInput('" +
          gid +
          "'," +
          y +
          ",'quartal',this.value)\">" +
          ["Q1", "Q2", "Q3", "Q4"]
            .map(function (qq) {
              return "<option" + (qVal === qq ? " selected" : "") + ">" + qq + "</option>";
            })
            .join("") +
          "</select></td>";
      });
      h +=
        '<td class="no-print" style="white-space:nowrap">' +
        '<button type="button" class="btn btn-sm btn-outline" onclick="dupGuidelineRow(\'' +
        gid +
        "')\">Dupl.</button> " +
        '<button type="button" class="btn btn-sm btn-danger btn-outline" onclick="delGuidelineRow(\'' +
        gid +
        "')\">Löschen</button>" +
        "</td>";
      tr.innerHTML = h;
      tb.appendChild(tr);
    });
  }

  async function saveGuidelinesAndRefresh() {
    try {
      const result = await saveGuidelinesToServer();
      if (result.conflict) {
        await handleGuidelinesConflict(result.body);
        return;
      }
      initGuidelineSelectors();
      if (typeof initSelectors === "function") initSelectors();
      bcToast("Leitplanken gespeichert");
    } catch (err) {
      bcToast(err.message || "Speichern fehlgeschlagen");
    }
  }

  function maybeMigrateLocalGuidelines() {
    try {
      if (localStorage.getItem(LS_MIGRATED)) return;
      const localRaw = localStorage.getItem(LS_GUIDE);
      if (!localRaw) return;
      const local = JSON.parse(localRaw);
      if (!Array.isArray(local) || !local.length) return;
      guidelines = normalizeGuidelineIds(local);
      markGuidelinesDirty();
      localStorage.setItem(LS_MIGRATED, "1");
      localStorage.removeItem(LS_GUIDE);
      bcToast("Leitplanken aus lokalem Browser-Speicher übernommen – bitte „Speichern“ klicken.");
    } catch (_err) {
      /* ignore */
    }
  }

  async function initAdminLeitplanken() {
    await loadGuideState();
    maybeMigrateLocalGuidelines();
    initGuidelineSelectors();
  }

  function dlFile(name, content, type) {
    const b = new Blob([content], { type });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = name;
    a.click();
    URL.revokeObjectURL(u);
  }

  function exportAdminGuidelinesCsv() {
    const cols = [
      "workstream", "kategorie", "prioritaet", "leitfrage", "festlegung",
      "zielwert", "zieljahr", "zielquartal", "verantwortlich",
      "abhaengigkeiten", "begruendung", "auswirkungen",
    ];
    const years = gpPlanningYears();
    const header = cols.slice();
    years.forEach(function (y) {
      header.push("Ziel " + y);
      header.push("Quartal " + y);
    });
    const csvCell = function (v) {
      return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    };
    const rows = [header.map(csvCell).join(";")];
    (guidelines || []).forEach(function (g) {
      const line = cols.map(function (c) {
        return csvCell(g && g[c] != null ? g[c] : "");
      });
      const jahre = (g && g.jahre) || {};
      years.forEach(function (y) {
        const cell = jahre[y] || jahre[String(y)] || {};
        line.push(csvCell(cell.ziel || ""));
        line.push(csvCell(cell.quartal || ""));
      });
      rows.push(line.join(";"));
    });
    dlFile("leitplanken.csv", "\ufeff" + rows.join("\n"), "text/csv");
    bcToast("Leitplanken-CSV exportiert");
  }

  function exportAdminGuidelinesJson() {
    dlFile(
      "leitplanken.json",
      JSON.stringify(guidelines || [], null, 2),
      "application/json"
    );
    bcToast("Leitplanken-JSON exportiert");
  }

  /** @deprecated Nur für Abwärtskompatibilität – persistiert nicht mehr lokal */
  function saveGuide() {
    updateGuideStatusLabels();
  }

  Object.defineProperty(window, "guidelines", {
    get() {
      return guidelines;
    },
    set(v) {
      guidelines = v;
    },
  });

  window.loadGuideState = loadGuideState;
  window.saveGuide = saveGuide;
  window.workstreams = workstreams;
  window.loadCsv = loadCsv;
  window.initGuidelineSelectors = initGuidelineSelectors;
  window.addGuidelineRow = addGuidelineRow;
  window.dupGuidelineRow = dupGuidelineRow;
  window.delGuidelineRow = delGuidelineRow;
  window.gpInput = gpInput;
  window.gpYearInput = gpYearInput;
  window.renderGuidelineEditor = renderGuidelineEditor;
  window.saveGuidelinesAndRefresh = saveGuidelinesAndRefresh;
  window.initAdminLeitplanken = initAdminLeitplanken;
  window.exportAdminGuidelinesCsv = exportAdminGuidelinesCsv;
  window.exportAdminGuidelinesJson = exportAdminGuidelinesJson;
})();
