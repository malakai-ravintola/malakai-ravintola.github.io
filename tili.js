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
const M=$("#acMain"),HERE=location.origin+location.pathname;
const FI={"Invalid login credentials":"Väärä sähköposti tai salasana.","Email not confirmed":"Vahvista ensin sähköpostiosoitteesi – avaa saamasi vahvistusviesti.","User already registered":"Tällä sähköpostilla on jo tili. Kirjaudu sisään tai palauta salasana.","Password should be at least 6 characters.":"Salasanan pitää olla vähintään 8 merkkiä."};
const fi=e=>FI[e?.message]||(/rate limit/i.test(e?.message||"")?"Liian monta yritystä. Odota hetki ja yritä uudelleen.":(e?.message||"Jokin meni vikaan. Yritä uudelleen."));
if(!C.url||!window.supabase){M.textContent="";M.append(mk("p",{class:"ac-mut",text:"Tilipalvelu ei latautunut. Tarkista nettiyhteys ja päivitä sivu."}));return}
const SB=supabase.createClient(C.url,C.anon);
let USER=null,ORD=null,CFG=null,CUS=null,mode="in",poll=null,recovery=/type=recovery/.test(location.hash);

async function pub(body){const r=await fetch(C.url+"/functions/v1/Public",{method:"POST",headers:{"Content-Type":"application/json",apikey:C.anon,Authorization:"Bearer "+C.anon},body:JSON.stringify(body)});return r.json()}
SB.auth.onAuthStateChange((ev,s)=>{if(ev==="PASSWORD_RECOVERY"){recovery=true;USER=s?.user||null;return render()}
  if(ev==="SIGNED_IN"&&!USER){USER=s.user;load()}if(ev==="SIGNED_OUT"){USER=null;ORD=null;render()}});
SB.auth.getSession().then(({data})=>{USER=data.session?.user||null;if(USER&&!recovery)load();else render()});

async function load(){
  const [o,c,g]=await Promise.all([SB.from("orders").select("id,no,created_at,kind,want,items,subtotal,fee,discount,discount_note,total,status,eta,reason,pay,address,zip,city").order("created_at",{ascending:false}).limit(60),
    SB.from("customers").select("orders,spent,first_order").maybeSingle(),pub({action:"order_cfg"}).catch(()=>null)]);
  ORD=o.error?[]:o.data;CUS=c.data||null;CFG=g||CFG||{};
  const me=USER.user_metadata||{};ls.set("mk_me",{...(ls.get("mk_me")||{}),n:me.name||"",p:me.phone||"",e:USER.email,a:me.address||"",apt:me.apt||"",door:me.door||"",z:me.zip||"",ci:me.city||"Lempäälä"});
  try{const last=ORD.find(o=>o.status!=="peruttu"&&(o.items||[]).some(i=>i.c!=="Päivän pizza"));if(last)ls.set("mk_last",{no:last.no,date:last.created_at,total:last.total,name:(USER.user_metadata?.name||"").split(" ")[0],items:(last.items||[]).filter(i=>i.c!=="Päivän pizza").map(i=>({...toCart(i),img:IMGF(i.n,i.c)}))});else localStorage.removeItem("mk_last")}catch(e){}
  render();clearInterval(poll);poll=setInterval(async()=>{if(document.hidden||!USER)return;const r=await SB.from("orders").select("id,status,eta,reason").in("status",["uusi","hyvaksytty","valmis"]);
    const open=(ORD||[]).filter(x=>["uusi","hyvaksytty","valmis"].includes(x.status));if(!open.length&&!(r.data||[]).length)return;
    const fresh=await SB.from("orders").select("id,no,created_at,kind,want,items,subtotal,fee,discount,discount_note,total,status,eta,reason,pay,address,zip,city").order("created_at",{ascending:false}).limit(60);if(!fresh.error){ORD=fresh.data;render()}},20000)}

// ---------- Näkymät
function render(){M.textContent="";
  if(recovery)return vReset();
  if(!USER){$("#acH").innerHTML="Oma <em>tili</em>";$("#acSub").textContent="Kirjaudu nähdäksesi tilauksesi, leimakorttisi ja etusi.";return vAuth()}
  const nm=(USER.user_metadata?.name||USER.email.split("@")[0]).split(" ")[0];
  $("#acH").innerHTML="Hei <em></em>!";$("#acH em").textContent=nm;$("#acSub").textContent="Tervetuloa takaisin – täältä näet tilauksesi ja etusi.";
  if(ORD===null){M.append(mk("p",{class:"ac-mut",text:"Ladataan tilauksia…"}));return}
  vTop();vLive();M.append(mk("div",{class:"ac-grid"},vStamps(),vPerks()));vHist();vProfile()}

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
    mk("div",{class:"ac-quick"},mk("a",{class:"ac-btn",href:"tilaa.html",text:"Tilaa nyt"}),mk("button",{class:"ac-btn o",text:"Kirjaudu ulos",onclick:async()=>{clearInterval(poll);try{localStorage.removeItem("mk_last")}catch(e){}await SB.auth.signOut();toast("Kirjauduit ulos")}}))))}

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

function vStamps(){const ev=+(CFG?.loyEvery??10),pc=+(CFG?.loyPct??20),n=ORD.filter(o=>o.status!=="peruttu").length;
  const c=mk("div",{class:"ac-card"},mk("h2",{html:"Leima<em>kortti</em>"}));
  if(!(ev>0&&pc>0)){c.append(mk("p",{class:"ac-mut",text:"Leimakortti ei ole juuri nyt käytössä."}));return c}
  const next=(n+1)%ev===0,k=next?ev-1:n%ev,left=next?0:ev-1-k;
  c.append(mk("div",{class:"ac-big",html:`${k}<span> / ${ev} leimaa</span>`}),
    mk("div",{class:"ac-stamps"},Array.from({length:ev},(_,i)=>mk("i",{class:(i<k?"on":"")+(i===ev-1?" gift":""),text:i===ev-1?"−"+pc+"%":i<k?"✓":""}))),
    mk("p",{class:"ac-mut",style:"margin:0",text:next?`🎉 Seuraava tilauksesi on ${n+1}. – saat siitä −${pc} %!`:`Vielä ${left} ${left===1?"tilaus":"tilausta"}, niin ${ev}. tilauksesta saat −${pc} %.`}),
    mk("p",{class:"ac-mut",style:"font-size:.8rem;margin:8px 0 0",text:`Jokainen nettitilaus = 1 leima. Kertynyt yhteensä ${n} ${n===1?"tilaus":"tilausta"}.`}));return c}

function vPerks(){const fp=+(CFG?.firstPct??15),ev=+(CFG?.loyEvery??10),pc=+(CFG?.loyPct??20),n=ORD.filter(o=>o.status!=="peruttu").length;
  const saved=ORD.filter(o=>o.status!=="peruttu").reduce((a,o)=>a+ +(o.discount||0),0);
  const P=(on,b,t,s)=>mk("div",{class:"ac-perk"+(on?"":" off")},mk("b",{class:"n",text:b}),mk("div",null,mk("strong",{text:t}),mk("small",{text:s})));
  const c=mk("div",{class:"ac-card"},mk("h2",{html:"Omat <em>edut</em>"}));
  if(fp>0)c.append(P(n===0,"−"+fp+"%","Uuden asiakkaan etu",n===0?"Käytössä ensimmäisessä nettitilauksessasi – lasketaan automaattisesti.":"Käytetty ✓"));
  if(ev>0&&pc>0)c.append(P((n+1)%ev===0,"−"+pc+"%","Leimakortin etu",(n+1)%ev===0?"Aktiivinen! Saat alennuksen seuraavasta tilauksesta.":"Joka "+ev+". tilaus. Kerää leimoja tilaamalla."));
  c.append(P(true,"💳","Maksa vasta noudettaessa","Kortilla tai käteisellä – ei ennakkomaksua."));
  if(saved>0)c.append(mk("div",{class:"ac-kv"},mk("span",{text:"Olet säästänyt etuina yhteensä"}),mk("b",{style:"color:var(--ay)",text:eur(saved)})));
  return c}

const IMGM={"Tropicana":"tropicana","Kebab Pizza":"kebab","Mexicana":"mexicana","Americano":"americano","Mamma Mia":"mammamia","Julia":"julia","Opera Special":"opera","Barbeque":"bbq","Margarita Mozzarella":"margarita","Oma valinta":"oma","Kebab ranskalaisilla":"kebab-ranskalaiset","Rullakebab":"kebabrulla","Kana ranskalaisilla":"kana-ranskalaiset","Kebabsalaatti":"kebabsalaatti","Iskender":"iskender","Kanasalaatti":"kanasalaatti","Kana riisillä":"kana-riisi","Malakai Special":"malakai-special","Ranskalaiset":"ranskalaiset","Ristikkoperunat":"ristikko","Kierreperunat":"kierre","Crispers-ranskanperunat":"crispers","Bataattiranskalaiset":"bataatti","Mozzarellatikut 5 kpl":"mozzarellatikut","Kananugetit 5 kpl":"nugetit","Kanakori":"kanakori"};
const IMGF=(n,c)=>{const k=IMGM[n]||(/rulla$/i.test(n)?"rulla":/^Sticky Fingers/.test(n)?"sticky":/^Hot ?wings/i.test(n)?"wings":/burgeri$/i.test(n)?"burgeri":"");return k?"media/tilaa/"+k+".webp":""};
// Tilaa uudelleen: muunnetaan tallennettu rivi takaisin ostoskorimuotoon
function toCart(i){const parts=String(i.opt||"").split(" · "),x={c:i.c,n:i.n,q:+i.q||1,s:"n",m:i.m||""};
  parts.forEach(p=>{if(p==="Perhe")x.s="p";else if(/^Kastike /.test(p))x.o=p.slice(8);else if(/^Lisätäytteet: /.test(p))x.x=p.slice(14).split(", ");else if(/^Ateria/.test(p))x.meal=true;else if(/^(Tupla|Tripla)liha$/.test(p))x.l=p;else if(/^Perunat: /.test(p))x.pt=p.slice(9);else if(/^Dipit: /.test(p))x.d=p.slice(7).split(", ")});
  if(i.c==="Tarjous"){x.t=String(parts[0]||"").replace(/^Pizzat: /,"").split(", ").filter(Boolean);return x}
  if(i.n==="Dippi")x.o=parts[0];if(i.n==="Oma valinta"){const t=parts.find(p=>p&&!/^(Perhe|Normaali|Lisätäytteet)/.test(p));x.t=t?t.split(", "):[]}
  return x}
function reorder(o){const items=(o.items||[]).filter(i=>i.c!=="Päivän pizza").map(toCart);const skip=(o.items||[]).length-items.length;
  if(!items.length)return toast("Tilauksen tuotteita ei voi tilata uudelleen (päivän pizza vaihtuu päivittäin).",true);
  const cart=ls.get("mk_cart")||[];ls.set("mk_cart",cart.concat(items));toast(skip?"Lisätty ostoskoriin (päivän pizzaa ei lisätty)":"Lisätty ostoskoriin");setTimeout(()=>location.href="tilaa.html",700)}

function vHist(){const c=mk("div",{class:"ac-card"},mk("h2",{html:"Tilaus<em>historia</em>"}));
  const done=ORD.filter(o=>!["uusi","hyvaksytty","valmis"].includes(o.status));
  if(!done.length){c.append(mk("p",{class:"ac-mut",text:ORD.length?"Aiemmat tilaukset näkyvät tässä, kun ne on luovutettu.":"Et ole vielä tilannut netistä. Ensimmäisestä tilauksesta saat alennuksen!"}),ORD.length?null:mk("a",{class:"ac-btn y",href:"tilaa.html",text:"Tee ensimmäinen tilaus →"}));M.append(c);return}
  let show=6;const list=mk("div");const draw=()=>{list.textContent="";done.slice(0,show).forEach(o=>{const can=o.status==="peruttu";
    list.append(mk("div",{class:"ac-ord"},mk("b",{text:"#"+o.no+" · "+fdt(o.created_at)}),mk("em",{text:eur(o.total)}),
      mk("small",{text:(o.kind==="kuljetus"?"Kotiinkuljetus":"Nouto")+" · klo "+hm(o.created_at)+(o.discount>0?" · "+(o.discount_note||"etu")+" −"+eur(o.discount):"")}),
      mk("p",{text:(o.items||[]).map(i=>i.q+" × "+i.n+(i.opt?" ("+i.opt+")":"")).join(", ")}),
      mk("div",{class:"row"},mk("span",{class:"ac-pill "+(can?"r":"g"),text:can?"PERUTTU":"LUOVUTETTU"}),can&&o.reason?mk("small",{class:"ac-mut",text:o.reason}):null,
        mk("span",{style:"flex:1"}),mk("button",{class:"ac-btn o",text:"Tilaa uudelleen",onclick:()=>reorder(o)}))))});
    if(done.length>show)list.append(mk("button",{class:"ac-link",text:"Näytä lisää ("+(done.length-show)+")",onclick:()=>{show+=10;draw()}}))};draw();
  const sum=done.filter(o=>o.status!=="peruttu");
  c.append(mk("div",{class:"ac-mut",style:"font-size:.86rem;margin:-4px 0 6px",text:sum.length+" tilausta · yhteensä "+eur(sum.reduce((a,o)=>a+ +o.total,0))}),list);M.append(c)}

function vProfile(){const me=USER.user_metadata||{},I=(k,a={})=>mk("input",{value:me[k]||"",maxlength:120,...a});
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
  M.append(mk("div",{class:"ac-grid"},f,g))}
})();
