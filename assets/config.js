/* LayerFrame-Website – hier zentral anpassen.
   Die Werte ersetzen beim Laden die gleichnamigen Platzhalter in allen Seiten.
   Leere Werte lassen den Platzhaltertext in der Seite stehen. */
window.LAYERFRAME = {
  version: "v1.0.0",
  // Kontaktadresse für Feedback, Fragen und Impressum
  kontakt: "hello@layerframe.at",

  // Download (GitHub-Release LayerFrameGIS/downloads). Erst auf true setzen, wenn das Release online ist.
  downloadAktiv: false,
  setupOffline: "https://github.com/LayerFrameGIS/downloads/releases/latest/download/LayerFrame-Setup-Beta-v1.0.0-offline.exe",
  setupOfflineGroesse: "",   // z. B. "1,2 GB" – nach dem Installer-Bau eintragen
  setupOfflineSha: "",       // SHA-256 – nach dem Installer-Bau eintragen
  setupWeb: "https://github.com/LayerFrameGIS/downloads/releases/latest/download/LayerFrame-Setup-Beta-v1.0.0-web.exe",
  setupWebGroesse: "",
  setupWebSha: "",
  // SmartScreen-Bildschirmfotos (Pfad relativ zur Website, z. B. "assets/img/smartscreen_1_de.webp")
  smartscreen1: "",
  smartscreen2: "",

  handbuch: "",
  // Projektseite/Repository (leer lassen, wenn es keine gibt)
  github: ""
};
