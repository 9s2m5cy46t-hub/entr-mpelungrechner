/* =============================================================================
 * app.js — Formular auslesen, prüfen, Ergebnis anzeigen
 * Nutzt berechnePreis() aus pricing.js und erstellePDF() aus pdf.js.
 * ========================================================================== */

(function () {
  'use strict';

  const formular = document.getElementById('rechner-formular');
  const artAuswahl = document.getElementById('auftragsart');
  const artHinweis = document.getElementById('art-hinweis');
  const ergebnisBereich = document.getElementById('ergebnis');
  const ergebnisArt = document.getElementById('ergebnis-art');
  const preisAnzeige = document.getElementById('preis-anzeige');
  const richtwertAnzeige = document.getElementById('richtwert-anzeige');
  const planStunden = document.getElementById('plan-stunden');
  const planDauer = document.getElementById('plan-dauer');
  const planDauerLabel = document.getElementById('plan-dauer-label');
  const planSlot = document.getElementById('plan-slot');
  const planFahrten = document.getElementById('plan-fahrten');
  const zoneAuswahl = document.getElementById('zone');
  const feldKilometer = document.getElementById('feld-kilometer');
  const volumenHinweis = document.getElementById('volumen-hinweis');
  const ergebnisReferenz = document.getElementById('ergebnis-referenz');
  const importKarte = document.getElementById('import-karte');
  const importText = document.getElementById('import-text');
  const importKnopf = document.getElementById('import-knopf');
  const importBericht = document.getElementById('import-bericht');
  const bildEingabe = document.getElementById('import-bild');
  const bildVorschau = document.getElementById('bild-vorschau');
  const bildAnzeige = document.getElementById('bild-anzeige');
  const bildInsPdf = document.getElementById('bild-ins-pdf');
  const bildEntfernen = document.getElementById('bild-entfernen');
  const aufschluesselungListe = document.getElementById('aufschluesselung');
  const pdfKnopf = document.getElementById('pdf-knopf');
  const pdfFehler = document.getElementById('pdf-fehler');
  const neuKnopf = document.getElementById('neu-knopf');

  // Letzte Kalkulation, damit der PDF-Knopf sie verwenden kann.
  // Bleibt nur im Arbeitsspeicher — nichts wird gespeichert oder gesendet.
  let letzteEingaben = null;
  let letztesErgebnis = null;

  // Aus der Website-Anfrage übernommen. Nur im Arbeitsspeicher.
  let referenz = '';
  let screenshotDatenUrl = null;

  // Kurzer Hinweis unter dem Dropdown, damit klar ist, wie gerechnet wird
  const ART_HINWEISE = {
    entruempelung: 'Preis nach Wohnfläche und Vermüllungsgrad.',
    abbruch: 'Preis nach geschätzter Arbeitszeit und Entsorgung.',
    bau: 'Preis nach geschätzter Arbeitszeit plus Material.',
    sonstiges: 'Preis nach geschätzter Arbeitszeit.',
  };

  /* ---------------------------------------------------------------------------
   * Felder der gewählten Auftragsart einblenden, die anderen ausblenden
   * ------------------------------------------------------------------------ */
  function aktuellesModell() {
    const art = artAuswahl.value;
    return (AUFTRAGSARTEN[art] || AUFTRAGSARTEN.entruempelung).modell;
  }

  function zeigeKilometerfeld() {
    const brauchtKm = zoneAuswahl.value === 'zone4';
    feldKilometer.hidden = !brauchtKm;
    if (!brauchtKm) zeigeFehler('kilometer', '');
  }

  function zeigePassendeFelder() {
    const modell = aktuellesModell();
    document.querySelectorAll('[data-modell]').forEach(function (gruppe) {
      gruppe.hidden = gruppe.dataset.modell !== modell;
    });
    artHinweis.textContent = ART_HINWEISE[artAuswahl.value] || '';
    volumenHinweis.textContent = modell === 'flaeche'
      ? 'Leer lassen – wird aus der Wohnfläche geschätzt. Nur ausfüllen, wenn ihr es besser weißt (z. B. aus der Website-Anfrage).'
      : 'Grob schätzen: ein voller Anhänger sind etwa 4 m³. Leer lassen, wenn nichts weggefahren werden muss.';
    // Fehlermeldungen ausgeblendeter Felder zurücksetzen
    ['wohnflaeche', 'zimmer', 'dauer'].forEach(function (name) {
      const feld = document.getElementById(name);
      if (feld && feld.closest('[data-modell]').hidden) zeigeFehler(name, '');
    });
  }

  /* ---------------------------------------------------------------------------
   * Formular auslesen
   * ------------------------------------------------------------------------ */
  function leseFormular() {
    const daten = new FormData(formular);
    return {
      auftragsart: daten.get('auftragsart'),
      beschreibung: (daten.get('beschreibung') || '').trim(),
      // Entrümpelung
      wohnflaeche: Number(daten.get('wohnflaeche')),
      zimmer: Number(daten.get('zimmer')),
      vermuellungsgrad: daten.get('vermuellungsgrad'),
      kellerabteil: daten.get('kellerabteil') === 'ja',
      // Stundenauftrag
      dauer: Number(daten.get('dauer')),
      erschwernis: daten.get('erschwernis'),
      material: Number(daten.get('material')) || 0,
      // alle Auftragsarten
      personen: Number(daten.get('personen')) || 1,
      etage: daten.get('etage'),
      aufzug: daten.get('aufzug') === 'ja',
      volumen: Number(daten.get('volumen')) || 0,
      zone: daten.get('zone'),
      kilometer: Number(daten.get('kilometer')) || 0,
      abfallarten: daten.getAll('abfallarten'),
      zusatzkosten: Number(daten.get('zusatzkosten')) || 0,
      // Kundendaten (nur fürs PDF)
      kundenname: (daten.get('kundenname') || '').trim(),
      adresse: (daten.get('adresse') || '').trim(),
      telefon: (daten.get('telefon') || '').trim(),
      // aus der Website-Anfrage, nicht aus dem Formular
      referenz: referenz,
      screenshot: (screenshotDatenUrl && bildInsPdf.checked) ? screenshotDatenUrl : null,
    };
  }

  /* ---------------------------------------------------------------------------
   * Prüfung — je Auftragsart sind andere Felder Pflicht.
   * Kundendaten sind nie Pflicht, die braucht nur das PDF.
   * ------------------------------------------------------------------------ */
  function zeigeFehler(feldName, text) {
    const meldung = document.querySelector('[data-fehler-fuer="' + feldName + '"]');
    const feld = document.getElementById(feldName);
    if (meldung) {
      meldung.textContent = text;
      meldung.hidden = !text;
    }
    if (feld) {
      if (text) feld.setAttribute('aria-invalid', 'true');
      else feld.removeAttribute('aria-invalid');
    }
  }

  function pruefe(eingaben) {
    let ersterFehler = null;

    function pruefeFeld(name, bedingung, text) {
      if (bedingung) {
        zeigeFehler(name, text);
        ersterFehler = ersterFehler || name;
      } else {
        zeigeFehler(name, '');
      }
    }

    if (aktuellesModell() === 'flaeche') {
      pruefeFeld('wohnflaeche',
        !eingaben.wohnflaeche || eingaben.wohnflaeche < 1,
        'Bitte die Wohnfläche in m² eintragen.');
      pruefeFeld('zimmer',
        !eingaben.zimmer || eingaben.zimmer < 1,
        'Bitte die Anzahl der Zimmer eintragen.');
    } else {
      pruefeFeld('dauer',
        !eingaben.dauer || eingaben.dauer <= 0,
        'Bitte schätzen, wie lange die Arbeit dauert.');
    }

    if (eingaben.zone === 'zone4') {
      pruefeFeld('kilometer',
        !eingaben.kilometer || eingaben.kilometer <= 0,
        'Bitte die Entfernung in Kilometern angeben.');
    } else {
      zeigeFehler('kilometer', '');
    }

    if (ersterFehler) {
      const feld = document.getElementById(ersterFehler);
      if (feld) {
        feld.focus();
        feld.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      return false;
    }
    return true;
  }

  /* ---------------------------------------------------------------------------
   * Aufschlüsselung rendern
   * ------------------------------------------------------------------------ */
  function zeile(bezeichnung, wert, istSumme) {
    const li = document.createElement('li');
    if (istSumme) li.className = 'summe';
    const links = document.createElement('span');
    links.textContent = bezeichnung;
    const rechts = document.createElement('span');
    rechts.textContent = wert;
    li.append(links, rechts);
    return li;
  }

  function zeigeAufschluesselung(ergebnis) {
    aufschluesselungListe.replaceChildren();
    ergebnis.positionen.forEach(function (pos) {
      aufschluesselungListe.append(zeile(pos.label, formatEuroCent(pos.betrag)));
    });
    aufschluesselungListe.append(
      zeile('Interner Richtwert', formatEuroCent(ergebnis.kalkulationspreis), true));
    aufschluesselungListe.append(
      zeile('Kundenspanne (±20 %)',
        formatZahl(ergebnis.spanneVon) + '–' + formatEuro(ergebnis.spanneBis), true));
  }

  /* ---------------------------------------------------------------------------
   * Absenden
   * ------------------------------------------------------------------------ */
  formular.addEventListener('submit', function (event) {
    event.preventDefault();

    const eingaben = leseFormular();
    if (!pruefe(eingaben)) return;

    letzteEingaben = eingaben;
    letztesErgebnis = berechnePreis(eingaben);

    ergebnisArt.textContent = letztesErgebnis.auftragsartLabel;
    ergebnisReferenz.textContent = referenz ? 'Anfrage ' + referenz : '';
    ergebnisReferenz.hidden = !referenz;
    preisAnzeige.textContent = letztesErgebnis.spanneText;
    // exakter Kalkulationspreis — nur intern, steht nicht im PDF
    richtwertAnzeige.textContent = formatEuroCent(letztesErgebnis.kalkulationspreis);

    planStunden.textContent = formatStunden(letztesErgebnis.personenstunden);
    planDauerLabel.textContent = 'Dauer vor Ort (' + letztesErgebnis.personen + ' Pers.)';
    planDauer.textContent = formatStunden(letztesErgebnis.dauerVorOrt);
    planSlot.textContent = letztesErgebnis.zeitslotText;
    if (letztesErgebnis.fahrten > 0) {
      planFahrten.textContent = letztesErgebnis.fahrten + ' \u00d7 (' +
        formatStunden(PREISE.transport.stundenProFahrt) + ')';
      document.getElementById('plan-fahrten-label').textContent =
        'Fahrten für ' + formatVolumen(letztesErgebnis.volumen) +
        ' (' + letztesErgebnis.volumenHerkunft + ')';
    } else {
      planFahrten.textContent = 'keine';
      document.getElementById('plan-fahrten-label').textContent = 'Fahrten zur Entsorgung';
    }

    zeigeAufschluesselung(letztesErgebnis);

    pdfFehler.hidden = true;
    ergebnisBereich.hidden = false;
    ergebnisBereich.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------------------------------------------------------------------------
   * Auftragsart wechseln
   * ------------------------------------------------------------------------ */
  zoneAuswahl.addEventListener('change', function () {
    zeigeKilometerfeld();
    ergebnisBereich.hidden = true;
    letztesErgebnis = null;
  });

  artAuswahl.addEventListener('change', function () {
    zeigePassendeFelder();
    ergebnisBereich.hidden = true;
    letztesErgebnis = null;
  });

  /* ---------------------------------------------------------------------------
   * Ergebnis verstecken, sobald eine Eingabe geändert wird
   * (sonst steht dort eine Zahl, die nicht mehr zu den Feldern passt)
   * ------------------------------------------------------------------------ */
  formular.addEventListener('input', function () {
    if (!ergebnisBereich.hidden) {
      ergebnisBereich.hidden = true;
      letztesErgebnis = null;
    }
  });

  /* ---------------------------------------------------------------------------
   * Anfrage aus der Website übernehmen
   * ------------------------------------------------------------------------ */

  /** Setzt ein Feld und hebt es kurz hervor, damit man sieht, was sich ändert. */
  function setzeFeld(id, wert) {
    const feld = document.getElementById(id);
    if (!feld || wert === undefined || wert === null || wert === '') return;
    feld.value = wert;
    feld.classList.add('uebernommen');
  }

  function setzeRadio(name, wert) {
    const feld = document.querySelector('input[name="' + name + '"][value="' + wert + '"]');
    if (feld) feld.checked = true;
  }

  function berichtAbschnitt(titel, zeilen, klasse) {
    if (!zeilen.length) return null;
    const block = document.createElement('div');
    block.className = 'bericht-block ' + klasse;
    const h = document.createElement('p');
    h.className = 'bericht-titel';
    h.textContent = titel;
    const ul = document.createElement('ul');
    zeilen.forEach(function (zeile) {
      const li = document.createElement('li');
      li.textContent = zeile;
      ul.append(li);
    });
    block.append(h, ul);
    return block;
  }

  importKnopf.addEventListener('click', function () {
    const text = importText.value.trim();
    importBericht.replaceChildren();

    if (!text) {
      importBericht.append(berichtAbschnitt('Nichts einzufügen',
        ['Bitte zuerst den Text der Benachrichtigungsmail einfügen.'], 'bericht-warnung'));
      importBericht.hidden = false;
      return;
    }

    // frühere Hervorhebungen zurücksetzen
    document.querySelectorAll('.uebernommen').forEach(function (f) {
      f.classList.remove('uebernommen');
    });

    const ergebnis = leseAnfrage(text);
    const f = ergebnis.felder;

    referenz = f.referenz || '';

    if (f.auftragsart) {
      artAuswahl.value = f.auftragsart;
      artAuswahl.classList.add('uebernommen');
      zeigePassendeFelder();
    }
    if (f.zone) {
      zoneAuswahl.value = f.zone;
      zoneAuswahl.classList.add('uebernommen');
      zeigeKilometerfeld();
    }

    setzeFeld('wohnflaeche', f.wohnflaeche);
    setzeFeld('zimmer', f.zimmer);
    setzeFeld('volumen', f.volumen);
    setzeFeld('etage', f.etage);
    setzeFeld('beschreibung', f.beschreibung);
    setzeFeld('kundenname', f.kundenname);
    setzeFeld('adresse', f.adresse);
    setzeFeld('telefon', f.telefon);

    if (f.vermuellungsgrad) setzeRadio('vermuellungsgrad', f.vermuellungsgrad);
    if (typeof f.aufzug === 'boolean') setzeRadio('aufzug', f.aufzug ? 'ja' : 'nein');
    if (f.abfallarten) {
      document.querySelectorAll('input[name="abfallarten"]').forEach(function (box) {
        box.checked = f.abfallarten.indexOf(box.value) !== -1;
      });
    }

    const uebernommen = berichtAbschnitt('Übernommen', ergebnis.notizen, 'bericht-ok');
    const pruefen = berichtAbschnitt('Bitte prüfen', ergebnis.warnungen, 'bericht-warnung');
    if (uebernommen) importBericht.append(uebernommen);
    if (pruefen) importBericht.append(pruefen);
    importBericht.hidden = false;

    // Ergebnis verwerfen, das Formular hat sich geändert
    ergebnisBereich.hidden = true;
    letztesErgebnis = null;
  });

  /* ---------------------------------------------------------------------------
   * Screenshot als Beleg
   * -----------------------------------------------------------------------------
   * Wird auf 1000 px verkleinert und als JPEG gespeichert, sonst bläht ein
   * Handy-Screenshot das PDF auf mehrere Megabyte auf. Bleibt im
   * Arbeitsspeicher, wird nirgendwo hochgeladen.
   * ------------------------------------------------------------------------ */
  bildEingabe.addEventListener('change', function () {
    const datei = bildEingabe.files && bildEingabe.files[0];
    if (!datei) return;

    const leser = new FileReader();
    leser.onload = function () {
      const bild = new Image();
      bild.onload = function () {
        const maxBreite = 1000;
        const faktor = Math.min(1, maxBreite / bild.width);
        const leinwand = document.createElement('canvas');
        leinwand.width = Math.round(bild.width * faktor);
        leinwand.height = Math.round(bild.height * faktor);
        const stift = leinwand.getContext('2d');
        // weißer Grund, damit dunkle Screenshots im PDF nicht ausfransen
        stift.fillStyle = '#ffffff';
        stift.fillRect(0, 0, leinwand.width, leinwand.height);
        stift.drawImage(bild, 0, 0, leinwand.width, leinwand.height);
        screenshotDatenUrl = leinwand.toDataURL('image/jpeg', 0.85);
        bildAnzeige.src = screenshotDatenUrl;
        bildVorschau.hidden = false;
      };
      bild.onerror = function () {
        importBericht.replaceChildren(berichtAbschnitt('Bild nicht lesbar',
          ['Die Datei konnte nicht geöffnet werden. Bitte ein anderes Bild wählen.'],
          'bericht-warnung'));
        importBericht.hidden = false;
      };
      bild.src = leser.result;
    };
    leser.readAsDataURL(datei);
  });

  bildEntfernen.addEventListener('click', function () {
    screenshotDatenUrl = null;
    bildEingabe.value = '';
    bildInsPdf.checked = false;
    bildAnzeige.removeAttribute('src');
    bildVorschau.hidden = true;
  });

  /* ---------------------------------------------------------------------------
   * PDF-Knopf
   * ------------------------------------------------------------------------ */
  pdfKnopf.addEventListener('click', function () {
    if (!letztesErgebnis) return;
    pdfFehler.hidden = true;
    try {
      erstellePDF(letzteEingaben, letztesErgebnis);
    } catch (fehler) {
      pdfFehler.textContent =
        'Das PDF konnte nicht erstellt werden. Bitte Internetverbindung prüfen ' +
        'und die Seite neu laden – oder die Seite über das Browser-Menü drucken.';
      pdfFehler.hidden = false;
      console.error(fehler);
    }
  });

  /* ---------------------------------------------------------------------------
   * Nächste Kalkulation
   * ------------------------------------------------------------------------ */
  neuKnopf.addEventListener('click', function () {
    ergebnisBereich.hidden = true;
    letztesErgebnis = null;
    formular.reset();
    referenz = '';
    ergebnisReferenz.hidden = true;
    importText.value = '';
    importBericht.hidden = true;
    importBericht.replaceChildren();
    if (importKarte) importKarte.open = false;
    document.querySelectorAll('.uebernommen').forEach(function (f) {
      f.classList.remove('uebernommen');
    });
    ['wohnflaeche', 'zimmer', 'dauer', 'kilometer'].forEach(function (n) { zeigeFehler(n, ''); });
    zeigePassendeFelder();
    zeigeKilometerfeld();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    artAuswahl.focus();
  });

  // Startzustand herstellen
  zeigePassendeFelder();
  zeigeKilometerfeld();
})();
