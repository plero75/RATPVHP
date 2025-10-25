
// ========== CONFIG ==========
const PROXY = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";
const PRIM_API_KEY = "7nAc6NHplCJtJ46Qw32QFtefq3TQEYrT"; // remplace si besoin

const STOP_AREAS = {
  JOINVILLE: "STIF:StopArea:SP:43135:",
  JOINVILLE_IDFM: "70640",
  HIPPODROME_77: "STIF:StopArea:SP:463641:",
  BREUIL_77_201: "STIF:StopArea:SP:463644:"
};
const LINES_CODE = { RER_A:"C01742", BUS_77:"C02251", BUS_201:"C01219", N33:"C01325" };

const APIS = {
  PRIM_STOP: (stopRef, lineRef=null) => {
    const u = new URL("https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring");
    u.searchParams.set("MonitoringRef", stopRef);
    if(lineRef) u.searchParams.set("LineRef", `STIF:Line::${lineRef}:`);
    return u.toString();
  },
  PRIM_GM: (lineCode) => `https://prim.iledefrance-mobilites.fr/marketplace/general-message?LineRef=STIF:Line::${lineCode}:`,
  NAVITIA_LINES: (stopAreaId) => `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_areas/stop_area:IDFM:${stopAreaId}/lines?count=200`,
  NAVITIA_SCHEDULE: (lineCode, stopAreaId, dt) => `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/lines/line:IDFM:${lineCode}/stop_areas/stop_area:IDFM:${stopAreaId}/stop_schedules?from_datetime=${dt}`,
  METEO: (lat=48.835, lon=2.45) => `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code`,
  FRANCEINFO: () => `https://www.francetvinfo.fr/titres.rss`,
  VELIB_STATUS: () => `https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_status.json`,
  VELIB_INFO: () => `https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_information.json`,
};

// ========== DEBUG HELPERS ==========
const badge = () => document.getElementById('proxy-badge');
function group(title, color="#0a7"){ console.groupCollapsed(`%c${title}`, `color:${color};font-weight:bold`); }
function gend(){ console.groupEnd(); }
function logOK(msg, color="#0a7"){ console.log(`%c${msg}`, `color:${color}`); }
function logERR(msg){ console.error(`%c${msg}`, "color:#c62828;font-weight:bold"); }

let lastProxyOK = null;
function setProxyBadge(ok){
  lastProxyOK = ok;
  const b = badge();
  if(!b) return;
  b.textContent = ok ? "Proxy: OK" : "Proxy: erreur";
  b.classList.remove("ok","err");
  b.classList.add(ok ? "ok" : "err");
}

// ========== UTILS ==========
const qs = (s, el=document)=> el.querySelector(s);
const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));
function hhmm(d){ if(!d) return "—:—"; const dt=new Date(d); return dt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }
function ymdhm(d=new Date()){ const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`; }

async function fetchAPI(url, timeout=15000){
  const t0 = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeout);
  try{
    const isPrim = url.includes("prim.iledefrance-mobilites.fr/marketplace/");
    const proxied = PROXY + encodeURIComponent(url);
    const init = isPrim ? { headers: { "apikey": PRIM_API_KEY, "Accept":"application/json" } } : {};

    group(`FETCH ${isPrim?'[PRIM] ':''}${url.split('?')[0]}`, isPrim? "#0a7":"#555");
    console.log("→ via proxy:", proxied);

    let resp = await fetch(proxied, { ...init, signal: controller.signal });
    console.log("← proxy status:", resp.status);
    if(isPrim) setProxyBadge(resp.ok);

    if(!resp.ok && isPrim){ // fallback only meaningful for PRIM
      logERR("proxy KO → fallback direct PRIM");
      try{
        resp = await fetch(url, { ...init, signal: controller.signal });
        console.log("← direct status:", resp.status);
      }catch(e){
        logERR("direct PRIM fetch failed: "+e.message);
      }
    }
    if(!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const ct = resp.headers.get('content-type')||'';
    const dur = Math.round(performance.now()-t0);
    console.log("content-type:", ct, "| durée:", dur+"ms");
    gend();

    if(ct.includes('xml')) return await resp.text();
    return await resp.json();
  } catch(e){
    gend();
    logERR("fetchAPI error: "+e.message);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
async function fetchText(url){
  group(`GET (text) ${url}`,"#09f");
  const r = await fetch(url);
  console.log("status:", r.status);
  gend();
  if(!r.ok) throw new Error(r.status);
  return await r.text();
}

function groupByDestination(visits){
  const groups={};
  (visits||[]).forEach(v=>{
    const dest=v?.MonitoredVehicleJourney?.DestinationName?.[0]?.value||'—';
    (groups[dest]||(groups[dest]=[])).push(v);
  });
  return groups;
}

// ========== HEADER stuff ==========
function tickClock(){
  const d=new Date();
  qs('#clock').textContent=d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
}
async function loadNews(){
  try{
    const xml = await fetchAPI(APIS.FRANCEINFO());
    const items = typeof xml==='string' ? [...xml.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>/g)].map(m=>m[1]).slice(0,6) : [];
    qs('#news-ticker').textContent = items.length? items.join(" • ") : "Actualités indisponibles";
  }catch{ qs('#news-ticker').textContent="Actualités indisponibles"; }
}

// ========== RER A ==========
async function getRERPlanned(){
  const dt = ymdhm(new Date());
  const u = APIS.NAVITIA_SCHEDULE(LINES_CODE.RER_A, STOP_AREAS.JOINVILLE_IDFM, dt);
  const d = await fetchAPI(u);
  try{
    const arr = (d?.stop_schedules?.[0]?.date_times||[]).map(x=>x?.date).filter(Boolean);
    arr.sort();
    const hh=t=>t?(t.slice(9,11)+':'+t.slice(11,13)):null;
    return { first:hh(arr[0]), next:arr.slice(0,4).map(hh) };
  }catch{ return { first:null, next:[] }; }
}
async function renderRER(){
  group("RER A","purple"); const board = qs('#board-rer-a'); board.innerHTML="Chargement…";
  try{
    const d = await fetchAPI(APIS.PRIM_STOP(STOP_AREAS.JOINVILLE, LINES_CODE.RER_A));
    const visits = d?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    if(!visits.length){
      const p = await getRERPlanned();
      board.innerHTML = `<div class="row ended">${p.first?`Service terminé — prochain passage à ${p.first}`:'Service terminé — prochains horaires indisponibles'}</div>`;
    }else{
      const groups = groupByDestination(visits);
      board.innerHTML = Object.entries(groups).map(([dest, arr])=>{
        const items = arr.slice(0,4).map(v=>{
          const mvj=v.MonitoredVehicleJourney||{};
          const est=mvj.MonitoredCall?.ExpectedDepartureTime||mvj.MonitoredCall?.ExpectedArrivalTime;
          const sch=mvj.MonitoredCall?.AimedDepartureTime||mvj.MonitoredCall?.AimedArrivalTime;
          const delay = est&&sch? Math.round((new Date(est)-new Date(sch))/60000):0;
          const imin = est? ((new Date(est)-Date.now())/60000<1.5):false;
          const cancelled = mvj?.MonitoredCall?.DepartureStatus==='cancelled';
          return `<div class="cell">${sch?`<s>${hhmm(sch)}</s>`:''} <strong>${hhmm(est)}</strong> ${delay>0?`<span class="delay">+${delay} min</span>`:''} ${imin?`<span class="imminent">🟢 imminent</span>`:''} ${cancelled?`<span class="cancelled">❌ supprimé</span>`:''}</div>`;
        }).join('');
        return `<div class="dest-group"><div class="dest-head">→ ${dest}</div><div class="cells">${items}</div></div>`;
      }).join('');
    }
  }catch{ board.innerHTML='<div class="row ended">RER indisponible</div>'; }
  try{
    const g = await fetchAPI(APIS.PRIM_GM(LINES_CODE.RER_A));
    const list = g?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage || [];
    if(list.length){
      const txt = list.map(x=> (x?.Content?.Message?.[0]?.MessageText?.[0]?.value||'').trim()).filter(Boolean).join(' • ');
      const bar = qs('#traffic-rer-a'); bar.textContent=`⚠️ ${txt}`; bar.classList.remove('hidden');
      qs('.panel-head.red').innerHTML = `Grosse perturbation RER A : <span>${txt}</span>`;
    }
  }catch{}
  gend();
}

// ========== BUS ==========
async function discoverBusLines(stopAreaId){
  const d = await fetchAPI(APIS.NAVITIA_LINES(stopAreaId));
  const lines = (d?.lines||[]).map(l=>{
    const id=(l?.id||'').split(':').pop();
    return { id, code:l?.code||id, name:l?.name||l?.label||id };
  }).filter(x=>x.id && /^C\d+/.test(x.id));
  lines.sort((a,b)=>(a.code||a.id).localeCompare(b.code||b.id,'fr',{numeric:true}));
  logOK(`lignes détectées: ${lines.map(x=>x.code).join(', ')}`,"#0a7");
  return lines;
}
async function getRealtimeForLine(lineCode, stopRef){
  const url = APIS.PRIM_STOP(stopRef, lineCode);
  const d = await fetchAPI(url);
  return d?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
}
function renderBusLineBlock(container, meta, visits){
  const wrap=document.createElement('div'); wrap.className='line-block';
  const title=document.createElement('div'); title.className='line-head'; title.innerHTML=`🚌 <span class="chip">${meta.code||meta.id}</span> <strong>${meta.name||''}</strong>`; wrap.appendChild(title);
  const body=document.createElement('div'); body.className='line-body';
  const groups = groupByDestination(visits||[]);
  const keys = Object.keys(groups);
  if(keys.length){
    keys.forEach(dest=>{
      const arr = groups[dest].slice(0,4);
      const row = document.createElement('div'); row.className='dest-row';
      const cells = arr.map(v=>{
        const mvj=v.MonitoredVehicleJourney||{};
        const est=mvj.MonitoredCall?.ExpectedDepartureTime||mvj.MonitoredCall?.ExpectedArrivalTime;
        const sch=mvj.MonitoredCall?.AimedDepartureTime||mvj.MonitoredCall?.AimedArrivalTime;
        const delay=est&&sch? Math.round((new Date(est)-new Date(sch))/60000):0;
        const imin=est? ((new Date(est)-Date.now())/60000<1.5):false;
        const cancelled = mvj?.MonitoredCall?.DepartureStatus==='cancelled';
        return `<div class="cell">${sch?`<s>${hhmm(sch)}</s>`:''} <strong>${hhmm(est)}</strong> ${delay>0?`<span class="delay">+${delay} min</span>`:''} ${imin?`<span class="imminent">🟢</span>`:''} ${cancelled?`<span class="cancelled">❌</span>`:''}</div>`;
      }).join('');
      row.innerHTML=`<div class="dest-head">→ ${dest}</div><div class="cells">${cells}</div>`; body.appendChild(row);
    });
  } else {
    const empty=document.createElement('div'); empty.className='no-realtime'; empty.textContent='Aucun passage imminent'; body.appendChild(empty);
  }
  wrap.appendChild(body); container.appendChild(wrap); return wrap;
}
async function getPlannedForLine(lineCode, fromDate=new Date()){
  const dt = ymdhm(fromDate);
  const d = await fetchAPI(APIS.NAVITIA_SCHEDULE(lineCode, STOP_AREAS.JOINVILLE_IDFM, dt));
  const ss = d?.stop_schedules?.[0];
  const dts = (ss?.date_times||[]).map(x=>x?.date).filter(Boolean);
  const hh = (t)=> t ? (t.slice(9,11)+':'+t.slice(11,13)) : null;
  if(dts.length) return { next:dts.slice(0,4).map(hh), first:hh(dts[0]) };
  const nextDay=new Date(fromDate); nextDay.setDate(nextDay.getDate()+1); nextDay.setHours(0,1,0,0);
  const d2 = await fetchAPI(APIS.NAVITIA_SCHEDULE(lineCode, STOP_AREAS.JOINVILLE_IDFM, ymdhm(nextDay)));
  const dts2 = (d2?.stop_schedules?.[0]?.date_times||[]).map(x=>x?.date).filter(Boolean);
  return { next:(dts2||[]).slice(0,4).map(hh), first:hh(dts2?.[0]) };
}
async function renderJoinvilleAllBuses(){
  group("BUS: Joinville (toutes lignes)","#daa520");
  const mount=qs('#board-joinville-bus'); mount.innerHTML='Chargement des lignes…';
  const lines = await discoverBusLines(STOP_AREAS.JOINVILLE_IDFM);
  mount.innerHTML='';
  // show banner if any for key lines
  for(const c of [LINES_CODE.BUS_77, LINES_CODE.BUS_201, LINES_CODE.N33]){
    try{
      const d = await fetchAPI(APIS.PRIM_GM(c));
      const list = d?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage||[];
      if(list.length){ const txt=list.map(x=> (x?.Content?.Message?.[0]?.MessageText?.[0]?.value||'').trim()).filter(Boolean).join(' • ');
        const bar=qs('#traffic-bus'); bar.textContent=`⚠️ ${txt}`; bar.classList.remove('hidden'); break; }
    }catch{}
  }
  for(const meta of lines){
    const box = renderBusLineBlock(mount, meta, []);
    await sleep(150);
    (async ()=>{
      const visits = await getRealtimeForLine(meta.id, STOP_AREAS.JOINVILLE);
      if(visits && visits.length){
        const body = box.querySelector('.line-body'); if(body) body.innerHTML='';
        const groups = groupByDestination(visits);
        Object.entries(groups).forEach(([dest, arr])=>{
          const items = arr.slice(0,4).map(v=>{
            const mvj=v.MonitoredVehicleJourney||{};
            const est=mvj.MonitoredCall?.ExpectedDepartureTime||mvj.MonitoredCall?.ExpectedArrivalTime;
            const sch=mvj.MonitoredCall?.AimedDepartureTime||mvj.MonitoredCall?.AimedArrivalTime;
            const delay=est&&sch? Math.round((new Date(est)-new Date(sch))/60000):0;
            const imin=est? ((new Date(est)-Date.now())/60000<1.5):false;
            const cancelled = mvj?.MonitoredCall?.DepartureStatus==='cancelled';
            return `<div class="cell">${sch?`<s>${hhmm(sch)}</s>`:''} <strong>${hhmm(est)}</strong> ${delay>0?`<span class="delay">+${delay} min</span>`:''} ${imin?`<span class="imminent">🟢</span>`:''} ${cancelled?`<span class="cancelled">❌</span>`:''}</div>`;
          }).join('');
          const row=document.createElement('div'); row.className='dest-row';
          row.innerHTML=`<div class="dest-head">→ ${dest}</div><div class="cells">${items}</div>`;
          const body=box.querySelector('.line-body'); if(body) body.appendChild(row);
        });
      } else {
        const planned = await getPlannedForLine(meta.id);
        const info=document.createElement('div'); info.className='planned';
        info.textContent = (planned && planned.next?.length) ? `Prochains passages (GTFS) : ${planned.next.join(' • ')}`
          : (planned?.first? `Service terminé — prochain passage à ${planned.first}` : 'Service terminé — prochains horaires indisponibles');
        const body=box.querySelector('.line-body'); if(body) body.appendChild(info);
      }
    })();
  }
  gend();
}

// Quick boards for 77 + 201 panels
async function genericBoard(stopRef, lineCode, mountSel, bannerSel){
  group(`BUS: ${lineCode} @ ${stopRef}`,"#888");
  const mount=qs(mountSel); mount.innerHTML='Chargement…';
  try{
    const d = await fetchAPI(APIS.PRIM_STOP(stopRef, lineCode));
    const visits = d?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    if(!visits.length){ mount.innerHTML='<div class="row ended">Aucun passage imminent</div>'; }
    else{
      const groups = groupByDestination(visits);
      mount.innerHTML = Object.entries(groups).map(([dest, arr])=>{
        const items = arr.slice(0,3).map(v=>{
          const mvj=v.MonitoredVehicleJourney||{};
          const est=mvj.MonitoredCall?.ExpectedDepartureTime||mvj.MonitoredCall?.ExpectedArrivalTime;
          const sch=mvj.MonitoredCall?.AimedDepartureTime||mvj.MonitoredCall?.AimedArrivalTime;
          const delay=est&&sch? Math.round((new Date(est)-new Date(sch))/60000):0;
          return `<div class="cell">${sch?`<s>${hhmm(sch)}</s>`:''} <strong>${hhmm(est)}</strong> ${delay>0?`<span class="delay">+${delay}m</span>`:''}</div>`;
        }).join('');
        return `<div class="dest-group"><div class="dest-head">→ ${dest}</div><div class="cells">${cells}</div></div>`;
      }).join('');
    }
  }catch{ mount.innerHTML='<div class="row ended">Indisponible</div>'; }

  try{
    const g = await fetchAPI(APIS.PRIM_GM(lineCode));
    const list = g?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage || [];
    if(list.length){ const txt=list.map(x=> (x?.Content?.Message?.[0]?.MessageText?.[0]?.value||'').trim()).filter(Boolean).join(' • ');
      const bar=qs(bannerSel); bar.textContent=`⚠️ ${txt}`; bar.classList.remove('hidden'); }
  }catch{}
  gend();
}

// ========== METEO / VELIB / NEWS / CLOCK =========
async function renderMeteo(){
  group("Météo","#09f");
  try{
    const d = await fetchAPI(APIS.METEO(48.835,2.45), 12000);
    const c=d?.current||{};
    qs('#temp').textContent = `${Math.round(c?.temperature_2m??0)}°C`;
    qs('#meteo').innerHTML = `<div>Température : <strong>${Math.round(c?.temperature_2m??0)}°C</strong> (ressentie ${Math.round(c?.apparent_temperature??0)}°C)</div>
    <div>Vent : ${Math.round(c?.wind_speed_10m??0)} km/h</div>`;
    logOK("météo OK");
  }catch(e){ logERR("météo KO: "+e.message); qs('#meteo').textContent='Météo indisponible'; }
  gend();
}
async function renderVelib(){
  group("Vélib","#0aa");
  try{
    const [status, info] = await Promise.all([fetchAPI(APIS.VELIB_STATUS(),12000), fetchAPI(APIS.VELIB_INFO(),12000)]);
    const byId = Object.fromEntries((info?.data?.stations||[]).map(s=>[s.station_id,s]));
    const wanted=["12163","12128"];
    const rows=wanted.map(id=>{
      const s=(status?.data?.stations||[]).find(x=>x.station_id===id);
      const meta=byId[id]||{}; if(!s) return `<div>Station ${id} indisponible</div>`;
      return `<div><strong>${meta?.name||id}</strong> — vélos: ${s.num_bikes_available} / places: ${s.num_docks_available}</div>`;
    }).join('');
    qs('#velib').innerHTML=rows;
    logOK("vélib OK");
  }catch(e){ logERR("vélib KO: "+e.message); qs('#velib').textContent='Vélib’ indisponible'; }
  gend();
}

// ========== Courses (scraping Jina proxy) ==========
async function refreshCourses() {
  group("Courses Vincennes","#a0a");
  const cont = document.getElementById("courses-list");
  if (!cont) return;
  cont.textContent = "Chargement…";
  try {
    const html = await fetchText("https://r.jina.ai/https://www.letrot.com/stats/Evenement/GetEvenements?hippodrome=VINCENNES&startDate=" +
      new Date().toISOString().slice(0, 10) +
      "&endDate=" + new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10));
    const entries = [...html.matchAll(/(\d{1,2} \w+ \d{4}).*?Réunion\s*(\d+)/gis)]
      .map(m => ({ date: m[1], reunion: m[2] }));
    cont.innerHTML = "";
    if (!entries.length) throw new Error("no entries");
    entries.slice(0, 4).forEach(({ date, reunion }) => {
      const div = document.createElement("div");
      div.className = "traffic-sub ok";
      div.textContent = `${date} — Réunion ${reunion}`;
      cont.appendChild(div);
    });
    logOK(`courses OK (${entries.length} entrées)`);
  } catch (e) {
    console.warn("refreshCourses", e);
    cont.innerHTML = '<div class="traffic-sub alert">Programme indisponible. Consultez <a href="https://www.letrot.com/stats/Evenement" target="_blank" rel="noopener">letrot.com</a>.</div>';
    logERR("courses KO: "+e.message);
  }
  gend();
}

// ========== Sytadin (image auto-refresh) ==========
function refreshSytadin(){
  const img = qs('#sytadin-img');
  const base = "https://www.sytadin.fr/sys/barometre_carte_couleur.jpg";
  img.src = base + "?t=" + Date.now();
  logOK("sytadin refresh");
}

// ========== INIT ==========
window.addEventListener('load', ()=>{
  tickClock(); setInterval(tickClock, 30*1000);
  loadNews(); setInterval(loadNews, 5*60*1000);

  renderMeteo(); setInterval(renderMeteo, 10*60*1000);
  renderVelib(); setInterval(renderVelib, 5*60*1000);

  renderRER(); setInterval(renderRER, 60*1000);
  renderJoinvilleAllBuses(); setInterval(renderJoinvilleAllBuses, 2*60*1000);

  genericBoard(STOP_AREAS.HIPPODROME_77, LINES_CODE.BUS_77, '#board-bus77', '#traffic-bus77');
  genericBoard(STOP_AREAS.BREUIL_77_201, LINES_CODE.BUS_201, '#board-bus201', '#traffic-bus201');
  setInterval(()=>genericBoard(STOP_AREAS.HIPPODROME_77, LINES_CODE.BUS_77, '#board-bus77', '#traffic-bus77'), 90*1000);
  setInterval(()=>genericBoard(STOP_AREAS.BREUIL_77_201, LINES_CODE.BUS_201, '#board-bus201', '#traffic-bus201'), 90*1000);

  refreshSytadin(); setInterval(refreshSytadin, 60*1000);
  refreshCourses(); setInterval(refreshCourses, 15*60*1000);
});
