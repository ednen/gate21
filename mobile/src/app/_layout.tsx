// Per-weight imports so only the 8 weights in use are bundled, not whole families.
import { BricolageGrotesque_500Medium } from '@expo-google-fonts/bricolage-grotesque/500Medium';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { syncContent } from '@/lib/content';
import { flushProgress } from '@/lib/progress';
import { invalidateProgress, queryClient } from '@/lib/queries';
import { colors } from '@/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });
  const status = useAuth((s) => s.status);
  const bootstrap = useAuth((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
    void syncContent();
  }, [bootstrap]);

  // Signed out while using the app (logout elsewhere, revoked session): back to the welcome screen.
  const previous = useRef(status);
  useEffect(() => {
    if (previous.current === 'signedIn' && status === 'signedOut') {
      router.replace('/welcome');
    }
    previous.current = status;
  }, [status]);

  // Whenever the app comes back to the foreground, send anything recorded offline.
  useEffect(() => {
    if (status !== 'signedIn') {
      return;
    }
    void flushProgress().then(invalidateProgress);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void flushProgress().then(invalidateProgress);
      }
    });
    return () => sub.remove();
  }, [status]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
          <Stack.Screen name="home" options={{ animation: 'none' }} />
          <Stack.Screen name="passport" options={{ animation: 'none' }} />
          <Stack.Screen name="sos" options={{ animation: 'none' }} />
          <Stack.Screen name="progress" options={{ animation: 'none' }} />
          <Stack.Screen name="consent" options={{ presentation: 'modal' }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
