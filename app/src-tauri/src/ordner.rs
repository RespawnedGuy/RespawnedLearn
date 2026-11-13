//! Der Datenordner auf der Platte ist die einzige Wahrheit (Vertrag Lernen, Grundsätze). Syncthing gleicht ihn
//! zwischen den Geräten ab; die App liest und schreibt hier nur Dateien, ohne Server.
//!
//! Alles in diesem Modul ist frei von Tauri, damit es sich mit `cargo test` gegen ein temporäres Verzeichnis prüfen lässt.

use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

/// Ordner, die nie zu den Daten gehören: eigener Index, Syncthing-Verwaltung, Git
const AUSGENOMMEN: &[&str] = &[".index", ".stfolder", ".stversions", ".git", ".geheim"];

/// Ein Eintrag der Dateiliste, Pfad relativ zum Datenordner mit `/`
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Eintrag {
    pub pfad: String,
    pub groesse: u64,
    /// Änderungszeit in Millisekunden seit 1970
    pub geaendert: u64,
}

/// Macht aus einem relativen Pfad der App einen Pfad im Datenordner. Absolute Pfade, `..` und leere Pfade werden
/// abgelehnt, damit die App nie außerhalb des gewählten Ordners liest oder schreibt.
pub fn sicherer_pfad(wurzel: &Path, rel: &str) -> Result<PathBuf, String> {
    if rel.is_empty() || rel.contains('\\') || rel.contains('\0') {
        return Err(format!("ungültiger Pfad: {rel:?}"));
    }
    let p = Path::new(rel);
    let mut ziel = wurzel.to_path_buf();
    for teil in p.components() {
        match teil {
            Component::Normal(t) => ziel.push(t),
            _ => return Err(format!("Pfad außerhalb des Datenordners: {rel:?}")),
        }
    }
    Ok(ziel)
}

/// Liest eine Datei als Bytes
pub fn lesen(wurzel: &Path, rel: &str) -> Result<Vec<u8>, String> {
    let p = sicherer_pfad(wurzel, rel)?;
    fs::read(&p).map_err(|e| format!("{rel}: {e}"))
}

/// Schreibt eine Datei vollständig oder gar nicht: erst in eine Nachbardatei, dann umbenennen. So sieht Syncthing nie
/// eine halb geschriebene Datei. Die Nachbardatei heißt wie Syncthings eigene Zwischendateien (`.syncthing.<name>.tmp`),
/// die Syncthing von sich aus nicht abgleicht.
pub fn schreiben(wurzel: &Path, rel: &str, inhalt: &[u8]) -> Result<(), String> {
    let ziel = sicherer_pfad(wurzel, rel)?;
    let ordner = ziel.parent().ok_or_else(|| format!("{rel}: kein Ordner"))?;
    fs::create_dir_all(ordner).map_err(|e| format!("{rel}: {e}"))?;
    let name = ziel.file_name().and_then(|n| n.to_str()).ok_or_else(|| format!("{rel}: kein Dateiname"))?;
    let zwischen = ordner.join(format!(".syncthing.{name}.tmp"));
    let ergebnis = (|| {
        let mut f = fs::File::create(&zwischen)?;
        f.write_all(inhalt)?;
        f.sync_all()?;
        fs::rename(&zwischen, &ziel)
    })();
    if let Err(e) = ergebnis {
        let _ = fs::remove_file(&zwischen);
        return Err(format!("{rel}: {e}"));
    }
    Ok(())
}

/// Alle Dateien im Datenordner, sortiert nach Pfad. Zwischendateien und Verwaltungsordner fehlen, Konfliktkopien von
/// Syncthing (`*.sync-conflict-*`) stehen bewusst drin: Die App zeigt sie an, damit ein Mensch entscheidet.
pub fn liste(wurzel: &Path) -> Result<Vec<Eintrag>, String> {
    let mut out = Vec::new();
    sammle(wurzel, wurzel, &mut out).map_err(|e| e.to_string())?;
    out.sort_by(|a, b| a.pfad.cmp(&b.pfad));
    Ok(out)
}

fn sammle(wurzel: &Path, ordner: &Path, out: &mut Vec<Eintrag>) -> std::io::Result<()> {
    for e in fs::read_dir(ordner)? {
        let e = e?;
        let name = e.file_name();
        let name = name.to_string_lossy();
        if ist_zwischendatei(&name) {
            continue;
        }
        let typ = e.file_type()?;
        if typ.is_dir() {
            if ordner == wurzel && AUSGENOMMEN.contains(&name.as_ref()) {
                continue;
            }
            sammle(wurzel, &e.path(), out)?;
        } else if typ.is_file() {
            let m = e.metadata()?;
            let geaendert = m.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis() as u64).unwrap_or(0);
            out.push(Eintrag { pfad: relativ(wurzel, &e.path()), groesse: m.len(), geaendert });
        }
    }
    Ok(())
}

/// Zwischendateien von Syncthing und dieser App
pub fn ist_zwischendatei(name: &str) -> bool {
    (name.starts_with(".syncthing.") && name.ends_with(".tmp")) || name.starts_with("~syncthing~")
}

/// Pfad relativ zum Datenordner, immer mit `/` (auch unter Windows)
pub fn relativ(wurzel: &Path, p: &Path) -> String {
    let r = p.strip_prefix(wurzel).unwrap_or(p);
    r.components().map(|c| c.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/")
}

/// Prüft, ob die App im Ordner schreiben darf (unter Android erst nach „Zugriff auf alle Dateien“)
pub fn pruefe_schreibbar(wurzel: &Path) -> Result<(), String> {
    if !wurzel.is_dir() {
        return Err(format!("{} ist kein Ordner", wurzel.display()));
    }
    let probe = ".respawnedlearn-probe";
    schreiben(wurzel, probe, b"ok").map_err(|e| format!("Kein Schreibzugriff: {e}"))?;
    fs::remove_file(wurzel.join(probe)).map_err(|e| format!("Kein Schreibzugriff: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ordner() -> tempfile::TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn lehnt_pfade_ausserhalb_ab() {
        let d = ordner();
        for rel in ["", "../x.md", "lernen/../../x.md", "/etc/passwd", "lernen\\x.md", "./x.md"] {
            assert!(sicherer_pfad(d.path(), rel).is_err(), "{rel} müsste abgelehnt werden");
        }
        assert_eq!(sicherer_pfad(d.path(), "lernen/karten/a.md").unwrap(), d.path().join("lernen").join("karten").join("a.md"));
    }

    #[test]
    fn schreibt_und_liest_mit_unterordnern() {
        let d = ordner();
        schreiben(d.path(), "lernen/karten/01J.md", "---\ntitel: Ohm\n---\nU = R · I".as_bytes()).unwrap();
        assert_eq!(lesen(d.path(), "lernen/karten/01J.md").unwrap(), "---\ntitel: Ohm\n---\nU = R · I".as_bytes());
        // Überschreiben ersetzt vollständig, es bleibt keine Zwischendatei liegen
        schreiben(d.path(), "lernen/karten/01J.md", b"neu").unwrap();
        assert_eq!(lesen(d.path(), "lernen/karten/01J.md").unwrap(), b"neu");
        let namen: Vec<_> = fs::read_dir(d.path().join("lernen/karten")).unwrap().map(|e| e.unwrap().file_name()).collect();
        assert_eq!(namen.len(), 1);
    }

    #[test]
    fn liste_zeigt_daten_und_konflikte_aber_keine_verwaltung() {
        let d = ordner();
        schreiben(d.path(), "lernen/module/m.md", b"m").unwrap();
        schreiben(d.path(), "lernen/module/m.sync-conflict-20261113-101010-ABCDEFG.md", b"k").unwrap();
        schreiben(d.path(), "anhaenge/2026/11/s.pdf", b"%PDF").unwrap();
        for verwaltung in [".stfolder/x", ".stversions/lernen/m~1.md", ".index/lernen/a.json", ".git/HEAD"] {
            schreiben(d.path(), verwaltung, b"v").unwrap();
        }
        fs::write(d.path().join("lernen/module/.syncthing.m.md.tmp"), b"halb").unwrap();
        fs::write(d.path().join("lernen/~syncthing~m.md.tmp"), b"halb").unwrap();
        let pfade: Vec<_> = liste(d.path()).unwrap().into_iter().map(|e| e.pfad).collect();
        assert_eq!(pfade, ["anhaenge/2026/11/s.pdf", "lernen/module/m.md", "lernen/module/m.sync-conflict-20261113-101010-ABCDEFG.md"]);
    }

    #[test]
    fn liste_nennt_groesse_und_zeit() {
        let d = ordner();
        schreiben(d.path(), "a.md", b"12345").unwrap();
        let e = &liste(d.path()).unwrap()[0];
        assert_eq!(e.groesse, 5);
        assert!(e.geaendert > 1_700_000_000_000);
    }

    #[test]
    fn prueft_schreibzugriff_ohne_spuren() {
        let d = ordner();
        pruefe_schreibbar(d.path()).unwrap();
        assert!(liste(d.path()).unwrap().is_empty());
        assert!(pruefe_schreibbar(&d.path().join("fehlt")).is_err());
    }
}
