# RespawnedLearn

Lernen mit eigenen Skripten und Büchern: Mitschriften, Lernkarten mit Wiederholung (FSRS), Stift direkt im PDF,
Zeichenblätter neben dem Skript und auf Wunsch KI-Fragen zum Kapitel, das du gerade liest.

- **Lokal:** Deine Daten liegen als Markdown, JSON und SVG in einem Ordner deiner Wahl. Kein Konto, kein Server.
- **Auf mehreren Geräten:** Gleiche den Ordner mit [Syncthing](https://syncthing.net) ab, so wie viele es mit Obsidian tun.
  Schalte in Syncthing die Dateiversionierung „Gestaffelt“ ein, dann bleibt jede überschriebene Datei erhalten.
- **KI optional:** Wer KI-Fragen möchte, trägt einen eigenen Anthropic-API-Schlüssel ein. Ohne Schlüssel läuft alles andere.
- **Plattformen:** Windows und Android.

## Installieren

Die Pakete baut die GitHub Action bei jedem Push (Reiter „Actions“, Artefakte `respawnedlearn-windows` und
`respawnedlearn-android`). Unter Android fragt die App beim ersten Start nach „Zugriff auf alle Dateien“, damit sie im
Syncthing-Ordner schreiben darf.

## Entwickeln

Voraussetzungen: Node 22, Rust (stable), für Android das Android-SDK mit NDK (siehe `.github/workflows/build.yml`).

```
npm ci
npm run check          # Tests und Build der Oberfläche
npm run tauri dev      # App am Rechner starten
(cd app/src-tauri && cargo test)   # Tests des Datenordners
```

Aufbau: `app/` (Oberfläche, React), `app/src-tauri/` (Tauri: Datenordner lesen, schreiben, beobachten),
`packages/kern/` (reine Logik ohne Browser), `packages/oberflaeche/` (Editor, PDF, Tinte, gemeinsame Bausteine).

Hervorgegangen aus dem Lernteil von RespawnedNotes; die Git-Historie dieser Dateien ist übernommen.

## Lizenz

[GNU Affero General Public License 3.0](LICENSE). Veränderte Fassungen müssen unter derselben Lizenz offen bleiben.
