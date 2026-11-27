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
// ---------- Stripe (avaimet Supabasen salaisuuksissa: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
const SK = () => (Deno.env.get("STRIPE_SECRET_KEY") ?? "").trim();
const payMode = () => /^(sk|rk)_live_/.test(SK()) ? "live" : /^(sk|rk)_test_/.test(SK()) ? "test" : "";
// Nettitilausten verkkomaksu (Stripe). false = asiakas maksaa paikan päällä kortilla tai käteisellä.
// Stripe-avaimet ja koodi säilyvät; laita true, kun verkkomaksu otetaan taas käyttöön. Lahjakorttien osto käyttää Stripeä aina.
const ORDER_PAY_ONLINE = false;
const orderPay = () => ORDER_PAY_ONLINE ? payMode() : "";
async function stripe(path: string, params?: Record<string, string>, idem?: string) {
  const r = await fetch("https://api.stripe.com/v1/" + path, { method: params ? "POST" : "GET",
    headers: { Authorization: "Bearer " + SK(), ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}), ...(idem ? { "Idempotency-Key": idem } : {}) },
    body: params ? new URLSearchParams(params) : undefined });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || "Stripe " + r.status);
  return d;
}
async function hookOk(raw: string, sig: string) {
  const sec = (Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "").trim();
  if (!sec || !sig) return false;
  const parts = Object.fromEntries(sig.split(",").map((p) => p.split("=")).filter((p) => p.length === 2 && p[0] === "t")) as Record<string, string>;
  const t = parts.t, v1 = sig.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !v1.length || Math.abs(Date.now() / 1000 - +t) > 600) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(sec), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`))), (b) => b.toString(16).padStart(2, "0")).join("");
  return v1.some((x) => x.length === mac.length && [...x].every((c, i) => c === mac[i]));
}
// Maksamaton tilaus poistetaan (kuponki palautuu peruttu-triggerin kautta)
async function dropUnpaid(id: string) {
  const { data } = await db.from("orders").update({ status: "peruttu", reason: "Maksu keskeytyi" }).eq("id", id).eq("status", "maksu").select("id");
  if (data?.length) await db.from("orders").delete().eq("id", id).eq("status", "peruttu").is("paid_at", null);
}
async function markPaid(id: string, pi: string) {
  const { data } = await db.from("orders").update({ status: "uusi", pay_status: "maksettu", paid_at: new Date().toISOString(), stripe_pi: pi || null }).eq("id", id).eq("status", "maksu").select("*");
  if (data?.length) await afterPlaced(data[0]);
  return !!data?.length;
}
async function stripeHook(raw: string, sig: string) {
  if (!(await hookOk(raw, sig))) return j({ error: "bad signature" }, 400);
  const ev = JSON.parse(raw), o = ev.data?.object ?? {};
  if (o.metadata?.kind === "gift" && o.metadata?.gift_id) {
    if ((ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") && o.payment_status === "paid") await markGiftPaid(o.metadata.gift_id, o.payment_intent);
    else if (ev.type === "checkout.session.expired") await dropGift(o.metadata.gift_id);
    return j({ received: true });
  }
  if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") {
    const id = o.metadata?.order_id;
    if (id && o.payment_status === "paid" && !(await markPaid(id, o.payment_intent))) {
      const { data: ex } = await db.from("orders").select("id,paid_at").eq("id", id).maybeSingle();
      if (!ex && o.payment_intent) await stripe("refunds", { payment_intent: o.payment_intent, "metadata[syy]": "tilaus poistettu ennen maksua" }, "orphan-" + o.payment_intent).catch(() => {});
    }
  } else if (ev.type === "checkout.session.expired") {
    if (o.metadata?.order_id) await dropUnpaid(o.metadata.order_id);
  } else if (ev.type === "charge.refunded") {
    if (o.payment_intent) await db.from("orders").update({ pay_status: o.refunded ? "palautettu" : "osapalautus", refunded_at: new Date().toISOString() }).eq("stripe_pi", o.payment_intent);
  }
  return j({ received: true });
}
// ---------- Lahjakortit
const GIFT_MIN = 10, GIFT_MAX = 300, GIFT_MONTHS = 12;
const giftCode = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", r = crypto.getRandomValues(new Uint8Array(8)); const c = Array.from(r, (b) => A[b % A.length]).join(""); return `MALA-${c.slice(0, 4)}-${c.slice(4)}`; };
const fdt = (d: string | Date) => new Date(d).toLocaleDateString("fi-FI", { timeZone: "Europe/Helsinki" });
async function dropGift(id: string) { await db.from("gift_cards").delete().eq("id", id).eq("status", "maksu"); }
async function markGiftPaid(id: string, pi: string) {
  for (let i = 0; i < 5; i++) {
    const exp = new Date(); exp.setMonth(exp.getMonth() + GIFT_MONTHS);
    const { data, error } = await db.from("gift_cards").update({ code: giftCode(), status: "aktiivinen", paid_at: new Date().toISOString(), expires_at: exp.toISOString(), stripe_pi: pi || null }).eq("id", id).eq("status", "maksu").select("*");
    if (error && /duplicate|unique/i.test(error.message)) continue;
    if (data?.length) { await db.from("gift_cards").update({ balance: data[0].amount }).eq("id", id); await giftMails({ ...data[0], balance: data[0].amount }); return true; }
    return false;
  }
  return false;
}
async function giftMails(g: any) {
  const gift = g.mode === "gift" && g.recipient_email, to = gift ? g.recipient_email : g.buyer_email, toName = (gift ? g.recipient_name : g.buyer_name) || "";
  const fn = (x: string) => String(x || "").split(" ")[0], exp = fdt(g.expires_at), amt = eur(+g.amount);
  const howTxt = `Näin käytät lahjakortin:\n- Nettitilaus: malakairavintola.fi/tilaa.html – kirjoita koodi kohtaan "Lahjakortti".\n- Ravintolassa: näytä koodi kassalla.\nLahjakortin voi käyttää useassa osassa, ja jäljellä oleva saldo säilyy voimassaoloajan loppuun.`;
  const txt = `Hei ${fn(toName)}!\n\n${gift ? `${g.buyer_name || "Ystäväsi"} lähetti sinulle Malakai Ravintolan lahjakortin!` : "Kiitos ostoksesta! Tässä lahjakorttisi."}${g.message ? `\n\nViesti: "${g.message}"` : ""}\n\nArvo: ${amt}\nKoodi: ${g.code}\nVoimassa: ${exp} asti\n\n${howTxt}\n\nMalakai Ravintola\nTampereentie 414, 33880 Lempäälä\n045 353 7000`;
  const html = E.shell({ pre: `${amt} lahjakortti – koodi ${g.code}`, tag: "Lahjakortti", title: gift ? `${E.esc(fn(toName) || "Hei")}, sait lahjakortin!` : `Lahjakorttisi on valmis, ${E.esc(fn(toName))}!`,
    body: (gift ? E.p(`<b>${E.esc(g.buyer_name || "Ystäväsi")}</b> lähetti sinulle Malakai Ravintolan lahjakortin.`) : E.p("Kiitos ostoksesta! Tässä lahjakorttisi – säilytä koodi.")) + E.giftCard(amt, g.code, exp, g.message || "", gift ? (g.buyer_name || "") : "") +
      E.infoBox([["Nettitilaus", "Kirjoita koodi tilaussivulla kohtaan Lahjakortti"], ["Ravintolassa", "Näytä koodi kassalla"], ["Saldo", "Voi käyttää useassa osassa"], ["Voimassa", exp + " asti"]]),
    foot: E.btn(`${E.SITE}/tilaa.html?lahjakortti=${encodeURIComponent(g.code)}`, "Tilaa ja käytä lahjakortti") + E.btn(`${E.SITE}/ruokalista.html`, "Katso ruokalista", true) });
  const jobs: Promise<unknown>[] = [mail(to, gift ? `${g.buyer_name || "Ystäväsi"} lähetti sinulle lahjakortin – Malakai Ravintola` : `Lahjakorttisi ${amt} – Malakai Ravintola`, txt, undefined, html)];
  if (gift) jobs.push(mail(g.buyer_email, `Kuitti: lahjakortti ${amt} lähetetty – Malakai Ravintola`,
    `Hei ${fn(g.buyer_name)}!\n\nKiitos ostoksesta! Lähetimme ${amt} lahjakortin osoitteeseen ${g.recipient_email}${g.recipient_name ? ` (${g.recipient_name})` : ""}.\n\nKoodi: ${g.code}\nVoimassa: ${exp} asti\n\nMalakai Ravintola · Y-tunnus 3305891-1\nTampereentie 414, 33880 Lempäälä`, undefined,
    E.shell({ pre: `Lahjakortti lähetetty: ${g.recipient_email}`, tag: "Kuitti", title: `Kiitos, ${E.esc(fn(g.buyer_name))}!`,
      body: E.p(`Lähetimme lahjakortin osoitteeseen <b>${E.esc(g.recipient_email)}</b>${g.recipient_name ? ` (${E.esc(g.recipient_name)})` : ""}.`) + E.infoBox([["Arvo", amt], ["Koodi", g.code], ["Voimassa", exp + " asti"], ["Maksettu", fdt(g.paid_at || new Date()) + " · netissä"], ["Myyjä", "Malakai Ravintola, Y-tunnus 3305891-1"]]) + E.p("Jos lahjan saaja ei löydä viestiä, pyydä häntä tarkistamaan roskaposti – tai anna koodi hänelle itse.") })));
  jobs.push(mail(OWNER_EMAIL, `LAHJAKORTTI MYYTY: ${amt} (${g.code})`, `Lahjakortti myyty ja maksettu netissä.\n\nArvo: ${amt}\nKoodi: ${g.code}\nOstaja: ${g.buyer_name} <${g.buyer_email}>${gift ? `\nSaaja: ${g.recipient_name || ""} <${g.recipient_email}>` : ""}\nVoimassa: ${exp} asti`));
  await Promise.allSettled(jobs);
  await db.from("gift_cards").update({ sent_at: new Date().toISOString() }).eq("id", g.id);
}
async function giftBuy(b: any) {
  const PM = payMode(); if (!PM) return j({ error: "Lahjakortin osto ei ole juuri nyt käytössä. Soita 045 353 7000." }, 400);
  const amount = Math.round(+b.amount), mode = b.mode === "gift" ? "gift" : "self";
  if (!(amount >= GIFT_MIN && amount <= GIFT_MAX)) return j({ error: `Valitse summa ${GIFT_MIN}–${GIFT_MAX} €` }, 400);
  const g: any = { amount, mode, buyer_name: s(b.n, 80), buyer_email: s(b.e, 120).toLowerCase(), recipient_name: mode === "gift" ? s(b.rn, 80) || null : null, recipient_email: mode === "gift" ? s(b.re, 120).toLowerCase() : null, message: mode === "gift" ? s(b.msg, 300) || null : null };
  if (!g.buyer_name) return j({ error: "Kirjoita nimesi" }, 400);
  { const bad = await emailOk(g.buyer_email); if (bad) return j({ error: bad }, 400); }
  if (mode === "gift") { if (!g.recipient_email) return j({ error: "Kirjoita lahjan saajan sähköposti" }, 400); const bad = await emailOk(g.recipient_email); if (bad) return j({ error: "Lahjan saaja: " + bad }, 400); }
  const { data: row, error } = await db.from("gift_cards").insert(g).select("id").single();
  if (error) throw error;
  const ret = `${SITE}/lahjakortti.html?g=${row.id}&maksu=`;
  try {
    const ses = await stripe("checkout/sessions", { mode: "payment", locale: "fi", customer_email: g.buyer_email, client_reference_id: row.id,
      "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "eur", "line_items[0][price_data][unit_amount]": String(amount * 100),
      "line_items[0][price_data][product_data][name]": `Malakai Ravintola – lahjakortti ${amount} €`,
      "line_items[0][price_data][product_data][description]": mode === "gift" ? `Lähetetään sähköpostilla: ${g.recipient_email}` : `Lähetetään sähköpostilla: ${g.buyer_email}`,
      "metadata[kind]": "gift", "metadata[gift_id]": row.id, "payment_intent_data[metadata][kind]": "gift", "payment_intent_data[metadata][gift_id]": row.id, "payment_intent_data[description]": `Malakai lahjakortti ${amount} €`,
      expires_at: String(Math.floor(Date.now() / 1000) + 31 * 60), success_url: ret + "ok", cancel_url: ret + "peruttu" }, "gift-" + row.id);
    await db.from("gift_cards").update({ stripe_session: ses.id }).eq("id", row.id);
    return j({ ok: true, pay_url: ses.url, g: row.id });
  } catch (_e) { await dropGift(row.id); return j({ error: "Maksun avaaminen epäonnistui. Yritä hetken päästä uudelleen." }, 502); }
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
const DEL_CUT = 30; // kotiinkuljetus päättyy 30 min ennen sulkemista
const clock = (m: number) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
// ---------- Tilaajan tarkistus: oikea sähköposti + puhelin, vahvistuskoodi, estolista
const DISPOSABLE = ["mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "temp-mail.org", "yopmail.com", "trashmail.com", "sharklasers.com", "getnada.com", "dispostable.com", "maildrop.cc", "fakeinbox.com", "throwawaymail.com", "emailondeck.com", "mintemail.com", "tempmailo.com", "moakt.com", "mohmal.com", "tempail.com", "burnermail.io", "spamgourmet.com", "mailnesia.com", "inboxkitten.com"];
const phoneOk = (p: string) => /^\+358\d{7,10}$/.test(p) || /^\+(?!358)\d{8,15}$/.test(p);
async function emailOk(e: string) {
  const m = e.match(/^[^\s@]+@([^\s@]+\.[a-z]{2,})$/i);
  if (!m) return "Tarkista sähköpostiosoite";
  const d = m[1].toLowerCase();
  if (DISPOSABLE.some((x) => d === x || d.endsWith("." + x))) return "Käytä omaa sähköpostiosoitettasi – kertakäyttöiset osoitteet eivät käy.";
  try { const mx = await Deno.resolveDns(d, "MX"); if (!mx.length) return "Sähköpostiosoitteen verkkotunnusta ei löydy – tarkista osoite."; }
  catch (err) { if (/NotFound|NXDomain|no record|not found/i.test(String((err as Error)?.name) + " " + String(err))) return "Sähköpostiosoitteen verkkotunnusta ei löydy – tarkista osoite."; }
  return "";
}
const isBlocked = (c: any, e: string, p: string) => (c.blocked?.e || []).includes(e) || (c.blocked?.p || []).includes(p);
const rnd = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
const code6 = () => String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
async function sendCode(email: string, phone: string) {
  const c = await cfg();
  if (isBlocked(c, email, phone)) return { error: "Nettitilausta ei voi tehdä näillä tiedoilla. Soita 045 353 7000.", st: 403 };
  const bad = await emailOk(email); if (bad) return { error: bad, st: 400 };
  if (!phoneOk(phone)) return { error: "Tarkista puhelinnumero (esim. 040 123 4567).", st: 400 };
  const { data: r } = await db.from("verify_codes").select("*").eq("email", email).maybeSingle();
  const inWin = r && Date.now() - new Date(r.window_start).getTime() < 3600e3;
  if (inWin && r.sends >= 5) return { error: "Liian monta koodipyyntöä. Odota hetki tai soita 045 353 7000.", st: 429 };
  const code = code6();
  await db.from("verify_codes").upsert({ email, code, expires: new Date(Date.now() + 15 * 60e3).toISOString(), tries: 0, sends: inWin ? r.sends + 1 : 1, window_start: inWin ? r.window_start : new Date().toISOString() });
  await mail(email, `Vahvistuskoodisi: ${code} – Malakai Ravintola`, `Vahvistuskoodisi on ${code}\n\nKirjoita koodi tilaussivulle vahvistaaksesi sähköpostiosoitteesi. Koodi on voimassa 15 minuuttia.\n\nJos et tilannut Malakaista, voit jättää tämän viestin huomiotta.\n\nMalakai Ravintola, 045 353 7000`, undefined,
    E.shell({ pre: `Vahvistuskoodi ${code}`, tag: "Vahvista tilaus", title: "Vahvistuskoodisi", body: E.big(code, "Koodi") + E.p("Kirjoita koodi tilaussivulle. Koodi on voimassa 15 minuuttia. Vahvistus tehdään vain kerran – seuraavat tilaukset tältä laitteelta menevät suoraan läpi.") + E.p("Jos et tilannut Malakaista, voit jättää tämän viestin huomiotta.") }));
  return { ok: true };
}
async function cfg() { const { data } = await db.from("settings").select("value").eq("key", "orders").maybeSingle(); return data?.value ?? { on: false }; }
function needsSauce(cat: any, it: any[]) { return /Med tai Hot/i.test((cat.note || "") + " " + (it[1] || "")); }
const LIHA: Record<string, number> = { Tuplaliha: 5, Triplaliha: 10 };
const POT: Record<string, number> = { "Ranskalaiset": 0, "Ristikkoperunat": 1, "Kierreperunat": 1, "Crispers-ranskanperunat": 1 }, DIP = 1.5;
const dipList = (S: any) => String((S.menu?.["Dipit ja juomat"]?.items || []).find((i: any[]) => i[0] === "Dippi")?.[1] || "").split(",").map((v: string) => v.trim()).filter(Boolean);
const WN = (it: any[]) => { const m = /^Hot Wings (\d+) kpl/i.exec(String(it?.[0] || "")); return m ? +m[1] : 0; };
const freeDips = (it: any[]) => { const w = WN(it); return !w ? 1 : w <= 16 ? 1 : w <= 25 ? 2 : 3; };
const dipTxt = (cat: any, it: any[]) => /\bdip/i.test((cat.note || "") + " " + (it[1] || ""));
const hasDip = (S: any, cat: any, it: any[]) => it[0] !== "Dippi" && dipList(S).length > 0 && (WN(it) > 0 || cat === S.menu?.Lisukkeet || dipTxt(cat, it));
function priceLine(S: any, day: string, x: any, out: string[] = []) {
  const q = Math.min(Math.max(Math.round(+x.q || 1), 1), 20), n = s(x.n, 80), c = s(x.c, 40);
  if (out.includes((c === "Päivän pizza" ? "Pizza" : c) + "|" + n)) throw new Error(`${n} on valitettavasti loppu. Poista se ostoskorista.`);
  const ALL = String(S.menu?.Pizza?.note || "").split("Täytteet:")[1]?.split(",").map((t: string) => t.trim().replace(/\.$/, "")) ?? [];
  const pick = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).map((t: unknown) => s(t, 40)))].filter((t) => ALL.includes(t as string)).slice(0, 30) as string[];
  const ex = pick(x.x);
  const SPICE = ["Tuore valkosipuli", "Oregano"], sp = [...new Set((Array.isArray(x.sp) ? x.sp : []).map((v: unknown) => s(v, 30)))].filter((v) => SPICE.includes(v as string)) as string[];
  if (c === "Päivän pizza") {
    if (!S.daily?.[day]?.name || S.daily[day].name !== n) throw new Error("Päivän pizza on vaihtunut. Päivitä sivu.");
    return { c, n, q, unit: Math.round((+S.dailyPrice + ex.length * XT.n) * 100) / 100, opt: ["Päivän pizza", sp.length ? "Mausteet: " + sp.join(", ") : "", ex.length ? "Lisätäytteet: " + ex.join(", ") : ""].filter(Boolean).join(" · "), m: s(x.m, 120) };
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
    const tx = t.map((_: string, i: number) => pick(Array.isArray(x.tx) ? x.tx[i] : []));
    const nx = tx.reduce((a: number, l: string[]) => a + l.length, 0);
    return { c, n, q, unit: Math.round((pr + nx * XT.n) * 100) / 100, opt: ["Pizzat: " + t.map((p: string, i: number) => p + (tx[i].length ? " (+ " + tx[i].join(", ") + ")" : "")).join(", "), /juoma/i.test(of.text || "") ? "1,5 l juoma" : "", "vain nouto"].filter(Boolean).join(" · "), m: s(x.m, 120), until: of.until || "" };
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
  if (c === "Pizza" && sp.length) opt.push("Mausteet: " + sp.join(", "));
  if ((c === "Kebab" || c === "Kana") && x.hot) opt.push("Tulinen");
  if (n === "Dippi") { const l = String(it[1]).split(",").map((v: string) => v.trim()); if (!l.includes(s(x.o, 40))) throw new Error("Valitse dipin maku"); opt.push(s(x.o, 40)); }
  else if (needsSauce(cat, it)) { const ok = ["Med", "Hot"]; if (!ok.includes(s(x.o, 5))) throw new Error(`Valitse kastike: ${n}`); opt.push("Kastike " + s(x.o, 5)); }
  if (c === "Dipit ja juomat" && /^Juoma/i.test(n) && String(it[1] || "").trim()) { const L = String(it[1]).split(",").map((v: string) => v.trim()), dr = s(x.dr, 40); if (!L.includes(dr)) throw new Error(`Valitse juoma: ${n}`); opt.push(dr); }
  if (c === "Kebab" && x.l) { const l = s(x.l, 12); if (!(l in LIHA)) throw new Error(`Tarkista lihavalinta: ${n}`); unit += LIHA[l]; opt.push(l); }
  if (n === "Kanakori" || c === "Sticky Fingers") { const pt = s(x.pt, 30) || "Ranskalaiset"; if (!(pt in POT)) throw new Error(`Tarkista perunat: ${n}`); unit += POT[pt]; opt.push("Perunat: " + pt); }
  if (hasDip(S, cat, it)) { const L = dipList(S), d = [...new Set((Array.isArray(x.d) ? x.d : []).map((v: unknown) => s(v, 40)))].filter((v) => L.includes(v as string)).slice(0, 8) as string[];
    if (!d.length && !WN(it) && dipTxt(cat, it)) throw new Error(`Valitse dippi: ${n}`); unit += Math.max(0, d.length - freeDips(it)) * DIP; if (d.length) opt.push("Dipit: " + d.join(", ")); }
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
  const { count } = await db.from("orders").select("id", { count: "exact", head: true }).not("status", "in", "(peruttu,maksu)").or(`email.eq."${e.replace(/"/g, "")}",phone.eq."${p.replace(/"/g, "")}"`);
  return count ?? 0;
}
// Leimakortti korvattu bonusjärjestelmällä (1 € = 1 piste)
const loyOf = (_c: any) => ({ every: 0, pct: 0 });
const BONUS = { rate: 1, round: 300, tiers: [{ p: 50, e: 1 }, { p: 90, e: 2 }, { p: 120, e: 4 }, { p: 150, e: 10 }, { p: 200, e: 15 }, { p: 250, e: 20 }, { p: 300, e: 25 }], minMul: 2 };
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
  const paused = !!c.pauseUntil && Date.now() < Date.parse(c.pauseUntil);
  const isOpen = !paused && open !== null && close !== null && now.min >= open && now.min <= close - 15;
  const delNow = !!c.delivery && isOpen && close !== null && now.min <= close - DEL_CUT;
  const pre = c.preDays === 0 ? 0 : Math.min(7, +c.preDays || 2), t0 = today();
  const days = Array.from({ length: pre + 1 }, (_, i) => {
    const d = new Date(t0 + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + i); const date = d.toISOString().slice(0, 10);
    const hh = S.hours?.[["su", "ma", "ti", "ke", "to", "pe", "la"][d.getUTCDay()]];
    return { date, open: hh && hh[0] ? hm(hh[0]) : null, close: hh && hh[1] ? hm(hh[1]) : null };
  });
  return { days, preDays: pre, paused, pauseUntil: paused ? c.pauseUntil : null, delCut: DEL_CUT, delNow, on: !!c.on, delivery: !!c.delivery, fee: +c.fee || 0, min: +c.min || 0, area: c.area || "", prep: +c.prep || 20, dtime: +c.dtime || 45, note: c.note || "",
    pay: orderPay(), bonus: BONUS, soldout: Array.isArray(c.soldout) ? c.soldout : [], hidden: Array.isArray(c.hidden) ? c.hidden : [], firstPct: c.firstPct === 0 ? 0 : +c.firstPct || 15, loyEvery: loyOf(c).every, loyPct: loyOf(c).pct, day: now.day, now: now.min, open, close, isOpen };
}
// Tilaus vastaanotettu (maksettu tai maksetaan paikan päällä): asiakastiedot + sähköpostit
async function afterPlaced(o: any) {
  const row = { id: o.id, no: o.no }, kind = o.kind, want = o.want, items = o.items || [], subtotal = +o.subtotal, fee = +o.fee || 0;
  o.total = +o.total; o.discount = +o.discount || 0;
  const when = whenTxt(want);
  const fullAddr = kind === "kuljetus" ? `${o.address}${o.apt ? " " + o.apt : ""}, ${o.zip} ${o.city || ""}` : "";
  const kindTxt = kind === "kuljetus" ? `Kotiinkuljetus: ${fullAddr}` + (o.door ? `\nOvikoodi: ${o.door}` : "") + (o.dnote ? `\nOhjeet kuljettajalle: ${o.dnote}` : "") : "Nouto ravintolasta";
  const addrRows: [string, string][] = kind === "kuljetus" ? ([["Osoite", fullAddr]] as [string, string][]).concat(o.door ? [["Ovikoodi", o.door]] : [], o.dnote ? [["Ohjeet kuljettajalle", o.dnote]] : []) : [];
  const sum = `${lines(items)}\n\nVälisumma: ${eur(subtotal)}` + (fee ? `\nKuljetus: ${eur(fee)}` : "") + (o.discount ? `\n${o.discount_note}: -${eur(o.discount)}` : "") + `\nYhteensä: ${eur(o.total)}\n  josta ALV 13,5 %: ${eur(vat(o.total))} (veroton ${eur(o.total - vat(o.total))})${+o.gift_amt ? `\nLahjakortilla: -${eur(+o.gift_amt)}` : ""}\nMaksutapa: ${o.pay === "lahjakortti" ? "lahjakortti" : o.pay === "netti" ? "maksettu netissä" : (o.pay === "kateinen" ? "käteisellä " : "kortilla ") + (kind === "kuljetus" ? "toimitettaessa" : "noudettaessa")}`;
  await saveCustomer(o).catch(() => {});
  await Promise.allSettled([
    mail(OWNER_EMAIL, `UUSI TILAUS #${row.no}${o.pay === "netti" ? " (MAKSETTU)" : ""}: ${kind === "kuljetus" ? "kuljetus" : "nouto"} ${when}, ${eur(o.total)}`,
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
          `<p style="margin:14px 0 0;font:13px/1.5 Arial,Helvetica,sans-serif;color:#6B6660">Luo <a href="${SITE}/tili.html" style="color:#B3121F">oma tili</a> samalla sähköpostilla, niin näet tilauksesi, bonuspisteesi ja kuponkisi. Saat ${Math.floor(o.total)} pistettä tästä tilauksesta, kun se on luovutettu – jo 50 pisteellä saat −1 € kupongin ja 300 pisteellä −25 €.</p>` })),
  ]);
}
async function placeOrder(b: any) {
  const C = await orderCfg(), S = await site();
  if (!C.on) return j({ error: "Nettitilaus ei ole juuri nyt käytössä. Soita 045 353 7000." }, 400);
  const kind = b.kind === "kuljetus" ? "kuljetus" : "nouto";
  if (kind === "kuljetus" && !C.delivery) return j({ error: "Kotiinkuljetus ei ole juuri nyt käytössä. Valitse nouto." }, 400);
  const PM = orderPay(); let online = PM === "live" || (PM === "test" && b.pt === true);
  const o: any = { name: s(b.n, 80), phone: norm(s(b.p, 30)), email: s(b.e, 120).toLowerCase(), kind, note: s(b.m, 400), pay: online ? "netti" : b.pay === "kateinen" ? "kateinen" : "kortti",
    address: kind === "kuljetus" ? s(b.a, 120) : null, zip: kind === "kuljetus" ? s(b.z, 10) : null, city: kind === "kuljetus" ? s(b.ci, 40) : null,
    apt: kind === "kuljetus" ? s(b.apt, 30) || null : null, door: kind === "kuljetus" ? s(b.door, 30) || null : null, dnote: kind === "kuljetus" ? s(b.dn, 300) || null : null };
  if (!o.name || o.phone.replace(/\D/g, "").length < 7 || !/^\S+@\S+\.\S+$/.test(o.email)) return j({ error: "Täytä nimi, puhelin ja sähköposti" }, 400);
  if (!phoneOk(o.phone)) return j({ error: "Tarkista puhelinnumero (esim. 040 123 4567)." }, 400);
  const RAW = await cfg();
  if (isBlocked(RAW, o.email, o.phone)) return j({ error: "Nettitilausta ei voi tehdä näillä tiedoilla. Soita 045 353 7000." }, 403);
  if (kind === "kuljetus" && (!o.address || !/\d/.test(o.address) || !/^\d{5}$/.test(o.zip || "") || !o.city)) return j({ error: "Täytä toimitusosoite talon numeron kanssa, postinumero ja paikkakunta" }, 400);
  const raw = Array.isArray(b.items) ? b.items.slice(0, 40) : [];
  if (!raw.length) return j({ error: "Ostoskori on tyhjä" }, 400);
  let items;
  try { items = raw.map((x: any) => priceLine(S, C.day, x, C.soldout.concat(C.hidden))); } catch (e) { return j({ error: (e as Error).message }, 400); }
  const subtotal = Math.round(items.reduce((a: number, i: any) => a + i.unit * i.q, 0) * 100) / 100;
  const fee = kind === "kuljetus" ? C.fee : 0;
  if (kind === "kuljetus" && subtotal < C.min) return j({ error: `Kotiinkuljetuksen vähimmäistilaus on ${eur(C.min)}` }, 400);
  let want = "heti";
  const lead = kind === "kuljetus" ? C.dtime : C.prep, wv = s(b.w, 16) || "heti";
  if (wv === "heti") {
    if (!C.isOpen) return j({ error: C.paused ? "Nettitilaus on hetken tauolla. Valitse ennakkotilaukselle aika tai soita 045 353 7000." : "Olemme juuri nyt kiinni. Valitse ennakkotilaukselle aika tai soita 045 353 7000." }, 400);
    if (kind === "kuljetus" && !C.delNow) return j({ error: `Kotiinkuljetus päättyy ${DEL_CUT} min ennen sulkemista. Valitse nouto tai soita 045 353 7000.` }, 400);
  } else {
    const m = wv.match(/^(?:(\d{4}-\d{2}-\d{2}) )?(\d{2}:\d{2})$/);
    const di = m ? (m[1] ? C.days.findIndex((d) => d.date === m[1]) : 0) : -1, D0 = di >= 0 ? C.days[di] : null, w = m ? hm(m[2]) : -1;
    if (!m || !D0 || D0.open === null || (m[1] && di === 0) || w < D0.open + lead - 5 || w > (D0.close ?? 0) - (kind === "kuljetus" ? DEL_CUT : 0) || (di === 0 && w < C.now + lead - 5))
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
  let CP: { id: string; eur: number } | null = null;
  if (b.cp) {
    const { data: u } = await db.auth.getUser(s(b.at, 4000));
    if (!u?.user || String(u.user.email || "").toLowerCase() !== o.email) return j({ error: "Kirjaudu omalle tilillesi samalla sähköpostilla, niin voit käyttää bonuskupongin." }, 400);
    const { data: k } = await db.from("bonus_coupons").select("id,eur,used_at").eq("id", s(b.cp, 40)).eq("email", o.email).maybeSingle();
    if (!k || k.used_at) return j({ error: "Kuponki on jo käytetty tai sitä ei löydy. Päivitä sivu." }, 400);
    const ce = +k.eur;
    if (o.total < ce * BONUS.minMul) return j({ error: `Kuponki −${ce} € vaatii vähintään ${eur(ce * BONUS.minMul)} tilauksen.` }, 400);
    CP = { id: k.id, eur: ce };
    o.discount = Math.round((discount + ce) * 100) / 100; o.discount_note = [D.note, `Bonuskuponki −${ce} €`].filter(Boolean).join(" + ");
    o.total = Math.round((o.total - ce) * 100) / 100; o.bonus_coupon = k.id;
  }
  if (typeof b.total === "number" && Math.abs(b.total - o.total) > 0.01) return j({ error: "Hinnat ovat muuttuneet. Tarkista ostoskori ja lähetä uudelleen.", total: o.total }, 409);
  const { count: openN } = await db.from("orders").select("id", { count: "exact", head: true }).in("status", ["uusi", "maksu"]).or(`email.eq."${o.email.replace(/"/g, "")}",phone.eq."${o.phone.replace(/"/g, "")}"`);
  if ((openN ?? 0) >= 2) return j({ error: "Sinulla on jo tilauksia odottamassa hyväksyntää. Odota vahvistusta tai soita 045 353 7000." }, 429);
  { const bad = await emailOk(o.email); if (bad) return j({ error: bad }, 400); }
  if (CP) { const { data: lk } = await db.from("bonus_coupons").update({ used_at: new Date().toISOString() }).eq("id", CP.id).is("used_at", null).select("id"); if (!lk?.length) return j({ error: "Kuponki on jo käytetty. Päivitä sivu." }, 400); }
  let GC: { card_id: string; taken: number; use_id: number } | null = null;
  if (b.gc) {
    const { data: gt, error: ge } = await db.rpc("gift_take", { p_code: s(b.gc, 20).toUpperCase(), p_max: o.total });
    if (ge || !gt?.length) { if (CP) await db.from("bonus_coupons").update({ used_at: null }).eq("id", CP.id); return j({ error: "Lahjakorttia ei löydy, se on vanhentunut tai saldo on käytetty." }, 400); }
    GC = { card_id: gt[0].card_id, taken: +gt[0].taken, use_id: +gt[0].use_id };
    o.gift_card = GC.card_id; o.gift_amt = GC.taken;
  }
  let payable = Math.round((o.total - (o.gift_amt || 0)) * 100) / 100;
  // Stripen pienin veloitus on 0,50 €: jätetään tarvittaessa pieni osa lahjakortin saldoon
  if (GC && online && payable > 0 && payable < 0.5) {
    const back = Math.round((0.5 - payable) * 100) / 100;
    const { data: gcr } = await db.from("gift_cards").select("balance").eq("id", GC.card_id).single();
    await db.from("gift_cards").update({ balance: Math.round((+gcr!.balance + back) * 100) / 100, status: "aktiivinen" }).eq("id", GC.card_id);
    GC.taken = Math.round((GC.taken - back) * 100) / 100; o.gift_amt = GC.taken; payable = 0.5;
    await db.from("gift_card_uses").update({ amount: GC.taken }).eq("id", GC.use_id);
  }
  if (online && payable <= 0) { online = false; o.pay = "lahjakortti"; }
  if (online) { o.status = "maksu"; o.pay_status = "odottaa"; }
  const { data: row, error } = await db.from("orders").insert(o).select("id,no").single();
  if (error) { if (CP) await db.from("bonus_coupons").update({ used_at: null }).eq("id", CP.id); if (GC) { await db.from("gift_card_uses").delete().eq("id", GC.use_id); const { data: gcr } = await db.from("gift_cards").select("balance").eq("id", GC.card_id).single(); await db.from("gift_cards").update({ balance: +gcr!.balance + GC.taken, status: "aktiivinen" }).eq("id", GC.card_id); } throw error; }
  if (GC) await db.from("gift_card_uses").update({ order_no: row.no }).eq("id", GC.use_id);
  if (CP) { await db.from("bonus_coupons").update({ used_order: row.no }).eq("id", CP.id); await db.from("bonus_log").insert({ email: o.email, order_no: row.no, delta: 0, note: `Kuponki −${CP.eur} € käytetty, tilaus #${row.no}` }); }
  if (online) {
    const cents = Math.round(payable * 100), ret = `${SITE}/tilaa.html?t=${row.id}&maksu=`;
    try {
      const ses = await stripe("checkout/sessions", { mode: "payment", locale: "fi", customer_email: o.email, client_reference_id: row.id,
        "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "eur", "line_items[0][price_data][unit_amount]": String(cents),
        "line_items[0][price_data][product_data][name]": `Malakai Ravintola – tilaus #${row.no}`,
        "line_items[0][price_data][product_data][description]": items.map((i: any) => `${i.q} × ${i.n}`).join(", ").slice(0, 300) + (kind === "kuljetus" ? " · kotiinkuljetus" : " · nouto"),
        "metadata[order_id]": row.id, "metadata[no]": String(row.no), "payment_intent_data[metadata][order_id]": row.id, "payment_intent_data[description]": `Malakai tilaus #${row.no}`,
        expires_at: String(Math.floor(Date.now() / 1000) + 31 * 60), success_url: ret + "ok", cancel_url: ret + "peruttu" }, "ord-" + row.id);
      await db.from("orders").update({ stripe_session: ses.id }).eq("id", row.id);
      return j({ ok: true, pay_url: ses.url, t: row.id, no: row.no, total: o.total, gift: o.gift_amt || 0, discount: o.discount, earn: Math.floor(o.total) });
    } catch (e) {
      await dropUnpaid(row.id);
      return j({ error: "Maksun avaaminen epäonnistui. Yritä hetken päästä uudelleen tai soita 045 353 7000." }, 502);
    }
  }
  await afterPlaced({ ...o, id: row.id, no: row.no });
  return j({ ok: true, no: row.no, total: o.total, gift: o.gift_amt || 0, discount: o.discount, earn: Math.floor(o.total) });
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sig = req.headers.get("stripe-signature");
    if (sig) return await stripeHook(await req.text(), sig);
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
    if (b.action === "pay_status" || b.action === "pay_cancel") {
      const id = s(b.t, 40);
      if (!/^[0-9a-f-]{36}$/.test(id)) return j({ error: "Virheellinen tilaus" }, 400);
      let { data: o } = await db.from("orders").select("id,no,status,pay_status,stripe_session,total,discount,kind,email").eq("id", id).maybeSingle();
      if (o && o.status === "maksu" && o.stripe_session && SK()) {
        const ses = await stripe("checkout/sessions/" + o.stripe_session).catch(() => null);
        if (ses?.payment_status === "paid") { await markPaid(id, ses.payment_intent); o.status = "uusi"; o.pay_status = "maksettu"; }
        else if (b.action === "pay_cancel") {
          if (ses?.status === "open") await stripe(`checkout/sessions/${o.stripe_session}/expire`, {}).catch(() => {});
          await dropUnpaid(id); o = null;
        }
      }
      if (!o) return j({ status: "poistettu" });
      return j({ status: o.status, paid: o.pay_status === "maksettu" || o.pay_status === "palautettu", no: o.no, total: +o.total, discount: +o.discount || 0, earn: Math.floor(+o.total), kind: o.kind });
    }
    if (b.action === "gift_buy") return await giftBuy(b);
    if (b.action === "gift_check") {
      const code = s(b.code, 20).toUpperCase().replace(/\s+/g, "");
      if (!/^MALA-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return j({ error: "Tarkista koodi (muotoa MALA-XXXX-XXXX)" }, 400);
      const { data: g } = await db.from("gift_cards").select("balance,status,expires_at").eq("code", code).maybeSingle();
      if (!g || g.status === "maksu") return j({ error: "Lahjakorttia ei löydy. Tarkista koodi." }, 404);
      if (g.expires_at && Date.parse(g.expires_at) < Date.now()) return j({ error: "Lahjakortti on vanhentunut." }, 400);
      if (!(+g.balance > 0)) return j({ error: "Lahjakortin saldo on käytetty." }, 400);
      return j({ ok: true, code, balance: +g.balance, expires: g.expires_at });
    }
    if (b.action === "gift_status" || b.action === "gift_cancel") {
      const id = s(b.g, 40);
      if (!/^[0-9a-f-]{36}$/.test(id)) return j({ error: "Virheellinen" }, 400);
      let { data: g } = await db.from("gift_cards").select("id,status,stripe_session,amount,mode,recipient_email,buyer_email").eq("id", id).maybeSingle();
      if (g && g.status === "maksu" && g.stripe_session && SK()) {
        const ses = await stripe("checkout/sessions/" + g.stripe_session).catch(() => null);
        if (ses?.payment_status === "paid") { await markGiftPaid(id, ses.payment_intent); g.status = "aktiivinen"; }
        else if (b.action === "gift_cancel") { if (ses?.status === "open") await stripe(`checkout/sessions/${g.stripe_session}/expire`, {}).catch(() => {}); await dropGift(id); g = null; }
      }
      if (!g) return j({ status: "poistettu" });
      return j({ status: g.status, amount: +g.amount, to: g.mode === "gift" ? g.recipient_email : g.buyer_email, gift: g.mode === "gift" });
    }
    if (b.action === "rate") {
      const id = s(b.id, 40), e = s(b.e, 120).toLowerCase(), r = Math.round(+b.r);
      if (!/^[0-9a-f-]{36}$/.test(id) || !(r >= 1 && r <= 5)) return j({ error: "Virheellinen arvio" }, 400);
      const { data, error } = await db.from("orders").update({ rating: r, rating_note: s(b.t, 300) || null, rated_at: new Date().toISOString() }).eq("id", id).eq("email", e).eq("status", "luovutettu").is("rating", null).select("id");
      if (error) throw error;
      return data?.length ? j({ ok: true }) : j({ error: "Tilausta ei voi arvioida" }, 400);
    }
    if (b.action === "verify_send") { const r: any = await sendCode(s(b.e, 120).toLowerCase(), norm(s(b.p, 30))); return j(r.ok ? { ok: true } : { error: r.error }, r.ok ? 200 : r.st); }
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
