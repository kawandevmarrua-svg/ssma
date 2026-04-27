import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { SafetyAlert } from '../../src/types/database';
import { colors, spacing, radius, fontSize } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';

const SEVERITY_CONFIG = {
  low: { color: colors.primaryLight, bg: colors.primaryLight + '20', label: 'Baixo', icon: 'information-circle' as const },
  medium: { color: colors.warning, bg: colors.warningLight, label: 'Medio', icon: 'alert-circle' as const },
  high: { color: '#F97316', bg: '#FFF7ED', label: 'Alto', icon: 'warning' as const },
  critical: { color: colors.danger, bg: colors.dangerLight, label: 'Critico', icon: 'alert' as const },
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
      <View style={[commonStyles.card, !item.read && styles.cardUnread]}>
        <View style={styles.cardRow}>
          <View style={[styles.severityIcon, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon} size={24} color={config.color} />
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {!item.read && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.cardMessage} numberOfLines={3}>{item.message}</Text>
            <View style={styles.cardMeta}>
              <View style={[styles.severityBadge, { backgroundColor: config.bg }]}>
                <Text style={[styles.severityText, { color: config.color }]}>{config.label}</Text>
              </View>
              <Text style={styles.cardDate}>
                {new Date(item.created_at).toLocaleDateString('pt-BR')}
              </Text>
              {item.operator_id === null && (
                <View style={styles.broadcastBadge}>
                  <Text style={styles.broadcastText}>Todos</Text>
                </View>
              )}
            </View>
            {item.response && (
              <View style={styles.responseContainer}>
                <Text style={styles.responseLabel}>Resposta:</Text>
                <Text style={styles.responseText}>{item.response}</Text>
              </View>
            )}
          </View>
        </View>
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
        contentContainerStyle={commonStyles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={commonStyles.empty}>
            <Ionicons name="megaphone-outline" size={48} color={colors.textLight} />
            <Text style={commonStyles.emptyText}>Nenhum alerta</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  severityIcon: { width: 44, height: 44, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, marginLeft: spacing.md },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: fontSize.base, fontWeight: '700', color: colors.text, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: spacing.sm },
  cardMessage: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm },
  severityBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  severityText: { fontSize: fontSize.xs, fontWeight: '600' },
  cardDate: { fontSize: fontSize.xs, color: colors.textLight },
  broadcastBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.primary + '20' },
  broadcastText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.primary },
  responseContainer: {
    marginTop: spacing.sm, padding: spacing.sm,
    backgroundColor: colors.success + '10', borderRadius: radius.sm,
    borderLeftWidth: 3, borderLeftColor: colors.success,
  },
  responseLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.success, marginBottom: 2 },
  responseText: { fontSize: fontSize.sm, color: colors.text },
});
