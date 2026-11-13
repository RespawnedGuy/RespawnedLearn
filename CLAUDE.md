# CLAUDE.md – RespawnedLearn

Regeln für jede Claude-Sitzung hier. Nils ergänzt diese Datei selbst, nichts davon stillschweigend entfernen. Mit Nils Deutsch, in ganzen Sätzen.

## Projekt

- **RespawnedLearn** ist der Lernteil von RespawnedNotes VX als eigenständige App (Nils 2026-11-12/13): lokal, ohne Server, Datenordner auf der Platte, Abgleich zwischen Geräten über Syncthing. Für Nils und andere Nutzer; öffentliches Repo unter AGPL-3.0, Weitergabe auch als Installer/APK. Plattformen Windows und Android, iOS erst wenn die App erfolgreich wird.
- **KI** nur mit eigenem Anthropic-API-Schlüssel je Nutzer, ohne Schlüssel läuft alles andere. Nie ein Abo-Token (`claude -p`, `CLAUDE_CODE_OAUTH_TOKEN`) oder ein Schlüssel von Nils in Code, Build oder Historie.
- **Stack** (exakt laut Lockfiles): TypeScript 7 strict, Node 22, React 19, Vite 8, CodeMirror 6, pdfjs, Vitest; Tauri 2 (Rust, `app/src-tauri`, Crates exakt in `Cargo.toml`/`Cargo.lock`). Neue Abhängigkeit oder Major-Sprung nur mit exakter Version und Begründung im Plan, Versionen mindestens zwei Wochen alt.
- RespawnedNotes VX (Repo RespawnedGuy/RespawnedVX) bleibt bis auf Weiteres unangetastet; der Rückbau des Lernteils dort ist ein eigener Auftrag.

## Landkarte

- `packages/kern/src/` (Tests `packages/kern/test/`): rein, nur relative Importe, kein Browser, kein React. `bestand.ts` (Index aller Dateien), `pfade.ts` (Orte im Datenordner), `module`, `mitschrift`, `fragen`, `inhalt`, `lernen.ts`, `blaetter.ts` (Zeichenblätter, Lineaturen, leeres Heft), `tinte`, `marken`. Einige Dateien stammen aus der Arbeits-App (`journal`, `aufgaben`, `berichtsvorlagen`), weil `bestand.ts` und der Editor sie brauchen.
- `packages/oberflaeche/src/`: `daten/ordner.ts` (Tauri-Befehle für den Datenordner), `daten/speicher.ts` (Daten im Browser, wird in Schritt 2 auf den Ordner umgestellt), `editor/`, `pdf/`, `Kopf.tsx`, `Fehlergrenze.tsx`.
- `app/src/`: `main.tsx`, `OrdnerWahl.tsx` (erster Start), `App.tsx`, `Start.tsx`, `Sammeln.tsx` (Übungsplatz), `Blaetter.tsx`, `Mitschrift.tsx`, `Abruf.tsx`, `wissen.ts` (Karten, FSRS), `ki.ts`.
- `app/src-tauri/src/`: `ordner.rs` (Lesen, atomares Schreiben, Liste, Schreibprobe; ohne Tauri, mit `cargo test`), `lib.rs` (Befehle, Ordner beobachten, Einstellungen des Geräts). `android/MainActivity.kt` + `tools/android-anpassen.mjs` setzen in der GitHub Action „Zugriff auf alle Dateien“.

## Laufender Umbau (Stand 2026-11-13)

Bauplan von Nils freigegeben („Go“ 2026-11-13), nacheinander:
1. ~~Repo, Historie, Tauri-Gerüst~~ (v0.1.0): Historie der übernommenen Dateien aus VX (`git filter-repo`, Claude-Session-Zeilen entfernt, Historie auf Adressen/Token gescannt), Tauri für Windows und Android, Ordnerwahl, Rust-Befehle mit Tests, GitHub Action baut Installer und Debug-APK.
2. Ordner statt Server: `speicher.ts` liest und schreibt den Ordner über `daten/ordner.ts`, beobachtet Änderungen (bei Android zusätzlich regelmäßig `dateien()` vergleichen, falls inotify im gemeinsamen Speicher schweigt), zeigt `*.sync-conflict-*` an. Eigener Vertrag „Lernen 1.0“ in `vertrag/` aus VX `typen-lernen.md` und den Lernteilen von `typen-gemeinsam.md`/`grundlagen.md`, gleiche Dateiformate.
3. Serverfunktionen in die App: Seitenbilder und PDF-Text über pdf.js, KI über die Anthropic-API mit eigenem Schlüssel, Einstellungen.
4. Releases: signierte APK (Schlüssel als GitHub-Secret), Windows vorerst unsigniert.
5. Umzug von Nils' Lerndaten (`lernen/**`, `reviews/`, Skripte mit Sidecars) mit SHA-256-Liste vorher/nachher, Quelle unberührt.

**Abnahme gesamt:** läuft auf Windows und Android ohne Netz und Server; Karte vom PC erscheint nach Syncthing ohne Neustart am Handy, gleichzeitige Änderung ergibt sichtbare Konfliktkopie; Fremder installiert, wählt leeren Ordner, legt los, keine Daten/Token von Nils in Paket oder Historie; Hash-Liste des Umzugs gleich; `npm run check` und `cargo test` grün.

## Arbeitsweise

- **Problem vor Lösung**, erst planen, dann bauen: Ziel, Abnahmekriterien, Dateien, Tests zeigen und auf Nils' Okay warten (außer der Schritt ist schon freigegeben). Apple-Prinzip: nur zeigen, was die Tätigkeit braucht.
- **Tiefer, nicht größer** bei größeren Aufgaben: Profi-Niveau, Rohquellen (Doku von Tauri, Android, Syncthing), unabhängige Prüfung; Nils am Anfang in 2–3 Zeilen sagen, was dadurch anders läuft.
- **Bugfix:** nur die Ursache, erst ein Test, der den Fehler zeigt. **Geprüft** heißt: Ausgabe von `npm run check` (und bei Rust `cargo test`) in der Antwort.
- **Harte Regeln** (nie ohne Nils' Erlaubnis): keine Secrets versioniert; `kern` importiert nichts aus `oberflaeche`, `app` oder Frameworks; keine Abhängigkeit ohne exakte Version, Lockfile, Begründung; nichts ungeprüft als erledigt melden; kein Format ohne Vertragsversion; keine Tests löschen, abschwächen oder überspringen. Neue Logik in `kern` und `src-tauri` bekommt Tests.
- Bezeichner, Kommentare und Commits deutsch (Fachbegriffe = Bezeichner). Neue Dateien unter etwa 300 Zeilen.

## Daten sind heilig

- Keine persönlichen Daten ins Repo (öffentlich!): keine Adressen, Pfade, Namen, Mails, Token, auch nicht in Commit-Nachrichten.
- Nutzerinhalte nie leer oder automatisch überschreiben; die App löscht kein Wissen. Schreiben immer atomar (`ordner::schreiben`).
- Syncthing-Konfliktkopien werden nie still verworfen, ein Mensch entscheidet.

## Befehle

`npm ci` · `npm run dev` (Oberfläche im Browser, ohne Ordner) · `npm run tauri dev` (App am Rechner) · `npm test` · `npm run build` (enthält `tsc`) · `npm run check` (Tests + Build) · `cd app/src-tauri && cargo test`.

## Vor jedem Push

1. Bei sichtbarer Änderung Version in `package.json` und `package-lock.json` hochzählen (Fix = Patch, Funktion = Minor); Tauri liest sie aus `package.json`.
2. `npm run check` und `cargo test` grün.
3. Auf `main` pushen; die GitHub Action baut Windows-Installer und APK. Neue Version Nils nennen.
