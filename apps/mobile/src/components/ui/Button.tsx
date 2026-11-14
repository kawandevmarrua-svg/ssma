import { ActivityIndicator, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { colors, elevation, radius, typography } from '../../theme/colors';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label?: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle | ViewStyle[];
  children?: ReactNode;
}

const sizeMap = {
  sm: { paddingV: 8, paddingH: 14, gap: 6, font: 14, iconSize: 16, height: 36 },
  md: { paddingV: 12, paddingH: 18, gap: 8, font: 15, iconSize: 18, height: 48 },
  lg: { paddingV: 16, paddingH: 22, gap: 10, font: 16, iconSize: 20, height: 56 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  style,
  children,
}: ButtonProps) {
  const s = sizeMap[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant].container,
        {
          paddingVertical: s.paddingV,
          paddingHorizontal: s.paddingH,
          minHeight: s.height,
          gap: s.gap,
        },
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style as ViewStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyles[variant].iconColor} />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons name={icon} size={s.iconSize} color={variantStyles[variant].iconColor} />
          )}
          {label ? (
            <Text
              style={[
                typography.button,
                { fontSize: s.font, color: variantStyles[variant].textColor },
              ]}
            >
              {label}
            </Text>
          ) : children}
          {icon && iconPosition === 'right' && (
            <Ionicons name={icon} size={s.iconSize} color={variantStyles[variant].iconColor} />
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
});


const variantStyles: Record<
  Variant,
  { container: ViewStyle; textColor: string; iconColor: string }
> = {
  primary: {
    container: { backgroundColor: colors.primary, ...elevation.brand },
    textColor: colors.white,
    iconColor: colors.white,
  },
  secondary: {
    container: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    textColor: colors.text,
    iconColor: colors.textSecondary,
  },
  outline: {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
    textColor: colors.text,
    iconColor: colors.text,
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    textColor: colors.text,
    iconColor: colors.text,
  },
  danger: {
    container: { backgroundColor: colors.danger },
    textColor: colors.white,
    iconColor: colors.white,
  },
  success: {
    container: { backgroundColor: colors.success },
    textColor: colors.white,
    iconColor: colors.white,
  },
};
