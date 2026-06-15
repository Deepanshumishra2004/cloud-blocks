// API base URL. Override per-environment with EXPO_PUBLIC_API_URL.
//   - Android emulator reaches the host machine via 10.0.2.2
//   - iOS simulator can use localhost
//   - physical device: set EXPO_PUBLIC_API_URL to your machine's LAN IP / domain
// All values include the /api/v1 prefix the backend mounts routes under.
import { Platform } from 'react-native';

const FALLBACK =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3001/api/v1'
    : 'http://localhost:3001/api/v1';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? FALLBACK;

// Identifies native clients to the backend so it returns tokens in the body
// (instead of relying on httpOnly cookies) and skips CSRF.
export const CLIENT_HEADER = { 'X-Client': 'mobile' } as const;
