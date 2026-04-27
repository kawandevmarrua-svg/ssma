import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { colors, spacing, radius, fontSize } from '../../src/theme/colors';

export default function OperatorHomeScreen() {
  const { profile, operatorData, signOut } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [preOpDone, setPreOpDone] = useState(false);
  const [stats, setStats] = useState({
    checklistsToday: 0,
    activitiesToday: 0,
    unreadAlerts: 0,
  });

  const today = new Date().toISOString().split('T')[0];

  const loadData = useCallback(async () => {
    if (!operatorData) return;

    const [preOpRes, checklistsRes, activitiesRes, alertsRes] = await Promise.all([
      supabase
        .from('pre_operation_checks')
        .select('id')
        .eq('operator_id', operatorData.id)
        .eq('date', today)
        .limit(1),
      supabase
        .from('checklists')
        .select('id', { count: 'exact', head: true })
        .eq('operator_id', operatorData.id)
        .eq('date', today),
      supabase
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('operator_id', operatorData.id)
        .eq('date', today),
      supabase
        .from('safety_alerts')
        .select('id', { count: 'exact', head: true })
        .or(`operator_id.eq.${operatorData.id},operator_id.is.null`)
        .eq('read', false),
    ]);

    setPreOpDone((preOpRes.data?.length ?? 0) > 0);
    setStats({
      checklistsToday: checklistsRes.count ?? 0,
      activitiesToday: activitiesRes.count ?? 0,
      unreadAlerts: alertsRes.count ?? 0,
    });
  }, [operatorData, today]);

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.welcome}>
        <View>
          <Text style={styles.greeting}>Ola,</Text>
          <Text style={styles.name}>{profile?.full_name || operatorData?.name || 'Operador'}</Text>
          {operatorData?.role && <Text style={styles.role}>{operatorData.role}</Text>}
        </View>
        <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.preOpCard, preOpDone ? styles.preOpDone : styles.preOpPending]}
        onPress={() => router.push('/(operator)/pre-operacao')}
      >
        <Ionicons
          name={preOpDone ? 'checkmark-circle' : 'alert-circle'}
          size={32}
          color={preOpDone ? colors.success : colors.warning}
        />
        <View style={styles.preOpText}>
          <Text style={styles.preOpTitle}>
            {preOpDone ? 'Pre-Operacao Concluida' : 'Pre-Operacao Pendente'}
          </Text>
          <Text style={styles.preOpSub}>
            {preOpDone
              ? 'Verificacao do dia realizada com sucesso'
              : 'Toque para preencher a verificacao diaria'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
      </TouchableOpacity>

      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(operator)/checklist')}>
          <Ionicons name="checkbox" size={28} color={colors.success} />
          <Text style={styles.statNumber}>{stats.checklistsToday}</Text>
          <Text style={styles.statLabel}>Checklists Hoje</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(operator)/atividade')}>
          <Ionicons name="construct" size={28} color={colors.primary} />
          <Text style={styles.statNumber}>{stats.activitiesToday}</Text>
          <Text style={styles.statLabel}>Atividades Hoje</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(operator)/alerts')}>
          <Ionicons name="warning" size={28} color={colors.warning} />
          <Text style={styles.statNumber}>{stats.unreadAlerts}</Text>
          <Text style={styles.statLabel}>Alertas</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Acoes Rapidas</Text>

      <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(operator)/checklist')}>
        <View style={[styles.actionIcon, { backgroundColor: colors.success + '20' }]}>
          <Ionicons name="clipboard" size={24} color={colors.success} />
        </View>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Novo Checklist Pre-Uso</Text>
          <Text style={styles.actionSub}>Inspecionar equipamento antes do uso</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(operator)/atividade')}>
        <View style={[styles.actionIcon, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="add-circle" size={24} color={colors.primary} />
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
  content: { padding: spacing.md },
  welcome: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: { fontSize: fontSize.sm, color: colors.textSecondary },
  name: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  role: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  logoutBtn: { padding: spacing.sm },
  preOpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  preOpDone: {
    backgroundColor: colors.success + '15',
    borderWidth: 1,
    borderColor: colors.success + '30',
  },
  preOpPending: {
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  preOpText: { flex: 1, marginLeft: spacing.md },
  preOpTitle: { fontSize: fontSize.base, fontWeight: '700', color: colors.text },
  preOpSub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statNumber: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text, marginTop: spacing.xs },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionIcon: { width: 44, height: 44, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' },
  actionText: { flex: 1, marginLeft: spacing.md },
  actionTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.text },
  actionSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
});
