/* =============================================================================
 * app.js — Formular auslesen, prüfen, Ergebnis anzeigen
 * Nutzt berechnePreis() aus pricing.js und erstellePDF() aus pdf.js.
 * ========================================================================== */

(function () {
  'use strict';

  const formular = document.getElementById('rechner-formular');
  const ergebnisBereich = document.getElementById('ergebnis');
  const preisAnzeige = document.getElementById('preis-anzeige');
  const richtwertAnzeige = document.getElementById('richtwert-anzeige');
  const aufschluesselungListe = document.getElementById('aufschluesselung');
  const pdfKnopf = document.getElementById('pdf-knopf');
  const pdfFehler = document.getElementById('pdf-fehler');
  const neuKnopf = document.getElementById('neu-knopf');

  // Letztes Ergebnis zwischenspeichern, damit der PDF-Knopf es verwenden kann.
  // Bleibt nur im Arbeitsspeicher — nichts wird gespeichert oder gesendet.
  let letzteEingaben = null;
  let letztesErgebnis = null;

  /* ---------------------------------------------------------------------------
   * Formular auslesen
   * ------------------------------------------------------------------------ */
  function leseFormular() {
    const daten = new FormData(formular);
    return {
      wohnflaeche: Number(daten.get('wohnflaeche')),
      zimmer: Number(daten.get('zimmer')),
      etage: daten.get('etage'),
      aufzug: daten.get('aufzug') === 'ja',
      vermuellungsgrad: daten.get('vermuellungsgrad'),
      kellerabteil: daten.get('kellerabteil') === 'ja',
      gegenstaende: daten.getAll('gegenstaende'),
      kundenname: (daten.get('kundenname') || '').trim(),
      adresse: (daten.get('adresse') || '').trim(),
      telefon: (daten.get('telefon') || '').trim(),
    };
  }

  /* ---------------------------------------------------------------------------
   * Prüfung der Pflichtfelder (nur Wohnfläche und Zimmer sind Pflicht —
   * die Kontaktdaten braucht nur das PDF und dürfen leer bleiben)
   * ------------------------------------------------------------------------ */
  function zeigeFehler(feldName, text) {
    const meldung = document.querySelector('[data-fehler-fuer="' + feldName + '"]');
    const feld = document.getElementById(feldName);
    if (meldung) {
      meldung.textContent = text;
      meldung.hidden = !text;
    }
    if (feld) {
      if (text) {
        feld.setAttribute('aria-invalid', 'true');
      } else {
        feld.removeAttribute('aria-invalid');
      }
    }
  }

  function pruefe(eingaben) {
    let ersterFehler = null;

    if (!eingaben.wohnflaeche || eingaben.wohnflaeche < 1) {
      zeigeFehler('wohnflaeche', 'Bitte die Wohnfläche in m² eintragen.');
      ersterFehler = ersterFehler || 'wohnflaeche';
    } else if (eingaben.wohnflaeche > 2000) {
      zeigeFehler('wohnflaeche', 'Bitte rufen Sie uns an – das rechnen wir persönlich.');
      ersterFehler = ersterFehler || 'wohnflaeche';
    } else {
      zeigeFehler('wohnflaeche', '');
    }

    if (!eingaben.zimmer || eingaben.zimmer < 1) {
      zeigeFehler('zimmer', 'Bitte die Anzahl der Zimmer eintragen.');
      ersterFehler = ersterFehler || 'zimmer';
    } else {
      zeigeFehler('zimmer', '');
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
   * Aufschlüsselung als Liste rendern
   * ------------------------------------------------------------------------ */
  function zeile(bezeichnung, betragText, istSumme) {
    const li = document.createElement('li');
    if (istSumme) li.className = 'summe';
    const links = document.createElement('span');
    links.textContent = bezeichnung;
    const rechts = document.createElement('span');
    rechts.textContent = betragText;
    li.append(links, rechts);
    return li;
  }

  function zeigeAufschluesselung(ergebnis) {
    const a = ergebnis.aufschluesselung;
    aufschluesselungListe.replaceChildren();

    aufschluesselungListe.append(zeile('Grundpauschale', formatEuroCent(a.grundpauschale)));
    aufschluesselungListe.append(zeile(
      'Wohnfläche (' + formatZahl(letzteEingaben.wohnflaeche) + ' m² × ' + formatEuroCent(PREISE.proQuadratmeter) + ')',
      formatEuroCent(a.flaechenpreis)
    ));

    if (a.vermuellungsZuschlag > 0) {
      aufschluesselungListe.append(zeile(
        'Aufwand ' + LABELS.vermuellung[a.vermuellungsgrad] + ' (×' + String(a.vermuellungsMultiplikator).replace('.', ',') + ')',
        '+ ' + formatEuroCent(a.vermuellungsZuschlag)
      ));
    }

    if (a.kellerZuschlag > 0) {
      aufschluesselungListe.append(zeile('Kellerabteil', '+ ' + formatEuroCent(a.kellerZuschlag)));
    }

    a.gegenstaendePositionen.forEach(function (pos) {
      aufschluesselungListe.append(zeile(pos.label, '+ ' + formatEuroCent(pos.betrag)));
    });

    if (a.etagenZuschlag > 0) {
      aufschluesselungListe.append(zeile(
        'Kein Aufzug, ' + a.etagenUeberEG + '. Etage (+' + a.etagenAufschlagProzent + ' %)',
        '+ ' + formatEuroCent(a.etagenZuschlag)
      ));
    }

    aufschluesselungListe.append(zeile('Kalkulierter Richtwert', formatEuroCent(ergebnis.kalkulationspreis), true));
    aufschluesselungListe.append(zeile(
      'Angezeigte Spanne (±20 %)',
      formatZahl(ergebnis.spanneVon) + '–' + formatEuro(ergebnis.spanneBis),
      true
    ));
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

    preisAnzeige.textContent = letztesErgebnis.spanneText;
    // exakter Kalkulationspreis — nur intern, steht nicht im PDF
    richtwertAnzeige.textContent = formatEuroCent(letztesErgebnis.kalkulationspreis);
    zeigeAufschluesselung(letztesErgebnis);

    pdfFehler.hidden = true;
    ergebnisBereich.hidden = false;
    ergebnisBereich.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------------------------------------------------------------------------
   * Ergebnis verstecken, sobald jemand eine Eingabe ändert
   * (sonst steht oben eine Preisspanne, die nicht mehr zu den Feldern passt)
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
        'Das PDF konnte nicht erstellt werden. Bitte prüfen Sie Ihre Internetverbindung ' +
        'und laden die Seite neu – oder drucken Sie die Seite über das Browser-Menü.';
      pdfFehler.hidden = false;
      console.error(fehler);
    }
  });

  /* ---------------------------------------------------------------------------
   * Neu berechnen
   * ------------------------------------------------------------------------ */
  neuKnopf.addEventListener('click', function () {
    ergebnisBereich.hidden = true;
    letztesErgebnis = null;
    formular.reset();
    zeigeFehler('wohnflaeche', '');
    zeigeFehler('zimmer', '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('wohnflaeche').focus();
  });
})();
