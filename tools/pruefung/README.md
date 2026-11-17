# Prüfen im Browser ohne Tauri

Die Oberfläche läuft im Browser, wenn ein Init-Skript die Tauri-Befehle nachstellt (`mock.mjs`: Datenordner
im Arbeitsspeicher der Seite, Stempel und „Schreiben nur auf erwartetem Stempel“ wie in `ordner.rs`, eine
Konfliktkopie für die Konfliktansicht). So lassen sich Ansichten am Handy- und PC-Format ansehen, ohne App-Build.
Das ersetzt keine Tests und keinen Gerätetest; Rust, Android und echtes Syncthing prüft es nicht.

```sh
npm ci
node tools/pruefung/beispieldaten.mjs                 # ./daten mit erfundenen Daten (steht in .gitignore)
npm run dev -w app -- --force                          # Vite auf http://localhost:1420/
node tools/pruefung/ansehen.mjs                        # alle Ansichten, oder z. B. start,uebungsplatz
```

- Ausgabe: `./ansehen/<ansicht>-<handy|pc>-<hell|dunkel>.png` und `ergebnis.json` (seitliches Überlaufen,
  Konsolenfehler und Antworten ≥ 400, Kontrast auf Glas). Dazu `lernen-handy-reduziert.png` mit „Bewegung reduzieren“
  und „Transparenz reduzieren“ (über CDP). Exit-Code 1 bei Konsolenfehlern, Schrift auf Glas unter 4,5:1
  (`glaskontrast.mjs`: Glas über Schwarz und Weiß gerechnet, weil axe durchsichtige Flächen nicht kennt) oder wenn
  das Glas mit reduzierter Transparenz nicht deckend wird, außerdem wenn die Werkzeugleiste am PC in einer Lage
  (oben, links, rechts, je mit Vollbild, bei 1366 und 1024 px) Skript oder Buch verdeckt (`leiste.mjs`, Bilder
  `leiste-<lage>-voll.png`).
- Umgebung: `DATEN`, `AUS`, `URL`, `PLAYWRIGHT` (Pfad zum Paket, falls nicht auflösbar), `AXE` (Pfad zu
  `axe.min.js`; ohne die Datei läuft keine WCAG-Prüfung, axe-core ist bewusst keine Abhängigkeit).
- Fallen: `npm run dev -- --port …` reicht die Schalter nicht an Vite weiter (leere Seite, 404 auf `/`), darum
  `-w app --`. Nach `npm ci` Vite mit `--force` starten, sonst „504 Outdated Optimize Dep“ und leere Seite.
  Ein weißer Screenshot ohne Konsolenfehler heißt fast immer: falscher Port oder falsche Wurzel.
- Neue Tauri-Befehle in `mock.mjs` ergänzen; unbekannte meldet sie als `mock: unbekannt` in der Konsole.
- `beispieldaten.mjs` stammt aus RespawnedNotes VX und legt auch Arbeitsdaten an; der Nachbau übernimmt nur
  `lernen/**` und das Beispielskript. Für lange Skripte (Scrollen) ein PDF mit Playwright `page.pdf()` erzeugen.
