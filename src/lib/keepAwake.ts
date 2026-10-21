import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';

let sentinel: WakeLockSentinel | null = null;
let isAwake = false;

/**
 * Request keeping the screen awake during video playback.
 * Automatically handles native Capacitor Android and Web Screen Wake Lock API.
 */
export async function requestKeepAwake(): Promise<void> {
  if (isAwake) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await KeepAwake.keepAwake();
      isAwake = true;
    } else if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      sentinel = await navigator.wakeLock.request('screen');
      sentinel.addEventListener('release', () => {
        isAwake = false;
        sentinel = null;
      });
      isAwake = true;
    }
  } catch (err) {
    // Wake lock might be rejected on low battery or unpermitted contexts
    console.debug('KeepAwake request failed:', err);
  }
}

/**
 * Release screen keep-awake lock when playback pauses or stops.
 */
export async function releaseKeepAwake(): Promise<void> {
  if (!isAwake && !sentinel) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await KeepAwake.allowSleep();
    } else if (sentinel) {
      await sentinel.release();
      sentinel = null;
    }
  } catch (err) {
    console.debug('KeepAwake release failed:', err);
  } finally {
    isAwake = false;
  }
}
