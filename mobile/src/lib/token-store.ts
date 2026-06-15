// Secure token storage for the mobile client.
//
// Prefers expo-secure-store (Keychain / Keystore). Falls back to an in-memory
// store if the native module isn't installed yet, so the app still runs in dev
// (tokens just won't persist across reloads). Install for real persistence:
//   npx expo install expo-secure-store
import { Platform } from 'react-native';

const ACCESS_KEY = 'cb_access_token';
const REFRESH_KEY = 'cb_refresh_token';

type SecureStoreModule = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

let secureStore: SecureStoreModule | null = null;
const memory = new Map<string, string>();

// Web has no SecureStore; native may not have it installed. Resolve lazily.
function getStore(): SecureStoreModule | null {
  if (secureStore) return secureStore;
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    secureStore = require('expo-secure-store') as SecureStoreModule;
    return secureStore;
  } catch {
    return null;
  }
}

async function getItem(key: string): Promise<string | null> {
  const store = getStore();
  if (store) {
    try { return await store.getItemAsync(key); } catch { /* fall through */ }
  }
  return memory.get(key) ?? null;
}

async function setItem(key: string, value: string): Promise<void> {
  const store = getStore();
  if (store) {
    try { await store.setItemAsync(key, value); return; } catch { /* fall through */ }
  }
  memory.set(key, value);
}

async function removeItem(key: string): Promise<void> {
  const store = getStore();
  if (store) {
    try { await store.deleteItemAsync(key); } catch { /* fall through */ }
  }
  memory.delete(key);
}

export const tokenStore = {
  getAccess: () => getItem(ACCESS_KEY),
  getRefresh: () => getItem(REFRESH_KEY),
  async setTokens(accessToken: string, refreshToken: string) {
    await Promise.all([setItem(ACCESS_KEY, accessToken), setItem(REFRESH_KEY, refreshToken)]);
  },
  async clear() {
    await Promise.all([removeItem(ACCESS_KEY), removeItem(REFRESH_KEY)]);
  },
};
