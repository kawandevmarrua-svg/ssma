import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, Text } from "../../src/components/ui";
import { useAuth } from "../../src/contexts/AuthContext";
import { useFormValidation } from "../../src/hooks/useFormValidation";
import { supabase } from "../../src/lib/supabase";
import { alertResponseSchema } from "../../src/schemas";
import { colors, radius, spacing } from "../../src/theme/colors";
import { SafetyAlert } from "../../src/types/database";

type AlertWithCreator = SafetyAlert & {
  creator?: { full_name: string | null; email: string } | null;
};

const TECH_BG = "#FFFFFF";
const TECH_BG_SOFT = "#F8FAFC";
const TECH_BORDER = "#E5E7EB";
const TECH_TEXT = "#0F172A";
const TECH_TEXT_MUTED = "#64748B";

type SeverityKey = "low" | "medium" | "high" | "critical";

const SEVERITY_CONFIG: Record<
  SeverityKey,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    accent: string;
    surface: string;
  }
> = {
  low: {
    label: "Baixo",
    icon: "information-circle-outline",
    accent: "#3B82F6",
    surface: "#EFF6FF",
  },
  medium: {
    label: "Médio",
    icon: "alert-circle-outline",
    accent: "#F59E0B",
    surface: "#FFFBEB",
  },
  high: {
    label: "Alto",
    icon: "warning-outline",
    accent: colors.primary,
    surface: colors.primarySurface,
  },
  critical: {
    label: "Crítico",
    icon: "alert-outline",
    accent: "#DC2626",
    surface: "#FEF2F2",
  },
};

type Filter = "all" | "unread";

function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

type OperatorOption = { id: string; full_name: string | null; email: string };

export default function OperatorAlertsScreen() {
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [alerts, setAlerts] = useState<AlertWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingAlert, setRespondingAlert] =
    useState<AlertWithCreator | null>(null);
  const [responseText, setResponseText] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const { errors, validate, clearErrors } =
    useFormValidation(alertResponseSchema);

  // Criar alerta
  const canCreate =
    profile?.role === "encarregado" || profile?.role === "supervisor";
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createMessage, setCreateMessage] = useState("");
  const [createSeverity, setCreateSeverity] = useState<SeverityKey>("medium");
  const [createRecipientId, setCreateRecipientId] = useState<string | null>(
    null,
  );
  const [operators, setOperators] = useState<OperatorOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadAlerts = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("safety_alerts")
      .select(
        "*, creator:profiles!safety_alerts_created_by_fkey(full_name, email)",
      )
      .or(`operator_id.eq.${user.id},operator_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      Alert.alert("Erro", "Falha ao carregar alertas.");
    }
    setAlerts(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("operator-alerts-refresh")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "safety_alerts" },
        () => {
          loadAlerts();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadAlerts]);

  async function onRefresh() {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  }

  async function loadOperators() {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "operator")
      .eq("active", true)
      .order("full_name", { ascending: true });
    setOperators((data ?? []) as OperatorOption[]);
  }

  function openCreate() {
    setCreateTitle("");
    setCreateMessage("");
    setCreateSeverity("medium");
    setCreateRecipientId(null);
    loadOperators();
    setShowCreate(true);
  }

  async function handleCreate() {
    if (!user) return;
    if (!createTitle.trim() || !createMessage.trim()) {
      Alert.alert("Atenção", "Preencha título e mensagem.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("safety_alerts").insert({
      title: createTitle.trim(),
      message: createMessage.trim(),
      severity: createSeverity,
      operator_id: createRecipientId,
      created_by: user.id,
    });
    setSubmitting(false);
    if (error) {
      Alert.alert("Erro", "Falha ao criar alerta.");
      return;
    }
    setShowCreate(false);
    loadAlerts();
  }

  async function markAsRead(id: string) {
    await supabase.from("safety_alerts").update({ read: true }).eq("id", id);
    loadAlerts();
  }

  async function markAllAsRead() {
    if (!user) return;
    const ids = alerts.filter((a) => !a.read).map((a) => a.id);
    if (ids.length === 0) return;
    await supabase.from("safety_alerts").update({ read: true }).in("id", ids);
    loadAlerts();
  }

  async function handleRespond() {
    if (!respondingAlert) return;
    const result = validate({ response: responseText });
    if (!result.success) return;

    setSaving(true);
    const { error } = await supabase
      .from("safety_alerts")
      .update({
        response: responseText,
        responded_at: new Date().toISOString(),
        read: true,
      })
      .eq("id", respondingAlert.id);
    setSaving(false);

    if (error) {
      Alert.alert("Erro", "Falha ao enviar resposta.");
      return;
    }

    setRespondingAlert(null);
    setResponseText("");
    clearErrors();
    loadAlerts();
  }

  const unreadCount = useMemo(
    () => alerts.filter((a) => !a.read).length,
    [alerts],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alerts.filter((a) => {
      if (filter === "unread" && a.read) return false;
      if (q.length === 0) return true;
      return (
        a.title?.toLowerCase().includes(q) ||
        a.message?.toLowerCase().includes(q)
      );
    });
  }, [alerts, filter, search]);

  function renderAlert({ item }: { item: AlertWithCreator }) {
    const config =
      SEVERITY_CONFIG[item.severity as SeverityKey] ?? SEVERITY_CONFIG.low;
    const unread = !item.read;
    const responded = !!item.response;
    const creatorName =
      item.creator?.full_name || item.creator?.email || "Sistema";
    const isNcAlert = item.title.startsWith("NC: ");

    return (
      <Pressable
        onPress={() => {
          if (unread) markAsRead(item.id);
        }}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      >
        {/* Linha topo: avatar + nome + meta */}
        <View style={styles.cardHeader}>
          <Avatar name={creatorName} size="xs" />
          <Text style={styles.senderName}>{creatorName}</Text>
          <View style={styles.cardHeaderRight}>
            <View
              style={[styles.severityDot, { backgroundColor: config.accent }]}
            />
            <Text style={[styles.severityLabel, { color: config.accent }]}>
              {config.label}
            </Text>
            <Text style={styles.metaSep}>|</Text>
            <Text style={styles.metaTime}>
              {formatRelative(item.created_at)}
            </Text>
            {unread && (
              <View
                style={[styles.unreadDot, { backgroundColor: config.accent }]}
              />
            )}
          </View>
        </View>

        {/* Divisor full-width */}
        <View style={styles.divider} />

        {/* Conteúdo abaixo */}
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardMessage} numberOfLines={3}>
          {item.message}
        </Text>

        <View style={styles.cardFooter}>
          {responded ? (
            <View style={styles.confirmedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={styles.confirmedText}>Confirmado</Text>
            </View>
          ) : (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                setRespondingAlert(item);
                setResponseText("");
                clearErrors();
              }}
              hitSlop={6}
              style={({ pressed }) => [
                styles.confirmBtn,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.confirmBtnText}>
                {isNcAlert ? "Plano de ação" : "Responder"}
              </Text>
              <Ionicons name="arrow-forward" size={12} color={colors.primary} />
            </Pressable>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.brandRow}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>MARRUÁ</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <View style={styles.bellDisplay}>
            <Ionicons name="notifications-outline" size={20} color={TECH_TEXT} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </View>
          {canCreate && (
            <Pressable
              onPress={openCreate}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
              ]}
              hitSlop={8}
            >
              <Ionicons name="add" size={22} color={TECH_TEXT} />
            </Pressable>
          )}
          <Pressable
            onPress={markAllAsRead}
            disabled={unreadCount === 0}
            style={({ pressed }) => [
              styles.iconBtn,
              unreadCount === 0 && { opacity: 0.4 },
              pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
            ]}
            hitSlop={8}
          >
            <Ionicons
              name="checkmark-done-outline"
              size={20}
              color={TECH_TEXT}
            />
          </Pressable>
        </View>
      </View>

      {/* SEARCH */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={TECH_TEXT_MUTED} />
        <TextInput
          style={styles.searchInput}
          placeholder="Pesquisar notificação"
          placeholderTextColor={TECH_TEXT_MUTED}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={TECH_TEXT_MUTED} />
          </Pressable>
        )}
      </View>

      {/* FILTERS */}
      <View style={styles.filterRow}>
        <FilterPill
          label="Todos"
          active={filter === "all"}
          count={alerts.length}
          onPress={() => setFilter("all")}
        />
        <FilterPill
          label="Não lidos"
          active={filter === "unread"}
          count={unreadCount}
          onPress={() => setFilter("unread")}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderAlert}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: spacing["3xl"] },
        ]}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={28}
                  color={TECH_TEXT_MUTED}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {filter === "unread" ? "Tudo em ordem" : "Nenhum alerta"}
              </Text>
              <Text style={styles.emptyMessage}>
                {filter === "unread"
                  ? "Você leu todas as notificações."
                  : "Quando houver um alerta de segurança, ele aparece aqui."}
              </Text>
            </View>
          ) : null
        }
      />

      {/* CREATE ALERT MODAL */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[styles.modalSheet, { paddingBottom: insets.bottom + 24 }]}
          >
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Novo alerta</Text>
              </View>
              <Pressable
                onPress={() => setShowCreate(false)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.modalCloseBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="close" size={18} color={TECH_TEXT} />
              </Pressable>
            </View>

            {/* Título */}
            <TextInput
              style={[styles.input, { minHeight: 44 }]}
              placeholder="Título do alerta"
              placeholderTextColor={TECH_TEXT_MUTED}
              value={createTitle}
              onChangeText={setCreateTitle}
              maxLength={120}
            />

            {/* Mensagem */}
            <TextInput
              style={styles.input}
              placeholder="Descreva o alerta..."
              placeholderTextColor={TECH_TEXT_MUTED}
              value={createMessage}
              onChangeText={setCreateMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Severidade */}
            <View style={styles.severitySelector}>
              {(Object.keys(SEVERITY_CONFIG) as SeverityKey[]).map((key) => {
                const cfg = SEVERITY_CONFIG[key];
                const active = createSeverity === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setCreateSeverity(key)}
                    style={[
                      styles.severityBtn,
                      active && {
                        backgroundColor: cfg.accent,
                        borderColor: cfg.accent,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.severityBtnText,
                        active ? { color: "#fff" } : undefined,
                      ]}
                    >
                      {cfg.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Destinatário */}
            <Text style={styles.recipientLabel}>Destinatário</Text>
            <View style={styles.recipientList}>
              <Pressable
                onPress={() => setCreateRecipientId(null)}
                style={[
                  styles.recipientItem,
                  createRecipientId === null && styles.recipientItemActive,
                ]}
              >
                <Ionicons
                  name="people-outline"
                  size={15}
                  color={
                    createRecipientId === null
                      ? colors.primary
                      : TECH_TEXT_MUTED
                  }
                />
                <Text
                  style={[
                    styles.recipientName,
                    {
                      color:
                        createRecipientId === null ? colors.primary : undefined,
                    },
                  ]}
                >
                  Sem destinatário específico
                </Text>
              </Pressable>
              {operators.map((op) => {
                const active = createRecipientId === op.id;
                const name = op.full_name || op.email;
                return (
                  <Pressable
                    key={op.id}
                    onPress={() => setCreateRecipientId(op.id)}
                    style={[
                      styles.recipientItem,
                      active && styles.recipientItemActive,
                    ]}
                  >
                    <Ionicons
                      name="person-outline"
                      size={15}
                      color={active ? colors.primary : TECH_TEXT_MUTED}
                    />
                    <Text
                      style={[
                        styles.recipientName,
                        { color: active ? colors.primary : undefined },
                      ]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={handleCreate}
              disabled={submitting}
              style={({ pressed }) => [
                styles.submitBtn,
                submitting && { opacity: 0.6 },
                pressed &&
                  !submitting && {
                    opacity: 0.92,
                    transform: [{ scale: 0.99 }],
                  },
              ]}
            >
              {!submitting && <Ionicons name="send" size={15} color="#fff" />}
              <Text style={styles.submitBtnText}>
                {submitting ? "Enviando..." : "Enviar alerta"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* RESPONSE MODAL */}
      <Modal visible={!!respondingAlert} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[styles.modalSheet, { paddingBottom: insets.bottom + 24 }]}
          >
            <View style={styles.modalHandle} />

            {/* Header: avatar + sender + título + fechar */}
            <View style={styles.modalHeader}>
              {respondingAlert && (
                <Avatar
                  name={
                    respondingAlert.creator?.full_name ||
                    respondingAlert.creator?.email ||
                    "Sistema"
                  }
                  size="sm"
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.modalSender}>
                  {respondingAlert?.creator?.full_name ||
                    respondingAlert?.creator?.email ||
                    "Sistema"}
                </Text>
                <Text style={styles.modalTitle}>
                  {respondingAlert?.title.startsWith("NC: ")
                    ? "Plano de ação"
                    : "Responder alerta"}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setRespondingAlert(null);
                  clearErrors();
                }}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.modalCloseBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="close" size={18} color={TECH_TEXT} />
              </Pressable>
            </View>

            {/* Preview do alerta */}
            {respondingAlert && (
              <View style={styles.alertPreview}>
                <View
                  style={[
                    styles.alertPreviewBar,
                    {
                      backgroundColor:
                        SEVERITY_CONFIG[respondingAlert.severity as SeverityKey]
                          ?.accent ?? colors.primary,
                    },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertPreviewTitle}>
                    {respondingAlert.title}
                  </Text>
                  <Text style={styles.alertPreviewMsg} numberOfLines={2}>
                    {respondingAlert.message}
                  </Text>
                </View>
              </View>
            )}

            {/* Input */}
            <TextInput
              style={[styles.input, errors.response && styles.inputError]}
              placeholder={
                respondingAlert?.title.startsWith("NC: ")
                  ? "Descreva como vai resolver esta não conformidade..."
                  : "Descreva o que foi feito ou observado..."
              }
              placeholderTextColor={TECH_TEXT_MUTED}
              value={responseText}
              onChangeText={setResponseText}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            {errors.response && (
              <Text style={styles.inputErrorText}>{errors.response}</Text>
            )}

            {/* Botão enviar */}
            <Pressable
              onPress={handleRespond}
              disabled={saving}
              style={({ pressed }) => [
                styles.submitBtn,
                saving && { opacity: 0.6 },
                pressed &&
                  !saving && { opacity: 0.92, transform: [{ scale: 0.99 }] },
              ]}
            >
              {!saving && <Ionicons name="send" size={15} color="#fff" />}
              <Text style={styles.submitBtnText}>
                {saving ? "Enviando..." : "Enviar resposta"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FilterPill({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.filterTab, pressed && { opacity: 0.6 }]}
    >
      <Text
        style={[
          styles.filterText,
          ...(active ? [styles.filterTextActive] : []),
        ]}
      >
        {label} <Text style={styles.filterCountInline}>{count}</Text>
      </Text>
      {active && <View style={styles.filterUnderline} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TECH_BG },

  // HEADER
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
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandLogo: { width: 28, height: 28, borderRadius: 6 },
  brandName: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 2,
    color: TECH_TEXT,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: TECH_BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TECH_BG,
  },
  bellDisplay: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: TECH_BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TECH_BG,
  },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: TECH_BG,
  },
  bellBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800" as const,
    textAlign: "center" as const,
    includeFontPadding: false,
  },

  // SEARCH
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: TECH_BORDER,
    backgroundColor: TECH_BG_SOFT,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: TECH_TEXT,
    padding: 0,
  },

  // FILTERS
  filterRow: {
    flexDirection: "row",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  filterTab: {
    paddingVertical: 10,
    alignItems: "center",
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
    color: TECH_TEXT_MUTED,
    letterSpacing: -0.1,
  },
  filterTextActive: {
    color: TECH_TEXT,
    fontWeight: "700",
  },
  filterCountInline: {
    fontSize: 12,
    fontWeight: "500",
    color: TECH_TEXT_MUTED,
  },
  filterUnderline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },

  // LIST
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  // CARD
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "column",
    gap: 0,
    borderWidth: 1,
    borderColor: TECH_BORDER,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
  },
  cardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginLeft: "auto" as any,
  },
  divider: {
    height: 1,
    backgroundColor: TECH_BORDER,
    marginHorizontal: -12,
    marginBottom: 10,
  },
  senderName: {
    fontSize: 13,
    fontWeight: "700",
    color: TECH_TEXT,
    flexShrink: 1,
  },
  metaSep: {
    fontSize: 11,
    color: "#CBD5E1",
    fontWeight: "400",
  },
  metaTime: {
    fontSize: 10.5,
    fontWeight: "500",
    color: "#777777",
  },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: TECH_TEXT,
    lineHeight: 18,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  cardMessage: {
    fontSize: 12,
    lineHeight: 17,
    color: TECH_TEXT_MUTED,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  severityRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  severityLabel: { fontSize: 11, fontWeight: "600" },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  confirmedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  confirmedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10B981",
  },

  // EMPTY
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
    fontSize: 16,
    fontWeight: "800",
    color: TECH_TEXT,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  emptyMessage: {
    fontSize: 13,
    color: TECH_TEXT_MUTED,
    textAlign: "center",
    lineHeight: 20,
  },

  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalSender: {
    fontSize: 12,
    fontWeight: "500",
    color: TECH_TEXT_MUTED,
    marginBottom: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TECH_TEXT,
    letterSpacing: -0.4,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  alertPreview: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: TECH_BG_SOFT,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: TECH_BORDER,
  },
  alertPreviewBar: {
    width: 3,
    borderRadius: 2,
    minHeight: 20,
  },
  alertPreviewTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: TECH_TEXT,
    marginBottom: 3,
  },
  alertPreviewMsg: {
    fontSize: 12,
    color: TECH_TEXT_MUTED,
    lineHeight: 17,
  },
  input: {
    backgroundColor: TECH_BG_SOFT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TECH_BORDER,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: TECH_TEXT,
    minHeight: 120,
  },
  inputError: { borderColor: "#DC2626" },
  inputErrorText: {
    fontSize: 12,
    color: "#DC2626",
    marginTop: -8,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },

  severitySelector: {
    flexDirection: "row",
    gap: 8,
  },
  severityBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: TECH_BORDER,
    backgroundColor: TECH_BG_SOFT,
  },
  severityBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: TECH_TEXT_MUTED,
  },

  recipientLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    color: TECH_TEXT_MUTED,
    textTransform: "uppercase",
    marginBottom: -8,
  },
  recipientList: {
    borderWidth: 1,
    borderColor: TECH_BORDER,
    borderRadius: 12,
    overflow: "hidden",
  },
  recipientItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: TECH_BORDER,
    backgroundColor: TECH_BG,
  },
  recipientItemActive: {
    backgroundColor: "#EFF6FF",
  },
  recipientName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: TECH_TEXT,
  },
});
