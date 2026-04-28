import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { ReactNode } from 'react';
import { colors, elevation, radius, spacing } from '../../theme/colors';

type Variant = 'elevated' | 'outlined' | 'flat' | 'soft';
type Padding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  variant?: Variant;
  padding?: Padding;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  children: ReactNode;
}

const paddingMap: Record<Padding, number> = {
  none: 0,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
};

export function Card({
  variant = 'elevated',
  padding = 'md',
  onPress,
  style,
  children,
}: CardProps) {
  const containerStyle = [
    styles.base,
    variantStyles[variant],
    { padding: paddingMap[padding] },
    style as ViewStyle,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [containerStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md },
  pressed: { opacity: 0.95, transform: [{ scale: 0.995 }] },
});

const variantStyles: Record<Variant, ViewStyle> = {
  elevated: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.sm,
  },
  outlined: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  flat: { backgroundColor: colors.surface },
  soft: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
};
