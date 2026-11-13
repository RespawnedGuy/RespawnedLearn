//! Der KI-Zugang, verschlüsselt im Datenordner, damit alle eigenen Geräte denselben Schlüssel nutzen (Vertrag Lernen 1.2,
//! Grundlagen 8 und Typen 5.8). Umschlagverfahren wie bei Passwortmanagern:
//!
//! - Ein zufälliger **Datenschlüssel** (32 Byte) verschlüsselt den Inhalt mit XChaCha20-Poly1305.
//! - Aus dem **Passwort** leitet Argon2id (RFC 9106) einen zweiten Schlüssel ab, der nur den Datenschlüssel einhüllt.
//! - Jedes Gerät merkt sich nach der ersten Passworteingabe nur den Datenschlüssel (zugang.rs, Konfigurationsordner),
//!   nie das Passwort. Der Datenschlüssel verlässt Rust nicht.
//!
//! Kopf (Kennung, Kosten, Salz) ist als zusätzliche Daten an beide Verschlüsselungen gebunden: Wer ein Byte daran
//! ändert oder Teile zweier Dateien mischt, bekommt nur einen Fehler.

use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::aead::{Aead, Payload};
use chacha20poly1305::{KeyInit, XChaCha20Poly1305, XNonce};
use serde::{Deserialize, Serialize};

const FORMAT: &str = "argon2id+xchacha20poly1305";
const BINDUNG: &str = "respawnedlearn ki-zugang 1";

/// Kosten von Argon2id. Standard nach RFC 9106, Abschnitt 4, zweite Empfehlung (64 MiB, 3 Durchgänge); ein Durchlauf
/// statt vier, weil die App ohne Threads rechnet. Steht in der Datei, damit spätere Versionen erhöhen können.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Kosten {
    pub m_kib: u32,
    pub t: u32,
    pub p: u32,
}

pub const STANDARD: Kosten = Kosten { m_kib: 64 * 1024, t: 3, p: 1 };
/// Eine fremde Datei darf das Gerät nicht lahmlegen (z. B. 8 GiB verlangen) und nicht unter OWASP fallen
const HOECHSTENS: Kosten = Kosten { m_kib: 512 * 1024, t: 16, p: 8 };
const MINDESTENS: Kosten = Kosten { m_kib: 19 * 1024, t: 2, p: 1 };

/// Was ein Gerät nach der ersten Passworteingabe behält
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Geraeteschluessel {
    pub kennung: String,
    pub schluessel: String,
}

#[derive(Serialize, Deserialize)]
struct Passwortteil {
    m_kib: u32,
    t: u32,
    p: u32,
    salz: String,
    nonce: String,
    schluessel: String,
}

#[derive(Serialize, Deserialize)]
struct Inhaltsteil {
    nonce: String,
    daten: String,
}

#[derive(Serialize, Deserialize)]
struct Datei {
    schema: u32,
    verfahren: String,
    kennung: String,
    passwort: Passwortteil,
    inhalt: Inhaltsteil,
}

/// Fehler als kurze Wörter, die die Oberfläche in Sätze übersetzt
#[derive(Debug, PartialEq)]
pub enum Fehler {
    /// Das Passwort passt nicht (oder jemand hat den Passwortteil verändert)
    Passwort,
    /// Der Datenschlüssel des Geräts passt nicht zur Datei: Passwort wurde auf einem anderen Gerät geändert
    Kennung,
    /// Datei kaputt, verändert oder unbekanntes Format
    Kaputt,
    /// Passwort zu kurz
    ZuKurz,
    /// Zufallsquelle des Betriebssystems nicht verfügbar
    Zufall,
}

impl Fehler {
    pub fn wort(&self) -> String {
        match self {
            Fehler::Passwort => "passwort",
            Fehler::Kennung => "kennung",
            Fehler::Kaputt => "kaputt",
            Fehler::ZuKurz => "zu-kurz",
            Fehler::Zufall => "zufall",
        }
        .into()
    }
}

/// Mindestlänge in Zeichen; die Oberfläche verlangt mehr und rät zu einem Satz aus mehreren Wörtern
pub const MINDESTLAENGE: usize = 8;

fn zufall<const N: usize>() -> Result<[u8; N], Fehler> {
    let mut b = [0u8; N];
    getrandom::fill(&mut b).map_err(|_| Fehler::Zufall)?;
    Ok(b)
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

fn unhex(s: &str) -> Result<Vec<u8>, Fehler> {
    if s.len() % 2 != 0 || !s.bytes().all(|c| c.is_ascii_hexdigit()) {
        return Err(Fehler::Kaputt);
    }
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|_| Fehler::Kaputt)).collect()
}

fn unhex_fest<const N: usize>(s: &str) -> Result<[u8; N], Fehler> {
    unhex(s)?.try_into().map_err(|_| Fehler::Kaputt)
}

fn bindung_passwort(kennung: &str, k: Kosten, salz: &str) -> String {
    format!("{BINDUNG}|passwort|{kennung}|{}|{}|{}|{salz}", k.m_kib, k.t, k.p)
}

fn bindung_inhalt(kennung: &str) -> String {
    format!("{BINDUNG}|inhalt|{kennung}")
}

fn ableiten(passwort: &str, salz: &[u8], k: Kosten) -> Result<[u8; 32], Fehler> {
    let params = Params::new(k.m_kib, k.t, k.p, Some(32)).map_err(|_| Fehler::Kaputt)?;
    let mut aus = [0u8; 32];
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
        .hash_password_into(passwort.as_bytes(), salz, &mut aus)
        .map_err(|_| Fehler::Kaputt)?;
    Ok(aus)
}

fn verschluesseln(schluessel: &[u8; 32], klartext: &[u8], bindung: &str) -> Result<(String, String), Fehler> {
    let nonce = zufall::<24>()?;
    let c = XChaCha20Poly1305::new(schluessel.into())
        .encrypt(&XNonce::from(nonce), Payload { msg: klartext, aad: bindung.as_bytes() })
        .map_err(|_| Fehler::Kaputt)?;
    Ok((hex(&nonce), hex(&c)))
}

fn entschluesseln(schluessel: &[u8; 32], nonce: &str, daten: &str, bindung: &str) -> Option<Vec<u8>> {
    let nonce = unhex_fest::<24>(nonce).ok()?;
    let daten = unhex(daten).ok()?;
    XChaCha20Poly1305::new(schluessel.into()).decrypt(&XNonce::from(nonce), Payload { msg: &daten, aad: bindung.as_bytes() }).ok()
}

fn lies(datei: &str) -> Result<Datei, Fehler> {
    let d: Datei = serde_json::from_str(datei).map_err(|_| Fehler::Kaputt)?;
    if d.schema != 1 || d.verfahren != FORMAT || unhex_fest::<16>(&d.kennung).is_err() {
        return Err(Fehler::Kaputt);
    }
    Ok(d)
}

fn kosten_von(p: &Passwortteil) -> Result<Kosten, Fehler> {
    let k = Kosten { m_kib: p.m_kib, t: p.t, p: p.p };
    let im_rahmen = |w: u32, lo: u32, hi: u32| (lo..=hi).contains(&w);
    if im_rahmen(k.m_kib, MINDESTENS.m_kib, HOECHSTENS.m_kib) && im_rahmen(k.t, MINDESTENS.t, HOECHSTENS.t) && im_rahmen(k.p, MINDESTENS.p, HOECHSTENS.p) {
        Ok(k)
    } else {
        Err(Fehler::Kaputt)
    }
}

fn als_text(d: &Datei) -> String {
    let mut s = serde_json::to_string_pretty(d).expect("Datei ist immer serialisierbar");
    s.push('\n');
    s
}

/// Neue Datei mit neuem Datenschlüssel: beim ersten Einschalten, bei „Passwort ändern“ und bei „Neu anfangen“
pub fn anlegen(passwort: &str, klartext: &str) -> Result<(String, Geraeteschluessel), Fehler> {
    anlegen_mit(passwort, klartext, STANDARD)
}

pub fn anlegen_mit(passwort: &str, klartext: &str, k: Kosten) -> Result<(String, Geraeteschluessel), Fehler> {
    if passwort.chars().count() < MINDESTLAENGE {
        return Err(Fehler::ZuKurz);
    }
    let datenschluessel = zufall::<32>()?;
    let kennung = hex(&zufall::<16>()?);
    let salz = hex(&zufall::<16>()?);
    let huelle = ableiten(passwort, &unhex(&salz)?, k)?;
    let (pn, pd) = verschluesseln(&huelle, &datenschluessel, &bindung_passwort(&kennung, k, &salz))?;
    let (inn, ind) = verschluesseln(&datenschluessel, klartext.as_bytes(), &bindung_inhalt(&kennung))?;
    let d = Datei {
        schema: 1,
        verfahren: FORMAT.into(),
        kennung: kennung.clone(),
        passwort: Passwortteil { m_kib: k.m_kib, t: k.t, p: k.p, salz, nonce: pn, schluessel: pd },
        inhalt: Inhaltsteil { nonce: inn, daten: ind },
    };
    Ok((als_text(&d), Geraeteschluessel { kennung, schluessel: hex(&datenschluessel) }))
}

/// Ein weiteres Gerät tritt mit dem Passwort bei und bekommt Inhalt und Datenschlüssel
pub fn beitreten(datei: &str, passwort: &str) -> Result<(String, Geraeteschluessel), Fehler> {
    let d = lies(datei)?;
    let k = kosten_von(&d.passwort)?;
    let huelle = ableiten(passwort, &unhex(&d.passwort.salz)?, k)?;
    let ds = entschluesseln(&huelle, &d.passwort.nonce, &d.passwort.schluessel, &bindung_passwort(&d.kennung, k, &d.passwort.salz)).ok_or(Fehler::Passwort)?;
    let ds: [u8; 32] = ds.try_into().map_err(|_| Fehler::Kaputt)?;
    let g = Geraeteschluessel { kennung: d.kennung.clone(), schluessel: hex(&ds) };
    Ok((oeffnen(datei, &g)?, g))
}

/// Inhalt mit dem Datenschlüssel des Geräts lesen
pub fn oeffnen(datei: &str, g: &Geraeteschluessel) -> Result<String, Fehler> {
    let d = lies(datei)?;
    if d.kennung != g.kennung {
        return Err(Fehler::Kennung);
    }
    let ds = unhex_fest::<32>(&g.schluessel)?;
    let k = entschluesseln(&ds, &d.inhalt.nonce, &d.inhalt.daten, &bindung_inhalt(&d.kennung)).ok_or(Fehler::Kaputt)?;
    String::from_utf8(k).map_err(|_| Fehler::Kaputt)
}

/// Neuen Inhalt schreiben, ohne Passwort: Kopf und Passwortteil bleiben byte-gleich, der Inhalt bekommt eine neue Nonce
pub fn schreiben(datei: &str, g: &Geraeteschluessel, klartext: &str) -> Result<String, Fehler> {
    let mut d = lies(datei)?;
    oeffnen(datei, g)?; // nur mit passendem, gültigem Schlüssel
    let ds = unhex_fest::<32>(&g.schluessel)?;
    let (n, c) = verschluesseln(&ds, klartext.as_bytes(), &bindung_inhalt(&d.kennung))?;
    d.inhalt = Inhaltsteil { nonce: n, daten: c };
    Ok(als_text(&d))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Schnell für Tests; die Prüfung der Grenzen gilt nur beim Öffnen fremder Dateien
    const BILLIG: Kosten = Kosten { m_kib: 19 * 1024, t: 2, p: 1 };
    const INHALT: &str = r#"{"anbieter":"anthropic","zugaenge":{"anthropic":{"schluessel":"sk-ant-geheim-1234","modell":"claude-opus-5-5"}}}"#;

    /// RFC 9106, Abschnitt 5.3: offizieller Prüfwert für Argon2id (Version 0x13, 32 KiB, 3 Durchgänge, 4 Bahnen,
    /// Passwort 32 × 0x01, Salz 16 × 0x02, Geheimnis 8 × 0x03, zusätzliche Daten 12 × 0x04)
    #[test]
    fn argon2id_rfc9106_pruefwert() {
        let params = argon2::ParamsBuilder::new().m_cost(32).t_cost(3).p_cost(4).output_len(32).data(argon2::AssociatedData::new(&[4u8; 12]).unwrap()).build().unwrap();
        let a = Argon2::new_with_secret(&[3u8; 8], Algorithm::Argon2id, Version::V0x13, params).unwrap();
        let mut aus = [0u8; 32];
        a.hash_password_into(&[1u8; 32], &[2u8; 16], &mut aus).unwrap();
        assert_eq!(hex(&aus), "0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659");
    }

    #[test]
    fn hin_und_zurueck_mit_passwort_und_mit_geraeteschluessel() {
        let (datei, g) = anlegen_mit("ein langer Satz als Passwort", INHALT, BILLIG).unwrap();
        assert_eq!(oeffnen(&datei, &g).unwrap(), INHALT);
        let (inhalt, g2) = beitreten(&datei, "ein langer Satz als Passwort").unwrap();
        assert_eq!(inhalt, INHALT);
        assert_eq!(g2, g);
        assert_eq!(lies(&datei).ok().unwrap().kennung, g.kennung);
    }

    #[test]
    fn kein_klartext_in_der_datei() {
        let (datei, g) = anlegen_mit("ein langer Satz als Passwort", INHALT, BILLIG).unwrap();
        for teil in ["sk-ant", "geheim", "1234", "anthropic", "opus", "Passwort", &g.schluessel] {
            assert!(!datei.contains(teil), "{teil} steht im Klartext in der Datei");
        }
    }

    #[test]
    fn falsches_passwort_und_zu_kurzes_scheitern() {
        let (datei, _) = anlegen_mit("ein langer Satz als Passwort", INHALT, BILLIG).unwrap();
        assert_eq!(beitreten(&datei, "ein langer Satz als passwort").unwrap_err(), Fehler::Passwort);
        assert_eq!(anlegen_mit("kurz", INHALT, BILLIG).unwrap_err(), Fehler::ZuKurz);
    }

    /// Jedes einzelne veränderte Zeichen in Kopf, Passwortteil oder Inhalt führt zu einem Fehler, nie zu anderem Inhalt
    #[test]
    fn jede_veraenderung_wird_erkannt() {
        let (datei, g) = anlegen_mit("ein langer Satz als Passwort", INHALT, BILLIG).unwrap();
        let roh: serde_json::Value = serde_json::from_str(&datei).unwrap();
        let felder: [&[&str]; 7] = [&["kennung"], &["passwort", "salz"], &["passwort", "nonce"], &["passwort", "schluessel"], &["inhalt", "nonce"], &["inhalt", "daten"], &["passwort", "m_kib"]];
        for f in felder {
            let mut v = roh.clone();
            let mut z = &mut v;
            for s in f {
                z = &mut z[*s];
            }
            *z = match z.clone() {
                serde_json::Value::String(s) => {
                    let erstes = if s.starts_with('0') { "1" } else { "0" };
                    serde_json::Value::String(format!("{erstes}{}", &s[1..]))
                }
                serde_json::Value::Number(n) => serde_json::json!(n.as_u64().unwrap() + 1024),
                x => x,
            };
            let t = v.to_string();
            assert!(beitreten(&t, "ein langer Satz als Passwort").is_err(), "{f:?} verändert, aber mit Passwort lesbar");
            if f != ["kennung"] {
                let mit_geraet = oeffnen(&t, &g);
                // Passwortteil und Kosten betreffen den Datenschlüssel des Geräts nicht, der Inhalt bleibt dann gleich
                assert!(mit_geraet.is_err() || mit_geraet.as_deref() == Ok(INHALT), "{f:?} verändert ergibt anderen Inhalt");
            }
        }
    }

    #[test]
    fn teile_zweier_dateien_lassen_sich_nicht_mischen() {
        let (a, ga) = anlegen_mit("ein langer Satz als Passwort", INHALT, BILLIG).unwrap();
        let (b, _) = anlegen_mit("ein langer Satz als Passwort", "{}", BILLIG).unwrap();
        let mut va: serde_json::Value = serde_json::from_str(&a).unwrap();
        let vb: serde_json::Value = serde_json::from_str(&b).unwrap();
        va["inhalt"] = vb["inhalt"].clone();
        assert!(oeffnen(&va.to_string(), &ga).is_err());
        let mut va: serde_json::Value = serde_json::from_str(&a).unwrap();
        va["passwort"] = vb["passwort"].clone();
        assert!(beitreten(&va.to_string(), "ein langer Satz als Passwort").is_err());
    }

    #[test]
    fn schreiben_behaelt_passwort_und_neues_passwort_sperrt_alten_geraeteschluessel() {
        let (datei, g) = anlegen_mit("ein langer Satz als Passwort", INHALT, BILLIG).unwrap();
        let neu = schreiben(&datei, &g, "{\"anbieter\":null}").unwrap();
        assert_eq!(oeffnen(&neu, &g).unwrap(), "{\"anbieter\":null}");
        // gleiche Kennung und gleicher Passwortteil: andere Geräte lesen ohne neue Eingabe weiter
        let (inhalt, _) = beitreten(&neu, "ein langer Satz als Passwort").unwrap();
        assert_eq!(inhalt, "{\"anbieter\":null}");
        let (geaendert, g2) = anlegen_mit("ganz anderes Passwort", INHALT, BILLIG).unwrap();
        assert_ne!(g2.kennung, g.kennung);
        assert_eq!(oeffnen(&geaendert, &g).unwrap_err(), Fehler::Kennung);
        assert_eq!(schreiben(&geaendert, &g, "{}").unwrap_err(), Fehler::Kennung);
        assert_eq!(beitreten(&geaendert, "ein langer Satz als Passwort").unwrap_err(), Fehler::Passwort);
    }

    #[test]
    fn fremde_kosten_ausserhalb_des_rahmens_werden_abgelehnt() {
        let (datei, _) = anlegen_mit("ein langer Satz als Passwort", INHALT, BILLIG).unwrap();
        for (feld, wert) in [("m_kib", 8u64 * 1024 * 1024), ("m_kib", 1024), ("t", 1), ("t", 1000), ("p", 64)] {
            let mut v: serde_json::Value = serde_json::from_str(&datei).unwrap();
            v["passwort"][feld] = serde_json::json!(wert);
            assert_eq!(beitreten(&v.to_string(), "ein langer Satz als Passwort").unwrap_err(), Fehler::Kaputt, "{feld}={wert}");
        }
    }

    #[test]
    fn kaputte_dateien() {
        let g = Geraeteschluessel { kennung: "00".repeat(16), schluessel: "00".repeat(32) };
        for t in ["", "{}", "[1]", "{kaputt", r#"{"schema":2}"#] {
            assert_eq!(oeffnen(t, &g).unwrap_err(), Fehler::Kaputt);
            assert!(lies(t).is_err());
        }
    }

    /// Die Standardkosten sind die geprüften und funktionieren (dauert im Debug-Bau einige Sekunden)
    #[test]
    fn standardkosten() {
        assert_eq!(STANDARD, Kosten { m_kib: 65536, t: 3, p: 1 });
        let (datei, _) = anlegen("ein langer Satz als Passwort", INHALT).unwrap();
        assert!(datei.contains("\"m_kib\": 65536"));
        assert_eq!(beitreten(&datei, "ein langer Satz als Passwort").unwrap().0, INHALT);
    }
}
