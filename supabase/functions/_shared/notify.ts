import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
export const OWNER_PHONE = Deno.env.get("OWNER_PHONE") ?? "+358456057475";
export const OWNER_EMAIL = Deno.env.get("OWNER_EMAIL") ?? "malakairavintola@gmail.com";
export const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};
export const j = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
export const norm = (p: string) => {
  p = p.replace(/[^\d+]/g, "");
  if (p.startsWith("00")) return "+" + p.slice(2);
  if (p.startsWith("0")) return "+358" + p.slice(1);
  if (p.startsWith("358")) return "+" + p;
  return p;
};
// Tekstiviesti: 46elks
export async function sms(to: string, message: string) {
  const auth = btoa(`${Deno.env.get("ELKS_USER")}:${Deno.env.get("ELKS_PASS")}`);
  const r = await fetch("https://api.46elks.com/a1/sms", {
    method: "POST",
    headers: { Authorization: "Basic " + auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ from: "Malakai", to, message }),
  });
  if (!r.ok) throw new Error("Tekstiviestin lähetys epäonnistui");
}
// Sähköposti: Brevo
export async function mail(to: string, subject: string, text: string) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": Deno.env.get("BREVO_KEY")!, "Content-Type": "application/json" },
    body: JSON.stringify({ sender: { name: "Malakai Ravintola", email: OWNER_EMAIL }, to: [{ email: to }], subject, textContent: text }),
  });
  if (!r.ok) throw new Error("Sähköpostin lähetys epäonnistui");
}
