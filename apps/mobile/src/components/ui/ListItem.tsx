import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { colors, elevation, radius, spacing } from '../../theme/colors';
import { Text } from './Text';

type Tone = 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface ListItemProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconTone?: Tone;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightSlot?: ReactNode;
  showChevron?: boolean;
  style?: ViewStyle;
  variant?: 'card' | 'plain';
}

const toneMap: Record<Tone, { bg: string; fg: string }> = {
  primary: { bg: colors.primarySurface, fg: colors.primary },
  success: { bg: colors.successSurface, fg: colors.successDark },
  danger: { bg: colors.dangerSurface, fg: colors.danger },
  warning: { bg: colors.warningSurface, fg: colors.warningDark },
  info: { bg: colors.infoSurface, fg: colors.info },
  neutral: { bg: colors.surfaceMuted, fg: colors.textSecondary },
};

export function ListItem({
  icon,
  iconTone = 'primary',
  title,
  subtitle,
  onPress,
  rightSlot,
  showChevron = true,
  style,
  variant = 'card',
}: ListItemProps) {
  const c = iconTone ? toneMap[iconTone] : null;

  const content = (
    <>
      {icon && c && (
        <View style={[styles.iconWrap, { backgroundColor: c.bg }]}>
          <Ionicons name={icon} size={20} color={c.fg} />
        </View>
      )}
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={1}>{title}</Text>
        {subtitle && (
          <Text variant="caption" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {rightSlot}
      {!rightSlot && showChevron && onPress && (
        <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
      )}
    </>
  );

  const baseStyle = variant === 'card' ? styles.cardBase : styles.plainBase;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [baseStyle, pressed && styles.pressed, style]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[baseStyle, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  cardBase: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...elevation.sm,
  },
  plainBase: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  pressed: { opacity: 0.95, transform: [{ scale: 0.995 }] },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
});
