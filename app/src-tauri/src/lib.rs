//! RespawnedLearn als Tauri-App: Die Oberfläche (React) spricht über diese Befehle mit dem Datenordner.
//! Kein Server, kein Netz nötig. Den Abgleich zwischen Geräten macht Syncthing auf dem Ordner.

mod ordner;

use notify::{RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Emitter, Manager, State};

/// Was die App sich auf dem Gerät merkt (nicht im Datenordner, der gehört allen Geräten)
#[derive(Default, Serialize, Deserialize, Clone)]
struct Einstellungen {
    ordner: Option<String>,
}

#[derive(Default)]
struct Zustand {
    einstellungen: Mutex<Einstellungen>,
    beobachter: Mutex<Option<notify::RecommendedWatcher>>,
}

#[derive(Serialize)]
struct Stand {
    ordner: Option<String>,
    plattform: &'static str,
}

fn einstellungs_datei(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(d.join("einstellungen.json"))
}

fn wurzel(z: &State<Zustand>) -> Result<PathBuf, String> {
    z.einstellungen.lock().unwrap().ordner.clone().map(PathBuf::from).ok_or_else(|| "Kein Datenordner gewählt".into())
}

/// Meldet jede Änderung im Datenordner an die Oberfläche (Ereignis `ordner-geaendert`, Liste relativer Pfade).
/// Die Oberfläche fasst kurz hintereinander kommende Meldungen zusammen und liest dann neu.
fn beobachte(app: &AppHandle, z: &State<Zustand>, ordner: PathBuf) -> Result<(), String> {
    let app2 = app.clone();
    let wurzel = ordner.clone();
    let mut w = notify::recommended_watcher(move |ereignis: notify::Result<notify::Event>| {
        let Ok(e) = ereignis else { return };
        let pfade: Vec<String> = e
            .paths
            .iter()
            .map(|p| ordner::relativ(&wurzel, p))
            .filter(|r| !r.is_empty() && !r.split('/').any(ordner::ist_zwischendatei) && !r.starts_with(".index/") && !r.starts_with(".st"))
            .collect();
        if !pfade.is_empty() {
            let _ = app2.emit("ordner-geaendert", pfade);
        }
    })
    .map_err(|e| e.to_string())?;
    w.watch(&ordner, RecursiveMode::Recursive).map_err(|e| e.to_string())?;
    *z.beobachter.lock().unwrap() = Some(w);
    Ok(())
}

#[tauri::command]
fn stand(z: State<Zustand>) -> Stand {
    Stand { ordner: z.einstellungen.lock().unwrap().ordner.clone(), plattform: std::env::consts::OS }
}

/// Setzt den Datenordner, nachdem geprüft ist, dass die App dort schreiben darf
#[tauri::command]
fn ordner_setzen(app: AppHandle, z: State<Zustand>, pfad: String) -> Result<(), String> {
    let p = PathBuf::from(&pfad);
    std::fs::create_dir_all(&p).map_err(|e| format!("Ordner lässt sich nicht anlegen: {e}"))?;
    ordner::pruefe_schreibbar(&p)?;
    let neu = Einstellungen { ordner: Some(pfad) };
    let datei = einstellungs_datei(&app)?;
    std::fs::create_dir_all(datei.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(&datei, serde_json::to_vec_pretty(&neu).unwrap()).map_err(|e| e.to_string())?;
    *z.einstellungen.lock().unwrap() = neu;
    beobachte(&app, &z, p)
}

#[tauri::command]
fn dateien(z: State<Zustand>) -> Result<Vec<ordner::Eintrag>, String> {
    ordner::liste(&wurzel(&z)?)
}

/// Liefert die Datei als rohe Bytes (kein JSON), damit auch große PDFs schnell ankommen
#[tauri::command]
fn datei_lesen(z: State<Zustand>, pfad: String) -> Result<Response, String> {
    Ok(Response::new(ordner::lesen(&wurzel(&z)?, &pfad)?))
}

/// Schreibt die rohen Bytes aus dem Rumpf der Anfrage; der Pfad steht URL-kodiert im Kopf `pfad`
#[tauri::command]
fn datei_schreiben(z: State<Zustand>, request: Request<'_>) -> Result<(), String> {
    let pfad = request.headers().get("pfad").and_then(|v| v.to_str().ok()).ok_or("Kopf „pfad“ fehlt")?;
    let pfad = url_dekodieren(pfad)?;
    let InvokeBody::Raw(inhalt) = request.body() else { return Err("Inhalt muss als Bytes kommen".into()) };
    ordner::schreiben(&wurzel(&z)?, &pfad, inhalt)
}

/// Liest viele Textdateien auf einmal (beim Start und nach Änderungen von außen)
#[tauri::command]
fn texte_lesen(z: State<Zustand>, pfade: Vec<String>) -> Result<Vec<ordner::TextDatei>, String> {
    Ok(ordner::texte_lesen(&wurzel(&z)?, &pfade))
}

/// Schreibt nur, wenn die Datei noch den erwarteten Stand hat (Kopf `erwartet`: Stempel, fehlt = darf nicht existieren)
#[tauri::command]
fn datei_schreiben_wenn(z: State<Zustand>, request: Request<'_>) -> Result<ordner::Geschrieben, String> {
    let kopf = |n: &str| request.headers().get(n).and_then(|v| v.to_str().ok()).map(str::to_string);
    let pfad = url_dekodieren(&kopf("pfad").ok_or("Kopf „pfad“ fehlt")?)?;
    let erwartet = kopf("erwartet");
    let InvokeBody::Raw(inhalt) = request.body() else { return Err("Inhalt muss als Bytes kommen".into()) };
    ordner::schreiben_wenn(&wurzel(&z)?, &pfad, inhalt, erwartet.as_deref())
}

/// Löscht eine Konfliktkopie (und nur eine solche), nachdem ein Mensch entschieden hat
#[tauri::command]
fn konflikt_loeschen(z: State<Zustand>, pfad: String) -> Result<(), String> {
    ordner::konflikt_loeschen(&wurzel(&z)?, &pfad)
}

/// encodeURIComponent rückwärts (Kopfzeilen dürfen nur ASCII enthalten, Dateinamen haben Umlaute)
fn url_dekodieren(s: &str) -> Result<String, String> {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            let h = std::str::from_utf8(&b[i + 1..i + 3]).map_err(|e| e.to_string())?;
            out.push(u8::from_str_radix(h, 16).map_err(|_| format!("ungültige Kodierung: {s}"))?);
            i += 3;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8(out).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Zustand::default())
        .setup(|app| {
            let h = app.handle();
            let z = app.state::<Zustand>();
            if let Ok(datei) = einstellungs_datei(h) {
                if let Some(e) = std::fs::read(&datei).ok().and_then(|b| serde_json::from_slice::<Einstellungen>(&b).ok()) {
                    let ordner = e.ordner.clone();
                    *z.einstellungen.lock().unwrap() = e;
                    // Fehlt der Ordner gerade (Laufwerk ab), fragt die Oberfläche neu; der Start scheitert nicht
                    if let Some(o) = ordner.map(PathBuf::from).filter(|p| p.is_dir()) {
                        let _ = beobachte(h, &z, o);
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![stand, ordner_setzen, dateien, datei_lesen, datei_schreiben, texte_lesen, datei_schreiben_wenn, konflikt_loeschen])
        .run(tauri::generate_context!())
        .expect("RespawnedLearn startet nicht");
}

#[cfg(test)]
mod tests {
    use super::url_dekodieren;

    #[test]
    fn dekodiert_wie_encode_uri_component() {
        assert_eq!(url_dekodieren("lernen%2Fkarten%2F%C3%9Cbung%20eins.md").unwrap(), "lernen/karten/Übung eins.md");
        assert_eq!(url_dekodieren("a.md").unwrap(), "a.md");
        assert!(url_dekodieren("%zz").is_err());
    }
}
