// Wird beim Build über tools/android-anpassen.mjs nach gen/android kopiert (Paketzeile setzt das Skript).
// Die App liest und schreibt ihren Datenordner direkt im gemeinsamen Speicher, damit Syncthing ihn abgleicht.
// Dafür braucht sie wie Obsidian „Zugriff auf alle Dateien“. Sie fragt erst, nachdem die Ordnerwahl erklärt hat, wofür
// (Android: Erlaubnis im Zusammenhang anfragen). Die Oberfläche erreicht die beiden Funktionen unten als
// `window.RespawnedAndroid`; dazu `oeffnen` für den Download einer neuen APK (docs/aktualisieren.md) und `ordnerWaehlen`
// (Ordnerauswahl des Systems, liefert einen echten Pfad im Gerätespeicher; seit v0.21.0). wry hängt seine eigene Brücke („ipc“) an derselben Stelle an (WryActivity.onWebViewCreate).
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
import android.provider.DocumentsContract
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import org.json.JSONObject

private const val RELEASES = "https://github.com/RespawnedGuy/RespawnedLearn/releases/download/"

private const val SPEICHER_ANBIETER = "com.android.externalstorage.documents"
private const val GERAETESPEICHER = "/storage/emulated/0"

/**
 * Macht aus der Wahl in der Ordnerauswahl (Storage Access Framework) einen echten Pfad. Die App liest und schreibt
 * über echte Pfade („Zugriff auf alle Dateien“), weil Syncthing einen gewöhnlichen Ordner braucht und atomares
 * Umbenennen über SAF nicht garantiert ist. Nur der interne Gerätespeicher (Kennung „primary:…“), keine SD-Karte
 * und keine Cloud-Anbieter: Für die gibt es keinen Pfad, den Rust prüfen könnte (ordnerwahl.rs).
 */
internal fun baumPfad(anbieter: String?, kennung: String?): String? {
  if (anbieter != SPEICHER_ANBIETER || kennung == null || !kennung.startsWith("primary:")) return null
  val rest = kennung.removePrefix("primary:").trim('/')
  return if (rest.isEmpty()) null else "$GERAETESPEICHER/$rest"
}

class MainActivity : TauriActivity() {
  private var webAnsicht: WebView? = null

  /** Ergebnis der Ordnerauswahl als Ereignis `respawned-ordner` an die Oberfläche (oberflaeche/daten/android.ts) */
  private val ordnerWahl = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
    val antwort = JSONObject()
    if (uri == null) {
      antwort.put("abgebrochen", true)
    } else {
      val pfad = try {
        baumPfad(uri.authority, DocumentsContract.getTreeDocumentId(uri))
      } catch (e: Exception) {
        null
      }
      if (pfad != null) antwort.put("pfad", pfad) else antwort.put("fehler", "nur-geraetespeicher")
    }
    webAnsicht?.evaluateJavascript("window.dispatchEvent(new CustomEvent('respawned-ordner',{detail:$antwort}))", null)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webAnsicht = webView
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

    /** Öffnet die Ordnerauswahl des Systems; das Ergebnis kommt als Ereignis `respawned-ordner` zurück */
    @JavascriptInterface
    fun ordnerWaehlen() {
      runOnUiThread {
        try {
          ordnerWahl.launch(null)
        } catch (e: Exception) {
          webAnsicht?.evaluateJavascript("window.dispatchEvent(new CustomEvent('respawned-ordner',{detail:{fehler:'keine-auswahl'}}))", null)
        }
      }
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
