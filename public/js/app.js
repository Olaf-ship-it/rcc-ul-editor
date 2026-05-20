// ===== CATEGORIES =====
const CATS = [
  {k:"Ergebnisse / Artefakte", q:"Welche Loesungen, Services, Strukturen oder Programme existieren bereits?",
   info:"Erfassen Sie alle bestehenden Ergebnisse: Produkte, Services, Tools, Prozesse, Programme. Auch Teilresultate und Piloten zaehlen.",
   ex_pm:"SAP S/4HANA Retail (CAR, POSDM) ist Kernprodukt. AMS-Managed-Services fuer 15+ Retailkunden aktiv. Erste KI-PoCs (AMS Copilot) in Pilotphase.",
   ex_sm:"SAP BTP Einfuehrungskurse fuer 2 Teams durchgefuehrt. Lernplattform in Pilotphase (50 TN). Change Story v1 kommuniziert.",
   ex_or:"KI Integration Hub in Gruendungsphase (2 MA). Open Source Guild: Charter v1 verabschiedet. CoP Retail monatlich, 15 TN.",
   ex_pe:"SAP Diamant-Partnerschaft Retail aktiv. Microsoft Gold-Partnerschaft aktiv. Co-Sell Draft mit SAP unterzeichnet."},
  {k:"Messbare KPIs / Markterfolg", q:"Welche messbaren Kennzahlen oder Erfolgsindikatoren liegen aktuell vor?",
   info:"Nennen Sie konkrete Zahlen: Umsatzanteile, Conversion Rates, Nutzerzahlen, Pipeline-Werte, NPS etc.",
   ex_pm:"70% Umsatz aus klassischen SAP-Projekten. 25% aus AMS. 2 aktive KI-Piloten, Pipeline 200T EUR.",
   ex_sm:"150 MA mit mind. 1 Training. Lernzeit 2h/Monat (Ziel: 4h). Employee NPS: +32.",
   ex_or:"6 offene Rollen (2 kritisch). 70% Projekte Cross-Unit. RACI-Abdeckung ~50%.",
   ex_pe:"2 strategische Partnergespraeche/Quartal. 0 Co-Sell-Deals. 0 Marketplace Listings."},
  {k:"Voraussetzungen / Ressourcen", q:"Welche organisatorischen, technischen oder finanziellen Voraussetzungen bestehen?",
   info:"Budget, Personal, Tools, Infrastruktur, Lizenzen – alles was als Grundlage vorhanden ist oder fehlt.",
   ex_pm:"SAP Diamant-Partner Retail (einziger DACH). MS Gold-Partner. Product Owner benannt. Budget in Pruefung.",
   ex_sm:"Trainingsbudget 80T EUR genehmigt. 2 externe Trainer. Zeitfreigabe nur in 3/8 Teams. Kein Learning Manager.",
   ex_or:"Rollenprofile 80% definiert. Collaboration-Tools aktiv. Budget fuer Hub in GF-Diskussion.",
   ex_pe:"Partnervertraege aktiv. 1 Alliance Manager (50%). Marketing-Material in Erstellung."},
  {k:"Abhaengigkeiten (intern / extern)", q:"Von welchen anderen Bereichen, Teams oder externen Partnern haengt der Fortschritt ab?",
   info:"Identifizieren Sie Abhaengigkeiten zu anderen Units, Workstreams, externen Partnern, Freigaben etc.",
   ex_pm:"Skills: API-/KI-Expertise fehlt teilweise. Org: Product-Team nicht vollstaendig. Partner: SAP Co-Sell ausstehend.",
   ex_sm:"Org: Rollenbeschreibungen nicht aktualisiert. HR: Karrierepfade nicht mit Skills verknuepft.",
   ex_or:"Skills: KI-Integratoren fehlen. Portfolio: Pilotprojekte als Praxis. HR: Recruiting-Kapazitaet begrenzt.",
   ex_pe:"Portfolio: Module muessen marktreif sein. Org: Alliance-Rolle muss Vollzeit werden."},
  {k:"Risiken / Blocker", q:"Welche konkreten Hindernisse oder Verzoegerungen bestehen aktuell?",
   info:"Benennen Sie konkrete Risiken, Blocker, Verzoegerungen – intern wie extern.",
   ex_pm:"Kein standardisiertes Pricing fuer KI-Module. Legal-Prozess >6 Wochen. Konkurrenz durch SAP-eigene KI-Features.",
   ex_sm:"Hohe Delivery-Auslastung (>90%) verhindert Lernzeit. KI-Skepsis bei erfahrenen Beratern.",
   ex_or:"Silodenken zwischen Delivery und Innovation. Widerstand mittleres Management.",
   ex_pe:"SAP Partner-Team wechselt Ansprechpartner haeufig. Kein lokaler Referenzcase."},
  {k:"Verantwortliche / Team", q:"Wer treibt das Thema aktuell? Welche Rollen sind beteiligt?",
   info:"Nennen Sie Rollen und ggf. Namen der Verantwortlichen. Identifizieren Sie fehlende Rollen.",
   ex_pm:"Portfolio Lead KI, Sales Lead Retail, Product Owner AMS Copilot, CTO als Sponsor.",
   ex_sm:"People & Culture Lead, Change Coach (extern), HR Director als Sponsor, 12 Teamleads als Mentoren.",
   ex_or:"COO: Hub-Setup. CTO: Governance. HR: Recruiting. Transformation PMO (0,5 FTE).",
   ex_pe:"Alliance Manager (50%), Sales Lead Retail, Marketing Lead, COO: Sign-off."},
  {k:"Staerken / Best Practices", q:"Was laeuft besonders gut? Was koennen andere Bereiche uebernehmen?",
   info:"Heben Sie hervor, was funktioniert – als Basis fuer Skalierung und Wissenstransfer.",
   ex_pm:"Einziger SAP Diamant-Partner Retail DACH. Tiefe Branchenexpertise. AMS-Delivery als Vertrauensbasis.",
   ex_sm:"Hohe Lernbereitschaft bei Junioren. SAP-Expertise auf hohem Niveau. Peer-Learning gut angenommen.",
   ex_or:"Flache Hierarchien, kurze Entscheidungswege. CoP Retail als funktionierendes Format.",
   ex_pe:"Diamant-Status oeffnet Tueren. Persoenliche SAP-Kontakte. Langjahrige Branchenreputation."},
  {k:"Handlungsfelder (0-6 Monate)", q:"Welche konkreten naechsten Schritte sind aus Ihrer Sicht notwendig?",
   info:"Definieren Sie 3-5 konkrete Massnahmen fuer die naechsten 6 Monate mit klarer Prioritaet.",
   ex_pm:"AMS Copilot Pilot finalisieren. Pricing Blueprint erstellen. SAP Co-Sell Antrag einreichen. 3 Pilotkunden ansprechen.",
   ex_sm:"Learning Manager einstellen. Zeitfreigabe durchsetzen. Badge-System pilotieren. KI-Basics als Pflichttraining.",
   ex_or:"KI-Manager einstellen (Prio 1). Hub-Budget freigeben. RACI erstellen. Guild Output steigern.",
   ex_pe:"Alliance Manager auf 100%. SAP Co-Sell Meeting organisieren. Referenzcase dokumentieren. Marketplace Listing."}
];

const WS_KEYS = ["Portfolio & Markt", "Skills & Mindset", "Organisation & Rollen", "Partner & Ecosystem"];
const WS_ICONS = {"Portfolio & Markt":"📊","Skills & Mindset":"🧠","Organisation & Rollen":"🏗️","Partner & Ecosystem":"🤝"};
const EX_KEYS = {
  "Portfolio & Markt":"ex_pm","Skills & Mindset":"ex_sm",
  "Organisation & Rollen":"ex_or","Partner & Ecosystem":"ex_pe"
};

// ===== SESSION + API =====
let currentUnit = "";
let currentName = "";
let currentEmail = "";
let isAdmin = false;
let entryStore = { status: [], team: [], skill: [] };

function today(){return new Date().toISOString().slice(0,10)}
function toast(m,c){const t=document.getElementById('toast');t.textContent=m;t.style.background=c||'#27ae60';t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500)}
function ampelHTML(v){if(v==='green')return'<span class="ampel ampel-green" title="Etabliert"></span>';if(v==='orange')return'<span class="ampel ampel-orange" title="Teilweise"></span>';if(v==='red')return'<span class="ampel ampel-red" title="Kritisch"></span>';return'–'}
function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML}

async function api(url, opts = {}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    let msg = "Anfrage fehlgeschlagen.";
    try { msg = (await res.json()).error || msg; } catch (_e) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

function load(type) { return entryStore[type] || []; }

async function refreshEntries() {
  const all = await api("/api/entries");
  entryStore = { status: [], team: [], skill: [] };
  all.forEach((e) => {
    if (entryStore[e.type]) entryStore[e.type].push(e);
  });
}

async function saveEntry(type, entry) {
  if (entry.id) {
    await api(`/api/entries/${entry.id}`, {
      method: "PUT",
      body: JSON.stringify({ entry: { ...entry, type } }),
    });
    return entry.id;
  }
  const result = await api("/api/entries", {
    method: "POST",
    body: JSON.stringify({ type, entry: { ...entry, type } }),
  });
  return result.id;
}

async function doLogin(){
  const email=document.getElementById('loginEmail').value.trim().toLowerCase();
  const password=document.getElementById('loginPassword').value;
  const unit=document.getElementById('loginUnit').value;
  const errEl=document.getElementById('loginError');
  errEl.style.display='none';
  if(!email||!password||!unit){errEl.textContent='Bitte alle Felder ausfuellen.';errEl.style.display='block';return}
  try {
    const session = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password, unit }) });
    currentUnit = session.unit;
    currentName = session.name;
    currentEmail = session.email;
    isAdmin = session.role === "admin";
    await showApp();
  } catch (error) {
    errEl.textContent = error.message;
    errEl.style.display = "block";
  }
}

async function doLogout(){
  try { await api("/api/auth/logout", { method: "POST" }); } catch (_e) {}
  currentUnit='';currentName='';currentEmail='';isAdmin=false;
  entryStore = { status: [], team: [], skill: [] };
  document.getElementById('loginOverlay').style.display='flex';document.getElementById('appHeader').style.display='none';
  document.getElementById('tabs').style.display='none';document.getElementById('appMain').style.display='none';
}

async function showApp(){
  await refreshEntries();
  document.getElementById('loginOverlay').style.display='none';document.getElementById('appHeader').style.display='flex';
  document.getElementById('tabs').style.display='flex';document.getElementById('appMain').style.display='block';
  document.getElementById('headerUnit').textContent=currentUnit;document.getElementById('headerName').textContent=currentName+' ('+currentEmail+')';
  document.getElementById('ovUnitLabel').textContent=currentUnit;
  checkAdmin();renderNavStatus();renderNavTeam();renderNavSkill();renderOverview();if(isAdmin)await renderAdminUsers();
}

async function bootSession() {
  try {
    const me = await api("/api/auth/me");
    currentUnit = me.unit;
    currentName = me.name;
    currentEmail = me.email;
    isAdmin = me.role === "admin";
    await showApp();
  } catch (_e) {}
}

// ===== TABS =====
document.querySelectorAll('.tab').forEach(t=>{t.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');document.getElementById('page-'+t.dataset.page).classList.add('active');
  if(t.dataset.page==='overview')renderOverview();if(t.dataset.page==='export')renderExportStats();if(t.dataset.page==='admin')renderAdminUsers();
})});

function switchTab(p){document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.page===p));
  document.querySelectorAll('.page').forEach(pg=>pg.classList.toggle('active',pg.id==='page-'+p));}

// ===== NAV PANELS =====
function renderNavStatus(){
  const ws=document.getElementById('s_workstream').value;
  const kat=document.getElementById('s_kategorie').value;
  let h='';
  WS_KEYS.forEach(w=>{const cls=w===ws?'nav-pill ws-active':(ws?'nav-pill dim':'nav-pill');
    h+=`<div class="${cls}" onclick="document.getElementById('s_workstream').value='${w}';document.getElementById('s_workstream').dispatchEvent(new Event('change'))">${WS_ICONS[w]} ${w}</div>`;
  });
  document.getElementById('navWS_status').innerHTML=h;
  let kh='';
  if(ws){CATS.forEach(c=>{const cls=c.k===kat?'nav-pill active':(kat?'nav-pill dim':'nav-pill');
    kh+=`<div class="${cls}" onclick="document.getElementById('s_kategorie').value='${c.k}';document.getElementById('s_kategorie').dispatchEvent(new Event('change'))">${c.k}</div>`;
  })}else{kh='<div style="color:var(--rc-muted);font-size:.75rem;font-style:italic">Erst Workstream waehlen</div>'}
  document.getElementById('navKat_status').innerHTML=kh;
}

function renderNavTeam(){
  const ws=document.getElementById('t_workstream').value;let h='';
  WS_KEYS.forEach(w=>{const cls=w===ws?'nav-pill ws-active':'nav-pill';
    h+=`<div class="${cls}" onclick="document.getElementById('t_workstream').value='${w}';document.getElementById('t_workstream').dispatchEvent(new Event('change'))">${WS_ICONS[w]} ${w}</div>`;
  });document.getElementById('navWS_team').innerHTML=h;
}
function renderNavSkill(){
  const ws=document.getElementById('sk_workstream').value;let h='';
  WS_KEYS.forEach(w=>{const cls=w===ws?'nav-pill ws-active':'nav-pill';
    h+=`<div class="${cls}" onclick="document.getElementById('sk_workstream').value='${w}';document.getElementById('sk_workstream').dispatchEvent(new Event('change'))">${WS_ICONS[w]} ${w}</div>`;
  });document.getElementById('navWS_skill').innerHTML=h;
}

// ===== INFO PANEL =====
function renderInfoStatus(){
  const ws=document.getElementById('s_workstream').value;
  const kat=document.getElementById('s_kategorie').value;
  const box=document.getElementById('infoContentStatus');
  if(!ws||!kat){box.innerHTML='<p style="font-style:italic">Waehlen Sie Workstream + Kategorie fuer Erlaeuterungen und Beispiele.</p>';return}
  const c=CATS.find(x=>x.k===kat);if(!c)return;
  const exKey=EX_KEYS[ws];
  box.innerHTML=`
    <div class="info-title">${esc(c.k)}</div>
    <p>${esc(c.info)}</p>
    <div class="info-hint">💡 <strong>Leitfrage:</strong> ${esc(c.q)}</div>
    <div class="info-example"><strong>Beispiel – ${WS_ICONS[ws]} ${esc(ws)}:</strong><br>${esc(c[exKey]||'')}</div>
    <table>
      <tr><th>Ampel</th><th>Bedeutung</th></tr>
      <tr><td>🟩</td><td>Etabliert / funktioniert</td></tr>
      <tr><td>🟧</td><td>Begonnen / teilweise</td></tr>
      <tr><td>🟥</td><td>Fehlt / kritisch</td></tr>
    </table>
  `;
}

// ===== STATUS FORM =====
const sWS=document.getElementById('s_workstream'),sKat=document.getElementById('s_kategorie');
sWS.addEventListener('change',()=>{
  sKat.innerHTML='<option value="">– waehlen –</option>';
  if(sWS.value){CATS.forEach(c=>{sKat.innerHTML+=`<option value="${c.k}">${c.k}</option>`})}
  document.getElementById('s_leitfrageBox').style.display='none';
  renderNavStatus();renderInfoStatus();
});
sKat.addEventListener('change',()=>{
  const c=CATS.find(x=>x.k===sKat.value);
  if(c){document.getElementById('s_leitfrage').textContent=c.q;document.getElementById('s_leitfrageBox').style.display='block'}
  else{document.getElementById('s_leitfrageBox').style.display='none'}
  renderNavStatus();renderInfoStatus();
});
document.getElementById('t_workstream').addEventListener('change',renderNavTeam);
document.getElementById('sk_workstream').addEventListener('change',renderNavSkill);

document.getElementById('statusForm').addEventListener('submit',async e=>{e.preventDefault();
  const d=load('status');const id=document.getElementById('s_editId').value||Date.now().toString();
  const entry={id,workstream:sWS.value,kategorie:sKat.value,ampel:document.getElementById('s_ampel').value,
    stand:document.getElementById('s_stand').value,kommentar:document.getElementById('s_kommentar').value,
    datum:document.getElementById('s_datum').value||today(),erfasser:currentName,unit:currentUnit,type:'status'};
  const eId=document.getElementById('s_editId').value; if (!eId) delete entry.id;
  await saveEntry("status", entry);
  await refreshEntries();
  document.getElementById('statusForm').reset();document.getElementById('s_editId').value='';
  document.getElementById('s_leitfrageBox').style.display='none';document.getElementById('btnStatusCancel').style.display='none';
  renderNavStatus();renderInfoStatus();toast('IST-Status gespeichert!');
});
function cancelStatusEdit(){document.getElementById('statusForm').reset();document.getElementById('s_editId').value='';
  document.getElementById('btnStatusCancel').style.display='none';document.getElementById('s_leitfrageBox').style.display='none';renderNavStatus();renderInfoStatus()}

// ===== TEAM FORM =====
document.getElementById('teamForm').addEventListener('submit',async e=>{e.preventDefault();
  const id=document.getElementById('t_editId').value||Date.now().toString();
  const entry={id,workstream:document.getElementById('t_workstream').value,bereich:document.getElementById('t_bereich').value,
    headcount:document.getElementById('t_headcount').value,offen:document.getElementById('t_offen').value,
    ausbau:document.getElementById('t_ausbau').value,status:document.getElementById('t_status').value,
    rollenmix:document.getElementById('t_rollenmix').value,schwerpunkt:document.getElementById('t_schwerpunkt').value,
    bemerkung:document.getElementById('t_bemerkung').value,erfasser:currentName,unit:currentUnit,type:'team'};
  const eId=document.getElementById('t_editId').value; if (!eId) delete entry.id;
  await saveEntry("team", entry);
  await refreshEntries();
  document.getElementById('teamForm').reset();document.getElementById('t_editId').value='';
  document.getElementById('btnTeamCancel').style.display='none';renderNavTeam();toast('Team gespeichert!');
});
function cancelTeamEdit(){document.getElementById('teamForm').reset();document.getElementById('t_editId').value='';document.getElementById('btnTeamCancel').style.display='none';renderNavTeam()}


// ===== SKILL ROW HELPERS =====
function addSkillRow(cat, name, level) {
  const container = document.getElementById('sk_'+cat+'_rows');
  const row = document.createElement('div');
  row.className = 'skill-entry';
  row.innerHTML = '<input type="text" placeholder="Skill-Name" value="'+(name||'')+'">'
    + '<select><option value="">Stufe</option><option value="1"'+(level==='1'?' selected':'')+'>1</option><option value="2"'+(level==='2'?' selected':'')+'>2</option><option value="3"'+(level==='3'?' selected':'')+'>3</option><option value="4"'+(level==='4'?' selected':'')+'>4</option><option value="5"'+(level==='5'?' selected':'')+'>5</option></select>'
    + '<button type="button" class="sk-remove" onclick="this.parentElement.remove()">✕</button>';
  container.appendChild(row);
}
function getSkillData(cat) {
  const rows = document.getElementById('sk_'+cat+'_rows').querySelectorAll('.skill-entry');
  const result = [];
  rows.forEach(r => {
    const name = r.querySelector('input').value.trim();
    const level = r.querySelector('select').value;
    if (name) result.push({skill: name, stufe: level ? parseInt(level) : null});
  });
  return result;
}
function setSkillData(cat, data) {
  document.getElementById('sk_'+cat+'_rows').innerHTML = '';
  if (!data || !data.length) { addSkillRow(cat); return; }
  data.forEach(d => addSkillRow(cat, d.skill, d.stufe ? String(d.stufe) : ''));
}
// Init with one empty row each
['tech','methodik','soft'].forEach(c => addSkillRow(c));

// ===== SKILL FORM =====
document.getElementById('skillForm').addEventListener('submit',async e=>{e.preventDefault();
  const id=document.getElementById('sk_editId').value||Date.now().toString();
  const entry={id,workstream:document.getElementById('sk_workstream').value,name:document.getElementById('sk_nachname').value.trim()+', '+document.getElementById('sk_vorname').value.trim(),
    rolle:document.getElementById('sk_rolle').value,tech:getSkillData('tech'),
    methodik:getSkillData('methodik'),soft:getSkillData('soft'),
    zertifikate:document.getElementById('sk_zertifikate').value,ziel:document.getElementById('sk_ziel').value,
    erfasser:currentName,unit:currentUnit,type:'skill'};
  const eId=document.getElementById('sk_editId').value; if (!eId) delete entry.id;
  await saveEntry("skill", entry);
  await refreshEntries();
  document.getElementById('skillForm').reset();document.getElementById('sk_editId').value='';['tech','methodik','soft'].forEach(c=>{document.getElementById('sk_'+c+'_rows').innerHTML='';addSkillRow(c)});
  document.getElementById('btnSkillCancel').style.display='none';renderNavSkill();toast('Skill gespeichert!');
});
function cancelSkillEdit(){document.getElementById('skillForm').reset();document.getElementById('sk_editId').value='';document.getElementById('btnSkillCancel').style.display='none';['tech','methodik','soft'].forEach(c=>{document.getElementById('sk_'+c+'_rows').innerHTML='';addSkillRow(c)});renderNavSkill()}

// ===== OVERVIEW =====
function getAll(){return[...load('status').map(e=>({...e,_type:'status'})),...load('team').map(e=>({...e,_type:'team'})),...load('skill').map(e=>({...e,_type:'skill'}))]}
function renderOverview(){
  const all=getAll();const fT=document.getElementById('ov_filterType').value;const fW=document.getElementById('ov_filterWS').value;
  const fS=document.getElementById('ov_filterSearch').value.toLowerCase();
  const f=all.filter(e=>{if(fT&&e._type!==fT)return false;if(fW&&e.workstream!==fW)return false;
    if(fS&&!JSON.stringify(e).toLowerCase().includes(fS))return false;return true});
  const sc=all.filter(e=>e._type==='status').length,tc=all.filter(e=>e._type==='team').length,skc=all.filter(e=>e._type==='skill').length;
  document.getElementById('overviewStats').innerHTML=`
    <div class="stat-card"><div class="num">${all.length}</div><div class="lbl">Gesamt</div></div>
    <div class="stat-card"><div class="num">${sc}</div><div class="lbl">IST-Status</div></div>
    <div class="stat-card"><div class="num">${tc}</div><div class="lbl">Teams</div></div>
    <div class="stat-card"><div class="num">${skc}</div><div class="lbl">Skills</div></div>`;
  const tb=document.getElementById('overviewBody'),no=document.getElementById('noOverview');
  if(!f.length){tb.innerHTML='';no.style.display='block';return}no.style.display='none';
  const tl={status:'📊 Status',team:'👥 Team',skill:'🧠 Skill'};
  tb.innerHTML=f.map(e=>{let k='',a='',d='';
    if(e._type==='status'){k=e.kategorie;a=ampelHTML(e.ampel);d=esc((e.stand||'').substring(0,80))}
    else if(e._type==='team'){k=e.bereich;a=ampelHTML(e.status);d='HC:'+e.headcount+' | '+esc(e.schwerpunkt||'')}
    else{k=e.name;a='–';d=esc(e.rolle);const ts=Array.isArray(e.tech)?e.tech:[];if(ts.length)d+=' | '+ts.map(s=>s.skill+'('+s.stufe+')').join(', ')}
    return`<tr><td>${tl[e._type]}</td><td>${esc(e.workstream)}</td><td>${esc(k)}</td><td>${a}</td><td style="max-width:220px">${d}</td>
    <td style="white-space:nowrap"><button class="btn btn-sm btn-outline" onclick="editEntry('${e._type}','${e.id}')">✏️</button> <button class="btn btn-sm btn-danger" onclick="deleteEntry('${e._type}','${e.id}')">🗑️</button></td></tr>`}).join('');
}
['ov_filterType','ov_filterWS'].forEach(id=>document.getElementById(id).addEventListener('change',renderOverview));
document.getElementById('ov_filterSearch').addEventListener('input',renderOverview);

function editEntry(type,id){
  const d=load(type),e=d.find(x=>x.id===id);if(!e)return;
  if(type==='status'){
    document.getElementById('s_editId').value=e.id;document.getElementById('s_workstream').value=e.workstream;
    sWS.dispatchEvent(new Event('change'));
    setTimeout(()=>{document.getElementById('s_kategorie').value=e.kategorie;sKat.dispatchEvent(new Event('change'));
      document.getElementById('s_ampel').value=e.ampel;document.getElementById('s_stand').value=e.stand;
      document.getElementById('s_kommentar').value=e.kommentar;document.getElementById('s_datum').value=e.datum;
      document.getElementById('btnStatusCancel').style.display='';},50);switchTab('status');
  }else if(type==='team'){
    document.getElementById('t_editId').value=e.id;document.getElementById('t_workstream').value=e.workstream;
    document.getElementById('t_bereich').value=e.bereich;document.getElementById('t_headcount').value=e.headcount;
    document.getElementById('t_offen').value=e.offen;document.getElementById('t_ausbau').value=e.ausbau;
    document.getElementById('t_status').value=e.status;document.getElementById('t_rollenmix').value=e.rollenmix;
    document.getElementById('t_schwerpunkt').value=e.schwerpunkt;document.getElementById('t_bemerkung').value=e.bemerkung;
    document.getElementById('btnTeamCancel').style.display='';renderNavTeam();switchTab('team');
  }else{
    document.getElementById('sk_editId').value=e.id;document.getElementById('sk_workstream').value=e.workstream;
    var _np=(e.name||'').split(', ');document.getElementById('sk_nachname').value=_np[0]||'';document.getElementById('sk_vorname').value=_np[1]||'';document.getElementById('sk_rolle').value=e.rolle;
    setSkillData('tech', Array.isArray(e.tech) ? e.tech : []);
    setSkillData('methodik', Array.isArray(e.methodik) ? e.methodik : []);
    setSkillData('soft', Array.isArray(e.soft) ? e.soft : []);
    document.getElementById('sk_zertifikate').value=e.zertifikate;
    document.getElementById('sk_ziel').value=e.ziel;document.getElementById('btnSkillCancel').style.display='';renderNavSkill();switchTab('skills');
  }
}
async function deleteEntry(type,id){
  if(!confirm('Eintrag loeschen?'))return;
  await api(`/api/entries/${id}`, { method: "DELETE" });
  await refreshEntries();
  renderOverview();
  toast('Geloescht.','#e74c3c');
}

// ===== EXPORT =====
function renderExportStats(){const a=getAll();document.getElementById('exportStats').innerHTML=`<strong>${a.length}</strong> Eintraege – Unit: <strong>${esc(currentUnit)}</strong> (${load('status').length} Status, ${load('team').length} Teams, ${load('skill').length} Skills)`}
function exportJSON(){const a=getAll();if(!a.length){toast('Keine Daten.','#e74c3c');return}
  const b=new Blob([JSON.stringify({unit:currentUnit,erfasser:currentName,export:new Date().toISOString(),entries:a},null,2)],{type:'application/json'});
  dl(b,'Unitleiter_'+currentUnit.replace(/\W/g,'_')+'_'+today()+'.json');toast('JSON exportiert!')}
function exportCSV(){const a=getAll();if(!a.length){toast('Keine Daten.','#e74c3c');return}
  const ks=[...new Set(a.flatMap(e=>Object.keys(e)))];const q=v=>'"'+String(v||'').replace(/"/g,'""')+'"';
  let csv=ks.map(q).join(';')+'\n';a.forEach(e=>{csv+=ks.map(k=>q(e[k])).join(';')+'\n'});
  const b=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  dl(b,'Unitleiter_'+currentUnit.replace(/\W/g,'_')+'_'+today()+'.csv');toast('CSV exportiert!')}
function fmtSk(v){
  if (Array.isArray(v)) return v.map(s => s.skill + ' ' + s.stufe).join(', ');
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) ? a.map(s => s.skill + ' ' + s.stufe).join(', ') : '';
  } catch(x) {
    return String(v || '').replace(/\|/g,'/').replace(/\n/g,', ');
  }
}
function exportMD(){const a=getAll();if(!a.length){toast('Keine Daten.','#e74c3c');return}
  const unit=currentUnit,name=currentName,dt=new Date().toISOString().slice(0,16).replace('T',' ');
  let md='# Unitleiter-Erfassung: '+unit+'\n\n';
  md+='**Erfasser:** '+name+'  \n**Export:** '+dt+'  \n**Eintraege:** '+a.length+'\n\n---\n\n';
  // Status
  const st=a.filter(e=>e._type==='status');
  if(st.length){
    md+='## IST-Statusaufnahme\n\n';
    const wsGroups={};st.forEach(e=>{if(!wsGroups[e.workstream])wsGroups[e.workstream]=[];wsGroups[e.workstream].push(e)});
    Object.keys(wsGroups).forEach(ws=>{
      md+='### '+ws+'\n\n';
      md+='| Kategorie | Ampel | Aktueller Stand | Kommentar |\n';
      md+='|-----------|-------|-----------------|----------|\n';
      wsGroups[ws].forEach(e=>{
        const amp=e.ampel==='green'?'🟩':e.ampel==='orange'?'🟧':'🟥';
        const stand=(e.stand||'').replace(/\|/g,'/').replace(/\n/g,' ');
        const kom=(e.kommentar||'').replace(/\|/g,'/').replace(/\n/g,' ');
        md+='| '+e.kategorie+' | '+amp+' | '+stand+' | '+kom+' |\n';
      });
      md+='\n';
    });
  }
  // Team
  const tm=a.filter(e=>e._type==='team');
  if(tm.length){
    md+='## Teamuebersicht\n\n';
    md+='| Workstream | Bereich | HC | Offen | Ausbau | Status | Rollenmix | Schwerpunkt | Bemerkung |\n';
    md+='|------------|---------|---:|------:|--------|--------|-----------|-------------|-----------|\n';
    tm.forEach(e=>{
      const amp=e.status==='green'?'🟩':e.status==='orange'?'🟧':e.status==='red'?'🟥':'–';
      md+='| '+e.workstream+' | '+e.bereich+' | '+e.headcount+' | '+(e.offen||'–')+' | '+(e.ausbau||'–')+' | '+amp+' | '+(e.rollenmix||'').replace(/\|/g,'/')+' | '+(e.schwerpunkt||'')+' | '+(e.bemerkung||'').replace(/\|/g,'/').replace(/\n/g,' ')+' |\n';
    });
    md+='\n';
  }
  // Skill
  const sk=a.filter(e=>e._type==='skill');
  if(sk.length){
    md+='## Skill-Matrix\n\n';
    md+='| Workstream | Name | Rolle | Tech-Skills | Methodik | Soft Skills | Zertifikate | Ziel 2026 |\n';
    md+='|------------|------|-------|-------------|----------|-------------|-------------|-----------|\n';
    sk.forEach(e=>{
      md+='| '+e.workstream+' | '+e.name+' | '+e.rolle+' | '+fmtSk(e.tech)+' | '+fmtSk(e.methodik)+' | '+fmtSk(e.soft)+' | '+(e.zertifikate||'')+' | '+(e.ziel||'')+' |\n';
    });
    md+='\n';
  }
  md+='---\n*Generiert aus Unitleiter-Erfassung realcore · Transformation 2026–2029*\n';
  const b=new Blob([md],{type:'text/markdown;charset=utf-8'});
  dl(b,'Unitleiter_'+currentUnit.replace(/\W/g,'_')+'_'+today()+'.md');toast('Markdown exportiert!');}
async function clearAll(){
  if(!confirm('ALLE Eintraege dieser Unit loeschen?'))return;
  await api("/api/entries", { method: "DELETE" });
  await refreshEntries();
  renderOverview();
  renderExportStats();
  toast('Geloescht.','#e74c3c');
}
function dl(b,n){const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;a.click();URL.revokeObjectURL(a.href)}


function checkAdmin(){
  document.getElementById('tabAdmin').style.display = isAdmin ? '' : 'none';
}

async function renderAdminUsers(){
  if(!isAdmin) return;
  const users = await api("/api/admin/users");
  document.getElementById('admUserCount').textContent = users.length;
  const tbody = document.getElementById('admUsersBody');
  tbody.innerHTML = users.map(u => {
    const isProtected = u.email === currentEmail;
    return '<tr>'
      + '<td>' + esc(u.email) + '</td>'
      + '<td>' + esc(u.name) + '</td>'
      + '<td>' + esc(u.role) + '</td>'
      + '<td style="white-space:nowrap">'
      + '<button class="btn btn-sm btn-outline" onclick="adminEditUser(' + u.id + ', \'' + esc(u.email) + '\', \'' + esc(u.name) + '\', \'' + esc(u.role) + '\')">✏️</button> '
      + (isProtected ? '' : '<button class="btn btn-sm btn-danger" onclick="adminDeleteUser(' + u.id + ')">🗑️</button>')
      + '</td></tr>';
  }).join('');
}

async function adminAddUser(){
  const email = document.getElementById('adm_email').value.trim().toLowerCase();
  const nn = document.getElementById('adm_nachname').value.trim();
  const vn = document.getElementById('adm_vorname').value.trim();
  const pw = document.getElementById('adm_pw').value;
  const errEl = document.getElementById('admError');
  const okEl = document.getElementById('admSuccess');
  errEl.style.display='none'; okEl.style.display='none';

  if(!email||!nn||!vn||!pw){errEl.textContent='Bitte alle Felder ausfuellen.';errEl.style.display='block';return}
  if(!email.includes('@')){errEl.textContent='Bitte gueltige E-Mail eingeben.';errEl.style.display='block';return}

  try {
    await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, name: nn + ', ' + vn, password: pw, role: "unit_lead" })
    });
  } catch (error) {
    errEl.textContent = error.message;
    errEl.style.display = "block";
    return;
  }

  document.getElementById('adm_email').value='';
  document.getElementById('adm_nachname').value='';
  document.getElementById('adm_vorname').value='';
  document.getElementById('adm_pw').value='';
  okEl.textContent='Benutzer ' + email + ' angelegt.';okEl.style.display='block';
  await renderAdminUsers();
  toast('Benutzer angelegt!');
}

async function adminDeleteUser(id){
  if(!confirm('Benutzer wirklich loeschen?')) return;
  await api('/api/admin/users/' + id, { method: "DELETE" });
  await renderAdminUsers();
  toast('Benutzer geloescht.');
}

async function adminEditUser(id, email, name, role){
  const newPw = prompt('Neues Passwort fuer ' + email + ' (leer lassen fuer unveraendert):', '');
  if(newPw === null) return;
  const nameParts = name.split(', ');
  const newNn = prompt('Nachname:', nameParts[0] || '');
  if(newNn === null) return;
  const newVn = prompt('Vorname:', nameParts[1]||'');
  if(newVn === null) return;
  const newRole = prompt('Rolle (admin oder unit_lead):', role || 'unit_lead');
  if(newRole === null) return;

  await api('/api/admin/users/' + id, {
    method: "PUT",
    body: JSON.stringify({ name: newNn + ', ' + newVn, role: newRole, password: newPw || undefined })
  });
  await renderAdminUsers();
  toast('Benutzer aktualisiert!');
}

async function adminExportUsers(){
  const users = await api("/api/admin/users");
  const blob = new Blob([JSON.stringify(users, null, 2)], {type:'application/json'});
  dl(blob, 'realcore_benutzer_' + today() + '.json');
  toast('Benutzer exportiert!');
}

function adminResetUsers(){
  toast('Reset wurde aus Sicherheitsgruenden entfernt.','#e74c3c');
}

// Init
document.getElementById('s_datum').value=today();
bootSession();

window.doLogin = doLogin;
window.doLogout = doLogout;
window.cancelStatusEdit = cancelStatusEdit;
window.cancelTeamEdit = cancelTeamEdit;
window.cancelSkillEdit = cancelSkillEdit;
window.addSkillRow = addSkillRow;
window.editEntry = editEntry;
window.deleteEntry = deleteEntry;
window.exportJSON = exportJSON;
window.exportCSV = exportCSV;
window.exportMD = exportMD;
window.clearAll = clearAll;
window.adminAddUser = adminAddUser;
window.adminDeleteUser = adminDeleteUser;
window.adminEditUser = adminEditUser;
window.adminExportUsers = adminExportUsers;
window.adminResetUsers = adminResetUsers;
