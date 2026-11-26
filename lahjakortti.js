// Malakai: lahjakortin osto (Stripe) – lahjakortti lähetetään sähköpostiin ostajalle tai lahjan saajalle
(function(){
"use strict";
const $=s=>document.querySelector(s),C=window.MALAKAI||{};
const eur=n=>Number(n||0).toFixed(2).replace(".",",")+" €",esc=t=>String(t??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
async function call(body){let r=null;for(const n of window.__PFN?[window.__PFN]:["public","Public"]){try{r=await fetch(C.url+"/functions/v1/"+n,{method:"POST",headers:{"Content-Type":"application/json",apikey:C.anon,Authorization:"Bearer "+C.anon},body:JSON.stringify(body)})}catch(e){r=null;continue}if(r.status!==404){window.__PFN=n;break}}
  if(!r)throw new Error("Yhteys ei toimi. Tarkista netti tai soita 045 353 7000.");const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||"Virhe "+r.status);return j}
const F=$("#gcForm");let AMT=50;
const mode=()=>(F.querySelector('input[name="mode"]:checked')||{}).value||"self";
function upd(){const oth=$("#gcChips .on")?.dataset.a==="muu";$("#gcOther").hidden=!oth;if(oth)AMT=Math.round(+$("#gcOA").value||0);
  const g=mode()==="gift";$("#gcGift").hidden=!g;F.elements.re.required=g;
  $("#gcAmt").textContent=AMT?AMT+" €":"– €";const rn=F.elements.rn.value.trim(),msg=F.elements.msg.value.trim();
  $("#gcFor").textContent=g&&rn?"Lahjaksi: "+rn:"Malakai Ravintola · Lempäälä";const m=$("#gcMsg");m.hidden=!(g&&msg);m.textContent=msg?"“"+msg+"”":"";
  $("#gcRcpt").textContent=g?"Saat kuitin tähän osoitteeseen. Lahjakortti lähetetään lahjan saajalle.":"Lahjakortti ja kuitti lähetetään tähän osoitteeseen.";
  const ok=AMT>=10&&AMT<=300;$("#gcSend").disabled=!ok;$("#gcSend").textContent=ok?"Siirry maksamaan · "+eur(AMT):"Valitse summa 10–300 €"}
$("#gcChips").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;document.querySelectorAll("#gcChips button").forEach(x=>x.classList.toggle("on",x===b));if(b.dataset.a!=="muu")AMT=+b.dataset.a;else setTimeout(()=>$("#gcOA").focus(),50);upd()});
F.addEventListener("input",upd);F.addEventListener("change",upd);
const err=t=>{const e=$("#gcErr");e.hidden=!t;e.textContent=t||""};
F.onsubmit=async e=>{e.preventDefault();err("");if(!F.reportValidity())return;const v=k=>F.elements[k].value.trim(),b=$("#gcSend");b.disabled=true;b.textContent="Avataan maksua…";
  try{const r=await call({action:"gift_buy",amount:AMT,mode:mode(),n:v("n"),e:v("e"),rn:v("rn"),re:v("re"),msg:v("msg")});try{localStorage.setItem("mk_gift",JSON.stringify({g:r.g,a:AMT}))}catch(_){}location.href=r.pay_url}
  catch(x){err(x.message);upd()}};
async function back(){const q=new URLSearchParams(location.search),g=q.get("g"),m=q.get("maksu");if(!g||!m)return;history.replaceState(null,"","lahjakortti.html");
  if(m==="peruttu"){try{await call({action:"gift_cancel",g})}catch(_){}err("Maksu keskeytyi, joten lahjakorttia ei ostettu. Voit yrittää uudelleen.");return}
  const D=$("#gcDone");$("#gcMain").hidden=true;D.hidden=false;D.innerHTML='<div class="gc-ok"><h2>Tarkistetaan maksua…</h2></div>';
  let r=null;for(let i=0;i<12;i++){try{r=await call({action:"gift_status",g})}catch(_){}if(r&&r.status!=="maksu")break;await new Promise(z=>setTimeout(z,1500))}
  if(r&&(r.status==="aktiivinen"||r.status==="kaytetty"))D.innerHTML=`<div class="gc-ok"><div class="gc-ic">✓</div><h2>Kiitos! Lahjakortti on matkalla</h2><p>${r.gift?`Lähetimme ${eur(r.amount)} lahjakortin osoitteeseen <b>${esc(r.to)}</b>. Saat kuitin omaan sähköpostiisi.`:`Lähetimme ${eur(r.amount)} lahjakortin osoitteeseen <b>${esc(r.to)}</b>.`}</p><p class="gc-small">Viesti saapuu yleensä minuutin sisällä – tarkista tarvittaessa roskaposti.</p><div class="gc-row"><a class="btn r" href="tilaa.html">Tilaa ruokaa</a><a class="btn" href="lahjakortti.html">Osta toinen lahjakortti</a></div></div>`;
  else D.innerHTML=`<div class="gc-ok"><h2>Maksu käsittelyssä</h2><p>Lahjakortti lähetetään sähköpostiin heti, kun maksu on vahvistunut. Älä osta uudelleen – soita tarvittaessa 045 353 7000.</p></div>`}
upd();back();
})();
