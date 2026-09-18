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
  let ergebnis = String(text)
    .replace(/\u20ac/g, 'EUR')        // Euro-Zeichen
    .replace(/[\u2013\u2014]/g, '-')    // Gedankenstrich / Geviertstrich
    .replace(/\u2248/g, '~')           // ungefähr-Zeichen
    .replace(/[\u2018\u2019\u201a]/g, "'")
    .replace(/[\u201c\u201d\u201e]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022]/g, '\u00b7')
    .replace(/\u00a0/g, ' ');          // geschütztes Leerzeichen

  // Häufige Buchstaben aus Nachbarsprachen umschreiben, statt sie zu
  // verlieren — bei Kundennamen ist "Michal" deutlich besser als "Micha".
  const umschrift = {
    'ł':'l','Ł':'L','ś':'s','Ś':'S','ż':'z','Ż':'Z','ź':'z','Ź':'Z',
    'ą':'a','Ą':'A','ę':'e','Ę':'E','ć':'c','Ć':'C','ń':'n','Ń':'N',
    'č':'c','Č':'C','š':'s','Š':'S','ř':'r','ě':'e','ů':'u','ő':'o','ű':'u',
    'ğ':'g','Ğ':'G','ş':'s','Ş':'S','ı':'i','İ':'I',
  };
  ergebnis = ergebnis.replace(/[^\u0000-\u00ff]/g, function (zeichen) {
    if (umschrift[zeichen]) return umschrift[zeichen];
    // Alles Übrige würde von jsPDF lautlos verschluckt. In der Konsole
    // meldet es sich, damit die Lücke auffällt und hier ergänzt werden kann.
    console.warn('pdfSicher: Zeichen nicht darstellbar und entfernt:', zeichen);
    return '';
  });
  return ergebnis;
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
    seitenumbruchPruefen(7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(36, 33, 29);
    doc.text(pdfSicher(bezeichnung), links, y);
    doc.setFont('helvetica', 'bold');
    doc.text(pdfSicher(wert), rechts, y, { align: 'right' });
    y += 6.0;
  }

  function trennlinie(abstandDanach) {
    doc.setDrawColor(221, 212, 198);
    doc.setLineWidth(0.3);
    doc.line(links, y, rechts, y);
    y += abstandDanach || 6;
  }

  function absatz(text, groesse) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(groesse || 9.5);
    doc.setTextColor(92, 86, 78);
    const zeilen = doc.splitTextToSize(pdfSicher(text), rechts - links);
    seitenumbruchPruefen(zeilen.length * 4.6);
    doc.text(zeilen, links, y);
    y += zeilen.length * 4.6;
  }

  /* --- Kopfbereich --------------------------------------------------------- */
  doc.setFillColor(47, 107, 60);
  doc.rect(0, 0, SEITE.breite, 27, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text(pdfSicher(FIRMA.name), links, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text(pdfSicher(FIRMA.ort + '  ·  Mobil ' + FIRMA.telefon), links, 20.5);

  y = 39;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(36, 33, 29);
  doc.text(pdfSicher('Kostenschätzung ' + ergebnis.auftragsartLabel), links, y);
  y += 8;

  const jetzt = new Date();
  const datumText = jetzt.toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(92, 86, 78);
  const kopfzeile = eingaben.referenz
    ? 'Erstellt am ' + datumText + '   \u00b7   Ihre Anfrage: ' + eingaben.referenz
    : 'Erstellt am ' + datumText;
  doc.text(pdfSicher(kopfzeile), links, y);
  y += 8;

  /* --- Kundendaten (nur wenn ausgefüllt) ---------------------------------- */
  const hatKundendaten = eingaben.kundenname || eingaben.adresse || eingaben.telefon;
  if (hatKundendaten) {
    ueberschrift('Kundendaten');
    trennlinie();
    if (eingaben.kundenname) zeile('Name', eingaben.kundenname);
    if (eingaben.adresse) zeile('Adresse / Baustelle', eingaben.adresse);
    if (eingaben.telefon) zeile('Telefon', eingaben.telefon);
    y += 3.5;
  }

  /* --- Was ist zu tun ------------------------------------------------------ */
  if (eingaben.beschreibung) {
    ueberschrift('Leistung');
    trennlinie();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(36, 33, 29);
    const beschreibungsZeilen = doc.splitTextToSize(pdfSicher(eingaben.beschreibung), rechts - links);
    seitenumbruchPruefen(beschreibungsZeilen.length * 5.5);
    doc.text(beschreibungsZeilen, links, y);
    y += beschreibungsZeilen.length * 5.2 + 5;
  }

  /* --- Angaben zum Auftrag ------------------------------------------------- */
  ueberschrift('Angaben zum Auftrag');
  trennlinie();
  zeile('Art des Auftrags', ergebnis.auftragsartLabel);

  if (ergebnis.modell === 'flaeche') {
    // Entrümpelung
    zeile('Wohnfläche', formatZahl(eingaben.wohnflaeche) + ' m²');
    if (eingaben.zimmer) zeile('Anzahl Zimmer', formatZahl(eingaben.zimmer));
    zeile('Vermüllungsgrad', LABELS.vermuellung[eingaben.vermuellungsgrad]);
    zeile('Kellerabteil zusätzlich', eingaben.kellerabteil ? 'Ja' : 'Nein');
  } else {
    // Abbruch, Bau, Sonstiges
    zeile('Schwierigkeit', LABELS.erschwernis[eingaben.erschwernis]);
    if (eingaben.material > 0) zeile('Material (im Preis enthalten)', 'Ja');
  }

  zeile('Etage', LABELS.etage[eingaben.etage] || String(eingaben.etage));
  zeile('Aufzug vorhanden', eingaben.aufzug ? 'Ja' : 'Nein');

  // Voraussichtliche Dauer — hilft dem Kunden bei der Terminplanung.
  // Personenstunden und interner Richtwert stehen hier bewusst NICHT.
  zeile('Voraussichtliche Dauer vor Ort', formatZeitslot(ergebnis.zeitslot));
  if (ergebnis.volumen > 0) {
    zeile('Zu entsorgende Menge', formatVolumen(ergebnis.volumen));
  }

  /* --- Entsorgung untereinander auflisten ---------------------------------- */
  const entsorgungText = eingaben.abfallarten.length
    ? eingaben.abfallarten.map(function (k) { return LABELS.abfallarten[k]; })
    : ['Keine'];

  seitenumbruchPruefen(8 + entsorgungText.length * 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(36, 33, 29);
  doc.text(pdfSicher('Entsorgung'), links, y);
  entsorgungText.forEach(function (text, index) {
    doc.setFont('helvetica', 'bold');
    doc.text(pdfSicher(text), rechts, y + index * 6, { align: 'right' });
  });
  y += entsorgungText.length * 5.8 + 5;

  /* --- Preisspanne --------------------------------------------------------- */
  // Platz für den GANZEN Schlussblock prüfen, bevor die Überschrift gesetzt
  // wird: Überschrift, Preiskasten, Umsatzsteuer-Hinweis und Schlussabsatz.
  // Sonst bleibt die Überschrift allein auf der Seite zurück.
  seitenumbruchPruefen(64);
  ueberschrift('Unverbindliche Kostenschätzung');
  doc.setFillColor(234, 243, 234);
  doc.setDrawColor(47, 107, 60);
  doc.setLineWidth(0.5);
  doc.roundedRect(links, y, rechts - links, 20, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(47, 107, 60);
  // Preiszeile bewusst mit "-" und "EUR" statt "\u2013" und "\u20ac" (siehe pdfSicher)
  const preisZeile = 'ca. ' + formatZahl(ergebnis.spanneVon) + ' - ' +
    formatZahl(ergebnis.spanneBis) + ' EUR (VB)';
  doc.text(pdfSicher(preisZeile), links + 6, y + 13.5);
  y += 26;

  // Umsatzsteuer-Hinweis je nach Einstellung in pricing.js
  if (PREISE.umsatzsteuer.kleinunternehmer) {
    absatz(
      'Der Betrag ist ein Endpreis. Als Kleinunternehmer nach § 19 UStG ' +
      'weisen wir keine Umsatzsteuer aus.'
    );
  } else {
    const satz = Math.round(PREISE.umsatzsteuer.satz * 100);
    absatz(
      'Die genannten Beträge sind Nettopreise. Hinzu kommen ' + satz +
      ' % Umsatzsteuer, also brutto etwa ' +
      formatZahl(Math.round(ergebnis.spanneVon * (1 + PREISE.umsatzsteuer.satz))) + ' bis ' +
      formatZahl(Math.round(ergebnis.spanneBis * (1 + PREISE.umsatzsteuer.satz))) + ' EUR.'
    );
  }
  y += 2;

  absatz(
    'Unverbindliche Schätzung auf Grundlage der genannten Angaben. Das finale ' +
    'Angebot folgt nach kurzer Rücksprache oder einem Blick vor Ort. Kein Vertrag ' +
    'und kein verbindliches Angebot.'
  );
  y += 4;

  /* --- Screenshot der Anfrage als interner Anhang -------------------------
   * Nur wenn im Werkzeug ausdrücklich angehakt. Die Mail enthält interne
   * Einordnungen ("allein machbar", "eigener Container nötig?"), die ein
   * Kunde nicht sehen soll — deshalb eine eigene, deutlich beschriftete
   * Seite und kein stiller Anhang.
   * ---------------------------------------------------------------------- */
  if (eingaben.screenshot) {
    doc.addPage();
    doc.setFillColor(168, 50, 42); // Warnrot
    doc.rect(0, 0, SEITE.breite, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(pdfSicher('Interner Anhang – nicht an Kunden weitergeben'), links, 10.5);

    doc.setTextColor(36, 33, 29);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(pdfSicher('Screenshot der Anfrage über die Website'), links, 26);

    try {
      const eigenschaften = doc.getImageProperties(eingaben.screenshot);
      const maxBreite = rechts - links;
      const maxHoehe = SEITE.hoehe - 32 - 24;
      const faktor = Math.min(maxBreite / eigenschaften.width, maxHoehe / eigenschaften.height);
      doc.addImage(
        eingaben.screenshot, 'JPEG', links, 32,
        eigenschaften.width * faktor, eigenschaften.height * faktor
      );
    } catch (fehler) {
      doc.text(pdfSicher('Der Screenshot konnte nicht eingefügt werden.'), links, 40);
      console.error(fehler);
    }
  }

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
  // Auftragsart im Dateinamen, damit mehrere PDFs unterscheidbar bleiben
  const artTeil = ergebnis.auftragsart.charAt(0).toUpperCase() + ergebnis.auftragsart.slice(1);
  doc.save('Kostenschaetzung-' + artTeil + '-' + datumDatei + nameTeil + '.pdf');
}
