// Malakai Kauppias – oma tilausportaali. Vain omistajan tunnuksella.
(function(){
"use strict";
const OWNER="hardi7fateh@hotmail.com",C=window.MALAKAI||{},SITE=window.SITE||{},TZ="Europe/Helsinki";
const $=s=>document.querySelector(s);
const mk=(t,a,...k)=>{const e=document.createElement(t);if(a)for(const[x,v]of Object.entries(a)){if(x==="class")e.className=v;else if(x==="text")e.textContent=v;else if(x.startsWith("on"))e[x]=v;else if(v!==false&&v!=null)e.setAttribute(x,v===true?"":v)}k.flat().forEach(c=>c!=null&&c!==false&&e.append(c));return e};
const ls={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}}};
let toastT;function toast(t,bad){const e=$("#toast");e.textContent=t;e.className="toast"+(bad?" bad":"");e.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>e.hidden=true,bad?6000:3000)}
const act=(t,fn,c)=>mk("button",{class:"btn "+(c||""),text:t,onclick:async ev=>{const b=ev.currentTarget;b.disabled=true;try{await fn()}catch(e){toast(e.message||String(e),true)}finally{b.disabled=false}}});
const lab=(t,el)=>mk("label",{class:"f"},t,el);
const eur=n=>Number(n||0).toFixed(2).replace(".",",")+" €";
const eur0=n=>Math.round(Number(n||0)).toLocaleString("fi-FI")+" €";
const fe2=n=>Number(n||0).toFixed(2).replace(".",",");
const VATP=13.5,vatOf=t=>Math.round(t*VATP/(100+VATP)*100)/100;
const hm=d=>new Date(d).toLocaleTimeString("fi-FI",{timeZone:TZ,hour:"2-digit",minute:"2-digit"}).replace(".",":");
const hDate=d=>new Date(d).toLocaleDateString("en-CA",{timeZone:TZ});
const hToday=()=>hDate(new Date());
const addDays=(d,n)=>{const x=new Date(d+"T12:00:00");x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
const fd=d=>{const [y,m,dd]=String(d).split("-");return +dd+"."+ +m+"."+y};
const WD=["su","ma","ti","ke","to","pe","la"],WDL={ma:"Maanantai",ti:"Tiistai",ke:"Keskiviikko",to:"Torstai",pe:"Perjantai",la:"Lauantai",su:"Sunnuntai"};
const wd=d=>WD[new Date(d+"T12:00:00").getDay()];
const pct=(a,b)=>b?Math.round((a-b)/b*100):(a?100:0);
const dl=(name,txt)=>{const u=URL.createObjectURL(new Blob(["﻿"+txt],{type:"text/csv;charset=utf-8"}));const a=mk("a",{href:u,download:name});document.body.append(a);a.click();a.remove()};
const q=x=>'"'+String(x??"").replace(/"/g,'""')+'"';

// ---------- Kirjautuminen
let SB=null;
if(!C.url||!window.supabase){$("#m").append(mk("div",{class:"card login"},mk("h2",{text:"Yhteys puuttuu"}),mk("p",{class:"mut",text:"Kirjautumista ei voitu ladata. Tarkista nettiyhteys ja päivitä sivu."})));return}
SB=supabase.createClient(C.url,C.anon);
const isOwner=s=>!!s&&String(s.user?.email||"").toLowerCase()===OWNER;
function loginView(){document.body.classList.remove("in");$("#mn").hidden=true;$("#av").hidden=true;$("#dr").hidden=true;$("#ttl").textContent="Malakai Kauppias";
  const em=mk("input",{type:"email",autocomplete:"username",required:true}),pw=mk("input",{type:"password",autocomplete:"current-password",required:true}),b=mk("button",{class:"btn y",text:"Kirjaudu",style:"width:100%"});
  const f=mk("form",{class:"card login"},mk("h2",{text:"Kirjaudu kauppiasportaaliin"}),mk("p",{class:"mut",text:"Vain Malakai Ravintolan omistajalle."}),lab("Sähköposti",em),lab("Salasana",pw),b);
  f.onsubmit=async e=>{e.preventDefault();b.disabled=true;const {data,error}=await SB.auth.signInWithPassword({email:em.value.trim(),password:pw.value});
    if(error||!isOwner(data?.session)){if(!error)await SB.auth.signOut({scope:"local"});b.disabled=false;pw.value="";return toast("Kirjautuminen epäonnistui",true)}location.reload()};
  $("#m").textContent="";$("#m").append(f);em.focus()}
SB.auth.onAuthStateChange(ev=>{if(ev==="SIGNED_OUT")location.reload()});
SB.auth.getSession().then(async({data})=>{if(!isOwner(data.session)){if(data.session)await SB.auth.signOut({scope:"local"});return loginView()}boot()});

async function api(action,d,again){const{data:{session}}=await SB.auth.getSession();if(!session)throw new Error("Kirjaudu uudelleen");
  const r=await fetch(C.url+"/functions/v1/admin",{method:"POST",headers:{"Content-Type":"application/json",apikey:C.anon,Authorization:"Bearer "+session.access_token},body:JSON.stringify({action,...d})});
  const j=await r.json().catch(()=>({}));
  if(r.status===401&&!again){const{data:rf,error:re}=await SB.auth.refreshSession();if(!re&&rf?.session)return api(action,d,true);await SB.auth.signOut({scope:"local"}).catch(()=>{});location.reload();throw new Error("Kirjaudu uudelleen")}
  if(!r.ok)throw new Error(j.error||"Virhe "+r.status);return j}

// ---------- Tila
let view=(location.hash||"#koti").slice(1),ORD=null,OCFG={},CUS=null,period="d",oSound=ls.get("ord_sound")==="1",oAC=null,oSeen=new Set(),oWake=null,oShowDone=false,repM=null,REP=null,repKey="";
const IC={
 koti:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
 tilaukset:'<path d="M6 3h12l1 4H5zM5 7h14v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM9 11h6M9 15h6"/>',
 myynti:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
 tuotteet:'<path d="M4 6h16M4 12h16M4 18h10"/>',
 kampanjat:'<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12"/>',
 asiakkaat:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 4 6"/>',
 yritys:'<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/>',
 ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'};
const svg=k=>{const s=document.createElementNS("http://www.w3.org/2000/svg","svg");s.setAttribute("viewBox","0 0 24 24");s.setAttribute("fill","none");s.setAttribute("stroke","currentColor");s.setAttribute("stroke-width","1.8");s.setAttribute("stroke-linecap","round");s.setAttribute("stroke-linejoin","round");s.innerHTML=IC[k];return s};
const NAV=[["koti","Koti"],["tilaukset","Tilaukset"],["myynti","Myyntiraportit"],["tuotteet","Tuotteet"],["kampanjat","Kampanjat"],["asiakkaat","Asiakkaat"],["yritys","Yritystiedot"]];
const TITLE={koti:"Hei Hardi!",tilaukset:"Tilaukset",myynti:"Myyntiraportit",tuotteet:"Tuotteet",kampanjat:"Kampanjat",asiakkaat:"Asiakkaat",yritys:"Yritystiedot"};

function boot(){document.body.classList.add("in");
  $("#mn").onclick=()=>$("#dr").classList.add("open");$("#drx").onclick=()=>$("#dr").classList.remove("open");
  $("#av").onclick=()=>go("yritys");$("#lo").onclick=()=>SB.auth.signOut({scope:"local"});
  addEventListener("hashchange",()=>{const v=location.hash.slice(1);if(v&&v!==view){view=v;render()}});
  ordLoad().then(render).catch(e=>{toast(e.message,true);ORD=[];render()});
  setInterval(()=>{if(!document.hidden||view==="tilaukset")ordLoad().catch(()=>{})},10000);
  setInterval(()=>{if(ORD&&ORD.some(o=>o.status==="uusi"))beep()},4000);
  render()}
function go(v){view=v;if(location.hash!=="#"+v)history.replaceState(null,"","#"+v);$("#dr").classList.remove("open");render();scrollTo(0,0)}
function nav(){const n=$("#nav");n.textContent="";const nw=ORD?ORD.filter(o=>o.status==="uusi").length:0;
  n.append(mk("small",{text:"Malakai Ravintola"}));
  NAV.forEach(([k,t])=>{const a=mk("a",{href:"#"+k,class:k===view?"on":"",onclick:e=>{e.preventDefault();go(k)}},svg(k),t,k==="tilaukset"&&nw?mk("span",{class:"bdg",text:String(nw)}):null);n.append(a)});
  n.append(mk("small",{text:"Muut"}),
    mk("a",{href:"tilaa.html",target:"_blank",rel:"noopener"},svg("ext"),"Tilaussivu asiakkaille"),
    mk("a",{href:"https://merchant.wolt.com/",target:"_blank",rel:"noopener"},svg("ext"),"Wolt Merchant"),
    mk("a",{href:"admin.html",target:"_blank",rel:"noopener"},svg("ext"),"Sivuston ylläpito"))}

// ---------- Data
async function ordLoad(){const since=new Date(Date.now()-16*864e5).toISOString();
  const [a,b]=await Promise.all([SB.from("orders").select("*").or(`created_at.gte."${since}",status.in.(uusi,hyvaksytty,valmis)`).order("created_at",{ascending:false}),SB.from("settings").select("value").eq("key","orders").maybeSingle()]);
  if(a.error)throw new Error(a.error.message);
  const fresh=a.data.filter(o=>o.status==="uusi"&&!oSeen.has(o.id));
  if(ORD&&fresh.length){if("Notification"in window&&Notification.permission==="granted")try{new Notification("Uusi tilaus #"+fresh[0].no,{body:(fresh[0].kind==="kuljetus"?"Kuljetus":"Nouto")+" · "+eur(fresh[0].total)})}catch(e){}beep()}
  ORD=a.data;OCFG=(b.data&&b.data.value)||OCFG||{};ORD.forEach(o=>oSeen.add(o.id));
  const n=ORD.filter(o=>o.status==="uusi").length;document.title=(n?"("+n+") UUSI TILAUS – ":"")+"Malakai Kauppias";
  const busy=document.activeElement&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if((view==="tilaukset"||view==="koti")&&!busy)render();else{nav();newbar()}}
function newbar(){const b=$("#nb"),n=ORD?ORD.filter(o=>o.status==="uusi").length:0;b.hidden=!n||view==="tilaukset";b.textContent="🔔 "+n+(n>1?" uutta tilausta":" uusi tilaus")+" – avaa";b.onclick=()=>go("tilaukset")}
function beep(){if(!oSound)return;try{oAC=oAC||new (window.AudioContext||window.webkitAudioContext)();const t=oAC.currentTime;[0,.25,.5].forEach((d,i)=>{const o=oAC.createOscillator(),g=oAC.createGain();o.frequency.value=i===2?1175:880;o.type="square";g.gain.setValueAtTime(.0001,t+d);g.gain.exponentialRampToValueAtTime(.35,t+d+.02);g.gain.exponentialRampToValueAtTime(.0001,t+d+.2);o.connect(g).connect(oAC.destination);o.start(t+d);o.stop(t+d+.22)})}catch(e){}}
async function saveCfg(msg){const {error}=await SB.from("settings").upsert({key:"orders",value:OCFG,updated_at:new Date().toISOString()});if(error)throw new Error(error.message);toast(msg||"Tallennettu");render()}
async function setOrd(o,status,extra={}){const r=await api("order",{id:o.id,status,...extra});Object.assign(o,{status},extra.eta?{eta:extra.eta}:{});
  toast({hyvaksytty:"Hyväksytty",peruttu:"Peruttu",valmis:"Merkitty valmiiksi",luovutettu:"Luovutettu"}[status]+(r.mail?" · asiakkaalle lähti sähköposti":""));await ordLoad();render()}
const live=()=>(ORD||[]).filter(o=>o.status!=="peruttu");
const onDay=(arr,d)=>arr.filter(o=>hDate(o.created_at)===d);
const sumT=a=>Math.round(a.reduce((x,o)=>x+ +o.total,0)*100)/100;

// ---------- Näkymät
function render(){nav();newbar();const m=$("#m");m.textContent="";$("#ttl").textContent=TITLE[view]||(view="koti",TITLE.koti);
  if(ORD===null){m.append(mk("div",{class:"card"},mk("p",{class:"mut",text:"Ladataan…"})));return}
  ({koti:vKoti,tilaukset:vTil,myynti:vRep,tuotteet:vProd,kampanjat:vCamp,asiakkaat:vCust,yritys:vYri})[view](m)}

const dl1=(a,b,lbl)=>{const p=pct(a,b);return mk("div",{class:"dl"},mk("i",{class:p>=0?"up":"dn",text:(p>=0?"↑ ":"↓ ")+Math.abs(p)+" %"})," "+lbl)};
function todayHours(){const k=wd(hToday()),h=(SITE.hours||{})[k];return h&&h[0]?h[0].replace(":",".")+"–"+h[1].replace(":","."):"suljettu"}
function vKoti(m){const t=hToday(),y=addDays(t,-1),L=live(),T=onDay(L,t),Y=onDay(L,y),canc=onDay(ORD.filter(o=>o.status==="peruttu"),t);
  const open=ORD.filter(o=>["uusi","hyvaksytty","valmis"].includes(o.status)),c=OCFG;
  // Kauppojen yleiskatsaus
  const sw=(on,fn)=>mk("button",{class:"sw"+(on?" on":""),"aria-pressed":on?"true":"false",onclick:fn});
  const store=(av,name,tag,sub,ctl)=>mk("div",{class:"store"},av,mk("div",null,mk("b",null,name,tag?mk("span",{class:"tag",text:tag}):null),mk("small",{text:sub})),ctl);
  const logo=on=>mk("span",{class:"sav"},mk("img",{src:"media/logo-malakai.svg",alt:""}),mk("i",{class:"dot"+(on?" on":"")}));
  m.append(mk("section",{class:"card"},mk("h2",{text:"Kauppojen yleiskatsaus"}),
    mk("div",{class:"kpis"},
      mk("div",{class:"kpi"},mk("small",{text:"Tilauksia tänään"}),mk("b",{text:String(T.length)}),dl1(T.length,Y.length,"vs eilen")),
      mk("div",{class:"kpi"},mk("small",{text:"Hylätyt tilaukset tänään"}),mk("b",{text:String(canc.length)}),mk("div",{class:"dl",text:canc.length?"Tarkista syyt Tilauksista":"Hienoa, ei hylkäyksiä"}))),
    mk("div",{style:"margin-top:8px"},
      store(logo(c.on),"Malakai Ravintola","Nettitilaus",(c.on?"Online":"Offline")+" · avoinna tänään "+todayHours(),sw(c.on,()=>{OCFG={...c,on:!c.on};saveCfg(OCFG.on?"Nettitilaus on nyt PÄÄLLÄ":"Nettitilaus on nyt POIS").catch(e=>toast(e.message,true))})),
      store(logo(c.on&&c.delivery),"Kotiinkuljetus","Oma kuljetus",(c.delivery?"Päällä":"Pois")+" · "+eur(c.fee)+" · min. "+eur0(c.min),sw(c.delivery,()=>{OCFG={...c,delivery:!c.delivery};saveCfg(OCFG.delivery?"Kotiinkuljetus päällä":"Kotiinkuljetus pois").catch(e=>toast(e.message,true))})),
      store(mk("span",{class:"sav w",text:"Wolt"}),"Malakai Ravintola","Wolt","Tilaukset ja tila Woltin omassa portaalissa",mk("a",{class:"btn o",href:"https://merchant.wolt.com/",target:"_blank",rel:"noopener",text:"Avaa"})))));
  if(open.length)m.append(mk("section",{class:"card",style:"background:var(--y2)"},mk("h2",{text:open.length+" avointa tilausta"}),
    mk("p",{class:"mut",style:"color:#5b4300",text:open.filter(o=>o.status==="uusi").length+" odottaa hyväksyntää · "+open.filter(o=>o.status!=="uusi").length+" työn alla"}),act("Avaa tilaukset",async()=>go("tilaukset"),"")));
  // Myynnin yleiskatsaus
  const P={d:[[t],[y],"vs eilen"],y:[[y],[addDays(t,-2)],"vs toissapäivä"],w:[[...Array(7)].map((_,i)=>addDays(t,-i)),[...Array(7)].map((_,i)=>addDays(t,-7-i)),"vs edelliset 7 päivää"]}[period];
  const cur=L.filter(o=>P[0].includes(hDate(o.created_at))),prev=L.filter(o=>P[1].includes(hDate(o.created_at))),s=sumT(cur);
  const pb=(k,tx)=>mk("button",{class:period===k?"on":"",text:tx,onclick:()=>{period=k;render()}});
  const days=[...Array(7)].map((_,i)=>addDays(t,i-6)),vals=days.map(d=>sumT(onDay(L,d))),mx=Math.max(1,...vals);
  m.append(mk("section",{class:"card"},mk("h2",{text:"Myynnin yleiskatsaus"}),mk("div",{class:"mut",text:"Malakai Ravintola · nettitilaukset"}),
    mk("div",{class:"pill3"},pb("d","Tänään"),pb("y","Eilen"),pb("w","Viimeiset 7 päivää")),
    mk("div",{class:"big"},eur(s),mk("span",null,dl1(s,sumT(prev),P[2]))),
    mk("div",{class:"tiles",style:"margin-top:16px"},
      mk("div",{class:"tile"},mk("small",{text:"Tilauksia"}),mk("b",{text:String(cur.length)})),
      mk("div",{class:"tile"},mk("small",{text:"Keskiostos"}),mk("b",{text:cur.length?eur(s/cur.length):"–"})),
      mk("div",{class:"tile"},mk("small",{text:"ALV 13,5 %"}),mk("b",{text:eur(vatOf(s))})),
      mk("div",{class:"tile"},mk("small",{text:"Nouto / kuljetus"}),mk("b",{text:cur.filter(o=>o.kind!=="kuljetus").length+" / "+cur.filter(o=>o.kind==="kuljetus").length}))),
    mk("div",{class:"chart","aria-label":"Myynti 7 päivää"},days.map((d,i)=>mk("div",{class:d===t?"now":"",title:wd(d)+" "+fd(d)+": "+eur(vals[i])},mk("small",{text:vals[i]?eur0(vals[i]):""}),mk("i",{style:"height:"+Math.max(4,Math.round(vals[i]/mx*110))+"px"}),mk("small",{text:wd(d)}))))));
  // Suosituimmat
  const pr={};L.filter(o=>hDate(o.created_at)>=addDays(t,-6)).forEach(o=>(o.items||[]).forEach(i=>{pr[i.n]=(pr[i.n]||0)+ +i.q}));
  const top=Object.entries(pr).sort((a,b)=>b[1]-a[1]).slice(0,5);
  m.append(mk("section",{class:"card"},mk("h2",{text:"Suosituimmat tuotteet (7 pv)"}),top.length?top.map(([n,k],i)=>mk("div",{class:"kv"},mk("span",{text:(i+1)+". "+n}),mk("b",{text:k+" kpl"}))):mk("p",{class:"mut",text:"Ei vielä tilauksia viimeisen viikon ajalta."})));
  if(!c.on)m.append(mk("div",{class:"warn"},mk("b",{text:"Nettitilaus on pois päältä. "}),"Asiakkaat eivät voi tilata sivulta. Kytke se päälle yllä olevasta kytkimestä."))}

const preOf=w=>{const m=String(w||"").match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/);return m?{d:m[1],t:m[2]}:null};
const wantTxt=w=>{if(w==="heti")return"Heti";const p=preOf(w);return p?wd(p.d)+" "+fd(p.d)+" klo "+p.t.replace(":","."):"klo "+String(w).replace(":",".")};
function ordCard(o){const del=o.kind==="kuljetus",pre=preOf(o.want),want=wantTxt(o.want);
  const c=mk("div",{class:"oc "+o.status},
    mk("h4",null,"#"+o.no,mk("span",{class:"k"+(del?" del":""),text:del?"KULJETUS":"NOUTO"}),pre?mk("span",{class:"k",style:"background:var(--y2);color:#7A5200",text:"ENNAKKO"}):null,mk("small",{text:hm(o.created_at)+(hDate(o.created_at)!==hToday()?" · "+fd(hDate(o.created_at)):"")})),
    mk("div",{class:"meta"},mk("b",{text:o.name}),"  ",mk("a",{href:"tel:"+o.phone,text:o.phone}),mk("br"),"Toivottu aika: ",mk("b",{text:want}),o.eta?mk("span",null," · Luvattu: ",mk("b",{text:"klo "+o.eta.replace(":",".")})):null,
      del?mk("div",null,"Osoite: ",mk("b",{text:o.address+(o.apt?" "+o.apt:"")+", "+o.zip+" "+(o.city||"")}),o.door?mk("span",null," · Ovikoodi: ",mk("b",{text:o.door})):null,o.dnote?mk("div",null,"Kuljettajalle: ",mk("b",{text:o.dnote})):null," ",mk("a",{href:"https://maps.google.com/?q="+encodeURIComponent(o.address+", "+o.zip+" "+(o.city||"")),target:"_blank",rel:"noopener",text:"kartta"})):null),
    mk("ul",null,(o.items||[]).map(i=>mk("li",null,mk("b",{text:i.q+" × "+i.n}),i.opt?mk("small",{text:i.opt}):null,i.m?mk("em",{text:"Toive: "+i.m}):null))),
    o.note?mk("div",{class:"meta"},"Lisätiedot: ",mk("b",{text:o.note})):null,
    mk("div",{class:"tot"},eur(o.total),mk("span",{text:"  sis. ALV "+eur(vatOf(+o.total))+" · "+(o.pay==="kateinen"?"KÄTEINEN":"KORTTI")+(o.fee>0?" · kuljetus "+eur(o.fee):"")+(o.discount>0?" · "+(o.discount_note||"alennus")+" −"+eur(o.discount):"")})));
  if(o.status==="uusi"){const now=new Date();
    c.append(mk("div",{class:"mut",text:"Hyväksy ja valitse "+(del?"toimitusaika":"valmistumisaika")+":"}),
      mk("div",{class:"etas"},(o.want==="heti"?[10,15,20,30,45,60]:[0]).map(mn=>{const t=o.want==="heti"?hm(new Date(now.getTime()+mn*60e3)):(pre?pre.t:o.want);return act(o.want==="heti"?mn+" min":"Vahvista "+wantTxt(o.want),()=>setOrd(o,"hyvaksytty",{eta:t}),"g")})),
      mk("div",{class:"row"},act("Hylkää tilaus",()=>{const r=prompt("Hylkäyksen syy asiakkaalle (esim. tuote loppu, liian kaukana):","");if(r===null)return;return setOrd(o,"peruttu",{reason:r})},"o")))}
  else if(o.status==="hyvaksytty")c.append(mk("div",{class:"row"},act(del?"Lähti kuljetukseen":"Valmis noudettavaksi",()=>setOrd(o,"valmis",{notify:true}),"y"),act(del?"Toimitettu":"Noudettu",()=>setOrd(o,"luovutettu"),"o")));
  else if(o.status==="valmis")c.append(mk("div",{class:"row"},act(del?"Toimitettu":"Noudettu",()=>setOrd(o,"luovutettu"),"g")));
  else c.append(mk("div",{class:"st "+(o.status==="peruttu"?"dn":"up"),text:o.status==="peruttu"?"Hylätty"+(o.reason?": "+o.reason:""):"Luovutettu "+(o.done_at?hm(o.done_at):"")}));
  const bl=OCFG.blocked||{e:[],p:[]},isB=(bl.e||[]).includes(o.email)||(bl.p||[]).includes(o.phone);
  c.append(mk("div",{class:"row",style:"margin-top:8px"},act(isB?"Poista esto":"🚫 Estä asiakas",async()=>{const B={e:[...(bl.e||[])],p:[...(bl.p||[])]};
    if(isB){B.e=B.e.filter(x=>x!==o.email);B.p=B.p.filter(x=>x!==o.phone)}else{if(!confirm("Estetäänkö "+o.name+" ("+o.phone+", "+o.email+")? Hän ei voi enää tilata netistä."))return;B.e.push(o.email);B.p.push(o.phone)}
    OCFG={...OCFG,blocked:B};await saveCfg(isB?"Esto poistettu":"Asiakas estetty")},"o")));
  return c}
function vTil(m){const c=OCFG;
  const sB=act(oSound?"🔔 Äänimerkki päällä":"🔕 Ota äänimerkki käyttöön",async()=>{oSound=!oSound;ls.set("ord_sound",oSound?"1":null);if(oSound){beep();if("Notification"in window&&Notification.permission==="default")Notification.requestPermission()}render()},oSound?"o":"y");
  const wB=act(oWake?"Näyttö pysyy päällä":"Pidä näyttö päällä",async()=>{if(oWake){await oWake.release();oWake=null}else if(navigator.wakeLock){oWake=await navigator.wakeLock.request("screen");oWake.addEventListener("release",()=>{oWake=null})}else toast("Laite ei tue tätä. Säädä näytön lukitus puhelimen asetuksista.",true);render()},"o");
  m.append(mk("section",{class:"card"},mk("div",{class:"row",style:"justify-content:space-between"},mk("div",null,mk("b",{text:c.on?"🟢 Nettitilaus online":"⚪ Nettitilaus offline"}),mk("div",{class:"mut",text:"Päivittyy itsestään 10 sekunnin välein"})),mk("div",{class:"row"},sB,wB))));
  const pk=o=>{const p=preOf(o.want);return p?p.d+" "+p.t:"0"},open=ORD.filter(o=>["uusi","hyvaksytty","valmis"].includes(o.status)).sort((a,b)=>(a.status==="uusi"?0:1)-(b.status==="uusi"?0:1)||pk(a).localeCompare(pk(b))||({uusi:0,hyvaksytty:1,valmis:2}[a.status]-{uusi:0,hyvaksytty:1,valmis:2}[b.status])||new Date(a.created_at)-new Date(b.created_at));
  m.append(open.length?mk("div",{class:"oq",style:"margin-top:16px"},open.map(ordCard)):mk("section",{class:"card"},mk("p",{class:"mut",text:c.on?"Ei avoimia tilauksia.":"Nettitilaus on pois päältä, joten asiakkaat eivät voi tilata. Kytke se päälle Koti-sivulta."})));
  const t=hToday(),done=ORD.filter(o=>["luovutettu","peruttu"].includes(o.status)&&hDate(o.created_at)>=addDays(t,-1)),T=onDay(live(),t),s=sumT(T);
  m.append(mk("p",{class:"mut",style:"margin:16px 4px"},"Tänään "+T.length+" tilausta · "+eur(s)+" (ALV "+eur(vatOf(s))+"). ",done.length?mk("a",{href:"#",text:oShowDone?"Piilota valmiit":"Näytä valmiit ("+done.length+")",onclick:e=>{e.preventDefault();oShowDone=!oShowDone;render()}}):null));
  if(oShowDone)m.append(mk("div",{class:"oq"},done.map(ordCard)))}

async function repLoad(ym){const [y,mo]=ym.split("-").map(Number),a=new Date(y,mo-1,1),b=new Date(y,mo,1);
  const {data,error}=await SB.from("orders").select("*").gte("created_at",new Date(a.getTime()-864e5).toISOString()).lt("created_at",new Date(b.getTime()+864e5).toISOString()).order("created_at");
  if(error)throw new Error(error.message);REP=(data||[]).filter(o=>hDate(o.created_at).slice(0,7)===ym);repKey=ym}
function vRep(m){if(!repM)repM=hToday().slice(0,7);
  const mi=mk("input",{type:"month",value:repM,max:hToday().slice(0,7)});mi.onchange=()=>{repM=mi.value;REP=null;render()};
  m.append(mk("section",{class:"card noprint g2",style:"align-items:end"},lab("Kuukausi",mi),mk("div",{class:"row",style:"margin-bottom:12px;justify-content:flex-end"},act("Tulosta / PDF",async()=>print(),"o"))));
  if(REP===null||repKey!==repM){m.append(mk("p",{class:"mut",text:"Ladataan…"}));repLoad(repM).then(render).catch(e=>toast(e.message,true));return}
  const ok=REP.filter(o=>o.status!=="peruttu"),canc=REP.filter(o=>o.status==="peruttu");
  const sum=(a,k)=>Math.round(a.reduce((x,o)=>x+ +(o[k]||0),0)*100)/100;
  const gross=sum(ok,"total"),vat=Math.round(ok.reduce((x,o)=>x+vatOf(+o.total),0)*100)/100,net=Math.round((gross-vat)*100)/100;
  const nou=ok.filter(o=>o.kind!=="kuljetus"),kul=ok.filter(o=>o.kind==="kuljetus"),kat=ok.filter(o=>o.pay==="kateinen"),kor=ok.filter(o=>o.pay!=="kateinen");
  const [y,mo]=repM.split("-"),MN=["tammikuu","helmikuu","maaliskuu","huhtikuu","toukokuu","kesäkuu","heinäkuu","elokuu","syyskuu","lokakuu","marraskuu","joulukuu"][+mo-1];
  const kv=(k,v)=>mk("div",{class:"kv"},mk("span",{text:k}),mk("b",{text:v}));
  m.append(mk("section",{class:"card"},mk("h2",{text:"Nettitilaukset – "+MN+" "+y}),mk("p",{class:"mut",text:"Malakai Ravintola · Tampereentie 414, 33880 Lempäälä · Summat sisältävät ALV:n 13,5 %."}),
    mk("div",{class:"tiles"},mk("div",{class:"tile"},mk("small",{text:"Myynti (sis. ALV)"}),mk("b",{text:eur(gross)})),mk("div",{class:"tile"},mk("small",{text:"ALV 13,5 %"}),mk("b",{text:eur(vat)})),mk("div",{class:"tile"},mk("small",{text:"Veroton"}),mk("b",{text:eur(net)})),mk("div",{class:"tile"},mk("small",{text:"Tilauksia · keskiostos"}),mk("b",{text:ok.length+" · "+(ok.length?eur(gross/ok.length):"–")})))));
  m.append(mk("div",{class:"g2"},
    mk("section",{class:"card",style:"margin:0"},mk("h3",{text:"Erittely"}),kv("Tuotemyynti",eur(sum(ok,"subtotal"))),kv("Kuljetusmaksut",eur(sum(ok,"fee"))),kv("Alennukset (uuden asiakkaan etu)","−"+eur(sum(ok,"discount"))),kv("Myynti yhteensä",eur(gross)),kv("josta ALV 13,5 %",eur(vat)),kv("Veroton",eur(net))),
    mk("section",{class:"card",style:"margin:0"},mk("h3",{text:"Tilaukset"}),kv("Nouto",nou.length+" kpl · "+eur(sum(nou,"total"))),kv("Kotiinkuljetus",kul.length+" kpl · "+eur(sum(kul,"total"))),kv("Kortilla",kor.length+" kpl · "+eur(sum(kor,"total"))),kv("Käteisellä",kat.length+" kpl · "+eur(sum(kat,"total"))),kv("Uudet asiakkaat (alennus)",ok.filter(o=>o.discount>0).length+" kpl"),kv("Hylätyt",canc.length+" kpl"))));
  const days={};ok.forEach(o=>{const d=hDate(o.created_at);(days[d]=days[d]||[]).push(o)});
  const tb=(hs,rows)=>mk("div",{class:"scroll"},mk("table",{class:"list"},mk("tr",null,hs.map(h=>mk("th",{text:h}))),rows));
  const pr={};ok.forEach(o=>(o.items||[]).forEach(i=>{const k=i.n+(i.opt&&/Perhe|Normaali/.test(i.opt)?" ("+i.opt.split(" · ")[0]+")":"");pr[k]=pr[k]||{q:0,s:0};pr[k].q+=+i.q;pr[k].s+=i.unit*i.q}));
  m.append(mk("section",{class:"card"},mk("h3",{text:"Myynti päivittäin"}),Object.keys(days).length?tb(["Päivä","Tilauksia","Myynti","ALV","Veroton"],Object.keys(days).sort().map(d=>{const g=sumT(days[d]),v=Math.round(days[d].reduce((x,o)=>x+vatOf(+o.total),0)*100)/100;return mk("tr",null,mk("td",{text:wd(d)+" "+fd(d)}),mk("td",{text:days[d].length}),mk("td",{text:eur(g)}),mk("td",{text:eur(v)}),mk("td",{text:eur(g-v)}))})):mk("p",{class:"mut",text:"Ei myyntiä."})),
    mk("section",{class:"card"},mk("h3",{text:"Myydyt tuotteet"}),Object.keys(pr).length?tb(["Tuote","Kpl","Myynti"],Object.entries(pr).sort((a,b)=>b[1].s-a[1].s).map(([k,v])=>mk("tr",null,mk("td",{text:k}),mk("td",{text:v.q}),mk("td",{text:eur(v.s)})))):mk("p",{class:"mut",text:"Ei myyntiä."})),
    mk("section",{class:"card"},mk("h3",{text:"Kaikki tilaukset"}),REP.length?tb(["Nro","Pvm","Klo","Asiakas","Tapa","Maksu","Yhteensä","ALV","Tila"],REP.map(o=>mk("tr",{class:o.status==="peruttu"?"x":""},mk("td",{text:"#"+o.no}),mk("td",{text:fd(hDate(o.created_at))}),mk("td",{text:hm(o.created_at)}),mk("td",{text:o.name}),mk("td",{text:o.kind==="kuljetus"?"Kuljetus":"Nouto"}),mk("td",{text:o.pay==="kateinen"?"Käteinen":"Kortti"}),mk("td",{text:eur(o.total)}),mk("td",{text:eur(vatOf(+o.total))}),mk("td",{text:o.status==="peruttu"?"Hylätty":"Myyty"})))):mk("p",{class:"mut",text:"Ei tilauksia tässä kuussa."})));
  m.append(mk("section",{class:"card noprint"},mk("h3",{text:"Lataa kirjanpitoon"}),mk("p",{class:"mut",text:"CSV-tiedostot avautuvat Excelissä. Lähetä ne tilitoimistolle kuukauden raportin kanssa."}),
    mk("div",{class:"row"},
      act("Tilaukset (CSV)",async()=>dl(`malakai-tilaukset-${repM}.csv`,["tilausnro;pvm;klo;asiakas;puhelin;sahkoposti;tapa;tuotteet_eur;kuljetus_eur;alennus_eur;yhteensa_eur;alv_13_5_eur;veroton_eur;tila;maksutapa"].concat(REP.map(o=>["#"+o.no,fd(hDate(o.created_at)),hm(o.created_at),q(o.name),q(o.phone),q(o.email),o.kind,fe2(o.subtotal),fe2(o.fee),fe2(o.discount),fe2(o.total),fe2(vatOf(+o.total)),fe2(+o.total-vatOf(+o.total)),o.status==="peruttu"?"hylatty":"myyty",o.pay==="kateinen"?"kateinen":"kortti"].join(";"))).join("\n")),"o"),
      act("Päivittäin (CSV)",async()=>dl(`malakai-myynti-paivittain-${repM}.csv`,["pvm;tilauksia;myynti_sis_alv_eur;alv_13_5_eur;veroton_eur"].concat(Object.keys(days).sort().map(d=>{const g=sumT(days[d]),v=Math.round(days[d].reduce((x,o)=>x+vatOf(+o.total),0)*100)/100;return[fd(d),days[d].length,fe2(g),fe2(v),fe2(g-v)].join(";")})).concat([["YHTEENSA",ok.length,fe2(gross),fe2(vat),fe2(net)].join(";")]).join("\n")),"o"),
      act("Tuotteet (CSV)",async()=>dl(`malakai-tuotteet-${repM}.csv`,["tuote;kpl;myynti_eur"].concat(Object.entries(pr).map(([k,v])=>[q(k),v.q,fe2(v.s)].join(";"))).join("\n")),"o"))))}

function vProd(m){const out=new Set(OCFG.soldout||[]),hid=new Set(OCFG.hidden||[]),M=SITE.menu||{},sq=mk("input",{type:"search",placeholder:"Hae tuotetta…"}),list=mk("div");
  const save=async(msg)=>{OCFG={...OCFG,soldout:[...out],hidden:[...hid]};try{await saveCfg(msg)}catch(e){toast(e.message,true)}};
  const sw=(on,lab,fn,cls)=>mk("button",{class:"psw"+(on?" on":"")+(cls?" "+cls:""),"aria-pressed":on?"true":"false",onclick:fn},mk("i"),mk("span",{text:lab}));
  const draw=()=>{const v=sq.value.trim().toLowerCase();list.textContent="";Object.entries(M).forEach(([cat,o])=>{const its=(o.items||[]).filter(i=>(+i[2]>0||i[0]==="Oma valinta")&&(!v||i[0].toLowerCase().includes(v)));if(!its.length)return;
    list.append(mk("h3",{text:cat,style:"margin:20px 0 6px"}),mk("div",{class:"plist"},its.map(i=>{const k=cat+"|"+i[0],h=hid.has(k),so=out.has(k);
      return mk("div",{class:"prow"+(h?" hid":"")},mk("div",{class:"pn"},mk("b",{text:i[0]}),mk("small",{text:(+i[2]>0?eur(+i[2]):"")+(h?" · piilotettu":so?" · loppu":"")})),
        sw(!h,h?"Piilossa":"Näkyy",()=>{if(h)hid.delete(k);else hid.add(k);save(h?i[0]+" näkyy taas tilaussivulla":i[0]+" piilotettu tilaussivulta")}),
        sw(so,so?"Loppu":"Myynnissä",()=>{if(so)out.delete(k);else out.add(k);save(so?i[0]+" taas myynnissä":i[0]+" merkitty loppuneeksi")},"red"))})))})};
  sq.oninput=draw;draw();
  m.append(mk("section",{class:"card"},mk("h2",{text:"Tuotteet tilaussivulla"}),
    mk("p",{class:"mut",text:"Näkyy / Piilossa: piilotettu tuote poistuu kokonaan tilaussivulta, eikä sitä voi tilata. Myynnissä / Loppu: tuote näkyy, mutta siinä lukee LOPPU. Paina uudelleen, niin tuote palaa. Hinnat muokataan sivuston ylläpidossa."}),
    mk("div",{class:"kv"},mk("span",{text:"Piilotettuja"}),mk("b",{text:String(hid.size)})),mk("div",{class:"kv"},mk("span",{text:"Loppuneita"}),mk("b",{text:String(out.size)})),
    sq,(out.size||hid.size)?mk("div",{style:"margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"},hid.size?act("Näytä kaikki",async()=>{OCFG={...OCFG,hidden:[]};await saveCfg("Kaikki tuotteet näkyvissä")},"o"):null,out.size?act("Kaikki taas myynnissä",async()=>{OCFG={...OCFG,soldout:[]};await saveCfg("Kaikki tuotteet myynnissä")},"o"):null):null,list))}

function vCamp(m){const c=OCFG,inp=mk("input",{type:"number",min:"0",max:"50",value:c.firstPct??15});
  const mo=hToday().slice(0,7),L=live().filter(o=>hDate(o.created_at).slice(0,7)===mo),fst=L.filter(o=>o.discount>0&&!/^Kanta/.test(o.discount_note||"")),loy=L.filter(o=>/^Kanta/.test(o.discount_note||""));
  m.append(mk("section",{class:"card"},mk("h2",{text:"Uuden asiakkaan etu"}),mk("div",{class:"store"},mk("span",{class:"sav",style:"background:var(--y);color:#111;font:800 1rem Inter"},"−"+(c.firstPct||0)+"%"),mk("div",null,mk("b",null,"Ensimmäinen tilaus",mk("span",{class:"tag",text:(+c.firstPct>0)?"Käynnissä":"Pois"})),mk("small",{text:"Alennus koko tilauksesta, lasketaan automaattisesti kassalla"}))),
    mk("div",{class:"tiles",style:"margin:10px 0 16px"},mk("div",{class:"tile"},mk("small",{text:"Uusia asiakkaita (kk)"}),mk("b",{text:String(fst.length)})),mk("div",{class:"tile"},mk("small",{text:"Annetut alennukset (kk)"}),mk("b",{text:eur(fst.reduce((x,o)=>x+ +o.discount,0))})),mk("div",{class:"tile"},mk("small",{text:"Uusien myynti (kk)"}),mk("b",{text:eur(sumT(fst))})),mk("div",{class:"tile"},mk("small",{text:"Kaikki tilaukset (kk)"}),mk("b",{text:String(L.length)}))),
    lab("Alennus % (0 = pois päältä)",inp),act("Tallenna",async()=>{OCFG={...OCFG,firstPct:Math.max(0,Math.min(50,+inp.value||0))};await saveCfg("Kampanja tallennettu")},"y")),
    mk("section",{class:"card"},mk("h2",{text:"Bonuspisteet"}),mk("p",{class:"mut",text:"Leimakortti on korvattu bonusjärjestelmällä. Asiakas saa 1 pisteen jokaisesta maksetusta eurosta, kun tilaus on luovutettu. Pisteet näkyvät asiakkaan Oma tili -sivulla, ja ne käytetään tilaussivulla kirjautuneena."}),
      mk("div",{class:"store"},mk("div",null,mk("b",{text:"Palkinnot"}),mk("p",{class:"mut",text:"−2 € = 40 p · −5 € = 100 p · −10 € = 200 p. Tilauksen oltava vähintään 2× alennus. Perutusta tilauksesta pisteet palautuvat automaattisesti."})))),

    mk("section",{class:"card"},mk("h2",{text:"Markkinointimateriaalit"}),mk("p",{class:"mut",text:"Tulostettavat QR-tarrat ja flyerit ohjaavat suoraan tilaussivulle."}),
      mk("div",{class:"row"},mk("a",{class:"btn o",href:"media/Malakai-QR-tarra-tulostus.pdf",target:"_blank",rel:"noopener",text:"QR-tarra (PDF)"}),mk("a",{class:"btn o",href:"media/Malakai-QR-flyer-tulostus.pdf",target:"_blank",rel:"noopener",text:"A5-flyer (PDF)"}),mk("a",{class:"btn o",href:"tilaa.html",target:"_blank",rel:"noopener",text:"Tilaussivu"}))))}

async function cusLoad(){const [a,b]=await Promise.all([SB.from("customers").select("*").order("last_order",{ascending:false}),SB.rpc("owner_accounts")]);if(a.error)throw new Error(a.error.message);CUS=a.data||[];ACC=b.error?[]:(b.data||[])}
let ACC=null;
function vAcc(){const L=ACC||[],dt=d=>d?fd(String(d).slice(0,10)):"",now=Date.now(),w=L.filter(a=>now-new Date(a.created_at)<7*864e5).length;
  const aq=mk("input",{type:"search",placeholder:"Hae tilin luoneista…"}),box=mk("div",{class:"scroll"});
  const draw=()=>{const v=aq.value.trim().toLowerCase(),rows=L.filter(a=>!v||[a.name,a.phone,a.email].join(" ").toLowerCase().includes(v));box.textContent="";
    const tb=mk("table",{class:"list"},mk("tr",null,["Nimi","Sähköposti","Puhelin","Tili luotu","Vahvistettu","Viimeksi kirjautunut","Tilauksia","Pisteet"].map(h=>mk("th",{text:h}))));
    rows.forEach(a=>tb.append(mk("tr",null,mk("td",{text:a.name||"–"}),mk("td",null,mk("a",{href:"mailto:"+a.email,text:a.email})),mk("td",null,a.phone?mk("a",{href:"tel:"+a.phone,text:a.phone}):""),
      mk("td",{text:dt(a.created_at)}),mk("td",{text:a.confirmed_at?"Kyllä":"Ei vielä"}),mk("td",{text:dt(a.last_sign_in_at)}),mk("td",{text:a.orders}),mk("td",null,mk("b",{text:a.points+" p"})))));
    if(!rows.length)tb.append(mk("tr",null,mk("td",{colspan:"8",class:"mut",text:"Ei osumia."})));box.append(tb)};aq.oninput=draw;draw();
  return mk("section",{class:"card"},mk("h2",{text:"Tilin luoneet asiakkaat"}),
    mk("div",{class:"tiles",style:"margin-bottom:16px"},mk("div",{class:"tile"},mk("small",{text:"Tilejä yhteensä"}),mk("b",{text:String(L.length)})),mk("div",{class:"tile"},mk("small",{text:"Uusia 7 pv"}),mk("b",{text:String(w)})),mk("div",{class:"tile"},mk("small",{text:"Vahvistettu"}),mk("b",{text:String(L.filter(a=>a.confirmed_at).length)})),mk("div",{class:"tile"},mk("small",{text:"Tilanneet"}),mk("b",{text:String(L.filter(a=>a.orders>0).length)}))),
    L.length?[aq,mk("div",{style:"height:10px"}),box,mk("div",{class:"row",style:"margin-top:14px"},act("Lataa tilit (CSV)",async()=>dl("malakai-asiakastilit.csv",["nimi;sahkoposti;puhelin;tili_luotu;vahvistettu;viimeksi_kirjautunut;tilauksia;pisteet"].concat(L.map(a=>[q(a.name),q(a.email),q(a.phone),q(dt(a.created_at)),a.confirmed_at?"kylla":"ei",q(dt(a.last_sign_in_at)),a.orders,a.points].join(";"))).join("\n")),"o"))]
      :mk("p",{class:"mut",text:"Kukaan ei ole vielä luonut tiliä. Tilit näkyvät tässä heti, kun asiakas rekisteröityy Oma tili -sivulla."}))}
function vCust(m){if(CUS===null){m.append(mk("p",{class:"mut",text:"Ladataan…"}));cusLoad().then(render).catch(e=>{CUS=[];toast(e.message,true);render()});return}
  const cq=mk("input",{type:"search",placeholder:"Hae nimellä, puhelimella tai sähköpostilla…"}),box=mk("div",{class:"scroll"});
  const draw=()=>{const v=cq.value.trim().toLowerCase(),rows=CUS.filter(c=>!v||[c.name,c.phone,c.email].join(" ").toLowerCase().includes(v));box.textContent="";
    const tb=mk("table",{class:"list"},mk("tr",null,["Nimi","Puhelin","Sähköposti","Osoite","Tilauksia","Ostot","Pisteet","Viimeisin","Palautepyyntö"].map(h=>mk("th",{text:h}))));
    rows.forEach(c=>{const cb=mk("input",{type:"checkbox",style:"width:auto"});cb.checked=c.review_mail!==false;cb.onchange=async()=>{const {error}=await SB.from("customers").update({review_mail:cb.checked}).eq("id",c.id);if(error){toast(error.message,true);cb.checked=!cb.checked}else{c.review_mail=cb.checked;toast(cb.checked?"Palautepyynnöt päällä":"Palautepyynnöt pois tältä asiakkaalta")}};
      tb.append(mk("tr",null,mk("td",{text:c.name||""}),mk("td",null,c.phone?mk("a",{href:"tel:"+c.phone,text:c.phone}):""),mk("td",null,mk("a",{href:"mailto:"+c.email,text:c.email})),mk("td",{text:[c.address,c.zip,c.city].filter(Boolean).join(" ")}),mk("td",{text:c.orders}),mk("td",{text:eur(c.spent)}),mk("td",{text:(c.points||0)+" p"}),mk("td",{text:c.last_order?fd(c.last_order.slice(0,10)):""}),mk("td",null,cb)))});
    box.append(tb)};cq.oninput=draw;draw();
  const tot=CUS.reduce((x,c)=>x+ +c.spent,0),rep=CUS.filter(c=>c.orders>1).length;
  m.append(vAcc());
  m.append(mk("section",{class:"card"},mk("h2",{text:"Asiakasrekisteri (kaikki tilanneet)"}),
    mk("div",{class:"tiles",style:"margin-bottom:16px"},mk("div",{class:"tile"},mk("small",{text:"Asiakkaita"}),mk("b",{text:String(CUS.length)})),mk("div",{class:"tile"},mk("small",{text:"Palaavia"}),mk("b",{text:String(rep)})),mk("div",{class:"tile"},mk("small",{text:"Ostot yhteensä"}),mk("b",{text:eur(tot)})),mk("div",{class:"tile"},mk("small",{text:"Keskim. / asiakas"}),mk("b",{text:CUS.length?eur(tot/CUS.length):"–"}))),
    CUS.length?[cq,mk("div",{style:"height:10px"}),box,mk("div",{class:"row",style:"margin-top:14px"},act("Lataa asiakkaat (CSV)",async()=>dl("malakai-tilausasiakkaat.csv",["nimi;puhelin;sahkoposti;osoite;postinumero;paikkakunta;tilauksia;ostot_eur;ensimmainen;viimeisin"].concat(CUS.map(c=>[q(c.name),q(c.phone),q(c.email),q(c.address),q(c.zip),q(c.city),c.orders,fe2(c.spent),q(c.first_order?fd(c.first_order.slice(0,10)):""),q(c.last_order?fd(c.last_order.slice(0,10)):"")].join(";"))).join("\n")),"o"))]
      :mk("p",{class:"mut",text:"Asiakkaat tallentuvat tähän automaattisesti ensimmäisestä nettitilauksesta lähtien."}),
    mk("p",{class:"mut",style:"margin-top:12px",text:"Palautepyyntö lähtee sähköpostilla 30 min luovutuksen jälkeen. Poista rasti, jos asiakas ei halua niitä."})))}

function vYri(m){const c=OCFG,kv=(k,v)=>mk("div",{class:"kv"},mk("span",{text:k}),mk("b",null,v));
  m.append(mk("section",{class:"card"},mk("div",{class:"store",style:"padding-top:0"},mk("span",{class:"sav"},mk("img",{src:"media/logo-malakai.svg",alt:""})),mk("div",null,mk("b",{text:"Malakai Ravintola"}),mk("small",{text:"Pizza · kebab · buffet · Sääksjärvi"}))),
    kv("Osoite","Tampereentie 414, 33880 Lempäälä"),kv("Puhelin",mk("a",{href:"tel:+358453537000",text:"045 353 7000"})),kv("Verkkosivu",mk("a",{href:"index.html",target:"_blank",rel:"noopener",text:"malakairavintola.fi"})),kv("Tilaussivu",mk("a",{href:"tilaa.html",target:"_blank",rel:"noopener",text:"malakairavintola.fi/tilaa.html"})),kv("Wolt",mk("a",{href:"https://order.site/malakai-ravintola",target:"_blank",rel:"noopener",text:"order.site/malakai-ravintola"})),kv("Kirjautunut",OWNER)));
  const H=SITE.hours||{};m.append(mk("section",{class:"card"},mk("h2",{text:"Aukioloajat"}),Object.keys(WDL).map(k=>kv(WDL[k],H[k]&&H[k][0]?H[k][0].replace(":",".")+"–"+H[k][1].replace(":","."):"Suljettu")),mk("p",{class:"mut",style:"margin-top:10px",text:"Aukioloajat muutetaan sivuston ylläpidossa, ja ne ohjaavat myös nettitilausta."})));
  const f=(k,l,a={})=>{const e=mk("input",{value:c[k]??"",...a});e.onchange=()=>{OCFG={...OCFG,[k]:a.type==="number"?+String(e.value).replace(",","."):e.value}};return lab(l,e)};
  m.append(mk("section",{class:"card"},mk("h2",{text:"Tilausasetukset"}),
    mk("div",{class:"g3"},f("fee","Kuljetusmaksu €",{type:"number",step:"0.1",min:"0"}),f("min","Kuljetuksen vähimmäistilaus €",{type:"number",step:"1",min:"0"}),f("prep","Noudon valmistusaika (min)",{type:"number",min:"5"})),
    mk("div",{class:"g3"},f("dtime","Kuljetuksen toimitusaika (min)",{type:"number",min:"10"}),f("area","Toimitusalue (näkyy asiakkaalle)"),f("note","Ilmoitus tilaussivulle")),
    mk("div",{class:"g3"},f("preDays","Ennakkotilaus päiviä eteenpäin (0 = pois)",{type:"number",min:"0",max:"7"})),
    act("Tallenna asetukset",async()=>saveCfg("Asetukset tallennettu"),"y")),
    mk("section",{class:"card"},mk("h2",{text:"Tili"}),mk("p",{class:"mut",text:"Kauppiasportaaliin ja ylläpitoon pääsee vain omistajan sähköpostilla ja salasanalla. Kirjaudu ulos, jos käytät yhteistä laitetta."}),act("Kirjaudu ulos",async()=>SB.auth.signOut({scope:"local"}),"r")))}
})();
