# KI in RespawnedLearn einrichten

RespawnedLearn hilft beim Lernen mit KI: Es erklärt markierte Stellen, gibt Rückmeldung auf deine Antworten
(auch handschriftlich) und schlägt Fragen für Lernkarten vor. Dafür nutzt du **deinen eigenen Zugang** bei einem
KI-Anbieter. Die App hat keinen Server dazwischen: Die Anfrage geht direkt von deinem Gerät zum Anbieter.

Ohne KI funktioniert alles andere genauso.

Eingerichtet wird unter **Einstellungen (Zahnrad oben rechts) › KI**:

1. Anbieter antippen und der Anleitung folgen.
2. Schlüssel einfügen (bei Ollama die Adresse) und **Verbinden** tippen. Die App holt die Liste der Modelle direkt vom Anbieter.
3. Ein Modell wählen. Ab jetzt ist dieser Anbieter aktiv.
4. Wer sicher gehen will, tippt **Testen**: Das ist eine winzige Anfrage, die prüft, ob das Modell im verlangten Format antwortet.

## Wo der Schlüssel liegt

Der Schlüssel bleibt **auf dem Gerät**, im Konfigurationsordner der App (unter Android im privaten Speicher der App).
Im Klartext liegt er nie im Datenordner.
Wer den Schlüssel loswerden will, tippt „Schlüssel entfernen“ und löscht ihn zusätzlich beim Anbieter.

### Auf allen Geräten nutzen

Damit du nicht auf jedem Gerät einen eigenen Schlüssel brauchst (und alle erneuern musst, wenn sie verfallen), kannst
du den Zugang unter **Einstellungen › KI › Auf allen Geräten** mit einem Passwort verschlüsselt in den Datenordner legen.

1. Auf dem ersten Gerät den Schlüssel eintragen, dann „Einrichten“ und ein Passwort vergeben. Am besten ein Satz aus
   mehreren Wörtern, aufbewahrt in deinem Passwortmanager.
2. Auf jedem weiteren Gerät, sobald Syncthing den Ordner gebracht hat, unter Einstellungen › KI einmal das Passwort
   eingeben.
3. Einen neuen Schlüssel trägst du danach auf irgendeinem Gerät ein; die anderen übernehmen ihn ohne Neustart.

So ist es geschützt: Die Datei `lernen/einstellungen/ki-zugang.verschluesselt.json` ist mit XChaCha20-Poly1305
verschlüsselt, der Schlüssel dazu mit Argon2id (64 MB Speicher je Versuch) aus deinem Passwort abgeleitet. Wer nur den
Ordner oder ein Backup hat, kommt ohne Passwort nicht an deine Schlüssel. Das Passwort selbst speichert die App
nirgends; jedes Gerät merkt sich nur den daraus geöffneten Datenschlüssel.

- **Passwort ändern:** Deine anderen Geräte fragen danach einmal nach dem neuen Passwort. Das ist auch der Weg, wenn
  ein Gerät verloren geht; erneuere dann zusätzlich den Schlüssel beim Anbieter.
- **Passwort vergessen:** Es gibt keine Hintertür. „Passwort vergessen?“ ersetzt den gemeinsamen Zugang durch den
  Zugang dieses Geräts mit einem neuen Passwort.
- **Gleichzeitig auf zwei Geräten geändert:** Unter „Konflikte“ stehen beide Fassungen, Schlüssel nur mit den letzten
  vier Zeichen. Du entscheidest, welche gilt.
- Die Adresse eines Ollama-Rechners wird mitgeteilt; das passt, wenn alle Geräte ihn im selben Netz erreichen.

## Die Anbieter

Stand der Angaben: Doku der Anbieter, geprüft am 13.11.2026. Preise ändern sich, darum stehen hier keine Preise.
Die Modellliste in der App kommt immer frisch vom Anbieter.

### Anthropic (Claude)

- Schlüssel: <https://platform.claude.com/settings/keys> („Create key“; der Schlüssel beginnt mit `sk-ant-` und wird nur einmal angezeigt).
- Vorher unter „Billing“ Guthaben aufladen.
- Ein Claude-Abo (Pro, Max) gilt für die API nicht; die API rechnet nach Verbrauch ab. Abo-Token (`sk-ant-oat…`) nimmt die App nicht.
- Für Opus 5.5, Sonnet 5.5 und Fable 5.x schaltet die App das serverseitige Ausweichen bei Ablehnungen ein: Lehnt das Modell eine harmlose Anfrage fälschlich ab, beantwortet sie ein anderes Claude-Modell.

### OpenAI (ChatGPT)

- Schlüssel: <https://platform.openai.com/api-keys>.
- Guthaben unter „Billing“ aufladen. Ein ChatGPT-Abo gilt für die API nicht.
- Die App zeigt nur Modelle, mit denen man chatten kann (keine Bild-, Ton- oder Embedding-Modelle).

### Google Gemini

- Schlüssel: <https://aistudio.google.com/apikey>.
- Gemini hat ein kostenloses Kontingent.
- Datenschutz laut [Bedingungen](https://ai.google.dev/gemini-api/terms) (Stand 23.03.2026): Im kostenlosen Kontingent nutzt Google Eingaben und Antworten zur Verbesserung seiner Produkte, und Menschen können sie lesen. **Im Europäischen Wirtschaftsraum, in der Schweiz und in Großbritannien gelten auch für die kostenlose Nutzung die Regeln des bezahlten Dienstes:** Dann nutzt Google deine Eingaben nicht zum Verbessern seiner Produkte und speichert sie nur begrenzt zur Missbrauchserkennung.

### Perplexity

- Erst ein Projekt anlegen: <https://console.perplexity.ai/project/settings>, dann den Schlüssel: <https://console.perplexity.ai/project/keys> (wird nur einmal angezeigt).
- Die App nutzt Perplexitys OpenAI-kompatible Schnittstelle. Darüber stehen Modelle verschiedener Hersteller zur Wahl; die Liste in der App nennt die Preise je Million Tokens.
- Beim ersten Mal kann eine Anfrage 10 bis 30 Sekunden dauern, weil Perplexity das Antwortformat vorbereitet.

### Ollama (eigener Rechner)

Ein Modell läuft auf deinem eigenen Rechner. Nichts verlässt dein Netz, es kostet nichts, braucht aber einen
kräftigen Rechner (am besten mit Grafikkarte).

1. Ollama installieren: <https://ollama.com/download>.
2. Ein Modell laden, z. B. `ollama pull gemma3`. Für Rückmeldung auf Handschrift braucht es ein Modell mit Bildverständnis; die App zeigt in der Liste „ohne Bilder“ an, wenn ein Modell keine Bilder liest.
3. Läuft die App auf demselben Rechner: Adresse `http://localhost:11434`.
4. Für das Handy oder einen zweiten Rechner im Heimnetz muss Ollama im Netz erreichbar sein ([FAQ](https://docs.ollama.com/faq)):
   - **Windows:** Ollama in der Taskleiste beenden, in den Umgebungsvariablen für dein Konto `OLLAMA_HOST` = `0.0.0.0:11434` anlegen, Ollama neu starten.
   - **macOS:** `launchctl setenv OLLAMA_HOST "0.0.0.0:11434"`, dann Ollama neu starten.
   - **Linux (systemd):** `systemctl edit ollama.service`, unter `[Service]` die Zeile `Environment="OLLAMA_HOST=0.0.0.0:11434"` ergänzen, dann `systemctl daemon-reload` und `systemctl restart ollama`.
   
   In der App dann die Adresse des Rechners im Heimnetz eintragen, z. B. `http://192.168.1.20:11434`.
5. Die Verbindung im Heimnetz ist unverschlüsselt (http). Die App erlaubt unverschlüsselte Verbindungen nur auf Port 11434.

## Anweisungen an die KI anpassen

Unter **Einstellungen › Anweisungen an die KI** steht für jede Aufgabe (Erklären, Rückmeldung, Frage vorschlagen,
Rechtschreibung, Kapitelfragen, Rechenaufgaben, Vorfragen), wie die KI vorgehen soll. Du kannst jeden Text ändern;
**Standard** holt den Originaltext zurück.

- Eigene Fassungen liegen im Datenordner (`lernen/einstellungen/ki-prompts.json`) und gelten damit auf allen Geräten.
- Gespeichert wird nur, was vom Standard abweicht. Verbessert ein Update den Standard, bekommst du ihn automatisch, solange du die Anweisung nicht selbst geändert hast.
- Das Antwortformat ist nicht Teil der Anweisung. Die App gibt es dem Anbieter getrennt vor und prüft jede Antwort, bevor sie etwas speichert. Ein geänderter Text kann die Funktion deshalb nicht zerlegen, höchstens die Qualität der Antworten ändern.

## Wenn etwas nicht geht

| Meldung | Was tun |
|---|---|
| Schlüssel nicht angenommen | Schlüssel neu kopieren (ohne Leerzeichen), beim Anbieter prüfen, ob er noch gilt. |
| Kein Guthaben oder Kontingent | Beim Anbieter Guthaben aufladen oder warten, bis das Kontingent wieder frei ist. |
| Zu viele Anfragen | Eine Minute warten. |
| Modell gibt es nicht | In den Einstellungen „Verbinden“ tippen und ein Modell aus der aktuellen Liste wählen. |
| Nicht im verlangten Format | Noch einmal versuchen oder ein größeres Modell wählen. Kleine lokale Modelle halten sich nicht immer an das Format. |
| Kein Netz | KI geht nur mit Verbindung zum Anbieter (bzw. zum eigenen Rechner mit Ollama). |
| Liest keine Bilder | Ein Modell mit Bildverständnis wählen oder die Antwort tippen. |
