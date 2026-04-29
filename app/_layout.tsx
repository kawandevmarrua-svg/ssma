import { useEffect, useRef } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { colors } from '../src/theme/colors';
import { startOfflineQueueAutoFlush } from '../src/lib/offlineQueue';
// Registra a task de localizacao em background no nivel do bundle.
// Tem que ser importado antes de qualquer chamada de Location.startLocationUpdatesAsync.
import '../src/lib/locationTask';

const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 horas em background = logout

function RootLayoutNav() {
  const { session, profile, loading, mustResetPassword, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const backgroundAtRef = useRef<number | null>(null);

  // Inactivity timeout: logout automatico apos tempo em background
  useEffect(() => {
    if (!session) return;
    function handleAppState(state: AppStateStatus) {
      if (state === 'background') {
        backgroundAtRef.current = Date.now();
      } else if (state === 'active' && backgroundAtRef.current) {
        if (Date.now() - backgroundAtRef.current > INACTIVITY_TIMEOUT_MS) {
          void signOut();
        }
        backgroundAtRef.current = null;
      }
    }
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [session, signOut]);

  useEffect(() => {
    if (loading) return;

    const segs = segments as string[];
    const inAuth = segs[0] === '(auth)';
    const inResetPassword = inAuth && segs[1] === 'reset-password';

    // Forca troca de senha antes de qualquer acesso
    if (session && profile && mustResetPassword && !inResetPassword) {
      router.replace('/(auth)/reset-password');
      return;
    }

    if (!session && !inAuth) {
      router.replace('/(auth)/splash');
    } else if (session && inAuth && profile && !mustResetPassword) {
      if (profile.role === 'operator') {
        router.replace('/(operator)');
      } else {
        router.replace('/(admin)');
      }
    }
  }, [session, profile, loading, segments, mustResetPassword]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const stop = startOfflineQueueAutoFlush();
    return stop;
  }, []);

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
