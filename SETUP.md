# Malakai Ravintola – automaattisen varaus- ja uutiskirjejärjestelmän käyttöönotto

Kun nämä vaiheet on tehty, asiakkaan varaus tulee automaattisesti tekstiviestinä numeroosi +358 45 6057475 ja sähköpostiisi, ja tallentuu ylläpitosivulle (admin.html).
Ennen käyttöönottoa sivu toimii silti: viesti avautuu asiakkaan omassa viestisovelluksessa.

## 1. Tietokanta ja kirjautuminen (Supabase, ilmainen)
1. Luo tili ja projekti osoitteessa supabase.com.
2. SQL Editor: liitä tiedoston `supabase/schema.sql` sisältö ja paina Run.
3. Authentication > Users > Add user: sähköposti `malakairavintola@gmail.com` ja oma salasanasi.
4. Authentication > Sign In / Providers: **kytke "Allow new users to sign up" pois**, ettei kukaan muu voi luoda tunnusta.
5. Project Settings > API: kopioi **Project URL** ja **anon public** -avain tiedostoon `config.js`.

## 2. Tekstiviestit (46elks)
1. Luo tili osoitteessa 46elks.com ja lataa tilille muutama euro.
2. Kopioi API username ja API password (Dashboard > Account).

## 3. Sähköpostit (Brevo, ilmainen 300 viestiä/pv)
1. Luo tili osoitteessa brevo.com.
2. Senders > lisää ja vahvista lähettäjäksi `malakairavintola@gmail.com`.
3. SMTP & API > API Keys: luo avain.

## 4. Palvelinfunktiot (Supabasen selaimessa)
Edge Functions > Deploy a new function > Via Editor. Tee kaksi funktiota:
- nimi `public`: liitä koko `supabase/functions/public/index.ts`, paina Deploy.
- nimi `admin`: liitä koko `supabase/functions/admin/index.ts`, paina Deploy.

Edge Functions > Secrets: lisää `BREVO_KEY` (sähköposti) ja halutessasi `ELKS_USER` + `ELKS_PASS` (tekstiviestit).
Jos avaimia ei ole, varaukset tallentuvat silti adminiin ja asiakasta pyydetään lisäksi lähettämään viesti itse.

## 5. Julkaisu
Siirrä kansion tiedostot repoon `malakai-ravintola.github.io` (index.html, admin.html, config.js, media/-kansio ja supabase/). Sivu päivittyy osoitteeseen malakairavintola.fi, ylläpito on osoitteessa malakairavintola.fi/admin.html.

## Huomioita
- Tekstiviesteistä veloitetaan 46elksin hinnan mukaan (muutama sentti/kpl). Brevo ja Supabase ovat ilmaisia pienellä käytöllä.
- Pelkkä Gmail-osoite lähettäjänä voi päätyä vastaanottajilla roskapostiin. Parempi toimitus: vahvista oma verkkotunnus (malakairavintola.fi) Brevossa ja käytä sen osoitetta.
- Uutiskirjeisiin kannattaa lisätä peruutusohje (lisätään automaattisesti) ja tilaajilta tulee olla suostumus.
- Tätä ei ole testattu oikeilla tileillä; tee ensimmäinen testivaraus itse.
