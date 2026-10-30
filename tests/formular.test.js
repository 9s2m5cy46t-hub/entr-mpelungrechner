/**
 * Der Weg Mail → Formular → Ergebnis, mit dem echten index.html und app.js.
 * Gerechnet wird nur, was im Formular ankommt – genau das prüft import.test.js
 * nicht.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { fixture } = require("./laden.js");
const { ladeSeite } = require("./dom-attrappe.js");

function importiert(name) {
  const seite = ladeSeite();
  seite.importiere(fixture(name));
  return seite;
}

function ergebnis(seite) {
  seite.rechne();
  assert.equal(seite.feld("ergebnis").hidden, false, "es muss ein Ergebnis geben");
  return {
    richtwert: seite.feld("richtwert-anzeige").textContent,
    spanne: seite.feld("preis-anzeige").textContent,
    spannenZeile: seite.feld("aufschluesselung").kinder.at(-1).text,
  };
}

test("Fixture 1 im Formular: 2 Personen, Handrechnung stimmt", () => {
  const seite = importiert("1-wohnung-gross.txt");
  assert.equal(seite.feld("personen").value, "2");
  assert.equal(seite.feld("etage").value, "3");
  assert.equal(seite.feld("volumen").value, "32");
  const r = ergebnis(seite);
  assert.equal(r.richtwert, "1.353,20 €");
  assert.equal(r.spanne, "ca. 1.010–1.790 € VB");
});

test("ALLEIN kommt als 1 Person im Formular an, nicht als Vorbelegung 2", () => {
  const seite = importiert("2-wohnung-mittel.txt");
  assert.equal(seite.feld("personen").value, "1");
  assert.equal(ergebnis(seite).richtwert, "512,60 €", "80 + 147 + 68,10 Etage + 157,50 Fahrzeit + 60");

  const alt = importiert("5-alte-mail-ohne-bereich.txt");
  assert.equal(alt.feld("personen").value, "1");
  assert.equal(ergebnis(alt).richtwert, "358,63 €");
});

test("Fixture 3 rechnet ohne Fläche und Zimmer", () => {
  assert.equal(ergebnis(importiert("3-haus-ohne-zimmer.txt")).richtwert, "1.109,00 €");
});

test("Die Spannen-Zeile nennt die Herkunft richtig", () => {
  const seite = importiert("1-wohnung-gross.txt");
  assert.ok(ergebnis(seite).spannenZeile.includes("aus der Mengenspanne"));

  seite.feld("volumen").value = "30";
  seite.feld("volumen").ausloesen("input");
  const vonHand = ergebnis(seite);
  assert.ok(vonHand.spannenZeile.includes("±20 %"), "von Hand geändert: Spanne verworfen");
  assert.equal(vonHand.spanne, "ca. 1.060–1.590 € VB");
});

test("Eine zweite Mail erbt nichts von der ersten", () => {
  const seite = importiert("1-wohnung-gross.txt");
  seite.importiere(
    "Bereich: Entrümpelung\nName: Beispielperson Folge\nOrt: Melverode\n" +
    "Was: Eine Wohnung\nWie voll: Normal möbliert\nEtage: Erdgeschoss",
  );
  assert.equal(seite.feld("volumen").value, "", "das Volumen der ersten Mail ist weg");
  assert.equal(seite.feld("wohnflaeche").value, "");
  seite.rechne();
  assert.equal(seite.feld("ergebnis").hidden, true, "ohne Grundlage kein Preis");
  assert.ok(seite.feld("import-bericht").text.includes("KEINE GRUNDLAGE"));
});

test("Block-Mail füllt auch die Kundendaten", () => {
  const seite = importiert("6-rechner-daten.txt");
  assert.equal(seite.feld("kundenname").value, "Beispielperson Sechs");
  assert.equal(ergebnis(seite).richtwert, "1.353,20 €");
});

test("Garten: das Formular nennt die fehlenden Zeitwerte auch ohne Auswahl", () => {
  const seite = ladeSeite();
  seite.feld("auftragsart").value = "garten";
  seite.feld("auftragsart").ausloesen("change");
  const kasten = seite.feld("garten-schaetzung");
  assert.equal(kasten.hidden, false);
  assert.ok(kasten.text.includes("Kein Vorschlag möglich"));
  assert.ok(kasten.text.includes("Rasen mähen oder kürzen"));

  const garten = importiert("4-garten.txt");
  assert.ok(garten.feld("garten-schaetzung").text.includes("Rasen mähen oder kürzen"));
  assert.equal(garten.feld("dauer").value, "", "keine erfundene Dauer");
});
