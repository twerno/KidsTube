/**
 * Bridge to the optional Android `VIEW` handler (ADR 0014).
 *
 * The manifest declares a disabled activity alias. Enabling the parent setting
 * flips the component state at runtime; disabling removes KidsTube from the
 * system's candidates again. On platforms/tests without the native module every
 * call is a safe no-op.
 */

import { NativeModules } from 'react-native';

export interface YouTubeLinkHandlerNative {
  setEnabled(enabled: boolean): Promise<boolean | void> | boolean | void;
  isDefaultHandler(): Promise<boolean> | boolean;
  openDefaultAppsSettings(): Promise<boolean | void> | boolean | void;
}

export interface YouTubeLinkHandlerBridge {
  setEnabled(enabled: boolean): Promise<void>;
  isDefaultHandler(): Promise<boolean>;
  openDefaultAppsSettings(): Promise<void>;
}

export function createYouTubeLinkHandlerBridge(
  native: YouTubeLinkHandlerNative | undefined,
): YouTubeLinkHandlerBridge {
  return {
    async setEnabled(enabled) {
      if (!native?.setEnabled) {
        return;
      }
      await native.setEnabled(enabled);
    },
    async isDefaultHandler() {
      if (!native?.isDefaultHandler) {
        return false;
      }
      try {
        return !!(await native.isDefaultHandler());
      } catch {
        return false;
      }
    },
    async openDefaultAppsSettings() {
      if (!native?.openDefaultAppsSettings) {
        return;
      }
      await native.openDefaultAppsSettings();
    },
  };
}

const bridge = createYouTubeLinkHandlerBridge(
  NativeModules.YouTubeLinkHandler as YouTubeLinkHandlerNative | undefined,
);

export function setYouTubeLinkHandlerEnabled(enabled: boolean): Promise<void> {
  return bridge.setEnabled(enabled);
}

export function isYouTubeLinkHandlerDefault(): Promise<boolean> {
  return bridge.isDefaultHandler();
}

export function openYouTubeLinkSettings(): Promise<void> {
  return bridge.openDefaultAppsSettings();
}
