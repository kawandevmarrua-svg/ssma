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
import { PreOperationCheck, PreOpQuestion } from '../../src/types/database';
import { colors, spacing, radius, fontSize } from '../../src/theme/colors';

type Answers = Record<string, boolean | null>;

export default function PreOperacaoScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingCheck, setExistingCheck] = useState<PreOperationCheck | null>(null);
  const [questions, setQuestions] = useState<PreOpQuestion[]>([]);
  const [answers, setAnswers] = useState<Answers>({});

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    if (!user) return;

    const { data: qs } = await supabase
      .from('pre_op_questions')
      .select('*')
      .eq('active', true)
      .order('order_index', { ascending: true });

    const list = (qs ?? []) as PreOpQuestion[];
    setQuestions(list);

    const { data: existing } = await supabase
      .from('pre_operation_checks')
      .select('*')
      .eq('operator_id', user.id)
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      setExistingCheck(existing);
      const { data: ans } = await supabase
        .from('pre_op_answers')
        .select('question_id, value')
        .eq('check_id', existing.id);
      const map: Answers = {};
      for (const q of list) map[q.id] = null;
      for (const a of ans ?? []) map[a.question_id] = a.value;
      setAnswers(map);
    } else {
      const map: Answers = {};
      for (const q of list) map[q.id] = null;
      setAnswers(map);
    }
    setLoading(false);
  }, [user, today]);

  useEffect(() => {
    load();
  }, [load]);

  function setAnswer(questionId: string, value: boolean) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSave() {
    if (saving) return;
    if (!user) return;

    const unanswered = questions.filter((q) => answers[q.id] === null || answers[q.id] === undefined);
    if (unanswered.length > 0) {
      Alert.alert('Atencao', 'Responda todas as perguntas antes de salvar.');
      return;
    }

    setSaving(true);

    const { data: check, error } = await supabase
      .from('pre_operation_checks')
      .insert({ operator_id: user.id, date: today })
      .select()
      .single();

    if (error || !check) {
      setSaving(false);
      Alert.alert('Erro', error?.message ?? 'Falha ao salvar pre-operacao.');
      return;
    }

    const rows = questions.map((q) => ({
      check_id: check.id,
      question_id: q.id,
      value: answers[q.id]!,
    }));

    const { error: ansErr } = await supabase.from('pre_op_answers').insert(rows);
    setSaving(false);

    if (ansErr) {
      Alert.alert('Erro', ansErr.message);
      return;
    }

    const criticalFailed = questions.filter(
      (q) => q.critical && answers[q.id] === false
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

      {questions.length === 0 && (
        <View style={styles.doneCard}>
          <Text style={styles.doneText}>Nenhuma pergunta cadastrada.</Text>
        </View>
      )}

      {questions.map((q) => (
        <View key={q.id} style={[styles.questionCard, q.critical && styles.questionCritical]}>
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
              style={[styles.answerBtn, answers[q.id] === true && styles.answerYes]}
              onPress={() => !existingCheck && setAnswer(q.id, true)}
              disabled={!!existingCheck}
            >
              <Ionicons
                name="checkmark"
                size={18}
                color={answers[q.id] === true ? colors.white : colors.success}
              />
              <Text style={[styles.answerText, answers[q.id] === true && styles.answerTextSelected]}>
                Sim
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.answerBtn, answers[q.id] === false && styles.answerNo]}
              onPress={() => !existingCheck && setAnswer(q.id, false)}
              disabled={!!existingCheck}
            >
              <Ionicons
                name="close"
                size={18}
                color={answers[q.id] === false ? colors.white : colors.danger}
              />
              <Text style={[styles.answerText, answers[q.id] === false && styles.answerTextSelected]}>
                Nao
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {!existingCheck && questions.length > 0 && (
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
    backgroundColor: colors.danger + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  criticalText: { color: colors.danger, fontWeight: '700', fontSize: fontSize.xs },
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
    backgroundColor: colors.background,
    gap: spacing.xs,
  },
  answerYes: { backgroundColor: colors.success, borderColor: colors.success },
  answerNo: { backgroundColor: colors.danger, borderColor: colors.danger },
  answerText: { fontSize: fontSize.base, fontWeight: '600', color: colors.text },
  answerTextSelected: { color: colors.white },
  saveBtn: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveBtnDisabled: { backgroundColor: colors.textSecondary },
  saveBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSize.base },
});
