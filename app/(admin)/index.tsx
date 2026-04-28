import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { supabase } from "../../src/lib/supabase";
import { colors, elevation, radius, spacing } from "../../src/theme/colors";
import { StatCard, Text } from "../../src/components/ui";

const SCREEN_HEIGHT = Dimensions.get("window").height;

const SAFETY_TIPS = [
  { icon: "shield-checkmark" as const, text: "Sempre realize a pré-operação antes de iniciar qualquer atividade." },
  { icon: "warning" as const, text: "EPIs são obrigatórios em todas as áreas operacionais." },
  { icon: "eye" as const, text: "Observe o ambiente ao redor antes de operar qualquer equipamento." },
  { icon: "hand-left" as const, text: "Na dúvida, pare! Segurança sempre em primeiro lugar." },
  { icon: "megaphone" as const, text: "Comunique qualquer condição insegura imediatamente ao seu gestor." },
  { icon: "fitness" as const, text: "Mantenha-se hidratado e faça pausas regulares durante a jornada." },
  { icon: "alert-circle" as const, text: "Verifique sinalizações e isolamentos antes de acessar áreas restritas." },
  { icon: "construct" as const, text: "Equipamento com defeito deve ser interditado e reportado." },
  { icon: "people" as const, text: "Trabalho em altura exige autorização e uso de cinto de segurança." },
  { icon: "flash" as const, text: "Desligue e bloqueie equipamentos antes de qualquer manutenção." },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [stats, setStats] = useState({
    checklistsToday: 0,
    activitiesToday: 0,
  });

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        setTipIndex((prev) => (prev + 1) % SAFETY_TIPS.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      });
    }, 6000);
    return () => clearInterval(interval);
  }, [fadeAnim]);

  const loadData = useCallback(async () => {
    if (!user) return;

    const { data: myOperators } = await supabase
      .from("operators")
      .select("id")
      .eq("created_by", user.id);

    const opIds = (myOperators ?? []).map((o) => o.id);

    if (opIds.length === 0) {
      setStats({ checklistsToday: 0, activitiesToday: 0 });
      return;
    }

    const [checklistsRes, activitiesRes] = await Promise.all([
      supabase
        .from("checklists")
        .select("id", { count: "exact", head: true })
        .in("operator_id", opIds)
        .eq("date", today),
      supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .in("operator_id", opIds)
        .eq("date", today),
    ]);

    setStats({
      checklistsToday: checklistsRes.count ?? 0,
      activitiesToday: activitiesRes.count ?? 0,
    });
  }, [user, today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Tips banner */}
      <View style={styles.tipsContainer}>
        <View style={styles.tipsHeader}>
          <View style={styles.tipBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.white} />
          </View>
          <Text variant="micro" tone="inverse">DICA DE SEGURANÇA</Text>
        </View>
        <Animated.View style={[styles.tipBody, { opacity: fadeAnim }]}>
          <Ionicons
            name={SAFETY_TIPS[tipIndex].icon}
            size={48}
            color={colors.white}
            style={{ opacity: 0.9, marginBottom: spacing.md }}
          />
          <Text variant="h2" tone="inverse" align="center" style={styles.tipText}>
            {SAFETY_TIPS[tipIndex].text}
          </Text>
        </Animated.View>
        <View style={styles.dots}>
          {SAFETY_TIPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === tipIndex && styles.dotActive]} />
          ))}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard
          icon="checkbox-outline"
          value={stats.checklistsToday}
          label="Checklists hoje"
          tone="primary"
          onPress={() => router.push("/(admin)/checklists")}
        />
        <StatCard
          icon="construct-outline"
          value={stats.activitiesToday}
          label="Atividades hoje"
          tone="neutral"
          onPress={() => router.push("/(admin)/activities")}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing["3xl"],
  },

  // Tips
  tipsContainer: {
    backgroundColor: colors.primary,
    borderRadius: radius["2xl"],
    padding: spacing.lg,
    marginBottom: spacing.lg,
    height: SCREEN_HEIGHT * 0.5,
    ...elevation.brand,
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tipBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  tipBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  tipText: { lineHeight: 30 },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.md,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
    opacity: 0.35,
  },
  dotActive: { opacity: 1, width: 18 },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
