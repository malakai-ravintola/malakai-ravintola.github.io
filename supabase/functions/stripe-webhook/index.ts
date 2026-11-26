// Supabase Edge Function: stripe-webhook (verify_jwt false)
// Ottaa vastaan Stripen tapahtumat ja välittää ne sellaisenaan public-funktiolle, joka tarkistaa allekirjoituksen.
// GET kertoo vain, ovatko Stripe-avaimet asetettu (ei koskaan avaimia itseään).
Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    const sk = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim(), wh = (Deno.env.get("STRIPE_WEBHOOK_SECRET") || "").trim();
    return Response.json({ STRIPE_SECRET_KEY: !sk ? "puuttuu" : /^(sk|rk)_(test|live)_/.test(sk) ? "ok" : "väärä muoto", mode: /_live_/.test(sk) ? "live" : /_test_/.test(sk) ? "test" : null, STRIPE_WEBHOOK_SECRET: !wh ? "puuttuu" : wh.startsWith("whsec_") ? "ok" : "väärä muoto" });
  }
  const sig = req.headers.get("stripe-signature") || "";
  const r = await fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/public", { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": sig }, body: await req.text() });
  return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
});
