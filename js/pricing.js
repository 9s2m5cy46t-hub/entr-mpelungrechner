/* =============================================================================
 * pricing.js — Kalkulationslogik Entrümpelungsrechner
 * -----------------------------------------------------------------------------
 * Diese Datei enthält ALLE Preis-Konstanten und die komplette Rechenlogik.
 * Wenn sich Preise ändern, muss NUR hier unten in PREISE etwas angepasst werden.
 * Keine Abhängigkeiten, läuft direkt im Browser (kein Build, kein npm).
 * ========================================================================== */

/* -----------------------------------------------------------------------------
 * 1) PREIS-KONSTANTEN  ← hier anpassen
 * -------------------------------------------------------------------------- */
const PREISE = {
  // Grundpauschale: deckt Anfahrt, Fahrzeug, Grundaufwand (in Euro)
  grundpauschale: 80,

  // Preis pro Quadratmeter Wohnfläche (in Euro)
  proQuadratmeter: 3.5,

  // Aufschlag, wenn KEIN Aufzug vorhanden ist: 15 % pro Etage über dem EG.
  // Beispiel 3. Etage ohne Aufzug = 3 × 15 % = 45 % Aufschlag.
  // Mit Aufzug entfällt dieser Aufschlag komplett.
  etagenaufschlagOhneAufzug: 0.15,

  // Multiplikator nach Vermüllungsgrad (wirkt auf Grundpauschale + Fläche)
  vermuellung: {
    leicht: 1.0,
    mittel: 1.3,
    stark: 1.7,
  },

  // Kellerabteil zusätzlich entrümpeln: Pauschale (in Euro)
  kellerabteil: 50,

  // Zuschläge für besondere Gegenstände (in Euro, jeweils falls ausgewählt)
  gegenstaende: {
    sperrmuell: 40,
    elektroschrott: 30,
    sondermuell: 60,
  },

  // Breite der angezeigten Preisspanne: ±20 % auf den Kalkulationspreis
  spanneProzent: 0.2,

  // Auf welchen Betrag die angezeigte Spanne gerundet wird (in Euro).
  // 10 = es werden immer runde Zehner-Beträge angezeigt ("350–550 €").
  rundungSpanne: 10,
};

/* -----------------------------------------------------------------------------
 * 2) TEXTE zu den Auswahlmöglichkeiten
 *    Werden sowohl im Formular (Beschreibung) als auch in der PDF-Liste genutzt,
 *    damit beides garantiert dieselbe Bezeichnung verwendet.
 * -------------------------------------------------------------------------- */
const LABELS = {
  vermuellung: {
    leicht: 'Leicht',
    mittel: 'Mittel',
    stark: 'Stark',
  },
  vermuellungBeschreibung: {
    leicht: 'Normal möbliert, alles gut zugänglich, keine Sonderfälle.',
    mittel: 'Viele Kartons, Schränke voll, Wege teilweise zugestellt.',
    stark: 'Räume stark zugestellt, Bodenfläche kaum sichtbar, hoher Aufwand.',
  },
  gegenstaende: {
    sperrmuell: 'Sperrmüll (Möbel, Matratzen)',
    elektroschrott: 'Elektroschrott (Geräte, Fernseher)',
    sondermuell: 'Sondermüll (Farben, Chemikalien)',
  },
  etage: {
    eg: 'Erdgeschoss',
    1: '1. Etage',
    2: '2. Etage',
    3: '3. Etage',
    4: '4. Etage',
    5: '5. Etage',
    hoeher: '6. Etage oder höher',
  },
};

/* -----------------------------------------------------------------------------
 * 3) HILFSFUNKTIONEN
 * -------------------------------------------------------------------------- */

/**
 * Wandelt den Etagen-Wert aus dem Dropdown in eine Zahl um
 * (Anzahl Etagen über dem Erdgeschoss).
 * "eg" -> 0, "1".."5" -> 1..5, "hoeher" -> 6 (kaufmännisch vorsichtig gerechnet)
 */
function etagenAlsZahl(etage) {
  if (etage === 'eg') return 0;
  if (etage === 'hoeher') return 6;
  const n = parseInt(etage, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Rundet auf das nächste Vielfache von `schritt` (z. B. 10 €). */
function rundeAuf(betrag, schritt) {
  return Math.round(betrag / schritt) * schritt;
}

/** Formatiert eine Zahl deutsch mit Tausenderpunkt, ohne Cent, z. B. "1.240". */
function formatZahl(betrag) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(betrag);
}

/** Formatiert einen Betrag als deutschen Euro-Betrag ohne Cent, z. B. "1.240 €". */
function formatEuro(betrag) {
  return formatZahl(betrag) + ' \u20ac';
}

/** Formatiert einen Betrag mit Cent, z. B. "1.240,65 €" (für die interne Kalkulation). */
function formatEuroCent(betrag) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(betrag) + ' \u20ac';
}

/* -----------------------------------------------------------------------------
 * 4) HAUPTBERECHNUNG
 * -----------------------------------------------------------------------------
 * Reihenfolge der Berechnung (bewusst so gewählt und hier dokumentiert):
 *
 *   1. Basis      = Grundpauschale + (Wohnfläche × Preis pro m²)
 *   2. Basis      × Vermüllungs-Multiplikator
 *      (der Vermüllungsgrad wirkt auf den flächenabhängigen Arbeitsaufwand,
 *       NICHT auf die Entsorgungspauschalen — sonst würde eine Dose Farbe
 *       im stark vermüllten Objekt plötzlich 102 € statt 60 € kosten)
 *   3. + Kellerabteil-Pauschale
 *      + Zuschläge für besondere Gegenstände
 *   4. Ergebnis   × (1 + Etagen über EG × 15 %)   — nur falls KEIN Aufzug
 *      (laut Vorgabe "15 % auf den Gesamtpreis", daher ganz am Ende und
 *       linear, nicht zinseszins-artig)
 *
 * Rückgabe: Objekt mit Endpreis, Preisspanne und einer Aufschlüsselung
 * (die Aufschlüsselung ist praktisch, um intern nachzuvollziehen,
 *  woraus sich der Preis zusammensetzt).
 * -------------------------------------------------------------------------- */
function berechnePreis(eingaben) {
  const wohnflaeche = Math.max(0, Number(eingaben.wohnflaeche) || 0);
  const vermuellungsgrad = eingaben.vermuellungsgrad || 'leicht';
  const multiplikator = PREISE.vermuellung[vermuellungsgrad] ?? 1.0;
  const gegenstaende = Array.isArray(eingaben.gegenstaende) ? eingaben.gegenstaende : [];

  // Schritt 1: Basis aus Pauschale und Fläche
  const flaechenpreis = wohnflaeche * PREISE.proQuadratmeter;
  const basis = PREISE.grundpauschale + flaechenpreis;

  // Schritt 2: Vermüllungsgrad
  const nachVermuellung = basis * multiplikator;
  const vermuellungsZuschlag = nachVermuellung - basis;

  // Schritt 3: Pauschalen aufaddieren
  const kellerZuschlag = eingaben.kellerabteil ? PREISE.kellerabteil : 0;

  let gegenstaendeZuschlag = 0;
  const gegenstaendePositionen = [];
  gegenstaende.forEach(function (key) {
    const betrag = PREISE.gegenstaende[key];
    if (betrag) {
      gegenstaendeZuschlag += betrag;
      gegenstaendePositionen.push({ key: key, label: LABELS.gegenstaende[key], betrag: betrag });
    }
  });

  const zwischensumme = nachVermuellung + kellerZuschlag + gegenstaendeZuschlag;

  // Schritt 4: Etagenaufschlag, wenn kein Aufzug vorhanden ist
  const etagen = etagenAlsZahl(eingaben.etage);
  const aufschlagFaktor = eingaben.aufzug ? 0 : etagen * PREISE.etagenaufschlagOhneAufzug;
  const etagenZuschlag = zwischensumme * aufschlagFaktor;

  const kalkulationspreis = zwischensumme + etagenZuschlag;

  // Angezeigte Preisspanne: ±20 %, auf 10 € gerundet
  const von = rundeAuf(kalkulationspreis * (1 - PREISE.spanneProzent), PREISE.rundungSpanne);
  const bis = rundeAuf(kalkulationspreis * (1 + PREISE.spanneProzent), PREISE.rundungSpanne);

  return {
    kalkulationspreis: kalkulationspreis,
    spanneVon: von,
    spanneBis: bis,
    // Text für die Anzeige, z. B. "ca. 350–550 € VB"
    spanneText: 'ca. ' + formatZahl(von) + '–' + formatEuro(bis) + ' VB',
    aufschluesselung: {
      grundpauschale: PREISE.grundpauschale,
      flaechenpreis: flaechenpreis,
      vermuellungsgrad: vermuellungsgrad,
      vermuellungsMultiplikator: multiplikator,
      vermuellungsZuschlag: vermuellungsZuschlag,
      kellerZuschlag: kellerZuschlag,
      gegenstaendePositionen: gegenstaendePositionen,
      gegenstaendeZuschlag: gegenstaendeZuschlag,
      etagenUeberEG: etagen,
      etagenAufschlagProzent: Math.round(aufschlagFaktor * 100),
      etagenZuschlag: etagenZuschlag,
    },
  };
}
