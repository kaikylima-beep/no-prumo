package expo.modules.sharereceiver

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

// Recebe um arquivo (PDF ou CSV) que outro app mandou pelo menu "Compartilhar".
// Copia o arquivo para o cache do app e entrega { uri, name, mimeType, size } ao JavaScript:
//   - getInitialShare(): o que abriu o app (uma vez só)
//   - evento "onShare": o que chegou com o app já aberto
class ShareReceiverModule : Module() {
  private var initialRead = false

  override fun definition() = ModuleDefinition {
    Name("ShareReceiver")

    Events("onShare")

    Function("getInitialShare") {
      if (initialRead) return@Function null
      initialRead = true
      val activity = appContext.currentActivity ?: return@Function null
      val intent = activity.intent ?: return@Function null
      val result = readIntent(intent)
      if (result != null) {
        // não processa o mesmo arquivo de novo se a tela for recriada
        activity.intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      }
      result
    }

    OnNewIntent { intent ->
      val result = readIntent(intent)
      if (result != null) sendEvent("onShare", result)
    }
  }

  private fun streamOf(intent: Intent): Uri? =
    when (intent.action) {
      Intent.ACTION_SEND ->
        if (Build.VERSION.SDK_INT >= 33) {
          intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
          @Suppress("DEPRECATION")
          intent.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri
        }
      Intent.ACTION_VIEW -> intent.data
      else -> null
    }

  private fun readIntent(intent: Intent): Map<String, Any?>? {
    val uri = streamOf(intent) ?: return null
    val context = appContext.reactContext ?: return null
    return try {
      val resolver = context.contentResolver
      var name = "arquivo"
      resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
        if (c.moveToFirst() && !c.isNull(0)) name = c.getString(0)
      }
      val mime = intent.type ?: resolver.getType(uri)
      val dir = File(context.cacheDir, "compartilhados").apply { mkdirs() }
      val safe = name.replace(Regex("[^A-Za-z0-9._-]"), "_")
      val out = File(dir, "${System.currentTimeMillis()}_$safe")
      val input = resolver.openInputStream(uri) ?: return mapOf("error" to "read")
      input.use { inp -> FileOutputStream(out).use { inp.copyTo(it) } }
      mapOf("uri" to Uri.fromFile(out).toString(), "name" to name, "mimeType" to mime, "size" to out.length().toDouble())
    } catch (e: Exception) {
      mapOf("error" to (e.message ?: "read"))
    }
  }
}
