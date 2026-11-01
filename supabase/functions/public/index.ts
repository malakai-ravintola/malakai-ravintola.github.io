import { cors, db, j, mail, OWNER_EMAIL, OWNER_PHONE, sms } from "../_shared/notify.ts";
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
      const jobs: Promise<unknown>[] = [sms(OWNER_PHONE, txt), mail(OWNER_EMAIL, "Uusi pöytävaraus", txt + (r.email ? ` Sähköposti: ${r.email}` : ""))];
      if (/^\S+@\S+\.\S+$/.test(r.email)) {
        jobs.push(mail(r.email, "Varauspyyntösi on vastaanotettu", `Hei ${r.name}!\n\nOlemme vastaanottaneet pöytävarauspyyntösi: ${r.date.split("-").reverse().join(".")} klo ${r.time}, ${r.guests} hlö.\nVahvistamme varauksen sähköpostilla tai tekstiviestillä.\n\nMalakai Ravintola, Tampereentie 414, Lempäälä, 045 353 7000`));
        if (b.news) jobs.push(Promise.resolve(db.from("subscribers").upsert({ email: r.email, name: r.name }, { onConflict: "email" })));
      }
      await Promise.allSettled(jobs);
      return j({ ok: true });
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
