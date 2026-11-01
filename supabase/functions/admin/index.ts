// Supabase Edge Function: admin  (liitä KOKO tiedosto Supabasen editoriin, funktion nimi: admin)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
const OWNER_PHONE = Deno.env.get("OWNER_PHONE") ?? "+358456057475";
const OWNER_EMAIL = Deno.env.get("OWNER_EMAIL") ?? "hardi7fateh@hotmail.com";
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
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const tok = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
    const { data } = await db.auth.getUser(tok);
    if (!data.user || data.user.email !== OWNER_EMAIL) return j({ error: "Ei oikeuksia" }, 401);
    const b = await req.json();
    if (b.action === "status") return j({ mail: hasMail(), sms: hasSms() });
    // Hyväksy tai peru varaus ja lähetä asiakkaalle viesti
    if (b.action === "reply") {
      const status = b.status === "vahvistettu" ? "vahvistettu" : "peruttu";
      const { data: r } = await db.from("reservations").select("*").eq("id", b.id).single();
      if (!r) return j({ error: "Varausta ei löydy" }, 404);
      const body = String(b.body ?? "").slice(0, 3000), sub = String(b.subject ?? "").slice(0, 200) || "Pöytävarauksesi";
      const res = { mail: false, sms: false, errors: [] as string[] };
      if (b.email && r.email && body) { try { res.mail = await mail(r.email, sub, body); } catch (e) { res.errors.push((e as Error).message); } }
      if (b.sms && r.phone && body) { try { res.sms = await sms(r.phone, body.slice(0, 600)); } catch (e) { res.errors.push((e as Error).message); } }
      await db.from("reservations").update({ status, handled_at: new Date().toISOString() }).eq("id", b.id);
      return j({ ok: true, ...res });
    }
    if (b.action === "sms") {
      if (!(await sms(String(b.to), String(b.text).slice(0, 600)))) return j({ error: "Tekstiviestit eivät ole käytössä (46elks-avaimet puuttuvat)" }, 400);
      return j({ ok: true });
    }
    if (b.action === "newsletter") {
      if (!hasMail()) return j({ error: "Sähköpostit eivät ole käytössä (BREVO_KEY puuttuu)" }, 400);
      const { data: subs } = await db.from("subscribers").select("email,name");
      let n = 0;
      for (const s of subs ?? []) {
        try {
          await mail(s.email, String(b.subject), String(b.body).replaceAll("{nimi}", s.name || "asiakkaamme") +
            "\n\n--\nMalakai Ravintola, Tampereentie 414, Lempäälä\nVoit perua tilauksen vastaamalla tähän viestiin.");
          n++;
        } catch (_e) { /* jatketaan seuraavaan */ }
      }
      return j({ sent: n });
    }
    return j({ error: "Tuntematon toiminto" }, 400);
  } catch (e) {
    return j({ error: String((e as Error).message ?? e) }, 500);
  }
});
