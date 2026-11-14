// Wird beim Build über tools/android-anpassen.mjs nach gen/android kopiert (Paketzeile setzt das Skript).
// Die App liest und schreibt ihren Datenordner direkt im gemeinsamen Speicher, damit Syncthing ihn abgleicht.
// Dafür braucht sie wie Obsidian „Zugriff auf alle Dateien“. Sie fragt erst, nachdem die Ordnerwahl erklärt hat, wofür
// (Android: Erlaubnis im Zusammenhang anfragen). Die Oberfläche erreicht die beiden Funktionen unten als
// `window.RespawnedAndroid`; dazu `oeffnen` für den Download einer neuen APK (docs/aktualisieren.md) und `ordnerWaehlen`
// (Ordnerauswahl des Systems, liefert einen echten Pfad im Gerätespeicher; seit v0.21.0), seit v0.22.0 „Nicht stören“
// während der Pomodoro-Lernzeit (`stille…`, Objekt `Stille` und Empfänger `StilleEnde` unten). wry hängt seine eigene Brücke („ipc“) an derselben Stelle an (WryActivity.onWebViewCreate).
package PAKET

import android.Manifest
import android.app.AlarmManager
import android.app.AutomaticZenRule
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.provider.DocumentsContract
import android.service.notification.Condition
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.annotation.RequiresApi
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

private const val STILLE_KENNUNG = "respawnedlearn://lernzeit"
private const val STILLE_ABLAGE = "stille"

/**
 * „Nicht stören“ während der Lernzeit. Ab Android 15 dürfen Apps den Modus des Geräts nicht mehr selbst umschalten,
 * nur eine eigene Regel beitragen, die das System mit den Regeln anderer zusammenführt (AutomaticZenRule). Darum
 * schon ab Android 10 nur dieser Weg: eine Regel „Lernzeit“, die die App an- und ausschaltet. Dafür braucht sie den
 * „Zugriff auf Nicht stören“, den der Nutzer in den Systemeinstellungen erteilt. Damit das Gerät nie im Modus hängen
 * bleibt, schaltet ein Wecker des Systems die Regel zur Endzeit ab, auch wenn die App schläft; die Oberfläche räumt
 * beim Start zusätzlich auf (app/src/pomodoroStand.ts).
 */
internal object Stille {
  fun moeglich(): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q

  private fun nm(ctx: Context): NotificationManager = ctx.getSystemService(NotificationManager::class.java)

  fun erlaubt(ctx: Context): Boolean = moeglich() && nm(ctx).isNotificationPolicyAccessGranted

  private fun bedingung(zustand: Int) = Condition(Uri.parse(STILLE_KENNUNG), "Lernzeit", zustand)

  /** Vorhandene eigene Regel oder eine neue; ihre Kennung merkt sich die App */
  @RequiresApi(Build.VERSION_CODES.Q)
  private fun regel(ctx: Context): String {
    val ablage = ctx.getSharedPreferences(STILLE_ABLAGE, Context.MODE_PRIVATE)
    val alt = ablage.getString("regel", null)
    if (alt != null && nm(ctx).getAutomaticZenRule(alt) != null) return alt
    val neu = nm(ctx).addAutomaticZenRule(
      AutomaticZenRule(
        "Lernzeit",
        null,
        ComponentName(ctx, MainActivity::class.java),
        Uri.parse(STILLE_KENNUNG),
        null,
        NotificationManager.INTERRUPTION_FILTER_PRIORITY,
        true
      )
    )
    ablage.edit().putString("regel", neu).apply()
    return neu
  }

  private fun wecker(ctx: Context): PendingIntent =
    PendingIntent.getBroadcast(ctx, 0, Intent(ctx, StilleEnde::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

  /** An bis `ende` (Millisekunden seit 1970); false, wenn es nicht geht (kein Zugriff, zu altes Android, Ende vorbei) */
  fun an(ctx: Context, ende: Long): Boolean {
    // Abfrage der Version hier ausgeschrieben, damit Android-Lint sie sieht (NewApi)
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || !erlaubt(ctx) || ende <= System.currentTimeMillis()) return false
    return try {
      nm(ctx).setAutomaticZenRuleState(regel(ctx), bedingung(Condition.STATE_TRUE))
      // Ohne Erlaubnis für genaue Wecker: Android darf ihn im Tiefschlaf etwas später auslösen, das genügt hier
      ctx.getSystemService(AlarmManager::class.java).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ende, wecker(ctx))
      true
    } catch (e: Exception) {
      false
    }
  }

  fun aus(ctx: Context) {
    try {
      ctx.getSystemService(AlarmManager::class.java).cancel(wecker(ctx))
    } catch (e: Exception) {
      // kein Wecker gestellt
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || !erlaubt(ctx)) return
    try {
      val id = ctx.getSharedPreferences(STILLE_ABLAGE, Context.MODE_PRIVATE).getString("regel", null) ?: return
      if (nm(ctx).getAutomaticZenRule(id) != null) nm(ctx).setAutomaticZenRuleState(id, bedingung(Condition.STATE_FALSE))
    } catch (e: Exception) {
      // Zugriff inzwischen entzogen: dann hat das System die Regel ohnehin entfernt
    }
  }
}

/** Wecker zur Endzeit der Lernzeit: schaltet „Nicht stören“ ab, auch wenn die App im Hintergrund schläft */
class StilleEnde : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    Stille.aus(context)
  }
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

    /** „Nicht stören“ während der Lernzeit: ab Android 10, mit Zugriff aus den Systemeinstellungen */
    @JavascriptInterface
    fun stilleMoeglich(): Boolean = Stille.moeglich()

    @JavascriptInterface
    fun stilleErlaubt(): Boolean = Stille.erlaubt(this@MainActivity)

    /** Öffnet die Seite „Zugriff auf Nicht stören“; der Nutzer schaltet die App dort frei */
    @JavascriptInterface
    fun stilleAnfragen() {
      runOnUiThread {
        try {
          startActivity(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
        } catch (e: Exception) {
          // Seite fehlt auf manchen Geräten: nichts tun statt abstürzen
        }
      }
    }

    /** Zahlen aus JavaScript kommen als Double an */
    @JavascriptInterface
    fun stilleAn(ende: Double): Boolean = Stille.an(this@MainActivity, ende.toLong())

    @JavascriptInterface
    fun stilleAus() {
      Stille.aus(this@MainActivity)
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
