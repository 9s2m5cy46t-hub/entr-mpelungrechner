/* =============================================================================
 * export.js — Text für Blitzangebot erzeugen
 * -----------------------------------------------------------------------------
 * Der Knopf „Für Blitzangebot kopieren" legt diesen Text in die Zwischenablage.
 * In Blitzangebot wird er in das Textfeld für neue Angebote eingefügt; dort
 * kommen die Preise aus dem eigenen Preisbuch dazu.
 *
 * Deshalb stehen hier AUSDRÜCKLICH KEINE PREISE: weder Richtwert noch
 * Kundenspanne, weder Stundensatz noch Eigenkosten. Der Text transportiert
 * nur die MENGEN, die dieser Rechner ermittelt hat. Von den Kundendaten steht
 * nur der Ort darin — Name und Telefonnummer gehören nicht in ein
 * Angebotsformular, das sie ohnehin schon kennt.
 * ========================================================================== */

/* -----------------------------------------------------------------------------
 * POSITIONEN AUS DEM PREISBUCH
 * -----------------------------------------------------------------------------
 * MUSS ZU pricebook-templates.ts IN BLITZANGEBOT PASSEN.
 *
 * Wörtlich übernommen aus GEWERK_TEMPLATES, Gewerke "entruempelung" und
 * "garten". Bezeichnung und Einheit sind genau die dortigen Zeichenketten —
 * nur so findet Blitzangebot die Position im Preisbuch wieder. Wer hier etwas
 * ändert, muss es dort ebenfalls ändern.
 *
 * Nicht jede Menge aus diesem Rechner hat dort eine Entsprechung. Was keine
 * hat, wird NICHT auf eine ähnlich klingende Position gebogen, sondern landet
 * in der Zeile "Hinweis:" — eine erfundene Position wäre im Angebot eine
 * falsche Leistung.
 * -------------------------------------------------------------------------- */
const BLITZANGEBOT_POSITIONEN = {
  entruempelung: {
    // GEWERK_TEMPLATES key "entruempelung"
    gewerk: 'Entrümpelung / Entsorgung',
    nachVolumen: { bezeichnung: 'Entrümpelung nach Volumen', einheit: 'm³' },
    arbeitszeit: { bezeichnung: 'Helfer Arbeitszeit', einheit: 'Std' },
    etagenzuschlag: { bezeichnung: 'Trage- / Etagenzuschlag', einheit: 'pausch.' },
    elektro: { bezeichnung: 'Elektrogroßgeräte fachgerecht entsorgen', einheit: 'Stk' },
    sondermuell: { bezeichnung: 'Sondermüll / Farben / Chemie entsorgen', einheit: 'pausch.' },
    anfahrt: { bezeichnung: 'An- und Abfahrt', einheit: 'pausch.' },
  },
  garten: {
    // GEWERK_TEMPLATES key "garten"
    gewerk: 'Garten & Landschaft',
    arbeitszeit: { bezeichnung: 'Gärtner / Helfer Arbeitszeit', einheit: 'Std' },
    gruenschnitt: { bezeichnung: 'Laub- / Grünschnitt entsorgen', einheit: 'm³' },
    anfahrt: { bezeichnung: 'An- und Abfahrt', einheit: 'pausch.' },
  },
};

/* -----------------------------------------------------------------------------
 * Wofür es bewusst KEINE Position gibt
 * -----------------------------------------------------------------------------
 * Die Fahrten zum Wertstoffhof fährt dieser Betrieb mit eigenem Anhänger. Im
 * Preisbuch gibt es nur „Container-Stellung und Abfuhr" (Stk) — das ist etwas
 * anderes: ein gestellter Container, den ein Entsorger abholt. Diese Position
 * für eigene Fahrten zu nehmen, hieße dem Kunden eine Leistung anzubieten,
 * die niemand erbringt. Die Fahrzeit steckt ohnehin schon in der
 * Helfer-Arbeitszeit; die Zahl der Fahrten steht als Hinweis dabei.
 *
 * Ebenso ohne Position: die Zahl der Personen. Sie ist keine Leistung,
 * sondern eine Annahme hinter der Arbeitszeit, und steht deshalb dort.
 * -------------------------------------------------------------------------- */

/** Formatiert eine Menge deutsch, ohne Nachkommastellen bei ganzen Zahlen. */
function mengeText(wert) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(wert);
}

/** Eine Angebotszeile: "Bezeichnung: Menge Einheit (Zusatz)". */
function posten(position, menge, zusatz) {
  return '- ' + position.bezeichnung + ': ' + menge + ' ' + position.einheit +
    (zusatz ? ' (' + zusatz + ')' : '');
}

/**
 * Baut den Text für die Zwischenablage.
 *
 * @param {object} eingaben  wie an berechnePreis übergeben
 * @param {object} ergebnis  Rückgabe von berechnePreis
 * @returns {string}
 */
function baueBlitzangebotText(eingaben, ergebnis) {
  const istGarten = eingaben.auftragsart === 'garten';
  const P = istGarten ? BLITZANGEBOT_POSITIONEN.garten : BLITZANGEBOT_POSITIONEN.entruempelung;

  const zeilen = [];
  const hinweise = [];

  /* --- Kopfzeile: Gewerk, Anfrage-Nummer, Ort -------------------------- */
  const kopf = [P.gewerk];
  if (eingaben.referenz) kopf.push('Anfrage ' + eingaben.referenz);
  if (eingaben.adresse) kopf.push(eingaben.adresse);
  zeilen.push(kopf.join(' — '));
  zeilen.push('');

  const zonenText = LABELS.zonenKurz[ergebnis.zone] || '';

  if (istGarten) {
    /* --- Gartenpflege ------------------------------------------------- */
    // Arbeitszeit nur, wenn sie wirklich bekannt ist: Entweder hat der
    // Rechner sie geschätzt oder jemand hat die Dauer eingetragen. Ohne
    // beides bleibt die Zeile weg, statt mit 0 Std. dazustehen.
    if (ergebnis.personenstunden > 0) {
      zeilen.push(posten(P.arbeitszeit,
        mengeText(aufHalbeStundenAufrunden(ergebnis.personenstunden)),
        ergebnis.personen + ' Personen'));
    } else {
      hinweise.push('Arbeitszeit steht noch nicht fest – im Rechner die Dauer ' +
        'eintragen oder beim Termin schätzen.');
    }

    const mitGruen = (eingaben.abfallarten || []).indexOf('gruenschnitt') !== -1;
    if (mitGruen) {
      if (ergebnis.volumen > 0) {
        zeilen.push(posten(P.gruenschnitt, mengeText(Math.round(ergebnis.volumen)), null));
      } else {
        hinweise.push('Grünschnitt soll mit, das Volumen ist aber nicht geschätzt – ' +
          'beim Termin nachtragen.');
      }
    }

    zeilen.push(posten(P.anfahrt, '1', zonenText));

  } else {
    /* --- Entrümpelung ------------------------------------------------- */
    if (ergebnis.volumen > 0) {
      zeilen.push(posten(P.nachVolumen, mengeText(Math.round(ergebnis.volumen)), null));
    } else {
      hinweise.push('Kein Volumen ermittelt – ohne Menge lässt sich die ' +
        'Hauptposition nicht füllen.');
    }

    if (ergebnis.personenstunden > 0) {
      zeilen.push(posten(P.arbeitszeit,
        mengeText(aufHalbeStundenAufrunden(ergebnis.personenstunden)),
        ergebnis.personen + ' Personen, Fahrzeit enthalten'));
    }

    // Trage- und Etagenzuschlag nur, wenn er auch berechnet wurde.
    if (ergebnis.etagenZuschlag > 0) {
      zeilen.push(posten(P.etagenzuschlag, '1',
        (LABELS.etage[eingaben.etage] || eingaben.etage) + ', ohne Aufzug'));
    }

    const arten = eingaben.abfallarten || [];
    if (arten.indexOf('elektroschrott') !== -1) {
      // Einheit ist Stk, die Mail nennt aber nie eine Zahl. Lieber offen
      // lassen als eine erfinden.
      zeilen.push(posten(P.elektro, '?', 'Anzahl beim Termin zählen'));
    }
    if (arten.indexOf('sondermuell') !== -1) {
      zeilen.push(posten(P.sondermuell, '1', null));
    }

    zeilen.push(posten(P.anfahrt, '1', zonenText));

    // Eigene Fahrten: ohne Position im Preisbuch, siehe Kommentar oben.
    if (ergebnis.fahrten > 0) {
      hinweise.push(ergebnis.fahrten + ' Fahrten zum Wertstoffhof mit eigenem ' +
        'Anhänger. Dafür gibt es im Preisbuch keine Position – die Fahrzeit ' +
        'steckt in der Arbeitszeit, die Gebühren sind nicht enthalten.');
    }
  }

  /* --- Annahmen --------------------------------------------------------- */
  const annahmen = [];
  if (ergebnis.spanneHerkunft === 'volumenspanne') {
    // Hier die GERECHNETE Menge, nicht die gerundete aus der Position:
    // 25,5 m³ als „26 m³" auszugeben wäre in den Annahmen schlicht falsch.
    annahmen.push('Mengenangabe der Anfrage ' + mengeText(ergebnis.spanneVolumenMin) +
      '–' + mengeText(ergebnis.spanneVolumenMax) + ' m³, gerechnet mit ' +
      mengeText(ergebnis.volumen) + ' m³');
  } else if (!istGarten && ergebnis.volumen > 0) {
    annahmen.push('Volumen ' + mengeText(ergebnis.volumen) + ' m³ (' +
      ergebnis.volumenHerkunft + ')');
  }
  if (!istGarten) {
    annahmen.push('Füllgrad ' + (LABELS.vermuellung[eingaben.vermuellungsgrad] || 'unbekannt'));
  }
  annahmen.push(ergebnis.personen + ' Personen');
  annahmen.push('Mengen vor der Besichtigung geschätzt');

  zeilen.push('');
  zeilen.push('Annahmen: ' + annahmen.join('; ') + '.');
  hinweise.forEach(function (h) { zeilen.push('Hinweis: ' + h); });

  return zeilen.join('\n');
}
