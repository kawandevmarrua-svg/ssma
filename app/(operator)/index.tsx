import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated,
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
} from '../../src/components/ui';
import { useOfflineQueueSize, useDeadLetterCount } from '../../src/hooks/useOfflineQueueSize';

function formatToday() {
  return new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function OperatorHomeScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    checklistsToday: 0,
    activitiesToday: 0,
    unreadAlerts: 0,
  });
  const [safetyMessages, setSafetyMessages] = useState<{ title: string; message: string }[]>([]);
  const [currentMsgIndex, setCurrentMsgIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const today = new Date().toISOString().split('T')[0];

  const loadData = useCallback(async () => {
    if (!user) return;

    const [checklistsRes, activitiesRes, alertsRes, messagesRes] = await Promise.all([
      supabase
        .from('checklists')
        .select('id', { count: 'exact', head: true })
        .eq('operator_id', user.id)
        .eq('date', today),
      supabase
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('operator_id', user.id)
        .eq('date', today),
      supabase
        .from('safety_alerts')
        .select('id', { count: 'exact', head: true })
        .or(`operator_id.eq.${user.id},operator_id.is.null`)
        .eq('read', false),
      supabase
        .from('safety_alerts')
        .select('title, message')
        .or(`operator_id.eq.${user.id},operator_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    setStats({
      checklistsToday: checklistsRes.count ?? 0,
      activitiesToday: activitiesRes.count ?? 0,
      unreadAlerts: alertsRes.count ?? 0,
    });

    if (messagesRes.data && messagesRes.data.length > 0) {
      setSafetyMessages(messagesRes.data);
    }
  }, [user, today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  const name = profile?.full_name || 'Operador';
  const firstName = name.split(' ')[0];
  // Auto-rotate safety messages every 6s
  useEffect(() => {
    if (safetyMessages.length <= 1) return;
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setCurrentMsgIndex((prev) => (prev + 1) % safetyMessages.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 6000);
    return () => clearInterval(interval);
  }, [safetyMessages.length, fadeAnim]);

  const pendingOffline = useOfflineQueueSize();
  const deadLetterCount = useDeadLetterCount();

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
            <Text variant="caption" tone="muted">Operador · {formatToday()}</Text>
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

      {deadLetterCount > 0 && (
        <View style={styles.deadLetterBanner}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text variant="caption" style={styles.deadLetterText}>
            {deadLetterCount} {deadLetterCount === 1 ? 'envio falhou' : 'envios falharam'} após várias tentativas. Acione o suporte.
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

      {/* Card de mensagens de segurança */}
      {safetyMessages.length > 0 && (
        <View style={styles.safetyCard} onTouchEnd={() => router.push('/(operator)/alerts')}>
          <View style={styles.safetyHeader}>
            <Ionicons name="shield-checkmark" size={20} color="#fff" />
            <Text variant="captionStrong" style={styles.safetyHeaderText}>
              SEGURANÇA
            </Text>
            {safetyMessages.length > 1 && (
              <Text variant="caption" style={styles.safetyCounter}>
                {currentMsgIndex + 1}/{safetyMessages.length}
              </Text>
            )}
          </View>
          <Animated.View style={{ opacity: fadeAnim }}>
            <Text variant="bodyStrong" style={styles.safetyTitle}>
              {safetyMessages[currentMsgIndex]?.title}
            </Text>
            <Text variant="caption" style={styles.safetyMessage} numberOfLines={3}>
              {safetyMessages[currentMsgIndex]?.message}
            </Text>
          </Animated.View>
        </View>
      )}
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
  safetyCard: {
    backgroundColor: '#F97316',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  safetyHeaderText: {
    color: '#fff',
    flex: 1,
  },
  safetyCounter: {
    color: 'rgba(255,255,255,0.7)',
  },
  safetyTitle: {
    color: '#fff',
    marginBottom: 4,
  },
  safetyMessage: {
    color: 'rgba(255,255,255,0.9)',
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
  deadLetterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  deadLetterText: {
    flex: 1,
    color: colors.danger,
  },
});
