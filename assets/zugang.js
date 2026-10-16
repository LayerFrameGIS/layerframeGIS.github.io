/* LayerFrame – Zugangscode der Closed Beta.
   Die Seite liegt verschlüsselt vor (AES-GCM, Schlüssel per PBKDF2 aus dem Code). Ohne den richtigen Code
   lässt sie sich nicht lesen. Nach erfolgreicher Eingabe merkt sich der Browser den abgeleiteten Schlüssel,
   damit nicht jede Seite erneut fragt. Erzeugt von veroeffentlichen.py – nicht von Hand bearbeiten. */
(function () {
  "use strict";
  var wurzel = document.documentElement;
  var daten = JSON.parse(document.getElementById("lf-daten").textContent);
  var SPEICHER = "lf-zugang-" + daten.s.slice(0, 10);
  var form = document.getElementById("lf-form");
  var feld = document.getElementById("lf-code");
  var knopf = form.querySelector("button");
  var knopfText = knopf.querySelector("span");
  var fehler = document.getElementById("lf-fehler");
  var normalText = knopfText.textContent;

  function ausB64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) { a[i] = b.charCodeAt(i); } return a; }
  function zuB64(buf) { var a = new Uint8Array(buf), s = ""; for (var i = 0; i < a.length; i++) { s += String.fromCharCode(a[i]); } return btoa(s); }
  function lesen() { try { return localStorage.getItem(SPEICHER) || sessionStorage.getItem(SPEICHER); } catch (e) { return null; } }
  function merken(wert) {
    try { localStorage.setItem(SPEICHER, wert); return; } catch (e) { /* weiter */ }
    try { sessionStorage.setItem(SPEICHER, wert); } catch (e) { /* ohne Merken weiter */ }
  }
  function vergessen() {
    try { localStorage.removeItem(SPEICHER); } catch (e) { /* egal */ }
    try { sessionStorage.removeItem(SPEICHER); } catch (e) { /* egal */ }
  }
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
  // Erst schreiben, wenn diese Seite fertig geladen ist – sonst hängt der Browser den Inhalt nur unten an.
  function anzeigen(html) {
    function schreiben() { document.open(); document.write(html); document.close(); }
    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", schreiben); }
    else { setTimeout(schreiben, 0); }
  }

  if (!window.crypto || !crypto.subtle || !window.TextEncoder) {
    freigeben();
    meldung(form.getAttribute("data-alt"));
    knopf.disabled = true;
    return;
  }

  var gemerkt = lesen();
  (gemerkt ? entschluesseln(ausB64(gemerkt)) : Promise.reject())
    .then(anzeigen)
    .catch(function () {
      if (gemerkt) { vergessen(); }
      freigeben();
      feld.focus();
    });

  feld.addEventListener("input", function () { fehler.hidden = true; feld.removeAttribute("aria-invalid"); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var code = feld.value.replace(/\s+/g, "").toUpperCase();
    if (!code) { feld.focus(); return; }
    knopf.disabled = true;
    knopfText.textContent = form.getAttribute("data-pruefen");
    fehler.hidden = true;
    var bits;
    ableiten(code)
      .then(function (b) { bits = b; return entschluesseln(new Uint8Array(b)); })
      .then(function (html) { merken(zuB64(bits)); anzeigen(html); })
      .catch(function () {
        knopf.disabled = false;
        knopfText.textContent = normalText;
        meldung(form.getAttribute("data-falsch"));
        feld.setAttribute("aria-invalid", "true");
        feld.select();
        var karte = form;
        karte.classList.remove("wackeln"); void karte.offsetWidth; karte.classList.add("wackeln");
      });
  });
})();
