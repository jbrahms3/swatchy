/**
 * Persists Clerk's session token across app restarts. Native only — Clerk's
 * web SDK handles its own persistence, and SecureStore doesn't exist on web.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const clerkTokenCache =
  Platform.OS === 'web'
    ? undefined
    : {
        async getToken(key: string) {
          try {
            return await SecureStore.getItemAsync(key);
          } catch {
            return null;
          }
        },
        async saveToken(key: string, value: string) {
          try {
            await SecureStore.setItemAsync(key, value);
          } catch {
            // Best effort — worst case the user re-authenticates next launch.
          }
        },
      };
