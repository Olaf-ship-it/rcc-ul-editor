/**
 * GF-Leitplanken (global, localStorage rc_bc_guidelines) – gemeinsam für Backcasting & Admin.
 */
(function () {
  const LS_GUIDE = "rc_bc_guidelines";
  const EMBEDDED = (window.BC_EMBEDDED || []).slice();

  var guidelines = [];
  var guideStorageAvailable = true;
  var memoryStoreGuide = null;

  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );
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

  function workstreams() {
    return [...new Set(guidelines.map((g) => g.workstream))];
  }

  function loadGuideState() {
    try {
      const sg = localStorage.getItem(LS_GUIDE);
      guidelines = sg ? JSON.parse(sg) : EMBEDDED.slice();
    } catch (_err) {
      guideStorageAvailable = false;
      guidelines = memoryStoreGuide
        ? JSON.parse(JSON.stringify(memoryStoreGuide))
        : EMBEDDED.slice();
    }
  }

  function saveGuide() {
    if (guideStorageAvailable) {
      try {
        localStorage.setItem(LS_GUIDE, JSON.stringify(guidelines));
        updateGuideStatusLabels();
        return;
      } catch (_err) {
        guideStorageAvailable = false;
      }
    }
    memoryStoreGuide = JSON.parse(JSON.stringify(guidelines));
    updateGuideStatusLabels();
  }

  function updateGuideStatusLabels() {
    const msg = "✓ " + guidelines.length + " Leitplanken aktiv";
    const cs = document.getElementById("csvStatus");
    if (cs) cs.textContent = msg;
    const pcs = document.getElementById("planCsvStatus");
    if (pcs) pcs.textContent = msg;
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
          const o = {};
          rows[i].forEach((v, j) => {
            if (head[j]) o[head[j]] = v.trim();
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
        saveGuide();
        initGuidelineSelectors();
        const msg = "✓ " + out.length + " Leitplanken geladen aus " + f.name;
        const cs = document.getElementById("csvStatus");
        if (cs) cs.textContent = msg;
        const pcs = document.getElementById("planCsvStatus");
        if (pcs) pcs.textContent = msg;
        bcToast(out.length + " Leitplanken geladen");
      } catch (err) {
        bcToast("CSV-Fehler: " + err.message);
      }
    };
    r.readAsText(f, "utf-8");
  }

  function resetEmbedded() {
    guidelines = EMBEDDED.slice();
    saveGuide();
    initGuidelineSelectors();
    const msg = "✓ Eingebettete Leitplanken aktiv (" + guidelines.length + ")";
    const cs = document.getElementById("csvStatus");
    if (cs) cs.textContent = msg;
    const pcs = document.getElementById("planCsvStatus");
    if (pcs) pcs.textContent = msg;
    bcToast("Eingebettete Leitplanken aktiv");
  }

  function initGuidelineSelectors() {
    const wss = workstreams();
    const gpWs = document.getElementById("gpWs");
    if (gpWs) {
      gpWs.innerHTML =
        '<option value="">Alle</option>' + wss.map((w) => "<option>" + esc(w) + "</option>").join("");
    }
    const emb = document.getElementById("embCount");
    if (emb) emb.textContent = EMBEDDED.length;
    if (document.getElementById("gpTable")) renderGuidelineEditor();
    updateGuideStatusLabels();
  }

  function guidelineEmpty() {
    return {
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
    };
  }

  function addGuidelineRow() {
    guidelines.unshift(guidelineEmpty());
    renderGuidelineEditor();
  }

  function dupGuidelineRow(i) {
    const g = guidelines[i] || guidelineEmpty();
    guidelines.splice(i + 1, 0, JSON.parse(JSON.stringify(g)));
    renderGuidelineEditor();
  }

  function delGuidelineRow(i) {
    if (!confirm("Leitplanke löschen?")) return;
    guidelines.splice(i, 1);
    renderGuidelineEditor();
  }

  function setGuideline(i, key, val) {
    const g = guidelines[i];
    if (!g) return;
    g[key] = val;
  }

  function gpInput(i, key, val) {
    setGuideline(i, key, val);
    if (document.getElementById("lpTable") && typeof renderLeitplanken === "function") {
      renderLeitplanken();
    }
    const wsSel = document.getElementById("planWsTop")?.value || "";
    if (wsSel && typeof updateWsHeader === "function") updateWsHeader(wsSel);
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
      ["zielquartal", "text"],
      ["verantwortlich", "text"],
      ["abhaengigkeiten", "text"],
      ["begruendung", "text"],
      ["auswirkungen", "text"],
    ];

    guidelines.forEach((g, idx) => {
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
        ]
          .map((x) => String(x ?? "").toLowerCase())
          .join(" | ");
        if (!hay.includes(q)) return;
      }

      const tr = document.createElement("tr");
      let h = "";
      cols.forEach(([k, t]) => {
        const v = g[k] ?? "";
        if (t === "prio") {
          h +=
            "<td><select onchange=\"gpInput(" +
            idx +
            ",'" +
            k +
            "',this.value)\">" +
            '<option value=""></option><option' +
            (v === "H" ? " selected" : "") +
            ">H</option><option" +
            (v === "M" ? " selected" : "") +
            ">M</option><option" +
            (v === "N" ? " selected" : "") +
            ">N</option></select></td>";
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
              "<td><textarea oninput=\"gpInput(" +
              idx +
              ",'" +
              k +
              '\',this.value)" style="min-height:46px">' +
              esc(v) +
              "</textarea></td>";
          } else {
            h +=
              '<td><input value="' +
              esc(v) +
              "\" oninput=\"gpInput(" +
              idx +
              ",'" +
              k +
              '\',this.value)"></td>';
          }
        }
      });
      h +=
        '<td class="no-print" style="white-space:nowrap">' +
        '<button type="button" class="btn btn-sm btn-outline" onclick="dupGuidelineRow(' +
        idx +
        ')">Dupl.</button> ' +
        '<button type="button" class="btn btn-sm btn-danger btn-outline" onclick="delGuidelineRow(' +
        idx +
        ')">Löschen</button>' +
        "</td>";
      tr.innerHTML = h;
      tb.appendChild(tr);
    });
  }

  function saveGuidelinesAndRefresh() {
    saveGuide();
    initGuidelineSelectors();
    if (typeof initSelectors === "function") initSelectors();
    bcToast("Leitplanken gespeichert");
  }

  function initAdminLeitplanken() {
    loadGuideState();
    initGuidelineSelectors();
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
  window.resetEmbedded = resetEmbedded;
  window.initGuidelineSelectors = initGuidelineSelectors;
  window.addGuidelineRow = addGuidelineRow;
  window.dupGuidelineRow = dupGuidelineRow;
  window.delGuidelineRow = delGuidelineRow;
  window.gpInput = gpInput;
  window.renderGuidelineEditor = renderGuidelineEditor;
  window.saveGuidelinesAndRefresh = saveGuidelinesAndRefresh;
  window.initAdminLeitplanken = initAdminLeitplanken;
})();
