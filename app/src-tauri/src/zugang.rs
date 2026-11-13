//! KI-Zugang des Geräts: gewählter Anbieter, Modelle, Schlüssel, Adresse eines eigenen KI-Rechners.
//! Liegt im Konfigurationsordner der App (unter Android im privaten Speicher der App), nie im Datenordner,
//! damit Syncthing keine Schlüssel verteilt (Vertrag Lernen 1.1, Grundlagen 8). Rust kennt den Inhalt nicht,
//! es speichert nur ein JSON-Objekt; was darin steht, bestimmt die Oberfläche (app/src/ki/zugang.ts).

use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::Path;

/// Liest den gespeicherten Zugang; fehlt die Datei oder ist sie kaputt, gibt es keinen (die App läuft dann ohne KI)
pub fn lesen(datei: &Path) -> Option<Value> {
    let b = fs::read(datei).ok()?;
    serde_json::from_slice::<Value>(&b).ok().filter(Value::is_object)
}

/// Schreibt den Zugang atomar (Zwischendatei, dann umbenennen); `None` löscht ihn.
/// Unter Unix darf nur der Nutzer selbst die Datei lesen (Rechte 600).
pub fn setzen(datei: &Path, wert: Option<&Value>) -> Result<(), String> {
    let Some(wert) = wert else {
        return match fs::remove_file(datei) {
            Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
            _ => Ok(()),
        };
    };
    if !wert.is_object() {
        return Err("Der KI-Zugang muss ein Objekt sein".into());
    }
    let ordner = datei.parent().ok_or("Kein Ordner für den KI-Zugang")?;
    fs::create_dir_all(ordner).map_err(|e| e.to_string())?;
    let zwischen = ordner.join(".ki-zugang.tmp");
    {
        let mut o = fs::OpenOptions::new();
        o.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            o.mode(0o600);
        }
        let mut f = o.open(&zwischen).map_err(|e| e.to_string())?;
        f.write_all(&serde_json::to_vec(wert).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
    }
    fs::rename(&zwischen, datei).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn speichert_liest_und_loescht() {
        let d = tempfile::tempdir().unwrap();
        let datei = d.path().join("konfig").join("ki-zugang.json");
        assert!(lesen(&datei).is_none());
        let w = json!({"anbieter": "anthropic", "zugaenge": {"anthropic": {"schluessel": "sk-ant-test", "modell": "claude-opus-5-5"}}});
        setzen(&datei, Some(&w)).unwrap();
        assert_eq!(lesen(&datei).unwrap(), w);
        // keine Zwischendatei bleibt liegen
        assert!(!d.path().join("konfig").join(".ki-zugang.tmp").exists());
        let w2 = json!({"anbieter": "ollama"});
        setzen(&datei, Some(&w2)).unwrap();
        assert_eq!(lesen(&datei).unwrap(), w2);
        setzen(&datei, None).unwrap();
        assert!(lesen(&datei).is_none());
        // Löschen ohne Datei ist kein Fehler
        setzen(&datei, None).unwrap();
    }

    #[test]
    fn nimmt_nur_objekte_und_uebergeht_kaputte_dateien() {
        let d = tempfile::tempdir().unwrap();
        let datei = d.path().join("ki-zugang.json");
        assert!(setzen(&datei, Some(&json!("sk-ant-x"))).is_err());
        fs::write(&datei, b"{kaputt").unwrap();
        assert!(lesen(&datei).is_none());
        fs::write(&datei, b"[1,2]").unwrap();
        assert!(lesen(&datei).is_none());
    }

    #[cfg(unix)]
    #[test]
    fn nur_der_nutzer_darf_lesen() {
        use std::os::unix::fs::PermissionsExt;
        let d = tempfile::tempdir().unwrap();
        let datei = d.path().join("ki-zugang.json");
        setzen(&datei, Some(&json!({"a": 1}))).unwrap();
        assert_eq!(fs::metadata(&datei).unwrap().permissions().mode() & 0o777, 0o600);
    }
}
