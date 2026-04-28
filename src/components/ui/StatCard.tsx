import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, radius, spacing } from '../../theme/colors';
import { Text } from './Text';

type Tone = 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  tone?: Tone;
  onPress?: () => void;
  trend?: { direction: 'up' | 'down' | 'flat'; label: string };
  meta?: string;
  style?: ViewStyle;
}

const toneFg: Record<Tone, string> = {
  primary: colors.primary,
  success: colors.successDark,
  danger: colors.danger,
  warning: colors.warningDark,
  info: colors.info,
  neutral: colors.textSecondary,
};

export function StatCard({
  icon,
  value,
  label,
  tone = 'primary',
  onPress,
  trend,
  meta,
  style,
}: StatCardProps) {
  const fg = toneFg[tone];
  const trendColor =
    trend?.direction === 'up'
      ? colors.successDark
      : trend?.direction === 'down'
      ? colors.danger
      : colors.textSecondary;
  const trendIcon =
    trend?.direction === 'up'
      ? 'trending-up'
      : trend?.direction === 'down'
      ? 'trending-down'
      : 'remove';

  const content = (
    <>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name={icon} size={14} color={colors.textSecondary} />
          <Text variant="captionStrong" tone="muted">{label}</Text>
        </View>
        {meta && (
          <Text variant="caption" tone="subtle">{meta}</Text>
        )}
      </View>

      <View style={styles.body}>
        <Text style={[styles.value, { color: fg }]}>{value}</Text>
        {trend && (
          <View style={styles.trendRow}>
            <Ionicons name={trendIcon} size={12} color={trendColor} />
            <Text style={[styles.trendText, { color: trendColor }]}>{trend.label}</Text>
          </View>
        )}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.base, pressed && styles.pressed, style]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.base, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...elevation.sm,
  },
  pressed: { opacity: 0.95, transform: [{ scale: 0.995 }] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  value: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingBottom: 4,
  },
  trendText: { fontSize: 11, fontWeight: '700' },
});
