//! Tests des Servers ohne Netz: jede Anfrage geht direkt in den Router (tower `oneshot`).

use super::*;
use axum::body::to_bytes;
use axum::http::Request as Anfrage;
use tower::ServiceExt;

struct Aufbau {
    _tmp: tempfile::TempDir,
    a: PathBuf,
    b: PathBuf,
    router: Router,
}

const A: &str = "a@example.com";
const B: &str = "b@github";

fn aufbau() -> Aufbau {
    let tmp = tempfile::tempdir().unwrap();
    let a = tmp.path().join("a");
    let b = tmp.path().join("b");
    let dist = tmp.path().join("dist");
    for o in [&a, &b, &dist] {
        std::fs::create_dir_all(o).unwrap();
    }
    std::fs::write(dist.join("index.html"), "<!doctype html><html><head><title>x</title></head><body></body></html>").unwrap();
    std::fs::create_dir_all(dist.join("assets")).unwrap();
    std::fs::write(dist.join("assets/app-1234.js"), "console.log(1)").unwrap();
    ordner::schreiben(&b, "lernen/geheim.md", b"nur B").unwrap();
    let n = Arc::new(Netz {
        ordner: HashMap::from([(A.to_string(), a.clone()), (B.to_string(), b.clone())]),
        oberflaeche: aus_ordner(dist),
        ki_ordner: tmp.path().join("ki"),
    });
    Aufbau { _tmp: tmp, a, b, router: router(n) }
}

/// Anfrage wie aus Safari über `tailscale serve`
fn von(login: Option<&str>, methode: &str, uri: &str) -> axum::http::request::Builder {
    let mut r = Anfrage::builder().method(methode).uri(uri);
    if let Some(l) = login {
        r = r.header("Tailscale-User-Login", l);
    }
    if uri.starts_with("/api/") {
        r = r.header("Rl-Anfrage", "1").header("Sec-Fetch-Site", "same-origin");
    }
    r
}

async fn schicke(r: &Router, a: Anfrage<Body>) -> (StatusCode, HeaderMap, Vec<u8>) {
    let antwort = r.clone().oneshot(a).await.unwrap();
    let status = antwort.status();
    let koepfe = antwort.headers().clone();
    let b = to_bytes(antwort.into_body(), usize::MAX).await.unwrap().to_vec();
    (status, koepfe, b)
}

fn leer(b: axum::http::request::Builder) -> Anfrage<Body> {
    b.body(Body::empty()).unwrap()
}

fn kodiert(p: &str) -> String {
    p.bytes()
        .map(|c| if c.is_ascii_alphanumeric() || b"-_.~".contains(&c) { (c as char).to_string() } else { format!("%{c:02X}") })
        .collect()
}

#[tokio::test]
async fn ohne_login_und_mit_fremdem_login_kein_zugang() {
    let s = aufbau();
    assert_eq!(schicke(&s.router, leer(von(None, "GET", "/api/dateien"))).await.0, StatusCode::UNAUTHORIZED);
    assert_eq!(schicke(&s.router, leer(von(Some("c@example.com"), "GET", "/api/dateien"))).await.0, StatusCode::FORBIDDEN);
    // auch die Oberfläche selbst, mit einer verständlichen Seite
    let (st, k, b) = schicke(&s.router, leer(von(Some("c@example.com"), "GET", "/"))).await;
    assert_eq!(st, StatusCode::FORBIDDEN);
    assert!(k[header::CONTENT_TYPE].to_str().unwrap().starts_with("text/html"));
    assert!(String::from_utf8(b).unwrap().contains("kein Datenordner eingetragen"));
}

#[tokio::test]
async fn fremde_seite_wird_abgelehnt() {
    let s = aufbau();
    // ohne eigenen Kopf (eine fremde Seite darf ihn ohne CORS-Freigabe nicht setzen)
    let a = Anfrage::builder().uri("/api/dateien").header("Tailscale-User-Login", A).body(Body::empty()).unwrap();
    assert_eq!(schicke(&s.router, a).await.0, StatusCode::FORBIDDEN);
    // mit Kopf, aber der Browser meldet eine andere Herkunft
    let a = Anfrage::builder().uri("/api/dateien").header("Tailscale-User-Login", A).header("Rl-Anfrage", "1").header("Sec-Fetch-Site", "cross-site").body(Body::empty()).unwrap();
    assert_eq!(schicke(&s.router, a).await.0, StatusCode::FORBIDDEN);
    // schreibend genauso: nichts landet auf der Platte
    let a = Anfrage::builder().method("PUT").uri("/api/datei?pfad=x.md").header("Tailscale-User-Login", A).body(Body::from("böse")).unwrap();
    assert_eq!(schicke(&s.router, a).await.0, StatusCode::FORBIDDEN);
    assert!(!s.a.join("x.md").exists());
}

#[tokio::test]
async fn jeder_sieht_nur_den_eigenen_ordner() {
    let s = aufbau();
    let (st, _, b) = schicke(&s.router, leer(von(Some(A), "GET", "/api/dateien"))).await;
    assert_eq!(st, StatusCode::OK);
    assert_eq!(String::from_utf8(b).unwrap(), "[]");
    let (_, _, b) = schicke(&s.router, leer(von(Some("B@GitHub"), "GET", "/api/dateien"))).await;
    assert!(String::from_utf8(b).unwrap().contains("lernen/geheim.md"));
    // A fragt nach Bs Datei: gibt es in As Ordner nicht
    let (st, _, _) = schicke(&s.router, leer(von(Some(A), "GET", "/api/datei?pfad=lernen%2Fgeheim.md"))).await;
    assert_eq!(st, StatusCode::BAD_REQUEST);
    // und kommt auch über Umwege nicht hin
    for p in ["../b/lernen/geheim.md", "/etc/passwd", "lernen/../../b/lernen/geheim.md", "lernen\\..\\..\\b"] {
        let (st, _, b) = schicke(&s.router, leer(von(Some(A), "GET", &format!("/api/datei?pfad={}", kodiert(p))))).await;
        assert_eq!(st, StatusCode::BAD_REQUEST, "{p}");
        assert!(!String::from_utf8_lossy(&b).contains("nur B"), "{p}");
    }
}

#[cfg(unix)]
#[tokio::test]
async fn symlink_im_ordner_wird_nicht_verfolgt() {
    let s = aufbau();
    std::os::unix::fs::symlink(&s.b, s.a.join("weg")).unwrap();
    let (st, _, b) = schicke(&s.router, leer(von(Some(A), "GET", "/api/datei?pfad=weg%2Flernen%2Fgeheim.md"))).await;
    assert_eq!(st, StatusCode::BAD_REQUEST);
    assert!(!String::from_utf8_lossy(&b).contains("nur B"));
    let a = von(Some(A), "PUT", "/api/datei?pfad=weg%2Fneu.md").body(Body::from("x")).unwrap();
    assert_eq!(schicke(&s.router, a).await.0, StatusCode::BAD_REQUEST);
    assert!(!s.b.join("neu.md").exists());
}

#[tokio::test]
async fn schreiben_nur_auf_erwartetem_stand() {
    let s = aufbau();
    let pfad = "/api/datei?pfad=lernen%2Fkarten%2F%C3%9Cbung.md";
    // neu anlegen: ohne erwarteten Stand
    let (st, _, b) = schicke(&s.router, von(Some(A), "PUT", pfad).body(Body::from("eins")).unwrap()).await;
    assert_eq!(st, StatusCode::OK);
    let g: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(g["art"], "ok");
    let stempel = g["stempel"].as_str().unwrap().to_string();
    assert_eq!(std::fs::read_to_string(s.a.join("lernen/karten/Übung.md")).unwrap(), "eins");
    // noch einmal ohne Stand: die Datei gibt es schon → 409, nichts überschrieben
    let (st, _, b) = schicke(&s.router, von(Some(A), "PUT", pfad).body(Body::from("zwei")).unwrap()).await;
    assert_eq!(st, StatusCode::CONFLICT);
    assert_eq!(serde_json::from_slice::<serde_json::Value>(&b).unwrap()["art"], "geaendert");
    assert_eq!(std::fs::read_to_string(s.a.join("lernen/karten/Übung.md")).unwrap(), "eins");
    // mit dem richtigen Stand
    let (st, _, _) = schicke(&s.router, von(Some(A), "PUT", pfad).header("Rl-Erwartet", &stempel).body(Body::from("zwei")).unwrap()).await;
    assert_eq!(st, StatusCode::OK);
    // der alte Stand gilt nicht mehr (die Desktop-App oder Syncthing hätte inzwischen geschrieben)
    let (st, _, _) = schicke(&s.router, von(Some(A), "PUT", pfad).header("Rl-Erwartet", &stempel).body(Body::from("drei")).unwrap()).await;
    assert_eq!(st, StatusCode::CONFLICT);
    assert_eq!(std::fs::read_to_string(s.a.join("lernen/karten/Übung.md")).unwrap(), "zwei");
    // lesen und mehrere Texte auf einmal
    let (_, _, b) = schicke(&s.router, leer(von(Some(A), "GET", pfad))).await;
    assert_eq!(b, b"zwei");
    let a = von(Some(A), "POST", "/api/texte").header("content-type", "application/json").body(Body::from(r#"["lernen/karten/Übung.md","fehlt.md"]"#)).unwrap();
    let (_, _, b) = schicke(&s.router, a).await;
    let t: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(t.as_array().unwrap().len(), 1);
    assert_eq!(t[0]["text"], "zwei");
}

#[tokio::test]
async fn nur_konfliktkopien_lassen_sich_loeschen() {
    let s = aufbau();
    ordner::schreiben(&s.a, "karte.md", b"a").unwrap();
    ordner::schreiben(&s.a, "karte.sync-conflict-20261115-061500-ABCDEFG.md", b"b").unwrap();
    let loesche = |pfad: &str| {
        von(Some(A), "POST", "/api/konflikt-loeschen").header("content-type", "application/json").body(Body::from(format!(r#"{{"pfad":"{pfad}","original":"karte.md"}}"#))).unwrap()
    };
    assert_eq!(schicke(&s.router, loesche("karte.md")).await.0, StatusCode::BAD_REQUEST);
    assert!(s.a.join("karte.md").exists());
    assert_eq!(schicke(&s.router, loesche("karte.sync-conflict-20261115-061500-ABCDEFG.md")).await.0, StatusCode::NO_CONTENT);
    assert!(!s.a.join("karte.sync-conflict-20261115-061500-ABCDEFG.md").exists());
}

#[tokio::test]
async fn ki_zugang_je_login_und_nur_bekannte_ziele() {
    let s = aufbau();
    let setze = von(Some(A), "PUT", "/api/ki-zugang").header("content-type", "application/json").body(Body::from(r#"{"anbieter":"anthropic"}"#)).unwrap();
    assert_eq!(schicke(&s.router, setze).await.0, StatusCode::NO_CONTENT);
    let (_, _, b) = schicke(&s.router, leer(von(Some(A), "GET", "/api/ki-zugang"))).await;
    assert_eq!(String::from_utf8(b).unwrap(), r#"{"anbieter":"anthropic"}"#);
    let (_, _, b) = schicke(&s.router, leer(von(Some(B), "GET", "/api/ki-zugang"))).await;
    assert_eq!(String::from_utf8(b).unwrap(), "null");
    // die Weiterleitung ist kein offener Proxy
    for url in ["https://evil.example/x", "http://127.0.0.1:4387/api/dateien", "https://api.openai.com.evil.example/v1"] {
        let a = von(Some(A), "POST", "/api/ki").header("content-type", "application/json").body(Body::from(format!(r#"{{"url":"{url}","rumpf":"{{}}"}}"#))).unwrap();
        assert_eq!(schicke(&s.router, a).await.0, StatusCode::FORBIDDEN, "{url}");
    }
}

#[tokio::test]
async fn zu_grosse_anfrage_wird_abgelehnt() {
    let s = aufbau();
    let a = von(Some(A), "PUT", "/api/datei?pfad=gross.pdf").body(Body::from(vec![0u8; HOECHSTENS + 1])).unwrap();
    assert_eq!(schicke(&s.router, a).await.0, StatusCode::PAYLOAD_TOO_LARGE);
    assert!(!s.a.join("gross.pdf").exists());
}

#[tokio::test]
async fn oberflaeche_mit_merkmal_und_sicherheitskoepfen() {
    let s = aufbau();
    let (st, k, b) = schicke(&s.router, leer(von(Some(A), "GET", "/"))).await;
    assert_eq!(st, StatusCode::OK);
    assert!(String::from_utf8(b).unwrap().contains(MERKMAL));
    assert!(k[header::CONTENT_SECURITY_POLICY].to_str().unwrap().contains("frame-ancestors 'none'"));
    assert_eq!(k[header::X_CONTENT_TYPE_OPTIONS], "nosniff");
    assert_eq!(k[header::CACHE_CONTROL], "no-cache");
    let (st, k, _) = schicke(&s.router, leer(von(Some(A), "GET", "/assets/app-1234.js"))).await;
    assert_eq!(st, StatusCode::OK);
    assert!(k[header::CONTENT_TYPE].to_str().unwrap().starts_with("text/javascript"));
    assert!(k[header::CACHE_CONTROL].to_str().unwrap().contains("immutable"));
    for p in ["/../a/x", "/assets/../../a", "/fehlt.js"] {
        assert_eq!(schicke(&s.router, leer(von(Some(A), "GET", p))).await.0, StatusCode::NOT_FOUND, "{p}");
    }
}

#[tokio::test]
async fn stand_nennt_plattform_und_namen() {
    let s = aufbau();
    let (_, _, b) = schicke(&s.router, leer(von(Some(A), "GET", "/api/stand").header("Tailscale-User-Name", "Alpha"))).await;
    let v: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(v["plattform"], "netz");
    assert_eq!(v["name"], "Alpha");
}

#[tokio::test]
async fn aenderung_kommt_als_ereignis() {
    use futures_util::StreamExt;
    let s = aufbau();
    let antwort = s.router.clone().oneshot(leer(von(Some(A), "GET", "/api/ereignisse"))).await.unwrap();
    assert_eq!(antwort.status(), StatusCode::OK);
    assert!(antwort.headers()[header::CONTENT_TYPE].to_str().unwrap().starts_with("text/event-stream"));
    let mut strom = antwort.into_body().into_data_stream();
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    ordner::schreiben(&s.a, "lernen/neu.md", b"x").unwrap();
    let mut gesehen = String::new();
    let frist = tokio::time::Instant::now() + std::time::Duration::from_secs(5);
    while !gesehen.contains("lernen/neu.md") && tokio::time::Instant::now() < frist {
        if let Ok(Some(Ok(teil))) = tokio::time::timeout(std::time::Duration::from_secs(1), strom.next()).await {
            gesehen.push_str(&String::from_utf8_lossy(&teil));
        }
    }
    assert!(gesehen.contains("event: geaendert"), "{gesehen}");
    assert!(gesehen.contains("lernen/neu.md"), "{gesehen}");
    // Zwischendateien melden nichts
    assert!(!gesehen.contains(".tmp"), "{gesehen}");
}

/// Gegenprobe im Browser: startet den Server mit `app/dist` und einem Ordner, bis der Prozess beendet wird.
/// `RL_NETZ_PROBE=<dist>|<ordner>|<port> cargo test netz_probe -- --ignored --nocapture`; Login beliebig, z. B. probe@test
#[tokio::test(flavor = "multi_thread")]
#[ignore]
async fn netz_probe() {
    let v = std::env::var("RL_NETZ_PROBE").expect("RL_NETZ_PROBE=<dist>|<ordner>|<port>");
    let t: Vec<&str> = v.split('|').collect();
    let n = Arc::new(Netz {
        ordner: HashMap::from([("probe@test".to_string(), PathBuf::from(t[1]))]),
        oberflaeche: aus_ordner(PathBuf::from(t[0])),
        ki_ordner: std::env::temp_dir().join("rl-netz-probe-ki"),
    });
    let l = tokio::net::TcpListener::bind(("127.0.0.1", t[2].parse::<u16>().unwrap())).await.unwrap();
    println!("lauscht auf {}", l.local_addr().unwrap());
    axum::serve(l, router(n)).await.unwrap();
}
