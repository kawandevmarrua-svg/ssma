import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { OperatorScore } from '../../src/types/database';
import { colors, radius, spacing, fontSize } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';
import { Avatar, Text } from '../../src/components/ui';
import { AppHeader } from '../../src/components/AppHeader';

export default function OperatorProfileScreen() {
  const { user, profile, signOut } = useAuth();
  const [score, setScore] = useState<OperatorScore | null>(null);

  useEffect(() => {
    if (!user) return;
    const period = new Date().toISOString().slice(0, 7);
    supabase
      .from('operator_scores')
      .select('*')
      .eq('operator_id', user.id)
      .eq('period', period)
      .single()
      .then(({ data }) => setScore(data));
  }, [user]);

  const name = profile?.full_name || 'Operador';

  return (
    <View style={commonStyles.container}>
      <AppHeader />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={signOut}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Ionicons name="log-out-outline" size={16} color={colors.danger} />
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroBlock}>
        <Avatar name={name} size="xl" />
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.role}>OPERADOR</Text>

        {(profile?.email || profile?.phone) && (
          <View style={styles.contactList}>
            {profile?.email ? (
              <View style={styles.contactRow}>
                <Ionicons name="mail-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.contactText} numberOfLines={1}>{profile.email}</Text>
              </View>
            ) : null}
            {profile?.phone ? (
              <View style={styles.contactRow}>
                <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.contactText}>{profile.phone}</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      {score && (
        <View style={styles.statsBlock}>
          <View style={styles.statsHeader}>
            <Text style={styles.sectionLabel}>INDICADORES DO MÊS</Text>
            <View style={styles.sectionLine} />
          </View>

          <View style={styles.statsGrid}>
            <Stat value={score.score.toFixed(0)} label="Score" highlight />
            <Stat
              value={`${score.checklists_done}/${score.checklists_total}`}
              label="Checklists"
            />
            <Stat
              value={`${score.inspections_done}/${score.inspections_total}`}
              label="Inspeções"
            />
            <Stat value={String(score.deviations_count)} label="Desvios" />
            <Stat value={String(score.interventions_count)} label="Intervenções" />
          </View>
        </View>
      )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/(operator)/auditoria')}
            activeOpacity={0.6}
          >
            <Ionicons name="document-text-outline" size={18} color={colors.text} />
            <Text style={styles.actionText}>Auditoria de atividades</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, ...(highlight ? [{ color: colors.primary }] : [])]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing['2xl'] },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.sm,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  logoutText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.danger,
    letterSpacing: 0.2,
  },

  // Hero
  heroBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing['2xl'],
  },
  name: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
    marginTop: spacing.md,
  },
  role: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.6,
    marginTop: -2,
  },
  contactList: {
    marginTop: spacing.md,
    gap: 6,
    alignItems: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // Stats
  statsBlock: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1.6,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
  },
  statItem: {
    flexBasis: '33.33%',
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.4,
    marginTop: 2,
  },

  // Actions
  actions: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
  },
  actionText: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.1,
  },
});
