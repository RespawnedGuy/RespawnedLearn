# Datenordner auf mehreren Geräten

RespawnedLearn arbeitet nur mit einem Ordner auf der Platte. Welches Programm ihn zwischen deinen Geräten abgleicht,
ist dir überlassen. Die App erkennt die Konfliktkopien gängiger Programme und räumt auf, wo nichts verloren gehen kann.

## Welches Programm wofür

| Programm | Windows | Android | Hinweis |
|---|---|---|---|
| [Syncthing](https://syncthing.net) | ja | ja ([Syncthing-Fork](https://github.com/Catfriend1/syncthing-android)) | ohne Cloud, direkt zwischen den Geräten; Versionierung „Gestaffelt“ einschalten |
| Nextcloud | Desktop-Client | Nextcloud-App (Ordner synchronisieren) | Konfliktkopien erkennt die App mit Programmname |
| Dropbox | Desktop-App | über FolderSync oder Autosync | Konfliktkopien erkennt die App mit Programmname |
| OneDrive | eingebaut | über FolderSync oder Autosync | Ordner auf „Immer auf diesem Gerät behalten“ stellen |
| Google Drive für Desktop | ja | über FolderSync oder Autosync | Ordner „spiegeln“ statt „streamen“ |
| iCloud Drive | iCloud für Windows | nicht möglich | „Immer auf diesem Gerät behalten“ |

Die Android-Apps von Dropbox, OneDrive und Google Drive gleichen keinen Ordner in beide Richtungen ab. Am Handy brauchst
du dafür eine Sync-App wie FolderSync oder Autosync, die einen Ordner im Gerätespeicher mit dem Cloud-Dienst abgleicht.
Diesen Ordner wählst du dann in RespawnedLearn.

## Wichtig bei Cloud-Diensten

- **Dateien wirklich auf dem Gerät halten.** OneDrive, iCloud und Google Drive legen sonst nur Platzhalter ab, die erst
  beim Öffnen geladen werden. Die App braucht die echten Dateien.
- **FolderSync:** Bei „Bei widersprüchlichen Änderungen“ den Standard „Überspringen“ lassen. FolderSync meldet den
  Konflikt dann selbst; „Neueste behalten“ würde die ältere Fassung ohne Nachfrage überschreiben.
- **Versionen und Papierkorb** des Dienstes sind deine Sicherung, wenn doch etwas schiefgeht.

## Was die App von selbst macht

- **Konfliktkopien** von Syncthing, Nextcloud und Dropbox erkennt sie am Namen. Kopien anderer Programme erkennt sie
  daran, dass eine Datei wie eine vorhandene heißt plus Zusatz („S001 (1).svg“, „…-LAPTOP.json“) oder als Notiz dieselbe
  Kennung trägt.
- **Ohne Nachfrage aufgeräumt** wird nur, wo nichts verloren gehen kann: gleicher Inhalt, eine leere Fassung, eine halb
  übertragene Fassung, die der Anfang der anderen ist, und Lernprotokolle, deren Zeilen zusammengeführt werden.
- **Alles andere** zeigt die Konfliktansicht (roter Hinweis oben): beide Fassungen nebeneinander, du entscheidest.
- **Unvollständige Dateien** (leer, abgebrochen) zeigt sie ebenfalls dort. Ändert die App eine davon, legt sie den alten
  Inhalt vorher als zweite Fassung ab.
- **Ordner plötzlich leer oder viele Dateien weg:** Die App meldet „Sync prüfen“ und schreibt bei leerem Ordner nichts,
  bis die Dateien zurück sind oder du bestätigst, dass der leere Ordner richtig ist.

Die genauen Regeln stehen im Datenvertrag, `vertrag/grundlagen.md`, Abschnitt 8.
