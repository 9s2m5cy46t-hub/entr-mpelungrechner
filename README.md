# Auftragsrechner

**Internes** Kalkulationswerkzeug für **Just & Luis**, Braunschweig-Stöckheim.
Gedacht für Just und Luis, nicht für Kunden.

Deckt alle Aufträge im Bau- und Entrümpelungsbereich ab: Auftragsart wählen,
Umfang eintippen – die Seite zeigt die Spanne, die man dem Kunden nennt, den
exakten internen Richtwert und die Zeitplanung für den Kalender. Auf Knopfdruck
entsteht daraus eine PDF-Zusammenfassung für den Kunden.

## Betriebliche Grundlagen der Kalkulation

Diese Annahmen stecken in den Zahlen. Ändert sich eine davon, muss
`js/pricing.js` nachgezogen werden:

| Grundlage | Wert | Wirkt auf |
|---|---|---|
| Standort | Kleiststraße, Braunschweig-Stöckheim | Anfahrtszonen |
| Umsatzsteuer | Kleinunternehmer, § 19 UStG | Preise sind Endpreise, PDF-Hinweis |
| Fahrzeug | Pkw mit Anhänger, ca. 4 m³ pro Fahrt | Anzahl Fahrten |
| Entsorgung | selbst zum Wertstoffhof, 15 € pro Anlieferung | Entsorgungskosten |
| Fahrtdauer | 45 Min pro Fahrt inkl. Abladen | Arbeitszeit und Preis |
| Müllmenge | 20 m³ aus 60 m² bei leichtem Füllgrad | Volumen und Fahrten |
| Mindestpreis | keiner | – |

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

## Anfrage aus der Website übernehmen

Oben auf der Seite die Karte „Anfrage aus der Website übernehmen"
aufklappen, den **Text** der Benachrichtigungsmail einfügen, auf
„Formular ausfüllen" tippen. Übernommen werden Anfrage-Nummer, Name,
Telefon, Ort (samt Anfahrtszone), Auftragsart, Zimmer bzw. Wohnfläche,
Füllgrad, Etage, Abfallarten und das Volumen.

Danach steht ein Bericht in zwei Teilen: **Übernommen** und **Bitte
prüfen**. Die ausgefüllten Felder sind braun hervorgehoben. Alles bleibt
änderbar – der Import ist eine Vorbelegung, keine Wahrheit.

**Warum der Text und nicht der Screenshot:** Ein Bild müsste per
Texterkennung gelesen werden. Auf dunklen Handy-Screenshots verwechselt
die 0 mit dem O und die 5 mit dem S – bei einer Telefonnummer oder
„10–18 m³" sind falsche Zahlen schlimmer als gar keine, und die 15 MB
Sprachdaten kämen obendrauf. Aus dem Text lässt sich alles exakt lesen,
ohne jede Bibliothek.

Der Screenshot kann trotzdem angehängt werden: er wird auf dem Bildschirm
angezeigt, damit man die Angaben abgleichen kann, ohne zwischen den Apps
zu wechseln. Ins PDF kommt er nur, wenn das Häkchen gesetzt ist – dann als
eigene, rot beschriftete Seite. Grund: die Mail enthält interne
Einordnungen („ALLEIN MACHBAR", „eigener Container nötig?"), die kein
Kunde sehen soll. Ein PDF mit Screenshot ist für die eigene Ablage.

### Ortsnamen ergänzen

Die Zuordnung Ort → Zone steht in `js/import.js` in `ORT_ZONEN`. Was dort
nicht steht, wird **nicht geraten** – das Werkzeug meldet stattdessen, dass
die Anfahrt selbst gewählt werden muss. Neue Orte einfach ergänzen:

```js
const ORT_ZONEN = {
  'stöckheim': 'zone1',
  'wolfenbüttel': 'zone3',
  // ...
};
```

### Was der Import nicht kann

- **Die Wohnfläche fehlt in der Mail.** Dort stehen nur Zimmer. Aus
  2 Zimmern werden grob 50 m² geschätzt (`quadratmeterProZimmer`, 25 m²)
  und ausdrücklich als zu prüfen gemeldet. Diese Zahl bestimmt bei der
  Entrümpelung den Arbeitsanteil – also korrigieren, sobald ihr die Wohnung
  gesehen habt.
- **Volumenspannen werden nach oben gerundet.** Aus „etwa 10–18 m³" wird
  18 m³. Zu wenig kalkulierte Fahrten kosten euch sicher Geld, zu viele
  kosten den Auftrag nur vielleicht.
- **Die Anhänge der Anfrage (Fotos) kann das Werkzeug nicht sehen.** Es
  weist nur darauf hin, dass es welche gibt.

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
| `js/import.js` | Anfrage aus der Website-Mail lesen, Ortsnamen zu Zonen |
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
2. `× Vermüllungs-Multiplikator` (wirkt auf Pauschale und Flächenanteil,
   nicht auf Gebühren und Nebenkosten)
3. `+ Kellerabteil`, dazu als Nebenkosten Fahrten, Anfahrtszone und
   Zusatzkosten
4. Falls kein Aufzug: `× (1 + Etagen über EG × 15 %)` auf die Arbeit vor Ort

Beispiel: 60 m², 3. Etage ohne Aufzug, mittel, Keller, Zone 1 →
26 m³ Müll → 7 Fahrten → Richtwert 1.275,40 € → Kundenspanne
**„ca. 1.020–1.530 € VB"**, Zeitslot 11 Std. ≈ 1,5 Tage.

Vor der Umstellung auf echte Transportkosten kam derselbe Auftrag auf
720,65 €. Die Differenz von rund 555 € sind die sieben Fahrten zum
Wertstoffhof – die fielen vorher unter den Tisch.

**Stundenauftrag (Abbruch, Bau, Sonstiges)**

1. `Personenstunden = Dauer vor Ort × Anzahl Personen`
2. `Arbeitskosten = Personenstunden × Stundensatz`, dazu der
   Erschwernis-Aufschlag
3. `+ Grundpauschale`, dazu als Nebenkosten Material (+ 10 % Beschaffung),
   Fahrten, Anfahrtszone und Zusatzkosten
4. Falls kein Aufzug: `× (1 + Etagen über EG × 15 %)` auf die Arbeit vor Ort

Beispiel: Treppe bauen, 2 Personen an 2 Tagen (16 Std. vor Ort), mittlere
Erschwernis, 900 € Material, 3 m³ Altholz, 40 € Anhängermiete, Zone 1 →
Richtwert 3.219,75 € → Kundenspanne **„ca. 2.580–3.860 € VB"**,
Zeitslot 22 Std. ≈ 3 Tage.

**Wichtig zur Eingabe:** „Dauer vor Ort" ist die Zeit, die ihr dort seid –
nicht die Personenstunden. Zwei Leute an zwei Tagen sind **16 Stunden**, nicht
32. Die Personenstunden rechnet das Werkzeug selbst.

### Anfahrtszonen

Gemessen von der Kleiststraße aus:

| Zone | Gebiet | Zuschlag |
|---|---|---|
| 1 | Stöckheim, Melverode, Leiferde, Rüningen | 0 € |
| 2 | Braunschweig, übriges Stadtgebiet | 20 € |
| 3 | Umland bis ca. 25 km (Wolfenbüttel, Vechelde, Cremlingen, SZ-Lebenstedt) | 45 € |
| 4 | weiter als 25 km | 45 € + 0,60 € je km über 25, Hin- und Rückfahrt |

### Transport und Entsorgung

Die Entsorgung wird nicht mehr über Pauschalen gerechnet, sondern über die
tatsächlichen Fahrten:

```
Volumen  ÷ 4 m³ pro Fahrt, aufgerundet  =  Anzahl Fahrten
Fahrten  × 15 €                         =  Anlieferungsgebühren
Fahrten  × 0,75 Std. × Anzahl Personen  =  Fahrzeit (kostet Stundensatz)
```

Bei der Entrümpelung kommt das Volumen aus der Wohnfläche
(0,33 m³ je m², mal Vermüllungsfaktor), beim Stundenauftrag gibt man es
selbst an.

Die Checkboxen bei „Was muss entsorgt werden?" sind dadurch **keine
Preispauschalen mehr**. Sie stehen im PDF und kosten nur dort extra, wo es
real extra kostet – aktuell nur Sondermüll mit 60 €, weil der nicht mit auf
den Anhänger darf. Zahlt ihr am Hof für Bauschutt gesondert, in
`PREISE.abfallarten.bauschutt` eintragen.

**Annahme zur Fahrzeit:** Es fahren alle mit, weil nur ein Fahrzeug da ist
und Beladen zu zweit schneller geht. Die Fahrzeit zählt deshalb für jede
Person. Wenn einer weiterarbeitet, während der andere fährt:
`PREISE.transport.nurEinePersonFaehrt` auf `true` setzen.

### Etagenaufschlag

Der Aufschlag von 15 % je Etage ohne Aufzug wirkt **nur auf die Arbeit vor
Ort** – nicht auf Anlieferungsgebühren, Fahrzeit, Material, Anfahrtszone oder
Zusatzkosten. Ursprünglich war „15 % auf den Gesamtpreis" vorgegeben. Das war
vertretbar, solange der Transport keine eigene Position war; jetzt würde es
die Deponiefahrt teurer machen, nur weil die Wohnung im dritten Stock liegt.

### Zeitplanung

Angezeigt werden Personenstunden, Dauer vor Ort und ein Kalender-Zeitslot
(Dauer + 30 % Puffer, auf halbe Stunden aufgerundet). Slots über 8 Stunden
werden zusätzlich in Tage umgerechnet, weil „21 Std." als Kalendereintrag
nicht weiterhilft.

### Was zuerst geprüft werden sollte

- **Müllmenge je m²** (`entruempelung.kubikmeterProQuadratmeter`) – die Annahme
  20 m³ aus 60 m² ist ein Erfahrungswert, nicht eure Messung. Nach den ersten
  zwei echten Entrümpelungen die tatsächliche Zahl der Fahrten mit der
  berechneten vergleichen und nachziehen. Diese Zahl bewegt den Preis stärker
  als jede andere.
- **Anlieferungspreis** (`transport.preisProAnlieferung`, 15 €) – prüfen, ob
  der Hof euch als Gewerbe anders einstuft als privat, und ob Bauschutt oder
  gemischte Ladungen mehr kosten.
- **Erschwernisfaktoren** (`stundenAuftrag.erschwernis`) – 1,0 / 1,2 / 1,5 sind
  bewusst niedriger als die Vermüllungsgrade, weil man die Stunden beim
  Stundenauftrag selbst schätzt.

### Noch offen: Abfallrecht

Wer Abfälle **gewerblich** befördert, muss das nach § 53 KrWG bei der
zuständigen Behörde anzeigen; für gefährliche Abfälle gelten strengere
Regeln (Erlaubnis nach § 54 KrWG). Sondermüll wie Farben und Chemikalien
lässt sich als Gewerbe in der Regel nicht über die normale Annahmestelle
abgeben. Das ist kein Rechtsrat – aber bevor die erste Entrümpelung mit
Sondermüll ansteht, gehört das geklärt. Ansprechpartner ist die
Abfallbehörde der Stadt Braunschweig.

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
