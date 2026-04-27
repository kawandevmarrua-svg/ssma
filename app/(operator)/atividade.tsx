import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  Image,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { pickPhoto, uploadPhoto } from '../../src/lib/imageUtils';
import { Activity } from '../../src/types/database';
import { colors, spacing, radius, fontSize } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';
import { FinishActivityModal } from '../../src/components/FinishActivityModal';

const PRE_OP_QUESTIONS = [
  { key: 'checklist_fisico', label: 'Checklist realizado fisico preenchido? (a Vale exige o preenchimento do formulario fisico)', critical: false },
  { key: 'prontos_preenchido', label: 'Prontos realizado?', critical: false },
  { key: 'apto_operar', label: 'Voce esta apto para operar?', critical: true },
  { key: 'conhece_limites', label: 'Conhece os limites do equipamento?', critical: false },
  { key: 'art_disponivel', label: 'ART e de seu conhecimento e encontra-se disponivel na frente de servico?', critical: false },
  { key: 'liberacao_acesso', label: 'E necessario Liberacao de Acesso?', critical: false },
  { key: 'pts_preenchida', label: 'Para esta atividade se aplica a PTS? A PTS esta preenchida?', critical: false },
  { key: 'local_adequado', label: 'O local da atividade esta adequado para realizacao da tarefa?', critical: false },
  { key: 'local_sinalizado', label: 'O local encontra-se sinalizado ou dentro de area controlada?', critical: false },
  { key: 'manutencao_valida', label: 'A manutencao do equipamento encontra-se valida?', critical: true },
  { key: 'radio_comunicacao', label: 'O equipamento disponibiliza de radio de comunicacao?', critical: false },
  { key: 'epi_adequado', label: "Voce esta com os EPI's adequados para a atividade?", critical: true },
] as const;

type PreOpKey = typeof PRE_OP_QUESTIONS[number]['key'];
type PreOpAnswers = Record<PreOpKey, boolean | null>;

const INITIAL_PREOP: PreOpAnswers = {
  checklist_fisico: null,
  prontos_preenchido: null,
  apto_operar: null,
  conhece_limites: null,
  art_disponivel: null,
  liberacao_acesso: null,
  pts_preenchida: null,
  local_adequado: null,
  local_sinalizado: null,
  manutencao_valida: null,
  radio_comunicacao: null,
  epi_adequado: null,
};

export default function AtividadeScreen() {
  const { user, operatorData } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [activityToFinish, setActivityToFinish] = useState<Activity | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [equipmentPhotoUri, setEquipmentPhotoUri] = useState<string | null>(null);
  const [startPhotoUri, setStartPhotoUri] = useState<string | null>(null);
  const [preopAnswers, setPreopAnswers] = useState<PreOpAnswers>({ ...INITIAL_PREOP });
  const [availableChecklists, setAvailableChecklists] = useState<{ id: string; machine_name: string; tag: string | null }[]>([]);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);

  function setPreopAnswer(key: PreOpKey, value: boolean) {
    setPreopAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function allPreopAnswered() {
    return PRE_OP_QUESTIONS.every((q) => preopAnswers[q.key] !== null);
  }

  const today = new Date().toISOString().split('T')[0];

  const loadActivities = useCallback(async () => {
    if (!operatorData) return;
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('operator_id', operatorData.id)
      .eq('date', today)
      .order('created_at', { ascending: false });
    if (error) Alert.alert('Erro', 'Falha ao carregar atividades.');
    setActivities(data ?? []);
    setLoading(false);
  }, [operatorData, today]);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  async function onRefresh() {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  }

  function resetCreateForm() {
    setLocation('');
    setDescription('');
    setEquipmentPhotoUri(null);
    setStartPhotoUri(null);
    setPreopAnswers({ ...INITIAL_PREOP });
    setSelectedChecklistId(null);
  }

  async function openCreateModal() {
    if (!operatorData) return;
    const { data } = await supabase
      .from('checklists')
      .select('id, machine_name, tag')
      .eq('operator_id', operatorData.id)
      .eq('date', today)
      .eq('result', 'released')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    const list = data ?? [];
    if (list.length === 0) {
      Alert.alert(
        'Checklist necessario',
        'Voce precisa realizar o checklist do equipamento antes de iniciar uma atividade.',
      );
      return;
    }
    resetCreateForm();
    setAvailableChecklists(list);
    setCreateModal(true);
  }

  async function handleCreate() {
    if (saving) return;
    if (!operatorData || !user) return;
    if (!selectedChecklistId) {
      Alert.alert('Atencao', 'Selecione a maquina (checklist do dia) antes de iniciar.');
      return;
    }
    if (!location.trim() || !description.trim()) {
      Alert.alert('Atencao', 'Preencha local e descricao da atividade.');
      return;
    }
    if (!allPreopAnswered()) {
      Alert.alert('Atencao', 'Responda todas as 12 perguntas da pre-operacao antes de iniciar.');
      return;
    }
    const selectedChecklist = availableChecklists.find((c) => c.id === selectedChecklistId);

    setSaving(true);
    const now = new Date().toISOString();

    // 1) Cria a pre-operacao desta atividade
    const { data: preop, error: preopErr } = await supabase
      .from('pre_operation_checks')
      .insert({
        operator_id: operatorData.id,
        date: today,
        checklist_fisico: preopAnswers.checklist_fisico!,
        prontos_preenchido: preopAnswers.prontos_preenchido!,
        apto_operar: preopAnswers.apto_operar!,
        conhece_limites: preopAnswers.conhece_limites!,
        art_disponivel: preopAnswers.art_disponivel!,
        liberacao_acesso: preopAnswers.liberacao_acesso,
        pts_preenchida: preopAnswers.pts_preenchida,
        local_adequado: preopAnswers.local_adequado!,
        local_sinalizado: preopAnswers.local_sinalizado!,
        manutencao_valida: preopAnswers.manutencao_valida!,
        radio_comunicacao: preopAnswers.radio_comunicacao!,
        epi_adequado: preopAnswers.epi_adequado!,
      })
      .select()
      .single();

    if (preopErr || !preop) {
      Alert.alert('Erro', preopErr?.message ?? 'Falha ao salvar pre-operacao.');
      setSaving(false);
      return;
    }

    // 2) Cria a atividade vinculada a essa pre-operacao
    const { data: activity, error } = await supabase
      .from('activities')
      .insert({
        operator_id: operatorData.id,
        pre_operation_id: preop.id,
        checklist_id: selectedChecklistId,
        date: today,
        equipment_tag: selectedChecklist?.tag ?? null,
        location,
        description,
        start_time: now,
      })
      .select()
      .single();

    if (error || !activity) {
      Alert.alert('Erro', error?.message ?? 'Erro ao criar atividade.');
      setSaving(false);
      return;
    }

    if (equipmentPhotoUri) {
      const path = await uploadPhoto(equipmentPhotoUri, 'activity-photos', `${user.id}/${activity.id}/equipment`);
      if (path) await supabase.from('activities').update({ equipment_photo_url: path }).eq('id', activity.id);
    }
    if (startPhotoUri) {
      const path = await uploadPhoto(startPhotoUri, 'activity-photos', `${user.id}/${activity.id}/start`);
      if (path) await supabase.from('activities').update({ start_photo_url: path }).eq('id', activity.id);
    }

    setSaving(false);
    resetCreateForm();
    setCreateModal(false);
    loadActivities();
  }

  function formatTime(iso: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function renderActivity({ item }: { item: Activity }) {
    const inProgress = !item.end_time;
    return (
      <View style={commonStyles.card}>
        <View style={st.actHeader}>
          <View style={[st.dot, { backgroundColor: inProgress ? colors.warning : colors.success }]} />
          <View style={st.actInfo}>
            <Text style={st.actDesc}>{item.description}</Text>
            {item.location && <Text style={st.actLocation}>{item.location}</Text>}
            {item.equipment_tag && <Text style={st.actTag}>TAG: {item.equipment_tag}</Text>}
          </View>
          <View style={[st.badge, { backgroundColor: inProgress ? colors.warningLight : colors.success + '20' }]}>
            <Text style={[st.badgeText, { color: inProgress ? colors.warning : colors.success }]}>
              {inProgress ? 'Em Andamento' : 'Finalizada'}
            </Text>
          </View>
        </View>

        <View style={st.timeRow}>
          <View style={st.timeItem}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={st.timeText}>Inicio: {formatTime(item.start_time)}</Text>
          </View>
          {item.end_time && (
            <View style={st.timeItem}>
              <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
              <Text style={st.timeText}>Fim: {formatTime(item.end_time)}</Text>
            </View>
          )}
        </View>

        {item.had_interference && (
          <View style={st.interferNote}>
            <Ionicons name="alert-circle" size={14} color={colors.warning} />
            <Text style={st.interferText}>Interferencia: {item.interference_notes || 'Sim'}</Text>
          </View>
        )}

        {inProgress && (
          <TouchableOpacity style={st.endBtn} onPress={() => setActivityToFinish(item)}>
            <Ionicons name="stop-circle" size={18} color={colors.primary} />
            <Text style={st.endBtnText}>Finalizar Atividade</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={renderActivity}
        contentContainerStyle={commonStyles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={commonStyles.empty}>
              <Ionicons name="construct-outline" size={48} color={colors.textLight} />
              <Text style={commonStyles.emptyText}>Nenhuma atividade hoje</Text>
              <Text style={[commonStyles.emptyText, { fontSize: fontSize.sm }]}>Toque em + para registrar</Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        style={[commonStyles.fab, { backgroundColor: colors.primary }]}
        onPress={openCreateModal}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={createModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={commonStyles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={commonStyles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={commonStyles.modalHeader}>
                <Text style={commonStyles.modalTitle}>Nova Atividade</Text>
                <TouchableOpacity onPress={() => { setCreateModal(false); resetCreateForm(); }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={st.sectionTitle}>Pre-Operacao (formulario Vale)</Text>
              <Text style={st.sectionHint}>Responda as 12 perguntas antes de iniciar a atividade.</Text>
              {PRE_OP_QUESTIONS.map((q) => (
                <View key={q.key} style={[st.questionCard, q.critical && st.questionCritical]}>
                  <View style={st.questionHeaderRow}>
                    <Text style={st.questionText}>{q.label}</Text>
                    {q.critical && (
                      <View style={st.criticalBadge}>
                        <Ionicons name="alert" size={12} color={colors.danger} />
                        <Text style={st.criticalText}>Critico</Text>
                      </View>
                    )}
                  </View>
                  <View style={st.answerRow}>
                    <TouchableOpacity
                      style={[st.answerBtn, preopAnswers[q.key] === true && st.answerYes]}
                      onPress={() => setPreopAnswer(q.key, true)}
                    >
                      <Text style={[st.answerText, preopAnswers[q.key] === true && st.answerTextActive]}>Sim</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[st.answerBtn, preopAnswers[q.key] === false && st.answerNo]}
                      onPress={() => setPreopAnswer(q.key, false)}
                    >
                      <Text style={[st.answerText, preopAnswers[q.key] === false && st.answerTextActive]}>Nao</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <Text style={st.sectionTitle}>Maquina (checklist do dia) *</Text>
              {availableChecklists.map((c) => {
                const isSel = c.id === selectedChecklistId;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[st.machineChoice, isSel && st.machineChoiceSel]}
                    onPress={() => setSelectedChecklistId(c.id)}
                  >
                    <Ionicons
                      name={isSel ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={isSel ? colors.primary : colors.textLight}
                    />
                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                      <Text style={st.machineChoiceName}>{c.machine_name}</Text>
                      {c.tag && <Text style={st.machineChoiceTag}>TAG: {c.tag}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}

              <Text style={st.sectionTitle}>Detalhes da Atividade</Text>
              <View style={commonStyles.inputGroup}>
                <Text style={commonStyles.label}>Local *</Text>
                <TextInput style={commonStyles.input} placeholder="Local da atividade" placeholderTextColor={colors.textLight} value={location} onChangeText={setLocation} />
              </View>
              <View style={commonStyles.inputGroup}>
                <Text style={commonStyles.label}>Descricao *</Text>
                <TextInput style={[commonStyles.input, commonStyles.textArea]} placeholder="Descricao da atividade" placeholderTextColor={colors.textLight} value={description} onChangeText={setDescription} multiline numberOfLines={3} />
              </View>

              <View style={st.photoRow}>
                <TouchableOpacity style={st.photoPicker} onPress={async () => { const uri = await pickPhoto(); if (uri) setEquipmentPhotoUri(uri); }}>
                  {equipmentPhotoUri
                    ? <Image source={{ uri: equipmentPhotoUri }} style={st.photoPreview} />
                    : <><Ionicons name="camera" size={24} color={colors.textLight} /><Text style={st.photoLabel}>Foto Equipamento</Text></>
                  }
                </TouchableOpacity>
                <TouchableOpacity style={st.photoPicker} onPress={async () => { const uri = await pickPhoto(); if (uri) setStartPhotoUri(uri); }}>
                  {startPhotoUri
                    ? <Image source={{ uri: startPhotoUri }} style={st.photoPreview} />
                    : <><Ionicons name="camera" size={24} color={colors.textLight} /><Text style={st.photoLabel}>Foto Inicio</Text></>
                  }
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[commonStyles.saveButton, { marginBottom: spacing.lg }, saving && commonStyles.buttonDisabled]}
                onPress={handleCreate}
                disabled={saving}
              >
                <Text style={commonStyles.saveButtonText}>{saving ? 'Criando...' : 'Iniciar Atividade'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FinishActivityModal
        activity={activityToFinish}
        userId={user?.id}
        onClose={() => setActivityToFinish(null)}
        onFinished={() => { setActivityToFinish(null); loadActivities(); }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  actHeader: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  actInfo: { flex: 1, marginLeft: spacing.md },
  actDesc: { fontSize: fontSize.base, fontWeight: '700', color: colors.text },
  actLocation: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  actTag: { fontSize: fontSize.xs, color: colors.textLight, marginTop: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full },
  badgeText: { fontSize: fontSize.xs, fontWeight: '600' },
  timeRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  timeItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  timeText: { fontSize: fontSize.xs, color: colors.textSecondary },
  interferNote: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.xs, backgroundColor: colors.warningLight, padding: spacing.sm, borderRadius: radius.sm },
  interferText: { fontSize: fontSize.xs, color: colors.warning, flex: 1 },
  endBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.primary, gap: spacing.xs },
  endBtnText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
  photoRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  photoPicker: {
    flex: 1, height: 100, backgroundColor: colors.inputBg, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.md, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  photoPreview: { width: '100%', height: '100%', borderRadius: radius.md },
  photoLabel: { fontSize: fontSize.xs, color: colors.textLight, marginTop: spacing.xs },

  // Pre-op no modal de nova atividade
  sectionTitle: {
    fontSize: fontSize.base, fontWeight: '700', color: colors.primary,
    marginTop: spacing.md, marginBottom: spacing.xs, paddingBottom: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.primary + '30',
  },
  sectionHint: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  questionCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  questionCritical: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  questionHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  questionText: { flex: 1, fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  criticalBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.dangerLight, paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.full, marginLeft: spacing.xs,
  },
  criticalText: { fontSize: 10, fontWeight: '700', color: colors.danger },
  answerRow: { flexDirection: 'row', gap: spacing.sm },
  answerBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  answerYes: { backgroundColor: colors.success, borderColor: colors.success },
  answerNo: { backgroundColor: colors.danger, borderColor: colors.danger },
  answerText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary },
  answerTextActive: { color: colors.white },

  // Seletor de maquina (checklist do dia)
  machineChoice: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  machineChoiceSel: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  machineChoiceName: { fontSize: fontSize.base, fontWeight: '700', color: colors.text },
  machineChoiceTag: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
});
