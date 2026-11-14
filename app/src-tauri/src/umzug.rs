//! Umzug des Datenordners an einen anderen Ort. Die Quelle bleibt unberührt: Die App kopiert, prüft jede Kopie Byte für
//! Byte gegen das Original und wechselt erst danach (lib.rs). Scheitert etwas, entfernt sie nur die eigenen Kopien.
//! Ohne Tauri, damit `cargo test` es gegen temporäre Ordner prüft.

use crate::ordner;
use crate::ordnerwahl::{kanonisch, liegt_in};
use serde::Serialize;
use std::fs;
use std::path::Path;

/// Was in einem Ordner liegt, bevor er Datenordner wird
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Inhalt {
    /// nichts außer Verwaltung anderer Programme (z. B. `.stfolder` von Syncthing)
    Leer,
    /// Daten von RespawnedLearn, etwa von einem anderen Gerät abgeglichen
    Lerndaten,
    /// andere Dateien
    Fremd,
}

/// Prüft, was im Ordner liegt; ein fehlender Ordner gilt als leer
pub fn inhalt(ordner_pfad: &Path) -> Result<Inhalt, String> {
    if !ordner_pfad.exists() {
        return Ok(Inhalt::Leer);
    }
    let liste = ordner::liste(ordner_pfad)?;
    Ok(if liste.is_empty() {
        Inhalt::Leer
    } else if liste.iter().any(|e| e.pfad.starts_with("lernen/") || e.pfad.starts_with("reviews/")) {
        Inhalt::Lerndaten
    } else {
        Inhalt::Fremd
    })
}

/// Alle Dateien, die umziehen: dieselben, die die App als Daten liest (`ordner::liste`). Ein symbolischer Link bricht
/// ab, statt still zu fehlen: Der Nutzer soll wissen, dass etwas nicht mitkäme.
fn sammle(wurzel: &Path, ordner_pfad: &Path, out: &mut Vec<String>) -> Result<(), String> {
    let fehler = |e: std::io::Error| format!("{}: {e}", ordner_pfad.display());
    for e in fs::read_dir(ordner_pfad).map_err(fehler)? {
        let e = e.map_err(fehler)?;
        let name = e.file_name().to_string_lossy().into_owned();
        if ordner::ist_zwischendatei(&name) || ordner::ist_fremde_verwaltung(&name) {
            continue;
        }
        let typ = e.file_type().map_err(fehler)?;
        let rel = ordner::relativ(wurzel, &e.path());
        if typ.is_symlink() {
            return Err(format!("{rel} ist ein symbolischer Link. Die App kopiert keine Links; bitte die Datei selbst dorthin legen und neu versuchen."));
        } else if typ.is_dir() {
            if ordner_pfad == wurzel && ordner::AUSGENOMMEN.contains(&name.as_str()) {
                continue;
            }
            sammle(wurzel, &e.path(), out)?;
        } else if typ.is_file() {
            out.push(rel);
        }
    }
    Ok(())
}

/// Kopiert alle Daten von `von` nach `nach` (muss leer sein) und prüft jede Kopie. `fortschritt(fertig, gesamt)`.
/// Liefert die Zahl der Dateien. Bei einem Fehler sind die eigenen Kopien wieder entfernt und `von` ist unverändert.
pub fn umziehen(von: &Path, nach: &Path, gross_klein_egal: bool, mut fortschritt: impl FnMut(usize, usize)) -> Result<usize, String> {
    let (von_k, nach_k) = (kanonisch(von), kanonisch(nach));
    if liegt_in(&nach_k, &von_k, gross_klein_egal) || liegt_in(&von_k, &nach_k, gross_klein_egal) {
        return Err("Der neue Ordner darf nicht im bisherigen liegen und der bisherige nicht im neuen.".into());
    }
    if inhalt(nach)? != Inhalt::Leer {
        return Err("Der neue Ordner ist nicht leer. Daten mitnehmen geht nur in einen leeren Ordner.".into());
    }
    let mut liste = Vec::new();
    sammle(von, von, &mut liste)?;
    liste.sort();
    fs::create_dir_all(nach).map_err(|e| format!("Ordner lässt sich nicht anlegen: {e}"))?;
    let gesamt = liste.len();
    let mut geschrieben: Vec<&str> = Vec::new();
    for (i, rel) in liste.iter().enumerate() {
        if let Err(e) = kopiere(von, nach, rel, &mut geschrieben) {
            aufraeumen(nach, &geschrieben);
            return Err(format!("Umzug abgebrochen, der bisherige Ordner bleibt aktiv. {e}"));
        }
        fortschritt(i + 1, gesamt);
    }
    Ok(gesamt)
}

fn kopiere<'a>(von: &Path, nach: &Path, rel: &'a str, geschrieben: &mut Vec<&'a str>) -> Result<(), String> {
    let inhalt = ordner::lesen(von, rel)?;
    if ordner::sicherer_pfad(nach, rel)?.exists() {
        return Err(format!("{rel}: liegt im neuen Ordner schon im Weg"));
    }
    ordner::schreiben(nach, rel, &inhalt)?;
    geschrieben.push(rel);
    if ordner::lesen(nach, rel)? != inhalt {
        return Err(format!("{rel}: Kopie weicht vom Original ab"));
    }
    Ok(())
}

/// Entfernt nur, was der Umzug selbst angelegt hat: die kopierten Dateien und danach leer gewordene Unterordner
fn aufraeumen(nach: &Path, geschrieben: &[&str]) {
    let mut ordner_liste = Vec::new();
    for rel in geschrieben {
        if let Ok(p) = ordner::sicherer_pfad(nach, rel) {
            let _ = fs::remove_file(&p);
            let mut v = p.parent();
            while let Some(o) = v.filter(|o| *o != nach) {
                ordner_liste.push(o.to_path_buf());
                v = o.parent();
            }
        }
    }
    // tiefste zuerst; remove_dir entfernt nur leere Ordner
    ordner_liste.sort_by_key(|o| std::cmp::Reverse(o.components().count()));
    ordner_liste.dedup();
    for o in ordner_liste {
        let _ = fs::remove_dir(o);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    /// Alle Dateien unter `p` mit Inhalt, auch Verwaltung und Zwischendateien: zeigt, dass die Quelle unberührt bleibt
    fn abbild(p: &Path) -> BTreeMap<String, Vec<u8>> {
        let mut m = BTreeMap::new();
        fn lauf(w: &Path, o: &Path, m: &mut BTreeMap<String, Vec<u8>>) {
            for e in fs::read_dir(o).unwrap() {
                let e = e.unwrap();
                if e.file_type().unwrap().is_dir() {
                    lauf(w, &e.path(), m)
                } else {
                    m.insert(ordner::relativ(w, &e.path()), fs::read(e.path()).unwrap());
                }
            }
        }
        if p.exists() {
            lauf(p, p, &mut m);
        }
        m
    }

    fn lege(w: &Path, rel: &str, inhalt: &[u8]) {
        let p = w.join(rel);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, inhalt).unwrap();
    }

    fn quelle() -> tempfile::TempDir {
        let d = tempfile::tempdir().unwrap();
        lege(d.path(), "lernen/karten/Übung eins.md", "# Frage\nÄußerst".as_bytes());
        lege(d.path(), "lernen/karten/Übung eins.sync-conflict-20261114-070000-ABCDEFG.md", b"andere Fassung");
        lege(d.path(), "reviews/2026-11.pc.jsonl", b"{}\n");
        lege(d.path(), "skripte/Mathe.pdf", &[0u8, 255, 1, 2, 3]);
        lege(d.path(), "lernen/einstellungen/ki-zugang.verschluesselt.json", b"{\"format\":\"x\"}");
        lege(d.path(), ".stfolder/.stkeep", b"");
        lege(d.path(), ".index/cache.json", b"[]");
        lege(d.path(), "lernen/.syncthing.a.md.tmp", b"halb");
        lege(d.path(), "Thumbs.db", b"x");
        d
    }

    #[test]
    fn kopiert_alle_daten_und_quelle_bleibt() {
        let von = quelle();
        let ziel = tempfile::tempdir().unwrap();
        let nach = ziel.path().join("Neu");
        let vorher = abbild(von.path());
        let mut schritte = Vec::new();
        let n = umziehen(von.path(), &nach, false, |a, b| schritte.push((a, b))).unwrap();
        assert_eq!(n, 5);
        assert_eq!(schritte.last(), Some(&(5, 5)));
        assert_eq!(abbild(von.path()), vorher, "Quelle muss unverändert sein");
        // Ziel: genau die Daten, Byte für Byte; Verwaltung, Index und Zwischendateien nicht
        let kopiert = abbild(&nach);
        let erwartet: BTreeMap<_, _> = vorher
            .into_iter()
            .filter(|(k, _)| !k.starts_with(".stfolder") && !k.starts_with(".index") && !k.contains(".syncthing.") && k != "Thumbs.db")
            .collect();
        assert_eq!(kopiert, erwartet);
        assert_eq!(inhalt(&nach).unwrap(), Inhalt::Lerndaten);
    }

    #[test]
    fn erkennt_inhalt() {
        let d = tempfile::tempdir().unwrap();
        assert_eq!(inhalt(&d.path().join("gibt-es-nicht")).unwrap(), Inhalt::Leer);
        assert_eq!(inhalt(d.path()).unwrap(), Inhalt::Leer);
        lege(d.path(), ".stfolder/.stkeep", b"");
        lege(d.path(), "desktop.ini", b"");
        assert_eq!(inhalt(d.path()).unwrap(), Inhalt::Leer, "nur Verwaltung zählt als leer");
        lege(d.path(), "Urlaub.jpg", b"x");
        assert_eq!(inhalt(d.path()).unwrap(), Inhalt::Fremd);
        lege(d.path(), "reviews/2026-11.handy.jsonl", b"");
        assert_eq!(inhalt(d.path()).unwrap(), Inhalt::Lerndaten);
    }

    #[test]
    fn nur_in_leeren_ordner() {
        let von = quelle();
        let nach = tempfile::tempdir().unwrap();
        lege(nach.path(), "Brief.txt", b"meins");
        let vorher = abbild(nach.path());
        assert!(umziehen(von.path(), nach.path(), false, |_, _| {}).is_err());
        assert_eq!(abbild(nach.path()), vorher);
    }

    #[test]
    fn nicht_ineinander() {
        let von = quelle();
        let vorher = abbild(von.path());
        assert!(umziehen(von.path(), &von.path().join("lernen").join("neu"), false, |_, _| {}).is_err());
        assert!(umziehen(von.path(), von.path(), false, |_, _| {}).is_err());
        let aussen = von.path().parent().unwrap().to_path_buf();
        let innen = tempfile::tempdir_in(von.path()).unwrap();
        assert!(umziehen(innen.path(), &aussen, false, |_, _| {}).is_err());
        drop(innen);
        assert_eq!(abbild(von.path()), vorher);
    }

    /// Scheitert eine Datei mitten im Umzug, sind die Kopien davor wieder weg und die Quelle ist unverändert
    #[test]
    fn fehler_mittendrin_raeumt_eigene_kopien_auf() {
        let von = quelle();
        lege(von.path(), "zuletzt.md", b"z");
        let nach = tempfile::tempdir().unwrap();
        // leerer Ordner mit dem Namen der letzten Datei: der Ordner gilt als leer, das Kopieren dieser Datei scheitert
        fs::create_dir(nach.path().join("zuletzt.md")).unwrap();
        let vorher = abbild(von.path());
        let e = umziehen(von.path(), nach.path(), false, |_, _| {}).unwrap_err();
        assert!(e.contains("zuletzt.md"), "{e}");
        assert!(ordner::liste(nach.path()).unwrap().is_empty(), "keine halben Kopien");
        assert!(!nach.path().join("lernen").exists(), "leere Unterordner entfernt");
        assert!(nach.path().join("zuletzt.md").is_dir(), "Fremdes bleibt");
        assert_eq!(abbild(von.path()), vorher);
    }

    #[cfg(unix)]
    #[test]
    fn link_bricht_ab_bevor_etwas_kopiert_ist() {
        let von = quelle();
        let anderswo = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(anderswo.path(), von.path().join("lernen").join("link")).unwrap();
        let nach = tempfile::tempdir().unwrap();
        let e = umziehen(von.path(), &nach.path().join("neu"), false, |_, _| {}).unwrap_err();
        assert!(e.contains("symbolischer Link"), "{e}");
        assert!(!nach.path().join("neu").exists());
    }
}
