//! Anfragen an Ollama (KI auf dem eigenen Rechner oder im Heimnetz). Statt einer offenen Freigabe für jeden Rechner auf
//! Port 11434 (`http://*:11434/*`) prüft dieser Befehl selbst: nur Port 11434, nur Pfade unter `/api/`, und der Name muss
//! ausschließlich auf Adressen im eigenen Netz zeigen (Loopback, privat, link-local, CGNAT etwa für Tailscale).
//! Verbunden wird mit genau der geprüften Adresse, damit ein DNS-Wechsel zwischen Prüfen und Verbinden nichts umlenkt;
//! Weiterleitungen folgt der Befehl nicht. So taugt Ollama nicht als Weg, Daten an einen fremden Rechner zu schicken.

use serde::Serialize;
use std::net::{IpAddr, SocketAddr, ToSocketAddrs};

pub const PORT: u16 = 11434;
/// Antworten von Ollama sind JSON; mehr wird nicht gelesen
const HOECHSTENS: usize = 16 * 1024 * 1024;

/// Liegt die Adresse im eigenen Netz?
pub fn ist_privat(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(a) => {
            let o = a.octets();
            a.is_loopback()
                || a.is_private()
                || a.is_link_local()
                // 100.64.0.0/10 (RFC 6598): Carrier-Grade-NAT, genutzt von Tailscale und ähnlichen privaten Netzen
                || (o[0] == 100 && (64..128).contains(&o[1]))
        }
        IpAddr::V6(a) => {
            if let Some(v4) = a.to_ipv4_mapped() {
                return ist_privat(IpAddr::V4(v4));
            }
            let s = a.segments();
            a.is_loopback()
                // fc00::/7 eindeutige lokale Adressen, fe80::/10 link-local
                || (s[0] & 0xfe00) == 0xfc00
                || (s[0] & 0xffc0) == 0xfe80
        }
    }
}

/// Zerlegt und prüft die Adresse der Anfrage: http oder https, Port 11434, Pfad unter /api/. Liefert Host und Port.
pub fn ziel(url: &str) -> Result<(String, u16), String> {
    let (schema, rest) = url.split_once("://").ok_or("ollama-adresse")?;
    if schema != "http" && schema != "https" {
        return Err("ollama-adresse".into());
    }
    let (hostport, pfad) = rest.split_at(rest.find('/').unwrap_or(rest.len()));
    if !pfad.starts_with("/api/") || pfad.contains("..") || hostport.contains('@') {
        return Err("ollama-adresse".into());
    }
    let (host, port) = match hostport.strip_prefix('[') {
        // IPv6 in Klammern: [::1]:11434
        Some(v6) => {
            let (h, p) = v6.split_once("]:").ok_or("ollama-adresse")?;
            (h.to_string(), p)
        }
        None => {
            let (h, p) = hostport.rsplit_once(':').ok_or("ollama-adresse")?;
            (h.to_string(), p)
        }
    };
    let port: u16 = port.parse().map_err(|_| "ollama-adresse")?;
    if port != PORT || host.is_empty() {
        return Err("ollama-adresse".into());
    }
    Ok((host, port))
}

/// Löst den Namen auf; jede gefundene Adresse muss im eigenen Netz liegen. Liefert die erste zum Verbinden.
pub fn aufloesen(host: &str, port: u16) -> Result<SocketAddr, String> {
    let adressen: Vec<SocketAddr> = (host, port).to_socket_addrs().map_err(|_| "kein-netz".to_string())?.collect();
    if adressen.is_empty() {
        return Err("kein-netz".into());
    }
    if !adressen.iter().all(|a| ist_privat(a.ip())) {
        return Err("ollama-nicht-privat".into());
    }
    Ok(adressen[0])
}

#[derive(Serialize)]
pub struct Antwort {
    status: u16,
    text: String,
}

/// Eine Anfrage an Ollama; `rumpf` = JSON-Text (POST) oder nichts (GET)
#[tauri::command]
pub async fn ollama_anfrage(url: String, rumpf: Option<String>) -> Result<Antwort, String> {
    use tauri_plugin_http::reqwest;
    let (host, port) = ziel(&url)?;
    let h = host.clone();
    let adresse = tauri::async_runtime::spawn_blocking(move || aufloesen(&h, port)).await.map_err(|e| e.to_string())??;
    let client = reqwest::Client::builder()
        .resolve(&host, adresse)
        .redirect(reqwest::redirect::Policy::none())
        // lokale Modelle brauchen beim ersten Laden länger (wie mitFrist in netz.ts)
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;
    let anfrage = match rumpf {
        Some(r) => client.post(&url).header("content-type", "application/json").body(r),
        None => client.get(&url),
    };
    let antwort = anfrage.send().await.map_err(|_| "kein-netz".to_string())?;
    let status = antwort.status().as_u16();
    let bytes = antwort.bytes().await.map_err(|_| "kein-netz".to_string())?;
    if bytes.len() > HOECHSTENS {
        return Err("zu-gross".into());
    }
    Ok(Antwort { status, text: String::from_utf8_lossy(&bytes).into_owned() })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ip(s: &str) -> IpAddr {
        s.parse().unwrap()
    }

    #[test]
    fn privat_ist_nur_das_eigene_netz() {
        for p in ["127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.254", "192.168.1.20", "169.254.1.1", "100.64.0.1", "100.127.255.1", "::1", "fd12:3456::1", "fe80::1", "::ffff:192.168.1.20"] {
            assert!(ist_privat(ip(p)), "{p} sollte privat sein");
        }
        for o in ["8.8.8.8", "172.32.0.1", "172.15.0.1", "100.128.0.1", "100.63.0.1", "1.1.1.1", "2001:4860:4860::8888", "::ffff:8.8.8.8", "0.0.0.0"] {
            assert!(!ist_privat(ip(o)), "{o} darf nicht als privat gelten");
        }
    }

    #[test]
    fn ziel_nur_port_11434_und_api() {
        assert_eq!(ziel("http://localhost:11434/api/chat").unwrap(), ("localhost".into(), 11434));
        assert_eq!(ziel("http://192.168.1.20:11434/api/tags").unwrap(), ("192.168.1.20".into(), 11434));
        assert_eq!(ziel("https://mein-pc.local:11434/api/show").unwrap(), ("mein-pc.local".into(), 11434));
        assert_eq!(ziel("http://[::1]:11434/api/chat").unwrap(), ("::1".into(), 11434));
        for f in [
            "http://localhost:8080/api/chat",
            "http://localhost/api/chat",
            "http://localhost:11434/",
            "http://localhost:11434/x/../api/chat",
            "http://localhost:11434/api/../../x",
            "ftp://localhost:11434/api/chat",
            "http://nutzer@angreifer.invalid:11434/api/chat",
            "localhost:11434/api/chat",
            "http://:11434/api/chat",
        ] {
            assert!(ziel(f).is_err(), "{f} muss abgelehnt werden");
        }
    }

    #[test]
    fn aufloesen_lehnt_fremde_rechner_ab() {
        assert!(aufloesen("127.0.0.1", PORT).unwrap().ip().is_loopback());
        assert!(aufloesen("localhost", PORT).unwrap().ip().is_loopback());
        assert_eq!(aufloesen("8.8.8.8", PORT).unwrap_err(), "ollama-nicht-privat");
        assert_eq!(aufloesen("192.168.1.20", PORT).unwrap().ip(), ip("192.168.1.20"));
    }
}
