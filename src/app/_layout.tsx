import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StoreProvider, useStoreState } from '@/lib/store';
import { T } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const store = useStoreState();

  useEffect(() => {
    if (store.ready) SplashScreen.hideAsync().catch(() => {});
  }, [store.ready]);

  if (!store.ready) return null;

  return (
    <SafeAreaProvider>
      <StoreProvider value={store}>
        <StatusBar style="light" />
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
    </SafeAreaProvider>
  );
}
