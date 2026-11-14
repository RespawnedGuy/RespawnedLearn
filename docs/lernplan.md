# Lernplan, ECTS und Lernzeit

Ab Version 0.23.0 kann ein Modul (Studienmodul, Buch, Kurs, Seminar) einen Umfang und einen Termin bekommen. Die App
misst nebenbei, wie lange du lernst, und rechnet daraus einen Lernplan. Alles ist freiwillig, ohne Angaben ändert sich
nichts. Eine KI braucht es dafür nicht.

## Umfang und Termin

Auf der Seite eines Moduls stehen unter dem Ziel vier Felder:

- **ECTS**: die Leistungspunkte aus dem Modulhandbuch, z. B. 5. Ein Punkt steht für 25 bis 30 Stunden Arbeit
  ([ECTS-Leitfaden der EU](https://education.ec.europa.eu/sites/default/files/document-library-docs/ects-users-guide_en.pdf),
  Abschnitt 1). Die App rechnet mit 30; ändern lässt sich das unter Einstellungen › Lernzeit.
- **oder Stunden**: für alles ohne ECTS (Schule, Kurs, Buch). Stunden haben Vorrang vor ECTS.
- **Termin**: Prüfung oder Abgabe.
- **Stunden pro Woche**: so viel Zeit hast du eingeplant.

Darunter steht, wie viel du schon gelernt hast, wie lange das Lesen noch etwa dauert und ob es bis zum Termin reicht.
Die letzte Woche vor dem Termin plant die App immer als Wiederholung ein.

## Lernzeit

Gezählt wird nur, solange ein Skript, ein Notizbuch, eine Mitschrift oder eine Lernrunde offen ist, die App zu sehen
ist und du in den letzten 5 Minuten etwas getan hast (blättern, schreiben, tippen). Einen Start-Knopf gibt es nicht.
Jedes Gerät schreibt seine Zeit in eine eigene Datei (`lernen/zeit/`), so entstehen beim Abgleich keine Konflikte.

Vorlesung, Übungen auf Papier und die Prüfung selbst zählen nicht mit. Deine gemessene Zeit liegt darum meist unter der
Zahl aus den ECTS. Unter Einstellungen › Lernzeit steht dein Schnitt, sobald zwei Module abgeschlossen sind.

## Der Lernplan

Die App teilt die PDFs eines Moduls in Abschnitte (Kapitel aus dem Inhaltsverzeichnis) und die Abschnitte in Pakete von
etwa 25 Minuten. Stellst du beim Pomodoro-Timer eine andere Zeit ein, nimmt der Plan diese. Bis 20 Seiten gelesen sind,
rechnet die App mit 5 Minuten je Seite (eine Schätzung), danach mit deinem Tempo.

- Gezeigt werden nur das aktuelle Paket und die drei nächsten. Der ganze Plan ist unter „Ganzer Plan“ eingeklappt.
- Ein Paket ist erledigt, sobald du im Skript über seine letzte Seite hinaus bist. Abhaken musst du nichts.
- Ein Kapitel, das dir schwerfällt, markierst du im ganzen Plan als „schwer“; es bekommt doppelt so viel Zeit je Seite.
- **Eigene Einheiten**: Unter dem Plan kannst du einzelne Fakten oder Aufgaben eintragen, mit Seite. Sie stehen dann beim
  passenden Paket und lassen sich abhaken. Sie liegen als normale Aufgabenliste unter `## Lernplan` in der Moduldatei
  (`lernen/module/<id>.md`) und sind mit jedem Editor lesbar.

## „Übung?“

Hast du einen Abschnitt fertig gelesen und gibt es dazu schon Kapitelfragen oder Lernkarten, erscheint im Skript oben
ein kleiner Knopf „Übung?“. Er führt zu den Fragen. Ignorierst du ihn, passiert nichts; mit ✕ verschwindet er für diesen
Abschnitt. Für Module ohne Übungen schaltest du den Vorschlag im ganzen Plan ab.

## Übersicht über alle Module

Der Tab „Übersicht“ ganz links (am Handy „Heute“) zeigt alle Module auf einen Blick:

- **Jetzt dran**: je Modul das nächste Paket. Antippen öffnet das Skript an dieser Seite. Module, die hinter dem Plan
  liegen, stehen oben, danach die mit dem nächsten Termin, dann die zuletzt gelesenen.
- **Diese Woche**: gemessene Lernzeit seit Montag, verglichen mit den Stunden pro Woche aller laufenden Module.
- **Module**: je Modul gelesene Seiten, Termin, ob es bis zur Wiederholung reicht, offene eigene Einheiten und fällige
  Karten. Antippen öffnet die Modulseite. Abgeschlossene Module fehlen hier.

Die Übersicht rechnet mit denselben Zahlen wie die Modulseite und schreibt nichts.

Unter Einstellungen › Beim Öffnen stellst du je Gerät ein, ob die App mit der Übersicht startet oder gleich im zuletzt
offenen Skript weitermacht.
