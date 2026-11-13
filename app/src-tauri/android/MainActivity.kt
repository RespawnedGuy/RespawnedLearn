// Wird beim Build über tools/android-anpassen.mjs nach gen/android kopiert (Paketzeile setzt das Skript).
// Die App liest und schreibt ihren Datenordner direkt im gemeinsamen Speicher, damit Syncthing ihn abgleicht.
// Dafür braucht sie wie Obsidian „Zugriff auf alle Dateien“; fehlt er, öffnet sie beim Start die passende Einstellung.
package PAKET

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !Environment.isExternalStorageManager()) {
      val wunsch = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:$packageName"))
      try {
        startActivity(wunsch)
      } catch (e: Exception) {
        startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))
      }
    }
  }
}
