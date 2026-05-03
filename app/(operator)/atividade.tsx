import { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useAuth } from '../../src/contexts/AuthContext';
import { usePendingFinishes } from '../../src/hooks/usePendingFinishes';
import { supabase } from '../../src/lib/supabase';
import { todayLocal } from '../../src/lib/dates';
import { Activity } from '../../src/types/database';
import { colors, elevation, spacing, radius } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';
import { Text } from '../../src/components/ui';
import { AppHeader } from '../../src/components/AppHeader';
import { FinishActivityModal } from '../../src/components/FinishActivityModal';

export default function AtividadeScreen() {
  const { user } = useAuth();
  useKeepAwake();
  const pendingFinishes = usePendingFinishes();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activityToFinish, setActivityToFinish] = useState<Activity | null>(null);

  const today = todayLocal();

  const loadActivities = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('operator_id', user.id)
      .eq('date', today)
      .order('created_at', { ascending: false });
    if (error) Alert.alert('Erro', 'Falha ao carregar atividades.');
    const rows = (data ?? []) as Activity[];
    setActivities(rows);
    setLoading(false);

    // Resolve signed URLs em batch (bucket privado)
    const paths = Array.from(new Set(
      rows
        .map((a) => a.equipment_photo_url ?? a.start_photo_url ?? a.end_photo_url)
        .filter((p): p is string => !!p)
    ));
    if (paths.length === 0) {
      setPhotoUrls({});
      return;
    }
    const { data: signed } = await supabase.storage
      .from('activity-photos')
      .createSignedUrls(paths, 3600);
    const map: Record<string, string> = {};
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) map[s.path] = s.signedUrl;
    }
    setPhotoUrls(map);
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

  const sections = useMemo(() => {
    const ongoing: Activity[] = [];
    const finished: Activity[] = [];
    for (const a of activities) {
      const isQueued = pendingFinishes.activityIds.has(a.id);
      const inProgress = !a.end_time && !isQueued;
      if (inProgress || isQueued) ongoing.push(a);
      else finished.push(a);
    }
    const out: { key: string; title: string; data: Activity[] }[] = [];
    if (ongoing.length) out.push({ key: 'ongoing', title: 'Em andamento', data: ongoing });
    if (finished.length) out.push({ key: 'finished', title: 'Finalizadas', data: finished });
    return out;
  }, [activities, pendingFinishes.activityIds]);

  function formatTime(iso: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDuration(start: string | null, end: string | null): string | null {
    if (!start || !end) return null;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const min = Math.max(1, Math.round(ms / 60000));
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
  }

  function renderActivity({ item }: { item: Activity }) {
    const isQueuedFinish = pendingFinishes.activityIds.has(item.id);
    const inProgress = !item.end_time && !isQueuedFinish;

    const statusColor = isQueuedFinish
      ? colors.warning
      : inProgress
      ? colors.warning
      : colors.success;

    const statusLabel = isQueuedFinish
      ? 'Sincronizando'
      : inProgress
      ? 'Em andamento'
      : 'Finalizada';

    const timeRange = item.end_time
      ? `${formatTime(item.start_time)} - ${formatTime(item.end_time)}`
      : formatTime(item.start_time);
    const duration = formatDuration(item.start_time, item.end_time);

    const photoPath = item.equipment_photo_url ?? item.start_photo_url ?? item.end_photo_url;
    const photoUri = photoPath ? photoUrls[photoPath] ?? null : null;

    return (
      <View style={st.cardWrap}>
        <View style={st.cardRow}>
          {photoUri ? (
            <ExpoImage
              source={{ uri: photoUri }}
              style={st.avatarImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={st.avatarPlaceholder}>
              <Ionicons name="camera-outline" size={26} color={colors.textLight} />
            </View>
          )}

          <View style={st.cardInfo}>
            <Text variant="h3" numberOfLines={2} style={st.title}>
              {item.description}
            </Text>

            <View style={st.metaRow}>
              <View style={st.metaItem}>
                <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                <Text variant="caption" tone="muted">{timeRange}</Text>
              </View>
              {duration ? (
                <>
                  <Text style={st.metaSep}>|</Text>
                  <View style={st.metaItem}>
                    <Ionicons name="hourglass-outline" size={12} color={colors.textSecondary} />
                    <Text variant="caption" tone="muted">{duration}</Text>
                  </View>
                </>
              ) : null}
              {item.location ? (
                <>
                  <Text style={st.metaSep}>|</Text>
                  <View style={st.metaItem}>
                    <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                    <Text variant="caption" tone="muted" numberOfLines={1}>{item.location}</Text>
                  </View>
                </>
              ) : null}
              {item.equipment_tag ? (
                <>
                  <Text style={st.metaSep}>|</Text>
                  <View style={st.metaItem}>
                    <Ionicons name="pricetag-outline" size={12} color={colors.textSecondary} />
                    <Text variant="caption" tone="muted" numberOfLines={1}>{item.equipment_tag}</Text>
                  </View>
                </>
              ) : null}
            </View>

            <View style={st.statusFooter}>
              <View style={st.statusGroup}>
                <View style={[st.statusDot, { backgroundColor: statusColor }]} />
                <Text style={st.statusLabel}>{statusLabel}</Text>
              </View>

              {inProgress && (
                <TouchableOpacity
                  style={st.finishBtn}
                  onPress={() => setActivityToFinish(item)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="stop-circle-outline" size={14} color={colors.white} />
                  <Text style={st.finishBtnText}>Finalizar atividade</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {item.had_interference && (
          <View style={st.interferNote}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.warningDark} />
            <Text variant="caption" tone="warning" style={{ flex: 1 }}>
              Interferência: {item.interference_notes || 'Sim'}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <AppHeader subtitle="Atividades de hoje" />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderActivity}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={st.sectionHeader}>
            <Text style={st.sectionHeaderLabel}>{section.title.toUpperCase()}</Text>
            <View style={st.sectionHeaderLine} />
            <Text style={st.sectionHeaderCount}>{String(section.data.length).padStart(2, '0')}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={st.cardSeparator} />}
        contentContainerStyle={st.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={st.emptyWrap}>
              <View style={st.emptyIcon}>
                <Ionicons name="construct-outline" size={28} color={colors.textSecondary} />
              </View>
              <Text variant="callout" tone="muted" style={{ marginTop: spacing.md, fontWeight: '700' }}>
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
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={colors.white} />
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
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing['3xl'] * 2,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionHeaderLabel: {
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  sectionHeaderLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  sectionHeaderCount: {
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '700',
    color: colors.textLight,
  },

  // Card
  cardWrap: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardInfo: { flex: 1, gap: 6 },
  cardSeparator: { height: 1, backgroundColor: '#E5E7EB' },

  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
    lineHeight: 19,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaSep: { fontSize: 12, color: colors.textLight, fontWeight: '400' },

  statusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 2,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.1,
  },

  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    backgroundColor: colors.text,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  finishBtnText: { fontSize: 12, fontWeight: '700', color: colors.white, letterSpacing: 0.2 },

  interferNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.warningSurface,
    padding: spacing.sm,
    borderRadius: radius.md,
  },

  // Empty
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  fab: {
    position: 'absolute', bottom: spacing.lg, right: spacing.lg,
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    ...elevation.brand,
  },
});
