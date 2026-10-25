/** Orientation lock bridge (see OrientationModule.kt). */

import { NativeModules } from 'react-native';

interface OrientationNative {
  lockLandscape(): Promise<boolean>;
  lockPortrait(): Promise<boolean>;
  unlock(): Promise<boolean>;
}

function native(): OrientationNative | undefined {
  return (NativeModules as { Orientation?: OrientationNative }).Orientation;
}

export function lockLandscape(): void {
  native()?.lockLandscape().catch(() => undefined);
}

export function lockPortrait(): void {
  native()?.lockPortrait().catch(() => undefined);
}

export function unlockOrientation(): void {
  native()?.unlock().catch(() => undefined);
}
