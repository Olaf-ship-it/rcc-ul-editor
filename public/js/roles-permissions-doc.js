/**
 * Statische Dokumentation: Systemrollen und Berechtigungen (Admin → Rollen & Berechtigungen).
 * Spiegelt die Zugriffslogik in server.js und public/js/app.js wider.
 */
(function () {
  const PERM = {
    full: { sym: "✓", cls: "adm-perm-yes", title: "Ja" },
    no: { sym: "–", cls: "adm-perm-no", title: "Nein" },
    cfg: { sym: "◎", cls: "adm-perm-cfg", title: "Konfigurierbar (Checkbox in Benutzerverwaltung)" },
    unit: { sym: "◐", cls: "adm-perm-unit", title: "Ja, eingeschränkt auf zugewiesene Unit(s)" },
    own: { sym: "●", cls: "adm-perm-own", title: "Nur eigenes Skill-Profil" },
  };

  const MATRIX_COLUMNS = [
    { id: "phase1", label: "Phase 1 · Status" },
    { id: "phase2", label: "Phase 2 · Backcasting" },
    { id: "phase3", label: "Phase 3 · Fortschritt" },
    { id: "admin", label: "Admin-Bereich" },
    { id: "units", label: "Units verwalten" },
    { id: "scope", label: "Daten-Umfang" },
  ];

  const MATRIX_ROWS = [
    {
      role: "Super Admin",
      badge: "administration",
      desc: "Höchste Systemrolle. Erweitert Admin um Unit-Stammdaten und globalen Filter.",
      cells: {
        phase1: PERM.full,
        phase2: PERM.full,
        phase3: PERM.full,
        admin: PERM.full,
        units: PERM.full,
        scope: "Alle Units (Filter „Alle Units“ / einzelne Unit)",
      },
    },
    {
      role: "Admin",
      badge: "administration",
      desc: "Vollzugriff auf Benutzerverwaltung, Kataloge, Organigramm und alle Phasen. Phase 2/3 immer aktiv.",
      cells: {
        phase1: PERM.full,
        phase2: PERM.full,
        phase3: PERM.full,
        admin: PERM.full,
        units: PERM.no,
        scope: "Alle Units (Unit per Session / Abfrage)",
      },
    },
    {
      role: "Geschäftsführung",
      badge: "hierarchie",
      desc: "Führungsrolle im Organigramm (Position „Geschäftsführer“). Kein eingeschränkter Mitarbeiter-Modus.",
      cells: {
        phase1: PERM.unit,
        phase2: PERM.no,
        phase3: PERM.no,
        admin: PERM.no,
        units: PERM.no,
        scope: "Session-Unit (erste Master-Unit beim Login)",
      },
    },
    {
      role: "Regionalleiter",
      badge: "hierarchie",
      desc: "Führungsrolle (Position „Regional Leiter“). Organigramm-Knoten mit zugewiesenen Units.",
      cells: {
        phase1: PERM.unit,
        phase2: PERM.cfg,
        phase3: PERM.cfg,
        admin: PERM.no,
        units: PERM.no,
        scope: "Zugewiesene Unit(s), Session-Unit beim Login",
      },
    },
    {
      role: "Unit Lead",
      badge: "hierarchie",
      desc: "Unit-Verantwortlicher (Position „Unit Leiter“ oder abgeleitete Hierarchierolle unit_lead).",
      cells: {
        phase1: PERM.unit,
        phase2: PERM.cfg,
        phase3: PERM.cfg,
        admin: PERM.no,
        units: PERM.no,
        scope: "Zugewiesene Unit(s)",
      },
    },
    {
      role: "CC Leiter",
      badge: "hierarchie",
      desc: "Competence-Center-Leitung – fachlich wie Unit Lead behandelt (Position „CC Leiter“ → unit_lead).",
      cells: {
        phase1: PERM.unit,
        phase2: PERM.cfg,
        phase3: PERM.cfg,
        admin: PERM.no,
        units: PERM.no,
        scope: "Zugewiesene Unit(s)",
      },
    },
    {
      role: "Stellv. Unit Leiter",
      badge: "hierarchie",
      desc: "Stellvertreter am Unit-Stammdatensatz. Anwendungszugriff separat freischaltbar.",
      cells: {
        phase1: PERM.unit,
        phase2: PERM.cfg,
        phase3: PERM.cfg,
        admin: PERM.no,
        units: PERM.no,
        scope: "Zugewiesene Unit(s)",
      },
    },
    {
      role: "Mitarbeiter (rein)",
      badge: "hierarchie",
      desc: "Nur Rolle/Position Mitarbeiter ohne erweiterte Führungsrolle (isPureMitarbeiter).",
      cells: {
        phase1: PERM.own,
        phase2: PERM.no,
        phase3: PERM.no,
        admin: PERM.no,
        units: PERM.no,
        scope: "Nur eigenes Skill-Profil in eigener Unit",
      },
    },
    {
      role: "Phase 2 · Backcasting",
      badge: "modul",
      desc: "Zusatzrolle backcasting – freigeschaltet per Checkbox für berechtigte Führungskräfte oder automatisch bei Admin.",
      cells: {
        phase1: PERM.no,
        phase2: PERM.full,
        phase3: PERM.no,
        admin: PERM.no,
        units: PERM.no,
        scope: "Unit des Plans (eigene zugewiesene Unit)",
      },
    },
    {
      role: "Phase 3 · Fortschritt",
      badge: "modul",
      desc: "Zusatzrolle fortschritt – IST/SOLL-Dashboard; freigeschaltet per Checkbox oder automatisch bei Admin.",
      cells: {
        phase1: PERM.no,
        phase2: PERM.no,
        phase3: PERM.full,
        admin: PERM.no,
        units: PERM.no,
        scope: "Konkrete Unit (nicht „Alle Units“)",
      },
    },
  ];

  const ROLE_DETAIL_SECTIONS = [
    {
      title: "Administration",
      color: "#e67e22",
      items: [
        {
          name: "Super Admin",
          id: "super_admin",
          text: "Alle Admin-Rechte plus „Units verwalten“ (Unit anlegen, Unit Leiter und Stellvertreter zuweisen). Filter im Header mit „Alle Units“. Vergabe erfordert Freischalt-Passwort.",
        },
        {
          name: "Admin",
          id: "admin",
          text: "Zugriff auf Benutzerverwaltung, Skill-Pflege, Rollen-/Positions-Kataloge, Organigramm und Export/Import. Sieht und bearbeitet Einträge aller Units. Phase 2 und 3 sind immer freigeschaltet.",
        },
      ],
    },
    {
      title: "Hierarchie & Organisation",
      color: "#16a085",
      items: [
        {
          name: "Geschäftsführung",
          id: "geschaeftsfuehrung",
          text: "Spitze des Organigramms. Voller Phase-1-Zugriff (Portfolio, Organisation, Skills der Unit), sofern nicht gleichzeitig reiner Mitarbeiter ohne Führungsrolle.",
        },
        {
          name: "Regionalleiter",
          id: "regionalleiter",
          text: "Führungskraft unterhalb der Geschäftsführung. Benötigt Standort und optional Vorgesetzte (GF). Phase-1-Daten der zugewiesenen Unit(s).",
        },
        {
          name: "Unit Lead (unit_lead)",
          id: "unit_lead",
          text: "Verantwortlich für eine oder mehrere Units. Pflegt Portfolio, Organisation und Skill-Matrix der Unit. Benötigt mindestens eine Unit und einen Regionalleiter als Vorgesetzten.",
        },
        {
          name: "Mitarbeiter (mitarbeiter)",
          id: "mitarbeiter",
          text: "Genau eine Unit. Reine Mitarbeiter sehen nur den Tab Skills und ihr eigenes Profil. Kombination mit Unit Lead / Admin / GF / Regionalleiter hebt die Einschränkung auf.",
        },
      ],
    },
    {
      title: "Positionen (Skill-Matrix)",
      color: "#2980b9",
      items: [
        {
          name: "Unit Leiter / CC Leiter / Regional Leiter / Geschäftsführer",
          id: "positions-hierarchy",
          text: "Positionen leiten System-Hierarchierollen ab: Unit Leiter und CC Leiter → unit_lead, Regional Leiter → regionalleiter, Geschäftsführer → geschaeftsfuehrung. Steuern u. a. Organigramm und Pflichtfelder in der Benutzerverwaltung.",
        },
        {
          name: "Stellv. Unit Leiter",
          id: "stellv",
          text: "Wird je Unit als Stellvertreter hinterlegt (Units verwalten). Kann Anwendungszugriff erhalten. Keine automatische Phase-2/3-Freigabe.",
        },
        {
          name: "Mitarbeiter / Berater",
          id: "positions-ma",
          text: "Führen zur Hierarchierolle mitarbeiter. Berater wird wie Mitarbeiter behandelt.",
        },
      ],
    },
    {
      title: "Organisationsrollen (Katalog)",
      color: "#8e44ad",
      items: [
        {
          name: "Frei definierbar (z. B. Solution Architect)",
          id: "org-catalog",
          text: "Reine Fachrollen in Organisation → Rollen in der Unit und in der Skill-Matrix. Keine eigenen Systemberechtigungen – dienen der Dokumentation und Auswertung.",
        },
      ],
    },
    {
      title: "Anwendungsmodule",
      color: "#27ae60",
      items: [
        {
          name: "Phase 2 · Backcasting (backcasting)",
          id: "backcasting",
          text: "Zugriff auf /backcasting/ – strategische Maßnahmenplanung. Freischaltbar für Unit Leiter, Stellv. Unit Leiter, CC Leiter und Regionalleiter. Admins immer.",
        },
        {
          name: "Phase 3 · Fortschritt (fortschritt)",
          id: "fortschritt",
          text: "Tab Fortschritt – IST/SOLL-Vergleich Portfolio, Organisation, Skills vs. Backcasting-Plan. Gleiche Freigabelogik wie Phase 2.",
        },
      ],
    },
  ];

  function permCellHtml(value) {
    if (typeof value === "string") {
      return `<td class="adm-perm-cell adm-perm-text" title="${escAttr(value)}">${esc(value)}</td>`;
    }
    return `<td class="adm-perm-cell ${value.cls}" title="${escAttr(value.title)}"><span aria-hidden="true">${value.sym}</span></td>`;
  }

  function badgeHtml(kind) {
    const labels = {
      administration: "Administration",
      hierarchie: "Hierarchie",
      modul: "Anwendungsmodul",
    };
    return `<span class="adm-perm-badge adm-perm-badge--${kind}">${labels[kind] || kind}</span>`;
  }

  function renderMatrix() {
    const head = MATRIX_COLUMNS.map((c) => `<th>${esc(c.label)}</th>`).join("");
    const body = MATRIX_ROWS.map((row) => {
      const cells = MATRIX_COLUMNS.map((c) => permCellHtml(row.cells[c.id])).join("");
      return `<tr>
        <th scope="row" class="adm-perm-row-head">
          <div class="adm-perm-row-title">${esc(row.role)}</div>
          ${badgeHtml(row.badge)}
          <p class="adm-perm-row-desc">${esc(row.desc)}</p>
        </th>
        ${cells}
      </tr>`;
    }).join("");
    return `<div class="tbl-wrap adm-perm-matrix-wrap">
      <table class="entries adm-perm-matrix">
        <thead><tr><th>Rolle</th>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
  }

  function renderLegend() {
    const items = [
      [PERM.full, "Vollzugriff"],
      [PERM.unit, "Zugriff auf zugewiesene Unit(s)"],
      [PERM.own, "Nur eigenes Skill-Profil"],
      [PERM.cfg, "Per Checkbox in Benutzerverwaltung"],
      [PERM.no, "Kein Zugriff"],
    ];
    return `<ul class="adm-perm-legend">${items
      .map(
        ([p, label]) =>
          `<li><span class="adm-perm-cell ${p.cls}" style="display:inline-flex;min-width:1.6rem">${p.sym}</span> ${esc(label)}</li>`
      )
      .join("")}</ul>`;
  }

  function renderDetailSections() {
    return ROLE_DETAIL_SECTIONS.map(
      (section) => `<details class="card admin-collapsible adm-perm-detail-card" style="border-left-color:${section.color}" open>
        <summary class="admin-collapsible__summary">
          <span class="admin-collapsible__chevron" aria-hidden="true">›</span>
          <span>${esc(section.title)}</span>
        </summary>
        <div class="admin-collapsible__body">
          ${section.items
            .map(
              (item) => `<div class="adm-perm-detail-item">
            <h4 class="adm-perm-detail-name">${esc(item.name)}</h4>
            <p class="adm-perm-detail-text">${esc(item.text)}</p>
          </div>`
            )
            .join("")}
        </div>
      </details>`
    ).join("");
  }

  function renderPhasesOverview() {
    return `<div class="adm-perm-phases">
      <div class="adm-perm-phase-card">
        <h4>Phase 1 · Status Aufnahme</h4>
        <p>Portfolio, Organisation, Skill-Matrix, Übersicht und Export für die Unit. Standard für alle angemeldeten Führungskräfte; reine Mitarbeiter nur Skills (eigenes Profil).</p>
      </div>
      <div class="adm-perm-phase-card">
        <h4>Phase 2 · Backcasting-Planung</h4>
        <p>Separates Modul unter <code>/backcasting/</code>. Leitplanken, Planung, Review und Export des strategischen Plans je Unit.</p>
      </div>
      <div class="adm-perm-phase-card">
        <h4>Phase 3 · Fortschritt</h4>
        <p>IST/SOLL-Dashboard: Vergleich Phase-1-Daten und Backcasting-Plan (Kennzahlen, Skills, Meilensteine) pro Unit und Jahr.</p>
      </div>
    </div>`;
  }

  function renderNotes() {
    const notes = [
      "Mehrere Rollen pro Benutzer sind möglich (z. B. Unit Lead + Mitarbeiter). Reine Mitarbeiter-Einschränkung gilt nur ohne erweiterte Rolle (Unit Lead, Admin, GF, Regionalleiter).",
      "Anwendungszugriff (Phase 2/3) wird in der Benutzerverwaltung nur für Unit Leiter, Stellv. Unit Leiter, CC Leiter und Regionalleiter angezeigt und vergeben.",
      "Admin und Super Admin haben Phase 2 und 3 immer aktiv; die Checkboxen sind gesperrt.",
      "Super Admin sieht zusätzlich den Filter „Alle Units“ im Header und kann Unit-Stammdaten pflegen.",
      "Organisationsrollen aus dem Katalog (Tab „Rollen & Positionen“) vergeben keine Systemrechte – nur Positionen und Administration/Hierarchie/MODUL-Rollen.",
    ];
    return `<ul class="adm-perm-notes">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`;
  }

  function renderAdminRolesPermissionsDoc() {
    const root = document.getElementById("adminPermissionsDoc");
    if (!root) return;
    root.innerHTML = `
      <div class="card adm-perm-intro-card" style="border-left-color:var(--rc-accent2)">
        <h3 style="color:var(--rc-accent2)">🔐 Rollen &amp; Berechtigungen</h3>
        <p class="adm-perm-intro">
          Übersicht aller <strong>Systemrollen</strong> und deren Wirkung in der Anwendung.
          Katalog-Rollen (Organisation) und Positionen (Skill-Matrix) werden unter
          <em>Rollen &amp; Positionen</em> gepflegt; hier geht es um Zugriffsrechte.
        </p>
        ${renderPhasesOverview()}
      </div>
      <details class="card admin-collapsible adm-perm-detail-card" style="border-left-color:var(--rc-accent)" open>
        <summary class="admin-collapsible__summary">
          <span class="admin-collapsible__chevron" aria-hidden="true">›</span>
          <span>📊 Berechtigungsmatrix</span>
        </summary>
        <div class="admin-collapsible__body">
          ${renderLegend()}
          ${renderMatrix()}
        </div>
      </details>
      ${renderDetailSections()}
      <details class="card admin-collapsible adm-perm-detail-card" style="border-left-color:var(--rc-muted)">
        <summary class="admin-collapsible__summary">
          <span class="admin-collapsible__chevron" aria-hidden="true">›</span>
          <span>ℹ️ Hinweise</span>
        </summary>
        <div class="admin-collapsible__body">${renderNotes()}</div>
      </details>
    `;
  }

  window.renderAdminRolesPermissionsDoc = renderAdminRolesPermissionsDoc;
})();
