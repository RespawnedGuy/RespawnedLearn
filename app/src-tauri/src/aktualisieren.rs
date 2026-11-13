//! Updates der App (docs/aktualisieren.md). Kein eigener Server und keine Kennung: Die App fragt nur die Datei
//! `latest.json` im neuesten GitHub-Release ab. Die Oberfläche liest sie mit `kern/aktualisierung.ts` und zeigt den Hinweis.
//!
//! Am PC installiert der Tauri-Updater auf Knopfdruck: Er lädt den Installer und prüft vor dem Start dessen Signatur
//! gegen den öffentlichen Update-Schlüssel, den die GitHub Action beim Bau in die Konfiguration legt
//! (`plugins.updater.pubkey` aus der Variablen TAURI_UPDATER_PUBKEY, Inhalt der .pub von `tauri signer generate`).
//! Außerdem muss die Signatur die angekündigte Version tragen (`requireSignedVersion`), sonst ließe sich ein älterer,
//! echt signierter Installer als neuer ausgeben. Ohne Schlüssel bietet die App keine Installation an.
//! Android kann sich nicht selbst ersetzen: dort öffnet die Oberfläche den Download der APK.

/// Muss mit `plugins.updater.endpoints` in tauri.conf.json und `NEUESTE_ADRESSE` in kern übereinstimmen (Tests)
pub const NEUESTE_ADRESSE: &str = "https://github.com/RespawnedGuy/RespawnedLearn/releases/latest/download/latest.json";

/// Öffentlicher Update-Schlüssel dieses Baus; leer in Bauten ohne Schlüssel (Forks, `npm run tauri dev`)
#[cfg(desktop)]
fn eingebauter_schluessel(app: &tauri::AppHandle) -> String {
    app.config().plugins.0.get("updater").and_then(|u| u.get("pubkey")).and_then(|k| k.as_str()).unwrap_or("").to_string()
}

/// latest.json ist klein; mehr wird nicht gelesen
const HOECHSTENS: usize = 64 * 1024;

/// Liest latest.json. Gleicher Weg am PC und unter Android, ohne Kopfzeilen außer einem allgemeinen Programmnamen.
#[tauri::command]
pub async fn aktualisierung_abrufen() -> Result<String, String> {
    use tauri_plugin_http::reqwest;
    let client = reqwest::Client::builder()
        .user_agent("RespawnedLearn")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let antwort = client.get(NEUESTE_ADRESSE).send().await.map_err(|_| "kein-netz".to_string())?;
    if !antwort.status().is_success() {
        return Err(format!("antwort-{}", antwort.status().as_u16()));
    }
    let bytes = antwort.bytes().await.map_err(|_| "kein-netz".to_string())?;
    if bytes.len() > HOECHSTENS {
        return Err("zu-gross".into());
    }
    String::from_utf8(bytes.to_vec()).map_err(|_| "kein-text".into())
}

/// Ist der Inhalt einer .pub-Datei (Base64, wie ihn Tauri erwartet) ein lesbarer minisign-Schlüssel?
#[cfg(desktop)]
pub fn schluessel_lesbar(schluessel: &str) -> bool {
    oeffentlicher_schluessel(schluessel).is_some()
}

#[cfg(desktop)]
fn oeffentlicher_schluessel(schluessel: &str) -> Option<minisign_verify::PublicKey> {
    use base64::Engine;
    let text = base64::engine::general_purpose::STANDARD.decode(schluessel.trim()).ok()?;
    minisign_verify::PublicKey::decode(std::str::from_utf8(&text).ok()?).ok()
}

/// Kann diese App sich selbst aktualisieren? (PC mit eingebautem Update-Schlüssel)
#[tauri::command]
pub fn aktualisierung_eingerichtet(app: tauri::AppHandle) -> bool {
    #[cfg(desktop)]
    return schluessel_lesbar(&eingebauter_schluessel(&app));
    #[cfg(mobile)]
    return {
        let _ = app;
        false
    };
}

/// Lädt und installiert die neue Version. Der Updater prüft die Signatur, bevor er den Installer startet;
/// unter Windows beendet er dafür die App, der Installer (passiv, ohne Fragen) startet sie danach neu.
#[tauri::command]
pub async fn aktualisierung_installieren(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_updater::UpdaterExt;
        if !schluessel_lesbar(&eingebauter_schluessel(&app)) {
            return Err("nicht-eingerichtet".into());
        }
        let update = app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())?;
        let Some(update) = update else { return Err("keine-neue".into()) };
        // Schlägt die Signaturprüfung fehl, kommt hier ein Fehler zurück und nichts wird gestartet
        update.download_and_install(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
        app.restart();
    }
    #[cfg(mobile)]
    {
        let _ = app;
        Err("nicht-moeglich".into())
    }
}

#[cfg(all(test, desktop))]
mod tests {
    use super::*;
    use base64::Engine;
    use std::path::PathBuf;
    use tauri_plugin_updater::RemoteRelease;

    fn testdaten(name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../testdaten").join(name)
    }

    fn lies(name: &str) -> String {
        std::fs::read_to_string(testdaten(name)).unwrap()
    }

    /// Wie tauri-plugin-updater (verify_signature): Schlüssel und Signatur je als Base64 des minisign-Texts
    fn signatur_gilt(daten: &[u8], signatur: &str, schluessel: &str) -> bool {
        let Some(pk) = oeffentlicher_schluessel(schluessel) else { return false };
        let Ok(text) = base64::engine::general_purpose::STANDARD.decode(signatur) else { return false };
        let Ok(sig) = minisign_verify::Signature::decode(std::str::from_utf8(&text).unwrap()) else { return false };
        pk.verify(daten, &sig, true).is_ok()
    }

    /// Wegwerf-Schlüssel nur für die Tests (der geheime Teil ist gelöscht). Die .pub-Datei von Tauri ist schon Base64,
    /// genau so steht ihr Inhalt in der Variablen des Workflows.
    fn testschluessel() -> String {
        lies("aktualisierung/testschluessel.pub")
    }

    #[test]
    fn updater_liest_die_testtabelle() {
        let r: RemoteRelease = serde_json::from_str(&lies("latest.json")).unwrap();
        assert_eq!(r.version.to_string(), "9.9.9");
        assert!(r.download_url("windows-x86_64-nsis").unwrap().as_str().ends_with("/v9.9.9/RespawnedLearn_9.9.9_x64-setup.exe"));
        assert!(r.download_url("android-aarch64").unwrap().as_str().ends_with("_arm64.apk"));
        assert!(r.download_url("linux-x86_64").is_err());
    }

    #[test]
    fn signatur_aus_der_testtabelle_gilt_nur_fuer_die_echte_datei() {
        let r: RemoteRelease = serde_json::from_str(&lies("latest.json")).unwrap();
        let sig = r.signature("windows-x86_64").unwrap();
        let datei = std::fs::read(testdaten("aktualisierung/RespawnedLearn_9.9.9_x64-setup.exe")).unwrap();
        assert!(signatur_gilt(&datei, sig, &testschluessel()));
        let mut verfaelscht = datei.clone();
        verfaelscht[0] ^= 1;
        assert!(!signatur_gilt(&verfaelscht, sig, &testschluessel()));
        // Signatur einer anderen Datei desselben Schlüssels
        let fremd = r.signature("android-aarch64").unwrap();
        assert!(!signatur_gilt(&datei, fremd, &testschluessel()));
    }

    #[test]
    fn fremder_schluessel_lehnt_ab() {
        // anderer Wegwerf-Schlüssel, ebenfalls mit `tauri signer generate` erzeugt
        let anderer = base64::engine::general_purpose::STANDARD.encode(
            "untrusted comment: minisign public key: 8EA6BC101864FF6E\nRWRu/2QYELymjvZEb7W6v34GRFTPQw3DzVf2NsfrEbkO4DEZ45HitYld\n",
        );
        assert!(schluessel_lesbar(&anderer));
        let r: RemoteRelease = serde_json::from_str(&lies("latest.json")).unwrap();
        let datei = std::fs::read(testdaten("aktualisierung/RespawnedLearn_9.9.9_x64-setup.exe")).unwrap();
        assert!(!signatur_gilt(&datei, r.signature("windows-x86_64").unwrap(), &anderer));
    }

    #[test]
    fn erkennt_lesbare_schluessel() {
        assert!(schluessel_lesbar(&testschluessel()));
        assert!(schluessel_lesbar(&format!("  {}\n", testschluessel())));
        assert!(!schluessel_lesbar(""));
        assert!(!schluessel_lesbar("kein base64"));
        assert!(!schluessel_lesbar(&base64::engine::general_purpose::STANDARD.encode("untrusted comment: x\nRWQ")));
    }

    #[test]
    fn adresse_steht_gleich_in_der_tauri_konfiguration() {
        let konf: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tauri.conf.json")).unwrap()).unwrap();
        assert_eq!(konf["plugins"]["updater"]["endpoints"][0], NEUESTE_ADRESSE);
        // der Schlüssel kommt beim Bau dazu, nie fest in die Konfiguration
        assert_eq!(konf["plugins"]["updater"]["pubkey"], "");
        // nur Installer, deren Signatur die angekündigte Version trägt (schreibt `tauri build` hinein)
        assert_eq!(konf["plugins"]["updater"]["requireSignedVersion"], true);
        // der Updater muss die Konfiguration lesen können, sonst startet die App nicht
        let u: tauri_plugin_updater::Config = serde_json::from_value(konf["plugins"]["updater"].clone()).unwrap();
        assert!(u.require_signed_version && !u.allow_downgrades);
    }
}
