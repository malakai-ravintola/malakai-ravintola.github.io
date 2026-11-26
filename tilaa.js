// Malakai nettitilaus: ostoskori, valinnat ja tilauksen lähetys. Hinnat tarkistetaan vielä palvelimella.
(function(){
const $=s=>document.querySelector(s);
const S=window.SITE||{},M=S.menu||{},C=window.MALAKAI||{};
const OMA={n:[11.5,12.5,13.5,13.9],p:[22,24,24,24]},MEAL=4.9,XT={n:1.5,p:3};
const eur=n=>(Math.round(n*100)/100).toFixed(2).replace(".",",")+" €";
const esc=t=>String(t??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
const slug=t=>t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const ls={get:k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const clock=m=>String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
const VAT=13.5,vat=t=>Math.round(t*VAT/(100+VAT)*100)/100;
const DK=["su","ma","ti","ke","to","pe","la"];
const helDay=()=>{const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Helsinki",weekday:"short"}).format(new Date()).toLowerCase();return DK[["sun","mon","tue","wed","thu","fri","sat"].indexOf(p)]};
const toppings=(String((M.Pizza||{}).note||"").split("Täytteet:")[1]||"").split(",").map(t=>t.trim().replace(/\.$/,"")).filter(Boolean);
const sauce=(cat,it)=>/Med tai Hot/i.test((cat.note||"")+" "+(it[1]||""));
const SAUCES=c=>["Med","Hot"];const SPICE=["Tuore valkosipuli","Oregano"];
const LIHA={Tuplaliha:5,Triplaliha:10},POT={"Ranskalaiset":0,"Ristikkoperunat":1,"Kierreperunat":1,"Crispers-ranskanperunat":1},DIP=1.5;
const DIPS=String((((M["Dipit ja juomat"]||{}).items||[]).find(i=>i[0]==="Dippi")||[])[1]||"").split(",").map(v=>v.trim()).filter(Boolean);
const DIMG={"paprikamajoneesi":"dip-paprika","valkosipulimajoneesi":"dip-valkosipuli","remoulade":"dip-remoulade","bbq-kastike":"dip-bbq","currymajoneesi":"dip-curry"},dImgOf=v=>DIMG[String(v).toLowerCase()]||"";
const hasPot=(c,n)=>n==="Kanakori"||c==="Sticky Fingers";
const WN=it=>{const m=/^Hot Wings (\d+) kpl/i.exec((it||[])[0]||"");return m?+m[1]:0};
const freeDips=it=>{const w=WN(it);return !w?1:w<=16?1:w<=25?2:3};
const dipTxt=(cat,it)=>/\bdip/i.test(((cat||{}).note||"")+" "+((it||[])[1]||""));
const hasDip=(cat,it)=>!!it&&it[0]!=="Dippi"&&DIPS.length>0&&(WN(it)>0||cat===M.Lisukkeet||dipTxt(cat,it));
const drinks=(c,it)=>c==="Dipit ja juomat"&&/^Juoma/i.test((it||[])[0]||"")?String(it[1]||"").split(",").map(v=>v.trim()).filter(Boolean):[];
const dImg=(b,n)=>{const l=litres(n);return "juoma-"+slug(b)+"-"+(l===0.33?"033":l===0.5?"05":"15")};
const litres=n=>{const m=String(n).match(/(\d+(?:[,.]\d+)?)\s*l\b/i);return m?+m[1].replace(",","."):0};

let CFG=null,FIRST=false,LOY=null,cart=ls.get("mk_cart")||[],cur=null;
const save=()=>ls.set("mk_cart",cart);

// ---------- Hinta (sama sääntö kuin palvelimella)
// ---------- Tarjoukset (data.js: offers)
const TODAY=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Helsinki"}).format(new Date());
const OFF=(S.offers||[]).filter(o=>o.on&&o.title&&o.price&&(!o.from||o.from<=TODAY)&&(!o.until||o.until>=TODAY));
const offOf=n=>OFF.find(o=>o.title===n),offN=o=>{const m=String(o.title+" "+(o.text||"")).match(/(\d+)\s*pizza/i);return m?Math.min(+m[1],6):0};
const offPrice=o=>+String(o.price).replace(/[^\d,.]/g,"").replace(",",".")||0;
const PIZZAS=()=>((M.Pizza||{}).items||[]).filter(i=>+i[2]>0&&i[0]!=="Oma valinta").map(i=>i[0]);
const offUntil=o=>o.until?(+o.until.slice(8))+"."+(+o.until.slice(5,7))+".":"";
function price(x){
  if(x.c==="Tarjous"){const o=offOf(x.n);return o?Math.round((offPrice(o)+(x.tx||[]).reduce((a,l)=>a+(l||[]).length,0)*XT.n)*100)/100:0}
  const ex=(x.x||[]).length*(x.c==="Päivän pizza"?XT.n:(XT[x.s]||XT.n));
  if(x.c==="Päivän pizza")return Math.round((+S.dailyPrice+ex)*100)/100;
  const cat=M[x.c],it=cat&&cat.items.find(i=>i[0]===x.n);if(!it)return 0;
  let u;if(x.c==="Pizza"&&x.n==="Oma valinta"){const o=OMA[x.s]||OMA.n,k=(x.t||[]).length;u=k<1?0:k<=4?o[k-1]:o[3]+(k-4)*(XT[x.s]||XT.n)}
  else u=+it[3]>0&&x.s==="p"?+it[3]:+it[2];
  if(x.c==="Pizza"&&x.n!=="Oma valinta")u+=ex;
  if(x.c==="Burgerit"&&x.meal)u+=MEAL;
  if(x.c==="Kebab")u+=LIHA[x.l]||0;
  if(hasPot(x.c,x.n))u+=POT[x.pt]||0;
  if(hasDip(cat,it))u+=Math.max(0,(x.d||[]).length-freeDips(it))*DIP;
  return Math.round(u*100)/100}
function optTxt(x){if(x.c==="Tarjous")return"Pizzat: "+(x.t||[]).map((p,i)=>p+((x.tx||[])[i]&&x.tx[i].length?" (+ "+x.tx[i].join(", ")+")":"")).join(", ")+" · 1,5 l juoma · vain nouto";const o=[];const xs=(x.x||[]).length?"Lisätäytteet: "+x.x.join(", "):"";if(x.c==="Päivän pizza")return["Päivän pizza",(x.sp||[]).length?"Mausteet: "+x.sp.join(", "):"",xs].filter(Boolean).join(" · ");
  const cat=M[x.c],it=cat&&cat.items.find(i=>i[0]===x.n);if(!it)return"";
  if(x.n==="Oma valinta")o.push(x.s==="p"?"Perhe":"Normaali",(x.t||[]).join(", "));else if(+it[3]>0)o.push(x.s==="p"?"Perhe":"Normaali");
  if(x.o)o.push(x.n==="Dippi"?x.o:"Kastike "+x.o);if(x.dr)o.push(x.dr);if(x.hot)o.push("Tulinen");if((x.sp||[]).length)o.push("Mausteet: "+x.sp.join(", "));if(x.l)o.push(x.l);if(x.pt)o.push("Perunat: "+x.pt);if((x.d||[]).length)o.push("Dipit: "+x.d.join(", "));if(x.meal)o.push("Ateria");if(xs)o.push(xs);return o.join(" · ")}
const orderable=(c,it)=>+it[2]>0||(c==="Pizza"&&it[0]==="Oma valinta");
const isHid=(c,n)=>!!(CFG&&(CFG.hidden||[]).includes((c==="Päivän pizza"?"Pizza":c)+"|"+n));
const isOut=(c,n)=>isHid(c,n)||!!(CFG&&(CFG.soldout||[]).includes((c==="Päivän pizza"?"Pizza":c)+"|"+n));
function marks(){document.querySelectorAll(".od-it").forEach(r=>{const c=r.dataset.c,n=r.dataset.n;const h=c==="Sticky Fingers"?((M[c]||{}).items||[]).every(i=>isHid(c,i[0])):isHid(c,n);r.hidden=h});
  document.querySelectorAll("section.od-sec").forEach(s=>{const rows=[...s.querySelectorAll(".od-it")];if(rows.length)s.hidden=rows.every(r=>r.hidden);const a=document.querySelector(`#odCats a[href="#${s.id}"]`),t=document.querySelector(`#odTiles a[href="#${s.id}"]`);if(a)a.hidden=s.hidden;if(t)t.hidden=s.hidden});
  document.querySelectorAll(".od-plus").forEach(b=>{const o=isOut(b.dataset.c,b.dataset.n);b.disabled=o;b.title=o?"Loppu":"";const row=b.closest(".od-it,.od-day");if(row){row.classList.toggle("out",o);let t=row.querySelector(".od-out");if(o&&!t){t=document.createElement("span");t.className="od-out";t.textContent="LOPPU";b.before(t)}else if(!o&&t)t.remove()}})}

// ---------- Ruokalista (kuvalliset kategoriat, välilehdet ja tuoterivit)
const day=helDay(),dp=(S.daily||{})[day];
const T="media/tilaa/";
const IMG0={"Tropicana":"tropicana","Kebab Pizza":"kebab","Mexicana":"mexicana","Americano":"americano","Mamma Mia":"mammamia","Julia":"julia","Opera Special":"opera","Barbeque":"bbq","Margarita Mozzarella":"margarita","Oma valinta":"oma","Kebab ranskalaisilla":"kebab-ranskalaiset","Rullakebab":"kebabrulla","Kana ranskalaisilla":"kana-ranskalaiset","Kebabsalaatti":"kebabsalaatti","Iskender":"iskender","Kanasalaatti":"kanasalaatti","Kana riisillä":"kana-riisi","Malakai Special":"malakai-special","Ranskalaiset":"ranskalaiset","Ristikkoperunat":"ristikko","Kierreperunat":"kierre","Crispers-ranskanperunat":"crispers","Bataattiranskalaiset":"bataatti","Mozzarellatikut 5 kpl":"mozzarellatikut","Kananugetit 5 kpl":"nugetit","Kanakori":"kanakori","Sipulirenkaat":"sipulirenkaat","Dippi":"dipit","Pitakebab":"pitakebab","Kanapita":"pita","Kana lohkoperunoilla":"kana-lohko","Kebab ristikkoperunoilla":"kebab-ristikko","Kebab lohkoperunoilla":"kebab-lohko","Hotwings-ateria":"wings-ateria","Finlandia":"finlandia","Tonnikala Pizza":"tonnikala","Juoma 0,33 l":"juomat-033","Juoma 0,5 l":"juomat-05","Juoma 1,5 l":"juomat-15"};
const IMG=new Proxy(IMG0,{get:(o,n)=>o[n]||(/rulla$/i.test(n)?"rulla":/^Sticky Fingers/.test(n)?"sticky":/^Hot ?wings/i.test(n)?"wings":/burgeri$/i.test(n)?"burgeri":undefined)});
const CIMG={"Pizza":"opera","Kebab":"kebab-ranskalaiset","Kana":"kana-ranskalaiset","Sticky Fingers":"sticky","Wings":"wings","Burgerit":"burgeri","Lisukkeet":"kat-lisukkeet2","Dipit ja juomat":"kat-dipit-juomat"};
const CNAME={"Pizza":"Pizzat","Kebab":"Kebabit","Kana":"Kana-annokset","Wings":"Hot Wings","Dipit ja juomat":"Dipit ja juomat"};
const pic=(f,alt,cls)=>{if(!f)return`<span class="od-ph ${cls||""}" aria-hidden="true"><img src="media/logo-malakai.svg" alt=""></span>`;
  if(f.includes("/"))return`<img src="${esc(f)}" alt="${esc(alt)}" loading="lazy" class="pho ${cls||""}">`;
  const cut=!f.includes(".");return`<img src="${T}${cut?f+".webp":f}?v=16" alt="${esc(alt)}" loading="lazy" class="${cut?"cut":"pho"} ${cls||""}">`};
function menu(){const m=$("#odMenu"),cats=$("#odCats"),tiles=$("#odTiles");let h="",ch="",th="";
  if(dp&&dp.name&&S.dailyPrice){
    th+=`<a class="od-tile" href="#paivan-pizza">${pic(IMG[dp.name]||dp.img,dp.name)}<b>Päivän pizza</b></a>`;
    ch+=`<a href="#paivan-pizza">Päivän pizza</a>`;
    h+=`<section class="od-sec" id="paivan-pizza"><h2>Päivän pizza</h2><div class="od-it od-day" data-c="Päivän pizza" data-n="${esc(dp.name)}"><div class="od-img">${pic(IMG[dp.name]||dp.img,dp.name)}</div><div class="od-tx"><b>${esc(dp.name)}</b><span class="od-pr">${eur(+S.dailyPrice)}</span><small>Vain tänään</small><p>Päivän tarjouspizza – vaihtuu joka päivä.</p></div><button class="od-plus" data-c="Päivän pizza" data-n="${esc(dp.name)}" aria-label="Lisää ${esc(dp.name)}">+</button></div></section>`}
  if(OFF.length){th=`<a class="od-tile od-tile-off" href="#tarjoukset">${pic("tarjous-3-pizzaa","Tarjous")}<b>Tarjoukset</b></a>`+th;ch=`<a href="#tarjoukset">Tarjoukset</a>`+ch;
    h=`<section class="od-sec" id="tarjoukset"><h2>Tarjoukset</h2>`+OFF.map(o=>{const n=offN(o);return`<div class="od-it od-day od-off" data-c="Tarjous" data-n="${esc(o.title)}"><div class="od-img">${pic("tarjous-3-pizzaa",o.title)}</div><div class="od-tx"><b>${esc(o.title)}</b><span class="od-pr">${esc(o.price)}</span>${o.was?`<s class="od-was">${esc(o.was)}</s>`:""}<small>Voimassa ${offUntil(o)} asti · vain nouto</small><p>${esc(o.text||"")}</p></div><button class="od-plus" data-c="Tarjous" data-n="${esc(o.title)}" aria-label="Lisää ${esc(o.title)}">+</button></div>`}).join("")+`</section>`+h}
  if(M.Pizza)th+=`<a class="od-tile" href="#" data-open="Oma valinta">${pic("oma","Oma pizza")}<b>Luo oma pizza</b></a>`;
  Object.entries(M).forEach(([c,cat])=>{const items=cat.items.filter(it=>orderable(c,it));if(!items.length)return;const id=slug(c),nm=CNAME[c]||c;
    th+=`<a class="od-tile" href="#${id}">${pic(CIMG[c],nm)}<b>${esc(nm)}</b></a>`;ch+=`<a href="#${id}">${esc(nm)}</a>`;
    h+=`<section class="od-sec" id="${id}"><h2>${esc(nm)}</h2>${cat.note&&c!=="Pizza"&&c!=="Sticky Fingers"?`<p class="od-cn">${esc(cat.note)}</p>`:""}`;
    (c==="Sticky Fingers"?[[ "Sticky Fingers", cat.note||"", Math.min(...items.map(i=>+i[2])), 0, "", items[0][0] ]]:items).forEach(it=>{const om=it[0]==="Oma valinta",two=+it[3]>0;
      const grp=c==="Sticky Fingers",pr=grp?"alk. "+eur(+it[2]):om?`alk. ${eur(OMA.n[0])} <i>normaali</i>`:eur(+it[2])+(two?" <i>normaali</i>":"");
      const p2=om?`alk. ${eur(OMA.p[0])} perhe`:(two?eur(+it[3])+" perhe":"");
      const ds=om?"Valitse itse täytteet – niin monta kuin haluat. Normaali tai perhekoko.":(it[0]==="Dippi"?"Valitse maku: "+it[1]:it[1]);
      const dn=grp?it[5]:it[0];
      h+=`<div class="od-it" data-c="${esc(c)}" data-n="${esc(dn)}" tabindex="0" role="button" aria-label="${esc(it[0])}"><div class="od-img">${pic(IMG[it[0]],it[0])}</div><div class="od-tx"><b>${esc(om?"Oma pizza":it[0])}</b><span class="od-pr">${pr}</span>${p2?`<small>${p2}</small>`:""}${ds?`<p>${esc(ds)}</p>`:""}</div><button class="od-plus" data-c="${esc(c)}" data-n="${esc(dn)}" aria-label="Lisää ${esc(it[0])}" tabindex="-1">+</button></div>`});
    h+="</section>"});
  m.innerHTML=h;cats.innerHTML=ch;tiles.innerHTML=th;
  const go=e=>{const r=e.target.closest(".od-it");if(!r)return;const b=r.querySelector(".od-plus");if(b&&b.disabled)return;open(r.dataset.c,r.dataset.n)};
  m.addEventListener("click",go);m.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.classList.contains("od-it")){e.preventDefault();go(e)}});
  tiles.addEventListener("click",e=>{const t=e.target.closest("[data-open]");if(t){e.preventDefault();open("Pizza",t.dataset.open)}});
  // Aktiivinen välilehti seuraa vieritystä
  const links=[...cats.querySelectorAll("a")],secs=links.map(a=>document.getElementById(a.hash.slice(1)));
  const spy=()=>{let i=0;secs.forEach((s,k)=>{if(s&&s.getBoundingClientRect().top<(parseInt(getComputedStyle(document.documentElement).getPropertyValue("--odTop"))||170)+20)i=k});links.forEach((a,k)=>a.classList.toggle("on",k===i));
    const a=links[i];if(a&&spy.l!==a){spy.l=a;const w=cats;w.scrollTo({left:a.offsetLeft-w.clientWidth/2+a.clientWidth/2,behavior:"smooth"})}};
  const pin=()=>{const tb=document.getElementById("topbar"),y=tb?Math.max(0,tb.getBoundingClientRect().bottom):64;cats.parentElement.style.top=y+"px";document.documentElement.style.setProperty("--odTop",(y+60)+"px")};
  addEventListener("scroll",()=>{cancelAnimationFrame(spy.r);spy.r=requestAnimationFrame(()=>{pin();spy()})},{passive:true});addEventListener("resize",pin);pin();spy()}

// ---------- Tuotekortti
const row=(name,type,v,sel)=>`<label class="od-row${v[3]?" od-drow":""}"><input type="${type}" name="${name}" value="${esc(v[0])}"${sel?" checked":""}${v[3]?` data-img="${v[3]}"`:""}><i></i>${v[3]?`<img src="${T}${v[3]}.webp?v=16" alt="" loading="lazy">`:(v.length>3?`<b class="od-rph" aria-hidden="true"></b>`:"")}<span>${esc(v[1])}</span><em>${v[2]||""}</em></label>`;
function grp(title,sub,name,type,list,sel){return`<div class="od-opt" data-g="${name}"><div class="od-gh"><b>${esc(title)}</b>${sub?`<small>${esc(sub)}</small>`:""}</div>${list.map((v,i)=>row(name,type,v,sel(v[0],i))).join("")}</div>`}
function sheet(x,{title,img,pr,desc,o,nonote}){$("#odMN").closest("label").hidden=!!nonote;cur=x;$("#odMT").textContent=title;$("#odMT2").textContent=title;$("#odMP").innerHTML=pr||"";$("#odMD").textContent=desc||"";
  const I=$("#odMI");I.hidden=!img;I.innerHTML=img?pic(img,title).replace(' loading="lazy"',""):"";
  $("#odMO").innerHTML=o;$("#odMN").value="";$("#odMq").textContent="1";$("#odMTop").classList.toggle("on",!img);
  $("#odModal").hidden=false;$("#odMS").scrollTop=0;document.documentElement.style.overflow="hidden";upd();setTimeout(()=>$("#odMX").focus(),30)}
$("#odMS").addEventListener("scroll",()=>{const s=$("#odMS"),I=$("#odMI");$("#odMTop").classList.toggle("on",I.hidden||s.scrollTop>I.offsetHeight-40)},{passive:true});
function open(c,n){
  if(c==="Tarjous"){const of=offOf(n);if(!of)return;const k=offN(of),P=PIZZAS(),x={c,n,q:1,t:[]};
    let o=`<div class="od-opt"><div class="od-gh"><b>Valitse ${k} pizzaa</b><small>Normaalikoko</small></div>`+Array.from({length:k},(_,i)=>`<label class="od-sel">Pizza ${i+1}<select name="op${i}"><option value="">Valitse…</option>${P.map(p=>`<option>${esc(p)}</option>`).join("")}</select></label><details class="od-xtra"><summary>+ Lisätäytteet pizzaan ${i+1} <small>+${eur(XT.n)} / täyte</small></summary>${grp("Lisätäytteet – pizza "+(i+1),"Valinnainen · +"+eur(XT.n)+" / täyte","tx"+i,"checkbox",toppings.map(t=>[t,t,"+"+eur(XT.n)]),()=>false)}</details>`).join("")+`</div>`;
    if(/juoma/i.test(of.text||""))o+=`<p class="od-small">+ 1,5 l juoma sisältyy. Kirjoita juomatoive alle lisätoiveeseen.</p>`;
    o+=`<p class="od-small">🛍️ Tarjous koskee vain noutoa. Voimassa ${offUntil(of)} asti.</p>`;
    return sheet(x,{title:n,img:"tarjous-3-pizzaa",pr:esc(of.price),desc:of.text||"",o})}
  const day=c==="Päivän pizza",cat=day?{}:M[c],it=day?[n,"",+S.dailyPrice]:cat.items.find(i=>i[0]===n),x={c,n,q:1,s:"n"};let o="",title=n,pr=eur(+it[2]),desc=it[1]||"";
  const xrows=()=>toppings.map(t=>[t,t,"+"+eur(XT.n)]);const spg=()=>grp("Mausteet","Valinnainen · ilmainen","sp","checkbox",SPICE.map(v=>[v,v,""]),()=>false);
  if(c==="Sticky Fingers"){const L=cat.items.filter(i=>+i[2]>0&&!isOut(c,i[0])),b=Math.min(...L.map(i=>+i[2]));title="Sticky Fingers";pr=eur(b);desc=String(cat.note||"").replace(/\s*Kastike:.*$/,"");
    o+=grp("Valitse määrä","Valitse yksi","sz","radio",L.map(i=>[i[0],i[0].replace(/^Sticky Fingers\s*/,""),+i[2]>b?"+"+eur(+i[2]-b):""]),v=>v===n)}
  if(day){pr=eur(+S.dailyPrice)+" <i>Vain tänään</i>";desc="Päivän tarjouspizza – vaihtuu joka päivä.";o+=spg()+grp("Lisätäytteet","Valinnainen · +"+eur(XT.n)+" / täyte","x","checkbox",xrows(),()=>false)}
  else if(n==="Oma valinta"){x.t=[];title="Oma pizza";pr=`alk. ${eur(OMA.n[0])} <i>perhe alk. ${eur(OMA.p[0])}</i>`;desc="Valitse koko ja täytteet – niin monta kuin haluat.";
    o+=grp("Koko","Valitse yksi","s","radio",[["n","Normaali",""],["p","Perhe",""]],v=>v==="n")+spg()+grp("Täytteet",`1 täyte ${eur(OMA.n[0])} / ${eur(OMA.p[0])} · 4 täytettä ${eur(OMA.n[3])} / ${eur(OMA.p[3])} · jokainen seuraava +${eur(XT.n)} / perhe +${eur(XT.p)}`,"t","checkbox",toppings.map(t=>[t,t,""]),()=>false)}
  else{if(+it[3]>0){pr=`${eur(+it[2])} <i>perhe ${eur(+it[3])}</i>`;o+=grp("Koko","Valitse yksi","s","radio",[["n","Normaali",eur(+it[2])],["p","Perhe",eur(+it[3])]],v=>v==="n")}
    if(c==="Pizza")o+=spg()+grp("Lisätäytteet",`Valinnainen · +${eur(XT.n)} / perhe +${eur(XT.p)} täyte`,"x","checkbox",xrows(),()=>false)}
  if(n==="Dippi"){desc="";o+=grp("Valitse maku","Valitse yksi","o","radio",String(it[1]).split(",").map(v=>[v.trim(),v.trim(),"",dImgOf(v.trim())]),(v,i)=>i===0)}
  else if(!day&&sauce(cat,it))o+=grp("Valitse kastike","Valitse yksi","o","radio",SAUCES(c).map(v=>[v,v==="Med"?"Medium":v,""]),v=>v==="Med");
  if(c==="Kebab"||c==="Kana")o+=grp("Tulisuus","Valinnainen · ilmainen","hot","checkbox",[["1","Tulinen","🌶️"]],()=>false);
  if(c==="Kebab")o+=grp("Tuplalihalla?","Valinnainen","l","radio",[["","Normaali",""],["Tuplaliha","Tuplaliha","+"+eur(LIHA.Tuplaliha)],["Triplaliha","Triplaliha","+"+eur(LIHA.Triplaliha)]],v=>v==="");
  if(hasPot(c,n))o+=grp("Perunat","Valitse yksi","pt","radio",Object.entries(POT).map(([v,p])=>[v,v,p?"+"+eur(p):""]),v=>v==="Ranskalaiset");
  if(!day&&hasDip(cat,it)){const fd=freeDips(it);o+=`<div data-free="${fd}">`+grp("Dippi?",`${fd===1?"1 dippi":fd+" dippiä"} sisältyy · lisädipit +${eur(DIP)} / kpl · enintään 8`,"d","checkbox",DIPS.map(v=>[v,v,"",dImgOf(v)]),()=>false)+`</div>`}
  if(c==="Burgerit")o+=grp("Ateria","Valinnainen","meal","checkbox",[["1","Ranskalaiset ja 0,33 l juoma","+"+eur(MEAL)]],()=>false);
  const L=litres(n),DR=day?[]:drinks(c,it);if(/juoma/i.test(n)){if(L)pr=`${eur(+it[2])} <i>${eur(+it[2]/L)}/l</i>`;desc=(L?Math.round(L*1000)+" ml":"")+(DR.length?"":" · Kirjoita lisätoiveeseen, minkä juoman haluat.")}
  if(DR.length)o=`<div class="od-opt" data-g="dr"><div class="od-gh"><b>Valitse juoma</b><small>Valitse yksi</small></div>${DR.map((b,i)=>`<label class="od-row od-drow"><input type="radio" name="dr" value="${esc(b)}"${i?"":" checked"} data-img="${dImg(b,n)}"><i></i><img src="${T}${dImg(b,n)}.webp?v=16" alt="" loading="lazy"><span>${esc(b)}</span><em></em></label>`).join("")}</div>`+o;
  sheet(x,{title,nonote:!!DR.length,img:DR.length?dImg(DR[0],n):n==="Dippi"?(dImgOf(String(it[1]).split(",")[0].trim())||"dipit"):IMG[c==="Sticky Fingers"?"Sticky Fingers 6 kpl":n]||(c==="Wings"?"wings":""),pr,desc,o})}
function read(){const f=$("#odMO"),x=cur,v=k=>{const e=f.querySelector(`input[name="${k}"]:checked`);return e?e.value:""},vs=k=>[...f.querySelectorAll(`input[name="${k}"]:checked`)].map(i=>i.value);
  x.m=$("#odMN").value.trim();x.q=+$("#odMq").textContent;
  if(x.c==="Tarjous"){x.t=[...f.querySelectorAll("select[name^=op]")].map(s=>s.value);x.tx=x.t.map((_,i)=>vs("tx"+i));if(!x.tx.some(l=>l.length))delete x.tx;return x}
  if(x.c==="Sticky Fingers"&&v("sz"))x.n=v("sz");
  x.s=v("s")||"n";x.o=v("o");x.t=vs("t");x.x=vs("x");x.meal=!!v("meal");x.l=v("l");x.pt=v("pt");x.d=vs("d");x.dr=v("dr");x.hot=!!v("hot");x.sp=vs("sp");if(!x.sp.length)delete x.sp;if(!x.hot)delete x.hot;
  ["o","l","pt","dr"].forEach(k=>{if(!x[k])delete x[k]});if(!x.d.length)delete x.d;return x}
function valid(x){if(x.c==="Tarjous")return x.t.some(v=>!v)?"Valitse kaikki pizzat":"";if(x.c==="Päivän pizza")return"";const cat=M[x.c],it=cat.items.find(i=>i[0]===x.n);
  if(x.n==="Oma valinta"&&x.t.length<1)return"Valitse vähintään 1 täyte";
  if((x.n==="Dippi"||sauce(cat,it))&&!x.o)return x.n==="Dippi"?"Valitse maku":"Valitse kastike";
  if(hasDip(cat,it)&&!WN(it)&&dipTxt(cat,it)&&!(x.d||[]).length)return"Valitse dippi";if(drinks(x.c,it).length&&!x.dr)return"Valitse juoma";return""}
function upd(){const x=read(),btn=$("#odMA"),v=valid(x),f=$("#odMO");
  const di=f.querySelector('input[name="dr"]:checked,input[name="o"][data-img]:checked');if(di){const im=$("#odMI img");if(im)im.src=T+di.dataset.img+".webp?v=16"}
  const D=[...f.querySelectorAll('input[name="d"]')];if(D.length){const fr=+(f.querySelector("[data-free]")||{dataset:{free:1}}).dataset.free||1,on=D.filter(i=>i.checked);D.forEach(i=>{i.disabled=!i.checked&&on.length>=8;i.parentNode.querySelector("em").textContent=i.checked?(on.indexOf(i)<fr?"sisältyy":"+"+eur(DIP)):(on.length>=fr?"+"+eur(DIP):"")})}
  f.querySelectorAll('input[name="x"]').forEach(i=>i.parentNode.querySelector("em").textContent="+"+eur(x.c==="Päivän pizza"?XT.n:(XT[x.s]||XT.n)));
  btn.innerHTML=v?esc(v):`<span>Lisää tilaukseen</span><b>${eur(price(x)*x.q)}</b>`;btn.disabled=!!v}
const $$=s=>[...document.querySelectorAll(s)];
$("#odMO").addEventListener("change",upd);
$("#odMm").onclick=()=>{const q=$("#odMq");q.textContent=Math.max(1,+q.textContent-1);upd()};
$("#odMp").onclick=()=>{const q=$("#odMq");q.textContent=Math.min(20,+q.textContent+1);upd()};
$("#odMA").onclick=()=>{const x=read();if(valid(x))return;add({...x});close()};
const close=()=>{$("#odModal").hidden=true;cur=null;document.documentElement.style.overflow=""};
$("#odMX").onclick=close;$("#odModal").addEventListener("click",e=>{if(e.target.id==="odModal")close()});
addEventListener("keydown",e=>{if(e.key==="Escape"){close();$("#odCart").classList.remove("open")}});

// ---------- Ostoskori
const key=x=>JSON.stringify([x.c,x.n,x.s||"",x.o||"",(x.t||[]).slice().sort(),(x.x||[]).slice().sort(),!!x.meal,x.dr||"",!!x.hot,(x.sp||[]).slice().sort(),x.l||"",x.pt||"",(x.d||[]).slice().sort(),x.m||""]);
function add(x){const k=key(x),e=cart.find(i=>key(i)===k);if(e)e.q=Math.min(20,e.q+x.q);else cart.push(x);save();draw();
  const b=$("#odBar");b.animate&&b.animate([{transform:"scale(1)"},{transform:"scale(1.05)"},{transform:"scale(1)"}],{duration:300})}
const sub=()=>cart.reduce((a,x)=>a+price(x)*x.q,0);
const kind=()=>($('input[name="kind"]:checked')||{}).value||"nouto";
function totals(){const s=sub(),fee=kind()==="kuljetus"&&CFG?CFG.fee:0,pct=FIRST&&CFG?CFG.firstPct:(LOY&&LOY.now?LOY.pct:0),d=pct?Math.round((s+fee)*pct)/100:0,t0=Math.round((s+fee-d)*100)/100;
  const rw=rwOk(RWSEL,t0)?RWSEL:null;return{s,fee,d,pct,rw,t:Math.round((t0-(rw?rw.eur:0))*100)/100}}
// ---------- Bonuspisteet (1 € = 1 piste)
let BON={pts:null,email:"",at:"",cps:[]},RWSEL=null;
const SBC=window.supabase&&C.url?supabase.createClient(C.url,C.anon):null;
const bRules=()=>(CFG&&CFG.bonus&&CFG.bonus.tiers)?CFG.bonus:{rate:1,round:300,tiers:[{p:50,e:1},{p:90,e:2},{p:120,e:4},{p:150,e:10},{p:200,e:15},{p:250,e:20},{p:300,e:25}],minMul:2};
const formEmail=()=>{const f=$("#odForm");return f?f.elements.e.value.trim().toLowerCase():""};
function rwOk(r,t0){return !!r&&BON.cps.some(c=>c.id===r.id)&&formEmail()===BON.email&&t0>=r.eur*(bRules().minMul||2)}
async function bonusLoad(){if(!SBC)return;try{const{data:{session}}=await SBC.auth.getSession();if(!session){BON={pts:null,email:"",at:"",cps:[]};return bonus()}
  BON.email=String(session.user.email||"").toLowerCase();BON.at=session.access_token;
  const[c,k]=await Promise.all([SBC.from("customers").select("points").eq("email",BON.email).maybeSingle(),SBC.from("bonus_coupons").select("id,eur,tier,round").eq("email",BON.email).is("used_at",null).order("eur",{ascending:false})]);
  BON.pts=+(c.data&&c.data.points)||0;BON.cps=(k.data||[]).map(x=>({id:x.id,eur:+x.eur,tier:x.tier}));try{const w=localStorage.getItem("mk_cp");if(w){localStorage.removeItem("mk_cp");const c0=BON.cps.find(x=>x.id===w);if(c0)RWSEL=c0}}catch(_){}
  const f=$("#odForm");if(f&&!f.elements.e.value)f.elements.e.value=BON.email}catch(e){}bonus();draw()}
function nextTier(p){const B=bRules(),r=B.round||300,q=p%r,n=B.tiers.find(x=>x.p>q);return n?{e:n.e,left:n.p-q}:{e:B.tiers[0].e,left:r-q+B.tiers[0].p}}
function bonus(){const el=$("#odStamps");if(!el)return;if(!cart.length){el.hidden=true;return}el.hidden=false;
  const B=bRules(),s=sub(),fee=kind()==="kuljetus"&&CFG?CFG.fee:0,pct=FIRST&&CFG?CFG.firstPct:0,t0=Math.round((s+fee-(pct?Math.round((s+fee)*pct)/100:0))*100)/100;
  const T=totals(),earn=Math.floor(T.t*(B.rate||1));
  if(BON.pts==null){el.innerHTML=`<div class="od-bn-g"><span class="od-bn-ic">★</span><div><b>Luo tili – kerää bonuskuponkeja</b><span>Tästä tilauksesta <strong>+${earn} pistettä</strong>. Jo 50 pisteellä −1 € kuponki, 300 pisteellä −25 €.</span></div><a href="tili.html" target="_blank" rel="noopener" class="od-bn-a">Luo tili →</a></div>`;return}
  const other=formEmail()&&formEmail()!==BON.email,nx=nextTier(BON.pts);
  const sel=RWSEL&&rwOk(RWSEL,t0)?RWSEL.id:"";
  el.innerHTML=`<div class="od-bn-h"><div><b>Bonuspisteesi <em>${BON.pts} p</em></b><span>${other?"Käytä tilisi sähköpostia ("+esc(BON.email)+"), niin voit käyttää kuponkeja.":`Tästä tilauksesta +${earn} p · seuraava kuponki −${nx.e} € vielä ${nx.left} p päässä`}</span></div><a href="tili.html#bonus" target="_blank" rel="noopener" class="od-bn-a">Lisätietoja</a></div>`+
   (BON.cps.length?`<div class="od-bn-r">${BON.cps.map(c=>{const big=t0>=c.eur*(B.minMul||2),on=sel===c.id;
    return`<button type="button" class="od-bn${on?" on":""}" data-cp="${c.id}" ${!other&&big?"":"disabled"}><b>−${c.eur} €</b><small>Bonuskuponki</small><i>${other?"Tilin sähköposti":!big?"Tilaus väh. "+eur(c.eur*(B.minMul||2)):on?"Käytössä ✓":"Käytä"}</i></button>`}).join("")}</div>`
   :`<p class="od-bn-n">Sinulla ei ole vielä kuponkeja. Ensimmäinen tulee 50 pisteellä.</p>`)}
document.addEventListener("click",e=>{const b=e.target.closest("[data-cp]");if(!b||b.disabled)return;const c=BON.cps.find(x=>x.id===b.dataset.cp);RWSEL=RWSEL&&RWSEL.id===c.id?null:c;draw()});
function draw(){
  cart=cart.filter(x=>price(x)>0&&!valid(x)&&!isOut(x.c,x.n)&&(x.c!=="Päivän pizza"||(dp&&x.n===dp.name)));save();
  const L=$("#odLines");
  L.innerHTML=cart.length?cart.map((x,i)=>`<div class="od-line"><b>${esc(x.n)}</b><em>${eur(price(x)*x.q)}</em>${optTxt(x)?`<small>${esc(optTxt(x))}</small>`:""}${x.m?`<small>Toive: ${esc(x.m)}</small>`:""}<div class="od-q"><button type="button" data-i="${i}" data-d="-1" aria-label="Vähemmän">−</button><b>${x.q}</b><button type="button" data-i="${i}" data-d="1" aria-label="Enemmän">+</button></div></div>`).join(""):'<p class="od-empty">Ostoskori on tyhjä. Lisää tuotteita listalta.</p>';
  const T=totals(),n=cart.reduce((a,x)=>a+x.q,0);
  $("#odSum").innerHTML=`<div><span>Tuotteet</span><span>${eur(T.s)}</span></div>`+(kind()==="kuljetus"?`<div><span>Kuljetus</span><span>${eur(T.fee)}</span></div>`:"")+(T.d?`<div class="disc"><span>${FIRST?"Uuden asiakkaan etu":"Kanta-asiakasetu"} −${T.pct} %</span><span>−${eur(T.d)}</span></div>`:"")+(T.rw?`<div class="disc"><span>Bonuskuponki</span><span>−${eur(T.rw.eur)}</span></div>`:"")+`<div class="tot"><span>Yhteensä</span><span>${eur(T.t)}</span></div>`+`<div class="vat"><span>Veroton hinta</span><span>${eur(T.t-vat(T.t))}</span></div><div class="vat"><span>ALV 13,5 % (sisältyy hintaan)</span><span>${eur(vat(T.t))}</span></div>`;
  upsell();bonus();$("#odBarN").textContent=n;$("#odBarT").textContent=eur(T.t);$("#odBar").hidden=!n;
  const send=$("#odSend"),why=!CFG?"Ladataan…":!CFG.on?"Nettitilaus ei ole käytössä":!$("#odWhen").value?"Ei vapaita aikoja":(kind()==="kuljetus"&&cart.some(x=>x.c==="Tarjous"))?"Tarjous on vain noutona – valitse Nouto":!n?"Ostoskori on tyhjä":(kind()==="kuljetus"&&T.s<CFG.min?"Vähimmäistilaus kuljetukseen "+eur(CFG.min):"");
  send.disabled=!!why;send.textContent=why||"Lähetä tilaus · "+eur(T.t)}
$("#odLines").addEventListener("click",e=>{const b=e.target.closest("button[data-i]");if(!b)return;const x=cart[+b.dataset.i];x.q+=+b.dataset.d;if(x.q<1)cart.splice(+b.dataset.i,1);save();draw()});
$("#odBar").onclick=()=>{$("#odCart").classList.add("open");setTimeout(()=>$("#odClose").focus(),30)};
$("#odClose").onclick=()=>$("#odCart").classList.remove("open");
$("#odCart").addEventListener("click",e=>{if(e.target.id==="odCart")$("#odCart").classList.remove("open")});

// ---------- Toimitustapa ja aika
const WDF=["Sunnuntai","Maanantai","Tiistai","Keskiviikko","Torstai","Perjantai","Lauantai"];
const dLabel=(d,i)=>i===1?"Huomenna":WDF[new Date(d+"T12:00:00Z").getUTCDay()]+" "+(+d.slice(8))+"."+(+d.slice(5,7))+".";
function when(){const sel=$("#odWhen"),k=kind(),c=CFG;if(!c||!c.days){sel.innerHTML='<option value="heti">Mahdollisimman pian</option>';return}
  const lead=k==="kuljetus"?c.dtime:c.prep,cur=sel.value;let h="";
  c.days.forEach((d,i)=>{if(d.open==null)return;let m0=i===0?Math.max(Math.ceil((c.now+lead+5)/15)*15,d.open+lead):d.open+lead,opts="";
    if(i===0&&c.isOpen&&(k!=="kuljetus"||c.delNow!==false))opts+=`<option value="heti">Mahdollisimman pian (noin ${lead} min)</option>`;
    const end=d.close-(k==="kuljetus"?(c.delCut||0):0);for(let m=m0;m<=end;m+=15)opts+=`<option value="${i===0?clock(m):d.date+" "+clock(m)}">${i===0?"Tänään":dLabel(d.date,i)} klo ${clock(m).replace(":",".")}</option>`;
    if(opts)h+=`<optgroup label="${i===0?"Tänään":(i===1?"Huomenna – ennakkotilaus":dLabel(d.date,i)+" – ennakkotilaus")}">${opts}</optgroup>`});
  sel.innerHTML=h||'<option value="">Ei vapaita aikoja</option>';if([...sel.options].some(o=>o.value===cur))sel.value=cur;
  const pre=/^\d{4}-/.test(sel.value);$("#odPre").hidden=!pre;if(pre)$("#odPre").textContent="📅 Ennakkotilaus: "+sel.options[sel.selectedIndex].text+". Saat vahvistuksen sähköpostiin.";}
function kindUi(){const k=kind();$("#odAddr").hidden=k!=="kuljetus";$$("#odAddr [data-req]").forEach(i=>i.required=k==="kuljetus");
  $("#odPayInfo").textContent=k==="kuljetus"?"Maksat kuljettajalle, kun ruoka tuodaan.":"Maksat kassalla, kun noudat tilauksen.";$("#odKindInfo").textContent=!CFG?"":k==="kuljetus"?`Kuljetus ${eur(CFG.fee)} · vähimmäistilaus ${eur(CFG.min)}${CFG.area?" · Toimitusalue: "+CFG.area:""} · Maksu toimitettaessa.`:"Nouto: Tampereentie 414, Lempäälä. Maksu noudettaessa.";
  if(CFG&&k==="kuljetus"&&CFG.isOpen&&CFG.delNow===false&&CFG.close!=null)$("#odKindInfo").textContent=`Kotiinkuljetus päättyi tänään klo ${clock(CFG.close-(CFG.delCut||30)).replace(":",".")}. Nouto onnistuu vielä klo ${clock(CFG.close-15).replace(":",".")} asti – tai valitse kuljetukselle ennakkoaika.`;
  when();draw()}
$$('input[name="kind"]').forEach(i=>i.onchange=kindUi);
$("#odWhen").addEventListener("change",()=>{when();draw()});
let fT=null;async function checkFirst(){const f=$("#odForm"),e=f.elements.e.value.trim(),p=f.elements.p.value.trim();
  if(!/^\S+@\S+\.\S+$/.test(e)||p.replace(/\D/g,"").length<7){FIRST=false;LOY=null;stamps();draw();return}
  try{const r=await call({action:"first",e,p});FIRST=!!r.first;if(CFG)CFG.firstPct=r.pct;LOY=r.every>0&&r.loyPct>0?{n:+r.count||0,every:+r.every,pct:+r.loyPct,now:!!r.loy}:null}catch(x){FIRST=false;LOY=null}
  $("#odFirst").hidden=!FIRST;stamps();draw()}
function stamps(){bonus();return;const el=$("#odStamps");if(!el)return;if(!LOY||FIRST){el.hidden=true;return}
  const k=LOY.now?LOY.every:LOY.n%LOY.every,left=LOY.every-k;el.hidden=false;
  el.innerHTML=`<div class="od-st-h"><b>${LOY.now?"🎉 Tämä on "+LOY.every+". tilauksesi – saat −"+LOY.pct+" %!":"Leimakortti "+k+"/"+LOY.every}</b><span>${LOY.now?"Kanta-asiakasetu lasketaan automaattisesti.":"Jokainen tilaus = 1 leima. Joka "+LOY.every+". tilaus −"+LOY.pct+" %."}</span></div><div class="od-st-r">${Array.from({length:LOY.every},(_,i)=>`<i class="${i<k?"on":""}${i===LOY.every-1?" gift":""}">${i===LOY.every-1?"%":i<k?"✓":""}</i>`).join("")}</div>`}
// ---------- Lisämyynti ostoskorissa
const UPS=[["Dipit ja juomat","Dippi","Dippi","dipit","Valitse maku"],["Dipit ja juomat","Juoma 0,33 l","Juoma 0,33 l","juomat-033","Pepsi, Coca-Cola…"],["Lisukkeet","Ranskalaiset","Ranskalaiset","ranskalaiset","Rapeat ja kuumat"],["Lisukkeet","Mozzarellatikut 5 kpl","Mozzarellatikut","mozzarellatikut","5 kpl"],["Wings","Hot Wings 10 kpl","Hot Wings 10 kpl","wings","Med tai Hot"]];
function upsell(){const el=$("#odUps");if(!el)return;const have=new Set(cart.map(x=>x.n));
  const l=UPS.filter(([c,n])=>{const it=(M[c]||{}).items&&M[c].items.find(i=>i[0]===n);return it&&+it[2]>0&&!have.has(n)&&!isOut(c,n)}).slice(0,4);
  if(!cart.length||!l.length){el.hidden=true;return}el.hidden=false;
  el.innerHTML=`<div class="od-ups-h"><b>Täydennä tilaustasi</b><span>Suosituimmat lisät</span></div><div class="od-ups-r">${l.map(([c,n,t,img,sub])=>{const it=M[c].items.find(i=>i[0]===n);return`<button type="button" class="od-uc" data-c="${esc(c)}" data-n="${esc(n)}" aria-label="Lisää ${esc(t)}"><span class="od-uc-i"><img src="media/tilaa/${img}.webp?v=16" alt="" loading="lazy"></span><span class="od-uc-t"><b>${esc(t)}</b><small>${esc(sub)}</small><em>${eur(+it[2])}</em></span><i class="od-uc-p" aria-hidden="true">+</i></button>`}).join("")}</div>`}
$("#odUps")&&$("#odUps").addEventListener("click",e=>{const b=e.target.closest("button[data-n]");if(b)open(b.dataset.c,b.dataset.n)});
["e","p"].forEach(k=>$("#odForm").elements[k].addEventListener("input",()=>{clearTimeout(fT);fT=setTimeout(checkFirst,600)}));

// ---------- Palvelin
async function call(body){let r=null;for(const n of window.__PFN?[window.__PFN]:["public","Public"]){try{r=await fetch(C.url+"/functions/v1/"+n,{method:"POST",headers:{"Content-Type":"application/json",apikey:C.anon,Authorization:"Bearer "+C.anon},body:JSON.stringify(body)})}catch(e){r=null;continue}if(r.status!==404){window.__PFN=n;break}}
  if(!r)throw new Error("Yhteys ei toimi. Tarkista netti tai soita 045 353 7000.");const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error||"Virhe "+r.status);e.j=j;throw e}return j}
function hdr(){const c=CFG||{},H=$("#odHours"),D=$("#odDel"),P=$("#odPreBtn");if(!H)return;const t=m=>clock(m).replace(":",".");
  const td=(c.days||[])[0]||{};let txt="";
  if(c.isOpen&&td.close!=null)txt="Avoinna nyt · tänään klo "+t(td.open)+"–"+t(td.close);
  else if(td.open!=null&&c.now<td.open)txt="Aukeaa tänään klo "+t(td.open);
  else{const i=(c.days||[]).findIndex((d,k)=>k>0&&d.open!=null);if(i>0)txt="Aukeaa "+(i===1?"huomenna":dLabel(c.days[i].date,i).toLowerCase())+" klo "+t(c.days[i].open)}
  H.textContent=txt||"Tilaukset myös puhelimitse 045 353 7000";
  D.textContent=c.delivery?`Nouto tai kotiinkuljetus ${eur(c.fee||0)} · vähimmäistilaus ${eur(c.min||0)}`:"Nouto: Tampereentie 414, Lempäälä";
  P.hidden=!(c.on&&!c.isOpen&&c.preDays>0)}
async function load(){
  try{CFG=await call({action:"order_cfg"})}catch(e){CFG={on:false,isOpen:false,delivery:false,fee:0,min:0}}
  const st=$("#odState"),note=$("#odNote");
  if(!CFG.on){st.textContent="Nettitilaus avautuu pian";note.hidden=false;note.className="od-note bad";note.innerHTML='Nettitilaus ei ole juuri nyt käytössä. Tilaa soittamalla <a href="tel:+358453537000">045 353 7000</a>.'}
  else if(CFG.paused){st.textContent="Tauolla hetken";note.hidden=false;note.className="od-note";note.innerHTML=`Nettitilaus on hetken tauolla${CFG.pauseUntil?" klo "+new Date(CFG.pauseUntil).toLocaleTimeString("fi-FI",{timeZone:"Europe/Helsinki",hour:"2-digit",minute:"2-digit"})+" asti":""}. Voit tehdä <b>ennakkotilauksen</b> tai soittaa <a href="tel:+358453537000">045 353 7000</a>.`}
  else if(!CFG.isOpen){st.textContent=CFG.preDays>0?"Kiinni nyt · ennakkotilaus auki":"Kiinni juuri nyt";note.hidden=false;note.className="od-note bad";note.className="od-note";note.innerHTML=CFG.open!=null&&CFG.now<CFG.open?`Avaamme tänään klo ${clock(CFG.open).replace(":",".")}. Voit jo nyt tehdä <b>ennakkotilauksen</b> – valitse aika alta.`:"Olemme tältä päivältä kiinni. Voit tehdä <b>ennakkotilauksen</b> huomiselle – valitse aika alta."}
  else{st.textContent=CFG.delNow?"Nouto ja kotiinkuljetus":"Nouto";if(CFG.note){note.hidden=false;note.className="od-note";note.textContent=CFG.note}}
  hdr();
  const d=$('input[name="kind"][value="kuljetus"]');d.disabled=!CFG.delivery;$("#odDelLab").title=CFG.delivery?"":"Kotiinkuljetus ei ole juuri nyt käytössä";
  if(!CFG.delivery)$('input[name="kind"][value="nouto"]').checked=true;
  const me=ls.get("mk_me")||{};["n","p","e","a","apt","door","z","ci"].forEach(k=>{const i=$("#odForm [name="+k+"]");if(i&&me[k])i.value=me[k]});
  const pr=$("#odPromo");if(pr&&CFG.firstPct>0){pr.hidden=false;pr.querySelector("b").textContent="−"+CFG.firstPct+" %"}
  const lt=$("#odLoyT");if(lt){const on=CFG.loyEvery>0&&CFG.loyPct>0;lt.textContent=on?"joka "+CFG.loyEvery+". tilaus −"+CFG.loyPct+" %":"";if(!on)lt.parentNode.innerHTML="Uusi asiakas? Ensimmäisestä nettitilauksesta alennus koko tilauksesta – lasketaan automaattisesti kassalla."}
  marks();kindUi();checkFirst()}
// ---------- Sähköpostin vahvistus (kerran per sähköposti/laite)
let VC="";
function codeAsk(email,msg){return new Promise(res=>{const w=document.createElement("div");w.className="od-modal";w.setAttribute("role","dialog");
  w.innerHTML=`<div class="od-mbox od-vbox"><h3>Vahvista sähköposti</h3><p class="od-small" style="font-size:.95rem">Lähetimme 6-numeroisen koodin osoitteeseen <b>${esc(email)}</b>. Kirjoita se tähän. Tarkista tarvittaessa roskaposti.</p>${msg?`<p class="od-verr">${esc(msg)}</p>`:""}<input class="od-vcode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••"><div class="od-mf"><button type="button" class="btn" data-x>Peruuta</button><button type="button" class="btn r" data-ok>Vahvista ja tilaa</button></div><button type="button" class="od-vre" data-re>Lähetä koodi uudelleen</button></div>`;
  document.body.append(w);const inp=w.querySelector("input");setTimeout(()=>inp.focus(),50);
  const done=v=>{w.remove();res(v)};w.querySelector("[data-x]").onclick=()=>done(null);
  w.querySelector("[data-ok]").onclick=()=>{const v=inp.value.replace(/\D/g,"");if(v.length===6)done(v);else inp.focus()};
  inp.oninput=()=>{inp.value=inp.value.replace(/\D/g,"").slice(0,6);if(inp.value.length===6)done(inp.value)};
  w.querySelector("[data-re]").onclick=()=>done("RESEND")})}
$("#odForm").onsubmit=async e=>{e.preventDefault();const f=e.target,send=$("#odSend");
  if(!f.reportValidity())return;
  const v=k=>f.elements[k].value.trim(),k=kind();
  if(k==="kuljetus"){if(!/\d/.test(v("a"))){alert("Lisää katuosoitteeseen talon numero.");f.elements.a.focus();return}if(!/^\d{5}$/.test(v("z"))){alert("Tarkista postinumero (5 numeroa).");f.elements.z.focus();return}}
  ls.set("mk_me",{n:v("n"),p:v("p"),e:v("e"),a:v("a"),apt:v("apt"),door:v("door"),z:v("z"),ci:v("ci")});
  send.disabled=true;send.textContent="Lähetetään…";clearTimeout(fT);await checkFirst();if(RWSEL&&SBC){try{const{data:{session}}=await SBC.auth.getSession();if(session)BON.at=session.access_token}catch(e){}}const T0=totals();send.disabled=true;send.textContent="Lähetetään…";
  try{const r=await call({action:"order",kind:k,n:v("n"),p:v("p"),e:v("e"),a:v("a"),apt:v("apt"),door:v("door"),dn:v("dn"),z:v("z"),ci:v("ci"),m:v("m"),w:v("w"),website:f.elements.website.value,vt:(ls.get("mk_vt")||{})[v("e").toLowerCase()]||"",vc:VC,cp:T0.rw?T0.rw.id:"",at:T0.rw?BON.at:"",pay:($('input[name="pay"]:checked')||{}).value||"kortti",total:T0.t,
      items:cart.map(x=>({c:x.c,n:x.n,s:x.s,o:x.o,t:x.t,tx:x.tx,x:x.x,meal:x.meal,l:x.l,pt:x.pt,d:x.d,dr:x.dr,hot:x.hot,sp:x.sp,q:x.q,m:x.m}))});
    VC="";if(r.vt){const t=ls.get("mk_vt")||{};t[v("e").toLowerCase()]=r.vt;ls.set("mk_vt",t)}
    $("#odDoneT").innerHTML=`Tilausnumerosi on <b>#${r.no}</b>.${r.discount?" Sait alennusta "+eur(r.discount)+".":""} Lähetimme vahvistuksen osoitteeseen ${esc(v("e"))}.${r.earn?(BON.pts==null?" Tästä tilauksesta kertyy <b>+"+r.earn+" bonuspistettä</b> – <a href=\"tili.html\" style=\"color:#E3A51C;font-weight:700\">luo tili samalla sähköpostilla</a>, niin näet ja voit käyttää ne.":" Saat tilauksesta <b>+"+r.earn+" bonuspistettä</b>, kun se on luovutettu."):""}<br><br>Saat toisen viestin, kun olemme hyväksyneet tilauksen ja ${k==="kuljetus"?"arvioineet toimitusajan":"tiedämme valmistumisajan"}. Kiireellisissä asioissa soita 045 353 7000.`;
    try{const im=x=>{const f=IMG[x.c==="Päivän pizza"?x.n:x.n]||(x.c==="Wings"?"wings":"");return f?T+(f.includes(".")?f:f+".webp"):""};ls.set("mk_last",{no:r.no,date:new Date().toISOString(),total:r.total,name:v("n").split(" ")[0],items:cart.filter(x=>x.c!=="Päivän pizza").map(x=>({...x,img:im(x)}))})}catch(e){}
    if(T0.rw)BON.cps=BON.cps.filter(c=>c.id!==T0.rw.id);RWSEL=null;cart=[];save();draw();$("#odCart").classList.remove("open");$("#odDone").hidden=false}
  catch(x){if(x.j&&x.j.need){
      if(x.j.need==="verify"||VC==="RESEND"){try{await call({action:"verify_send",e:v("e"),p:v("p")})}catch(y){VC="";alert(y.message);draw();return}}
      const c=await codeAsk(v("e"),x.j.need==="code"||VC?x.j.error:"");if(!c){VC="";draw();return}
      VC=c;if(c==="RESEND"){VC="RESEND";try{await call({action:"verify_send",e:v("e"),p:v("p")})}catch(y){alert(y.message)}const c2=await codeAsk(v("e"),"Uusi koodi lähetetty.");if(!c2){VC="";draw();return}VC=c2==="RESEND"?"":c2}
      return f.requestSubmit?f.requestSubmit():f.dispatchEvent(new Event("submit",{cancelable:true}))}
    if(x.j&&x.j.total){await checkFirst();alert("Hinta päivittyi: "+eur(x.j.total)+". Tarkista summa ja lähetä uudelleen.")}else alert(x.message);draw()}};

menu();draw();load();bonusLoad();
{const q=new URLSearchParams(location.search).get("tarjous");if(q&&offOf(q))setTimeout(()=>open("Tarjous",q),300)}
setInterval(()=>{if(document.visibilityState==="visible")load()},120000);
})();
