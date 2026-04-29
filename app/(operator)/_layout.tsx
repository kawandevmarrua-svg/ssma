import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { SafetyAlert } from '../../src/types/database';
import { colors } from '../../src/theme/colors';
import { useLocationTracking } from '../../src/hooks/useLocationTracking';

const isExpoGo = Constants.appOwnership === 'expo';
let Notifications: typeof import('expo-notifications') | null = null;
if (!isExpoGo) {
  Notifications = require('expo-notifications');
}

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export default function OperatorLayout() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  useLocationTracking({ operatorId: user?.id ?? null });

  useEffect(() => {
    setupNotificationChannel();
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('operator-alerts-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'safety_alerts',
      }, (payload) => {
        const alert = payload.new as SafetyAlert;
        if (alert.operator_id !== user.id && alert.operator_id !== null) return;
        showLocalNotification(alert.title, alert.message, alert.severity);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'safety_alerts',
      }, (payload) => {
        const alert = payload.new as SafetyAlert;
        if (alert.operator_id !== user.id && alert.operator_id !== null) return;
        if (!alert.read) {
          showLocalNotification(alert.title, alert.message, alert.severity);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function setupNotificationChannel() {
    if (!Notifications || !Device.isDevice) return;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('safety-alerts', {
        name: 'Alertas de Seguranca',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
  }

  async function showLocalNotification(title: string, message: string, severity: string) {
    if (!Notifications) return;

    const severityLabel: Record<string, string> = {
      low: 'Baixo', medium: 'Medio', high: 'Alto', critical: 'CRITICO',
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Alerta [${severityLabel[severity] || severity}]: ${title}`,
        body: message,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: colors.surface,
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 17,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="checklist"
        options={{
          title: 'Checklist',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkbox" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="atividade"
        options={{
          title: 'Atividades',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="construct" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alertas',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="warning" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pre-operacao"
        options={{
          href: null,
          title: 'Pre-Operacao',
        }}
      />
    </Tabs>
  );
}
