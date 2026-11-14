# Datenvertrag – Typen

Alle Typen von RespawnedLearn. Version und Wegweiser stehen in `DATENVERTRAG.md`. Formate wie im Datenvertrag 0.46 von RespawnedNotes VX.

## 5. Typen

### 5.1 Quelle und Anhang

**`quelle`**: externe Herkunft, zum Beispiel ein Datenblatt, Buch, Kurs, Link, Elternbrief oder eine Mail.
```yaml
quellenart: datenblatt     # pdf | buch | kurs | web | mail | brief | foto | audio
url:                       # optional
anhaenge: ["[[ID]]"]       # anhang-Sidecars
autor:                     # optional
```

**`anhang`**: eine Sidecar-Datei zu jeder Originaldatei.
```yaml
datei: anhaenge/2026/10/IMG_2041.jpg   # relativer Pfad, die Wahrheit für die Datei
sha256: …                              # erkennt Verschieben, Umbenennen und neue Annotationen
veraenderlich: false                   # true bei lebenden Dokumenten (annotierte PDFs)
mime: image/jpeg
aufgenommen: 2026-10-19T09:12:00+02:00 # aus EXIF oder Gerät
geraet: android-x1y2                   # Eingangsgerät
ort: { lat: …, lon: … }                # optional
name: Tafelbild Spannungsteiler        # optional, vom Nutzer vergeben
beschreibung: "Aus der Vorlesung\nzweite Hälfte"   # optional, mehrzeilig als JSON-String mit \n
```

`name` und `beschreibung` vergibt nur der Nutzer, `titel` bleibt der Dateiname. Die App zeigt einen Anhang mit `name` unter diesem Namen, sonst unter `titel`; so wird ein Skript umbenannt, ohne Datei, Pfad oder ID zu ändern. Ein leerer Name nimmt das Feld heraus. Ein Buch (Modul mit genau diesem PDF), das bis dahin so hieß wie das PDF, bekommt beim Umbenennen denselben `titel`. Andere Dateien verweisen auf Anhänge immer über die **ID des Sidecars**, nie über den Pfad; den Pfad pflegt nur das Sidecar.

### 5.3 Typen der Lern-App

`frage`, `uebung`, `gleichung`, `erklaerung`, `thema` sowie die Abrufblöcke im Text, wie im Vorschlag der Lern-App beschrieben. Die Felder legt die Lern-App fest und ergänzt sie hier.

**`notiz`** gehört ausschließlich der Lern-App. Lernen ist gerichtet, deshalb verweist jede `notiz` auf ihr Ziel: ein `thema` (Modul, Fähigkeit, Lernziel) oder eine `quelle` (Buch, Video, Kurs). Die Felder dafür legt die Lern-App fest.

Eine `notiz` ohne `thema` und `quelle` zeigt die App unter „Ohne Thema“, dort lässt sich das Thema nachtragen. Notizen, die RespawnedNotes VX aus dem Journal verschoben hat, tragen zusätzlich `aus: Journal <datum>`.

**Mitschrift:** eine `notiz`, deren `thema` ein `modul` ist (Lehrgang oder Vorlesung, auch ohne PDF). Sie ist reines Sammeln von Wissen in normalem Markdown; Fragen stehen nicht darin. Die Überschriften sind die Gliederung, so wie sie dastehen (jede Ebene, Reihenfolge des Textes). Mehrere Mitschriften eines Moduls ordnet die App nach `erstellt`. Eine Lernkarte aus einer Stelle der Mitschrift ist eine eigene `frage` mit `thema` (dasselbe Modul) und `stelle`; in der Mitschrift bekommt nur die letzte Zeile der Stelle einen Anker (`^abc123` am Zeilenende), sonst ändert sich der Text nicht.
```yaml
typ: frage
thema: "[[modul-id]]"
stelle: "[[notiz-id#^k7x2m9]]"   # Absatz in der Mitschrift; die Überschriften darüber sind der Abschnitt der Karte
```

**`modul`** (`lernen/module/<id>.md`): das, was gerade gelernt wird, mit seinen PDFs. Ein **Buch** ist ein Modul mit genau einem PDF; beide werden gleich behandelt. Ein PDF ohne Modul zeigt die App wie ein Buch an; erst ein Stern oder das Zuordnen legt die Moduldatei an.
```yaml
quellen: ["[[anhang-id]]", "[[anhang-id]]"]   # PDFs in Lesereihenfolge; ein PDF steckt in höchstens einem Modul
ziel: Klausur Elektrotechnik 2 im Februar      # optional: was damit erreicht werden soll
favorit: true                                 # optional: steht auf der Startseite und im Menü ganz oben
status: abgeschlossen                         # optional; fehlt das Feld, wird noch daran gelernt
ects: 5                                       # optional ab Lernen 1.7: Leistungspunkte, Zahl > 0 (auch 2.5)
stunden: 40                                   # optional ab 1.7: geplanter Aufwand in Stunden, hat Vorrang vor ects
termin: 2027-02-10                            # optional ab 1.7: Prüfung oder Abgabe (JJJJ-MM-TT)
stundenProWoche: 12                           # optional ab 1.7: so viel Zeit ist je Woche eingeplant
schwer: ["3 Wechselstrom"]                    # optional ab 1.7: Kapitel (Titel aus dem Inhaltsverzeichnis), die doppelt so viel Zeit je Seite bekommen
uebungen: false                               # optional ab 1.7: kein Hinweis „Übung?“ nach einem Abschnitt; fehlt das Feld, gilt true
```
**Umfang und Lernplan** (ab Lernen 1.7): Der Umfang in Stunden ist `stunden`, sonst `ects` mal Stunden je ECTS (`lernen/einstellungen/lernzeit.json`, `{"stundenJeEcts": 30}`, nur wenn vom Standard 30 abweichend; erlaubt 10 bis 60). Der Lernplan wird nicht gespeichert, sondern aus Inhaltsverzeichnis, Seitenzahl der PDFs, Lesestand, Tempo (Lernzeit) und den Feldern oben jederzeit neu gerechnet: Abschnitte sind dieselbe Kapitel-Einheit wie bei den Kapitelfragen (5.7), Pakete Seitenbereiche von etwa 25 Minuten. Ein Paket ist erledigt, wenn der Lesestand über seine letzte Seite hinaus ist. Eigene Einheiten stehen als Aufgabenliste unter der Überschrift `## Lernplan` im Rumpf des Moduls, eine Zeile je Fakt oder Aufgabe, optional mit Seite; die App ändert dort nur das Kästchen einer Zeile und hängt neue Zeilen an:
```markdown
## Lernplan
- [ ] S. 13: Effektivwert = Spitzenwert / √2
- [x] S. 21: Aufgabe 3.4 rechnen
```
Module werden nie gelöscht (Abschnitt 7). Ein herausgenommenes PDF bleibt mit allem Herausgearbeiteten erhalten.

**Lesestand** `lernen/stand/<geraet>.json`: pro PDF die zuletzt gelesene Seite und die Zeit, `{"<anhang-id>": {"seite": 12, "am": "2026-10-21T08:00:00Z"}}`. Jedes Gerät schreibt nur seine eigene Datei, gelesen wird über alle Geräte, der jüngste Eintrag gewinnt. Daraus ergeben sich „Zuletzt bearbeitet“ und die Stelle, an der ein Klick weitermacht. Ohne Lesestand zählt die jüngste Markierung im PDF.

**Lernzeit** `lernen/zeit/JJJJ-MM.<geraet>.jsonl` (ab Lernen 1.7): wie lange an etwas gelernt wurde, eine Zeile je Abschnitt, nur anhängen, jedes Gerät seine eigene Datei; der Monat ist der von `am`. Gemessen wird nur, solange die App sichtbar ist und in den letzten 5 Minuten etwas getan wurde; ein Abschnitt endet nach 5 Minuten ohne Eingabe, beim Verlassen der Ansicht oder der App und wird spätestens alle 5 Minuten geschrieben.
```json
{"ziel": "<modul- oder anhang-id>", "art": "sammeln", "am": "2026-11-14T08:00:00.000Z", "bis": "2026-11-14T08:42:00.000Z", "quelle": "<anhang-id>", "seiten": [12, 19]}
```
`ziel` ist das Lernziel (Modul-ID, bei einem losen PDF die Anhang-ID; zum Modul zählt auch, was `ziel` oder `quelle` auf eines seiner PDFs hat). `art`: `sammeln` (Skript und Notizbücher), `mitschrift` oder `lernen` (Karten, Kapitelfragen). `quelle` und `seiten` (erste und letzte Skriptseite des Abschnitts) nur, wenn ein Skript offen war. Unlesbare Zeilen werden übergangen.

**`notizbuch`** (`lernen/buecher/<id>.md`, ab Lernen 1.3): Schreibseiten, die nicht an einer Skriptseite hängen. Ein Buch gehört keinem Skript; es steht frei oder in einem Modul. Beim Schreiben merkt es sich, welche Skriptseite gerade offen war (Verweise), und Markierungen aus dem Skript landen als Ausschnitt darin.
```yaml
typ: notizbuch
titel: Übungen Kapitel 3
lineatur: kariert          # wie bei den Zeichenblättern; gilt für alle Seiten und lässt sich jederzeit wechseln
modul: "[[modul-id]]"      # optional: gehört zu diesem Modul, sonst frei
status: archiviert         # optional: aus der Auswahl genommen; gelöscht wird ein Buch nie
```
Umbenennen ändert nur `titel` (nie leer) und `geaendert`; Seiten, Markierungen und Verweise hängen an der ID.
Die Seiten liegen im Ordner daneben: `lernen/buecher/<id>/S001.svg` (Tinte, Format 5.4, mindestens A4 hoch, wächst nach unten, kürzer wird sie nie) und `lernen/buecher/<id>/S001.json` mit den Bildern und Verweisen dieser Seite. Die Seiten sind fortlaufend nummeriert; eine Seite entsteht erst mit ihrem ersten Strich oder Bild, leere Seitendateien gibt es nicht.
```json
{"bilder":   [{"id": "m2c8r7tb", "anhang": "01JSKRIPT…", "seite": 12, "bereich": {"x": 0.1, "y": 0.2, "b": 0.5, "h": 0.1}, "x": 48, "y": 380, "b": 600, "h": 120}],
 "verweise": [{"id": "v3k9p2", "y": 96, "anhang": "01JSKRIPT…", "seite": 12, "am": "2026-11-13T10:42:00+01:00"},
              {"id": "v4p1x7", "y": 380, "anhang": "01JSKRIPT…", "seite": 12, "marke": "a7k2c9", "bild": "m2c8r7tb", "am": "2026-11-13T10:44:10+01:00"}]}
```
- `bilder`: wie bei den Zeichenblättern, nur ohne `blatt` (die Seite gehört genau einem Buch).
- `verweise`: wohin die Stelle der Buchseite im Skript zeigt. `y` ist die Höhe auf der Buchseite (Seitenkoordinaten, Breite 1000), `anhang` und `seite` die Skriptseite, `am` optional. Mit `marke` (ID einer Zeile in `lernen/markierungen/<anhang-id>.md`, 5.4) stammt der Verweis aus einer Markierung, sonst hat die App ihn beim Schreiben gesetzt. Verweise sind abgeleitet: Die App darf einen Verweis ohne `marke` entfernen, wenn darunter bis zum nächsten Verweis nichts mehr geschrieben steht. `bild` (ab Lernen 1.5, nur mit `marke`) ist die `id` des Ausschnitts auf derselben Seite, der zu dieser Markierung gehört; er bleibt richtig, auch wenn der Ausschnitt verschoben wird. Einen Verweis mit `marke` entfernt nur der Nutzer („Marke entfernen“), dann mit ihm den Ausschnitt: den aus `bild`, bei älteren Verweisen ohne `bild` den Ausschnitt derselben Skriptseite (`anhang`, `seite`) auf derselben Höhe `y`. Gibt es keinen solchen Ausschnitt mehr, geht nur der Verweis. Die Markierung im Skript (5.4) und alles andere auf der Seite bleiben.
- Unbekannte Felder in `S001.json` bleiben erhalten.

**Anordnung im Übungsplatz**: Welche Ansichten neben einem Skript stehen (am PC nebeneinander, am Handy eine mit Umschalter), steht pro PDF in `lernen/blaetter/<anhang-id>/anordnung.json` und gilt für alle Geräte. Die Reihenfolge der Liste ist die Reihenfolge auf dem Schirm, `breite` der Anteil an der Breite relativ zu den anderen offenen Ansichten.
```json
{"schema": 2,
 "ansichten": [{"art": "pdf", "id": "pdf", "breite": 2},
               {"art": "buch", "id": "01JNB8…", "breite": 1.5},
               {"art": "buch", "id": "01JNC2…", "breite": 1.5, "zu": true}]}
```
- `art`: `pdf` (das Skript, genau einmal, `id: pdf`) oder `buch` (`id` = ID des Notizbuchs). `zu: true` blendet aus, das Buch bleibt. Mindestens eine Ansicht bleibt offen.
- Fehlt die Datei, steht das Skript allein da.
- Eine Anordnung ohne `schema: 2` stammt aus Lernen 1.2 oder früher und enthält noch Zeichenblätter (`art: blatt`); sie wird beim ersten Öffnen des Skripts angehoben (siehe unten).

**Zeichenblätter (bis Lernen 1.2, werden angehoben):** Früher hing an jeder Skriptseite je Blatt eine eigene Schreibseite: Anordnung mit `{"art": "blatt", "id": "1", "lineatur": "kariert"}`, Tinte in `lernen/blaetter/<anhang-id>/S001.svg` (Blatt `1`) bzw. `S001-<blatt>.svg`, Bilder in `S001-bilder.json` mit Feld `blatt`. Fehlte die Anordnung, galt Blatt `1` mit Kästchen.

**Anheben (Migration auf Lernen 1.3)**: Beim ersten Öffnen eines Skripts, dessen Anordnung kein `schema: 2` trägt oder fehlt, obwohl alte Blätter da sind, wird jedes Blatt mit Inhalt zu einem Notizbuch:
- Die ID ist abgeleitet, nicht zufällig: Zeitteil der Anhang-ID plus eine Prüfsumme aus Anhang-ID und Blatt-ID (gültige ULID). `erstellt` und `geaendert` übernimmt das Buch vom Anhang, `titel` ist der Titel des Skripts (weitere Blätter mit Lineatur dahinter), `lineatur` die des Blatts, `modul` das Modul des Skripts. Damit schreiben zwei Geräte, die gleichzeitig anheben, byte-gleiche Dateien.
- Nur Skriptseiten mit Strichen oder Bildern werden Buchseiten, in Seitenreihenfolge. Die Tinte wird byte-genau übernommen (fehlt sie bei einer Seite mit Bildern, entsteht eine leere A4-Seite), die Bilder ohne `blatt`, und jede Buchseite bekommt oben einen Verweis (`y: 0`, ohne `am`) auf ihre Skriptseite.
- In der Anordnung wird aus `{"art": "blatt"}` ein `{"art": "buch"}` mit derselben Breite und demselben `zu`; Blätter ohne Inhalt fallen weg. Dazu `schema: 2`.
- Die alten Dateien in `lernen/blaetter/<anhang-id>/` bleiben unverändert liegen (Archiv, Grundlagen 7) und werden danach nicht mehr gelesen.

**Heft für ein Buch auf Papier**: Ab Lernen 1.3 legt „Buch ohne PDF“ ein Notizbuch ohne Skript an (kein leeres PDF mehr, keine Grenze bei 60 Seiten). Bis Lernen 1.2 entstand ein leeres PDF (A4 hoch, 60 Seiten) als Anhang mit `art: skript` und `heft: <lineatur>`, als Buch (Modul mit diesem PDF) mit ausgeblendetem Skript und Blatt `1`. Solche Hefte werden wie jedes Skript angehoben; ihr Notizbuch trägt das Modul des Hefts, die Verweise zeigen auf die Seiten des leeren PDFs. Das PDF bleibt liegen.

**Inhaltsverzeichnis** `lernen/inhalt/<anhang-id>.json`: die Kapitel eines PDFs mit der PDF-Seite (nicht der gedruckten Seitenzahl), gelesen beim ersten Öffnen. Vorrang hat die eingebettete Gliederung (Lesezeichen) des PDFs (`herkunft: pdf`), sonst die gedruckten Inhaltsseiten am Anfang, deren Seitenzahlen über die Seitenlabels oder den Versatz zu den Kapitelanfängen umgerechnet werden (`herkunft: gedruckt`); findet sich nichts, steht `herkunft: keins`. Man kann Kapitel setzen, Seiten korrigieren und Einträge entfernen; danach steht `eigen: true` und das Verzeichnis wird nie mehr automatisch überschrieben. `version` ist die Version des Auslesens: eine neuere darf ein nicht eigenes Verzeichnis ersetzen.
```json
{"herkunft": "pdf", "version": 1, "kapitel": [{"titel": "1.2 Spannungsteiler", "seite": 9, "ebene": 2}]}
```

**`anhang`** eines Skripts trägt `art: skript`; ein bis Lernen 1.2 erzeugtes leeres Heft zusätzlich `heft: <lineatur>` (siehe Heft). Sidecars mit `art: plan` oder `projekt` stammen aus RespawnedNotes VX und bleiben unberührt.

### 5.4 Markierungen und Handschrift (beide Apps)

**`markierungen`**: eine Begleitdatei pro PDF (`lernen/markierungen/<anhang-id>.md`), eine Zeile pro Stelle. Der Bereich steht relativ zur Seite (0 bis 1: x, y, Breite, Höhe), danach das Datum und optional die Farbe:
```
- S. 1 · Merksatz Spannungsteiler %%rn 0.120 0.300 0.430 0.080 2026-10-19 wichtig%% ^a7k2c9
- S. 31 · [[01JB…|Spannung]] %%rn 0.100 0.500 0.600 0.120 2026-10-19%% ^b8m3d0
```
```yaml
anhang: "[[ID]]"
```
- Der Text einer Stelle verweist auf die Karte, die daraus entstand. So zeigt „Nutzen“ die Spur zurück ins Skript.
- **Baustein** (ab Lernen 1.8): Jede Markierung ist ein Baustein, den man in allen Skripten wiederfindet. Ihr Text besteht aus dem Namen, Schlagworten und Verweisen in beliebiger Reihenfolge, getrennt durch Leerzeichen: `#wort` ist ein Schlagwort (Buchstaben, Ziffern, `-`, `_`, `/`), `[[ID|Titel]]` ein Verweis auf eine Karte, der Rest ist der Name.
  ```
  - S. 12 · Stammfunktion umformen #integral #stammfunktion [[01JB…|Wie lautet die Stammfunktion von x^n?]] %%rn 0.100 0.400 0.700 0.100 2026-11-14%% ^c4n8q1
  - S. 40 · %%rn 0.200 0.300 0.500 0.150 2026-11-14%% ^d5p9r2
  - S. 7 · Alte Übung #archiv %%rn 0.100 0.100 0.800 0.300 2026-11-14%% ^e6q0s3
  ```
  - Name fehlt: Dann gilt der Titel des ersten Verweises. Der Text `Markiert` (so schrieb „Nur markieren“ bis Lernen 1.6) zählt als kein Name.
  - **Offen** ist ein Baustein ohne Name, ohne Schlagwort und ohne Verweis. Die App zeigt offene Bausteine, damit man sie benennt oder weglegt.
  - `#archiv` heißt weggelegt: Der Baustein erscheint nicht mehr unter „Offen“ und nicht in der Suche, die Markierung im Skript bleibt. Entfernt man `#archiv`, ist er wieder da. Die App löscht keinen Baustein.
  - Benennt man einen Baustein um, ändert die App nur Name und Schlagworte; Verweise bleiben stehen.
  - Ältere Apps lesen den Text weiter als Ganzes, darum bleibt das Format der Zeile gleich.
- **Im Notizbuch** (ab Lernen 1.9): Auch eigene Seiten lassen sich markieren. Die Markierungen eines Buchs stehen in `lernen/markierungen/<buch-id>.md` (Kopf `buch: "[[ID]]"` statt `anhang`), eine Zeile je Stelle wie oben; `S.` ist die Buchseite (5.3). Weil Buchseiten nach unten wachsen, stehen alle vier Maße in Seitenbreiten: x und Breite zwischen 0 und 1, y und Höhe ab 0 und auch größer als 1 (auf einer A4-Seite reicht y bis 1,414). Die Stelle bleibt so an ihrem Platz, wenn die Seite länger wird. Jede Markierung im Buch ist ein Baustein wie im Skript; ein Verweis `![[<buch-id>#seite=2&marke=b7x2q1|…]]` zeigt den Ausschnitt der Buchseite mit Tinte und Bildern.
  ```
  - S. 2 · Eigene Herleitung #integral %%rn 0.080 1.120 0.840 0.260 2026-11-14%% ^b7x2q1
  ```
- **Verschieben und skalieren** (Skript und Notizbuch): Der Nutzer darf den Bereich einer Rechteck-Markierung nachträglich ändern. Die App ersetzt dann nur die vier Maße in ihrer Zeile; Text, Datum, Farbe und ID bleiben, Verweise auf die Markierung zeigen danach den neuen Ausschnitt. Das Format ändert sich dadurch nicht.
- **In der Mitschrift** (ab Lernen 1.10): Markierter Text einer Mitschrift (`notiz`, 5.3) wird ein Baustein. Die App setzt an die letzte Zeile seines Absatzes eine Blockkennung `^anker` (wie für Lernkarten aus der Mitschrift) und schreibt in `lernen/markierungen/<notiz-id>.md` (Kopf `notiz: "[[ID]]"`) eine Zeile mit der Kennung statt Seite und Bereich, danach das Datum und optional die Farbe:
  ```
  - ^k3m9 · Maschenregel #kirchhoff %%rt 2026-11-14%% ^b7x2q1
  ```
  Text des Bausteins ist der Absatz, an dessen Ende die Kennung steht (nach oben bis zur Leerzeile oder Überschrift). Je Kennung gibt es höchstens einen Baustein; eine Lernkarte aus derselben Stelle hängt ihren Verweis an diese Zeile. Fehlt die Kennung in der Mitschrift, bleibt die Zeile stehen und die App sagt, dass die Stelle fehlt. Ältere Apps erkennen die Zeile nicht und lassen sie unverändert.

**Handschrift** pro Seite als SVG mit der Breite 1000 (`lernen/tinte/<anhang-id>/S001.svg`, Zeichenblätter in `lernen/blaetter/`, 5.3). Ein `<path>` pro Strich als gefüllter Umriss, dazu `data-farbe`, `data-w` (Breite) und `data-pts="x y druck,…"` für spätere Erkennung. Benannte Farben: `alltag` (Blau), `alltag_schwarz`, `wichtig` (Rot), `ergaenzung` (Grün).

### 5.5 Lernkarten und Protokoll

- **Wissenskarte** (`erklaerung`) aus einer Stelle: Der Rumpf beginnt mit dem Ausschnitt, darunter steht der Text in eigenen Worten. Entsteht sie aus „Erklären“ (5.8), steht die Erklärung der KI samt Rückfragen am Ende als eingeklappter Block, getrennt vom eigenen Text:
  ```
  ![[anhang-id#seite=12&marke=a7k2c9|Elektronik, S. 12]]

  In eigenen Worten:

  > [!ki]- Erklärung der KI vom 2026-10-31
  > Die Spannung teilt sich im Verhältnis der Widerstände auf …
  >
  > Rückfrage: Warum fällt an R2 mehr ab?
  >
  > Weil …
  ```
  Die App schreibt den Block nur beim Anlegen. Danach gehört er dem Nutzer wie der Rest der Karte.
- **Lernkarte** (`frage`): `?? Frage` und `:: Antwort`. Aus einer Stelle ist der Ausschnitt die Antwort.
- **Protokoll** `reviews/JJJJ-MM.<geraet>.jsonl`, eine Zeile pro Wiederholung: `{"karte":"ID","am":"2026-10-19T18:47:46Z","note":"gut","sicher":"eher_sicher"}`. Noten: `nochmal`, `schwer`, `gut`, `leicht`. `sicher` ist die Einschätzung vor dem Aufdecken. Den Lernstand berechnet die App daraus (FSRS); er steht nirgends sonst.

### 5.7 Fragen zum Kapitel

Der Erzeuger der Fragen (Grundlagen 6) erzeugt Fragen zu dem Kapitel, in dem gerade gelesen wird; in RespawnedLearn auf Knopfdruck („Fragen zu … erzeugen“), angeboten, solange das aktuelle Kapitel keine fertigen Fragen hat. Nach jedem Schritt schreibt er auf den neuesten Stand der Datei, sodass ein Abbruch oder ein zweites Gerät nichts Erreichtes verliert; ein Knopfdruck setzt ein Kapitel mit `fehler` wieder auf `laeuft`. Eine unlesbare Fragendatei überschreibt er nie. Grundlage sind der Lesestand (5.3, jüngster Eintrag aller Geräte, höchstens 14 Tage alt) und das Inhaltsverzeichnis. Als Kapitel gilt dieselbe Einheit wie in der Modulübersicht: die oberste Ebene, bei Büchern mit weniger als drei Teilen eine Ebene tiefer; es endet vor dem nächsten Eintrag dieser Einheit, höchstens nach 40 Seiten. Den Text liest er in Stücken von 5 Seiten aus dem PDF. Seiten ohne Text (Scans) gehen nicht an die KI.

**`lernen/fragen/<anhang-id>/S<erste Seite>.json`**: eine Datei pro Kapitel, sie wächst Stück für Stück.
```json
{"anhang": "01J…", "kapitel": "2 Spannungsteiler", "von": 12, "bis": 19, "status": "laeuft", "modell": "sonnet",
 "abschnitte": [{"von": 12, "bis": 16, "kern": "Worum es geht"}],
 "fragen": [{"id": "12-1", "art": "verstaendnis", "frage": "Warum …?", "antwort": "Kernpunkte", "seite": 13},
            {"id": "kapitel-1", "art": "sokratisch", "frage": "Wo liegen die Grenzen …?", "antwort": "- Denkanstoß", "seite": 19}]}
```
- `status`: `laeuft`, `fertig`, `kein_text` (nichts Lesbares im PDF) oder `fehler` (nach drei Fehlversuchen, `fehler` nennt den Grund). Ein Stück, das in `abschnitte` steht, ist erledigt; danach geht es beim nächsten weiter.
- `art`: `verstaendnis` (in eigenen Worten abrufen, bevorzugt Warum und Wie, `antwort` mit den Kernpunkten), `sokratisch` (offen, `antwort` sind Denkanstöße) oder `rechnen` (Rechenaufgabe, `antwort` ist nur das Endergebnis).
- Rechenaufgaben entstehen in einem eigenen Durchgang je Abschnitt mit Lernstoff, auch in Kapiteln, deren Fragen schon `fertig` sind; erledigt ist ein Abschnitt, wenn in `abschnitte` `"rechnen": true` steht. Die Aufgabe nennt nur Gegebenes und Gesuchtes, nie den Weg. Dazu `tipps` (gestufte Hinweise ohne Zahlen), `schritte` (ein möglicher Weg: `ziel` ohne Zahlen, `rechnung`, `ergebnis`) und optional `wege` (andere Wege in Worten). Die App deckt in Stufen auf: Tipps, dann je Schritt erst das Teilziel, dann die Rechnung; das Ergebnis lässt sich für sich prüfen.
  ```json
  {"id": "12-r1", "art": "rechnen", "frage": "…", "antwort": "$U_2 \\approx 3{,}8\\,V$", "seite": 13, "tipps": ["…"], "schritte": [{"ziel": "Gesamtwiderstand bestimmen", "rechnung": "$R = R_1 + R_2$", "ergebnis": "$6{,}9\\,k\\Omega$"}], "wege": "…"}
  ``` `seite` ist die PDF-Seite des Stoffs. Fragen mit `kapitel-…` gelten dem ganzen Kapitel und stehen auf der letzten Seite.
- Die Lern-App zeigt eine Frage erst, wenn bis zu ihrer Seite gelesen ist, also im Kapitel, in dem gerade gelesen wird, bis zur aktuellen Seite.

**`lernen/fragen-stand/<geraet>.json`**: was ein Gerät erledigt hat, `{"<anhang-id>/<von>/<id>": {"am": "2026-10-21T19:00:00Z", "wie": "erledigt"}}`; `wie: karte` mit `karte: "<id>"`, wenn daraus eine Lernkarte (`frage`, 5.5) wurde. Gelesen wird über alle Geräte. Die Fragedatei selbst ändert die App nie.

### 5.8 Vorfragen, Rückmeldung und Erklären (Lernen)

**Vorfragen** `lernen/vorfragen/<JJJJ-MM-TT>.json`: Auf Knopfdruck in der Lern-App liest der Erzeuger die nächsten Seiten (ab der aktuellen, sechs Seiten) der höchstens zwei zuletzt gelesenen Bücher (Lesestand höchstens 14 Tage alt, Seiten ohne Text zählen nicht) und erzeugt Fragen, die vor dem Lesen beantwortet werden. Einmal pro Tag und Lesestand: ist seitdem nicht weitergelesen, kommt dieselbe Datei zurück; „Neue Vorfragen“ ersetzt sie. Was davon schon gemacht ist, merkt sich nur das Gerät (localStorage).
```json
{"datum": "2026-10-22", "erstellt": "2026-10-22T06:30:00Z", "modell": "sonnet",
 "buecher": [{"anhang": "01J…", "titel": "Elektronik", "ab": 12, "bis": 17, "kapitel": "2 Spannungsteiler"}],
 "fragen": [{"id": "1", "anhang": "01J…", "seite": 13, "frage": "Was passiert, wenn …?", "antwort": "Kern aus dem Text"}]}
```

**Rückmeldung** auf eine eigene Antwort (Lernkarte, Kapitelfrage, Rechenaufgabe): Die Handschrift der Schreibfläche geht als PNG, Getipptes als Text an die KI, zusammen mit Frage und Musterlösung. Zurück kommen `urteil` (`richtig`, `teilweise`, `falsch`, `leer`), `gelesen`, `richtig`, `fehlt`, `fehler` und `tipp`, ohne die Lösung zu verraten. Nichts davon wird gespeichert.

**Erklären** einer markierten Stelle im Skript: Der markierte Text, der Text der ganzen Seite als Zusammenhang (bei Scans ein Bild der Stelle) und der bisherige Verlauf gehen an die KI (`verlauf: [{"von": "ki" | "ich", "text": "…"}]`). Zurück kommen `antwort` (einfache Erklärung oder Antwort auf die letzte Rückfrage) und `begriff` (Kernbegriff der Stelle). Die KI merkt sich nichts, und weder Markierung noch Erklärung werden gespeichert. Erst „Als Wissenskarte behalten“ legt wie „Wissenskarte“ eine Markierung und eine `erklaerung` an, mit `begriff` als Titel und dem Verlauf als `[!ki]`-Block (5.5).

**KI-Anweisungen** `lernen/einstellungen/ki-prompts.json`: Die Anweisungen (System-Prompts) an die KI sind in der App vorausgefüllt und lassen sich in den Einstellungen ändern. In der Datei steht nur, was vom Standard der App abweicht; „Standard“ entfernt den Eintrag wieder. So gelten auf allen Geräten dieselben Anweisungen, und ein verbesserter Standard aus einem Update kommt bei allen an, die ihn nicht geändert haben. Das Antwortformat (JSON-Schema) gehört nicht zur Anweisung und ist nicht änderbar; die App prüft jede Antwort dagegen, bevor sie etwas speichert.
```json
{"prompts": {"erklaeren": "Du erklärst …", "rueckmeldung": "…"}}
```
Schlüssel: `erklaeren`, `rueckmeldung`, `vorschlag`, `korrektur`, `kapitel_stueck`, `kapitel_ganz`, `kapitel_rechnen`, `vorfragen`. Unbekannte Schlüssel bleiben beim Schreiben erhalten. `modell` in Fragen- und Vorfragen-Dateien (5.7, 5.8) nennt seit Lernen 1.1 Anbieter und Modell, z. B. `"anthropic/claude-opus-5-5"` (früher nur `"sonnet"`).

**Gemeinsamer KI-Zugang** `lernen/einstellungen/ki-zugang.verschluesselt.json` (seit Lernen 1.2, freiwillig): derselbe KI-Zugang auf allen eigenen Geräten, verschlüsselt mit einem Passwort. Umschlagverfahren: Ein zufälliger Datenschlüssel (32 Byte) verschlüsselt den Inhalt mit XChaCha20-Poly1305; aus dem Passwort leitet Argon2id (RFC 9106, Version 0x13) einen Schlüssel ab, der nur den Datenschlüssel einhüllt. Alle Bytes stehen als Kleinbuchstaben-Hex.
```json
{"schema": 1, "verfahren": "argon2id+xchacha20poly1305", "kennung": "<16 Byte>",
 "passwort": {"m_kib": 65536, "t": 3, "p": 1, "salz": "<16 Byte>", "nonce": "<24 Byte>", "schluessel": "<Datenschlüssel + 16 Byte Prüfsumme>"},
 "inhalt": {"nonce": "<24 Byte>", "daten": "<verschlüsselter Inhalt + 16 Byte Prüfsumme>"}}
```
- Zusätzliche Daten (an die Verschlüsselung gebunden, damit jede Änderung am Kopf auffällt): für den Datenschlüssel `respawnedlearn ki-zugang 1|passwort|<kennung>|<m_kib>|<t>|<p>|<salz>`, für den Inhalt `respawnedlearn ki-zugang 1|inhalt|<kennung>`.
- Kosten: Standard 64 MiB, 3 Durchgänge, 1 Bahn. Eine Datei außerhalb von 19 MiB bis 512 MiB, 2 bis 16 Durchgängen, 1 bis 8 Bahnen wird nicht geöffnet.
- Inhalt (entschlüsselt) ist JSON: `{"anbieter": "anthropic", "zugaenge": {"anthropic": {"schluessel": "…", "modell": "…"}, "ollama": {"adresse": "http://…:11434", "modell": "…"}}}`. Unbekannte Felder und Anbieter bleiben beim Schreiben erhalten.
- Jede Änderung (neuer Schlüssel, anderes Modell) verschlüsselt nur den Inhalt neu; `kennung` und `passwort` bleiben gleich, andere Geräte lesen ohne neue Eingabe weiter. „Passwort ändern“ und „Neu anfangen“ (Passwort vergessen) legen die Datei mit neuem Datenschlüssel und neuer `kennung` an; Geräte mit der alten Kennung fragen dann einmal nach dem Passwort.
- Ein Gerät tritt mit dem Passwort bei; was nur dieses Gerät kannte (Anbieter ohne Eintrag in der Datei), kommt dazu, sonst gilt die Datei. Wer auf einem Gerät nicht mehr teilt, behält eine Kopie nur auf diesem Gerät; die Datei bleibt.
- Konfliktkopien (8) zeigt die App entschlüsselt, Schlüssel nur mit den letzten vier Zeichen.
