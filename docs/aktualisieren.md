# Updates

RespawnedLearn kann sich ab Version 0.20.0 selbst auf den neuesten Stand bringen. Dafür gibt es keinen eigenen Server:
Neue Versionen liegen als Release auf GitHub, zusammen mit einer kleinen Versionsliste `latest.json`.

## Was die App tut

- **Beim Start** fragt die App einmal die Datei `latest.json` aus dem neuesten Release ab
  (`https://github.com/RespawnedGuy/RespawnedLearn/releases/latest/download/latest.json`). Ist dort eine neuere Version,
  zeigt sie oben einen Hinweis mit „Installieren“ (PC) oder „APK herunterladen“ (Android), „Mehr“ und „Später“.
  „Später“ blendet diese Version beim Start aus; in den Einstellungen bleibt sie sichtbar.
- **Abschalten:** Einstellungen → Updates → „Beim Start nach neuen Versionen suchen“. Die Einstellung gilt je Gerät.
  „Jetzt suchen“ geht immer.
- **Ohne Netz** sagt die App beim Start nichts und arbeitet normal weiter.

## Datenschutz

Die Abfrage ist ein gewöhnlicher Abruf einer Datei von GitHub. Die App sendet keine Kennung, keine Geräte- oder
Nutzungsdaten und nichts aus deinem Datenordner; als Programmname nennt sie nur „RespawnedLearn“. GitHub sieht wie bei
jedem Seitenaufruf deine IP-Adresse (Datenschutzerklärung von GitHub). Wer das nicht möchte, schaltet die Prüfung ab.

## Windows

„Installieren und neu starten“ lädt den neuen Installer und prüft vor dem Start seine **Signatur** gegen den öffentlichen
Update-Schlüssel, der in der App steckt. Die Signatur muss außerdem die angekündigte Versionsnummer tragen; so kann niemand
eine ältere, echt signierte Version als neue ausgeben. Passt etwas nicht, installiert die App nichts und sagt das.
Danach beendet sich die App, der Installer läuft ohne Fragen durch und startet sie neu. Dein Datenordner bleibt, wie er ist.

SmartScreen warnt bei der **ersten** Installation aus dem Browser, solange die App kein bezahltes Zertifikat trägt
(siehe [installieren.md](installieren.md)). Updates lädt die App selbst, nicht der Browser; die Datei trägt darum nicht
die Browser-Markierung, an der SmartScreen ansetzt, und eine Warnung ist nicht zu erwarten.

Zurück zu einer älteren Version: deren Installer aus den [Releases](https://github.com/RespawnedGuy/RespawnedLearn/releases)
laden und installieren. Die App selbst geht nie automatisch zurück.

## Android

Android erlaubt einer App nicht, sich selbst zu ersetzen. Die App öffnet darum den Download der neuen APK im Browser;
installiert wird wie beim ersten Mal. Android nimmt das Update nur an, wenn die APK mit demselben Schlüssel signiert ist
wie die installierte App, und behält alle Einstellungen. F-Droid oder der Play Store können später dazukommen.

## Mehrere Geräte

Bekommt der PC eine neue Version früher als das Handy, kann die neuere App Dateien in einer neueren Form schreiben.
Dafür trägt jede App ihre Datenvertrags-Version in `lernen/vertrag.json` ein (Datenvertrag, Grundlagen 8). Findet eine
ältere App dort eine neuere Version, zeigt sie oben „Bitte zuerst die App aktualisieren“.

## Für Betreuer

Releases baut die GitHub Action (`.github/workflows/build.yml`). Mit dem Update-Schlüssel (Secrets und Variable, siehe
[signieren.md](signieren.md#updates-eigener-update-schlüssel-kostenlos)) schreibt sie zu Installer und APK je eine `.sig`,
baut daraus `latest.json` (`tools/neueste.mjs`), prüft vor und nach dem Hochladen jede Signatur selbst nach und
veröffentlicht den Release als „Latest“. Ohne Schlüssel gibt es kein `latest.json`, die Apps sehen dann kein Update.
Downloads ohne Anmeldung gehen nur aus einem öffentlichen Repo.
