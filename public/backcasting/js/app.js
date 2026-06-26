console.log("APP_BOOT", new Date().toISOString());
window.__APP_BOOTED__ = true;
const YEARS=[2026,2027,2028,2029];
const TYPES=["Produkt","Service","Lösung","Organisation","Skill","Sales","Partner","Tech"];
const STATUSES=["Geplant","In Arbeit","Abgeschlossen","Blockiert"];
const LS_PLAN = "rc_bc_plan";
const LS_PLAN_MIGRATED = "rc_bc_plan_migrated";

let plan = { meta: {}, measures: {} }, currentCat = null;
let bcUserUnit = '';
let bcViewUnit = '';
let bcUserUnits = [];
let bcSessionUser = null;
let bcIsSuperAdmin = false;
let bcIsAdmin = false;
let bcMasterUnitsCache = [];
let bcUnitSwitcherBound = false;

function escAttr(s){return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}

const BC_SVG_SAVE =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
const BC_SVG_TRASH =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
const BC_SVG_CHEVRON =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
const BC_SVG_EDIT =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

let milestoneModalCtx = null;

function bcMsIconBtn(className, title, onclick, svg, id) {
  const idAttr = id ? ` id="${id}"` : "";
  return (
    `<button type="button" class="bc-ms-icon-btn ${className} no-print"${idAttr}` +
    ` title="${escAttr(title)}" aria-label="${escAttr(title)}" onclick="${onclick}">${svg}</button>`
  );
}

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
    return;
  }
  await loadPlanFromApi();
  await syncPlanMetaFromContext();
  initSelectors();
}

function uid(){return 'm'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1900)}
function esc(s){return (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function catId(g){return g.workstream+'||'+g.kategorie}
function wsId(ws){return 'WS||'+ws}

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
    if (!silent) toast("Bitte bei allen Meilensteinen „Ergebnis / Artefakt“ ausfüllen.", "#e74c3c");
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

async function saveMilestone(ws, yr, idx){
  if(isBcViewAll()) return;
  if(!requireBcSaveUnit()) return;
  const entries=getWsEntries(ws, yr);
  const entry=entries[idx];
  if(!entry) return;
  const mid='ms_'+yr+'_'+idx;
  const field=document.getElementById(mid+'_ergebnis');
  if(!String(entry.ergebnis||'').trim()){
    toast('„Ergebnis / Artefakt“ ist ein Pflichtfeld.', '#e74c3c');
    document.getElementById(mid)?.classList.remove('closed');
    field?.classList.add('bc-input-invalid');
    field?.focus();
    return;
  }
  field?.classList.remove('bc-input-invalid');
  const ok = await savePlan();
  if(ok) toast('Gespeichert');
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

  // Leitplanken Ansicht (read-only)
  const lpWs=document.getElementById('lpWs');
  if(lpWs) lpWs.innerHTML='<option value="">Alle</option>'+wss.map(w=>'<option>'+esc(w)+'</option>').join('');

  if(typeof initGuidelineSelectors==='function') initGuidelineSelectors();

  // Planung (Workstream Dropdown)
  const planWs=document.getElementById('planWs');
  const planWsTop=document.getElementById('planWsTop');
  const opts = wss.map(w=>'<option value="'+esc(w)+'">'+esc(w)+'</option>').join('');
  if(planWs) planWs.innerHTML=opts;
  if(planWsTop) planWsTop.innerHTML=opts;

  // auto-select first workstream and render immediately
  if(wss.length){
    if(planWs) planWs.value = wss[0];
    if(planWsTop) planWsTop.value = wss[0];
  }

  if(document.getElementById('lpTable')) renderLeitplanken();

  const wsSel = (planWsTop && planWsTop.value) ? planWsTop.value : (planWs ? planWs.value : '');
  if(wsSel) {
    currentCat = wsId(wsSel);
    renderWsDetail(wsSel);
    updateWsHeader(wsSel);
  }

  if(document.getElementById('reviewTable')) renderReview();
}

/* ---------- leitplanken view ---------- */
function syncWsFromTop(){
  onWsChange();
}

function updateWsHeader(ws){
  // Workstream-Name wird nicht mehr separat angezeigt.
  const cnt = ws ? Object.values(plan.measures).flat().filter(m=>m && m.workstream===ws).length : 0;

  // Falls noch vorhanden (oben), ausblenden/aktualisieren – primär wird unten im Erfassungs-Header angezeigt.
  const cntTop=document.getElementById('wsTopCount');
  if(cntTop){
    cntTop.textContent = cnt + ' Einträge';
    cntTop.style.display='none';
  }

  const cntIn=document.getElementById('wsEntryCount');
  if(cntIn) cntIn.textContent = cnt + ' Einträge';
}

function onWsChange(){
  // falls Leitplanken-Pflege offen ist, Editor refreshen
  if(document.getElementById('gpTable')) renderGuidelineEditor();
  const top=document.getElementById('planWsTop');
  const dd=document.getElementById('planWs');
  const wsSel = (top && top.value) ? top.value : (dd ? dd.value : '');

  if(dd && wsSel) dd.value = wsSel;
  if(top && wsSel) top.value = wsSel;

  currentCat = wsSel ? wsId(wsSel) : null;
  updateWsHeader(wsSel);

  // Erfassung + Leitplanken sofort umschalten
  if(wsSel) {
    renderWsDetail(wsSel);
    updateWsHeader(wsSel);
  }
}

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

/* ---------- planung ---------- */
function catsForWs(ws){return guidelines.filter(g=>g.workstream===ws)}
function measuresFor(cid){return (plan.measures[cid]||[])}

function renderCatList(){
  // UI wurde umgestellt: keine separate Leitplanken-Übersicht mehr nötig.
  return;
}

function renderWsDetail(ws){
  const wid=wsId(ws);
  // show all guidelines for this workstream
  const gs=guidelines.filter(g=>g.workstream===ws);
  const prioCounts = {H:0,M:0,N:0};
  gs.forEach(g=>{const p=(g.prioritaet||''); if(prioCounts[p]!=null) prioCounts[p]++});

  let h='<div class="ws-split" id="wsSplit">'+
    '<div class="ws-left ws-plan" id="wsLeft">'+
      '<h3 style="margin-top:0;color:var(--rc-accent2)">Erfassung / Backcasting je Jahr (2026 → 2029) <span class="bc-tag" id="wsEntryCount">0 Einträge</span></h3>';


  YEARS.forEach((yr,idx)=>{
    const entries = getWsEntries(ws, yr);
    h+='<div class="acc'+(idx===0?' open':'')+'" data-yr="'+yr+'">'+
      '<div class="acc-head" onclick="this.parentNode.classList.toggle(\'open\')">'+
        '<span class="yr">'+yr+'</span><span class="bc-muted">'+(entries.length? (entries.length+' Meilenstein(e)') : 'leer')+'</span>'+
      '</div>'+
      '<div class="acc-body">'+
        wsYearForm(ws, yr)+
      '</div>'+
    '</div>';
  });

  h+='</div>'+
    '<div class="ws-resize" id="wsResize" title="Ziehe, um die Breite anzupassen"></div>'+
    '<div class="ws-right vorgabe" id="wsRight" style="margin:0">'+
      '<div class="lf">Workstream-Leitplanke: '+esc(ws)+'</div>'+
      '<div class="bc-muted">Diese Leitplanke besteht aus '+gs.length+' Vorgaben (H: '+prioCounts.H+', M: '+prioCounts.M+', N: '+prioCounts.N+').</div>'+
      '<div class="tbl-wrap" style="margin-top:.65rem;max-height:60vh">'+
        '<table class="entries"><thead><tr><th>Kategorie</th><th>Prio</th><th>Festlegung</th><th>Zielwert</th></tr></thead><tbody>'+
        gs.map(g=>'<tr><td><b>'+esc(g.kategorie)+'</b></td><td><span class="badge '+(g.prioritaet||'empty')+'">'+(g.prioritaet||'–')+'</span></td><td>'+esc(g.festlegung)+'</td><td>'+esc(g.zielwert)+'</td></tr>').join('')+
        '</tbody></table>'+
      '</div>'+
    '</div>'+
  '</div>';
  document.getElementById('planDetail').innerHTML=h;
  initSplitter();
}

function getWsEntries(ws, yr){
  const key = wsId(ws)+'||'+yr;
  const v = plan.measures[key];
  if(!v) return [];
  return Array.isArray(v) ? v : [v];
}

function setWsEntries(ws, yr, arr) {
  if (!requireBcSaveUnit()) return;
  const key = wsId(ws) + "||" + yr;
  plan.measures[key] = arr;
}

function initSplitter(){
  const resize=document.getElementById('wsResize');
  const left=document.getElementById('wsLeft');
  const right=document.getElementById('wsRight');
  if(!resize||!left||!right) return;

  // restore ratio from plan.meta (in-memory) if present
  const saved = plan?.meta?.splitRatio;
  if(saved && typeof saved==='number'){
    left.style.flex = `0 0 ${Math.max(35, Math.min(80, saved))}%`;
    right.style.flex = `1 1 ${100 - Math.max(35, Math.min(80, saved))}%`;
  }

  let dragging=false;
  const onDown=(e)=>{dragging=true; document.body.style.cursor='col-resize'; e.preventDefault();};
  const onUp=()=>{if(!dragging) return; dragging=false; document.body.style.cursor='';
    // persist ratio
    const total = left.getBoundingClientRect().width + right.getBoundingClientRect().width + resize.getBoundingClientRect().width;
    if(total>0){
      const pct = (left.getBoundingClientRect().width / total) * 100;
      plan.meta = plan.meta || {};
      plan.meta.splitRatio = pct;
      savePlan({ allowIncomplete: true });
    }
  };
  const onMove=(e)=>{
    if(!dragging) return;
    const container=document.getElementById('wsSplit');
    const rect=container.getBoundingClientRect();
    const x = (e.touches? e.touches[0].clientX : e.clientX);
    let pct = ((x - rect.left) / rect.width) * 100;
    pct = Math.max(35, Math.min(80, pct));
    left.style.flex = `0 0 ${pct}%`;
    right.style.flex = `1 1 ${100-pct}%`;
  };

  resize.onmousedown=onDown;
  resize.ontouchstart=onDown;
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, {passive:false});
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchend', onUp);
}

function toggleMs(id){
  const el=document.getElementById(id);
  if(!el) return;
  el.classList.toggle('closed');
  const btn=document.getElementById(id+'_toggle');
  if(!btn) return;
  const collapsed=el.classList.contains('closed');
  btn.classList.toggle('is-expanded', !collapsed);
  const label=collapsed ? 'Aufklappen' : 'Zuklappen';
  btn.title=label;
  btn.setAttribute('aria-label', label);
}

function wsYearForm(ws, yr){
  const entries = getWsEntries(ws, yr);

  let h='<div class="bc-muted">Du kannst pro Jahr mehrere Meilensteine erfassen (z. B. mehrere Artefakte oder Initiativen in diesem Workstream).</div>';
  h+='<div class="row" style="margin:8px 0" class="no-print">'+
     '<button class="btn btn-sm btn-primary" onclick="addWsEntry(\''+esc(ws).replace(/'/g,'')+'\','+yr+')">+ Meilenstein hinzufügen</button>'+
     '</div>';

  if(!entries.length){
    h+='<p class="bc-muted">Noch kein Meilenstein für '+yr+'.</p>';
  }

  entries.forEach((e, idx)=>{
    const wsJs=esc(ws).replace(/'/g,"\\'");
    const mid = 'ms_'+yr+'_'+idx;
    const title=milestoneTitle(e);
    const titleClass=(e.ergebnis||'').trim()?'ms-title':'ms-title ms-title--empty';
    const isDraft=idx===0 && !(e.ergebnis||'').trim();
    const wsArg="'"+esc(ws).replace(/'/g,"\\'")+"'";

    if(isDraft){
      const oc=(field)=>`onchange="updWs('${wsJs}',${yr},${idx},'${field}',this.value)"`;
      h += '<div class="measure">'+
        '<div class="bc-flex-between measure-head" style="cursor:pointer" onclick="toggleMs(\''+mid+'\')">'+
          '<b class="'+titleClass+'" id="'+mid+'_title">'+esc(title)+'</b>'+
          '<div class="ms-actions" onclick="event.stopPropagation()">'+
            bcMsIconBtn('bc-ms-icon-btn--save', 'Speichern', "saveMilestone("+wsArg+","+yr+","+idx+")", BC_SVG_SAVE)+
            bcMsIconBtn('bc-ms-icon-btn--delete', 'Löschen', "delWsEntry('"+esc(ws).replace(/'/g,'')+"',"+yr+","+idx+")", BC_SVG_TRASH)+
            bcMsIconBtn('bc-ms-icon-btn--toggle is-expanded', 'Zuklappen', "toggleMs('"+mid+"')", BC_SVG_CHEVRON, mid+'_toggle')+
          '</div>'+
        '</div>'+
        '<div id="'+mid+'" class="ms-body">'+
          renderMilestoneFormFields(ws, yr, idx, e, mid, true)+
        '</div>'+
      '</div>';
      return;
    }

    h += '<div class="measure measure--compact">'+
      '<div class="bc-flex-between measure-head">'+
        '<b class="'+titleClass+'">'+esc(title)+'</b>'+
        '<div class="ms-actions">'+
          bcMsIconBtn('bc-ms-icon-btn--edit', 'Bearbeiten', "openMilestoneEditModal("+wsArg+","+yr+","+idx+")", BC_SVG_EDIT)+
          bcMsIconBtn('bc-ms-icon-btn--delete', 'Löschen', "delWsEntry('"+esc(ws).replace(/'/g,'')+"',"+yr+","+idx+")", BC_SVG_TRASH)+
        '</div>'+
      '</div>'+
    '</div>';
  });

  return h;
}

function renderMilestoneFormFields(ws, yr, idx, e, idPrefix, live){
  const wsJs=esc(ws).replace(/'/g,"\\'");
  const oc=(field)=>live?`onchange="updWs('${wsJs}',${yr},${idx},'${field}',this.value)"`:'';
  const ergebnisLive=live?` oninput="updWs('${wsJs}',${yr},${idx},'ergebnis',this.value)"`:'';
  const fid=(name)=>idPrefix+'_'+name;
  return ''+
    '<div class="field">'+tipRequired('1. Ergebnis / Artefakt (Was muss existieren?)','Beschreibe konkrete deliverables, die bis Jahresende existieren müssen (z. B. Offering, Playbook, Governance, Pilot, Asset, Board-Entscheidung). Name erscheint als Meilenstein-Titel.')+
      '<textarea id="'+fid('ergebnis')+'" class="bc-ms-required" required'+ergebnisLive+' '+oc('ergebnis')+'>'+esc(e.ergebnis||'')+'</textarea></div>'+
    '<div class="field">'+tip('2. Messbare KPIs (Woran messen wir Erfolg?)','Nenne messbare Kennzahlen für dieses Jahr (z. B. #Piloten, %Reuse, Recurring-Anteil, #Zertifizierungen, Marge).')+
      '<textarea id="'+fid('kpis')+'" '+oc('kpis')+'>'+esc(e.kpis||'')+'</textarea></div>'+
    '<div class="field">'+tip('3. Voraussetzungen (Was muss vorher passieren?)','Liste Voraussetzungen, die vorher erfüllt sein müssen (Budgetfreigabe, Rollenbesetzung, Trainings, Tooling, Entscheidungsgremien).')+
      '<textarea id="'+fid('voraussetzungen')+'" '+oc('voraussetzungen')+'>'+esc(e.voraussetzungen||'')+'</textarea></div>'+
    '<div class="field">'+tip('4. Abhängigkeiten (Welche anderen Streams?)','Welche anderen Workstreams/Teams müssen liefern, damit das klappt? (z. B. Partner, Organisation, Skills).')+
      '<textarea id="'+fid('abhaengigkeiten')+'" '+oc('abhaengigkeiten')+'>'+esc(e.abhaengigkeiten||'')+'</textarea></div>'+
    '<div class="field">'+tip('5. Risiken / Blocker (Was könnte scheitern?)','Beschreibe Risiken/Blocker und ggf. Gegenmaßnahmen. Beispiel: fehlende Skills, zu wenig Kapazität, keine Referenzkunden.')+
      '<textarea id="'+fid('risiken')+'" '+oc('risiken')+'>'+esc(e.risiken||'')+'</textarea></div>'+
    '<div class="field">'+tip('6. Verantwortlich (Wer treibt das Thema?)','Wer ist accountable in diesem Jahr? Nenne Rolle/Person und ggf. Mitwirkende.')+
      '<input id="'+fid('verantwortlich')+'" '+oc('verantwortlich')+' value="'+esc(e.verantwortlich||'')+'"></div>'+
    renderStructuredTargets(ws, yr, idx, e, idPrefix, live);
}

function openMilestoneEditModal(ws, yr, idx){
  const entries=getWsEntries(ws, yr);
  const e=entries[idx];
  if(!e) return;
  milestoneModalCtx={ ws, yr, idx };
  const overlay=document.getElementById('bcMilestoneEdit');
  const body=document.getElementById('bcMilestoneEditBody');
  const titleEl=document.getElementById('bcMilestoneEditTitle');
  if(!overlay||!body) return;
  if(titleEl) titleEl.textContent=milestoneTitle(e)+' · '+yr;
  body.innerHTML=renderMilestoneFormFields(ws, yr, idx, e, 'bcMilestoneEdit', false);
  overlay.style.display='flex';
  document.getElementById('bcMilestoneEdit_ergebnis')?.focus();
}

function closeMilestoneEditModal(){
  const overlay=document.getElementById('bcMilestoneEdit');
  if(overlay) overlay.style.display='none';
  milestoneModalCtx=null;
}

function readMilestoneFormValues(idPrefix){
  const val=(name)=>document.getElementById(idPrefix+'_'+name)?.value ?? '';
  const num=(name)=>{
    const raw=val(name).trim();
    if(!raw) return null;
    const n=/prozent|level/.test(name)?parseInt(raw,10):parseFloat(raw.replace(',','.'));
    return Number.isFinite(n)?n:null;
  };
  return {
    ergebnis: val('ergebnis'),
    kpis: val('kpis'),
    voraussetzungen: val('voraussetzungen'),
    abhaengigkeiten: val('abhaengigkeiten'),
    risiken: val('risiken'),
    verantwortlich: val('verantwortlich'),
    ziel_quartal: val('ziel_quartal'),
    ziel_skill_kategorie: val('ziel_skill_kategorie'),
    ziel_umsatz_teur: num('ziel_umsatz_teur'),
    ziel_headcount: num('ziel_headcount'),
    ziel_skill_level_min: num('ziel_skill_level_min'),
    ziel_anteil_prozent: num('ziel_anteil_prozent'),
  };
}

async function saveMilestoneEditModal(){
  if(!milestoneModalCtx) return;
  const { ws, yr, idx }=milestoneModalCtx;
  const entries=getWsEntries(ws, yr);
  const e=entries[idx];
  if(!e) return;
  const values=readMilestoneFormValues('bcMilestoneEdit');
  if(!String(values.ergebnis||'').trim()){
    toast('„Ergebnis / Artefakt“ ist ein Pflichtfeld.', '#e74c3c');
    document.getElementById('bcMilestoneEdit_ergebnis')?.classList.add('bc-input-invalid');
    document.getElementById('bcMilestoneEdit_ergebnis')?.focus();
    return;
  }
  Object.assign(e, values, { updatedAt: new Date().toISOString() });
  setWsEntries(ws, yr, entries);
  const ok=await savePlan();
  if(!ok) return;
  closeMilestoneEditModal();
  renderWsDetail(ws);
  renderCatList();
  toast('Gespeichert');
}

function addWsEntry(ws, yr){
  const entries=getWsEntries(ws, yr);
  entries.unshift({id: uid(), kind:'wsYear', workstream: ws, jahr: yr,
    ergebnis:'', kpis:'', voraussetzungen:'', abhaengigkeiten:'', risiken:'', verantwortlich:'',
    ziel_umsatz_teur: null, ziel_headcount: null, ziel_quartal: '', ziel_skill_kategorie: '',
    ziel_skill_level_min: null, ziel_anteil_prozent: null
  });
  setWsEntries(ws, yr, entries);
  renderWsDetail(ws);
  renderCatList();
  setTimeout(() => document.getElementById('ms_'+yr+'_0_ergebnis')?.focus(), 0);
}

function delWsEntry(ws, yr, idx){
  if(!confirm('Meilenstein löschen?')) return;
  const entries=getWsEntries(ws, yr);
  entries.splice(idx,1);
  setWsEntries(ws, yr, entries);
  renderWsDetail(ws);
  renderCatList();
}

function updWs(ws, yr, idx, field, val){
  const entries=getWsEntries(ws, yr);
  const e=entries[idx];
  if(!e) return;
  e[field]=val;
  e.updatedAt=new Date().toISOString();
  setWsEntries(ws, yr, entries);
  if(field==='ergebnis'){
    const mid='ms_'+yr+'_'+idx;
    const titleEl=document.getElementById(mid+'_title');
    const fieldEl=document.getElementById(mid+'_ergebnis');
    if(titleEl){
      titleEl.textContent=milestoneTitle(e);
      titleEl.classList.toggle('ms-title--empty', !String(val||'').trim());
    }
    if(fieldEl && String(val||'').trim()) fieldEl.classList.remove('bc-input-invalid');
  }
  renderCatList();
}

function updWsNum(ws, yr, idx, field, val){
  const entries=getWsEntries(ws, yr);
  const e=entries[idx];
  if(!e) return;
  if(val === '' || val == null) e[field] = null;
  else {
    const n = /prozent|level/.test(field) ? parseInt(val, 10) : parseFloat(String(val).replace(',', '.'));
    e[field] = Number.isFinite(n) ? n : null;
  }
  e.updatedAt=new Date().toISOString();
  setWsEntries(ws, yr, entries);
  renderCatList();
}

function renderStructuredTargets(ws, yr, idx, e, idPrefix, live){
  const wsEsc = esc(ws).replace(/'/g, "\\'");
  const ocNum=live?(field)=>`onchange="updWsNum('${wsEsc}',${yr},${idx},'${field}',this.value)"`:()=>'';
  const oc=live?(field)=>`onchange="updWs('${wsEsc}',${yr},${idx},'${field}',this.value)"`:()=>'';
  const fid=(name)=>(idPrefix?idPrefix+'_'+name:name);
  const qOpts=['Q1','Q2','Q3','Q4'].map(q=>'<option value="'+q+'"'+(e.ziel_quartal===q?' selected':'')+'>'+q+'</option>').join('');
  return '<details class="bc-structured-targets" open>'+
    '<summary>Strukturierte Zielwerte (IST/SOLL-Vergleich)</summary>'+
    '<p class="bc-muted" style="margin:.35rem 0 .65rem">Numerische Ziele für den Abgleich mit Phase 1 (Status Aufnahme).</p>'+
    '<div class="review-mini-grid">'+
      '<div class="field"><label>Ziel-Umsatz (TEUR)</label><input type="number" min="0" step="1" id="'+fid('ziel_umsatz_teur')+'" '+ocNum('ziel_umsatz_teur')+' value="'+(e.ziel_umsatz_teur!=null?esc(e.ziel_umsatz_teur):'')+'"></div>'+
      '<div class="field"><label>Ziel-Headcount</label><input type="number" min="0" step="1" id="'+fid('ziel_headcount')+'" '+ocNum('ziel_headcount')+' value="'+(e.ziel_headcount!=null?esc(e.ziel_headcount):'')+'"></div>'+
      '<div class="field"><label>Ziel-Quartal</label><select id="'+fid('ziel_quartal')+'" '+oc('ziel_quartal')+'><option value="">–</option>'+qOpts+'</select></div>'+
      '<div class="field"><label>Skill-Kategorie (Ziel)</label><select id="'+fid('ziel_skill_kategorie')+'" '+oc('ziel_skill_kategorie')+'>'+buildHarmSkillCategoryOptions(e.ziel_skill_kategorie||'')+'</select></div>'+
      '<div class="field"><label>Min. Skill-Level (1–5)</label><input type="number" min="1" max="5" step="1" id="'+fid('ziel_skill_level_min')+'" '+ocNum('ziel_skill_level_min')+' value="'+(e.ziel_skill_level_min!=null?esc(e.ziel_skill_level_min):'')+'"></div>'+
      '<div class="field"><label>Ziel-Anteil (% der MA)</label><input type="number" min="0" max="100" step="1" id="'+fid('ziel_anteil_prozent')+'" '+ocNum('ziel_anteil_prozent')+' value="'+(e.ziel_anteil_prozent!=null?esc(e.ziel_anteil_prozent):'')+'"></div>'+
    '</div></details>';
}
function tip(label,text){return '<label>'+esc(label)+' <span class="help" tabindex="0" data-tip="'+esc(text)+'">i</span></label>'}
function tipRequired(label,text){return '<label>'+esc(label)+' <span class="bc-required" aria-hidden="true">*</span> <span class="help" tabindex="0" data-tip="'+esc(text)+'">i</span></label>'}

function milestoneTitle(entry) {
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
      if (entry?.kind === "wsYear" && !String(entry.ergebnis || "").trim()) {
        missing.push({ entry, idx });
      }
    });
  });
  return missing;
}


/* legacy measureCard block removed */
function fld(cid,m,key,label,type,opts,helpText){
  const v=m[key]||'';
  const oc='onchange="upd(\''+cid+'\',\''+m.id+'\',\''+key+'\',this.value)"';
  let inp;
  if(type==='textarea')inp='<textarea '+oc+'>'+esc(v)+'</textarea>';
  else if(type==='select')inp='<select '+oc+'>'+opts.map(o=>'<option'+(o===v?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select>';
  else inp='<input '+oc+' value="'+esc(v)+'">';
  return '<div class="field">'+tip(label, helpText||'Bitte Feld passend zur geplanten Maßnahme ausfüllen.')+inp+'</div>';
}
// NOTE: Die frühere Maßnahme-CRUD-Logik pro Vorgabe-Kategorie wird in dieser Version nicht mehr genutzt,
// da Planung pro Workstream (1 Leitplanke) und Jahr erfolgt. Die Daten liegen in plan.measures["WS||<workstream>||<jahr>"]
// und werden über updWs() gepflegt.
function addMeasure(){toast('In dieser Version werden Einträge pro Workstream/Jahr direkt im Formular erfasst.');}
function upd(){}
function dupMeasure(){toast('Nicht verfügbar: Planung erfolgt pro Workstream/Jahr.');}
function delMeasure(){toast('Nicht verfügbar: Planung erfolgt pro Workstream/Jahr.');}

/* ---------- review ---------- */
function ampelFor(ws,yr){
  const cats=guidelines.filter(g=>g.workstream===ws);
  if(!cats.length)return{c:'grey',n:0};

  const entries = getWsEntries(ws, yr);
  if(!entries.length) return {c:'red', n:0};

  // "grün" wenn alle Einträge core-Felder haben, und keiner als Risiko/Blocker leer ist optional
  const coreOk = entries.every(e => (e.ergebnis||'').trim() && (e.kpis||'').trim() && (e.verantwortlich||'').trim());
  const hasAnyRisk = entries.some(e => (e.risiken||'').trim());

  if(coreOk && !hasAnyRisk) return {c:'green', n:entries.length};
  return {c:'amber', n:entries.length};
}
function renderReview(){
  const wss=workstreams();
  let h='<thead><tr><th>Workstream</th>'+YEARS.map(y=>'<th style="text-align:center">'+y+'</th>').join('')+'</tr></thead><tbody>';
  wss.forEach(ws=>{
    h+='<tr><td><b>'+esc(ws)+'</b></td>';
    YEARS.forEach(y=>{const a=ampelFor(ws,y);
      h+='<td class="cell" onclick="drill(\''+esc(ws).replace(/'/g,"")+'\','+y+')"><span class="dot '+a.c+'"></span><div class="bc-muted">'+a.n+'</div></td>';});
    h+='</tr>';
  });
  h+='</tbody>';
  document.getElementById('reviewTable').innerHTML=h;
}

// Alte Maßnahme-Kartenlogik (pro Vorgabe-Kategorie) wird in dieser Version nicht mehr genutzt.
function measureCard(){return ''}
function drill(ws,yr){
  const entries=getWsEntries(ws, yr);
  let h='<div class="bc-flex-between"><h3>'+esc(ws)+' · '+yr+'</h3><button class="btn btn-sm btn-outline" onclick="document.getElementById(\'reviewDrill\').style.display=\'none\'">Schließen</button></div>';
  if(!entries.length){
    h+='<p class="bc-muted">Keine Einträge.</p>';
  } else {
    entries.forEach((e)=>{
      h+='<div class="measure" style="margin-top:10px"><b>'+esc(milestoneTitle(e))+'</b></div>';
      const items=[
        ['Ergebnis / Artefakt', e.ergebnis],
        ['Messbare KPIs', e.kpis],
        ['Voraussetzungen', e.voraussetzungen],
        ['Abhängigkeiten', e.abhaengigkeiten],
        ['Risiken / Blocker', e.risiken],
        ['Verantwortlich', e.verantwortlich],
      ];
      items.forEach(([t,v])=>{
        h+='<div class="measure" style="margin-top:6px"><b>'+esc(t)+'</b><div class="bc-muted" style="white-space:pre-wrap;margin-top:4px">'+esc(v||'–')+'</div></div>';
      });
    });
  }
  const d=document.getElementById('reviewDrill');d.innerHTML=h;d.style.display='block';d.scrollIntoView({behavior:'smooth'})
}

const REVIEW_YEARS = YEARS;
let reviewSelected = {ws:'', year:2026};

function reviewAllEntries(){
  return Object.values(plan.measures||{}).flat().filter(m=>m && m.kind==='wsYear');
}
function reviewEntries(ws, year){ return getWsEntries(ws, year); }
function reviewCoreFilled(m){ return !!((m.ergebnis||'').trim() && (m.kpis||'').trim() && (m.verantwortlich||'').trim()); }
function reviewExtendedCount(m){ return [m.ergebnis,m.kpis,m.voraussetzungen,m.abhaengigkeiten,m.risiken,m.verantwortlich].filter(v=>String(v||'').trim()).length; }
function reviewQualityState(items){
  if(!items.length) return {cls:'c-red', label:'leer', risk:false};
  const avg = items.reduce((a,m)=>a+reviewExtendedCount(m),0)/items.length;
  const anyRisk = items.some(m=>String(m.risiken||'').trim());
  const allCore = items.every(reviewCoreFilled);
  if(allCore && avg >= 5.2 && !anyRisk) return {cls:'c-green', label:'stark', risk:false};
  if(allCore) return {cls:'c-amber', label:'solide', risk:anyRisk};
  return {cls:'c-red', label:'kritisch', risk:anyRisk};
}
function renderReviewStats(){
  const wss = workstreams();
  const all = reviewAllEntries();
  const totalCells = wss.length * REVIEW_YEARS.length || 1;
  const covered = wss.flatMap(ws=>REVIEW_YEARS.map(y=>reviewEntries(ws,y))).filter(arr=>arr.length).length;
  const complete = all.filter(reviewCoreFilled).length;
  const risks = all.filter(d=>String(d.risiken||'').trim()).length;
  const depOpen = all.filter(d=>String(d.abhaengigkeiten||'').trim() && !String(d.voraussetzungen||'').trim()).length;
  const byId = id => document.getElementById(id);
  if(byId('rvCoverage')) byId('rvCoverage').textContent = Math.round((covered/totalCells)*100) + '%';
  if(byId('rvQuality')) byId('rvQuality').textContent = all.length ? Math.round((complete/all.length)*100) + '%' : '0%';
  if(byId('rvRisk')) byId('rvRisk').textContent = all.length ? Math.round((risks/all.length)*100) + '%' : '0%';
  if(byId('rvDepOpen')) byId('rvDepOpen').textContent = depOpen;
}
function selectReviewCell(ws, year){ reviewSelected = {ws, year}; renderReviewDrill(); }
function renderReview(){
  renderReviewStats();
  const wss=workstreams();
  if(!reviewSelected.ws && wss.length) reviewSelected = {ws:wss[0], year:2026};
  let h='<thead><tr><th>Workstream</th>'+REVIEW_YEARS.map(y=>'<th style="text-align:center">'+y+'</th>').join('')+'</tr></thead><tbody>';
  wss.forEach(ws=>{
    h+='<tr><td><b>'+esc(ws)+'</b></td>';
    REVIEW_YEARS.forEach(year=>{
      const items = reviewEntries(ws, year);
      const q = reviewQualityState(items);
      const avg = items.length ? Math.round(items.reduce((a,m)=>a+reviewExtendedCount(m),0)/items.length) : 0;
      h += '<td><div class="review-cellbox '+q.cls+'" onclick="selectReviewCell(\''+esc(ws).replace(/'/g,'')+'\','+year+')">'+
           '<div class="review-cell-top"><div class="review-count">'+items.length+'</div><div class="review-quality">'+q.label+'</div><div class="review-risk">'+(q.risk ? '⚠' : '')+'</div></div>'+
           '<div class="review-cell-sub">Ø '+avg+'/6 Felder</div></div></td>';
    });
    h+='</tr>';
  });
  h+='</tbody>';
  document.getElementById('reviewTable').innerHTML=h;
  renderReviewQualityBars();
  renderReviewRiskBoard();
  renderReviewDrill();
}
function renderReviewQualityBars(){
  const box = document.getElementById('reviewQualityBars'); if(!box) return;
  let h='';
  workstreams().forEach(ws=>{
    const items = reviewAllEntries().filter(d=>d.workstream===ws);
    const pct = items.length ? Math.round((items.reduce((a,m)=>a+reviewExtendedCount(m),0)/(items.length*6))*100) : 0;
    h += '<div class="review-bar-row"><div><b>'+esc(ws)+'</b></div><div class="review-bar-track"><div class="review-bar-fill" style="width:'+pct+'%"></div></div><div><b>'+pct+'%</b></div></div>';
  });
  box.innerHTML = h;
}
function renderReviewDrill(){
  const box = document.getElementById('reviewDrill'); const title = document.getElementById('reviewDrillTitle');
  if(!box || !title) return;
  const ws = reviewSelected.ws; const year = reviewSelected.year;
  const items = ws ? reviewEntries(ws, year) : [];
  const mode = (document.getElementById('reviewRiskFilter')||{}).value || 'all';
  const filtered = items.filter(m=>{
    const hasRisk = !!String(m.risiken||'').trim();
    if(mode==='withRisk') return hasRisk;
    if(mode==='withoutRisk') return !hasRisk;
    return true;
  });
  title.textContent = ws ? (ws + ' · ' + year + ' · ' + filtered.length + ' Meilenstein(e)') : 'Wähle eine Zelle in der Matrix.';
  if(!filtered.length){ box.innerHTML = '<div class="bc-muted">Keine passenden Meilensteine in dieser Auswahl.</div>'; return; }
  box.innerHTML = filtered.map((m,i)=>{
    const score = reviewExtendedCount(m);
    const cls = !reviewCoreFilled(m) ? 'red' : (String(m.risiken||'').trim() ? 'amber' : 'green');
    const label = !reviewCoreFilled(m) ? 'kritisch' : (String(m.risiken||'').trim() ? 'mit Risiko' : 'stabil');
    return '<div class="review-mile"><div class="review-mile-head"><div><div class="review-mile-title">'+esc(milestoneTitle(m))+'</div><div class="bc-muted" style="margin-top:4px">Vollständigkeit '+score+'/6</div></div><span class="review-pill '+cls+'">'+label+'</span></div>'+
      '<div class="review-mini-grid">'+
      '<div class="review-field"><div class="k">Messbare KPIs</div><div class="v">'+esc(m.kpis)+'</div></div>'+
      '<div class="review-field"><div class="k">Verantwortlich</div><div class="v">'+esc(m.verantwortlich)+'</div></div>'+
      '<div class="review-field"><div class="k">Voraussetzungen</div><div class="v">'+esc(m.voraussetzungen||'–')+'</div></div>'+
      '<div class="review-field"><div class="k">Abhängigkeiten</div><div class="v">'+esc(m.abhaengigkeiten||'–')+'</div></div>'+
      '<div class="review-field"><div class="k">Risiken / Blocker</div><div class="v">'+esc(m.risiken||'–')+'</div></div>'+
      '<div class="review-field"><div class="k">Workstream / Jahr</div><div class="v">'+esc(m.workstream)+' · '+m.jahr+'</div></div>'+
      '</div></div>';
  }).join('');
}
function renderReviewRiskBoard(){
  const box = document.getElementById('reviewRiskBoard'); if(!box) return;
  const risks = reviewAllEntries().filter(d=>String(d.risiken||'').trim());
  box.innerHTML = risks.length ? risks.map(r=>
    '<div class="review-risk-item"><div class="bc-flex-between"><b>'+esc(r.ergebnis)+'</b><span class="bc-muted">'+r.jahr+'</span></div><div class="bc-muted" style="margin:4px 0 8px">'+esc(r.workstream)+' · Verantwortlich: '+esc(r.verantwortlich)+'</div><div style="font-size:13px;white-space:pre-wrap">'+esc(r.risiken)+'</div></div>'
  ).join('') : '<div class="bc-muted">Keine Risiken / Blocker gepflegt.</div>';
}

/* ---------- export ---------- */
function dl(name,content,type){const b=new Blob([content],{type});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u)}
function exportJson(){const slug=(plan.meta?.unit||plan.meta?.bereich||'plan').replace(/\s+/g,'_');dl('backcasting_plan_'+slug+'.json',JSON.stringify({meta:plan.meta,guidelines,measures:plan.measures},null,2),'application/json');toast('JSON exportiert')}
function exportCsv(){
  const cols=['workstream','jahr','planIndex','ergebnis','kpis','voraussetzungen','abhaengigkeiten','risiken','verantwortlich'];
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

function exportGuidelinesCsv(){
  const cols=['workstream','kategorie','prioritaet','leitfrage','festlegung','zielwert','zieljahr','zielquartal','verantwortlich','abhaengigkeiten','begruendung','auswirkungen'];
  let rows=[cols.join(';')];
  (guidelines||[]).forEach(g=>{
    const row = cols.map(c=>{
      const v = g && g[c]!=null ? String(g[c]) : '';
      return '"'+v.replace(/"/g,'""')+'"';
    }).join(';');
    rows.push(row);
  });
  dl('backcasting_leitplanken_'+(plan.meta?.unit||plan.meta?.bereich||'plan').replace(/\s+/g,'_')+'.csv','\ufeff'+rows.join('\n'),'text/csv');
  toast('Leitplanken-CSV exportiert');
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
document.querySelectorAll('#bcTabs .tab').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#bcTabs .tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');document.getElementById('page-'+b.dataset.tab).classList.add('active');
  if(b.dataset.tab==='review')renderReview();
});

/* boot */
initPlanState();

async function bootBackcastingPlan(me) {
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
}

document.addEventListener('rc-backcasting-ready', (e)=>void bootBackcastingPlan(e.detail));
if(document.body.dataset.rcUserUnit) void bootBackcastingPlan(null);
document.getElementById('bcMilestoneEdit')?.addEventListener('click', (e)=>{
  if(e.target.id==='bcMilestoneEdit') closeMilestoneEditModal();
});
document.addEventListener('keydown', (e)=>{
  if(e.key==='Escape' && milestoneModalCtx) closeMilestoneEditModal();
});
window.addEventListener('error', function(e){
  const msg = 'JS-Fehler: ' + (e && e.message ? e.message : 'Unbekannter Fehler');
  const cs=document.getElementById('csvStatus'); if(cs) cs.textContent=msg;
  const pcs=document.getElementById('planCsvStatus'); if(pcs) pcs.textContent=msg;
  console.error(e);
});
