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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { todayLocal } from '../../src/lib/dates';
import { colors, spacing, radius } from '../../src/theme/colors';
import { Text, Avatar } from '../../src/components/ui';

type ChecklistRow = {
  id: string;
  machine_name: string;
  tag: string | null;
  result: 'released' | 'not_released' | null;
  status: 'pending' | 'completed';
  created_at: string;
};

type ActivityRow = {
  id: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  activity_type: { description: string } | null;
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

  const loadData = useCallback(async (date: string) => {
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('checklists')
      .select('id, machine_name, tag, result, status, created_at, operator_id, operator:profiles!checklists_operator_id_fkey(full_name, email)')
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
      for (const a of (acts ?? []) as any[]) {
        if (groupMap[a.operator_id]) {
          groupMap[a.operator_id].activities.push({
            id: a.id,
            description: a.description,
            start_time: a.start_time,
            end_time: a.end_time,
            location: a.location,
            activity_type: a.activity_type ?? null,
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
    setNcDetails({});
    setLoading(true);
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
    operators.reduce((acc, op) => acc + op.checklists.filter(c => c.result === 'not_released').length, 0),
    [operators],
  );

  function renderChecklist(c: ChecklistRow) {
    const isNc = c.result === 'not_released';
    const isPending = c.status === 'pending';
    const isExpanded = expandedChecklist === c.id;
    const time = new Date(c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity
        key={c.id}
        style={[st.checklistRow, isNc && st.checklistRowNc]}
        onPress={() => isNc ? toggleNcDetails(c.id) : undefined}
        activeOpacity={isNc ? 0.7 : 1}
      >
        <View style={st.checklistRowLeft}>
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
        </View>

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
      </TouchableOpacity>
    );
  }

  function renderActivity(a: ActivityRow) {
    const isDone = !!a.end_time;
    const formatTime = (t: string | null) =>
      t ? new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
    const start = formatTime(a.start_time);
    const end = formatTime(a.end_time);
    const timeStr = start
      ? end ? `${start} → ${end}` : `${start} · Em andamento`
      : 'Sem horário';
    const label = a.activity_type?.description || a.description || 'Atividade';

    return (
      <View key={a.id} style={st.activityRow}>
        <Ionicons
          name={isDone ? 'checkmark-circle' : 'time-outline'}
          size={15}
          color={isDone ? colors.success : colors.warning}
        />
        <View style={{ flex: 1 }}>
          <Text style={st.activityLabel} numberOfLines={1}>{label}</Text>
          <Text style={st.activityMeta}>
            {timeStr}{a.location ? ` · ${a.location}` : ''}
          </Text>
        </View>
      </View>
    );
  }

  function renderOperator({ item }: { item: OperatorGroup }) {
    const name = item.full_name || item.email;
    const ncCount = item.checklists.filter(c => c.result === 'not_released').length;
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
        {totalNc > 0 && (
          <View style={st.headerBadge}>
            <Text style={st.headerBadgeText}>{totalNc} NC</Text>
          </View>
        )}
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
  brandName: { fontSize: 16, fontWeight: '800', letterSpacing: 2, color: '#0F172A' },
  headerBadge: {
    backgroundColor: colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  headerBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },

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
  dateLabel: { fontSize: 15, fontWeight: '700', color: '#0F172A' },

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
  operatorName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  operatorMeta: { fontSize: 12, color: '#64748B', marginTop: 1 },

  ncBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.danger,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full,
  },
  ncBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  okBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.success,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full,
  },
  okBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  section: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#94A3B8',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 2,
  },

  activityRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  activityLabel: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  activityMeta: { fontSize: 11, color: '#64748B', marginTop: 1 },

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
  checklistMachine: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  checklistMeta: { fontSize: 11, color: '#64748B', marginTop: 1 },

  ncDetails: {
    marginTop: spacing.sm,
    marginLeft: 24,
    gap: 4,
  },
  ncNone: { fontSize: 12, color: '#64748B', fontStyle: 'italic' },
  ncItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 4,
  },
  ncItemText: { flex: 1, fontSize: 12, color: '#7F1D1D', lineHeight: 16 },

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
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.2, marginBottom: 6 },
  emptyMessage: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20 },
});
