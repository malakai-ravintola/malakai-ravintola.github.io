// Malakai: asiakkaan oma tili. Jokainen näkee vain omat tilauksensa (tietokannan RLS-säännöt).
(function(){
"use strict";
const $=s=>document.querySelector(s),C=window.MALAKAI||{},S=window.SITE||{},TZ="Europe/Helsinki";
const mk=(t,a,...k)=>{const e=document.createElement(t);if(a)for(const[x,v]of Object.entries(a)){if(x==="class")e.className=v;else if(x==="text")e.textContent=v;else if(x==="html")e.innerHTML=v;else if(x.startsWith("on"))e[x]=v;else if(v!==false&&v!=null)e.setAttribute(x,v===true?"":v)}k.flat().forEach(c=>c!=null&&c!==false&&e.append(c));return e};
const eur=n=>Number(n||0).toFixed(2).replace(".",",")+" €";
const fdt=d=>new Date(d).toLocaleDateString("fi-FI",{timeZone:TZ,day:"numeric",month:"numeric",year:"numeric"});
const hm=d=>new Date(d).toLocaleTimeString("fi-FI",{timeZone:TZ,hour:"2-digit",minute:"2-digit"}).replace(":",".");
let tT;const toast=(t,bad)=>{const e=$("#acToast");e.textContent=t;e.className="ac-toast"+(bad?" bad":"");e.hidden=false;clearTimeout(tT);tT=setTimeout(()=>e.hidden=true,bad?6000:3200)};
const ls={get:k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let M=$("#acMain"),HERE=location.origin+location.pathname;
const FI={"Invalid login credentials":"Väärä sähköposti tai salasana.","Email not confirmed":"Vahvista ensin sähköpostiosoitteesi – avaa saamasi vahvistusviesti.","User already registered":"Tällä sähköpostilla on jo tili. Kirjaudu sisään tai palauta salasana.","Password should be at least 6 characters.":"Salasanan pitää olla vähintään 8 merkkiä."};
const fi=e=>FI[e?.message]||(/rate limit/i.test(e?.message||"")?"Liian monta yritystä. Odota hetki ja yritä uudelleen.":(e?.message||"Jokin meni vikaan. Yritä uudelleen."));
if(!C.url||!window.supabase){M.textContent="";M.append(mk("p",{class:"ac-mut",text:"Tilipalvelu ei latautunut. Tarkista nettiyhteys ja päivitä sivu."}));return}
const SB=supabase.createClient(C.url,C.anon);
const MYE=()=>String((USER&&USER.email)||"").toLowerCase();
let USER=null,ORD=null,CFG=null,CUS=null,mode="in",poll=null,recovery=/type=recovery/.test(location.hash);

async function pub(body){const r=await fetch(C.url+"/functions/v1/Public",{method:"POST",headers:{"Content-Type":"application/json",apikey:C.anon,Authorization:"Bearer "+C.anon},body:JSON.stringify(body)});return r.json()}
SB.auth.onAuthStateChange((ev,s)=>{if(ev==="PASSWORD_RECOVERY"){recovery=true;USER=s?.user||null;return render()}
  if(ev==="SIGNED_IN"&&!USER){USER=s.user;load()}if(ev==="SIGNED_OUT"){USER=null;ORD=null;render()}});
SB.auth.getSession().then(({data})=>{USER=data.session?.user||null;if(USER&&!recovery)load();else render()});

async function load(){
  const [o,c,g]=await Promise.all([SB.from("orders").select("id,no,created_at,kind,want,items,subtotal,fee,discount,discount_note,total,status,eta,reason,pay,address,zip,city,rating").eq("email",MYE()).order("created_at",{ascending:false}).limit(60),
    SB.from("customers").select("orders,spent,first_order,points").eq("email",MYE()).maybeSingle(),pub({action:"order_cfg"}).catch(()=>null)]);
  ORD=o.error?[]:(o.data||[]).filter(x=>x.status!=="maksu");CUS=c.data||null;CFG=g||CFG||{};
  try{const bc=await SB.from("bonus_coupons").select("id,round,tier,eur,used_at,used_order").eq("email",MYE()).order("round").order("tier");BCP=bc.error?[]:bc.data.map(k=>({...k,eur:+k.eur}))}catch(e){BCP=[]}
  try{const bl=await SB.from("bonus_log").select("delta,note,created_at").eq("email",MYE()).order("created_at",{ascending:false}).limit(30);BLOG=bl.error?[]:bl.data}catch(e){BLOG=[]}
  const me=USER.user_metadata||{};ls.set("mk_me",{...(ls.get("mk_me")||{}),n:me.name||"",p:me.phone||"",e:USER.email,a:me.address||"",apt:me.apt||"",door:me.door||"",z:me.zip||"",ci:me.city||"Lempäälä"});
  try{const last=ORD.find(o=>o.status!=="peruttu"&&(o.items||[]).some(i=>i.c!=="Päivän pizza"));if(last)ls.set("mk_last",{no:last.no,date:last.created_at,total:last.total,name:(USER.user_metadata?.name||"").split(" ")[0],items:(last.items||[]).filter(i=>i.c!=="Päivän pizza").map(i=>({...toCart(i),img:IMGF(i.n,i.c)}))});else localStorage.removeItem("mk_last")}catch(e){}
  render();clearInterval(poll);poll=setInterval(async()=>{if(document.hidden||!USER)return;const r=await SB.from("orders").select("id,status,eta,reason").eq("email",MYE()).in("status",["uusi","hyvaksytty","valmis"]);
    const open=(ORD||[]).filter(x=>["uusi","hyvaksytty","valmis"].includes(x.status));if(!open.length&&!(r.data||[]).length)return;
    const fresh=await SB.from("orders").select("id,no,created_at,kind,want,items,subtotal,fee,discount,discount_note,total,status,eta,reason,pay,address,zip,city,rating").eq("email",MYE()).order("created_at",{ascending:false}).limit(60);if(!fresh.error){ORD=fresh.data;render()}},20000)}

// ---------- Näkymät
function render(){M.textContent="";
  if(recovery)return vReset();
  if(!USER){$("#acH").innerHTML="Oma <em>tili</em>";$("#acSub").textContent="Kirjaudu nähdäksesi tilauksesi, leimakorttisi ja etusi.";return vAuth()}
  const nm=(USER.user_metadata?.name||USER.email.split("@")[0]).split(" ")[0];
  $("#acH").innerHTML="Hei <em></em>!";$("#acH em").textContent=nm;$("#acSub").textContent="Tervetuloa takaisin – täältä näet tilauksesi ja etusi.";
  if(ORD===null){M.append(mk("p",{class:"ac-mut",text:"Ladataan tilauksia…"}));return}
  vHub();if(location.hash==="#bonus"&&!document.querySelector(".bd-ov"))bDetails();else if(SUBS[location.hash.slice(1)]&&!document.querySelector(".bd-ov"))SUBS[location.hash.slice(1)]()}

function vAuth(){const box=mk("div",{class:"ac-card ac-auth"});
  const tabs=mk("div",{class:"ac-tabs",role:"tablist"},mk("button",{class:mode==="in"?"on":"",text:"Kirjaudu",onclick:()=>{mode="in";render()}}),mk("button",{class:mode==="up"?"on":"",text:"Luo tili",onclick:()=>{mode="up";render()}}));
  box.append(tabs);
  const em=mk("input",{type:"email",autocomplete:"email",required:true,maxlength:120}),pw=mk("input",{type:"password",autocomplete:mode==="up"?"new-password":"current-password",required:true,minlength:8});
  if(mode==="forgot"){box.textContent="";const f=mk("form",null,mk("h2",{html:"Unohtuiko <em>salasana?</em>"}),mk("p",{class:"ac-mut",text:"Lähetämme sähköpostiisi linkin, jolla voit asettaa uuden salasanan."}),mk("label",null,"Sähköposti",em),mk("button",{class:"ac-btn w",text:"Lähetä linkki"}),mk("button",{type:"button",class:"ac-link",text:"← Takaisin kirjautumiseen",onclick:()=>{mode="in";render()}}));
    f.onsubmit=async e=>{e.preventDefault();const b=f.querySelector(".ac-btn");b.disabled=true;const {error}=await SB.auth.resetPasswordForEmail(em.value.trim(),{redirectTo:HERE});b.disabled=false;
      if(error)return toast(fi(error),true);f.replaceWith(mk("div",{class:"ac-msg",text:"Jos osoitteella on tili, saat hetken päästä sähköpostin, jossa on linkki uuden salasanan asettamiseen."}));};box.append(f);M.append(box);em.focus();return}
  const f=mk("form");
  if(mode==="up"){const nmI=mk("input",{autocomplete:"name",required:true,maxlength:80}),ok=mk("input",{type:"checkbox",required:true});
    f.append(mk("label",null,"Nimi",nmI),mk("label",null,"Sähköposti",em),mk("label",null,"Salasana (vähintään 8 merkkiä)",pw),
      mk("label",{class:"ck"},ok,mk("span",{html:'Hyväksyn <a href="tietosuoja.html#tili" target="_blank" rel="noopener">tietosuojaselosteen</a> ja <a href="kayttoehdot.html#tilaukset" target="_blank" rel="noopener">käyttöehdot</a>.'})),
      mk("button",{class:"ac-btn w",text:"Luo tili"}),mk("p",{class:"ac-mut",style:"font-size:.84rem;margin:12px 0 0",text:"Tilillä näet tilaushistorian, aktiiviset tilaukset, leimakortin ja edut. Aiemmat tilauksesi samalla sähköpostilla näkyvät heti."}));
    f.onsubmit=async e=>{e.preventDefault();if(pw.value.length<8)return toast("Salasanan pitää olla vähintään 8 merkkiä.",true);const b=f.querySelector(".ac-btn");b.disabled=true;
      const {data,error}=await SB.auth.signUp({email:em.value.trim(),password:pw.value,options:{data:{name:nmI.value.trim()},emailRedirectTo:HERE}});b.disabled=false;
      if(error)return toast(fi(error),true);
      if(data.session){USER=data.user;toast("Tili luotu – tervetuloa!");load()}
      else{box.textContent="";box.append(mk("h2",{html:"Vahvista <em>sähköpostisi</em>"}),mk("div",{class:"ac-msg",text:"Lähetimme vahvistuslinkin osoitteeseen "+em.value.trim()+". Avaa viesti ja paina linkkiä, niin pääset tilillesi. Tarkista myös roskaposti."}),mk("button",{class:"ac-link",text:"Takaisin kirjautumiseen",onclick:()=>{mode="in";render()}}))}}}
  else{f.append(mk("label",null,"Sähköposti",em),mk("label",null,"Salasana",pw),mk("button",{class:"ac-btn w",text:"Kirjaudu"}),mk("button",{type:"button",class:"ac-link",text:"Unohtuiko salasana?",onclick:()=>{mode="forgot";render()}}));
    f.onsubmit=async e=>{e.preventDefault();const b=f.querySelector(".ac-btn");b.disabled=true;const {data,error}=await SB.auth.signInWithPassword({email:em.value.trim(),password:pw.value});b.disabled=false;
      if(error){pw.value="";return toast(fi(error),true)}USER=data.user;load()}}
  box.append(f);M.append(box,mk("p",{class:"ac-mut",style:"font-size:.86rem",html:'Voit tilata myös ilman tiliä: <a href="tilaa.html" style="color:var(--ay)">Tilaa netistä →</a>'}));(mode==="up"?f.querySelector("input"):em).focus()}

function vReset(){$("#acH").innerHTML="Uusi <em>salasana</em>";$("#acSub").textContent="Kirjoita uusi salasana tilillesi.";
  const pw=mk("input",{type:"password",autocomplete:"new-password",required:true,minlength:8}),f=mk("form",{class:"ac-card ac-auth"},mk("label",null,"Uusi salasana (vähintään 8 merkkiä)",pw),mk("button",{class:"ac-btn w",text:"Tallenna salasana"}));
  f.onsubmit=async e=>{e.preventDefault();if(pw.value.length<8)return toast("Salasanan pitää olla vähintään 8 merkkiä.",true);const {data,error}=await SB.auth.updateUser({password:pw.value});if(error)return toast(fi(error),true);
    recovery=false;history.replaceState(null,"",HERE);toast("Salasana vaihdettu");USER=data.user;load()};M.append(f);pw.focus()}

function vTop(){const nm=USER.user_metadata?.name||"";const ini=(nm||USER.email).split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();
  M.append(mk("div",{class:"ac-card ac-top"},mk("span",{class:"ac-av",text:ini}),mk("div",null,mk("b",{text:nm||USER.email}),mk("small",{text:USER.email+(CUS?.first_order?" · asiakkaana "+fdt(CUS.first_order)+" alkaen":"")})),
    mk("div",{class:"ac-quick"},mk("a",{class:"ac-btn",href:"tilaa.html",text:"Tilaa nyt"}),mk("button",{class:"ac-btn o",text:"Kirjaudu ulos",onclick:async()=>{clearInterval(poll);try{localStorage.removeItem("mk_last")}catch(e){}await SB.auth.signOut({scope:"local"});toast("Kirjauduit ulos")}}))))}

const STEP={uusi:0,hyvaksytty:1,valmis:2,luovutettu:3};
function vLive(){const act=ORD.filter(o=>["uusi","hyvaksytty","valmis"].includes(o.status));
  act.forEach(o=>{const del=o.kind==="kuljetus",st=STEP[o.status];
    const lbl=[["Vastaanotettu"],["Hyväksytty"],[del?"Matkalla":"Valmis"],[del?"Perillä":"Noudettu"]];
    const head={uusi:"Odottaa ravintolan hyväksyntää",hyvaksytty:del?"Valmistetaan – toimitus":"Valmistetaan – valmis noudettavaksi",valmis:del?"Ruoka on matkalla!":"Tilauksesi on valmis noudettavaksi!"}[o.status];
    M.append(mk("div",{class:"ac-card ac-live"},mk("h3",null,"Tilaus #"+o.no,mk("span",{class:"ac-pill y",text:del?"KULJETUS":"NOUTO"})),mk("div",{class:"ac-mut",text:head}),
      o.eta?mk("div",{class:"eta",text:(o.status==="valmis"&&!del?"Valmis ":"Arvio klo ")+o.eta.replace(":",".")}):mk("div",{class:"ac-mut",style:"margin-top:6px",text:"Saat sähköpostin, kun tilaus on hyväksytty."}),
      mk("div",{class:"ac-steps"},lbl.map((l,i)=>mk("div",{class:i<=st?"on":""},mk("i"),l[0]))),
      mk("div",{class:"ac-mut",style:"font-size:.86rem",text:(o.items||[]).map(i=>i.q+" × "+i.n).join(", ")+" · "+eur(o.total)}),
      mk("div",{class:"ac-mut",style:"font-size:.84rem;margin-top:6px",html:'Kysyttävää? Soita <a href="tel:+358453537000" style="color:var(--ay)">045 353 7000</a>'})))})}

let BLOG=[],BCP=[];
const GIFT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M2.5 9h19v3.5h-19zM12 9v11M12 9c-1.5-3.5-5.5-4-5.5-1.5S10 9 12 9zm0 0c1.5-3.5 5.5-4 5.5-1.5S14 9 12 9z"/></svg>';
const CHK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function bRules(){const B=CFG&&CFG.bonus;return B&&B.tiers?B:{rate:1,round:300,tiers:[{p:50,e:1},{p:90,e:2},{p:120,e:4},{p:150,e:10},{p:200,e:15},{p:250,e:20},{p:300,e:25}],minMul:2}}
function bState(){const B=bRules(),R=B.round||300,pts=+(CUS&&CUS.points)||0,rn=pts>0?Math.floor((pts-1)/R)+1:1,q=pts-(rn-1)*R;
  const tiers=B.tiers.map(x=>{const c=BCP.find(k=>k.round===rn&&k.tier===x.p);return{...x,st:c?(c.used_at?"used":"avail"):(q>=x.p?"avail":"lock"),c}});
  const nx=tiers.find(x=>x.p>q)||null,avail=BCP.filter(k=>!k.used_at).sort((a,b)=>b.eur-a.eur);
  return{B,R,pts,rn,q,tiers,nx,avail,left:nx?nx.p-q:R-q+B.tiers[0].p,nxe:nx?nx.e:B.tiers[0].e}}
function bBar(S){const w=mk("div",{class:"bb"}),pct=Math.min(100,S.q/S.R*100);
  w.append(mk("div",{class:"bb-tr"},mk("i",{style:`width:${pct}%`})));
  w.append(mk("div",{class:"bb-tip",style:`left:${Math.max(6,Math.min(94,pct))}%`,text:S.q+" p"}));
  let lastL=-99;S.tiers.forEach(x=>{const l=x.p/S.R*100;w.append(mk("span",{class:"bb-n "+x.st,style:`left:${l}%`,html:x.st==="lock"?GIFT:CHK,title:`−${x.e} € (${x.p} p)`}));
    if(x.st==="lock"&&l-lastL>=13){w.append(mk("small",{class:"bb-l",style:`left:${l}%`,text:x.p+" p"}));lastL=l}});
  return w}
function vStamps(){const S=bState();
  const c=mk("div",{class:"ac-card ac-bonus",id:"bonus"},
    mk("div",{class:"bk-h"},mk("h2",{html:"Bonus<em>kupongit</em>"}),mk("button",{class:"bk-more",type:"button",text:"Lisätietoja",onclick:bDetails})),
    bBar(S),
    mk("div",{class:"bk-next"},mk("div",null,mk("small",{text:"Seuraava palkinto"}),mk("b",{text:"Bonuskuponki"}),mk("span",{class:"bk-pill",text:"−"+S.nxe+" €"}),mk("p",{class:"ac-mut",text:`Vielä ${S.left} p · 1 € = 1 piste nettitilauksista`})),mk("span",{class:"bk-gift",html:GIFT})),
    S.avail.length?mk("div",{class:"bk-av"},mk("b",{text:"Käytettävissä olevat kupongit"}),mk("div",{class:"bk-cps"},S.avail.map(k=>mk("span",{class:"bk-cp",text:"−"+(+k.eur)+" €"}))),mk("a",{class:"ac-btn y",href:"tilaa.html",style:"margin-top:12px",text:"Käytä tilauksessa →"})):null);
  return c}
function bDetails(){const S=bState(),ov=mk("div",{class:"bd-ov",role:"dialog","aria-modal":"true","aria-label":"Bonuskupongit"});
  const close=()=>{ov.remove();document.body.style.overflow="";if(location.hash==="#bonus")history.replaceState(null,"",location.pathname)};
  const tierRow=x=>mk("div",{class:"bd-t "+x.st},mk("span",{class:"bd-i",html:x.st==="lock"?GIFT:CHK}),mk("div",null,mk("b",{text:`−${x.e} € Bonuskuponki`}),mk("p",{text:`Kun pisteitä on vähintään ${x.p}`}),x.st!=="lock"?mk("span",{class:"bd-badge "+x.st,text:x.st==="used"?"Käytetty":"Käytettävissä"}):null));
  const old=S.avail.filter(k=>k.round<S.rn);
  ov.append(mk("div",{class:"bd"},
    mk("div",{class:"bd-top"},mk("button",{class:"bd-back",type:"button","aria-label":"Takaisin",html:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',onclick:close}),mk("h2",{text:"Bonuskupongit"}),
      mk("div",{class:"bd-stats"},mk("div",{class:"bd-st"},mk("span",{html:GIFT}),mk("b",{text:S.left+" p"}),mk("small",{text:"Seuraavaan kuponkiin"})),mk("div",{class:"bd-st"},mk("span",{html:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 9.5h3.8a1.7 1.7 0 0 1 0 3.4h-2.6a1.7 1.7 0 0 0 0 3.4H14.5" stroke-linecap="round"/></svg>'}),mk("b",{text:S.q+" p"}),mk("small",{text:"Kertyneet"})))),
    mk("p",{class:"bd-round",text:`Kierros ${S.rn} · ${S.R} p:n jälkeen alkaa uusi kierros`}),
    mk("section",{class:"bd-sec"},mk("h3",{text:"Saldon kertyminen"}),bBar(S)),
    mk("section",{class:"bd-sec"},mk("h3",{text:"Bonuskupongit, jotka voit ansaita"}),S.tiers.map(tierRow)),
    old.length?mk("section",{class:"bd-sec"},mk("h3",{text:"Käyttämättömät kupongit aiemmilta kierroksilta"}),old.map(k=>mk("div",{class:"bd-t avail"},mk("span",{class:"bd-i",html:CHK}),mk("div",null,mk("b",{text:`−${+k.eur} € Bonuskuponki`}),mk("span",{class:"bd-badge avail",text:"Käytettävissä"}))))):null,
    mk("section",{class:"bd-sec"},mk("h3",{text:"Bonuskuponkien ehdot"}),mk("p",{class:"bd-txt",text:`Pisteet kertyvät vain nettitilauksista, ja kupongit voi käyttää vain nettitilauksiin – ei ravintolassa eikä muiden palveluiden kautta. Saat 1 pisteen jokaisesta maksetusta eurosta, kun nettitilauksesi on noudettu tai toimitettu. Kun kertyneet pisteet ylittävät rajan, saat kupongin omalle tilillesi: 50 p = −1 €, 90 p = −2 €, 120 p = −4 €, 150 p = −10 €, 200 p = −15 €, 250 p = −20 € ja 300 p = −25 €. ${S.R} pisteen jälkeen alkaa uusi kierros. Yhteen tilaukseen voi käyttää yhden kupongin, ja tilauksen on oltava vähintään kaksinkertainen kupongin arvoon nähden. Kupongin käyttö ei vähennä pisteitä. Perutusta tilauksesta kuponki palautuu. Kuponkeja ei voi vaihtaa rahaksi.`})),
    mk("section",{class:"bd-sec"},
      mk("details",{class:"bd-acc"},mk("summary",{text:"Miten osallistun bonuskuponkeihin?"}),mk("p",{text:"Luo oma tili samalla sähköpostilla, jolla tilaat. Tilaa malakairavintola.fi:n kautta – pisteet kirjautuvat automaattisesti, kun tilaus on luovutettu. Kupongit näkyvät tällä sivulla ja kassalla, kun olet kirjautunut."})),
      mk("details",{class:"bd-acc"},mk("summary",{text:"Lisätietoja"}),mk("p",{text:"Pisteet kertyvät vain malakairavintola.fi:n nettitilauksista (nouto ja kotiinkuljetus), ja kupongit käyvät vain nettitilauksiin. Kupongin valitset tilaussivun kassalla kohdasta Bonuspisteesi. Kysyttävää? Soita 045 353 7000."})),
      BLOG.length?mk("details",{class:"bd-acc"},mk("summary",{text:"Pistehistoria"}),BLOG.map(l=>mk("div",{class:"ac-kv"},mk("span",{text:fdt(l.created_at)+" · "+(l.note||"")}),l.delta?mk("b",{style:"color:"+(l.delta>0?"#7BE0A6":"#FF9A8C"),text:(l.delta>0?"+":"")+l.delta+" p"}):null))):null)));
  document.body.append(ov);document.body.style.overflow="hidden";ov.querySelector(".bd-back").focus();
  ov.addEventListener("keydown",e=>{if(e.key==="Escape")close()})}

function vPerks(){const fp=+(CFG?.firstPct??15),ev=+(CFG?.loyEvery??10),pc=+(CFG?.loyPct??20),n=ORD.filter(o=>o.status!=="peruttu").length;
  const saved=ORD.filter(o=>o.status!=="peruttu").reduce((a,o)=>a+ +(o.discount||0),0);
  const P=(on,b,t,s)=>mk("div",{class:"ac-perk"+(on?"":" off")},mk("b",{class:"n",text:b}),mk("div",null,mk("strong",{text:t}),mk("small",{text:s})));
  const c=mk("div",{class:"ac-card"},mk("h2",{html:"Omat <em>edut</em>"}));
  if(fp>0)c.append(P(n===0,"−"+fp+"%","Uuden asiakkaan etu",n===0?"Käytössä ensimmäisessä nettitilauksessasi – lasketaan automaattisesti.":"Käytetty ✓"));
  c.append(P(true,"1 €","Bonuspisteet","1 € = 1 piste. Kupongit −1 € … −25 € (50–300 p)."));
  c.append(P(true,"💳","Maksa vasta noudettaessa","Kortilla tai käteisellä – ei ennakkomaksua."));
  if(saved>0)c.append(mk("div",{class:"ac-kv"},mk("span",{text:"Olet säästänyt etuina yhteensä"}),mk("b",{style:"color:var(--ay)",text:eur(saved)})));
  return c}

const IMGM={"Tropicana":"tropicana","Kebab Pizza":"kebab","Mexicana":"mexicana","Americano":"americano","Mamma Mia":"mammamia","Julia":"julia","Opera Special":"opera","Barbeque":"bbq","Margarita Mozzarella":"margarita","Oma valinta":"oma","Kebab ranskalaisilla":"kebab-ranskalaiset","Rullakebab":"kebabrulla","Kana ranskalaisilla":"kana-ranskalaiset","Kebabsalaatti":"kebabsalaatti","Iskender":"iskender","Kanasalaatti":"kanasalaatti","Kana riisillä":"kana-riisi","Malakai Special":"malakai-special","Ranskalaiset":"ranskalaiset","Ristikkoperunat":"ristikko","Kierreperunat":"kierre","Crispers-ranskanperunat":"crispers","Bataattiranskalaiset":"bataatti","Mozzarellatikut 5 kpl":"mozzarellatikut","Kananugetit 5 kpl":"nugetit","Kanakori":"kanakori","Pitakebab":"pitakebab","Kanapita":"pita","Kana lohkoperunoilla":"kana-lohko","Kebab ristikkoperunoilla":"kebab-ristikko","Kebab lohkoperunoilla":"kebab-lohko","Finlandia":"finlandia","Tonnikala Pizza":"tonnikala","Juoma 0,33 l":"juomat-033","Juoma 0,5 l":"juomat-05","Juoma 1,5 l":"juomat-15"};
const IMGF=(n,c)=>{const k=IMGM[n]||(/rulla$/i.test(n)?"rulla":/^Sticky Fingers/.test(n)?"sticky":/^Hot ?wings/i.test(n)?"wings":/burgeri$/i.test(n)?"burgeri":"");return k?"media/tilaa/"+k+".webp":""};
// Tilaa uudelleen: muunnetaan tallennettu rivi takaisin ostoskorimuotoon
function toCart(i){const parts=String(i.opt||"").split(" · "),x={c:i.c,n:i.n,q:+i.q||1,s:"n",m:i.m||""};
  parts.forEach(p=>{if(p==="Perhe")x.s="p";else if(/^Kastike /.test(p))x.o=p.slice(8);else if(/^Lisätäytteet: /.test(p))x.x=p.slice(14).split(", ");else if(/^Ateria/.test(p))x.meal=true;else if(/^(Tupla|Tripla)liha$/.test(p))x.l=p;else if(/^Perunat: /.test(p))x.pt=p.slice(9);else if(/^Dipit: /.test(p))x.d=p.slice(7).split(", ");else if(p==="Tulinen")x.hot=true;else if(/^Mausteet: /.test(p))x.sp=p.slice(10).split(", ")});
  if(i.c==="Tarjous"){x.t=String(parts[0]||"").replace(/^Pizzat: /,"").split(", ").filter(Boolean);return x}
  if(i.n==="Dippi")x.o=parts[0];if(i.c==="Dipit ja juomat"&&/^Juoma/.test(i.n)&&parts[0])x.dr=parts[0];if(i.n==="Oma valinta"){const t=parts.find(p=>p&&!/^(Perhe|Normaali|Lisätäytteet)/.test(p));x.t=t?t.split(", "):[]}
  return x}
function reorder(o){const items=(o.items||[]).filter(i=>i.c!=="Päivän pizza").map(toCart);const skip=(o.items||[]).length-items.length;
  if(!items.length)return toast("Tilauksen tuotteita ei voi tilata uudelleen (päivän pizza vaihtuu päivittäin).",true);
  const cart=ls.get("mk_cart")||[];ls.set("mk_cart",cart.concat(items));toast(skip?"Lisätty ostoskoriin (päivän pizzaa ei lisätty)":"Lisätty ostoskoriin");setTimeout(()=>location.href="tilaa.html",700)}

function rateRow(o){const w=mk("div",{class:"ac-rate"});
  if(o.rating){w.append(mk("span",{class:"ac-mut",text:"Arviosi "}),mk("b",{style:"color:#E3A51C;letter-spacing:2px",text:"★".repeat(o.rating)+"☆".repeat(5-o.rating)}));return w}
  w.append(mk("span",{class:"ac-mut",text:"Arvioi tilaus "}),...[1,2,3,4,5].map(n=>mk("button",{type:"button","aria-label":n+" tähteä",text:"★",style:"background:none;border:0;color:#5a5a5a;font-size:1.5rem;cursor:pointer;padding:0 2px",
    onmouseenter:e=>[...w.querySelectorAll("button")].forEach((b,i)=>b.style.color=i<n?"#E3A51C":"#5a5a5a"),
    onclick:async()=>{const r=await pub({action:"rate",id:o.id,e:USER.email,r:n}).catch(()=>({}));if(r&&r.ok){o.rating=n;toast("Kiitos arviosta!");render()}else toast((r&&r.error)||"Arvio ei onnistunut",true)}})));return w}
function vHist(){const c=mk("div",{class:"ac-card"},mk("h2",{html:"Tilaus<em>historia</em>"}));
  const done=ORD.filter(o=>!["uusi","hyvaksytty","valmis"].includes(o.status));
  if(!done.length){c.append(mk("p",{class:"ac-mut",text:ORD.length?"Aiemmat tilaukset näkyvät tässä, kun ne on luovutettu.":"Et ole vielä tilannut netistä. Ensimmäisestä tilauksesta saat alennuksen!"}),ORD.length?null:mk("a",{class:"ac-btn y",href:"tilaa.html",text:"Tee ensimmäinen tilaus →"}));M.append(c);return}
  let show=6;const list=mk("div");const draw=()=>{list.textContent="";done.slice(0,show).forEach(o=>{const can=o.status==="peruttu";
    list.append(mk("div",{class:"ac-ord"},mk("b",{text:"#"+o.no+" · "+fdt(o.created_at)}),mk("em",{text:eur(o.total)}),
      mk("small",{text:(o.kind==="kuljetus"?"Kotiinkuljetus":"Nouto")+" · klo "+hm(o.created_at)+(o.discount>0?" · "+(o.discount_note||"etu")+" −"+eur(o.discount):"")}),
      mk("p",{text:(o.items||[]).map(i=>i.q+" × "+i.n+(i.opt?" ("+i.opt+")":"")).join(", ")}),
      mk("div",{class:"row"},mk("span",{class:"ac-pill "+(can?"r":"g"),text:can?"PERUTTU":"LUOVUTETTU"}),can&&o.reason?mk("small",{class:"ac-mut",text:o.reason}):null,
        mk("span",{style:"flex:1"}),mk("button",{class:"ac-btn o",text:"Tilaa uudelleen",onclick:()=>reorder(o)})),
      o.status==="luovutettu"?rateRow(o):null))});
    if(done.length>show)list.append(mk("button",{class:"ac-link",text:"Näytä lisää ("+(done.length-show)+")",onclick:()=>{show+=10;draw()}}))};draw();
  const sum=done.filter(o=>o.status!=="peruttu");
  c.append(mk("div",{class:"ac-mut",style:"font-size:.86rem;margin:-4px 0 6px",text:sum.length+" tilausta · yhteensä "+eur(sum.reduce((a,o)=>a+ +o.total,0))}),list);M.append(c)}

function vProfile(part){const me=USER.user_metadata||{},I=(k,a={})=>mk("input",{value:me[k]||"",maxlength:120,...a});
  const nm=I("name",{autocomplete:"name"}),ph=I("phone",{type:"tel",autocomplete:"tel"}),ad=I("address",{autocomplete:"street-address"}),apt=I("apt"),door=I("door"),zp=I("zip",{inputmode:"numeric",maxlength:5}),ci=I("city");if(!ci.value)ci.value="Lempäälä";
  const f=mk("form",{class:"ac-card"},mk("h2",{html:"Omat <em>tiedot</em>"}),mk("p",{class:"ac-mut",style:"font-size:.86rem;margin:-6px 0 12px",text:"Tiedot täytetään valmiiksi tilaussivulle. Tilaa samalla sähköpostilla, niin tilaukset ja leimat tallentuvat tilillesi."}),
    mk("div",{class:"ac-2"},mk("label",null,"Nimi",nm),mk("label",null,"Puhelin",ph)),mk("label",null,"Katuosoite ja talon numero (kotiinkuljetukseen)",ad),mk("div",{class:"ac-2"},mk("label",null,"Rappu ja asunto",apt),mk("label",null,"Ovikoodi",door)),mk("div",{class:"ac-2"},mk("label",null,"Postinumero",zp),mk("label",null,"Paikkakunta",ci)),
    mk("button",{class:"ac-btn y",text:"Tallenna tiedot"}));
  f.onsubmit=async e=>{e.preventDefault();const d={name:nm.value.trim(),phone:ph.value.trim(),address:ad.value.trim(),apt:apt.value.trim(),door:door.value.trim(),zip:zp.value.trim(),city:ci.value.trim()};
    const {data,error}=await SB.auth.updateUser({data:d});if(error)return toast(fi(error),true);USER=data.user;ls.set("mk_me",{n:d.name,p:d.phone,e:USER.email,a:d.address,apt:d.apt,door:d.door,z:d.zip,ci:d.city});toast("Tiedot tallennettu");render()};
  const pw=mk("input",{type:"password",autocomplete:"new-password",minlength:8}),g=mk("form",{class:"ac-card"},mk("h2",{html:"Tili ja <em>tietosuoja</em>"}),
    mk("div",{class:"ac-kv"},mk("span",{text:"Sähköposti"}),mk("b",{text:USER.email})),mk("label",{style:"margin-top:12px"},"Vaihda salasana (vähintään 8 merkkiä)",pw),mk("button",{class:"ac-btn o",text:"Vaihda salasana"}),
    mk("p",{class:"ac-mut",style:"font-size:.84rem;margin:14px 0 0",html:'Haluatko poistaa tilisi ja tietosi? <a style="color:var(--ay)" href="mailto:malakairavintola@gmail.com?subject=Asiakastilin%20poisto">Lähetä poistopyyntö</a>, niin poistamme sen. Lue lisää <a style="color:var(--ay)" href="tietosuoja.html#tili">tietosuojaselosteesta</a>.'}));
  g.onsubmit=async e=>{e.preventDefault();if(pw.value.length<8)return toast("Salasanan pitää olla vähintään 8 merkkiä.",true);const {error}=await SB.auth.updateUser({password:pw.value});if(error)return toast(fi(error),true);pw.value="";toast("Salasana vaihdettu")};
  if(part==="f")return M.append(f);if(part==="g")return M.append(g);M.append(mk("div",{class:"ac-grid"},f,g))}
// ---------- Tili-keskus (sovellustyylinen)
const IC={rc:'<path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',hist:'<path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="18" r="2"/>',res:'<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h3"/>',me:'<circle cx="10" cy="8" r="3.6"/><path d="M3.5 20c0-3.7 2.9-6 6.5-6 1.5 0 2.9.4 4 1.1"/><path d="M18 21s-3.2-2-3.2-4.1a1.7 1.7 0 0 1 3.2-.8 1.7 1.7 0 0 1 3.2.8C21.2 19 18 21 18 21z"/>',
  per:'<circle cx="12" cy="7.5" r="3.5"/><path d="M7 21v-4.5a5 5 0 0 1 10 0V21"/>',addr:'<path d="M12 21s-6.5-6.2-6.5-11.5a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v3"/>',share:'<path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/>',
  cp:'<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',off:'<path d="M12 2.5l2.6 1.9 3.2-.2.9 3.1 2.6 1.9-1 3.1 1 3.1-2.6 1.9-.9 3.1-3.2-.2L12 21.5l-2.6-1.9-3.2.2-.9-3.1-2.6-1.9 1-3.1-1-3.1 2.6-1.9.9-3.1 3.2.2z"/><path d="M9 15l6-6"/><circle cx="9.3" cy="9.3" r=".9"/><circle cx="14.7" cy="14.7" r=".9"/>',out:'<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',chev:'<path d="M9 5l7 7-7 7"/>'};
const ico=(k,w)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w||1.7}" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
function capture(fn){const keep=M;M=document.createElement("div");try{fn()}finally{}const out=M;M=keep;return out}
function sub(title,body,hash){const ov=mk("div",{class:"bd-ov",role:"dialog","aria-modal":"true","aria-label":title});
  const close=()=>{ov.remove();if(!document.querySelector(".bd-ov"))document.body.style.overflow="";if(hash&&location.hash==="#"+hash)history.replaceState(null,"",location.pathname)};
  ov.append(mk("div",{class:"bd"},mk("div",{class:"sb-top"},mk("button",{class:"bd-back",type:"button","aria-label":"Takaisin",html:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',onclick:close}),mk("h2",{text:title})),mk("div",{class:"sb-body"},body)));
  ov.addEventListener("keydown",e=>{if(e.key==="Escape")close()});document.body.append(ov);document.body.style.overflow="hidden";if(hash)history.replaceState(null,"","#"+hash);ov.querySelector(".bd-back").focus();return ov}
const row=(k,t,s,fn)=>mk(typeof fn==="string"?"a":"button",{class:"hb-row",type:typeof fn==="string"?null:"button",href:typeof fn==="string"?fn:null,onclick:typeof fn==="string"?null:fn},mk("span",{class:"hb-i",html:ico(k)}),mk("span",{class:"hb-t"},mk("b",{text:t}),s?mk("small",{text:s}):null),mk("span",{class:"hb-c",html:ico("chev",2)}));
const YTUNNUS="3305891-1";
function receipt(o){const vat=Math.round(+o.total*13.5/113.5*100)/100,d=new Date(o.created_at);
  const w=mk("div",{class:"rc"},mk("div",{class:"rc-h"},mk("b",{text:"MALAKAI RAVINTOLA"}),YTUNNUS?mk("span",{text:"Y-tunnus "+YTUNNUS}):null,mk("span",{text:"Tampereentie 414, 33880 Lempäälä"}),mk("span",{text:"045 353 7000"}),mk("span",{text:"malakairavintola.fi"})),
    mk("div",{class:"rc-m"},mk("span",{text:"Tilaus #"+o.no}),mk("span",{text:d.toLocaleDateString("fi-FI",{timeZone:TZ})+" klo "+d.toLocaleTimeString("fi-FI",{timeZone:TZ,hour:"2-digit",minute:"2-digit"})})),
    mk("div",{class:"rc-m"},mk("span",{text:o.kind==="kuljetus"?"Kotiinkuljetus":"Nouto"}),mk("span",{text:o.pay==="lahjakortti"?"Lahjakortti":o.pay==="netti"?"Maksettu netissä":o.pay==="kateinen"?"Käteinen":"Kortti"})),
    mk("div",{class:"rc-l"},(o.items||[]).map(i=>mk("div",{class:"rc-i"},mk("div",{class:"rc-r"},mk("span",{text:i.q+" × "+i.n}),mk("b",{text:eur((+i.unit||0)*(+i.q||1))})),i.opt?mk("small",{text:i.opt}):null))),
    mk("div",{class:"rc-r"},mk("span",{text:"Välisumma"}),mk("span",{text:eur(o.subtotal)})),
    +o.fee?mk("div",{class:"rc-r"},mk("span",{text:"Kuljetus"}),mk("span",{text:eur(o.fee)})):null,
    +o.discount?mk("div",{class:"rc-r rc-d"},mk("span",{text:o.discount_note||"Alennus"}),mk("span",{text:"−"+eur(o.discount)})):null,
    mk("div",{class:"rc-r rc-t"},mk("span",{text:"YHTEENSÄ"}),mk("b",{text:eur(o.total)})),
    mk("div",{class:"rc-r rc-s"},mk("span",{text:"ALV 13,5 %"}),mk("span",{text:eur(vat)})),mk("div",{class:"rc-r rc-s"},mk("span",{text:"Veroton"}),mk("span",{text:eur(+o.total-vat)})),
    mk("p",{class:"rc-f",text:"Kiitos tilauksestasi! Tervetuloa uudelleen."}));
  const ov=sub("Digikuitti #"+o.no,mk("div",null,w,mk("button",{class:"ac-btn o",style:"margin-top:16px;width:100%",type:"button",text:"Tulosta tai tallenna PDF",onclick:()=>{document.body.classList.add("rc-print");window.print();setTimeout(()=>document.body.classList.remove("rc-print"),500)}})));ov.classList.add("rc-ov")}
const SUBS={
  digikuitit:()=>{const L=ORD.filter(o=>o.status!=="peruttu");sub("Digikuitit",L.length?mk("div",null,mk("p",{class:"ac-mut",text:"Kaikki nettitilaustesi kuitit yhdessä paikassa."}),L.map(o=>mk("button",{class:"hb-row",type:"button",onclick:()=>receipt(o)},mk("span",{class:"hb-i",html:ico("rc")}),mk("span",{class:"hb-t"},mk("b",{text:"#"+o.no+" · "+fdt(o.created_at)}),mk("small",{text:(o.items||[]).map(i=>i.n).slice(0,3).join(", ")})),mk("b",{class:"hb-p",text:eur(o.total)}))))
    :mk("p",{class:"ac-mut",text:"Kuitit näkyvät tässä, kun olet tilannut netistä."}),"digikuitit")},
  historia:()=>sub("Tilaushistoria",capture(vHist),"historia"),
  varaukset:async()=>{const box=mk("div",null,mk("p",{class:"ac-mut",text:"Ladataan…"}));sub("Pöytävaraukset",box,"varaukset");
    const{data,error}=await SB.from("reservations").select("date,time,guests,status,note,created_at").eq("email",MYE()).order("date",{ascending:false}).limit(50);box.textContent="";
    const ST={uusi:["Odottaa vahvistusta","y"],vahvistettu:["Vahvistettu","g"],hyvaksytty:["Vahvistettu","g"],peruttu:["Peruttu","r"]};
    if(error||!data||!data.length)box.append(mk("p",{class:"ac-mut",text:"Sinulla ei ole pöytävarauksia tällä sähköpostilla."}));
    else data.forEach(r=>{const s=ST[r.status]||[r.status||"Vastaanotettu","y"];box.append(mk("div",{class:"hb-row"},mk("span",{class:"hb-i",html:ico("res")}),mk("span",{class:"hb-t"},mk("b",{text:r.date.split("-").reverse().join(".")+" klo "+String(r.time).slice(0,5)}),mk("small",{text:r.guests+" hlö"+(r.note?" · "+r.note:"")})),mk("span",{class:"ac-pill "+s[1],text:s[0]})))});
    box.append(mk("a",{class:"ac-btn y",href:"index.html#varaa",style:"margin-top:16px",text:"Varaa pöytä"}))},
  henkilotiedot:()=>sub("Henkilö- ja osoitetiedot",capture(()=>vProfile("f")),"henkilotiedot"),
  kirjautuminen:()=>sub("Kirjautumistiedot",capture(()=>vProfile("g")),"kirjautuminen"),
};
async function shareApp(){const d={title:"Malakai Ravintola",text:"Tilaa suoraan Malakaista – ensimmäinen nettitilaus −20 % ja bonuskupongit!",url:"https://malakairavintola.fi/tilaa.html"};
  try{if(navigator.share)return await navigator.share(d);await navigator.clipboard.writeText(d.text+" "+d.url);toast("Linkki kopioitu – liitä se viestiin")}catch(e){}}
function vHub(){const nm=(USER.user_metadata?.name||"").split(" ")[0];
  M.append(mk("div",{class:"hb-hero"},mk("h2",{html:"Hei <em></em>!"}),mk("div",{class:"hb-q"},[["rc","Digikuitit",SUBS.digikuitit],["res","Pöytä&shy;varaukset",SUBS.varaukset],["hist","Tilaus&shy;historia",SUBS.historia],["me","Omat tiedot",SUBS.henkilotiedot]].map(([k,t,f])=>mk("button",{type:"button",class:"hb-qb",onclick:f},mk("span",{html:ico(k)}),mk("b",{html:t}))))));
  M.querySelector(".hb-hero h2 em").textContent=nm||"asiakas";
  vLive();M.append(mk("div",{class:"ac-grid"},vStamps(),vPerks()));
  M.append(mk("div",{class:"ac-card hb-list"},
    mk("h3",{text:"Ostoksesi / varauksesi"}),row("rc","Digikuitit","Kuitit kaikista nettitilauksista",SUBS.digikuitit),row("hist","Tilaushistoria","Tilaa uudelleen ja arvioi",SUBS.historia),row("res","Pöytävaraukset","Omat varauksesi ja uusi varaus",SUBS.varaukset),
    mk("h3",{text:"Edut"}),row("cp","Kuponkini","Bonuskupongit ja pisteet","kupongit.html"),row("off","Tarjoukset","Voimassa olevat tarjoukset","tarjoukset.html"),
    mk("h3",{text:"Profiili"}),row("per","Henkilö- ja osoitetiedot","Nimi, puhelin ja toimitusosoite",SUBS.henkilotiedot),row("lock","Kirjautumistiedot","Sähköposti ja salasana",SUBS.kirjautuminen),row("share","Vinkkaa kaverille","Jaa tilauslinkki",shareApp),
    row("out","Kirjaudu ulos","",async()=>{clearInterval(poll);try{localStorage.removeItem("mk_last")}catch(e){}await SB.auth.signOut({scope:"local"});toast("Kirjauduit ulos")})))}
})();
