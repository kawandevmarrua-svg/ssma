import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { OperatorScore } from '../../src/types/database';
import { colors, spacing, radius, fontSize } from '../../src/theme/colors';

export default function OperatorProfileScreen() {
  const { profile, operatorData, signOut } = useAuth();
  const [score, setScore] = useState<OperatorScore | null>(null);

  useEffect(() => {
    if (!operatorData) return;
    const period = new Date().toISOString().slice(0, 7);
    supabase
      .from('operator_scores')
      .select('*')
      .eq('operator_id', operatorData.id)
      .eq('period', period)
      .single()
      .then(({ data }) => setScore(data));
  }, [operatorData]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color={colors.primary} />
          </View>
          <Text style={styles.name}>{profile?.full_name || operatorData?.name || 'Operador'}</Text>
          <Text style={styles.role}>{operatorData?.role || 'Operador'}</Text>
        </View>

        <View style={styles.infoSection}>
          {profile?.email && (
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.infoText}>{profile.email}</Text>
            </View>
          )}
          {operatorData?.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.infoText}>{operatorData.phone}</Text>
            </View>
          )}
        </View>
      </View>

      {score && (
        <View style={styles.scoreCard}>
          <Text style={styles.scoreTitle}>Indicadores do Mes</Text>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreValue}>{score.score.toFixed(0)}</Text>
            <Text style={styles.scoreLabel}>Score</Text>
          </View>
          <View style={styles.scoreRow}>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreItemValue}>{score.checklists_done}/{score.checklists_total}</Text>
              <Text style={styles.scoreItemLabel}>Checklists</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreItemValue}>{score.inspections_done}/{score.inspections_total}</Text>
              <Text style={styles.scoreItemLabel}>Inspecoes</Text>
            </View>
          </View>
          <View style={styles.scoreRow}>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreItemValue}>{score.deviations_count}</Text>
              <Text style={styles.scoreItemLabel}>Desvios</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreItemValue}>{score.interventions_count}</Text>
              <Text style={styles.scoreItemLabel}>Intervencoes</Text>
            </View>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
        <Ionicons name="log-out-outline" size={22} color={colors.danger} />
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: { alignItems: 'center', marginBottom: spacing.lg },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  name: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  role: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  infoSection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
  infoText: { fontSize: fontSize.base, color: colors.text },
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  scoreTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  scoreCircle: {
    alignItems: 'center',
    alignSelf: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  scoreValue: { fontSize: fontSize['2xl'], fontWeight: '800', color: colors.primary },
  scoreLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  scoreRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  scoreItem: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  scoreItemValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  scoreItemLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  logoutText: { fontSize: fontSize.base, fontWeight: '700', color: colors.danger },
});
