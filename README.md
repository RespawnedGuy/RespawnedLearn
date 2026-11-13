# RespawnedLearn

Lernen mit eigenen Skripten und Büchern: Mitschriften, Lernkarten mit Wiederholung (FSRS), Stift direkt im PDF,
Zeichenblätter neben dem Skript und auf Wunsch KI-Fragen zum Kapitel, das du gerade liest.

- **Lokal:** Deine Daten liegen als Markdown, JSON und SVG in einem Ordner deiner Wahl. Kein Konto, kein Server.
- **Auf mehreren Geräten:** Gleiche den Ordner mit einem Sync-Programm deiner Wahl ab, etwa [Syncthing](https://syncthing.net),
  Nextcloud, Dropbox, OneDrive oder Google Drive. Die App erkennt deren Konfliktkopien; was zu beachten ist, steht in
  [docs/sync.md](docs/sync.md).
- **KI optional:** Wer KI-Fragen möchte, trägt einen eigenen Anthropic-API-Schlüssel ein. Ohne Schlüssel läuft alles andere.
- **Plattformen:** Windows und Android.

## Installieren

Windows-Installer und Android-APK stehen unter **Releases**, mit Prüfsummen. Was bei den Warnungen von Windows, Browser und
Android zu tun ist, steht in [docs/installieren.md](docs/installieren.md). Wie die Pakete signiert werden:
[docs/signieren.md](docs/signieren.md).

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
