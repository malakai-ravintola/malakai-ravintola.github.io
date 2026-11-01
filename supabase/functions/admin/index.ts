import { cors, db, j, mail, norm, OWNER_EMAIL, sms } from "../_shared/notify.ts";
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
      await sms(norm(r.phone), msg);
      if (r.email) await mail(r.email, b.ok ? "Varauksesi on vahvistettu" : "Varauksesta", msg).catch(() => {});
      await db.from("reservations").update({ status: b.ok ? "vahvistettu" : "peruttu" }).eq("id", b.id);
      return j({ ok: true });
    }
    if (b.action === "sms") { await sms(norm(String(b.to)), String(b.text).slice(0, 600)); return j({ ok: true }); }
    if (b.action === "newsletter") {
      const { data: subs } = await db.from("subscribers").select("email,name");
      let n = 0;
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
