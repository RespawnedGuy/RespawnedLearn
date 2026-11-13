//! Konfliktkopien beliebiger Sync-Programme (Vertrag Lernen, Grundlagen 8), das Gegenstück zu `kern/src/syncKopien.ts`.
//! Rust braucht das nur für eine Frage: Darf die App diese Datei löschen? Beide Seiten prüfen dieselbe Tabelle
//! `testdaten/syncnamen.json`, damit sie nie auseinanderlaufen.

use std::fs;
use std::path::Path;

/// Ordner, deren Dateien die App liest; nur dort gelten Kopien unbekannter Programme
pub fn in_app_ordner(rel: &str) -> bool {
    ["lernen/", "reviews/", "gemeinsam/anhaenge/", "gemeinsam/quellen/", "gemeinsam/entitaeten/", "anhaenge/"].iter().any(|p| rel.starts_with(p))
}

fn ziffern(s: &str, n: usize) -> bool {
    s.len() >= n && s.as_bytes()[..n].iter().all(u8::is_ascii_digit)
}

/// `JJJJ-MM-TT` am Anfang von `s`
fn datum(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() >= 10 && ziffern(s, 4) && b[4] == b'-' && ziffern(&s[5..], 2) && b[7] == b'-' && ziffern(&s[8..], 2)
}

/// `JJJJ-MM-TT HHMMSS` am Anfang von `s`
fn datum_zeit(s: &str) -> bool {
    datum(s) && s.as_bytes().get(10) == Some(&b' ') && ziffern(&s[11..], 6)
}

/// Fängt die Marke bei `start` mit einem Leerzeichen davor an, gehört es dazu
fn mit_leer(n: &str, start: usize) -> usize {
    if start > 0 && n.as_bytes()[start - 1] == b' ' {
        start - 1
    } else {
        start
    }
}

/// Ende einer optionalen Nummer ` (n)` hinter einer Dropbox-Marke
fn mit_nummer(n: &str, ende: usize) -> usize {
    let r = &n[ende..];
    if let Some(innen) = r.strip_prefix(" (") {
        let z = innen.bytes().take_while(u8::is_ascii_digit).count();
        if z > 0 && innen.as_bytes().get(z) == Some(&b')') {
            return ende + 3 + z;
        }
    }
    ende
}

/// Alle Marken bekannter Programme im Dateinamen als (Anfang, Ende)
fn marken(n: &str) -> Vec<(usize, usize)> {
    let mut out = Vec::new();
    // Syncthing und diese App: .sync-conflict-JJJJMMTT-HHMMSS-<gerät>
    for (i, _) in n.match_indices(".sync-conflict-") {
        let r = &n[i + 15..];
        let b = r.as_bytes();
        if ziffern(r, 8) && b.get(8) == Some(&b'-') && ziffern(&r[9..], 6) && b.get(15) == Some(&b'-') {
            let geraet = r[16..].find(['.', '/']).unwrap_or(r.len() - 16);
            if geraet > 0 {
                out.push((i, i + 15 + 16 + geraet));
            }
        }
    }
    // Nextcloud: (conflicted copy [<Nutzer> ]JJJJ-MM-TT HHMMSS)
    for (i, _) in n.match_indices("(conflicted copy ") {
        let r = &n[i + 17..];
        if let Some(zu) = r.find(')') {
            let innen = &r[..zu];
            let ok = !innen.contains('(')
                && innen.len() >= 17
                && innen.get(innen.len() - 17..).is_some_and(datum_zeit)
                && (innen.len() == 17 || innen.as_bytes()[innen.len() - 18] == b' ');
            if ok {
                out.push((mit_leer(n, i), i + 17 + zu + 1));
            }
        }
    }
    // Nextcloud und ownCloud, alt: _conflict-JJJJMMTT-HHMMSS
    for (i, _) in n.match_indices("_conflict-") {
        let r = &n[i + 10..];
        if ziffern(r, 8) && r.as_bytes().get(8) == Some(&b'-') && ziffern(&r[9..], 6) {
            out.push((i, i + 10 + 15));
        }
    }
    // Nextcloud: (case clash from JJJJ-MM-TT HHMMSS)
    for (i, _) in n.match_indices("(case clash from ") {
        let r = &n[i + 17..];
        if datum_zeit(r) && r.as_bytes().get(17) == Some(&b')') {
            out.push((mit_leer(n, i), i + 17 + 18));
        }
    }
    // Dropbox: (<Nutzer>['s] conflicted copy[ JJJJ-MM-TT])[ (n)], deutsch „in Konflikt stehende Kopie“
    for anker in [" conflicted copy", " in Konflikt stehende Kopie"] {
        for (i, _) in n.match_indices(anker) {
            let Some(auf) = n[..i].rfind('(') else { continue };
            if auf + 1 >= i || n[auf + 1..i].contains(')') {
                continue;
            }
            let r = &n[i + anker.len()..];
            let zu = if r.starts_with(')') {
                0
            } else if r.starts_with(' ') && datum(&r[1..]) && r.as_bytes().get(11) == Some(&b')') {
                11
            } else {
                continue;
            };
            out.push((mit_leer(n, auf), mit_nummer(n, i + anker.len() + zu + 1)));
        }
    }
    out
}

/// Stufe A: Pfad des Originals, wenn der Dateiname eine bekannte Konfliktkopie ist. Bei Kopien von Kopien zählt die letzte Marke.
pub fn bekanntes_original(rel: &str) -> Option<String> {
    let (ordner, n) = rel.rsplit_once('/').map(|(o, n)| (format!("{o}/"), n)).unwrap_or((String::new(), rel));
    let (a, e) = marken(n).into_iter().max_by_key(|m| m.0)?;
    Some(format!("{ordner}{}{}", &n[..a], &n[e..]))
}

fn teile(n: &str) -> (&str, String) {
    match n.rfind('.') {
        Some(p) if p > 0 => (&n[..p], n[p..].to_lowercase()),
        _ => (n, String::new()),
    }
}

/// Zusatz, den Sync-Programme an den Namen hängen: ` (1)`, ` 2`, `-RECHNERNAME`
fn zusatz(z: &str) -> bool {
    let klammer = |s: &str| s.starts_with('(') && s.ends_with(')') && s.len() >= 2 && !s[1..s.len() - 1].contains(['(', ')', '/']);
    if klammer(z) || z.strip_prefix(' ').is_some_and(klammer) {
        return true;
    }
    if let Some(d) = z.strip_prefix(' ') {
        return (1..=3).contains(&d.len()) && d.bytes().all(|b| b.is_ascii_digit());
    }
    if let Some(w) = z.strip_prefix('-') {
        let mut c = w.chars();
        return c.next().is_some_and(|x| !x.is_whitespace() && !"()/.-".contains(x)) && c.all(|x| !x.is_whitespace() && !"()/.".contains(x));
    }
    false
}

/// Stufe B nach dem Namen: gleicher Ordner, gleiche Endung, Name des Originals plus Zusatz (wie `kopieVon` in kern)
pub fn kopie_von(kopie: &str, original: &str) -> bool {
    let (ok, nk) = kopie.rsplit_once('/').unwrap_or(("", kopie));
    let (oo, no) = original.rsplit_once('/').unwrap_or(("", original));
    if kopie == original || ok != oo {
        return false;
    }
    let (sk, ek) = teile(nk);
    let (so, eo) = teile(no);
    ek == eo && sk.len() > so.len() && sk.starts_with(so) && zusatz(&sk[so.len()..])
}

/// `id` aus dem Kopfbereich einer Markdown-Datei
fn id_von(text: &str) -> Option<String> {
    let rest = text.strip_prefix('\u{feff}').unwrap_or(text);
    let rest = rest.strip_prefix("---\n").or_else(|| rest.strip_prefix("---\r\n"))?;
    for zeile in rest.lines() {
        if zeile.trim_end() == "---" {
            break;
        }
        if let Some(w) = zeile.strip_prefix("id:") {
            let w = w.trim().trim_matches(|c| c == '"' || c == '\'');
            return (!w.is_empty()).then(|| w.to_string());
        }
    }
    None
}

/// Darf `kopie` als Konfliktkopie von `original` gelöscht werden (wie `loeschbareKopie` in kern)? Bekanntes Muster, oder
/// das Original ist da und die Kopie heißt wie es plus Zusatz bzw. trägt als Markdown dieselbe ID.
pub fn loeschbar(wurzel: &Path, kopie: &str, original: Option<&str>) -> bool {
    if bekanntes_original(kopie).is_some() {
        return true;
    }
    let Some(original) = original else { return false };
    if kopie == original || !in_app_ordner(kopie) || kopie.rsplit_once('/').map(|x| x.0) != original.rsplit_once('/').map(|x| x.0) {
        return false;
    }
    let (Ok(pk), Ok(po)) = (crate::ordner::sicherer_pfad(wurzel, kopie), crate::ordner::sicherer_pfad(wurzel, original)) else { return false };
    if !po.is_file() {
        return false;
    }
    if kopie_von(kopie, original) {
        return true;
    }
    if !kopie.ends_with(".md") || !original.ends_with(".md") {
        return false;
    }
    let lies = |p: &Path| fs::read(p).ok().map(|b| String::from_utf8_lossy(&b).into_owned());
    match (lies(&po).as_deref().and_then(id_von), lies(&pk).as_deref().and_then(id_von)) {
        (Some(a), Some(b)) => a == b,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn tabelle() -> Value {
        serde_json::from_str(include_str!("../../../testdaten/syncnamen.json")).unwrap()
    }

    #[test]
    fn bekannte_muster_wie_in_kern() {
        let t = tabelle();
        for f in t["bekannt"].as_array().unwrap() {
            let name = f["name"].as_str().unwrap();
            assert_eq!(bekanntes_original(name).as_deref(), f["original"].as_str(), "{name}");
        }
        for n in t["keine"].as_array().unwrap() {
            let n = n.as_str().unwrap();
            assert_eq!(bekanntes_original(n), None, "{n}");
        }
    }

    #[test]
    fn kopie_nach_dem_namen_wie_in_kern() {
        for f in tabelle()["kopieVon"].as_array().unwrap() {
            let (k, o) = (f["kopie"].as_str().unwrap(), f["original"].as_str().unwrap());
            assert_eq!(kopie_von(k, o), f["ja"].as_bool().unwrap(), "{k} ← {o}");
        }
    }

    #[test]
    fn loeschbar_nur_mit_vorhandenem_original_oder_gleicher_id() {
        let d = tempfile::tempdir().unwrap();
        let w = d.path();
        let schreib = |rel: &str, t: &str| crate::ordner::schreiben(w, rel, t.as_bytes()).unwrap();
        schreib("lernen/tinte/A1/S001.svg", "<svg></svg>");
        schreib("lernen/karten/01ABC.md", "---\nid: 01ABC\n---\nA");
        schreib("lernen/karten/neu.md", "---\nid: \"01ABC\"\n---\nB");
        schreib("lernen/karten/fremd.md", "---\nid: 01XYZ\n---\nC");
        assert!(loeschbar(w, "lernen/karten/k.sync-conflict-20261113-101010-ABCDEFG.md", None));
        assert!(loeschbar(w, "lernen/tinte/A1/S001 (1).svg", Some("lernen/tinte/A1/S001.svg")));
        assert!(loeschbar(w, "lernen/karten/neu.md", Some("lernen/karten/01ABC.md")));
        assert!(!loeschbar(w, "lernen/tinte/A1/S002.svg", Some("lernen/tinte/A1/S001.svg")));
        assert!(!loeschbar(w, "lernen/tinte/A1/S001 (1).svg", None));
        assert!(!loeschbar(w, "lernen/tinte/A9/S001 (1).svg", Some("lernen/tinte/A9/S001.svg")));
        assert!(!loeschbar(w, "lernen/karten/fremd.md", Some("lernen/karten/01ABC.md")));
        assert!(!loeschbar(w, "lernen/karten/01ABC.md", Some("lernen/karten/01ABC.md")));
        assert!(!loeschbar(w, "lernen/karten/neu.md", Some("../lernen/karten/01ABC.md")));
    }
}
