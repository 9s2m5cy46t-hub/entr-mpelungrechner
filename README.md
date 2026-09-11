# Entrümpelungsrechner

**Internes** Kalkulationswerkzeug für **Just & Luis Entrümpelung**,
Braunschweig-Stöckheim. Gedacht für Just und Luis, nicht für Kunden.

Wohnfläche, Etage, Vermüllungsgrad und Sonderposten eintippen – die Seite zeigt
die Spanne, die man dem Kunden nennt, **und** den exakten internen Richtwert.
Auf Knopfdruck entsteht daraus eine PDF-Zusammenfassung für den Kunden.

**Kein Backend, keine Datenbank, kein Build-Prozess.** Reines
HTML/CSS/JavaScript – läuft direkt über GitHub Pages. Alle Berechnungen und
die PDF-Erzeugung laufen im Browser; es werden keine Eingaben gespeichert oder
an einen Server gesendet.

> **Achtung, Sichtbarkeit:** Bei einem öffentlichen Repository ist die
> GitHub-Pages-Seite für jeden im Internet erreichbar, der die Adresse kennt –
> es gibt kein Login. Ein `noindex`-Hinweis hält Suchmaschinen fern, aber das
> ist kein Schutz. Wer die Kalkulationsgrundlage nicht öffentlich haben will:
> siehe „Seite nicht öffentlich betreiben" unten.

---

## GitHub Pages aktivieren

1. Im GitHub-Repository oben auf **Settings** klicken.
2. Links in der Seitenleiste auf **Pages**.
3. Unter *Build and deployment* → *Source*: **Deploy from a branch** wählen.
4. Unter *Branch*: **main** und den Ordner **/ (root)** auswählen, dann **Save**.
5. Eine bis zwei Minuten warten. Oben auf derselben Seite erscheint dann die
   Adresse, z. B. `https://<benutzername>.github.io/<repo-name>/`.

Danach ist die Seite öffentlich erreichbar. Jeder weitere Push auf `main`
aktualisiert die Seite automatisch.

> Die Datei `.nojekyll` im Hauptverzeichnis sorgt dafür, dass GitHub Pages die
> Dateien unverändert ausliefert. Nicht löschen.

## Lokal ausprobieren

`index.html` einfach im Browser öffnen – das genügt. Wer es "richtig" testen
will, startet einen kleinen lokalen Server:

```bash
python3 -m http.server 8000
# dann http://localhost:8000 im Browser öffnen
```

---

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Das Formular und der Seitenaufbau |
| `css/styles.css` | Optik: mobile-first, große Schrift, Grün/Erdtöne |
| `js/pricing.js` | **Alle Preise und die Rechenlogik** |
| `js/app.js` | Formular auslesen, prüfen, Ergebnis anzeigen |
| `js/pdf.js` | PDF-Zusammenfassung erzeugen (jsPDF) |
| `.nojekyll` | Nötig für GitHub Pages |

## Preise ändern

Alle Beträge stehen oben in `js/pricing.js` im Block `PREISE` – nur dort etwas
ändern, sonst nichts anfassen:

```js
const PREISE = {
  grundpauschale: 80,            // Grundpauschale in Euro
  proQuadratmeter: 3.5,          // Preis pro m² Wohnfläche
  etagenaufschlagOhneAufzug: 0.15, // 15 % pro Etage über EG, falls kein Aufzug
  vermuellung: { leicht: 1.0, mittel: 1.3, stark: 1.7 },
  kellerabteil: 50,              // Pauschale Kellerabteil
  gegenstaende: { sperrmuell: 40, elektroschrott: 30, sondermuell: 60 },
  spanneProzent: 0.2,            // angezeigte Spanne: ±20 %
  rundungSpanne: 10,             // Spanne auf 10 € runden
};
```

Die Telefonnummer steht nur noch in `js/pdf.js` im Block `FIRMA` – sie
erscheint in der PDF-Fußzeile, also in dem Dokument, das der Kunde bekommt.
Auf der Seite selbst gibt es keine Telefonnummer und keine Anruf-Leiste, weil
das Werkzeug intern ist.

### So wird gerechnet

1. `Grundpauschale + (Wohnfläche × Preis pro m²)`
2. Ergebnis `× Vermüllungs-Multiplikator`
   (wirkt nur auf den Arbeitsaufwand, nicht auf die Entsorgungspauschalen)
3. `+ Kellerabteil + Zuschläge für besondere Gegenstände`
4. Falls **kein Aufzug**: `× (1 + Etagen über EG × 15 %)`
5. Angezeigte Spanne: Ergebnis `±20 %`, auf 10 € gerundet

Beispiel: 60 m², 3. Etage ohne Aufzug, mittel, Keller, Sperrmüll + Elektroschrott
→ interner Richtwert 720,65 € → Kundenspanne **„ca. 580–860 € VB"**.

Auf dem Bildschirm stehen beide Zahlen: die Kundenspanne in Grün, der interne
Richtwert darunter in Braun. **Im PDF steht nur die Kundenspanne**, der
Richtwert nicht.

> Hinweis: *Anzahl Zimmer* geht bewusst **nicht** in den Preis ein (die
> Wohnfläche deckt das schon ab). Das Feld steht nur zur Information im PDF.

## PDF

Die PDF-Erzeugung nutzt [jsPDF](https://github.com/parallax/jsPDF), das über ein
CDN (`cdnjs.cloudflare.com`) geladen wird – nichts zu installieren. Das PDF
enthält Datum, Kundendaten (sofern ausgefüllt), alle Formulareingaben, die
Preisspanne und die Fußzeile mit Kontaktdaten. Es wird direkt auf dem Gerät
erzeugt und heruntergeladen.

Zwei Dinge, die man dazu wissen sollte:

- **Ohne Internetverbindung zum CDN kein PDF.** Die Berechnung funktioniert
  weiterhin; nur der PDF-Knopf zeigt dann einen Hinweis. Wer das nicht will,
  lädt `jspdf.umd.min.js` einmal herunter, legt sie unter `js/` ab und ändert in
  `index.html` das `<script src="…">` auf den lokalen Pfad.
- **jsPDF-Standardfonts können kein „€" und keine Gedankenstriche.** Deshalb
  steht im PDF `EUR` und ein normaler Bindestrich. Die Funktion `pdfSicher()`
  in `js/pdf.js` sorgt dafür – wer dort Texte ergänzt, sollte sie nicht umgehen.

## Seite nicht öffentlich betreiben

Als internes Werkzeug muss die Seite gar nicht im Netz stehen. Drei
Möglichkeiten, von einfach nach aufwendig:

1. **Gar nicht veröffentlichen.** Repository klonen oder als ZIP herunterladen,
   `index.html` doppelklicken. Funktioniert vollständig offline – außer der
   PDF-Erzeugung, die jsPDF vom CDN lädt (dann jsPDF lokal ablegen, siehe oben).
   GitHub Pages in den Einstellungen auf *None* stellen.
2. **Auf dem Handy speichern.** Seite im Browser öffnen und „Zum Startbildschirm
   hinzufügen". Sieht aus wie eine App, braucht danach kein Suchen mehr.
3. **Repository auf privat stellen.** GitHub Pages für private Repositories
   setzt allerdings einen bezahlten Plan voraus (GitHub Pro oder Team) –
   sonst wird die Seite nicht mehr ausgeliefert.

Solange die Seite öffentlich läuft: Sie enthält keine Kundendaten (es wird
nichts gespeichert), aber die **komplette Kalkulationsgrundlage** – Stundenlogik,
Zuschläge, Margenpuffer. Wer das nicht offenlegen will, nimmt Variante 1 oder 3.
