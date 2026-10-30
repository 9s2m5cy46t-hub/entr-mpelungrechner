/**
 * Eine kleine Attrappe des Browser-DOM – gerade genug, um das echte index.html
 * einzulesen und das echte js/app.js darauf laufen zu lassen.
 *
 * Wozu: Die Tests in import.test.js gehen an app.js vorbei. Was der Import
 * liefert, aber nie im Formular ankommt, fällt dort nicht auf – gerechnet wird
 * im Browser aber nur, was im Formular steht. Ersetzt keinen Blick in den
 * echten Browser (keine Optik, kein Layout), prüft aber den Weg
 * Mail → Formular → Ergebnis.
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const WURZEL = path.join(__dirname, "..");
const OHNE_ENDE = new Set(["input", "br", "meta", "link", "img", "hr"]);

class Knoten {
  constructor(tag, attribute) {
    this.tag = tag;
    this.attribute = attribute;
    this.kinder = [];
    this.eltern = null;
    this.textContent = "";
    this.hoerer = {};
    this.klassen = new Set((attribute.class || "").split(/\s+/).filter(Boolean));
    this.hidden = "hidden" in attribute;
    this.checked = "checked" in attribute;
    this.dataset = {};
    for (const [name, wert] of Object.entries(attribute)) {
      if (name.startsWith("data-")) {
        const schluessel = name.slice(5).replace(/-(\w)/g, (_, b) => b.toUpperCase());
        this.dataset[schluessel] = wert;
      }
    }
    this.startChecked = this.checked;
    this.wert = attribute.value === undefined ? "" : attribute.value;
    this.classList = {
      add: (k) => this.klassen.add(k),
      remove: (k) => this.klassen.delete(k),
    };
  }

  get id() { return this.attribute.id; }
  get name() { return this.attribute.name; }
  get type() { return this.attribute.type; }

  /* Wie im Browser: Ein select nimmt nur Werte an, die es als option gibt. */
  get value() {
    if (this.tag !== "select") return this.wert;
    const optionen = this.alle().filter((k) => k.tag === "option");
    const gewaehlt = optionen.find((o) => o.gewaehlt) || optionen[0];
    return gewaehlt ? gewaehlt.attribute.value : "";
  }
  set value(neu) {
    if (this.tag !== "select") { this.wert = String(neu); return; }
    this.alle().filter((k) => k.tag === "option").forEach((o) => {
      o.gewaehlt = o.attribute.value === String(neu);
    });
  }

  alle() {
    return this.kinder.flatMap((k) => [k, ...k.alle()]);
  }
  passt(selektor) {
    if (selektor.startsWith(".")) return this.klassen.has(selektor.slice(1));
    const tag = selektor.match(/^[a-z]+/);
    if (tag && tag[0] !== this.tag) return false;
    return [...selektor.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].every(([, name, wert]) =>
      wert === undefined ? name in this.attribute : this.attribute[name] === wert);
  }
  querySelectorAll(selektor) { return this.alle().filter((k) => k.passt(selektor)); }
  querySelector(selektor) { return this.querySelectorAll(selektor)[0] || null; }
  closest(selektor) {
    let k = this;
    while (k && !k.passt(selektor)) k = k.eltern;
    return k || null;
  }

  append(...neue) { neue.forEach((k) => { k.eltern = this; this.kinder.push(k); }); }
  replaceChildren(...neue) { this.kinder = []; this.append(...neue); }
  setAttribute(n, w) { this.attribute[n] = w; }
  removeAttribute(n) { delete this.attribute[n]; }
  focus() {}
  select() {}
  scrollIntoView() {}

  addEventListener(art, fn) { (this.hoerer[art] = this.hoerer[art] || []).push(fn); }
  ausloesen(art) {
    const ereignis = { target: this, preventDefault() {} };
    for (let k = this; k; k = k.eltern) (k.hoerer[art] || []).forEach((fn) => fn(ereignis));
  }
  click() { this.ausloesen("click"); }

  reset() {
    this.alle().forEach((k) => {
      k.checked = k.startChecked;
      k.wert = k.attribute.value === undefined ? "" : k.attribute.value;
      if (k.tag === "option") k.gewaehlt = "selected" in k.attribute;
    });
  }

  /** Der Text samt Kindern, wie ihn innerText ungefähr liefert. */
  get text() { return [this.textContent, ...this.kinder.map((k) => k.text)].join(" ").trim(); }
}

function baueDokument(html) {
  const wurzel = new Knoten("#wurzel", {});
  const ohneKommentare = html.replace(/<!--[\s\S]*?-->/g, "");
  const stapel = [wurzel];
  for (const m of ohneKommentare.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*\/?>/g)) {
    const tag = m[2].toLowerCase();
    if (m[1]) {
      const stelle = stapel.map((k) => k.tag).lastIndexOf(tag);
      if (stelle > 0) stapel.length = stelle;
      continue;
    }
    const attribute = {};
    for (const a of m[3].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attribute[a[1]] = a[2] === undefined ? "" : a[2];
    const knoten = new Knoten(tag, attribute);
    if (tag === "option") knoten.gewaehlt = "selected" in attribute;
    stapel[stapel.length - 1].append(knoten);
    if (!OHNE_ENDE.has(tag)) stapel.push(knoten);
  }
  return wurzel;
}

/** FormData wie im Browser: nur angekreuzte Radios und Checkboxen zählen. */
function baueFormData(formular) {
  const paare = formular.alle().filter((k) =>
    k.name && ["input", "select", "textarea"].includes(k.tag) &&
    (!["radio", "checkbox"].includes(k.type) || k.checked));
  return class {
    get(name) { const t = paare.find((k) => k.name === name); return t ? t.value : null; }
    getAll(name) { return paare.filter((k) => k.name === name).map((k) => k.value); }
  };
}

/**
 * Lädt die Seite und gibt zurück:
 *   feld(id)      das Element
 *   importiere()  Mailtext einfügen und "Formular ausfüllen" drücken
 *   rechne()      das Formular absenden
 */
function ladeSeite() {
  const dok = baueDokument(fs.readFileSync(path.join(WURZEL, "index.html"), "utf8"));
  const feld = (id) => dok.alle().find((k) => k.id === id) || null;
  const formular = feld("rechner-formular");

  const document = {
    getElementById: feld,
    querySelector: (s) => dok.querySelector(s),
    querySelectorAll: (s) => dok.querySelectorAll(s),
    createElement: (tag) => new Knoten(tag, {}),
  };
  const kontext = vm.createContext({
    document, console, Intl, Math, Number, String, JSON, Array, Object,
    window: { scrollTo() {} },
    navigator: {},
    get FormData() {
      return class { constructor(f) { return new (baueFormData(f))(); } };
    },
  });
  for (const datei of ["js/pricing.js", "js/import.js", "js/app.js"]) {
    vm.runInContext(fs.readFileSync(path.join(WURZEL, datei), "utf8"), kontext, { filename: datei });
  }

  return {
    feld,
    importiere(mail) {
      feld("import-text").value = mail;
      feld("import-knopf").click();
    },
    rechne() { formular.ausloesen("submit"); },
  };
}

module.exports = { ladeSeite };
