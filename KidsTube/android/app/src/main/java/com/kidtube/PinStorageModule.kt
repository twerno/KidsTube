package com.kidtube

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * At-rest encryption for the parent PIN record (ADR 0022).
 *
 * The PBKDF2 hash/salt/iterations are AES/GCM-encrypted with a key generated
 * inside Android Keystore. Only the ciphertext lives in private SharedPreferences;
 * the key never leaves the Keystore. A backup/rooted extraction of app storage
 * therefore does not expose the PIN hash. The plaintext PIN is never stored.
 */
class PinStorageModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val PREFS = "kidtube_secure"
    private const val ENTRY = "pin_record"
    private const val KEY_ALIAS = "kidtube_pin_v1"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val GCM_TAG_BITS = 128
  }

  override fun getName(): String = "PinStorage"

  private val prefs
    get() = reactApplicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  @ReactMethod
  fun save(json: String, promise: Promise) {
    try {
      val payload = encrypt(json)
      val stored = prefs.edit().putString(ENTRY, payload).commit()
      if (stored) {
        promise.resolve(true)
      } else {
        promise.reject("pin_storage_write", "Could not persist the encrypted PIN record")
      }
    } catch (error: Exception) {
      promise.reject("pin_storage_write", error)
    }
  }

  @ReactMethod
  fun load(promise: Promise) {
    try {
      val payload = prefs.getString(ENTRY, null)
      if (payload == null) {
        promise.resolve(null)
        return
      }
      promise.resolve(decrypt(payload))
    } catch (error: Exception) {
      // A changed/invalidated Keystore key must not brick the app: treat the
      // record as missing and let the parent set a new PIN.
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun clear(promise: Promise) {
    try {
      val cleared = prefs.edit().remove(ENTRY).commit()
      try {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        if (keyStore.containsAlias(KEY_ALIAS)) {
          keyStore.deleteEntry(KEY_ALIAS)
        }
      } catch (_: Exception) {
        // Best effort: the ciphertext is already gone.
      }
      promise.resolve(cleared)
    } catch (error: Exception) {
      promise.reject("pin_storage_clear", error)
    }
  }

  private fun secretKey(): SecretKey {
    val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val existing = keyStore.getKey(KEY_ALIAS, null)
    if (existing is SecretKey) {
      return existing
    }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(
      KeyGenParameterSpec.Builder(
        KEY_ALIAS,
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
      )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build(),
    )
    return generator.generateKey()
  }

  private fun encrypt(plain: String): String {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, secretKey())
    val iv = cipher.iv
    val ciphertext = cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
    val combined = ByteArray(1 + iv.size + ciphertext.size)
    combined[0] = iv.size.toByte()
    System.arraycopy(iv, 0, combined, 1, iv.size)
    System.arraycopy(ciphertext, 0, combined, 1 + iv.size, ciphertext.size)
    return Base64.encodeToString(combined, Base64.NO_WRAP)
  }

  private fun decrypt(payload: String): String {
    val combined = Base64.decode(payload, Base64.NO_WRAP)
    require(combined.size > 1) { "Encrypted PIN record is empty" }
    val ivSize = combined[0].toInt() and 0xFF
    require(ivSize > 0 && combined.size > 1 + ivSize) { "Encrypted PIN record is malformed" }
    val iv = combined.copyOfRange(1, 1 + ivSize)
    val ciphertext = combined.copyOfRange(1 + ivSize, combined.size)
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(GCM_TAG_BITS, iv))
    return String(cipher.doFinal(ciphertext), Charsets.UTF_8)
  }
}
