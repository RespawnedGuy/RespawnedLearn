#![cfg_attr(desktop, allow(dead_code))]
//! Welcher Datenordner erlaubt ist. Die Oberfläche darf keinen beliebigen Pfad setzen: Mit „Zugriff auf alle Dateien“
//! (Android) bzw. den Rechten des Benutzers (PC) läse die App danach jede Datei dort. Am PC wählt deshalb nur der
//! Ordnerdialog, den Rust selbst öffnet (`ordner_waehlen` in lib.rs). Unter Android gibt es keinen Dialog für echte
//! Pfade; dort muss der getippte Pfad ein Unterordner des gemeinsamen Speichers sein, außerhalb der App-Daten anderer
//! Apps (`Android/`).

use std::path::{Component, Path, PathBuf};

pub const ANDROID_SPEICHER: &str = "/storage/emulated/0";

/// Prüft einen unter Android getippten Pfad und liefert ihn bereinigt (ohne Schrägstrich am Ende)
pub fn android_ordner(pfad: &str) -> Result<PathBuf, String> {
    let falsch = || format!("Der Ordner muss im Gerätespeicher liegen, zum Beispiel {ANDROID_SPEICHER}/RespawnedLearn.");
    let rest = pfad.trim().strip_prefix(ANDROID_SPEICHER).and_then(|r| r.strip_prefix('/')).ok_or_else(falsch)?;
    let rest = rest.trim_end_matches('/');
    if rest.is_empty() || rest.contains('\\') || rest.contains('\0') {
        return Err(falsch());
    }
    let mut teile = Vec::new();
    for t in Path::new(rest).components() {
        match t {
            Component::Normal(n) => teile.push(n.to_string_lossy().into_owned()),
            _ => return Err(falsch()),
        }
    }
    if teile.first().is_some_and(|t| t.eq_ignore_ascii_case("android")) {
        return Err("Im Ordner „Android“ liegen die Daten anderer Apps; bitte einen eigenen Ordner wählen.".into());
    }
    Ok(Path::new(ANDROID_SPEICHER).join(rest))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn android_nur_eigene_ordner_im_geraetespeicher() {
        assert_eq!(android_ordner("/storage/emulated/0/RespawnedLearn").unwrap(), PathBuf::from("/storage/emulated/0/RespawnedLearn"));
        assert_eq!(android_ordner(" /storage/emulated/0/Sync/Lernen/ ").unwrap(), PathBuf::from("/storage/emulated/0/Sync/Lernen"));
        for f in [
            "/storage/emulated/0",
            "/storage/emulated/0/",
            "/storage/emulated/0/../../data/data",
            "/storage/emulated/0/a/../../x",
            "/storage/emulated/0/Android/data/fremde.app",
            "/storage/emulated/0/android",
            "/storage/emulated/01/x",
            "/data/data/io.github.respawnedguy.respawnedlearn",
            "/sdcard/RespawnedLearn",
            "RespawnedLearn",
            "",
        ] {
            assert!(android_ordner(f).is_err(), "{f} muss abgelehnt werden");
        }
    }
}
