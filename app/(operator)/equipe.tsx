import { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Image,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { todayLocal } from '../../src/lib/dates';
import { colors, spacing, radius, fontSize } from '../../src/theme/colors';
import { Text, Avatar } from '../../src/components/ui';

type ChecklistRow = {
  id: string;
  machine_name: string;
  tag: string | null;
  result: 'released' | 'not_released' | null;
  status: 'pending' | 'completed';
  created_at: string;
  encarregado_confirmed: boolean;
  encarregado_confirmed_at: string | null;
};

type ActivityNcAnswer = {
  id: string;
  label: string | null;
  nc_description: string | null;
};

type ActivityRow = {
  id: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  activity_type: { description: string } | null;
  nc_answers: ActivityNcAnswer[];
};

type OperatorGroup = {
  operator_id: string;
  full_name: string | null;
  email: string;
  checklists: ChecklistRow[];
  activities: ActivityRow[];
};

type NcItem = {
  id: string;
  notes: string | null;
  machine_item: { description: string } | null;
};

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string): string {
  const today = todayLocal();
  if (dateStr === today) return 'Hoje';
  const yesterday = addDays(today, -1);
  if (dateStr === yesterday) return 'Ontem';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' });
}

export default function EquipeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const today = todayLocal();

  const [selectedDate, setSelectedDate] = useState(today);
  const [operators, setOperators] = useState<OperatorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedChecklist, setExpandedChecklist] = useState<string | null>(null);
  const [ncDetails, setNcDetails] = useState<Record<string, NcItem[]>>({});
  const [ncLoading, setNcLoading] = useState<Record<string, boolean>>({});
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [confirmingChecklist, setConfirmingChecklist] = useState<{ id: string } | null>(null);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const router = useRouter();
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useFocusEffect(
    useCallback(() => {
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
    }, [user]),
  );

  const loadData = useCallback(async (date: string) => {
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('checklists')
      .select('id, machine_name, tag, result, status, created_at, encarregado_confirmed, encarregado_confirmed_at, operator_id, operator:profiles!checklists_operator_id_fkey(full_name, email)')
      .eq('encarregado_id', user.id)
      .eq('date', date)
      .order('created_at', { ascending: false });
    if (error) {
      Alert.alert('Erro', 'Falha ao carregar equipe.');
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as any[];
    const groupMap: Record<string, OperatorGroup> = {};
    for (const row of rows) {
      const opId = row.operator_id as string;
      if (!groupMap[opId]) {
        groupMap[opId] = {
          operator_id: opId,
          full_name: row.operator?.full_name ?? null,
          email: row.operator?.email ?? '',
          checklists: [],
          activities: [],
        };
      }
      groupMap[opId].checklists.push({
        id: row.id,
        machine_name: row.machine_name,
        tag: row.tag,
        result: row.result,
        status: row.status,
        created_at: row.created_at,
        encarregado_confirmed: row.encarregado_confirmed ?? false,
        encarregado_confirmed_at: row.encarregado_confirmed_at ?? null,
      });
    }

    // Busca atividades dos mesmos operadores no mesmo dia
    const operatorIds = Object.keys(groupMap);
    if (operatorIds.length > 0) {
      const { data: acts } = await supabase
        .from('activities')
        .select('id, operator_id, description, start_time, end_time, location, activity_type:activity_types(description)')
        .in('operator_id', operatorIds)
        .eq('date', date)
        .order('start_time', { ascending: true, nullsFirst: false });

      const actList = (acts ?? []) as any[];

      // Busca respostas NC das atividades (value = false)
      const actIds = actList.map((a) => a.id);
      let ncByActivity: Record<string, ActivityNcAnswer[]> = {};
      if (actIds.length > 0) {
        const { data: ncAnswers } = await supabase
          .from('activity_answers')
          .select('id, activity_id, nc_description, question:activity_questions(label)')
          .in('activity_id', actIds)
          .eq('value', false);
        for (const ans of (ncAnswers ?? []) as any[]) {
          if (!ncByActivity[ans.activity_id]) ncByActivity[ans.activity_id] = [];
          ncByActivity[ans.activity_id].push({
            id: ans.id,
            label: ans.question?.label ?? null,
            nc_description: ans.nc_description ?? null,
          });
        }
      }

      for (const a of actList) {
        if (groupMap[a.operator_id]) {
          groupMap[a.operator_id].activities.push({
            id: a.id,
            description: a.description,
            start_time: a.start_time,
            end_time: a.end_time,
            location: a.location,
            activity_type: a.activity_type ?? null,
            nc_answers: ncByActivity[a.id] ?? [],
          });
        }
      }
    }

    setOperators(Object.values(groupMap));
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData(selectedDate);
    }, [loadData, selectedDate]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadData(selectedDate);
    setRefreshing(false);
  }

  function changeDate(delta: number) {
    const newDate = addDays(selectedDate, delta);
    if (newDate > today) return;
    setSelectedDate(newDate);
    setExpandedChecklist(null);
    setExpandedActivity(null);
    setNcDetails({});
    setLoading(true);
  }

  function confirmChecklist(c: ChecklistRow) {
    setConfirmNotes('');
    setConfirmingChecklist({ id: c.id });
  }

  async function doConfirm(checklistId: string, notes: string | null) {
    const { error } = await supabase
      .from('checklists')
      .update({
        encarregado_confirmed: true,
        encarregado_confirmed_at: new Date().toISOString(),
        encarregado_confirmed_notes: notes || null,
      })
      .eq('id', checklistId);
    if (error) {
      Alert.alert('Erro', 'Falha ao confirmar checklist.');
      return;
    }
    setConfirmingChecklist(null);
    setConfirmNotes('');
    loadData(selectedDate);
  }

  async function toggleNcDetails(checklistId: string) {
    if (expandedChecklist === checklistId) {
      setExpandedChecklist(null);
      return;
    }
    setExpandedChecklist(checklistId);
    if (ncDetails[checklistId]) return;
    setNcLoading((p) => ({ ...p, [checklistId]: true }));
    const { data } = await supabase
      .from('checklist_responses')
      .select('id, notes, machine_item:machine_checklist_items(description)')
      .eq('checklist_id', checklistId)
      .eq('status', 'NC');
    setNcDetails((p) => ({ ...p, [checklistId]: (data ?? []) as NcItem[] }));
    setNcLoading((p) => ({ ...p, [checklistId]: false }));
  }

  const totalNc = useMemo(() =>
    operators.reduce((acc, op) => {
      const checklistNc = op.checklists.filter(c => c.result === 'not_released').length;
      const activityNc = op.activities.reduce((s, a) => s + a.nc_answers.length, 0);
      return acc + checklistNc + activityNc;
    }, 0),
    [operators],
  );

  function renderChecklist(c: ChecklistRow) {
    const isNc = c.result === 'not_released';
    const isPending = c.status === 'pending';
    const isExpanded = expandedChecklist === c.id;
    const time = new Date(c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return (
      <View key={c.id} style={[st.checklistRow, isNc && st.checklistRowNc]}>
        {/* Header da row — toque aqui expande NC */}
        <Pressable
          style={st.checklistRowLeft}
          onPress={() => isNc ? toggleNcDetails(c.id) : undefined}
        >
          <Ionicons
            name={isPending ? 'time-outline' : isNc ? 'alert-circle' : 'checkmark-circle'}
            size={16}
            color={isPending ? colors.warning : isNc ? colors.danger : colors.success}
          />
          <View style={{ flex: 1 }}>
            <Text style={st.checklistMachine} numberOfLines={1}>{c.machine_name}</Text>
            <Text style={st.checklistMeta}>
              {time}{c.tag ? ` · ${c.tag}` : ''}
              {isPending ? ' · Em andamento' : ''}
            </Text>
          </View>
          {isNc && (
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.danger}
            />
          )}
        </Pressable>

        {isExpanded && (
          <View style={st.ncDetails}>
            {ncLoading[c.id] ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (ncDetails[c.id] ?? []).length === 0 ? (
              <Text style={st.ncNone}>Sem itens NC registrados.</Text>
            ) : (
              (ncDetails[c.id] ?? []).map((nc) => (
                <View key={nc.id} style={st.ncItem}>
                  <Ionicons name="close-circle" size={13} color={colors.danger} />
                  <Text style={st.ncItemText} numberOfLines={2}>
                    {nc.machine_item?.description ?? 'Item não identificado'}
                    {nc.notes ? ` — ${nc.notes}` : ''}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {isPending && isNc && (
          c.encarregado_confirmed ? (
            <View style={st.confirmedBadge}>
              <Ionicons name="checkmark-circle" size={13} color={colors.success} />
              <Text style={st.confirmedBadgeText}>
                Confirmado
                {c.encarregado_confirmed_at
                  ? ` · ${new Date(c.encarregado_confirmed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                  : ''}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={st.confirmBtn}
              onPress={() => confirmChecklist(c)}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle-outline" size={14} color={colors.primary} />
              <Text style={st.confirmBtnText}>Confirmar</Text>
            </TouchableOpacity>
          )
        )}
      </View>
    );
  }

  function renderActivity(a: ActivityRow) {
    const isDone = !!a.end_time;
    const hasNc = a.nc_answers.length > 0;
    const isExpanded = expandedActivity === a.id;
    const formatTime = (t: string | null) =>
      t ? new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
    const start = formatTime(a.start_time);
    const end = formatTime(a.end_time);
    const timeStr = start
      ? end ? `${start} → ${end}` : `${start} · Em andamento`
      : 'Sem horário';
    const label = a.activity_type?.description || a.description || 'Atividade';

    return (
      <View key={a.id} style={[st.activityRow, hasNc && st.activityRowNc]}>
        <Pressable
          style={st.activityRowLeft}
          onPress={() => hasNc ? setExpandedActivity(isExpanded ? null : a.id) : undefined}
        >
          <Ionicons
            name={hasNc ? 'alert-circle' : isDone ? 'checkmark-circle' : 'time-outline'}
            size={15}
            color={hasNc ? colors.danger : isDone ? colors.success : colors.warning}
          />
          <View style={{ flex: 1 }}>
            <Text style={st.activityLabel} numberOfLines={1}>{label}</Text>
            <Text style={st.activityMeta}>
              {timeStr}{a.location ? ` · ${a.location}` : ''}
            </Text>
          </View>
          {hasNc && (
            <View style={st.activityNcBadge}>
              <Text style={st.activityNcBadgeText}>{a.nc_answers.length} NC</Text>
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={12} color={colors.danger} />
            </View>
          )}
        </Pressable>
        {isExpanded && (
          <View style={st.ncDetails}>
            {a.nc_answers.map((nc) => (
              <View key={nc.id} style={st.ncItem}>
                <Ionicons name="close-circle" size={13} color={colors.danger} />
                <Text style={st.ncItemText} numberOfLines={3}>
                  {nc.label ?? 'Item não identificado'}
                  {nc.nc_description ? ` — ${nc.nc_description}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  function renderOperator({ item }: { item: OperatorGroup }) {
    const name = item.full_name || item.email;
    const ncCount = item.checklists.filter(c => c.result === 'not_released').length
      + item.activities.reduce((s, a) => s + a.nc_answers.length, 0);
    const totalChecklists = item.checklists.length;
    const totalActivities = item.activities.length;
    const metaParts: string[] = [];
    if (totalChecklists > 0) metaParts.push(`${totalChecklists} checklist${totalChecklists !== 1 ? 's' : ''}`);
    if (totalActivities > 0) metaParts.push(`${totalActivities} atividade${totalActivities !== 1 ? 's' : ''}`);

    return (
      <View style={st.operatorCard}>
        <View style={st.operatorHeader}>
          <Avatar name={name} size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={st.operatorName} numberOfLines={1}>{name}</Text>
            <Text style={st.operatorMeta}>{metaParts.join(' · ') || 'Sem registros'}</Text>
          </View>
          {ncCount > 0 && (
            <View style={st.ncBadge}>
              <Ionicons name="alert" size={11} color="#fff" />
              <Text style={st.ncBadgeText}>{ncCount} NC</Text>
            </View>
          )}
          {ncCount === 0 && totalChecklists > 0 && (
            <View style={st.okBadge}>
              <Ionicons name="checkmark" size={11} color="#fff" />
              <Text style={st.okBadgeText}>OK</Text>
            </View>
          )}
        </View>

        {/* Checklists */}
        {item.checklists.length > 0 && (
          <View style={st.section}>
            <Text style={st.sectionLabel}>CHECKLISTS</Text>
            {item.checklists.map(renderChecklist)}
          </View>
        )}

        {/* Atividades */}
        {item.activities.length > 0 && (
          <View style={st.section}>
            <Text style={st.sectionLabel}>ATIVIDADES</Text>
            {item.activities.map(renderActivity)}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={st.container}>
      {/* Header */}
      <View style={[st.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={st.brandRow}>
          <Image source={require('../../assets/icon.png')} style={st.brandLogo} resizeMode="contain" />
          <Text style={st.brandName}>MARRUÁ</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {totalNc > 0 && (
            <View style={st.headerBadge}>
              <Text style={st.headerBadgeText}>{totalNc} NC</Text>
            </View>
          )}
          <Pressable
            onPress={() => router.push('/(operator)/alerts')}
            style={({ pressed }) => [st.bellBtn, pressed && { opacity: 0.8 }]}
            hitSlop={8}
          >
            <Ionicons name="notifications-outline" size={20} color="#0F172A" />
            {unreadAlerts > 0 && (
              <View style={st.bellBadge}>
                <Text style={st.bellBadgeText}>{unreadAlerts > 9 ? '9+' : unreadAlerts}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Date nav */}
      <View style={st.dateNav}>
        <TouchableOpacity onPress={() => changeDate(-1)} hitSlop={8} style={st.dateNavBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={st.dateLabel}>{formatDateLabel(selectedDate)}</Text>
        <TouchableOpacity
          onPress={() => changeDate(1)}
          hitSlop={8}
          style={[st.dateNavBtn, selectedDate >= today && { opacity: 0.3 }]}
          disabled={selectedDate >= today}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={st.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={operators}
          keyExtractor={(item) => item.operator_id}
          renderItem={renderOperator}
          contentContainerStyle={st.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={st.empty}>
              <View style={st.emptyIcon}>
                <Ionicons name="people-outline" size={28} color="#94A3B8" />
              </View>
              <Text style={st.emptyTitle}>Nenhum checklist</Text>
              <Text style={st.emptyMessage}>
                Nenhum operador fez checklist sob sua responsabilidade {selectedDate === today ? 'hoje' : 'neste dia'}.
              </Text>
            </View>
          }
        />
      )}

      {/* Modal: resolução de não conformidade */}
      <Modal visible={!!confirmingChecklist} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={st.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={st.modalSheet}>
            <View style={st.modalHandle} />
            <Text style={st.modalTitle}>Resolução da não conformidade</Text>
            <Text style={st.modalSubtitle}>
              Este checklist possui itens NC. Descreva como a pendência foi resolvida ou tratada antes de confirmar.
            </Text>
            <TextInput
              style={st.modalInput}
              placeholder="Ex: Item X foi reparado, máquina liberada pelo responsável de manutenção..."
              placeholderTextColor="#94A3B8"
              value={confirmNotes}
              onChangeText={setConfirmNotes}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[st.modalConfirmBtn, confirmSubmitting && { opacity: 0.6 }]}
              activeOpacity={0.8}
              disabled={confirmSubmitting}
              onPress={async () => {
                if (!confirmNotes.trim()) {
                  Alert.alert('Atenção', 'Informe como a não conformidade foi resolvida.');
                  return;
                }
                setConfirmSubmitting(true);
                await doConfirm(confirmingChecklist!.id, confirmNotes.trim());
                setConfirmSubmitting(false);
              }}
            >
              <Text style={st.modalConfirmBtnText}>
                {confirmSubmitting ? 'Confirmando...' : 'Confirmar e registrar'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={st.modalCancelBtn}
              onPress={() => setConfirmingChecklist(null)}
            >
              <Text style={st.modalCancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandLogo: { width: 28, height: 28, borderRadius: 6 },
  brandName: { fontSize: fontSize.base, fontWeight: '800', letterSpacing: 2, color: '#0F172A' },
  headerBadge: {
    backgroundColor: colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  headerBadgeText: { fontSize: fontSize.xs, fontWeight: '700', color: '#fff' },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: fontSize['2xs'],
    lineHeight: 12,
    fontWeight: '800',
    textAlign: 'center',
  },

  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dateNavBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
  },
  dateLabel: { fontSize: fontSize.base, fontWeight: '700', color: '#0F172A' },

  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'] * 2,
  },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  operatorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  operatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  operatorName: { fontSize: fontSize.sm, fontWeight: '700', color: '#0F172A' },
  operatorMeta: { fontSize: fontSize.xs, color: '#64748B', marginTop: 1 },

  ncBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.danger,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full,
  },
  ncBadgeText: { fontSize: fontSize.xs, fontWeight: '700', color: '#fff' },
  okBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.success,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full,
  },
  okBadgeText: { fontSize: fontSize.xs, fontWeight: '700', color: '#fff' },

  section: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  sectionLabel: {
    fontSize: fontSize['2xs'],
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#94A3B8',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 2,
  },

  activityRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  activityRowNc: { backgroundColor: '#FEF2F2' },
  activityRowLeft: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
  },
  activityLabel: { fontSize: fontSize.sm, fontWeight: '600', color: '#0F172A' },
  activityMeta: { fontSize: fontSize.xs, color: '#64748B', marginTop: 1 },
  activityNcBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: radius.full,
  },
  activityNcBadgeText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.danger },

  checklistRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  checklistRowNc: { backgroundColor: '#FEF2F2' },
  checklistRowLeft: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  checklistMachine: { fontSize: fontSize.sm, fontWeight: '600', color: '#0F172A' },
  checklistMeta: { fontSize: fontSize.xs, color: '#64748B', marginTop: 1 },

  ncDetails: {
    marginTop: spacing.sm,
    marginLeft: 24,
    gap: 4,
  },
  ncNone: { fontSize: fontSize.xs, color: '#64748B', fontStyle: 'italic' },
  ncItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 4,
  },
  ncItemText: { flex: 1, fontSize: fontSize.xs, color: '#7F1D1D', lineHeight: 16 },

  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    marginLeft: 24,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    alignSelf: 'flex-start',
  },
  confirmBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.primary,
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    marginLeft: 24,
  },
  confirmedBadgeText: {
    fontSize: fontSize.xs,
    color: colors.success,
    fontWeight: '600',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 14,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: fontSize.sm,
    color: '#64748B',
    lineHeight: 19,
    marginTop: -6,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.sm,
    color: '#0F172A',
    minHeight: 110,
  },
  modalConfirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    color: '#fff',
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  modalCancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalCancelBtnText: {
    fontSize: fontSize.sm,
    color: '#64748B',
    fontWeight: '600',
  },

  empty: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#F8FAFC',
    borderWidth: 1, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: fontSize.base, fontWeight: '800', color: '#0F172A', letterSpacing: -0.2, marginBottom: 6 },
  emptyMessage: { fontSize: fontSize.sm, color: '#64748B', textAlign: 'center', lineHeight: 20 },
});
