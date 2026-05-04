import { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { todayLocal } from '../../src/lib/dates';
import { pickPhoto, uploadPhoto } from '../../src/lib/imageUtils';
import { ActivityType, ActivityQuestion, Location } from '../../src/types/database';
import { colors, spacing, radius, fontSize } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';
import { Text } from '../../src/components/ui';
import { AppHeader } from '../../src/components/AppHeader';
import { LocationPicker } from '../../src/components/LocationPicker';

type ActivityAnswers = Record<string, boolean | null>;
type ActivityNcDescriptions = Record<string, string>;
type ActivityNcPhotos = Record<string, string | null>;

export default function ServicoScreen() {
  const { user, profile } = useAuth();
  const { type_id } = useLocalSearchParams<{ type_id?: string }>();

  const [activityType, setActivityType] = useState<ActivityType | null>(null);
  const [questions, setQuestions] = useState<ActivityQuestion[]>([]);
  const [availableChecklists, setAvailableChecklists] = useState<
    { id: string; machine_name: string; tag: string | null; machine_id: string | null }[]
  >([]);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [equipmentPhotoUri, setEquipmentPhotoUri] = useState<string | null>(null);
  const [startPhotoUri, setStartPhotoUri] = useState<string | null>(null);
  const [preopAnswers, setPreopAnswers] = useState<ActivityAnswers>({});
  const [preopNcDescriptions, setPreopNcDescriptions] = useState<ActivityNcDescriptions>({});
  const [preopNcPhotos, setPreopNcPhotos] = useState<ActivityNcPhotos>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const today = todayLocal();
  const userId = user?.id ?? null;
  const isEncarregado = profile?.role === 'encarregado';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!type_id || !userId) return;
      // Buscamos TODOS os checklists do dia do operador (sem filtrar por
      // status/result aqui) para conseguir dar uma mensagem precisa quando
      // nao encontrar nenhum elegivel.
      // Limpa qualquer estado residual da tela (em caso de re-uso do componente
      // entre criacoes, p.ex. quando o operador finaliza uma atividade e abre outra
      // do mesmo tipo, os campos abaixo nao podem vir preenchidos).
      setLoading(true);
      setActivityType(null);
      setQuestions([]);
      setAvailableChecklists([]);
      setSelectedChecklistId(null);
      setSelectedLocation(null);
      setDescription('');
      setEquipmentPhotoUri(null);
      setStartPhotoUri(null);
      setPreopAnswers({});
      setPreopNcDescriptions({});
      setPreopNcPhotos({});

      const [typeRes, clRes, qRes] = await Promise.all([
        supabase.from('activity_types').select('*').eq('id', type_id).single(),
        supabase
          .from('checklists')
          .select('id, machine_name, tag, machine_id, status, result')
          .eq('operator_id', userId)
          .eq('date', today)
          .order('created_at', { ascending: false }),
        isEncarregado
          ? Promise.resolve({ data: null, error: null })
          : supabase
              .from('activity_questions')
              .select('*')
              .eq('active', true)
              .order('order_index', { ascending: true }),
      ]);
      if (cancelled) return;

      if (typeRes.error || !typeRes.data) {
        Alert.alert('Erro', 'Tipo de atividade nao encontrado.');
        router.replace('/(operator)/atividade');
        return;
      }

      const allToday = clRes.data ?? [];
      const eligible = allToday.filter(
        (c) => c.status === 'pending' && c.result === 'released',
      );

      if (!isEncarregado && eligible.length === 0) {
        let title = 'Checklist necessario';
        let message: string;
        if (allToday.length === 0) {
          message = 'Voce nao realizou nenhum checklist hoje. Faca o checklist do equipamento antes de iniciar uma atividade.';
        } else {
          const finalized = allToday.filter((c) => c.status === 'completed').length;
          const notReleased = allToday.filter((c) => c.result === 'not_released').length;
          if (notReleased > 0 && finalized === 0) {
            title = 'Equipamento nao liberado';
            message = 'Seu checklist de hoje resultou em "Nao liberado". Solicite manutencao ou refaca o checklist em outro equipamento.';
          } else if (finalized > 0 && notReleased === 0) {
            title = 'Checklist ja finalizado';
            message = 'Voce ja encerrou seu checklist de hoje. Para iniciar uma nova atividade, faca um novo checklist.';
          } else {
            message = 'Voce tem checklists hoje, mas nenhum esta liberado e em uso. Verifique a aba Checklist.';
          }
        }
        Alert.alert(title, message);
        router.replace('/(operator)/atividade');
        return;
      }

      const qList = isEncarregado ? [] : (qRes.data ?? []) as ActivityQuestion[];
      const initial: ActivityAnswers = {};
      for (const q of qList) initial[q.id] = null;

      const eligibleMapped = eligible.map((c) => ({
        id: c.id,
        machine_name: c.machine_name,
        tag: c.tag,
        machine_id: c.machine_id,
      }));

      const autoChecklistId = isEncarregado ? null : (eligibleMapped[0]?.id ?? null);

      setActivityType(typeRes.data as ActivityType);
      setQuestions(qList);
      setAvailableChecklists(isEncarregado ? [] : eligibleMapped);
      setSelectedChecklistId(autoChecklistId);
      setPreopAnswers(initial);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [type_id, userId, today]);

  function setPreopAnswer(questionId: string, value: boolean) {
    setPreopAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (value === true) {
      // Operador mudou de "Nao" para "Sim": limpa evidencia coletada antes
      // para nao persistir foto/descricao orfas no banco.
      setPreopNcDescriptions((prev) => {
        const { [questionId]: _drop, ...rest } = prev;
        return rest;
      });
      setPreopNcPhotos((prev) => {
        const { [questionId]: _drop, ...rest } = prev;
        return rest;
      });
    }
  }

  function setPreopNcDescription(questionId: string, value: string) {
    setPreopNcDescriptions((prev) => ({ ...prev, [questionId]: value }));
  }

  async function pickPreopNcPhoto(questionId: string) {
    const uri = await pickPhoto();
    if (uri) setPreopNcPhotos((prev) => ({ ...prev, [questionId]: uri }));
  }

  function allPreopAnswered() {
    // Sem perguntas configuradas, "todas respondidas" eh trivialmente true.
    // Antes retornava false e travava o submit em instalacoes sem pre-op.
    if (questions.length === 0) return true;
    return questions.every((q) => {
      const ans = preopAnswers[q.id];
      if (ans === true) return true;
      if (ans === false) return !!preopNcPhotos[q.id];
      return false;
    });
  }

  async function handleCreate() {
    if (saving) return;
    if (!user || !activityType) return;
    if (!isEncarregado && !selectedChecklistId) {
      Alert.alert('Atencao', 'Selecione a maquina (checklist do dia) antes de iniciar.');
      return;
    }
    if (!selectedLocation) {
      Alert.alert('Atencao', 'Selecione o local da atividade.');
      return;
    }
    if (activityType.allow_custom && !description.trim()) {
      Alert.alert('Atencao', 'Descreva a atividade.');
      return;
    }
    if (!isEncarregado && !allPreopAnswered()) {
      const hasNoWithoutPhoto = questions.some(
        (q) => preopAnswers[q.id] === false && !preopNcPhotos[q.id],
      );
      if (hasNoWithoutPhoto) {
        Alert.alert(
          'Atencao',
          'Anexe uma foto em cada pergunta respondida com "Nao" antes de iniciar.',
        );
      } else {
        Alert.alert('Atencao', `Responda todas as ${questions.length} perguntas da pre-operacao antes de iniciar.`);
      }
      return;
    }

    const selectedChecklist = availableChecklists.find((c) => c.id === selectedChecklistId);

    setSaving(true);
    const now = new Date().toISOString();

    // Activity ID gerado no cliente: permite subir as fotos pra um prefixo
    // estavel ANTES de inserir qualquer linha. Se algum upload falhar, abortamos
    // sem deixar activity_answers/activities orfaos.
    const activityId = Crypto.randomUUID();
    const uploadedPaths: string[] = [];

    try {
      // FASE 1 — Sobe TODAS as fotos primeiro. Qualquer falha aborta a
      // operacao inteira (sem inserts no banco) e limpa o storage.
      const ncPhotoPaths: Record<string, string> = {};
      for (const q of questions) {
        if (preopAnswers[q.id] !== false) continue;
        const uri = preopNcPhotos[q.id];
        if (!uri) continue;
        const path = await uploadPhoto(
          uri,
          'activity-photos',
          `${user.id}/${activityId}/preop/${q.id}`,
        );
        if (!path) throw new Error('Falha ao enviar foto da atividade. Tente novamente.');
        ncPhotoPaths[q.id] = path;
        uploadedPaths.push(path);
      }

      let equipmentPath: string | null = null;
      if (equipmentPhotoUri) {
        equipmentPath = await uploadPhoto(
          equipmentPhotoUri,
          'activity-photos',
          `${user.id}/${activityId}/equipment`,
        );
        if (!equipmentPath) throw new Error('Falha ao enviar foto do equipamento. Tente novamente.');
        uploadedPaths.push(equipmentPath);
      }

      let startPath: string | null = null;
      if (startPhotoUri) {
        startPath = await uploadPhoto(
          startPhotoUri,
          'activity-photos',
          `${user.id}/${activityId}/start`,
        );
        if (!startPath) throw new Error('Falha ao enviar foto de inicio. Tente novamente.');
        uploadedPaths.push(startPath);
      }

      // FASE 2 — activities
      const finalDescription = activityType.allow_custom
        ? `${activityType.code} - ${description.trim()}`
        : activityType.description;

      const { error: actErr } = await supabase.from('activities').insert({
        id: activityId,
        operator_id: user.id,
        checklist_id: selectedChecklistId,
        machine_id: selectedChecklist?.machine_id ?? null,
        activity_type_id: activityType.id,
        date: today,
        equipment_tag: selectedChecklist?.tag ?? null,
        location: selectedLocation.name,
        description: finalDescription,
        start_time: now,
        equipment_photo_url: equipmentPath,
        start_photo_url: startPath,
      });
      if (actErr) throw new Error(actErr.message);

      // FASE 3 — activity_answers
      if (questions.length > 0) {
        const answerRows = questions.map((q) => {
          const value = preopAnswers[q.id]!;
          const row: {
            activity_id: string;
            question_id: string;
            value: boolean;
            nc_description?: string | null;
            nc_photo_url?: string | null;
          } = { activity_id: activityId, question_id: q.id, value };
          if (value === false) {
            const desc = preopNcDescriptions[q.id]?.trim();
            if (desc) row.nc_description = desc;
            const photo = ncPhotoPaths[q.id];
            if (photo) row.nc_photo_url = photo;
          }
          return row;
        });
        const { error: ansErr } = await supabase.from('activity_answers').insert(answerRows);
        if (ansErr) {
          await supabase.from('activities').delete().eq('id', activityId);
          throw new Error(ansErr.message);
        }
      }

      setSaving(false);
      router.replace('/(operator)/atividade');
    } catch (e: any) {
      // Limpa qualquer foto que tenha sido enviada antes do erro.
      if (uploadedPaths.length > 0) {
        try {
          await supabase.storage.from('activity-photos').remove(uploadedPaths);
        } catch {
          // best-effort cleanup; nao trava o fluxo do operador
        }
      }
      setSaving(false);
      Alert.alert('Erro', e?.message ?? 'Erro ao criar atividade.');
    }
  }

  const answeredCount = questions.filter((q) => {
    const ans = preopAnswers[q.id];
    if (ans === true) return true;
    if (ans === false) return !!preopNcPhotos[q.id];
    return false;
  }).length;

  if (loading) {
    return (
      <View style={commonStyles.container}>
        <AppHeader onBack={() => router.back()} />
        <View style={st.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={st.loadingText}>Preparando atividade…</Text>
          <Text style={st.loadingHint}>Carregando equipamento, local e perguntas</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <AppHeader onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
          {activityType && (
            <>
              <Text style={st.eyebrow}>Tipo de atividade</Text>
              <View style={st.activityCard}>
                <View style={st.activityAvatar}>
                  <Text style={st.activityCode}>{activityType.code}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.activityName} numberOfLines={2}>
                    {activityType.description}
                  </Text>
                  <Text style={st.activityRole}>
                    {activityType.allow_custom ? 'Descrição livre' : 'Atividade fixa'}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Maquina — apenas para operadores */}
          {!isEncarregado && <Text style={st.sectionLabel}>Equipamento</Text>}
          {!isEncarregado && availableChecklists.map((c) => {
            const isSel = c.id === selectedChecklistId;
            return (
              <TouchableOpacity
                key={c.id}
                style={[st.choiceCard, isSel && st.choiceCardSel]}
                onPress={() => setSelectedChecklistId(c.id)}
                activeOpacity={0.85}
              >
                <View style={[st.choiceAvatar, isSel && st.choiceAvatarSel]}>
                  <Ionicons
                    name="image-outline"
                    size={22}
                    color={isSel ? colors.primary : colors.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.choiceName} numberOfLines={1}>{c.machine_name}</Text>
                  <Text style={st.choiceTag}>{c.tag || 'Sem TAG'}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Local */}
          <Text style={st.sectionLabel}>Local</Text>
          <TouchableOpacity
            style={[st.choiceCard, !!selectedLocation && st.choiceCardSel]}
            onPress={() => setLocationPickerVisible(true)}
            activeOpacity={0.85}
          >
            <View style={[st.choiceAvatar, !!selectedLocation && st.choiceAvatarSel]}>
              <Ionicons
                name="location-outline"
                size={22}
                color={selectedLocation ? colors.primary : colors.textSecondary}
              />
            </View>
            <View style={{ flex: 1 }}>
              {selectedLocation ? (
                <>
                  <Text style={st.choiceName} numberOfLines={1}>{selectedLocation.name}</Text>
                  <Text style={st.choiceTag}>{selectedLocation.code || 'Local'}</Text>
                </>
              ) : (
                <>
                  <Text style={st.choiceName}>Selecionar local</Text>
                  <Text style={st.choiceTagPlaceholder}>Toque para escolher</Text>
                </>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
          </TouchableOpacity>

          {/* Descricao livre */}
          {activityType?.allow_custom && (
            <>
              <Text style={st.sectionLabel}>Descrição da atividade</Text>
              <TextInput
                style={st.textInput}
                placeholder="Descreva a atividade"
                placeholderTextColor={colors.textLight}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </>
          )}

          {/* Pre-operacao: apenas para operadores */}
          {!isEncarregado && <View style={st.progressWrap}>
            <View style={st.progressTextRow}>
              <Text style={st.progressLabel}>Pré-operação</Text>
              <Text style={st.progressCount}>{answeredCount} de {questions.length}</Text>
            </View>
            <View style={st.progressBar}>
              <View
                style={[
                  st.progressFill,
                  { width: questions.length > 0 ? `${(answeredCount / questions.length) * 100}%` : '0%' },
                ]}
              />
            </View>
          </View>

          {!isEncarregado && questions.map((q, idx) => {
            const ans = preopAnswers[q.id];
            const isYes = ans === true;
            const isNo = ans === false;
            const ncPhoto = preopNcPhotos[q.id] ?? null;
            const answered = isYes || (isNo && !!ncPhoto);
            return (
              <View
                key={q.id}
                style={[
                  st.questionCard,
                  q.critical && st.questionCritical,
                  answered && isYes && st.questionAnswered,
                  isNo && st.questionNc,
                ]}
              >
                <View style={st.questionHeaderRow}>
                  <View style={st.questionNumber}>
                    <Text style={st.questionNumberText}>{idx + 1}</Text>
                  </View>
                  <Text style={st.questionText}>{q.label}</Text>
                  {answered && isYes && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  )}
                  {isNo && (
                    <Ionicons name="alert-circle" size={18} color={colors.danger} />
                  )}
                </View>
                {q.critical && (
                  <View style={st.criticalRow}>
                    <Ionicons name="alert" size={11} color={colors.danger} />
                    <Text style={st.criticalText}>Pergunta crítica</Text>
                  </View>
                )}

                <View style={st.answerRow}>
                  <TouchableOpacity
                    style={[st.answerBtn, isYes && st.answerYes]}
                    onPress={() => setPreopAnswer(q.id, true)}
                    activeOpacity={0.85}
                  >
                    <Text style={isYes ? [st.answerText, st.answerTextActive] : st.answerText}>Sim</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[st.answerBtn, isNo && st.answerNo]}
                    onPress={() => setPreopAnswer(q.id, false)}
                    activeOpacity={0.85}
                  >
                    <Text style={isNo ? [st.answerText, st.answerTextActive] : st.answerText}>Não</Text>
                  </TouchableOpacity>
                </View>

                {isNo && (
                  <View style={st.ncPanel}>
                    <Text style={st.ncPanelTitle}>Evidência da não conformidade</Text>
                    <TextInput
                      style={[st.textInput, { marginBottom: spacing.sm }]}
                      placeholder="Descreva o que aconteceu (opcional)"
                      placeholderTextColor={colors.textLight}
                      value={preopNcDescriptions[q.id] ?? ''}
                      onChangeText={(t) => setPreopNcDescription(q.id, t)}
                      multiline
                      numberOfLines={3}
                    />
                    <TouchableOpacity
                      style={st.ncPhotoBtn}
                      onPress={() => pickPreopNcPhoto(q.id)}
                      activeOpacity={0.85}
                    >
                      {ncPhoto ? (
                        <Image source={{ uri: ncPhoto }} style={st.ncPhotoPreview} />
                      ) : (
                        <>
                          <Ionicons name="camera" size={20} color={colors.text} />
                          <Text style={st.ncPhotoBtnText}>Tirar foto da evidência</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          {/* Fotos opcionais */}
          <Text style={st.sectionLabel}>Registros visuais</Text>
          <View style={st.photoRow}>
            <TouchableOpacity
              style={st.photoPicker}
              onPress={async () => {
                const uri = await pickPhoto();
                if (uri) setEquipmentPhotoUri(uri);
              }}
              activeOpacity={0.85}
            >
              {equipmentPhotoUri ? (
                <Image source={{ uri: equipmentPhotoUri }} style={st.photoPreview} />
              ) : (
                <>
                  <Ionicons name="camera" size={24} color={colors.textLight} />
                  <Text style={st.photoLabel}>Equipamento</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={st.photoPicker}
              onPress={async () => {
                const uri = await pickPhoto();
                if (uri) setStartPhotoUri(uri);
              }}
              activeOpacity={0.85}
            >
              {startPhotoUri ? (
                <Image source={{ uri: startPhotoUri }} style={st.photoPreview} />
              ) : (
                <>
                  <Ionicons name="camera" size={24} color={colors.textLight} />
                  <Text style={st.photoLabel}>Início</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[st.cta, saving && st.ctaDisabled]}
            onPress={handleCreate}
            disabled={saving}
            activeOpacity={0.9}
          >
            <Ionicons name="play-circle" size={20} color={colors.white} />
            <Text style={st.ctaText}>{saving ? 'Criando...' : 'Iniciar atividade'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <LocationPicker
        visible={locationPickerVisible}
        onClose={() => setLocationPickerVisible(false)}
        onSelect={(loc) => setSelectedLocation(loc)}
      />

      {saving && (
        <View style={st.savingOverlay} pointerEvents="auto">
          <View style={st.savingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={st.savingTitle}>Salvando atividade…</Text>
            <Text style={st.savingHint}>Enviando fotos e registrando dados</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  topBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  backText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },

  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },

  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  loadingHint: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  savingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 220,
  },
  savingTitle: {
    marginTop: spacing.sm,
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  savingHint: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  eyebrow: {
    fontSize: fontSize['2xs'],
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    fontSize: fontSize['2xs'],
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  // Tipo de atividade card
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  activityAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityCode: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: colors.primary,
    fontFamily: 'monospace',
    letterSpacing: 0.4,
  },
  activityName: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  activityRole: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },

  // Choice card (maquina, local) — mesmo estilo do encarregado
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  choiceCardSel: { borderColor: colors.primary, borderWidth: 2 },
  choiceAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceAvatarSel: { backgroundColor: colors.primarySurface },
  choiceName: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  choiceTag: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  choiceTagPlaceholder: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    fontWeight: '500',
    marginTop: 2,
  },

  // Inputs
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.sm,
    color: colors.text,
    minHeight: 44,
  },

  // Progress
  progressWrap: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  progressBar: { height: 4, backgroundColor: colors.surfaceMuted, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.text, borderRadius: 2 },
  progressLabel: {
    fontSize: fontSize['2xs'], fontWeight: '700', color: colors.textSecondary,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  progressCount: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },

  // Question card
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questionCritical: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  questionAnswered: { borderColor: colors.successLight, backgroundColor: colors.successSurface },
  questionNc: { borderColor: colors.dangerLight, backgroundColor: colors.dangerSurface },
  questionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  questionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionNumberText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  questionText: { flex: 1, fontSize: fontSize.sm, fontWeight: '600', color: colors.text, lineHeight: 20, paddingTop: 2 },
  criticalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
    marginLeft: 32,
  },
  criticalText: { fontSize: 10, fontWeight: '700', color: colors.danger, letterSpacing: 0.4, textTransform: 'uppercase' },

  // Sim / Nao
  answerRow: { flexDirection: 'row', gap: spacing.sm },
  answerBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  answerYes: { backgroundColor: colors.success, borderColor: colors.success },
  answerNo: { backgroundColor: colors.danger, borderColor: colors.danger },
  answerText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary },
  answerTextActive: { color: colors.white },

  // NC panel
  ncPanel: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSurface,
  },
  ncPanelTitle: {
    fontSize: fontSize['2xs'],
    fontWeight: '700',
    color: colors.dangerDark,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  ncPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    minHeight: 60,
  },
  ncPhotoBtnText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  ncPhotoPreview: { width: '100%', height: 120, borderRadius: radius.sm },

  // Fotos
  photoRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  photoPicker: {
    flex: 1,
    height: 110,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPreview: { width: '100%', height: '100%', borderRadius: radius.md },
  photoLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs, fontWeight: '600' },

  // CTA
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.full,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.white, letterSpacing: 0.2 },
});
