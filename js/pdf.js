/* =============================================================================
 * pdf.js — PDF-Zusammenfassung im Browser erzeugen (jsPDF via CDN)
 * -----------------------------------------------------------------------------
 * Es wird NICHTS an einen Server gesendet: jsPDF baut die Datei im Browser,
 * der Browser lädt sie anschließend lokal herunter.
 * ========================================================================== */

/* -----------------------------------------------------------------------------
 * Firmendaten — hier anpassen, falls sich Kontaktdaten ändern
 * -------------------------------------------------------------------------- */
const FIRMA = {
  name: 'Just & Luis Entrümpelung',
  ort: 'Braunschweig-Stöckheim',
  telefon: '0179 7499007',
};

/* Seitenmaße und Ränge in Millimetern (A4 hochkant: 210 × 297 mm) */
const SEITE = {
  breite: 210,
  hoehe: 297,
  rand: 18,
};

/* -----------------------------------------------------------------------------
 * Zeichen-Absicherung für das PDF
 * -----------------------------------------------------------------------------
 * Die eingebauten jsPDF-Standardfonts (Helvetica) beherrschen nur den
 * Latin-1-Zeichensatz. Umlaute und "\u00b2" funktionieren, aber typografische
 * Zeichen wie das Euro-Zeichen "\u20ac", Gedankenstriche oder geschweifte
 * Anführungszeichen werden ohne Warnung ERSATZLOS VERSCHLUCKT — aus
 * "650\u2013970 \u20ac" würde im PDF "650970". Deshalb läuft jeder Text, der ins
 * PDF geschrieben wird, durch diese Funktion.
 * -------------------------------------------------------------------------- */
function pdfSicher(text) {
  return String(text)
    .replace(/\u20ac/g, 'EUR')      // Euro-Zeichen
    .replace(/[\u2013\u2014]/g, '-')  // Gedankenstrich / Geviertstrich
    .replace(/[\u2018\u2019\u201a]/g, "'")
    .replace(/[\u201c\u201d\u201e]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u00b7]/g, '\u00b7')
    .replace(/\u00a0/g, ' ');        // geschütztes Leerzeichen
}

/**
 * Erzeugt das PDF und startet den Download.
 * @param {object} eingaben  Formulardaten (aus app.js)
 * @param {object} ergebnis  Rückgabe von berechnePreis() (aus pricing.js)
 */
function erstellePDF(eingaben, ergebnis) {
  // jsPDF hängt sich als window.jspdf an (UMD-Build vom CDN)
  const jsPDFKlasse = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDFKlasse) {
    throw new Error('jsPDF ist nicht geladen (CDN nicht erreichbar?).');
  }

  const doc = new jsPDFKlasse({ unit: 'mm', format: 'a4' });
  const links = SEITE.rand;
  const rechts = SEITE.breite - SEITE.rand;
  let y = SEITE.rand;

  /* --- kleine Zeichen-Helfer ---------------------------------------------- */

  // Passt auf, dass nichts über den unteren Rand hinausläuft
  function seitenumbruchPruefen(benoetigt) {
    if (y + benoetigt > SEITE.hoehe - 30) {
      doc.addPage();
      y = SEITE.rand;
    }
  }

  function ueberschrift(text, groesse) {
    seitenumbruchPruefen(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(groesse || 13);
    doc.setTextColor(47, 107, 60); // --gruen-dunkel
    doc.text(pdfSicher(text), links, y);
    y += groesse ? groesse * 0.55 : 7;
  }

  // Eine Zeile "Bezeichnung .......... Wert"
  function zeile(bezeichnung, wert) {
    seitenumbruchPruefen(8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(36, 33, 29);
    doc.text(pdfSicher(bezeichnung), links, y);
    doc.setFont('helvetica', 'bold');
    doc.text(pdfSicher(wert), rechts, y, { align: 'right' });
    y += 7;
  }

  function trennlinie(abstandDanach) {
    doc.setDrawColor(221, 212, 198);
    doc.setLineWidth(0.3);
    doc.line(links, y, rechts, y);
    y += abstandDanach || 6;
  }

  function absatz(text, groesse) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(groesse || 10);
    doc.setTextColor(92, 86, 78);
    const zeilen = doc.splitTextToSize(pdfSicher(text), rechts - links);
    seitenumbruchPruefen(zeilen.length * 5);
    doc.text(zeilen, links, y);
    y += zeilen.length * 5;
  }

  /* --- Kopfbereich --------------------------------------------------------- */
  doc.setFillColor(47, 107, 60);
  doc.rect(0, 0, SEITE.breite, 30, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text(pdfSicher(FIRMA.name), links, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text(pdfSicher(FIRMA.ort + '  ·  Mobil ' + FIRMA.telefon), links, 22);

  y = 44;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(36, 33, 29);
  doc.text(pdfSicher('Kostenschätzung Entrümpelung'), links, y);
  y += 8;

  const jetzt = new Date();
  const datumText = jetzt.toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(92, 86, 78);
  doc.text(pdfSicher('Erstellt am ' + datumText), links, y);
  y += 10;

  /* --- Kundendaten (nur wenn ausgefüllt) ---------------------------------- */
  const hatKundendaten = eingaben.kundenname || eingaben.adresse || eingaben.telefon;
  if (hatKundendaten) {
    ueberschrift('Kundendaten');
    trennlinie();
    if (eingaben.kundenname) zeile('Name', eingaben.kundenname);
    if (eingaben.adresse) zeile('Adresse', eingaben.adresse);
    if (eingaben.telefon) zeile('Telefon', eingaben.telefon);
    y += 5;
  }

  /* --- Angaben zum Objekt -------------------------------------------------- */
  ueberschrift('Angaben zum Objekt');
  trennlinie();
  zeile('Wohnfläche', formatZahl(eingaben.wohnflaeche) + ' m²');
  zeile('Anzahl Zimmer', formatZahl(eingaben.zimmer));
  zeile('Etage', LABELS.etage[eingaben.etage] || String(eingaben.etage));
  zeile('Aufzug vorhanden', eingaben.aufzug ? 'Ja' : 'Nein');
  zeile('Vermüllungsgrad', LABELS.vermuellung[eingaben.vermuellungsgrad]);
  zeile('Kellerabteil zusätzlich', eingaben.kellerabteil ? 'Ja' : 'Nein');

  const gegenstaendeText = eingaben.gegenstaende.length
    ? eingaben.gegenstaende.map(function (k) { return LABELS.gegenstaende[k]; })
    : ['Keine Angabe'];

  // Besondere Gegenstände untereinander auflisten, damit nichts abgeschnitten wird
  seitenumbruchPruefen(8 + gegenstaendeText.length * 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(36, 33, 29);
  doc.text(pdfSicher('Besondere Gegenstände'), links, y);
  gegenstaendeText.forEach(function (text, index) {
    doc.setFont('helvetica', 'bold');
    doc.text(pdfSicher(text), rechts, y + index * 6, { align: 'right' });
  });
  y += gegenstaendeText.length * 6 + 6;

  /* --- Preisspanne --------------------------------------------------------- */
  ueberschrift('Unverbindliche Kostenschätzung');
  seitenumbruchPruefen(30);
  doc.setFillColor(234, 243, 234);
  doc.setDrawColor(47, 107, 60);
  doc.setLineWidth(0.5);
  doc.roundedRect(links, y, rechts - links, 22, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(47, 107, 60);
  // Preiszeile bewusst mit "-" und "EUR" statt "\u2013" und "\u20ac" (siehe pdfSicher)
  const preisZeile = 'ca. ' + formatZahl(ergebnis.spanneVon) + ' - ' +
    formatZahl(ergebnis.spanneBis) + ' EUR (VB)';
  doc.text(pdfSicher(preisZeile), links + 6, y + 14.5);
  y += 29;

  absatz(
    'Unverbindliche Schätzung auf Grundlage der oben genannten Angaben. ' +
    'Das finale Angebot machen wir nach kurzer Rücksprache oder einem Blick vor Ort. ' +
    'Diese Zusammenfassung ist kein Vertrag und kein verbindliches Angebot.'
  );
  y += 4;

  /* --- Fußzeile auf allen Seiten ------------------------------------------ */
  const seitenAnzahl = doc.getNumberOfPages();
  for (let seite = 1; seite <= seitenAnzahl; seite++) {
    doc.setPage(seite);
    const fussY = SEITE.hoehe - 18;
    doc.setDrawColor(221, 212, 198);
    doc.setLineWidth(0.3);
    doc.line(links, fussY - 6, rechts, fussY - 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(47, 107, 60);
    doc.text(pdfSicher(FIRMA.name + '  ·  ' + FIRMA.ort), links, fussY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(92, 86, 78);
    doc.text(pdfSicher('Mobil ' + FIRMA.telefon), links, fussY + 5);
    if (seitenAnzahl > 1) {
      doc.text('Seite ' + seite + ' von ' + seitenAnzahl, rechts, fussY + 5, { align: 'right' });
    }
  }

  /* --- Dateiname und Download --------------------------------------------- */
  const datumDatei = jetzt.toISOString().slice(0, 10); // z. B. 2026-09-11
  // Umlaute im Dateinamen umschreiben — manche Systeme stolpern sonst darüber
  const nameTeil = eingaben.kundenname
    ? '-' + eingaben.kundenname
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
        .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    : '';
  doc.save('Entruempelung-Kostenschaetzung-' + datumDatei + nameTeil + '.pdf');
}
