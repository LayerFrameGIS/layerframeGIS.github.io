/* LayerFrame-Website: Platzhalter aus config.js, Tooltips im Abdeckungsdiagramm, Bildlupe. Kein Tracking. */
(function () {
  "use strict";
  var c = window.LAYERFRAME || {};
  var wurzel = document.documentElement.getAttribute("data-wurzel") || "";
  function adresse(wert) { return /^(https?:|mailto:|\/)/.test(wert) ? wert : wurzel + wert; }

  // Platzhalter: data-lf="kontakt|version" (Text), data-lf-href="kontakt|setupOffline|setupWeb|handbuch|github"
  document.querySelectorAll("[data-lf]").forEach(function (el) {
    var wert = c[el.getAttribute("data-lf")];
    if (wert) {
      if (el.getAttribute("data-lf-vorlage")) {
        el.textContent = el.getAttribute("data-lf-vorlage").replace("{v}", wert);
      } else { el.textContent = wert; }
    }
  });
  document.querySelectorAll("[data-lf-href]").forEach(function (el) {
    var name = el.getAttribute("data-lf-href"), wert = c[name];
    if (name === "github") { if (wert) { el.href = wert; el.hidden = false; } else { el.hidden = true; } return; }
    if (!wert) { return; }
    el.href = name === "kontakt" ? "mailto:" + wert : adresse(wert);
  });

  // Sanftes Einblenden beim Scrollen – nur was beim Laden noch unterhalb des Bildschirms liegt
  if ("IntersectionObserver" in window && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    var beobachter = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) { if (e.isIntersecting) { e.target.classList.remove("wartet"); beobachter.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".erscheinen").forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add("wartet"); beobachter.observe(el); }
    });
  }

  // Knopf „Adresse kopieren“
  document.querySelectorAll("[data-kopieren]").forEach(function (knopf) {
    var original = knopf.textContent;
    knopf.addEventListener("click", function () {
      var wert = c[knopf.getAttribute("data-kopieren")] || "";
      if (!wert) {
        var link = document.querySelector('[data-lf="' + knopf.getAttribute("data-kopieren") + '"]');
        wert = link ? link.textContent : "";
      }
      if (!navigator.clipboard) { return; }
      navigator.clipboard.writeText(wert).then(function () {
        knopf.textContent = knopf.getAttribute("data-kopiert");
        setTimeout(function () { knopf.textContent = original; }, 1800);
      });
    });
  });

  // Tooltip für Diagrammsegmente (Maus und Tastatur)
  var tipp = document.createElement("div");
  tipp.className = "tipp"; tipp.hidden = true; tipp.setAttribute("role", "status");
  document.body.appendChild(tipp);
  function zeigen(el, x, y) {
    tipp.textContent = el.getAttribute("data-tipp");
    tipp.hidden = false;
    var b = tipp.offsetWidth, h = tipp.offsetHeight;
    tipp.style.left = Math.max(8, Math.min(window.innerWidth - b - 8, x - b / 2)) + "px";
    tipp.style.top = Math.max(8, y - h - 12) + "px";
  }
  document.querySelectorAll("[data-tipp]").forEach(function (el) {
    el.addEventListener("mousemove", function (e) { zeigen(el, e.clientX, e.clientY); });
    el.addEventListener("mouseleave", function () { tipp.hidden = true; });
    el.addEventListener("focus", function () {
      var r = el.getBoundingClientRect(); zeigen(el, r.left + r.width / 2, r.top);
    });
    el.addEventListener("blur", function () { tipp.hidden = true; });
  });

  // Bildlupe für die Galerie (ohne JavaScript öffnet der Link das Bild direkt)
  var lupe = document.querySelector("dialog.lupe");
  if (lupe && typeof lupe.showModal === "function") {
    var bild = lupe.querySelector("img"), text = lupe.querySelector("p");
    document.querySelectorAll("a[data-lupe]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var img = a.querySelector("img");
        bild.src = a.href; bild.alt = img ? img.alt : "";
        text.textContent = a.getAttribute("data-lupe");
        lupe.showModal();
      });
    });
    lupe.addEventListener("click", function (e) { if (e.target === lupe || e.target.tagName === "BUTTON") { lupe.close(); } });
  }
})();
