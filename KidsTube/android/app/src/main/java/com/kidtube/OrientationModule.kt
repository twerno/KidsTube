package com.kidtube

import android.content.pm.ActivityInfo
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Locks the current activity's orientation (player landscape, audio portrait). */
class OrientationModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "Orientation"

  private fun apply(requested: Int) {
    reactApplicationContext.currentActivity?.requestedOrientation = requested
  }

  @ReactMethod
  fun lockLandscape(promise: Promise) {
    // Fixed landscape: does not flip with the sensor.
    apply(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE)
    promise.resolve(true)
  }

  @ReactMethod
  fun lockPortrait(promise: Promise) {
    apply(ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT)
    promise.resolve(true)
  }

  @ReactMethod
  fun unlock(promise: Promise) {
    apply(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED)
    promise.resolve(true)
  }
}
