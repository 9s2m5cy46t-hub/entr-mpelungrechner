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
  //
  // WICHTIG: Der Aufschlag wirkt nur auf die Arbeit VOR ORT (Grundpauschale,
  // Räum- bzw. Stundenanteil, Kellerabteil). Nicht auf Anlieferungsgebühren,
  // Fahrzeit, Material, Anfahrtszone oder Zusatzkosten — die Fahrt zur
  // Deponie wird nicht teurer, nur weil die Wohnung im 3. Stock liegt.
  // Ursprünglich war "15 % auf den Gesamtpreis" vorgegeben; das war eine
  // Vereinfachung und fällt jetzt auf, wo der Transport eine große
  // Position ist.
  etagenaufschlagOhneAufzug: 0.15,

  /* --- Umsatzsteuer ------------------------------------------------------- */
  umsatzsteuer: {
    // true = Kleinunternehmerregelung nach § 19 UStG: die berechneten Preise
    // sind Endpreise, im PDF steht ein entsprechender Hinweis.
    //
    // Sobald ihr über die Umsatzgrenze kommt (derzeit 25.000 € im Vorjahr),
    // hier auf false stellen: dann weist das PDF Netto, Umsatzsteuer und
    // Bruttopreis aus. Die berechneten Preise gelten dann als NETTO — ihr
    // müsst euch also entscheiden, ob ihr sie um 19 % anhebt (dann zahlt
    // der Kunde mehr) oder nicht (dann bleibt euch weniger).
    kleinunternehmer: true,
    satz: 0.19,
  },

  /* --- Anfahrt: Zonen um die Kleiststraße, Braunschweig-Stöckheim --------- */
  anfahrt: {
    zonen: {
      zone1: { zuschlag: 0 },
      zone2: { zuschlag: 20 },
      zone3: { zuschlag: 45 },
      // Zone 4 rechnet zusätzlich die Kilometer über der Freigrenze,
      // Hin- und Rückfahrt gezählt.
      zone4: { zuschlag: 45, freieKilometer: 25, proKilometer: 0.6 },
    },
  },

  /* --- Transport und Entsorgung ------------------------------------------- */
  // Ihr fahrt selbst: Pkw mit Anhänger, Abgabe am Wertstoffhof/Deponie.
  transport: {
    // Was pro Fahrt reinpasst, in m³ (Anhänger + Kofferraum)
    kapazitaetProFahrt: 4,

    // Was eine Anlieferung am Hof kostet (in Euro)
    preisProAnlieferung: 15,

    // Dauer einer Fahrt: hinfahren, abladen, zurückkommen (in Stunden)
    stundenProFahrt: 0.75,

    // false = alle fahren mit (nur ein Fahrzeug, Beladen geht zu zweit
    // schneller). Die Fahrzeit zählt dann für jede Person.
    // true  = einer fährt, der andere arbeitet weiter. Günstiger, aber dann
    // stimmt die Dauer vor Ort nicht mehr mit der Fahrzeit zusammen.
    nurEinePersonFaehrt: false,
  },

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

    // Müllmenge je Quadratmeter Wohnfläche bei "leicht", in m³.
    // Grundlage: eine normal möblierte 60-m²-Wohnung ergibt etwa 20 m³.
    // Skaliert mit demselben Vermüllungs-Multiplikator.
    // NACH DEN ERSTEN ZWEI ENTRÜMPELUNGEN PRÜFEN: Zahl der tatsächlichen
    // Fahrten mit der berechneten vergleichen und hier nachziehen.
    kubikmeterProQuadratmeter: 20 / 60,

    // Zuschlag auf die Personenstunden, wenn kein Aufzug vorhanden ist
    zusatzstundenOhneAufzug: 0.5,

    // Nur für den Import aus der Website-Anfrage: dort steht die Zahl der
    // Zimmer, aber keine Wohnfläche. Grobe Umrechnung, damit das Formular
    // nicht leer bleibt — die Fläche ist danach IMMER zu prüfen.
    // 2 Zimmer ergeben damit 50 m², was für eine Zweizimmerwohnung
    // eher am unteren Rand liegt.
    quadratmeterProZimmer: 25,
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

  /* --- Nur Gartenarbeiten: Stunden schätzen ------------------------------
   * Gartenaufträge rechnen über dasselbe Stundenmodell wie Abbruch und Bau:
   * derselbe Stundensatz, dieselbe Grundpauschale, dieselbe Anfahrt. Ein
   * eigener Garten-Stundensatz stünde hier bewusst NICHT — er würde mit der
   * Zeit vom Satz oben abweichen, und dann kostet dieselbe Arbeit je nach
   * gewählter Auftragsart unterschiedlich viel.
   *
   * Die Zahlen hier dienen einem einzigen Zweck: aus den Angaben des Kunden
   * die DAUER vor Ort zu schätzen, damit man sie nicht jedes Mal im Kopf
   * überschlagen muss. Der Vorschlag landet im Feld "Dauer vor Ort" und ist
   * dort überschreibbar.
   *
   * Solange ein gebrauchter Wert auf null steht, schätzt das Werkzeug NICHT.
   * Es sagt dann, welche Zahl fehlt, und die Dauer wird wie bei Abbruch und
   * Bau selbst eingetragen. Geraten wird nichts — eine Schätzung aus
   * erfundenen Zahlen wäre schlimmer als keine.
   *
   * WOHER DIE ZAHLEN KOMMEN SOLLEN: beim nächsten Gartenauftrag mitschreiben,
   * wie lange eine Person für jede Arbeit gebraucht hat, und hier eintragen.
   * Nach zwei oder drei Aufträgen stimmen sie ungefähr; danach nur noch
   * nachziehen, wenn die geplante Zeit regelmäßig nicht reicht.
   */
  garten: {
    // Personenstunden für die Arbeit, bevor Größe und Zustand wirken —
    // also wie lange EINE Person dafür braucht. Wie viele Leute hinfahren,
    // steht weiter unten im Formular und wird davon abgezogen.
    basisstunden: {
      rasen: null,
      hecke: null,
      laub: null,
      gruenschnitt_weg: null,
      instandsetzung: null,
      aufloesung: null,
      sonstiges: null,
    },

    // Multiplikatoren auf die Summe der Basisstunden.
    //
    // Praktisch ist, eine Stufe auf 1,0 zu setzen — die Basisstunden oben
    // sind dann genau die Stunden für diese Stufe, und die anderen Stufen
    // sagen, wie viel mehr oder weniger es dort ist.
    faktorGroesse: { klein: null, mittel: null, gross: null },
    faktorZustand: { gepflegt: null, leicht: null, stark: null },
  },

  /* --- Zuschläge je Abfallart ---------------------------------------------
   * Der normale Entsorgungsaufwand steckt jetzt im Transport (Fahrten ×
   * Anlieferungspreis). Hier stehen nur noch ZUSÄTZLICHE Kosten für Arten,
   * die nicht einfach mit auf den Anhänger dürfen.
   *
   * 0 € heißt: im Anlieferungspreis enthalten, die Art wird nur im PDF
   * vermerkt. Wer für Bauschutt am Hof extra zahlt, trägt es hier ein.
   * ---------------------------------------------------------------------- */
  abfallarten: {
    sperrmuell: 0,
    elektroschrott: 0,   // am Wertstoffhof üblicherweise kostenlos
    sondermuell: 60,     // gesonderte Annahmestelle, nicht mit auf den Anhänger
    bauschutt: 0,        // prüfen: wird Bauschutt bei euch extra berechnet?
    altholz: 0,
    gruenschnitt: 0,     // prüfen: nimmt euch der Hof Grünschnitt kostenlos ab?
  },
};

/* -----------------------------------------------------------------------------
 * 1b) ABGELEITETE KONSTANTEN
 * -----------------------------------------------------------------------------
 * Diese beiden Werte werden NICHT frei gesetzt, sondern aus den Zahlen oben
 * errechnet. Damit kostet dieselbe Arbeit gleich viel, egal ob sie über die
 * Wohnfläche oder über ein angegebenes Volumen gerechnet wird – sonst würde
 * eine importierte Anfrage anders bepreist als dieselbe Wohnung von Hand.
 *
 * Wer oben proQuadratmeter, quadratmeterProStunde oder
 * kubikmeterProQuadratmeter ändert, muss hier nichts anfassen.
 * -------------------------------------------------------------------------- */

// Preis je Kubikmeter Räumgut: 3,50 € je m² geteilt durch 0,333 m³ je m²
// ergibt 10,50 € je m³.
PREISE.entruempelung.preisProKubikmeter =
  PREISE.entruempelung.proQuadratmeter / PREISE.entruempelung.kubikmeterProQuadratmeter;

// Wie viele Kubikmeter eine Person in einer Stunde schafft: 15 m² je Stunde
// mal 0,333 m³ je m² ergibt 5 m³ je Personenstunde.
PREISE.entruempelung.kubikmeterProPersonenstunde =
  PREISE.entruempelung.quadratmeterProStunde * PREISE.entruempelung.kubikmeterProQuadratmeter;

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
  garten: { label: 'Gartenarbeiten', modell: 'stunden' },
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
  zonen: {
    zone1: 'Stöckheim, Melverode, Leiferde, Rüningen',
    zone2: 'Braunschweig, übriges Stadtgebiet',
    zone3: 'Umland bis ca. 25 km (Wolfenbüttel, Vechelde, Cremlingen, Salzgitter-Lebenstedt)',
    zone4: 'Weiter als 25 km',
  },
  zonenKurz: {
    zone1: 'Stöckheim und direkte Nachbarschaft',
    zone2: 'Braunschweig Stadtgebiet',
    zone3: 'Umland bis ca. 25 km',
    zone4: 'über 25 km',
  },
  abfallarten: {
    sperrmuell: 'Sperrmüll (Möbel, Matratzen)',
    elektroschrott: 'Elektroschrott (Geräte, Fernseher)',
    sondermuell: 'Sondermüll (Farben, Chemikalien)',
    bauschutt: 'Bauschutt-Container',
    altholz: 'Altholz / Bauholz',
    gruenschnitt: 'Grünschnitt',
  },
  /*
   * Garten: WORTGLEICH mit den Antwortmöglichkeiten im Chat der Website
   * (src/lib/auftrag.ts, schritteGarten). Das ist Absicht — so muss beim
   * Übertragen einer Anfrage nichts gedeutet werden, und im PDF steht
   * dasselbe, was der Kunde angeklickt hat.
   */
  gartenArbeiten: {
    rasen: 'Rasen mähen oder kürzen',
    hecke: 'Hecke oder Sträucher schneiden',
    laub: 'Laub, Unkraut, Beete',
    gruenschnitt_weg: 'Grünschnitt wegfahren',
    instandsetzung: 'Garten wieder in Ordnung bringen',
    aufloesung: 'Gartenauflösung (Schuppen, Möbel, Geräte)',
    sonstiges: 'Etwas anderes / eigene Idee',
  },
  gartenGroesse: {
    klein: 'Klein (bis etwa 100 m\u00b2)',
    mittel: 'Mittel (etwa 100\u2013300 m\u00b2)',
    gross: 'Groß (über 300 m\u00b2)',
  },
  gartenZustand: {
    gepflegt: 'Gepflegt',
    leicht: 'Etwas verwildert',
    stark: 'Stark verwildert',
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

/** Volumenangabe, z. B. "26 m³". */
function formatVolumen(kubikmeter) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0, maximumFractionDigits: 1,
  }).format(kubikmeter) + ' m\u00b3';
}

/** Stundenangabe, z. B. "4,5 Std." */
function formatStunden(stunden) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(stunden) + ' Std.';
}

/* -----------------------------------------------------------------------------
 * 4b) STUNDEN SCHÄTZEN FÜR GARTENAUFTRÄGE
 * -----------------------------------------------------------------------------
 * Setzt VOR der Preisrechnung an und beantwortet nur eine Frage: Wie lange
 * sind wir dort? Das Ergebnis füllt das Feld "Dauer vor Ort". Danach rechnet
 * berechnePreis() ganz normal weiter — an der Preisrechnung ändert sich
 * nichts, weder für Garten noch für die anderen Auftragsarten.
 *
 *   Summe der Basisstunden der angekreuzten Arbeiten   (Personenstunden)
 *     × Faktor Gartengröße
 *     × Faktor Zustand
 *     ÷ Anzahl Personen
 *     = Dauer vor Ort, auf die nächste halbe Stunde aufgerundet
 *
 * Das Teilen durch die Personen ist wichtig: Die Basisstunden sind die
 * Arbeit, die anfällt — "Dauer vor Ort" ist dagegen die Zeit, die man dort
 * steht. Zwei Leute sind halb so lange da. Ohne das Teilen würde
 * berechnePreis() die Arbeit anschließend noch einmal mit den Personen
 * multiplizieren und damit doppelt zählen.
 *
 * Dass zwei Leute genau doppelt so schnell sind, ist eine Vereinfachung —
 * aber dieselbe, mit der das Werkzeug auch bei Abbruch und Bau rechnet.
 *
 * Rückgabe:
 *   stunden   Zahl, oder null wenn nicht geschätzt werden kann
 *   fehlt     welche Zahlen in PREISE.garten dafür fehlen
 *   teile     Klartext, woraus sich die Schätzung zusammensetzt
 *
 * stunden === null ist kein Fehler: dann wird die Dauer selbst eingetragen.
 *
 * fehlendeGartenwerte() listet unabhängig von der Auswahl alle Zahlen auf, die
 * in PREISE.garten noch auf null stehen – je Gruppe eine Zeile fürs Formular.
 * -------------------------------------------------------------------------- */
function fehlendeGartenwerte() {
  const g = PREISE.garten;
  function offen(zahlen, texte) {
    return Object.keys(zahlen).filter(function (k) {
      return typeof zahlen[k] !== 'number';
    }).map(function (k) { return texte[k]; });
  }
  const gruppen = [
    ['Basisstunden fehlen für: ', offen(g.basisstunden, LABELS.gartenArbeiten)],
    ['Faktor Gartengröße fehlt für: ', offen(g.faktorGroesse, LABELS.gartenGroesse)],
    ['Faktor Zustand fehlt für: ', offen(g.faktorZustand, LABELS.gartenZustand)],
  ];
  return gruppen.filter(function (gruppe) { return gruppe[1].length; })
    .map(function (gruppe) { return gruppe[0] + gruppe[1].join(', '); });
}

function schaetzeGartenstunden(eingaben) {
  const g = PREISE.garten;
  const arbeiten = Array.isArray(eingaben.gartenArbeiten) ? eingaben.gartenArbeiten : [];
  const fehlt = [];
  const teile = [];

  if (!arbeiten.length) {
    return { stunden: null, fehlt: [], teile: [], ohneArbeiten: true };
  }

  let summe = 0;
  arbeiten.forEach(function (schluessel) {
    const wert = g.basisstunden[schluessel];
    if (typeof wert !== 'number') {
      fehlt.push('Basisstunden für \u201e' +
        (LABELS.gartenArbeiten[schluessel] || schluessel) + '\u201c');
      return;
    }
    summe += wert;
  });

  const groesseKey = g.faktorGroesse.hasOwnProperty(eingaben.gartenGroesse)
    ? eingaben.gartenGroesse : null;
  const zustandKey = g.faktorZustand.hasOwnProperty(eingaben.gartenZustand)
    ? eingaben.gartenZustand : null;

  if (!groesseKey) {
    fehlt.push('Gartengröße ist nicht ausgewählt');
  } else if (typeof g.faktorGroesse[groesseKey] !== 'number') {
    fehlt.push('Faktor für Gartengröße \u201e' + LABELS.gartenGroesse[groesseKey] + '\u201c');
  }

  if (!zustandKey) {
    fehlt.push('Zustand ist nicht ausgewählt');
  } else if (typeof g.faktorZustand[zustandKey] !== 'number') {
    fehlt.push('Faktor für Zustand \u201e' + LABELS.gartenZustand[zustandKey] + '\u201c');
  }

  // Eine einzige fehlende Zahl genügt, um nicht zu schätzen.
  if (fehlt.length) return { stunden: null, fehlt: fehlt, teile: [] };

  const faktorGroesse = g.faktorGroesse[groesseKey];
  const faktorZustand = g.faktorZustand[zustandKey];
  const personen = Math.max(1, Number(eingaben.personen) || 1);
  const personenstunden = summe * faktorGroesse * faktorZustand;

  teile.push(arbeiten.length + (arbeiten.length === 1 ? ' Arbeit' : ' Arbeiten') +
    ' \u2192 ' + formatStunden(summe) + ' Arbeit');
  if (faktorGroesse !== 1) {
    teile.push(LABELS.gartenGroesse[groesseKey] + ' (\u00d7' +
      String(faktorGroesse).replace('.', ',') + ')');
  }
  if (faktorZustand !== 1) {
    teile.push(LABELS.gartenZustand[zustandKey] + ' (\u00d7' +
      String(faktorZustand).replace('.', ',') + ')');
  }

  if (personenstunden !== summe) {
    teile.push('zusammen ' + formatStunden(personenstunden) + ' Arbeit');
  }
  if (personen > 1) {
    teile.push('verteilt auf ' + personen + ' Personen');
  }

  return {
    stunden: aufHalbeStundenAufrunden(personenstunden / personen),
    personenstunden: personenstunden,
    fehlt: [],
    teile: teile,
  };
}

/* -----------------------------------------------------------------------------
 * 5) HAUPTBERECHNUNG
 * -----------------------------------------------------------------------------
 * Aufbau, für beide Auftragsarten gleich:
 *
 *   ARBEIT VOR ORT  (bekommt den Etagenaufschlag, falls kein Aufzug)
 *     Grundpauschale
 *     + Entrümpelung: Volumen × Preis pro m³, ohne Volumen stattdessen
 *       Wohnfläche × Preis pro m², mal Vermüllungsgrad
 *       Stundenauftrag: Dauer × Personen × Stundensatz, mal Erschwernis
 *     + Kellerabteil (nur Entrümpelung)
 *
 *   NEBENKOSTEN  (ohne Etagenaufschlag — eine Deponiefahrt wird nicht
 *                 teurer, weil die Wohnung im 3. Stock liegt)
 *     + Fahrzeit zur Entsorgung (Fahrten × Dauer × Personen × Stundensatz)
 *     + Anlieferungsgebühren (Fahrten × Preis pro Anlieferung)
 *     + Zuschläge für Abfallarten, die extra kosten (z. B. Sondermüll)
 *     + Material samt Beschaffungsaufschlag (nur Stundenauftrag)
 *     + Anfahrtszone
 *     + Zusatzkosten (Anhängermiete, Werkzeug, Halteverbotszone)
 *
 *   Richtwert = Arbeit × (1 + Etagen über EG × 15 %) + Nebenkosten
 *   Kundenspanne = Preis bei Volumen min bis max, ohne Spanne Richtwert ±20 %,
 *                  auf 10 € gerundet
 *
 * Anzahl Fahrten: Volumen ÷ Kapazität pro Fahrt, aufgerundet. Das Volumen
 * ist angegeben; nur bei der Entrümpelung ohne Angabe kommt es aus der
 * Wohnfläche.
 *
 * Rückgabe: Richtwert, Kundenspanne, Personenstunden, Dauer vor Ort,
 * Kalender-Zeitslot, Volumen, Fahrten und die Aufschlüsselung als Liste.
 * -------------------------------------------------------------------------- */
function berechnePreis(eingaben) {
  const art = AUFTRAGSARTEN[eingaben.auftragsart] ? eingaben.auftragsart : 'entruempelung';
  const modell = AUFTRAGSARTEN[art].modell;
  const personen = Math.max(1, Number(eingaben.personen) || 1);
  const t = PREISE.transport;

  // Zwei Töpfe: "arbeit" bekommt den Etagenaufschlag, "neben" nicht.
  const positionen = [];
  let arbeit = 0;
  let neben = 0;

  function zurArbeit(label, betrag) {
    positionen.push({ label: label, betrag: betrag });
    arbeit += betrag;
  }
  function zuNeben(label, betrag) {
    positionen.push({ label: label, betrag: betrag });
    neben += betrag;
  }

  zurArbeit('Grundpauschale (Anfahrt)', PREISE.grundpauschale);

  let arbeitsstunden = 0;   // Personenstunden vor Ort, ohne Fahrten
  let volumen = 0;          // zu entsorgendes Volumen in m³
  let volumenHerkunft = 'angegeben';   // "angegeben" oder "geschätzt"

  if (modell === 'flaeche') {
    /* ---------- Entrümpelung ---------------------------------------------
     * Zwei Wege, die bei gleicher Menge dasselbe ergeben:
     *
     *   Volumen angegeben → Arbeit und Stunden kommen aus dem Volumen.
     *                       Der Vermüllungsgrad wird dann NICHT noch einmal
     *                       aufgeschlagen: Wer 30 m³ nennt, hat den vollen
     *                       Schrank schon mitgezählt. Sonst zählte die
     *                       Vermüllung doppelt.
     *   kein Volumen      → wie bisher aus der Wohnfläche, mit Vermüllungsgrad.
     *
     * Probe: 60 m², leicht, 20 m³ ergibt in beiden Wegen 290 € Arbeit und
     * 4 Personenstunden (siehe tests/import.test.js).
     * ------------------------------------------------------------------- */
    const e = PREISE.entruempelung;
    const wohnflaeche = Math.max(0, Number(eingaben.wohnflaeche) || 0);
    const grad = e.vermuellung[eingaben.vermuellungsgrad] ? eingaben.vermuellungsgrad : 'leicht';
    const faktor = e.vermuellung[grad];
    const angegeben = Math.max(0, Number(eingaben.volumen) || 0);

    if (angegeben > 0) {
      /* --- Weg über das Volumen --- */
      volumen = angegeben;
      volumenHerkunft = 'angegeben';

      zurArbeit(
        'Räumvolumen (' + formatVolumen(volumen) + ' \u00d7 ' + formatEuroCent(e.preisProKubikmeter) + ')',
        volumen * e.preisProKubikmeter
      );

      if (eingaben.kellerabteil) zurArbeit('Kellerabteil', e.kellerabteil);

      arbeitsstunden = volumen / e.kubikmeterProPersonenstunde;
      if (!eingaben.aufzug) arbeitsstunden += e.zusatzstundenOhneAufzug;

    } else {
      /* --- Weg über die Wohnfläche (unverändert) --- */
      const flaechenpreis = wohnflaeche * e.proQuadratmeter;
      zurArbeit(
        'Wohnfläche (' + formatZahl(wohnflaeche) + ' m\u00b2 \u00d7 ' + formatEuroCent(e.proQuadratmeter) + ')',
        flaechenpreis
      );

      if (faktor !== 1) {
        // Der Vermüllungsgrad wirkt auf Grundpauschale und Flächenanteil,
        // nicht auf Gebühren und Nebenkosten.
        const zuschlag = (PREISE.grundpauschale + flaechenpreis) * (faktor - 1);
        zurArbeit(
          'Vermüllungsgrad ' + LABELS.vermuellung[grad] + ' (\u00d7' + String(faktor).replace('.', ',') + ')',
          zuschlag
        );
      }

      if (eingaben.kellerabteil) zurArbeit('Kellerabteil', e.kellerabteil);

      arbeitsstunden = (wohnflaeche / e.quadratmeterProStunde) * faktor;
      if (!eingaben.aufzug) arbeitsstunden += e.zusatzstundenOhneAufzug;

      volumen = wohnflaeche * e.kubikmeterProQuadratmeter * faktor;
      volumenHerkunft = 'geschätzt';
    }

  } else {
    /* ---------- Stundenauftrag (Abbruch, Bau, Sonstiges) ----------------- */
    const st = PREISE.stundenAuftrag;
    const dauer = Math.max(0, Number(eingaben.dauer) || 0);
    const grad = st.erschwernis[eingaben.erschwernis] ? eingaben.erschwernis : 'einfach';
    const faktor = st.erschwernis[grad];

    arbeitsstunden = dauer * personen;
    const arbeitskosten = arbeitsstunden * PREISE.stundensatzProPerson;
    zurArbeit(
      'Arbeitszeit (' + formatStunden(arbeitsstunden) + ' \u00d7 ' + formatEuroCent(PREISE.stundensatzProPerson) + ')',
      arbeitskosten
    );

    if (faktor !== 1) {
      zurArbeit(
        'Erschwernis ' + LABELS.erschwernis[grad] + ' (\u00d7' + String(faktor).replace('.', ',') + ')',
        arbeitskosten * (faktor - 1)
      );
    }

    const material = Math.max(0, Number(eingaben.material) || 0);
    if (material > 0) {
      zuNeben('Material', material);
      if (st.materialAufschlag > 0) {
        zuNeben(
          'Materialbeschaffung (' + Math.round(st.materialAufschlag * 100) + ' %)',
          material * st.materialAufschlag
        );
      }
    }

    volumen = Math.max(0, Number(eingaben.volumen) || 0);
    volumenHerkunft = 'angegeben';
  }

  /* ---------- Transport zur Entsorgung ------------------------------------ */
  const fahrten = volumen > 0 ? Math.ceil(volumen / t.kapazitaetProFahrt) : 0;
  const personenProFahrt = t.nurEinePersonFaehrt ? 1 : personen;
  const fahrtstunden = fahrten * t.stundenProFahrt * personenProFahrt;

  if (fahrten > 0) {
    zuNeben(
      'Fahrzeit Entsorgung (' + fahrten + ' \u00d7 ' + formatStunden(t.stundenProFahrt) +
        (personenProFahrt > 1 ? ' \u00d7 ' + personenProFahrt + ' Pers.' : '') + ')',
      fahrtstunden * PREISE.stundensatzProPerson
    );
    zuNeben(
      'Anlieferung (' + fahrten + ' \u00d7 ' + formatEuroCent(t.preisProAnlieferung) + ')',
      fahrten * t.preisProAnlieferung
    );
  }

  /* ---------- Zuschläge für besondere Abfallarten ------------------------- */
  const arten = Array.isArray(eingaben.abfallarten) ? eingaben.abfallarten : [];
  arten.forEach(function (key) {
    const betrag = PREISE.abfallarten[key];
    if (betrag > 0) zuNeben(LABELS.abfallarten[key], betrag);
  });

  /* ---------- Anfahrtszone ------------------------------------------------ */
  const zoneKey = PREISE.anfahrt.zonen[eingaben.zone] ? eingaben.zone : 'zone1';
  const zone = PREISE.anfahrt.zonen[zoneKey];
  let zonenzuschlag = zone.zuschlag;
  if (zone.proKilometer) {
    // Kilometer über der Freigrenze, Hin- und Rückfahrt gezählt
    const km = Math.max(0, Number(eingaben.kilometer) || 0);
    const extraKm = Math.max(0, km - zone.freieKilometer) * 2;
    zonenzuschlag += extraKm * zone.proKilometer;
  }
  if (zonenzuschlag > 0) zuNeben('Anfahrt: ' + LABELS.zonenKurz[zoneKey], zonenzuschlag);

  /* ---------- Zusatzkosten ----------------------------------------------- */
  const zusatz = Math.max(0, Number(eingaben.zusatzkosten) || 0);
  if (zusatz > 0) zuNeben('Zusatzkosten (Miete, Werkzeug)', zusatz);

  /* ---------- Etagenaufschlag auf die Arbeit vor Ort --------------------- */
  const etagen = etagenAlsZahl(eingaben.etage);
  const aufschlagFaktor = eingaben.aufzug ? 0 : etagen * PREISE.etagenaufschlagOhneAufzug;
  let etagenZuschlag = 0;
  if (aufschlagFaktor > 0) {
    etagenZuschlag = arbeit * aufschlagFaktor;
    positionen.push({
      label: 'Kein Aufzug, ' + etagen + '. Etage (+' + Math.round(aufschlagFaktor * 100) + ' % auf die Arbeit)',
      betrag: etagenZuschlag,
    });
  }

  const kalkulationspreis = arbeit + etagenZuschlag + neben;

  /* ---------- Kundenspanne -----------------------------------------------
   * Nennt die Anfrage eine Volumen-SPANNE (z. B. „etwa 22–42 m³"), dann
   * entsteht die Preisspanne aus dieser Spanne statt aus pauschalen ±20 %:
   * Die Rechnung läuft dann noch zweimal, einmal mit der unteren und einmal
   * mit der oberen Menge.
   *
   * RICHTWERT IST DIE MITTE, nicht die Obergrenze. Die Obergrenze ist das
   * „bis" der Kundenspanne. Wer den Richtwert an die Obergrenze legt, nennt
   * dem Kunden im Schnitt zu viel und verliert Aufträge, die sich gelohnt
   * hätten – und die Obergrenze steht ja ohnehin daneben.
   *
   * Die beiden Zusatzläufe bekommen die Spanne geleert mitgegeben, damit
   * sie sich nicht endlos selbst aufrufen.
   * -------------------------------------------------------------------- */
  const spanneMin = Math.max(0, Number(eingaben.volumenMin) || 0);
  const spanneMax = Math.max(0, Number(eingaben.volumenMax) || 0);
  const ausVolumenspanne =
    modell === 'flaeche' && spanneMin > 0 && spanneMax > spanneMin;

  let von;
  let bis;
  if (ausVolumenspanne) {
    const ohneSpanne = { volumenMin: 0, volumenMax: 0 };
    const unten = berechnePreis(Object.assign({}, eingaben, ohneSpanne, { volumen: spanneMin }));
    const oben = berechnePreis(Object.assign({}, eingaben, ohneSpanne, { volumen: spanneMax }));
    von = rundeAuf(unten.kalkulationspreis, PREISE.rundungSpanne);
    bis = rundeAuf(oben.kalkulationspreis, PREISE.rundungSpanne);
  } else {
    von = rundeAuf(kalkulationspreis * (1 - PREISE.spanneProzent), PREISE.rundungSpanne);
    bis = rundeAuf(kalkulationspreis * (1 + PREISE.spanneProzent), PREISE.rundungSpanne);
  }

  const personenstunden = arbeitsstunden + fahrtstunden;
  const dauerVorOrt = personenstunden / personen;
  const zeitslot = aufHalbeStundenAufrunden(dauerVorOrt * (1 + PREISE.zeitpuffer));

  return {
    auftragsart: art,
    auftragsartLabel: AUFTRAGSARTEN[art].label,
    modell: modell,
    kalkulationspreis: kalkulationspreis,
    spanneVon: von,
    spanneBis: bis,
    spanneText: 'ca. ' + formatZahl(von) + '\u2013' + formatEuro(bis) + ' VB',
    personen: personen,
    personenstunden: personenstunden,
    arbeitsstunden: arbeitsstunden,
    fahrtstunden: fahrtstunden,
    dauerVorOrt: dauerVorOrt,
    zeitslot: zeitslot,
    zeitslotText: formatZeitslot(zeitslot),
    volumen: volumen,
    volumenHerkunft: volumenHerkunft,
    // Arbeit vor Ort vor dem Etagenaufschlag. Nützlich zum Nachvollziehen
    // und für Tests, die nicht an Beschriftungen hängen sollen.
    arbeitVorEtage: arbeit,
    etagenZuschlag: etagenZuschlag,
    nebenkosten: neben,
    // "volumenspanne" = aus der genannten Mengenspanne, sonst "prozent"
    spanneHerkunft: ausVolumenspanne ? 'volumenspanne' : 'prozent',
    spanneVolumenMin: ausVolumenspanne ? spanneMin : 0,
    spanneVolumenMax: ausVolumenspanne ? spanneMax : 0,
    fahrten: fahrten,
    zone: zoneKey,
    positionen: positionen,
  };
}
