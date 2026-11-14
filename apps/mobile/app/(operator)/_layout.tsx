import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { Tabs, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "../../src/components/ui";
import { useAuth } from "../../src/contexts/AuthContext";
import { useLocationTracking } from "../../src/hooks/useLocationTracking";
import { supabase } from "../../src/lib/supabase";
import { colors, fontSize } from "../../src/theme/colors";
import { SafetyAlert } from "../../src/types/database";

const isExpoGo = Constants.executionEnvironment === "storeClient";
let Notifications: typeof import("expo-notifications") | null = null;
if (!isExpoGo) {
  Notifications = require("expo-notifications");
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

const PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

export default function OperatorLayout() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const router = useRouter();
  const tokenSaved = useRef(false);

  useLocationTracking({ operatorId: user?.id ?? null });

  // Registra push token uma vez por sessão
  useEffect(() => {
    if (!user || tokenSaved.current) return;
    setupNotificationChannel();
  }, [user]);

  // Abre tela de alertas ao tocar na notificação
  useEffect(() => {
    if (!Notifications) return;
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.push("/(operator)/alerts");
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("operator-alerts-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "safety_alerts",
        },
        (payload) => {
          const alert = payload.new as SafetyAlert;
          if (alert.operator_id !== user.id && alert.operator_id !== null)
            return;
          showLocalNotification(alert.title, alert.message, alert.severity);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "safety_alerts",
        },
        (payload) => {
          const alert = payload.new as SafetyAlert;
          if (alert.operator_id !== user.id && alert.operator_id !== null)
            return;
          if (!alert.read) {
            showLocalNotification(alert.title, alert.message, alert.severity);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function setupNotificationChannel() {
    if (!Notifications || !Device.isDevice) return;

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("safety-alerts", {
        name: "Alertas de Seguranca",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    // Salva o push token no banco para notificações remotas (app fechado)
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync(
        PROJECT_ID ? { projectId: PROJECT_ID } : undefined,
      );
      if (tokenData?.data && user) {
        await supabase.from("user_push_tokens").upsert(
          {
            user_id: user.id,
            push_token: tokenData.data,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        tokenSaved.current = true;
      }
    } catch {
      // best-effort
    }
  }

  async function showLocalNotification(
    title: string,
    message: string,
    severity: string,
  ) {
    if (!Notifications) return;

    const severityLabel: Record<string, string> = {
      low: "Baixo",
      medium: "Medio",
      high: "Alto",
      critical: "CRITICO",
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Alerta [${severityLabel[severity] || severity}]: ${title}`,
        body: message,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: Platform.OS === 'android' ? { channelId: 'safety-alerts' } : null,
    });
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "#3C3C3C",
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 76 + insets.bottom,
          paddingTop: 10,
          paddingBottom: insets.bottom + 6,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderTopWidth: 1,
          borderLeftWidth: 0,
          borderRightWidth: 0,
          borderColor: "#E5E7EB",
          backgroundColor: "#FFFFFF",
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 12,
        },
        headerStyle: {
          backgroundColor: colors.surface,
          shadowColor: "transparent",
          elevation: 0,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: fontSize.md,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={24}
                color={color}
              />
              {focused && (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#F97316",
                    marginTop: 4,
                  }}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="checklist"
        options={{
          href: profile?.role === "encarregado" ? null : undefined,
          title: "Checklist",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <Ionicons
                name={focused ? "checkbox" : "checkbox-outline"}
                size={24}
                color={color}
              />
              {focused && (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#F97316",
                    marginTop: 4,
                  }}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="atividade"
        options={{
          href: profile?.role === "encarregado" ? null : undefined,
          title: "Atividades",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <Ionicons
                name={focused ? "construct" : "construct-outline"}
                size={24}
                color={color}
              />
              {focused && (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#F97316",
                    marginTop: 4,
                  }}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alertas",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <Ionicons
                name={focused ? "warning" : "warning-outline"}
                size={24}
                color={color}
              />
              {focused && (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#F97316",
                    marginTop: 4,
                  }}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="lembretes"
        options={{
          title: "Lembretes",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <Ionicons
                name={focused ? "alarm" : "alarm-outline"}
                size={24}
                color={color}
              />
              {focused && (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#F97316",
                    marginTop: 4,
                  }}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="equipe"
        options={{
          href: profile?.role === "encarregado" ? undefined : null,
          title: "Equipe",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <Ionicons
                name={focused ? "people" : "people-outline"}
                size={24}
                color={color}
              />
              {focused && (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#F97316",
                    marginTop: 4,
                  }}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <View style={{ alignItems: "center" }}>
              <Avatar
                name={profile?.full_name || profile?.email || ""}
                size="xs"
                style={
                  focused
                    ? { borderWidth: 2, borderColor: "#F97316" }
                    : undefined
                }
              />
              {focused && (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#F97316",
                    marginTop: 4,
                  }}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="criar-lembrete"
        options={{
          href: null,
          title: "Novo lembrete",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="pre-operacao"
        options={{
          href: null,
          title: "Pre-Operacao",
        }}
      />
      <Tabs.Screen
        name="parada"
        options={{
          href: null,
          title: "Nova parada",
        }}
      />
      <Tabs.Screen
        name="selecionar-atividade"
        options={{
          href: null,
          title: "Selecionar atividade",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="servico"
        options={{
          href: null,
          title: "Nova atividade",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="auditoria"
        options={{
          href: null,
          title: "Auditoria de atividades",
        }}
      />
    </Tabs>
  );
}
