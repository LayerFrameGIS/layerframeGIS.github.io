/* LayerFrame – Werkzeug-Demos auf der Demo-Seite (KI-Assistent, Puffer, Symbologie, Auswahl, Höhenlinien, Messen).
   Alles läuft im Browser auf schematischen Demodaten; kein Netz, keine echte KI. */
(function () {
  "use strict";
  var wurzel = document.querySelector("[data-wz-demo]");
  if (!wurzel) { return; }
  var D = JSON.parse(document.getElementById("wz-daten").textContent);
  var T = D.t;
  var svg = wurzel.querySelector(".ki-karte > svg");
  var panel = wurzel.querySelector(".ki-panel-innen");
  var panelRahmen = wurzel.querySelector(".ki-panel");
  var legende = wurzel.querySelector(".ki-legende");
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".wz-tabs [role=tab]"));
  var ruhig = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var zahl = new Intl.NumberFormat(T.zahl, { maximumFractionDigits: 0 });
  var zahl1 = new Intl.NumberFormat(T.zahl, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  var zahl2 = new Intl.NumberFormat(T.zahl, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  var M = 10;                                            // Meter je Karteneinheit
  var aktiv = "ki", sitzung = 0;

  // ---------- Daten aus der Karte ----------
  var gebaeude = Array.prototype.map.call(svg.querySelectorAll(".gebaeude rect"), function (r) {
    var w = +r.getAttribute("width"), h = +r.getAttribute("height");
    return { el: r, id: +r.getAttribute("data-id"), n: +r.getAttribute("data-n"), g: +r.getAttribute("data-g"),
             x: +r.getAttribute("x") + w / 2, y: +r.getAttribute("y") + h / 2, f: Math.round(w * h * M * M / 10) * 10 };
  });
  var nachId = {}; gebaeude.forEach(function (g) { nachId[g.id] = g; });
  var halte = Array.prototype.map.call(svg.querySelectorAll(".haltestelle"), function (g) {
    return { name: g.getAttribute("data-name"), x: +g.getAttribute("data-x"), y: +g.getAttribute("data-y") };
  });
  var innPunkte = (svg.querySelector(".gewaesser.inn").getAttribute("d").match(/-?\d+(\.\d+)?/g) || []).map(Number);
  var hlPfade = Array.prototype.slice.call(svg.querySelectorAll(".hl path"));
  var el = {
    innPuffer: svg.querySelector(".inn-puffer"), haltPuffer: svg.querySelector(".halt-puffer"),
    kreis: svg.querySelector(".auswahl-kreis"), mess: svg.querySelector(".mess"),
    messLinie: svg.querySelector(".mess-linie"), messPunkte: svg.querySelector(".mess-punkte"), zeiger: svg.querySelector(".zeiger")
  };
  var NS = "http://www.w3.org/2000/svg";

  // Höhenraster (Uint16, alle 10 Einheiten)
  var R = D.raster, rb = atob(R.daten), rw = new Uint16Array(R.nx * R.ny);
  for (var i = 0; i < rw.length; i++) { rw[i] = rb.charCodeAt(2 * i) | (rb.charCodeAt(2 * i + 1) << 8); }
  function hoeheBei(x, y) {
    var gx = Math.max(0, Math.min(R.nx - 1.001, x / R.schritt)), gy = Math.max(0, Math.min(R.ny - 1.001, y / R.schritt));
    var x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    var a = rw[y0 * R.nx + x0], b = rw[y0 * R.nx + x0 + 1], c = rw[(y0 + 1) * R.nx + x0], d = rw[(y0 + 1) * R.nx + x0 + 1];
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
  }

  // ---------- Hilfen ----------
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function zeigen(e, an) { if (an) { e.removeAttribute("hidden"); } else { e.setAttribute("hidden", ""); } }
  function svgEl(tag, attr) { var e = document.createElementNS(NS, tag); for (var k in attr) { e.setAttribute(k, attr[k]); } return e; }
  function abstandZuInn(x, y) {
    var best = Infinity;
    for (var i = 0; i + 3 < innPunkte.length; i += 2) {
      var ax = innPunkte[i], ay = innPunkte[i + 1], dx = innPunkte[i + 2] - ax, dy = innPunkte[i + 3] - ay, l = dx * dx + dy * dy;
      var t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx - x, ay + t * dy - y));
    }
    return best;
  }
  function meter(m) { return m >= 1000 ? zahl2.format(m / 1000) + " km" : zahl.format(m) + " m"; }

  // ---------- Kartenausschnitt ----------
  var START = { ki: [260, 150, 1080, 607.5], puffer: [510, 280, 700, 393.75], symbologie: [560, 320, 600, 337.5],
                auswahl: [600, 345, 520, 292.5], hoehe: [0, 0, 1600, 900], messen: [0, 0, 1600, 900] };
  var vb = START.ki.slice();
  function setzeVb(v) {
    vb = v.slice();
    svg.setAttribute("viewBox", v.join(" "));
    var r = svg.getBoundingClientRect();
    var s = Math.max(r.width / v[2], r.height / v[3]) || 1;
    svg.style.setProperty("--z", (1 / s).toFixed(4));
    svg.classList.toggle("weit", v[2] > 900);                // Beschriftung der Haltestellen nur näher dran
    Array.prototype.forEach.call(svg.querySelectorAll(".haltestelle circle, .mess-punkte circle"), function (c) { c.setAttribute("r", (5 / s).toFixed(2)); });
  }
  function zoomeAuf(ziel, fertig) {
    if (ruhig) { setzeVb(ziel); if (fertig) { fertig(); } return; }
    var von = vb.slice(), t0 = null, meine = sitzung;
    requestAnimationFrame(function schritt(t) {
      if (meine !== sitzung) { return; }
      if (t0 === null) { t0 = t; }
      var k = Math.min(1, (t - t0) / 800), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      setzeVb(von.map(function (a, i) { return a + (ziel[i] - a) * e; }));
      if (k < 1) { requestAnimationFrame(schritt); } else if (fertig) { fertig(); }
    });
  }
  function ausschnitt(cx, cy, breite) { return [cx - breite / 2, cy - breite * 9 / 32, breite, breite * 9 / 16]; }
  wurzel.querySelectorAll("[data-zoom]").forEach(function (b) {
    b.addEventListener("click", function () {
      var z = +b.getAttribute("data-zoom");
      if (z === 0) { zoomeAuf(START[aktiv]); return; }
      var cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2, br = Math.max(160, Math.min(1600, vb[2] * (z > 0 ? 0.65 : 1.55)));
      zoomeAuf(ausschnitt(cx, cy, br));
    });
  });

  // Verschieben mit der Maus/dem Finger; ein kurzer Klick bleibt ein Klick
  var zug = null, gezogen = false;
  svg.addEventListener("pointerdown", function (e) {
    zug = { x: e.clientX, y: e.clientY, vb: vb.slice(), id: e.pointerId }; gezogen = false;
  });
  svg.addEventListener("pointermove", function (e) {
    if (zug && e.pointerId === zug.id && (e.buttons & 1 || e.pointerType === "touch")) {
      var dx = e.clientX - zug.x, dy = e.clientY - zug.y;
      if (!gezogen && Math.hypot(dx, dy) > 5) { gezogen = true; svg.setPointerCapture(e.pointerId); svg.classList.add("zieht"); }
      if (gezogen) {
        var r = svg.getBoundingClientRect(), s = Math.max(r.width / zug.vb[2], r.height / zug.vb[3]);
        setzeVb([zug.vb[0] - dx / s, zug.vb[1] - dy / s, zug.vb[2], zug.vb[3]]);
      }
    }
    if (aktiv === "hoehe" && !gezogen) { hoeheZeigen(e); }
  });
  function zugEnde() { zug = null; svg.classList.remove("zieht"); setTimeout(function () { gezogen = false; }, 0); }
  svg.addEventListener("pointerup", zugEnde);
  svg.addEventListener("pointercancel", zugEnde);
  svg.addEventListener("pointerleave", function () { if (aktiv === "hoehe") { zeigen(el.zeiger, false); var a = panel.querySelector(".wz-wert"); if (a) { a.textContent = "– m"; } } });
  function kartenPunkt(e) {
    var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  }
  window.addEventListener("resize", function () { setzeVb(vb); });

  // ---------- Grundzustand ----------
  function legendeZeigen(name, an) { var li = legende.querySelector('[data-layer="' + name + '"]'); if (li) { li.hidden = !an; } }
  function aufraeumen() {
    gebaeude.forEach(function (g) { g.el.classList.remove("gewaehlt", "im-puffer", "hervor"); g.el.style.fill = ""; g.el.style.fillOpacity = ""; });
    zeigen(el.innPuffer, false); zeigen(el.haltPuffer, false); el.haltPuffer.innerHTML = ""; zeigen(el.kreis, false);
    zeigen(el.mess, false); el.messLinie.setAttribute("points", ""); el.messPunkte.innerHTML = ""; zeigen(el.zeiger, false);
    hlPfade.forEach(function (p) { p.style.display = ""; });
    legendeZeigen("puffer", false); legende.hidden = false;
  }

  // ---------- Werkzeug: Puffer ----------
  function puffer() {
    var t = T.puffer;
    panel.innerHTML = '<div class="wz-inhalt"><div class="wz-kopf"><h2>' + esc(t.titel) + '</h2><p>' + esc(t.text) + '</p></div>' +
      '<div class="wz-feld"><label for="wz-p-ein">' + esc(t.eingabe) + '</label><select id="wz-p-ein"><option value="inn">' + esc(t.inn) + '</option><option value="halt">' + esc(t.halt) + '</option></select></div>' +
      '<div class="wz-feld"><label for="wz-p-ab">' + esc(t.abstand) + ' <output id="wz-p-wert" for="wz-p-ab"></output></label><input id="wz-p-ab" type="range" min="25" max="500" step="25" value="100"></div>' +
      '<div class="wz-ergebnis"><h3>' + esc(t.ergebnis) + '</h3><dl><div><dt>' + esc(t.drin) + '</dt><dd id="wz-p-n"></dd></div><div><dt>' + esc(t.anteil) + '</dt><dd id="wz-p-a"></dd></div></dl></div></div>';
    var ein = panel.querySelector("#wz-p-ein"), ab = panel.querySelector("#wz-p-ab");
    function rechnen() {
      var d = +ab.value, r = d / M, drin = 0;
      panel.querySelector("#wz-p-wert").textContent = zahl.format(d) + " m";
      if (ein.value === "inn") {
        el.innPuffer.style.strokeWidth = 2 * r; zeigen(el.innPuffer, true); zeigen(el.haltPuffer, false);
      } else {
        zeigen(el.innPuffer, false); el.haltPuffer.innerHTML = "";
        halte.forEach(function (h) { el.haltPuffer.appendChild(svgEl("circle", { cx: h.x, cy: h.y, r: r })); });
        zeigen(el.haltPuffer, true);
      }
      gebaeude.forEach(function (g) {
        var innen = ein.value === "inn" ? abstandZuInn(g.x, g.y) <= r : halte.some(function (h) { return Math.hypot(g.x - h.x, g.y - h.y) <= r; });
        g.el.classList.toggle("im-puffer", innen); if (innen) { drin++; }
      });
      panel.querySelector("#wz-p-n").textContent = zahl.format(drin);
      panel.querySelector("#wz-p-a").textContent = zahl.format(Math.round(drin / gebaeude.length * 100)) + " %";
      legendeZeigen("puffer", true);
    }
    ein.addEventListener("change", rechnen); ab.addEventListener("input", rechnen); rechnen();
  }

  // ---------- Werkzeug: Symbologie ----------
  var KAT = ["#E0A23B", "#7B68C8", "#2E8B7A", "#D9655B"];
  var RAMPEN = { gruen: ["#D7EBDF", "#1E6B5A"], blau: ["#D6E6F5", "#1F5F99"], orange: ["#FBE3C8", "#C2571A"] };
  function mischen(a, b, t) {
    var p = function (h, i) { return parseInt(h.substr(1 + 2 * i, 2), 16); };
    return "#" + [0, 1, 2].map(function (i) { return Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, "0"); }).join("");
  }
  function symbologie() {
    var t = T.symb;
    panel.innerHTML = '<div class="wz-inhalt"><div class="wz-kopf"><h2>' + esc(t.titel) + '</h2><p>' + esc(t.text) + '</p></div>' +
      '<fieldset class="wz-feld wz-wahl"><legend>' + esc(t.methode) + '</legend>' +
      ['einzel', 'eindeutig', 'abgestuft'].map(function (m, i) { return '<label><input type="radio" name="wz-s-m" value="' + m + '"' + (i === 1 ? ' checked' : '') + '> ' + esc(t[m]) + '</label>'; }).join("") + '</fieldset>' +
      '<div class="wz-zeile wz-s-abgestuft"><div class="wz-feld"><label for="wz-s-k">' + esc(t.klassen) + '</label><select id="wz-s-k"><option>3</option><option selected>4</option><option>5</option></select></div>' +
      '<div class="wz-feld"><label for="wz-s-r">' + esc(t.schema) + '</label><select id="wz-s-r"><option value="gruen">●●● Grün / Green</option><option value="blau">●●● Blau / Blue</option><option value="orange">●●● Orange</option></select></div></div>' +
      '<div class="wz-ergebnis"><h3>' + esc(t.legende) + '</h3><ul class="wz-legende"></ul></div></div>';
    legende.hidden = true;
    var liste = panel.querySelector(".wz-legende");
    function zeichnen() {
      var m = panel.querySelector('input[name="wz-s-m"]:checked').value, eintraege = [];
      panel.querySelector(".wz-s-abgestuft").hidden = m !== "abgestuft";
      if (m === "einzel") {
        gebaeude.forEach(function (g) { g.el.style.fill = "#8A9590"; g.el.style.fillOpacity = 1; });
        eintraege.push(["#8A9590", t.alle, gebaeude.length]);
      } else if (m === "eindeutig") {
        T.nutzung.forEach(function (n, i) { eintraege.push([KAT[i], n, 0]); });
        gebaeude.forEach(function (g) { g.el.style.fill = KAT[g.n]; g.el.style.fillOpacity = 1; eintraege[g.n][2]++; });
      } else {
        var k = +panel.querySelector("#wz-s-k").value, r = RAMPEN[panel.querySelector("#wz-s-r").value];
        for (var i = 0; i < k; i++) {
          var lo = Math.floor(i * 8 / k) + 1, hi = Math.floor((i + 1) * 8 / k);
          eintraege.push([mischen(r[0], r[1], k > 1 ? i / (k - 1) : 1), (lo === hi ? lo : lo + "–" + hi) + " " + t.geschosse, 0, lo, hi]);
        }
        gebaeude.forEach(function (g) {
          var e = eintraege.filter(function (x) { return g.g >= x[3] && g.g <= x[4]; })[0];
          g.el.style.fill = e[0]; g.el.style.fillOpacity = 1; e[2]++;
        });
      }
      liste.innerHTML = eintraege.map(function (e) { return '<li><i style="background:' + e[0] + '"></i><span>' + esc(e[1]) + '</span><b>' + zahl.format(e[2]) + '</b></li>'; }).join("");
    }
    panel.querySelector(".wz-inhalt").addEventListener("change", zeichnen); zeichnen();
  }

  // ---------- Werkzeug: Auswahl & Attributtabelle ----------
  var auswahl = [];
  function auswahlWerkzeug() {
    var t = T.ausw;
    auswahl = [];
    panel.innerHTML = '<div class="wz-inhalt"><div class="wz-kopf"><h2>' + esc(t.titel) + '</h2><p>' + esc(t.text) + '</p></div>' +
      '<div class="wz-feld"><span class="wz-label">' + esc(t.nachattr) + '</span><div class="wz-chips">' +
      t.abfragen.map(function (a, i) { return '<button type="button" class="ki-chip" data-abfrage="' + i + '"><code>' + esc(a[0]) + '</code></button>'; }).join("") +
      '</div></div><dl class="wz-statistik"><div><dt>' + esc(t.anzahl) + '</dt><dd id="wz-a-n">0</dd></div><div><dt>' + esc(t.summe) + '</dt><dd id="wz-a-f">–</dd></div><div><dt>' + esc(t.schnitt) + '</dt><dd id="wz-a-g">–</dd></div></dl>' +
      '<div class="wz-tabelle"><table><thead><tr><th scope="col">' + esc(t.id) + '</th><th scope="col">' + esc(t.nutzung) + '</th><th scope="col" class="zahl">' + esc(t.geschosse) + '</th><th scope="col" class="zahl">' + esc(t.flaeche) + '</th></tr></thead><tbody></tbody></table>' +
      '<p class="wz-leer">' + esc(t.leer) + '</p></div><button type="button" class="ki-zuruecksetzen wz-aufheben">' + esc(t.aufheben) + '</button></div>';
    panel.querySelectorAll("[data-abfrage]").forEach(function (b) {
      b.addEventListener("click", function () {
        var a = t.abfragen[+b.getAttribute("data-abfrage")];
        auswahl = gebaeude.filter(function (g) { return a[1] === "n" ? g.n === a[2] : g[a[1]] >= a[2]; });
        auswahlZeigen();
      });
    });
    panel.querySelector(".wz-aufheben").addEventListener("click", function () { auswahl = []; auswahlZeigen(); });
    auswahlZeigen();
  }
  function auswahlZeigen() {
    gebaeude.forEach(function (g) { g.el.classList.toggle("gewaehlt", auswahl.indexOf(g) >= 0); });
    var body = panel.querySelector(".wz-tabelle tbody"); if (!body) { return; }
    var sortiert = auswahl.slice().sort(function (a, b) { return a.id - b.id; });
    body.innerHTML = sortiert.map(function (g) {
      return '<tr data-id="' + g.id + '"><td>' + g.id + '</td><td>' + esc(T.nutzung[g.n]) + '</td><td class="zahl">' + g.g + '</td><td class="zahl">' + zahl.format(g.f) + ' m²</td></tr>';
    }).join("");
    panel.querySelector(".wz-leer").hidden = auswahl.length > 0;
    var f = auswahl.reduce(function (s, g) { return s + g.f; }, 0);
    panel.querySelector("#wz-a-n").textContent = zahl.format(auswahl.length);
    panel.querySelector("#wz-a-f").textContent = auswahl.length ? zahl.format(f) + " m²" : "–";
    panel.querySelector("#wz-a-g").textContent = auswahl.length ? zahl1.format(auswahl.reduce(function (s, g) { return s + g.g; }, 0) / auswahl.length) : "–";
  }
  svg.addEventListener("click", function (e) {
    if (gezogen) { return; }
    if (aktiv === "auswahl" && e.target.matches(".gebaeude rect")) {
      var g = nachId[+e.target.getAttribute("data-id")], i = auswahl.indexOf(g);
      if (i >= 0) { auswahl.splice(i, 1); } else { auswahl.push(g); }
      auswahlZeigen();
    } else if (aktiv === "messen") {
      var p = kartenPunkt(e); messPunkt(p.x, p.y);
    }
  });
  panel.addEventListener("mouseover", function (e) {
    var tr = e.target.closest && e.target.closest("tr[data-id]");
    gebaeude.forEach(function (g) { g.el.classList.toggle("hervor", !!tr && g.id === +tr.getAttribute("data-id")); });
  });

  // ---------- Werkzeug: Höhenlinien ----------
  function hoehe() {
    var t = T.hoehe;
    panel.innerHTML = '<div class="wz-inhalt"><div class="wz-kopf"><h2>' + esc(t.titel) + '</h2><p>' + esc(t.text) + '</p></div>' +
      '<fieldset class="wz-feld wz-segment"><legend>' + esc(t.intervall) + '</legend>' +
      [100, 200, 500].map(function (v, i) { return '<label><input type="radio" name="wz-h-i" value="' + v + '"' + (i === 0 ? ' checked' : '') + '><span>' + v + ' m</span></label>'; }).join("") + '</fieldset>' +
      '<div class="wz-ergebnis"><h3>' + esc(t.abfrage) + '</h3><p class="wz-wert">– m</p><p class="wz-klein">' + esc(t.hinweis) + '</p></div>' +
      '<p class="wz-klein"><i class="wz-index"></i>' + esc(t.index) + '</p></div>';
    function filtern() {
      var iv = +panel.querySelector('input[name="wz-h-i"]:checked').value;
      hlPfade.forEach(function (p) { p.style.display = (+p.getAttribute("data-z")) % iv === 0 ? "" : "none"; });
    }
    panel.querySelector(".wz-inhalt").addEventListener("change", filtern); filtern();
  }
  function hoeheZeigen(e) {
    var p = kartenPunkt(e), h = hoeheBei(p.x, p.y);
    el.zeiger.setAttribute("transform", "translate(" + p.x.toFixed(1) + " " + p.y.toFixed(1) + ") scale(" + (svg.style.getPropertyValue("--z") || 1) + ")");
    zeigen(el.zeiger, true);
    var a = panel.querySelector(".wz-wert"); if (a) { a.textContent = zahl.format(Math.round(h)) + " m"; }
  }

  // ---------- Werkzeug: Messen ----------
  var punkte = [];
  function messen() {
    var t = T.mess; punkte = [];
    panel.innerHTML = '<div class="wz-inhalt"><div class="wz-kopf"><h2>' + esc(t.titel) + '</h2><p>' + esc(t.text) + '</p></div>' +
      '<div class="wz-ergebnis"><h3>' + esc(t.strecke) + '</h3><p class="wz-wert" id="wz-m-s">–</p><p class="wz-klein" id="wz-m-seg"></p></div>' +
      '<div class="wz-ergebnis"><h3>' + esc(t.profil) + '</h3><div class="wz-profil"><p class="wz-klein">' + esc(t.leer) + '</p></div><p class="wz-klein" id="wz-m-hm"></p></div>' +
      '<button type="button" class="ki-zuruecksetzen wz-neu">' + esc(t.neu) + '</button></div>';
    panel.querySelector(".wz-neu").addEventListener("click", function () { punkte = []; messZeichnen(); });
    zeigen(el.mess, true); messZeichnen();
  }
  function messPunkt(x, y) { punkte.push([x, y]); messZeichnen(); }
  function messZeichnen() {
    var t = T.mess;
    el.messLinie.setAttribute("points", punkte.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" "));
    el.messPunkte.innerHTML = "";
    punkte.forEach(function (p) { el.messPunkte.appendChild(svgEl("circle", { cx: p[0], cy: p[1], r: 5 })); });
    setzeVb(vb);
    var segs = [], ges = 0;
    for (var i = 1; i < punkte.length; i++) { var d = Math.hypot(punkte[i][0] - punkte[i - 1][0], punkte[i][1] - punkte[i - 1][1]) * M; segs.push(d); ges += d; }
    var s = panel.querySelector("#wz-m-s"); if (!s) { return; }
    s.textContent = punkte.length > 1 ? meter(ges) : "–";
    panel.querySelector("#wz-m-seg").textContent = segs.length > 1 ? t.segmente + ": " + segs.map(meter).join(" · ") : "";
    var box = panel.querySelector(".wz-profil"), hm = panel.querySelector("#wz-m-hm");
    if (punkte.length < 2) { box.innerHTML = '<p class="wz-klein">' + esc(t.leer) + '</p>'; hm.textContent = ""; return; }
    // Profil abtasten
    var n = 120, werte = [], auf = 0, laenge = ges / M;
    for (var k = 0; k <= n; k++) {
      var ziel = laenge * k / n, lauf = 0, j = 1;
      while (j < punkte.length - 1 && lauf + segs[j - 1] / M < ziel) { lauf += segs[j - 1] / M; j++; }
      var sl = segs[j - 1] / M || 1, f = Math.min(1, (ziel - lauf) / sl);
      var x = punkte[j - 1][0] + (punkte[j][0] - punkte[j - 1][0]) * f, y = punkte[j - 1][1] + (punkte[j][1] - punkte[j - 1][1]) * f;
      werte.push(hoeheBei(x, y));
      if (k > 0 && werte[k] > werte[k - 1]) { auf += werte[k] - werte[k - 1]; }
    }
    var lo = Math.min.apply(null, werte), hi = Math.max.apply(null, werte), sp = Math.max(50, hi - lo), B = 300, Hh = 110;
    var pts = werte.map(function (v, k) { return (k / n * B).toFixed(1) + "," + (Hh - 8 - (v - lo) / sp * (Hh - 24)).toFixed(1); });
    box.innerHTML = '<svg viewBox="0 0 ' + B + ' ' + Hh + '" role="img" aria-label="' + esc(t.profil) + '"><polygon class="wz-profil-flaeche" points="0,' + Hh + ' ' + pts.join(" ") + ' ' + B + ',' + Hh + '"/>' +
      '<polyline class="wz-profil-linie" points="' + pts.join(" ") + '"/>' +
      '<text x="4" y="12">' + zahl.format(Math.round(hi)) + ' m</text><text x="4" y="' + (Hh - 4) + '">' + zahl.format(Math.round(lo)) + ' m</text></svg>';
    hm.textContent = t.hm + ": " + zahl.format(Math.round(auf)) + " m · " + t.max + ": " + zahl.format(Math.round(hi)) + " m · " + t.min + ": " + zahl.format(Math.round(lo)) + " m";
  }

  // ---------- Werkzeug: KI-Assistent ----------
  var FUNKEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>';
  var PFEIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
  var HAKEN = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function ki() {
    var K = T.ki, meine = sitzung, laeuft = false, stapel = [];
    panel.innerHTML = '<div class="ki-kopf"><span class="ki-name">' + FUNKEN + esc(T.ki_name) + '</span><button type="button" class="ki-zuruecksetzen">' + esc(T.reset) + '</button></div>' +
      '<div class="ki-verlauf" aria-live="polite"></div><div class="ki-fuss"><p class="ki-vorschlaege-titel">' + esc(T.vorschlaege) + '</p><div class="ki-vorschlaege"></div>' +
      '<div class="ki-eingabe"><input type="text" placeholder="' + esc(T.eingabe) + '" aria-label="' + esc(T.eingabe) + '" disabled><button type="button" disabled aria-label="' + esc(T.senden) + '">' + PFEIL + '</button></div>' +
      '<p class="ki-eingabe-hinweis">' + esc(T.eingabe_hinweis) + '</p></div>';
    var log = panel.querySelector(".ki-verlauf"), chips = panel.querySelector(".ki-vorschlaege");
    function neu(tag, kl, text) { var e = document.createElement(tag); if (kl) { e.className = kl; } if (text) { e.textContent = text; } return e; }
    function unten() { log.scrollTop = log.scrollHeight; }
    function warte(ms) { return new Promise(function (r) { setTimeout(r, ruhig ? 0 : ms); }); }
    function fuelle(s, w) { return s.replace(/\{(\w+)\}/g, function (_, k) { return w[k] !== undefined ? w[k] : ""; }); }
    function markiere(l) { gebaeude.forEach(function (g) { g.el.classList.toggle("gewaehlt", l.indexOf(g) >= 0); }); }
    var A = {
      zoom: function (ok) { zoomeAuf(ausschnitt(860, 475, 560), function () { ok({}); }); return { name: K.namen.zoom, zurueck: function () { zoomeAuf(START.ki); } }; },
      layer: function (ok) { legende.classList.add("blinkt"); setTimeout(function () { legende.classList.remove("blinkt"); }, 1400); ok({ g: gebaeude.length, h: halte.length }); return null; },
      auswahl: function (ok) {
        var h = halte.filter(function (x) { return x.name === K.haltestelle; })[0], r = 250 / M;
        var tr = gebaeude.filter(function (g) { return Math.hypot(g.x - h.x, g.y - h.y) <= r; });
        zoomeAuf(ausschnitt(h.x, h.y, 300), function () { el.kreis.setAttribute("cx", h.x); el.kreis.setAttribute("cy", h.y); el.kreis.setAttribute("r", r); zeigen(el.kreis, true); markiere(tr); ok({ n: tr.length }); });
        return { name: K.namen.auswahl, zurueck: function () { zeigen(el.kreis, false); markiere([]); } };
      },
      puffer: function (ok) {
        var tr = gebaeude.filter(function (g) { return abstandZuInn(g.x, g.y) <= 100 / M; });
        zoomeAuf(ausschnitt(860, 470, 700), function () { el.innPuffer.style.strokeWidth = 20; zeigen(el.innPuffer, true); legendeZeigen("puffer", true); ok({ n: tr.length }); });
        return { name: K.namen.puffer, zurueck: function () { zeigen(el.innPuffer, false); legendeZeigen("puffer", false); } };
      },
      undo: function (ok) { var l = stapel.pop(); if (!l) { ok({ leer: true }); return null; } l.zurueck(); ok({ letzte: l.name }); return null; }
    };
    function frage(p) {
      if (laeuft) { return; }
      laeuft = true; chips.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
      log.appendChild(neu("p", "ki-du", p.frage));
      var antw = neu("div", "ki-antwort"), denkt = neu("p", "ki-denkt", K.denkt); antw.appendChild(denkt); log.appendChild(antw); unten();
      var erg = null;
      warte(600).then(function () {
        if (meine !== sitzung) { throw 0; }
        denkt.remove(); var ul = neu("ul", "ki-schritte"); antw.appendChild(ul);
        return p.schritte.reduce(function (k, s) { return k.then(function () { var li = neu("li"); li.innerHTML = HAKEN; li.appendChild(document.createTextNode(s)); ul.appendChild(li); unten(); return warte(380); }); }, Promise.resolve());
      }).then(function () {
        if (meine !== sitzung) { throw 0; }
        return new Promise(function (ok) { if (!p.aktion) { ok({}); return; } erg = A[p.aktion](ok); });
      }).then(function (w) {
        if (meine !== sitzung) { throw 0; }
        if (erg) { stapel.push(erg); }
        var text = w.leer ? K.nichtsZurueck : fuelle(p.antwort, w), abs = neu("p", "ki-text"); antw.appendChild(abs);
        var wo = text.split(" "), i = 0;
        return new Promise(function (r) { (function weiter() { if (ruhig) { abs.textContent = text; r(); return; } abs.textContent = wo.slice(0, ++i).join(" "); unten(); if (i < wo.length) { setTimeout(weiter, 26); } else { r(); } })(); });
      }).then(function () {
        laeuft = false; chips.querySelectorAll("button").forEach(function (b) { b.disabled = false; }); unten();
      }).catch(function () { /* Werkzeug gewechselt */ });
    }
    K.prompts.forEach(function (p) { var b = neu("button", "ki-chip", p.kurz || p.frage); b.type = "button"; if (p.kurz) { b.title = p.frage; } b.addEventListener("click", function () { frage(p); }); chips.appendChild(b); });
    panel.querySelector(".ki-kopf .ki-zuruecksetzen").addEventListener("click", function () {
      if (laeuft) { return; }
      while (stapel.length) { stapel.pop().zurueck(); }
      aufraeumen(); zoomeAuf(START.ki); log.innerHTML = ""; log.appendChild(neu("p", "ki-text ki-begruessung", K.start));
    });
    log.appendChild(neu("p", "ki-text ki-begruessung", K.start));
  }

  // ---------- Umschalten ----------
  var WERKZEUGE = { ki: ki, puffer: puffer, symbologie: symbologie, auswahl: auswahlWerkzeug, hoehe: hoehe, messen: messen };
  function aktivieren(name, fokus) {
    sitzung++; aktiv = name; wurzel.setAttribute("data-aktiv", name);
    tabs.forEach(function (b) { var an = b.getAttribute("data-wz") === name; b.setAttribute("aria-selected", an); b.tabIndex = an ? 0 : -1; if (an && fokus) { b.focus(); } if (an) { var l = b.parentNode; l.scrollLeft = b.offsetLeft - (l.clientWidth - b.offsetWidth) / 2; } });
    panelRahmen.setAttribute("aria-labelledby", "wz-tab-" + name);
    aufraeumen();
    WERKZEUGE[name]();
    zoomeAuf(START[name]);
  }
  tabs.forEach(function (b, i) {
    b.addEventListener("click", function () { aktivieren(b.getAttribute("data-wz")); });
    b.addEventListener("keydown", function (e) {
      var j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
      if (j === null) { return; }
      e.preventDefault(); j = (j + tabs.length) % tabs.length; aktivieren(tabs[j].getAttribute("data-wz"), true);
    });
  });
  setzeVb(vb);
  var start = (location.hash || "").replace("#", "");
  aktivieren(WERKZEUGE[start] ? start : "ki");
})();
