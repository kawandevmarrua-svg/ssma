import { Text as RNText, TextProps as RNTextProps, StyleSheet, TextStyle } from 'react-native';
import { colors, typography } from '../../theme/colors';

type Variant = keyof typeof typography;
type Tone = 'default' | 'muted' | 'subtle' | 'inverse' | 'primary' | 'success' | 'danger' | 'warning';

interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  weight?: '400' | '500' | '600' | '700' | '800';
  align?: 'left' | 'center' | 'right';
  style?: TextStyle | TextStyle[];
}

const toneColor: Record<Tone, string> = {
  default: colors.text,
  muted: colors.textSecondary,
  subtle: colors.textLight,
  inverse: colors.textInverse,
  primary: colors.primary,
  success: colors.successDark,
  danger: colors.danger,
  warning: colors.warningDark,
};

export function Text({
  variant = 'body',
  tone = 'default',
  weight,
  align,
  style,
  children,
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
      style={[
        typography[variant] as TextStyle,
        { color: toneColor[tone] },
        weight && { fontWeight: weight },
        align && { textAlign: align },
        style as TextStyle,
      ]}
    >
      {children}
    </RNText>
  );
}

export const textStyles = StyleSheet.create({});
