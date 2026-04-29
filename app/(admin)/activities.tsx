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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { pickPhoto, uploadPhoto } from '../../src/lib/imageUtils';
import { Activity, PreOpQuestion } from '../../src/types/database';
import { colors, elevation, spacing, radius, fontSize } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';
import { Badge, Button, Text } from '../../src/components/ui';
import { FinishActivityModal } from '../../src/components/FinishActivityModal';

type PreOpAnswers = Record<string, boolean | null>;

interface ActivityRow {
  id: string;
  date: string;
  location: string | null;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  equipment_tag: string | null;
  had_interference: boolean;
  interference_notes: string | null;
  notes: string | null;
  transit_start: string | null;
  transit_end: string | null;
  equipment_photo_url: string | null;
  start_photo_url: string | null;
  end_photo_url: string | null;
  created_at: string;
  operator_id: string;
  checklist_id: string | null;
  profiles: { full_name: string | null } | null;
}

export default function AdminActivitiesScreen() {
  const { user, profile } = useAuth();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create modal
  const [createModal, setCreateModal] = useState(false);
  const [location, setLocation] = useState('');
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

  // Finish modal
  const [activityToFinish, setActivityToFinish] = useState<Activity | null>(null);
  const [saving, setSaving] = useState(false);

  const loadActivities = useCallback(async () => {
    if (!user) return;
    // Busca operadores criados por este admin
    const { data: myProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('created_by', user.id)
      .eq('role', 'operator');
    const opIds = (myProfiles ?? []).map((p) => p.id);
    // Inclui o proprio admin se ele tambem for operador
    if (!opIds.includes(user.id)) opIds.push(user.id);
    if (opIds.length === 0) { setActivities([]); setLoading(false); return; }
    const { data } = await supabase
      .from('activities')
      .select('*, profiles!activities_operator_id_fkey(full_name)')
      .in('operator_id', opIds).order('created_at', { ascending: false }).limit(50);
    setActivities((data as ActivityRow[] | null) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  function formatTime(t: string | null) {
    if (!t) return '--:--';
    return new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function resetCreateForm(initialAnswers: PreOpAnswers = {}) {
    setLocation(''); setDescription('');
    setEquipmentPhotoUri(null); setStartPhotoUri(null);
    setPreopAnswers(initialAnswers);
    setSelectedChecklistId(null);
  }

  async function openCreateModal() {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
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
    if (!user) return;
    if (!selectedChecklistId) {
      Alert.alert('Atencao', 'Selecione a maquina (checklist do dia) antes de iniciar.');
      return;
    }
    if (!location.trim() || !description.trim()) {
      Alert.alert('Atencao', 'Preencha local e descricao da atividade.');
      return;
    }
    if (!allPreopAnswered()) {
      Alert.alert('Atencao', `Responda todas as ${questions.length} perguntas da pre-operacao antes de iniciar.`);
      return;
    }
    const selectedChecklist = availableChecklists.find((c) => c.id === selectedChecklistId);
    setSaving(true);
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

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

    const { data: activity, error } = await supabase
      .from('activities')
      .insert({
        operator_id: user.id,
        pre_operation_id: preop.id,
        checklist_id: selectedChecklistId,
        machine_id: selectedChecklist?.machine_id ?? null,
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

  if (loading) {
    return <View style={st.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const ongoingActivities = activities.filter((a) => a.start_time && !a.end_time);
  const completedActivities = activities.filter((a) => !a.start_time || a.end_time);
  const hasOngoing = ongoingActivities.length > 0;

  function renderActivityCard(item: ActivityRow, isOngoing: boolean) {
    return (
      <View key={item.id} style={[st.card, isOngoing && st.ongoingCard]}>
        <View style={st.cardHeader}>
          <View style={st.headerLeft}>
            <Ionicons
              name={isOngoing ? 'time-outline' : 'checkmark-circle-outline'}
              size={14}
              color={colors.textSecondary}
            />
            <Text variant="captionStrong" tone="muted">
              {new Date(item.date).toLocaleDateString('pt-BR')} · {formatTime(item.start_time)} - {formatTime(item.end_time)}
            </Text>
          </View>
          <Badge
            label={isOngoing ? 'EM ANDAMENTO' : 'CONCLUÍDA'}
            variant={isOngoing ? 'warning' : 'success'}
            size="sm"
          />
        </View>

        {item.description && (
          <Text variant="h3" numberOfLines={2} style={{ marginBottom: 4 }}>
            {item.description}
          </Text>
        )}
        {item.profiles?.full_name && (
          <Text variant="caption" tone="muted">{item.profiles.full_name}</Text>
        )}

        <View style={st.meta}>
          {item.equipment_tag && (
            <View style={st.metaItem}>
              <Ionicons name="pricetag-outline" size={12} color={colors.textSecondary} />
              <Text variant="caption" tone="muted">{item.equipment_tag}</Text>
            </View>
          )}
          {item.location && (
            <View style={st.metaItem}>
              <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
              <Text variant="caption" tone="muted">{item.location}</Text>
            </View>
          )}
        </View>

        {isOngoing && (
          <Button
            label="Finalizar atividade"
            icon="stop-circle-outline"
            variant="primary"
            size="md"
            fullWidth
            onPress={() => setActivityToFinish(item as unknown as Activity)}
            style={{ marginTop: spacing.md }}
          />
        )}
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <ScrollView
        contentContainerStyle={commonStyles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadActivities(); setRefreshing(false); }} tintColor={colors.primary} />}
      >
        {hasOngoing && (
          <View style={st.sectionWrap}>
            <View style={st.sectionHeader}>
              <View style={st.sectionLeft}>
                <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                <Text variant="captionStrong" tone="muted">EM ANDAMENTO</Text>
              </View>
              <Badge label={String(ongoingActivities.length)} variant="warning" size="sm" />
            </View>
            {ongoingActivities.map((item) => renderActivityCard(item, true))}
          </View>
        )}

        <View style={st.sectionWrap}>
          <View style={st.sectionHeader}>
            <View style={st.sectionLeft}>
              <Ionicons name="checkmark-done-outline" size={14} color={colors.textSecondary} />
              <Text variant="captionStrong" tone="muted">CONCLUÍDAS</Text>
            </View>
            <Badge label={String(completedActivities.length)} variant="success" size="sm" />
          </View>
          {completedActivities.length === 0 && !hasOngoing && (
            <View style={commonStyles.empty}>
              <Ionicons name="construct-outline" size={40} color={colors.textLight} />
              <Text variant="callout" tone="muted" style={{ marginTop: spacing.md }}>
                Nenhuma atividade
              </Text>
              <Text variant="caption" tone="subtle" style={{ marginTop: 4 }}>
                Toque em + para registrar
              </Text>
            </View>
          )}
          {completedActivities.length === 0 && hasOngoing && (
            <View style={st.emptySection}>
              <Ionicons name="document-text-outline" size={28} color={colors.textLight} />
              <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
                Nenhuma atividade concluída ainda
              </Text>
            </View>
          )}
          {completedActivities.map((item) => renderActivityCard(item, false))}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[commonStyles.fab, { backgroundColor: colors.primary }]}
        onPress={() => {
          if (hasOngoing) {
            Alert.alert('Atividade em andamento', 'Finalize a atividade atual antes de iniciar uma nova.');
            return;
          }
          openCreateModal();
        }}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

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

              <Text style={st.preopSectionTitle}>Pre-Operacao (formulario Vale)</Text>
              <Text style={st.preopSectionHint}>Responda as {questions.length} perguntas antes de iniciar a atividade.</Text>
              {questions.map((q) => (
                <View key={q.id} style={[st.preopCard, q.critical && st.preopCardCritical]}>
                  <View style={st.preopHeaderRow}>
                    <Text style={st.preopText}>{q.label}</Text>
                    {q.critical && (
                      <View style={st.preopCriticalBadge}>
                        <Ionicons name="alert" size={12} color={colors.danger} />
                        <Text style={st.preopCriticalText}>Critico</Text>
                      </View>
                    )}
                  </View>
                  <View style={st.preopAnswerRow}>
                    <TouchableOpacity
                      style={[st.preopAnswerBtn, preopAnswers[q.id] === true && st.preopAnswerYes]}
                      onPress={() => setPreopAnswer(q.id, true)}
                    >
                      <Text style={preopAnswers[q.id] === true ? [st.preopAnswerText, st.preopAnswerTextActive] : st.preopAnswerText}>Sim</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[st.preopAnswerBtn, preopAnswers[q.id] === false && st.preopAnswerNo]}
                      onPress={() => setPreopAnswer(q.id, false)}
                    >
                      <Text style={preopAnswers[q.id] === false ? [st.preopAnswerText, st.preopAnswerTextActive] : st.preopAnswerText}>Não</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <Text style={st.preopSectionTitle}>Maquina (checklist do dia) *</Text>
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

              <Text style={st.preopSectionTitle}>Detalhes da Atividade</Text>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

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
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  sectionWrap: { marginBottom: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing['2xs'],
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emptySection: { alignItems: 'center', paddingVertical: spacing.xl },

  photoRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  photoPicker: {
    flex: 1, height: 100, backgroundColor: colors.background, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.sm, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  photoPreview: { width: '100%', height: '100%', borderRadius: radius.sm },
  photoLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs, fontWeight: '500' },

  preopSectionTitle: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary,
    marginTop: spacing.lg, marginBottom: spacing.sm,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  preopSectionHint: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: spacing.sm },
  preopCard: {
    backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  preopCardCritical: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  preopHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm, gap: spacing.sm },
  preopText: { flex: 1, fontSize: fontSize.sm, fontWeight: '600', color: colors.text, lineHeight: 18 },
  preopCriticalBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.dangerSurface, paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.full,
  },
  preopCriticalText: { fontSize: 10, fontWeight: '700', color: colors.danger, letterSpacing: 0.3 },
  preopAnswerRow: { flexDirection: 'row', gap: spacing.sm },
  preopAnswerBtn: {
    flex: 1, paddingVertical: spacing.sm + 2, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
    backgroundColor: colors.surface,
  },
  preopAnswerYes: { backgroundColor: colors.success, borderColor: colors.success },
  preopAnswerNo: { backgroundColor: colors.danger, borderColor: colors.danger },
  preopAnswerText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary },
  preopAnswerTextActive: { color: colors.white },

  machineChoice: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  machineChoiceSel: { borderColor: colors.primary, backgroundColor: colors.primarySurface },
  machineChoiceName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  machineChoiceTag: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
});
