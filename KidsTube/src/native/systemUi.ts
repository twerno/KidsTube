/**
 * Navigation-bar and audio-screen brightness bridge (see SystemUiModule.kt).
 *
 * The player hides the Android navigation buttons while a film runs and shows
 * them again for audio mode / after leaving. Audio mode also dims the window
 * backlight for bedtime; leaving it restores the system brightness. Every call
 * is a safe no-op on platforms and in tests without the native module.
 */

import { NativeModules } from 'react-native';

/** A dim but still readable backlight for the audio screen. */
export const AUDIO_DIM_BRIGHTNESS = 0.15;

export interface SystemUiNative {
  hideNavigation(): Promise<boolean | void> | boolean | void;
  showNavigation(): Promise<boolean | void> | boolean | void;
  setScreenBrightness?(value: number): Promise<boolean | void> | boolean | void;
  restoreScreenBrightness?(): Promise<boolean | void> | boolean | void;
  setKeepScreenOn?(enabled: boolean): Promise<boolean | void> | boolean | void;
}

export interface SystemUiBridge {
  hideNavigation(): Promise<void>;
  showNavigation(): Promise<void>;
  setScreenBrightness(value: number): Promise<void>;
  restoreScreenBrightness(): Promise<void>;
  setKeepScreenOn(enabled: boolean): Promise<void>;
}

export function createSystemUiBridge(
  native: SystemUiNative | undefined,
): SystemUiBridge {
  return {
    async hideNavigation() {
      if (!native?.hideNavigation) {
        return;
      }
      try {
        await native.hideNavigation();
      } catch {
        // Best effort: the film must keep playing even if the system refuses.
      }
    },
    async showNavigation() {
      if (!native?.showNavigation) {
        return;
      }
      try {
        await native.showNavigation();
      } catch {
        // Best effort: leaving the player must never fail on UI chrome.
      }
    },
    async setScreenBrightness(value: number) {
      if (!native?.setScreenBrightness) {
        return;
      }
      try {
        await native.setScreenBrightness(value);
      } catch {
        // Brightness is a comfort feature; playback must never depend on it.
      }
    },
    async restoreScreenBrightness() {
      if (!native?.restoreScreenBrightness) {
        return;
      }
      try {
        await native.restoreScreenBrightness();
      } catch {
        // Ignore: the system may have changed the window in the meantime.
      }
    },
    async setKeepScreenOn(enabled: boolean) {
      if (!native?.setKeepScreenOn) {
        return;
      }
      try {
        await native.setKeepScreenOn(enabled);
      } catch {
        // Best effort: playback must never depend on the screen policy.
      }
    },
  };
}

const bridge = createSystemUiBridge(
  NativeModules.SystemUi as SystemUiNative | undefined,
);

export function hideNavigation(): void {
  bridge.hideNavigation().catch(() => undefined);
}

export function showNavigation(): void {
  bridge.showNavigation().catch(() => undefined);
}

/** Dim the window backlight for the audio/bedtime screen. */
export function dimScreen(): void {
  bridge.setScreenBrightness(AUDIO_DIM_BRIGHTNESS).catch(() => undefined);
}

/** Restore the system-controlled backlight. */
export function restoreScreenBrightness(): void {
  bridge.restoreScreenBrightness().catch(() => undefined);
}

/**
 * Keep the display awake while something plays (ADR 0025). Stops holding it as
 * soon as playback stops, so the phone can lock itself on the normal timeout.
 */
export function keepScreenAwake(enabled: boolean): void {
  bridge.setKeepScreenOn(enabled).catch(() => undefined);
}
