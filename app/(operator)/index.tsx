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
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { todayLocal } from '../../src/lib/dates';
import { colors, radius, spacing } from '../../src/theme/colors';
import { Text } from '../../src/components/ui';
import { AppHeader } from '../../src/components/AppHeader';
import { useOfflineQueueSize, useDeadLetterCount } from '../../src/hooks/useOfflineQueueSize';

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
const HERO_HEIGHT = Math.round(WINDOW_HEIGHT * 0.36);

const APP_VERSION = (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';

export default function OperatorHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ checklistsToday: 0, activitiesToday: 0, unreadAlerts: 0 });
  const [safetyMessages, setSafetyMessages] = useState(DEFAULT_SAFETY_MESSAGES);
  const [currentMsgIndex, setCurrentMsgIndex] = useState(0);

  // Animations
  const msgFade = useRef(new Animated.Value(1)).current;
  const msgSlide = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const today = todayLocal();

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
      Animated.timing(heroAnim, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(statsAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [headerAnim, heroAnim, statsAnim]);

  // Pulse for the live status indicator
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

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

  const pendingOffline = useOfflineQueueSize();
  const deadLetterCount = useDeadLetterCount();

  const headerStyle = {
    opacity: headerAnim,
    transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
  };
  const heroStyle = {
    opacity: heroAnim,
    transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  };
  const statsStyle = {
    opacity: statsAnim,
    transform: [{ translateY: statsAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };

  const pulseRingStyle = {
    opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
    transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
  };

  const current = safetyMessages[currentMsgIndex];

  return (
    <View style={styles.container}>
      {/* HEADER FIXO — compartilhado com as demais telas */}
      <Animated.View style={headerStyle}>
        <AppHeader />
      </Animated.View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: spacing.md, paddingBottom: spacing['3xl'] }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
      {/* LIVE STATUS BAR */}
      <Animated.View style={[styles.statusBar, headerStyle]}>
        <View style={styles.statusLeft}>
          <View style={styles.pulseWrap}>
            <Animated.View style={[styles.pulseRing, pulseRingStyle]} />
            <View style={styles.pulseDot} />
          </View>
          <Text style={styles.statusText}>SISTEMA OPERANTE</Text>
        </View>
        <View style={styles.statusDivider} />
        <Text style={styles.statusMono}>v{APP_VERSION}</Text>
        <View style={styles.statusDivider} />
        <Text style={styles.statusMono}>ID·{user?.id ? user.id.slice(0, 6).toUpperCase() : '------'}</Text>
      </Animated.View>

      {/* HERO SAFETY CARD — white tech */}
      <Animated.View style={heroStyle}>
        <Pressable
          onPress={() => router.push('/(operator)/alerts')}
          style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}
        >
          {/* Tech grid lines */}
          <View pointerEvents="none" style={styles.gridLayer}>
            <View style={[styles.gridLine, styles.gridV, { left: '25%' }]} />
            <View style={[styles.gridLine, styles.gridV, { left: '50%' }]} />
            <View style={[styles.gridLine, styles.gridV, { left: '75%' }]} />
            <View style={[styles.gridLine, styles.gridH, { top: '33%' }]} />
            <View style={[styles.gridLine, styles.gridH, { top: '66%' }]} />
          </View>

          {/* HUD corner ticks */}
          <View pointerEvents="none" style={[styles.corner, styles.cornerTL]} />
          <View pointerEvents="none" style={[styles.corner, styles.cornerTR]} />
          <View pointerEvents="none" style={[styles.corner, styles.cornerBL]} />
          <View pointerEvents="none" style={[styles.corner, styles.cornerBR]} />

          {/* Top bar */}
          <View style={styles.heroTopBar}>
            <View style={styles.brandTag}>
              <View style={styles.brandDot} />
              <Text style={styles.brandTagText}>SSMA</Text>
            </View>
            <View style={styles.counterPill}>
              <Text style={styles.counterText}>
                {String(currentMsgIndex + 1).padStart(2, '0')} / {String(safetyMessages.length).padStart(2, '0')}
              </Text>
            </View>
          </View>

          {/* Body */}
          <Animated.View
            style={[
              styles.heroBody,
              { opacity: msgFade, transform: [{ translateY: msgSlide }] },
            ]}
          >
            <Text style={styles.heroEyebrow}>MENSAGEM DE SEGURANÇA</Text>
            <Text style={styles.heroTitle}>{current?.title}</Text>
            <View style={styles.accentBar} />
            <Text style={styles.heroMessage}>{current?.message}</Text>
          </Animated.View>

          {/* Footer: dots + cta */}
          <View style={styles.heroFooter}>
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
              <Text style={styles.ctaText}>VER ALERTAS</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.white} />
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

      {/* STATS — 3 cards estilo HUD */}
      <Animated.View style={statsStyle}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLine} />
          <Text style={styles.sectionLabel}>HOJE</Text>
          <View style={styles.sectionHeaderLine} />
        </View>

        <View style={styles.statsRow}>
          <TechStat
            icon="checkbox-outline"
            value={stats.checklistsToday}
            label="Checklists"
            onPress={() => router.push('/(operator)/checklist')}
          />
          <TechStat
            icon="construct-outline"
            value={stats.activitiesToday}
            label="Atividades"
            onPress={() => router.push('/(operator)/atividade')}
          />
          <TechStat
            icon="notifications-outline"
            value={stats.unreadAlerts}
            label="Alertas"
            highlight={stats.unreadAlerts > 0}
            onPress={() => router.push('/(operator)/alerts')}
          />
        </View>

        {/* Acesso rápido */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLine} />
          <Text style={styles.sectionLabel}>ACESSO RÁPIDO</Text>
          <View style={styles.sectionHeaderLine} />
        </View>

        <View style={styles.shortcuts}>
          <Shortcut icon="clipboard-outline" label="Pré-Operação" onPress={() => router.push('/(operator)/pre-operacao')} />
          <Shortcut icon="pause-circle-outline" label="Parada" onPress={() => router.push('/(operator)/parada')} />
          <Shortcut icon="hammer-outline" label="Serviço" onPress={() => router.push('/(operator)/servico')} />
          <Shortcut icon="time-outline" label="Atividade" onPress={() => router.push('/(operator)/atividade')} />
        </View>
      </Animated.View>
      </ScrollView>
    </View>
  );
}

/* --------------------------------- pieces -------------------------------- */

function TechStat({
  icon,
  value,
  label,
  onPress,
  highlight,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  onPress?: () => void;
  highlight?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        statStyles.card,
        highlight && statStyles.cardHighlight,
        pressed && { opacity: 0.95, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={statStyles.iconWrap}>
        <Ionicons name={icon} size={14} color={highlight ? colors.primary : colors.textSecondary} />
      </View>
      <Text style={[statStyles.value, ...(highlight ? [{ color: colors.primary }] : [])]}>
        {String(value).padStart(2, '0')}
      </Text>
      <Text style={statStyles.label}>{label}</Text>
      <View style={statStyles.tickRow}>
        <View style={statStyles.tick} />
        <View style={[statStyles.tick, statStyles.tickTall]} />
        <View style={statStyles.tick} />
        <View style={statStyles.tick} />
        <View style={[statStyles.tick, statStyles.tickTall, highlight && { backgroundColor: colors.primary }]} />
        <View style={statStyles.tick} />
        <View style={statStyles.tick} />
      </View>
    </Pressable>
  );
}

function Shortcut({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        shortcutStyles.item,
        pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={shortcutStyles.iconWrap}>
        <Ionicons name={icon} size={20} color={colors.text} />
      </View>
      <Text style={shortcutStyles.label}>{label}</Text>
    </Pressable>
  );
}

/* --------------------------------- styles -------------------------------- */

const TECH_BORDER = '#E5E7EB';
const TECH_BORDER_STRONG = '#0F172A';
const TECH_BG = '#FFFFFF';
const TECH_BG_SOFT = '#F8FAFC';
const TECH_TEXT = '#0F172A';
const TECH_TEXT_MUTED = '#64748B';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TECH_BG },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },

  // STATUS BAR
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: TECH_BORDER,
    backgroundColor: TECH_BG_SOFT,
    marginBottom: spacing.md,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseWrap: {
    width: 10, height: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#10B981',
  },
  pulseDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '800',
    color: TECH_TEXT,
  },
  statusDivider: {
    width: 1, height: 12,
    backgroundColor: TECH_BORDER,
  },
  statusMono: {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
    color: TECH_TEXT_MUTED,
  },

  // HERO
  hero: {
    backgroundColor: TECH_BG,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    height: HERO_HEIGHT,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: TECH_BORDER,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  heroPressed: { opacity: 0.97, transform: [{ scale: 0.997 }] },

  gridLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: '#F1F5F9',
  },
  gridV: { width: 1, top: 0, bottom: 0 },
  gridH: { height: 1, left: 0, right: 0 },

  corner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: TECH_TEXT,
  },
  cornerTL: { top: 10, left: 10, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  cornerTR: { top: 10, right: 10, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  cornerBL: { bottom: 10, left: 10, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  cornerBR: { bottom: 10, right: 10, borderBottomWidth: 1.5, borderRightWidth: 1.5 },

  heroTopBar: {
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
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  brandDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: '#fff',
  },
  brandTagText: {
    color: '#fff',
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '800',
  },
  counterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: TECH_BG_SOFT,
    borderWidth: 1,
    borderColor: TECH_BORDER,
  },
  counterText: {
    color: TECH_TEXT_MUTED,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
  },

  heroBody: {
    flex: 1,
    justifyContent: 'center',
  },
  heroEyebrow: {
    color: colors.primary,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  heroTitle: {
    color: TECH_TEXT,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.7,
    marginBottom: spacing.md,
  },
  accentBar: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
  },
  heroMessage: {
    color: TECH_TEXT_MUTED,
    fontSize: 14,
    lineHeight: 22,
    maxWidth: WINDOW_WIDTH * 0.82,
  },

  heroFooter: {
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
    backgroundColor: '#CBD5E1',
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.primary,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  ctaText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // BANNERS
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: TECH_BG,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: TECH_BORDER,
  },
  bannerDanger: {
    backgroundColor: colors.dangerSurface,
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
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeaderLine: {
    height: 1,
    flex: 1,
    backgroundColor: TECH_BORDER,
  },
  sectionLabel: {
    color: TECH_TEXT_MUTED,
    fontSize: 11,
    letterSpacing: 1.8,
    fontWeight: '800',
  },

  // STATS
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  // SHORTCUTS
  shortcuts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: TECH_BG,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: TECH_BORDER,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    minHeight: 120,
  },
  cardHighlight: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  iconWrap: {
    width: 26, height: 26, borderRadius: radius.full,
    borderWidth: 1, borderColor: TECH_BORDER,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
    backgroundColor: TECH_BG,
  },
  value: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -1,
    color: TECH_TEXT,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: TECH_TEXT_MUTED,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  tickRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 12,
  },
  tick: {
    width: 2,
    height: 4,
    borderRadius: 1,
    backgroundColor: '#CBD5E1',
  },
  tickTall: {
    height: 10,
    backgroundColor: '#94A3B8',
  },
});

const shortcutStyles = StyleSheet.create({
  item: {
    width: (WINDOW_WIDTH - spacing.md * 2 - spacing.sm) / 2,
    backgroundColor: TECH_BG,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: TECH_BORDER,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: TECH_BG_SOFT,
    borderWidth: 1, borderColor: TECH_BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: TECH_TEXT,
    letterSpacing: 0.2,
    flex: 1,
  },
});
