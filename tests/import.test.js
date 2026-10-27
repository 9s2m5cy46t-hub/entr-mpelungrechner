/**
 * Tests für den Mail-Import und die Entrümpelungs-Rechnung.
 *
 * Lauf: node --test tests/
 * Ohne zusätzliche Abhängigkeit – node:test und node:vm reichen.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { ladeBrowserDateien, fixture } = require("./laden.js");

const G = ladeBrowserDateien(
  ["js/pricing.js", "js/import.js"],
  [
    "PREISE", "LABELS", "AUFTRAGSARTEN", "berechnePreis",
    "leseAnfrage", "leseRechnerDaten", "erkenneEtage", "erkenneLeute",
    "erkenneVolumen", "zoneFuerOrt", "formatEuroCent",
  ],
);

/**
 * Arbeit vor Ort, wie der Rechner sie selbst führt – nicht aus
 * Beschriftungen zusammengesucht.
 */
function arbeitsanteil(ergebnis) {
  return ergebnis.arbeitVorEtage;
}

/**
 * Objekte aus dem vm-Kontext haben andere Prototypen als die des Tests;
 * assert.deepEqual vergleicht die mit. Der JSON-Umweg macht daraus
 * gewöhnliche Objekte dieses Realms – verglichen wird weiter der Inhalt.
 */
function rein(wert) {
  return JSON.parse(JSON.stringify(wert));
}

/** Baut aus Import-Feldern das, was das Formular an berechnePreis gibt. */
function alsEingaben(felder, extra = {}) {
  return Object.assign(
    {
      auftragsart: felder.auftragsart || "entruempelung",
      wohnflaeche: felder.wohnflaeche || 0,
      zimmer: felder.zimmer || 0,
      vermuellungsgrad: felder.vermuellungsgrad || "leicht",
      kellerabteil: false,
      volumen: felder.volumen || 0,
      volumenMin: felder.volumenMin || 0,
      volumenMax: felder.volumenMax || 0,
      dauer: 0,
      erschwernis: "einfach",
      material: 0,
      personen: felder.personen || 1,
      etage: felder.etage || "eg",
      aufzug: felder.aufzug === true,
      zone: felder.zone || "zone1",
      abfallarten: felder.abfallarten || [],
      zusatzkosten: 0,
    },
    extra,
  );
}

/* =========================================================================
 * Abgeleitete Konstanten
 * ====================================================================== */

test("Konstanten werden abgeleitet, nicht frei gesetzt", () => {
  const e = G.PREISE.entruempelung;
  assert.equal(e.preisProKubikmeter, e.proQuadratmeter / e.kubikmeterProQuadratmeter);
  assert.equal(e.preisProKubikmeter, 10.5, "3,50 € je m² ÷ 0,333 m³ je m² = 10,50 € je m³");
  assert.equal(e.kubikmeterProPersonenstunde, e.quadratmeterProStunde * e.kubikmeterProQuadratmeter);
  assert.equal(e.kubikmeterProPersonenstunde, 5, "15 m² je Stunde × 0,333 m³ je m² = 5 m³");
});

test("Kontrollrechnung: 60 m² und 20 m³ ergeben dieselbe Arbeit und Zeit", () => {
  const basis = {
    auftragsart: "entruempelung", vermuellungsgrad: "leicht", etage: "eg",
    aufzug: true, personen: 2, zone: "zone1", abfallarten: [], kellerabteil: false,
  };
  const ueberFlaeche = G.berechnePreis({ ...basis, wohnflaeche: 60 });
  const ueberVolumen = G.berechnePreis({ ...basis, wohnflaeche: 0, volumen: 20 });

  assert.equal(arbeitsanteil(ueberFlaeche), 290, "Flächenweg: 80 € + 60 × 3,50 €");
  assert.equal(arbeitsanteil(ueberVolumen), 290, "Volumenweg: 80 € + 20 × 10,50 €");
  assert.equal(ueberFlaeche.arbeitsstunden, 4);
  assert.equal(ueberVolumen.arbeitsstunden, 4);
});

test("Volumenweg rechnet den Vermüllungsgrad nicht ein zweites Mal", () => {
  const basis = {
    auftragsart: "entruempelung", wohnflaeche: 0, volumen: 20, etage: "eg",
    aufzug: true, personen: 1, zone: "zone1", abfallarten: [], kellerabteil: false,
  };
  const leicht = G.berechnePreis({ ...basis, vermuellungsgrad: "leicht" });
  const stark = G.berechnePreis({ ...basis, vermuellungsgrad: "stark" });
  assert.equal(
    arbeitsanteil(leicht), arbeitsanteil(stark),
    "Wer 20 m³ nennt, hat den vollen Schrank schon mitgezählt",
  );
});

test("Posten heißt „Räumvolumen (X m³ × 10,50 €)“", () => {
  const r = G.berechnePreis({
    auftragsart: "entruempelung", wohnflaeche: 0, volumen: 32, vermuellungsgrad: "leicht",
    etage: "eg", aufzug: true, personen: 1, zone: "zone1", abfallarten: [], kellerabteil: false,
  });
  assert.ok(
    r.positionen.some((p) => p.label === "Räumvolumen (32 m³ × 10,50 €)"),
    "gefunden: " + r.positionen.map((p) => p.label).join(" | "),
  );
});

/* =========================================================================
 * Etage, Leute, Volumen
 * ====================================================================== */

test("Etage kommt exakt aus den Chat-Antworten", () => {
  assert.deepEqual(rein(G.erkenneEtage("Erdgeschoss")), { etage: "eg" });

  const zwei = G.erkenneEtage("1. oder 2. Stock, ohne Aufzug");
  assert.equal(zwei.etage, "2", "vorsichtig die teurere der beiden Etagen");
  assert.equal(zwei.hinweis, "1. oder 2. Stock, mit 2 gerechnet");

  const drei = G.erkenneEtage("3. Stock oder höher, ohne Aufzug");
  assert.equal(drei.etage, "3", "NICHT 'hoeher' – das wären 6 Etagen und +90 %");
  assert.equal(drei.warnung, "mindestens 3. Etage, vor Ort prüfen");

  const lift = G.erkenneEtage("Mit Aufzug");
  assert.equal(lift.aufzug, true);
});

test("Stichwortlogik bleibt als Rückfall für fremde Texte", () => {
  assert.equal(G.erkenneEtage("4. OG").etage, "4");
  assert.equal(G.erkenneEtage("Dachgeschoss").etage, "hoeher");
  assert.equal(G.erkenneEtage("völlig unklar"), null);
});

test("Zeile „Leute“ wird zu 1 oder 2 Personen", () => {
  assert.equal(G.erkenneLeute("ALLEIN – Kleiner Auftrag"), 1);
  assert.equal(G.erkenneLeute("ALLEIN MACHBAR – Mittlere Menge"), 1);
  assert.equal(G.erkenneLeute("ZU ZWEIT – Schwerlast dabei"), 2);
  assert.equal(G.erkenneLeute("unklar"), null);
});

test("Volumen wird als Spanne mit Mitte gelesen", () => {
  assert.deepEqual(rein(G.erkenneVolumen("etwa 22–42 m³")), { min: 22, max: 42, mitte: 32 });
  assert.deepEqual(rein(G.erkenneVolumen("18-33 m³")), { min: 18, max: 33, mitte: 25.5 });
  assert.deepEqual(rein(G.erkenneVolumen("20 m³")), { min: 20, max: 20, mitte: 20 });
  assert.equal(G.erkenneVolumen("keine Angabe"), null);
});

/* =========================================================================
 * Fixture 1: Handrechnung zur Gegenprobe
 * ====================================================================== */

test("Fixture 1: Etage, Personen, Volumen-Spanne und Zone", () => {
  const { felder, warnungen } = G.leseAnfrage(fixture("1-wohnung-gross.txt"));
  assert.equal(felder.etage, "3");
  assert.equal(felder.aufzug, false);
  assert.equal(felder.personen, 2);
  assert.equal(felder.volumen, 32);
  assert.equal(felder.volumenMin, 22);
  assert.equal(felder.volumenMax, 42);
  assert.equal(felder.zone, "zone1");
  assert.deepEqual(rein(felder.abfallarten), ["elektroschrott"]);
  assert.ok(warnungen.some((w) => w.includes("mindestens 3. Etage")));
});

test("Fixture 1: Richtwert und Spanne wie von Hand gerechnet", () => {
  const { felder } = G.leseAnfrage(fixture("1-wohnung-gross.txt"));
  const r = G.berechnePreis(alsEingaben(felder));

  /*
   * Von Hand, bei Mitte 32 m³, 2 Personen, Zone 1, 3. Etage ohne Aufzug:
   *   Grundpauschale                          80,00
   *   Räumvolumen 32 × 10,50                 336,00
   *   Fahrzeit 8 Fahrten × 0,75 × 2 × 52,50  630,00
   *   Anlieferung 8 × 15,00                  120,00
   *   Etagenaufschlag 45 % auf (80 + 336)    187,20
   *                                        ---------
   *                                        1.353,20
   */
  assert.equal(r.fahrten, 8);
  assert.equal(r.kalkulationspreis, 1353.2);
  assert.equal(r.spanneHerkunft, "volumenspanne");
  assert.equal(r.spanneVon, 1010, "Preis bei 22 m³, auf 10 € gerundet");
  assert.equal(r.spanneBis, 1790, "Preis bei 42 m³, auf 10 € gerundet");
  assert.ok(
    r.kalkulationspreis > r.spanneVon && r.kalkulationspreis < r.spanneBis,
    "Richtwert ist die Mitte, nicht die Obergrenze",
  );
});

/* =========================================================================
 * Fixtures 2 bis 5
 * ====================================================================== */

test("Fixture 2: 1. oder 2. Stock wird zu Etage 2, ALLEIN zu 1 Person", () => {
  const { felder, notizen } = G.leseAnfrage(fixture("2-wohnung-mittel.txt"));
  assert.equal(felder.etage, "2");
  assert.equal(felder.aufzug, false);
  assert.equal(felder.personen, 1);
  assert.equal(felder.volumen, 14);
  assert.equal(felder.volumenMin, 10);
  assert.equal(felder.volumenMax, 18);
  assert.ok(felder.abfallarten.includes("bauschutt"));
  assert.ok(notizen.some((n) => n.includes("mit 2 gerechnet")));
});

test("Fixture 3: Haus ohne Zimmer – die Arbeit ist NICHT null", () => {
  const { felder, warnungen } = G.leseAnfrage(fixture("3-haus-ohne-zimmer.txt"));
  assert.equal(felder.wohnflaeche, undefined, "die Mail nennt keine Fläche");
  assert.equal(felder.volumen, 25.5, "Mitte aus 18–33 m³");
  assert.equal(felder.zone, "zone3", "Wolfenbüttel");

  const r = G.berechnePreis(alsEingaben(felder));
  const arbeit = arbeitsanteil(r);
  assert.ok(arbeit > G.PREISE.grundpauschale, "nicht nur die Grundpauschale: " + arbeit);
  assert.equal(arbeit, 80 + 25.5 * 10.5, "80 € + 25,5 m³ × 10,50 €");
  assert.ok(r.arbeitsstunden > 0, "ohne Stunden keine Zeitplanung");

  assert.ok(warnungen.some((w) => w.includes("Verwertbares")), "„noch gut“ muss auffallen");
  assert.ok(felder.abfallarten.includes("sondermuell"));
});

test("Fixture 3: Warnung bleibt aus, wenn eine Grundlage da ist", () => {
  const { warnungen } = G.leseAnfrage(fixture("3-haus-ohne-zimmer.txt"));
  assert.ok(
    !warnungen.some((w) => w.includes("KEINE GRUNDLAGE")),
    "mit Volumen ist eine Grundlage vorhanden",
  );
});

test("Entrümpelung ohne Volumen und ohne Fläche wird deutlich angemahnt", () => {
  const ohne = fixture("3-haus-ohne-zimmer.txt").replace(/^Volumen:.*$/m, "");
  const { warnungen } = G.leseAnfrage(ohne);
  assert.ok(warnungen.some((w) => w.includes("KEINE GRUNDLAGE")), warnungen.join(" | "));
});

test("Fixture 4: Garten mit Grünschnitt, ohne erfundenes Volumen", () => {
  const { felder, warnungen } = G.leseAnfrage(fixture("4-garten.txt"));
  assert.equal(felder.auftragsart, "garten");
  assert.deepEqual(rein(felder.gartenArbeiten), ["rasen", "hecke", "gruenschnitt_weg"]);
  assert.equal(felder.gartenGroesse, "mittel");
  assert.equal(felder.gartenZustand, "leicht");
  assert.ok(felder.abfallarten.includes("gruenschnitt"));
  assert.equal(felder.volumen, undefined, "aus „Hecke schneiden“ folgt keine Kubikmeterzahl");
  assert.ok(warnungen.some((w) => w.includes("Volumen des Grünschnitts")));
});

test("Fixture 5: alte Mail ohne Bereich-Zeile gilt als Entrümpelung", () => {
  const { felder } = G.leseAnfrage(fixture("5-alte-mail-ohne-bereich.txt"));
  assert.equal(felder.auftragsart || "entruempelung", "entruempelung");
  assert.equal(felder.etage, "eg");
  assert.equal(felder.personen, 1);
  assert.equal(felder.volumen, 11, "Mitte aus 8–14 m³");
  assert.equal(felder.zone, "zone1", "Rüningen");
});

/* =========================================================================
 * Strukturierter Block
 * ====================================================================== */

test("RECHNER-DATEN v1 wird bevorzugt gelesen", () => {
  const { felder, notizen, warnungen } = G.leseAnfrage(fixture("6-rechner-daten.txt"));
  assert.ok(notizen.some((n) => n.includes("RECHNER-DATEN v1")));
  assert.equal(felder.etage, "3");
  assert.equal(felder.aufzug, false);
  assert.equal(felder.personen, 2);
  assert.equal(felder.volumen, 32);
  assert.equal(felder.volumenMin, 22);
  assert.equal(felder.volumenMax, 42);
  assert.equal(felder.zimmer, 3);
  assert.equal(felder.vermuellungsgrad, "stark");
  assert.equal(felder.zone, "zone1");
  assert.deepEqual(rein(felder.abfallarten), ["elektroschrott"]);
  assert.ok(warnungen.some((w) => w.includes("Schwerlast")));
  assert.ok(warnungen.some((w) => w.includes("mindestens 3. Etage")));
});

test("Block und Textweg kommen beim selben Fall aufs selbe Ergebnis", () => {
  const ausBlock = G.leseAnfrage(fixture("6-rechner-daten.txt")).felder;
  const ausText = G.leseAnfrage(fixture("1-wohnung-gross.txt")).felder;
  const preisBlock = G.berechnePreis(alsEingaben(ausBlock));
  const preisText = G.berechnePreis(alsEingaben(ausText));
  assert.equal(preisBlock.kalkulationspreis, preisText.kalkulationspreis);
  assert.equal(preisBlock.spanneVon, preisText.spanneVon);
  assert.equal(preisBlock.spanneBis, preisText.spanneBis);
});

test("Fehlende Zeilen im Block werden nicht geraten", () => {
  const knapp = [
    "--- RECHNER-DATEN v1 ---",
    "bereich: entruempelung",
    "volumen_m3: 12-20",
    "--- ENDE ---",
  ].join("\n");
  const { felder, warnungen } = G.leseRechnerDaten(knapp);
  assert.equal(felder.etage, undefined, "keine Etage-Zeile, also keine Etage");
  assert.equal(felder.aufzug, undefined);
  assert.equal(felder.personen, undefined);
  assert.equal(felder.vermuellungsgrad, undefined);
  assert.equal(felder.zone, undefined);
  assert.equal(warnungen.length, 0, "fehlende Zeilen sind kein Fehler: " + warnungen.join(" | "));
});

test("Ohne Block greift der Textweg", () => {
  assert.equal(G.leseRechnerDaten(fixture("1-wohnung-gross.txt")), null);
});

/* =========================================================================
 * Garten: keine erfundenen Zahlen
 * ====================================================================== */

test("Garten-Zeitwerte stehen auf null und werden nicht geschätzt", () => {
  const g = G.PREISE.garten;
  const alleNull = [
    ...Object.values(g.basisstunden),
    ...Object.values(g.faktorGroesse),
    ...Object.values(g.faktorZustand),
  ];
  assert.ok(alleNull.every((w) => w === null), "ausgeliefert wird ohne Zahlen");
});

/* =========================================================================
 * Spanne verwerfen
 * ====================================================================== */

test("Ohne Volumen-Spanne gilt wieder ±20 %", () => {
  const { felder } = G.leseAnfrage(fixture("1-wohnung-gross.txt"));
  // So verhält sich der Rechner, nachdem das Volumenfeld von Hand geändert wurde:
  const ohneSpanne = G.berechnePreis(alsEingaben(felder, { volumenMin: 0, volumenMax: 0 }));
  assert.equal(ohneSpanne.spanneHerkunft, "prozent");
  assert.equal(ohneSpanne.spanneVon, Math.round(ohneSpanne.kalkulationspreis * 0.8 / 10) * 10);
  assert.equal(ohneSpanne.spanneBis, Math.round(ohneSpanne.kalkulationspreis * 1.2 / 10) * 10);
});
