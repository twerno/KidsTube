/**
 * Bridge to the Android share/VIEW intents.
 *
 * - Shared text arrives through the small native `ShareIntent` module (see
 *   android/app/src/main/java/com/kidtube).
 * - Plain links arrive through React Native's Linking (ACTION_VIEW).
 */

import { AppState, Linking, NativeModules } from 'react-native';

interface ShareIntentNative {
  consumeShare(): Promise<string | null | undefined>;
}

/** Read and clear any pending ACTION_SEND text. */
export async function consumeSharedText(): Promise<string | undefined> {
  const native = NativeModules.ShareIntent as ShareIntentNative | undefined;
  if (!native?.consumeShare) {
    return undefined;
  }
  try {
    const text = await native.consumeShare();
    if (typeof text === 'string' && text.trim()) {
      return text.trim();
    }
  } catch {
    // Ignore and fall through.
  }
  return undefined;
}

/** The URL that launched the app, if any. */
export async function getInitialLink(): Promise<string | undefined> {
  try {
    const url = await Linking.getInitialURL();
    return url ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Subscribe to links arriving while the app runs: both new VIEW intents and
 * shares that bring the app back to the foreground. The two origins are kept
 * separate because the optional VIEW handler can be disabled (ADR 0014).
 */
export function subscribeLinks(
  onShare: (raw: string) => void,
  onView: (url: string) => void,
): () => void {
  const urlSubscription = Linking.addEventListener('url', event => {
    if (event.url) {
      onView(event.url);
    }
  });

  const appStateSubscription = AppState.addEventListener('change', state => {
    if (state === 'active') {
      consumeSharedText().then(raw => {
        if (raw) {
          onShare(raw);
        }
      });
    }
  });

  return () => {
    urlSubscription.remove();
    appStateSubscription.remove();
  };
}
