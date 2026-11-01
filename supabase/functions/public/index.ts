// Supabase Edge Function: public  (liitä kokonaan Supabasen editoriin)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
const OWNER_PHONE = Deno.env.get("OWNER_PHONE") ?? "+358456057475";
const OWNER_EMAIL = Deno.env.get("OWNER_EMAIL") ?? "malakairavintola@gmail.com";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info" };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const norm = (p: string) => { p = p.replace(/[^\d+]/g, ""); if (p.startsWith("00")) return "+" + p.slice(2); if (p.startsWith("0")) return "+358" + p.slice(1); if (p.startsWith("358")) return "+" + p; return p; };
// Tekstiviesti (46elks). Ohitetaan, jos ELKS_USER/ELKS_PASS puuttuvat.
async function sms(to: string, message: string) {
  const u = Deno.env.get("ELKS_USER"), pw = Deno.env.get("ELKS_PASS");
  if (!u || !pw) return false;
  const r = await fetch("https://api.46elks.com/a1/sms", { method: "POST",
    headers: { Authorization: "Basic " + btoa(`${u}:${pw}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ from: "Malakai", to, message }) });
  if (!r.ok) throw new Error("Tekstiviestin lähetys epäonnistui");
  return true;
}
// Sähköposti (Brevo). Ohitetaan, jos BREVO_KEY puuttuu.
async function mail(to: string, subject: string, text: string) {
  const k = Deno.env.get("BREVO_KEY");
  if (!k) return false;
  const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST",
    headers: { "api-key": k, "Content-Type": "application/json" },
    body: JSON.stringify({ sender: { name: "Malakai Ravintola", email: OWNER_EMAIL }, to: [{ email: to }], subject, textContent: text }) });
  if (!r.ok) throw new Error("Sähköpostin lähetys epäonnistui");
  return true;
}
const s = (x: unknown, n = 200) => String(x ?? "").trim().slice(0, n);
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const b = await req.json();
    if (b.website) return j({ ok: true });
    if (b.action === "reserve") {
      const r = { name: s(b.n, 80), email: s(b.e, 120).toLowerCase(), phone: s(b.p, 30), guests: Math.min(Math.max(+b.g || 2, 1), 30),
        date: s(b.d, 10), time: s(b.t, 5), note: s(b.m, 300) };
      if (!r.name || !r.phone || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !/^\d{2}:\d{2}$/.test(r.time))
        return j({ error: "Puutteelliset tiedot" }, 400);
      const { error } = await db.from("reservations").insert(r);
      if (error) throw error;
      const txt = `Uusi pöytävaraus: ${r.name}, ${r.guests} hlö, ${r.date.split("-").reverse().join(".")} klo ${r.time}. Puh ${r.phone}.` +
        (r.note ? ` Huom: ${r.note}` : "");
      const owner = Promise.allSettled([sms(OWNER_PHONE, txt), mail(OWNER_EMAIL, "Uusi pöytävaraus", txt + (r.email ? ` Sähköposti: ${r.email}` : ""))]);
      const jobs: Promise<unknown>[] = [];
      if (/^\S+@\S+\.\S+$/.test(r.email)) {
        jobs.push(mail(r.email, "Varauspyyntösi on vastaanotettu", `Hei ${r.name}!\n\nOlemme vastaanottaneet pöytävarauspyyntösi: ${r.date.split("-").reverse().join(".")} klo ${r.time}, ${r.guests} hlö.\nVahvistamme varauksen sähköpostilla tai tekstiviestillä.\n\nMalakai Ravintola, Tampereentie 414, Lempäälä, 045 353 7000`));
        if (b.news) jobs.push(Promise.resolve(db.from("subscribers").upsert({ email: r.email, name: r.name }, { onConflict: "email" })));
      }
      await Promise.allSettled(jobs);
      const notified = (await owner).some((x) => x.status === "fulfilled" && x.value === true);
      return j({ ok: true, notified });
    }
    if (b.action === "subscribe") {
      const email = s(b.e, 120).toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return j({ error: "Virheellinen sähköposti" }, 400);
      const { error } = await db.from("subscribers").upsert({ email, name: s(b.n, 80) }, { onConflict: "email" });
      if (error) throw error;
      await Promise.allSettled([
        sms(OWNER_PHONE, `Uusi uutiskirjeen tilaaja: ${email}`),
        mail(email, "Tervetuloa Malakai Ravintolan uutiskirjeen tilaajaksi",
          "Kiitos tilauksesta! Saat jatkossa tarjouksemme ja uutiset sähköpostiisi.\n\nMalakai Ravintola, Tampereentie 414, Lempäälä"),
      ]);
      return j({ ok: true });
    }
    return j({ error: "Tuntematon toiminto" }, 400);
  } catch (_e) {
    return j({ error: "Virhe" }, 500);
  }
});
