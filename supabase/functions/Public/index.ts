// Vanha nimi "Public": välittää kaikki pyynnöt varsinaiselle "public"-funktiolle (yksi koodi, ei kahta versiota).
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const h: Record<string, string> = { "Content-Type": "application/json" };
  for (const k of ["stripe-signature", "user-agent", "x-forwarded-for"]) { const v = req.headers.get(k); if (v) h[k] = v; }
  const r = await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/public", { method: "POST", headers: h, body: await req.text() });
  return new Response(await r.text(), { status: r.status, headers: { ...cors, "Content-Type": "application/json" } });
});
