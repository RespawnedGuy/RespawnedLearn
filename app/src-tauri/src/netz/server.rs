//! Der Webserver für den Zugang übers Netz (docs/netz.md). Liefert die Oberfläche aus der App und dieselben Befehle wie
//! die Tauri-Brücke als HTTP, je Tailscale-Login im eigenen Datenordner. Lauscht nur auf 127.0.0.1; andere Geräte
//! erreichen ihn ausschließlich über `tailscale serve` (HTTPS, Login im Kopf). Die Dateiarbeit macht ordner.rs, dieselbe
//! wie in der App: sicherer Pfad ohne Symlinks, atomar, Schreiben nur auf erwartetem Stempel, nur Konfliktkopien löschen.

use super::ki;
use super::zugriff::{self, Abgelehnt};
use crate::ordner;
use axum::body::{Body, Bytes};
use axum::extract::{DefaultBodyLimit, Query, Request, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::middleware::{self, Next};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Extension, Json, Router};
use notify::{RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::convert::Infallible;
use std::path::PathBuf;
use std::sync::Arc;

/// Liefert eine Datei der Oberfläche (Pfad ohne führenden `/`) mit ihrem Medientyp
pub type Oberflaeche = Arc<dyn Fn(&str) -> Option<(Vec<u8>, String)> + Send + Sync>;

/// Skripte (PDF) dürfen groß sein; mehr nimmt der Server in einer Anfrage nicht an
pub const HOECHSTENS: usize = 200 * 1024 * 1024;

/// Wie die CSP der App (tauri.conf.json), ohne die Tauri-Brücke, dazu kein Einbetten in fremde Seiten
const CSP: &str = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";

/// Merkmal in der ausgelieferten Seite: daran erkennt die Oberfläche, dass sie vom Server kommt (oberflaeche/daten/netz.ts)
pub const MERKMAL: &str = "<meta name=\"rl-netz\" content=\"1\">";

pub struct Netz {
    /// Login (normiert) → Datenordner
    pub ordner: HashMap<String, PathBuf>,
    pub oberflaeche: Oberflaeche,
    /// Ordner für den KI-Zugang je Login (im Konfigurationsordner der App)
    pub ki_ordner: PathBuf,
}

/// Wer gerade fragt
#[derive(Clone)]
struct Nutzer {
    login: String,
    name: String,
    ordner: PathBuf,
}

struct Fehler(StatusCode, String);

impl IntoResponse for Fehler {
    fn into_response(self) -> Response {
        (self.0, self.1).into_response()
    }
}

fn falsch(e: String) -> Fehler {
    Fehler(StatusCode::BAD_REQUEST, e)
}

/// Dateiarbeit nicht auf dem Netz-Faden
async fn blockierend<T: Send + 'static>(f: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, Fehler> {
    tokio::task::spawn_blocking(f).await.map_err(|e| Fehler(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?.map_err(falsch)
}

pub fn router(n: Arc<Netz>) -> Router {
    let api = Router::new()
        .route("/stand", get(stand))
        .route("/dateien", get(dateien))
        .route("/texte", post(texte))
        .route("/datei", get(datei_lesen).put(datei_schreiben))
        .route("/konflikt-loeschen", post(konflikt_loeschen))
        .route("/ereignisse", get(ereignisse))
        .route("/ki-zugang", get(ki_zugang_lesen).put(ki_zugang_setzen))
        .route("/ki", post(ki_anfrage))
        .fallback(|| async { Fehler(StatusCode::NOT_FOUND, "unbekannt".into()) });
    Router::new()
        .nest("/api", api)
        .fallback(oberflaeche)
        .layer(DefaultBodyLimit::max(HOECHSTENS))
        .layer(middleware::from_fn_with_state(n.clone(), pruefen))
        .layer(middleware::map_response(sicherheitskoepfe))
        .with_state(n)
}

/// Jede Anfrage: Login → Ordner, `/api/` zusätzlich gegen fremde Seiten
async fn pruefen(State(n): State<Arc<Netz>>, mut req: Request, next: Next) -> Response {
    let k = req.headers().clone();
    let kopf = |name: &str| k.get(name).and_then(|v| v.to_str().ok());
    let api = req.uri().path().starts_with("/api/");
    let ergebnis = zugriff::nutzer(kopf, &n.ordner).and_then(|(login, ordner)| {
        if api {
            zugriff::pruefe_api(kopf)?;
        }
        Ok(Nutzer { name: kopf(zugriff::NAME_KOPF).unwrap_or(&login).to_string(), login, ordner })
    });
    match ergebnis {
        Ok(nutzer) => {
            req.extensions_mut().insert(nutzer);
            next.run(req).await
        }
        Err(a) => abgelehnt(a, api),
    }
}

fn abgelehnt(a: Abgelehnt, api: bool) -> Response {
    let status = StatusCode::from_u16(a.status()).unwrap_or(StatusCode::FORBIDDEN);
    if api {
        return (status, a.text()).into_response();
    }
    let seite = format!(
        "<!doctype html><html lang=\"de\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>RespawnedLearn</title><body style=\"font:17px/1.5 system-ui;max-width:32em;margin:3em auto;padding:0 1em\"><h1 style=\"font-size:1.3em\">Kein Zugang</h1><p>{}</p></body></html>",
        a.text()
    );
    (status, [(header::CONTENT_TYPE, "text/html; charset=utf-8")], seite).into_response()
}

async fn sicherheitskoepfe(mut r: Response) -> Response {
    let h = r.headers_mut();
    h.insert(header::CONTENT_SECURITY_POLICY, HeaderValue::from_static(CSP));
    h.insert(header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));
    h.insert(header::REFERRER_POLICY, HeaderValue::from_static("no-referrer"));
    h.insert(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));
    r
}

#[derive(Serialize)]
struct Stand {
    plattform: &'static str,
    name: String,
}

async fn stand(Extension(u): Extension<Nutzer>) -> Json<Stand> {
    Json(Stand { plattform: "netz", name: u.name })
}

async fn dateien(Extension(u): Extension<Nutzer>) -> Result<Json<Vec<ordner::Eintrag>>, Fehler> {
    Ok(Json(blockierend(move || ordner::liste(&u.ordner)).await?))
}

async fn texte(Extension(u): Extension<Nutzer>, Json(pfade): Json<Vec<String>>) -> Result<Json<Vec<ordner::TextDatei>>, Fehler> {
    Ok(Json(blockierend(move || Ok(ordner::texte_lesen(&u.ordner, &pfade))).await?))
}

#[derive(Deserialize)]
struct PfadFrage {
    pfad: String,
}

async fn datei_lesen(Extension(u): Extension<Nutzer>, Query(q): Query<PfadFrage>) -> Result<Response, Fehler> {
    let b = blockierend(move || ordner::lesen(&u.ordner, &q.pfad)).await?;
    Ok(([(header::CONTENT_TYPE, "application/octet-stream"), (header::CACHE_CONTROL, "no-store")], b).into_response())
}

/// Schreibt nur auf dem erwarteten Stand (Kopf `Rl-Erwartet`, fehlt = darf noch nicht existieren); sonst 409
async fn datei_schreiben(Extension(u): Extension<Nutzer>, Query(q): Query<PfadFrage>, koepfe: HeaderMap, inhalt: Bytes) -> Result<Response, Fehler> {
    let erwartet = koepfe.get("rl-erwartet").and_then(|v| v.to_str().ok()).map(str::to_string);
    let g = blockierend(move || ordner::schreiben_wenn(&u.ordner, &q.pfad, &inhalt, erwartet.as_deref())).await?;
    let status = if matches!(g, ordner::Geschrieben::Geaendert) { StatusCode::CONFLICT } else { StatusCode::OK };
    Ok((status, Json(g)).into_response())
}

#[derive(Deserialize)]
struct KonfliktFrage {
    pfad: String,
    original: Option<String>,
}

async fn konflikt_loeschen(Extension(u): Extension<Nutzer>, Json(k): Json<KonfliktFrage>) -> Result<StatusCode, Fehler> {
    blockierend(move || ordner::konflikt_loeschen(&u.ordner, &k.pfad, k.original.as_deref())).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Meldet Änderungen im eigenen Ordner als Server-Sent Events (Ereignis `geaendert`, Liste relativer Pfade). Jede
/// Verbindung hat einen eigenen Beobachter, der mit ihr endet.
async fn ereignisse(Extension(u): Extension<Nutzer>) -> Result<Response, Fehler> {
    let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<Vec<String>>();
    let wurzel = u.ordner.clone();
    let mut w = notify::recommended_watcher(move |e: notify::Result<notify::Event>| {
        let Ok(e) = e else { return };
        let pfade: Vec<String> = e.paths.iter().map(|p| ordner::relativ(&wurzel, p)).filter(|r| ordner::meldenswert(r)).collect();
        if !pfade.is_empty() {
            let _ = tx.send(pfade);
        }
    })
    .map_err(|e| falsch(e.to_string()))?;
    w.watch(&u.ordner, RecursiveMode::Recursive).map_err(|e| falsch(e.to_string()))?;
    let strom = futures_util::stream::unfold((rx, w), |(mut rx, w)| async move {
        let pfade = rx.recv().await?;
        let ereignis = Event::default().event("geaendert").data(serde_json::to_string(&pfade).unwrap_or_default());
        Some((Ok::<_, Infallible>(ereignis), (rx, w)))
    });
    let mut r = Sse::new(strom).keep_alive(KeepAlive::default()).into_response();
    r.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    Ok(r)
}

fn ki_datei(n: &Netz, u: &Nutzer) -> PathBuf {
    n.ki_ordner.join(format!("{}.json", zugriff::dateiname(&u.login)))
}

async fn ki_zugang_lesen(State(n): State<Arc<Netz>>, Extension(u): Extension<Nutzer>) -> Json<Option<serde_json::Value>> {
    Json(crate::zugang::lesen(&ki_datei(&n, &u)))
}

async fn ki_zugang_setzen(State(n): State<Arc<Netz>>, Extension(u): Extension<Nutzer>, Json(wert): Json<Option<serde_json::Value>>) -> Result<StatusCode, Fehler> {
    let datei = ki_datei(&n, &u);
    blockierend(move || crate::zugang::setzen(&datei, wert.as_ref())).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn ki_anfrage(Json(a): Json<ki::KiAnfrage>) -> Result<Json<crate::ollama::Antwort>, Fehler> {
    ki::ziel(&a.url).map_err(|e| Fehler(StatusCode::FORBIDDEN, e))?;
    ki::weiterleiten(a).await.map(Json).map_err(|e| Fehler(StatusCode::BAD_GATEWAY, e))
}

/// Dateien der Oberfläche; in die Startseite kommt das Merkmal für den Netz-Betrieb
async fn oberflaeche(State(n): State<Arc<Netz>>, req: Request) -> Response {
    let pfad = req.uri().path().trim_start_matches('/');
    let pfad = if pfad.is_empty() { "index.html" } else { pfad };
    if pfad.split('/').any(|t| t == ".." || t.is_empty()) || pfad.contains('\\') {
        return StatusCode::NOT_FOUND.into_response();
    }
    let Some((mut bytes, mime)) = (n.oberflaeche)(pfad) else {
        return (StatusCode::NOT_FOUND, "nicht gefunden").into_response();
    };
    // auch wenn Tauri für einen unbekannten Pfad auf index.html ausweicht
    if mime.starts_with("text/html") {
        let html = String::from_utf8_lossy(&bytes).replacen("</head>", &format!("{MERKMAL}</head>"), 1);
        bytes = html.into_bytes();
    }
    // Vite versieht Dateien unter assets/ mit einem Inhaltsfingerabdruck; alles andere jedes Mal neu prüfen
    let cache = if pfad.starts_with("assets/") { "public, max-age=31536000, immutable" } else { "no-cache" };
    ([(header::CONTENT_TYPE, mime), (header::CACHE_CONTROL, cache.to_string())], Body::from(bytes)).into_response()
}

/// Ein laufender Server; endet, wenn er fallen gelassen wird
pub struct Laufend {
    griff: tauri::async_runtime::JoinHandle<()>,
}

impl Drop for Laufend {
    fn drop(&mut self) {
        self.griff.abort();
    }
}

/// Startet den Server auf 127.0.0.1 (nie auf anderen Adressen); ein belegter Port fällt sofort als Fehler auf
pub fn starten(n: Arc<Netz>, port: u16) -> Result<Laufend, String> {
    let l = std::net::TcpListener::bind(("127.0.0.1", port)).map_err(|e| format!("Port {port} lässt sich nicht öffnen: {e}"))?;
    l.set_nonblocking(true).map_err(|e| e.to_string())?;
    let griff = tauri::async_runtime::spawn(async move {
        if let Ok(l) = tokio::net::TcpListener::from_std(l) {
            let _ = axum::serve(l, router(n)).await;
        }
    });
    Ok(Laufend { griff })
}

/// Oberfläche aus einem Ordner (Vite-Ausgabe `app/dist`); nur für Tests und die Gegenprobe im Browser
#[cfg(test)]
pub fn aus_ordner(wurzel: PathBuf) -> Oberflaeche {
    Arc::new(move |p: &str| {
        let b = ordner::lesen(&wurzel, p).ok()?;
        Some((b, medientyp(p).to_string()))
    })
}

/// Medientyp nach Endung (nur was Vite ausgibt); in der App bestimmt ihn Tauri
#[cfg(test)]
fn medientyp(p: &str) -> &'static str {
    match p.rsplit('.').next().unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json",
        "webmanifest" => "application/manifest+json",
        "png" => "image/png",
        "svg" => "image/svg+xml",
        "wasm" => "application/wasm",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "bcmap" => "application/octet-stream",
        "pfb" => "application/octet-stream",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
#[path = "server_tests.rs"]
mod tests;
