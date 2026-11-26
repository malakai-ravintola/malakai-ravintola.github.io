// Malakai: Kuponkini-sivu – bonuskupongit omalta tililtä
(function(){
"use strict";
const $=s=>document.querySelector(s),C=window.MALAKAI||{},M=$("#kpMain");
const eur=n=>Number(n||0).toFixed(2).replace(".",",")+" €",e0=n=>typeof n==="string"?n:(+n%1?eur(n):(+n)+" €");
const T=[{p:50,e:1},{p:90,e:2},{p:120,e:4},{p:150,e:10},{p:200,e:15},{p:250,e:20},{p:300,e:25}],R=300;
const GIFT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M2.5 9h19v3.5h-19zM12 9v11M12 9c-1.5-3.5-5.5-4-5.5-1.5S10 9 12 9zm0 0c1.5-3.5 5.5-4 5.5-1.5S14 9 12 9z"/></svg>';
const ticket=(k,st)=>`<div class="kp-t ${st}"><div class="kp-l"><span class="kp-pill">${st==="lock"?"Tulossa":"Bonuskuponki"}</span><span class="kp-g">${GIFT}</span><b>−${e0(k.eur)}</b></div>
  <div class="kp-r"><span class="kp-y">−${e0(k.eur)}</span><small>alennus</small><h3>${st==="first"?"Ensimmäinen nettitilaus":"Bonuskuponki"}</h3><p>${k.note}</p>
  ${st==="avail"?`<a class="kp-btn" href="tilaa.html" data-cp="${k.id}">Käytä tilauksessa</a>`:st==="used"?`<span class="kp-st">Käytetty</span>`:st==="first"?`<a class="kp-btn" href="tilaa.html">Tilaa nyt</a>`:`<span class="kp-st">Vielä ${k.left} p</span>`}</div></div>`;
M.addEventListener("click",e=>{const a=e.target.closest("[data-cp]");if(a)try{localStorage.setItem("mk_cp",a.dataset.cp)}catch(_){}});
async function run(){
  if(!C.url||!window.supabase){M.innerHTML='<p class="ac-mut">Kuponkipalvelu ei latautunut. Päivitä sivu.</p>';return}
  const SB=supabase.createClient(C.url,C.anon);const{data:{session}}=await SB.auth.getSession();
  if(!session){M.innerHTML=`<div class="kp-in"><span class="kp-g">${GIFT}</span><h2>Kerää bonuskuponkeja</h2><p>Saat 1 pisteen jokaisesta nettitilauksen eurosta. Jo 50 pisteellä saat −1 € kupongin ja 300 pisteellä −25 €.</p><a class="kp-btn" href="tili.html">Kirjaudu tai luo tili</a></div>`+
    `<h2 class="kp-h">Kaikki kupongit</h2>`+T.map(t=>ticket({eur:t.e,note:`Kun pisteitä on vähintään ${t.p}`,left:t.p},"lock")).join("")+ticket({eur:"20 %",note:"−20 % koko tilauksesta, lasketaan kassalla automaattisesti."},"first").replace("−20 % €","−20 %");return}
  const em=String(session.user.email||"").toLowerCase();
  const[c,k]=await Promise.all([SB.from("customers").select("points,orders").eq("email",em).maybeSingle(),SB.from("bonus_coupons").select("id,round,tier,eur,used_at").eq("email",em).order("created_at",{ascending:false})]);
  const pts=+(c.data&&c.data.points)||0,K=(k.data||[]).map(x=>({...x,eur:+x.eur})),av=K.filter(x=>!x.used_at),used=K.filter(x=>x.used_at);
  const rn=pts>0?Math.floor((pts-1)/R)+1:1,q=pts-(rn-1)*R,nx=T.find(t=>t.p>q),left=nx?nx.p-q:R-q+T[0].p,nxe=nx?nx.e:T[0].e;
  const first=!(c.data&&c.data.orders>0);
  M.innerHTML=`<p class="kp-cnt">Käytettävissä <b>${av.length+(first?1:0)}</b> kuponkia</p>
   <a class="kp-sum" href="tili.html#bonus"><div><small>Bonuspisteesi</small><b>${q} p</b><span>Seuraava kuponki −${nxe} € · vielä ${left} p</span></div><i class="kp-bar"><em style="width:${Math.min(100,q/R*100)}%"></em></i><u>Lisätietoja ›</u></a>`+
   (first?ticket({eur:"20 %",note:"−20 % koko ensimmäisestä nettitilauksesta. Lasketaan kassalla automaattisesti."},"first").replace("−20 % €","−20 %"):"")+
   av.map(x=>ticket({...x,note:`Nettitilaukseen, kun tilaus on vähintään ${eur(x.eur*2)}`},"avail")).join("")+
   (nx||true?ticket({eur:nxe,note:`Ansaitset tämän, kun pisteitä kertyy vielä ${left}`,left},"lock"):"")+
   (used.length?`<h2 class="kp-h">Käytetyt</h2>`+used.slice(0,10).map(x=>ticket({...x,note:"Käytetty nettitilauksessa"},"used")).join(""):"");
}
run().catch(()=>{M.innerHTML='<p class="ac-mut">Kuponkeja ei voitu ladata. Päivitä sivu.</p>'});
})();
