import { ClerkProvider, SignedIn, SignedOut, useAuth } from '@clerk/clerk-expo';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthScreen } from '@/components/AuthScreen';
import { clerkTokenCache } from '@/lib/clerkTokenCache';
import { StoreProvider, useStoreState } from '@/lib/store';
import { T } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey && __DEV__) {
  console.warn('[auth] EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set — see .env.example.');
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey ?? ''} tokenCache={clerkTokenCache}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Gate />
      </SafeAreaProvider>
    </ClerkProvider>
  );
}

/** Waits for Clerk to resolve a session before deciding what to render. */
function Gate() {
  const { isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [isLoaded]);

  if (!isLoaded) return null;

  return (
    <>
      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>
      <SignedOut>
        <AuthScreen />
      </SignedOut>
    </>
  );
}

/** Only mounted once signed in — useStoreState() needs a real Clerk session. */
function AuthenticatedApp() {
  const store = useStoreState();

  if (!store.ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg }}>
        <ActivityIndicator color={T.text} />
      </View>
    );
  }

  return (
    <StoreProvider value={store}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: T.bg },
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="pick"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </StoreProvider>
  );
}
