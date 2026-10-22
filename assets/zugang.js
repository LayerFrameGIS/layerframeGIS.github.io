/* LayerFrame – Einstieg der Closed Beta.
   1) Zugang beantragen: Das Formular bereitet eine E-Mail an LayerFrame vor (kein Server, nichts wird gespeichert).
   2) Code eingeben: Die Seite liegt verschlüsselt vor (AES-GCM, Schlüssel per PBKDF2 aus dem Code). Nach richtiger
      Eingabe merkt sich der Browser den abgeleiteten Schlüssel, damit nicht jede Seite erneut fragt.
   Erzeugt von veroeffentlichen.py – nicht von Hand bearbeiten. */
(function () {
  "use strict";
  var wurzel = document.documentElement;
  var daten = JSON.parse(document.getElementById("lf-daten").textContent);
  var SPEICHER = "lf-zugang-" + daten.s.slice(0, 10);
  var SPRACHE = "lf-sprache";
  var form = document.getElementById("lf-form");
  var feld = document.getElementById("lf-code");
  var knopf = form.querySelector("button[type=submit]");
  var knopfText = knopf.querySelector("span") || knopf;
  var fehler = document.getElementById("lf-fehler");
  var normalText = knopfText.textContent;

  function speicherLesen(k) { try { return localStorage.getItem(k) || sessionStorage.getItem(k); } catch (e) { return null; } }
  function speicherSetzen(k, v) {
    try { localStorage.setItem(k, v); return; } catch (e) { /* weiter */ }
    try { sessionStorage.setItem(k, v); } catch (e) { /* ohne Merken weiter */ }
  }
  function vergessen() {
    try { localStorage.removeItem(SPEICHER); } catch (e) { /* egal */ }
    try { sessionStorage.removeItem(SPEICHER); } catch (e) { /* egal */ }
  }

  // Sprache: Wer kein Deutsch im Browser eingestellt hat, landet beim ersten Besuch auf der englischen Startseite.
  document.querySelectorAll("a[hreflang]").forEach(function (a) {
    a.addEventListener("click", function () { speicherSetzen(SPRACHE, a.getAttribute("hreflang")); });
  });
  if (wurzel.getAttribute("data-start") === "de" && !speicherLesen(SPRACHE)) {
    var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "de"]);
    var deutsch = langs.some(function (l) { return /^de\b/i.test(l || ""); });
    if (!deutsch) { location.replace("en/" + location.hash); return; }
  }

  function ausB64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) { a[i] = b.charCodeAt(i); } return a; }
  function zuB64(buf) { var a = new Uint8Array(buf), s = ""; for (var i = 0; i < a.length; i++) { s += String.fromCharCode(a[i]); } return btoa(s); }
  function freigeben() { wurzel.classList.remove("lf-pruefen"); }
  function meldung(text) { fehler.textContent = text; fehler.hidden = false; }

  function entschluesseln(roh) {
    return crypto.subtle.importKey("raw", roh, "AES-GCM", false, ["decrypt"])
      .then(function (k) { return crypto.subtle.decrypt({ name: "AES-GCM", iv: ausB64(daten.iv) }, k, ausB64(daten.ct)); })
      .then(function (buf) { return new TextDecoder().decode(buf); });
  }
  function ableiten(code) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveBits"])
      .then(function (k) {
        return crypto.subtle.deriveBits({ name: "PBKDF2", salt: ausB64(daten.s), iterations: daten.i, hash: "SHA-256" }, k, 256);
      });
  }
  // Entschlüsselte Seite einsetzen und die Skripte danach der Reihe nach neu laden.
  function anzeigen(html) {
    function einsetzen() {
      var neu = new DOMParser().parseFromString(html, "text/html");
      var skripte = [];
      Array.prototype.forEach.call(neu.querySelectorAll("script"), function (s) {
        var typ = (s.getAttribute("type") || "").toLowerCase();
        if (!typ || typ === "text/javascript" || typ === "module") { skripte.push(s.getAttribute("src")); s.parentNode.removeChild(s); }
      });
      Array.prototype.slice.call(wurzel.attributes).forEach(function (a) { wurzel.removeAttribute(a.name); });
      Array.prototype.forEach.call(neu.documentElement.attributes, function (a) { wurzel.setAttribute(a.name, a.value); });
      document.head.innerHTML = neu.head.innerHTML;
      document.body.replaceWith(document.importNode(neu.body, true));
      document.title = neu.title;
      skripte.forEach(function (src) {
        if (!src) { return; }
        var s = document.createElement("script"); s.src = src; s.async = false; document.body.appendChild(s);
      });
      if (location.hash && location.hash.length > 1 && location.hash.indexOf("=") < 0) {
        var ziel = document.getElementById(location.hash.slice(1)); if (ziel) { ziel.scrollIntoView(); }
      }
    }
    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", einsetzen); } else { einsetzen(); }
  }

  // ---------- Reiter ----------
  var reiter = Array.prototype.slice.call(document.querySelectorAll(".z-tabs [role=tab]"));
  var zustand = "form";  // form | ok | fallback
  var antrag = document.getElementById("z-antrag");
  var ok = document.getElementById("z-ok");
  var gesendet = document.getElementById("z-gesendet");
  function zeigeReiter(name, fokus) {
    reiter.forEach(function (r) {
      var an = r.getAttribute("data-reiter") === name;
      r.setAttribute("aria-selected", an ? "true" : "false");
      r.tabIndex = an ? 0 : -1;
      if (an && fokus) { r.focus(); }
    });
    form.hidden = name !== "code";
    antrag.hidden = name !== "antrag" || zustand !== "form";
    ok.hidden = name !== "antrag" || zustand !== "ok";
    gesendet.hidden = name !== "antrag" || zustand !== "fallback";
  }
  reiter.forEach(function (r, i) {
    r.addEventListener("click", function () { zeigeReiter(r.getAttribute("data-reiter")); if (r.getAttribute("data-reiter") === "code") { feld.focus(); } });
    r.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") { return; }
      var n = reiter[(i + (e.key === "ArrowRight" ? 1 : reiter.length - 1)) % reiter.length];
      zeigeReiter(n.getAttribute("data-reiter"), true);
    });
  });

  // ---------- Zugang anfordern: direkt an LayerFrame senden, sonst E-Mail vorbereiten ----------
  var an = antrag.getAttribute("data-an");
  var ziel = antrag.getAttribute("data-ziel");
  var antragText = "", antragBetreff = "";
  var sendenKnopf = antrag.querySelector("button[type=submit]");
  var sendenText = sendenKnopf.textContent;
  function wert(name) { var el = antrag.elements[name]; return el ? String(el.value || "").trim() : ""; }
  function wahlText(name) { var el = antrag.elements[name]; return el && el.selectedIndex > 0 ? el.options[el.selectedIndex].text : ""; }
  function fallback() {
    var q = "?subject=" + encodeURIComponent(antragBetreff) + "&body=" + encodeURIComponent(antragText);
    document.getElementById("z-text").textContent = antragText;
    document.getElementById("z-gmail").href = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(an) +
      "&su=" + encodeURIComponent(antragBetreff) + "&body=" + encodeURIComponent(antragText);
    document.getElementById("z-outlook").href = "https://outlook.live.com/mail/0/deeplink/compose?to=" + encodeURIComponent(an) +
      "&subject=" + encodeURIComponent(antragBetreff) + "&body=" + encodeURIComponent(antragText);
    zustand = "fallback"; zeigeReiter("antrag");
    gesendet.querySelector("h2").focus();
    location.href = "mailto:" + an + q;
  }
  antrag.addEventListener("submit", function (e) {
    e.preventDefault();
    var t = JSON.parse(antrag.getAttribute("data-texte"));
    antragBetreff = t.betreff + " – " + wert("name");
    var zeilen = [t.anrede, "", t.name + ": " + wert("name"), t.mail + ": " + wert("mail")];
    if (wert("org")) { zeilen.push(t.org + ": " + wert("org")); }
    if (wahlText("einsatz")) { zeilen.push(t.einsatz + ": " + wahlText("einsatz")); }
    if (wert("vorhaben")) { zeilen.push("", t.vorhaben + ":", wert("vorhaben")); }
    zeilen.push("", t.sprache, "", t.fuss);
    antragText = zeilen.join("\n");
    if (!ziel || !window.fetch) { fallback(); return; }
    sendenKnopf.disabled = true; sendenKnopf.textContent = antrag.getAttribute("data-sendet");
    var nutzlast = { name: wert("name"), mail: wert("mail"), org: wert("org"), einsatz: wahlText("einsatz"), vorhaben: wert("vorhaben"),
      sprache: wurzel.getAttribute("lang") || "de", website: wert("website") };
    var abbruch = window.AbortController ? new AbortController() : null;
    var uhr = setTimeout(function () { if (abbruch) { abbruch.abort(); } }, 12000);
    fetch(ziel, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nutzlast), signal: abbruch ? abbruch.signal : undefined })
      .then(function (r) { if (!r.ok) { throw new Error("status " + r.status); } return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) { throw new Error("antwort"); }
        zustand = "ok"; antrag.reset(); zeigeReiter("antrag"); ok.querySelector("h2").focus();
      })
      .catch(function () { fallback(); })
      .then(function () { clearTimeout(uhr); sendenKnopf.disabled = false; sendenKnopf.textContent = sendenText; });
  });
  document.getElementById("z-zurueck").addEventListener("click", function () { zustand = "form"; zeigeReiter("antrag"); });
  document.getElementById("z-neu").addEventListener("click", function () { zustand = "form"; zeigeReiter("antrag"); });
  gesendet.querySelectorAll("[data-kopie]").forEach(function (k) {
    var original = k.textContent;
    k.addEventListener("click", function () {
      var inhalt = k.getAttribute("data-kopie") === "text" ? "To: " + an + "\nSubject: " + antragBetreff + "\n\n" + antragText : an;
      if (!navigator.clipboard) { return; }
      navigator.clipboard.writeText(inhalt).then(function () {
        k.textContent = k.getAttribute("data-kopiert");
        setTimeout(function () { k.textContent = original; }, 1800);
      });
    });
  });

  // ---------- Code eingeben ----------
  if (!window.crypto || !crypto.subtle || !window.TextEncoder) {
    freigeben();
    meldung(form.getAttribute("data-alt"));
    knopf.disabled = true;
    return;
  }

  function pruefen(code) {
    knopf.disabled = true;
    knopfText.textContent = form.getAttribute("data-pruefen");
    fehler.hidden = true;
    var bits;
    ableiten(code)
      .then(function (b) { bits = b; return entschluesseln(new Uint8Array(b)); })
      .then(function (html) { speicherSetzen(SPEICHER, zuB64(bits)); anzeigen(html); })
      .catch(function () {
        knopf.disabled = false;
        knopfText.textContent = normalText;
        meldung(form.getAttribute("data-falsch"));
        feld.setAttribute("aria-invalid", "true");
        feld.select();
        form.classList.remove("wackeln"); void form.offsetWidth; form.classList.add("wackeln");
      });
  }

  // Link aus der Einladung: …/#code=LF-XXXX-XXXX-XXXX öffnet direkt
  var hashCode = /^#code=([A-Za-z0-9-]+)$/.exec(location.hash);
  if (hashCode && history.replaceState) { history.replaceState(null, "", location.pathname + location.search); }
  if (location.hash === "#code") { zeigeReiter("code"); }

  var gemerkt = speicherLesen(SPEICHER);
  (gemerkt ? entschluesseln(ausB64(gemerkt)) : Promise.reject())
    .then(anzeigen)
    .catch(function () {
      if (gemerkt) { vergessen(); }
      freigeben();
      if (hashCode) {
        zeigeReiter("code");
        feld.value = hashCode[1].toUpperCase();
        pruefen(feld.value);
      }
    });

  feld.addEventListener("input", function () { fehler.hidden = true; feld.removeAttribute("aria-invalid"); });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var code = feld.value.replace(/\s+/g, "").toUpperCase();
    if (!code) { feld.focus(); return; }
    pruefen(code);
  });
})();
