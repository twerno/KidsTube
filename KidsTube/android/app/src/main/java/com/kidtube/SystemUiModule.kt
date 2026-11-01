package com.kidtube

import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Immersive film playback: hides the Android navigation bar (back / home /
 * recents) while the child watches and restores it afterwards.
 *
 * The status bar is already owned by React Native's `StatusBar`; this module
 * only touches the navigation bars, so both can be combined for a full-screen
 * player. A swipe from the edge still reveals the bars temporarily
 * (BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE), so the child is never trapped.
 */
class SystemUiModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "SystemUi"

  @ReactMethod
  fun hideNavigation(promise: Promise) {
    val controller = controller()
    if (controller == null) {
      promise.resolve(false)
      return
    }
    controller.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    controller.hide(WindowInsetsCompat.Type.navigationBars())
    promise.resolve(true)
  }

  @ReactMethod
  fun showNavigation(promise: Promise) {
    val controller = controller()
    if (controller == null) {
      promise.resolve(false)
      return
    }
    controller.show(WindowInsetsCompat.Type.navigationBars())
    promise.resolve(true)
  }

  /**
   * Audio mode (bedtime): dim the window's backlight. `value` is 0..1; the
   * system brightness is restored with `restoreScreenBrightness` when the
   * child leaves audio mode.
   */
  @ReactMethod
  fun setScreenBrightness(value: Double, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    activity.runOnUiThread {
      try {
        val params = activity.window.attributes
        params.screenBrightness = value.toFloat().coerceIn(0.05f, 1.0f)
        activity.window.attributes = params
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("brightness_failed", error)
      }
    }
  }

  @ReactMethod
  fun restoreScreenBrightness(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    activity.runOnUiThread {
      try {
        val params = activity.window.attributes
        params.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
        activity.window.attributes = params
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("brightness_failed", error)
      }
    }
  }

  /**
   * Playback keeps the display awake (ADR 0025). While a film or an audiobook
   * runs the screen must not lock — a bedtime chapter would die when the
   * display sleeps. The flag is released the moment playback stops (pause, end,
   * sleep timer, error), so afterwards the phone can lock itself on the normal
   * screen timeout; nothing keeps it awake overnight.
   *
   * Both the window flag and the decor view's `keepScreenOn` are used: the view
   * flag is the same path the embedded YouTube player uses, so clearing it also
   * cancels a wake lock the WebView may have taken for itself.
   */
  @ReactMethod
  fun setKeepScreenOn(enabled: Boolean, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    activity.runOnUiThread {
      try {
        activity.window.decorView.keepScreenOn = enabled
        if (enabled) {
          activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
          activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("keep_screen_on_failed", error)
      }
    }
  }

  private fun controller(): WindowInsetsControllerCompat? {
    val activity = reactApplicationContext.currentActivity ?: return null
    return WindowCompat.getInsetsController(activity.window, activity.window.decorView)
  }
}
