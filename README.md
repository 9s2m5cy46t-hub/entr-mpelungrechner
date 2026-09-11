# Auftragsrechner

**Internes** Kalkulationswerkzeug für **Just & Luis**, Braunschweig-Stöckheim.
Gedacht für Just und Luis, nicht für Kunden.

Deckt alle Aufträge im Bau- und Entrümpelungsbereich ab: Auftragsart wählen,
Umfang eintippen – die Seite zeigt die Spanne, die man dem Kunden nennt, den
exakten internen Richtwert und die Zeitplanung für den Kalender. Auf Knopfdruck
entsteht daraus eine PDF-Zusammenfassung für den Kunden.

**Kein Backend, keine Datenbank, kein Build-Prozess.** Reines
HTML/CSS/JavaScript – läuft direkt über GitHub Pages. Alle Berechnungen und die
PDF-Erzeugung laufen im Browser; es werden keine Eingaben gespeichert oder an
einen Server gesendet.

> **Achtung, Sichtbarkeit:** Bei einem öffentlichen Repository ist die
> GitHub-Pages-Seite für jeden im Internet erreichbar, der die Adresse kennt –
> es gibt kein Login. Der `noindex`-Hinweis hält Suchmaschinen fern, ist aber
> kein Schutz. Siehe „Seite nicht öffentlich betreiben" unten.

---

## Auftragsarten

| Art | Rechenweg | Pflichtfelder |
|---|---|---|
| **Entrümpelung** | Wohnfläche × Preis pro m², mal Vermüllungsgrad | Wohnfläche, Zimmer |
| **Abbruch / Rückbau** | Arbeitszeit × Stundensatz, mal Erschwernis | Dauer vor Ort |
| **Bau / Montage** | wie Abbruch, zusätzlich Material | Dauer vor Ort |
| **Sonstiges** | wie Abbruch | Dauer vor Ort |

Bei allen Arten kommen dazu: Anzahl Personen, Etage, Aufzug und die
Entsorgungsposten. Kundendaten sind nie Pflicht – die braucht nur das PDF.

**Neue Auftragsart hinzufügen:** in `js/pricing.js` einen Eintrag in
`AUFTRAGSARTEN` ergänzen und im Dropdown in `index.html` eine `<option>`.
Nutzt sie das Modell `stunden`, ist an der Rechenlogik nichts zu ändern.

## GitHub Pages aktivieren

1. Im Repository oben auf **Settings**, links auf **Pages**.
2. *Source*: **Deploy from a branch**.
3. *Branch*: **main**, Ordner **/ (root)** → **Save**.
4. Nach ein bis zwei Minuten steht die Adresse oben auf derselben Seite.

Jeder weitere Push auf `main` aktualisiert die Seite automatisch. Die Datei
`.nojekyll` sorgt dafür, dass die Dateien unverändert ausgeliefert werden –
nicht löschen.

## Lokal ausprobieren

`index.html` im Browser öffnen genügt. Oder mit lokalem Server:

```bash
python3 -m http.server 8000    # dann http://localhost:8000 öffnen
```

---

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Formular und Seitenaufbau |
| `css/styles.css` | Optik: mobile-first, große Schrift, Grün/Erdtöne |
| `js/pricing.js` | **Alle Preise, Auftragsarten und Rechenlogik** |
| `js/app.js` | Formular auslesen, prüfen, Ergebnis anzeigen |
| `js/pdf.js` | PDF-Zusammenfassung erzeugen (jsPDF) |
| `.nojekyll` | Nötig für GitHub Pages |

## Preise ändern

Alle Beträge stehen oben in `js/pricing.js` im Block `PREISE`:

```js
const PREISE = {
  grundpauschale: 80,              // Anfahrt, Fahrzeug, Grundaufwand
  stundensatzProPerson: 52.5,      // pro Person und Stunde
  etagenaufschlagOhneAufzug: 0.15, // 15 % pro Etage über EG, falls kein Aufzug
  zeitpuffer: 0.3,                 // 30 % Puffer für den Kalender-Zeitslot
  arbeitstagStunden: 8,            // nur für die Anzeige langer Slots
  spanneProzent: 0.2,              // Kundenspanne: ±20 %
  rundungSpanne: 10,               // Spanne auf 10 € runden

  entruempelung: {
    proQuadratmeter: 3.5,
    vermuellung: { leicht: 1.0, mittel: 1.3, stark: 1.7 },
    kellerabteil: 50,
    quadratmeterProStunde: 15,     // 1 Personenstunde je 15 m² bei "leicht"
    zusatzstundenOhneAufzug: 0.5,
  },

  stundenAuftrag: {
    erschwernis: { einfach: 1.0, mittel: 1.2, schwer: 1.5 },
    materialAufschlag: 0.1,        // 10 % für Beschaffung und Transport
  },

  entsorgung: {
    sperrmuell: 40, elektroschrott: 30, sondermuell: 60,
    bauschutt: 250, altholz: 120,
  },
};
```

### Warum 52,50 € pro Stunde

Dieser Satz steckt bereits in der Entrümpelungs-Formel: 3,50 € pro m² bei
1 Stunde Aufwand je 15 m² sind 3,50 × 15 = **52,50 € pro Personenstunde**,
unabhängig von der Fläche. Bau- und Abbruchaufträge rechnen deshalb mit
demselben Satz – so driften die Auftragsarten preislich nicht auseinander.

Wer `stundensatzProPerson` ändert, sollte `entruempelung.proQuadratmeter`
mit anpassen (Stundensatz ÷ 15), sonst kostet dieselbe Arbeit je nach
gewählter Auftragsart unterschiedlich viel.

### Rechenwege im Detail

**Entrümpelung**

1. `Grundpauschale + Wohnfläche × Preis pro m²`
2. `× Vermüllungs-Multiplikator` (wirkt auf den Arbeitsaufwand, nicht auf
   die Entsorgungspauschalen)
3. `+ Kellerabteil + gewählte Entsorgungsposten`
4. Falls kein Aufzug: `× (1 + Etagen über EG × 15 %)`

Beispiel: 60 m², 3. Etage ohne Aufzug, mittel, Keller, Sperrmüll +
Elektroschrott → Richtwert 720,65 € → Kundenspanne **„ca. 580–860 € VB"**.

**Stundenauftrag (Abbruch, Bau, Sonstiges)**

1. `Personenstunden = Dauer vor Ort × Anzahl Personen`
2. `Arbeitskosten = Personenstunden × Stundensatz`, dazu der
   Erschwernis-Aufschlag
3. `+ Grundpauschale + Material (+ 10 % Beschaffung) + Entsorgungsposten`
4. Falls kein Aufzug: `× (1 + Etagen über EG × 15 %)`

Beispiel: Treppe bauen, 2 Personen an 2 Tagen (16 Std. vor Ort), mittlere
Erschwernis, 900 € Material, Altholz-Entsorgung → Richtwert 3.206 € →
Kundenspanne **„ca. 2.560–3.850 € VB"**, Zeitslot 21 Std. ≈ 3 Tage.

**Wichtig zur Eingabe:** „Dauer vor Ort" ist die Zeit, die ihr dort seid –
nicht die Personenstunden. Zwei Leute an zwei Tagen sind **16 Stunden**, nicht
32. Die Personenstunden rechnet das Werkzeug selbst.

### Zeitplanung

Angezeigt werden Personenstunden, Dauer vor Ort und ein Kalender-Zeitslot
(Dauer + 30 % Puffer, auf halbe Stunden aufgerundet). Slots über 8 Stunden
werden zusätzlich in Tage umgerechnet, weil „21 Std." als Kalendereintrag
nicht weiterhilft.

### Was zuerst geprüft werden sollte

Zwei Zahlengruppen sind Schätzwerte und müssen gegen die Realität gehalten
werden:

- **`entsorgung.bauschutt` (250 €) und `entsorgung.altholz` (120 €)** –
  Containerpreise schwanken regional und nach Menge erheblich. Einmal beim
  Entsorger nachfragen und eintragen.
- **`stundenAuftrag.erschwernis`** – die Faktoren 1,0 / 1,2 / 1,5 sind
  bewusst niedriger als die Vermüllungsgrade, weil man die Stunden hier
  selbst schätzt und der Faktor nur zusätzliche Erschwernis abdeckt.

## PDF

Die PDF-Erzeugung nutzt [jsPDF](https://github.com/parallax/jsPDF) über ein CDN
(`cdnjs.cloudflare.com`) – nichts zu installieren. Das PDF enthält Datum,
Kundendaten (sofern ausgefüllt), die Leistungsbeschreibung, alle Eingaben zum
Auftrag, die voraussichtliche Dauer, die Entsorgung und die Kundenspanne.
**Der interne Richtwert und die Personenstunden stehen bewusst nicht darin.**

Zwei Dinge, die man dazu wissen sollte:

- **Ohne Verbindung zum CDN kein PDF.** Die Berechnung funktioniert weiterhin;
  nur der PDF-Knopf zeigt einen Hinweis. Wer das nicht will, lädt
  `jspdf.umd.min.js` einmal herunter, legt sie unter `js/` ab und ändert in
  `index.html` das `<script src="…">` auf den lokalen Pfad.
- **Die jsPDF-Standardfonts können nur Latin-1.** Zeichen wie „€", „–" oder
  „≈" würden lautlos verschwinden. `pdfSicher()` in `js/pdf.js` ersetzt sie
  (`EUR`, `-`, `~`), schreibt häufige Buchstaben aus Nachbarsprachen um
  (ł → l, ş → s) und meldet alles Übrige in der Browser-Konsole. Wer dort
  Texte ergänzt, sollte die Funktion nicht umgehen.

## Seite nicht öffentlich betreiben

Als internes Werkzeug muss die Seite gar nicht im Netz stehen:

1. **Gar nicht veröffentlichen.** Repository klonen oder als ZIP herunterladen,
   `index.html` doppelklicken. Funktioniert offline – außer der PDF-Erzeugung,
   die jsPDF vom CDN lädt (dann jsPDF lokal ablegen, siehe oben).
   GitHub Pages in den Einstellungen auf *None* stellen.
2. **Auf dem Handy speichern.** Seite öffnen und „Zum Startbildschirm
   hinzufügen". Sieht aus wie eine App. Ändert nichts an der Sichtbarkeit.
3. **Repository auf privat stellen.** GitHub Pages für private Repositories
   setzt einen bezahlten Plan voraus (GitHub Pro oder Team), sonst wird die
   Seite nicht mehr ausgeliefert.

Solange die Seite öffentlich läuft: Sie enthält keine Kundendaten (es wird
nichts gespeichert), aber die **komplette Kalkulationsgrundlage** – Stundensatz,
Zuschläge, Margenpuffer. Wer das nicht offenlegen will, nimmt Variante 1 oder 3.
