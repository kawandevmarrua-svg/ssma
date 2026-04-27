import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { PreOperationCheck } from '../../src/types/database';
import { colors, spacing, radius, fontSize } from '../../src/theme/colors';

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

type QuestionKey = typeof PRE_OP_QUESTIONS[number]['key'];
type Answers = Record<QuestionKey, boolean | null>;

const INITIAL_ANSWERS: Answers = {
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

export default function PreOperacaoScreen() {
  const { operatorData } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingCheck, setExistingCheck] = useState<PreOperationCheck | null>(null);
  const [answers, setAnswers] = useState<Answers>({ ...INITIAL_ANSWERS });

  const today = new Date().toISOString().split('T')[0];

  const loadExisting = useCallback(async () => {
    if (!operatorData) return;

    const { data } = await supabase
      .from('pre_operation_checks')
      .select('*')
      .eq('operator_id', operatorData.id)
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setExistingCheck(data);
      setAnswers({
        checklist_fisico: data.checklist_fisico,
        prontos_preenchido: data.prontos_preenchido,
        apto_operar: data.apto_operar,
        conhece_limites: data.conhece_limites,
        art_disponivel: data.art_disponivel,
        liberacao_acesso: data.liberacao_acesso ?? false,
        pts_preenchida: data.pts_preenchida ?? false,
        local_adequado: data.local_adequado,
        local_sinalizado: data.local_sinalizado,
        manutencao_valida: data.manutencao_valida,
        radio_comunicacao: data.radio_comunicacao,
        epi_adequado: data.epi_adequado,
      });
    }
    setLoading(false);
  }, [operatorData, today]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  function setAnswer(key: QuestionKey, value: boolean) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (saving) return;
    if (!operatorData) return;

    const unanswered = PRE_OP_QUESTIONS.filter((q) => answers[q.key] === null);
    if (unanswered.length > 0) {
      Alert.alert('Atencao', 'Responda todas as perguntas antes de salvar.');
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('pre_operation_checks').insert({
      operator_id: operatorData.id,
      date: today,
      checklist_fisico: answers.checklist_fisico!,
      prontos_preenchido: answers.prontos_preenchido!,
      apto_operar: answers.apto_operar!,
      conhece_limites: answers.conhece_limites!,
      art_disponivel: answers.art_disponivel!,
      liberacao_acesso: answers.liberacao_acesso,
      pts_preenchida: answers.pts_preenchida,
      local_adequado: answers.local_adequado!,
      local_sinalizado: answers.local_sinalizado!,
      manutencao_valida: answers.manutencao_valida!,
      radio_comunicacao: answers.radio_comunicacao!,
      epi_adequado: answers.epi_adequado!,
    });

    setSaving(false);

    if (error) {
      if (error.code === '23505') {
        Alert.alert('Aviso', 'Pre-operacao ja registrada hoje.');
      } else {
        Alert.alert('Erro', error.message);
      }
      return;
    }

    const criticalFailed = PRE_OP_QUESTIONS.filter(
      (q) => q.critical && answers[q.key] === false
    );

    if (criticalFailed.length > 0) {
      Alert.alert(
        'Atencao',
        'Itens criticos marcados como NAO. O gestor sera notificado automaticamente.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } else {
      Alert.alert('Sucesso', 'Pre-operacao registrada com sucesso!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Verificacao Pre-Operacao</Text>
      <Text style={styles.subtitle}>
        Smart Vision — {new Date().toLocaleDateString('pt-BR')}
      </Text>

      {existingCheck && (
        <View style={styles.doneCard}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <Text style={styles.doneText}>Pre-operacao ja realizada hoje</Text>
        </View>
      )}

      {PRE_OP_QUESTIONS.map((q) => (
        <View key={q.key} style={[styles.questionCard, q.critical && styles.questionCritical]}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionText}>{q.label}</Text>
            {q.critical && (
              <View style={styles.criticalBadge}>
                <Text style={styles.criticalText}>Critico</Text>
              </View>
            )}
          </View>
          <View style={styles.answerRow}>
            <TouchableOpacity
              style={[styles.answerBtn, answers[q.key] === true && styles.answerYes]}
              onPress={() => !existingCheck && setAnswer(q.key, true)}
              disabled={!!existingCheck}
            >
              <Ionicons
                name="checkmark"
                size={18}
                color={answers[q.key] === true ? colors.white : colors.success}
              />
              <Text style={[styles.answerText, answers[q.key] === true && styles.answerTextSelected]}>
                Sim
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.answerBtn, answers[q.key] === false && styles.answerNo]}
              onPress={() => !existingCheck && setAnswer(q.key, false)}
              disabled={!!existingCheck}
            >
              <Ionicons
                name="close"
                size={18}
                color={answers[q.key] === false ? colors.white : colors.danger}
              />
              <Text style={[styles.answerText, answers[q.key] === false && styles.answerTextSelected]}>
                Nao
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {!existingCheck && (
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Salvando...' : 'Registrar Pre-Operacao'}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  doneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  doneText: { fontSize: fontSize.base, fontWeight: '600', color: colors.success },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  questionCritical: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  questionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  questionText: { flex: 1, fontSize: fontSize.base, fontWeight: '600', color: colors.text },
  criticalBadge: {
    backgroundColor: colors.dangerLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  criticalText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.danger },
  answerRow: { flexDirection: 'row', gap: spacing.sm },
  answerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  answerYes: { backgroundColor: colors.success, borderColor: colors.success },
  answerNo: { backgroundColor: colors.danger, borderColor: colors.danger },
  answerText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  answerTextSelected: { color: colors.white },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.white, fontSize: fontSize.base, fontWeight: '700' },
});
