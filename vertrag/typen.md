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

`name` und `beschreibung` vergibt nur der Nutzer, `titel` bleibt der Dateiname. Andere Dateien verweisen auf Anhänge immer über die **ID des Sidecars**, nie über den Pfad; den Pfad pflegt nur das Sidecar.

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
```
Module werden nie gelöscht (Abschnitt 7). Ein herausgenommenes PDF bleibt mit allem Herausgearbeiteten erhalten.

**Lesestand** `lernen/stand/<geraet>.json`: pro PDF die zuletzt gelesene Seite und die Zeit, `{"<anhang-id>": {"seite": 12, "am": "2026-10-21T08:00:00Z"}}`. Jedes Gerät schreibt nur seine eigene Datei, gelesen wird über alle Geräte, der jüngste Eintrag gewinnt. Daraus ergeben sich „Zuletzt bearbeitet“ und die Stelle, an der ein Klick weitermacht. Ohne Lesestand zählt die jüngste Markierung im PDF.

**Zeichenblätter** neben dem Skript: Welche Ansichten im Übungsplatz nebeneinander stehen (am Handy untereinander), steht pro PDF in `lernen/blaetter/<anhang-id>/anordnung.json` und gilt für alle Seiten und Geräte. Die Reihenfolge der Liste ist die Reihenfolge auf dem Schirm, `breite` ist der Anteil an der Breite relativ zu den anderen offenen Ansichten.
```json
{"ansichten": [{"art": "pdf", "id": "pdf", "breite": 2},
               {"art": "blatt", "id": "1", "lineatur": "kariert", "breite": 1.5},
               {"art": "blatt", "id": "k7x2m9", "lineatur": "millimeter", "breite": 1.5, "zu": true}]}
```
- `art`: `pdf` (das Skript, genau einmal, `id: pdf`) oder `blatt`. Die `id` eines Blatts besteht aus Kleinbuchstaben und Ziffern; das erste heißt `1`.
- `lineatur`: `kariert` (5 mm), `liniert` (8 mm), `punkte` (5 mm), `millimeter` (1/5/10 mm), `noten` (12 Systeme pro A4) oder `leer`. Die Maße beziehen sich auf A4-Breite (210 mm = 1000 Seitenkoordinaten), die Linien stehen also auf jedem Gerät an derselben Stelle der Tinte. Die Lineatur gehört nicht zur Tinte und lässt sich jederzeit wechseln.
- `zu: true`: ausgeblendet. Ein Blatt, das auf irgendeiner Seite Tinte hat, wird beim Schließen nur ausgeblendet und lässt sich wieder öffnen; ein Blatt ohne Tinte fällt aus der Liste. Mindestens eine Ansicht bleibt offen.
- Fehlt die Datei, gilt: Skript (`breite` 3) und Blatt `1` mit Kästchen (`breite` 2).

Die Tinte liegt pro Skriptseite und Blatt in `lernen/blaetter/<anhang-id>/S001.svg` (Blatt `1`, das erste Blatt) bzw. `S001-<blatt>.svg` (Format wie 5.4). Ein Blatt ist mindestens A4 hoch (Höhe 1414 bei Breite 1000); „Platz nach unten“ macht es um eine A4-Höhe länger, indem die SVG-Höhe wächst. Kürzer wird es nie, damit keine Striche abgeschnitten werden.

**Bilder auf Blättern**: Fotos (Kamera, Galerie, Einfügen aus der Zwischenablage) und Ausschnitte aus dem PDF („Ins Blatt“ an einer markierten Stelle, z. B. eine Aufgabe) liegen pro Skriptseite in `lernen/blaetter/<anhang-id>/S001-bilder.json`, unter der Tinte, sodass sich darauf schreiben lässt.
```json
{"bilder": [{"id": "x3k9p2qa", "blatt": "1", "anhang": "01JFOTO…", "x": 48, "y": 48, "b": 700, "h": 525},
            {"id": "m2c8r7tb", "blatt": "k7x2m9", "anhang": "01JSKRIPT…", "seite": 3, "bereich": {"x": 0.1, "y": 0.2, "b": 0.5, "h": 0.25}, "x": 48, "y": 597, "b": 700, "h": 248}]}
```
- `blatt`: auf welchem Blatt der Seite; `x`, `y`, `b`, `h` in Seitenkoordinaten dieses Blatts (Breite 1000). Das Seitenverhältnis bleibt beim Vergrößern erhalten.
- `anhang`: Sidecar-ID (5.1). Ein Foto wird wie jedes andere als Anhang abgelegt (Original nach `anhaenge/`). Bei einem PDF stehen `seite` und `bereich` (Anteile der Seite wie bei Markierungen) dabei; die App schneidet den Ausschnitt beim Anzeigen aus, es entsteht keine Bilddatei.
- Ein Bild vom Blatt nehmen löscht nur den Eintrag, nie das Foto oder das PDF.

**Heft für ein Buch auf Papier**: „Buch ohne PDF“ erzeugt in der App ein leeres PDF (A4 hoch, 60 Seiten) mit der gewählten Lineatur auf jeder Seite, legt es als Anhang mit `art: skript` und `heft: <lineatur>` ab und macht daraus ein Buch (Modul mit diesem PDF). So gelten Seiten, Lesestand und Module wie bei jedem Buch. Die Anordnung wird gleich mitgeschrieben: Skript ausgeblendet, Blatt `1` mit derselben Lineatur. Das PDF lässt sich wie jedes andere einblenden, beschreiben und drucken.

**Inhaltsverzeichnis** `lernen/inhalt/<anhang-id>.json`: die Kapitel eines PDFs mit der PDF-Seite (nicht der gedruckten Seitenzahl), gelesen beim ersten Öffnen. Vorrang hat die eingebettete Gliederung (Lesezeichen) des PDFs (`herkunft: pdf`), sonst die gedruckten Inhaltsseiten am Anfang, deren Seitenzahlen über die Seitenlabels oder den Versatz zu den Kapitelanfängen umgerechnet werden (`herkunft: gedruckt`); findet sich nichts, steht `herkunft: keins`. Man kann Kapitel setzen, Seiten korrigieren und Einträge entfernen; danach steht `eigen: true` und das Verzeichnis wird nie mehr automatisch überschrieben. `version` ist die Version des Auslesens: eine neuere darf ein nicht eigenes Verzeichnis ersetzen.
```json
{"herkunft": "pdf", "version": 1, "kapitel": [{"titel": "1.2 Spannungsteiler", "seite": 9, "ebene": 2}]}
```

**`anhang`** eines Skripts trägt `art: skript`; ein von der App erzeugtes leeres Heft zusätzlich `heft: <lineatur>` (siehe Zeichenblätter). Sidecars mit `art: plan` oder `projekt` stammen aus RespawnedNotes VX und bleiben unberührt.

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
