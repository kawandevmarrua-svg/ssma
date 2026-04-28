import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../theme/colors';
import { Text } from './Text';

type Variant = 'primary' | 'success' | 'danger' | 'warning' | 'neutral' | 'info';
type Size = 'sm' | 'md';

interface BadgeProps {
  label?: string | number;
  variant?: Variant;
  size?: Size;
  style?: ViewStyle;
  dot?: boolean;
}

const variantStyles: Record<Variant, { bg: string; fg: string }> = {
  primary: { bg: colors.primarySurface, fg: colors.primaryDark },
  success: { bg: colors.successSurface, fg: colors.successDark },
  danger: { bg: colors.dangerSurface, fg: colors.danger },
  warning: { bg: colors.warningSurface, fg: colors.warningDark },
  info: { bg: colors.infoSurface, fg: colors.info },
  neutral: { bg: colors.surfaceMuted, fg: colors.textSecondary },
};

export function Badge({ label, variant = 'neutral', size = 'sm', style, dot }: BadgeProps) {
  const c = variantStyles[variant];

  if (dot) {
    return <View style={[styles.dot, { backgroundColor: c.fg }, style]} />;
  }

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: c.bg,
          paddingVertical: size === 'sm' ? 2 : 4,
          paddingHorizontal: size === 'sm' ? 8 : 10,
        },
        style,
      ]}
    >
      <Text style={{ color: c.fg, fontSize: size === 'sm' ? 11 : 12, fontWeight: '700', letterSpacing: 0.3 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
