package com.kidtube

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.IOException

/**
 * Storage Access Framework bridge for database backups (ADR 0017).
 *
 * Export uses ACTION_CREATE_DOCUMENT and import ACTION_OPEN_DOCUMENT, so the
 * parent picks the file location themselves. No storage permission is needed and
 * nothing leaves the device without that choice.
 */
class BackupFileModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var pending: Promise? = null
  private var pendingContent = ""

  private val listener = object : BaseActivityEventListener() {
    override fun onActivityResult(
      activity: Activity,
      requestCode: Int,
      resultCode: Int,
      data: Intent?,
    ) {
      if (requestCode != REQUEST_SAVE && requestCode != REQUEST_OPEN) {
        return
      }
      val promise = pending ?: return
      pending = null
      val uri = data?.data
      if (resultCode != Activity.RESULT_OK || uri == null) {
        pendingContent = ""
        promise.resolve(null)
        return
      }
      try {
        when (requestCode) {
          REQUEST_SAVE -> {
            val resolver = reactApplicationContext.contentResolver
            resolver.openOutputStream(uri, "wt")?.use { output ->
              output.write(pendingContent.toByteArray(Charsets.UTF_8))
            } ?: throw IOException("Brak strumienia zapisu")
            promise.resolve(uri.toString())
          }

          else -> {
            val resolver = reactApplicationContext.contentResolver
            val text = resolver.openInputStream(uri)?.bufferedReader(Charsets.UTF_8)?.use {
              it.readText()
            } ?: throw IOException("Brak strumienia odczytu")
            val result = Arguments.createMap()
            result.putString("content", text)
            result.putString("name", displayName(uri))
            promise.resolve(result)
          }
        }
      } catch (error: Exception) {
        promise.reject("kidtube_backup", error)
      } finally {
        pendingContent = ""
      }
    }
  }

  init {
    reactApplicationContext.addActivityEventListener(listener)
  }

  override fun getName(): String = "KidTubeBackup"

  /** Ask for a destination and write the JSON document there. */
  @ReactMethod
  fun saveJson(fileName: String, content: String, promise: Promise) {
    if (pending != null) {
      promise.reject("kidtube_backup", "Inna operacja na plikach już trwa")
      return
    }
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("kidtube_backup", "Brak aktywnego ekranu")
      return
    }
    pending = promise
    pendingContent = content
    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "application/json"
      putExtra(Intent.EXTRA_TITLE, fileName)
    }
    try {
      activity.startActivityForResult(intent, REQUEST_SAVE)
    } catch (error: Exception) {
      pending = null
      pendingContent = ""
      promise.reject("kidtube_backup", error)
    }
  }

  /** Ask for a JSON file and return its whole content. */
  @ReactMethod
  fun openJson(promise: Promise) {
    if (pending != null) {
      promise.reject("kidtube_backup", "Operacja już trwa")
      return
    }
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("kidtube_backup", "Brak aktywności")
      return
    }
    pending = promise
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "*/*"
      putExtra(
        Intent.EXTRA_MIME_TYPES,
        arrayOf("application/json", "text/plain", "application/octet-stream"),
      )
    }
    try {
      activity.startActivityForResult(intent, REQUEST_OPEN)
    } catch (error: Exception) {
      pending = null
      promise.reject("kidtube_backup", error)
    }
  }

  private fun displayName(uri: Uri): String? {
    return try {
      reactApplicationContext.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
        val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (index >= 0 && cursor.moveToFirst()) cursor.getString(index) else null
      }
    } catch (_: Exception) {
      null
    }
  }

  private companion object {
    const val REQUEST_SAVE = 4711
    const val REQUEST_OPEN = 4712
  }
}
