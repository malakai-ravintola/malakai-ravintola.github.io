// Malakai Tilaukset – tablettinäkymä keittiöön (vain omistajan tunnuksella)
(function(){
"use strict";
const OWNER="hardi7fateh@hotmail.com",C=window.MALAKAI||{},S=window.SITE||{},TZ="Europe/Helsinki";
const $=s=>document.querySelector(s);
const mk=(t,a,...k)=>{const e=document.createElement(t);if(a)for(const[x,v]of Object.entries(a)){if(x==="class")e.className=v;else if(x==="text")e.textContent=v;else if(x==="html")e.innerHTML=v;else if(x.startsWith("on"))e[x]=v;else if(v!==false&&v!=null)e.setAttribute(x,v===true?"":v)}k.flat().forEach(c=>c!=null&&c!==false&&e.append(c));return e};
const eur=n=>Number(n||0).toFixed(2).replace(".",",")+" €";
const hm=d=>new Date(d).toLocaleTimeString("fi-FI",{timeZone:TZ,hour:"2-digit",minute:"2-digit"}).replace(".",":");
const hDate=d=>new Date(d).toLocaleDateString("en-CA",{timeZone:TZ});
const hToday=()=>hDate(new Date());
const fd=d=>{const[y,m,dd]=String(d).split("-");return +dd+"."+ +m+"."};
const WD=["su","ma","ti","ke","to","pe","la"],WDL=["sunnuntaina","maanantaina","tiistaina","keskiviikkona","torstaina","perjantaina","lauantaina"];
const preOf=w=>{const m=String(w||"").match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/);return m?{d:m[1],t:m[2]}:null};
const wantTxt=w=>{if(w==="heti")return"Mahdollisimman pian";const p=preOf(w);return p?WD[new Date(p.d+"T12:00:00").getDay()]+" "+fd(p.d)+" klo "+p.t.replace(":","."):"klo "+String(w).replace(":",".")};
let toastT;function toast(t,bad){const e=$("#toast");e.textContent=t;e.className="toast"+(bad?" bad":"");e.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>e.hidden=true,bad?6000:2800)}
const btn=(t,fn,c)=>mk("button",{class:"btn "+(c||""),text:t,onclick:async ev=>{const b=ev.currentTarget;b.disabled=true;try{await fn()}catch(e){toast(e.message||String(e),true)}finally{b.disabled=false}}});
const IC=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

// ---------- Kirjautuminen
if(!C.url||!window.supabase){$("#m").append(mk("div",{class:"login"},mk("h2",{text:"Yhteys puuttuu"}),mk("p",{text:"Tarkista nettiyhteys ja päivitä sivu."})));return}
const SB=supabase.createClient(C.url,C.anon);
const isOwner=s=>!!s&&String(s.user?.email||"").toLowerCase()===OWNER;
function loginView(){const em=mk("input",{type:"email",autocomplete:"username",required:true,placeholder:"Sähköposti"}),pw=mk("input",{type:"password",autocomplete:"current-password",required:true,placeholder:"Salasana"}),b=mk("button",{class:"btn y wide",text:"Kirjaudu"});
  const f=mk("form",{class:"login"},mk("h2",{text:"Malakai Tilaukset"}),mk("p",{text:"Kirjaudu omistajan tunnuksilla."}),em,pw,b);
  f.onsubmit=async e=>{e.preventDefault();b.disabled=true;const{data,error}=await SB.auth.signInWithPassword({email:em.value.trim(),password:pw.value});
    if(error||!isOwner(data?.session)){if(!error)await SB.auth.signOut({scope:"local"});b.disabled=false;pw.value="";return toast("Kirjautuminen epäonnistui",true)}location.reload()};
  $("#hd").hidden=true;$("#m").textContent="";$("#m").append(f)}
SB.auth.onAuthStateChange(ev=>{if(ev==="SIGNED_OUT")location.reload()});
SB.auth.getSession().then(async({data})=>{if(!isOwner(data.session)){if(data.session)await SB.auth.signOut({scope:"local"});return loginView()}boot()});
async function api(action,d,again){const{data:{session}}=await SB.auth.getSession();if(!session)throw new Error("Kirjaudu uudelleen");
  const r=await fetch(C.url+"/functions/v1/admin",{method:"POST",headers:{"Content-Type":"application/json",apikey:C.anon,Authorization:"Bearer "+session.access_token},body:JSON.stringify({action,...d})});
  const j=await r.json().catch(()=>({}));
  if(r.status===401&&!again){const{data:rf,error:re}=await SB.auth.refreshSession();if(!re&&rf?.session)return api(action,d,true);await SB.auth.signOut({scope:"local"}).catch(()=>{});location.reload();throw new Error("Kirjaudu uudelleen")}
  if(!r.ok)throw new Error(j.error||"Virhe "+r.status);return j}

// ---------- Tila
let tab="uudet",sub="valmis",view="aktiiviset",ORD=null,CFG={},AC=null,seen=new Set(),wake=null;
const TT={uudet:"Uudet tilaukset",kaynnissa:"Käynnissä",valmiit:"Valmiit"};
const NEW=()=>(ORD||[]).filter(o=>o.status==="uusi").sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
const RUN=()=>(ORD||[]).filter(o=>o.status==="hyvaksytty").sort((a,b)=>(a.eta||"").localeCompare(b.eta||""));
const READY=k=>(ORD||[]).filter(o=>o.status==="valmis"&&(k==="toim"?o.kind==="kuljetus":o.kind!=="kuljetus"));
const LS={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
let VOL=+(LS.get("tab_vol")??80),SND=LS.get("tab_snd")||"tilaus",SON=LS.get("tab_snd_on")!=="0",alarmOn=false,alarmT=null,bannerX=false;
const SOUNDS={tilaus:"Tilausääni (pirteä)",halytys:"Kiireellinen",kilina:"Kilinä"};if(!SOUNDS[SND])SND="tilaus";
const soundOk=()=>SON&&AC&&AC.state==="running";
const I={bag:'<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M9 13a3 3 0 0 0 6 0"/>',bike:'<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M5.5 17 9 10h6l3.5 7M9 10 7.5 7H5M15 10l-1.5-3H16"/>',walk:'<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6 3 3v3M8 12l2-4 4 1 2 3 2 .5M12 15l-1-4"/>',cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',chev:'<path d="M6 9l6 6 6-6"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',pin:'<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',note:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h4"/>'};
const svg=(k,w)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w||2}" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;
const ico=(k,w)=>mk("span",{html:svg(k,w),style:"display:inline-flex"});
const kindTag=o=>{const d=o.kind==="kuljetus";return mk("span",{class:"tag "+(d?"del":"nou")},ico(d?"bike":"walk"),d?"Kotiinkuljetus":"Nouto")};
const short=n=>{const p=String(n||"").trim().split(/\s+/);return p.length>1?p[0]+" "+p[p.length-1][0].toUpperCase():p[0]||""};

function unlock(){try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state!=="running")AC.resume().then(()=>{snd();alarm()}).catch(()=>{});}catch(e){}snd()}
function snd(){const b=$("#snd");if(!b)return;const need=SON&&!soundOk()&&!bannerX;b.hidden=!need}
function boot(){$("#hd").hidden=false;$("#tabs").hidden=false;
  unlock();["pointerdown","keydown","touchstart"].forEach(e=>document.addEventListener(e,()=>{if(SON&&!soundOk()){unlock();keepAwake();if("Notification"in window&&Notification.permission==="default")Notification.requestPermission()}},{passive:true}));
  $("#sndOn").onclick=()=>{unlock();setTimeout(()=>{if(soundOk()&&!NEW().length)beep()},150)};$("#sndX").onclick=e=>{e.stopPropagation();bannerX=true;snd()};
  document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{tab=b.dataset.t;view="aktiiviset";render()});
  $("#mn").onclick=()=>$("#dr").classList.add("open");$("#drx").onclick=()=>$("#dr").classList.remove("open");
  $("#dr").onclick=e=>{if(e.target.id==="dr")$("#dr").classList.remove("open")};
  document.querySelectorAll(".mi").forEach(b=>b.onclick=()=>{view=b.dataset.v;$("#dr").classList.remove("open");if(view==="aiemmat")loadPast();render()});
  $("#sb").onclick=storeSheet;$("#cnt").onclick=()=>{tab=NEW().length?"uudet":"kaynnissa";view="aktiiviset";render()};
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){load();keepAwake()}});
  keepAwake();load();setInterval(load,8000);setInterval(()=>{alarm();snd()},1000);setInterval(head,30000);render()}
async function keepAwake(){try{if("wakeLock"in navigator&&!wake){wake=await navigator.wakeLock.request("screen");wake.addEventListener("release",()=>wake=null)}}catch(e){}}
// ---------- Äänet: oletuksena päällä, soi kunnes tilaus hyväksytään/hylätään (5 s tauko välissä)
function tone(dst,f,t,len,type,peak,partials){(partials||[[1,1]]).forEach(([m,a])=>{const o=AC.createOscillator(),g=AC.createGain();o.type=type||"sine";o.frequency.value=f*m;
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak*a,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+len);o.connect(g).connect(dst);o.start(t);o.stop(t+len+.05)})}
function play(kind,vol){if(!AC)return 0;
  // kompressori nostaa äänen kuuluvuutta säröttä
  const cp=AC.createDynamicsCompressor();cp.threshold.value=-24;cp.knee.value=6;cp.ratio.value=8;cp.attack.value=.003;cp.release.value=.2;
  const out=AC.createGain();out.gain.value=1.8*Math.pow((vol??VOL)/100,1.4);const mg=AC.createGain();mg.gain.value=1.45;out.connect(cp).connect(mg).connect(AC.destination);const t=AC.currentTime+.05;
  // marimba-tyylinen näppäilty sävy
  const pl=(f,s,len,pk)=>tone(out,f,s,len||.35,"sine",pk||1,[[1,1],[3.9,.18],[9.8,.05]]);
  if(kind==="halytys"){ // kiireellinen kaksisävel, pulssi
    for(let r=0;r<6;r++){const s=t+r*.9;[0,.12,.24].forEach((d,i)=>tone(out,i===1?1480:1175,s+d,.11,"triangle",.95,[[1,1],[2,.3]]));tone(out,1760,s+.4,.25,"triangle",.8,[[1,1],[2,.25]])}return 5.6}
  if(kind==="kilina"){ // nopea kellotrilli
    for(let r=0;r<4;r++){for(let i=0;i<8;i++)tone(out,i%2?2093:1568,t+r*1.3+i*.07,.4,"sine",.7,[[1,1],[2.76,.3],[5.4,.1]])}return 5.4}
  // tilausääni: pirteä nouseva marimba-arpeggio, toistuu 4 kertaa
  const A=[[1047,0],[1319,.11],[1568,.22],[2093,.33],[1568,.5],[2093,.62]];
  for(let r=0;r<4;r++)A.forEach(([f,d])=>pl(f,t+r*1.35+d,.4,1));return 5.5}

function beep(){if(soundOk())play(SND)}
function alarm(){const want=soundOk()&&NEW().length>0;if(!want){alarmOn=false;clearTimeout(alarmT);return}if(alarmOn)return;alarmOn=true;
  const loop=()=>{if(!soundOk()||!NEW().length){alarmOn=false;return}const d=play(SND);alarmT=setTimeout(loop,(d+5)*1000)};loop()}
async function load(){try{const since=new Date(Date.now()-3*864e5).toISOString();
  const[a,b]=await Promise.all([SB.from("orders").select("*").or(`created_at.gte."${since}",status.in.(uusi,hyvaksytty,valmis)`).order("created_at",{ascending:false}),SB.from("settings").select("value").eq("key","orders").maybeSingle()]);
  if(a.error)throw new Error(a.error.message);
  const fresh=a.data.filter(o=>o.status==="uusi"&&!seen.has(o.id));
  if(ORD&&fresh.length){tab="uudet";view="aktiiviset";if("Notification"in window&&Notification.permission==="granted")try{new Notification("Uusi tilaus #"+fresh[0].no,{body:(fresh[0].kind==="kuljetus"?"Kuljetus":"Nouto")+" · "+eur(fresh[0].total)})}catch(e){}}
  ORD=a.data;a.data.forEach(o=>seen.add(o.id));CFG=(b.data&&b.data.value)||{};
  const busy=$(".sheet")||(document.activeElement&&/INPUT|TEXTAREA/.test(document.activeElement.tagName))||view!=="aktiiviset";if(!busy)render();else head()}catch(e){if(!ORD){ORD=[];render()}}}
async function setOrd(o,status,extra={}){const r=await api("order",{id:o.id,status,...extra});Object.assign(o,{status},extra,status==="hyvaksytty"?{handled_at:new Date().toISOString()}:{});
  toast({hyvaksytty:"Hyväksytty",peruttu:"Hylätty",valmis:o.kind==="kuljetus"?"Lähti kuljetukseen":"Valmis noudettavaksi",luovutettu:o.kind==="kuljetus"?"Toimitettu":"Noudettu"}[status]+(r.mail?" · asiakas sai viestin":""));
  if(status==="hyvaksytty"&&!NEW().length)tab="kaynnissa";if(status==="valmis"){tab="valmiit";sub=o.kind==="kuljetus"?"toim":"valmis"}render();load()}
async function saveCfg(msg){const{error}=await SB.from("settings").upsert({key:"orders",value:CFG,updated_at:new Date().toISOString()});if(error)throw new Error(error.message);toast(msg);render()}

// ---------- Aukiolo (automaattinen aukioloaikojen mukaan)
const DEL_CUT=30;
const hrs=k=>{const h=(S.hours||{})[k];return h&&h[0]&&h[1]?h:null};
const min=t=>{const[a,b]=t.split(":");return +a*60+ +b};
const nowMin=()=>{const p=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date()).split(":");return(+p[0]%24)*60+ +p[1]};
const clk=m=>String(Math.floor(m/60)).padStart(2,"0")+"."+String(m%60).padStart(2,"0");
const paused=()=>!!CFG.pauseUntil&&Date.now()<Date.parse(CFG.pauseUntil);
function openInfo(){const k=WD[new Date(hToday()+"T12:00:00").getDay()],h=hrs(k),n=nowMin();
  if(h&&n>=min(h[0])&&n<min(h[1])){const c=min(h[1]);return{open:true,close:c,del:n<=c-DEL_CUT,txt:"Auki klo "+h[1].replace(":",".")+" asti"}}
  if(h&&n<min(h[0]))return{open:false,txt:"tänään klo "+h[0].replace(":",".")};
  for(let i=1;i<8;i++){const x=new Date(hToday()+"T12:00:00");x.setDate(x.getDate()+i);const hh=hrs(WD[x.getDay()]);if(hh)return{open:false,txt:(i===1?"huomenna ":WDL[x.getDay()]+" ")+"klo "+hh[0].replace(":",".")}}
  return{open:false,txt:""}}
const live=()=>!!CFG.on&&openInfo().open&&!paused();

// ---------- Otsikko ja alavalikot
function head(){const n=NEW().length,k=RUN().length,oi=openInfo(),pa=paused();
  const sb=$("#sb");sb.classList.toggle("on",live());sb.classList.toggle("pa",!!CFG.on&&oi.open&&pa);
  sb.title=!CFG.on?"Nettitilaus pois päältä":pa?"Tauolla":oi.open?"Auki":"Kiinni";
  $("#cntN").hidden=!(n+k);$("#cntN").textContent=n+k;$("#bdN").hidden=!n;$("#bdN").textContent=n;$("#bdK").hidden=!k;$("#bdK").textContent=k;
  document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("on",view==="aktiiviset"&&b.dataset.t===tab));
  document.querySelectorAll(".mi").forEach(b=>b.classList.toggle("on",b.dataset.v===view));
  $("#ttl").textContent=view==="aktiiviset"?TT[tab]:{aiemmat:"Aiemmat tilaukset",tuotteet:"Tuotelista",asetukset:"Asetukset"}[view];
  const s=$("#sub");s.textContent="";
  if(view==="aktiiviset"&&tab==="valmiit")s.append(seg([["valmis","Valmis ("+READY("valmis").length+")"],["toim","Toimituksessa"+(READY("toim").length?" ("+READY("toim").length+")":"")]],sub,v=>{sub=v;render()}));
  if(view==="aiemmat"){s.append(seg([["tilaukset","Tilaukset"],["tuotteet","Tuotteet"]],PF.sub,v=>{PF.sub=v;render()}));s.append(filters())}
  document.title=(n?"("+n+") UUSI TILAUS – ":"")+"Malakai Tilaukset";snd()}
const seg=(opts,cur,fn)=>mk("div",{class:"seg"},opts.map(([v,t])=>mk("button",{class:v===cur?"on":"",text:t,onclick:()=>fn(v)})));

function render(){if(!ORD){$("#m").textContent="";return}head();const m=$("#m");m.textContent="";m.scrollTop=0;
  if(view==="aiemmat")return vPast(m);if(view==="tuotteet")return vProd(m);if(view==="asetukset")return vSet(m);
  const L=tab==="uudet"?NEW():tab==="kaynnissa"?RUN():READY(sub);
  if(!L.length){const oi=openInfo();
    if(tab==="uudet"&&!CFG.on)return m.append(mk("div",{class:"empty red"},mk("div",null,mk("h2",{text:"Nettitilaus on pois päältä"}),mk("p",{text:"Asiakkaat eivät voi tilata malakairavintola.fi:stä."}),btn("Ota nettitilaus käyttöön",async()=>{CFG={...CFG,on:true};await saveCfg("Nettitilaus käytössä – aukeaa aukioloaikojen mukaan")},"eb"))));
    if(tab==="uudet"&&oi.open&&paused())return m.append(mk("div",{class:"empty red"},mk("div",null,mk("h2",{text:"Tauolla klo "+hm(CFG.pauseUntil).replace(":",".")+" asti"}),mk("p",{text:"Asiakkaat voivat tehdä vain ennakkotilauksia. Nettitilaus aukeaa itsestään tauon jälkeen."}),btn("Avaa nyt",async()=>{CFG={...CFG,pauseUntil:null};await saveCfg("Nettitilaus auki")},"eb"))));
    if(tab==="uudet"&&!oi.open)return m.append(mk("div",{class:"empty red"},mk("div",null,mk("h2",{text:"Ravintola on kiinni"}),mk("p",{text:(oi.txt?"Nettitilaus aukeaa automaattisesti "+oi.txt+". ":"")+"Ennakkotilaukset tulevat tänne myös kiinniolon aikana."}))));
    const E={uudet:["Ei uusia tilauksia","Asiakkaiden tekemät uudet tilaukset ilmestyvät tähän automaattisesti"],kaynnissa:["Ei keskeneräisiä tilauksia","Uudet tilaukset -välilehdeltä hyväksytyt tilaukset näkyvät täällä automaattisesti"],
      valmis:["Ei tilauksia valmiina","Noutoa odottavat tilaukset näkyvät täällä"],toim:["Ei tilauksia toimituksessa","Kuljetukseen lähteneet tilaukset näkyvät täällä"]}[tab==="valmiit"?sub:tab];
    const box=mk("div",{class:"empty"},mk("div",null,mk("h2",{text:E[0]}),mk("p",{text:E[1]})));
    if(tab==="uudet"&&oi.open&&!oi.del)box.firstChild.append(mk("p",{style:"margin-top:16px;color:#9A6A00;font-weight:700",text:"Kotiinkuljetus päättyi klo "+clk(oi.close-DEL_CUT)+" – nyt vain nouto."}));
    return m.append(box)}
  m.append(mk("div",{class:"list"},L.map(o=>card(o))))}
function stars(r){return r?mk("span",{class:"stars",text:"★".repeat(r)+"☆".repeat(5-r)}):null}
function card(o,ro){const del=o.kind==="kuljetus",pre=preOf(o.want);
  const c=mk("div",{class:"oc "+o.status},
    mk("div",{class:"oh"},mk("b",{text:"#"+o.no}),kindTag(o),pre?mk("span",{class:"tag pre",text:"Ennakko"}):null,
      mk("div",{class:"tm"},o.eta&&o.status!=="uusi"?"Valmis klo "+o.eta.replace(":","."):wantTxt(o.want),mk("small",{text:"Tilattu "+hm(o.created_at)}))),
    mk("div",{class:"ob"},
      mk("div",{class:"cu"},mk("b",{text:o.name}),mk("a",{href:"tel:"+o.phone,text:o.phone})),
      del?mk("div",{class:"ad"},mk("b",{text:o.address+(o.apt?" "+o.apt:"")+", "+o.zip+" "+(o.city||"")}),o.door?mk("div",null,"Ovikoodi: ",mk("b",{text:o.door})):null,o.dnote?mk("div",null,"Kuljettajalle: ",mk("b",{text:o.dnote})):null):null,
      mk("ul",{class:"its"},(o.items||[]).map(i=>mk("li",null,mk("b",{text:i.q+" × "+i.n}),i.opt?mk("small",{text:i.opt}):null,i.m?mk("em",{text:"Toive: "+i.m}):null))),
      o.note?mk("div",{class:"nt",text:"Lisätiedot: "+o.note}):null,
      o.rating?mk("div",{class:"nt",style:"background:#F4F4F4;color:#333"},"Asiakkaan arvio: ",mk("b",{class:"s"+o.rating,text:"★".repeat(o.rating)}),o.rating_note?mk("div",{text:"“"+o.rating_note+"”"}):null):null,
      mk("div",{class:"tot"},eur(o.total),mk("span",{text:o.pay==="netti"?(o.pay_status==="palautettu"?"Maksettu netissä · palautettu":"MAKSETTU NETISSÄ"):(o.pay==="kateinen"?"Käteinen":"Kortti")+(del?" · kuljettajalle":" · kassalla")}))));
  if(ro){}
  else if(o.status==="uusi"){
    c.append(mk("div",{class:"acts"},mk("p",{text:"Hyväksy – "+(del?"toimitus":"valmis")+" noin:"}),
      o.want==="heti"?etaPick(o,del)
        :btn("Hyväksy "+wantTxt(o.want),()=>setOrd(o,"hyvaksytty",{eta:pre?pre.t:o.want}),"g wide"),
      btn("Hylkää tilaus",()=>rejectSheet(o),"x")))}
  else if(o.status==="hyvaksytty")c.append(cdown(o),mk("div",{class:"acts"},btn(del?"Lähti kuljetukseen":"Valmis noudettavaksi",()=>setOrd(o,"valmis",{notify:true}),"g wide"),btn("Peru tilaus",()=>rejectSheet(o),"x")));
  else if(o.status==="valmis")c.append(mk("div",{class:"acts"},btn(del?"Toimitettu":"Asiakas nouti",()=>setOrd(o,"luovutettu"),"g wide"),!del?btn("Ei noudettu – estä asiakas",()=>blockSheet(o),"x"):null));
  if(o.status==="luovutettu"||o.status==="peruttu"){c.append(mk("div",{class:"st "+(o.status==="peruttu"?"no":"ok"),text:o.status==="peruttu"?"Hylätty"+(o.reason?": "+o.reason:""):(del?"Toimitettu ":"Noudettu ")+(o.done_at?hm(o.done_at):"")}));
    c.append(mk("div",{class:"acts",style:"padding-top:0"},btn("Estä asiakas",()=>blockSheet(o),"x")))}
  return c}
// ---------- Ajastin: laskee alas valmistumisaikaan
function etaTs(o){if(!o.eta)return null;const p=preOf(o.want),d=p?p.d:hDate(o.handled_at||o.created_at),[h,mi]=o.eta.split(":").map(Number);
  const base=new Date(d+"T00:00:00");base.setHours(h,mi,0,0);return base.getTime()}
function cdown(o){const T=etaTs(o);if(!T)return null;const st=Date.parse(o.handled_at||o.created_at)||Date.now();
  const w=mk("div",{class:"cd","data-t":String(T),"data-s":String(st)},mk("div",{class:"cd-r"},mk("b",{class:"cd-v"}),mk("span",{class:"cd-l"})),mk("div",{class:"cd-b"},mk("i")));tick(w);return w}
function tick(w){const T=+w.dataset.t,S0=+w.dataset.s,now=Date.now(),left=Math.round((T-now)/1000),tot=Math.max(60,(T-S0)/1000);
  const v=w.querySelector(".cd-v"),l=w.querySelector(".cd-l"),bar=w.querySelector(".cd-b i");
  const f=s=>{s=Math.abs(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return(h?h+":"+String(m).padStart(2,"0"):m)+":"+String(x).padStart(2,"0")};
  if(left>=0){v.textContent=f(left);l.textContent=left>3600?"valmistumiseen":"jäljellä";w.classList.toggle("soon",left<=300);w.classList.remove("late");bar.style.width=Math.min(100,100*(1-left/tot))+"%"}
  else{v.textContent="+"+f(left);l.textContent="myöhässä";w.classList.add("late");bar.style.width="100%"}}
setInterval(()=>document.querySelectorAll(".cd").forEach(tick),1000);
function sheetBox(title,...kids){const s=mk("div",{class:"sheet",onclick:e=>{if(e.target===s)s.remove()}});
  s.append(mk("div",null,mk("div",{class:"grab"}),mk("div",{class:"shx"},mk("button",{class:"ib",style:"width:48px;height:48px","aria-label":"Sulje",html:svg("x",2.4),onclick:()=>s.remove()})),title?mk("h3",{text:title}):null,...kids));document.body.append(s);return s}
function blockSheet(o){const s=sheetBox("Estä "+o.name+"?",mk("p",{text:o.phone+" · "+o.email+" – asiakas ei voi enää tilata netistä. Voit poistaa eston Asetuksista."}),
    mk("div",{class:"row2"},btn("Peruuta",async()=>s.remove(),"o"),btn("Estä",async()=>{const B={e:[...((CFG.blocked||{}).e||[])],p:[...((CFG.blocked||{}).p||[])]};if(!B.e.includes(o.email))B.e.push(o.email);if(!B.p.includes(o.phone))B.p.push(o.phone);
      CFG={...CFG,blocked:B};if(o.status!=="luovutettu"&&o.status!=="peruttu")await api("order",{id:o.id,status:"peruttu",reason:"Tilausta ei noudettu"}).catch(()=>{});await saveCfg("Asiakas estetty");s.remove();load()},"y")))}
const ETA={};
function etaPick(o,del){let v=ETA[o.id]??(del?Math.min(60,+CFG.dtime||45):Math.min(60,+CFG.prep||20));v=Math.max(5,Math.min(60,Math.round(v/5)*5));
  const val=mk("b",{class:"ev"}),clk=mk("small"),ok=btn("",()=>setOrd(o,"hyvaksytty",{eta:hm(Date.now()+v*6e4)}),"g wide");
  const upd=()=>{ETA[o.id]=v;val.textContent=v+" min";clk.textContent=(del?"Perillä":"Valmis")+" noin klo "+hm(Date.now()+v*6e4).replace(":",".");ok.textContent="Hyväksy · "+v+" min";mi.disabled=v<=5;pl.disabled=v>=60};
  const mi=mk("button",{class:"es",text:"−5",onclick:()=>{v=Math.max(5,v-5);upd()}}),pl=mk("button",{class:"es",text:"+5",onclick:()=>{v=Math.min(60,v+5);upd()}});
  const quick=mk("div",{class:"eq"},[10,15,20,30,45,60].map(n=>mk("button",{text:n+"",onclick:()=>{v=n;upd()}})));
  upd();return mk("div",null,mk("div",{class:"ep"},mi,mk("div",{class:"ec"},val,clk),pl),quick,ok)}

function rejectSheet(o){const ta=mk("textarea",{placeholder:"Syy asiakkaalle"});
  const s=sheetBox((o.status==="hyvaksytty"?"Peru tilaus #":"Hylkää tilaus #")+o.no,mk("p",{text:o.pay_status==="maksettu"?"Asiakas saa sähköpostin, jossa syy kerrotaan. Netissä maksettu "+eur(o.total)+" palautetaan asiakkaalle automaattisesti.":"Asiakas saa sähköpostin, jossa syy kerrotaan."}),
    mk("div",{class:"chips"},["Tuote on loppu","Liian kiireinen hetki","Osoite liian kaukana","Suljemme pian"].map(t=>mk("button",{text:t,onclick:()=>ta.value=t}))),ta,
    mk("div",{class:"row2"},btn("Peruuta",async()=>s.remove(),"o"),btn("Hylkää",async()=>{await setOrd(o,"peruttu",{reason:ta.value.trim()});s.remove()},"y")))}
function storeSheet(){const oi=openInfo(),pa=paused();let s;
  const until=m=>new Date(Date.now()+m*6e4).toISOString();
  const endToday=()=>{const n=nowMin();return until(Math.max(1,(oi.close||n)-n))};
  const pause=async(iso,msg)=>{CFG={...CFG,pauseUntil:iso};await saveCfg(msg);s.remove()};
  const info=!CFG.on?"Nettitilaus on pois päältä. Kun se on käytössä, se aukeaa ja sulkeutuu automaattisesti aukioloaikojen mukaan."
    :pa?"Tauolla klo "+hm(CFG.pauseUntil).replace(":",".")+" asti. Sen jälkeen nettitilaus aukeaa automaattisesti."
    :oi.open?oi.txt+". Kotiinkuljetus "+(oi.del?"klo "+clk(oi.close-DEL_CUT)+" asti, sen jälkeen vain nouto.":"on päättynyt tältä päivältä – vain nouto.")
    :"Kiinni. Aukeaa automaattisesti "+oi.txt+". Ennakkotilaukset ovat auki.";
  s=sheetBox(!CFG.on?"Nettitilaus pois päältä":pa?"Nettitilaus tauolla":oi.open?"Nettitilaus auki":"Ravintola kiinni",mk("p",{text:info}),
    !CFG.on?btn("Ota nettitilaus käyttöön",async()=>{CFG={...CFG,on:true,pauseUntil:null};await saveCfg("Nettitilaus käytössä");s.remove()},"g wide")
    :pa?btn("Avaa nyt",async()=>pause(null,"Nettitilaus auki"),"g wide")
    :oi.open?mk("div",{style:"display:grid;gap:10px"},mk("p",{style:"margin:0;font-weight:700;color:#333",text:"Kiire? Pidä tauko:"}),mk("div",{class:"row2"},btn("Tauko 30 min",async()=>pause(until(30),"Tauko 30 min"),"o"),btn("Tauko 1 h",async()=>pause(until(60),"Tauko 1 h"),"o")),btn("Sulje tältä päivältä",async()=>pause(endToday(),"Suljettu tältä päivältä"),"x"))
    :null)}

// ---------- Aiemmat tilaukset
const PER=[["tanaan","Tänään"],["eilen","Eilen"],["viikko","Tämä viikko"],["edviikko","Edellinen viikko"],["kk","Tämä kuukausi"],["edkk","Edellinen kuukausi"]];
let PF={sub:"tilaukset",per:"viikko",kind:null,rate:null,st:null},PAST=null,PKEY="";
function range(per){const d0=new Date(hToday()+"T00:00:00"),dow=(d0.getDay()+6)%7,a=new Date(d0),b=new Date(d0);
  if(per==="tanaan")b.setDate(b.getDate()+1);
  else if(per==="eilen")a.setDate(a.getDate()-1);
  else if(per==="viikko"){a.setDate(a.getDate()-dow);b.setDate(b.getDate()+1)}
  else if(per==="edviikko"){a.setDate(a.getDate()-dow-7);b.setDate(b.getDate()-dow)}
  else if(per==="kk"){a.setDate(1);b.setDate(b.getDate()+1)}
  else{a.setDate(1);a.setMonth(a.getMonth()-1);b.setDate(1)}
  return[a,b]}
async function loadPast(){const[a,b]=range(PF.per),key=PF.per;PAST=null;PKEY=key;
  const r=await SB.from("orders").select("*").in("status",["luovutettu","peruttu"]).gte("created_at",a.toISOString()).lt("created_at",b.toISOString()).order("created_at",{ascending:false}).limit(2000);
  if(PKEY!==key)return;PAST=r.error?[]:r.data;if(view==="aiemmat")render()}
function filters(){const lab=(v,l,d)=>v?l:d;
  const f=(t,on,fn,ic)=>mk("button",{class:on?"on":"",onclick:fn},ic?ico(ic):null,t,ico("chev",2.4));
  return mk("div",{class:"fl"},
    f(lab(PF.per,(PER.find(p=>p[0]===PF.per)||[])[1],"Päivämäärä"),true,()=>pick("Valitse ajanjakso",PER.map(([v,t])=>[v,t]),PF.per,v=>{PF.per=v||"viikko";loadPast()}),"cal"),
    f(lab(PF.kind,PF.kind==="kuljetus"?"Kotiinkuljetus":"Nouto","Toimitus"),!!PF.kind,()=>pick("Valitse toimitustapa",[["kuljetus","Kotiinkuljetus","bike"],["nouto","Nouto","walk"]],PF.kind,v=>{PF.kind=v;render()})),
    f(lab(PF.rate,"★ "+PF.rate,"Luokitukset"),!!PF.rate,()=>pick("Valitse luokitus",[1,2,3,4,5].map(n=>[n,String(n),"star"+n]),PF.rate,v=>{PF.rate=v;render()})),
    f(lab(PF.st,PF.st==="peruttu"?"Hylätty":"Valmis","Tila"),!!PF.st,()=>pick("Valitse tila",[["luovutettu","Valmis"],["peruttu","Hylätty"]],PF.st,v=>{PF.st=v;render()})))}
function pick(title,opts,cur,fn){let sel=cur;const ap=mk("button",{class:"apply",text:"Käytä",onclick:()=>{s.remove();fn(sel)}});
  const rows=opts.map(([v,t,ic])=>{const r=mk("button",{class:"rd"+(v===sel?" on":""),onclick:()=>{sel=sel===v&&cur!==v?null:v;rows.forEach(x=>x.classList.toggle("on",x._v===sel));ap.disabled=sel===cur}},
    ic&&ic.startsWith("star")?mk("b",{class:"star s"+ic.slice(4),text:"★"}):ic?ico(ic,1.8):null,mk("span",{text:t}),mk("i"));r._v=v;return r});
  ap.disabled=true;const clr=cur&&title!=="Valitse ajanjakso"?mk("button",{class:"btn o wide",style:"margin-top:10px",text:"Tyhjennä",onclick:()=>{s.remove();fn(null)}}):null;
  const s=sheetBox(title,...rows,ap,clr)}
function vPast(m){if(!PAST){if(PKEY!==PF.per)loadPast();return m.append(mk("div",{class:"empty"},mk("p",{text:"Ladataan…"})))}
  let L=PAST.filter(o=>(!PF.kind||(PF.kind==="kuljetus")===(o.kind==="kuljetus"))&&(!PF.rate||o.rating===PF.rate));
  const ok=L.filter(o=>o.status==="luovutettu"),rj=L.filter(o=>o.status==="peruttu"),sum=a=>a.reduce((s,o)=>s+ +o.total,0);
  if(PF.st)L=L.filter(o=>o.status===PF.st);
  m.append(mk("div",{class:"sum"},mk("div",null,mk("small",{text:"Kokonaismyynnit ("+ok.length+")"}),mk("b",{text:eur(sum(ok))})),mk("div",null,mk("small",{text:"Hylätty"+(rj.length?" ("+rj.length+")":"")}),mk("b",{text:eur(sum(rj))}))));
  if(PF.sub==="tuotteet"){const P={};ok.forEach(o=>(o.items||[]).forEach(i=>{const k=i.n;P[k]=P[k]||{n:k,q:0,s:0};P[k].q+=+i.q||1;P[k].s+=(+i.unit||0)*(+i.q||1)}));
    const A=Object.values(P).sort((a,b)=>b.q-a.q);if(!A.length)return m.append(mk("div",{class:"empty"},mk("div",null,mk("h2",{text:"Ei myytyjä tuotteita"}),mk("p",{text:"Valitulla ajanjaksolla ei ole valmiita tilauksia."}))));
    return m.append(mk("div",null,A.map(p=>mk("div",{class:"pt"},mk("div",null,mk("b",{text:p.n}),mk("small",{text:eur(p.s)})),mk("span",{class:"q",text:p.q+" kpl"})))))}
  if(!L.length)return m.append(mk("div",{class:"empty"},mk("div",null,mk("h2",{text:"Ei tilauksia"}),mk("p",{text:"Valitulla ajanjaksolla ja suodattimilla ei löytynyt tilauksia."}))));
  const box=mk("div",{class:"pl"});let d0="";
  L.forEach(o=>{const d=hDate(o.created_at);if(d!==d0){d0=d;const[y,mm,dd]=d.split("-");box.append(mk("h4",{text:+dd+"."+ +mm+"."+y}))}
    box.append(mk("button",{class:"po",onclick:()=>sheetBox(null,card(o,true))},
      mk("div",null,mk("span",{class:"no",text:"#"+o.no}),mk("span",{class:"nm",text:short(o.name)}),mk("span",{class:"tm2",text:hm(o.created_at).replace(":",".")}),kindTag(o)),
      mk("div",null,mk("span",{class:"pp",text:eur(o.total)}),o.status==="peruttu"?mk("span",{class:"rj",text:"Hylätty"}):null,stars(o.rating))))});
  m.append(box)}
function vProd(m){const out=new Set(CFG.soldout||[]),M=S.menu||{},box=mk("div",{class:"sec"},mk("p",{style:"color:var(--mut);margin-top:0",text:"Merkitse tuote loppuneeksi, niin sitä ei voi tilata netissä. Paina uudelleen, kun tuotetta taas on."}));
  Object.entries(M).forEach(([cat,o])=>{const its=(o.items||[]).filter(i=>+i[2]>0||i[0]==="Oma valinta");if(!its.length)return;box.append(mk("h3",{text:cat}));
    its.forEach(i=>{const k=cat+"|"+i[0],so=out.has(k);box.append(mk("div",{class:"pr"},mk("span",null,i[0],mk("br"),mk("small",{text:so?"Loppu":"Myynnissä"})),
      mk("button",{class:"tg"+(so?" on":""),"aria-label":"Loppu",onclick:async()=>{if(so)out.delete(k);else out.add(k);CFG={...CFG,soldout:[...out]};try{await saveCfg(so?i[0]+" taas myynnissä":i[0]+" merkitty loppuneeksi")}catch(e){toast(e.message,true)}}})))})});
  m.append(box)}
function vSet(m){const tgl=(t,sub,on,fn,ok)=>mk("div",{class:"pr"},mk("span",null,t,mk("br"),mk("small",{text:sub})),mk("button",{class:"tg"+(ok===false?"":" ok")+(on?" on":""),onclick:async()=>{try{await fn()}catch(e){toast(e.message,true)}}}));
  const H=S.hours||{},DN={ma:"Maanantai",ti:"Tiistai",ke:"Keskiviikko",to:"Torstai",pe:"Perjantai",la:"Lauantai",su:"Sunnuntai"};
  const box=mk("div",{class:"sec"},mk("h3",{text:"Nettitilaus"}),
  tgl("Nettitilaus käytössä",CFG.on?"Aukeaa ja sulkeutuu automaattisesti aukioloaikojen mukaan":"Pois päältä – asiakkaat eivät voi tilata",!!CFG.on,async()=>{CFG={...CFG,on:!CFG.on,pauseUntil:null};await saveCfg(CFG.on?"Nettitilaus käytössä":"Nettitilaus pois päältä")}),
  tgl("Kotiinkuljetus",CFG.delivery?"Käytössä – päättyy "+DEL_CUT+" min ennen sulkemista":"Vain nouto",!!CFG.delivery,async()=>{CFG={...CFG,delivery:!CFG.delivery};await saveCfg(CFG.delivery?"Kotiinkuljetus päällä":"Vain nouto")}),
  mk("h3",{style:"margin-top:22px",text:"Aukioloajat"}),
  Object.keys(DN).map(k=>{const h=H[k];return mk("div",{class:"pr"},mk("span",{text:DN[k]}),mk("b",{text:h&&h[0]?h[0].replace(":",".")+"–"+h[1].replace(":","."):"Suljettu"}))}),
  mk("p",{style:"color:var(--mut);margin:8px 0 0;font-size:.95rem",text:"Nettitilaus aukeaa aukeamisaikaan ja sulkeutuu 15 min ennen sulkemista. Kotiinkuljetus päättyy 30 min ennen sulkemista – sen jälkeen vain nouto. Aukioloajat muutetaan kauppiasportaalista."}),
  mk("h3",{style:"margin-top:22px",text:"Tilausääni"}),
  tgl("Tilausääni",SON?(soundOk()?"Päällä – soi kunnes tilaus hyväksytään tai hylätään":"Päällä – napauta näyttöä kerran, niin ääni aktivoituu"):"Pois päältä",SON,async()=>{SON=!SON;LS.set("tab_snd_on",SON?"1":"0");bannerX=false;if(SON)unlock();else{alarmOn=false;clearTimeout(alarmT)}render()}),
  SON?Object.entries(SOUNDS).map(([k,t])=>mk("div",{class:"pr"},mk("span",null,t,mk("br"),mk("small",{text:k===SND?"Valittu":""})),
    btn("Kuuntele",async()=>{unlock();setTimeout(()=>play(k),120)},"o"),
    mk("button",{class:"tg ok"+(k===SND?" on":""),"aria-label":"Valitse "+t,onclick:()=>{SND=k;LS.set("tab_snd",k);if(soundOk())play(k);render()}}))):null,
  SON?(()=>{const v=mk("b",{text:VOL+" %"}),r=mk("input",{type:"range",min:"5",max:"100",step:"5",value:String(VOL),style:"flex:1;accent-color:#139BDF;height:34px"});
    r.oninput=()=>{VOL=+r.value;v.textContent=VOL+" %";LS.set("tab_vol",VOL)};r.onchange=()=>{if(soundOk())play(SND)};
    return mk("div",{class:"pr"},mk("span",{style:"flex:none;width:130px"},"Voimakkuus"),r,v)})():null,
  mk("p",{style:"color:var(--mut);margin:6px 0 18px;font-size:.92rem",text:"Pidä myös tabletin oma äänenvoimakkuus kovalla ja äänetön tila pois päältä."}),
  mk("h3",{text:"Estetyt asiakkaat"}),
  ((CFG.blocked||{}).e||[]).length?((CFG.blocked||{}).e||[]).map((em,i)=>mk("div",{class:"pr"},mk("span",null,em,mk("br"),mk("small",{text:((CFG.blocked||{}).p||[])[i]||""})),btn("Poista esto",async()=>{const B={e:[...CFG.blocked.e],p:[...(CFG.blocked.p||[])]};B.e.splice(i,1);B.p.splice(i,1);CFG={...CFG,blocked:B};await saveCfg("Esto poistettu")},"o"))):mk("p",{style:"color:var(--mut)",text:"Ei estettyjä asiakkaita."}),
  mk("p",{style:"color:var(--mut);margin-top:18px",text:"Vinkki: pidä tämä sivu auki ja tabletti laturissa. Näytön lukitus kannattaa ottaa pois."}),
  btn("Kirjaudu ulos",async()=>{await SB.auth.signOut({scope:"local"})},"x"));
  m.append(box)}
})();
