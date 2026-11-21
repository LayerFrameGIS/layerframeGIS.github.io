/* LayerFrame-Website – hier zentral anpassen.
   Die Werte ersetzen beim Laden die gleichnamigen Platzhalter in allen Seiten.
   Leere Werte lassen den Platzhaltertext in der Seite stehen. */
window.LAYERFRAME = {
  version: "v2.0.0",
  // Kontaktadresse für Feedback, Fragen und Impressum
  kontakt: "hello@layerframe.at",

  // Download (GitHub-Release LayerFrameGIS/downloads, Closed Beta v2.0.0 – online seit 21.11.2026).
  // Adressen mit fester Version (nicht „latest“), damit ein späteres Release diese Links nicht ins Leere laufen lässt.
  downloadAktiv: true,
  setupOffline: "https://github.com/LayerFrameGIS/downloads/releases/download/v2.0.0/LayerFrame-Setup-Beta-v2.0.0-offline.exe",
  setupOfflineGroesse: "494 MB",
  setupOfflineSha: "4b621fb59eedd80d7f7378871dacec1a5e260ada070ddc3f3046c41533ce7c00",
  setupWeb: "https://github.com/LayerFrameGIS/downloads/releases/download/v2.0.0/LayerFrame-Setup-Beta-v2.0.0-web.exe",
  setupWebGroesse: "236 MB",
  setupWebSha: "5ac57f7676f8e2bc84975d693b1e763037e19db6a9aa8face97a2e89c3706b49",
  // SmartScreen-Bildschirmfotos (Pfad relativ zur Website, z. B. "assets/img/smartscreen_1_de.webp")
  smartscreen1: "",
  smartscreen2: "",

  handbuch: "",
  // Projektseite/Repository (leer lassen, wenn es keine gibt)
  github: ""
};
