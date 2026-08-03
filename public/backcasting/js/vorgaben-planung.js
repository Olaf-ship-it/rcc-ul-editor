/**
 * Register "Vorgaben & Planung" (Workstream-Fahrplan) – PROTOTYP.
 *
 * Stellt je Workstream die GF-Vorgabe direkt neben die Planung:
 *   - Endziel (Leitplanke mit zieljahr = letztes Planjahr) als "North Star"-Banner
 *   - Jahres-Timeline 2026→2029: pro Jahr das Zwischenziel (GF) + Erfassungsfeld
 *
 * Kein neues Schema: liest window.guidelines (Leitplanken) und schreibt in das
 * bestehende plan.measures-Modell mit Schlüssel  WS||<workstream>||<jahr>  (kind:"wsYear").
 *
 * Dieses Register ist bewusst isoliert (1 Datei + 1 Tab + 1 Page-Div + 1 CSS-Block),
 * damit es sich rückstandslos wieder entfernen lässt, falls der Vorschlag nicht gefällt.
 */
(function () {
  // Beispiel-Vorgaben – nur als Fallback, wenn noch keine echten Leitplanken gepflegt sind,
  // damit das Layout auch ohne Datenbestand anschaulich ist.
  var VP_SAMPLE = [
    { workstream: "Skills & Mindset", kategorie: "Zertifizierungsquote", prioritaet: "H", leitfrage: "Wie erreicht ihr die geforderte Zertifizierungsquote im Team?", festlegung: "Verbindlicher SAP-Zertifizierungspfad für alle Consultants.", zielwert: "80 % zertifiziert", zieljahr: "2029", zielquartal: "Q4", verantwortlich: "Unit Lead" },
    { workstream: "Skills & Mindset", kategorie: "Zertifizierungsquote", prioritaet: "H", leitfrage: "", festlegung: "Erste Zertifizierungswelle abgeschlossen.", zielwert: "30 % zertifiziert", zieljahr: "2026", zielquartal: "Q4", verantwortlich: "Unit Lead" },
    { workstream: "Skills & Mindset", kategorie: "Zertifizierungsquote", prioritaet: "M", leitfrage: "", festlegung: "Aufbaupfad läuft, zweite Welle.", zielwert: "50 % zertifiziert", zieljahr: "2027", zielquartal: "Q4", verantwortlich: "Unit Lead" },
    { workstream: "Skills & Mindset", kategorie: "Zertifizierungsquote", prioritaet: "M", leitfrage: "", festlegung: "Breitenqualifizierung.", zielwert: "65 % zertifiziert", zieljahr: "2028", zielquartal: "Q4", verantwortlich: "Unit Lead" },
    { workstream: "Portfolio & Markt", kategorie: "Cloud-Umsatzanteil", prioritaet: "H", leitfrage: "Wie verschiebt ihr das Portfolio Richtung Cloud / S/4HANA?", festlegung: "Mindestanteil Cloud-/S4-Umsatz am Gesamtumsatz.", zielwert: "75 % Cloud-Anteil", zieljahr: "2029", zielquartal: "Q4", verantwortlich: "Bereichsleiter" },
    { workstream: "Portfolio & Markt", kategorie: "Cloud-Umsatzanteil", prioritaet: "M", leitfrage: "", festlegung: "Erste Cloud-Angebote im Markt.", zielwert: "30 % Cloud-Anteil", zieljahr: "2026", zielquartal: "Q2", verantwortlich: "Bereichsleiter" },
    { workstream: "Portfolio & Markt", kategorie: "Cloud-Umsatzanteil", prioritaet: "M", leitfrage: "", festlegung: "Skalierung Cloud-Portfolio.", zielwert: "45 % Cloud-Anteil", zieljahr: "2027", zielquartal: "Q4", verantwortlich: "Bereichsleiter" },
    { workstream: "Portfolio & Markt", kategorie: "Cloud-Umsatzanteil", prioritaet: "M", leitfrage: "", festlegung: "Cloud als Standard-Liefermodell.", zielwert: "60 % Cloud-Anteil", zieljahr: "2028", zielquartal: "Q4", verantwortlich: "Bereichsleiter" },
    { workstream: "Organisation & Rollen", kategorie: "Ziel-Rollenmodell", prioritaet: "M", leitfrage: "Wie baut ihr die Ziel-Rollenlandkarte inkl. Nachfolge auf?", festlegung: "Vollständige Rollenlandkarte mit Nachfolgeplanung.", zielwert: "100 % Rollen besetzt/geplant", zieljahr: "2029", zielquartal: "Q4", verantwortlich: "Unit Lead" },
    { workstream: "Organisation & Rollen", kategorie: "Ziel-Rollenmodell", prioritaet: "N", leitfrage: "", festlegung: "Kernrollen definiert und benannt.", zielwert: "Kernrollen benannt", zieljahr: "2027", zielquartal: "Q2", verantwortlich: "Unit Lead" },
  ];

  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function escAttr(s) {
    return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }
  // Sicher zum Einbetten in ein einfach-gequotetes JS-Stringliteral, das selbst in
  // einem doppelt-gequoteten HTML-Attribut steht (z. B. oninput="vpEdit('...')").
  // HTML-Entities via escAttr, danach Backslash und Apostroph JS-escapen.
  function jsAttr(s) {
    return escAttr(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  // Zugriff auf die geteilten Lexical-Globals aus app.js (let YEARS/plan) bzw.
  // guidelines (per defineProperty auf window). Bare-Zugriff, wie in planning-new.js.
  function vpYears() {
    var ys = typeof YEARS !== "undefined" ? YEARS : null;
    return Array.isArray(ys) && ys.length ? ys.slice() : [2026, 2027, 2028, 2029];
  }
  function vpFinalYear() {
    var ys = vpYears();
    return ys[ys.length - 1];
  }

  function vpLiveGuidelines() {
    if (typeof guidelines !== "undefined" && Array.isArray(guidelines)) return guidelines;
    if (typeof window !== "undefined" && Array.isArray(window.guidelines)) return window.guidelines;
    return [];
  }
  function vpUsesSample() {
    return !vpLiveGuidelines().length;
  }
  function vpGuidelines() {
    return vpUsesSample() ? VP_SAMPLE : vpLiveGuidelines();
  }

  // Workstreams in Reihenfolge des ersten Auftretens
  function vpWorkstreamGroups() {
    var order = [];
    var byWs = {};
    vpGuidelines().forEach(function (g) {
      var ws = String(g.workstream || "").trim() || "Ohne Workstream";
      if (!byWs[ws]) {
        byWs[ws] = [];
        order.push(ws);
      }
      byWs[ws].push(g);
    });
    return order.map(function (ws) {
      return { ws: ws, items: byWs[ws] };
    });
  }

  function vpParseYear(v) {
    var n = parseInt(String(v == null ? "" : v).trim(), 10);
    return isNaN(n) ? null : n;
  }

  // Buckets: endziel (letztes Jahr), perYear[jahr], general (kein/unbekanntes Jahr)
  function vpBucketWorkstream(items) {
    var fy = vpFinalYear();
    var endziel = [];
    var general = [];
    var perYear = {};
    vpYears().forEach(function (y) {
      perYear[y] = [];
    });
    items.forEach(function (g) {
      var y = vpParseYear(g.zieljahr);
      if (y === fy) endziel.push(g);
      else if (y != null && perYear[y]) perYear[y].push(g);
      else general.push(g);

      // Zusätzlich: neue Pro-Jahr-Ziele aus g.jahre (Ziel-Text + Quartal je Planjahr)
      var jahre = g.jahre || {};
      Object.keys(jahre).forEach(function (yk) {
        var yy = vpParseYear(yk);
        if (yy == null || !perYear[yy]) return;
        // Für das eigene Zieljahr ist die volle Leitplanke bereits einsortiert – kein Duplikat.
        if (yy === y) return;
        var cell = jahre[yk] || {};
        var zielTxt = String(cell.ziel || "").trim();
        if (!zielTxt) return;
        var block = {
          workstream: g.workstream,
          kategorie: g.kategorie,
          prioritaet: g.prioritaet,
          zielwert: zielTxt,
          zielquartal: cell.quartal || "",
          __fromJahre: true,
        };
        // Endjahr-Ziele gehören ins ENDZIEL-Banner (die Jahres-Karte des Endjahres
        // zeigt guidelinesForYear nicht an), sonst in die Jahres-Karte.
        if (yy === fy) endziel.push(block);
        else perYear[yy].push(block);
      });
    });
    return { endziel: endziel, general: general, perYear: perYear };
  }

  function vpTopPrio(items) {
    if (items.some(function (g) { return g.prioritaet === "H"; })) return "H";
    if (items.some(function (g) { return g.prioritaet === "M"; })) return "M";
    if (items.some(function (g) { return g.prioritaet === "N"; })) return "N";
    return "";
  }

  /* ---------- Planungs-Maßnahmen (plan.measures, Modell "wsYear") ---------- */
  function vpMeasureKey(ws, year) {
    return "WS||" + ws + "||" + year;
  }
  function vpNewId() {
    return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function vpPlan() {
    // "plan" ist das geteilte Lexical-Global aus app.js (let plan = {...}).
    if (typeof plan === "undefined" || !plan) return { meta: {}, measures: {} };
    if (!plan.measures) plan.measures = {};
    return plan;
  }
  function vpGetMeasure(ws, year, create) {
    var plan = vpPlan();
    var key = vpMeasureKey(ws, year);
    var arr = plan.measures[key];
    if (!Array.isArray(arr)) {
      arr = arr ? [arr] : [];
      plan.measures[key] = arr;
    }
    var m = arr.find(function (x) { return x && x.kind === "wsYear"; });
    if (!m && create) {
      m = {
        id: vpNewId(), kind: "wsYear", workstream: ws, jahr: year,
        bezeichnung: "", ergebnis: "", kpis: "", voraussetzungen: "", abhaengigkeiten: "", risiken: "", verantwortlich: "",
        // Strukturierte Zielwerte – werden von server/dashboard-service.js als SOLL gelesen.
        ziel_umsatz_teur: null, ziel_headcount: null, ziel_anteil_prozent: null,
      };
      arr.push(m);
    }
    return m || null;
  }

  function vpStatus(ws, year) {
    var m = vpGetMeasure(ws, year, false);
    if (!m) return "empty";
    var bez = String(m.bezeichnung || "").trim();
    var erg = String(m.ergebnis || "").trim();
    if (bez && erg) return "done";
    if (bez || erg) return "partial";
    return "empty";
  }
  function vpStatusLabel(s) {
    return s === "done" ? "geplant" : s === "partial" ? "teilweise" : "offen";
  }

  /* ---------- Rendering ---------- */
  function vpGuidelineBlock(g) {
    var prio = g.prioritaet ? '<span class="badge ' + esc(g.prioritaet) + '">' + esc(g.prioritaet) + "</span>" : "";
    var lines = "";
    if (g.kategorie) lines += '<div class="vp-vorgabe-kat">' + prio + "<b>" + esc(g.kategorie) + "</b></div>";
    if (g.zielwert) lines += '<div class="vp-vorgabe-zw"><span class="vp-tag">Zielwert</span> ' + esc(g.zielwert) + (g.zielquartal ? " · " + esc(g.zielquartal) : "") + "</div>";
    if (g.festlegung) lines += '<div class="vp-vorgabe-fest">' + esc(g.festlegung) + "</div>";
    return '<div class="vp-vorgabe">' + lines + "</div>";
  }

  function vpEndzielBanner(group, bucket) {
    var fy = vpFinalYear();
    var inner = "";
    var leitfragen = [];
    (bucket.endziel.concat(bucket.general)).forEach(function (g) {
      inner += vpGuidelineBlock(g);
      if (g.leitfrage) leitfragen.push(g.leitfrage);
    });
    if (!inner) inner = '<div class="bc-muted">Für diesen Workstream ist noch kein Endziel (Zieljahr ' + fy + ") gepflegt.</div>";
    var lf = leitfragen.length ? '<div class="vp-leitfrage"><span class="vp-leitfrage-ico">?</span> ' + esc(leitfragen.join("  ·  ")) + "</div>" : "";
    return (
      '<div class="vp-endziel">' +
      '<div class="vp-endziel-head"><span class="vp-endziel-star">★</span> ENDZIEL ' + fy + '<span class="vp-endziel-sub">Zielbild – dahin führt die Planung</span></div>' +
      lf +
      '<div class="vp-endziel-body">' + inner + "</div>" +
      "</div>"
    );
  }

  function vpYearCard(ws, year, guidelinesForYear, isFinal) {
    var status = vpStatus(ws, year);
    var m = vpGetMeasure(ws, year, false) || {};
    var zBlocks = "";
    if (isFinal) {
      zBlocks = '<div class="vp-zwischenziel-note">Zielquartal entspricht dem <b>Endziel ' + year + "</b> (siehe oben).</div>";
    } else if (guidelinesForYear.length) {
      guidelinesForYear.forEach(function (g) {
        zBlocks += vpGuidelineBlock(g);
      });
    } else {
      zBlocks = '<div class="bc-muted vp-zwischenziel-empty">Kein GF-Zwischenziel für ' + year + " – freie Etappenplanung.</div>";
    }

    var wsA = escAttr(ws);   // reiner HTML-Attribut-Kontext (data-vp-ws)
    var wsJs = jsAttr(ws);   // Einbettung in JS-Inline-Handler
    var f = function (field, ph, tag) {
      return (
        '<label class="vp-field"><span class="vp-field-lbl">' + tag + "</span>" +
        '<input type="text" value="' + escAttr(m[field] || "") + '" placeholder="' + ph + '" ' +
        'oninput="vpEdit(\'' + wsJs + "'," + year + ",'" + field + "',this.value)\" onchange=\"vpSave()\"></label>"
      );
    };
    var beschreibung =
      '<label class="vp-field"><span class="vp-field-lbl">Beschreibung / Ergebnis</span>' +
      '<textarea placeholder="Was wird ' + year + " konkret erreicht?\" " +
      'oninput="vpEdit(\'' + wsJs + "'," + year + ",'ergebnis',this.value)\" onchange=\"vpSave()\">" + esc(m.ergebnis || "") + "</textarea></label>";

    var numVal = function (field) {
      var v = m[field];
      return v == null ? "" : escAttr(v);
    };
    var num = function (field, lbl, hint) {
      return (
        '<label class="vp-numfield"><span class="vp-field-lbl">' + lbl + "</span>" +
        '<input type="number" step="any" min="0" value="' + numVal(field) + '" placeholder="' + hint + '" ' +
        'oninput="vpEditNum(\'' + wsJs + "'," + year + ",'" + field + "',this.value)\" onchange=\"vpSave()\"></label>"
      );
    };
    var kennzahlen =
      '<div class="vp-kennzahlen">' +
      '<div class="vp-kennzahlen-title">Ziel-Kennzahlen <span class="vp-kennzahlen-hint">→ Fortschritts-Dashboard (SOLL)</span></div>' +
      '<div class="vp-numrow">' +
      num("ziel_umsatz_teur", "Umsatz (TEUR)", "z. B. 1200") +
      num("ziel_headcount", "Headcount", "z. B. 12") +
      num("ziel_anteil_prozent", "Anteil %", "z. B. 50") +
      "</div></div>";

    return (
      '<div class="vp-year-card" data-vp-ws="' + wsA + '" data-vp-year="' + year + '">' +
      '<div class="vp-year-head' + (isFinal ? " is-final" : "") + '">' +
      "<span class=\"vp-year-num\">" + year + "</span>" +
      '<span class="vp-year-role">' + (isFinal ? "Endziel-Jahr" : "Zwischenziel") + "</span>" +
      '<span class="vp-dot vp-dot-' + status + '" title="' + vpStatusLabel(status) + '"></span>' +
      "</div>" +
      '<div class="vp-year-goal">' + zBlocks + "</div>" +
      '<div class="vp-year-plan">' +
      '<div class="vp-plan-title">Ihre Planung</div>' +
      f("bezeichnung", "Kurztitel der Maßnahme", "Maßnahme") +
      beschreibung +
      f("kpis", "Woran messbar?", "KPIs") +
      f("verantwortlich", "Wer verantwortet?", "Verantwortlich") +
      kennzahlen +
      '<div class="vp-plan-status vp-plan-status-' + status + '">' + vpStatusLabel(status) + "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function vpWorkstreamSection(group) {
    var bucket = vpBucketWorkstream(group.items);
    var fy = vpFinalYear();
    var years = vpYears();
    var plannedYears = years.filter(function (y) { return vpStatus(group.ws, y) === "done"; }).length;
    var prio = vpTopPrio(group.items);
    var prioBadge = prio ? '<span class="badge ' + esc(prio) + '">Prio ' + esc(prio) + "</span>" : "";

    var cards = years
      .map(function (y) {
        return vpYearCard(group.ws, y, bucket.perYear[y] || [], y === fy);
      })
      .join('<div class="vp-timeline-arrow">→</div>');

    return (
      '<section class="vp-ws card">' +
      '<div class="vp-ws-head">' +
      "<h3>" + esc(group.ws) + "</h3>" +
      prioBadge +
      '<span class="vp-ws-progress">' + plannedYears + " / " + years.length + " Jahre geplant</span>" +
      "</div>" +
      vpEndzielBanner(group, bucket) +
      '<div class="vp-timeline">' + cards + "</div>" +
      "</section>"
    );
  }

  function vpRenderInto(root) {
    var groups = vpWorkstreamGroups();
    var sampleNote = vpUsesSample()
      ? '<div class="vp-samplebanner">⚠ Es sind noch keine GF-Leitplanken gepflegt – angezeigt werden <b>Beispiel-Vorgaben</b>. Sobald unter „④ Leitplanken" bzw. im Admin echte Leitplanken hinterlegt sind, erscheinen diese hier automatisch.</div>'
      : "";
    var intro =
      '<div class="card vp-intro">' +
      "<h3 style=\"margin:0 0 .35rem\">Vorgaben &amp; Planung</h3>" +
      '<p class="bc-muted" style="margin:0">Je Workstream steht oben das <b>Endziel</b> (' + vpFinalYear() + ', Zielbild der Geschäftsführung), darunter die Etappen 2026→' + vpFinalYear() +
      ". Für jedes Jahr sehen Sie links das <b>GF-Zwischenziel</b> und erfassen rechts direkt Ihre Planung dagegen. " +
      'Gespeichert wird in dieselbe Planung wie unter „① Planung".</p>' +
      '<div class="vp-legend"><span class="vp-dot vp-dot-done"></span> geplant <span class="vp-dot vp-dot-partial"></span> teilweise <span class="vp-dot vp-dot-empty"></span> offen</div>' +
      "</div>";

    if (!groups.length) {
      root.innerHTML = intro + '<div class="card"><p class="bc-muted">Keine Workstreams/Leitplanken vorhanden.</p></div>';
      return;
    }
    root.innerHTML =
      sampleNote +
      intro +
      groups
        .map(function (g) {
          return vpWorkstreamSection(g);
        })
        .join("");
  }

  /* ---------- Interaktion ---------- */
  var _vpSaveTimer = null;
  function vpEdit(ws, year, field, value) {
    var m = vpGetMeasure(ws, year, true);
    m[field] = value;
    // Live-Status am Kartenkopf + Fußzeile aktualisieren
    var card = document.querySelector('.vp-year-card[data-vp-ws="' + (window.CSS && CSS.escape ? CSS.escape(ws) : ws) + '"][data-vp-year="' + year + '"]');
    if (card) {
      var s = vpStatus(ws, year);
      var dot = card.querySelector(".vp-dot");
      if (dot) dot.className = "vp-dot vp-dot-" + s;
      var st = card.querySelector(".vp-plan-status");
      if (st) {
        st.className = "vp-plan-status vp-plan-status-" + s;
        st.textContent = vpStatusLabel(s);
      }
    }
  }

  function vpEditNum(ws, year, field, value) {
    var m = vpGetMeasure(ws, year, true);
    var t = String(value == null ? "" : value).trim();
    // Leer -> null (sonst liest das Dashboard Number("") = 0 als falsches Ziel).
    m[field] = t === "" ? null : Number(t.replace(",", "."));
  }

  async function vpSave() {
    if (typeof isBcViewAll === "function" && isBcViewAll()) {
      if (typeof toast === "function") toast("Bitte oben eine konkrete Unit wählen, um zu speichern.", "#e74c3c");
      return;
    }
    if (typeof savePlan !== "function") return;
    // leichte Entprellung, falls onchange mehrfach feuert
    if (_vpSaveTimer) clearTimeout(_vpSaveTimer);
    _vpSaveTimer = setTimeout(async function () {
      var ok = await savePlan({ allowIncomplete: true, silent: true });
      if (ok && typeof toast === "function") toast("Planung gespeichert");
      // Workstream-Fortschritt oben aktualisieren
      var root = document.getElementById("vorgabenPlanungContent");
      if (root && root.offsetParent !== null) refreshProgressLabels();
    }, 250);
  }

  function refreshProgressLabels() {
    var years = vpYears();
    document.querySelectorAll(".vp-ws").forEach(function (sec) {
      var head = sec.querySelector(".vp-ws-head h3");
      if (!head) return;
      var ws = head.textContent;
      var planned = years.filter(function (y) { return vpStatus(ws, y) === "done"; }).length;
      var lbl = sec.querySelector(".vp-ws-progress");
      if (lbl) lbl.textContent = planned + " / " + years.length + " Jahre geplant";
    });
  }

  async function initVorgabenPlanung() {
    var root = document.getElementById("vorgabenPlanungContent");
    if (!root) return;
    root.innerHTML = '<div class="card"><p class="bc-muted">Lade Vorgaben &amp; Planung…</p></div>';

    // Leitplanken laden (falls noch nicht vorhanden)
    if (!(Array.isArray(window.guidelines) && window.guidelines.length) && typeof loadGuideState === "function") {
      try { await loadGuideState(); } catch (_e) { /* Fallback = Sample */ }
    }
    // Plan der aktuellen Unit laden (falls konkrete Unit gewählt)
    if (!(typeof isBcViewAll === "function" && isBcViewAll()) && typeof loadPlanFromApi === "function") {
      try { await loadPlanFromApi(); } catch (_e) { /* ignore */ }
    }

    vpRenderInto(root);

    if (typeof isBcViewAll === "function" && isBcViewAll()) {
      var notice = document.createElement("div");
      notice.className = "unit-save-notice";
      notice.setAttribute("role", "status");
      notice.innerHTML =
        "<strong>Nur Ansicht:</strong> Oben ist <em>Alle Units</em> aktiv. " +
        "Zum Erfassen/Speichern bitte im <strong>Filter</strong> eine konkrete Unit wählen.";
      root.insertBefore(notice, root.firstChild);
    }
  }

  window.vpEdit = vpEdit;
  window.vpEditNum = vpEditNum;
  window.vpSave = vpSave;
  window.initVorgabenPlanung = initVorgabenPlanung;
})();
