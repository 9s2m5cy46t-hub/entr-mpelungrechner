/* =============================================================================
 * import.js — Anfrage aus der Website-E-Mail übernehmen
 * -----------------------------------------------------------------------------
 * Liest den TEXT der Benachrichtigungsmail und füllt damit das Formular.
 * Bewusst kein OCR aus dem Screenshot: auf dunklen Handy-Screenshots
 * verwechselt Texterkennung 0/O und 5/S, und falsche Zahlen in einer
 * Kalkulation sind schlimmer als gar keine. Der Screenshot dient als Beleg,
 * die Zahlen kommen aus dem Text.
 *
 * Alles läuft im Browser, nichts wird gespeichert oder gesendet.
 * ========================================================================== */

/* -----------------------------------------------------------------------------
 * Ortsnamen den Anfahrtszonen zuordnen
 * -----------------------------------------------------------------------------
 * Ausgangspunkt ist die Kleiststraße in Braunschweig-Stöckheim.
 * Neue Orte einfach ergänzen. Was hier nicht steht, wird NICHT geraten —
 * das Werkzeug meldet dann, dass die Zone geprüft werden muss.
 * -------------------------------------------------------------------------- */
const ORT_ZONEN = {
  // Zone 1 — Stöckheim und direkte Nachbarschaft
  'stöckheim': 'zone1', 'stockheim': 'zone1', 'melverode': 'zone1',
  'leiferde': 'zone1', 'rüningen': 'zone1', 'runingen': 'zone1',
  'mascherode': 'zone1', 'südstadt': 'zone1',

  // Zone 2 — übriges Braunschweig
  'braunschweig': 'zone2', 'innenstadt': 'zone2', 'weststadt': 'zone2',
  'lehndorf': 'zone2', 'kanzlerfeld': 'zone2', 'querum': 'zone2',
  'gliesmarode': 'zone2', 'riddagshausen': 'zone2', 'volkmarode': 'zone2',
  'wenden': 'zone2', 'watenbüttel': 'zone2', 'ölper': 'zone2',
  'rühme': 'zone2', 'veltenhof': 'zone2', 'heidberg': 'zone2',
  'lindenberg': 'zone2', 'bebelhof': 'zone2', 'lehndorf-watenbüttel': 'zone2',
  'geitelde': 'zone2', 'timmerlah': 'zone2', 'broitzem': 'zone2',
  'hondelage': 'zone2', 'bienrode': 'zone2', 'waggum': 'zone2',
  'thune': 'zone2', 'harxbüttel': 'zone2',

  // Zone 3 — Umland bis etwa 25 km
  'wolfenbüttel': 'zone3', 'wolfenbuettel': 'zone3', 'vechelde': 'zone3',
  'cremlingen': 'zone3', 'salzgitter': 'zone3', 'lebenstedt': 'zone3',
  'sickte': 'zone3', 'wendeburg': 'zone3', 'lehre': 'zone3',
  'schwülper': 'zone3', 'denkte': 'zone3', 'schladen': 'zone3',
  'peine': 'zone3', 'salzdahlum': 'zone3', 'destedt': 'zone3',
  'flechtorf': 'zone3', 'meine': 'zone3', 'edemissen': 'zone3',
};

/* -----------------------------------------------------------------------------
 * Freitext auf Auswahlwerte abbilden
 * -------------------------------------------------------------------------- */

/**
 * Die Zeile "Bereich:" aus der Mail. Die Website schreibt dort "Garten",
 * "Entrümpelung" oder "Entrümpelung + Garten" — eine Tatsache, die nicht
 * geraten werden muss. Fehlt die Zeile (ältere Mails, klassisches
 * Formular), greifen danach die Stichwörter.
 */
function erkenneBereich(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return null;
  const garten = /garten/.test(t);
  const entruempelung = /entrümpel|entrumpel/.test(t);
  if (garten && entruempelung) return 'beides';
  if (garten) return 'garten';
  if (entruempelung) return 'entruempelung';
  return null;
}

/** "Eine Wohnung" -> entruempelung, "Hecke schneiden" -> garten, ... */
function erkenneAuftragsart(text) {
  const t = text.toLowerCase();
  if (/abbruch|rückbau|ruckbau|abreißen|abreissen|herausreißen/.test(t)) return 'abbruch';
  // Garten VOR bau: sonst fängt "aufbau|bauen|treppe" eine Gartenanfrage ab
  if (/garten|rasen|hecke|sträucher|straucher|laub|unkraut|beet|grünschnitt|grunschnitt|mähen|mahen/.test(t)) return 'garten';
  if (/treppe|montage|aufbau|bauen|einbau|renovier/.test(t)) return 'bau';
  if (/wohnung|haus|keller|dachboden|garage|speicher|entrümpel|entrumpel|räumung|raumung/.test(t)) return 'entruempelung';
  return null;
}

/**
 * Die angekreuzten Gartenarbeiten aus der Zeile "Was im Garten:".
 * Dort stehen die Antworten des Chats im Klartext, mit Komma getrennt.
 */
function erkenneGartenarbeiten(text) {
  const t = text.toLowerCase();
  const arbeiten = [];
  if (/rasen|mähen|mahen/.test(t)) arbeiten.push('rasen');
  if (/hecke|sträucher|straucher/.test(t)) arbeiten.push('hecke');
  if (/laub|unkraut|beet/.test(t)) arbeiten.push('laub');
  if (/wegfahren|mitnehmen/.test(t)) arbeiten.push('gruenschnitt_weg');
  if (/in ordnung bringen|instandsetz/.test(t)) arbeiten.push('instandsetzung');
  if (/auflösung|auflosung|schuppen/.test(t)) arbeiten.push('aufloesung');
  if (/etwas anderes|eigene idee/.test(t)) arbeiten.push('sonstiges');
  return arbeiten;
}

/** "Mittel (etwa 100–300 m²)" -> mittel */
function erkenneGartengroesse(text) {
  const t = String(text || '').toLowerCase();
  if (/^\s*klein|\bklein\b/.test(t)) return 'klein';
  if (/\bmittel\b/.test(t)) return 'mittel';
  if (/\bgroß\b|\bgross\b/.test(t)) return 'gross';
  return null;
}

/** "Etwas verwildert" -> leicht, "Stark verwildert" -> stark */
function erkenneGartenzustand(text) {
  const t = String(text || '').toLowerCase();
  if (/stark/.test(t)) return 'stark';
  if (/etwas verwildert|leicht/.test(t)) return 'leicht';
  if (/gepflegt/.test(t)) return 'gepflegt';
  return null;
}

/** "Normal möbliert" -> leicht, "sehr voll" -> stark, ... */
function erkenneVermuellungsgrad(text) {
  const t = text.toLowerCase();
  if (/stark|vermüllt|vermullt|sehr voll|kaum.*boden|zugestellt|extrem/.test(t)) return 'stark';
  if (/mittel|viele kartons|voll|teilweise/.test(t)) return 'mittel';
  if (/normal|leicht|wenig|leer|aufgeräumt|aufgeraumt/.test(t)) return 'leicht';
  return null;
}

/** "Erdgeschoss" -> eg, "3. Etage" -> "3", "Dachgeschoss" -> ... */
function erkenneEtage(text) {
  const t = text.toLowerCase();
  if (/erdgeschoss|\beg\b|parterre/.test(t)) return 'eg';
  if (/höher|hoher|dachgeschoss|\bdg\b|[6-9]\s*\./.test(t)) return 'hoeher';
  const treffer = t.match(/([1-5])\s*\./);
  if (treffer) return treffer[1];
  const zahl = t.match(/\b([1-5])\b/);
  if (zahl) return zahl[1];
  return null;
}

/** "Bauschutt oder Altholz" -> ["bauschutt", "altholz"] */
function erkenneAbfallarten(text) {
  const t = text.toLowerCase();
  const arten = [];
  if (/bauschutt|fliesen|mörtel|mortel|steine|beton/.test(t)) arten.push('bauschutt');
  if (/altholz|bauholz|\bholz\b|balken|bretter|unterkonstruktion/.test(t)) arten.push('altholz');
  if (/sperrmüll|sperrmull|möbel|mobel|matratze|teppich|sofa|schrank/.test(t)) arten.push('sperrmuell');
  if (/elektro|kühlschrank|kuhlschrank|fernseher|waschmaschine|gerät|gerat/.test(t)) arten.push('elektroschrott');
  if (/sondermüll|sondermull|farbe|lack|chemikalie|öl|asbest|batterie/.test(t)) arten.push('sondermuell');
  return arten;
}

/** "etwa 10–18 m³" -> 18 (obere Grenze, damit nicht zu knapp kalkuliert wird) */
function erkenneVolumen(text) {
  const bereinigt = text.replace(/,/g, '.');
  const zahlen = (bereinigt.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(function (n) {
    return n > 0 && n < 500;
  });
  if (!zahlen.length) return null;
  // Bei einer Spanne die obere Grenze nehmen: zu wenig Fahrten kalkuliert
  // kostet euch Geld, zu viele kostet den Auftrag — aber nur vielleicht.
  return Math.max.apply(null, zahlen);
}

/** "2 Zimmer" -> 2 */
function erkenneZimmer(text) {
  const treffer = text.match(/(\d+)\s*(?:zimmer|zi\b|raum|räume)/i);
  return treffer ? Number(treffer[1]) : null;
}

/** "65 m²" oder "65 qm" -> 65 */
function erkenneWohnflaeche(text) {
  const treffer = text.match(/(\d+(?:[.,]\d+)?)\s*(?:m²|m2|qm|quadratmeter)/i);
  return treffer ? Number(String(treffer[1]).replace(',', '.')) : null;
}

/* -----------------------------------------------------------------------------
 * HAUPTFUNKTION
 * -----------------------------------------------------------------------------
 * Liest den Mailtext und gibt zurück:
 *   felder   Werte für das Formular (nur was erkannt wurde)
 *   notizen  was übernommen wurde, für die Anzeige
 *   warnungen  was NICHT erkannt wurde und geprüft werden muss
 * -------------------------------------------------------------------------- */
function leseAnfrage(mailtext) {
  const felder = {};
  const notizen = [];
  const warnungen = [];

  // Alle "Label: Wert"-Zeilen sammeln. Labels können doppelt vorkommen
  // (die Mail hat zweimal "Größe:" — einmal die Einordnung "MITTEL",
  // einmal "2 Zimmer"), deshalb wird pro Label eine Liste geführt.
  const werte = {};
  mailtext.split(/\r?\n/).forEach(function (zeile) {
    const treffer = zeile.match(/^\s*([A-Za-zÄÖÜäöüß\- .]{2,30}?)\s*:\s*(.+?)\s*$/);
    if (!treffer) return;
    const label = treffer[1].toLowerCase().replace(/\s+/g, ' ').trim();
    if (!werte[label]) werte[label] = [];
    werte[label].push(treffer[2]);
  });

  function hole(label) {
    return werte[label] ? werte[label] : [];
  }
  function ersteZeile(label) {
    const liste = hole(label);
    return liste.length ? liste[0] : '';
  }

  /* --- Referenz ---------------------------------------------------------- */
  const referenz = ersteZeile('anfrage-nummer') || ersteZeile('anfragenummer');
  if (referenz) {
    felder.referenz = referenz;
    notizen.push('Anfrage-Nummer ' + referenz);
  }

  /* --- Kundendaten ------------------------------------------------------- */
  const name = ersteZeile('name');
  if (name) { felder.kundenname = name; notizen.push('Name: ' + name); }

  const telefon = ersteZeile('telefon') || ersteZeile('telefonnummer');
  if (telefon) { felder.telefon = telefon; notizen.push('Telefon: ' + telefon); }

  /* --- Ort und Zone ------------------------------------------------------ */
  const ort = ersteZeile('ort') || ersteZeile('wo') || ersteZeile('adresse');
  if (ort) {
    felder.adresse = ort;
    const schluessel = ort.toLowerCase().replace(/[^a-zäöüß]/g, '');
    let zone = ORT_ZONEN[schluessel];
    if (!zone) {
      // auch Teiltreffer versuchen, z. B. "38124 Braunschweig-Stöckheim"
      const gefunden = Object.keys(ORT_ZONEN).find(function (o) {
        return ort.toLowerCase().indexOf(o) !== -1;
      });
      if (gefunden) zone = ORT_ZONEN[gefunden];
    }
    if (zone) {
      felder.zone = zone;
      notizen.push('Ort ' + ort + ' → ' + LABELS.zonenKurz[zone]);
    } else {
      warnungen.push('Ort "' + ort + '" ist keiner Zone zugeordnet – bitte Anfahrt selbst wählen.');
    }
  } else {
    warnungen.push('Kein Ort gefunden – bitte Anfahrt selbst wählen.');
  }

  /* --- Bereich und Auftragsart ------------------------------------------- */
  const bereich = erkenneBereich(ersteZeile('bereich'));
  const wasText = hole('was').join(' ') + ' ' + hole('was im garten').join(' ') +
    ' ' + hole('leistung').join(' ') + ' ' + hole('betreff').join(' ');

  let art = null;
  if (bereich === 'garten') {
    art = 'garten';
  } else if (bereich === 'entruempelung') {
    art = 'entruempelung';
  } else if (bereich === 'beides') {
    /*
     * Die Website lässt beides zusammen anfragen, das Werkzeug rechnet
     * einen Auftrag. Hier wird nichts still entschieden: eingestellt ist
     * die Entrümpelung, und der Hinweis sagt, dass eine zweite Kalkulation
     * fehlt. Ein zusammengerechneter Preis aus zwei Aufträgen wäre falsch.
     */
    art = 'entruempelung';
    warnungen.push('Die Anfrage umfasst Entrümpelung UND Garten. Das Werkzeug ' +
      'rechnet einen Auftrag – bitte zwei Kalkulationen erstellen. ' +
      'Eingestellt ist zunächst die Entrümpelung.');
  }
  if (!art) art = erkenneAuftragsart(wasText);

  if (art) {
    felder.auftragsart = art;
    notizen.push('Auftragsart: ' + AUFTRAGSARTEN[art].label +
      (bereich ? ' (aus der Zeile „Bereich")' : ''));
  } else {
    warnungen.push('Auftragsart nicht erkannt – bitte oben selbst wählen.');
  }

  /* --- Garten ------------------------------------------------------------- */
  const gartenZeile = hole('was im garten').join(', ');
  if (gartenZeile) {
    const arbeiten = erkenneGartenarbeiten(gartenZeile);
    if (arbeiten.length) {
      felder.gartenArbeiten = arbeiten;
      notizen.push('Arbeiten im Garten: ' + arbeiten.map(function (k) {
        return LABELS.gartenArbeiten[k];
      }).join(', '));
    } else {
      warnungen.push('Die Gartenarbeiten waren nicht zuzuordnen („' + gartenZeile +
        '") – bitte selbst ankreuzen.');
    }
  }

  const gartenGroesse = erkenneGartengroesse(
    ersteZeile('gartengröße') || ersteZeile('gartengrösse') || ersteZeile('gartengroesse'));
  if (gartenGroesse) {
    felder.gartenGroesse = gartenGroesse;
    notizen.push('Gartengröße: ' + LABELS.gartenGroesse[gartenGroesse]);
  } else if (art === 'garten') {
    warnungen.push('Keine Gartengröße in der Mail – bitte selbst einordnen.');
  }

  const gartenZustand = erkenneGartenzustand(ersteZeile('zustand'));
  if (gartenZustand && art === 'garten') {
    felder.gartenZustand = gartenZustand;
    notizen.push('Zustand: ' + LABELS.gartenZustand[gartenZustand]);
  } else if (art === 'garten') {
    warnungen.push('Kein Zustand in der Mail – bitte selbst einordnen.');
  }

  /*
   * Grünschnitt: dass er mitgenommen werden soll, steht in der Mail. WIE VIEL
   * es ist, steht dort nicht — aus "Hecke schneiden" folgt keine
   * Kubikmeterzahl. Das Volumen bleibt deshalb leer und wird angemahnt,
   * statt geraten zu werden: davon hängen die Fahrten und damit ein guter
   * Teil des Preises ab.
   */
  const gruenZeile = (ersteZeile('grünschnitt') || ersteZeile('grunschnitt') || '').toLowerCase();
  const gruenMit = /mitnehmen/.test(gruenZeile) ||
    (felder.gartenArbeiten || []).indexOf('gruenschnitt_weg') !== -1;
  if (gruenMit) {
    felder.abfallarten = (felder.abfallarten || []).concat(['gruenschnitt']);
    notizen.push('Grünschnitt wird mitgenommen');
    warnungen.push('Volumen des Grünschnitts steht nicht in der Mail – bitte ' +
      'schätzen (ein voller Anhänger sind etwa ' +
      PREISE.transport.kapazitaetProFahrt + ' m³). Davon hängen die Fahrten ab.');
  }

  /* --- Größe: Wohnfläche oder Zimmer ------------------------------------- */
  // "Größe" kommt in der Mail zweimal vor. Alle Vorkommen durchsuchen und
  // das Konkrete nehmen, nicht die Einordnung "MITTEL".
  const groessen = hole('größe').concat(hole('grösse'), hole('grosse'), hole('wohnfläche'), hole('flaeche'));
  let flaeche = null;
  let zimmer = null;
  groessen.forEach(function (wert) {
    if (flaeche === null) flaeche = erkenneWohnflaeche(wert);
    if (zimmer === null) zimmer = erkenneZimmer(wert);
  });

  if (flaeche) {
    felder.wohnflaeche = flaeche;
    notizen.push('Wohnfläche: ' + flaeche + ' m²');
  }
  if (zimmer) {
    felder.zimmer = zimmer;
    notizen.push('Zimmer: ' + zimmer);
    if (!flaeche) {
      // Die Mail nennt keine Fläche. Grob aus den Zimmern rechnen,
      // damit das Formular nicht leer bleibt — und deutlich warnen.
      felder.wohnflaeche = zimmer * PREISE.entruempelung.quadratmeterProZimmer;
      warnungen.push('Keine Wohnfläche in der Mail. Aus ' + zimmer + ' Zimmern grob ' +
        felder.wohnflaeche + ' m² geschätzt – bitte prüfen und korrigieren.');
    }
  }

  /* --- Füllgrad ---------------------------------------------------------- */
  // "Zustand" nur dann, wenn es kein Gartenauftrag ist — dort beschreibt
  // dieselbe Zeile den Garten, nicht die Vermüllung einer Wohnung.
  const vollText = hole('wie voll').join(' ') + ' ' + hole('füllgrad').join(' ') +
    (art === 'garten' ? '' : ' ' + hole('zustand').join(' '));
  const grad = erkenneVermuellungsgrad(vollText);
  if (grad) {
    felder.vermuellungsgrad = grad;
    notizen.push('Füllgrad: ' + LABELS.vermuellung[grad]);
  } else if (art === 'entruempelung') {
    warnungen.push('Füllgrad nicht erkannt – bitte selbst wählen.');
  }

  /* --- Etage ------------------------------------------------------------- */
  const etage = erkenneEtage(hole('etage').join(' ') + ' ' + hole('stockwerk').join(' '));
  if (etage) {
    felder.etage = etage;
    notizen.push('Etage: ' + LABELS.etage[etage]);
  }

  /* --- Aufzug ------------------------------------------------------------ */
  const aufzugText = (hole('aufzug').join(' ') + ' ' + hole('etage').join(' ')).toLowerCase();
  if (/aufzug|lift/.test(aufzugText)) {
    felder.aufzug = !/kein|ohne|nein|nicht/.test(aufzugText);
    notizen.push('Aufzug: ' + (felder.aufzug ? 'ja' : 'nein'));
  }

  /* --- Abfallarten ------------------------------------------------------- */
  const besonderes = hole('besonderes').join(' ') + ' ' + hole('achtung').join(' ') +
    ' ' + hole('besondere gegenstände').join(' ');
  const arten = erkenneAbfallarten(besonderes);
  if (arten.length) {
    // Dazu, nicht statt: der Grünschnitt von oben bleibt stehen.
    const vorhanden = felder.abfallarten || [];
    felder.abfallarten = vorhanden.concat(arten.filter(function (a) {
      return vorhanden.indexOf(a) === -1;
    }));
    notizen.push('Entsorgung: ' + arten.map(function (a) { return LABELS.abfallarten[a]; }).join(', '));
  }

  /* --- Volumen ----------------------------------------------------------- */
  const volumenZeile = ersteZeile('volumen') || ersteZeile('menge');
  if (volumenZeile) {
    const volumen = erkenneVolumen(volumenZeile);
    if (volumen) {
      felder.volumen = volumen;
      notizen.push('Volumen: ' + volumen + ' m³ (obere Grenze aus "' + volumenZeile + '")');
    }
  }

  /* --- Beschreibung für das PDF ------------------------------------------ */
  const teile = [];
  hole('was').forEach(function (w) { teile.push(w); });
  hole('was im garten').forEach(function (w) { teile.push(w); });
  // Die eigene Beschreibung des Kunden steht wörtlich im PDF — sie ist
  // oft genauer als jede Auswahl.
  hole('beschreibung').forEach(function (w) { teile.push(w); });
  if (zimmer) teile.push(zimmer + ' Zimmer');
  hole('besonderes').forEach(function (w) { teile.push('Besonderes: ' + w); });
  hole('wie oft').forEach(function (w) { teile.push('Häufigkeit: ' + w); });
  hole('wann').forEach(function (w) { teile.push('Wunschtermin: ' + w); });
  if (teile.length) felder.beschreibung = teile.join(', ') + '.';

  /* --- Interne Einordnung der Website nur melden, nicht ins PDF ---------- */
  hole('achtung').forEach(function (w) {
    warnungen.push('Hinweis der Website: ' + w);
  });
  hole('leute').forEach(function (w) {
    notizen.push('Einordnung der Website: ' + w);
  });
  const anhaenge = ersteZeile('anhänge');
  if (anhaenge && Number(anhaenge) > 0) {
    warnungen.push('Die Anfrage hat ' + anhaenge + ' Anhang/Anhänge (Fotos) – vor dem Angebot ansehen.');
  }

  if (!notizen.length) {
    warnungen.push('Aus dem Text war nichts zu erkennen. Ist der vollständige Mailtext eingefügt?');
  }

  return { felder: felder, notizen: notizen, warnungen: warnungen };
}
