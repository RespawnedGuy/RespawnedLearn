#![cfg_attr(desktop, allow(dead_code))]
//! Welcher Datenordner erlaubt ist. Die Oberfläche darf keinen beliebigen Pfad setzen: Mit „Zugriff auf alle Dateien“
//! (Android) bzw. den Rechten des Benutzers (PC) läse die App danach jede Datei dort. Am PC wählt deshalb nur der
//! Ordnerdialog, den Rust selbst öffnet (`ordner_waehlen` in lib.rs). Unter Android gibt es keinen Dialog für echte
//! Pfade; dort muss der getippte Pfad ein Unterordner des gemeinsamen Speichers sein, außerhalb der App-Daten anderer
//! Apps (`Android/`).

use std::path::{Component, Path, PathBuf};

pub const ANDROID_SPEICHER: &str = "/storage/emulated/0";

/// Name des vorgeschlagenen Datenordners: am PC in „Dokumente“, unter Android im gemeinsamen Speicher
pub const STANDARD_NAME: &str = "RespawnedLearn";

/// Wo ein Datenordner nie liegen darf, mit Begründung für die Meldung
pub struct Sperre {
    pub pfad: PathBuf,
    pub grund: &'static str,
}

pub const GRUND_PROGRAMM: &str = "Das ist der Programmordner der App. Dort gehören keine Lerndaten hin: Er ist nicht für eigene Dateien gedacht, und eine Neuinstallation an anderer Stelle ließe sie zurück.";
pub const GRUND_APPDATEN: &str = "Das ist ein interner Ordner der App. Beim Deinstallieren mit „App-Daten löschen“ entfernt Windows ihn samt Inhalt.";
pub const GRUND_UMFASST: &str = "Dieser Ordner enthält den Programmordner oder die internen Daten der App. Bitte einen eigenen Unterordner wählen, zum Beispiel „RespawnedLearn“ in „Dokumente“.";

/// Vergleichbare Form eines Pfads: Bestandteile, unter Windows ohne Groß-/Kleinschreibung. Kanonisieren (Links,
/// `\\?\`-Vorsatz) übernimmt der Aufrufer für beide Seiten gleich (`kanonisch`).
fn teile(p: &Path, gross_klein_egal: bool) -> Vec<String> {
    p.components()
        .filter_map(|c| match c {
            Component::CurDir => None,
            Component::RootDir => Some("/".to_string()),
            c => Some(c.as_os_str().to_string_lossy().into_owned()),
        })
        .map(|t| if gross_klein_egal { t.to_lowercase() } else { t })
        .collect()
}

/// Liegt `innen` in `aussen` oder ist es derselbe Ordner? Verglichen wird je Bestandteil, damit „RespawnedLearn2“
/// nicht als Unterordner von „RespawnedLearn“ gilt.
pub fn liegt_in(innen: &Path, aussen: &Path, gross_klein_egal: bool) -> bool {
    let (i, a) = (teile(innen, gross_klein_egal), teile(aussen, gross_klein_egal));
    !a.is_empty() && i.len() >= a.len() && i[..a.len()] == a[..]
}

/// Grund, warum `pfad` als Datenordner nicht taugt, oder `None`. Gesperrt ist jede Sperre selbst, alles darin und
/// jeder Ordner, der eine Sperre enthält (sonst läse die App z. B. den ganzen Benutzerordner samt AppData).
pub fn gesperrt(pfad: &Path, sperren: &[Sperre], gross_klein_egal: bool) -> Option<&'static str> {
    for s in sperren {
        if liegt_in(pfad, &s.pfad, gross_klein_egal) {
            return Some(s.grund);
        }
    }
    sperren.iter().any(|s| liegt_in(&s.pfad, pfad, gross_klein_egal)).then_some(GRUND_UMFASST)
}

/// Kanonische Form, soweit der Pfad existiert; sonst der kanonische nächste vorhandene Vorfahr plus Rest
pub fn kanonisch(p: &Path) -> PathBuf {
    if let Ok(k) = std::fs::canonicalize(p) {
        return k;
    }
    match (p.parent(), p.file_name()) {
        (Some(v), Some(n)) if v != p => kanonisch(v).join(n),
        _ => p.to_path_buf(),
    }
}

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

    fn sperren() -> Vec<Sperre> {
        vec![
            Sperre { pfad: PathBuf::from("/home/u/.local/share/RespawnedLearn"), grund: GRUND_PROGRAMM },
            Sperre { pfad: PathBuf::from("/home/u/.config/io.github.respawnedguy.respawnedlearn"), grund: GRUND_APPDATEN },
        ]
    }

    #[test]
    fn programmordner_und_appdaten_gesperrt() {
        let s = sperren();
        assert_eq!(gesperrt(Path::new("/home/u/.local/share/RespawnedLearn"), &s, false), Some(GRUND_PROGRAMM));
        assert_eq!(gesperrt(Path::new("/home/u/.local/share/RespawnedLearn/"), &s, false), Some(GRUND_PROGRAMM));
        assert_eq!(gesperrt(Path::new("/home/u/.local/share/RespawnedLearn/daten"), &s, false), Some(GRUND_PROGRAMM));
        assert_eq!(gesperrt(Path::new("/home/u/.config/io.github.respawnedguy.respawnedlearn/x"), &s, false), Some(GRUND_APPDATEN));
        // Ordner, die eine Sperre enthalten: Benutzerordner, Laufwerk
        assert_eq!(gesperrt(Path::new("/home/u"), &s, false), Some(GRUND_UMFASST));
        assert_eq!(gesperrt(Path::new("/"), &s, false), Some(GRUND_UMFASST));
        // gleicher Anfang, anderer Ordner
        assert_eq!(gesperrt(Path::new("/home/u/.local/share/RespawnedLearn2"), &s, false), None);
        assert_eq!(gesperrt(Path::new("/home/u/Dokumente/RespawnedLearn"), &s, false), None);
    }

    #[test]
    fn windows_ohne_gross_klein() {
        let s = vec![Sperre { pfad: PathBuf::from("C:/Users/u/AppData/Local/RespawnedLearn"), grund: GRUND_PROGRAMM }];
        assert_eq!(gesperrt(Path::new("c:/users/U/appdata/local/respawnedlearn/Daten"), &s, true), Some(GRUND_PROGRAMM));
        assert_eq!(gesperrt(Path::new("c:/users/U/appdata/local/respawnedlearn/Daten"), &s, false), None);
        assert_eq!(gesperrt(Path::new("C:/Users/u/Documents/RespawnedLearn"), &s, true), None);
    }

    #[test]
    fn kanonisch_auch_fuer_neue_ordner() {
        let d = tempfile::tempdir().unwrap();
        let basis = std::fs::canonicalize(d.path()).unwrap();
        assert_eq!(kanonisch(&d.path().join("neu").join("tiefer")), basis.join("neu").join("tiefer"));
        assert_eq!(kanonisch(d.path()), basis);
    }

    /// Links führen nicht an der Sperre vorbei: Wer über einen Link in den Programmordner zeigt, landet dort
    #[cfg(unix)]
    #[test]
    fn link_auf_gesperrten_ordner() {
        let d = tempfile::tempdir().unwrap();
        let prog = d.path().join("programm");
        std::fs::create_dir(&prog).unwrap();
        std::os::unix::fs::symlink(&prog, d.path().join("link")).unwrap();
        let s = vec![Sperre { pfad: kanonisch(&prog), grund: GRUND_PROGRAMM }];
        assert_eq!(gesperrt(&kanonisch(&d.path().join("link").join("daten")), &s, false), Some(GRUND_PROGRAMM));
    }

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
