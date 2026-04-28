import { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { colors, spacing } from '../../src/theme/colors';
import { Text, PasswordInput, Button } from '../../src/components/ui';

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;

export default function ResetPasswordScreen() {
  const { clearMustResetPassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!STRONG_PASSWORD.test(password)) {
      Alert.alert(
        'Senha fraca',
        'A senha deve ter no minimo 10 caracteres, com pelo menos uma maiuscula, uma minuscula e um numero.',
      );
      return;
    }

    if (password !== confirm) {
      Alert.alert('Senhas diferentes', 'A confirmacao nao confere com a senha digitada.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_reset_password: false },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }

    Alert.alert('Senha atualizada', 'Sua nova senha foi salva com sucesso.', [
      { text: 'OK', onPress: () => clearMustResetPassword() },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text variant="h1" align="center" style={styles.title}>
            Troque sua senha
          </Text>
          <Text variant="callout" tone="muted" align="center" style={styles.subtitle}>
            Sua senha foi definida pelo administrador. Por seguranca, defina uma nova senha pessoal antes de continuar.
          </Text>
        </View>

        <View style={styles.form}>
          <PasswordInput
            label="Nova senha"
            placeholder="Minimo 10 caracteres"
            leftIcon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            returnKeyType="next"
          />

          <PasswordInput
            label="Confirmar nova senha"
            placeholder="Repita a senha"
            leftIcon="lock-closed-outline"
            value={confirm}
            onChangeText={setConfirm}
            containerStyle={{ marginTop: spacing.md }}
            returnKeyType="done"
            onSubmitEditing={handleReset}
          />

          <Text variant="caption" tone="muted" style={styles.hint}>
            Minimo 10 caracteres, com maiuscula, minuscula e numero.
          </Text>

          <Button
            label={loading ? 'Salvando...' : 'Salvar nova senha'}
            onPress={handleReset}
            loading={loading}
            disabled={loading}
            fullWidth
            size="lg"
            style={{ marginTop: spacing.xl }}
          />

          <Button
            label="Sair"
            variant="ghost"
            onPress={signOut}
            fullWidth
            size="sm"
            style={{ marginTop: spacing.md }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing['2xl'],
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  title: { marginBottom: spacing.sm },
  subtitle: { maxWidth: 320 },
  form: { width: '100%' },
  hint: { marginTop: spacing.sm },
});
