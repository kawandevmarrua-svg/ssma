import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { alertResponseSchema } from '../../src/schemas';
import { useFormValidation } from '../../src/hooks/useFormValidation';
import { SafetyAlert } from '../../src/types/database';
import { colors, radius, spacing } from '../../src/theme/colors';
import { Text } from '../../src/components/ui';

const TECH_BG = '#FFFFFF';
const TECH_BG_SOFT = '#F8FAFC';
const TECH_BORDER = '#E5E7EB';
const TECH_TEXT = '#0F172A';
const TECH_TEXT_MUTED = '#64748B';

type SeverityKey = 'low' | 'medium' | 'high' | 'critical';

const SEVERITY_CONFIG: Record<SeverityKey, {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  surface: string;
}> = {
  low: { label: 'Baixo', icon: 'information-circle-outline', accent: '#3B82F6', surface: '#EFF6FF' },
  medium: { label: 'Médio', icon: 'alert-circle-outline', accent: '#F59E0B', surface: '#FFFBEB' },
  high: { label: 'Alto', icon: 'warning-outline', accent: colors.primary, surface: colors.primarySurface },
  critical: { label: 'Crítico', icon: 'alert-outline', accent: '#DC2626', surface: '#FEF2F2' },
};

type Filter = 'all' | 'unread';

function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function OperatorAlertsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingAlert, setRespondingAlert] = useState<SafetyAlert | null>(null);
  const [responseText, setResponseText] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const { errors, validate, clearErrors } = useFormValidation(alertResponseSchema);

  const loadAlerts = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('safety_alerts')
      .select('*')
      .or(`operator_id.eq.${user.id},operator_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      Alert.alert('Erro', 'Falha ao carregar alertas.');
    }
    setAlerts(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('operator-alerts-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'safety_alerts' }, () => {
        loadAlerts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadAlerts]);

  async function onRefresh() {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  }

  async function markAsRead(id: string) {
    await supabase.from('safety_alerts').update({ read: true }).eq('id', id);
    loadAlerts();
  }

  async function markAllAsRead() {
    if (!user) return;
    const ids = alerts.filter(a => !a.read).map(a => a.id);
    if (ids.length === 0) return;
    await supabase.from('safety_alerts').update({ read: true }).in('id', ids);
    loadAlerts();
  }

  async function handleRespond() {
    if (!respondingAlert) return;
    const result = validate({ response: responseText });
    if (!result.success) return;

    setSaving(true);
    const { error } = await supabase
      .from('safety_alerts')
      .update({
        response: responseText,
        responded_at: new Date().toISOString(),
        read: true,
      })
      .eq('id', respondingAlert.id);
    setSaving(false);

    if (error) {
      Alert.alert('Erro', 'Falha ao enviar resposta.');
      return;
    }

    setRespondingAlert(null);
    setResponseText('');
    clearErrors();
    loadAlerts();
  }

  const unreadCount = useMemo(() => alerts.filter(a => !a.read).length, [alerts]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alerts.filter(a => {
      if (filter === 'unread' && a.read) return false;
      if (q.length === 0) return true;
      return (
        a.title?.toLowerCase().includes(q) ||
        a.message?.toLowerCase().includes(q)
      );
    });
  }, [alerts, filter, search]);

  function renderAlert({ item }: { item: SafetyAlert }) {
    const config = SEVERITY_CONFIG[item.severity as SeverityKey] ?? SEVERITY_CONFIG.low;
    const unread = !item.read;
    const responded = !!item.response;

    return (
      <Pressable
        onPress={() => { if (unread) markAsRead(item.id); }}
        style={({ pressed }) => [
          styles.card,
          pressed && { opacity: 0.97 },
        ]}
      >
        <View style={styles.cardTopRow}>
          <View style={styles.severityRow}>
            <View style={[styles.severityDot, { backgroundColor: config.accent }]} />
            <Text style={styles.severityLabel}>{config.label}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{formatRelative(item.created_at)}</Text>
          </View>
          {unread && <View style={[styles.unreadDot, { backgroundColor: config.accent }]} />}
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardMessage} numberOfLines={3}>{item.message}</Text>

        {responded ? (
          <View style={styles.responseBox}>
            <Text style={styles.responseLabel}>Respondido</Text>
            <Text style={styles.responseText} numberOfLines={2}>{item.response}</Text>
          </View>
        ) : (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              setRespondingAlert(item);
              setResponseText('');
              clearErrors();
            }}
            hitSlop={6}
            style={({ pressed }) => [styles.respondLink, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.respondLinkText}>Responder</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.primary} />
          </Pressable>
        )}
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.brandRow}>
          <Image source={require('../../assets/icon.png')} style={styles.brandLogo} resizeMode="contain" />
          <Text style={styles.brandName}>MARRUÁ</Text>
        </View>
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
          <Ionicons name="checkmark-done-outline" size={20} color={TECH_TEXT} />
        </Pressable>
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
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={TECH_TEXT_MUTED} />
          </Pressable>
        )}
      </View>

      {/* FILTERS */}
      <View style={styles.filterRow}>
        <FilterPill label="Todos" active={filter === 'all'} count={alerts.length} onPress={() => setFilter('all')} />
        <FilterPill label="Não lidos" active={filter === 'unread'} count={unreadCount} onPress={() => setFilter('unread')} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderAlert}
        contentContainerStyle={[styles.listContent, { paddingBottom: spacing['3xl'] }]}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="shield-checkmark-outline" size={28} color={TECH_TEXT_MUTED} />
              </View>
              <Text style={styles.emptyTitle}>
                {filter === 'unread' ? 'Tudo em ordem' : 'Nenhum alerta'}
              </Text>
              <Text style={styles.emptyMessage}>
                {filter === 'unread'
                  ? 'Você leu todas as notificações.'
                  : 'Quando houver um alerta de segurança, ele aparece aqui.'}
              </Text>
            </View>
          ) : null
        }
      />

      {/* RESPONSE MODAL */}
      <Modal visible={!!respondingAlert} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>RESPONDER</Text>
                <Text style={styles.modalTitle}>Sua resposta</Text>
              </View>
              <Pressable
                onPress={() => { setRespondingAlert(null); clearErrors(); }}
                hitSlop={8}
                style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="close" size={20} color={TECH_TEXT} />
              </Pressable>
            </View>

            {respondingAlert && (
              <View style={styles.alertPreview}>
                <View style={styles.alertPreviewBar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertPreviewTitle}>{respondingAlert.title}</Text>
                  <Text style={styles.alertPreviewMsg} numberOfLines={3}>
                    {respondingAlert.message}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.inputLabel}>SUA RESPOSTA</Text>
            <TextInput
              style={[styles.input, errors.response && styles.inputError]}
              placeholder="Escreva o que foi feito ou observado..."
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

            <Pressable
              onPress={handleRespond}
              disabled={saving}
              style={({ pressed }) => [
                styles.submitBtn,
                saving && { opacity: 0.6 },
                pressed && !saving && { opacity: 0.92, transform: [{ scale: 0.99 }] },
              ]}
            >
              <Text style={styles.submitBtnText}>
                {saving ? 'ENVIANDO...' : 'ENVIAR RESPOSTA'}
              </Text>
              {!saving && <Ionicons name="arrow-forward" size={16} color="#fff" />}
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
      <Text style={[styles.filterText, active && styles.filterTextActive]}>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: TECH_BORDER,
    backgroundColor: TECH_BG,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogo: { width: 28, height: 28, borderRadius: 6 },
  brandName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
    color: TECH_TEXT,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    borderWidth: 1, borderColor: TECH_BORDER,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: TECH_BG,
  },

  // SEARCH
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  filterTab: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: TECH_TEXT_MUTED,
    letterSpacing: -0.1,
  },
  filterTextActive: {
    color: TECH_TEXT,
    fontWeight: '700',
  },
  filterCountInline: {
    fontSize: 12,
    fontWeight: '500',
    color: TECH_TEXT_MUTED,
  },
  filterUnderline: {
    position: 'absolute',
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
    backgroundColor: TECH_BG,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  severityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  severityDot: { width: 7, height: 7, borderRadius: 4 },
  severityLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TECH_TEXT_MUTED,
    letterSpacing: -0.1,
  },
  metaDot: { color: TECH_TEXT_MUTED, fontSize: 12 },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
    color: TECH_TEXT_MUTED,
  },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },

  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TECH_TEXT,
    letterSpacing: -0.3,
    lineHeight: 22,
    marginBottom: 6,
  },
  cardMessage: {
    fontSize: 13,
    lineHeight: 20,
    color: TECH_TEXT_MUTED,
    marginBottom: spacing.sm,
  },

  // RESPONDED
  responseBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: 4,
  },
  responseLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  responseText: {
    fontSize: 12,
    lineHeight: 17,
    color: TECH_TEXT_MUTED,
  },

  // RESPOND LINK
  respondLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  respondLinkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },

  // EMPTY
  empty: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: TECH_BG_SOFT,
    borderWidth: 1, borderColor: TECH_BORDER,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TECH_TEXT,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  emptyMessage: {
    fontSize: 13,
    color: TECH_TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },

  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: TECH_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalEyebrow: {
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 2,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TECH_TEXT,
    letterSpacing: -0.4,
  },
  alertPreview: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: TECH_BG_SOFT,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  alertPreviewBar: {
    width: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  alertPreviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TECH_TEXT,
    marginBottom: 4,
  },
  alertPreviewMsg: {
    fontSize: 12,
    color: TECH_TEXT_MUTED,
    lineHeight: 17,
  },

  inputLabel: {
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '800',
    color: TECH_TEXT_MUTED,
    marginBottom: 8,
  },
  input: {
    backgroundColor: TECH_BG_SOFT,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: TECH_BORDER,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 14,
    color: TECH_TEXT,
    minHeight: 110,
    marginBottom: spacing.md,
  },
  inputError: { borderColor: '#DC2626' },
  inputErrorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
