// Supabase Edge Function: public  (liitä KOKO tiedosto Supabasen editoriin, funktion nimi: public)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
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
async function mail(to: string, subject: string, text: string, replyTo?: string) {
  if (!hasMail()) return false;
  const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST",
    headers: { "api-key": Deno.env.get("BREVO_KEY")!, "Content-Type": "application/json" },
    body: JSON.stringify({ sender: { name: "Malakai Ravintola", email: SENDER_EMAIL }, to: [{ email: to }], subject, textContent: text,
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
const MEAL = 4.9;
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
function priceLine(S: any, day: string, x: any) {
  const q = Math.min(Math.max(Math.round(+x.q || 1), 1), 20), n = s(x.n, 80), c = s(x.c, 40);
  if (c === "Päivän pizza") {
    if (!S.daily?.[day]?.name || S.daily[day].name !== n) throw new Error("Päivän pizza on vaihtunut. Päivitä sivu.");
    return { c, n, q, unit: +S.dailyPrice, opt: "Päivän pizza", m: s(x.m, 120) };
  }
  const cat = S.menu?.[c], it = cat?.items?.find((i: any[]) => i[0] === n);
  if (!it) throw new Error(`Tuotetta ${n} ei löydy. Päivitä sivu.`);
  const sz = x.s === "p" ? "p" : "n", opt: string[] = [];
  let unit: number;
  if (c === "Pizza" && n === "Oma valinta") {
    const all = String(cat.note || "").split("Täytteet:")[1]?.split(",").map((t: string) => t.trim().replace(/\.$/, "")) ?? [];
    const t = [...new Set((Array.isArray(x.t) ? x.t : []).map((v: unknown) => s(v, 40)))].filter((v) => all.includes(v as string)) as string[];
    if (t.length < 1 || t.length > 4) throw new Error("Valitse omaan pizzaan 1–4 täytettä");
    unit = OMA[sz][t.length - 1]; opt.push(sz === "p" ? "Perhe" : "Normaali", t.join(", "));
  } else {
    const has2 = +it[3] > 0;
    unit = has2 && sz === "p" ? +it[3] : +it[2];
    if (has2) opt.push(sz === "p" ? "Perhe" : "Normaali");
  }
  if (!(unit > 0)) throw new Error(`Tuotetta ${n} ei voi tilata netissä`);
  if (n === "Dippi") { const l = String(it[1]).split(",").map((v: string) => v.trim()); if (!l.includes(s(x.o, 40))) throw new Error("Valitse dipin maku"); opt.push(s(x.o, 40)); }
  else if (needsSauce(cat, it)) { if (!["Med", "Hot"].includes(s(x.o, 5))) throw new Error(`Valitse kastike: ${n}`); opt.push("Kastike " + s(x.o, 5)); }
  if (c === "Burgerit" && x.meal) { unit += MEAL; opt.push("Ateria: ranskalaiset + 0,33 l juoma"); }
  return { c, n, q, unit: Math.round(unit * 100) / 100, opt: opt.join(" · "), m: s(x.m, 120) };
}
const lines = (items: any[]) => items.map((i) => `${i.q} × ${i.n}${i.opt ? " (" + i.opt + ")" : ""}  ${eur(i.unit * i.q)}${i.m ? "\n    Lisätoive: " + i.m : ""}`).join("\n");
async function isFirst(email: string, phone: string) {
  const e = email.toLowerCase().trim(), p = norm(phone);
  if (!e && p.length < 8) return false;
  const { count } = await db.from("orders").select("id", { count: "exact", head: true }).neq("status", "peruttu").or(`email.eq."${e.replace(/"/g, "")}",phone.eq."${p.replace(/"/g, "")}"`);
  return (count ?? 0) === 0;
}
async function saveCustomer(o: any) {
  const { data: c } = await db.from("customers").select("*").eq("email", o.email).maybeSingle();
  const now = new Date().toISOString();
  const row: any = { email: o.email, name: o.name, phone: o.phone, last_order: now, orders: (c?.orders ?? 0) + 1, spent: Math.round(((+c?.spent || 0) + o.total) * 100) / 100 };
  if (o.address) { row.address = o.address; row.zip = o.zip; row.city = o.city; }
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
        `(Tilaus #${o.no}. Et halua palautepyyntöjä jatkossa? Vastaa tähän viestiin sanalla "ei kiitos".)`);
      n++;
    } catch (_e) { /* yritetään seuraavaa */ }
  }
  return n;
}
async function orderCfg() {
  const [S, c] = await Promise.all([site(), cfg()]), now = hel(), h = S.hours?.[now.day];
  const open = h && h[0] ? hm(h[0]) : null, close = h && h[1] ? hm(h[1]) : null;
  const isOpen = open !== null && close !== null && now.min >= open && now.min <= close - 15;
  return { on: !!c.on, delivery: !!c.delivery, fee: +c.fee || 0, min: +c.min || 0, area: c.area || "", prep: +c.prep || 20, dtime: +c.dtime || 45, note: c.note || "",
    firstPct: c.firstPct === 0 ? 0 : +c.firstPct || 15, day: now.day, now: now.min, open, close, isOpen };
}
async function placeOrder(b: any) {
  const C = await orderCfg(), S = await site();
  if (!C.on) return j({ error: "Nettitilaus ei ole juuri nyt käytössä. Soita 045 353 7000." }, 400);
  if (!C.isOpen) return j({ error: "Olemme kiinni tai sulkemassa. Tilaa aukioloaikana tai soita 045 353 7000." }, 400);
  const kind = b.kind === "kuljetus" ? "kuljetus" : "nouto";
  if (kind === "kuljetus" && !C.delivery) return j({ error: "Kotiinkuljetus ei ole juuri nyt käytössä. Valitse nouto." }, 400);
  const o: any = { name: s(b.n, 80), phone: norm(s(b.p, 30)), email: s(b.e, 120).toLowerCase(), kind, note: s(b.m, 400),
    address: kind === "kuljetus" ? s(b.a, 120) : null, zip: kind === "kuljetus" ? s(b.z, 10) : null, city: kind === "kuljetus" ? s(b.ci, 40) : null };
  if (!o.name || o.phone.replace(/\D/g, "").length < 7 || !/^\S+@\S+\.\S+$/.test(o.email)) return j({ error: "Täytä nimi, puhelin ja sähköposti" }, 400);
  if (kind === "kuljetus" && (!o.address || !/^\d{5}$/.test(o.zip || ""))) return j({ error: "Täytä toimitusosoite ja postinumero" }, 400);
  const raw = Array.isArray(b.items) ? b.items.slice(0, 40) : [];
  if (!raw.length) return j({ error: "Ostoskori on tyhjä" }, 400);
  let items;
  try { items = raw.map((x: any) => priceLine(S, C.day, x)); } catch (e) { return j({ error: (e as Error).message }, 400); }
  const subtotal = Math.round(items.reduce((a: number, i: any) => a + i.unit * i.q, 0) * 100) / 100;
  const fee = kind === "kuljetus" ? C.fee : 0;
  if (kind === "kuljetus" && subtotal < C.min) return j({ error: `Kotiinkuljetuksen vähimmäistilaus on ${eur(C.min)}` }, 400);
  let want = "heti";
  if (b.w && b.w !== "heti") {
    const w = hm(s(b.w, 5)), lead = kind === "kuljetus" ? C.dtime : C.prep;
    if (!/^\d{2}:\d{2}$/.test(s(b.w, 5)) || w < C.now + lead - 5 || w > (C.close ?? 0)) return j({ error: "Valitse toinen aika (aikaisintaan " + clock(Math.ceil((C.now + lead) / 5) * 5) + ")" }, 400);
    want = clock(w);
  }
  const first = C.firstPct > 0 && await isFirst(o.email, o.phone);
  const discount = first ? Math.round((subtotal + fee) * C.firstPct) / 100 : 0;
  o.discount = discount; o.discount_note = first ? `Ensitilaus -${C.firstPct} %` : null;
  o.want = want; o.items = items; o.subtotal = subtotal; o.fee = fee; o.total = Math.round((subtotal + fee - discount) * 100) / 100;
  if (typeof b.total === "number" && Math.abs(b.total - o.total) > 0.01) return j({ error: "Hinnat ovat muuttuneet. Tarkista ostoskori ja lähetä uudelleen.", total: o.total }, 409);
  const { data: row, error } = await db.from("orders").insert(o).select("id,no").single();
  if (error) throw error;
  const when = want === "heti" ? "mahdollisimman pian" : "klo " + want.replace(":", ".");
  const kindTxt = kind === "kuljetus" ? `Kotiinkuljetus: ${o.address}, ${o.zip} ${o.city || ""}` : "Nouto ravintolasta";
  const sum = `${lines(items)}\n\nVälisumma: ${eur(subtotal)}` + (fee ? `\nKuljetus: ${eur(fee)}` : "") + (discount ? `\n${o.discount_note}: -${eur(discount)}` : "") + `\nYhteensä: ${eur(o.total)}\n  josta ALV 13,5 %: ${eur(vat(o.total))} (veroton ${eur(o.total - vat(o.total))})\nMaksu: ${kind === "kuljetus" ? "toimitettaessa" : "noudettaessa"}`;
  await saveCustomer(o).catch(() => {});
  await Promise.allSettled([
    mail(OWNER_EMAIL, `UUSI TILAUS #${row.no}: ${kind === "kuljetus" ? "kuljetus" : "nouto"} ${when}, ${eur(o.total)}`,
      `Uusi nettitilaus #${row.no}\n\n${kindTxt}\nAika: ${when}\nNimi: ${o.name}\nPuhelin: ${o.phone}\nSähköposti: ${o.email}` + (o.note ? `\nLisätiedot: ${o.note}` : "") +
      `\n\n${sum}\n\nHyväksy tilaus tilausnäytöllä:\n${SITE}/admin.html#tilaukset`, o.email),
    mail(o.email, `Tilauksesi #${row.no} on vastaanotettu – Malakai Ravintola`,
      `Hei ${o.name.split(" ")[0]}!\n\nKiitos tilauksestasi. Olemme vastaanottaneet sen, ja saat pian toisen viestin, kun tilaus on hyväksytty ja tiedämme valmistumisajan.\n\nTilausnumero: #${row.no}\n${kindTxt}\nToivottu aika: ${when}\n\n${sum}` +
      (o.note ? `\n\nLisätiedot: ${o.note}` : "") + `\n\nJos haluat muuttaa tilausta, soita 045 353 7000.\n\nMalakai Ravintola\nTampereentie 414, 33880 Lempäälä\n045 353 7000`),
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
    if (b.action === "first") { const c = await cfg(); const pct = c.firstPct === 0 ? 0 : +c.firstPct || 15; return j({ first: pct > 0 && await isFirst(s(b.e, 120), s(b.p, 30)), pct }); }
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
