//! Der Datenordner auf der Platte ist die einzige Wahrheit (Vertrag Lernen, Grundsätze). Syncthing gleicht ihn
//! zwischen den Geräten ab; die App liest und schreibt hier nur Dateien, ohne Server.
//!
//! Alles in diesem Modul ist frei von Tauri, damit es sich mit `cargo test` gegen ein temporäres Verzeichnis prüfen lässt.

use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::Hasher;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

/// Ordner, die nie zu den Daten gehören: eigener Index, Syncthing-Verwaltung, Git, Zwischenspeicher von Dropbox
/// (help.dropbox.com/delete-restore/cache-folder: „.dropbox.cache“ im Wurzelordner)
pub const AUSGENOMMEN: &[&str] = &[".index", ".stfolder", ".stversions", ".git", ".geheim", ".dropbox.cache"];

/// Ein Eintrag der Dateiliste, Pfad relativ zum Datenordner mit `/`
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Eintrag {
    pub pfad: String,
    pub groesse: u64,
    /// Änderungszeit in Millisekunden seit 1970
    pub geaendert: u64,
}

/// Macht aus einem relativen Pfad der App einen Pfad im Datenordner. Absolute Pfade, `..` und leere Pfade werden
/// abgelehnt, damit die App nie außerhalb des gewählten Ordners liest oder schreibt. Ebenso symbolische Links
/// unterhalb des Ordners: Syncthing überträgt sie unter Linux und Android, ein Link könnte
/// Lesen und Schreiben sonst aus dem Datenordner hinausführen. Der gewählte Ordner selbst darf ein Link sein.
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
        if fs::symlink_metadata(&ziel).map(|m| m.file_type().is_symlink()).unwrap_or(false) {
            return Err(format!("{rel}: symbolischer Link im Datenordner, die App folgt ihm nicht"));
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
/// eine halb geschriebene Datei. Die Nachbardatei hat die Form von Syncthings Zwischendateien, die Syncthing von sich aus
/// nicht abgleicht, aber einen eigenen Zusatz (`zwischenname`), und wird neu angelegt, nie eine vorhandene geöffnet.
pub fn schreiben(wurzel: &Path, rel: &str, inhalt: &[u8]) -> Result<(), String> {
    let ziel = sicherer_pfad(wurzel, rel)?;
    let ordner = ziel.parent().ok_or_else(|| format!("{rel}: kein Ordner"))?;
    fs::create_dir_all(ordner).map_err(|e| format!("{rel}: {e}"))?;
    let name = ziel.file_name().and_then(|n| n.to_str()).ok_or_else(|| format!("{rel}: kein Dateiname"))?;
    let zwischen = ordner.join(zwischenname(name));
    let ergebnis = (|| {
        let mut f = fs::OpenOptions::new().write(true).create_new(true).open(&zwischen)?;
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

/// Name der eigenen Zwischendatei: `.syncthing.<name>.<zufall>.tmp`. Syncthing gleicht alles mit diesem Anfang und
/// Ende nicht ab (geprüft gegen 1.30.0), nutzt selbst aber genau `.syncthing.<name>.tmp`, während es eine Datei
/// zieht. Der Zusatz verhindert, dass die App in eine solche halbe Datei schreibt oder sie wegbenennt.
fn zwischenname(name: &str) -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static ZAEHLER: AtomicU64 = AtomicU64::new(0);
    let zeit = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(0);
    let z = zeit ^ ((std::process::id() as u64) << 32) ^ ZAEHLER.fetch_add(1, Ordering::Relaxed).wrapping_mul(0x9E37_79B9_7F4A_7C15);
    format!(".syncthing.{name}.{:x}.tmp", z)
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
        if ist_zwischendatei(&name) || ist_fremde_verwaltung(&name) {
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
            out.push(Eintrag { pfad: relativ(wurzel, &e.path()), groesse: m.len(), geaendert: ms(&m) });
        }
    }
    Ok(())
}

/// Zwischendateien von Syncthing und dieser App
pub fn ist_zwischendatei(name: &str) -> bool {
    (name.starts_with(".syncthing.") && name.ends_with(".tmp")) || name.starts_with("~syncthing~")
}

/// Sperr-, Zwischen- und Verwaltungsdateien anderer Programme, die nie zu den Daten gehören. Quelle: Nextcloud-Client,
/// `sync-exclude.lst` und `src/csync/csync_exclude.cpp` (Office-Sperren `~$*`, LibreOffice `.~lock.*`, halbe Downloads
/// `*.part`/`*.filepart`/`*.crdownload`, macOS `._*`/`.DS_Store`, Windows `Thumbs.db`/`desktop.ini`, eigene Journale).
pub fn ist_fremde_verwaltung(name: &str) -> bool {
    let k = name.to_lowercase();
    k.starts_with("~$")
        || k.starts_with(".~lock.")
        || k.ends_with('~')
        || (k.starts_with('~') && k.ends_with(".tmp"))
        || [".part", ".filepart", ".crdownload"].iter().any(|e| k.ends_with(e))
        || k.starts_with("._")
        || ["thumbs.db", ".ds_store", "desktop.ini"].contains(&k.as_str())
        || k.starts_with(".sync_") && k.contains(".db")
        || [".csync_journal.db", ".owncloudsync.log", ".nextcloudsync.log", ".nextcloudpermissions.log"].iter().any(|p| k.starts_with(p))
}

/// Pfad relativ zum Datenordner, immer mit `/` (auch unter Windows)
pub fn relativ(wurzel: &Path, p: &Path) -> String {
    let r = p.strip_prefix(wurzel).unwrap_or(p);
    r.components().map(|c| c.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/")
}

/// Fingerabdruck eines Dateistands: Größe, Änderungszeit (ns) und Prüfsumme des Inhalts. Die Oberfläche gibt ihn beim
/// Schreiben zurück; passt er nicht mehr, hat jemand anderes (meist Syncthing) die Datei inzwischen ersetzt.
/// `DefaultHasher::new()` ist innerhalb eines Programmlaufs fest; der Stempel wird nie gespeichert, nur verglichen.
pub fn stempel_von(inhalt: &[u8], m: &fs::Metadata) -> String {
    let mut h = DefaultHasher::new();
    h.write(inhalt);
    let ns = m.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_nanos()).unwrap_or(0);
    format!("{}:{}:{:016x}", inhalt.len(), ns, h.finish())
}

fn ms(m: &fs::Metadata) -> u64 {
    m.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// Eine gelesene Textdatei mit ihrem Stand
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TextDatei {
    pub pfad: String,
    pub groesse: u64,
    pub geaendert: u64,
    pub stempel: String,
    pub text: String,
}

/// Liest viele Textdateien in einem Aufruf (ein Aufruf über die Brücke zur Oberfläche statt tausend). Fehlende oder
/// unlesbare Dateien fehlen im Ergebnis: Syncthing kann sie zwischen Liste und Lesen entfernt haben.
pub fn texte_lesen(wurzel: &Path, pfade: &[String]) -> Vec<TextDatei> {
    let mut out = Vec::with_capacity(pfade.len());
    for rel in pfade {
        let Ok(p) = sicherer_pfad(wurzel, rel) else { continue };
        let Ok(inhalt) = fs::read(&p) else { continue };
        let Ok(m) = fs::metadata(&p) else { continue };
        let stempel = stempel_von(&inhalt, &m);
        out.push(TextDatei { pfad: rel.clone(), groesse: m.len(), geaendert: ms(&m), stempel, text: String::from_utf8_lossy(&inhalt).into_owned() });
    }
    out
}

/// Stand einer Datei; None, wenn es sie nicht gibt
pub fn stand_von(wurzel: &Path, rel: &str) -> Result<Option<(Eintrag, String)>, String> {
    let p = sicherer_pfad(wurzel, rel)?;
    let Ok(inhalt) = fs::read(&p) else { return Ok(None) };
    let m = fs::metadata(&p).map_err(|e| format!("{rel}: {e}"))?;
    Ok(Some((Eintrag { pfad: rel.to_string(), groesse: m.len(), geaendert: ms(&m) }, stempel_von(&inhalt, &m))))
}

/// Was beim Schreiben herauskam
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "art", rename_all = "lowercase")]
pub enum Geschrieben {
    /// Geschrieben; neuer Stand
    Ok { groesse: u64, geaendert: u64, stempel: String },
    /// Nicht geschrieben, weil die Datei nicht mehr dem erwarteten Stand entspricht
    Geaendert,
}

/// Schreibt nur, wenn die Datei noch so ist, wie die Oberfläche sie kennt: `erwartet` ist der Stempel des bekannten
/// Stands, `None` heißt „darf noch nicht existieren“. So überschreibt die App nie still, was Syncthing gerade
/// gebracht hat; die Oberfläche legt dann eine Konfliktkopie an. Zwischen Prüfen und Umbenennen bleibt ein Fenster
/// von Mikrosekunden, das ohne Sperren im Dateisystem nicht zu schließen ist; Syncthing selbst arbeitet genauso.
pub fn schreiben_wenn(wurzel: &Path, rel: &str, inhalt: &[u8], erwartet: Option<&str>) -> Result<Geschrieben, String> {
    let jetzt = stand_von(wurzel, rel)?.map(|(_, s)| s);
    if jetzt.as_deref() != erwartet {
        return Ok(Geschrieben::Geaendert);
    }
    schreiben(wurzel, rel, inhalt)?;
    let (e, stempel) = stand_von(wurzel, rel)?.ok_or_else(|| format!("{rel}: nach dem Schreiben verschwunden"))?;
    Ok(Geschrieben::Ok { groesse: e.groesse, geaendert: e.geaendert, stempel })
}

/// Löscht eine Konfliktkopie (eines beliebigen Sync-Programms, `kopien::loeschbar`), nachdem ein Mensch entschieden hat
/// oder nichts verloren gehen kann. Andere Dateien löscht die App nie (sie löscht kein Wissen); die Versionierung bzw.
/// der Papierkorb des Sync-Programms behält auch die gelöschte Kopie noch eine Weile.
pub fn konflikt_loeschen(wurzel: &Path, rel: &str, original: Option<&str>) -> Result<(), String> {
    if !crate::kopien::loeschbar(wurzel, rel, original) {
        return Err(format!("{rel} ist keine Konfliktkopie, die App löscht nur Konfliktkopien"));
    }
    let p = sicherer_pfad(wurzel, rel)?;
    match fs::remove_file(&p) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("{rel}: {e}")),
    }
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

    /// Ein Sync-Partner legt Links an, die aus dem Datenordner hinauszeigen: weder lesen noch schreiben darf durchgehen
    #[cfg(unix)]
    #[test]
    fn folgt_keinen_links_aus_dem_ordner_hinaus() {
        let d = ordner();
        let draussen = ordner();
        fs::write(draussen.path().join("geheim.txt"), b"fremd").unwrap();
        fs::create_dir_all(d.path().join("lernen")).unwrap();
        std::os::unix::fs::symlink(draussen.path().join("geheim.txt"), d.path().join("lernen/datei.md")).unwrap();
        std::os::unix::fs::symlink(draussen.path(), d.path().join("anhaenge")).unwrap();
        assert!(lesen(d.path(), "lernen/datei.md").is_err());
        assert!(lesen(d.path(), "anhaenge/geheim.txt").is_err());
        assert!(schreiben(d.path(), "anhaenge/neu.txt", b"x").is_err());
        assert!(schreiben(d.path(), "lernen/datei.md", b"x").is_err());
        assert!(texte_lesen(d.path(), &["anhaenge/geheim.txt".into()]).is_empty());
        assert!(!draussen.path().join("neu.txt").exists());
        assert_eq!(fs::read(draussen.path().join("geheim.txt")).unwrap(), b"fremd");
        // der gewählte Ordner selbst darf ein Link sein
        let link = draussen.path().join("ordner-link");
        std::os::unix::fs::symlink(d.path(), &link).unwrap();
        schreiben(&link, "lernen/ok.md", b"ok").unwrap();
        assert_eq!(lesen(d.path(), "lernen/ok.md").unwrap(), b"ok");
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
    fn laesst_die_zwischendatei_von_syncthing_in_ruhe() {
        // Syncthing zieht gerade dieselbe Datei in `.syncthing.<name>.tmp` (gegen echtes Syncthing 1.30.0 beobachtet,
        // wenn zwei Geräte gleichzeitig anheben). Die App darf dort weder hineinschreiben noch sie wegbenennen.
        let d = ordner();
        fs::create_dir_all(d.path().join("lernen")).unwrap();
        let fremd = d.path().join("lernen/.syncthing.m.md.tmp");
        fs::write(&fremd, b"Block von Syncthing").unwrap();
        schreiben(d.path(), "lernen/m.md", b"neu").unwrap();
        assert_eq!(fs::read(&fremd).unwrap(), b"Block von Syncthing");
        assert_eq!(lesen(d.path(), "lernen/m.md").unwrap(), b"neu");
        // die eigene Zwischendatei zählt wie die von Syncthing als Zwischendatei und bleibt nicht liegen
        let namen: Vec<_> = fs::read_dir(d.path().join("lernen")).unwrap().map(|e| e.unwrap().file_name().into_string().unwrap()).collect();
        assert_eq!(namen.len(), 2, "{namen:?}");
    }

    #[test]
    fn eigene_zwischendatei_gilt_als_zwischendatei() {
        assert!(ist_zwischendatei(&zwischenname("m.md")));
        assert_ne!(zwischenname("m.md"), zwischenname("m.md"));
        assert_ne!(zwischenname("m.md"), ".syncthing.m.md.tmp");
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
    fn liste_uebergeht_verwaltung_anderer_sync_programme() {
        let d = ordner();
        schreiben(d.path(), "lernen/karten/k.md", b"k").unwrap();
        for n in ["~$k.docx", ".~lock.k.md#", "k.md~", "~k.tmp", "s.pdf.part", "s.pdf.crdownload", "._k.md", ".DS_Store", "Thumbs.db", "desktop.ini", ".sync_1a2b.db", ".sync_1a2b.db-wal", ".owncloudsync.log"] {
            fs::write(d.path().join("lernen/karten").join(n), b"x").unwrap();
        }
        fs::create_dir_all(d.path().join(".dropbox.cache/2026")).unwrap();
        fs::write(d.path().join(".dropbox.cache/2026/x.md"), b"x").unwrap();
        let pfade: Vec<_> = liste(d.path()).unwrap().into_iter().map(|e| e.pfad).collect();
        assert_eq!(pfade, ["lernen/karten/k.md"]);
    }

    #[test]
    fn loescht_kopien_anderer_programme_nur_mit_original() {
        let d = ordner();
        schreiben(d.path(), "lernen/tinte/A/S001.svg", b"<svg></svg>").unwrap();
        schreiben(d.path(), "lernen/tinte/A/S001 (1).svg", b"<svg>2</svg>").unwrap();
        schreiben(d.path(), "lernen/tinte/A/S002.svg", b"<svg>3</svg>").unwrap();
        schreiben(d.path(), "lernen/karten/k (Nils's conflicted copy 2024-01-31).md", b"k").unwrap();
        assert!(konflikt_loeschen(d.path(), "lernen/tinte/A/S002.svg", Some("lernen/tinte/A/S001.svg")).is_err());
        assert!(konflikt_loeschen(d.path(), "lernen/tinte/A/S001 (1).svg", None).is_err());
        konflikt_loeschen(d.path(), "lernen/tinte/A/S001 (1).svg", Some("lernen/tinte/A/S001.svg")).unwrap();
        konflikt_loeschen(d.path(), "lernen/karten/k (Nils's conflicted copy 2024-01-31).md", None).unwrap();
        let pfade: Vec<_> = liste(d.path()).unwrap().into_iter().map(|e| e.pfad).collect();
        assert_eq!(pfade, ["lernen/tinte/A/S001.svg", "lernen/tinte/A/S002.svg"]);
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
    #[test]
    fn liest_viele_texte_mit_stand_und_ueberspringt_fehlende() {
        let d = ordner();
        schreiben(d.path(), "lernen/karten/a.md", "Ä".as_bytes()).unwrap();
        schreiben(d.path(), "lernen/b.json", b"{}").unwrap();
        let t = texte_lesen(d.path(), &["lernen/karten/a.md".into(), "fehlt.md".into(), "../x.md".into(), "lernen/b.json".into()]);
        assert_eq!(t.iter().map(|t| t.pfad.as_str()).collect::<Vec<_>>(), ["lernen/karten/a.md", "lernen/b.json"]);
        assert_eq!(t[0].text, "Ä");
        assert_eq!(t[0].groesse, 2);
        assert!(t[0].stempel.starts_with("2:"));
    }

    #[test]
    fn schreibt_nur_auf_dem_erwarteten_stand() {
        let d = ordner();
        // Neu anlegen gelingt nur, wenn die Datei noch fehlt
        let Geschrieben::Ok { stempel: s1, .. } = schreiben_wenn(d.path(), "k.md", b"eins", None).unwrap() else { panic!() };
        assert_eq!(schreiben_wenn(d.path(), "k.md", b"doppelt", None).unwrap(), Geschrieben::Geaendert);
        // Auf dem bekannten Stand weiterschreiben
        let Geschrieben::Ok { stempel: s2, .. } = schreiben_wenn(d.path(), "k.md", b"zwei", Some(&s1)).unwrap() else { panic!() };
        assert_ne!(s1, s2);
        // Syncthing ersetzt die Datei (gleiche Größe!), danach scheitert der alte Stempel, die fremde Fassung bleibt
        schreiben(d.path(), "k.md", b"drei").unwrap();
        assert_eq!(schreiben_wenn(d.path(), "k.md", b"vier", Some(&s2)).unwrap(), Geschrieben::Geaendert);
        assert_eq!(lesen(d.path(), "k.md").unwrap(), b"drei");
        // Gelöscht, während die Oberfläche noch einen Stand kennt: auch das ist eine Änderung
        fs::remove_file(d.path().join("k.md")).unwrap();
        assert_eq!(schreiben_wenn(d.path(), "k.md", b"fuenf", Some(&s2)).unwrap(), Geschrieben::Geaendert);
    }

    #[test]
    fn gleiche_groesse_und_zeit_aber_anderer_inhalt_faellt_auf() {
        let d = ordner();
        schreiben(d.path(), "k.md", b"aaaa").unwrap();
        let (_, s1) = stand_von(d.path(), "k.md").unwrap().unwrap();
        let zeit = fs::metadata(d.path().join("k.md")).unwrap().modified().unwrap();
        fs::write(d.path().join("k.md"), b"bbbb").unwrap();
        fs::File::options().write(true).open(d.path().join("k.md")).unwrap().set_modified(zeit).unwrap();
        let (_, s2) = stand_von(d.path(), "k.md").unwrap().unwrap();
        assert_ne!(s1, s2);
    }

    #[test]
    fn loescht_nur_konfliktkopien() {
        let d = ordner();
        schreiben(d.path(), "lernen/m.md", b"m").unwrap();
        schreiben(d.path(), "lernen/m.sync-conflict-20261113-101010-ABCDEFG.md", b"k").unwrap();
        assert!(konflikt_loeschen(d.path(), "lernen/m.md", None).is_err());
        assert!(konflikt_loeschen(d.path(), "lernen.sync-conflict-x/m.md", None).is_err());
        konflikt_loeschen(d.path(), "lernen/m.sync-conflict-20261113-101010-ABCDEFG.md", None).unwrap();
        let pfade: Vec<_> = liste(d.path()).unwrap().into_iter().map(|e| e.pfad).collect();
        assert_eq!(pfade, ["lernen/m.md"]);
        // Schon weg (Syncthing war schneller): kein Fehler
        konflikt_loeschen(d.path(), "lernen/m.sync-conflict-20261113-101010-ABCDEFG.md", None).unwrap();
    }

    /// Messung: Start mit 2000 Karten (Liste + alle Texte lesen). Kein harter Grenzwert, die Zeit steht in der Ausgabe.
    #[test]
    fn messung_2000_dateien() {
        let d = ordner();
        let text = "---\ntyp: frage\nthema: \"[[modul]]\"\n---\n".to_string() + &"Ein Satz zur Lernkarte. ".repeat(20);
        for i in 0..2000 {
            schreiben(d.path(), &format!("lernen/fragen/{i:05}.md"), text.as_bytes()).unwrap();
        }
        let start = std::time::Instant::now();
        let pfade: Vec<String> = liste(d.path()).unwrap().into_iter().map(|e| e.pfad).collect();
        let t = texte_lesen(d.path(), &pfade);
        let dauer = start.elapsed();
        assert_eq!(t.len(), 2000);
        println!("MESSUNG 2000 Dateien: Liste + Lesen {dauer:?}");
        assert!(dauer.as_secs() < 5);
    }
}
