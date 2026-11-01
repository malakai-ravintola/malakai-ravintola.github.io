// Supabase Edge Function: admin  (liitä kokonaan Supabasen editoriin)
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
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const tok = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
    const { data } = await db.auth.getUser(tok);
    if (!data.user || data.user.email !== OWNER_EMAIL) return j({ error: "Ei oikeuksia" }, 401);
    const b = await req.json();
    if (b.action === "confirm") {
      const { data: r } = await db.from("reservations").select("*").eq("id", b.id).single();
      if (!r) return j({ error: "Varausta ei löydy" }, 404);
      const dt = r.date.split("-").reverse().join(".");
      const msg = b.ok
        ? `Hei ${r.name}! Pöytävarauksesi Malakai Ravintolaan on vahvistettu: ${dt} klo ${String(r.time).slice(0, 5)}, ${r.guests} hlö. Tervetuloa! Tampereentie 414, Lempäälä.`
        : `Hei ${r.name}! Valitettavasti emme voi vahvistaa pöytävarausta toivomaasi aikaan. Soita 045 353 7000, niin sovitaan toinen aika. Malakai Ravintola`;
      const res = await Promise.allSettled([sms(norm(r.phone), msg),
        r.email ? mail(r.email, b.ok ? "Varauksesi on vahvistettu" : "Varauksesta", msg) : Promise.resolve(false)]);
      await db.from("reservations").update({ status: b.ok ? "vahvistettu" : "peruttu" }).eq("id", b.id);
      const sent = res.some((x) => x.status === "fulfilled" && x.value === true);
      return j({ ok: true, sent });
    }
    if (b.action === "sms") { if (!(await sms(norm(String(b.to)), String(b.text).slice(0, 600)))) return j({ error: "Tekstiviestit eivät ole käytössä (46elks-avaimet puuttuvat)" }, 400); return j({ ok: true }); }
    if (b.action === "newsletter") {
      const { data: subs } = await db.from("subscribers").select("email,name");
      let n = 0;
      if (!Deno.env.get("BREVO_KEY")) return j({ error: "Sähköpostit eivät ole käytössä (BREVO_KEY puuttuu)" }, 400);
      for (const s of subs ?? []) {
        await mail(s.email, String(b.subject),
          String(b.body).replaceAll("{nimi}", s.name || "asiakkaamme") +
          "\n\n--\nMalakai Ravintola, Tampereentie 414, Lempäälä\nVoit perua tilauksen vastaamalla tähän viestiin.");
        n++;
      }
      return j({ sent: n });
    }
    return j({ error: "Tuntematon toiminto" }, 400);
  } catch (e) {
    return j({ error: String((e as Error).message ?? e) }, 500);
  }
});
