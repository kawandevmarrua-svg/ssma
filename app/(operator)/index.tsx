import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated,
  Dimensions,
  Easing,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { colors, radius, spacing, elevation, fontSize } from '../../src/theme/colors';
import { Text, Avatar, StatCard } from '../../src/components/ui';
import { useOfflineQueueSize, useDeadLetterCount } from '../../src/hooks/useOfflineQueueSize';

function formatToday() {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const parts = formatter.format(new Date());
  return parts.charAt(0).toUpperCase() + parts.slice(1);
}

const DEFAULT_SAFETY_MESSAGES: { title: string; message: string }[] = [
  {
    title: 'Segurança em primeiro lugar.',
    message: 'Nenhuma tarefa é tão urgente que não possa ser feita com segurança. Em caso de dúvida, pare e pergunte.',
  },
  {
    title: 'Você é o ponto de bloqueio.',
    message: 'Identificou uma condição insegura? Pare a operação e comunique imediatamente o encarregado.',
  },
  {
    title: 'Cuide de você e do colega.',
    message: 'Sua vida e a do seu colega dependem das suas atitudes. Trabalhe atento e respeite os procedimentos.',
  },
  {
    title: 'Antes de iniciar, reavalie.',
    message: 'Mudou o cenário? Mudou o equipamento? Mudou a equipe? Refaça a análise de risco antes de começar.',
  },
  {
    title: 'EPI sempre, sem exceção.',
    message: 'Use os EPIs corretos para a atividade. Eles existem para te proteger e voltar bem para casa.',
  },
];

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');
const SAFETY_CARD_HEIGHT = Math.round(WINDOW_HEIGHT * 0.4);

export default function OperatorHomeScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ checklistsToday: 0, activitiesToday: 0, unreadAlerts: 0 });
  const [safetyMessages, setSafetyMessages] = useState(DEFAULT_SAFETY_MESSAGES);
  const [currentMsgIndex, setCurrentMsgIndex] = useState(0);

  // Animations
  const msgFade = useRef(new Animated.Value(1)).current;
  const msgSlide = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const safetyAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;

  const today = new Date().toISOString().split('T')[0];

  const loadData = useCallback(async () => {
    if (!user) return;
    const [checklistsRes, activitiesRes, alertsRes, messagesRes] = await Promise.all([
      supabase.from('checklists').select('id', { count: 'exact', head: true })
        .eq('operator_id', user.id).eq('date', today),
      supabase.from('activities').select('id', { count: 'exact', head: true })
        .eq('operator_id', user.id).eq('date', today),
      supabase.from('safety_alerts').select('id', { count: 'exact', head: true })
        .or(`operator_id.eq.${user.id},operator_id.is.null`).eq('read', false),
      supabase.from('safety_alerts').select('title, message')
        .or(`operator_id.eq.${user.id},operator_id.is.null`)
        .order('created_at', { ascending: false }).limit(10),
    ]);
    setStats({
      checklistsToday: checklistsRes.count ?? 0,
      activitiesToday: activitiesRes.count ?? 0,
      unreadAlerts: alertsRes.count ?? 0,
    });
    if (messagesRes.data && messagesRes.data.length > 0) {
      setSafetyMessages(messagesRes.data);
    } else {
      setSafetyMessages(DEFAULT_SAFETY_MESSAGES);
    }
  }, [user, today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Stagger entrance
  useEffect(() => {
    Animated.stagger(100, [
      Animated.timing(headerAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(safetyAnim, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(statsAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [headerAnim, safetyAnim, statsAnim]);

  // Cross-fade + slide for messages
  useEffect(() => {
    if (safetyMessages.length <= 1) return;
    const interval = setInterval(() => {
      Animated.parallel([
        Animated.timing(msgFade, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(msgSlide, { toValue: -20, duration: 280, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        setCurrentMsgIndex((prev) => (prev + 1) % safetyMessages.length);
        msgSlide.setValue(20);
        Animated.parallel([
          Animated.timing(msgFade, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(msgSlide, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
      });
    }, 7000);
    return () => clearInterval(interval);
  }, [safetyMessages.length, msgFade, msgSlide]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  function jumpTo(idx: number) {
    if (idx === currentMsgIndex) return;
    const dir = idx > currentMsgIndex ? -20 : 20;
    Animated.parallel([
      Animated.timing(msgFade, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(msgSlide, { toValue: dir, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setCurrentMsgIndex(idx);
      msgSlide.setValue(-dir);
      Animated.parallel([
        Animated.timing(msgFade, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(msgSlide, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  }

  const name = profile?.full_name || 'Operador';
  const firstName = name.split(' ')[0];

  const pendingOffline = useOfflineQueueSize();
  const deadLetterCount = useDeadLetterCount();

  const headerStyle = {
    opacity: headerAnim,
    transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
  };
  const safetyStyle = {
    opacity: safetyAnim,
    transform: [
      { translateY: safetyAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
    ],
  };
  const statsStyle = {
    opacity: statsAnim,
    transform: [{ translateY: statsAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };

  const current = safetyMessages[currentMsgIndex];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing['3xl'] }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <Animated.View style={[styles.header, headerStyle]}>
        <View style={styles.headerLeft}>
          <Text style={styles.nameText}>{firstName}</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {formatToday()}
          </Text>
        </View>
        <Avatar name={name} size="md" />
      </Animated.View>

      <View style={styles.heroSpacerTop} />

      {/* HERO SAFETY CARD */}
      <Animated.View style={safetyStyle}>
        <Pressable
          onPress={() => router.push('/(operator)/alerts')}
          style={({ pressed }) => [styles.safetyCard, pressed && styles.safetyCardPressed]}
        >
          {/* Top bar */}
          <View style={styles.safetyTopBar}>
            <View style={styles.brandTag}>
              <View style={styles.brandDot} />
              <Text variant="micro" style={styles.brandTagText}>SSMA</Text>
            </View>
            <View style={styles.counterPill}>
              <Text variant="micro" style={styles.counterText}>
                {String(currentMsgIndex + 1).padStart(2, '0')} / {String(safetyMessages.length).padStart(2, '0')}
              </Text>
            </View>
          </View>

          {/* Body */}
          <Animated.View
            style={[
              styles.safetyBody,
              { opacity: msgFade, transform: [{ translateY: msgSlide }] },
            ]}
          >
            <Text style={styles.safetyEyebrow}>MENSAGEM DE SEGURANÇA</Text>
            <Text style={styles.safetyTitle}>{current?.title}</Text>
            <View style={styles.accentBar} />
            <Text style={styles.safetyMessage}>{current?.message}</Text>
          </Animated.View>

          {/* Bottom row: dots + cta */}
          <View style={styles.safetyFooter}>
            {safetyMessages.length > 1 ? (
              <View style={styles.dotsRow}>
                {safetyMessages.map((_, idx) => (
                  <TouchableOpacity
                    key={idx}
                    hitSlop={8}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      jumpTo(idx);
                    }}
                    style={[styles.dot, idx === currentMsgIndex && styles.dotActive]}
                  />
                ))}
              </View>
            ) : (
              <View />
            )}
            <View style={styles.ctaRow}>
              <Text style={styles.ctaText}>Ver alertas</Text>
              <Ionicons name="arrow-forward" size={14} color="#EA580C" />
            </View>
          </View>
        </Pressable>
      </Animated.View>

      {/* BANNERS */}
      {pendingOffline > 0 && (
        <Animated.View style={[styles.banner, statsStyle]}>
          <View style={styles.bannerIcon}>
            <Ionicons name="cloud-upload-outline" size={16} color={colors.primary} />
          </View>
          <Text variant="caption" style={{ flex: 1, color: colors.textSecondary }}>
            {pendingOffline} {pendingOffline === 1 ? 'item aguardando envio' : 'itens aguardando envio'} — sincroniza ao reconectar.
          </Text>
        </Animated.View>
      )}

      {deadLetterCount > 0 && (
        <Animated.View style={[styles.banner, styles.bannerDanger, statsStyle]}>
          <View style={[styles.bannerIcon, { backgroundColor: colors.dangerSurface }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
          </View>
          <Text variant="caption" style={{ flex: 1, color: colors.danger, fontWeight: '600' }}>
            {deadLetterCount} {deadLetterCount === 1 ? 'envio falhou' : 'envios falharam'} após várias tentativas.
          </Text>
        </Animated.View>
      )}

      {/* STATS */}
      <Animated.View style={statsStyle}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>HOJE</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.statsRow}>
          <StatCard
            icon="checkbox-outline"
            value={stats.checklistsToday}
            label="Checklists"
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

        <Pressable
          onPress={() => router.push('/(operator)/alerts')}
          style={({ pressed }) => [styles.alertsRow, pressed && { opacity: 0.92, transform: [{ scale: 0.997 }] }]}
        >
          <View style={[styles.alertIconBadge, stats.unreadAlerts > 0 && styles.alertIconBadgeActive]}>
            <Ionicons
              name="notifications"
              size={18}
              color={stats.unreadAlerts > 0 ? colors.white : colors.textSecondary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">
              {stats.unreadAlerts > 0
                ? `${stats.unreadAlerts} ${stats.unreadAlerts === 1 ? 'alerta ativo' : 'alertas ativos'}`
                : 'Tudo em ordem'}
            </Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
              {stats.unreadAlerts > 0 ? 'Toque para visualizar' : 'Nenhum alerta pendente'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing['3xl'],
  },

  // HEADER
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerLeft: { flex: 1 },
  nameText: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    color: colors.text,
    lineHeight: 40,
  },

  // Espaçador para empurrar o card para o meio
  heroSpacerTop: { height: spacing.md },

  // HERO SAFETY CARD (orange)
  safetyCard: {
    backgroundColor: '#EA580C',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    height: SAFETY_CARD_HEIGHT,
    overflow: 'hidden',
    shadowColor: '#9A3412',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 10,
  },
  safetyCardPressed: { opacity: 0.96, transform: [{ scale: 0.997 }] },

  safetyTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  brandTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  brandDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#fff',
  },
  brandTagText: {
    color: '#fff',
    letterSpacing: 1.4,
    fontWeight: '800',
  },
  counterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  counterText: {
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 1,
    fontWeight: '700',
  },

  safetyBody: {
    flex: 1,
    justifyContent: 'center',
  },
  safetyEyebrow: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  safetyTitle: {
    color: '#fff',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.7,
    marginBottom: spacing.md,
  },
  accentBar: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#fff',
    marginBottom: spacing.md,
  },
  safetyMessage: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    lineHeight: 23,
    maxWidth: WINDOW_WIDTH * 0.82,
  },

  safetyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    width: 22,
    backgroundColor: '#fff',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: '#fff',
  },
  ctaText: {
    color: '#EA580C',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // BANNERS
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.sm,
  },
  bannerDanger: {
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerLight,
  },
  bannerIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
  },

  // SECTION
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    marginLeft: 2,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '800',
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },

  // STATS
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },

  // ALERTS ROW
  alertsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.sm,
  },
  alertIconBadge: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  alertIconBadgeActive: {
    backgroundColor: colors.primary,
  },
});
