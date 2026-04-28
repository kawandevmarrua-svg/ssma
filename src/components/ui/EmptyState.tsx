import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../../theme/colors';
import { Text } from './Text';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <View style={styles.iconBubble}>
        <Ionicons name={icon} size={36} color={colors.textSecondary} />
      </View>
      <Text variant="h3" align="center" style={styles.title}>{title}</Text>
      {description && (
        <Text variant="callout" tone="muted" align="center" style={styles.desc}>
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} variant="primary" size="md" style={styles.action} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.lg,
  },
  compact: { paddingVertical: spacing.xl },
  iconBubble: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { marginBottom: spacing.xs },
  desc: { maxWidth: 280 },
  action: { marginTop: spacing.lg },
});
