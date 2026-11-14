import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { useCallback, useState } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import {
  Alert as RNAlert,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../src/components/ui";
import { useAuth } from "../../src/contexts/AuthContext";
import { supabase } from "../../src/lib/supabase";
import { colors, radius, spacing, fontSize } from "../../src/theme/colors";

const isExpoGo = Constants.appOwnership === "expo";
let Notifications: typeof import("expo-notifications") | null = null;
if (!isExpoGo) {
  Notifications = require("expo-notifications");
}

const ACCENT = colors.primary;
const TECH_BG = "#FFFFFF";
const TECH_BG_SOFT = "#F8FAFC";
const TECH_BORDER = "#E5E7EB";
const TECH_TEXT = "#0F172A";
const TECH_TEXT_MUTED = "#64748B";

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Recurrence = "daily" | "weekly" | "once";

interface Reminder {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  reminder_time: string;
  recurrence: Recurrence;
  days_of_week: number[] | null;
  specific_date: string | null;
  is_active: boolean;
  notification_ids: string[] | null;
  created_at: string;
}

function parseTime(str: string): { hour: number; minute: number } | null {
  const m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { hour: h, minute: min };
}

function formatRecurrence(r: Reminder): string {
  if (r.recurrence === "daily") return "Todo dia";
  if (r.recurrence === "once") {
    if (r.specific_date) {
      const [y, mo, d] = r.specific_date.split("-");
      return `${d}/${mo}/${y}`;
    }
    return "Uma vez";
  }
  if (r.recurrence === "weekly") {
    const days = (r.days_of_week ?? [])
      .sort((a, b) => a - b)
      .map((d) => DAYS_PT[d])
      .join(", ");
    return days || "Semanal";
  }
  return "";
}

async function setupReminderChannel() {
  if (!Notifications || !Device.isDevice) return;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    const { status: asked } = await Notifications.requestPermissionsAsync();
    status = asked;
  }
  if (status !== "granted") return;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Lembretes",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

async function scheduleNotifications(
  reminder: Pick<
    Reminder,
    "title" | "description" | "reminder_time" | "recurrence" | "days_of_week" | "specific_date"
  >
): Promise<string[]> {
  if (!Notifications || !Device.isDevice) return [];
  const parsed = parseTime(reminder.reminder_time);
  if (!parsed) return [];
  const { hour, minute } = parsed;
  const ids: string[] = [];

  try {
    if (reminder.recurrence === "daily") {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `⏰ ${reminder.title}`,
          body: reminder.description ?? "Hora do seu lembrete!",
          sound: true,
        },
        trigger: Platform.OS === "android"
          ? { channelId: "reminders", hour, minute, repeats: true } as any
          : { hour, minute, repeats: true } as any,
      });
      ids.push(id);
    } else if (reminder.recurrence === "weekly" && reminder.days_of_week) {
      for (const day of reminder.days_of_week) {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: `⏰ ${reminder.title}`,
            body: reminder.description ?? "Hora do seu lembrete!",
            sound: true,
          },
          trigger: Platform.OS === "android"
            ? { channelId: "reminders", weekday: day + 1, hour, minute, repeats: true } as any
            : { weekday: day + 1, hour, minute, repeats: true } as any,
        });
        ids.push(id);
      }
    } else if (reminder.recurrence === "once" && reminder.specific_date) {
      const [y, mo, d] = reminder.specific_date.split("-").map(Number);
      const date = new Date(y, mo - 1, d, hour, minute, 0);
      if (date > new Date()) {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: `⏰ ${reminder.title}`,
            body: reminder.description ?? "Hora do seu lembrete!",
            sound: true,
          },
          trigger: { date } as any,
        });
        ids.push(id);
      }
    }
  } catch (e) {
    console.log("[Lembretes] falha ao agendar notificacao:", e);
  }

  return ids;
}

async function cancelNotifications(ids: string[] | null) {
  if (!Notifications || !ids) return;
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch { /* ignore */ }
  }
}

export default function LembretesScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadReminders = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("reminders")
      .select("*")
      .eq("user_id", user.id)
      .order("reminder_time", { ascending: true });
    if (error) RNAlert.alert("Erro", "Falha ao carregar lembretes.");
    setReminders((data ?? []) as Reminder[]);
    setLoading(false);
  }, [user]);

  async function handleDelete(item: Reminder) {
    RNAlert.alert(
      "Remover lembrete",
      `Remover "${item.title}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            await cancelNotifications(item.notification_ids);
            await supabase.from("reminders").delete().eq("id", item.id);
            loadReminders();
          },
        },
      ]
    );
  }

  async function handleToggle(item: Reminder) {
    const newActive = !item.is_active;
    await cancelNotifications(item.notification_ids);
    let newNotifIds: string[] | null = null;

    if (newActive) {
      await setupReminderChannel();
      const ids = await scheduleNotifications({
        title: item.title,
        description: item.description,
        reminder_time: item.reminder_time,
        recurrence: item.recurrence,
        days_of_week: item.days_of_week,
        specific_date: item.specific_date,
      });
      newNotifIds = ids.length > 0 ? ids : null;
    }

    await supabase.from("reminders")
      .update({ is_active: newActive, notification_ids: newNotifIds })
      .eq("id", item.id);
    loadReminders();
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadReminders();
    setRefreshing(false);
  }

  function renderReminder({ item }: { item: Reminder }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <View style={[styles.timeBadge, !item.is_active && styles.timeBadgeInactive]}>
            <Text style={[styles.timeText, !item.is_active && styles.timeTextInactive]}>
              {item.reminder_time}
            </Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, !item.is_active && { color: TECH_TEXT_MUTED }]}>
            {item.title}
          </Text>
          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}
          <View style={styles.cardMeta}>
            <Ionicons
              name="repeat-outline"
              size={11}
              color={item.is_active ? ACCENT : TECH_TEXT_MUTED}
            />
            <Text style={[styles.cardMetaText, { color: item.is_active ? ACCENT : TECH_TEXT_MUTED }]}>
              {formatRecurrence(item)}
            </Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <Switch
            value={item.is_active}
            onValueChange={() => handleToggle(item)}
            trackColor={{ false: TECH_BORDER, true: ACCENT + "80" }}
            thumbColor={item.is_active ? ACCENT : "#9CA3AF"}
            style={{ transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] }}
          />
          <Pressable
            onPress={() => handleDelete(item)}
            hitSlop={8}
            style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, marginTop: 2 }]}
          >
            <Ionicons name="trash-outline" size={17} color="#EF4444" />
          </Pressable>
        </View>
      </View>
    );
  }

  const router = useRouter();
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadReminders();
      if (!user) return;
      let cancelled = false;
      (async () => {
        const { count } = await supabase
          .from('safety_alerts')
          .select('id', { count: 'exact', head: true })
          .or(`operator_id.eq.${user.id},operator_id.is.null`)
          .eq('read', false);
        if (!cancelled) setUnreadAlerts(count ?? 0);
      })();
      return () => { cancelled = true; };
    }, [user, loadReminders]),
  );

  const activeCount = reminders.filter((r) => r.is_active).length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.brandRow}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>MARRUÁ</Text>
        </View>
        <Pressable
          onPress={() => router.push('/(operator)/alerts')}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.8 }]}
          hitSlop={8}
        >
          <Ionicons name="notifications-outline" size={20} color={TECH_TEXT} />
          {unreadAlerts > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadAlerts > 9 ? '9+' : unreadAlerts}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.titleRow}>
        <View style={[styles.titleDot, { backgroundColor: ACCENT }]} />
        <Text style={styles.screenTitle}>Lembretes</Text>
        <Text style={styles.screenCount}>
          {activeCount} ativo{activeCount !== 1 ? "s" : ""}
        </Text>
      </View>

      <FlatList
        data={reminders}
        keyExtractor={(item) => item.id}
        renderItem={renderReminder}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="alarm-outline" size={28} color={TECH_TEXT_MUTED} />
              </View>
              <Text style={styles.emptyTitle}>Nenhum lembrete</Text>
              <Text style={styles.emptyMessage}>
                Toque em + para criar um lembrete de remédio ou compromisso.
              </Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(operator)/criar-lembrete')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TECH_BG },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: TECH_BORDER,
    backgroundColor: TECH_BG,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandLogo: { width: 28, height: 28, borderRadius: 6 },
  brandName: { fontSize: fontSize.base, fontWeight: "800", letterSpacing: 2, color: TECH_TEXT },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: TECH_BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TECH_BG,
    position: "relative",
  },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontSize: fontSize['2xs'],
    fontWeight: "800",
    color: "#fff",
  },
  fab: {
    position: "absolute",
    bottom: spacing.lg,
    right: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  titleDot: { width: 8, height: 8, borderRadius: 4 },
  screenTitle: { fontSize: fontSize.lg, fontWeight: "800", color: TECH_TEXT, flex: 1 },
  screenCount: { fontSize: fontSize.xs, fontWeight: "600", color: TECH_TEXT_MUTED },

  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["3xl"],
    paddingTop: spacing.sm,
  },

  card: {
    backgroundColor: TECH_BG,
    borderRadius: 13,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: TECH_BORDER,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLeft: { alignItems: "center" },
  timeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: ACCENT + "18",
    alignItems: "center",
    minWidth: 58,
  },
  timeBadgeInactive: { backgroundColor: TECH_BG_SOFT },
  timeText: { fontSize: fontSize.base, fontWeight: "800", color: ACCENT, letterSpacing: 0.5 },
  timeTextInactive: { color: TECH_TEXT_MUTED },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { fontSize: fontSize.sm, fontWeight: "700", color: TECH_TEXT, lineHeight: 19 },
  cardDesc: { fontSize: fontSize.xs, color: TECH_TEXT_MUTED, lineHeight: 17 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  cardMetaText: { fontSize: fontSize.xs, fontWeight: "600" },
  cardActions: { alignItems: "center", gap: 6 },

  empty: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: TECH_BG_SOFT,
    borderWidth: 1,
    borderColor: TECH_BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.base,
    fontWeight: "800",
    color: TECH_TEXT,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  emptyMessage: {
    fontSize: fontSize.sm,
    color: TECH_TEXT_MUTED,
    textAlign: "center",
    lineHeight: 20,
  },

});
