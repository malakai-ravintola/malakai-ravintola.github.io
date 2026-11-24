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
  $("#m").textContent="";$("#m").append(f)}
SB.auth.onAuthStateChange(ev=>{if(ev==="SIGNED_OUT")location.reload()});
SB.auth.getSession().then(async({data})=>{if(!isOwner(data.session)){if(data.session)await SB.auth.signOut({scope:"local"});return loginView()}boot()});
async function api(action,d){const{data:{session}}=await SB.auth.getSession();if(!session)throw new Error("Kirjaudu uudelleen");
  const r=await fetch(C.url+"/functions/v1/admin",{method:"POST",headers:{"Content-Type":"application/json",apikey:C.anon,Authorization:"Bearer "+session.access_token},body:JSON.stringify({action,...d})});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||"Virhe "+r.status);return j}

// ---------- Tila
let tab="uudet",view="aktiiviset",ORD=null,CFG={},AC=null,soundOk=false,seen=new Set(),wake=null;
const TT={uudet:"Uudet tilaukset",kaynnissa:"Käynnissä",valmiit:"Valmiit"};
const NEW=()=>(ORD||[]).filter(o=>o.status==="uusi").sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
const RUN=()=>(ORD||[]).filter(o=>o.status==="hyvaksytty"||o.status==="valmis").sort((a,b)=>(a.eta||"").localeCompare(b.eta||""));
const DONE=()=>(ORD||[]).filter(o=>(o.status==="luovutettu"||o.status==="peruttu")&&hDate(o.done_at||o.created_at)===hToday());

function boot(){$("#top").hidden=false;$("#tabs").hidden=false;$("#snd").hidden=false;
  $("#sndOn").onclick=()=>{try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();AC.resume();soundOk=true;alarm();if(!NEW().length)beep();$("#snd").hidden=true;keepAwake();if("Notification"in window&&Notification.permission==="default")Notification.requestPermission()}catch(e){toast("Ääntä ei voitu ottaa käyttöön",true)}};
  document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{tab=b.dataset.t;view="aktiiviset";render()});
  $("#mn").onclick=()=>$("#dr").classList.add("open");$("#drx").onclick=()=>$("#dr").classList.remove("open");
  $("#dr").onclick=e=>{if(e.target.id==="dr")$("#dr").classList.remove("open")};
  document.querySelectorAll(".mi").forEach(b=>b.onclick=()=>{view=b.dataset.v;$("#dr").classList.remove("open");render()});
  $("#sb").onclick=storeSheet;$("#cnt").onclick=()=>{tab=NEW().length?"uudet":"kaynnissa";view="aktiiviset";render()};
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){load();keepAwake()}});
  load();setInterval(load,8000);setInterval(alarm,1000);render()}
async function keepAwake(){try{if("wakeLock"in navigator&&!wake){wake=await navigator.wakeLock.request("screen");wake.addEventListener("release",()=>wake=null)}}catch(e){}}
// ---------- Äänet: 3 tilausääntä, voimakkuus, soi kunnes tilaus hyväksytään/hylätään (5 s tauko välissä)
const LS={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
let VOL=+(LS.get("tab_vol")??80),SND=LS.get("tab_snd")||"tilaus",alarmOn=false,alarmT=null;
const SOUNDS={tilaus:"Tilausääni (pirteä)",halytys:"Kiireellinen",kilina:"Kilinä"};if(!SOUNDS[SND])SND="tilaus";
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
function beep(){if(soundOk)play(SND)}
function alarm(){const want=soundOk&&NEW().length>0;if(!want){alarmOn=false;clearTimeout(alarmT);return}if(alarmOn)return;alarmOn=true;
  const loop=()=>{if(!soundOk||!NEW().length){alarmOn=false;return}const d=play(SND);alarmT=setTimeout(loop,(d+5)*1000)};loop()}
async function load(){try{const since=new Date(Date.now()-8*864e5).toISOString();
  const[a,b]=await Promise.all([SB.from("orders").select("*").or(`created_at.gte."${since}",status.in.(uusi,hyvaksytty,valmis)`).order("created_at",{ascending:false}),SB.from("settings").select("value").eq("key","orders").maybeSingle()]);
  if(a.error)throw new Error(a.error.message);
  const fresh=a.data.filter(o=>o.status==="uusi"&&!seen.has(o.id));
  if(ORD&&fresh.length){tab="uudet";view="aktiiviset";if("Notification"in window&&Notification.permission==="granted")try{new Notification("Uusi tilaus #"+fresh[0].no,{body:(fresh[0].kind==="kuljetus"?"Kuljetus":"Nouto")+" · "+eur(fresh[0].total)})}catch(e){}}
  ORD=a.data;a.data.forEach(o=>seen.add(o.id));CFG=(b.data&&b.data.value)||{};
  const busy=$(".sheet")||(document.activeElement&&/INPUT|TEXTAREA/.test(document.activeElement.tagName));if(!busy)render();else head()}catch(e){if(!ORD){ORD=[];render()}}}
async function setOrd(o,status,extra={}){const r=await api("order",{id:o.id,status,...extra});Object.assign(o,{status},extra);
  toast({hyvaksytty:"Hyväksytty",peruttu:"Hylätty",valmis:o.kind==="kuljetus"?"Lähti kuljetukseen":"Valmis noudettavaksi",luovutettu:o.kind==="kuljetus"?"Toimitettu":"Noudettu"}[status]+(r.mail?" · asiakas sai viestin":""));
  if(status==="hyvaksytty"&&!NEW().length)tab="kaynnissa";render();load()}
async function saveCfg(msg){const{error}=await SB.from("settings").upsert({key:"orders",value:CFG,updated_at:new Date().toISOString()});if(error)throw new Error(error.message);toast(msg);render()}

// ---------- Aukiolo
const hrs=k=>{const h=(S.hours||{})[k];return h&&h[0]&&h[1]?h:null};
const min=t=>{const[a,b]=t.split(":");return +a*60+ +b};
const nowMin=()=>{const p=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date()).split(":");return(+p[0]%24)*60+ +p[1]};
function openInfo(){const d=new Date(),k=WD[new Date(hToday()+"T12:00:00").getDay()],h=hrs(k),n=nowMin();
  if(h&&n>=min(h[0])&&n<min(h[1]))return{open:true,txt:"Auki klo "+h[1].replace(":",".")+" asti"};
  if(h&&n<min(h[0]))return{open:false,txt:"klo "+h[0].replace(":",".")};
  for(let i=1;i<8;i++){const x=new Date(hToday()+"T12:00:00");x.setDate(x.getDate()+i);const kk=WD[x.getDay()],hh=hrs(kk);if(hh)return{open:false,txt:(i===1?"huomenna ":WDL[x.getDay()]+" ")+"klo "+hh[0].replace(":",".")}}
  return{open:false,txt:""}}

// ---------- Näkymät
function head(){const n=NEW().length,k=RUN().length,on=!!CFG.on&&openInfo().open;
  $("#sb").classList.toggle("on",on);$("#sb").title=CFG.on?(on?"Auki":"Kiinni"):"Nettitilaus pois päältä";
  $("#cntN").textContent=n+k;$("#bdN").hidden=!n;$("#bdN").textContent=n;$("#bdK").hidden=!k;$("#bdK").textContent=k;
  document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("on",view==="aktiiviset"&&b.dataset.t===tab));
  document.querySelectorAll(".mi").forEach(b=>b.classList.toggle("on",b.dataset.v===view));
  $("#ttl").textContent=view==="aktiiviset"?TT[tab]:{aiemmat:"Aiemmat tilaukset",tuotteet:"Tuotelista",asetukset:"Asetukset"}[view];
  document.title=(n?"("+n+") UUSI TILAUS – ":"")+"Malakai Tilaukset"}
function render(){if(!ORD){$("#m").textContent="";return}head();const m=$("#m");m.textContent="";m.scrollTop=0;
  if(view==="aiemmat")return vPast(m);if(view==="tuotteet")return vProd(m);if(view==="asetukset")return vSet(m);
  const L=tab==="uudet"?NEW():tab==="kaynnissa"?RUN():DONE();
  if(!L.length){const oi=openInfo();
    if(tab==="uudet"&&!CFG.on)return m.append(mk("div",{class:"empty red"},mk("div",null,mk("h2",{text:"Nettitilaus on pois päältä"}),mk("p",{text:"Asiakkaat eivät voi tilata malakairavintola.fi:stä."}),btn("Avaa nettitilaus",async()=>{CFG={...CFG,on:true};await saveCfg("Nettitilaus avattu")},"eb"))));
    if(tab==="uudet"&&!oi.open)return m.append(mk("div",{class:"empty red"},mk("div",null,mk("h2",{text:"Ravintola on kiinni"+(oi.txt?", aukeaa "+oi.txt:"")}),mk("p",{text:"Ennakkotilaukset tulevat tänne myös kiinniolon aikana."}))));
    return m.append(mk("div",{class:"empty"},mk("div",null,mk("div",{class:"ic",html:IC(tab==="valmiit"?'<path d="M2 13l4 4L13 9M10 15l2 2 10-10"/>':'<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>')}),mk("h2",{text:{uudet:"Ei uusia tilauksia",kaynnissa:"Ei käynnissä olevia tilauksia",valmiit:"Ei vielä valmiita tilauksia tänään"}[tab]}),mk("p",{style:"color:var(--mut)",text:tab==="uudet"?"Uusi tilaus näkyy tässä ja tabletti piippaa, kunnes hyväksyt sen.":""}))))}
  m.append(mk("div",{class:"list"},L.map(card)))}
function card(o){const del=o.kind==="kuljetus",pre=preOf(o.want);
  const c=mk("div",{class:"oc "+o.status},
    mk("div",{class:"oh"},mk("b",{text:"#"+o.no}),mk("span",{class:"tag "+(del?"del":"nou"),text:del?"KULJETUS":"NOUTO"}),pre?mk("span",{class:"tag pre",text:"ENNAKKO"}):null,
      mk("div",{class:"tm"},o.eta&&o.status!=="uusi"?"Valmis klo "+o.eta.replace(":","."):wantTxt(o.want),mk("small",{text:"Tilattu "+hm(o.created_at)}))),
    mk("div",{class:"ob"},
      mk("div",{class:"cu"},mk("b",{text:o.name}),mk("a",{href:"tel:"+o.phone,text:o.phone})),
      del?mk("div",{class:"ad"},"📍 ",mk("b",{text:o.address+(o.apt?" "+o.apt:"")+", "+o.zip+" "+(o.city||"")}),o.door?mk("div",null,"Ovikoodi: ",mk("b",{text:o.door})):null,o.dnote?mk("div",null,"Kuljettajalle: ",mk("b",{text:o.dnote})):null):null,
      mk("ul",{class:"its"},(o.items||[]).map(i=>mk("li",null,mk("b",{text:i.q+" × "+i.n}),i.opt?mk("small",{text:i.opt}):null,i.m?mk("em",{text:"Toive: "+i.m}):null))),
      o.note?mk("div",{class:"nt",text:"📝 "+o.note}):null,
      mk("div",{class:"tot"},eur(o.total),mk("span",{text:(o.pay==="kateinen"?"KÄTEINEN":"KORTTI")+(del?" · kuljettajalle":" · kassalla")}))));
  if(o.status==="uusi"){const now=Date.now();
    c.append(mk("div",{class:"acts"},mk("p",{text:"Hyväksy – "+(del?"toimitus":"valmis")+" noin:"}),
      o.want==="heti"?etaPick(o,del)
        :btn("Hyväksy "+wantTxt(o.want),()=>setOrd(o,"hyvaksytty",{eta:pre?pre.t:o.want}),"g wide"),
      btn("Hylkää tilaus",()=>rejectSheet(o),"x")))}
  else if(o.status==="hyvaksytty")c.append(mk("div",{class:"acts"},mk("div",{class:"row2"},btn(del?"Lähti kuljetukseen":"Valmis noudettavaksi",()=>setOrd(o,"valmis",{notify:true}),"y"),btn(del?"Toimitettu":"Noudettu",()=>setOrd(o,"luovutettu"),"o"))));
  else if(o.status==="valmis")c.append(mk("div",{class:"acts"},btn(del?"Toimitettu":"Noudettu",()=>setOrd(o,"luovutettu"),"g wide")));
  else c.append(mk("div",{class:"st "+(o.status==="peruttu"?"no":"ok"),text:o.status==="peruttu"?"Hylätty"+(o.reason?": "+o.reason:""):(del?"Toimitettu ":"Noudettu ")+(o.done_at?hm(o.done_at):"")}));
  return c}
const ETA={};
function etaPick(o,del){let v=ETA[o.id]??(del?Math.min(60,+CFG.dtime||45):Math.min(60,+CFG.prep||20));v=Math.max(5,Math.min(60,Math.round(v/5)*5));
  const val=mk("b",{class:"ev"}),clk=mk("small"),ok=btn("",()=>setOrd(o,"hyvaksytty",{eta:hm(Date.now()+v*6e4)}),"g wide");
  const upd=()=>{ETA[o.id]=v;val.textContent=v+" min";clk.textContent=(del?"Perillä":"Valmis")+" noin klo "+hm(Date.now()+v*6e4).replace(":",".");ok.textContent="Hyväksy · "+v+" min";mi.disabled=v<=5;pl.disabled=v>=60};
  const mi=mk("button",{class:"es",text:"−5",onclick:()=>{v=Math.max(5,v-5);upd()}}),pl=mk("button",{class:"es",text:"+5",onclick:()=>{v=Math.min(60,v+5);upd()}});
  const quick=mk("div",{class:"eq"},[10,15,20,30,45,60].map(n=>mk("button",{text:n+"",onclick:()=>{v=n;upd()}})));
  upd();return mk("div",null,mk("div",{class:"ep"},mi,mk("div",{class:"ec"},val,clk),pl),quick,ok)}
function rejectSheet(o){const ta=mk("textarea",{placeholder:"Syy asiakkaalle"});
  const close=()=>s.remove();
  const s=mk("div",{class:"sheet",onclick:e=>{if(e.target===s)close()}},mk("div",null,mk("h3",{text:"Hylkää tilaus #"+o.no}),mk("p",{text:"Asiakas saa sähköpostin, jossa syy kerrotaan."}),
    mk("div",{class:"chips"},["Tuote on loppu","Liian kiireinen hetki","Osoite liian kaukana","Suljemme pian"].map(t=>mk("button",{text:t,onclick:()=>ta.value=t}))),ta,
    mk("div",{class:"row2"},btn("Peruuta",async()=>close(),"o"),btn("Hylkää",async()=>{await setOrd(o,"peruttu",{reason:ta.value.trim()});close()},"y"))));
  document.body.append(s)}
function storeSheet(){const oi=openInfo(),close=()=>s.remove();
  const s=mk("div",{class:"sheet",onclick:e=>{if(e.target===s)close()}},mk("div",null,
    mk("h3",{text:CFG.on?(oi.open?"Nettitilaus on auki":"Ravintola on kiinni"):"Nettitilaus on pois päältä"}),
    mk("p",{text:CFG.on?(oi.open?oi.txt+". ":"Aukeaa "+oi.txt+". Ennakkotilaukset ovat auki. ")+"Voit sulkea nettitilauksen tilapäisesti, esim. kiireen takia.":"Asiakkaat eivät voi nyt tilata sivulta."}),
    CFG.on?btn("Sulje nettitilaus",async()=>{CFG={...CFG,on:false};await saveCfg("Nettitilaus suljettu");close()},"x"):btn("Avaa nettitilaus",async()=>{CFG={...CFG,on:true};await saveCfg("Nettitilaus avattu");close()},"g wide"),
    btn("Peruuta",async()=>close(),"o wide")));
  s.querySelector(".btn.o").style.marginTop="10px";document.body.append(s)}
function vPast(m){const L=(ORD||[]).filter(o=>o.status==="luovutettu"||o.status==="peruttu");const box=mk("div",{class:"sec"});
  if(!L.length)box.append(mk("p",{style:"color:var(--mut)",text:"Ei aiempia tilauksia viimeisen viikon ajalta."}));
  let d0="";L.forEach(o=>{const d=hDate(o.created_at);if(d!==d0){d0=d;box.append(mk("h3",{text:d===hToday()?"Tänään":fd(d)}))}
    box.append(mk("div",{class:"ho",onclick:()=>{const s=mk("div",{class:"sheet",onclick:e=>{if(e.target===s)s.remove()}},mk("div",{style:"max-height:85vh;overflow:auto"},card(o)));document.body.append(s)}},
      mk("div",null,mk("b",{text:"#"+o.no+" · "+o.name}),mk("br"),mk("small",{text:hm(o.created_at)+" · "+(o.kind==="kuljetus"?"Kuljetus":"Nouto")+" · "+(o.items||[]).map(i=>i.q+"× "+i.n).join(", ")})),
      mk("div",{style:"text-align:right"},mk("b",{text:eur(o.total)}),mk("br"),mk("small",{style:"color:"+(o.status==="peruttu"?"#FF9A8C":"#7BE0A6"),text:o.status==="peruttu"?"Hylätty":"Valmis"}))))});
  m.append(box)}
function vProd(m){const out=new Set(CFG.soldout||[]),M=S.menu||{},box=mk("div",{class:"sec"},mk("p",{style:"color:var(--mut);margin-top:0",text:"Merkitse tuote loppuneeksi, niin sitä ei voi tilata netissä. Paina uudelleen, kun tuotetta taas on."}));
  Object.entries(M).forEach(([cat,o])=>{const its=(o.items||[]).filter(i=>+i[2]>0||i[0]==="Oma valinta");if(!its.length)return;box.append(mk("h3",{text:cat}));
    its.forEach(i=>{const k=cat+"|"+i[0],so=out.has(k);box.append(mk("div",{class:"pr"},mk("span",null,i[0],mk("br"),mk("small",{text:so?"LOPPU":"Myynnissä"})),
      mk("button",{class:"tg"+(so?" on":""),"aria-label":"Loppu",onclick:async()=>{if(so)out.delete(k);else out.add(k);CFG={...CFG,soldout:[...out]};try{await saveCfg(so?i[0]+" taas myynnissä":i[0]+" merkitty loppuneeksi")}catch(e){toast(e.message,true)}}})))})});
  m.append(box)}
function vSet(m){const box=mk("div",{class:"sec"},mk("h3",{text:"Nettitilaus"}),
  mk("div",{class:"pr"},mk("span",null,"Nettitilaus",mk("br"),mk("small",{text:CFG.on?"Auki – asiakkaat voivat tilata":"Pois päältä"})),mk("button",{class:"tg ok"+(CFG.on?" on":""),onclick:async()=>{CFG={...CFG,on:!CFG.on};try{await saveCfg(CFG.on?"Nettitilaus avattu":"Nettitilaus suljettu")}catch(e){toast(e.message,true)}}})),
  mk("div",{class:"pr"},mk("span",null,"Kotiinkuljetus",mk("br"),mk("small",{text:CFG.delivery?"Käytössä":"Vain nouto"})),mk("button",{class:"tg ok"+(CFG.delivery?" on":""),onclick:async()=>{CFG={...CFG,delivery:!CFG.delivery};try{await saveCfg(CFG.delivery?"Kotiinkuljetus päällä":"Vain nouto")}catch(e){toast(e.message,true)}}})),
  mk("h3",{text:"Tilausääni"}),
  mk("p",{style:"color:var(--mut);margin:0 0 6px",text:soundOk?"Ääni soi uudesta tilauksesta, kunnes hyväksyt tai hylkäät sen – 5 sekunnin tauko soittojen välissä.":"Ääni ei ole päällä – paina ylhäältä \"Ota äänet käyttöön\"."}),
  Object.entries(SOUNDS).map(([k,t])=>mk("div",{class:"pr"},mk("span",null,t,mk("br"),mk("small",{text:k===SND?"Valittu":""})),
    btn("▶ Kuuntele",async()=>{if(!soundOk)$("#sndOn").click();play(k)},"o"),
    mk("button",{class:"tg ok"+(k===SND?" on":""),"aria-label":"Valitse "+t,onclick:()=>{SND=k;LS.set("tab_snd",k);if(soundOk)play(k);render()}}))),
  (()=>{const v=mk("b",{text:VOL+" %"}),r=mk("input",{type:"range",min:"5",max:"100",step:"5",value:String(VOL),style:"flex:1;accent-color:#E3A51C;height:34px"});
    r.oninput=()=>{VOL=+r.value;v.textContent=VOL+" %";LS.set("tab_vol",VOL)};r.onchange=()=>{if(soundOk)play(SND)};
    return mk("div",{class:"pr"},mk("span",{style:"flex:none;width:130px"},"Voimakkuus"),r,v)})(),
  mk("p",{style:"color:var(--mut);margin:6px 0 18px;font-size:.92rem",text:"Tämä säätää sivun äänen. Pidä myös tabletin oma äänenvoimakkuus kovalla."}),

  mk("p",{style:"color:var(--mut);margin-top:18px",text:"Vinkki: pidä tämä sivu auki ja tabletti laturissa. Laita tabletin äänet kovalle ja näytön lukitus pois."}),
  btn("Kirjaudu ulos",async()=>{await SB.auth.signOut()},"x"));
  m.append(box)}
})();
