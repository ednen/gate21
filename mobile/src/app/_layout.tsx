// Per-weight imports so only the weights in use are bundled, not whole families.
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { IBMPlexSansCondensed_500Medium } from '@expo-google-fonts/ibm-plex-sans-condensed/500Medium';
import { IBMPlexSansCondensed_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-condensed/600SemiBold';
import { IBMPlexSansCondensed_700Bold } from '@expo-google-fonts/ibm-plex-sans-condensed/700Bold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { createElement, type CSSProperties } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { DEMO, reloadIfOutdated } from '@/lib/demo/flag';
import { syncContent } from '@/lib/content';
import { flushProgress } from '@/lib/progress';
import { invalidateProgress, queryClient } from '@/lib/queries';
import { preloadVoices } from '@/lib/voice';
import { colors } from '@/theme';

/**
 * The browser demo on a wide screen shows the app inside a phone-sized frame. The app itself
 * runs in an iframe, so it really has a phone's width and height (dialogs included).
 */
if (DEMO && Platform.OS === 'web') {
  reloadIfOutdated();
}

const FRAMED =
  DEMO && Platform.OS === 'web' && typeof window !== 'undefined' && window.self === window.top && window.innerWidth >= 700;

export default function RootLayout() {
  return FRAMED ? <PhoneFrame /> : <App />;
}

function PhoneFrame() {
  const page: CSSProperties = {
    position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 48,
    background: '#232A31', fontFamily: 'IBMPlexSansCondensed_500Medium, system-ui, sans-serif',
  };
  const phone: CSSProperties = {
    width: 390, height: 'min(844px, calc(100vh - 48px))', borderRadius: 44, border: '10px solid #11151A',
    boxShadow: '0 30px 80px rgba(0,0,0,.5)', overflow: 'hidden', background: '#fff',
  };
  const note: CSSProperties = { color: '#AEB7C0', maxWidth: 260, fontSize: 16, lineHeight: 1.5 };
  return createElement(
    'div',
    { style: page },
    createElement('div', { style: phone }, createElement('iframe', {
      src: window.location.href,
      title: 'Gate 21',
      allow: 'microphone; autoplay',
      style: { width: '100%', height: '100%', border: 0, display: 'block' },
    })),
    createElement(
      'div',
      { style: note },
      createElement('div', { style: { color: '#FFC72C', fontWeight: 700, fontSize: 18, marginBottom: 8 } }, 'Gate 21, demo'),
      'Telefonda nasıl görünüyorsa burada da öyle. En iyi deneyim için bu linki telefonunda aç. Ses için Chrome ya da Safari kullan; mikrofon izni ister.',
    ),
  );
}

function App() {
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSansCondensed_500Medium,
    IBMPlexSansCondensed_600SemiBold,
    IBMPlexSansCondensed_700Bold,
  });
  const status = useAuth((s) => s.status);
  const bootstrap = useAuth((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
    void syncContent();
    void preloadVoices();
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
        {/* On a wide browser window the app keeps a phone-like column instead of stretching. */}
        <View style={styles.page}>
          <View style={styles.column}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
          <Stack.Screen name="home" options={{ animation: 'none' }} />
          <Stack.Screen name="passport" options={{ animation: 'none' }} />
          <Stack.Screen name="practice" options={{ animation: 'none' }} />
          <Stack.Screen name="words" options={{ animation: 'none' }} />
          <Stack.Screen name="membership" options={{ presentation: 'modal' }} />
          <Stack.Screen name="sos" options={{ animation: 'none' }} />
          <Stack.Screen name="progress" options={{ animation: 'none' }} />
          <Stack.Screen name="consent" options={{ presentation: 'modal' }} />
        </Stack>
          </View>
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#D7DBD5' },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: colors.ground,
    ...(Platform.OS === 'web' ? { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#C9CEC6' } : null),
  },
});
