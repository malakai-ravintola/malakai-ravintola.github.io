(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const C=window.MALAKAI||{},API=C.url?C.url+"/functions/v1/public":"";
const PH="358456057475",PHP="+358456057475",MAIL="malakairavintola@gmail.com";
const f=n=>n.toFixed(2).replace(".",",")+" €";
const fi=()=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Helsinki",year:"numeric",month:"2-digit",day:"2-digit",weekday:"short",hour:"numeric",minute:"numeric",hour12:false}).formatToParts(new Date()),g=t=>p.find(x=>x.type===t).value;
  return{date:`${g("year")}-${g("month")}-${g("day")}`,dow:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(g("weekday")),t:(+g("hour")%24)+(+g("minute"))/60}};
const H={0:[12,20],1:[10.5,20],2:[10.5,20],3:[10.5,20],4:[10.5,20],5:[10.5,21],6:[11,21]};
const now=fi();
let EN=false;

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
(function(){const d=$("#dot");if(!d)return;const on=now.t>=H[now.dow][0]&&now.t<H[now.dow][1];d.classList.toggle("on",on);
  $("#open").textContent=on?"Avoinna nyt":"Suljettu juuri nyt"})();

// --- Isänpäivä (voimassa 8.11.2026 asti)
const live=now.date<="2026-11-08";
const ann=$("#ann");if(ann&&!live)ann.hidden=true;
$$(".isa").forEach(e=>{if(!live)e.hidden=true});
const pop=$("#pop");
if(pop&&live){const close=()=>{pop.hidden=true;document.body.style.overflow=""};
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
const D=[["su","Sunnuntai","Opera Special"],["ma","Maanantai","Tropicana"],["ti","Tiistai","Kebab Pizza"],["ke","Keskiviikko","Mexicana"],["to","Torstai","Americano"],["pe","Perjantai","Mamma Mia"],["la","Lauantai","Julia"]];
const wk=$("#week");
if(wk){[1,2,3,4,5,6,0].forEach(i=>{const d=D[i],a=document.createElement("div");a.className="day"+(i===now.dow?" now":"");
    a.innerHTML='<img alt="" width="78" height="78" loading="lazy"><small></small><b></b>';a.querySelector("img").src="media/pizza-"+d[0]+".png";a.querySelector("small").textContent=d[1];a.querySelector("b").textContent=d[2];wk.appendChild(a)});
  const t=D[now.dow],x=M.Pizza.items.find(i=>i[0].toLowerCase()===t[2].toLowerCase());
  $("#tdName").textContent=t[2];$("#tdDesc").textContent=x?x[1]:"";$("#tdImg").src="media/pizza-"+t[0]+".png";$("#tdImg").alt=t[2]+"-pizza";$("#tdLbl").textContent="Tänään · "+t[1]}

// --- Galleria
const gl=$("#gal");if(gl)gl.addEventListener("click",e=>{if(e.target.tagName!=="IMG")return;const l=document.createElement("div");l.className="lb";l.innerHTML="<img>";l.firstChild.src=e.target.src;l.firstChild.alt=e.target.alt;l.onclick=()=>l.remove();document.body.appendChild(l)});
addEventListener("keydown",e=>{if(e.key==="Escape")$$(".lb").forEach(l=>l.remove())});

// --- Varaus
const sms=(n,t)=>"sms:"+n+"?&body="+encodeURIComponent(t),wa=t=>"https://wa.me/"+PH+"?text="+encodeURIComponent(t);
const rf=$("#resForm");
if(rf){const g=rf.g;for(let i=1;i<=8;i++)g.add(new Option(i+(i==1?" vieras":" vierasta"),i));g.value=2;
  rf.d.min=now.date;
  const slots=()=>{const t=rf.t;t.textContent="";t.add(new Option("Valitse aika",""));if(!rf.d.value)return;
    const dow=new Date(rf.d.value+"T12:00:00").getDay(),[a,b]=H[dow];for(let x=a;x<=b-1;x+=.5){const h=Math.floor(x),m=x%1?"30":"00";t.add(new Option(`${String(h).padStart(2,"0")}:${m}`,`${String(h).padStart(2,"0")}:${m}`))}};
  rf.d.onchange=slots;slots();
  const manual=(v)=>{const dd=v.d.value.split("-").reverse().join("."),
    t=`Pöytävaraus: ${v.n.value}, ${v.g.value} hlö, ${dd} klo ${v.t.value}. Puh: ${v.p.value}. Sähköposti: ${v.e.value}.`+(v.m.value?` Toive: ${v.m.value}`:"");
    $("#resTxt").textContent=t;$("#resSms").href=sms(PHP,t);$("#resWa").href=wa(t);$("#resMail").href="mailto:"+MAIL+"?subject="+encodeURIComponent("Pöytävaraus")+"&body="+encodeURIComponent(t);
    $("#resDone").hidden=false;$("#resDone").scrollIntoView({block:"center"})};
  rf.onsubmit=async e=>{e.preventDefault();const v=e.target;
    if(API){try{const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json",apikey:C.anon,Authorization:"Bearer "+C.anon},body:JSON.stringify({action:"reserve",n:v.n.value,e:v.e.value,p:v.p.value,g:v.g.value,d:v.d.value,t:v.t.value,m:v.m.value,news:v.news.checked,website:v.website.value})});
        if(!r.ok)throw 0;rf.hidden=true;const d=$("#resDone");d.textContent="Kiitos! Varauspyyntösi on lähetetty. Vahvistamme sen sähköpostilla tai tekstiviestillä.";d.hidden=false;return}catch(x){}}
    manual(v)}}

// --- Uutiskirje
const nf=$("#nlForm");
if(nf)nf.onsubmit=async e=>{e.preventDefault();const v=e.target,t=`Tilaan uutiskirjeen: ${v.e.value}`+(v.n.value?` (${v.n.value})`:"");
  if(API){try{const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json",apikey:C.anon,Authorization:"Bearer "+C.anon},body:JSON.stringify({action:"subscribe",e:v.e.value,n:v.n.value,website:v.website.value})});
      if(!r.ok)throw 0;nf.hidden=true;const d=$("#nlDone");d.textContent="Kiitos! Tilaus on vastaanotettu, vahvistus tulee sähköpostiisi.";d.hidden=false;return}catch(x){}}
  $("#nlSms").href=sms(PHP,t);$("#nlWa").href=wa(t);$("#nlMail").href="mailto:"+MAIL+"?subject="+encodeURIComponent("Uutiskirjeen tilaus")+"&body="+encodeURIComponent(t);$("#nlDone").hidden=false};

// --- Videot
if(matchMedia("(prefers-reduced-motion: reduce)").matches)$$("video").forEach(v=>{v.removeAttribute("autoplay");v.pause()});
})();
