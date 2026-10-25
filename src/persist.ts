import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// In the Android app, every saved key is mirrored to native app storage (SharedPreferences). That storage
// belongs to the app, not the WebView, and Android's automatic Google backup restores it on a new phone.
export const isNative = Capacitor.isNativePlatform();

/** On launch, copy native storage back into localStorage, which the rest of the app reads synchronously. */
export async function restore() {
  if (!isNative) return;
  const { keys } = await Preferences.keys();
  for (const key of keys) {
    const { value } = await Preferences.get({ key });
    try {
      if (value !== null) localStorage.setItem(key, value);
    } catch {
      // WebView storage unavailable: the app still runs in memory
    }
  }
}

export function persist(key: string, value: string) {
  if (isNative) void Preferences.set({ key, value });
}
