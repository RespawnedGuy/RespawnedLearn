# RespawnedLearn installieren

Die fertigen Pakete stehen unter **Releases** (rechte Spalte auf der Startseite des Repos). Jede Version hat:

| Datei | Wofür |
|---|---|
| `RespawnedLearn_<version>_x64-setup.exe` | Windows-Installer (empfohlen) |
| `RespawnedLearn_<version>_x64_en-US.msi` | Windows-Installer für verwaltete Rechner |
| `RespawnedLearn_<version>_arm64.apk` | Android (Handys und Tablets mit 64-Bit-ARM, also fast alle) |
| `SHA256SUMS.txt` | Prüfsummen aller Dateien |

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
3. Der Installer legt RespawnedLearn im Startmenü an. Beim ersten Start wählst du den Datenordner, zum Beispiel deinen
   Syncthing-Ordner.

Lädst du nur von dieser Releases-Seite und stimmt die Prüfsumme, ist die Warnung kein Hinweis auf ein Problem.

## Android

1. Lade die `.apk` am Handy herunter und tippe sie an.
2. Android fragt, ob der Browser (oder die Datei-App) **unbekannte Apps installieren** darf. Erlaube es für diese eine App;
   danach kannst du es in den Einstellungen wieder abschalten.
3. Google Play Protect zeigt eventuell „Unbekannte App“. Wähle **Details** und **Trotzdem installieren**.
4. Beim ersten Start erklärt RespawnedLearn, wozu es **Zugriff auf alle Dateien** braucht: damit es im Syncthing-Ordner
   schreiben darf (so wie Obsidian). Tippe auf **Zugriff erlauben**, schalte den Zugriff in den Einstellungen ein und
   kehre zurück. Ohne diese Freigabe kann die App deinen Datenordner nicht lesen.

Updates installierst du einfach über die alte Version, deine Einstellungen bleiben. Nur wer eine frühere Testfassung
(Debug-APK aus den Actions) hat, muss diese **einmal deinstallieren**, weil die Releases einen anderen Schlüssel tragen.
Dein Datenordner bleibt dabei unberührt.
