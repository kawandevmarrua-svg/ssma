import { View, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing } from '../../src/theme/colors';
import { Avatar, Button, Card, Text } from '../../src/components/ui';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  operator: 'Operador',
};

export default function AdminProfileScreen() {
  const { profile, signOut } = useAuth();
  const name = profile?.full_name || 'Admin';
  const roleLabel = ROLE_LABELS[profile?.role || ''] || profile?.role;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card variant="elevated" padding="lg">
        <View style={styles.avatarRow}>
          <Avatar name={name} size="xl" />
          <View style={styles.identity}>
            <Text variant="h2" numberOfLines={1}>{name}</Text>
            <View style={styles.metaRow}>
              <Text variant="caption" tone="muted">Conta ·</Text>
              <Text variant="caption" tone="primary" style={styles.metaLink}>
                {roleLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoSection}>
          {profile?.email && (
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
              <Text variant="bodyMedium">{profile.email}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text variant="bodyMedium">
              Desde {new Date(profile?.created_at || '').toLocaleDateString('pt-BR')}
            </Text>
          </View>
        </View>
      </Card>

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
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
  logoutBtn: { marginTop: spacing.lg },
});
