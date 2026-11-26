// Malakai: Tarjoukset-sivu (sovellustyylinen)
(function(){
"use strict";
const $=s=>document.querySelector(s),S=window.SITE||{},TZ="Europe/Helsinki";
const esc=t=>String(t??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const eur=n=>Number(n||0).toFixed(2).replace(".",",")+" €";
const today=new Intl.DateTimeFormat("en-CA",{timeZone:TZ}).format(new Date());
const dk=["su","ma","ti","ke","to","pe","la"][new Date(today+"T12:00:00").getDay()];
const DN={ma:"Ma",ti:"Ti",ke:"Ke",to:"To",pe:"Pe",la:"La",su:"Su"};
const pd=d=>d?(+d.slice(8))+"."+(+d.slice(5,7))+".":"";
const IMG={"Tropicana":"tropicana","Kebab Pizza":"kebab","Mexicana":"mexicana","Americano":"americano","Mamma Mia":"mammamia","Julia":"julia","Opera Special":"opera","Barbeque":"bbq","Margarita Mozzarella":"margarita","Finlandia":"finlandia","Tonnikala Pizza":"tonnikala"};
const card=o=>`<a class="tf-c${o.cls?" "+o.cls:""}" href="${o.href}"><div class="tf-im">${o.img?`<img src="${o.img}" alt="" loading="lazy">`:o.art||""}${o.badge?`<span class="tf-b">${o.badge}</span>`:""}</div>
  <div class="tf-tx"><h3>${esc(o.t)}</h3>${o.was?`<s>${esc(o.was)}</s>`:""}<div class="tf-tag"><span>${esc(o.tag)}</span><i>M</i></div><b class="tf-p">${o.p}</b>${o.d?`<p>${esc(o.d)}</p>`:""}<span class="tf-dt">${esc(o.dt)}</span></div></a>`;
const L=[];
(S.offers||[]).filter(o=>o.on&&(!o.from||o.from<=today)&&(!o.until||o.until>=today)).forEach(o=>L.push({t:o.title,img:"media/tilaa/tarjous-3-pizzaa.webp?v=16",tag:"Nettitilauksena",p:esc(o.price),was:o.was,d:o.text,dt:"Voimassa "+(o.from?pd(o.from)+"–":"")+pd(o.until),href:"tilaa.html?tarjous="+encodeURIComponent(o.title)+"#tarjoukset",badge:"Tarjous"}));
const dp=(S.daily||{})[dk];
if(dp&&dp.name)L.push({t:"Päivän pizza: "+dp.name,img:IMG[dp.name]?"media/tilaa/"+IMG[dp.name]+".webp?v=16":dp.img,tag:"Vain tänään",p:eur(S.dailyPrice),d:"Joka päivä eri pizza erikoishintaan.",dt:"Tänään "+pd(today),href:"tilaa.html#paivan-pizza",badge:"Päivän pizza"});
L.push({t:"Ensimmäinen nettitilaus",art:'<div class="tf-art"><b>−20%</b><small>KOKO TILAUKSESTA</small></div>',tag:"Uudelle asiakkaalle",p:"−20 %",d:"Alennus lasketaan kassalla automaattisesti.",dt:"Aina voimassa",href:"tilaa.html"});
L.push({t:"Bonuskupongit",art:'<div class="tf-art y"><b>−25 €</b><small>300 PISTEELLÄ</small></div>',tag:"Oma tili",p:"1 € = 1 p",d:"50 p = −1 € … 300 p = −25 €. Kupongit omalle tilille.",dt:"Kierros alkaa alusta 300 p jälkeen",href:"kupongit.html"});
const wk=Object.keys(DN).filter(k=>(S.daily||{})[k]&&S.daily[k].name);
$("#tfMain").innerHTML=`<p class="tf-n">${L.length} tarjousta</p><div class="tf-g">${L.map(card).join("")}</div>`+
  (wk.length?`<section class="tf-wk"><h2>Päivän pizzat tällä viikolla · ${eur(S.dailyPrice)}</h2><ul>${wk.map(k=>`<li class="${k===dk?"on":""}"><b>${DN[k]}</b><span>${esc(S.daily[k].name)}</span></li>`).join("")}</ul></section>`:"");
})();
