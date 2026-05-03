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
import { Avatar } from '../../src/components/ui';

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
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.5,
          marginBottom: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
        tabBarStyle: {
          height: 70 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 6,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderTopWidth: 1,
          borderLeftWidth: 0,
          borderRightWidth: 0,
          borderColor: '#E5E7EB',
          backgroundColor: '#FFFFFF',
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 12,
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
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="checklist"
        options={{
          title: 'Checklist',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'checkbox' : 'checkbox-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="atividade"
        options={{
          title: 'Atividades',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'construct' : 'construct-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alertas',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'warning' : 'warning-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <Avatar
              name={profile?.full_name || profile?.email || ''}
              size="xs"
              style={focused ? { borderWidth: 2, borderColor: colors.primary } : undefined}
            />
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
      <Tabs.Screen
        name="parada"
        options={{
          href: null,
          title: 'Nova parada',
        }}
      />
      <Tabs.Screen
        name="selecionar-atividade"
        options={{
          href: null,
          title: 'Selecionar atividade',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="servico"
        options={{
          href: null,
          title: 'Nova atividade',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="auditoria"
        options={{
          href: null,
          title: 'Auditoria de atividades',
        }}
      />
    </Tabs>
  );
}
