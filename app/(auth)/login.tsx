import { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { loginSchema } from '../../src/schemas';
import { useFormValidation } from '../../src/hooks/useFormValidation';
import { colors, spacing } from '../../src/theme/colors';
import { Text, Input, PasswordInput, Button } from '../../src/components/ui';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { errors, validate } = useFormValidation(loginSchema);

  async function handleLogin() {
    const result = validate({ email, password });
    if (!result.success) return;

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      Alert.alert('Não foi possível entrar', 'Verifique seu e-mail e senha e tente novamente.');
    }
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
          <Image
            source={require('../../logo.jpeg')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text variant="h1" align="center" style={styles.title}>
            Bem-vindo de volta
          </Text>
          <Text variant="callout" tone="muted" align="center" style={styles.subtitle}>
            Entre com suas credenciais para continuar acompanhando suas atividades.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="E-mail"
            placeholder="seu@email.com"
            leftIcon="mail-outline"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
            returnKeyType="next"
          />

          <PasswordInput
            label="Senha"
            placeholder="Digite sua senha"
            leftIcon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            containerStyle={{ marginTop: spacing.md }}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <Button
            label={loading ? 'Entrando...' : 'Entrar'}
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            fullWidth
            size="lg"
            style={{ marginTop: spacing.xl }}
          />
        </View>

        <View style={styles.footer}>
          <Text variant="caption" tone="muted" align="center">
            Problemas para acessar? Fale com o administrador.
          </Text>
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
  logo: {
    width: 96,
    height: 96,
    marginBottom: spacing.lg,
    borderRadius: 24,
  },
  title: { marginBottom: spacing.sm },
  subtitle: { maxWidth: 320 },
  form: { width: '100%' },
  footer: {
    marginTop: spacing['2xl'],
    alignItems: 'center',
  },
});
