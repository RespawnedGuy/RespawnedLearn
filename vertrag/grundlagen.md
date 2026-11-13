# Datenvertrag – Grundlagen

Grundsätze, Ordnerstruktur, Dateien, Links, Eigentum, Löschen, Sync und offene Punkte. Version und Wegweiser stehen in `DATENVERTRAG.md`.

## 1. Grundsätze

1. **Eine Wahrheit.** Der Datenordner auf der Platte (Markdown mit YAML-Frontmatter, JSON, SVG und Originale) ist die einzige Quelle der Wahrheit. Es gibt keinen Server. Was die App daraus berechnet (Index, Lernstand), hält sie nur im Arbeitsspeicher.
2. **Abgleich nur über Dateien.** Geräte gleichen den Ordner mit Syncthing ab. Die App reagiert auf Dateiänderungen (Dateiüberwachung, unter Android zusätzlich regelmäßiger Vergleich der Dateiliste) und spricht mit keinem anderen Gerät direkt.
3. **Unbekanntes bleibt erhalten.** Die App löscht, sortiert oder normalisiert keine Frontmatter-Felder, Textblöcke oder Dateien, die sie nicht kennt.
4. **Originale sind unantastbar.** Fotos und PDFs werden nach dem Ablegen nie verändert. Handschrift, Markierungen und Blätter liegen in eigenen Dateien daneben.
5. **Wissen wird nie gelöscht.** Dateien werden nur aktualisiert. Ältere Stände hält die Dateiversionierung von Syncthing (empfohlen: „Gestaffelt“).

## 2. Ordnerstruktur

Dateinamen und Unterordner sind frei wählbar, weil Links über IDs laufen. Die oberste Ebene ist festgelegt.

```
/
├─ gemeinsam/        quelle, anhang-Sidecars
├─ lernen/
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
│  └─ blaetter/<anhang-id>/        Zeichenblätter: anordnung.json, S001.svg, S001-<blatt>.svg, S001-bilder.json
├─ anhaenge/JJJJ/MM/ Originaldateien (PDF, JPG …), unveränderlich
└─ reviews/          Wiederholungsprotokoll, je Gerät eine Datei
```

Nicht zu den Daten gehören und werden von der App übergangen: `.stfolder/`, `.stversions/` (Syncthing), `.git/`, `.index/`, `.geheim/` sowie Zwischendateien (`.syncthing.<name>.tmp`, `~syncthing~*`). Ordner `arbeit/` aus RespawnedNotes VX dürfen im selben Ordner liegen; die App liest sie nicht aus und ändert sie nie.

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

- Wissen wird nie gelöscht: keine Karten, Module, Notizen, Markierungen, Tinte, Protokolle oder Originale.
- Einzige Ausnahme sind **Konfliktkopien** (8). Die App löscht eine Konfliktkopie nur, nachdem ein Mensch entschieden hat („Zweite Fassung verwerfen“ oder „übernehmen“). Andere Dateien kann die App technisch nicht löschen.
- Ein Bild vom Blatt nehmen oder ein Kapitel aus dem Inhaltsverzeichnis entfernen ändert nur den Eintrag in der jeweiligen Datei.

## 8. Sync, Offline und Konflikte

- **Jedes Gerät hat den ganzen Ordner** und arbeitet ohne Netz. Syncthing gleicht ab, sobald Geräte sich sehen.
- **Atomar schreiben:** Die App schreibt jede Datei erst vollständig in eine Nachbardatei `.syncthing.<name>.tmp` im selben Ordner und benennt sie dann um. Syncthing sieht so nie eine halbe Datei und gleicht die Zwischendatei nicht ab.
- **Ruhe vor dem Schreiben:** Getippter Text steht sofort in der Oberfläche und wird nach etwa einer Sekunde ohne weitere Änderung geschrieben, beim Wechsel in den Hintergrund sofort.
- **Nur auf dem bekannten Stand schreiben:** Die App merkt sich zu jeder gelesenen Datei ihren Stand (Größe, Änderungszeit, Prüfsumme des Inhalts). Direkt vor dem Schreiben vergleicht sie ihn mit der Datei auf der Platte. Hat Syncthing die Datei inzwischen ersetzt und weicht der eigene Text ab, wird der eigene Text zur Konfliktkopie und die Datei behält den Stand von außen. Ist der Text gleich, ist es kein Konflikt. Wurde die Datei von außen gelöscht, während hier noch ungespeicherter Text stand, legt die App sie mit diesem Text neu an.
- **Konfliktkopien** heißen wie bei Syncthing: `<name>.sync-conflict-<JJJJMMTT>-<HHMMSS>-<gerät>.<endung>`. Bei Syncthing ist `<gerät>` die siebenstellige Kennung, bei der App der Gerätename. Sie werden nie still verworfen: Die App zählt sie im Kopf, zeigt Datei und zweite Fassung nebeneinander und lässt den Menschen entscheiden. Im Index zählt eine Konfliktkopie nicht als zweites Dokument derselben ID.
- **Nur anhängen, und zwar pro Gerät:** Protokoll (`reviews/JJJJ-MM.<geraet>.jsonl`), Lesestand und Fragen-Stand hat jedes Gerät in einer eigenen Datei, damit gleichzeitiges Arbeiten auf zwei Geräten gar nicht erst Konflikte erzeugt.
- **Originale** (PDF, Foto) legt die App nur neu an; existiert der Pfad schon, schreibt sie nicht.
- **Keine Statusfelder mit hoher Änderungsrate im Frontmatter**, damit Syncthing nicht ständig ganze Notizen verteilt.
- **Geheimnisse nur verschlüsselt im Ordner:** KI-Schlüssel, die Adresse eines eigenen KI-Rechners und das gewählte Modell merkt sich jedes Gerät selbst (im Konfigurationsordner der App). Wer sie auf allen eigenen Geräten nutzen will, legt sie mit einem Passwort verschlüsselt in `lernen/einstellungen/ki-zugang.verschluesselt.json` ab (5.8); im Klartext stehen sie nie im Datenordner. Das Passwort steht nirgends, jedes Gerät behält nach der ersten Eingabe nur den Datenschlüssel in seinem Konfigurationsordner.

## 10. Offene Punkte

1. **Tags:** Namensräume mit Präfix (`lernen/…`).
2. **Seitenbilder** rechnet niemand voraus; die App zeichnet PDFs mit pdf.js selbst und liest den Text der Seiten ebenso daraus.
