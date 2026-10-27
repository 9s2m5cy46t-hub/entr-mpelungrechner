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
| **Gartenarbeiten** | Arbeitszeit × Stundensatz, Dauer wird vorgeschlagen | Arbeiten, Dauer vor Ort |
| **Abbruch / Rückbau** | Arbeitszeit × Stundensatz, mal Erschwernis | Dauer vor Ort |
| **Bau / Montage** | wie Abbruch, zusätzlich Material | Dauer vor Ort |
| **Sonstiges** | wie Abbruch | Dauer vor Ort |

Bei allen Arten kommen dazu: Anzahl Personen, Etage, Aufzug und die
Entsorgungsposten. Kundendaten sind nie Pflicht – die braucht nur das PDF.
Bei Gartenarbeiten sind Etage, Aufzug und Material ausgeblendet: In einem
Garten gibt es keine Etage, und Material wird dort nicht eingekauft.

**Neue Auftragsart hinzufügen:** in `js/pricing.js` einen Eintrag in
`AUFTRAGSARTEN` ergänzen und im Dropdown in `index.html` eine `<option>`.
Nutzt sie das Modell `stunden`, ist an der Rechenlogik nichts zu ändern.

## Anfrage aus der Website übernehmen

Oben auf der Seite die Karte „Anfrage aus der Website übernehmen" aufklappen,
den **Text** der Benachrichtigungsmail einfügen, auf „Formular ausfüllen"
tippen.

Der Import nimmt zwei Wege:

**1. Strukturierter Block (bevorzugt).** Steht in der Mail ein Block

```
--- RECHNER-DATEN v1 ---
bereich: entruempelung
objekt: wohnung
zimmer: 3
fuellgrad: voll
etage: 3plus
aufzug: nein
besonderes: elektro; schwerlast
volumen_m3: 22-42
personen: 2
ort: Stöckheim
--- ENDE ---
```

dann wird er gelesen und der Fließtext ignoriert. Feste Schlüssel statt
deutscher Sätze: nichts zu raten. **Eine fehlende Zeile heißt „unbekannt" und
wird nicht ergänzt.** Mehrere Werte in einer Zeile mit `; ` trennen.

Mögliche Werte: `bereich` entruempelung/garten/beides · `objekt`
wohnung/haus/keller/garage/moebel/anderes · `fuellgrad` leer/normal/voll/unbekannt ·
`etage` eg/1-2/3plus/unbekannt · `aufzug` ja/nein/unbekannt · `besonderes`
elektro/bauschutt/schadstoffe/schwerlast/verwertbares/sonstiges ·
`garten_arbeiten` rasen/hecke/laub/gruenschnitt_weg/instandsetzung/aufloesung/sonstiges ·
`garten_groesse` und `garten_zustand` wie im Formular · `gruenschnitt`
mitnehmen/bleibt/unbekannt.

**2. Fließtext (ältere Mails).** Ohne den Block gilt der bisherige Weg über die
Zeilen „Name:", „Ort:", „Was:", „Etage:" und so weiter.

### Was übernommen wird

| Aus der Mail | Wird zu |
|---|---|
| `Etage: Erdgeschoss` | Erdgeschoss |
| `Etage: 1. oder 2. Stock, ohne Aufzug` | **Etage 2**, Notiz „mit 2 gerechnet" |
| `Etage: 3. Stock oder höher, ohne Aufzug` | **Etage 3** + Warnung „mindestens 3. Etage, vor Ort prüfen" |
| `Etage: Mit Aufzug` | Erdgeschoss, Aufzug ja |
| `Leute: ALLEIN …` | 1 Person |
| `Leute: ZU ZWEIT …` | 2 Personen |
| `Volumen: etwa 22–42 m³` | 32 m³ ins Feld, Spanne 22–42 bestimmt den Preis von–bis |
| `Ort: Stöckheim` | Anfahrtszone 1 |

**Warum Etage 3 und nicht „höher":** „3. Stock oder höher" könnte den dritten
Stock meinen (+45 % auf die Arbeit) oder den sechsten (+90 %). Ein zu hoher
Preis kostet den Auftrag, ohne dass jemand nachfragt – also die untere Kante
nehmen und vor Ort prüfen. Die Warnung steht im Bericht.

**Warum die Mitte der Volumenspanne:** Der Richtwert soll der wahrscheinliche
Fall sein, nicht der schlimmste. Die Obergrenze steht ohnehin als „bis" daneben.
Ändert ihr das Volumenfeld von Hand, passt die Spanne aus der Mail nicht mehr
dazu – sie wird dann verworfen, und es gilt wieder ±20 %.

### Warnungen, die nicht übergangen werden

- `Sachen, die noch gut sind` → „Verwertbares, bei Besichtigung gegenrechnen"
- `Sehr Schweres` → „Schwerlast, mindestens 2 Personen"
- `Etwas anderes: <Text>` → der Text selbst, ungekürzt
- Entrümpelung **ohne Volumen und ohne Wohnfläche** → „KEINE GRUNDLAGE"; ohne
  eines von beiden gibt es keinen belastbaren Preis

Danach steht ein Bericht in zwei Teilen: **Übernommen** und **Bitte prüfen**.
Die ausgefüllten Felder sind braun hervorgehoben. Alles bleibt änderbar – der
Import ist eine Vorbelegung, keine Wahrheit.

**Warum der Text und nicht der Screenshot:** Ein Bild müsste per Texterkennung
gelesen werden. Auf dunklen Handy-Screenshots verwechselt die 0 mit dem O und
die 5 mit dem S – bei einer Telefonnummer oder „10–18 m³" sind falsche Zahlen
schlimmer als gar keine. Aus dem Text lässt sich alles exakt lesen, ohne jede
Bibliothek.

Der Screenshot kann trotzdem angehängt werden: er wird auf dem Bildschirm
angezeigt, damit man die Angaben abgleichen kann, ohne zwischen den Apps zu
wechseln. Ins PDF kommt er nur mit Häkchen – dann als eigene, rot beschriftete
Seite, weil die Mail interne Einordnungen enthält.

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

- **Die Wohnfläche steht selten in der Mail.** Nennt sie Zimmer, werden daraus
  grob 25 m² je Zimmer geschätzt. Liegt ein Volumen vor, geht diese Schätzung
  **nicht** in den Preis ein – gerechnet wird dann über das Volumen, und die
  Fläche steht nur im PDF. Ohne Volumen ist sie die Grundlage und muss geprüft
  werden.
- **Volumenspannen werden nicht enger.** Aus „etwa 18–33 m³" wird ein Richtwert
  bei 25,5 m³ und eine Kundenspanne von 840 bis 1.380 €. Diese Spanne ist breit,
  weil die Angabe breit ist – das ist ehrlicher, als sie schmalzurechnen.
- **Die Anhänge der Anfrage (Fotos) kann das Werkzeug nicht sehen.** Es weist
  nur darauf hin, dass es welche gibt.
- **Gartenarbeiten bekommen kein Volumen.** Aus „Hecke schneiden" folgt keine
  Kubikmeterzahl. Soll Grünschnitt mit, wird daran erinnert, das Volumen selbst
  zu schätzen – davon hängen die Fahrten ab.
- **Bei „Beides"** rechnet dieses Werkzeug nur die Entrümpelung. Die
  Gartenarbeiten gehören in eine zweite Kalkulation; darauf weist der Bericht
  hin.

## GitHub Pages aktivieren

1. Im Repository oben auf **Settings**, links auf **Pages**.
2. *Source*: **Deploy from a branch**.
3. *Branch*: **main**, Ordner **/ (root)** → **Save**.
4. Nach ein bis zwei Minuten steht die Adresse oben auf derselben Seite.

Jeder weitere Push auf `main` aktualisiert die Seite automatisch. Die Datei
`.nojekyll` sorgt dafür, dass die Dateien unverändert ausgeliefert werden –
nicht löschen.

## Tests

```bash
node --test tests/
```

Braucht nichts außer Node. Die Browser-Dateien werden mit `node:vm` geladen
(`tests/laden.js`) – sie bleiben dadurch reine `<script>`-Dateien ohne
`module.exports`. Die Beispielmails in `tests/fixtures/` sind erfunden,
es stehen keine echten Kundendaten darin.

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
| `tests/` | Tests mit Nodes eingebautem Testlauf, ohne Abhängigkeit |

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

  abfallarten: {
    sperrmuell: 0, elektroschrott: 0, sondermuell: 60,
    bauschutt: 0, altholz: 0, gruenschnitt: 0,
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

**Entrümpelung – zwei Wege, die bei gleicher Menge dasselbe ergeben**

Liegt ein **Volumen** vor (aus der Anfrage oder selbst eingetragen):

1. `Grundpauschale + Volumen × 10,50 € je m³`
2. `+ Kellerabteil`, dazu als Nebenkosten Fahrten, Anfahrtszone, Zusatzkosten
3. Falls kein Aufzug: `× (1 + Etagen über EG × 15 %)` auf die Arbeit vor Ort
4. Arbeitszeit: `Volumen ÷ 5 m³ je Personenstunde`, plus 0,5 Std. ohne Aufzug

Der **Vermüllungsgrad wird hier nicht noch einmal aufgeschlagen**. Wer 30 m³
nennt, hat den vollen Schrank schon mitgezählt; ihn zusätzlich zu
multiplizieren hieße, dieselbe Menge zweimal zu berechnen.

Ohne Volumen gilt unverändert der **Flächenweg**:

1. `Grundpauschale + Wohnfläche × 3,50 € je m²`
2. `× Vermüllungs-Multiplikator` (auf Pauschale und Flächenanteil)
3. `+ Kellerabteil`, dazu dieselben Nebenkosten
4. Falls kein Aufzug: derselbe Etagenaufschlag
5. Arbeitszeit: `Wohnfläche ÷ 15 m² je Stunde × Vermüllungsfaktor`

**Die beiden Konstanten werden abgeleitet, nicht gesetzt:**

```
preisProKubikmeter          = proQuadratmeter / kubikmeterProQuadratmeter
                            = 3,50 € / 0,333 m³  =  10,50 € je m³
kubikmeterProPersonenstunde = quadratmeterProStunde × kubikmeterProQuadratmeter
                            = 15 m² × 0,333 m³    =  5 m³ je Personenstunde
```

Damit kostet dieselbe Arbeit gleich viel, egal über welchen Weg sie gerechnet
wird. **Probe:** 60 m², leicht, 20 m³, EG ergibt in beiden Wegen 290 € Arbeit
und 4 Personenstunden. Der Test `tests/import.test.js` prüft das.

Beispiel Flächenweg: 60 m², 3. Etage ohne Aufzug, mittel, Keller, Zone 1 →
26 m³ Müll → 7 Fahrten → Richtwert 1.275,40 €, Kundenspanne
**„ca. 1.020–1.530 € VB"**.

Beispiel Volumenweg: 22–42 m³ aus der Anfrage, 3. Etage ohne Aufzug,
2 Personen, Zone 1 → gerechnet mit 32 m³ → 8 Fahrten → Richtwert 1.353,20 €,
Kundenspanne **„ca. 1.010–1.790 € VB"**.

**Stundenauftrag (Garten, Abbruch, Bau, Sonstiges)**

1. `Personenstunden = Dauer vor Ort × Anzahl Personen`
2. `Arbeitskosten = Personenstunden × Stundensatz`, dazu der Erschwernis-Aufschlag
3. `+ Grundpauschale`, dazu als Nebenkosten Material (+ 10 % Beschaffung),
   Fahrten, Anfahrtszone und Zusatzkosten
4. Falls kein Aufzug: `× (1 + Etagen über EG × 15 %)` auf die Arbeit vor Ort

**Wichtig zur Eingabe:** „Dauer vor Ort" ist die Zeit, die ihr dort seid –
nicht die Personenstunden. Zwei Leute an zwei Tagen sind **16 Stunden**, nicht
32. Die Personenstunden rechnet das Werkzeug selbst.

### Wie die Kundenspanne entsteht

Normalerweise: **Richtwert ±20 %**, auf 10 € gerundet.

Nennt die Anfrage dagegen eine **Mengenspanne** („etwa 22–42 m³"), entsteht die
Preisspanne aus dieser Menge: Die Rechnung läuft zweimal mehr, einmal mit der
unteren und einmal mit der oberen Zahl.

```
Richtwert = Preis bei der MITTE    (32 m³ → 1.353,20 €)
von       = Preis bei min          (22 m³ → 1.010 €)
bis       = Preis bei max          (42 m³ → 1.790 €)
```

**Der Richtwert ist die Mitte, nicht die Obergrenze.** Die Obergrenze ist das
„bis" und steht ohnehin daneben. Ein Richtwert an der Obergrenze wäre im
Schnitt zu teuer und kostet Aufträge, die sich gelohnt hätten. Im Ergebnis
steht ein Hinweis, woher die Spanne kommt.

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
- **Grünschnitt** (`abfallarten.gruenschnitt`, 0 €) – steht auf 0, weil viele
  Höfe Grünschnitt kostenlos annehmen. Nachfragen: Gilt das auch für euch als
  Gewerbe? Wenn nicht, Betrag eintragen.
- **Anlieferungspreis** (`transport.preisProAnlieferung`, 15 €) – prüfen, ob
  der Hof euch als Gewerbe anders einstuft als privat, und ob Bauschutt oder
  gemischte Ladungen mehr kosten.
- **Erschwernisfaktoren** (`stundenAuftrag.erschwernis`) – 1,0 / 1,2 / 1,5 sind
  bewusst niedriger als die Vermüllungsgrade, weil man die Stunden beim
  Stundenauftrag selbst schätzt.
- **Garten-Basisstunden und -Faktoren** (`garten.*`) – stehen alle auf `null`,
  weil niemand sie geraten hat. Solange sie fehlen, wird die Dauer bei
  Gartenaufträgen selbst eingetragen. Die ersten echten Aufträge liefern die
  Zahlen.

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
