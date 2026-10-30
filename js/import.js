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

/**
 * Die Zone zu einem Ortsnamen – oder null, wenn er nicht in der Liste steht.
 * Wird NICHT geraten: ein unbekannter Ort führt zu einer Warnung, nicht zu
 * einer stillen Annahme.
 */
function zoneFuerOrt(ort) {
  const schluessel = ort.toLowerCase().replace(/[^a-zäöüß]/g, '');
  if (ORT_ZONEN[schluessel]) return ORT_ZONEN[schluessel];
  // auch Teiltreffer, z. B. "38124 Braunschweig-Stöckheim"
  const gefunden = Object.keys(ORT_ZONEN).find(function (o) {
    return ort.toLowerCase().indexOf(o) !== -1;
  });
  return gefunden ? ORT_ZONEN[gefunden] : null;
}

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

  /*
   * Zuerst die vier Antworten, die der Chat tatsächlich schickt. Sie sind
   * Spannen ("1. oder 2. Stock"), keine Etagenzahlen — deshalb wird hier
   * übersetzt und gesagt, womit gerechnet wurde:
   *
   *   "1. oder 2. Stock, ohne Aufzug"    -> 2  (die teurere der beiden)
   *   "3. Stock oder höher, ohne Aufzug" -> 3  (die GÜNSTIGSTE der Spanne,
   *                                             nach oben offen -> Warnung)
   *
   * Warum bei "3. Stock oder höher" nicht 'hoeher': Das sind 6 Etagen und
   * damit +90 % Aufschlag auf die Arbeit. Die Antwort kann aber auch den
   * dritten Stock meinen (+45 %). Ein zu hoher Preis kostet den Auftrag,
   * ohne dass jemand nachfragt – also die untere Kante nehmen und vor Ort
   * prüfen.
   */
  if (/1\.\s*oder\s*2\.\s*stock/.test(t)) {
    return { etage: '2', hinweis: '1. oder 2. Stock, mit 2 gerechnet' };
  }
  if (/3\.\s*stock\s*oder\s*höher|3\.\s*stock\s*oder\s*hoher/.test(t)) {
    return { etage: '3', warnung: 'mindestens 3. Etage, vor Ort prüfen' };
  }
  if (/mit\s*aufzug/.test(t)) {
    return { etage: 'eg', aufzug: true, hinweis: 'Mit Aufzug – kein Etagenaufschlag' };
  }
  if (/erdgeschoss|\beg\b|parterre/.test(t)) {
    return { etage: 'eg' };
  }

  /* --- Rückfall für Texte, die nicht aus dem Chat stammen --------------- */
  if (/höher|hoher|dachgeschoss|\bdg\b|[6-9]\s*\./.test(t)) return { etage: 'hoeher' };
  const treffer = t.match(/([1-5])\s*\./);
  if (treffer) return { etage: treffer[1] };
  const zahl = t.match(/\b([1-5])\b/);
  if (zahl) return { etage: zahl[1] };
  return null;
}

/**
 * Zeile "Leute: ALLEIN MACHBAR – ..." oder "Leute: ZU ZWEIT – ...".
 * Die Website schätzt das selbst; wie viele hinfahren, bestimmt bei uns
 * die Fahrzeit und die Dauer vor Ort.
 */
function erkenneLeute(text) {
  const t = text.trim().toUpperCase();
  if (t.indexOf('ZU ZWEIT') === 0) return 2;
  if (t.indexOf('ALLEIN') === 0) return 1;
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

/** "etwa 10–18 m³" -> { min: 10, max: 18, mitte: 14 } */
function erkenneVolumen(text) {
  // Die Einheit zuerst weg: die 3 aus "m3" wäre sonst die untere Grenze.
  const bereinigt = text.replace(/m\s*[3³]/gi, '').replace(/,/g, '.');
  const zahlen = (bereinigt.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(function (n) {
    return n > 0 && n < 500;
  });
  if (!zahlen.length) return null;

  const min = Math.min.apply(null, zahlen);
  const max = Math.max.apply(null, zahlen);
  /*
   * Gerechnet wird mit der MITTE, nicht mit der Obergrenze: Die Obergrenze
   * ist das "bis" der Kundenspanne und steht ohnehin daneben. Ein Richtwert
   * an der Obergrenze wäre im Schnitt zu teuer.
   */
  return { min: min, max: max, mitte: (min + max) / 2 };
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

/* =============================================================================
 * Strukturierter Block "RECHNER-DATEN v1"
 * -----------------------------------------------------------------------------
 * Wenn die Website ihn mitschickt, ist er die bessere Quelle: feste Schlüssel
 * statt deutscher Sätze, nichts zu raten. Aufbau:
 *
 *   --- RECHNER-DATEN v1 ---
 *   bereich: entruempelung
 *   objekt: wohnung
 *   zimmer: 3
 *   ...
 *   --- ENDE ---
 *
 * Mehrere Werte in einer Zeile mit "; " getrennt. Was die Website nicht weiß,
 * lässt sie weg – eine fehlende Zeile heißt also "unbekannt" und wird NICHT
 * geraten.
 * ========================================================================== */

/** Übersetzungen der Schlüssel aus dem Block in die Werte des Formulars. */
const RD_OBJEKT = {
  wohnung: 'entruempelung', haus: 'entruempelung', keller: 'entruempelung',
  garage: 'entruempelung', moebel: 'entruempelung', anderes: 'entruempelung',
};
const RD_FUELLGRAD = { leer: 'leicht', normal: 'leicht', voll: 'stark' };
const RD_ETAGE = {
  eg: { etage: 'eg' },
  '1-2': { etage: '2', hinweis: '1. oder 2. Stock, mit 2 gerechnet' },
  '3plus': { etage: '3', warnung: 'mindestens 3. Etage, vor Ort prüfen' },
};
const RD_BESONDERES = {
  elektro: 'elektroschrott',
  bauschutt: 'bauschutt',
  schadstoffe: 'sondermuell',
};
const RD_WARNUNG = {
  schwerlast: 'Schwerlast, mindestens 2 Personen',
  verwertbares: 'Verwertbares, bei Besichtigung gegenrechnen',
};

/**
 * Sucht den Block und liest ihn aus. Gibt null zurück, wenn er fehlt — dann
 * gilt der Textweg für ältere Mails.
 */
function leseRechnerDaten(mailtext) {
  const treffer = mailtext.match(
    /---\s*RECHNER-DATEN\s+v1\s*---([\s\S]*?)---\s*ENDE\s*---/i
  );
  if (!treffer) return null;

  const zeilen = {};
  treffer[1].split(/\r?\n/).forEach(function (zeile) {
    const m = zeile.match(/^\s*([a-z0-9_]+)\s*:\s*(.+?)\s*$/i);
    if (m) zeilen[m[1].toLowerCase()] = m[2];
  });

  const felder = {};
  const notizen = ['Strukturierte Daten aus der Mail gelesen (RECHNER-DATEN v1)'];
  const warnungen = [];
  const liste = function (name) {
    return (zeilen[name] || '').split(';').map(function (x) { return x.trim(); })
      .filter(Boolean);
  };

  /* --- Bereich ---------------------------------------------------------- */
  const bereich = (zeilen.bereich || '').toLowerCase();
  if (bereich === 'garten') felder.auftragsart = 'garten';
  else if (bereich === 'entruempelung' || bereich === 'beides') felder.auftragsart = 'entruempelung';
  if (bereich === 'beides') {
    warnungen.push('Anfrage über BEIDES – hier ist nur die Entrümpelung ' +
      'gerechnet. Die Gartenarbeiten bitte getrennt kalkulieren.');
  }
  if (felder.auftragsart) notizen.push('Auftragsart: ' + AUFTRAGSARTEN[felder.auftragsart].label);

  /* --- Objekt und Zimmer ------------------------------------------------ */
  const objekt = (zeilen.objekt || '').toLowerCase();
  if (objekt && RD_OBJEKT[objekt]) notizen.push('Objekt: ' + objekt);
  const zimmer = Number(zeilen.zimmer);
  if (Number.isFinite(zimmer) && zimmer > 0) {
    felder.zimmer = zimmer;
    notizen.push('Zimmer: ' + zimmer);
  }

  /* --- Füllgrad --------------------------------------------------------- */
  const fuellgrad = (zeilen.fuellgrad || '').toLowerCase();
  if (RD_FUELLGRAD[fuellgrad]) {
    felder.vermuellungsgrad = RD_FUELLGRAD[fuellgrad];
    notizen.push('Füllgrad: ' + LABELS.vermuellung[felder.vermuellungsgrad]);
  } else if (fuellgrad === 'unbekannt') {
    warnungen.push('Füllgrad unbekannt – bitte selbst wählen.');
  }

  /* --- Etage und Aufzug ------------------------------------------------- */
  const etage = RD_ETAGE[(zeilen.etage || '').toLowerCase()];
  if (etage) {
    felder.etage = etage.etage;
    notizen.push('Etage: ' + LABELS.etage[etage.etage] +
      (etage.hinweis ? ' (' + etage.hinweis + ')' : ''));
    if (etage.warnung) warnungen.push(etage.warnung);
  } else if ((zeilen.etage || '').toLowerCase() === 'unbekannt') {
    warnungen.push('Etage unbekannt – bitte nachfragen, sie bestimmt den Aufschlag.');
  }

  const aufzug = (zeilen.aufzug || '').toLowerCase();
  if (aufzug === 'ja' || aufzug === 'nein') {
    felder.aufzug = aufzug === 'ja';
    notizen.push('Aufzug: ' + aufzug);
  } else if (aufzug === 'unbekannt') {
    warnungen.push('Aufzug unbekannt – ohne Aufzug gerechnet, bitte prüfen.');
  }

  /* --- Besonderes ------------------------------------------------------- */
  const arten = [];
  liste('besonderes').forEach(function (eintrag) {
    const k = eintrag.toLowerCase();
    if (RD_BESONDERES[k] && arten.indexOf(RD_BESONDERES[k]) === -1) arten.push(RD_BESONDERES[k]);
    if (RD_WARNUNG[k]) warnungen.push(RD_WARNUNG[k]);
    if (k === 'sonstiges') warnungen.push('Eigene Angabe im Feld "Besonderes" – Mailtext lesen.');
  });
  if (arten.length) {
    felder.abfallarten = arten;
    notizen.push('Entsorgung: ' + arten.map(function (a) { return LABELS.abfallarten[a]; }).join(', '));
  }

  /* --- Volumen ---------------------------------------------------------- */
  const volumenRoh = zeilen.volumen_m3;
  if (volumenRoh) {
    const volumen = erkenneVolumen(volumenRoh);
    if (volumen) {
      felder.volumen = volumen.mitte;
      if (volumen.max > volumen.min) {
        felder.volumenMin = volumen.min;
        felder.volumenMax = volumen.max;
        notizen.push('Volumen: ' + volumen.min + '–' + volumen.max + ' m³, gerechnet mit ' +
          volumen.mitte + ' m³ (Mitte); die Spanne bestimmt den Preis von–bis');
      } else {
        notizen.push('Volumen: ' + volumen.mitte + ' m³');
      }
    }
  }

  /* --- Personen --------------------------------------------------------- */
  const personen = Number(zeilen.personen);
  if (personen === 1 || personen === 2) {
    felder.personen = personen;
    notizen.push('Personen: ' + personen);
  }

  /* --- Garten ----------------------------------------------------------- */
  const arbeiten = liste('garten_arbeiten').filter(function (a) {
    return LABELS.gartenArbeiten && LABELS.gartenArbeiten[a];
  });
  if (arbeiten.length) {
    felder.gartenArbeiten = arbeiten;
    notizen.push('Gartenarbeiten: ' + arbeiten.map(function (a) {
      return LABELS.gartenArbeiten[a];
    }).join(', '));
  }
  const gGroesse = (zeilen.garten_groesse || '').toLowerCase();
  if (LABELS.gartenGroesse && LABELS.gartenGroesse[gGroesse]) {
    felder.gartenGroesse = gGroesse;
    notizen.push('Gartengröße: ' + LABELS.gartenGroesse[gGroesse]);
  } else if (gGroesse === 'unbekannt') {
    warnungen.push('Gartengröße unbekannt – bitte selbst einordnen.');
  }
  const gZustand = (zeilen.garten_zustand || '').toLowerCase();
  if (LABELS.gartenZustand && LABELS.gartenZustand[gZustand]) {
    felder.gartenZustand = gZustand;
    notizen.push('Zustand: ' + LABELS.gartenZustand[gZustand]);
  } else if (gZustand === 'unbekannt') {
    warnungen.push('Zustand des Gartens unbekannt – bitte selbst einordnen.');
  }

  const gruen = (zeilen.gruenschnitt || '').toLowerCase();
  if (gruen === 'mitnehmen' || arbeiten.indexOf('gruenschnitt_weg') !== -1) {
    felder.abfallarten = (felder.abfallarten || []).concat(
      (felder.abfallarten || []).indexOf('gruenschnitt') === -1 ? ['gruenschnitt'] : []
    );
    notizen.push('Grünschnitt wird mitgenommen');
    if (!felder.volumen) {
      warnungen.push('Volumen des Grünschnitts steht nicht in der Mail – bitte ' +
        'schätzen (ein voller Anhänger sind etwa ' +
        PREISE.transport.kapazitaetProFahrt + ' m³). Davon hängen die Fahrten ab.');
    }
  } else if (gruen === 'unbekannt') {
    warnungen.push('Unklar, ob der Grünschnitt mit soll – bitte nachfragen.');
  }

  /* --- Ort und Zone ----------------------------------------------------- */
  if (zeilen.ort) {
    felder.adresse = zeilen.ort;
    const zone = zoneFuerOrt(zeilen.ort);
    if (zone) {
      felder.zone = zone;
      notizen.push('Ort ' + zeilen.ort + ' \u2192 ' + LABELS.zonenKurz[zone]);
    } else {
      warnungen.push('Ort "' + zeilen.ort + '" ist keiner Zone zugeordnet \u2013 ' +
        'bitte Anfahrt selbst wählen.');
    }
  }

  /* --- Ohne Grundlage kein Preis ---------------------------------------- */
  if ((bereich === 'entruempelung' || bereich === 'beides') && !felder.volumen) {
    warnungen.push(
      'KEINE GRUNDLAGE: Kein Volumen im Datenblock. Ohne Volumen oder ' +
      'Wohnfläche lässt sich kein Preis rechnen.'
    );
  }

  return { felder: felder, notizen: notizen, warnungen: warnungen };
}

/**
 * Alle "Label: Wert"-Zeilen sammeln. Labels können doppelt vorkommen (die Mail
 * hat zweimal "Größe:" — einmal die Einordnung "MITTEL", einmal "2 Zimmer"),
 * deshalb wird pro Label eine Liste geführt.
 */
function leseZeilen(mailtext) {
  const werte = {};
  mailtext.split(/\r?\n/).forEach(function (zeile) {
    const treffer = zeile.match(/^\s*([A-Za-zÄÖÜäöüß\- .]{2,30}?)\s*:\s*(.+?)\s*$/);
    if (!treffer) return;
    const label = treffer[1].toLowerCase().replace(/\s+/g, ' ').trim();
    if (!werte[label]) werte[label] = [];
    werte[label].push(treffer[2]);
  });
  return werte;
}

/**
 * Der Block kennt weder Kontakt noch Anfrage-Nummer noch Anhänge – die stehen
 * im Rest der Mail und gingen sonst still verloren. Nur diese Angaben kommen
 * von dort. Alles, was den Preis bestimmt, bleibt allein Sache des Blocks:
 * Fehlt dort eine Zeile, gilt sie als unbekannt.
 */
function ergaenzeAusRestDerMail(ergebnis, mailtext) {
  const rest = leseZeilen(mailtext.replace(/---\s*RECHNER-DATEN[\s\S]*?---\s*ENDE\s*---/i, ''));
  const erste = function (label) { return rest[label] ? rest[label][0] : ''; };

  const referenz = erste('anfrage-nummer') || erste('anfragenummer');
  if (referenz) {
    ergebnis.felder.referenz = referenz;
    ergebnis.notizen.push('Anfrage-Nummer ' + referenz);
  }
  const name = erste('name');
  if (name) {
    ergebnis.felder.kundenname = name;
    ergebnis.notizen.push('Name: ' + name);
  }
  const telefon = erste('telefon') || erste('telefonnummer');
  if (telefon) {
    ergebnis.felder.telefon = telefon;
    ergebnis.notizen.push('Telefon: ' + telefon);
  }
  const anhaenge = erste('anhänge');
  if (anhaenge && Number(anhaenge) > 0) {
    ergebnis.warnungen.push('Die Anfrage hat ' + anhaenge + ' Anhang/Anhänge (Fotos) – vor dem Angebot ansehen.');
  }
  return ergebnis;
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
  /*
   * Schickt die Website den strukturierten Block mit, ist er die bessere
   * Quelle: feste Schlüssel statt deutscher Sätze. Ältere Mails haben ihn
   * nicht – für die gilt unverändert der Textweg darunter.
   */
  const strukturiert = leseRechnerDaten(mailtext);
  if (strukturiert) return ergaenzeAusRestDerMail(strukturiert, mailtext);

  const felder = {};
  const notizen = [];
  const warnungen = [];

  const werte = leseZeilen(mailtext);

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
    const zone = zoneFuerOrt(ort);
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
    const anhaenger = PREISE.transport.kapazitaetProFahrt + ' m³';
    // Steht in der Mail überhaupt ein Volumen? Bei einer reinen
    // Gartenanfrage nie – bei "Entrümpelung + Garten" gilt es dem Hausrat.
    warnungen.push(hole('volumen').length || hole('menge').length
      ? 'Grünschnitt kommt dazu. Das Volumen aus der Mail gilt dem Hausrat – ' +
          'bitte den Grünschnitt dazurechnen (ein voller Anhänger sind etwa ' +
          anhaenger + ').'
      : 'Volumen des Grünschnitts steht nicht in der Mail – bitte schätzen ' +
          '(ein voller Anhänger sind etwa ' + anhaenger + '). ' +
          'Davon hängen die Fahrten ab.');
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
      // damit das Formular nicht leer bleibt.
      felder.wohnflaeche = zimmer * PREISE.entruempelung.quadratmeterProZimmer;
      /*
       * Ob das eine Warnung wert ist, hängt daran, ob die Fläche überhaupt in
       * den Preis eingeht: Nennt die Mail ein Volumen, rechnet der Rechner
       * darüber, und die geschätzte Fläche steht nur noch im PDF. Davor zu
       * warnen wäre Lärm – und würde die echten Warnungen verwässern.
       *
       * Die Volumenzeile wird weiter unten ausgewertet; hier genügt die
       * Frage, ob überhaupt eine brauchbare drinsteht.
       */
      const mitVolumen = Boolean(
        erkenneVolumen(ersteZeile('volumen') || ersteZeile('menge') || '')
      );
      if (mitVolumen) {
        notizen.push('Wohnfläche aus ' + zimmer + ' Zimmern grob auf ' +
          felder.wohnflaeche + ' m² geschätzt – nur fürs PDF, gerechnet wird ' +
          'mit dem Volumen.');
      } else {
        warnungen.push('Keine Wohnfläche in der Mail. Aus ' + zimmer + ' Zimmern grob ' +
          felder.wohnflaeche + ' m² geschätzt – bitte prüfen und korrigieren.');
      }
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

  /* --- Etage und Aufzug -------------------------------------------------- */
  const etageText = hole('etage').join(' ') + ' ' + hole('stockwerk').join(' ');
  const etage = erkenneEtage(etageText);
  if (etage) {
    felder.etage = etage.etage;
    notizen.push('Etage: ' + LABELS.etage[etage.etage] +
      (etage.hinweis ? ' (' + etage.hinweis + ')' : ''));
    if (etage.warnung) warnungen.push(etage.warnung);
    if (etage.aufzug === true) felder.aufzug = true;
  } else if (art === 'entruempelung') {
    warnungen.push('Etage nicht erkannt – es gilt, was im Formular steht (Erdgeschoss). Bitte prüfen.');
  }

  // Steht "ohne Aufzug" in derselben Zeile, ist das eindeutig.
  const aufzugText = (hole('aufzug').join(' ') + ' ' + etageText).toLowerCase();
  if (felder.aufzug === undefined && /aufzug|lift/.test(aufzugText)) {
    felder.aufzug = !/kein|ohne|nein|nicht/.test(aufzugText);
  }
  if (felder.aufzug !== undefined) {
    notizen.push('Aufzug: ' + (felder.aufzug ? 'ja' : 'nein'));
  }

  /* --- Wie viele Leute (Zeile "Leute:") ---------------------------------- */
  const leuteZeile = ersteZeile('leute') || ersteZeile('personen');
  if (leuteZeile) {
    const leute = erkenneLeute(leuteZeile);
    if (leute) {
      felder.personen = leute;
      notizen.push('Personen: ' + leute + ' (aus "' + leuteZeile.split('–')[0].trim() + '")');
    }
  }

  /* --- Was im "Besonderes" steht, aber keine Abfallart ist ---------------
   * Diese drei Antworten verändern den Auftrag, ohne dass eine Abfallart
   * davon betroffen wäre. Bisher gingen sie unter – jetzt stehen sie im
   * Bericht unter "Bitte prüfen".
   * -------------------------------------------------------------------- */
  const besonderesText = hole('besonderes').join(' ') + ' ' + hole('besondere gegenstände').join(' ');
  const bt = besonderesText.toLowerCase();
  if (/noch gut sind|verwertbar|gut erhalten/.test(bt)) {
    warnungen.push('Verwertbares, bei Besichtigung gegenrechnen');
  }
  if (/sehr schweres|klavier|tresor|schwerlast/.test(bt)) {
    warnungen.push('Schwerlast, mindestens 2 Personen');
  }
  /*
   * "Etwas anderes: <Text>" – der Freitext des Kunden. Er kann alles
   * enthalten, vom Öltank bis zum Taubenkot, und gehört deshalb ungekürzt
   * vor die Augen, nicht in eine Schublade. Deshalb bis zum Zeilenende: Am
   * Komma zu trennen schnitte "Öltank, rostig" mitten im Satz ab.
   */
  hole('besonderes').concat(hole('besondere gegenstände')).forEach(function (zeile) {
    const m = zeile.match(/etwas anderes\s*:\s*(.+)$/i);
    if (m) warnungen.push('Eigene Angabe: ' + m[1].trim());
  });

  /* --- Abfallarten ------------------------------------------------------- */
  const besonderes = besonderesText + ' ' + hole('achtung').join(' ');
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
      felder.volumen = volumen.mitte;
      if (volumen.max > volumen.min) {
        felder.volumenMin = volumen.min;
        felder.volumenMax = volumen.max;
        notizen.push('Volumen: ' + volumen.min + '–' + volumen.max + ' m³, gerechnet mit ' +
          volumen.mitte + ' m³ (Mitte); die Spanne bestimmt den Preis von–bis');
      } else {
        notizen.push('Volumen: ' + volumen.mitte + ' m³');
      }
    }
  }

  /* --- Beschreibung für das PDF ------------------------------------------ */
  const teile = [];
  hole('was').forEach(function (w) { teile.push(w); });
  /*
   * Die angekreuzten Gartenarbeiten stehen im PDF schon als eigene Zeilen —
   * hier würden sie den Text nur zustellen. Was hier hingehört, ist die
   * eigene Beschreibung des Kunden: sie ist oft genauer als jede Auswahl.
   */
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

  /*
   * Ohne Volumen UND ohne Wohnfläche gibt es für eine Entrümpelung keine
   * Grundlage: Die Arbeit käme dann allein aus der Grundpauschale, und das
   * wäre keine Schätzung, sondern eine Zahl, die zufällig erscheint.
   */
  if ((art === 'entruempelung' || art === 'beides') &&
      !felder.volumen && !felder.wohnflaeche) {
    warnungen.push(
      'KEINE GRUNDLAGE: Weder Volumen noch Wohnfläche in der Mail. So lässt ' +
      'sich kein Preis rechnen – bitte eines von beidem eintragen oder ' +
      'nachfragen.'
    );
  }

  if (!notizen.length) {
    warnungen.push('Aus dem Text war nichts zu erkennen. Ist der vollständige Mailtext eingefügt?');
  }

  return { felder: felder, notizen: notizen, warnungen: warnungen };
}
