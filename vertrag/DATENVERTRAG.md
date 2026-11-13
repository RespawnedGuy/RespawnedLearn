# DATENVERTRAG – RespawnedLearn

Verbindliche Referenz für alles, was den Datenordner von RespawnedLearn liest oder schreibt.
Vertragsversion: **Lernen 1.0 (2026-11-13)**. Änderungen nur über eine neue Version mit Eintrag in `aenderungen.md`.

Entstanden aus dem Datenvertrag 0.46 von RespawnedNotes VX (Lernteile). Die Dateiformate sind dieselben, Daten aus VX
lassen sich unverändert übernehmen. Die Abschnittsnummern bleiben gleich, damit Verweise im Code („Vertrag 5.3“) stimmen;
Nummern, die nur die Arbeits-App betrafen (5.2, 5.6, 9), fehlen.

| Abschnitt | Inhalt | Datei |
|---|---|---|
| 1–4 | Grundsätze, Ordnerstruktur, Dateien und Pflichtfelder, Links | `grundlagen.md` |
| 5.1 | Quelle, Anhang | `typen.md` |
| 5.3 | Notiz, Mitschrift, Modul, Lesestand, Zeichenblätter, Heft, Inhaltsverzeichnis | `typen.md` |
| 5.4, 5.5 | Markierungen, Handschrift, Lernkarten und Protokoll | `typen.md` |
| 5.7, 5.8 | Fragen zum Kapitel, Vorfragen, Rückmeldung, Erklären | `typen.md` |
| 6–8, 10 | Eigentum, Löschen, Sync und Konflikte, offene Punkte | `grundlagen.md` |
| – | Änderungsprotokoll | `aenderungen.md` |

## Ändern

1. Den Abschnitt in seiner Datei ändern.
2. Die Vertragsversion oben hochzählen.
3. In `aenderungen.md` eine Zeile anhängen, die am Ende sagt: „alte Dateien bleiben gültig“ oder „Migration: …“.

**Migration.** Bleiben ältere Dateien nicht unverändert lesbar, wird das Feld `schema` des Typs (3) hochgezählt, und die
App liest die alte Form weiter oder hebt sie mit einem getesteten Schritt an. Eine Migration schreibt nur Form, nie
Inhalt.
