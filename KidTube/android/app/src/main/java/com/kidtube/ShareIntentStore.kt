package com.kidtube

/**
 * Holds text from the most recent ACTION_SEND intent until JS consumes it.
 * Simple and race-free for our single-activity app.
 */
object ShareIntentStore {
  @Volatile
  var pendingText: String? = null
}
