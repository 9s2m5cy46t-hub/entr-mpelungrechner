/* =============================================================================
 * pricing.js — Kalkulationslogik Just & Luis
 * -----------------------------------------------------------------------------
 * Deckt alle Auftragsarten im Bau- und Entrümpelungsbereich ab.
 * Hier stehen ALLE Preise und die komplette Rechenlogik.
 * Ändern sich Preise, wird NUR unten in PREISE etwas angepasst.
 * Keine Abhängigkeiten, läuft direkt im Browser (kein Build, kein npm).
 * ========================================================================== */

/* -----------------------------------------------------------------------------
 * 1) PREIS-KONSTANTEN  ← hier anpassen
 * -------------------------------------------------------------------------- */
const PREISE = {
  /* --- Gilt für jeden Auftrag --------------------------------------------- */

  // Grundpauschale: Anfahrt, Fahrzeug, Grundaufwand (in Euro)
  grundpauschale: 80,

  // Stundensatz pro Person und Stunde (in Euro).
  //
  // WOHER DIESE ZAHL KOMMT: Sie steckt bereits in der Entrümpelungs-Formel.
  // Dort sind 3,50 € pro m² angesetzt und 1 Stunde Aufwand je 15 m² —
  // das sind 3,50 × 15 = 52,50 € pro Personenstunde, unabhängig von der
  // Fläche. Damit rechnen Bau- und Abbruchaufträge mit demselben Satz wie
  // Entrümpelungen. Wer hier etwas ändert, sollte auch
  // entruempelung.proQuadratmeter mit anpassen, sonst driften die
  // beiden Auftragsarten preislich auseinander.
  stundensatzProPerson: 52.5,

  // Aufschlag, wenn KEIN Aufzug vorhanden ist: 15 % pro Etage über dem EG.
  // Gilt für alle Auftragsarten (Material und Abbruchgut muss getragen werden).
  etagenaufschlagOhneAufzug: 0.15,

  // Zeitpuffer für den Kalender: 30 % auf die geschätzte Dauer vor Ort
  zeitpuffer: 0.3,

  // Stunden je Arbeitstag — nur für die Anzeige: längere Slots werden
  // in Tage umgerechnet, weil "21 Std." als Kalendereintrag nichts hilft
  arbeitstagStunden: 8,

  // Angezeigte Kundenspanne: ±20 % auf den internen Richtwert,
  // gerundet auf volle 10 Euro
  spanneProzent: 0.2,
  rundungSpanne: 10,

  /* --- Nur Entrümpelung --------------------------------------------------- */
  entruempelung: {
    // Preis pro Quadratmeter Wohnfläche (in Euro)
    proQuadratmeter: 3.5,

    // Multiplikator nach Vermüllungsgrad (wirkt auf Pauschale + Fläche)
    vermuellung: { leicht: 1.0, mittel: 1.3, stark: 1.7 },

    // Kellerabteil zusätzlich entrümpeln: Pauschale (in Euro)
    kellerabteil: 50,

    // Aufwandsschätzung: 1 Personenstunde je 15 m² bei "leicht".
    // Wird mit demselben Vermüllungs-Multiplikator hochgerechnet.
    quadratmeterProStunde: 15,

    // Zuschlag auf die Personenstunden, wenn kein Aufzug vorhanden ist
    zusatzstundenOhneAufzug: 0.5,
  },

  /* --- Nur Aufträge auf Stundenbasis (Abbruch, Bau, Sonstiges) ------------ */
  stundenAuftrag: {
    // Erschwernis-Multiplikator auf die Arbeitszeit.
    //
    // Bewusst niedriger als die Vermüllungsgrade: bei der Entrümpelung
    // schätzt die Formel die Stunden selbst und der Faktor muss das ganze
    // Mehrvolumen abbilden. Hier gibt man die Stunden schon selbst an —
    // der Faktor deckt also nur zusätzliche Erschwernis (enger Zugang,
    // Altbau, Arbeiten über Kopf, Winterbaustelle).
    erschwernis: { einfach: 1.0, mittel: 1.2, schwer: 1.5 },

    // Aufschlag auf eingekauftes Material für Beschaffung und Transport.
    // Auf 0 setzen, wenn Material zum Einkaufspreis durchgereicht wird.
    materialAufschlag: 0.1,
  },

  /* --- Entsorgungspauschalen ---------------------------------------------- */
  // ACHTUNG: Die Bau-Positionen sind Schätzwerte und müssen gegen die
  // tatsächlichen Preise eures Entsorgers geprüft werden — Containerpreise
  // schwanken regional und nach Menge erheblich.
  entsorgung: {
    sperrmuell: 40,
    elektroschrott: 30,
    sondermuell: 60,
    bauschutt: 250,
    altholz: 120,
  },
};

/* -----------------------------------------------------------------------------
 * 2) AUFTRAGSARTEN
 * -----------------------------------------------------------------------------
 * "modell" bestimmt, wie gerechnet wird:
 *   "flaeche" → Preis aus Wohnfläche und Vermüllungsgrad (Entrümpelung)
 *   "stunden" → Preis aus geschätzter Arbeitszeit, Material und Entsorgung
 *
 * Neue Auftragsart hinzufügen: hier einen Eintrag ergänzen. Nutzt sie das
 * Modell "stunden", funktioniert sie ohne weitere Änderungen an der Logik —
 * nur im Dropdown in index.html muss sie noch auftauchen.
 * -------------------------------------------------------------------------- */
const AUFTRAGSARTEN = {
  entruempelung: { label: 'Entrümpelung', modell: 'flaeche' },
  abbruch: { label: 'Abbruch / Rückbau', modell: 'stunden' },
  bau: { label: 'Bau / Montage', modell: 'stunden' },
  sonstiges: { label: 'Sonstiges', modell: 'stunden' },
};

/* -----------------------------------------------------------------------------
 * 3) TEXTE zu den Auswahlmöglichkeiten
 *    Werden im Formular UND im PDF genutzt, damit beides dieselbe
 *    Bezeichnung verwendet.
 * -------------------------------------------------------------------------- */
const LABELS = {
  vermuellung: { leicht: 'Leicht', mittel: 'Mittel', stark: 'Stark' },
  erschwernis: { einfach: 'Einfach', mittel: 'Mittel', schwer: 'Schwer' },
  entsorgung: {
    sperrmuell: 'Sperrmüll (Möbel, Matratzen)',
    elektroschrott: 'Elektroschrott (Geräte, Fernseher)',
    sondermuell: 'Sondermüll (Farben, Chemikalien)',
    bauschutt: 'Bauschutt-Container',
    altholz: 'Altholz / Bauholz',
  },
  etage: {
    eg: 'Erdgeschoss',
    1: '1. Etage', 2: '2. Etage', 3: '3. Etage',
    4: '4. Etage', 5: '5. Etage',
    hoeher: '6. Etage oder höher',
  },
};

/* -----------------------------------------------------------------------------
 * 4) HILFSFUNKTIONEN
 * -------------------------------------------------------------------------- */

/** Etagen über dem Erdgeschoss als Zahl. "hoeher" wird als 6 gerechnet. */
function etagenAlsZahl(etage) {
  if (etage === 'eg') return 0;
  if (etage === 'hoeher') return 6;
  const n = parseInt(etage, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Rundet auf das nächste Vielfache von `schritt`. */
function rundeAuf(betrag, schritt) {
  return Math.round(betrag / schritt) * schritt;
}

/** Rundet auf die nächste halbe Stunde AUF. */
function aufHalbeStundenAufrunden(stunden) {
  return Math.ceil(stunden * 2) / 2;
}

/** Deutsche Zahl ohne Nachkommastellen, z. B. "1.240". */
function formatZahl(betrag) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(betrag);
}

/** Euro-Betrag ohne Cent, z. B. "1.240 €". */
function formatEuro(betrag) {
  return formatZahl(betrag) + ' €';
}

/** Euro-Betrag mit Cent, z. B. "1.240,65 €" (interne Kalkulation). */
function formatEuroCent(betrag) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(betrag) + ' €';
}

/** Rechnet eine Slot-Länge in einen brauchbaren Kalendertext um. */
function formatZeitslot(stunden) {
  if (stunden <= PREISE.arbeitstagStunden) return formatStunden(stunden);
  const tage = stunden / PREISE.arbeitstagStunden;
  const gerundet = Math.ceil(tage * 2) / 2; // auf halbe Tage aufrunden
  return formatZahl(stunden) + ' Std. \u2248 ' +
    String(gerundet).replace('.', ',') + ' Tage (' +
    PREISE.arbeitstagStunden + ' Std./Tag)';
}

/** Stundenangabe, z. B. "4,5 Std." */
function formatStunden(stunden) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(stunden) + ' Std.';
}

/* -----------------------------------------------------------------------------
 * 5) HAUPTBERECHNUNG
 * -----------------------------------------------------------------------------
 * Zwei Rechenwege, gemeinsame Struktur:
 *
 * A) ENTRÜMPELUNG (modell "flaeche") — unverändert wie bisher:
 *      1. Grundpauschale + Wohnfläche × Preis pro m²
 *      2. × Vermüllungs-Multiplikator (wirkt auf den Arbeitsaufwand,
 *         nicht auf die Entsorgungspauschalen)
 *      3. + Kellerabteil + gewählte Entsorgungsposten
 *      4. × (1 + Etagen über EG × 15 %), falls kein Aufzug
 *
 * B) STUNDENAUFTRAG (modell "stunden") — Abbruch, Bau, Sonstiges:
 *      1. Personenstunden = Dauer vor Ort × Anzahl Personen
 *      2. Arbeitskosten  = Personenstunden × Stundensatz × Erschwernis
 *      3. Grundpauschale + Arbeitskosten + Material (+ Aufschlag)
 *         + gewählte Entsorgungsposten
 *      4. × (1 + Etagen über EG × 15 %), falls kein Aufzug
 *
 * Beide liefern zusätzlich Personenstunden, Dauer vor Ort und einen
 * Kalender-Zeitslot (Dauer + 30 % Puffer, auf halbe Stunden aufgerundet).
 *
 * Rückgabe:
 *   kalkulationspreis  exakter interner Richtwert
 *   spanneVon/Bis      Kundenspanne (±20 %, auf 10 € gerundet)
 *   spanneText         fertiger Anzeigetext, z. B. "ca. 350–550 € VB"
 *   personenstunden / dauerVorOrt / zeitslot
 *   positionen         Aufschlüsselung als Liste (für Anzeige und PDF)
 * -------------------------------------------------------------------------- */
function berechnePreis(eingaben) {
  const art = AUFTRAGSARTEN[eingaben.auftragsart] ? eingaben.auftragsart : 'entruempelung';
  const modell = AUFTRAGSARTEN[art].modell;
  const personen = Math.max(1, Number(eingaben.personen) || 1);

  // Positionen der Aufschlüsselung sammeln
  const positionen = [];
  function position(label, betrag) {
    positionen.push({ label: label, betrag: betrag });
  }

  let zwischensumme = 0;
  let personenstunden = 0;

  position('Grundpauschale (Anfahrt)', PREISE.grundpauschale);
  zwischensumme += PREISE.grundpauschale;

  if (modell === 'flaeche') {
    /* ---------- A) Entrümpelung ------------------------------------------ */
    const e = PREISE.entruempelung;
    const wohnflaeche = Math.max(0, Number(eingaben.wohnflaeche) || 0);
    const grad = e.vermuellung[eingaben.vermuellungsgrad] ? eingaben.vermuellungsgrad : 'leicht';
    const faktor = e.vermuellung[grad];

    const flaechenpreis = wohnflaeche * e.proQuadratmeter;
    position(
      'Wohnfläche (' + formatZahl(wohnflaeche) + ' m² × ' + formatEuroCent(e.proQuadratmeter) + ')',
      flaechenpreis
    );
    zwischensumme += flaechenpreis;

    const vorFaktor = zwischensumme;
    zwischensumme *= faktor;
    if (faktor !== 1) {
      position(
        'Vermüllungsgrad ' + LABELS.vermuellung[grad] + ' (×' + String(faktor).replace('.', ',') + ')',
        zwischensumme - vorFaktor
      );
    }

    if (eingaben.kellerabteil) {
      position('Kellerabteil', e.kellerabteil);
      zwischensumme += e.kellerabteil;
    }

    // Aufwandsschätzung: 1 Std. je 15 m², mit demselben Vermüllungsfaktor
    personenstunden = (wohnflaeche / e.quadratmeterProStunde) * faktor;
    if (!eingaben.aufzug) personenstunden += e.zusatzstundenOhneAufzug;

  } else {
    /* ---------- B) Stundenauftrag ---------------------------------------- */
    const s = PREISE.stundenAuftrag;
    const dauer = Math.max(0, Number(eingaben.dauer) || 0);
    const grad = s.erschwernis[eingaben.erschwernis] ? eingaben.erschwernis : 'einfach';
    const faktor = s.erschwernis[grad];

    personenstunden = dauer * personen;
    const arbeitskosten = personenstunden * PREISE.stundensatzProPerson;
    position(
      'Arbeitszeit (' + formatStunden(personenstunden) + ' × ' + formatEuroCent(PREISE.stundensatzProPerson) + ')',
      arbeitskosten
    );
    zwischensumme += arbeitskosten;

    if (faktor !== 1) {
      const erschwernisZuschlag = arbeitskosten * (faktor - 1);
      position(
        'Erschwernis ' + LABELS.erschwernis[grad] + ' (×' + String(faktor).replace('.', ',') + ')',
        erschwernisZuschlag
      );
      zwischensumme += erschwernisZuschlag;
    }

    const material = Math.max(0, Number(eingaben.material) || 0);
    if (material > 0) {
      position('Material', material);
      zwischensumme += material;
      if (s.materialAufschlag > 0) {
        const aufschlag = material * s.materialAufschlag;
        position(
          'Materialbeschaffung (' + Math.round(s.materialAufschlag * 100) + ' %)',
          aufschlag
        );
        zwischensumme += aufschlag;
      }
    }
  }

  /* ---------- Entsorgungsposten (bei jeder Auftragsart) ------------------- */
  const gewaehlt = Array.isArray(eingaben.entsorgung) ? eingaben.entsorgung : [];
  gewaehlt.forEach(function (key) {
    const betrag = PREISE.entsorgung[key];
    if (betrag) {
      position(LABELS.entsorgung[key], betrag);
      zwischensumme += betrag;
    }
  });

  /* ---------- Etagenaufschlag ohne Aufzug -------------------------------- */
  const etagen = etagenAlsZahl(eingaben.etage);
  const aufschlagFaktor = eingaben.aufzug ? 0 : etagen * PREISE.etagenaufschlagOhneAufzug;
  if (aufschlagFaktor > 0) {
    const etagenZuschlag = zwischensumme * aufschlagFaktor;
    position(
      'Kein Aufzug, ' + etagen + '. Etage (+' + Math.round(aufschlagFaktor * 100) + ' %)',
      etagenZuschlag
    );
    zwischensumme += etagenZuschlag;
  }

  const kalkulationspreis = zwischensumme;

  /* ---------- Kundenspanne und Zeitplanung ------------------------------- */
  const von = rundeAuf(kalkulationspreis * (1 - PREISE.spanneProzent), PREISE.rundungSpanne);
  const bis = rundeAuf(kalkulationspreis * (1 + PREISE.spanneProzent), PREISE.rundungSpanne);

  const dauerVorOrt = personenstunden / personen;
  const zeitslot = aufHalbeStundenAufrunden(dauerVorOrt * (1 + PREISE.zeitpuffer));

  return {
    auftragsart: art,
    auftragsartLabel: AUFTRAGSARTEN[art].label,
    modell: modell,
    kalkulationspreis: kalkulationspreis,
    spanneVon: von,
    spanneBis: bis,
    spanneText: 'ca. ' + formatZahl(von) + '–' + formatEuro(bis) + ' VB',
    personen: personen,
    personenstunden: personenstunden,
    dauerVorOrt: dauerVorOrt,
    zeitslot: zeitslot,
    zeitslotText: formatZeitslot(zeitslot),
    positionen: positionen,
  };
}
