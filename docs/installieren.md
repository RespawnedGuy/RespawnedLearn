# RespawnedLearn installieren

Die fertigen Pakete stehen unter **Releases** (rechte Spalte auf der Startseite des Repos). Jede Version hat:

| Datei | Wofür |
|---|---|
| `RespawnedLearn_<version>_x64-setup.exe` | Windows-Installer (empfohlen) |
| `RespawnedLearn_<version>_x64_en-US.msi` | Windows-Installer für verwaltete Rechner |
| `RespawnedLearn_<version>_arm64.apk` | Android (Handys und Tablets mit 64-Bit-ARM, also fast alle) |
| `SHA256SUMS.txt` | Prüfsummen aller Dateien |
| `*.sig`, `latest.json` | Signaturen und Versionsliste für die Updates in der App ([aktualisieren.md](aktualisieren.md)) |

Ab Version 0.20.0 sucht die App selbst nach neuen Versionen; installieren musst du nur einmal.

## Prüfsumme kontrollieren (freiwillig, aber sinnvoll)

So siehst du, dass die Datei unterwegs nicht verändert wurde. Windows (PowerShell, im Download-Ordner):

```
Get-FileHash .\RespawnedLearn_0.6.0_x64-setup.exe -Algorithm SHA256
```

Der Wert muss mit der Zeile in `SHA256SUMS.txt` übereinstimmen (Groß- und Kleinschreibung egal).
Unter Linux und macOS: `sha256sum -c SHA256SUMS.txt`.

## Windows

Der Windows-Installer ist noch **nicht signiert**. Ein Zertifikat kostet Geld und verhindert die Warnungen auch nicht sofort,
weil Windows Vertrauen erst über viele Downloads aufbaut. Darum warnen Browser und Windows bei einem neuen Programm:

1. **Browser:** Chrome und Edge melden womöglich „Gefährlicher Download blockiert“ oder „wird selten heruntergeladen“.
   Öffne die Download-Liste (Strg+J), klicke beim Eintrag auf das Menü (⋮ bzw. …) und wähle „Gefährliche Datei
   herunterladen“ bzw. „Behalten“.
2. **SmartScreen:** Beim Start erscheint „Der Computer wurde durch Windows geschützt“. Klicke auf **Weitere Informationen**
   und dann auf **Trotzdem ausführen**.
3. Der Installer legt RespawnedLearn im Startmenü an. Beim ersten Start schlägt die App `Dokumente\RespawnedLearn` als
   Datenordner vor („Hier anlegen“); mit „Anderen Ordner wählen“ nimmst du einen eigenen, zum Beispiel deinen
   Syncthing-Ordner. Den Programmordner und die internen Ordner der App lehnt sie ab (siehe „Wo der Datenordner liegt“).

Lädst du nur von dieser Releases-Seite und stimmt die Prüfsumme, ist die Warnung kein Hinweis auf ein Problem.

## Android

1. Lade die `.apk` am Handy herunter und tippe sie an.
2. Android fragt, ob der Browser (oder die Datei-App) **unbekannte Apps installieren** darf. Erlaube es für diese eine App;
   danach kannst du es in den Einstellungen wieder abschalten.
3. Google Play Protect zeigt eventuell „Unbekannte App“. Wähle **Details** und **Trotzdem installieren**.
4. Beim ersten Start erklärt RespawnedLearn, wozu es **Zugriff auf alle Dateien** braucht: damit es im Syncthing-Ordner
   schreiben darf (so wie Obsidian). Tippe auf **Zugriff erlauben**, schalte den Zugriff in den Einstellungen ein und
   kehre zurück. Ohne diese Freigabe kann die App deinen Datenordner nicht lesen.
5. Danach wählst du den Ordner mit **Ordner auswählen** in der Auswahl von Android, oder du tippst den Pfad ein
   (Vorschlag `/storage/emulated/0/RespawnedLearn`). Möglich sind Ordner im Gerätespeicher außer `Android/`; SD-Karten
   und Cloud-Ordner gehen nicht direkt.

Updates installierst du einfach über die alte Version, deine Einstellungen bleiben. Nur wer eine frühere Testfassung
(Debug-APK aus den Actions) hat, muss diese **einmal deinstallieren**, weil die Releases einen anderen Schlüssel tragen.
Dein Datenordner bleibt dabei unberührt.

**Nur Dateien aus dem Release installieren.** Die ZIP-Dateien `testbau-…` unter „Actions“ sind Prüfbauten aus
Pull Requests: ohne Signatur und ohne Update-Schlüssel. Am PC können sie sich nicht selbst aktualisieren, am Handy lässt
sich keine Release-APK darüber installieren.

## Wo der Datenordner liegt

Deine Lerndaten liegen in einem gewöhnlichen Ordner, den du wählst, nie in der App selbst.

- **Am PC** schlägt die App `Dokumente\RespawnedLearn` vor. Nicht erlaubt sind der Programmordner
  (`%LOCALAPPDATA%\RespawnedLearn`) und die internen Ordner der App (`%APPDATA%\io.github.respawnedguy.respawnedlearn`,
  `%LOCALAPPDATA%\io.github.respawnedguy.respawnedlearn`): Beim Deinstallieren mit „App-Daten löschen“ entfernt Windows
  die internen Ordner samt Inhalt. Updates und Deinstallieren lassen deinen Datenordner in Ruhe.
- **Unter Android** liegt er im Gerätespeicher, etwa `/storage/emulated/0/RespawnedLearn`. Updates und Deinstallieren
  lassen ihn in Ruhe.
- **Ordner wechseln:** Einstellungen › Datenordner › „Anderen Ordner wählen“. Ist der neue Ordner leer, kannst du die
  Daten mitnehmen: Die App kopiert sie, vergleicht jede Kopie mit dem Original und wechselt erst dann. Der alte Ordner
  bleibt unverändert, du löschst ihn selbst, wenn alles da ist. Liegen im neuen Ordner schon Lerndaten (etwa von einem
  anderen Gerät), nutzt die App sie ohne Kopie. Gleicht Syncthing den alten Ordner ab, stelle dort den neuen Pfad ein.
- **Lag der Ordner bisher im Programmordner** (bis v0.20.5 öffnete der Ordnerdialog dort), zeigt die App einen Hinweis
  mit „Jetzt umziehen“.
