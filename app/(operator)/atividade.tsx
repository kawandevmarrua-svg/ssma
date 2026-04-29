import { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useAuth } from '../../src/contexts/AuthContext';
import { usePendingFinishes } from '../../src/hooks/usePendingFinishes';
import { supabase } from '../../src/lib/supabase';
import { Activity } from '../../src/types/database';
import { colors, elevation, spacing, radius } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';
import { Badge, Button, Text } from '../../src/components/ui';
import { FinishActivityModal } from '../../src/components/FinishActivityModal';

export default function AtividadeScreen() {
  const { user } = useAuth();
  useKeepAwake();
  const pendingFinishes = usePendingFinishes();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activityToFinish, setActivityToFinish] = useState<Activity | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const loadActivities = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('operator_id', user.id)
      .eq('date', today)
      .order('created_at', { ascending: false });
    if (error) Alert.alert('Erro', 'Falha ao carregar atividades.');
    setActivities(data ?? []);
    setLoading(false);
  }, [user, today]);

  useFocusEffect(
    useCallback(() => {
      loadActivities();
    }, [loadActivities]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  }

  function formatTime(iso: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function renderActivity({ item }: { item: Activity }) {
    const isQueuedFinish = pendingFinishes.activityIds.has(item.id);
    const inProgress = !item.end_time && !isQueuedFinish;
    return (
      <View style={[st.card, inProgress && st.ongoingCard]}>
        <View style={st.cardHeader}>
          <View style={st.headerLeft}>
            <Ionicons
              name={isQueuedFinish ? 'cloud-upload-outline' : inProgress ? 'time-outline' : 'checkmark-circle-outline'}
              size={14}
              color={colors.textSecondary}
            />
            <Text variant="captionStrong" tone="muted">
              {formatTime(item.start_time)}{item.end_time ? ` - ${formatTime(item.end_time)}` : ''}
            </Text>
          </View>
          <Badge
            label={isQueuedFinish ? 'SINCRONIZANDO' : inProgress ? 'EM ANDAMENTO' : 'FINALIZADA'}
            variant={isQueuedFinish ? 'warning' : inProgress ? 'warning' : 'success'}
            size="sm"
          />
        </View>

        <Text variant="h3" numberOfLines={2} style={{ marginBottom: 4 }}>
          {item.description}
        </Text>
        <View style={st.metaRow}>
          {item.location && (
            <View style={st.metaItem}>
              <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
              <Text variant="caption" tone="muted">{item.location}</Text>
            </View>
          )}
          {item.equipment_tag && (
            <View style={st.metaItem}>
              <Ionicons name="pricetag-outline" size={12} color={colors.textSecondary} />
              <Text variant="caption" tone="muted">{item.equipment_tag}</Text>
            </View>
          )}
        </View>

        {item.had_interference && (
          <View style={st.interferNote}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.warningDark} />
            <Text variant="caption" tone="warning" style={{ flex: 1 }}>
              Interferência: {item.interference_notes || 'Sim'}
            </Text>
          </View>
        )}

        {inProgress && (
          <Button
            label="Finalizar atividade"
            icon="stop-circle-outline"
            variant="primary"
            size="md"
            fullWidth
            onPress={() => setActivityToFinish(item)}
            style={{ marginTop: spacing.md }}
          />
        )}
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={renderActivity}
        contentContainerStyle={commonStyles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={commonStyles.empty}>
              <Ionicons name="construct-outline" size={40} color={colors.textLight} />
              <Text variant="callout" tone="muted" style={{ marginTop: spacing.md }}>
                Nenhuma atividade hoje
              </Text>
              <Text variant="caption" tone="subtle" style={{ marginTop: 4 }}>
                Toque em + para registrar
              </Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        style={st.fab}
        onPress={() => router.push('/(operator)/selecionar-atividade')}
      >
        <Ionicons name="add" size={26} color={colors.white} />
      </TouchableOpacity>

      <FinishActivityModal
        activity={activityToFinish}
        userId={user?.id}
        onClose={() => setActivityToFinish(null)}
        onFinished={() => { setActivityToFinish(null); loadActivities(); }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.sm,
  },
  ongoingCard: { borderLeftWidth: 3, borderLeftColor: colors.warning },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  interferNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.warningSurface,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  fab: {
    position: 'absolute', bottom: spacing.lg, right: spacing.lg,
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    ...elevation.brand,
  },
});
