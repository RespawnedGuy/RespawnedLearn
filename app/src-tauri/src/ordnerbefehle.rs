//! Befehle rund um die Wahl des Datenordners: Stand, Standardort, Wahl beim ersten Start und Wechsel mit Umzug.
//! Die Oberfläche setzt nie einen beliebigen Pfad: Am PC wählt der Dialog, den Rust öffnet; unter Android muss der Pfad
//! im gemeinsamen Speicher liegen (ordnerwahl.rs). Jede Wahl geht durch `setze_ordner` und damit durch `pruefe_ort`.
//!
//! Gesperrt sind am PC der Programmordner und die internen Ordner der App. Die Tauri-Vorlage des Installers
//! (crates/tauri-bundler/.../nsis/installer.nsi) löscht beim Deinstallieren mit „App-Daten löschen“
//! `%APPDATA%\<Kennung>` und `%LOCALAPPDATA%\<Kennung>` samt Inhalt; Updates entfernen nur die eigenen Programmdateien.

use crate::ordnerwahl::{self, kanonisch, Sperre};
use crate::umzug::{self, Inhalt};
use crate::{setze_ordner, wurzel, Zustand};
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager, State};

const GROSS_KLEIN_EGAL: bool = cfg!(windows);

#[derive(Serialize)]
pub struct Stand {
    ordner: Option<String>,
    plattform: &'static str,
    /// vorgeschlagener Ort (PC: Dokumente\RespawnedLearn, Android: /storage/emulated/0/RespawnedLearn)
    standard: Option<String>,
    /// was dort schon liegt; `None`, wenn es sich (noch) nicht lesen lässt
    standard_inhalt: Option<Inhalt>,
    /// liegt der gewählte Ordner an einem gesperrten Ort (ältere Fassungen erlaubten das), steht hier der Grund
    warnung: Option<&'static str>,
}

#[derive(Serialize)]
pub struct Vormerkung {
    pfad: String,
    inhalt: Inhalt,
}

/// Orte, an denen der Datenordner nie liegen darf, kanonisch
fn sperren(app: &AppHandle) -> Vec<Sperre> {
    let mut v = Vec::new();
    #[cfg(desktop)]
    {
        if let Some(d) = std::env::current_exe().ok().and_then(|e| e.parent().map(Path::to_path_buf)) {
            v.push(Sperre { pfad: kanonisch(&d), grund: ordnerwahl::GRUND_PROGRAMM });
        }
        let p = app.path();
        for d in [p.app_config_dir(), p.app_data_dir(), p.app_local_data_dir(), p.app_cache_dir()].into_iter().flatten() {
            v.push(Sperre { pfad: kanonisch(&d), grund: ordnerwahl::GRUND_APPDATEN });
        }
    }
    #[cfg(mobile)]
    let _ = app;
    v
}

fn grund_der_sperre(app: &AppHandle, p: &Path) -> Option<&'static str> {
    ordnerwahl::gesperrt(&kanonisch(p), &sperren(app), GROSS_KLEIN_EGAL)
}

/// Lehnt gesperrte Orte mit Begründung ab
pub fn pruefe_ort(app: &AppHandle, p: &Path) -> Result<(), String> {
    grund_der_sperre(app, p).map_or(Ok(()), |g| Err(g.to_string()))
}

fn standard(app: &AppHandle) -> Option<PathBuf> {
    #[cfg(desktop)]
    return app.path().document_dir().ok().map(|d| d.join(ordnerwahl::STANDARD_NAME));
    #[cfg(mobile)]
    {
        let _ = app;
        Some(Path::new(ordnerwahl::ANDROID_SPEICHER).join(ordnerwahl::STANDARD_NAME))
    }
}

fn text(p: &Path) -> String {
    p.to_string_lossy().into_owned()
}

#[tauri::command]
pub fn stand(app: AppHandle, z: State<Zustand>) -> Stand {
    let ordner = z.einstellungen.lock().unwrap().ordner.clone();
    let warnung = ordner.as_deref().and_then(|o| grund_der_sperre(&app, Path::new(o)));
    let standard = standard(&app);
    Stand {
        standard_inhalt: standard.as_deref().and_then(|s| umzug::inhalt(s).ok()),
        standard: standard.as_deref().map(text),
        ordner,
        plattform: std::env::consts::OS,
        warnung,
    }
}

/// Erster Start: den vorgeschlagenen Ort anlegen und nutzen (liegen dort schon Daten, werden sie weiter genutzt)
#[tauri::command]
pub fn ordner_standard(app: AppHandle, z: State<Zustand>) -> Result<(), String> {
    let s = standard(&app).ok_or("Kein Ordner „Dokumente“ gefunden. Bitte einen Ordner wählen.")?;
    setze_ordner(&app, &z, s)
}

/// Unter Android: Pfad aus der Ordnerauswahl oder getippt, nur Unterordner des gemeinsamen Speichers. Am PC gibt es
/// diesen Weg nicht, dort wählt nur der Dialog (`ordner_waehlen`).
#[tauri::command]
pub fn ordner_setzen(app: AppHandle, z: State<Zustand>, pfad: String) -> Result<(), String> {
    #[cfg(mobile)]
    return setze_ordner(&app, &z, ordnerwahl::android_ordner(&pfad)?);
    #[cfg(desktop)]
    {
        let _ = (app, z, pfad);
        Err("Den Ordner bitte über „Ordner wählen“ aussuchen.".into())
    }
}

/// Am PC: öffnet den Ordnerdialog des Systems, startet in „Dokumente“. Ohne Startordner öffnet Windows den Ordner, aus
/// dem die App lief, also den Programmordner; so landeten Daten dort.
async fn dialog(app: &AppHandle) -> Result<Option<PathBuf>, String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_dialog::DialogExt;
        let mut d = app.dialog().file().set_title("Datenordner wählen");
        if let Ok(dok) = app.path().document_dir() {
            d = d.set_directory(dok);
        }
        let gewaehlt = tauri::async_runtime::spawn_blocking(move || d.blocking_pick_folder()).await.map_err(|e| e.to_string())?;
        gewaehlt.map(|g| g.into_path().map_err(|e| e.to_string())).transpose()
    }
    #[cfg(mobile)]
    {
        let _ = app;
        Err("nicht-moeglich".into())
    }
}

/// Erster Start am PC: Dialog und sofort übernehmen. `false` = abgebrochen.
#[tauri::command]
pub async fn ordner_waehlen(app: AppHandle) -> Result<bool, String> {
    let Some(p) = dialog(&app).await? else { return Ok(false) };
    setze_ordner(&app, &app.state::<Zustand>(), p)?;
    Ok(true)
}

/// Wechsel in den Einstellungen, Schritt 1: neuen Ort bestimmen und prüfen, noch nicht übernehmen.
/// `wahl`: "dialog" (PC), "standard" oder "pfad" (Android, mit `pfad`). `None` = abgebrochen.
#[tauri::command]
pub async fn ordner_vormerken(app: AppHandle, wahl: String, pfad: Option<String>) -> Result<Option<Vormerkung>, String> {
    let neu = match wahl.as_str() {
        "dialog" => match dialog(&app).await? {
            Some(p) => p,
            None => return Ok(None),
        },
        "standard" => standard(&app).ok_or("Kein Standardordner auf diesem Gerät.")?,
        #[cfg(mobile)]
        "pfad" => ordnerwahl::android_ordner(pfad.as_deref().unwrap_or(""))?,
        _ => return Err(format!("unbekannte Wahl {wahl:?}")),
    };
    let _ = pfad;
    pruefe_ort(&app, &neu)?;
    let z = app.state::<Zustand>();
    if let Ok(alt) = wurzel(&z) {
        let (n, a) = (kanonisch(&neu), kanonisch(&alt));
        if ordnerwahl::liegt_in(&n, &a, GROSS_KLEIN_EGAL) && ordnerwahl::liegt_in(&a, &n, GROSS_KLEIN_EGAL) {
            return Err("Das ist schon der Datenordner.".into());
        }
    }
    let inhalt = umzug::inhalt(&neu)?;
    *z.vorgemerkt.lock().unwrap() = Some(neu.clone());
    Ok(Some(Vormerkung { pfad: text(&neu), inhalt }))
}

/// Schritt 2: den vorgemerkten Ordner übernehmen, mit `mitnehmen` vorher alle Daten dorthin kopieren und prüfen
/// (umzug.rs, Ereignis `umzug-fortschritt` = [fertig, gesamt]). Liefert die Zahl der kopierten Dateien.
/// Der bisherige Ordner bleibt, wie er ist; scheitert der Umzug, bleibt er auch der Datenordner.
#[tauri::command]
pub async fn ordner_uebernehmen(app: AppHandle, mitnehmen: bool) -> Result<usize, String> {
    let z = app.state::<Zustand>();
    let neu = z.vorgemerkt.lock().unwrap().take().ok_or("Kein neuer Ordner gewählt.")?;
    pruefe_ort(&app, &neu)?;
    let mut anzahl = 0;
    if mitnehmen {
        let alt = wurzel(&z)?;
        let (a, n, h) = (alt.clone(), neu.clone(), app.clone());
        anzahl = tauri::async_runtime::spawn_blocking(move || {
            umzug::umziehen(&a, &n, GROSS_KLEIN_EGAL, |fertig, gesamt| {
                let _ = h.emit("umzug-fortschritt", (fertig, gesamt));
            })
        })
        .await
        .map_err(|e| e.to_string())??;
    }
    setze_ordner(&app, &z, neu)?;
    Ok(anzahl)
}
