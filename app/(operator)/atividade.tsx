import { useEffect, useState, useCallback } from 'react';
import {
  View,
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
import { useKeepAwake } from 'expo-keep-awake';
import { useAuth } from '../../src/contexts/AuthContext';
import { usePendingFinishes } from '../../src/hooks/usePendingFinishes';
import { supabase } from '../../src/lib/supabase';
import { pickPhoto, uploadPhoto } from '../../src/lib/imageUtils';
import { Activity, PreOpQuestion, Location, ActivityType } from '../../src/types/database';
import { colors, elevation, spacing, radius, fontSize } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';
import { Badge, Button, Text } from '../../src/components/ui';
import { FinishActivityModal } from '../../src/components/FinishActivityModal';
import { LocationPicker } from '../../src/components/LocationPicker';
import { ActivityTypePicker } from '../../src/components/ActivityTypePicker';

type PreOpAnswers = Record<string, boolean | null>;

export default function AtividadeScreen() {
  const { user, profile } = useAuth();
  useKeepAwake();
  const pendingFinishes = usePendingFinishes();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [activityToFinish, setActivityToFinish] = useState<Activity | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType | null>(null);
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [equipmentPhotoUri, setEquipmentPhotoUri] = useState<string | null>(null);
  const [startPhotoUri, setStartPhotoUri] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PreOpQuestion[]>([]);
  const [preopAnswers, setPreopAnswers] = useState<PreOpAnswers>({});
  const [availableChecklists, setAvailableChecklists] = useState<{ id: string; machine_name: string; tag: string | null; machine_id: string | null }[]>([]);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);

  function setPreopAnswer(questionId: string, value: boolean) {
    setPreopAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function allPreopAnswered() {
    return questions.length > 0 && questions.every((q) => preopAnswers[q.id] === true || preopAnswers[q.id] === false);
  }

  const today = new Date().toISOString().split('T')[0];

  const loadActivities = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('operator_id', user.id)
      .eq('date', today)
      .order('created_at', { ascending: false });
    if (error) Alert.alert('Erro', 'Falha ao carregar atividades.');
    setActivities(data ?? []);
    setLoading(false);
  }, [user, today]);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  async function onRefresh() {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  }

  function resetCreateForm(initialAnswers: PreOpAnswers = {}) {
    setSelectedLocation(null);
    setActivityType(null);
    setDescription('');
    setEquipmentPhotoUri(null);
    setStartPhotoUri(null);
    setPreopAnswers(initialAnswers);
    setSelectedChecklistId(null);
  }

  async function openCreateModal() {
    if (!user) return;
    const [{ data: cls }, { data: qs }] = await Promise.all([
      supabase
        .from('checklists')
        .select('id, machine_name, tag, machine_id')
        .eq('operator_id', user.id)
        .eq('date', today)
        .eq('result', 'released')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('pre_op_questions')
        .select('*')
        .eq('active', true)
        .order('order_index', { ascending: true }),
    ]);
    const list = cls ?? [];
    if (list.length === 0) {
      Alert.alert(
        'Checklist necessario',
        'Voce precisa realizar o checklist do equipamento antes de iniciar uma atividade.',
      );
      return;
    }
    const qList = (qs ?? []) as PreOpQuestion[];
    setQuestions(qList);
    const initial: PreOpAnswers = {};
    for (const q of qList) initial[q.id] = null;
    resetCreateForm(initial);
    setAvailableChecklists(list);
    setCreateModal(true);
  }

  async function handleCreate() {
    if (saving) return;
    if (!user) return;
    if (!selectedChecklistId) {
      Alert.alert('Atencao', 'Selecione a maquina (checklist do dia) antes de iniciar.');
      return;
    }
    if (!selectedLocation) {
      Alert.alert('Atencao', 'Selecione o local da atividade.');
      return;
    }
    if (!activityType) {
      Alert.alert('Atencao', 'Selecione o tipo de atividade.');
      return;
    }
    if (activityType.allow_custom && !description.trim()) {
      Alert.alert('Atencao', 'Descreva a atividade.');
      return;
    }
    if (!allPreopAnswered()) {
      Alert.alert('Atencao', `Responda todas as ${questions.length} perguntas da pre-operacao antes de iniciar.`);
      return;
    }
    const selectedChecklist = availableChecklists.find((c) => c.id === selectedChecklistId);

    setSaving(true);
    const now = new Date().toISOString();

    // 1) Cria a pre-operacao desta atividade
    const { data: preop, error: preopErr } = await supabase
      .from('pre_operation_checks')
      .insert({ operator_id: user.id, date: today })
      .select()
      .single();

    if (preopErr || !preop) {
      Alert.alert('Erro', preopErr?.message ?? 'Falha ao salvar pre-operacao.');
      setSaving(false);
      return;
    }

    const answerRows = questions.map((q) => ({
      check_id: preop.id,
      question_id: q.id,
      value: preopAnswers[q.id]!,
    }));
    const { error: ansErr } = await supabase.from('pre_op_answers').insert(answerRows);
    if (ansErr) {
      Alert.alert('Erro', ansErr.message);
      setSaving(false);
      return;
    }

    const finalDescription = activityType.allow_custom
      ? `${activityType.code} - ${description.trim()}`
      : activityType.description;

    // 2) Cria a atividade vinculada a essa pre-operacao
    const { data: activity, error } = await supabase
      .from('activities')
      .insert({
        operator_id: user.id,
        pre_operation_id: preop.id,
        checklist_id: selectedChecklistId,
        machine_id: selectedChecklist?.machine_id ?? null,
        activity_type_id: activityType.id,
        date: today,
        equipment_tag: selectedChecklist?.tag ?? null,
        location: selectedLocation.name,
        description: finalDescription,
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
    const isQueuedFinish = pendingFinishes.activityIds.has(item.id);
    const inProgress = !item.end_time && !isQueuedFinish;
    return (
      <View style={[st.card, inProgress && st.ongoingCard]}>
        <View style={st.cardHeader}>
          <View style={st.headerLeft}>
            <Ionicons
              name={isQueuedFinish ? 'cloud-upload-outline' : inProgress ? 'time-outline' : 'checkmark-circle-outline'}
              size={14}
              color={colors.textSecondary}
            />
            <Text variant="captionStrong" tone="muted">
              {formatTime(item.start_time)}{item.end_time ? ` - ${formatTime(item.end_time)}` : ''}
            </Text>
          </View>
          <Badge
            label={isQueuedFinish ? 'SINCRONIZANDO' : inProgress ? 'EM ANDAMENTO' : 'FINALIZADA'}
            variant={isQueuedFinish ? 'warning' : inProgress ? 'warning' : 'success'}
            size="sm"
          />
        </View>

        <Text variant="h3" numberOfLines={2} style={{ marginBottom: 4 }}>
          {item.description}
        </Text>
        <View style={st.metaRow}>
          {item.location && (
            <View style={st.metaItem}>
              <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
              <Text variant="caption" tone="muted">{item.location}</Text>
            </View>
          )}
          {item.equipment_tag && (
            <View style={st.metaItem}>
              <Ionicons name="pricetag-outline" size={12} color={colors.textSecondary} />
              <Text variant="caption" tone="muted">{item.equipment_tag}</Text>
            </View>
          )}
        </View>

        {item.had_interference && (
          <View style={st.interferNote}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.warningDark} />
            <Text variant="caption" tone="warning" style={{ flex: 1 }}>
              Interferência: {item.interference_notes || 'Sim'}
            </Text>
          </View>
        )}

        {inProgress && (
          <Button
            label="Finalizar atividade"
            icon="stop-circle-outline"
            variant="primary"
            size="md"
            fullWidth
            onPress={() => setActivityToFinish(item)}
            style={{ marginTop: spacing.md }}
          />
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
              <Ionicons name="construct-outline" size={40} color={colors.textLight} />
              <Text variant="callout" tone="muted" style={{ marginTop: spacing.md }}>
                Nenhuma atividade hoje
              </Text>
              <Text variant="caption" tone="subtle" style={{ marginTop: 4 }}>
                Toque em + para registrar
              </Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        style={st.fab}
        onPress={openCreateModal}
      >
        <Ionicons name="add" size={26} color={colors.white} />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={createModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={commonStyles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={commonStyles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={commonStyles.modalHeader}>
                <Text variant="h2">Nova atividade</Text>
                <TouchableOpacity onPress={() => { setCreateModal(false); resetCreateForm(); }} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={st.sectionTitle}>Pre-Operacao (formulario Vale)</Text>
              <Text style={st.sectionHint}>Responda as {questions.length} perguntas antes de iniciar a atividade.</Text>
              {questions.map((q) => (
                <View key={q.id} style={[st.questionCard, q.critical && st.questionCritical]}>
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
                      style={[st.answerBtn, preopAnswers[q.id] === true && st.answerYes]}
                      onPress={() => setPreopAnswer(q.id, true)}
                    >
                      <Text style={preopAnswers[q.id] === true ? [st.answerText, st.answerTextActive] : st.answerText}>Sim</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[st.answerBtn, preopAnswers[q.id] === false && st.answerNo]}
                      onPress={() => setPreopAnswer(q.id, false)}
                    >
                      <Text style={preopAnswers[q.id] === false ? [st.answerText, st.answerTextActive] : st.answerText}>Não</Text>
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
                <TouchableOpacity
                  style={st.typePickerBtn}
                  onPress={() => setLocationPickerVisible(true)}
                >
                  {selectedLocation ? (
                    <View style={{ flex: 1 }}>
                      <Text style={st.machineChoiceName}>{selectedLocation.name}</Text>
                      {selectedLocation.code && (
                        <Text style={st.machineChoiceTag}>{selectedLocation.code}</Text>
                      )}
                    </View>
                  ) : (
                    <Text style={st.typePickerPlaceholder}>Toque para selecionar a localidade</Text>
                  )}
                  <Ionicons name="location-outline" size={18} color={colors.textLight} />
                </TouchableOpacity>
              </View>

              <View style={commonStyles.inputGroup}>
                <Text style={commonStyles.label}>Tipo de atividade *</Text>
                <TouchableOpacity
                  style={st.typePickerBtn}
                  onPress={() => setTypePickerVisible(true)}
                >
                  {activityType ? (
                    <View style={{ flex: 1 }}>
                      <Text style={st.typePickerCode}>{activityType.code}</Text>
                      <Text style={st.typePickerDesc}>{activityType.description}</Text>
                    </View>
                  ) : (
                    <Text style={st.typePickerPlaceholder}>Toque para escolher (codigo ou descricao)</Text>
                  )}
                  <Ionicons name="search" size={18} color={colors.textLight} />
                </TouchableOpacity>
              </View>

              {activityType?.allow_custom && (
                <View style={commonStyles.inputGroup}>
                  <Text style={commonStyles.label}>Informe a atividade *</Text>
                  <TextInput
                    style={[commonStyles.input, commonStyles.textArea]}
                    placeholder="Descreva a atividade"
                    placeholderTextColor={colors.textLight}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              )}

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

              <Button
                label={saving ? 'Criando...' : 'Iniciar atividade'}
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

      <LocationPicker
        visible={locationPickerVisible}
        onClose={() => setLocationPickerVisible(false)}
        onSelect={(loc) => setSelectedLocation(loc)}
      />

      <ActivityTypePicker
        visible={typePickerVisible}
        onClose={() => setTypePickerVisible(false)}
        onSelect={(t) => {
          setActivityType(t);
          if (!t.allow_custom) setDescription('');
        }}
      />

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
  ongoingCard: { borderLeftWidth: 3, borderLeftColor: colors.warning },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  interferNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.warningSurface,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },

  // FAB
  fab: {
    position: 'absolute', bottom: spacing.lg, right: spacing.lg,
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    ...elevation.brand,
  },

  // Modal photos
  photoRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  photoPicker: {
    flex: 1, height: 100, backgroundColor: colors.background, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.sm, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  photoPreview: { width: '100%', height: '100%', borderRadius: radius.sm },
  photoLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs, fontWeight: '500' },

  // Pre-op
  sectionTitle: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary,
    marginTop: spacing.lg, marginBottom: spacing.sm,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  sectionHint: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: spacing.sm },
  questionCard: {
    backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  questionCritical: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  questionHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm, gap: spacing.sm },
  questionText: { flex: 1, fontSize: fontSize.sm, fontWeight: '600', color: colors.text, lineHeight: 18 },
  criticalBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.dangerSurface, paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.full,
  },
  criticalText: { fontSize: 10, fontWeight: '700', color: colors.danger, letterSpacing: 0.3 },
  answerRow: { flexDirection: 'row', gap: spacing.sm },
  answerBtn: {
    flex: 1, paddingVertical: spacing.sm + 2, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
    backgroundColor: colors.surface,
  },
  answerYes: { backgroundColor: colors.success, borderColor: colors.success },
  answerNo: { backgroundColor: colors.danger, borderColor: colors.danger },
  answerText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary },
  answerTextActive: { color: colors.white },

  // Seletor de máquina
  machineChoice: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  machineChoiceSel: { borderColor: colors.primary, backgroundColor: colors.primarySurface },
  machineChoiceName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  machineChoiceTag: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  // Picker de localidade
  typePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: 52,
  },
  typePickerPlaceholder: { flex: 1, fontSize: fontSize.sm, color: colors.textLight },
  typePickerCode: { fontSize: fontSize.xs, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },
  typePickerDesc: { fontSize: fontSize.sm, color: colors.text, marginTop: 2 },
});
