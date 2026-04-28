import { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { SafetyAlert } from '../../src/types/database';
import { colors, elevation, radius, spacing } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';
import { Badge, Text } from '../../src/components/ui';

const SEVERITY_CONFIG = {
  low: { variant: 'info' as const, label: 'Baixo', icon: 'information-circle-outline' as const },
  medium: { variant: 'warning' as const, label: 'Médio', icon: 'alert-circle-outline' as const },
  high: { variant: 'primary' as const, label: 'Alto', icon: 'warning-outline' as const },
  critical: { variant: 'danger' as const, label: 'Crítico', icon: 'alert-outline' as const },
};

export default function AdminAlertsScreen() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAlerts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('safety_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setAlerts(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-alerts-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'safety_alerts' }, () => {
        loadAlerts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadAlerts]);

  async function onRefresh() {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  }

  function renderAlert({ item }: { item: SafetyAlert }) {
    const config = SEVERITY_CONFIG[item.severity];
    return (
      <View style={[styles.card, !item.read && styles.cardUnread]}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Ionicons name={config.icon} size={14} color={colors.textSecondary} />
            <Text variant="captionStrong" tone="muted">
              {new Date(item.created_at).toLocaleDateString('pt-BR')}
            </Text>
            {item.operator_id === null && (
              <Badge label="TODOS" variant="primary" size="sm" />
            )}
          </View>
          <View style={styles.headerRight}>
            <Badge label={config.label.toUpperCase()} variant={config.variant} size="sm" />
            {!item.read && <View style={styles.unreadDot} />}
          </View>
        </View>

        <Text variant="h3" style={{ marginBottom: 4 }}>{item.title}</Text>
        <Text variant="body" tone="muted" numberOfLines={3} style={{ lineHeight: 20 }}>
          {item.message}
        </Text>

        {item.response && (
          <View style={styles.responseContainer}>
            <Text variant="captionStrong" tone="success">RESPOSTA</Text>
            <Text variant="bodyMedium" style={{ marginTop: 4 }}>{item.response}</Text>
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={renderAlert}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={commonStyles.empty}>
            <Ionicons name="megaphone-outline" size={40} color={colors.textLight} />
            <Text variant="callout" tone="muted" style={{ marginTop: spacing.md }}>Nenhum alerta</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  listContent: { padding: spacing.md, gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...elevation.sm,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  responseContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.successSurface,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
});
