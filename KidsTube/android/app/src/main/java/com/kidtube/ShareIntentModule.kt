package com.kidstube

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Exposes shared text to JavaScript and clears it once read. */
class ShareIntentModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ShareIntent"

  @ReactMethod
  fun consumeShare(promise: Promise) {
    val text = ShareIntentStore.pendingText
    ShareIntentStore.pendingText = null
    promise.resolve(text)
  }
}
