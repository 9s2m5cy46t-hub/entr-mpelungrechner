/**
 * Lädt die Browser-Dateien in einen eigenen Kontext.
 *
 * Die Dateien sind für das <script>-Tag geschrieben: Sie definieren globale
 * Konstanten und Funktionen und kennen kein module.exports. Mit vm bekommt
 * jede Testdatei einen frischen Kontext, in dem genau diese Globalen liegen –
 * ohne die Produktivdateien für Node umzubauen.
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const WURZEL = path.join(__dirname, "..");

/**
 * Lädt die genannten Dateien und gibt die angeforderten Globalen zurück.
 *
 * `const` auf oberster Ebene landet im lexikalischen Scope des Kontexts und
 * nicht am globalen Objekt – deshalb werden die Namen danach mit einem
 * zweiten Skript gezielt herausgereicht. Fehlt einer, schlägt das hier laut
 * fehl, statt still `undefined` zu liefern.
 *
 * @param {string[]} dateien z. B. ["js/pricing.js", "js/import.js"]
 * @param {string[]} namen   welche Globalen gebraucht werden
 * @returns {object} die angeforderten Globalen
 */
function ladeBrowserDateien(dateien, namen) {
  const kontext = vm.createContext({ console, Intl, Math, Number, String, JSON, Array, Object });
  for (const datei of dateien) {
    const quelle = fs.readFileSync(path.join(WURZEL, datei), "utf8");
    vm.runInContext(quelle, kontext, { filename: datei });
  }
  const ausdruck = "({ " + namen.map((n) => `${n}: ${n}`).join(", ") + " })";
  const heraus = vm.runInContext(ausdruck, kontext, { filename: "herausreichen" });
  for (const n of namen) {
    if (heraus[n] === undefined) {
      throw new Error(`"${n}" wurde von ${dateien.join(", ")} nicht definiert`);
    }
  }
  return heraus;
}

/** Liest eine Beispielmail aus tests/fixtures. */
function fixture(name) {
  return fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
}

module.exports = { ladeBrowserDateien, fixture };
