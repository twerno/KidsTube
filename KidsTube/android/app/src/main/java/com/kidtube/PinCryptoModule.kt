package com.kidstube

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * Native PBKDF2-HMAC-SHA256. Pure-JS PBKDF2 is far too slow on Hermes for a
 * sane iteration count, so the PIN derivation runs in the platform crypto.
 */
class PinCryptoModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "PinCrypto"

  @ReactMethod
  fun pbkdf2(password: String, saltHex: String, iterations: Int, keyLength: Int, promise: Promise) {
    try {
      val salt = hexToBytes(saltHex)
      val spec = PBEKeySpec(password.toCharArray(), salt, iterations, keyLength * 8)
      val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
      val hash = factory.generateSecret(spec).encoded
      promise.resolve(bytesToHex(hash))
    } catch (error: Exception) {
      promise.reject("PBKDF2_ERROR", error)
    }
  }

  @ReactMethod
  fun randomBytes(length: Int, promise: Promise) {
    try {
      val bytes = ByteArray(length)
      java.security.SecureRandom().nextBytes(bytes)
      promise.resolve(bytesToHex(bytes))
    } catch (error: Exception) {
      promise.reject("RANDOM_ERROR", error)
    }
  }

  private fun hexToBytes(hex: String): ByteArray {
    val clean = hex.trim()
    require(clean.length % 2 == 0) { "Hex string must have an even length" }
    return ByteArray(clean.length / 2) { index ->
      clean.substring(index * 2, index * 2 + 2).toInt(16).toByte()
    }
  }

  private fun bytesToHex(bytes: ByteArray): String {
    val builder = StringBuilder(bytes.size * 2)
    for (byte in bytes) {
      builder.append(String.format("%02x", byte.toInt() and 0xFF))
    }
    return builder.toString()
  }
}
