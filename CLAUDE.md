# CLAUDE.md – RespawnedLearn

Regeln für jede Claude-Sitzung hier. Nils ergänzt diese Datei selbst, nichts davon stillschweigend entfernen. Mit Nils Deutsch, in ganzen Sätzen.

## Projekt

- **RespawnedLearn** ist der Lernteil von RespawnedNotes VX als eigenständige App (Nils 2026-11-12/13): lokal, ohne Server, Datenordner auf der Platte, Abgleich zwischen Geräten über Syncthing. Für Nils und andere Nutzer; öffentliches Repo unter AGPL-3.0, Weitergabe auch als Installer/APK. Plattformen Windows und Android, iOS erst wenn die App erfolgreich wird.
- **KI** nur mit eigenem Zugang je Nutzer, Anbieter frei wählbar (Anthropic, OpenAI, Gemini, Perplexity, Ollama; Nils 2026-11-13), ohne KI läuft alles andere. Später evtl. ein Abo, das die API übernimmt. Anweisungen an die KI sind vorausgefüllte, änderbare Einstellungen mit „Standard“. Nie ein Abo-Token (`claude -p`, `CLAUDE_CODE_OAUTH_TOKEN`) oder ein Schlüssel von Nils in Code, Build oder Historie.
- **Stack** (exakt laut Lockfiles): TypeScript 7 strict, Node 22, React 19, Vite 8, CodeMirror 6, pdfjs, Vitest; Tauri 2 (Rust, `app/src-tauri`, Crates exakt in `Cargo.toml`/`Cargo.lock`). Neue Abhängigkeit oder Major-Sprung nur mit exakter Version und Begründung im Plan, Versionen mindestens zwei Wochen alt.
- RespawnedNotes VX (Repo RespawnedGuy/RespawnedVX) bleibt bis auf Weiteres unangetastet; der Rückbau des Lernteils dort ist ein eigener Auftrag.

## Landkarte

- `packages/kern/src/` (Tests `packages/kern/test/`): rein, nur relative Importe, kein Browser, kein React. `bestand.ts` (Index aller Dateien), `pfade.ts` (Orte im Datenordner), `module`, `mitschrift`, `fragen`, `inhalt`, `lernen.ts`, `blaetter.ts` (Anordnung im Übungsplatz, Lineaturen, Bilder auf Seiten; alte Zeichenblätter nur noch fürs Anheben), `buecher.ts` (Notizbücher: Seiten, Verweise aufs Skript, Anheben der Zeichenblätter, Vertrag Lernen 1.3), `scrollen.ts` (sichtbare Seite im scrollenden Skript), `tinte`, `marken`. Einige Dateien stammen aus der Arbeits-App (`journal`, `aufgaben`, `berichtsvorlagen`), weil `bestand.ts` und der Editor sie brauchen.
- `vertrag/`: Datenvertrag „Lernen 1.1“ (Stand Lernen 1.3; Wegweiser `DATENVERTRAG.md`, `grundlagen.md`, `typen.md`, `aenderungen.md`); erst Vertrag ändern, dann Code.
- `packages/oberflaeche/src/`: `daten/ordner.ts` (Schnittstelle `Ablage`, Tauri-Befehle), `daten/ablageImSpeicher.ts` (Ordner im Arbeitsspeicher für Tests und `npm run dev`, `Platte` = Syncthing nachgestellt), `daten/speicher.ts` (Texte im Arbeitsspeicher, Schreiben nach 1 s Ruhe, nur auf bekanntem Stempel, sonst Konfliktkopie; Tests `packages/oberflaeche/test/speicher.test.ts`), `editor/`, `pdf/`, `Kopf.tsx`, `Fehlergrenze.tsx`.
- `app/src/`: `main.tsx`, `OrdnerWahl.tsx` (erster Start), `App.tsx`, `Start.tsx`, `Sammeln.tsx` (Übungsplatz: Skript scrollt, Notizbücher daneben), `Buch.tsx` (Notizbuch-Seiten, Bilder ins Buch), `BuchWahl.tsx` („+ Buch“), `BuchAllein.tsx` (Buch ohne Skript), `anheben.ts` (alte Blätter → Bücher beim Öffnen), `Blaetter.tsx` (Anordnung, Lineatur, Kopf, Trenner), `Mitschrift.tsx`, `Abruf.tsx`, `Konflikte.tsx` (zwei Fassungen, übernehmen oder verwerfen), `wissen.ts` (Karten, FSRS), `ki.ts` (KI-Funktionen der Ansichten), `kianbieter/` (je Anbieter ein Adapter, `frage.ts` = `kiFrage()` mit Schema-Prüfung, `zugang.ts` = Zugang des Geräts und, freiwillig, gemeinsam verschlüsselt im Datenordner, `teilen.ts` = Regeln dazu), `Einstellungen.tsx` (+ `EinstellungenKi`, `EinstellungenPrompts`). KI-Aufträge, Standard-Anweisungen und Antwort-Schemas rein in `kern` (`kiAuftraege`, `kiPrompts`, `kiSchemas`). Nutzer-Wiki: `docs/ki-anbieter.md`.
- `app/src-tauri/src/`: `ordner.rs` (Lesen, viele Texte auf einmal, atomares Schreiben, Schreiben nur auf erwartetem Stempel, Konfliktkopien löschen und sonst nichts, Liste, Schreibprobe; ohne Tauri, mit `cargo test`), `zugang.rs` (KI-Zugang und Datenschlüssel im Konfigurationsordner, atomar, 0600), `tresor.rs` (gemeinsamer KI-Zugang: Argon2id + XChaCha20-Poly1305, Vertrag Lernen 1.2), `lib.rs` (Befehle, Ordner beobachten, Einstellungen des Geräts, Plugin `http` für Anfragen an die Anbieter ohne CORS; erlaubte Adressen in `capabilities/default.json`, CSP in `tauri.conf.json`). `android/MainActivity.kt` + `tools/android-anpassen.mjs` setzen in der GitHub Action „Zugriff auf alle Dateien“.

## Laufender Umbau (Stand 2026-11-13, nach Schritt 3)

Bauplan von Nils freigegeben („Go“ 2026-11-13), nacheinander:
1. ~~Repo, Historie, Tauri-Gerüst~~ (v0.1.0): Historie der übernommenen Dateien aus VX (`git filter-repo`, Claude-Session-Zeilen entfernt, Historie auf Adressen/Token gescannt), Tauri für Windows und Android, Ordnerwahl, Rust-Befehle mit Tests, GitHub Action baut Installer und Debug-APK.
2. ~~Ordner statt Server~~ (v0.2.0): Speicher auf dem Ordner, Android fragt die Dateiliste alle 10 s ab, Konfliktansicht, Vertrag „Lernen 1.0“. Geprüft gegen echtes Syncthing 1.30.0 (Konfliktname, Zwischendateien werden nicht verteilt). KI, Kapitelfragen und Vorfragen sind bis Schritt 3 ohne Funktion.
3. Serverfunktionen in die App (Plan v2 freigegeben): ~~3a~~ (v0.3.0) fünf Anbieter, Einstellungen, änderbare Anweisungen (Vertrag 1.1), Erklären/Rückmeldung/Frage-Vorschlag/Korrektur, Seitenbilder nur noch über pdf.js, keine Schriften aus dem Netz. ~~3b~~ (v0.4.0): PDF-Text über pdf.js (`seitenText` in `oberflaeche/pdf/inhalt.ts`), Kapitelfragen und Vorfragen auf Knopfdruck: reiner Teil `kern/kapitelfragen.ts` (Schritt für Schritt, `naechsterSchritt`), Ablauf `app/src/fragenErzeugen.ts` (Tests gegen den echten Speicher), Anbindung `fragenWerkzeug.ts`.
4. Releases (ab v0.9.0 gebaut): neue Version in `package.json` → GitHub Release mit EXE, MSI, APK, `SHA256SUMS.txt` und Gegenprobe. APK-Release-Signatur über Secrets `ANDROID_KEY_*` (`tools/android-signatur.mjs`, Test gegen Tauri-Vorlage), ohne sie Debug-APK. Windows unsigniert, bis Nils zahlt; Schalter `WINDOWS_PFX_*` (`tools/windows-signieren.ps1`), ohne ihn bei jedem Lauf Signierprobe mit Wegwerf-Zertifikat, geprüft wird die EXE im Installer. Doku `docs/installieren.md`, `docs/signieren.md`. Offen: Nils legt den Android-Schlüssel an.
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
