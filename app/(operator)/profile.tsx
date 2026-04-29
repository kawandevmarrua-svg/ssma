import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { OperatorScore } from '../../src/types/database';
import { colors, elevation, radius, spacing } from '../../src/theme/colors';
import { Avatar, Button, Card, Text } from '../../src/components/ui';

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile card */}
      <Card variant="elevated" padding="lg">
        <View style={styles.avatarRow}>
          <Avatar name={name} size="xl" />
          <View style={styles.identity}>
            <Text variant="h2" numberOfLines={1}>{name}</Text>
            <View style={styles.metaRow}>
              <Text variant="caption" tone="muted">Operador</Text>
            </View>
          </View>
        </View>

        {(profile?.email || profile?.phone) && (
          <View style={styles.infoSection}>
            {profile?.email && (
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
                <Text variant="bodyMedium">{profile.email}</Text>
              </View>
            )}
            {profile?.phone && (
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
                <Text variant="bodyMedium">{profile.phone}</Text>
              </View>
            )}
          </View>
        )}
      </Card>

      {/* Score */}
      {score && (
        <View style={styles.scoreCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="stats-chart-outline" size={14} color={colors.textSecondary} />
              <Text variant="captionStrong" tone="muted">INDICADORES DO MÊS</Text>
            </View>
          </View>

          <View style={styles.scoreCircle}>
            <Text style={styles.scoreValue}>{score.score.toFixed(0)}</Text>
            <Text variant="caption" tone="muted">Score</Text>
          </View>

          <View style={styles.scoreGrid}>
            <ScoreItem
              label="Checklists"
              value={`${score.checklists_done}/${score.checklists_total}`}
            />
            <ScoreItem
              label="Inspeções"
              value={`${score.inspections_done}/${score.inspections_total}`}
            />
            <ScoreItem label="Desvios" value={score.deviations_count} />
            <ScoreItem label="Intervenções" value={score.interventions_count} />
          </View>
        </View>
      )}

      {/* Logout */}
      <Button
        label="Sair"
        icon="log-out-outline"
        variant="secondary"
        size="lg"
        fullWidth
        onPress={signOut}
        style={styles.logoutBtn}
      />
    </ScrollView>
  );
}

function ScoreItem({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.scoreItem}>
      <Text style={styles.scoreItemValue}>{value}</Text>
      <Text variant="caption" tone="muted">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing['2xl'] },

  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  identity: { flex: 1 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  metaLink: { fontWeight: '600' },
  infoSection: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  // Score card
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...elevation.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreCircle: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  scoreValue: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  scoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  scoreItem: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  scoreItemValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
    marginBottom: 2,
  },

  logoutBtn: { marginTop: spacing.lg },
});
