# Entrümpelungsrechner

Statischer Preisrechner für **Just & Luis Entrümpelung**, Braunschweig-Stöckheim.

Kunden geben Wohnfläche, Etage, Vermüllungsgrad und Sonderposten ein und
bekommen sofort eine Preisspanne. Auf Knopfdruck entsteht daraus eine
PDF-Zusammenfassung.

**Kein Backend, keine Datenbank, kein Build-Prozess.** Reines
HTML/CSS/JavaScript – läuft direkt über GitHub Pages. Alle Berechnungen und
die PDF-Erzeugung laufen im Browser des Kunden; es werden keine Eingaben
gespeichert oder an einen Server gesendet.

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

Die Telefonnummer steht an drei Stellen: in `index.html` (Anruf-Leiste und
Fußzeile) und in `js/pdf.js` im Block `FIRMA` (für die PDF-Fußzeile).

### So wird gerechnet

1. `Grundpauschale + (Wohnfläche × Preis pro m²)`
2. Ergebnis `× Vermüllungs-Multiplikator`
   (wirkt nur auf den Arbeitsaufwand, nicht auf die Entsorgungspauschalen)
3. `+ Kellerabteil + Zuschläge für besondere Gegenstände`
4. Falls **kein Aufzug**: `× (1 + Etagen über EG × 15 %)`
5. Angezeigte Spanne: Ergebnis `±20 %`, auf 10 € gerundet

Beispiel: 60 m², 3. Etage ohne Aufzug, mittel, Keller, Sperrmüll + Elektroschrott
→ Richtwert 720,65 € → Anzeige **„ca. 580–860 € VB"**.

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

## Noch offen

- **Impressum und Datenschutzerklärung fehlen.** Für eine geschäftlich genutzte
  Seite in Deutschland sind beide Pflicht (§ 5 DDG, Art. 13 DSGVO). Die Daten
  dafür müssen von Just & Luis kommen; danach als `impressum.html` und
  `datenschutz.html` ergänzen und in der Fußzeile verlinken.
