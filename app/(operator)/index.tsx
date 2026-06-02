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
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { todayLocal } from '../../src/lib/dates';
import { colors, radius, spacing, fontSize } from '../../src/theme/colors';
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

export default function OperatorHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ checklistsToday: 0, activitiesToday: 0, unreadAlerts: 0, remindersToday: 0 });
  const [remindersPreview, setRemindersPreview] = useState<{ id: string; title: string; reminder_time: string }[]>([]);
  const [safetyMessages, setSafetyMessages] = useState(DEFAULT_SAFETY_MESSAGES);
  const [currentMsgIndex, setCurrentMsgIndex] = useState(0);

  // Animations
  const msgFade = useRef(new Animated.Value(1)).current;
  const msgSlide = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;

  const today = todayLocal();

  const loadData = useCallback(async () => {
    if (!user) return;
    const [checklistsRes, activitiesRes, alertsRes, messagesRes, remindersRes] = await Promise.all([
      supabase.from('checklists').select('id', { count: 'exact', head: true })
        .eq('operator_id', user.id).eq('date', today),
      supabase.from('activities').select('id', { count: 'exact', head: true })
        .eq('operator_id', user.id).eq('date', today),
      supabase.from('safety_alerts').select('id', { count: 'exact', head: true })
        .or(`operator_id.eq.${user.id},operator_id.is.null`).eq('read', false),
      supabase.from('safety_alerts').select('title, message')
        .or(`operator_id.eq.${user.id},operator_id.is.null`)
        .order('created_at', { ascending: false }).limit(10),
      supabase.from('reminders')
        .select('id, title, reminder_time, recurrence, days_of_week, specific_date')
        .eq('user_id', user.id).eq('is_active', true)
        .order('reminder_time', { ascending: true }),
    ]);

    const todayDow = new Date().getDay();
    const todayReminders = (remindersRes.data ?? []).filter((r) => {
      if (r.recurrence === 'daily') return true;
      if (r.recurrence === 'weekly') return (r.days_of_week as number[] | null)?.includes(todayDow) ?? false;
      if (r.recurrence === 'once') return r.specific_date === today;
      return false;
    });
    const remindersToday = todayReminders.length;
    setRemindersPreview(todayReminders.map((r) => ({ id: r.id, title: r.title, reminder_time: r.reminder_time })));

    setStats({
      checklistsToday: checklistsRes.count ?? 0,
      activitiesToday: activitiesRes.count ?? 0,
      unreadAlerts: alertsRes.count ?? 0,
      remindersToday,
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
        {/* LEMBRETES DO DIA */}
        {remindersPreview.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLine} />
              <Text style={styles.sectionLabel}>LEMBRETES</Text>
              <View style={styles.sectionHeaderLine} />
            </View>
            <ReminderPreviewCard
              reminders={remindersPreview}
              onPress={() => router.push('/(operator)/lembretes')}
            />
          </>
        )}

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
        </View>
        <View style={[styles.statsRow, { marginTop: spacing.sm }]}>
          <TechStat
            icon="notifications-outline"
            value={stats.unreadAlerts}
            label="Alertas"
            highlight={stats.unreadAlerts > 0}
            onPress={() => router.push('/(operator)/alerts')}
          />
          <TechStat
            icon="alarm-outline"
            value={stats.remindersToday}
            label="Lembretes"
            accentColor={colors.primary}
            onPress={() => router.push('/(operator)/lembretes')}
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
  accentColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  onPress?: () => void;
  highlight?: boolean;
  accentColor?: string;
}) {
  const accent = accentColor ?? colors.primary;
  const active = highlight || !!accentColor;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        statStyles.card,
        active && { borderColor: accent, backgroundColor: accent + '0D' },
        pressed && { opacity: 0.95, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={statStyles.iconWrap}>
        <Ionicons name={icon} size={14} color={active ? accent : colors.textSecondary} />
      </View>
      <Text style={[statStyles.value, active && { color: accent }]}>
        {String(value).padStart(2, '0')}
      </Text>
      <Text style={statStyles.label}>{label}</Text>
      <View style={statStyles.tickRow}>
        <View style={statStyles.tick} />
        <View style={[statStyles.tick, statStyles.tickTall]} />
        <View style={statStyles.tick} />
        <View style={statStyles.tick} />
        <View style={[statStyles.tick, statStyles.tickTall, active && { backgroundColor: accent }]} />
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

function ReminderPreviewCard({
  reminders,
  onPress,
}: {
  reminders: { id: string; title: string; reminder_time: string }[];
  onPress: () => void;
}) {
  const nowHHMM = new Date().toTimeString().slice(0, 5);
  const visible = reminders.slice(0, 5);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [reminderCardStyles.card, pressed && { opacity: 0.95 }]}
    >
      {visible.map((r, idx) => {
        const notified = r.reminder_time <= nowHHMM;
        return (
          <View key={r.id} style={[reminderCardStyles.row, idx > 0 && reminderCardStyles.rowBorder]}>
            <View style={[reminderCardStyles.timeBadge, notified && reminderCardStyles.timeBadgeDone]}>
              <Text style={[reminderCardStyles.timeText, notified && reminderCardStyles.timeTextDone]}>
                {r.reminder_time}
              </Text>
            </View>
            <Text style={[reminderCardStyles.title, notified && { color: '#94A3B8' }]} numberOfLines={1}>
              {r.title}
            </Text>
            <View style={[reminderCardStyles.statusDot, { backgroundColor: notified ? '#10B981' : colors.primary }]}>
              <Ionicons
                name={notified ? 'checkmark' : 'alarm-outline'}
                size={10}
                color="#fff"
              />
            </View>
          </View>
        );
      })}
      {reminders.length > 5 && (
        <Text style={reminderCardStyles.more}>+{reminders.length - 5} mais</Text>
      )}
      <View style={reminderCardStyles.footer}>
        <Text style={reminderCardStyles.footerText}>Ver todos os lembretes</Text>
        <Ionicons name="arrow-forward" size={12} color={colors.primary} />
      </View>
    </Pressable>
  );
}

const reminderCardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.primarySurface,
    minWidth: 50,
    alignItems: 'center',
  },
  timeBadgeDone: {
    backgroundColor: '#F0FDF4',
  },
  timeText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.3,
  },
  timeTextDone: {
    color: '#10B981',
  },
  title: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#0F172A',
  },
  statusDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  more: {
    fontSize: fontSize.xs,
    color: '#94A3B8',
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  footerText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.primary,
  },
});

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
    fontSize: fontSize['2xs'],
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
    fontSize: fontSize['2xs'],
    letterSpacing: 1.2,
    fontWeight: '700',
  },

  heroBody: {
    flex: 1,
    justifyContent: 'center',
  },
  heroEyebrow: {
    color: colors.primary,
    fontSize: fontSize.xs,
    letterSpacing: 1.6,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  heroTitle: {
    color: TECH_TEXT,
    fontSize: fontSize['2xl'],
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
    fontSize: fontSize.sm,
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
    fontSize: fontSize.xs,
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
    fontSize: fontSize.xs,
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
    fontSize: fontSize['2xl'],
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -1,
    color: TECH_TEXT,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: fontSize['2xs'],
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
    width: (WINDOW_WIDTH - spacing.lg * 2 - spacing.sm * 3) / 4,
    backgroundColor: TECH_BG,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: TECH_BORDER,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: TECH_BG_SOFT,
    borderWidth: 1, borderColor: TECH_BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: TECH_TEXT,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});
