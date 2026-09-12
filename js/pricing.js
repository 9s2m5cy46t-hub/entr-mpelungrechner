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
 * 5) HAUPTBERECHNUNG
 * -----------------------------------------------------------------------------
 * Aufbau, für beide Auftragsarten gleich:
 *
 *   ARBEIT VOR ORT  (bekommt den Etagenaufschlag, falls kein Aufzug)
 *     Grundpauschale
 *     + Entrümpelung: Wohnfläche × Preis pro m², mal Vermüllungsgrad
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
 *   Kundenspanne = Richtwert ±20 %, auf 10 € gerundet
 *
 * Anzahl Fahrten: Volumen ÷ Kapazität pro Fahrt, aufgerundet. Das Volumen
 * kommt bei der Entrümpelung aus der Wohnfläche, beim Stundenauftrag gibt
 * man es selbst an.
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

  if (modell === 'flaeche') {
    /* ---------- Entrümpelung --------------------------------------------- */
    const e = PREISE.entruempelung;
    const wohnflaeche = Math.max(0, Number(eingaben.wohnflaeche) || 0);
    const grad = e.vermuellung[eingaben.vermuellungsgrad] ? eingaben.vermuellungsgrad : 'leicht';
    const faktor = e.vermuellung[grad];

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

  /* ---------- Kundenspanne und Zeitplanung ------------------------------- */
  const von = rundeAuf(kalkulationspreis * (1 - PREISE.spanneProzent), PREISE.rundungSpanne);
  const bis = rundeAuf(kalkulationspreis * (1 + PREISE.spanneProzent), PREISE.rundungSpanne);

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
    fahrten: fahrten,
    zone: zoneKey,
    positionen: positionen,
  };
}
