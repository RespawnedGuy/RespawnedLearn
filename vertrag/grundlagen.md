# Datenvertrag – Grundlagen

Grundsätze, Ordnerstruktur, Dateien, Links, Eigentum, Löschen, Sync und offene Punkte. Version und Wegweiser stehen in `DATENVERTRAG.md`.

## 1. Grundsätze

1. **Eine Wahrheit.** Der Datenordner auf der Platte (Markdown mit YAML-Frontmatter, JSON, SVG und Originale) ist die einzige Quelle der Wahrheit. Es gibt keinen Server. Was die App daraus berechnet (Index, Lernstand), hält sie nur im Arbeitsspeicher.
2. **Abgleich nur über Dateien.** Geräte gleichen den Ordner mit einem beliebigen Sync-Programm ab (Syncthing, Nextcloud, Dropbox, OneDrive, Google Drive für Desktop, iCloud Drive unter Windows, am Handy z. B. FolderSync); die App kennt keines davon direkt. Die App reagiert auf Dateiänderungen (Dateiüberwachung, unter Android zusätzlich regelmäßiger Vergleich der Dateiliste) und spricht mit keinem anderen Gerät direkt.
3. **Unbekanntes bleibt erhalten.** Die App löscht, sortiert oder normalisiert keine Frontmatter-Felder, Textblöcke oder Dateien, die sie nicht kennt.
4. **Originale sind unantastbar.** Fotos und PDFs werden nach dem Ablegen nie verändert. Handschrift, Markierungen und Blätter liegen in eigenen Dateien daneben.
5. **Wissen wird nie gelöscht.** Dateien werden nur aktualisiert. Ältere Stände hält die Dateiversionierung des Sync-Programms (Syncthing: „Gestaffelt“ empfohlen; Cloud-Dienste: Versionsverlauf und Papierkorb).

## 2. Ordnerstruktur

Dateinamen und Unterordner sind frei wählbar, weil Links über IDs laufen. Die oberste Ebene ist festgelegt.

```
/
├─ gemeinsam/        quelle, anhang-Sidecars
├─ lernen/
│  ├─ vertrag.json                 Vertragsmarke: höchste Vertragsversion, mit der ein Gerät hier schreibt (8, ab Lernen 1.6)
│  ├─ karten/<id>.md               Wissenskarten und Lernkarten
│  ├─ module/<id>.md               Module und Bücher (Lernziel mit seinen PDFs)
│  ├─ stand/<geraet>.json          Lesestand je Gerät
│  ├─ inhalt/<anhang-id>.json      Inhaltsverzeichnis eines PDFs
│  ├─ fragen/<anhang-id>/S012.json Fragen zu einem Kapitel (5.7)
│  ├─ fragen-stand/<geraet>.json   welche Kapitelfragen ein Gerät erledigt hat
│  ├─ vorfragen/<datum>.json       Vorfragen eines Tages (5.8)
│  ├─ einstellungen/ki-prompts.json eigene KI-Anweisungen, nur Abweichungen vom Standard (5.8)
│  ├─ einstellungen/ki-zugang.verschluesselt.json KI-Zugang, verschlüsselt, für alle eigenen Geräte (5.8)
│  ├─ markierungen/<anhang-id>.md  Stellen in Skripten
│  ├─ tinte/<anhang-id>/S001.svg   Handschrift im Skript
│  ├─ buecher/<id>.md, <id>/       Notizbücher: Steckbrief, je Seite S001.svg und S001.json (ab Lernen 1.3)
│  └─ blaetter/<anhang-id>/        anordnung.json je Skript; alte Zeichenblätter (bis 1.2, nur noch Archiv)
├─ anhaenge/JJJJ/MM/ Originaldateien (PDF, JPG …), unveränderlich
└─ reviews/          Wiederholungsprotokoll, je Gerät eine Datei
```

Nicht zu den Daten gehören und werden von der App übergangen: `.stfolder/`, `.stversions/` (Syncthing), `.dropbox.cache/` (Dropbox), `.git/`, `.index/`, `.geheim/`, Zwischendateien (`.syncthing.<name>.tmp`, `~syncthing~*`) sowie Sperr- und Verwaltungsdateien anderer Programme (ab Lernen 1.4, nach der Ausschlussliste des Nextcloud-Clients): `~$*`, `.~lock.*`, `*~`, `~*.tmp`, `*.part`, `*.filepart`, `*.crdownload`, `._*`, `.DS_Store`, `Thumbs.db`, `desktop.ini`, `.sync_*.db*`, `.csync_journal.db*`, `.owncloudsync.log*`, `.nextcloudsync.log*`, `.nextcloudpermissions.log*`. Ordner `arbeit/` aus RespawnedNotes VX dürfen im selben Ordner liegen; die App liest sie nicht aus und ändert sie nie.

## 3. Dateien und Pflichtfelder

```yaml
---
id: 01JAB3K7Q8X2M4N5P6R7S8T9V0     # ULID, unveränderlich
typ: frage
erstellt: 2026-10-19T15:32:34+02:00 # ISO 8601 mit Zeitzone
geaendert: 2026-10-19T15:40:00+02:00
titel: Spannungsteiler
# optional:
thema: "[[01J…]]"
tags: [lernen/elektrotechnik]
---
```

- **Feldnamen:** Kleinbuchstaben, `snake_case`, Deutsch, ohne Umlaute.
- **`titel`** ist Pflicht, weil Dateinamen frei sind und Links nur IDs enthalten.
- **`geaendert`** wird nur bei einer inhaltlichen Änderung gesetzt. Reagiert die App auf eine Änderung von außen, ohne selbst etwas zu ändern, schreibt sie nicht (sonst schaukeln sich Geräte über Syncthing auf).
- **`schema`** (optional, Zahl): Version des Typschemas, fehlt es, gilt 1.

## 4. Links und Einbettungen

| Syntax | Bedeutung |
|---|---|
| `[[ID]]`, `[[ID\|Text]]` | Link, mit Anzeigetext |
| `[[ID#abschnitt]]` | Link auf eine Überschrift (Slug) |
| `[[ID#^anker]]` | Link auf eine Zeile mit Anker `^anker` am Zeilenende |
| `[[ID#seite=12]]` | Link auf eine PDF-Seite |
| `![[ID#seite=12&marke=a7k2c9\|Text]]` | markierte Stelle auf einer PDF-Seite, angezeigt als Ausschnitt (5.4) |
| `![[ID]]` | Einbettung, immer der aktuelle Stand |

- Links in Frontmatter-Feldern stehen als String in Anführungszeichen: `thema: "[[01J…]]"`.
- Ein Link auf eine fehlende ID wird als „nicht gefunden“ angezeigt und nie automatisch entfernt. Das kommt vor, solange Syncthing eine Datei noch nicht gebracht hat.

## 6. Eigentum

| Was | Schreibt | Andere |
|---|---|---|
| `lernen/**`, `reviews/`, Typen aus 5.3 bis 5.5 | RespawnedLearn | lesen |
| `lernen/fragen/**`, `lernen/vorfragen/**` (5.7, 5.8) | der Erzeuger der Fragen: RespawnedLearn auf Knopfdruck mit dem KI-Zugang des Geräts (früher der Server von RespawnedNotes VX) | lesen |
| `quelle`, `anhang` | anlegende App; `name` und `beschreibung` darf jede App setzen | lesen |
| Pflichtfelder `id`, `typ`, `erstellt` | anlegende App, danach unveränderlich | — |

Eine App ändert nur die Felder, die sie bearbeiten will, den Rest schreibt sie byte-genau zurück.

## 7. Löschen

- Wissen wird nie gelöscht: keine Karten, Module, Notizen, Notizbücher, Markierungen, Tinte, Protokolle oder Originale.
- Einzige Ausnahme sind **Konfliktkopien** (8). Die App löscht eine Konfliktkopie nur, nachdem ein Mensch entschieden hat („Zweite Fassung verwerfen“ oder „übernehmen“) oder wenn dabei nichts verloren gehen kann (8, ab Lernen 1.4). Andere Dateien kann die App technisch nicht löschen: Auch die Ablage prüft vor dem Löschen selbst, dass es eine Konfliktkopie ist und ihr Original existiert.
- Ein Bild vom Blatt nehmen oder ein Kapitel aus dem Inhaltsverzeichnis entfernen ändert nur den Eintrag in der jeweiligen Datei.

## 8. Sync, Offline und Konflikte

- **Jedes Gerät hat den ganzen Ordner** und arbeitet ohne Netz. Das Sync-Programm gleicht ab, sobald es kann. Dateien müssen auf dem Gerät liegen (bei Cloud-Diensten „Immer auf diesem Gerät behalten“), Platzhalter ohne Inhalt kann die App nicht lesen.
- **Atomar schreiben:** Die App schreibt jede Datei erst vollständig in eine Nachbardatei `.syncthing.<name>.tmp` im selben Ordner und benennt sie dann um. Syncthing sieht so nie eine halbe Datei und gleicht die Zwischendatei nicht ab.
- **Ruhe vor dem Schreiben:** Getippter Text steht sofort in der Oberfläche und wird nach etwa einer Sekunde ohne weitere Änderung geschrieben, beim Wechsel in den Hintergrund sofort.
- **Nur auf dem bekannten Stand schreiben:** Die App merkt sich zu jeder gelesenen Datei ihren Stand (Größe, Änderungszeit, Prüfsumme des Inhalts). Direkt vor dem Schreiben vergleicht sie ihn mit der Datei auf der Platte. Hat Syncthing die Datei inzwischen ersetzt und weicht der eigene Text ab, wird der eigene Text zur Konfliktkopie und die Datei behält den Stand von außen. Ist der Text gleich, ist es kein Konflikt. Wurde die Datei von außen gelöscht, während hier noch ungespeicherter Text stand, legt die App sie mit diesem Text neu an.
- **Konfliktkopien der App** heißen wie bei Syncthing: `<name>.sync-conflict-<JJJJMMTT>-<HHMMSS>-<gerät>.<endung>`. Bei Syncthing ist `<gerät>` die siebenstellige Kennung, bei der App der Gerätename.
- **Konfliktkopien der Sync-Programme** (ab Lernen 1.4) erkennt die App auf zwei Wegen. (A) Bekannte Namensmuster, belegt aus Primärquellen: Syncthing (wie oben), Nextcloud/ownCloud `<name> (conflicted copy [<nutzer> ]JJJJ-MM-TT HHMMSS).<endung>`, älter `<name>_conflict-JJJJMMTT-HHMMSS.<endung>`, `<name> (case clash from JJJJ-MM-TT HHMMSS).<endung>`, Dropbox `<name> (<nutzer>'s conflicted copy JJJJ-MM-TT)[ (n)].<endung>` und deutsch `… in Konflikt stehende Kopie …`. Bei einer Kopie einer Kopie zählt die letzte Marke. (B) Unabhängig vom Programm, nur in den Ordnern der App (`lernen/`, `reviews/`, `anhaenge/`, `gemeinsam/anhaenge|quellen|entitaeten/`): eine Datei, die wie eine vorhandene Datei im selben Ordner heißt plus Zusatz (` (1)`, ` 2`, `-RECHNERNAME`) und keinen Namen trägt, den die App selbst vergibt (2), sowie bei Markdown eine zweite Datei mit derselben `id` im selben Ordner. Original ist dann `<id>.md`, sonst der kürzeste Name. Die Namensfälle stehen als Testtabelle in `testdaten/syncnamen.json`.
- **Konfliktkopien werden nie still verworfen.** Die App zählt sie im Kopf, zeigt Datei und zweite Fassung nebeneinander und lässt den Menschen entscheiden. Im Index zählt eine Konfliktkopie nicht als zweites Dokument derselben ID.
- **Ausnahme: Auflösen ohne Menschen, wenn nichts verloren gehen kann** (ab Lernen 1.4): gleicher Inhalt (Unterschiede nur bei Zeilenenden oder BOM) → Kopie löschen; eine Seite leer → die volle bleibt; eine Seite unlesbar (siehe unten) und zugleich der Anfang der anderen → die vollständige bleibt; Protokolle `reviews/*.jsonl` → Zeilen beider Fassungen vereinigen, jede Zeile einmal, nach `am` sortiert; Vertragsmarke `lernen/vertrag.json` → die höhere Version bleibt (ab Lernen 1.6). Binärdateien nur bei leerer Seite oder Byte für Byte gleichem Inhalt. Die Konfliktansicht nennt die Zahl der so gelösten Kopien.
- **Unlesbare Dateien** (ab Lernen 1.4): leer, JSON nicht lesbar, JSONL mit beschädigter Zeile, SVG ohne `</svg>`, Markdown mit Kopfbereich ohne Ende. Die App zeigt sie als „Unvollständige Dateien“ und lässt sie stehen. Bevor die App eine unlesbare Datei überschreibt, legt sie deren Inhalt als Konfliktkopie ab.
- **Ordner leer oder Massenschwund** (ab Lernen 1.4): Ist die Dateiliste plötzlich leer, obwohl vorher mindestens 10 Dateien da waren, übernimmt die App das nicht, zeigt einen Hinweis und schreibt nichts, bis Dateien zurück sind oder der Mensch bestätigt. Verschwinden auf einmal mindestens 10 Dateien und mindestens 20 % des Bestands, zeigt sie einen Hinweis; sie legt verschwundene Dateien nicht von sich aus neu an (außer bei ungespeichertem Text, siehe oben).
- **Nur anhängen, und zwar pro Gerät:** Protokoll (`reviews/JJJJ-MM.<geraet>.jsonl`), Lesestand und Fragen-Stand hat jedes Gerät in einer eigenen Datei, damit gleichzeitiges Arbeiten auf zwei Geräten gar nicht erst Konflikte erzeugt.
- **Originale** (PDF, Foto) legt die App nur neu an; existiert der Pfad schon, schreibt sie nicht.
- **Keine Statusfelder mit hoher Änderungsrate im Frontmatter**, damit Syncthing nicht ständig ganze Notizen verteilt.
- **Vertragsmarke** (ab Lernen 1.6): `lernen/vertrag.json` enthält genau `{"vertrag": "<version>"}` und eine Zeilenschaltung, z. B. `{"vertrag": "1.6"}`, die höchste Vertragsversion, nach der ein Gerät in diesem Ordner schreibt. Fehlt die Marke oder ist sie niedriger als die eigene Version, schreibt die App ihre eigene hinein; nie eine niedrigere. Ist sie höher, warnt die App, dass ein anderes Gerät eine neuere App hat, und bittet, zuerst zu aktualisieren (ältere Apps können neuere Einträge falsch lesen). Eine unlesbare Marke lässt die App stehen. Weil der Text für dieselbe Version immer gleich ist, ergibt gleichzeitiges Schreiben auf zwei Geräten gleichen Inhalt. Apps vor Lernen 1.6 kennen die Marke nicht und übergehen sie.
- **Geheimnisse nur verschlüsselt im Ordner:** KI-Schlüssel, die Adresse eines eigenen KI-Rechners und das gewählte Modell merkt sich jedes Gerät selbst (im Konfigurationsordner der App). Wer sie auf allen eigenen Geräten nutzen will, legt sie mit einem Passwort verschlüsselt in `lernen/einstellungen/ki-zugang.verschluesselt.json` ab (5.8); im Klartext stehen sie nie im Datenordner. Das Passwort steht nirgends, jedes Gerät behält nach der ersten Eingabe nur den Datenschlüssel in seinem Konfigurationsordner.

## 10. Offene Punkte

1. **Tags:** Namensräume mit Präfix (`lernen/…`).
2. **Seitenbilder** rechnet niemand voraus; die App zeichnet PDFs mit pdf.js selbst und liest den Text der Seiten ebenso daraus.
