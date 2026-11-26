// Uutuusilmoitus etusivulla: oma nettitilaus + Oma tili (näkyy 30.11.2026 asti)
(function(){
"use strict";
const END=new Date("2026-11-30T23:59:59+02:00").getTime();
if(Date.now()>END)return;
const LS={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
const KEY="mk_promo_netti";
// Kun uutuusikkuna näytetään, muu ponnahdusikkuna odottaa seuraavaan käyntiin
const seen=LS.get(KEY)==="1";

const css=`
.np-bg{position:fixed;inset:0;z-index:120;background:rgba(0,0,0,.72);backdrop-filter:blur(5px);display:grid;place-items:center;padding:18px;opacity:0;transition:opacity .35s}
.np-bg.on{opacity:1}
.np{position:relative;width:min(440px,100%);margin-top:70px;max-height:calc(100svh - 110px);overflow:visible;background:radial-gradient(420px 300px at 50% 0%,rgba(227,165,28,.22),transparent 70%),#0B0B0B;border-radius:28px;padding:150px 26px 26px;text-align:center;color:#fff;font-family:Inter,system-ui,sans-serif;
  box-shadow:0 0 0 1.5px rgba(227,165,28,.55),0 30px 90px rgba(0,0,0,.8),0 0 60px rgba(227,165,28,.18);transform:translateY(40px) scale(.9);opacity:0;transition:transform .6s cubic-bezier(.2,1.35,.4,1),opacity .4s}
.np-bg.on .np{transform:none;opacity:1}
.np-pz{position:absolute;left:50%;top:-86px;width:230px;height:230px;margin-left:-115px;filter:drop-shadow(0 24px 30px rgba(0,0,0,.7));animation:npSpin 22s linear infinite}
.np-bg.on .np-pz{animation:npIn .9s cubic-bezier(.2,1.3,.4,1) both,npSpin 22s linear .9s infinite}
@keyframes npIn{from{transform:translateY(-60px) rotate(-90deg) scale(.6);opacity:0}to{transform:none;opacity:1}}
@keyframes npSpin{to{transform:rotate(360deg)}}
.np-x{position:absolute;right:14px;top:14px;width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.08);color:#fff;font-size:22px;line-height:1;cursor:pointer}
.np-tag{display:inline-block;background:#B3121F;color:#fff;font:800 .74rem Inter,sans-serif;letter-spacing:.2em;padding:6px 14px;border-radius:999px}
.np h2{font:500 clamp(2rem,8vw,2.5rem)/1.05 "Playfair Display",Georgia,serif;margin:14px 0 6px}.np h2 em{color:#E3A51C}
.np p{margin:0 0 16px;color:#cfcfcf;font-size:.95rem}
.np ul{list-style:none;margin:0 0 20px;padding:0;text-align:left;display:grid;gap:10px}
.np li{display:flex;gap:12px;align-items:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:11px 14px;font-size:.95rem;opacity:0;transform:translateX(-20px);transition:.45s}
.np-bg.on li{opacity:1;transform:none}.np-bg.on li:nth-child(1){transition-delay:.45s}.np-bg.on li:nth-child(2){transition-delay:.6s}.np-bg.on li:nth-child(3){transition-delay:.75s}
.np li i{flex:none;width:32px;height:32px;border-radius:50%;background:#E3A51C;color:#111;display:grid;place-items:center;font:900 .9rem Inter,sans-serif;font-style:normal}
.np li b{color:#fff}
.np-cta{display:flex;gap:10px}
.np-cta a{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:999px;padding:15px 12px;font:800 1rem Inter,sans-serif;text-decoration:none}
.np-cta .a1{background:#B3121F;color:#fff;box-shadow:0 10px 30px rgba(179,18,31,.45)}.np-cta .a1 span{display:inline-block;animation:npArr 1.1s ease-in-out infinite}
.np-cta .a2{border:1.5px solid #E3A51C;color:#E3A51C}
@keyframes npArr{50%{transform:translateX(5px)}}
.np-bub{position:absolute;top:calc(100% + 16px);right:-8px;z-index:60;width:max-content;max-width:190px;background:#E3A51C;color:#111;border-radius:14px;padding:10px 14px;font:700 .85rem/1.3 Inter,sans-serif;text-align:left;box-shadow:0 12px 30px rgba(0,0,0,.5);animation:npBob 1.4s ease-in-out infinite;pointer-events:none}
.np-bub::before{content:"";position:absolute;top:-8px;right:20px;width:16px;height:16px;background:#E3A51C;transform:rotate(45deg);border-radius:3px}
.np-bub small{display:block;font-weight:600;opacity:.8}
.np-bub b{display:block;font-size:.95rem}
@keyframes npBob{50%{transform:translateY(6px)}}
.top .acc.np-glow{border-color:#E3A51C;color:#E3A51C;box-shadow:0 0 0 0 rgba(227,165,28,.7);animation:npPulse 1.8s infinite}
@keyframes npPulse{70%{box-shadow:0 0 0 12px rgba(227,165,28,0)}100%{box-shadow:0 0 0 0 rgba(227,165,28,0)}}
@media(prefers-reduced-motion:reduce){.np-pz,.np-bub,.top .acc.np-glow,.np-cta .a1 span{animation:none!important}}`;
const st=document.createElement("style");st.textContent=css;document.head.append(st);

function bubble(){const a=document.getElementById("acc");if(!a||a.querySelector(".np-bub"))return;
  a.classList.add("np-glow");const b=document.createElement("span");b.className="np-bub";
  b.innerHTML="<small>Uutta!</small><b>Oma tili</b>Kerää bonuspisteitä tilauksista";a.append(b);
  const off=()=>{b.remove();a.classList.remove("np-glow")};a.addEventListener("click",()=>LS.set(KEY+"_acc","1"));setTimeout(off,8000)}

function modal(){const bg=document.createElement("div");bg.className="np-bg";bg.setAttribute("role","dialog");bg.setAttribute("aria-modal","true");bg.setAttribute("aria-label","Uutta: oma nettitilaus");
  bg.innerHTML=`<div class="np"><img class="np-pz" src="media/tilaa/pizza-uusi.webp" alt=""><button class="np-x" aria-label="Sulje">×</button>
  <span class="np-tag">UUTTA</span><h2>Oma nettitilaus <em>on täällä</em></h2><p>Tilaa suoraan meiltä – nouto tai kotiinkuljetus. Maksat vasta, kun saat ruoan.</p>
  <ul><li><i>%</i><span><b>−20 %</b> ensimmäisestä nettitilauksesta</span></li><li><i>★</i><span><b>Bonuspisteet</b> omalle tilille – 1 € = 1 piste</span></li><li><i>€</i><span><b>Ei palvelumaksuja</b> – halvemmalla kuin sovelluksissa</span></li></ul>
  <div class="np-cta"><a class="a1" href="tilaa.html">Tilaa nyt <span>→</span></a><a class="a2" href="tili.html">Luo oma tili</a></div></div>`;
  document.body.append(bg);requestAnimationFrame(()=>requestAnimationFrame(()=>bg.classList.add("on")));
  const close=()=>{LS.set(KEY,"1");bg.classList.remove("on");setTimeout(()=>{bg.remove();bubble()},350);removeEventListener("keydown",esc)};
  const esc=e=>{if(e.key==="Escape")close()};addEventListener("keydown",esc);
  bg.querySelector(".np-x").onclick=close;bg.onclick=e=>{if(e.target===bg)close()};
  bg.querySelectorAll(".np-cta a").forEach(x=>x.addEventListener("click",()=>LS.set(KEY,"1")))}

const go=()=>{if(LS.get(KEY+"_acc")!=="1")setTimeout(bubble,900)};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();
})();
