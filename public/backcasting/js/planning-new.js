/* planning-new.js -- Phase-1-basierte Meilensteinplanung */

let _p1SummaryCache = null;
let _p1Initialized = false;

const P1_AREAS = [
  { key: "portfolio", label: "Portfolio", icon: "\ud83d\udcbc" },
  { key: "gliederungen", label: "Organisation \u00b7 Gliederungen", icon: "\ud83c\udfe2" },
  { key: "rollen", label: "Organisation \u00b7 Rollen", icon: "\ud83d\udc54" },
  { key: "skills", label: "Skills", icon: "\ud83e\udde0" },
];

function p1Key(area, sub, yr) {
  return "P1||" + area + "||" + sub + "||" + yr;
}

function getP1Entries(area, sub, yr) {
  const v = plan.measures[p1Key(area, sub, yr)];
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function setP1Entries(area, sub, yr, arr) {
  if (!requireBcSaveUnit()) return;
  plan.measures[p1Key(area, sub, yr)] = arr;
}

function p1MilestoneTemplate(area, sub, yr) {
  const base = {
    id: uid(),
    kind: "p1Year",
    area: area,
    subcategory: sub,
    jahr: yr,
    ergebnis: "",
    verantwortlich: "",
    ziel_quartal: "",
  };
  if (area === "portfolio") {
    base.ziel_umsatz_teur = null;
  } else if (area === "gliederungen") {
    base.ziel_headcount = null;
    base.ziel_umsatz_teur = null;
  } else if (area === "rollen") {
    base.ziel_anzahl = null;
  } else if (area === "skills") {
    base.ziel_skill_level_min = null;
    base.ziel_anteil_prozent = null;
  }
  return base;
}

function p1KpiFields(area) {
  if (area === "portfolio") return [["ziel_umsatz_teur", "Ziel-Umsatz (TEUR)", "number"]];
  if (area === "gliederungen") return [["ziel_headcount", "Ziel-Headcount", "number"], ["ziel_umsatz_teur", "Ziel-Umsatz (TEUR)", "number"]];
  if (area === "rollen") return [["ziel_anzahl", "Ziel-Anzahl", "number"]];
  if (area === "skills") return [["ziel_skill_level_min", "Mindest-Level (1\u20135)", "number"], ["ziel_anteil_prozent", "Ziel-Anteil (%)", "number"]];
  return [];
}

function p1IstBadge(area, item) {
  if (area === "portfolio") {
    const n = item.count || 0;
    const t = item.umsatz_teur || 0;
    return n + " Eintr. \u00b7 " + Math.round(t) + " TEUR";
  }
  if (area === "gliederungen") {
    return (item.headcount || 0) + " HC \u00b7 " + Math.round(item.umsatz_teur || 0) + " TEUR";
  }
  if (area === "rollen") return (item.anzahl || 0) + " MA";
  if (area === "skills") return "\u00d8 " + (item.avgLevel || 0) + " \u00b7 " + (item.employeeCount || 0) + " MA";
  return "";
}

function p1MilestoneDomId(area, sub, yr, idx) {
  return "p1ms_" + area + "_" + sub.replace(/[^a-zA-Z0-9]/g, "_") + "_" + yr + "_" + idx;
}

function p1MilestoneTitle(ms) {
  const text = String(ms?.ergebnis || "").trim();
  if (!text) return "Ergebnis eingeben\u2026";
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length <= 96) return firstLine;
  return firstLine.slice(0, 93) + "\u2026";
}

function renderP1MilestoneForm(area, sub, yr, idx, ms, forceOpen) {
  const fields = p1KpiFields(area);
  const eid = "p1_" + area + "_" + sub.replace(/[^a-zA-Z0-9]/g, "_") + "_" + yr + "_" + idx;
  const mid = p1MilestoneDomId(area, sub, yr, idx);
  const title = p1MilestoneTitle(ms);
  const hasErgebnis = Boolean(String(ms.ergebnis || "").trim());
  const bodyOpen = forceOpen || !hasErgebnis;
  const titleCls = hasErgebnis ? "p1-ms__title" : "p1-ms__title p1-ms__title--empty";
  const bodyCls = bodyOpen ? "p1-ms__body" : "p1-ms__body closed";
  const wrapCls = bodyOpen ? "p1-ms p1-ms--open" : "p1-ms";

  let html = '<div class="' + wrapCls + '" data-area="' + escAttr(area) + '" data-sub="' + escAttr(sub) + '" data-yr="' + yr + '" data-idx="' + idx + '">';
  html += '<div class="p1-ms__head" onclick="toggleP1Ms(\'' + mid + '\')" role="button" tabindex="0" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();toggleP1Ms(\'' + mid + '\')}">';
  html += '<span class="p1-ms__chev" aria-hidden="true"></span>';
  html += '<span class="' + titleCls + '" id="' + mid + '_title">' + escAttr(title) + '</span>';
  html += '<span class="p1-ms__actions" onclick="event.stopPropagation()">';
  html += '<button type="button" class="bc-ms-icon-btn --delete" title="L\u00f6schen" onclick="delP1Entry(\'' + escAttr(area) + '\',\'' + escAttr(sub) + '\',' + yr + ',' + idx + ')">\u2716</button>';
  html += '</span></div>';

  html += '<div id="' + mid + '" class="' + bodyCls + '">';
  html += '<div class="p1-ms__field"><label>Ergebnis / Ma\u00dfnahme</label>';
  html += '<textarea id="' + eid + '_ergebnis" rows="2" oninput="p1SyncMsTitle(this)" onchange="updP1(this,\'' + escAttr(area) + '\',\'' + escAttr(sub) + '\',' + yr + ',' + idx + ',\'ergebnis\')">' + escAttr(ms.ergebnis || "") + '</textarea></div>';

  html += '<div class="p1-ms__kpi-grid">';
  fields.forEach(function(f) {
    const val = ms[f[0]];
    html += '<div class="p1-ms__field p1-ms__field--kpi"><label>' + escAttr(f[1]) + '</label>';
    html += '<input type="number" step="any" value="' + (val != null ? val : "") + '" onchange="updP1Num(this,\'' + escAttr(area) + '\',\'' + escAttr(sub) + '\',' + yr + ',' + idx + ',\'' + f[0] + '\')">';
    html += '</div>';
  });
  html += '<div class="p1-ms__field p1-ms__field--kpi"><label>Quartal</label>';
  html += '<select onchange="updP1(this,\'' + escAttr(area) + '\',\'' + escAttr(sub) + '\',' + yr + ',' + idx + ',\'ziel_quartal\')">';
  html += '<option value="">--</option>';
  ["Q1","Q2","Q3","Q4"].forEach(function(q) {
    html += '<option value="' + q + '"' + (ms.ziel_quartal === q ? ' selected' : '') + '>' + q + '</option>';
  });
  html += '</select></div>';
  html += '<div class="p1-ms__field p1-ms__field--kpi"><label>Verantwortlich</label>';
  html += '<input type="text" value="' + escAttr(ms.verantwortlich || "") + '" onchange="updP1(this,\'' + escAttr(area) + '\',\'' + escAttr(sub) + '\',' + yr + ',' + idx + ',\'verantwortlich\')">';
  html += '</div>';
  html += '</div>';

  html += '<div class="p1-ms__save">';
  html += '<button type="button" class="btn btn-sm btn-primary" onclick="saveP1Milestone(\'' + escAttr(area) + '\',\'' + escAttr(sub) + '\',' + yr + ',' + idx + ')">Speichern</button>';
  html += '</div>';
  html += '</div></div>';
  return html;
}

function renderP1YearAccordion(area, sub, yr, isFirst, openMsIdx) {
  const entries = getP1Entries(area, sub, yr);
  const count = entries.length;
  const openCls = isFirst ? " p1-acc--open" : "";
  let html = '<div class="p1-acc' + openCls + '" data-yr="' + yr + '">';
  html += '<div class="p1-acc__head" onclick="this.parentElement.classList.toggle(\'p1-acc--open\')">';
  html += '<span class="p1-acc__yr">' + yr + '</span>';
  html += '<span class="p1-acc__count">' + (count ? count + " Meilenstein(e)" : "leer") + '</span>';
  html += '</div>';
  html += '<div class="p1-acc__body">';
  entries.forEach(function(ms, idx) {
    html += renderP1MilestoneForm(area, sub, yr, idx, ms, openMsIdx === idx);
  });
  html += '<button type="button" class="btn btn-sm btn-outline p1-add-btn" onclick="event.stopPropagation();addP1Entry(\'' + escAttr(area) + '\',\'' + escAttr(sub) + '\',' + yr + ')">+ Meilenstein</button>';
  html += '</div></div>';
  return html;
}

function renderP1SubcategoryBlock(area, item) {
  const sub = item.subcategory || item.label;
  const label = item.label || item.subcategory;
  const badge = p1IstBadge(area, item);
  const blockId = "p1block_" + area + "_" + sub.replace(/[^a-zA-Z0-9]/g, "_");

  let html = '<details class="p1-subcat" id="' + escAttr(blockId) + '">';
  html += '<summary class="p1-subcat__head">';
  html += '<span class="p1-subcat__label">' + escAttr(label) + '</span>';
  html += '<span class="p1-subcat__ist">IST: ' + escAttr(badge) + '</span>';
  html += '</summary>';
  html += '<div class="p1-subcat__body">';
  YEARS.forEach(function(yr, i) {
    html += renderP1YearAccordion(area, sub, yr, i === 0);
  });
  html += '</div></details>';
  return html;
}

function renderP1Area(areaDef, items) {
  let html = '<details class="p1-area" open>';
  html += '<summary class="p1-area__head">';
  html += '<span class="p1-area__icon">' + areaDef.icon + '</span>';
  html += '<span class="p1-area__label">' + escAttr(areaDef.label) + '</span>';
  html += '<span class="p1-area__count">' + items.length + ' Unterkategorien</span>';
  html += '</summary>';
  html += '<div class="p1-area__body">';
  items.forEach(function(item) {
    html += renderP1SubcategoryBlock(areaDef.key, item);
  });
  html += '</div></details>';
  return html;
}

function renderPlanungNewHtml() {
  let html = '<div class="p1-planning">';
  html += '<div class="card" style="margin-bottom:.75rem"><h3 style="margin:0;color:var(--rc-accent2)">Planung NEW \u00b7 Phase-1-basiert</h3>';
  html += '<p class="bc-muted" style="margin:.3rem 0 0">Meilensteinplanung auf Basis der Phase-1-Unterkategorien. IST-Werte werden als Referenz angezeigt.</p></div>';

  let hasAny = false;
  P1_AREAS.forEach(function (areaDef) {
    const items = (_p1SummaryCache && _p1SummaryCache[areaDef.key]) || [];
    if (items.length) {
      html += renderP1Area(areaDef, items);
      hasAny = true;
    }
  });

  if (!hasAny) {
    html += '<div class="card"><p class="bc-muted">F\u00fcr diese Unit sind noch keine Phase-1-Daten (Portfolio, Organisation, Skills) erfasst. Bitte zuerst Phase-1-Eintr\u00e4ge anlegen.</p></div>';
  }

  html += '</div>';
  return html;
}

function collectP1OpenState() {
  const state = { subcats: [], accs: [], milestones: [] };
  document.querySelectorAll(".p1-subcat[open]").forEach(function (el) {
    if (el.id) state.subcats.push(el.id);
  });
  document.querySelectorAll(".p1-acc.p1-acc--open").forEach(function (el) {
    const yr = el.dataset.yr;
    const subcat = el.closest(".p1-subcat")?.id;
    if (yr && subcat) state.accs.push({ subcat: subcat, yr: yr });
  });
  document.querySelectorAll(".p1-ms__body:not(.closed)").forEach(function (el) {
    if (el.id) state.milestones.push(el.id);
  });
  return state;
}

function applyP1OpenState(state, focusTarget) {
  const subcats = new Set(state?.subcats || []);
  const accKeys = new Set((state?.accs || []).map(function (a) { return a.subcat + "||" + a.yr; }));
  const milestones = new Set(state?.milestones || []);

  if (focusTarget) {
    const blockId = "p1block_" + focusTarget.area + "_" + focusTarget.sub.replace(/[^a-zA-Z0-9]/g, "_");
    subcats.add(blockId);
    accKeys.add(blockId + "||" + String(focusTarget.yr));
    if (focusTarget.idx != null) {
      milestones.add(p1MilestoneDomId(focusTarget.area, focusTarget.sub, focusTarget.yr, focusTarget.idx));
    }
  }

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

  if (focusTarget && focusTarget.idx != null && focusTarget.idx >= 0) {
    const textarea = document.getElementById(
      "p1_" + focusTarget.area + "_" + focusTarget.sub.replace(/[^a-zA-Z0-9]/g, "_") + "_" + focusTarget.yr + "_" + focusTarget.idx + "_ergebnis"
    );
    if (textarea) {
      requestAnimationFrame(function () { textarea.focus(); });
    }
  }
}

function refreshPlanungNewUI(opts) {
  const root = document.getElementById("planungNewContent");
  if (!root || !_p1SummaryCache) return;
  const openState = opts?.openState || collectP1OpenState();
  root.innerHTML = renderPlanungNewHtml();
  applyP1OpenState(openState, opts?.focusTarget);
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

  const openState = opts?.skipFetch ? (opts.openState || collectP1OpenState()) : null;

  if (!opts?.skipFetch) {
    root.innerHTML = '<div class="card"><p class="bc-muted">Lade Phase-1-Daten\u2026</p></div>';

    try {
      const unit = typeof bcViewUnit !== "undefined" ? bcViewUnit : "";
      const resp = await fetch("/api/backcasting/phase1-summary?unit=" + encodeURIComponent(unit), { credentials: "include" });
      if (!resp.ok) throw new Error("API-Fehler " + resp.status);
      _p1SummaryCache = await resp.json();
    } catch (e) {
      root.innerHTML = '<div class="card"><p style="color:var(--rc-red)">Phase-1-Daten konnten nicht geladen werden: ' + escAttr(e.message) + '</p></div>';
      return;
    }
  } else if (!_p1SummaryCache) {
    return initPlanungNew();
  }

  root.innerHTML = renderPlanungNewHtml();
  applyP1OpenState(openState || {}, opts?.focusTarget);
  _p1Initialized = true;
}

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
  titleEl.textContent = text ? text.split("\n")[0].slice(0, 96) : "Ergebnis eingeben\u2026";
  titleEl.classList.toggle("p1-ms__title--empty", !text);
};

window.addP1Entry = function(area, sub, yr) {
  if (!requireBcSaveUnit()) return;
  const openState = collectP1OpenState();
  const entries = getP1Entries(area, sub, yr);
  entries.unshift(p1MilestoneTemplate(area, sub, yr));
  setP1Entries(area, sub, yr, entries);
  initPlanungNew({ skipFetch: true, openState: openState, focusTarget: { area: area, sub: sub, yr: yr, idx: 0 } });
};

window.delP1Entry = function(area, sub, yr, idx) {
  if (!confirm("Meilenstein l\u00f6schen?")) return;
  const openState = collectP1OpenState();
  const entries = getP1Entries(area, sub, yr);
  entries.splice(idx, 1);
  setP1Entries(area, sub, yr, entries);
  const focusTarget = entries.length
    ? { area: area, sub: sub, yr: yr, idx: Math.min(idx, entries.length - 1) }
    : { area: area, sub: sub, yr: yr };
  initPlanungNew({ skipFetch: true, openState: openState, focusTarget: focusTarget });
};

window.updP1 = function(el, area, sub, yr, idx, field) {
  const entries = getP1Entries(area, sub, yr);
  if (!entries[idx]) return;
  entries[idx][field] = el.value;
  entries[idx].updatedAt = new Date().toISOString();
  setP1Entries(area, sub, yr, entries);
  if (field === "ergebnis") {
    const mid = p1MilestoneDomId(area, sub, yr, idx);
    const titleEl = document.getElementById(mid + "_title");
    if (titleEl) {
      titleEl.textContent = p1MilestoneTitle(entries[idx]);
      titleEl.classList.toggle("p1-ms__title--empty", !String(el.value || "").trim());
    }
  }
};

window.updP1Num = function(el, area, sub, yr, idx, field) {
  const entries = getP1Entries(area, sub, yr);
  if (!entries[idx]) return;
  const v = el.value.trim();
  entries[idx][field] = v === "" ? null : Number(v);
  entries[idx].updatedAt = new Date().toISOString();
  setP1Entries(area, sub, yr, entries);
};

window.saveP1Milestone = async function(area, sub, yr, idx) {
  const entries = getP1Entries(area, sub, yr);
  const ms = entries[idx];
  if (!ms) return;
  if (!ms.ergebnis || !ms.ergebnis.trim()) {
    alert("Bitte mindestens das Feld \u201eErgebnis / Ma\u00dfnahme\u201c ausf\u00fcllen.");
    return;
  }
  const openState = collectP1OpenState();
  const mid = p1MilestoneDomId(area, sub, yr, idx);
  openState.milestones = (openState.milestones || []).filter(function (id) { return id !== mid; });
  await savePlan({ allowIncomplete: true });
  initPlanungNew({
    skipFetch: true,
    openState: openState,
    focusTarget: { area: area, sub: sub, yr: yr },
  });
};
