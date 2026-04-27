import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const SCREEN_HEIGHT = Dimensions.get("window").height;
import { useAuth } from "../../src/contexts/AuthContext";
import { supabase } from "../../src/lib/supabase";
import { colors, fontSize, radius, spacing } from "../../src/theme/colors";

const SAFETY_TIPS = [
  { icon: "shield-checkmark" as const, text: "Sempre realize a pre-operacao antes de iniciar qualquer atividade." },
  { icon: "warning" as const, text: "EPIs sao obrigatorios em todas as areas operacionais." },
  { icon: "eye" as const, text: "Observe o ambiente ao redor antes de operar qualquer equipamento." },
  { icon: "hand-left" as const, text: "Na duvida, pare! Seguranca sempre em primeiro lugar." },
  { icon: "megaphone" as const, text: "Comunique qualquer condicao insegura imediatamente ao seu gestor." },
  { icon: "fitness" as const, text: "Mantenha-se hidratado e faca pausas regulares durante a jornada." },
  { icon: "alert-circle" as const, text: "Verifique sinalizacoes e isolamentos antes de acessar areas restritas." },
  { icon: "construct" as const, text: "Equipamento com defeito deve ser interditado e reportado." },
  { icon: "people" as const, text: "Trabalho em altura exige autorizacao e uso de cinto de seguranca." },
  { icon: "flash" as const, text: "Desligue e bloqueie equipamentos antes de qualquer manutencao." },
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

  // Auto-rotate tips with fade animation
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setTipIndex((prev) => (prev + 1) % SAFETY_TIPS.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    }, 5000);
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
    >
      {/* Safety tips banner */}
      <View style={styles.tipsContainer}>
        <View style={styles.tipsHeader}>
          <Ionicons name="shield-checkmark" size={20} color={colors.white} />
          <Text style={styles.tipsTitle}>Dica de Seguranca</Text>
        </View>
        <Animated.View style={[styles.tipCard, { opacity: fadeAnim }]}>
          <Ionicons name={SAFETY_TIPS[tipIndex].icon} size={56} color={colors.white} style={styles.tipIcon} />
          <Text style={styles.tipText}>{SAFETY_TIPS[tipIndex].text}</Text>
        </Animated.View>
        <View style={styles.dots}>
          {SAFETY_TIPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === tipIndex && styles.dotActive]} />
          ))}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => router.push("/(admin)/checklists")}
        >
          <Ionicons name="checkbox" size={28} color={colors.primary} />
          <Text style={styles.statNumber}>{stats.checklistsToday}</Text>
          <Text style={styles.statLabel}>Checklists Hoje</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          onPress={() => router.push("/(admin)/activities")}
        >
          <Ionicons name="construct" size={28} color={colors.success} />
          <Text style={styles.statNumber}>{stats.activitiesToday}</Text>
          <Text style={styles.statLabel}>Atividades Hoje</Text>
        </TouchableOpacity>
      </View>

      {/* Acoes Rapidas */}
      <Text style={styles.sectionTitle}>Acoes Rapidas</Text>

      <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/(admin)/checklists")}>
        <View style={[styles.actionIcon, { backgroundColor: colors.primary + "20" }]}>
          <Ionicons name="clipboard" size={24} color={colors.primary} />
        </View>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Novo Checklist Pre-Uso</Text>
          <Text style={styles.actionSub}>Inspecionar equipamento antes do uso</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/(admin)/activities")}>
        <View style={[styles.actionIcon, { backgroundColor: colors.success + "20" }]}>
          <Ionicons name="add-circle" size={24} color={colors.success} />
        </View>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Registrar Atividade</Text>
          <Text style={styles.actionSub}>Iniciar nova atividade do dia</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },

  // Safety tips
  tipsContainer: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    overflow: "hidden",
    height: SCREEN_HEIGHT * 0.5,
    justifyContent: "center",
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  tipsTitle: {
    fontSize: fontSize.base,
    fontWeight: "800",
    color: colors.white,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  tipCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  tipIcon: { marginBottom: spacing.lg, opacity: 0.85 },
  tipText: {
    fontSize: fontSize.xl,
    color: colors.white,
    fontWeight: "800",
    lineHeight: 34,
    textAlign: "center",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
    opacity: 0.3,
  },
  dotActive: { opacity: 1, width: 24 },

  // Section
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, marginBottom: spacing.md, marginTop: spacing.sm },

  // Action cards
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionIcon: { width: 44, height: 44, borderRadius: radius.sm, justifyContent: "center", alignItems: "center" },
  actionText: { flex: 1, marginLeft: spacing.md },
  actionTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
  actionSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  // Stats
  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statNumber: {
    fontSize: fontSize.xl,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: "center",
  },
});
