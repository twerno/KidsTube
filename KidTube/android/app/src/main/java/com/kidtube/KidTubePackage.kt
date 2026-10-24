package com.kidtube

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/** Registers the app's own native modules. */
class KidTubePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(
      ShareIntentModule(reactContext),
      YouTubeLinkHandlerModule(reactContext),
      PinCryptoModule(reactContext),
      OrientationModule(reactContext),
      BackupFileModule(reactContext),
    )

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
