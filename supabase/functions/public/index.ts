// Supabase Edge Function: public  (liitä KOKO tiedosto Supabasen editoriin, funktion nimi: public)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import * as E from "./email.ts";
const OWNER_PHONE = Deno.env.get("OWNER_PHONE") ?? "+358456057475";
const OWNER_EMAIL = "hardi7fateh@hotmail.com"; // tilaukset ja varaukset tulevat aina tähän osoitteeseen
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") ?? OWNER_EMAIL;
const SITE = "https://malakairavintola.fi";
const REVIEW = "https://search.google.com/local/writereview?placeid=ChIJ-5aOe3_fjkYRQ_Anq7PATkc";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info" };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const norm = (p: string) => { p = p.replace(/[^\d+]/g, ""); if (p.startsWith("00")) return "+" + p.slice(2); if (p.startsWith("0")) return "+358" + p.slice(1); if (p.startsWith("358")) return "+" + p; return p; };
const fd = (d: string) => d.split("-").reverse().join(".");
const hasMail = () => !!Deno.env.get("BREVO_KEY");
const hasSms = () => !!(Deno.env.get("ELKS_USER") && Deno.env.get("ELKS_PASS"));
// Tekstiviesti (46elks). Ohitetaan, jos ELKS_USER/ELKS_PASS puuttuvat.
async function sms(to: string, message: string) {
  if (!hasSms()) return false;
  const r = await fetch("https://api.46elks.com/a1/sms", { method: "POST",
    headers: { Authorization: "Basic " + btoa(`${Deno.env.get("ELKS_USER")}:${Deno.env.get("ELKS_PASS")}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ from: "Malakai", to: norm(to), message }) });
  if (!r.ok) throw new Error("Tekstiviestin lähetys epäonnistui");
  return true;
}
// Sähköposti (Brevo). Ohitetaan, jos BREVO_KEY puuttuu.
async function mail(to: string, subject: string, text: string, replyTo?: string, html?: string) {
  if (!hasMail()) return false;
  const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST",
    headers: { "api-key": Deno.env.get("BREVO_KEY")!, "Content-Type": "application/json" },
    body: JSON.stringify({ sender: { name: "Malakai Ravintola", email: SENDER_EMAIL }, to: [{ email: to }], subject, textContent: text, ...(html ? { htmlContent: html } : {}),
      replyTo: { email: replyTo ?? OWNER_EMAIL } }) });
  if (!r.ok) throw new Error("Sähköpostin lähetys epäonnistui: " + (await r.text()).slice(0, 200));
  return true;
}
const s = (x: unknown, n = 200) => String(x ?? "").trim().slice(0, n);
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki" }).format(new Date());
// Kävijälaskuri: ei evästeitä, IP-osoitetta ei tallenneta (vain päivittäin vaihtuva tiiviste)
const SALT = Deno.env.get("VISIT_SALT") ?? "malakai-kavijat";
async function hash(x: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(x));
  return Array.from(new Uint8Array(b)).slice(0, 12).map((v) => v.toString(16).padStart(2, "0")).join("");
}
function source(ref: string) {
  if (!ref) return "suora";
  let h = ""; try { h = new URL(ref).hostname.replace(/^www\./, ""); } catch { return "suora"; }
  if (/malakairavintola\.fi$|github\.io$/.test(h)) return "sivusto";
  if (/google\./.test(h)) return "Google";
  if (/instagram\./.test(h)) return "Instagram";
  if (/facebook\.|fb\.|messenger\./.test(h)) return "Facebook";
  if (/tiktok\./.test(h)) return "TikTok";
  if (/bing\.|duckduckgo\.|yahoo\.|ecosia\./.test(h)) return "Muu hakukone";
  return h.slice(0, 60);
}

// ---------- Nettitilaukset
const OMA: Record<string, number[]> = { n: [11.5, 12.5, 13.5, 13.9], p: [22, 24, 24, 24] };
const MEAL = 4.9, XT: Record<string, number> = { n: 1.5, p: 3 };
const VAT = 13.5; // ruoka ja alkoholittomat juomat, ravintola- ja ateriapalvelut 1.1.2026 alkaen
const vat = (t: number) => Math.round(t * VAT / (100 + VAT) * 100) / 100;
const eur = (n: number) => n.toFixed(2).replace(".", ",") + " €";
let MC: { t: number; d: any } | null = null;
async function site() {
  if (MC && Date.now() - MC.t < 120000) return MC.d;
  const r = await fetch(SITE + "/data.js?t=" + Date.now());
  const m = (await r.text()).match(/\/\*BEGIN\*\/([\s\S]*)\/\*END\*\//);
  if (!m) throw new Error("data.js");
  MC = { t: Date.now(), d: JSON.parse(m[1]) };
  return MC.d;
}
const hel = () => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  const k = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(g("weekday").toLowerCase());
  return { day: ["su", "ma", "ti", "ke", "to", "pe", "la"][k], min: (+g("hour") % 24) * 60 + +g("minute") };
};
const hm = (t: string) => { const [a, b] = String(t || "").split(":"); return +a * 60 + (+b || 0); };
const clock = (m: number) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
async function cfg() { const { data } = await db.from("settings").select("value").eq("key", "orders").maybeSingle(); return data?.value ?? { on: false }; }
function needsSauce(cat: any, it: any[]) { return /Med tai Hot/i.test((cat.note || "") + " " + (it[1] || "")); }
const LIHA: Record<string, number> = { Tuplaliha: 5, Triplaliha: 10 };
const POT: Record<string, number> = { "Ranskalaiset": 0, "Ristikkoperunat": 1, "Kierreperunat": 1, "Crispers-ranskanperunat": 1 }, DIP = 1.5;
const dipList = (S: any) => String((S.menu?.["Dipit ja juomat"]?.items || []).find((i: any[]) => i[0] === "Dippi")?.[1] || "").split(",").map((v: string) => v.trim()).filter(Boolean);
const hasDip = (S: any, cat: any, it: any[]) => it[0] !== "Dippi" && dipList(S).length > 0 && /\bdip/i.test((cat.note || "") + " " + (it[1] || ""));
function priceLine(S: any, day: string, x: any, out: string[] = []) {
  const q = Math.min(Math.max(Math.round(+x.q || 1), 1), 20), n = s(x.n, 80), c = s(x.c, 40);
  if (out.includes((c === "Päivän pizza" ? "Pizza" : c) + "|" + n)) throw new Error(`${n} on valitettavasti loppu. Poista se ostoskorista.`);
  const ALL = String(S.menu?.Pizza?.note || "").split("Täytteet:")[1]?.split(",").map((t: string) => t.trim().replace(/\.$/, "")) ?? [];
  const pick = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).map((t: unknown) => s(t, 40)))].filter((t) => ALL.includes(t as string)).slice(0, 30) as string[];
  const ex = pick(x.x);
  if (c === "Päivän pizza") {
    if (!S.daily?.[day]?.name || S.daily[day].name !== n) throw new Error("Päivän pizza on vaihtunut. Päivitä sivu.");
    return { c, n, q, unit: Math.round((+S.dailyPrice + ex.length * XT.n) * 100) / 100, opt: ["Päivän pizza", ex.length ? "Lisätäytteet: " + ex.join(", ") : ""].filter(Boolean).join(" · "), m: s(x.m, 120) };
  }
  if (c === "Tarjous") {
    const t0 = today(), of = (S.offers || []).find((o: any) => o.on && o.title === n && (!o.from || o.from <= t0) && (!o.until || o.until >= t0));
    if (!of) throw new Error("Tarjous ei ole enää voimassa. Poista se ostoskorista.");
    const mm = String(of.title + " " + (of.text || "")).match(/(\d+)\s*pizza/i), k = mm ? Math.min(+mm[1], 6) : 0;
    const P = (S.menu?.Pizza?.items || []).filter((i: any[]) => +i[2] > 0 && i[0] !== "Oma valinta").map((i: any[]) => i[0]);
    const t = (Array.isArray(x.t) ? x.t : []).map((v: unknown) => s(v, 80));
    if (t.length !== k || t.some((v: string) => !P.includes(v))) throw new Error(`Valitse tarjoukseen ${k} pizzaa`);
    const pr = +String(of.price).replace(/[^\d,.]/g, "").replace(",", ".");
    if (!(pr > 0)) throw new Error("Tarjousta ei voi tilata netissä");
    return { c, n, q, unit: pr, opt: ["Pizzat: " + t.join(", "), /juoma/i.test(of.text || "") ? "1,5 l juoma" : "", "vain nouto"].filter(Boolean).join(" · "), m: s(x.m, 120), until: of.until || "" };
  }
  const cat = S.menu?.[c], it = cat?.items?.find((i: any[]) => i[0] === n);
  if (!it) throw new Error(`Tuotetta ${n} ei löydy. Päivitä sivu.`);
  const sz = x.s === "p" ? "p" : "n", opt: string[] = [];
  let unit: number;
  if (c === "Pizza" && n === "Oma valinta") {
    const t = pick(x.t);
    if (t.length < 1) throw new Error("Valitse omaan pizzaan vähintään 1 täyte");
    unit = t.length <= 4 ? OMA[sz][t.length - 1] : OMA[sz][3] + (t.length - 4) * XT[sz]; opt.push(sz === "p" ? "Perhe" : "Normaali", t.join(", "));
  } else {
    const has2 = +it[3] > 0;
    unit = has2 && sz === "p" ? +it[3] : +it[2];
    if (has2) opt.push(sz === "p" ? "Perhe" : "Normaali");
    if (c === "Pizza" && ex.length) { unit += ex.length * XT[has2 ? sz : "n"]; opt.push("Lisätäytteet: " + ex.join(", ")); }
  }
  if (!(unit > 0)) throw new Error(`Tuotetta ${n} ei voi tilata netissä`);
  if (n === "Dippi") { const l = String(it[1]).split(",").map((v: string) => v.trim()); if (!l.includes(s(x.o, 40))) throw new Error("Valitse dipin maku"); opt.push(s(x.o, 40)); }
  else if (needsSauce(cat, it)) { const ok = c === "Sticky Fingers" ? ["Med", "Hot", "X-hot"] : ["Med", "Hot"]; if (!ok.includes(s(x.o, 5))) throw new Error(`Valitse kastike: ${n}`); opt.push("Kastike " + s(x.o, 5)); }
  if (c === "Kebab" && x.l) { const l = s(x.l, 12); if (!(l in LIHA)) throw new Error(`Tarkista lihavalinta: ${n}`); unit += LIHA[l]; opt.push(l); }
  if (n === "Kanakori" || c === "Sticky Fingers") { const pt = s(x.pt, 30) || "Ranskalaiset"; if (!(pt in POT)) throw new Error(`Tarkista perunat: ${n}`); unit += POT[pt]; opt.push("Perunat: " + pt); }
  if (hasDip(S, cat, it)) { const L = dipList(S), d = [...new Set((Array.isArray(x.d) ? x.d : []).map((v: unknown) => s(v, 40)))].filter((v) => L.includes(v as string)).slice(0, 8) as string[];
    if (!d.length) throw new Error(`Valitse dippi: ${n}`); unit += (d.length - 1) * DIP; opt.push("Dipit: " + d.join(", ")); }
  if (c === "Burgerit" && x.meal) { unit += MEAL; opt.push("Ateria: ranskalaiset + 0,33 l juoma"); }
  return { c, n, q, unit: Math.round(unit * 100) / 100, opt: opt.join(" · "), m: s(x.m, 120) };
}
const WDF = ["sunnuntaina", "maanantaina", "tiistaina", "keskiviikkona", "torstaina", "perjantaina", "lauantaina"];
const whenTxt = (w: string) => { if (w === "heti") return "mahdollisimman pian"; const m = w.match(/^(\d{4})-(\d{2})-(\d{2}) (.+)$/);
  if (!m) return "tänään klo " + w.replace(":", "."); const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`); return `${WDF[d.getUTCDay()]} ${+m[3]}.${+m[2]}. klo ${m[4].replace(":", ".")} (ennakkotilaus)`; };
const lines = (items: any[]) => items.map((i) => `${i.q} × ${i.n}${i.opt ? " (" + i.opt + ")" : ""}  ${eur(i.unit * i.q)}${i.m ? "\n    Lisätoive: " + i.m : ""}`).join("\n");
async function orderCount(email: string, phone: string) {
  const e = email.toLowerCase().trim(), p = norm(phone);
  if (!e && p.length < 8) return -1;
  const { count } = await db.from("orders").select("id", { count: "exact", head: true }).neq("status", "peruttu").or(`email.eq."${e.replace(/"/g, "")}",phone.eq."${p.replace(/"/g, "")}"`);
  return count ?? 0;
}
const loyOf = (c: any) => ({ every: c.loyEvery === 0 ? 0 : Math.max(2, +c.loyEvery || 10), pct: c.loyPct === 0 ? 0 : Math.min(50, +c.loyPct || 20) });
function discountFor(n: number, firstPct: number, L: { every: number; pct: number }) {
  if (n < 0) return { pct: 0, note: null as string | null, loy: false };
  if (n === 0 && firstPct > 0) return { pct: firstPct, note: `Ensitilaus -${firstPct} %`, loy: false };
  if (n > 0 && L.every > 0 && L.pct > 0 && (n + 1) % L.every === 0) return { pct: L.pct, note: `Kanta-asiakasetu ${n + 1}. tilaus -${L.pct} %`, loy: true };
  return { pct: 0, note: null, loy: false };
}
async function saveCustomer(o: any) {
  const { data: c } = await db.from("customers").select("*").eq("email", o.email).maybeSingle();
  const now = new Date().toISOString();
  const row: any = { email: o.email, name: o.name, phone: o.phone, last_order: now, orders: (c?.orders ?? 0) + 1, spent: Math.round(((+c?.spent || 0) + o.total) * 100) / 100 };
  if (o.address) { row.address = o.address; row.zip = o.zip; row.city = o.city; row.apt = o.apt; row.door = o.door; }
  if (!c) row.first_order = now;
  await db.from("customers").upsert(row, { onConflict: "email" });
}
async function sendReviews() {
  const since = new Date(Date.now() - 30 * 60e3).toISOString(), old = new Date(Date.now() - 24 * 3600e3).toISOString();
  const { data } = await db.from("orders").select("id,no,name,email,kind").eq("status", "luovutettu").is("review_sent_at", null).lte("done_at", since).gte("done_at", old).limit(20);
  let n = 0;
  for (const o of data ?? []) {
    await db.from("orders").update({ review_sent_at: new Date().toISOString() }).eq("id", o.id);
    const { data: c } = await db.from("customers").select("review_mail").eq("email", o.email).maybeSingle();
    if (c && c.review_mail === false) continue;
    const fn = String(o.name || "").split(" ")[0];
    try {
      await mail(o.email, `Miten onnistuimme, ${fn}? ⭐`,
        `Hei ${fn}!\n\nKiitos, että tilasit Malakaista! Toivottavasti ${o.kind === "kuljetus" ? "ruoka saapui lämpimänä ja" : "ruoka"} maistui.\n\n` +
        `Olemme pieni paikallinen ravintola Sääksjärvellä, ja jokainen arvio auttaa meitä todella paljon. Kertoisitko kokemuksestasi Googlessa? Se vie alle minuutin:\n\n` +
        `👉 Anna arvio: ${REVIEW}\n\n` +
        `Jos jokin ei mennyt niin kuin piti, vastaa suoraan tähän viestiin. Luemme jokaisen palautteen itse ja korjaamme asian.\n\n` +
        `Tervetuloa uudelleen – nähdään pian!\n\nMalakai Ravintola\nTampereentie 414, 33880 Lempäälä\n045 353 7000\n${SITE}\n\n` +
        `(Tilaus #${o.no}. Et halua palautepyyntöjä jatkossa? Vastaa tähän viestiin sanalla "ei kiitos".)`, undefined,
        E.shell({ pre: "Kertoisitko kokemuksestasi? Se vie alle minuutin.", tag: "Kiitos tilauksesta", title: `Miten onnistuimme, ${E.esc(fn)}?`,
          body: E.p(`Kiitos, että tilasit Malakaista! Toivottavasti ${o.kind === "kuljetus" ? "ruoka saapui lämpimänä ja" : "ruoka"} maistui.`) +
            E.p("Olemme pieni paikallinen ravintola Sääksjärvellä, ja jokainen arvio auttaa meitä todella paljon. Kertoisitko kokemuksestasi Googlessa? Se vie alle minuutin.") +
            `<div style="font-size:30px;letter-spacing:6px;color:#E3A51C;padding:4px 0 14px">★★★★★</div>` + E.btn(REVIEW, "Anna arvio Googlessa") +
            `<p style="margin:18px 0 0;font:14px/1.5 Arial,Helvetica,sans-serif;color:#6B6660">Jos jokin ei mennyt niin kuin piti, vastaa suoraan tähän viestiin – luemme jokaisen palautteen itse.</p>`,
          foot: `<p style="margin:0;font:12px Arial,Helvetica,sans-serif;color:#9C968E">Tilaus #${o.no}. Et halua palautepyyntöjä? Vastaa tähän viestiin sanalla "ei kiitos".</p>` }));
      n++;
    } catch (_e) { /* yritetään seuraavaa */ }
  }
  return n;
}
async function orderCfg() {
  const [S, c] = await Promise.all([site(), cfg()]), now = hel(), h = S.hours?.[now.day];
  const open = h && h[0] ? hm(h[0]) : null, close = h && h[1] ? hm(h[1]) : null;
  const isOpen = open !== null && close !== null && now.min >= open && now.min <= close - 15;
  const pre = c.preDays === 0 ? 0 : Math.min(7, +c.preDays || 2), t0 = today();
  const days = Array.from({ length: pre + 1 }, (_, i) => {
    const d = new Date(t0 + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + i); const date = d.toISOString().slice(0, 10);
    const hh = S.hours?.[["su", "ma", "ti", "ke", "to", "pe", "la"][d.getUTCDay()]];
    return { date, open: hh && hh[0] ? hm(hh[0]) : null, close: hh && hh[1] ? hm(hh[1]) : null };
  });
  return { days, preDays: pre, on: !!c.on, delivery: !!c.delivery, fee: +c.fee || 0, min: +c.min || 0, area: c.area || "", prep: +c.prep || 20, dtime: +c.dtime || 45, note: c.note || "",
    soldout: Array.isArray(c.soldout) ? c.soldout : [], firstPct: c.firstPct === 0 ? 0 : +c.firstPct || 15, loyEvery: loyOf(c).every, loyPct: loyOf(c).pct, day: now.day, now: now.min, open, close, isOpen };
}
async function placeOrder(b: any) {
  const C = await orderCfg(), S = await site();
  if (!C.on) return j({ error: "Nettitilaus ei ole juuri nyt käytössä. Soita 045 353 7000." }, 400);
  const kind = b.kind === "kuljetus" ? "kuljetus" : "nouto";
  if (kind === "kuljetus" && !C.delivery) return j({ error: "Kotiinkuljetus ei ole juuri nyt käytössä. Valitse nouto." }, 400);
  const o: any = { name: s(b.n, 80), phone: norm(s(b.p, 30)), email: s(b.e, 120).toLowerCase(), kind, note: s(b.m, 400), pay: b.pay === "kateinen" ? "kateinen" : "kortti",
    address: kind === "kuljetus" ? s(b.a, 120) : null, zip: kind === "kuljetus" ? s(b.z, 10) : null, city: kind === "kuljetus" ? s(b.ci, 40) : null,
    apt: kind === "kuljetus" ? s(b.apt, 30) || null : null, door: kind === "kuljetus" ? s(b.door, 30) || null : null, dnote: kind === "kuljetus" ? s(b.dn, 300) || null : null };
  if (!o.name || o.phone.replace(/\D/g, "").length < 7 || !/^\S+@\S+\.\S+$/.test(o.email)) return j({ error: "Täytä nimi, puhelin ja sähköposti" }, 400);
  if (kind === "kuljetus" && (!o.address || !/\d/.test(o.address) || !/^\d{5}$/.test(o.zip || "") || !o.city)) return j({ error: "Täytä toimitusosoite talon numeron kanssa, postinumero ja paikkakunta" }, 400);
  const raw = Array.isArray(b.items) ? b.items.slice(0, 40) : [];
  if (!raw.length) return j({ error: "Ostoskori on tyhjä" }, 400);
  let items;
  try { items = raw.map((x: any) => priceLine(S, C.day, x, C.soldout)); } catch (e) { return j({ error: (e as Error).message }, 400); }
  const subtotal = Math.round(items.reduce((a: number, i: any) => a + i.unit * i.q, 0) * 100) / 100;
  const fee = kind === "kuljetus" ? C.fee : 0;
  if (kind === "kuljetus" && subtotal < C.min) return j({ error: `Kotiinkuljetuksen vähimmäistilaus on ${eur(C.min)}` }, 400);
  let want = "heti";
  const lead = kind === "kuljetus" ? C.dtime : C.prep, wv = s(b.w, 16) || "heti";
  if (wv === "heti") {
    if (!C.isOpen) return j({ error: "Olemme juuri nyt kiinni. Valitse ennakkotilaukselle aika tai soita 045 353 7000." }, 400);
  } else {
    const m = wv.match(/^(?:(\d{4}-\d{2}-\d{2}) )?(\d{2}:\d{2})$/);
    const di = m ? (m[1] ? C.days.findIndex((d) => d.date === m[1]) : 0) : -1, D0 = di >= 0 ? C.days[di] : null, w = m ? hm(m[2]) : -1;
    if (!m || !D0 || D0.open === null || (m[1] && di === 0) || w < D0.open + lead - 5 || w > (D0.close ?? 0) || (di === 0 && w < C.now + lead - 5))
      return j({ error: "Valittu aika ei ole enää vapaana. Valitse toinen aika." }, 400);
    want = (di > 0 ? D0.date + " " : "") + clock(w);
  }
  if (items.some((i: any) => i.c === "Tarjous")) {
    if (kind === "kuljetus") return j({ error: "Tarjous on voimassa vain noutona. Valitse Nouto." }, 400);
    const wd = /^\d{4}-/.test(want) ? want.slice(0, 10) : today();
    if (items.some((i: any) => i.c === "Tarjous" && i.until && wd > i.until)) return j({ error: "Tarjous ei ole voimassa valitsemanasi päivänä. Valitse aikaisempi päivä." }, 400);
  }
  items.forEach((i: any) => delete i.until);
  if (/^\d{4}-/.test(want) && items.some((i: any) => i.c === "Päivän pizza")) return j({ error: "Päivän pizza on tilattavissa vain samalle päivälle. Poista se ostoskorista tai valitse aika tälle päivälle." }, 400);
  const D = discountFor(await orderCount(o.email, o.phone), C.firstPct, { every: C.loyEvery, pct: C.loyPct });
  const discount = D.pct ? Math.round((subtotal + fee) * D.pct) / 100 : 0;
  o.discount = discount; o.discount_note = D.note;
  o.want = want; o.items = items; o.subtotal = subtotal; o.fee = fee; o.total = Math.round((subtotal + fee - discount) * 100) / 100;
  if (typeof b.total === "number" && Math.abs(b.total - o.total) > 0.01) return j({ error: "Hinnat ovat muuttuneet. Tarkista ostoskori ja lähetä uudelleen.", total: o.total }, 409);
  const { data: row, error } = await db.from("orders").insert(o).select("id,no").single();
  if (error) throw error;
  const when = whenTxt(want);
  const fullAddr = kind === "kuljetus" ? `${o.address}${o.apt ? " " + o.apt : ""}, ${o.zip} ${o.city || ""}` : "";
  const kindTxt = kind === "kuljetus" ? `Kotiinkuljetus: ${fullAddr}` + (o.door ? `\nOvikoodi: ${o.door}` : "") + (o.dnote ? `\nOhjeet kuljettajalle: ${o.dnote}` : "") : "Nouto ravintolasta";
  const addrRows: [string, string][] = kind === "kuljetus" ? ([["Osoite", fullAddr]] as [string, string][]).concat(o.door ? [["Ovikoodi", o.door]] : [], o.dnote ? [["Ohjeet kuljettajalle", o.dnote]] : []) : [];
  const sum = `${lines(items)}\n\nVälisumma: ${eur(subtotal)}` + (fee ? `\nKuljetus: ${eur(fee)}` : "") + (discount ? `\n${o.discount_note}: -${eur(discount)}` : "") + `\nYhteensä: ${eur(o.total)}\n  josta ALV 13,5 %: ${eur(vat(o.total))} (veroton ${eur(o.total - vat(o.total))})\nMaksutapa: ${o.pay === "kateinen" ? "käteisellä" : "kortilla"} ${kind === "kuljetus" ? "toimitettaessa" : "noudettaessa"}`;
  await saveCustomer(o).catch(() => {});
  await Promise.allSettled([
    mail(OWNER_EMAIL, `UUSI TILAUS #${row.no}: ${kind === "kuljetus" ? "kuljetus" : "nouto"} ${when}, ${eur(o.total)}`,
      `Uusi nettitilaus #${row.no}\n\n${kindTxt}\nAika: ${when}\nNimi: ${o.name}\nPuhelin: ${o.phone}\nSähköposti: ${o.email}` + (o.note ? `\nLisätiedot: ${o.note}` : "") +
      `\n\n${sum}\n\nHyväksy tilaus kauppiasportaalissa:\n${SITE}/kauppias.html#tilaukset`, o.email,
      E.shell({ pre: `${o.name} · ${when} · ${eur(o.total)}`, tag: "Uusi tilaus", title: `Tilaus #${row.no} odottaa hyväksyntää`,
        body: E.btn(`${SITE}/kauppias.html#tilaukset`, "Avaa kauppiasportaali →") + E.infoBox([["Tapa", kind === "kuljetus" ? "Kotiinkuljetus" : "Nouto"], ["Aika", when], ["Asiakas", o.name], ["Puhelin", o.phone], ["Sähköposti", o.email]].concat(addrRows).concat(o.note ? [["Lisätiedot", o.note]] : []) as [string, string][]) +
          E.orderSummary({ ...o, no: row.no }) })),
    mail(o.email, `Tilauksesi #${row.no} on vastaanotettu – Malakai Ravintola`,
      `Hei ${o.name.split(" ")[0]}!\n\nKiitos tilauksestasi. Olemme vastaanottaneet sen, ja saat pian toisen viestin, kun tilaus on hyväksytty ja tiedämme valmistumisajan.\n\nTilausnumero: #${row.no}\n${kindTxt}\nToivottu aika: ${when}\n\n${sum}` +
      (o.note ? `\n\nLisätiedot: ${o.note}` : "") + `\n\nJos haluat muuttaa tilausta, soita 045 353 7000.\n\nMalakai Ravintola\nTampereentie 414, 33880 Lempäälä\n045 353 7000`, undefined,
      E.shell({ pre: `Tilaus #${row.no} vastaanotettu – saat pian valmistumisajan.`, tag: "Tilaus vastaanotettu", title: `Kiitos tilauksesta, ${E.esc(o.name.split(" ")[0])}!`,
        body: E.p("Olemme vastaanottaneet tilauksesi. Saat pian toisen viestin, kun ravintola on hyväksynyt sen ja tiedämme valmistumisajan.") + E.steps(0, kind === "kuljetus") +
          E.infoBox([["Tilausnumero", "#" + row.no], ["Tapa", kind === "kuljetus" ? "Kotiinkuljetus" : "Nouto ravintolasta"], ...(kind === "kuljetus" ? addrRows : [["Nouto", "Tampereentie 414, Lempäälä"]] as [string, string][]), ["Toivottu aika", when]].concat(o.note ? [["Lisätiedot", o.note]] : []) as [string, string][]) +
          E.orderSummary({ ...o, no: row.no }),
        foot: E.btn(`${SITE}/tili.html`, "Seuraa tilausta") + E.btn("tel:+358453537000", "Soita 045 353 7000", true) +
          `<p style="margin:14px 0 0;font:13px/1.5 Arial,Helvetica,sans-serif;color:#6B6660">Luo <a href="${SITE}/tili.html" style="color:#B3121F">oma tili</a> samalla sähköpostilla, niin näet tilauksesi, leimakorttisi ja etusi. Joka 10. tilaus −20 %.</p>` })),
  ]);
  return j({ ok: true, no: row.no, total: o.total, discount });
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const b = await req.json();
    if (b.website) return j({ ok: true }); // roskapostiansa
    if (b.action === "hit") {
      const ua = req.headers.get("user-agent") ?? "";
      if (!ua || /bot|crawl|spider|slurp|headless|preview|lighthouse|monitor/i.test(ua)) return j({ ok: true });
      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
      const path = s(b.p, 80).replace(/\/index\.html$/, "/").replace(/\.html$/, "") || "/";
      if (/admin|tulostus/.test(path)) return j({ ok: true });
      const day = today();
      await db.from("page_views").insert({ day, path, source: source(s(b.r, 300)),
        device: /mobile|android|iphone|ipad/i.test(ua) ? "puhelin" : "tietokone",
        visitor: await hash(`${ip}|${ua}|${day}|${SALT}`) });
      return j({ ok: true });
    }
    if (b.action === "order_cfg") return j(await orderCfg());
    if (b.action === "order") return await placeOrder(b);
    if (b.action === "first") {
      const c = await cfg(), pct = c.firstPct === 0 ? 0 : +c.firstPct || 15, L = loyOf(c), n = await orderCount(s(b.e, 120), s(b.p, 30)), D = discountFor(n, pct, L);
      return j({ first: n === 0 && pct > 0, pct, count: Math.max(0, n), every: L.every, loyPct: L.pct, loy: D.loy });
    }
    if (b.action === "reviews") {
      const { data: t } = await db.from("settings").select("value").eq("key", "cron").maybeSingle();
      if (!t?.value?.token || b.token !== t.value.token) return j({ error: "Ei oikeuksia" }, 401);
      return j({ sent: await sendReviews() });
    }
    if (b.action === "reserve") {
      const r = { name: s(b.n, 80), email: s(b.e, 120).toLowerCase(), phone: s(b.p, 30), guests: Math.min(Math.max(+b.g || 2, 1), 30),
        date: s(b.d, 10), time: s(b.t, 5), note: s(b.m, 300), source: "verkko" };
      if (!r.name || !r.phone || !/^\S+@\S+\.\S+$/.test(r.email) || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !/^\d{2}:\d{2}$/.test(r.time))
        return j({ error: "Täytä kaikki kentät" }, 400);
      if (r.date < today()) return j({ error: "Päivämäärä on menneisyydessä" }, 400);
      const { error } = await db.from("reservations").insert(r);
      if (error) throw error;
      const when = `${fd(r.date)} klo ${r.time}`;
      const ownerTxt = `Uusi pöytävaraus odottaa hyväksyntää\n\nNimi: ${r.name}\nAika: ${when}\nHenkilöitä: ${r.guests}\nPuhelin: ${r.phone}\nSähköposti: ${r.email}` +
        (r.note ? `\nToiveet: ${r.note}` : "") + `\n\nHyväksy tai peru varaus ylläpidossa:\n${SITE}/admin.html`;
      const jobs: Promise<unknown>[] = [
        mail(OWNER_EMAIL, `Uusi varaus: ${r.name}, ${when}, ${r.guests} hlö`, ownerTxt, r.email),
        sms(OWNER_PHONE, `Uusi pöytävaraus: ${r.name}, ${r.guests} hlö, ${when}. Hyväksy: ${SITE}/admin.html`),
        mail(r.email, "Varauspyyntösi on vastaanotettu",
          `Hei ${r.name}!\n\nKiitos varauksestasi. Olemme vastaanottaneet pöytävarauspyyntösi:\n${when}, ${r.guests} hlö.\n\nSaat vielä erillisen vahvistuksen, kun olemme käsitelleet varauksen.\n\nMalakai Ravintola\nTampereentie 414, 33880 Lempäälä\n045 353 7000`),
      ];
      if (b.news) jobs.push(Promise.resolve(db.from("subscribers").upsert({ email: r.email, name: r.name }, { onConflict: "email" })));
      await Promise.allSettled(jobs);
      return j({ ok: true });
    }
    if (b.action === "subscribe") {
      const email = s(b.e, 120).toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return j({ error: "Virheellinen sähköposti" }, 400);
      const { error } = await db.from("subscribers").upsert({ email, name: s(b.n, 80) || null }, { onConflict: "email" });
      if (error) throw error;
      await Promise.allSettled([mail(email, "Tervetuloa Malakai Ravintolan uutiskirjeen tilaajaksi",
        "Kiitos tilauksesta! Saat jatkossa tarjouksemme ja uutiset sähköpostiisi.\n\nVoit perua tilauksen vastaamalla tähän viestiin.\n\nMalakai Ravintola, Tampereentie 414, Lempäälä")]);
      return j({ ok: true });
    }
    return j({ error: "Tuntematon toiminto" }, 400);
  } catch (_e) {
    return j({ error: "Palvelinvirhe" }, 500);
  }
});
