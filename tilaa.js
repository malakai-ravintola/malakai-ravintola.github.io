// Malakai nettitilaus: ostoskori, valinnat ja tilauksen lähetys. Hinnat tarkistetaan vielä palvelimella.
(function(){
const $=s=>document.querySelector(s);
const S=window.SITE||{},M=S.menu||{},C=window.MALAKAI||{};
const OMA={n:[11.5,12.5,13.5,13.9],p:[22,24,24,24]},MEAL=4.9;
const eur=n=>(Math.round(n*100)/100).toFixed(2).replace(".",",")+" €";
const esc=t=>String(t??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
const slug=t=>t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const ls={get:k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const clock=m=>String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
const DK=["su","ma","ti","ke","to","pe","la"];
const helDay=()=>{const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Helsinki",weekday:"short"}).format(new Date()).toLowerCase();return DK[["sun","mon","tue","wed","thu","fri","sat"].indexOf(p)]};
const toppings=(String((M.Pizza||{}).note||"").split("Täytteet:")[1]||"").split(",").map(t=>t.trim().replace(/\.$/,"")).filter(Boolean);
const sauce=(cat,it)=>/Med tai Hot/i.test((cat.note||"")+" "+(it[1]||""));

let CFG=null,cart=ls.get("mk_cart")||[],cur=null;
const save=()=>ls.set("mk_cart",cart);

// ---------- Hinta (sama sääntö kuin palvelimella)
function price(x){
  if(x.c==="Päivän pizza")return +S.dailyPrice;
  const cat=M[x.c],it=cat&&cat.items.find(i=>i[0]===x.n);if(!it)return 0;
  let u;if(x.c==="Pizza"&&x.n==="Oma valinta")u=(OMA[x.s]||OMA.n)[(x.t||[]).length-1]||0;
  else u=+it[3]>0&&x.s==="p"?+it[3]:+it[2];
  if(x.c==="Burgerit"&&x.meal)u+=MEAL;return Math.round(u*100)/100}
function optTxt(x){const o=[];if(x.c==="Päivän pizza")return"Päivän pizza";
  const cat=M[x.c],it=cat&&cat.items.find(i=>i[0]===x.n);if(!it)return"";
  if(x.n==="Oma valinta")o.push(x.s==="p"?"Perhe":"Normaali",(x.t||[]).join(", "));else if(+it[3]>0)o.push(x.s==="p"?"Perhe":"Normaali");
  if(x.o)o.push(x.n==="Dippi"?x.o:"Kastike "+x.o);if(x.meal)o.push("Ateria");return o.join(" · ")}
const orderable=(c,it)=>+it[2]>0||(c==="Pizza"&&it[0]==="Oma valinta");

// ---------- Ruokalista
const day=helDay(),dp=(S.daily||{})[day];
function menu(){const m=$("#odMenu"),cats=$("#odCats");let h="",ch="";
  if(dp&&dp.name&&S.dailyPrice){h+=`<div class="od-day" id="paivan-pizza"><img src="${esc(dp.img)}" alt=""><div><small>PÄIVÄN PIZZA</small><b>${esc(dp.name)}</b><em>${eur(+S.dailyPrice)}</em></div><button class="od-plus" data-c="Päivän pizza" data-n="${esc(dp.name)}" aria-label="Lisää ${esc(dp.name)}">+</button></div>`}
  Object.entries(M).forEach(([c,cat])=>{const items=cat.items.filter(it=>orderable(c,it));if(!items.length)return;const id=slug(c);ch+=`<a href="#${id}">${esc(c)}</a>`;
    h+=`<section class="od-sec" id="${id}"><h2>${esc(c)}</h2>${cat.note&&c!=="Pizza"?`<p>${esc(cat.note)}</p>`:""}`;
    items.forEach(it=>{const pr=it[0]==="Oma valinta"?"alk. "+eur(OMA.n[0]):(+it[3]>0?eur(+it[2])+" / "+eur(+it[3]):eur(+it[2]));
      const ds=it[0]==="Oma valinta"?"Valitse 1–4 täytettä":(it[0]==="Dippi"?"Valitse maku":it[1]);
      h+=`<div class="od-it"><div><b>${esc(it[0])}</b>${ds?`<span>${esc(ds)}</span>`:""}</div><div class="od-add"><em>${pr}</em><button class="od-plus" data-c="${esc(c)}" data-n="${esc(it[0])}" aria-label="Lisää ${esc(it[0])}">+</button></div></div>`});
    h+="</section>"});
  m.innerHTML=h;cats.innerHTML=(dp?'<a href="#paivan-pizza">Päivän pizza</a>':"")+ch;
  m.addEventListener("click",e=>{const b=e.target.closest(".od-plus");if(b)open(b.dataset.c,b.dataset.n)})}

// ---------- Valintaikkuna
function chips(name,list,type,sel){return`<div class="od-chips">${list.map(v=>`<label><input type="${type}" name="${name}" value="${esc(v[0])}"${sel(v[0])?" checked":""}><span>${esc(v[1])}</span></label>`).join("")}</div>`}
function open(c,n){
  if(c==="Päivän pizza"){add({c,n,q:1});return}
  const cat=M[c],it=cat.items.find(i=>i[0]===n),x={c,n,q:1,s:"n"};let o="";
  if(n==="Oma valinta"){x.t=[];o+=`<div class="od-opt"><b>Koko</b>${chips("s",[["n","Normaali"],["p","Perhe"]],"radio",v=>v==="n")}</div><div class="od-opt"><b>Täytteet (1–4)</b>${chips("t",toppings.map(t=>[t,t]),"checkbox",()=>false)}</div>`}
  else if(+it[3]>0)o+=`<div class="od-opt"><b>Koko</b>${chips("s",[["n","Normaali "+eur(+it[2])],["p","Perhe "+eur(+it[3])]],"radio",v=>v==="n")}</div>`;
  if(n==="Dippi")o+=`<div class="od-opt"><b>Maku</b>${chips("o",String(it[1]).split(",").map(v=>[v.trim(),v.trim()]),"radio",()=>false)}</div>`;
  else if(sauce(cat,it))o+=`<div class="od-opt"><b>Kastike</b>${chips("o",[["Med","Med"],["Hot","Hot"]],"radio",()=>false)}</div>`;
  if(c==="Burgerit")o+=`<div class="od-opt">${chips("meal",[["1","Ateriana: ranskalaiset + 0,33 l juoma (+"+eur(MEAL)+")"]],"checkbox",()=>false)}</div>`;
  if(!o&&!/juoma/i.test(n)){add(x);return}
  if(/juoma/i.test(n))o+=`<p class="od-small">Kirjoita lisätoiveeseen, minkä juoman haluat. Muuten valitsemme puolestasi.</p>`;
  cur=x;$("#odMT").textContent=n;$("#odMD").textContent=n==="Oma valinta"?"Valitse koko ja 1–4 täytettä":(n==="Dippi"?"":it[1]||"");$("#odMO").innerHTML=o;$("#odMN").value="";$("#odMq").textContent="1";
  $("#odModal").hidden=false;upd();setTimeout(()=>$("#odMX").focus(),30)}
function read(){const f=$("#odMO"),x=cur;const s=f.querySelector('input[name="s"]:checked');x.s=s?s.value:"n";
  const o=f.querySelector('input[name="o"]:checked');x.o=o?o.value:"";x.t=[...f.querySelectorAll('input[name="t"]:checked')].map(i=>i.value);
  x.meal=!!f.querySelector('input[name="meal"]:checked');x.m=$("#odMN").value.trim();x.q=+$("#odMq").textContent;return x}
function valid(x){const cat=M[x.c],it=cat.items.find(i=>i[0]===x.n);
  if(x.n==="Oma valinta"&&(x.t.length<1||x.t.length>4))return"Valitse 1–4 täytettä";
  if((x.n==="Dippi"||sauce(cat,it))&&!x.o)return x.n==="Dippi"?"Valitse maku":"Valitse kastike";return""}
function upd(){const x=read(),btn=$("#odMA"),v=valid(x);btn.textContent=v||"Lisää · "+eur(price(x)*x.q);btn.disabled=!!v;
  $$('#odMO input[name="t"]').forEach(i=>{i.disabled=!i.checked&&x.t.length>=4})}
const $$=s=>[...document.querySelectorAll(s)];
$("#odMO").addEventListener("change",upd);
$("#odMm").onclick=()=>{const q=$("#odMq");q.textContent=Math.max(1,+q.textContent-1);upd()};
$("#odMp").onclick=()=>{const q=$("#odMq");q.textContent=Math.min(20,+q.textContent+1);upd()};
$("#odMA").onclick=()=>{const x=read();if(valid(x))return;add({...x});close()};
const close=()=>{$("#odModal").hidden=true;cur=null};
$("#odMX").onclick=close;$("#odModal").addEventListener("click",e=>{if(e.target.id==="odModal")close()});
addEventListener("keydown",e=>{if(e.key==="Escape"){close();$("#odCart").classList.remove("open")}});

// ---------- Ostoskori
const key=x=>JSON.stringify([x.c,x.n,x.s||"",x.o||"",(x.t||[]).slice().sort(),!!x.meal,x.m||""]);
function add(x){const k=key(x),e=cart.find(i=>key(i)===k);if(e)e.q=Math.min(20,e.q+x.q);else cart.push(x);save();draw();
  const b=$("#odBar");b.animate&&b.animate([{transform:"scale(1)"},{transform:"scale(1.05)"},{transform:"scale(1)"}],{duration:300})}
const sub=()=>cart.reduce((a,x)=>a+price(x)*x.q,0);
const kind=()=>($('input[name="kind"]:checked')||{}).value||"nouto";
function totals(){const s=sub(),fee=kind()==="kuljetus"&&CFG?CFG.fee:0;return{s,fee,t:Math.round((s+fee)*100)/100}}
function draw(){
  cart=cart.filter(x=>price(x)>0&&(x.c!=="Päivän pizza"||(dp&&x.n===dp.name)));save();
  const L=$("#odLines");
  L.innerHTML=cart.length?cart.map((x,i)=>`<div class="od-line"><b>${esc(x.n)}</b><em>${eur(price(x)*x.q)}</em>${optTxt(x)?`<small>${esc(optTxt(x))}</small>`:""}${x.m?`<small>Toive: ${esc(x.m)}</small>`:""}<div class="od-q"><button type="button" data-i="${i}" data-d="-1" aria-label="Vähemmän">−</button><b>${x.q}</b><button type="button" data-i="${i}" data-d="1" aria-label="Enemmän">+</button></div></div>`).join(""):'<p class="od-empty">Ostoskori on tyhjä. Lisää tuotteita listalta.</p>';
  const T=totals(),n=cart.reduce((a,x)=>a+x.q,0);
  $("#odSum").innerHTML=`<div><span>Tuotteet</span><span>${eur(T.s)}</span></div>`+(kind()==="kuljetus"?`<div><span>Kuljetus</span><span>${eur(T.fee)}</span></div>`:"")+`<div class="tot"><span>Yhteensä</span><span>${eur(T.t)}</span></div>`;
  $("#odBarN").textContent=n;$("#odBarT").textContent=eur(T.t);$("#odBar").hidden=!n;
  const send=$("#odSend"),why=!CFG?"Ladataan…":!CFG.on?"Nettitilaus ei ole käytössä":!CFG.isOpen?"Olemme kiinni":!n?"Ostoskori on tyhjä":(kind()==="kuljetus"&&T.s<CFG.min?"Vähimmäistilaus kuljetukseen "+eur(CFG.min):"");
  send.disabled=!!why;send.textContent=why||"Lähetä tilaus · "+eur(T.t)}
$("#odLines").addEventListener("click",e=>{const b=e.target.closest("button[data-i]");if(!b)return;const x=cart[+b.dataset.i];x.q+=+b.dataset.d;if(x.q<1)cart.splice(+b.dataset.i,1);save();draw()});
$("#odBar").onclick=()=>{$("#odCart").classList.add("open");setTimeout(()=>$("#odClose").focus(),30)};
$("#odClose").onclick=()=>$("#odCart").classList.remove("open");
$("#odCart").addEventListener("click",e=>{if(e.target.id==="odCart")$("#odCart").classList.remove("open")});

// ---------- Toimitustapa ja aika
function when(){const sel=$("#odWhen"),k=kind(),c=CFG;if(!c||c.open==null){sel.innerHTML='<option value="heti">Mahdollisimman pian</option>';return}
  const lead=k==="kuljetus"?c.dtime:c.prep,first=Math.ceil((c.now+lead+5)/15)*15,cur=sel.value;let h=`<option value="heti">Mahdollisimman pian (noin ${lead} min)</option>`;
  for(let m=Math.max(first,c.open+lead);m<=c.close;m+=15)h+=`<option value="${clock(m)}">Tänään klo ${clock(m).replace(":",".")}</option>`;
  sel.innerHTML=h;if([...sel.options].some(o=>o.value===cur))sel.value=cur}
function kindUi(){const k=kind();$("#odAddr").hidden=k!=="kuljetus";$$("#odAddr input").forEach(i=>i.required=k==="kuljetus");
  $("#odKindInfo").textContent=!CFG?"":k==="kuljetus"?`Kuljetus ${eur(CFG.fee)} · vähimmäistilaus ${eur(CFG.min)}${CFG.area?" · Toimitusalue: "+CFG.area:""} · Maksu toimitettaessa.`:"Nouto: Tampereentie 414, Lempäälä. Maksu noudettaessa.";
  when();draw()}
$$('input[name="kind"]').forEach(i=>i.onchange=kindUi);

// ---------- Palvelin
async function call(body){let r=null;for(const n of window.__PFN?[window.__PFN]:["public","Public"]){try{r=await fetch(C.url+"/functions/v1/"+n,{method:"POST",headers:{"Content-Type":"application/json",apikey:C.anon,Authorization:"Bearer "+C.anon},body:JSON.stringify(body)})}catch(e){r=null;continue}if(r.status!==404){window.__PFN=n;break}}
  if(!r)throw new Error("Yhteys ei toimi. Tarkista netti tai soita 045 353 7000.");const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error||"Virhe "+r.status);e.j=j;throw e}return j}
async function load(){
  try{CFG=await call({action:"order_cfg"})}catch(e){CFG={on:false,isOpen:false,delivery:false,fee:0,min:0}}
  const st=$("#odState"),note=$("#odNote");
  if(!CFG.on){st.textContent="Nettitilaus avautuu pian";note.hidden=false;note.className="od-note bad";note.innerHTML='Nettitilaus ei ole juuri nyt käytössä. Tilaa soittamalla <a href="tel:+358453537000">045 353 7000</a>.'}
  else if(!CFG.isOpen){st.textContent="Kiinni juuri nyt";note.hidden=false;note.className="od-note bad";note.innerHTML=CFG.open!=null&&CFG.now<CFG.open?`Avaamme tänään klo ${clock(CFG.open).replace(":",".")}. Voit koota ostoskorin valmiiksi.`:"Olemme tältä päivältä kiinni. Tervetuloa tilaamaan huomenna!"}
  else{st.textContent=CFG.delivery?"Nouto ja kotiinkuljetus":"Nouto";if(CFG.note){note.hidden=false;note.className="od-note";note.textContent=CFG.note}}
  const d=$('input[name="kind"][value="kuljetus"]');d.disabled=!CFG.delivery;$("#odDelLab").title=CFG.delivery?"":"Kotiinkuljetus ei ole juuri nyt käytössä";
  if(!CFG.delivery)$('input[name="kind"][value="nouto"]').checked=true;
  const me=ls.get("mk_me")||{};["n","p","e","a","z","ci"].forEach(k=>{const i=$("#odForm [name="+k+"]");if(i&&me[k])i.value=me[k]});
  kindUi()}
$("#odForm").onsubmit=async e=>{e.preventDefault();const f=e.target,send=$("#odSend");
  if(!f.reportValidity())return;
  const v=k=>f.elements[k].value.trim(),k=kind(),T=totals();
  ls.set("mk_me",{n:v("n"),p:v("p"),e:v("e"),a:v("a"),z:v("z"),ci:v("ci")});
  send.disabled=true;send.textContent="Lähetetään…";
  try{const r=await call({action:"order",kind:k,n:v("n"),p:v("p"),e:v("e"),a:v("a"),z:v("z"),ci:v("ci"),m:v("m"),w:v("w"),website:f.elements.website.value,total:T.t,
      items:cart.map(x=>({c:x.c,n:x.n,s:x.s,o:x.o,t:x.t,meal:x.meal,q:x.q,m:x.m}))});
    $("#odDoneT").innerHTML=`Tilausnumerosi on <b>#${r.no}</b>. Lähetimme vahvistuksen osoitteeseen ${esc(v("e"))}.<br><br>Saat toisen viestin, kun olemme hyväksyneet tilauksen ja ${k==="kuljetus"?"arvioineet toimitusajan":"tiedämme valmistumisajan"}. Kiireellisissä asioissa soita 045 353 7000.`;
    cart=[];save();draw();$("#odCart").classList.remove("open");$("#odDone").hidden=false}
  catch(x){alert(x.message);if(x.j&&x.j.total)load();draw()}};

menu();draw();load();setInterval(()=>{if(document.visibilityState==="visible")load()},120000);
})();
