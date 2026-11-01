(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const C=window.MALAKAI||{},API=C.url?C.url+"/functions/v1/public":"";
const f=n=>n.toFixed(2).replace(".",",")+" €";
const fi=()=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Helsinki",year:"numeric",month:"2-digit",day:"2-digit",weekday:"short",hour:"numeric",minute:"numeric",hour12:false}).formatToParts(new Date()),g=t=>p.find(x=>x.type===t).value;
  return{date:`${g("year")}-${g("month")}-${g("day")}`,dow:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(g("weekday")),t:(+g("hour")%24)+(+g("minute"))/60}};
const S=window.SITE||{},DK=["su","ma","ti","ke","to","pe","la"],DN={ma:"Maanantai",ti:"Tiistai",ke:"Keskiviikko",to:"Torstai",pe:"Perjantai",la:"Lauantai",su:"Sunnuntai"},
  DS={ma:"Ma",ti:"Ti",ke:"Ke",to:"To",pe:"Pe",la:"La",su:"Su"};
const hn=s=>{if(!s)return null;const[a,b]=s.split(":");return +a+(+b||0)/60};
const H={};DK.forEach((k,i)=>{const h=(S.hours||{})[k];H[i]=h&&h[0]&&h[1]?[hn(h[0]),hn(h[1])]:null});
const now=fi();
let EN=false;
const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
const until=o=>o&&o.on&&(!o.until||now.date<=o.until);

// --- Sisältö data.js:stä (muokataan admin.html:ssä)
if(S.hours){const order=["ma","ti","ke","to","pe","la","su"],g=[];
  order.forEach(k=>{const v=(S.hours[k]||[]).join("–"),l=g[g.length-1];if(l&&l.v===v)l.e=k;else g.push({s:k,e:k,v,h:S.hours[k]})});
  const tm=t=>t.replace(":","."),sh=t=>t.replace(":00","").replace(":",".");
  const lab=(x,m)=>x.s===x.e?m[x.s]:m[x.s]+"–"+m[x.e],val=(x,f)=>x.h&&x.h[0]?f(x.h[0])+"–"+f(x.h[1]):"Suljettu";
  $$("table.hrs").forEach(t=>{t.innerHTML=g.map(x=>`<tr><td>${lab(x,DN)}</td><td>${val(x,tm)}</td></tr>`).join("")});
  $$(".hline").forEach(e=>e.textContent=g.map(x=>lab(x,DS)+" "+val(x,sh)).join(", ")+".");
  const L=$('script[type="application/ld+json"]'),EK={ma:"Mo",ti:"Tu",ke:"We",to:"Th",pe:"Fr",la:"Sa",su:"Su"};
  if(L)try{const o=JSON.parse(L.textContent);o.openingHours=g.filter(x=>x.h&&x.h[0]).map(x=>(x.s===x.e?EK[x.s]:EK[x.s]+"-"+EK[x.e])+" "+x.h[0]+"-"+x.h[1]);L.textContent=JSON.stringify(o)}catch(x){}}
const B=S.buffet;
if(B){const en=a=>a.replace(/\./g,":");
  $$("table.pt").forEach(t=>{t.innerHTML=`<tr class="h"><td colspan="2" data-en="Weekdays ${esc(en(B.arki.aika))}">Arkisin klo ${esc(B.arki.aika)}</td></tr><tr><td>Pizzabuffet</td><td>${f(B.arki.pizza)}</td></tr><tr><td>Salaattibuffet</td><td>${f(B.arki.salaatti)}</td></tr>`+
    `<tr class="h"><td colspan="2" data-en="Weekends ${esc(en(B.vkl.aika))}">Viikonloppuna klo ${esc(B.vkl.aika)}</td></tr><tr><td>Pizzabuffet</td><td>${f(B.vkl.pizza)}</td></tr><tr><td>Salaattibuffet</td><td>${f(B.vkl.salaatti)}</td></tr>`+
    (B.lapset&&B.lapset.length?`<tr class="h"><td colspan="2" data-en="Children">Lapset</td></tr>`+B.lapset.map(l=>`<tr><td>${esc(l[0])}</td><td>${f(l[1])}</td></tr>`).join(""):"")});
  $$('[data-k="arki"]').forEach(e=>e.textContent=f(B.arki.pizza));$$('[data-k="vkl"]').forEach(e=>e.textContent=f(B.vkl.pizza));
  const bn=$("#bufNote");if(bn){bn.textContent=B.huom||"";bn.hidden=!B.huom}}
if(S.dailyPrice)$$(".dp").forEach(e=>e.textContent=f(S.dailyPrice));
{const a=$("#ann");if(a&&S.ann){if(until(S.ann)){a.textContent=S.ann.text;a.href=S.ann.link||"#";a.dataset.en=esc(S.ann.text_en||S.ann.text)}else a.hidden=true}}
{const ev=$("#isanpaiva");if(ev&&S.event){if(until(S.event)){$("#evT").textContent=S.event.title;$("#evX").textContent=S.event.text}else ev.hidden=true}}
{const pi=$("#popImg");if(pi&&S.popup){pi.src=S.popup.image;pi.alt=S.popup.alt||""}}

// --- Yläpalkki, valikko
const tb=$("#topbar");if(tb){const sc=()=>tb.classList.toggle("solid",scrollY>40||document.body.dataset.solid);addEventListener("scroll",sc,{passive:true});sc()}
const bg=$("#burger"),nav=$("#nav");if(bg){bg.onclick=()=>{const o=nav.classList.toggle("open");bg.setAttribute("aria-expanded",o)};nav.addEventListener("click",e=>{if(e.target.tagName==="A")nav.classList.remove("open")})}

// --- Kielenvaihto FI/EN
function setLang(en){EN=en;document.documentElement.lang=en?"en":"fi";
  $$("[data-en]").forEach(e=>{if(!e.dataset.fi)e.dataset.fi=e.innerHTML;e.innerHTML=en?e.dataset.en:e.dataset.fi});
  $$(".lang button").forEach(b=>b.classList.toggle("on",(b.dataset.l==="en")===en));
  try{localStorage.setItem("lang",en?"en":"fi")}catch(x){}}
$$(".lang button").forEach(b=>b.onclick=()=>setLang(b.dataset.l==="en"));
try{if(localStorage.getItem("lang")==="en")setLang(true)}catch(x){}

// --- Aukiolo
(function(){const d=$("#dot");if(!d)return;const h=H[now.dow],on=!!h&&now.t>=h[0]&&now.t<h[1];d.classList.toggle("on",on);
  $("#open").textContent=on?"Avoinna nyt":"Suljettu juuri nyt"})();

// --- Ponnahdusikkuna (asetukset data.js:ssä)
const pop=$("#pop");
if(pop&&until(S.popup)){const close=()=>{pop.hidden=true;document.body.style.overflow=""};
  setTimeout(()=>{pop.hidden=false;document.body.style.overflow="hidden";$("#popX").focus()},80);
  $("#popX").onclick=close;$("#popB").onclick=close;pop.addEventListener("click",e=>{if(e.target===pop)close()});
  addEventListener("keydown",e=>{if(e.key==="Escape"&&!pop.hidden)close()})}

// --- Ruokalista
const M=window.MENU,SL={"Pizza":"pizza","Kebab":"kebab","Kana":"kana","Sticky Fingers":"sticky-fingers","Wings":"wings","Burgerit":"burgerit","Lisukkeet":"lisukkeet","Dipit ja juomat":"dipit-juomat"};
const price=i=>i[4]||f(i[2])+(i[3]?" / "+f(i[3]):"");
function rows(k,el){const s=M[k];el.textContent="";
  s.items.forEach(i=>{const r=document.createElement("div");r.className="row";r.innerHTML="<div><strong></strong>"+(i[1]?"<span></span>":"")+"</div><em></em>";
    r.querySelector("strong").textContent=i[0];if(i[1])r.querySelector("span").textContent=i[1];r.querySelector("em").textContent=price(i);el.appendChild(r)});
  return s.note}
const mAll=$("#menuAll");
if(mAll){const keys=(mAll.dataset.keys||Object.keys(M).join(",")).split(",");
  keys.forEach(k=>{const sec=document.createElement("section");sec.className="msec";sec.id=SL[k];sec.innerHTML='<h2></h2><p class="lead"></p><div class="lst"></div><div class="note" hidden></div>';
    sec.querySelector("h2").textContent=k==="Wings"?"Hot Wings":k;const n=rows(k,sec.querySelector(".lst"));
    const nt=sec.querySelector(".note");if(n){nt.hidden=false;nt.textContent=n}sec.querySelector(".lead").remove();mAll.appendChild(sec)});
  const q=$("#q");if(q)q.oninput=()=>{const v=q.value.trim().toLowerCase();$$("#menuAll .row").forEach(r=>r.hidden=v&&!r.textContent.toLowerCase().includes(v));
    $$("#menuAll .msec").forEach(s=>s.hidden=v&&![...s.querySelectorAll(".row")].some(r=>!r.hidden))}}

// --- Päivän pizza
const D=DK.map(k=>{const x=(S.daily||{})[k]||{};return[k,DN[k],x.name||"",x.img||"media/pizza-"+k+".png"]});
const wk=$("#week");
if(wk){[1,2,3,4,5,6,0].forEach(i=>{const d=D[i],a=document.createElement("div");a.className="day"+(i===now.dow?" now":"");
    a.innerHTML='<img alt="" width="78" height="78" loading="lazy"><small></small><b></b>';a.querySelector("img").src=d[3];a.querySelector("small").textContent=d[1];a.querySelector("b").textContent=d[2];wk.appendChild(a)});
  const t=D[now.dow],x=M.Pizza.items.find(i=>i[0].toLowerCase()===t[2].toLowerCase());
  $("#tdName").textContent=t[2];$("#tdDesc").textContent=x?x[1]:"";$("#tdImg").src=t[3];$("#tdImg").alt=t[2]+"-pizza";$("#tdLbl").textContent="Tänään · "+t[1]}

// --- Galleria
const gl=$("#gal");if(gl)gl.addEventListener("click",e=>{if(e.target.tagName!=="IMG")return;const l=document.createElement("div");l.className="lb";l.innerHTML="<img>";l.firstChild.src=e.target.src;l.firstChild.alt=e.target.alt;l.onclick=()=>l.remove();document.body.appendChild(l)});
addEventListener("keydown",e=>{if(e.key==="Escape")$$(".lb").forEach(l=>l.remove())});

// --- Varaus
let FN=null;
const post=async body=>{if(!API)throw new Error("Ei yhteyttä");let r,last;
  for(const n of FN?[FN]:["public","Public"]){try{r=await fetch(C.url+"/functions/v1/"+n,{method:"POST",headers:{"Content-Type":"application/json",apikey:C.anon,Authorization:"Bearer "+C.anon},body:JSON.stringify(body)})}catch(x){last=x;r=null;continue}
    if(r.status!==404){FN=n;break}}
  if(!r)throw last||new Error("Failed to fetch");
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error((j.error||j.message||j.msg||"Virhe")+" · koodi "+r.status);return j};
const busy=(f,on,txt)=>{const b=f.querySelector("button[type=submit]");if(!b.dataset.t)b.dataset.t=b.innerHTML;b.disabled=on;b.innerHTML=on?txt:b.dataset.t};
const rf=$("#resForm");
if(rf){const g=rf.g;for(let i=1;i<=8;i++)g.add(new Option(i+(i==1?" vieras":" vierasta"),i));g.value=2;
  rf.d.min=now.date;
  const slots=()=>{const t=rf.t;t.textContent="";t.add(new Option("Valitse aika",""));if(!rf.d.value)return;
    const dow=new Date(rf.d.value+"T12:00:00").getDay();if(!H[dow]){t.options[0].text="Suljettu tänä päivänä";return}const[a,b]=H[dow],min=rf.d.value===now.date?now.t+.5:0;
    for(let x=a;x<=b-1;x+=.5){if(x<min)continue;const h=Math.floor(x),m=x%1?"30":"00",v=`${String(h).padStart(2,"0")}:${m}`;t.add(new Option(v,v))}
    if(t.options.length===1)t.options[0].text="Ei vapaita aikoja tänään"};
  rf.d.onchange=slots;slots();
  const err=$("#resErr");
  rf.onsubmit=async e=>{e.preventDefault();const v=e.target;err.hidden=true;busy(rf,true,"Lähetetään…");
    try{await post({action:"reserve",n:v.n.value,e:v.e.value,p:v.p.value,g:v.g.value,d:v.d.value,t:v.t.value,m:v.m.value,news:v.news.checked,website:v.website.value});
      const dd=v.d.value.split("-").reverse().join("."),d=$("#resDone");
      $("#resTxt").textContent=`Kiitos ${v.n.value.split(" ")[0]}! Varauspyyntösi ${dd} klo ${v.t.value} (${v.g.value} hlö) on vastaanotettu. Saat vahvistuksen sähköpostiisi ${v.e.value}, kun olemme käsitelleet varauksen.`;
      rf.hidden=true;d.hidden=false;d.scrollIntoView({block:"center",behavior:"smooth"})}
    catch(x){err.textContent="Varauksen lähetys ei onnistunut. Yritä uudelleen tai soita 045 353 7000. ("+(x.message==="Failed to fetch"||x.message==="Load failed"?"ei yhteyttä palvelimeen":x.message)+")";err.hidden=false}
    finally{busy(rf,false)}}}

// --- Uutiskirje
const nf=$("#nlForm");
if(nf)nf.onsubmit=async e=>{e.preventDefault();const v=e.target,d=$("#nlDone");busy(nf,true,"Lähetetään…");
  try{await post({action:"subscribe",e:v.e.value,n:v.n.value,website:v.website.value});nf.hidden=true;d.textContent="Kiitos! Olet nyt uutiskirjeen tilaaja.";d.hidden=false}
  catch(x){d.textContent="Tilaus ei onnistunut. Yritä hetken päästä uudelleen.";d.hidden=false}finally{busy(nf,false)}};

// --- Videot
if(matchMedia("(prefers-reduced-motion: reduce)").matches)$$("video").forEach(v=>{v.removeAttribute("autoplay");v.pause()});
})();
