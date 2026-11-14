# Signieren (für Betreuer)

Die GitHub Action (`.github/workflows/build.yml`) signiert nur, wenn die passenden Secrets gesetzt sind. Sie gehören in
das **Environment `release`**, nicht zu den Repository-Secrets: Dann bekommt sie nur ein Lauf auf `main`, und jeder
solche Lauf wartet, bis du ihn freigibst. Schlüssel und Passwörter gehören nie ins Repo.

## Repo absichern (einmal, vor dem Öffentlichmachen)

Wer auf `main` pushen kann, bekäme sonst über die Action ein echt signiertes Update an alle Nutzer. Deshalb:

1. **Environment anlegen:** Settings → Environments → New environment, Name `release`.
   - *Required reviewers:* dich selbst eintragen, *Prevent self-review* aus lassen (du gibst deine eigenen Läufe frei).
   - *Deployment branches and tags:* „Selected branches and tags“ → `main`.
   - *Environment secrets:* alle Secrets aus den Abschnitten unten hier anlegen (`ANDROID_KEY_*`, `TAURI_SIGNING_*`,
     später `WINDOWS_PFX_*`). Die Variable `TAURI_UPDATER_PUBKEY` ist öffentlich und muss eine Repository-Variable sein, nicht im Environment: Der Schritt „Release“ läuft ohne Environment und fände sie sonst nicht.
   - Danach die alten **Repository-Secrets** gleichen Namens löschen (Settings → Secrets and variables → Actions).
2. **`main` schützen:** Settings → Rules → Rulesets → New branch ruleset, Name `main`, *Enforcement* „Active“,
   *Target branches* „Include default branch“. Anhaken: *Restrict deletions*, *Block force pushes*, *Require a pull
   request before merging* (Required approvals 0, du mergst selbst), *Require status checks to pass* mit „Tests und Build“.
   Keine Bypass-Liste, damit auch die Claude-App nur über Pull Requests ändert.
3. **Secret Scanning:** Settings → Advanced Security → *Secret Protection* und *Push protection* einschalten
   (für öffentliche Repos kostenlos).
4. **Fremde Pull Requests:** Settings → Actions → General → *Approval for running fork pull request workflows from
   contributors* → „Require approval for all external contributors“.
5. **Konto:** github.com/settings/security → Passkey oder Zwei-Faktor einschalten.
6. **Mailadresse:** github.com/settings/emails → „Keep my email addresses private“ und „Block command line pushes that
   expose my email“. Sonst steht deine private Adresse in jedem Merge-Commit, den du über die Weboberfläche anlegst.

Ein Release läuft danach so: Pull Request mergen → Action baut → unter Actions im Lauf „Review deployments“ →
`release` anhaken → Approve. Erst dann signieren Windows- und Android-Job, danach entsteht der Release.

## Android: eigener Schlüssel (kostenlos)

Einmalig auf dem eigenen Rechner (`keytool` gehört zu jedem JDK, auch zu Android Studio):

```
keytool -genkeypair -v -keystore respawnedlearn.jks -alias respawnedlearn -keyalg RSA -keysize 4096 -validity 10000
```

Nimm ein langes Passwort **nur aus Buchstaben und Ziffern** (es landet in einer Properties-Datei) und dasselbe für Schlüssel
und Keystore. Dann die Secrets setzen:

| Secret | Inhalt |
|---|---|
| `ANDROID_KEY_BASE64` | die Datei als Base64: PowerShell `[Convert]::ToBase64String([IO.File]::ReadAllBytes("respawnedlearn.jks"))` |
| `ANDROID_KEY_ALIAS` | `respawnedlearn` |
| `ANDROID_KEY_PASSWORD` | das Passwort |

**Sichere `respawnedlearn.jks` und das Passwort an zwei Orten** (z. B. Passwortmanager). Ohne diesen Schlüssel lassen sich
installierte Apps nie mehr aktualisieren, Nutzer müssten deinstallieren. Fehlen die Secrets, baut die Action eine Debug-APK.

Prüfen: Die Action zeigt im Schritt „Signatur prüfen“ das Zertifikat (`apksigner verify --print-certs`) und bricht ab, wenn
eine Release-APK den Debug-Schlüssel trägt.

## Updates: eigener Update-Schlüssel (kostenlos)

Damit sich installierte Apps selbst aktualisieren ([aktualisieren.md](aktualisieren.md)), signiert die Action jeden
Installer und jede APK zusätzlich mit einem Update-Schlüssel (minisign). Einmalig auf dem eigenen Rechner im Repo-Ordner
nach `npm ci`:

```
npx tauri signer generate -w respawnedlearn-update.key
```

Ein Passwort ist freiwillig, empfohlen ist eins. Es entstehen zwei Dateien: `respawnedlearn-update.key` (geheim) und
`respawnedlearn-update.key.pub` (öffentlich). Dann im Environment `release` (Secrets) bzw. unter Settings → Secrets and variables → Actions (Variable):

| Wo | Name | Inhalt |
|---|---|---|
| Secret | `TAURI_SIGNING_PRIVATE_KEY` | Inhalt von `respawnedlearn-update.key` |
| Secret | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | das Passwort (leer lassen, wenn keins) |
| Variable (Reiter „Variables“) | `TAURI_UPDATER_PUBKEY` | Inhalt von `respawnedlearn-update.key.pub` |

Der öffentliche Schlüssel kommt beim Bau in die App, er ist nicht geheim. **Sichere die `.key`-Datei und das Passwort an
zwei Orten.** Ohne sie bekommt keine installierte App mehr Updates, Nutzer müssten den neuen Installer von Hand laden.

Prüfen: Die Action bricht ab, wenn das Secret ohne die Variable gesetzt ist, und prüft vor und nach dem Hochladen jede
Signatur in `latest.json` selbst gegen `TAURI_UPDATER_PUBKEY` nach (`tools/neueste.mjs`, Ed25519 über `node:crypto`).
Passen Schlüssel und Variable nicht zusammen, entsteht kein Release.

## Windows: Schalter für später

Mit den Secrets `WINDOWS_PFX_BASE64` (Zertifikat als PFX, Base64) und `WINDOWS_PFX_PASSWORT` signiert Tauri App-EXE und
beide Installer über `tools/windows-signieren.ps1` (signtool, SHA-256, Zeitstempel). Ohne Secrets baut die Action
unsigniert und probt den ganzen Weg bei jedem Lauf mit einem Wegwerf-Zertifikat (`tools/windows-signierprobe.ps1`,
Prüfung mit `signtool verify /pa`), damit das Einschalten später nicht scheitert.

Wege zu einem echten Zertifikat (Stand November 2026, laut
[Microsoft](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options) und
[SignPath](https://signpath.org/terms)):

| Weg | Kosten | Bedingungen |
|---|---|---|
| SignPath Foundation | 0 € | Open Source mit OSI-Lizenz (AGPL passt), Freigabe jedes Releases von Hand, MFA, Abschnitt „Code signing policy“ auf der Download-Seite; Herausgeber im Zertifikat ist „SignPath Foundation“. Signiert über die eigene GitHub-Aktion von SignPath, braucht eine kleine Anpassung statt des PFX-Schalters. |
| Azure Artifact Signing | ca. 9,99 $/Monat | Einzelpersonen nur in USA und Kanada, in der EU nur Organisationen. Läuft über `signCommand` mit eigenem Werkzeug, ebenfalls kleine Anpassung. |
| OV-Zertifikat einer CA | ca. 150–300 $/Jahr | Schlüssel seit 2023 nur auf Hardware-Token oder in einer Cloud-HSM; ein Token lässt sich nicht als PFX exportieren, für die Action braucht es dann die Cloud-Variante der CA. |

Keiner dieser Wege lässt die SmartScreen-Warnung sofort verschwinden (seit 2024 auch EV nicht mehr): Vertrauen wächst über
mehrere Releases mit derselben Signatur.
