import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
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
import { colors, spacing, radius, fontSize } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';

const CARGOS = [
  'Tecnico de seguranca',
  'Engenheiro de seguranca',
  'Coordenador de seguranca',
  'Analista de SSMA',
  'Supervisor de operacoes',
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

  // Create modal
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

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function resetForm() {
    setName('');
    setEmail('');
    setPassword('');
    setSelectedCargo(null);
    setShowPassword(false);
  }

  async function handleCreate() {
    if (!user) return;

    if (!name.trim()) {
      Alert.alert('Atencao', 'Preencha o nome completo.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Atencao', 'Preencha o email.');
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/.test(password)) {
      Alert.alert(
        'Atencao',
        'A senha deve ter no minimo 10 caracteres, com letra maiuscula, minuscula e numero.',
      );
      return;
    }
    if (!selectedCargo) {
      Alert.alert('Atencao', 'Selecione um cargo.');
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-operator', {
        body: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          cargo: selectedCargo,
        },
      });

      if (error || data?.success === false) {
        const msg = (data?.error as string | undefined) ?? error?.message ?? 'Falha ao criar usuario.';
        Alert.alert('Erro', msg);
        setSaving(false);
        return;
      }

      Alert.alert('Sucesso', `Usuario ${name.trim()} criado com sucesso!`);
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
    const { error } = await supabase
      .from('operators')
      .update({ active: !currentActive })
      .eq('id', userId);

    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    loadUsers();
  }

  if (loading) {
    return (
      <View style={st.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <ScrollView
        contentContainerStyle={commonStyles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadUsers();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Stats */}
        <View style={st.statsRow}>
          <View style={st.statCard}>
            <Text style={st.statNumber}>{users.length}</Text>
            <Text style={st.statLabel}>Total</Text>
          </View>
          <View style={st.statCard}>
            <Text style={[st.statNumber, { color: colors.success }]}>
              {users.filter((u) => u.active).length}
            </Text>
            <Text style={st.statLabel}>Ativos</Text>
          </View>
          <View style={st.statCard}>
            <Text style={[st.statNumber, { color: colors.danger }]}>
              {users.filter((u) => !u.active).length}
            </Text>
            <Text style={st.statLabel}>Inativos</Text>
          </View>
        </View>

        {/* User List */}
        {users.length === 0 ? (
          <View style={commonStyles.empty}>
            <Ionicons name="people-outline" size={48} color={colors.textLight} />
            <Text style={commonStyles.emptyText}>Nenhum usuario cadastrado</Text>
            <Text style={st.hintText}>Toque em + para adicionar um usuario</Text>
          </View>
        ) : (
          users.map((item) => (
            <View key={item.id} style={[commonStyles.card, !item.active && st.inactiveCard]}>
              <View style={st.cardRow}>
                <View style={[st.avatar, { backgroundColor: item.active ? colors.primary + '20' : colors.textLight + '20' }]}>
                  <Ionicons name="person" size={24} color={item.active ? colors.primary : colors.textLight} />
                </View>
                <View style={st.cardInfo}>
                  <Text style={st.userName}>{item.full_name ?? 'Sem nome'}</Text>
                  <Text style={st.userEmail}>{item.email}</Text>
                  <View style={st.cargoBadge}>
                    <Ionicons name="briefcase-outline" size={12} color={colors.primary} />
                    <Text style={st.cargoText}>{item.operator_role ?? '-'}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[st.toggleBtn, { backgroundColor: item.active ? colors.success + '15' : colors.danger + '15' }]}
                  onPress={() => toggleUserActive(item.id, item.active)}
                >
                  <Ionicons
                    name={item.active ? 'checkmark-circle' : 'close-circle'}
                    size={20}
                    color={item.active ? colors.success : colors.danger}
                  />
                </TouchableOpacity>
              </View>
              <View style={st.cardFooter}>
                <Text style={st.dateText}>
                  Criado em {new Date(item.created_at).toLocaleDateString('pt-BR')}
                </Text>
                <View style={[st.statusBadge, { backgroundColor: item.active ? colors.success + '20' : colors.danger + '20' }]}>
                  <Text style={[st.statusText, { color: item.active ? colors.success : colors.danger }]}>
                    {item.active ? 'Ativo' : 'Inativo'}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[commonStyles.fab, { backgroundColor: colors.primary }]}
        onPress={() => {
          resetForm();
          setModalVisible(true);
        }}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={commonStyles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={commonStyles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={commonStyles.modalHeader}>
                <Text style={commonStyles.modalTitle}>Novo Usuario</Text>
                <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Nome */}
              <View style={commonStyles.inputGroup}>
                <Text style={commonStyles.label}>Nome completo *</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="Nome do usuario"
                  placeholderTextColor={colors.textLight}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              {/* Email */}
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

              {/* Senha */}
              <View style={commonStyles.inputGroup}>
                <Text style={commonStyles.label}>Senha *</Text>
                <View style={st.passwordRow}>
                  <TextInput
                    style={[commonStyles.input, { flex: 1 }]}
                    placeholder="Minimo 8 caracteres"
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
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={22}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Cargo */}
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
                      <Text style={[st.cargoOptionText, isSelected && st.cargoOptionTextSelected]}>
                        {cargo}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={[commonStyles.saveButton, { marginBottom: spacing.lg }, saving && commonStyles.buttonDisabled]}
                onPress={handleCreate}
                disabled={saving}
              >
                <Text style={commonStyles.saveButtonText}>
                  {saving ? 'Criando...' : 'Criar Usuario'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statNumber: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.text,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Cards
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  userName: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.text,
  },
  userEmail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cargoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
    backgroundColor: colors.primary + '10',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  cargoText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.primary,
  },
  toggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveCard: {
    opacity: 0.6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dateText: {
    fontSize: fontSize.xs,
    color: colors.textLight,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  hintText: {
    fontSize: fontSize.sm,
    color: colors.textLight,
    marginTop: spacing.xs,
  },

  // Password
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  eyeBtn: {
    padding: spacing.sm,
  },

  // Cargo selector
  cargoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  cargoOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  cargoOptionText: {
    fontSize: fontSize.base,
    color: colors.text,
  },
  cargoOptionTextSelected: {
    fontWeight: '700',
    color: colors.primary,
  },
});
