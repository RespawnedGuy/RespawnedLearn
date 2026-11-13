// Wird beim Build über tools/android-anpassen.mjs nach gen/android kopiert (Paketzeile setzt das Skript).
// Die App liest und schreibt ihren Datenordner direkt im gemeinsamen Speicher, damit Syncthing ihn abgleicht.
// Dafür braucht sie wie Obsidian „Zugriff auf alle Dateien“. Sie fragt erst, nachdem die Ordnerwahl erklärt hat, wofür
// (Android: Erlaubnis im Zusammenhang anfragen). Die Oberfläche erreicht die beiden Funktionen unten als
// `window.RespawnedAndroid`; dazu `oeffnen` für den Download einer neuen APK (docs/aktualisieren.md). wry hängt seine eigene Brücke („ipc“) an derselben Stelle an (WryActivity.onWebViewCreate).
package PAKET

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

private const val RELEASES = "https://github.com/RespawnedGuy/RespawnedLearn/releases/download/"

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.addJavascriptInterface(Dateizugriff(), "RespawnedAndroid")
  }

  private fun hatZugriff(): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) Environment.isExternalStorageManager()
    else checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED

  private fun zugriffAnfragen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      // ab Android 11 eine Sonder-Erlaubnis: nur über die Einstellungsseite, nicht über einen Dialog
      try {
        startActivity(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:$packageName")))
      } catch (e: Exception) {
        startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))
      }
    } else {
      // Android 7 bis 10: gewöhnliche Laufzeit-Erlaubnis mit Systemdialog
      requestPermissions(arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE), 1)
    }
  }

  /** Läuft im Hintergrund-Thread der WebView: nur lesen; Anfragen gehen auf den Haupt-Thread */
  inner class Dateizugriff {
    @JavascriptInterface
    fun vorhanden(): Boolean = hatZugriff()

    @JavascriptInterface
    fun anfragen() {
      runOnUiThread { zugriffAnfragen() }
    }

    /** Nur Releases dieses Repos, im Browser; das Installieren bestätigt der Nutzer im System (Signatur muss passen) */
    @JavascriptInterface
    fun oeffnen(adresse: String) {
      if (!adresse.startsWith(RELEASES) || adresse.contains("..")) return
      runOnUiThread {
        try {
          startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(adresse)))
        } catch (e: Exception) {
          // kein Browser installiert: nichts tun statt abstürzen
        }
      }
    }
  }
}
