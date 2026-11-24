// Malakai Ravintola – sähköpostipohja (sama tiedosto public- ja admin-funktioissa)
export const SITE = "https://malakairavintola.fi";
const IMG = SITE + "/media/email/";
const Y = "#E3A51C", R = "#B3121F", INK = "#0B0B0B", MUT = "#6B6660", LINE = "#ECE8E1";
export const esc = (t: unknown) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
export const eur = (n: number) => Number(n || 0).toFixed(2).replace(".", ",") + " €";
const MAP: Record<string, string> = { "Tropicana": "tropicana", "Kebab Pizza": "kebab", "Mexicana": "mexicana", "Americano": "americano", "Mamma Mia": "mammamia", "Julia": "julia",
  "Opera Special": "opera", "Barbeque": "bbq", "Margarita Mozzarella": "margarita", "Oma valinta": "oma", "Kebab ranskalaisilla": "kebab-ranskalaiset", "Rullakebab": "kebabrulla",
  "Kana ranskalaisilla": "kana-ranskalaiset", "Kebabsalaatti": "kebabsalaatti", "Iskender": "iskender", "Kanasalaatti": "kanasalaatti", "Kana riisillä": "kana-riisi", "Malakai Special": "malakai-special",
  "Ranskalaiset": "ranskalaiset", "Ristikkoperunat": "ristikko", "Kierreperunat": "kierre", "Crispers-ranskanperunat": "crispers", "Bataattiranskalaiset": "bataatti", "Mozzarellatikut 5 kpl": "mozzarellatikut", "Kananugetit 5 kpl": "nugetit", "Kanakori": "kanakori" };
export function imgFor(n: string, c = "") {
  const k = c === "Tarjous" ? "tarjous" : MAP[n] || (/rulla$/i.test(n) ? "rulla" : /^Sticky Fingers/.test(n) ? "sticky" : /^Hot ?wings/i.test(n) ? "wings" : /burgeri$/i.test(n) ? "burgeri"
    : c === "Lisukkeet" ? "kat-lisukkeet" : "tuote");
  return IMG + k + ".jpg";
}
export function itemsHtml(items: any[]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">` + items.map((i) => `
<tr><td style="padding:12px 0;border-bottom:1px solid ${LINE};width:72px;vertical-align:middle"><img src="${imgFor(i.n, i.c)}" width="60" height="60" alt="" style="display:block;width:60px;height:60px;border-radius:12px;border:0"></td>
<td style="padding:12px 12px;border-bottom:1px solid ${LINE};vertical-align:middle;font:15px/1.35 Arial,Helvetica,sans-serif;color:${INK}"><b>${esc(i.q)} × ${esc(i.n)}</b>${i.opt ? `<br><span style="font-size:13px;color:${MUT}">${esc(i.opt)}</span>` : ""}${i.m ? `<br><span style="font-size:13px;color:#9A6A00">Toive: ${esc(i.m)}</span>` : ""}</td>
<td style="padding:12px 0;border-bottom:1px solid ${LINE};vertical-align:middle;text-align:right;white-space:nowrap;font:bold 15px Arial,Helvetica,sans-serif;color:${INK}">${i.unit != null ? eur(i.unit * i.q) : ""}</td></tr>`).join("") + `</table>`;
}
export function sumHtml(rows: [string, string, string?][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">` + rows.map(([a, b, k]) => {
    const big = k === "tot", small = k === "small", disc = k === "disc";
    const st = big ? `font:bold 18px Arial,Helvetica,sans-serif;color:${INK};padding:10px 0 4px;border-top:2px solid ${INK}` : `font:${small ? "13px" : "15px"} Arial,Helvetica,sans-serif;color:${disc ? "#1F8A4C" : small ? MUT : INK};padding:4px 0`;
    return `<tr><td style="${st}">${esc(a)}</td><td style="${st};text-align:right;white-space:nowrap">${esc(b)}</td></tr>`;
  }).join("") + `</table>`;
}
export function steps(st: number, del: boolean) {
  const l = ["Vastaanotettu", "Hyväksytty", del ? "Matkalla" : "Valmis", del ? "Perillä" : "Noudettu"];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 6px"><tr>` + l.map((t, i) =>
    `<td style="width:25%;padding:0 3px;vertical-align:top"><div style="height:6px;border-radius:3px;background:${i <= st ? Y : "#E2DED6"}"></div><div style="font:${i <= st ? "bold " : ""}12px Arial,Helvetica,sans-serif;color:${i <= st ? INK : "#9C968E"};text-align:center;padding-top:6px">${t}</div></td>`).join("") + `</tr></table>`;
}
export const infoBox = (rows: [string, string][]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F4;border:1px solid ${LINE};border-radius:12px;margin:18px 0">` +
  rows.map(([a, b], i) => `<tr><td style="padding:10px 16px;${i ? `border-top:1px solid ${LINE};` : ""}font:13px Arial,Helvetica,sans-serif;color:${MUT};width:38%">${esc(a)}</td><td style="padding:10px 16px;${i ? `border-top:1px solid ${LINE};` : ""}font:bold 14px Arial,Helvetica,sans-serif;color:${INK}">${esc(b)}</td></tr>`).join("") + `</table>`;
export const btn = (href: string, t: string, alt = false) => `<a href="${href}" style="display:inline-block;background:${alt ? "#ffffff" : R};color:${alt ? INK : "#ffffff"};border:${alt ? `1.5px solid ${INK}` : `1.5px solid ${R}`};text-decoration:none;font:bold 15px Arial,Helvetica,sans-serif;padding:13px 24px;border-radius:999px;margin:4px 6px 4px 0">${t}</a>`;
export const big = (t: string, sub = "") => `<div style="background:${INK};border-radius:14px;padding:18px 20px;margin:18px 0;text-align:center"><div style="font:bold 12px Arial,Helvetica,sans-serif;letter-spacing:2px;color:${Y};text-transform:uppercase">${esc(sub)}</div><div style="font:bold 34px Arial,Helvetica,sans-serif;color:#ffffff;padding-top:4px">${esc(t)}</div></div>`;
export const p = (t: string) => `<p style="margin:0 0 14px;font:16px/1.55 Arial,Helvetica,sans-serif;color:${INK}">${t}</p>`;
export const textToHtml = (t: string) => esc(t).split(/\n{2,}/).map((x) => p(x.replace(/\n/g, "<br>"))).join("");
export function shell(o: { pre: string; tag?: string; title: string; body: string; foot?: string }) {
  return `<!DOCTYPE html><html lang="fi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:#F3F1EC">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F1EC"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="background:${INK};padding:22px 28px;border-bottom:4px solid ${Y}">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle"><a href="${SITE}"><img src="${IMG}logo.png" width="56" height="56" alt="Malakai Ravintola" style="display:block;border:0;border-radius:50%"></a></td>
<td style="vertical-align:middle;padding-left:14px"><div style="font:26px Georgia,'Times New Roman',serif;color:#ffffff;line-height:1">Malakai</div><div style="font:bold 10px Arial,Helvetica,sans-serif;letter-spacing:5px;color:#D9D9D9;padding-top:5px">RAVINTOLA</div></td></tr></table></td></tr>
<tr><td style="padding:30px 28px 10px">
${o.tag ? `<div style="display:inline-block;background:${Y};color:${INK};font:bold 11px Arial,Helvetica,sans-serif;letter-spacing:1.5px;text-transform:uppercase;padding:5px 12px;border-radius:999px;margin-bottom:14px">${esc(o.tag)}</div>` : ""}
<h1 style="margin:0 0 14px;font:normal 28px/1.2 Georgia,'Times New Roman',serif;color:${INK}">${o.title}</h1>
${o.body}
</td></tr>
<tr><td style="padding:10px 28px 26px">${o.foot ?? ""}</td></tr>
<tr><td style="background:${INK};padding:22px 28px;font:13px/1.6 Arial,Helvetica,sans-serif;color:#BDBDBD">
<b style="color:#ffffff">Malakai Ravintola</b><br>Tampereentie 414, 33880 Lempäälä<br><a href="tel:+358453537000" style="color:${Y};text-decoration:none">045 353 7000</a> · <a href="${SITE}" style="color:${Y};text-decoration:none">malakairavintola.fi</a>
<div style="padding-top:10px"><a href="${SITE}/tilaa.html" style="color:#ffffff">Tilaa netistä</a> &nbsp;·&nbsp; <a href="${SITE}/tili.html" style="color:#ffffff">Oma tili</a> &nbsp;·&nbsp; <a href="${SITE}/ruokalista.html" style="color:#ffffff">Ruokalista</a></div></td></tr>
</table></td></tr></table></body></html>`;
}
// Tilauksen yhteenveto (rivit + summat)
export function orderSummary(o: any) {
  const vat = Math.round(o.total * 13.5 / 113.5 * 100) / 100, del = o.kind === "kuljetus";
  const rows: [string, string, string?][] = [["Välisumma", eur(o.subtotal)]];
  if (+o.fee) rows.push(["Kuljetus", eur(o.fee)]);
  if (+o.discount) rows.push([o.discount_note || "Alennus", "−" + eur(o.discount), "disc"]);
  rows.push(["Yhteensä", eur(o.total), "tot"], [`josta ALV 13,5 %`, eur(vat), "small"], ["Maksutapa", `${o.pay === "kateinen" ? "Käteisellä" : "Kortilla"} ${del ? "toimitettaessa" : "noudettaessa"}`, "small"]);
  return itemsHtml(o.items || []) + sumHtml(rows);
}
