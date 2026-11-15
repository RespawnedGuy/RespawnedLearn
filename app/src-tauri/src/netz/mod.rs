//! Zugang übers Netz (docs/netz.md): Die Desktop-App kann ihre Oberfläche für andere Geräte im eigenen Tailnet anbieten,
//! etwa für ein iPhone in Safari. Einstellung und Zugriffsprüfung sind rein; der Server selbst gibt es nur am PC.

pub mod einstellung;
pub mod zugriff;

#[cfg(desktop)]
pub mod ki;
#[cfg(desktop)]
pub mod server;
