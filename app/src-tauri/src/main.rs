// Unter Windows ohne zusätzliches Konsolenfenster
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    respawnedlearn_lib::run()
}
