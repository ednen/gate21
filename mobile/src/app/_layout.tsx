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
import { createElement, type CSSProperties } from 'react';
import { AppState, Platform } from 'react-native';
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
    background: '#14171C', fontFamily: 'system-ui, sans-serif',
  };
  const phone: CSSProperties = {
    width: 390, height: 'min(844px, calc(100vh - 48px))', borderRadius: 48, border: '12px solid #2A2F37',
    boxShadow: '0 30px 80px rgba(0,0,0,.5)', overflow: 'hidden', background: '#fff',
  };
  const note: CSSProperties = { color: '#C9CED6', maxWidth: 260, fontSize: 15, lineHeight: 1.5 };
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
      createElement('div', { style: { color: '#FFC629', fontWeight: 700, letterSpacing: 2, fontSize: 12, marginBottom: 8 } }, 'GATE 21 · DEMO'),
      'Telefonda nasıl görünüyorsa burada da öyle. En iyi deneyim için bu linki telefonunda aç. Ses için Chrome ya da Safari kullan; mikrofon izni ister.',
    ),
  );
}

function App() {
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
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
