console.log("APP_BOOT", new Date().toISOString());
window.__APP_BOOTED__ = true;
let YEARS=[2026,2027,2028,2029];
const TYPES=["Produkt","Service","Lösung","Organisation","Skill","Sales","Partner","Tech"];
const STATUSES=["Geplant","In Arbeit","Abgeschlossen","Blockiert"];
const LS_PLAN = "rc_bc_plan";
const LS_PLAN_MIGRATED = "rc_bc_plan_migrated";
const LS_BC_TAB = "rc_bc_active_tab";
const BC_TAB_IDS = ["planung", "jahresabschluss", "review", "leitplanken", "export"];

let plan = { meta: {}, measures: {} }, currentCat = null;
let bcUserUnit = '';
let bcViewUnit = '';
let bcUserUnits = [];
let bcSessionUser = null;
let bcIsSuperAdmin = false;
let bcIsAdmin = false;
let bcMasterUnitsCache = [];
let bcUnitSwitcherBound = false;

function readPersistedBcTab() {
  try {
    const urlTab = new URLSearchParams(window.location.search).get("tab");
    if (urlTab === "planung-new") return "planung";
    if (urlTab && BC_TAB_IDS.indexOf(urlTab) >= 0) return urlTab;
    const tab = sessionStorage.getItem(LS_BC_TAB) || "";
    if (tab === "planung-new") return "planung";
    return BC_TAB_IDS.indexOf(tab) >= 0 ? tab : "planung";
  } catch (_e) {
    return "planung";
  }
}

function writePersistedBcTab(tab) {
  if (BC_TAB_IDS.indexOf(tab) < 0) return;
  try {
    sessionStorage.setItem(LS_BC_TAB, tab);
  } catch (_e) {
    /* ignore */
  }
}

function runBcTabSideEffects(tabId) {
  if (tabId === "review") renderReview();
  if (tabId === "planung" && typeof initPlanungNew === "function") initPlanungNew();
  if (tabId === "vorgaben" && typeof initVorgabenPlanung === "function") initVorgabenPlanung();
  if (tabId === "jahresabschluss" && typeof initYearClose === "function") initYearClose();
}

function activateBcTab(tabId, options) {
  const opts = options || {};
  const tab = document.querySelector('#bcTabs .tab[data-tab="' + tabId + '"]');
  const page = document.getElementById("page-" + tabId);
  if (!tab || !page) return false;

  document.querySelectorAll("#bcTabs .tab").forEach(function (x) { x.classList.remove("active"); });
  document.querySelectorAll(".page").forEach(function (x) { x.classList.remove("active"); });
  tab.classList.add("active");
  page.classList.add("active");

  if (!opts.skipPersist) writePersistedBcTab(tabId);
  if (!opts.skipSideEffects) runBcTabSideEffects(tabId);
  return true;
}

function refreshActiveBcTab() {
  const tabId = document.querySelector("#bcTabs .tab.active")?.dataset.tab;
  if (tabId) runBcTabSideEffects(tabId);
}

function escAttr(s){return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}

function initBcSessionFromDetail(me){
  if(!me){
    bcUserUnit = document.body.dataset.rcUserUnit || '';
    bcUserUnits = (document.body.dataset.rcUserUnits || '').split('|').filter(Boolean);
    bcIsSuperAdmin = document.body.dataset.rcIsSuperAdmin === '1';
    bcIsAdmin = document.body.dataset.rcIsAdmin === '1';
    bcSessionUser = {
      name: document.body.dataset.rcUserName || '',
      email: document.body.dataset.rcUserEmail || '',
      unit: bcUserUnit,
      units: bcUserUnits,
    };
    return;
  }
  bcSessionUser = me;
  bcUserUnit = me.unit || (me.units && me.units[0]) || '';
  bcUserUnits = Array.isArray(me.units) ? me.units : [];
  bcIsSuperAdmin = Boolean(me.isSuperAdmin);
  bcIsAdmin = Boolean(me.isAdmin);
}

function shouldShowBcUnitSwitcher(){
  return bcIsSuperAdmin || bcIsAdmin || bcUserUnits.length > 1;
}

function isBcViewAll(){
  return (bcIsSuperAdmin || bcIsAdmin) && bcViewUnit === 'all';
}

function getBcViewUnit(){
  return bcViewUnit;
}

function getBcSaveUnit(){
  if(bcIsSuperAdmin || bcIsAdmin){
    if(bcViewUnit === 'all') return '';
    return String(bcViewUnit || '').trim();
  }
  return String(bcViewUnit || bcUserUnit || '').trim();
}

function requireBcSaveUnit(){
  const unit = getBcSaveUnit();
  if(!unit){
    toast('Bitte oben eine konkrete Unit wählen (nicht „Alle Units“), um zu speichern.');
    document.getElementById('bcHeaderUnitSwitcher')?.scrollIntoView?.({ behavior:'smooth', block:'nearest' });
    return false;
  }
  return true;
}

async function loadBcMasterUnitsCache(){
  try{
    if(bcIsAdmin){
      const res = await fetch('/api/admin/units', { credentials:'same-origin' });
      if(res.ok){ bcMasterUnitsCache = await res.json(); return; }
    }
    const res = await fetch('/api/auth/units', { credentials:'same-origin' });
    const data = await res.json();
    bcMasterUnitsCache = (data.units || []).map((name)=>({ name }));
  }catch(_e){
    bcMasterUnitsCache = bcUserUnits.map((name)=>({ name }));
  }
}

function updateBcEditMode(){
  const notice = document.getElementById('bcUnitSaveNotice');
  const hint = document.getElementById('bcSuperAdminViewHint');
  const viewAll = isBcViewAll();
  if(notice) notice.style.display = viewAll ? '' : 'none';
  if(hint) hint.style.display = viewAll ? '' : 'none';
}

function initBcUnitSwitcher(){
  if(bcUnitSwitcherBound) return;
  const tabs = document.getElementById('bcHeaderUnitTabs');
  if(!tabs) return;
  tabs.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-unit]');
    if(!btn) return;
    e.preventDefault();
    void setBcViewUnit(btn.getAttribute('data-unit'));
  });
  bcUnitSwitcherBound = true;
}

async function renderBcUnitSwitcher(){
  const bar = document.getElementById('bcHeaderUnitSwitcher');
  const tabs = document.getElementById('bcHeaderUnitTabs');
  if(!bar || !tabs) return;
  if(!shouldShowBcUnitSwitcher()){
    bar.style.display = 'none';
    updateBcEditMode();
    return;
  }
  await loadBcMasterUnitsCache();
  let items;
  if(bcIsSuperAdmin || bcIsAdmin){
    const units = bcMasterUnitsCache.map((u)=>u.name);
    items = [{ id:'all', label:'Alle Units' }, ...units.map((n)=>({ id:n, label:n }))];
  }else{
    items = bcUserUnits.map((n)=>({ id:n, label:n }));
  }
  bar.style.display = 'flex';
  tabs.innerHTML = items.map((item)=>
    `<button type="button" class="header-unit-tab${bcViewUnit===item.id?' active':''}" data-unit="${escAttr(item.id)}" role="tab" aria-selected="${bcViewUnit===item.id}">${esc(item.label)}</button>`
  ).join('');
  updateBcEditMode();
}

async function syncPlanMetaFromContext(){
  const unit = getBcSaveUnit();
  const oldMeta = (plan && plan.meta) ? plan.meta : {};
  if(!unit){
    plan.meta = { ...oldMeta };
    return;
  }
  let unitLeadName = bcSessionUser?.name || '';
  let unitLeadMail = bcSessionUser?.email || '';
  try{
    const res = await fetch('/api/auth/unit-context?unit='+encodeURIComponent(unit), { credentials:'same-origin' });
    if(res.ok){
      const ctx = await res.json();
      if(ctx.unitLead?.name) unitLeadName = ctx.unitLead.name;
      if(ctx.unitLead?.email) unitLeadMail = ctx.unitLead.email;
    }
  }catch(_e){ /* ignore */ }
  const today = new Date().toISOString().slice(0,10);
  plan.meta = {
    ...oldMeta,
    bereich: unit,
    unit,
    leiter: unitLeadName,
    mail: unitLeadMail,
    datum: oldMeta.datum || today,
    splitRatio: oldMeta.splitRatio || 60,
  };
}

async function setBcViewUnit(unit){
  bcViewUnit = unit || 'all';
  rcViewUnitPersist?.writePersistedViewUnit?.(bcViewUnit);
  updateBcEditMode();
  await renderBcUnitSwitcher();
  if(isBcViewAll()){
    plan = { meta:{}, measures:{} };
    initSelectors();
    refreshActiveBcTab();
    return;
  }
  await loadPlanFromApi();
  await syncPlanMetaFromContext();
  initSelectors();
  refreshActiveBcTab();
}

function uid(){return 'm'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1900)}
function esc(s){return (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function catId(g){return g.workstream+'||'+g.kategorie}

/* ---------- init ---------- */
function initPlanState() {
  plan = { meta: {}, measures: {} };
}

function planHasMeasures(payload) {
  const measures = payload?.measures || {};
  return Object.values(measures).some((list) => Array.isArray(list) && list.length > 0);
}

function maybeMigrateLocalPlan() {
  try {
    if (localStorage.getItem(LS_PLAN_MIGRATED)) return false;
    const raw = localStorage.getItem(LS_PLAN);
    if (!raw) return false;
    const local = JSON.parse(raw);
    if (!local || !planHasMeasures(local)) return false;
    plan = {
      meta: local.meta && typeof local.meta === "object" ? local.meta : {},
      measures: local.measures && typeof local.measures === "object" ? local.measures : {},
    };
    if (!plan.measures) plan.measures = {};
    localStorage.setItem(LS_PLAN_MIGRATED, "1");
    localStorage.removeItem(LS_PLAN);
    toast("Plan aus lokalem Browser-Speicher übernommen – wird auf den Server gespeichert …");
    return true;
  } catch (_err) {
    return false;
  }
}

async function savePlan(options = {}) {
  const allowIncomplete = Boolean(options.allowIncomplete);
  const silent = Boolean(options.silent);
  if (isBcViewAll()) return false;
  if (!requireBcSaveUnit()) return false;
  await syncPlanMetaFromContext();
  if (!allowIncomplete && findMilestonesMissingErgebnis().length) {
    if (!silent) toast("Bitte bei allen Meilensteinen „Bezeichnung“ und „Beschreibung“ ausfüllen.", "#e74c3c");
    return false;
  }
  const unit = getBcSaveUnit();
  if (!unit) return false;
  try {
    const res = await fetch("/api/backcasting/plan", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unit,
        meta: plan.meta,
        measures: plan.measures,
        is_demo: Boolean(plan.meta?.is_demo),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (!silent) toast(body.error || "Speichern fehlgeschlagen", "#e74c3c");
      return false;
    }
    return true;
  } catch (_e) {
    if (!silent) toast("Speichern fehlgeschlagen", "#e74c3c");
    return false;
  }
}

async function loadPlanFromApi() {
  const unit = getBcSaveUnit();
  if (!unit) return false;
  try {
    const res = await fetch("/api/backcasting/plan?unit=" + encodeURIComponent(unit), {
      credentials: "same-origin",
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.plan) {
      if (maybeMigrateLocalPlan()) {
        await syncPlanMetaFromContext();
        await savePlan({ allowIncomplete: true, silent: true });
        return true;
      }
      plan = { meta: {}, measures: {} };
      await syncPlanMetaFromContext();
      return true;
    }
    plan.meta = data.plan.meta || {};
    plan.measures = data.plan.measures || {};
    if (data.plan.is_demo) plan.meta.is_demo = true;
    else if (plan.meta) delete plan.meta.is_demo;
    await syncPlanMetaFromContext();
    return true;
  } catch (_e) {
    return false;
  }
}

/* ---------- selectors ---------- */
function initSelectors(){
  const wss=typeof workstreams==='function'?workstreams():[];

  const lpWs=document.getElementById('lpWs');
  if(lpWs) lpWs.innerHTML='<option value="">Alle</option>'+wss.map(w=>'<option>'+esc(w)+'</option>').join('');

  if(typeof initGuidelineSelectors==='function') initGuidelineSelectors();

  if(document.getElementById('lpTable')) renderLeitplanken();
}

function milestoneTitle(entry) {
  const bez = String(entry?.bezeichnung || "").trim();
  if (bez) {
    return bez.length <= 96 ? bez : bez.slice(0, 93) + "…";
  }
  const text = String(entry?.ergebnis || "").trim();
  if (!text) return "Neuer Meilenstein";
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length <= 96) return firstLine;
  return firstLine.slice(0, 93) + "…";
}

function findMilestonesMissingErgebnis() {
  const missing = [];
  Object.values(plan?.measures || {}).forEach((val) => {
    const arr = Array.isArray(val) ? val : val ? [val] : [];
    arr.forEach((entry, idx) => {
      if (entry?.kind === "wsYear" && (!String(entry.bezeichnung || "").trim() || !String(entry.ergebnis || "").trim())) {
        missing.push({ entry, idx });
      }
    });
  });
  return missing;
}

/* ---------- leitplanken view ---------- */
function renderLeitplanken(){
  const ws=(document.getElementById('lpWs')?.value)||'';
  const pr=(document.getElementById('lpPrio')?.value)||'';
  const q=((document.getElementById('lpSearch')?.value)||'').toLowerCase();
  const tb=document.querySelector('#lpTable tbody');
  if(!tb) return;
  tb.innerHTML='';
  guidelines.filter(g=>(!ws||g.workstream===ws)&&(!pr||g.prioritaet===pr)&&(!q||JSON.stringify(g).toLowerCase().includes(q)))
  .forEach(g=>{
    const tr=document.createElement('tr');
    tr.innerHTML='<td><span class="badge '+(g.prioritaet||'empty')+'">'+(g.prioritaet||'–')+'</span></td>'+
      '<td>'+esc(g.workstream)+'</td><td><b>'+esc(g.kategorie)+'</b></td>'+
      '<td>'+esc(g.leitfrage)+'</td><td>'+esc(g.festlegung)+'</td><td>'+esc(g.zielwert)+'</td><td>'+esc(g.verantwortlich)+'</td>';
    tb.appendChild(tr);
  });
}

/* ---------- Planungsstatus (ehem. Review) ---------- */
let _p1OverviewModel = null;
let reviewSelected = {area:null, year:null};

const REVIEW_TILE_IDS = { portfolio:'rvPortfolio', gliederungen:'rvGliederungen', rollen:'rvRollen', mitarbeiter:'rvMitarbeiter' };

function renderReviewTiles(model){
  model.forEach(area=>{
    const tileId = REVIEW_TILE_IDS[area.key];
    if(!tileId) return;
    const numEl = document.getElementById(tileId);
    const subEl = document.getElementById(tileId+'Sub');
    const total = area.items.length;
    if(numEl) numEl.textContent = total ? (area.fullyPlanned+' / '+total) : '–';
    if(subEl) subEl.textContent = total ? 'vollständig geplant · alle Jahre' : 'keine Basis in Phase 1';
    const card = numEl?.closest('.stat-card');
    if(card){
      card.classList.toggle('bc-stat-empty', !total);
      card.classList.toggle('bc-stat-warn', area.mandatory && total>0 && area.fullyPlanned<total);
    }
  });
}

function reviewCellClass(state, hasBasis){
  if(!hasBasis) return 'c-grey';
  if(state.planned===0) return 'c-red';
  if(state.planned===state.total) return 'c-green';
  return 'c-amber';
}

function selectReviewCell(areaKey, year){ reviewSelected = {area:areaKey, year:year}; renderReviewDrill(); }

function renderReviewMatrix(model){
  const box = document.getElementById('reviewTable'); if(!box) return;
  let h='<thead><tr><th>Bereich</th>'+YEARS.map(y=>'<th style="text-align:center">'+y+'</th>').join('')+'</tr></thead><tbody>';
  model.forEach(area=>{
    const hasBasis = area.items.length>0;
    h+='<tr><td><b>'+esc(area.label)+'</b>'+(area.mandatory ? ' <span class="bc-muted" style="font-size:.7rem">(Pflicht)</span>' : '')+'</td>';
    YEARS.forEach(year=>{
      const st = area.yearTotals[year];
      const cls = reviewCellClass(st, hasBasis);
      const pct = st.total ? Math.round((st.planned/st.total)*100) : 0;
      const sub = hasBasis ? (st.planned+'/'+st.total+' geplant') : 'keine Basis';
      h += '<td><div class="review-cellbox '+cls+'" onclick="selectReviewCell(\''+area.key+'\','+year+')">'+
           '<div class="review-cell-top"><div class="review-count">'+(hasBasis ? pct+'%' : '–')+'</div></div>'+
           '<div class="review-cell-sub">'+sub+'</div></div></td>';
    });
    h+='</tr>';
  });
  h+='</tbody>';
  box.innerHTML=h;
  if(!reviewSelected.area && model.length) reviewSelected = {area:model[0].key, year:YEARS[0]};
}

function renderReviewDrill(){
  const box = document.getElementById('reviewDrill'); const title = document.getElementById('reviewDrillTitle');
  if(!box || !title) return;
  const area = (_p1OverviewModel||[]).find(a=>a.key===reviewSelected.area);
  const year = reviewSelected.year;
  if(!area || !year){ title.textContent = 'Wähle eine Zelle in der Matrix.'; box.innerHTML=''; return; }
  if(!area.items.length){
    title.textContent = area.label+' · '+year;
    box.innerHTML = '<div class="bc-muted">Keine Phase-1-Einträge für diesen Bereich – nichts zu planen.</div>';
    return;
  }
  const mode = (document.getElementById('reviewOpenFilter')||{}).value || 'open';
  const rows = area.items.filter(it=>{
    const st = it.years[year];
    if(mode==='open') return !st.complete;
    if(mode==='done') return st.complete;
    return true;
  });
  title.textContent = area.label+' · '+year+' · '+rows.length+' Eintrag(e)';
  if(!rows.length){ box.innerHTML = '<div class="bc-muted">Keine passenden Einträge in dieser Auswahl.</div>'; return; }
  box.innerHTML = rows.map(it=>{
    const st = it.years[year];
    const cls = st.complete ? 'green' : 'red';
    const label = area.key==='mitarbeiter'
      ? (st.complete ? 'vollständig' : st.filled+'/'+st.total+' Skills')
      : (st.complete ? 'geplant' : 'noch offen');
    return '<div class="review-mile"><div class="review-mile-head"><div><div class="review-mile-title">'+esc(it.label)+'</div></div><span class="review-pill '+cls+'">'+label+'</span></div></div>';
  }).join('');
}

function renderReviewMandatoryChecklist(model){
  const box = document.getElementById('reviewMandatory'); if(!box) return;
  const area = model.find(a=>a.key==='mitarbeiter');
  if(!area || !area.items.length){
    box.innerHTML = '<div class="bc-muted">Keine Mitarbeiter-Skillprofile aus Phase 1 gefunden.</div>';
    return;
  }
  const openCount = area.items.length - area.fullyPlanned;
  const rows = area.items.map(it=>{
    const cells = YEARS.map(yr=>{
      const st = it.years[yr];
      const cls = st.complete ? 'green' : 'red';
      const label = st.complete ? '✓' : (st.filled+'/'+st.total);
      return '<td><span class="review-pill '+cls+'">'+label+'</span></td>';
    }).join('');
    return '<tr><td>'+esc(it.label)+'</td>'+cells+'</tr>';
  }).join('');
  box.innerHTML =
    '<p class="bc-muted" style="margin-bottom:.65rem">'+(openCount
      ? '<b>'+openCount+'</b> von '+area.items.length+' Mitarbeitern haben noch nicht für alle Jahre vollständig bewertete Skills.'
      : 'Alle '+area.items.length+' Mitarbeiter sind für alle Planjahre vollständig bewertet.')+'</p>'+
    '<div class="tbl-wrap"><table class="entries matrix"><thead><tr><th>Mitarbeiter</th>'+YEARS.map(y=>'<th style="text-align:center">'+y+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}

async function renderReview(){
  const notice = document.getElementById('reviewUnitNotice');
  if(isBcViewAll()){
    if(notice) notice.style.display='';
    ['reviewTable','reviewDrill','reviewMandatory'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=''; });
    const title = document.getElementById('reviewDrillTitle'); if(title) title.textContent = 'Wähle eine Zelle in der Matrix.';
    return;
  }
  if(notice) notice.style.display='none';
  const ok = await ensureP1OverviewDataLoaded();
  if(!ok) return;
  _p1OverviewModel = buildP1OverviewModel();
  renderReviewTiles(_p1OverviewModel);
  renderReviewMatrix(_p1OverviewModel);
  renderReviewDrill();
  renderReviewMandatoryChecklist(_p1OverviewModel);
}

/* ---------- export ---------- */
function dl(name,content,type){const b=new Blob([content],{type});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u)}
function exportJson(){const slug=(plan.meta?.unit||plan.meta?.bereich||'plan').replace(/\s+/g,'_');dl('backcasting_plan_'+slug+'.json',JSON.stringify({meta:plan.meta,guidelines,measures:plan.measures},null,2),'application/json');toast('JSON exportiert')}
function exportCsv(){
  const cols=['workstream','jahr','planIndex','bezeichnung','ergebnis','kpis','voraussetzungen','abhaengigkeiten','risiken','verantwortlich'];
  let rows=[cols.join(';')];
  Object.entries(plan.measures).forEach(([k,v])=>{
    if(!v) return;
    const arr = Array.isArray(v) ? v : [v];
    arr.forEach((m, idx)=>{
      if(!m || m.kind!=='wsYear') return;
      const rowObj = {...m, planIndex: (idx+1)};
      rows.push(cols.map(c=>'"'+String(rowObj[c]==null?'':rowObj[c]).replace(/"/g,'""')+'"').join(';'));
    });
  });
  dl('backcasting_workstream_plan_'+(plan.meta?.unit||plan.meta?.bereich||'plan').replace(/\s+/g,'_')+'.csv','\ufeff'+rows.join('\n'),'text/csv');toast('CSV exportiert')
}

function importJson(){
  const f=document.getElementById('jsonImport').files[0];if(!f){toast('Bitte JSON wählen');return}
  const r=new FileReader();r.onload=e=>{try{const d=JSON.parse(e.target.result);
    if(d.meta)plan.meta=d.meta; if(d.measures)plan.measures=d.measures; if(d.guidelines)guidelines=d.guidelines;
    void syncPlanMetaFromContext().then(()=>{saveGuide();savePlan();initSelectors();document.getElementById('expStat').textContent='✓ Import erfolgreich';toast('Import erfolgreich')});
  }catch(err){toast('JSON-Fehler: '+err.message)}};r.readAsText(f)
}

/* ---------- klickbare Erklärungs-Popups (Review-KPI, Qualität je WS, …) ---------- */
function closeBcTipPopovers(exceptCard) {
  document.querySelectorAll('.bc-has-tip').forEach((card) => {
    if (exceptCard && card === exceptCard) return;
    card.classList.remove('bc-tip-open');
    card.setAttribute('aria-expanded', 'false');
  });
}

function initBcTipPopovers() {
  const cards = document.querySelectorAll('.bc-has-tip');
  if (!cards.length) return;

  cards.forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.bc-stat-tip-close')) return;
      if (e.target.closest('.bc-stat-tooltip') && card.classList.contains('bc-tip-open')) {
        e.stopPropagation();
        return;
      }
      const open = card.classList.contains('bc-tip-open');
      closeBcTipPopovers();
      if (!open) {
        card.classList.add('bc-tip-open');
        card.setAttribute('aria-expanded', 'true');
      }
      e.stopPropagation();
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
      if (e.key === 'Escape') closeBcTipPopovers();
    });

    card.querySelector('.bc-stat-tip-close')?.addEventListener('click', (e) => {
      closeBcTipPopovers();
      e.stopPropagation();
    });
  });

  document.addEventListener('click', () => closeBcTipPopovers());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeBcTipPopovers();
  });
}

initBcTipPopovers();

/* ---------- tabs ---------- */
document.querySelectorAll("#bcTabs .tab").forEach(function (b) {
  b.onclick = function () { activateBcTab(b.dataset.tab); };
});
activateBcTab(readPersistedBcTab(), { skipPersist: true, skipSideEffects: true });

/* boot */
initPlanState();

async function bootBackcastingPlan(me) {
  try {
    const resp = await fetch("/api/config/planning-years", { credentials: "include" });
    if (resp.ok) {
      const cfg = await resp.json();
      if (Array.isArray(cfg.years) && cfg.years.length) YEARS = cfg.years;
    }
  } catch (_e) { /* keep default YEARS */ }
  if (typeof loadGuideState === "function") await loadGuideState();
  initBcSessionFromDetail(me);
  initBcUnitSwitcher();
  const persisted = rcViewUnitPersist?.readPersistedViewUnit?.() || "";
  bcViewUnit =
    rcViewUnitPersist?.resolveViewUnitForSession?.(persisted, {
      isSuperAdmin: bcIsSuperAdmin,
      isAdmin: bcIsAdmin,
      userUnits: bcUserUnits,
      currentUnit: bcUserUnit,
    }) ??
    (() => {
      if (bcIsSuperAdmin || bcIsAdmin) return "all";
      if (bcUserUnits.length === 1) return bcUserUnits[0];
      if (bcUserUnits.length > 1) return bcUserUnit || bcUserUnits[0];
      return bcUserUnit || "";
    })();
  rcViewUnitPersist?.writePersistedViewUnit?.(bcViewUnit);
  await renderBcUnitSwitcher();
  if (!isBcViewAll()) {
    await loadPlanFromApi();
    await syncPlanMetaFromContext();
  } else {
    plan = { meta: {}, measures: {} };
  }
  initSelectors();
  const cs = document.getElementById("csvStatus");
  if (cs) cs.textContent = "✓ " + guidelines.length + " Leitplanken aktiv";
  refreshActiveBcTab();
}

document.addEventListener('rc-backcasting-ready', (e)=>void bootBackcastingPlan(e.detail));
if(document.body.dataset.rcUserUnit) void bootBackcastingPlan(null);
window.addEventListener('error', function(e){
  const msg = 'JS-Fehler: ' + (e && e.message ? e.message : 'Unbekannter Fehler');
  const cs=document.getElementById('csvStatus'); if(cs) cs.textContent=msg;
  console.error(e);
});
