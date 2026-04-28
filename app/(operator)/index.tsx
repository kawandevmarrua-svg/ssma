import { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { colors, radius, spacing } from '../../src/theme/colors';
import {
  Text,
  Avatar,
  StatCard,
  ListItem,
} from '../../src/components/ui';
import { useOfflineQueueSize } from '../../src/hooks/useOfflineQueueSize';

function formatToday() {
  return new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function OperatorHomeScreen() {
  const { profile, operatorData } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    checklistsToday: 0,
    activitiesToday: 0,
    unreadAlerts: 0,
  });

  const today = new Date().toISOString().split('T')[0];

  const loadData = useCallback(async () => {
    if (!operatorData) return;

    const [checklistsRes, activitiesRes, alertsRes] = await Promise.all([
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

  const name = profile?.full_name || operatorData?.name || 'Operador';
  const firstName = name.split(' ')[0];
  const pendingOffline = useOfflineQueueSize();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header — estilo "Release iOS" */}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text variant="display">{firstName}</Text>
          <View style={styles.metaRow}>
            <Text variant="caption" tone="muted">Operador ·</Text>
            <Text variant="caption" tone="primary" style={styles.metaLink}>
              {operatorData?.role || 'Sem função'}
            </Text>
            <Text variant="caption" tone="muted">· {formatToday()}</Text>
          </View>
        </View>
        <Avatar name={name} size="md" />
      </View>

      {pendingOffline > 0 && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
          <Text variant="caption" style={styles.offlineText}>
            {pendingOffline} {pendingOffline === 1 ? 'item aguardando envio' : 'itens aguardando envio'} — serão sincronizados ao reconectar.
          </Text>
        </View>
      )}

      {/* Stats — grid de cards no estilo da imagem */}
      <View style={styles.statsRow}>
        <StatCard
          icon="checkbox-outline"
          value={stats.checklistsToday}
          label="Checklists hoje"
          tone="primary"
          onPress={() => router.push('/(operator)/checklist')}
        />
        <StatCard
          icon="construct-outline"
          value={stats.activitiesToday}
          label="Atividades"
          tone="neutral"
          onPress={() => router.push('/(operator)/atividade')}
        />
      </View>

      <View style={styles.statsRow}>
        <StatCard
          icon="notifications-outline"
          value={stats.unreadAlerts}
          label="Alertas ativos"
          tone={stats.unreadAlerts > 0 ? 'primary' : 'neutral'}
          onPress={() => router.push('/(operator)/alerts')}
          meta={stats.unreadAlerts > 0 ? 'Ver todos' : undefined}
        />
      </View>

      {/* Ações */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionLeft}>
          <Ionicons name="flash-outline" size={14} color={colors.textSecondary} />
          <Text variant="captionStrong" tone="muted">AÇÕES RÁPIDAS</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <ListItem
          icon="clipboard-outline"
          iconTone="primary"
          title="Novo checklist pré-uso"
          subtitle="Inspecione o equipamento antes de operar"
          onPress={() => router.push('/(operator)/checklist')}
        />
        <ListItem
          icon="add-circle-outline"
          iconTone="neutral"
          title="Registrar atividade"
          subtitle="Inicie uma nova atividade do turno"
          onPress={() => router.push('/(operator)/atividade')}
        />
        <ListItem
          icon="warning-outline"
          iconTone="neutral"
          title="Alertas de segurança"
          subtitle={
            stats.unreadAlerts > 0
              ? `${stats.unreadAlerts} alerta(s) sem leitura`
              : 'Nenhum alerta pendente'
          }
          onPress={() => router.push('/(operator)/alerts')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  headerText: { flex: 1 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: spacing.xs,
  },
  metaLink: { fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing['2xs'],
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actions: {
    gap: spacing.sm,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  offlineText: {
    flex: 1,
    color: colors.textSecondary,
  },
});
