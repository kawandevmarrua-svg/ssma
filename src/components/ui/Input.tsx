import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../theme/colors';
import { Text } from './Text';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helper?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  variant?: 'filled' | 'outlined';
}

export function Input({
  label,
  error,
  helper,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  variant = 'filled',
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label && <Text variant="subhead" tone="default" style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputBox,
          variant === 'filled' && styles.filled,
          variant === 'outlined' && styles.outlined,
          focused && styles.focused,
          !!error && styles.errored,
        ]}
      >
        {leftIcon && (
          <Ionicons name={leftIcon} size={20} color={focused ? colors.primary : colors.textSecondary} />
        )}
        <TextInput
          {...rest}
          placeholderTextColor={colors.textLight}
          style={styles.input}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
        {rightIcon && (
          <Pressable onPress={onRightIconPress} hitSlop={8}>
            <Ionicons name={rightIcon} size={20} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" style={styles.helperText}>{error}</Text>
      ) : helper ? (
        <Text variant="caption" tone="muted" style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
}

interface PasswordInputProps extends Omit<InputProps, 'rightIcon' | 'onRightIconPress' | 'secureTextEntry'> {}

export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      secureTextEntry={!visible}
      rightIcon={visible ? 'eye-off-outline' : 'eye-outline'}
      onRightIconPress={() => setVisible((v) => !v)}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  label: { marginBottom: spacing.xs },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  filled: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  outlined: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  focused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  errored: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSurface,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  helperText: { marginTop: spacing.xs, marginLeft: spacing.xs },
});
