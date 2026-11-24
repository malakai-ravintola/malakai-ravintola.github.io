// Supabase Edge Function: admin  (liitä KOKO tiedosto Supabasen editoriin, funktion nimi: admin)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import * as E from "./email.ts";
const OWNER_PHONE = Deno.env.get("OWNER_PHONE") ?? "+358456057475";
const OWNER_EMAIL = "hardi7fateh@hotmail.com"; // ainoa ylläpitäjä
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
async function mail(to: string, subject: string, text: string, replyTo?: string, html?: string) {
  if (!hasMail()) return false;
  const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST",
    headers: { "api-key": Deno.env.get("BREVO_KEY")!, "Content-Type": "application/json" },
    body: JSON.stringify({ sender: { name: "Malakai Ravintola", email: SENDER_EMAIL }, to: [{ email: to }], subject, textContent: text, ...(html ? { htmlContent: html } : {}),
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
      if (b.email && r.email && body) { try { res.mail = await mail(r.email, sub, body, undefined, E.shell({ pre: sub, tag: status === "vahvistettu" ? "Pöytävaraus vahvistettu" : "Pöytävaraus", title: E.esc(sub), body: E.textToHtml(body) })); } catch (e) { res.errors.push((e as Error).message); } }
      if (b.sms && r.phone && body) { try { res.sms = await sms(r.phone, body.slice(0, 600)); } catch (e) { res.errors.push((e as Error).message); } }
      await db.from("reservations").update({ status, handled_at: new Date().toISOString() }).eq("id", b.id);
      return j({ ok: true, ...res });
    }
    // Nettitilauksen tila: hyväksy (valmistumisaika), valmis, luovutettu, peru. Asiakas saa sähköpostin.
    if (b.action === "order") {
      const st = ["hyvaksytty", "valmis", "luovutettu", "peruttu"].includes(b.status) ? b.status : null;
      if (!st) return j({ error: "Virheellinen tila" }, 400);
      const { data: o } = await db.from("orders").select("*").eq("id", b.id).single();
      if (!o) return j({ error: "Tilausta ei löydy" }, 404);
      const up: Record<string, unknown> = { status: st };
      if (st === "hyvaksytty") { up.eta = String(b.eta ?? "").slice(0, 5); up.handled_at = new Date().toISOString(); }
      if (st === "peruttu") { up.reason = String(b.reason ?? "").slice(0, 300); up.handled_at = new Date().toISOString(); }
      if (st === "luovutettu" || st === "valmis") up.done_at = new Date().toISOString();
      const { error } = await db.from("orders").update(up).eq("id", b.id);
      if (error) throw error;
      const pm = String(o.want || "").match(/^(\d{4})-(\d{2})-(\d{2}) /), pd = pm ? ["su", "ma", "ti", "ke", "to", "pe", "la"][new Date(`${pm[1]}-${pm[2]}-${pm[3]}T12:00:00Z`).getUTCDay()] + ` ${+pm[3]}.${+pm[2]}. ` : "";
      const fn = String(o.name || "").split(" ")[0], del = o.kind === "kuljetus", eta = pd + "klo " + String(up.eta ?? o.eta ?? "").replace(":", ".");
      const foot = "\n\nMalakai Ravintola\nTampereentie 414, 33880 Lempäälä\n045 353 7000";
      const eur = (n: number) => Number(n).toFixed(2).replace(".", ",") + " €";
      const items = (o.items || []).map((i: any) => `${i.q} × ${i.n}${i.opt ? " (" + i.opt + ")" : ""}`).join("\n");
      let sub = "", txt = "", html = "";
      const H = (pre: string, tag: string, title: string, body: string) => E.shell({ pre, tag, title, body, foot: E.btn(`${E.SITE}/tili.html`, "Seuraa tilausta") + E.btn("tel:+358453537000", "Soita meille", true) });
      if (st === "hyvaksytty") {
        sub = `Tilauksesi #${o.no} on vahvistettu – ${del ? "perillä noin" : "valmiina noin"} ${eta}`;
        txt = `Hei ${fn}!\n\nTilauksesi #${o.no} on vahvistettu ja se on työn alla.\n\n${del ? `Toimitamme sen osoitteeseen ${o.address}${o.apt ? " " + o.apt : ""}, ${o.zip} noin ${eta}.` : `Tilauksesi on noudettavissa noin ${eta} osoitteesta Tampereentie 414, Lempäälä.`}\n\n${items}\n\nYhteensä ${eur(o.total)} (sis. ALV 13,5 % ${eur(Math.round(o.total * 13.5 / 113.5 * 100) / 100)}), maksu ${o.pay === "kateinen" ? "käteisellä" : "kortilla"} ${del ? "toimitettaessa" : "noudettaessa"}.` + foot;
        html = H(`${del ? "Perillä" : "Valmiina"} noin ${eta}`, "Tilaus vahvistettu", `Tilauksesi #${o.no} on työn alla, ${E.esc(fn)}!`,
          E.p(del ? "Valmistamme tilaustasi, ja kuljettaja tuo sen sinulle." : "Valmistamme tilaustasi. Tervetuloa noutamaan!") + E.big(eta, del ? "Arvioitu toimitus" : "Valmiina noudettavaksi") + E.steps(1, del) +
          E.infoBox([["Tilausnumero", "#" + o.no], [del ? "Toimitusosoite" : "Nouto", del ? `${o.address}${o.apt ? " " + o.apt : ""}, ${o.zip} ${o.city || ""}` : "Tampereentie 414, Lempäälä"]]) + E.orderSummary(o));
      } else if (st === "peruttu") {
        sub = `Tilauksesi #${o.no} on valitettavasti peruttu`;
        txt = `Hei ${fn}!\n\nEmme valitettavasti pysty toimittamaan tilaustasi #${o.no}.` + (up.reason ? `\n\nSyy: ${up.reason}` : "") + `\n\nPahoittelemme. Voit soittaa meille numeroon 045 353 7000.` + foot;
        html = E.shell({ pre: "Emme valitettavasti pysty toimittamaan tilaustasi.", tag: "Tilaus peruttu", title: `Pahoittelemme, ${E.esc(fn)}`,
          body: E.p(`Emme valitettavasti pysty toimittamaan tilaustasi #${o.no}.`) + (up.reason ? E.infoBox([["Syy", String(up.reason)]]) : "") + E.p("Tilauksesta ei veloiteta mitään. Soita meille, niin etsitään korvaava vaihtoehto.") + E.itemsHtml(o.items || []),
          foot: E.btn("tel:+358453537000", "Soita 045 353 7000") + E.btn(`${E.SITE}/tilaa.html`, "Tilaa uudelleen", true) });
      } else if (st === "valmis" && !del && b.notify) {
        sub = `Tilauksesi #${o.no} on valmis noudettavaksi`;
        txt = `Hei ${fn}!\n\nTilauksesi #${o.no} on valmis. Tervetuloa noutamaan: Tampereentie 414, Lempäälä.` + foot;
        html = H("Tervetuloa noutamaan!", "Valmis noudettavaksi", `Tilauksesi #${o.no} on valmis!`, E.p("Ruokasi odottaa lämpimänä tiskillä. Tervetuloa noutamaan!") + E.big("Tampereentie 414", "Noutopaikka") + E.steps(2, false) + E.orderSummary(o));
      } else if (st === "valmis" && del && b.notify) {
        sub = `Tilauksesi #${o.no} on matkalla`;
        txt = `Hei ${fn}!\n\nTilauksesi #${o.no} on lähtenyt kuljetukseen ja on pian perillä.` + foot;
        html = H("Ruokasi on matkalla!", "Matkalla", `Tilauksesi #${o.no} on matkalla!`, E.p(`Kuljettaja on lähtenyt, ja ruoka on pian perillä osoitteessa ${E.esc(o.address)}.`) + E.steps(2, true) + E.orderSummary(o));
      }
      let sent = false, err = "";
      if (sub && o.email) { try { sent = await mail(o.email, sub, txt, undefined, html || undefined); } catch (e) { err = (e as Error).message; } }
      return j({ ok: true, mail: sent, error: err || undefined });
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
          const bt = String(b.body).replaceAll("{nimi}", s.name || "asiakkaamme");
          await mail(s.email, String(b.subject), bt + "\n\n--\nMalakai Ravintola, Tampereentie 414, Lempäälä\nVoit perua tilauksen vastaamalla tähän viestiin.", undefined,
            E.shell({ pre: String(b.subject), tag: "Uutiskirje", title: E.esc(String(b.subject)), body: E.textToHtml(bt), foot: E.btn(`${E.SITE}/tilaa.html`, "Tilaa netistä") + `<p style="margin:14px 0 0;font:12px Arial,Helvetica,sans-serif;color:#9C968E">Voit perua uutiskirjeen vastaamalla tähän viestiin.</p>` }));
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
