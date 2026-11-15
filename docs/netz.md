# Zugang übers Netz (iPhone, iPad, fremde Rechner)

Für Geräte ohne eigene App, etwa ein iPhone, kann die Desktop-App unter Windows ihre Oberfläche im eigenen
[Tailscale](https://tailscale.com)-Netz freigeben. Das Gerät öffnet RespawnedLearn dann in Safari und legt es auf den
Homescreen. Jedes Tailscale-Konto arbeitet in seinem eigenen Datenordner auf dem Rechner, der freigibt.

Es gibt keinen offenen Port im Internet: Die App lauscht nur auf `127.0.0.1`, erreichbar wird sie allein über
`tailscale serve` (HTTPS mit Zertifikat). Wer fragt, sagt Tailscale der App; ein Konto ohne eingetragenen Ordner bekommt
nur eine Seite „Kein Zugang“.

## Was du wissen solltest

- **Der Rechner muss laufen und wach sein, und die App muss offen sein.** In den Energieoptionen von Windows
  „Bei Netzbetrieb in den Energiesparmodus wechseln nach: Nie“ einstellen.
- **Ohne Verbindung geht am iPhone nichts.** Die Daten liegen auf dem Rechner. Bricht die Verbindung beim Schreiben ab,
  hält die App den Text und schreibt nach, sobald der Rechner wieder antwortet; wer die Seite vorher schließt, verliert,
  was noch nicht gespeichert war. Ob alles gespeichert ist, zeigt der Punkt oben rechts.
- **Die Daten der anderen liegen bei dir.** Wer den Rechner bedient, kann die Ordner lesen. Sichere sie wie deine
  eigenen.
- **Updates kommen von selbst:** Sobald die Desktop-App aktualisiert ist, bekommt das iPhone beim nächsten Öffnen die
  neue Fassung.
- **Nicht in der Browser-Fassung:** „Nicht stören“ während der Lernzeit, der gemeinsame verschlüsselte KI-Zugang und die
  Wahl des Datenordners (der steht auf dem Rechner fest). Ton nach der Pause kommt erst, nachdem man einmal getippt hat.
- **Apple Pencil** geht am iPad wie ein Stift am Surface (Handballen wird erkannt). Am iPhone schreibt man mit dem Finger.
- Sehr große PDFs können am iPhone den Speicher füllen; Safari lädt die Seite dann neu.

## Einrichten auf dem Rechner (einmal)

1. **Tailscale** installieren und anmelden.
2. In der [Tailscale-Verwaltung](https://login.tailscale.com/admin/dns) unter **DNS** „MagicDNS“ und
   „HTTPS Certificates“ einschalten (sonst fragt `tailscale serve` beim ersten Mal selbst danach).
3. In RespawnedLearn unter **Einstellungen › Zugang übers Netz**:
   - je Person das Tailscale-Konto (Form `name@anbieter`, so wie es in der Tailscale-App steht) und einen eigenen,
     vollständigen Ordnerpfad eintragen, etwa `C:\Users\<du>\Documents\RespawnedLearn-<Name>`. Der Ordner wird angelegt.
     Dein eigenes Konto darf auf deinen gewohnten Datenordner zeigen; dann arbeiten App und iPhone auf denselben Dateien.
   - „Freigeben“ anhaken, „Übernehmen“. Darunter steht „Läuft auf diesem Rechner unter 127.0.0.1:4387“.
4. In der Eingabeaufforderung einmal:

   ```
   tailscale serve --bg localhost:4387
   ```

   Tailscale nennt die Adresse, etwa `https://<rechner>.<tailnet>.ts.net/`. Die Einstellung bleibt auch nach einem
   Neustart. Anzeigen mit `tailscale serve status`, abschalten mit `tailscale serve reset`.

## Eine andere Person einladen

Am einfachsten teilst du nur diesen einen Rechner ([Tailscale: Sharing](https://tailscale.com/docs/features/sharing)).
Die Person bleibt in ihrem eigenen Tailscale-Netz, sieht nur deinen Rechner, und es kostet nichts.

1. In der Verwaltung unter **Machines** beim Rechner **Share** wählen und den Einladungslink schicken.
2. Die Person installiert Tailscale (iPhone: App Store), meldet sich mit einem eigenen Konto an und nimmt die Einladung
   an. Alle ihre Geräte mit diesem Konto (etwa iPhone und iPad) arbeiten dann im selben Ordner.
3. **Wichtig:** Mit der Standardregel von Tailscale („alles erlaubt“) erreicht ein geteiltes Gerät jeden Port deines
   Rechners, etwa Windows-Freigaben. Beschränke geteilte Konten in der
   [Zugriffsrichtlinie](https://login.tailscale.com/admin/acls) auf HTTPS. Steht dort noch die Standardregel, ersetze sie
   durch:

   ```json
   "grants": [
     { "src": ["autogroup:member"], "dst": ["*"], "ip": ["*"] },
     { "src": ["autogroup:shared"], "dst": ["*"], "ip": ["443"] }
   ]
   ```

   Die erste Zeile lässt deine eigenen Geräte wie bisher alles, die zweite erlaubt geteilten Konten nur Port 443, also
   RespawnedLearn.
4. Das Tailscale-Konto der Person trägst du wie oben in RespawnedLearn ein.

Getaggte Geräte schickt Tailscale ohne Konto; sie bekommen keinen Zugang.

## Am iPhone oder iPad

1. Tailscale-App öffnen und verbinden.
2. In **Safari** die Adresse öffnen, die Tailscale auf dem Rechner genannt hat.
3. Teilen-Knopf › **Zum Home-Bildschirm**. Ab dann startet RespawnedLearn wie eine App, ohne Browserleiste.
4. KI: In den Einstellungen wie in der App den eigenen Schlüssel eintragen. Er liegt danach je Konto auf dem Rechner,
   nicht im Datenordner. Die Anfragen schickt der Rechner, und nur an Anthropic, OpenAI, Google Gemini, Perplexity und
   Ollama im eigenen Netz.

Gedacht ist die Browser-Fassung für aktuelles Safari (iOS 18 und neuer); ältere Versionen können an pdf.js scheitern.
Geprüft ist sie bisher in Chromium mit iPhone-Maßen, noch nicht auf einem echten iPhone.

## Wenn etwas nicht geht

| Was du siehst | Woran es liegt |
|---|---|
| „Nur über Tailscale erreichbar“ | Die Seite wurde nicht über die `ts.net`-Adresse geöffnet, oder das Gerät ist getaggt. |
| „Für dein Tailscale-Konto ist hier kein Datenordner eingetragen“ | Das Konto steht nicht oder anders geschrieben in den Einstellungen am Rechner. |
| Seite lädt nicht | Rechner schläft, App ist zu, Tailscale am iPhone getrennt, oder `tailscale serve` fehlt. |
| Rote Meldung unter „Übernehmen“ | Port belegt (anderen wählen und `tailscale serve` mit dem neuen Port wiederholen) oder Ordner an einem gesperrten Ort. |

## Technik

- Server: `app/src-tauri/src/netz/` (axum, nur `127.0.0.1`, Tests ohne Netz in `server_tests.rs`), Einstellung
  `netz.json` im Konfigurationsordner der App, KI-Zugang je Konto in `netz-ki/`.
- Jede Anfrage braucht den Kopf `Tailscale-User-Login` (setzt Serve und entfernt gefälschte), Anfragen an `/api/`
  zusätzlich `Rl-Anfrage: 1` und, wenn der Browser ihn schickt, `Sec-Fetch-Site: same-origin` (Schutz vor fremden
  Webseiten). DNS-Rebinding scheitert am Zertifikat von Serve.
- Dateien: dieselben Funktionen wie in der App (`ordner.rs`: kein Pfad außerhalb des Ordners, keine Symlinks, atomar,
  Schreiben nur auf erwartetem Stempel, sonst 409 und Konfliktkopie, gelöscht werden nur Konfliktkopien).
- Oberfläche: `oberflaeche/daten/netz.ts` (`netzAblage`, Ereignisstrom statt Dateiüberwachung). Kein Datenvertrag
  betroffen: Der Ordner sieht genauso aus wie mit der App.
