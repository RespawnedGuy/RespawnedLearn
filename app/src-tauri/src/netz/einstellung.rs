//! Einstellung „Zugang übers Netz“: an oder aus, Port, und welcher Tailscale-Login in welchem Datenordner arbeitet.
//! Liegt als `netz.json` im Konfigurationsordner der App, nie im Datenordner (Syncthing würde sie verteilen) und nie im Repo.

use super::zugriff::normiert;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub const STANDARD_PORT: u16 = 4387;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NetzNutzer {
    pub login: String,
    pub ordner: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NetzEinstellung {
    #[serde(default)]
    pub an: bool,
    #[serde(default = "standard_port")]
    pub port: u16,
    #[serde(default)]
    pub nutzer: Vec<NetzNutzer>,
}

fn standard_port() -> u16 {
    STANDARD_PORT
}

impl Default for NetzEinstellung {
    fn default() -> Self {
        NetzEinstellung { an: false, port: STANDARD_PORT, nutzer: vec![] }
    }
}

impl NetzEinstellung {
    /// Prüft, was ohne Dateisystem prüfbar ist; die Orte prüft lib.rs wie jede Ordnerwahl (`pruefe_ort`)
    pub fn pruefen(&self) -> Result<(), String> {
        if self.port < 1024 {
            return Err("Der Port muss 1024 oder höher sein.".into());
        }
        let mut gesehen = std::collections::HashSet::new();
        for n in &self.nutzer {
            let l = normiert(&n.login);
            if !l.contains('@') || l.chars().any(char::is_whitespace) {
                return Err(format!("„{}“ ist kein Tailscale-Login (Form name@anbieter).", n.login.trim()));
            }
            if !gesehen.insert(l) {
                return Err(format!("{} steht doppelt in der Liste.", n.login.trim()));
            }
            if !Path::new(&n.ordner).is_absolute() {
                return Err(format!("Der Ordner für {} muss ein vollständiger Pfad sein.", n.login.trim()));
            }
        }
        if self.an && self.nutzer.is_empty() {
            return Err("Ohne eingetragenen Nutzer gibt es nichts freizugeben.".into());
        }
        Ok(())
    }

    /// Login (normiert) → Datenordner
    pub fn ordner(&self) -> HashMap<String, PathBuf> {
        self.nutzer.iter().map(|n| (normiert(&n.login), PathBuf::from(&n.ordner))).collect()
    }
}

pub fn lesen(datei: &Path) -> NetzEinstellung {
    crate::zugang::lesen(datei).and_then(|v| serde_json::from_value(v).ok()).unwrap_or_default()
}

/// Atomar und nur für den Nutzer lesbar, wie der KI-Zugang
pub fn schreiben(datei: &Path, e: &NetzEinstellung) -> Result<(), String> {
    crate::zugang::setzen(datei, Some(&serde_json::to_value(e).map_err(|e| e.to_string())?))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn absolut(name: &str) -> String {
        std::env::temp_dir().join(name).to_string_lossy().into_owned()
    }

    fn mit(nutzer: &[(&str, &str)]) -> NetzEinstellung {
        NetzEinstellung { an: true, port: STANDARD_PORT, nutzer: nutzer.iter().map(|(l, o)| NetzNutzer { login: l.to_string(), ordner: absolut(o) }).collect() }
    }

    #[test]
    fn gueltige_einstellung() {
        assert_eq!(mit(&[("a@example.com", "a"), ("b@github", "b")]).pruefen(), Ok(()));
        assert_eq!(NetzEinstellung::default().pruefen(), Ok(()));
    }

    #[test]
    fn fehler_werden_benannt() {
        assert!(mit(&[("kein-login", "a")]).pruefen().is_err());
        assert!(mit(&[("a@x", "a"), ("A@X", "b")]).pruefen().unwrap_err().contains("doppelt"));
        assert!(mit(&[]).pruefen().is_err());
        let mut e = mit(&[("a@x", "a")]);
        e.port = 80;
        assert!(e.pruefen().is_err());
        let mut e = mit(&[("a@x", "a")]);
        e.nutzer[0].ordner = "relativ/ordner".into();
        assert!(e.pruefen().is_err());
    }

    #[test]
    fn lesen_und_schreiben() {
        let d = tempfile::tempdir().unwrap();
        let datei = d.path().join("netz.json");
        assert_eq!(lesen(&datei), NetzEinstellung::default());
        let e = mit(&[("A@Example.com", "a")]);
        schreiben(&datei, &e).unwrap();
        assert_eq!(lesen(&datei), e);
        assert!(e.ordner().contains_key("a@example.com"));
        // alte oder kaputte Datei: Standard statt Absturz
        std::fs::write(&datei, b"{\"an\":true}").unwrap();
        assert_eq!(lesen(&datei).port, STANDARD_PORT);
        std::fs::write(&datei, b"kaputt").unwrap();
        assert_eq!(lesen(&datei), NetzEinstellung::default());
    }
}
