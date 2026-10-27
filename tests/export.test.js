/**
 * Tests für den Blitzangebot-Text.
 *
 * Lauf: node --test   (findet tests/ von selbst)
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { ladeBrowserDateien, fixture } = require("./laden.js");

const G = ladeBrowserDateien(
  ["js/pricing.js", "js/import.js", "js/export.js"],
  [
    "PREISE", "LABELS", "berechnePreis", "leseAnfrage",
    "baueBlitzangebotText", "BLITZANGEBOT_POSITIONEN",
  ],
);

/**
 * Die Positionen, wie sie in pricebook-templates.ts von Blitzangebot stehen
 * (GEWERK_TEMPLATES, Gewerke "entruempelung" und "garten").
 *
 * Hier bewusst noch einmal abgeschrieben statt aus dem Produktivcode gelesen:
 * Würde der Test dieselbe Quelle benutzen, fiele ein Tippfehler darin nicht
 * auf. Weichen die beiden Listen voneinander ab, ist eine davon falsch – und
 * genau das soll auffallen.
 */
const AUS_BLITZANGEBOT = {
  entruempelung: [
    ["Entrümpelung / Haushaltsauflösung pauschal", "pausch."],
    ["Entrümpelung nach Volumen", "m³"],
    ["Container-Stellung und Abfuhr", "Stk"],
    ["Sperrmüll / Mischabfall entsorgen", "m³"],
    ["Elektrogroßgeräte fachgerecht entsorgen", "Stk"],
    ["Möbel und Einrichtung demontieren", "pausch."],
    ["Einbauküche demontieren", "pausch."],
    ["Sondermüll / Farben / Chemie entsorgen", "pausch."],
    ["Teppich / Bodenbelag entfernen", "m²"],
    ["Besenreine Übergabe / Endreinigung", "pausch."],
    ["Trage- / Etagenzuschlag", "pausch."],
    ["Helfer Arbeitszeit", "Std"],
    ["An- und Abfahrt", "pausch."],
  ],
  garten: [
    ["Rasen mähen / Rasenpflege", "m²"],
    ["Rasen neu anlegen (säen / Rollrasen)", "m²"],
    ["Heckenschnitt inkl. Abfuhr", "lfm"],
    ["Baum- / Strauchschnitt", "Stk"],
    ["Baum fällen / roden", "Stk"],
    ["Beet anlegen / bepflanzen", "m²"],
    ["Pflaster- / Wegebau inkl. Unterbau", "m²"],
    ["Terrasse anlegen", "m²"],
    ["Zaun setzen inkl. Pfosten", "lfm"],
    ["Bewässerungssystem installieren", "pausch."],
    ["Vertikutieren", "m²"],
    ["Laub- / Grünschnitt entsorgen", "m³"],
    ["Gärtner / Helfer Arbeitszeit", "Std"],
    ["An- und Abfahrt", "pausch."],
  ],
};

function eingabenAus(felder, extra = {}) {
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
      referenz: felder.referenz || "",
      adresse: felder.adresse || "",
      gartenArbeiten: felder.gartenArbeiten || [],
      gartenGroesse: felder.gartenGroesse || "",
      gartenZustand: felder.gartenZustand || "",
    },
    extra,
  );
}

/** Erzeugt den Text zu einer Beispielmail. */
function textZu(datei, extra = {}) {
  const felder = G.leseAnfrage(fixture(datei)).felder;
  const eingaben = eingabenAus(felder, extra);
  return G.baueBlitzangebotText(eingaben, G.berechnePreis(eingaben));
}

/* =========================================================================
 * Die Tabelle muss zu Blitzangebot passen
 * ====================================================================== */

test("jede verwendete Position steht so in pricebook-templates.ts", () => {
  const paare = [
    ["entruempelung", G.BLITZANGEBOT_POSITIONEN.entruempelung],
    ["garten", G.BLITZANGEBOT_POSITIONEN.garten],
  ];
  for (const [gewerk, tabelle] of paare) {
    const erlaubt = AUS_BLITZANGEBOT[gewerk];
    for (const [schluessel, position] of Object.entries(tabelle)) {
      if (schluessel === "gewerk") continue;
      const treffer = erlaubt.find((p) => p[0] === position.bezeichnung);
      assert.ok(
        treffer,
        `${gewerk}.${schluessel}: „${position.bezeichnung}" gibt es dort nicht`,
      );
      assert.equal(
        position.einheit, treffer[1],
        `${gewerk}.${schluessel}: Einheit weicht ab`,
      );
    }
  }
});

test("die Gewerk-Bezeichnungen sind die von Blitzangebot", () => {
  assert.equal(G.BLITZANGEBOT_POSITIONEN.entruempelung.gewerk, "Entrümpelung / Entsorgung");
  assert.equal(G.BLITZANGEBOT_POSITIONEN.garten.gewerk, "Garten & Landschaft");
});

/* =========================================================================
 * Keine Preise, keine Kundendaten
 * ====================================================================== */

test("im Text steht kein Preis und kein Betrag", () => {
  for (const datei of [
    "1-wohnung-gross.txt", "2-wohnung-mittel.txt", "3-haus-ohne-zimmer.txt",
    "5-alte-mail-ohne-bereich.txt", "6-rechner-daten.txt",
  ]) {
    const text = textZu(datei);
    assert.ok(!/€/.test(text), datei + ": Euro-Zeichen im Text");
    assert.ok(!/EUR/.test(text), datei + ": EUR im Text");
    assert.ok(!/\bVB\b/.test(text), datei + ": Preisspanne im Text");
    assert.ok(!/Richtwert|Stundensatz|Pauschale/i.test(text), datei + ": Preisbegriff im Text");
    // Keine Zahl mit Nachkommastellen in Geldform (1.353,20)
    assert.ok(!/\d+[.,]\d{2}\b/.test(text), datei + ": sieht nach Betrag aus");
  }
});

test("von den Kundendaten steht nur der Ort im Text", () => {
  const felder = G.leseAnfrage(fixture("1-wohnung-gross.txt")).felder;
  const text = textZu("1-wohnung-gross.txt");
  assert.ok(text.includes("Stöckheim"), "der Ort gehört hinein");
  assert.ok(!text.includes(felder.kundenname), "Name gehört nicht hinein");
  assert.ok(!text.includes(felder.telefon), "Telefonnummer gehört nicht hinein");
});

/* =========================================================================
 * Aufbau des Textes
 * ====================================================================== */

test("Fixture 1: Kopfzeile, Posten und Einheiten", () => {
  const text = textZu("1-wohnung-gross.txt");
  const zeilen = text.split("\n");

  assert.equal(zeilen[0], "Entrümpelung / Entsorgung — Anfrage A-261027-TEST1 — Stöckheim");
  assert.ok(text.includes("- Entrümpelung nach Volumen: 32 m³"), text);
  assert.ok(text.includes("- Helfer Arbeitszeit: 19 Std (2 Personen, Fahrzeit enthalten)"), text);
  assert.ok(text.includes("- Trage- / Etagenzuschlag: 1 pausch. (3. Etage, ohne Aufzug)"), text);
  assert.ok(text.includes("- Elektrogroßgeräte fachgerecht entsorgen: ? Stk"), text);
  assert.ok(text.includes("- An- und Abfahrt: 1 pausch."), text);
});

test("Fixture 1: Annahmen nennen Spanne, Füllgrad und den Schätzvorbehalt", () => {
  const text = textZu("1-wohnung-gross.txt");
  const annahmen = text.split("\n").find((z) => z.startsWith("Annahmen:"));
  assert.ok(annahmen, "Annahmen-Zeile fehlt");
  assert.ok(annahmen.includes("22–42 m³"), annahmen);
  assert.ok(annahmen.includes("Füllgrad Stark"), annahmen);
  assert.ok(annahmen.includes("2 Personen"), annahmen);
  assert.ok(annahmen.includes("vor der Besichtigung geschätzt"), annahmen);
});

test("Annahmen nennen die gerechnete Menge, nicht die gerundete", () => {
  const text = textZu("3-haus-ohne-zimmer.txt");
  const annahmen = text.split("\n").find((z) => z.startsWith("Annahmen:"));
  assert.ok(annahmen.includes("gerechnet mit 25,5 m³"), annahmen);
  assert.ok(text.includes("- Entrümpelung nach Volumen: 26 m³"), "Position rundet auf ganze m³");
});

test("Fahrten stehen als Hinweis, nicht als Container-Position", () => {
  const text = textZu("1-wohnung-gross.txt");
  assert.ok(!text.includes("Container-Stellung"), "eigene Fahrten sind keine Containerstellung");
  const hinweis = text.split("\n").find((z) => z.startsWith("Hinweis:") && z.includes("Fahrten"));
  assert.ok(hinweis, "die Zahl der Fahrten gehört in einen Hinweis");
  assert.ok(hinweis.includes("8 Fahrten"), hinweis);
});

test("Sondermüll erscheint, Elektro nur wenn angekreuzt", () => {
  const drei = textZu("3-haus-ohne-zimmer.txt");
  assert.ok(drei.includes("- Sondermüll / Farben / Chemie entsorgen: 1 pausch."));
  assert.ok(!drei.includes("Elektrogroßgeräte"), "in Fixture 3 nicht angekreuzt");

  const eins = textZu("1-wohnung-gross.txt");
  assert.ok(eins.includes("Elektrogroßgeräte"));
  assert.ok(!eins.includes("Sondermüll"), "in Fixture 1 nicht angekreuzt");
});

test("Ohne Etagenzuschlag fehlt die Zeile", () => {
  const text = textZu("3-haus-ohne-zimmer.txt");
  assert.ok(!text.includes("Trage- / Etagenzuschlag"), "Erdgeschoss: kein Zuschlag");
});

/* =========================================================================
 * Garten
 * ====================================================================== */

test("Garten ohne eingetragene Dauer nennt keine Arbeitszeit", () => {
  const text = textZu("4-garten.txt");
  assert.equal(text.split("\n")[0].startsWith("Garten & Landschaft"), true, text);
  assert.ok(!text.includes("Gärtner / Helfer Arbeitszeit"), "ohne Dauer keine Stundenzahl");
  assert.ok(
    text.includes("Hinweis: Arbeitszeit steht noch nicht fest"),
    "dafür ein Hinweis statt einer 0",
  );
  assert.ok(text.includes("- An- und Abfahrt: 1 pausch."));
});

test("Garten mit Dauer nennt die Arbeitszeit in Std", () => {
  const text = textZu("4-garten.txt", { dauer: 4, personen: 2 });
  assert.ok(text.includes("- Gärtner / Helfer Arbeitszeit: 8 Std (2 Personen)"), text);
});

test("Grünschnitt braucht ein Volumen, sonst Hinweis", () => {
  const ohne = textZu("4-garten.txt", { dauer: 4 });
  assert.ok(!ohne.includes("Laub- / Grünschnitt entsorgen"), "ohne Menge keine Position");
  assert.ok(ohne.includes("Hinweis: Grünschnitt soll mit"), ohne);

  const mit = textZu("4-garten.txt", { dauer: 4, volumen: 6 });
  assert.ok(mit.includes("- Laub- / Grünschnitt entsorgen: 6 m³"), mit);
});

/* =========================================================================
 * Entrümpelung ohne Grundlage
 * ====================================================================== */

test("Ohne Volumen fehlt die Hauptposition und es steht ein Hinweis", () => {
  const text = G.baueBlitzangebotText(
    eingabenAus({ auftragsart: "entruempelung" }),
    G.berechnePreis(eingabenAus({ auftragsart: "entruempelung" })),
  );
  assert.ok(!text.includes("- Entrümpelung nach Volumen"), text);
  assert.ok(text.includes("Hinweis: Kein Volumen ermittelt"), text);
});
