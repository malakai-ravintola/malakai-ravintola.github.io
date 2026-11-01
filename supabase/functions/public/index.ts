// Supabase Edge Function: public  (liitä KOKO tiedosto Supabasen editoriin, funktion nimi: public)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
const OWNER_PHONE = Deno.env.get("OWNER_PHONE") ?? "+358456057475";
const OWNER_EMAIL = Deno.env.get("OWNER_EMAIL") ?? "malakairavintola@gmail.com";
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") ?? OWNER_EMAIL;
const SITE = "https://malakairavintola.fi";
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
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const b = await req.json();
    if (b.website) return j({ ok: true }); // roskapostiansa
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
