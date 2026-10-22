// LayerFrame – Weiterleitung "Zugang anfordern" (layerframe.at → hello@layerframe.at)
// Speichert nichts. Nimmt die Anfrage der Website an und schickt sie per Resend als E-Mail ans Postfach.
const MAX = { name: 120, mail: 160, org: 160, einsatz: 60, vorhaben: 600, sprache: 5 };
const zuletzt = new Map(); // einfache Bremse je IP (nur innerhalb einer Worker-Instanz)

function cors(env, origin) {
  const erlaubt = (env.ERLAUBT || "").split(",").map((s) => s.trim());
  const o = erlaubt.includes(origin) ? origin : erlaubt[0] || "*";
  return { "Access-Control-Allow-Origin": o, "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" };
}
function antwort(daten, status, kopf) {
  return new Response(JSON.stringify(daten), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...kopf } });
}
function sauber(wert, max) {
  return String(wert ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const kopf = cors(env, origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: kopf });
    if (request.method !== "POST") return new Response("LayerFrame", { status: 200, headers: kopf });

    const erlaubt = (env.ERLAUBT || "").split(",").map((s) => s.trim());
    if (origin && !erlaubt.includes(origin)) return antwort({ ok: false, fehler: "herkunft" }, 403, kopf);
    if ((request.headers.get("Content-Length") || 0) > 8000) return antwort({ ok: false, fehler: "zu_gross" }, 413, kopf);

    let roh;
    try { roh = await request.json(); } catch { return antwort({ ok: false, fehler: "format" }, 400, kopf); }
    const d = {};
    for (const [k, m] of Object.entries(MAX)) d[k] = sauber(roh[k], m);

    // Honigtopf: Bots füllen das versteckte Feld "website" aus – still "ok" melden, nichts senden
    if (sauber(roh.website, 200)) return antwort({ ok: true }, 200, kopf);
    if (!d.name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.mail)) return antwort({ ok: false, fehler: "pflichtfelder" }, 422, kopf);

    const ip = request.headers.get("CF-Connecting-IP") || "?";
    const jetzt = Date.now();
    if (jetzt - (zuletzt.get(ip) || 0) < 20000) return antwort({ ok: false, fehler: "zu_schnell" }, 429, kopf);
    zuletzt.set(ip, jetzt);
    if (zuletzt.size > 5000) zuletzt.clear();

    const text = [
      "Neue Anfrage über layerframe.at – Zugang anfordern", "",
      "Name: " + d.name, "E-Mail: " + d.mail,
      d.org ? "Organisation: " + d.org : null,
      d.einsatz ? "Einsatz: " + d.einsatz : null,
      "Sprache: " + (d.sprache === "en" ? "Englisch" : "Deutsch"),
      d.vorhaben ? "\nVorhaben:\n" + d.vorhaben : null,
      "", "Antworten geht direkt an die Person (Antwort-an ist gesetzt).",
    ].filter((z) => z !== null).join("\n");

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + env.RESEND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.ABSENDER, to: [env.EMPFAENGER], reply_to: d.mail,
        subject: "Zugang anfordern: " + d.name + (d.org ? " (" + d.org + ")" : ""), text }),
    });
    if (!r.ok) {
      let grund = "";
      try { const j = await r.json(); grund = String(j.message || j.name || "").slice(0, 160); } catch { /* egal */ }
      return antwort({ ok: false, fehler: "versand", status: r.status, grund }, 502, kopf);
    }
    return antwort({ ok: true }, 200, kopf);
  },
};
