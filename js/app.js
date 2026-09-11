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
  const aufschluesselungListe = document.getElementById('aufschluesselung');
  const pdfKnopf = document.getElementById('pdf-knopf');
  const pdfFehler = document.getElementById('pdf-fehler');
  const neuKnopf = document.getElementById('neu-knopf');

  // Letzte Kalkulation, damit der PDF-Knopf sie verwenden kann.
  // Bleibt nur im Arbeitsspeicher — nichts wird gespeichert oder gesendet.
  let letzteEingaben = null;
  let letztesErgebnis = null;

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

  function zeigePassendeFelder() {
    const modell = aktuellesModell();
    document.querySelectorAll('[data-modell]').forEach(function (gruppe) {
      gruppe.hidden = gruppe.dataset.modell !== modell;
    });
    artHinweis.textContent = ART_HINWEISE[artAuswahl.value] || '';
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
      entsorgung: daten.getAll('entsorgung'),
      // Kundendaten (nur fürs PDF)
      kundenname: (daten.get('kundenname') || '').trim(),
      adresse: (daten.get('adresse') || '').trim(),
      telefon: (daten.get('telefon') || '').trim(),
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
    preisAnzeige.textContent = letztesErgebnis.spanneText;
    // exakter Kalkulationspreis — nur intern, steht nicht im PDF
    richtwertAnzeige.textContent = formatEuroCent(letztesErgebnis.kalkulationspreis);

    planStunden.textContent = formatStunden(letztesErgebnis.personenstunden);
    planDauerLabel.textContent = 'Dauer vor Ort (' + letztesErgebnis.personen + ' Pers.)';
    planDauer.textContent = formatStunden(letztesErgebnis.dauerVorOrt);
    planSlot.textContent = letztesErgebnis.zeitslotText;

    zeigeAufschluesselung(letztesErgebnis);

    pdfFehler.hidden = true;
    ergebnisBereich.hidden = false;
    ergebnisBereich.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------------------------------------------------------------------------
   * Auftragsart wechseln
   * ------------------------------------------------------------------------ */
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
    ['wohnflaeche', 'zimmer', 'dauer'].forEach(function (n) { zeigeFehler(n, ''); });
    zeigePassendeFelder();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    artAuswahl.focus();
  });

  // Startzustand herstellen
  zeigePassendeFelder();
})();
