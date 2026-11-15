//! Wer darf was? Rein, ohne Tauri und ohne Netz, damit `cargo test` jeden Fall prüft.
//!
//! Der Server lauscht nur auf 127.0.0.1; erreichbar ist er für andere Geräte allein über `tailscale serve`. Serve setzt
//! bei jeder Anfrage aus dem Tailnet den Kopf `Tailscale-User-Login` und entfernt gleichnamige Köpfe, die ein Gerät
//! selbst mitschickt (tailscale.com/docs/features/tailscale-serve, „Identity headers“). Daran hängt der Datenordner.
//!
//! Schutz vor fremden Webseiten im Browser des Nutzers (CSRF): Der Browser schickt die Anfrage einer fremden Seite
//! ans Tailnet mit, Tailscale ergänzt den Login. Darum braucht jede Anfrage an `/api/` den Kopf `Rl-Anfrage: 1`.
//! Einen eigenen Kopf darf eine fremde Seite nur nach einer CORS-Vorabfrage senden, und die erlaubt der Server nie.
//! Dazu muss `Sec-Fetch-Site`, wenn der Browser ihn schickt, „same-origin“ sein.
//!
//! DNS-Rebinding braucht keinen eigenen Schutz: Serve spricht nur HTTPS mit dem Zertifikat des eigenen Gerätenamens,
//! ein fremder Name scheitert schon am Zertifikat.

use std::collections::HashMap;
use std::path::PathBuf;

pub const LOGIN_KOPF: &str = "tailscale-user-login";
pub const NAME_KOPF: &str = "tailscale-user-name";
pub const ANFRAGE_KOPF: &str = "rl-anfrage";

/// Warum eine Anfrage abgelehnt wird
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Abgelehnt {
    /// kein Tailscale-Login: kommt nicht über `tailscale serve` (oder von einem getaggten Gerät)
    OhneLogin,
    /// Login ohne eigenen Datenordner
    Unbekannt,
    /// sieht nach einer fremden Webseite aus
    FremdeHerkunft,
}

impl Abgelehnt {
    pub fn status(self) -> u16 {
        match self {
            Abgelehnt::OhneLogin => 401,
            Abgelehnt::Unbekannt | Abgelehnt::FremdeHerkunft => 403,
        }
    }

    /// Text für den Menschen; nennt keinen Pfad des Rechners
    pub fn text(self) -> &'static str {
        match self {
            Abgelehnt::OhneLogin => "Nur über Tailscale erreichbar (tailscale serve). Getaggte Geräte haben keinen Login und bekommen keinen Zugang.",
            Abgelehnt::Unbekannt => "Für dein Tailscale-Konto ist hier kein Datenordner eingetragen. Bitte den Besitzer dieses Rechners, dich in RespawnedLearn unter Einstellungen › Zugang übers Netz einzutragen.",
            Abgelehnt::FremdeHerkunft => "Anfrage von einer fremden Seite abgelehnt.",
        }
    }
}

/// Logins vergleicht der Server ohne Groß- und Kleinschreibung (E-Mail-Adressen)
pub fn normiert(login: &str) -> String {
    login.trim().to_lowercase()
}

/// Wer fragt, und in welchem Ordner arbeitet er? Liest nur die Köpfe als (kleingeschriebener Name, Wert).
pub fn nutzer<'a>(koepfe: impl Fn(&str) -> Option<&'a str>, ordner: &HashMap<String, PathBuf>) -> Result<(String, PathBuf), Abgelehnt> {
    let login = koepfe(LOGIN_KOPF).map(normiert).filter(|l| !l.is_empty()).ok_or(Abgelehnt::OhneLogin)?;
    let o = ordner.get(&login).cloned().ok_or(Abgelehnt::Unbekannt)?;
    Ok((login, o))
}

/// Prüft eine Anfrage an `/api/` auf fremde Herkunft
pub fn pruefe_api<'a>(koepfe: impl Fn(&str) -> Option<&'a str>) -> Result<(), Abgelehnt> {
    if koepfe(ANFRAGE_KOPF) != Some("1") {
        return Err(Abgelehnt::FremdeHerkunft);
    }
    match koepfe("sec-fetch-site") {
        None | Some("same-origin") => Ok(()),
        Some(_) => Err(Abgelehnt::FremdeHerkunft),
    }
}

/// Dateiname für Daten je Login (KI-Zugang): hexadezimal, damit verschiedene Logins nie dieselbe Datei treffen und kein
/// Login aus dem Ordner hinausführt
pub fn dateiname(login: &str) -> String {
    normiert(login).bytes().map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn koepfe<'a>(paare: &'a [(&'a str, &'a str)]) -> impl Fn(&str) -> Option<&'a str> + 'a {
        move |n: &str| paare.iter().find(|(k, _)| *k == n).map(|(_, v)| *v)
    }

    fn ordner() -> HashMap<String, PathBuf> {
        HashMap::from([("a@example.com".to_string(), PathBuf::from("/daten/a")), ("b@github".to_string(), PathBuf::from("/daten/b"))])
    }

    #[test]
    fn ohne_login_kein_zugang() {
        assert_eq!(nutzer(koepfe(&[]), &ordner()), Err(Abgelehnt::OhneLogin));
        assert_eq!(nutzer(koepfe(&[(LOGIN_KOPF, "  ")]), &ordner()), Err(Abgelehnt::OhneLogin));
        assert_eq!(Abgelehnt::OhneLogin.status(), 401);
    }

    #[test]
    fn unbekannter_login_kein_zugang() {
        assert_eq!(nutzer(koepfe(&[(LOGIN_KOPF, "c@example.com")]), &ordner()), Err(Abgelehnt::Unbekannt));
        assert_eq!(Abgelehnt::Unbekannt.status(), 403);
    }

    #[test]
    fn login_waehlt_den_eigenen_ordner() {
        assert_eq!(nutzer(koepfe(&[(LOGIN_KOPF, "A@Example.com")]), &ordner()).unwrap().1, PathBuf::from("/daten/a"));
        assert_eq!(nutzer(koepfe(&[(LOGIN_KOPF, "b@github")]), &ordner()).unwrap().1, PathBuf::from("/daten/b"));
    }

    #[test]
    fn api_nur_mit_eigenem_kopf_und_gleicher_herkunft() {
        assert_eq!(pruefe_api(koepfe(&[(ANFRAGE_KOPF, "1")])), Ok(()));
        assert_eq!(pruefe_api(koepfe(&[(ANFRAGE_KOPF, "1"), ("sec-fetch-site", "same-origin")])), Ok(()));
        assert_eq!(pruefe_api(koepfe(&[])), Err(Abgelehnt::FremdeHerkunft));
        assert_eq!(pruefe_api(koepfe(&[(ANFRAGE_KOPF, "0")])), Err(Abgelehnt::FremdeHerkunft));
        for s in ["cross-site", "same-site", "none"] {
            assert_eq!(pruefe_api(koepfe(&[(ANFRAGE_KOPF, "1"), ("sec-fetch-site", s)])), Err(Abgelehnt::FremdeHerkunft), "{s}");
        }
    }

    #[test]
    fn dateiname_ohne_pfadzeichen_und_eindeutig() {
        let a = dateiname("../x@y");
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(dateiname("a.b@c"), dateiname("a_b@c"));
        assert_eq!(dateiname("A@B"), dateiname("a@b"));
    }
}
