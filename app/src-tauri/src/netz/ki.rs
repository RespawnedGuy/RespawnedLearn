//! KI über den Zugang übers Netz: Safari darf Perplexity und Ollama wegen CORS nicht direkt fragen, darum leitet der
//! Server weiter. Damit er kein offener Weiterleiter wird, gehen Anfragen nur an die vier Anbieter, die auch die App
//! erreichen darf (capabilities/default.json), und an Ollama nur über die Prüfung aufs eigene Netz (ollama.rs).
//! Der KI-Zugang (Schlüssel, Modelle) liegt je Login im Konfigurationsordner, wie am Gerät selbst (zugang.rs).

use serde::Deserialize;
use std::collections::BTreeMap;
use tauri_plugin_http::reqwest;

/// Dieselben Ziele wie die Freigabe `http:default` in capabilities/default.json
pub const ANBIETER: &[&str] = &["api.anthropic.com", "api.openai.com", "generativelanguage.googleapis.com", "api.perplexity.ai"];

/// Köpfe, die der Server nie weitergibt: Verbindung, Herkunft, Anmeldung des Browsers, Tailscale-Login
const NIE: &[&str] = &["host", "connection", "content-length", "transfer-encoding", "cookie", "origin", "referer", "keep-alive", "upgrade", "te", "trailer", "proxy-authorization", "rl-anfrage"];

#[derive(Debug, Deserialize)]
pub struct KiAnfrage {
    pub url: String,
    #[serde(default = "post")]
    pub methode: String,
    #[serde(default)]
    pub kopf: BTreeMap<String, String>,
    pub rumpf: Option<String>,
}

fn post() -> String {
    "POST".into()
}

#[derive(Debug, PartialEq, Eq)]
pub enum Ziel {
    Anbieter,
    Ollama,
}

/// Darf der Server diese Adresse fragen?
pub fn ziel(url: &str) -> Result<Ziel, String> {
    if crate::ollama::ziel(url).is_ok() {
        return Ok(Ziel::Ollama);
    }
    let u = reqwest::Url::parse(url).map_err(|_| "ki-ziel".to_string())?;
    let host = u.host_str().unwrap_or("");
    if u.scheme() != "https" || u.port().is_some() || !u.username().is_empty() || u.password().is_some() || !ANBIETER.contains(&host) {
        return Err("ki-ziel".into());
    }
    Ok(Ziel::Anbieter)
}

/// Weitergegebene Köpfe: alles außer der Sperrliste und Tailscales eigenen
pub fn weiterzugeben(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    !NIE.contains(&n.as_str()) && !n.starts_with("tailscale-") && !n.starts_with("sec-")
}

/// Führt die Anfrage aus; Antwort wie bei `ollama_anfrage` (Status und Text)
pub async fn weiterleiten(a: KiAnfrage) -> Result<crate::ollama::Antwort, String> {
    match ziel(&a.url)? {
        Ziel::Ollama => crate::ollama::anfrage(a.url, a.rumpf).await,
        Ziel::Anbieter => {
            let client = reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .timeout(std::time::Duration::from_secs(600))
                .build()
                .map_err(|e| e.to_string())?;
            let methode = match a.methode.to_ascii_uppercase().as_str() {
                "GET" => reqwest::Method::GET,
                "POST" => reqwest::Method::POST,
                _ => return Err("ki-methode".into()),
            };
            let mut r = client.request(methode, &a.url);
            for (k, v) in a.kopf.iter().filter(|(k, _)| weiterzugeben(k)) {
                r = r.header(k, v);
            }
            if let Some(rumpf) = a.rumpf {
                r = r.body(rumpf);
            }
            let antwort = r.send().await.map_err(|_| "kein-netz".to_string())?;
            let status = antwort.status().as_u16();
            let bytes = antwort.bytes().await.map_err(|_| "kein-netz".to_string())?;
            if bytes.len() > crate::ollama::HOECHSTENS {
                return Err("zu-gross".into());
            }
            Ok(crate::ollama::Antwort { status, text: String::from_utf8_lossy(&bytes).into_owned() })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nur_bekannte_anbieter_und_ollama() {
        assert_eq!(ziel("https://api.anthropic.com/v1/messages"), Ok(Ziel::Anbieter));
        assert_eq!(ziel("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000"), Ok(Ziel::Anbieter));
        // Ollama: hier nur Port und Pfad; ob der Name aufs eigene Netz zeigt, prüft ollama::anfrage beim Verbinden
        assert_eq!(ziel("http://192.168.1.20:11434/api/chat"), Ok(Ziel::Ollama));
        for f in [
            "http://api.anthropic.com/v1/messages",
            "https://api.anthropic.com:8443/v1/messages",
            "https://evil.example/v1",
            "https://api.anthropic.com.evil.example/v1",
            "https://user:pw@api.openai.com/v1",
            "https://192.168.1.20/",
            "http://localhost:4387/api/dateien",
            "kein url",
        ] {
            assert!(ziel(f).is_err(), "{f} darf nicht erreichbar sein");
        }
    }

    #[test]
    fn koepfe_ohne_herkunft_und_login() {
        for k in ["x-api-key", "Authorization", "anthropic-version", "content-type", "x-goog-api-key"] {
            assert!(weiterzugeben(k), "{k}");
        }
        for k in ["Host", "cookie", "Origin", "Tailscale-User-Login", "sec-fetch-site", "Rl-Anfrage", "content-length"] {
            assert!(!weiterzugeben(k), "{k}");
        }
    }
}
