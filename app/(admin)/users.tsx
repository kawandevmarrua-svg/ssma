import { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { colors, elevation, spacing, radius, fontSize } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';
import { Avatar, Badge, Button, StatCard, Text } from '../../src/components/ui';

const CARGOS = [
  'Técnico de segurança',
  'Engenheiro de segurança',
  'Coordenador de segurança',
  'Analista de SSMA',
  'Supervisor de operações',
] as const;

type Cargo = typeof CARGOS[number];

interface UserRow {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  created_at: string;
  operator_role: string | null;
  active: boolean;
}

export default function UsersScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedCargo, setSelectedCargo] = useState<Cargo | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!user) return;
    const { data: operators } = await supabase
      .from('operators')
      .select('id, name, email, role, active, auth_user_id, created_at')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    const mapped: UserRow[] = (operators ?? []).map((op) => ({
      id: op.id,
      full_name: op.name,
      email: op.email ?? '',
      role: 'operator',
      created_at: op.created_at,
      operator_role: op.role,
      active: op.active,
    }));

    setUsers(mapped);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  function resetForm() {
    setName(''); setEmail(''); setPassword('');
    setSelectedCargo(null); setShowPassword(false);
  }

  async function handleCreate() {
    if (!user) return;

    if (!name.trim()) { Alert.alert('Atenção', 'Preencha o nome completo.'); return; }
    if (!email.trim()) { Alert.alert('Atenção', 'Preencha o email.'); return; }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/.test(password)) {
      Alert.alert('Atenção', 'A senha deve ter no mínimo 10 caracteres, com letra maiúscula, minúscula e número.');
      return;
    }
    if (!selectedCargo) { Alert.alert('Atenção', 'Selecione um cargo.'); return; }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-operator', {
        body: { name: name.trim(), email: email.trim().toLowerCase(), password, cargo: selectedCargo },
      });
      if (error || data?.success === false) {
        const msg = (data?.error as string | undefined) ?? error?.message ?? 'Falha ao criar usuário.';
        Alert.alert('Erro', msg);
        setSaving(false);
        return;
      }
      Alert.alert('Sucesso', `Usuário ${name.trim()} criado com sucesso!`);
      resetForm();
      setModalVisible(false);
      loadUsers();
    } catch (err: any) {
      Alert.alert('Erro', err?.message ?? 'Erro inesperado.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleUserActive(userId: string, currentActive: boolean) {
    const { error } = await supabase.from('operators').update({ active: !currentActive }).eq('id', userId);
    if (error) { Alert.alert('Erro', error.message); return; }
    loadUsers();
  }

  if (loading) {
    return (
      <View style={st.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const activeCount = users.filter((u) => u.active).length;
  const inactiveCount = users.filter((u) => !u.active).length;

  return (
    <View style={commonStyles.container}>
      <ScrollView
        contentContainerStyle={commonStyles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadUsers(); setRefreshing(false); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Stats */}
        <View style={st.statsRow}>
          <StatCard icon="people-outline" value={users.length} label="Total" tone="primary" />
          <StatCard icon="checkmark-circle-outline" value={activeCount} label="Ativos" tone="success" />
          <StatCard icon="close-circle-outline" value={inactiveCount} label="Inativos" tone="neutral" />
        </View>

        {/* User List */}
        {users.length === 0 ? (
          <View style={commonStyles.empty}>
            <Ionicons name="people-outline" size={40} color={colors.textLight} />
            <Text variant="callout" tone="muted" style={{ marginTop: spacing.md }}>
              Nenhum usuário cadastrado
            </Text>
            <Text variant="caption" tone="subtle" style={{ marginTop: 4 }}>
              Toque em + para adicionar um usuário
            </Text>
          </View>
        ) : (
          users.map((item) => (
            <View key={item.id} style={[st.card, !item.active && st.inactiveCard]}>
              <View style={st.cardHeader}>
                <View style={st.headerLeft}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                  <Text variant="captionStrong" tone="muted">
                    Desde {new Date(item.created_at).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
                <Badge
                  label={item.active ? 'ATIVO' : 'INATIVO'}
                  variant={item.active ? 'success' : 'neutral'}
                  size="sm"
                />
              </View>

              <View style={st.userRow}>
                <Avatar name={item.full_name ?? '?'} size="md" />
                <View style={st.userInfo}>
                  <Text variant="bodyStrong" numberOfLines={1}>{item.full_name ?? 'Sem nome'}</Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>{item.email}</Text>
                </View>
                <TouchableOpacity
                  style={[
                    st.toggleBtn,
                    { backgroundColor: item.active ? colors.successSurface : colors.surfaceMuted },
                  ]}
                  onPress={() => toggleUserActive(item.id, item.active)}
                  hitSlop={4}
                >
                  <Ionicons
                    name={item.active ? 'checkmark-circle-outline' : 'close-circle-outline'}
                    size={18}
                    color={item.active ? colors.successDark : colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {item.operator_role && (
                <View style={st.cargoRow}>
                  <Ionicons name="briefcase-outline" size={12} color={colors.textSecondary} />
                  <Text variant="caption" tone="muted">{item.operator_role}</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={st.fab}
        onPress={() => { resetForm(); setModalVisible(true); }}
      >
        <Ionicons name="add" size={26} color={colors.white} />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={commonStyles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={commonStyles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={commonStyles.modalHeader}>
                <Text variant="h2">Novo usuário</Text>
                <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={commonStyles.inputGroup}>
                <Text style={commonStyles.label}>Nome completo *</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="Nome do usuário"
                  placeholderTextColor={colors.textLight}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              <View style={commonStyles.inputGroup}>
                <Text style={commonStyles.label}>Email *</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="email@exemplo.com"
                  placeholderTextColor={colors.textLight}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={commonStyles.inputGroup}>
                <Text style={commonStyles.label}>Senha *</Text>
                <View style={st.passwordRow}>
                  <TextInput
                    style={[commonStyles.input, { flex: 1 }]}
                    placeholder="Mínimo 10 caracteres"
                    placeholderTextColor={colors.textLight}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={st.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={commonStyles.inputGroup}>
                <Text style={commonStyles.label}>Cargo *</Text>
                {CARGOS.map((cargo) => {
                  const isSelected = selectedCargo === cargo;
                  return (
                    <TouchableOpacity
                      key={cargo}
                      style={[st.cargoOption, isSelected && st.cargoOptionSelected]}
                      onPress={() => setSelectedCargo(cargo)}
                    >
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={isSelected ? colors.primary : colors.textLight}
                      />
                      <Text
                        variant="bodyMedium"
                        tone={isSelected ? 'primary' : 'default'}
                        weight={isSelected ? '700' : '500'}
                      >
                        {cargo}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Button
                label={saving ? 'Criando...' : 'Criar usuário'}
                variant="primary"
                size="lg"
                fullWidth
                loading={saving}
                disabled={saving}
                onPress={handleCreate}
                style={{ marginBottom: spacing.lg }}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.sm,
  },
  inactiveCard: { opacity: 0.7 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  userInfo: { flex: 1 },
  toggleBtn: {
    width: 36, height: 36, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cargoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },

  // FAB
  fab: {
    position: 'absolute', bottom: spacing.lg, right: spacing.lg,
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    ...elevation.brand,
  },

  // Modal extras
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyeBtn: { padding: spacing.sm },
  cargoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  cargoOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
});
