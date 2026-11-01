package com.kidtube

import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Enables/disables the optional YouTube VIEW activity alias (ADR 0014).
 *
 * The alias is declared with android:enabled="false"; enabling it makes KidTube
 * a system candidate for supported YouTube links, disabling removes it again.
 * We never try to become the default handler programmatically — that choice
 * belongs to the user in system settings.
 */
class YouTubeLinkHandlerModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "YouTubeLinkHandler"

  private val componentName: ComponentName
    get() = ComponentName(
      reactApplicationContext.packageName,
      "${reactApplicationContext.packageName}.YouTubeLinkHandlerActivity",
    )

  @ReactMethod
  fun setEnabled(enabled: Boolean, promise: Promise) {
    try {
      val state =
        if (enabled) PackageManager.COMPONENT_ENABLED_STATE_ENABLED
        else PackageManager.COMPONENT_ENABLED_STATE_DISABLED
      reactApplicationContext.packageManager.setComponentEnabledSetting(
        componentName,
        state,
        PackageManager.DONT_KILL_APP,
      )
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("kidtube_link_handler", error)
    }
  }

  /** Whether KidTube currently wins the system chooser for a YouTube film link. */
  @ReactMethod
  fun isDefaultHandler(promise: Promise) {
    try {
      val intent = Intent(
        Intent.ACTION_VIEW,
        Uri.parse("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
      ).addCategory(Intent.CATEGORY_BROWSABLE)
      val resolved = reactApplicationContext.packageManager.resolveActivity(
        intent,
        PackageManager.MATCH_DEFAULT_ONLY,
      )
      promise.resolve(resolved?.activityInfo?.packageName == reactApplicationContext.packageName)
    } catch (error: Exception) {
      promise.reject("kidtube_link_handler", error)
    }
  }

  /** Open “Otwieraj domyślnie” (or app details as a fallback). */
  @ReactMethod
  fun openDefaultAppsSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        reactApplicationContext.startActivity(intent)
      } catch (notFound: ActivityNotFoundException) {
        reactApplicationContext.startActivity(
          Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:${reactApplicationContext.packageName}"),
          ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
      }
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("kidtube_link_handler", error)
    }
  }
}
