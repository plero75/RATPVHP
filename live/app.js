/* ===============================
   Dashboard Hippodrome – Panneau public IDFM complet (horizontal times)
   =============================== */

const PROXY = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";
const PRIM_API_KEY = "7nAc6NHplCJtJ46Qw32QFtefq3TQEYrT";


const LINES_CODE = { RER_A:"C01742", BUS_77:"C02251", BUS_201:"C01219" };;const STOP_AREAS = { JOINVILLE:"STIF:StopArea:SP:43135:", HIPPODROME:"STIF:StopArea:SP:463641:", BREUIL:"STIF:StopArea:SP:463644:" };;const NAVITIA = (lineId, stopAreaId, dt) => `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/lines/line:IDFM:${lineId}/stop_areas/stop_area:IDFM:${stopAreaId}/stop_schedules?from_datetime=${dt}`;;
const APIS = {
  WEATHER: "https://api.open-meteo.com/v1/forecast?latitude=48.83&longitude=2.42&current_weather=true",
  SAINT: "https://nominis.cef.fr/json/nominis.php",
  RSS: "https://www.francetvinfo.fr/titres.rss",
  PRIM_STOP: (stopId) => `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stopId}`,
  PRIM_GM: (cCode) => `https://prim.iledefrance-mobilites.fr/marketplace/general-message?LineRef=STIF:Line::${cCode}:`,
  PMU: (day) => `https://offline.turfinfo.api.pmu.fr/rest/client/7/programme/${day}`,
  VELIB: (station) => `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/records?where=stationcode%3D${station}&limit=1`
};

const STOP_IDS = { JOINVILLE_RER: "STIF:StopArea:SP:43135:", HIPPODROME: "STIF:StopArea:SP:463641:", BREUIL: "STIF:StopArea:SP:463644:" };

const qs = (s, el=document) => el.querySelector(s);
const el = (tag, cls, html) => { const n=document.createElement(tag); if(cls) n.className=cls; if(html!=null) n.innerHTML=html; return n; };

function banner(msg){ const host=document.getElementById('prim-messages'); if(!host) return; host.prepend(el('div','message critical', msg)); }
async function fetchAPI(url, timeout=15000){ const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(), timeout); try { const isPrim = url.includes("prim.iledefrance-mobilites.fr/marketplace/"); const finalUrl = url.startsWith(PROXY) ? url : PROXY + encodeURIComponent(url); const init = isPrim ? { headers: { "apikey": PRIM_API_KEY, "Accept": "application/json" } } : {}; const f=url.startsWith(PROXY)?url:PROXY+encodeURIComponent(url); const r=await fetch(f,{signal:c.signal}); clearTimeout(t); if(!r.ok) throw new Error(`HTTP ${r.status}`); const ct=r.headers.get('content-type')||''; return ct.includes('application/json')? await r.json(): await r.text(); }catch(e){ clearTimeout(t); console.warn('fetchAPI failed:',url,e.message); banner(`Erreur API (${e.message})`); return null; }}

const clean=(s="")=>s.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
const minutesFromISO=(iso)=> iso? Math.max(0,Math.round((new Date(iso).getTime()-Date.now())/60000)):null;

const COLORS={ modes:{bus:'#0055c3','rer-a':'#e2223b'}, lines:{'77':'#0055c3','201':'#0055c3','A':'#e2223b','101':'#0055c3','106':'#0055c3','108':'#0055c3','110':'#0055c3','112':'#0055c3','111':'#0055c3','281':'#0055c3','317':'#0055c3','N33':'#662d91'} };
const colorFor=(g)=> COLORS.lines[g.lineId]||COLORS.modes[g.mode]||'#0055c3';

function setClock(){ const d=new Date(); qs('#datetime').textContent=`${d.toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})} – ${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`; }

async function loadWeather(){ const d=await fetchAPI(APIS.WEATHER); const t=d?.current_weather?.temperature; qs('#weather').textContent=Number.isFinite(t)? `${Math.round(t)}°C`:'–'; }
async function loadSaint(){ const d=await fetchAPI(APIS.SAINT); const p=d?.response?.prenom||d?.response?.prenoms?.[0]; qs('#saint').textContent=p? `Saint ${p}`:'Saint du jour'; }

async function loadTrafficMessages(){ const lines=[{label:'RER A',code:'C01742'},{label:'Bus 77',code:'C01399'},{label:'Bus 201',code:'C01219'}]; const out=[]; for(const {label,code} of lines){ const d=await fetchAPI(APIS.PRIM_GM(code)); if(!d?.Siri?.ServiceDelivery) continue; const dels=d.Siri.ServiceDelivery.GeneralMessageDelivery||[]; dels.forEach(x=> (x.InfoMessage||[]).forEach(m=>{ const txt=clean(m?.Content?.Message?.[0]?.MessageText?.[0]?.value||""); if(txt) out.push({label,txt,sev:m?.Content?.Severity||'info'}); })); } const box=qs('#prim-messages'); box.innerHTML=''; if(!out.length) { box.appendChild(el('div','message info', '✅ Aucune perturbation signalée sur le réseau')); } else { out.slice(0,3).forEach(i=> box.appendChild(el('div',`message ${i.sev}`, `<strong>${i.label}:</strong> ${i.txt}`))); } }

async function fetchStopData(stopId){ const d=await fetchAPI(APIS.PRIM_STOP(stopId)); const vs=d?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit||[]; return vs.map(v=>{ const mv=v.MonitoredVehicleJourney||{}; const call=mv.MonitoredCall||{}; const lineRef=mv.LineRef?.value||mv.LineRef||''; const lineId=(lineRef.match(/C\d{5}/)||[null])[0]; const dest=clean(call.DestinationDisplay?.[0]?.value||''); const expected=call.ExpectedDepartureTime||call.ExpectedArrivalTime||null; const aimed=call.AimedDepartureTime||call.AimedArrivalTime||null; const minutes=minutesFromISO(expected); let delayMin=null; if(expected&&aimed){ const d=Math.round((new Date(expected)-new Date(aimed))/60000); if(Number.isFinite(d)&&d>0) delayMin=d; } const cancelled=/cancel|annul|supprim/.test((call.DepartureStatus||call.ArrivalStatus||'').toLowerCase()); const atStop=/at.stop|quai|imminent/.test((call.DepartureStatus||call.ArrivalStatus||'').toLowerCase()); return { lineId,dest,expected,aimed,minutes,delayMin,cancelled,atStop,timeStr: expected? new Date(expected).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'' }; }); }

// Import helper horizontal
async function loadHorizontalHelper(){ if(!window.renderHorizontalTimes){ const s=document.createElement('script'); s.src='partials/horizontal-timeline.js'; document.head.appendChild(s); await new Promise(res=> s.onload=res); } }

function renderHorizontalTimes(trips){ return window.renderHorizontalTimes? window.renderHorizontalTimes(trips) : ''; }

function renderBoard(container, groups){ if (!container) return; groups=[...groups].sort((a,b)=>{ if(a.lineId==='A'&&b.lineId!=='A') return -1; if(a.lineId!=='A'&&b.lineId==='A') return 1; if(a.lineId===b.lineId) return (a.direction||'').localeCompare(b.direction||''); return (''+a.lineId).localeCompare(''+b.lineId,'fr',{numeric:true}); }); container.innerHTML=''; if(!groups.length) return container.appendChild(el('div','group', '<div class="row"><div class="info"><div class="dest">Aucune donnée transport disponible</div></div></div>')); groups.forEach(g=>{ const group=el('div','group'); const head=el('div','group-head'); const pill=el('div',`pill ${g.mode==='rer-a'?'rer-a':'bus'}`, g.mode==='rer-a'?'A':g.lineId); pill.style.background=colorFor(g); const dir=el('div','dir', g.direction || g.dest || ''); head.append(pill,dir); group.appendChild(head); const block=el('div','row'); block.innerHTML = renderHorizontalTimes(g.trips||[]); group.appendChild(block); container.appendChild(group); }); }

// LIGNES PAR ARRÊT
const STATIC_LINES={ 'rer-a': [{lineId:'A',mode:'rer-a',direction:'Vers Paris / La Défense'},{lineId:'A',mode:'rer-a',direction:'Vers Boissy‑Saint‑Léger'}], 'joinville-bus': [{lineId:'77',mode:'bus'},{lineId:'101',mode:'bus'},{lineId:'106',mode:'bus'},{lineId:'108',mode:'bus'},{lineId:'110',mode:'bus'},{lineId:'112',mode:'bus'},{lineId:'201',mode:'bus'},{lineId:'281',mode:'bus'},{lineId:'317',mode:'bus'},{lineId:'N33',mode:'bus'}], 'hippodrome': [{lineId:'77',mode:'bus',direction:'Direction Joinville RER'},{lineId:'77',mode:'bus',direction:'Direction Plateau de Gravelle'},{lineId:'111',mode:'bus'},{lineId:'112',mode:'bus'},{lineId:'201',mode:'bus'}], 'breuil': [{lineId:'77',mode:'bus',direction:'Direction Joinville RER'},{lineId:'201',mode:'bus',direction:'Direction Porte Dorée'},{lineId:'112',mode:'bus'}] };

const LINE_CODES={'77':'C01399','201':'C01219','A':'C01742','101':'C01260','106':'C01371','108':'C01374','110':'C01376','112':'C01379','111':'C01377','281':'C01521','317':'C01693','N33':'C01833'};

async function loadTransportData(){ await loadHorizontalHelper(); const [joinvilleData, hippoData, breuilData] = await Promise.all([ fetchStopData(STOP_IDS.JOINVILLE_RER), fetchStopData(STOP_IDS.HIPPODROME), fetchStopData(STOP_IDS.BREUIL) ]); function mergeStaticWithRealtime(staticLines, realTimeData, useTheoretical=true) { return staticLines.map(st => { const cCode = LINE_CODES[st.lineId]; const liveTrips = realTimeData.filter(v => v.lineId === cCode); if(liveTrips.length > 0) { return { ...st, trips: liveTrips.slice(0, 3).map(v => ({ waitMin: v.minutes, timeStr: v.timeStr, aimed: v.aimed, dest: v.dest, delayMin: v.delayMin, cancelled: v.cancelled, atStop: v.atStop })), hasRealTimeData: true }; } else { const theoretical = generateTheoretical(st.lineId); return { ...st, trips: theoretical.slice(0, 3).map(th => ({ waitMin: th.waitMin, timeStr: th.aimedTime, aimed: th.aimed, dest: th.dest, delayMin: 0, cancelled: false, atStop: false })), hasRealTimeData: false }; } }); } const rerGroups = mergeStaticWithRealtime(STATIC_LINES['rer-a'], joinvilleData); renderBoard(qs('#board-rer-a'), rerGroups); const joinvilleBusGroups = mergeStaticWithRealtime(STATIC_LINES['joinville-bus'], joinvilleData); renderBoard(qs('#board-joinville-bus'), joinvilleBusGroups); const hippoGroups = mergeStaticWithRealtime(STATIC_LINES['hippodrome'], hippoData); renderBoard(qs('#board-hippodrome'), hippoGroups); const breuilGroups = mergeStaticWithRealtime(STATIC_LINES['breuil'], breuilData); renderBoard(qs('#board-breuil'), breuilGroups); }

// Théorique
function generateTheoretical(lineId, now=new Date()){ const base=now.getTime(); const freq={'A':4,'77':6,'201':8,'101':12,'106':10,'108':9,'110':11,'112':15,'111':13,'281':18,'317':20,'N33':30}[lineId]||10; const trips=[]; for(let i=0;i<6;i++){ const offset=freq*i*60*1000 + (Math.random()-0.5)*120*1000; if(offset>2*60*60*1000) break; const aimedTime=new Date(base+offset); trips.push({ aimed: aimedTime.toISOString(), aimedTime: aimedTime.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}), waitMin: Math.round(offset/60000), dest: getDestination(lineId, i) }); } return trips.filter(t=>t.waitMin>=0&&t.waitMin<=120); }
function getDestination(lineId, index){ const map={'A': index%2?'Boissy-Saint-Léger':'La Défense - Châtelet','77': index%2?'Joinville RER':'Plateau de Gravelle','201': index%2?'Champigny la Plage':'Porte Dorée','101':'Château de Vincennes','106':'Créteil Université','108':'Maisons-Alfort','110':'Créteil Préfecture','112':'École du Breuil','111':'République','281':'Torcy RER','317':'Val-de-Fontenay','N33':'Château de Vincennes'}; return map[lineId]||`Terminus ${lineId}`; }

async function loadNews(){ const xml=await fetchAPI(APIS.RSS); if(!xml) return qs('#news').textContent='Actualités indisponibles'; const doc=new DOMParser().parseFromString(xml,'application/xml'); const nodes=[...doc.querySelectorAll('item')].slice(0,6); qs('#news').innerHTML=nodes.length? nodes.map(n=>`<div class="news-item"><strong>${clean(n.querySelector('title')?.textContent||'')}</strong></div>`).join('') : 'Aucune actualité'; }
async function loadVelib(){ const [d1,d2]=await Promise.all([fetchAPI(APIS.VELIB('12163')),fetchAPI(APIS.VELIB('12128'))]); const v1=d1?.results?.[0]; if(v1) qs('#velib-vincennes').textContent=`${v1.numbikesavailable||0} vélos – ${v1.numdocksavailable||0} libres`; const v2=d2?.results?.[0]; if(v2) qs('#velib-breuil').textContent=`${v2.numbikesavailable||0} vélos – ${v2.numdocksavailable||0} libres`; }
async function loadCourses(){ const today = new Date(); const day = `${String(today.getDate()).padStart(2,'0')}${String(today.getMonth()+1).padStart(2,'0')}${today.getFullYear()}`; const data = await fetchAPI(APIS.PMU(day)); const vin=[],eng=[]; (data?.programme?.reunions||[]).forEach(r=>{ const hip=r.hippodrome?.code; const list=hip==='VIN'?vin:hip==='ENG'?eng:null; if(!list) return; (r.courses||[]).slice(0,4).forEach(c=>{ const ts=Date.parse(c.heureDepart); if(ts>Date.now()) list.push(`<strong>${new Date(ts).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</strong> - ${c.libelle||'Course'} (${c.numOrdre?`C${c.numOrdre}`:''})`); }); }); qs('#races-vincennes').innerHTML=vin.length? vin.join('<br>') :'Aucune course aujourd\'hui'; qs('#races-enghien').innerHTML=eng.length? eng.join('<br>') :'Aucune course aujourd\'hui'; }

let pollInterval=60_000; function adaptPolling(){ const h=new Date().getHours(); if(h>=6&&h<=9||h>=17&&h<=20) pollInterval=45_000; else if(h>=22||h<=5) pollInterval=300_000; else pollInterval=90_000; }
let transportTimer; function scheduleTransportRefresh(){ clearTimeout(transportTimer); transportTimer=setTimeout(()=>{ loadTransportData().then(scheduleTransportRefresh); }, pollInterval); }

async function init(){ setClock(); setInterval(setClock,30_000); adaptPolling(); setInterval(adaptPolling, 10*60_000); await Promise.allSettled([ loadWeather(),loadSaint(),loadTrafficMessages(),loadTransportData(),loadNews(),loadVelib(),loadCourses() ]); scheduleTransportRefresh(); setInterval(loadTrafficMessages, 300_000); setInterval(()=>Promise.allSettled([loadNews(),loadVelib(),loadCourses()]), 600_000); }

init().catch(console.error);

function groupByDestination(visits){ const groups={}; (visits||[]).forEach(v=>{ const dest=v?.MonitoredVehicleJourney?.DestinationName?.[0]?.value||'—'; (groups[dest]||(groups[dest]=[])).push(v); }); return groups; }

async function ymdhm(d=new Date()){
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}
async function getRERPlanned(){
  const dt = await ymdhm(new Date());
  const url = NAVITIA(LINES_CODE.RER_A, "70640", dt);
  const data = await fetchAPI(url);
  try{
    const ss = data?.stop_schedules?.[0];
    const ds = ss?.date_times||[];
    const times = ds.map(x=>x?.date).filter(Boolean);
    times.sort();
    const first = times[0] ? times[0].slice(9,11)+':'+times[0].slice(11,13) : null;
    const last  = times[times.length-1] ? times[times.length-1].slice(9,11)+':'+times[times.length-1].slice(11,13) : null;
    return {first,last};
  }catch(e){ return {first:null,last:null}; }
}

async function renderRER(){
  const board = qs('#board-rer-a');
  if(!board) return;
  board.innerHTML = 'Chargement…';
  const data = await fetchAPI(APIS.PRIM_STOP(STOP_AREAS.JOINVILLE));
  const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
  if(visits.length===0){
    const planned = await getRERPlanned();
    const msg = planned.first ? `Service terminé — prochain passage à ${planned.first}` : 'Service terminé — prochains horaires indisponibles';
    board.innerHTML = `<div class="row ended">${msg}</div>`;
    return;
  }
  const groups = groupByDestination(visits);
  board.innerHTML = Object.entries(groups).map(([dest, arr])=>{
    const items = arr.slice(0,4).map(v=>{
      const mvj = v.MonitoredVehicleJourney||{};
      const est = mvj.MonitoredCall?.ExpectedDepartureTime || mvj.MonitoredCall?.ExpectedArrivalTime;
      const sch = mvj.MonitoredCall?.AimedDepartureTime || mvj.MonitoredCall?.AimedArrivalTime;
      const delayMin = est && sch ? Math.round((new Date(est)-new Date(sch))/60000) : 0;
      const immin = est ? ( (new Date(est)-Date.now())/60000 < 1.5 ) : false;
      const cancelled = mvj.Monitored? false : (mvj?.MonitoredCall?.DepartureStatus==='cancelled' || v?.MonitoredCall?.DepartureStatus==='cancelled');
      const hh = (d)=> d? new Date(d).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '—:—';
      const delayTxt = delayMin>0 ? `<span class="delay">retardé de +${delayMin} min</span>` : '';
      const imminTxt = immin ? `<span class="imminent">🟢 imminent</span>` : '';
      const cancelTxt = cancelled ? `<span class="cancelled">❌ supprimé</span>` : '';
      const aimed = sch ? `<s>${hh(sch)}</s>` : '';
      return `<div class="cell">${aimed} <strong>${hh(est)}</strong> ${delayTxt} ${imminTxt} ${cancelTxt} ${lastFlagIfNeeded(est, planned?.last)}</div>`;
    }).join('');
    return `<div class="dest-group"><div class="dest-head">→ ${dest}</div><div class="cells">${items}</div></div>`;
  }).join('');
}

async function renderTrafficBanners(){
  const blocks = [
    { sel:'#board-rer-a', code: LINES_CODE.RER_A, label:'RER A' },
    { sel:'#board-hippodrome', code: LINES_CODE.BUS_77, label:'Bus 77' },
    { sel:'#board-breuil', code: LINES_CODE.BUS_201, label:'Bus 201' }
  ];
  for(const b of blocks){
    const url = APIS.PRIM_GM(b.code);
    const d = await fetchAPI(url);
    const list = d?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage || [];
    if(list.length){
      const txt = list.map(x=> (x?.Content?.Message?.[0]?.MessageText?.[0]?.value || '').trim()).filter(Boolean).join(' • ');
      const panel = document.querySelector(b.sel)?.closest('.transport-panel');
      if(panel){
        let bar = panel.querySelector('.traffic-banner');
        if(!bar){ bar = document.createElement('div'); bar.className='traffic-banner'; panel.prepend(bar); }
        bar.innerHTML = `⚠️ ${txt}`;
      }
    }
  }
}


// Découverte des lignes de bus d'une zone (PRIM /v2/navitia) – retourne [{id, code, name}]
async function discoverBusLines(stopAreaId){
  const url = `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_areas/stop_area:IDFM:${stopAreaId}/lines?count=200`;
  const data = await fetchAPI(url);
  const lines = (data?.lines||[]).map(l=>{
    const id = (l?.id||'').split(':').pop(); // ex "line:IDFM:C01219" -> "C01219"
    return { 
      id,
      navitiaId: l?.id,
      code: l?.code || id || '',
      name: l?.name || l?.label || l?.code || id || ''
    };
  });
  // Filtrer les lignes non-bus si nécessaire (Navitia donne 'physical_modes' mais optionnel ici)
  return lines.filter(x=>x.id && /^C\d+/.test(x.id));
}


// Retourne "HH:MM" depuis date Navitia (YYYYMMDDThhmmss)
const hhmmFromNavitia = (dt) => dt ? `${dt.slice(9,11)}:${dt.slice(11,13)}` : null;

// Fallback GTFS: récupère prochains horaires planifiés pour une ligne donnée à Joinville
async function getPlannedForLine(lineCode, fromDate=new Date()){
  const dt = await ymdhm(fromDate);
  const url = NAVITIA(lineCode, "70640", dt);
  const data = await fetchAPI(url);
  const ss = data?.stop_schedules?.[0];
  const dts = (ss?.date_times||[]).map(x=>x?.date).filter(Boolean);
  if (dts.length) {
    return { next: dts.slice(0,4).map(hhmmFromNavitia), first: hhmmFromNavitia(dts[0]), last: hhmmFromNavitia(dts[dts.length-1]) };
  }
  // Si rien aujourd'hui après "dt", tenter au lendemain 00:01
  const nextDay = new Date(fromDate); nextDay.setDate(nextDay.getDate()+1); nextDay.setHours(0,1,0,0);
  const url2 = NAVITIA(lineCode, "70640", await ymdhm(nextDay));
  const data2 = await fetchAPI(url2);
  const ss2 = data2?.stop_schedules?.[0];
  const dts2 = (ss2?.date_times||[]).map(x=>x?.date).filter(Boolean);
  return { next: dts2.slice(0,4).map(hhmmFromNavitia), first: hhmmFromNavitia(dts2[0])||null, last: hhmmFromNavitia(dts2[dts2.length-1])||null };
}

// Rendu d'un bloc "ligne de bus" avec temps réel + fallback prévu, toujours visible
function renderBusLineBlock(container, meta, visits){
  const wrap = document.createElement('div');
  wrap.className = 'line-block';
  const title = document.createElement('div');
  title.className = 'line-head';
  title.innerHTML = `🚌 <span class="chip">${meta.code || meta.id}</span> <strong>${meta.name||''}</strong>`;
  wrap.appendChild(title);

  const body = document.createElement('div'); body.className='line-body';
  // Groupement par destination
  const groups = groupByDestination(visits||[]);
  const keys = Object.keys(groups);
  if(keys.length){
    keys.forEach(dest=>{
      const arr = groups[dest].slice(0,4);
      const row = document.createElement('div');
      row.className='dest-row';
      const cells = arr.map(v=>{
        const mvj = v.MonitoredVehicleJourney||{};
        const est = mvj.MonitoredCall?.ExpectedDepartureTime || mvj.MonitoredCall?.ExpectedArrivalTime;
        const sch = mvj.MonitoredCall?.AimedDepartureTime || mvj.MonitoredCall?.AimedArrivalTime;
        const delayMin = est && sch ? Math.round((new Date(est)-new Date(sch))/60000) : 0;
        const immin = est ? ((new Date(est)-Date.now())/60000 < 1.5) : false;
        const cancelled = mvj.Monitored? false : (mvj?.MonitoredCall?.DepartureStatus==='cancelled');
        const hh = (d)=> d? new Date(d).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '—:—';
        const aimed = sch ? `<s>${hh(sch)}</s>` : '';
        const delayTxt = delayMin>0 ? `<span class="delay">+${delayMin} min</span>` : '';
        const imminTxt = immin ? `<span class="imminent">🟢</span>` : '';
        const cancelTxt = cancelled ? `<span class="cancelled">❌</span>` : '';
        return `<div class="cell">${aimed} <strong>${hh(est)}</strong> ${delayTxt} ${imminTxt} ${cancelTxt} ${lastFlagIfNeeded(est, planned?.last)}</div>`;
      }).join('');
      row.innerHTML = `<div class="dest-head">→ ${dest}</div><div class="cells">${cells}</div>`;
      body.appendChild(row);
    });
  } else {
    // Si pas de temps réel, on mettra 'Aucun passage imminent' et on laissera le fallback compléter
    const empty = document.createElement('div');
    empty.className = 'no-realtime';
    empty.textContent = 'Aucun passage imminent';
    body.appendChild(empty);
  }

  wrap.appendChild(body);
  container.appendChild(wrap);
  return wrap;
}

// Récupère temps réel PRIM SIRI pour une ligne spécifique à Joinville
async function getRealtimeForLine(lineCode){
  const url = `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${STOP_AREAS.JOINVILLE}&LineRef=STIF:Line::${lineCode}:`;
  const d = await fetchAPI(url);
  return d?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
}

// Rendu de tous les bus à Joinville (découverte dynamique, tjs visibles)
async function renderJoinvilleAllBuses(){
  const mount = qs('#board-joinville-bus');
  if(!mount) return;
  mount.innerHTML = 'Chargement des lignes…';

  const lines = await discoverBusLines("70640"); // Joinville-le-Pont
  // Tri alphanumérique naturel
  lines.sort((a,b)=>(a.code||a.id).localeCompare(b.code||b.id,'fr',{numeric:true}));

  mount.innerHTML = '';
  for(const meta of lines){
    const box = renderBusLineBlock(mount, meta, []);
    // Charger temps réel + fallback asynchrone par ligne
    (async ()=>{
      const visits = await getRealtimeForLine(meta.id);
      if(visits && visits.length){
        // re-render inside box body
        const body = box.querySelector('.line-body'); if(body) body.innerHTML='';
        const groups = groupByDestination(visits);
        Object.entries(groups).forEach(([dest, arr])=>{
          const items = arr.slice(0,4).map(v=>{
            const mvj = v.MonitoredVehicleJourney||{};
            const est = mvj.MonitoredCall?.ExpectedDepartureTime || mvj.MonitoredCall?.ExpectedArrivalTime;
            const sch = mvj.MonitoredCall?.AimedDepartureTime || mvj.MonitoredCall?.AimedArrivalTime;
            const delayMin = est && sch ? Math.round((new Date(est)-new Date(sch))/60000) : 0;
            const immin = est ? ((new Date(est)-Date.now())/60000 < 1.5) : false;
            const cancelled = mvj.Monitored? false : (mvj?.MonitoredCall?.DepartureStatus==='cancelled');
            const hh = (d)=> d? new Date(d).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '—:—';
            const aimed = sch ? `<s>${hh(sch)}</s>` : '';
            const delayTxt = delayMin>0 ? `<span class="delay">+${delayMin} min</span>` : '';
            const imminTxt = immin ? `<span class="imminent">🟢</span>` : '';
            const cancelTxt = cancelled ? `<span class="cancelled">❌</span>` : '';
            return `<div class="cell">${aimed} <strong>${hh(est)}</strong> ${delayTxt} ${imminTxt} ${cancelTxt} ${lastFlagIfNeeded(est, planned?.last)}</div>`;
          }).join('');
          const row = document.createElement('div'); row.className='dest-row';
          row.innerHTML = `<div class="dest-head">→ ${dest}</div><div class="cells">${items}</div>`;
          const body = box.querySelector('.line-body'); if(body) body.appendChild(row);
        });
      } else {
        // Fallback planifié
        const planned = await getPlannedForLine(meta.id);
        const info = document.createElement('div'); info.className='planned';
        if (planned && (!planned.next || planned.next.length===0)) {
          if (planned.first) info.textContent = `Service terminé — prochain passage à ${planned.first}`;
          else info.textContent = `Service terminé — prochains horaires indisponibles`;
        } else {
          info.textContent = `Prochains passages (GTFS) : ${(planned.next||[]).join(' • ')}`;
        }
        const body = box.querySelector('.line-body'); if(body) body.appendChild(info);
      }
    })();
  }
}

window.addEventListener('load', ()=>{ try{ renderGlobalMessages(); }catch(e){} });

window.addEventListener('load', ()=>{ try{ renderPerLineMessages(); }catch(e){} });


// Map PRIM general-message item to severity class
function gmSeverity(item){
  const sev = (item?.InfoMessageVersionedReference?.InfoChannelRef || '').toLowerCase();
  // Some feeds set severity in 'Priority' or 'Audience'
  const pr = (item?.Priority || '').toString();
  if (sev.includes('critical') || pr === '1') return 'traffic-critical';
  if (sev.includes('alert') || sev.includes('warning') || pr === '2') return 'traffic-warning';
  return 'traffic-info';
}
function gmText(item){
  const t = item?.Content?.Message?.[0]?.MessageText?.[0]?.value || '';
  return t.replace(/\s+/g,' ').trim();
}


async function renderGlobalMessages(){
  const mount = document.querySelector('#prim-messages .message');
  if(!mount) return;
  // Collect lines to check: RER A, 77, 201 + dynamically discovered buses at Joinville (if available in DOM cache)
  const codes = new Set([LINES_CODE.RER_A, LINES_CODE.BUS_77, LINES_CODE.BUS_201]);
  try {
    const d = await discoverBusLines("70640");
    d.forEach(l=>codes.add(l.id));
  } catch(e){}
  const all = [];
  for(const code of codes){
    const d = await fetchAPI(APIS.PRIM_GM(code));
    const list = d?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage || [];
    for(const it of list){
      const txt = gmText(it); if(!txt) continue;
      const cls = gmSeverity(it);
      all.push({code, txt, cls});
    }
  }
  // Deduplicate by (txt)
  const dedup = [];
  const seen = new Set();
  for(const m of all){
    const key = m.txt;
    if(seen.has(key)) continue;
    seen.add(key); dedup.push(m);
  }
  if(!dedup.length){
    mount.className = 'message';
    mount.textContent = '✅ Aucun incident majeur signalé sur le réseau.';
    return;
  }
  // Sort by severity: critical > warning > info
  const rank = (c)=> c==='traffic-critical'?0 : c==='traffic-warning'?1 : 2;
  dedup.sort((a,b)=> rank(a.cls)-rank(b.cls));
  mount.innerHTML = dedup.map(m => `<div class="traffic-banner ${m.cls}">⚠️ ${m.code} — ${m.txt}</div>`).join('');
}


async function renderPerLineMessages(){
  // Panels mapping: selector -> set of line codes to attach banner to
  const map = [
    { sel:'#board-rer-a', lines:[LINES_CODE.RER_A] },
    { sel:'#board-hippodrome', lines:[LINES_CODE.BUS_77] },
    { sel:'#board-breuil', lines:[LINES_CODE.BUS_201] },
  ];
  // Dynamically add ALL Joinville bus lines to '#board-joinville-bus'
  try{
    const d = await discoverBusLines("70640");
    const codes = d.map(x=>x.id);
    map.push({ sel:'#board-joinville-bus', lines: codes });
  }catch{}
  for(const m of map){
    const panel = document.querySelector(m.sel)?.closest('.transport-panel');
    if(!panel) continue;
    // Aggregate all messages for these lines
    const banners = [];
    for(const code of m.lines){
      const res = await fetchAPI(APIS.PRIM_GM(code));
      const list = res?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage || [];
      for(const it of list){
        const txt = gmText(it); if(!txt) continue;
        const cls = gmSeverity(it);
        banners.push({txt, cls});
      }
    }
    // Dedup & render
    const out = [];
    const seen = new Set();
    for(const b of banners){
      if(seen.has(b.txt)) continue;
      seen.add(b.txt); out.push(b);
    }
    let bar = panel.querySelector('.traffic-banner');
    if(!bar){ bar = document.createElement('div'); bar.className='traffic-banner'; panel.prepend(bar); }
    if(out.length===0){
      bar.className = 'traffic-banner traffic-info no-perturbation';
      bar.textContent = 'Aucune perturbation signalée.';
    }else{
      // choose highest severity among messages
      const level = out.reduce((acc,cur)=> acc==='traffic-critical'?acc : (cur.cls==='traffic-critical'?cur.cls : (acc==='traffic-warning'?acc:cur.cls)), 'traffic-info');
      bar.className = 'traffic-banner ' + level;
      bar.innerHTML = out.map(x=>`⚠️ ${x.txt}`).join(' • ');
    }
  }
}


function lastFlagIfNeeded(estISO, plannedLastHHMM){
  if(!estISO || !plannedLastHHMM) return '';
  const d = new Date(estISO);
  const hh = d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  // Consider ±5 min tolerance
  const [plH, plM] = plannedLastHHMM.split(':').map(n=>parseInt(n,10));
  const planned = new Date(d); planned.setHours(plH, plM, 0, 0);
  const diffMin = Math.abs((d - planned)/60000);
  if(diffMin <= 5) return `<span class="last-flag">Dernier passage</span>`;
  return '';
}
