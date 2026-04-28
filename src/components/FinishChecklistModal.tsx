import { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, fontSize } from '../theme/colors';
import { commonStyles } from '../theme/commonStyles';
import { Button, Text } from './ui';
import { enqueueOrExecute } from '../lib/offlineQueue';

interface PendingChecklist {
  id: string;
  machine_name: string;
  tag: string | null;
}

interface Props {
  checklist: PendingChecklist | null;
  userId: string | undefined;
  onClose: () => void;
  onFinished: () => void;
}

export function FinishChecklistModal({ checklist, userId, onClose, onFinished }: Props) {
  const [hadInterference, setHadInterference] = useState<boolean | null>(null);
  const [interferenceNotes, setInterferenceNotes] = useState('');
  const [endNotes, setEndNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setHadInterference(null);
    setInterferenceNotes('');
    setEndNotes('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleEnd() {
    if (saving) return;
    if (!checklist) return;
    if (hadInterference === null) {
      Alert.alert('Atencao', 'Informe se houve alguma interferencia.');
      return;
    }
    if (hadInterference && !interferenceNotes.trim()) {
      Alert.alert('Atencao', 'Descreva a interferencia no campo de observacao.');
      return;
    }
    setSaving(true);

    const now = new Date().toISOString();
    const result = await enqueueOrExecute({
      kind: 'updateChecklist',
      payload: {
        id: checklist.id,
        patch: {
          status: 'completed',
          ended_at: now,
          had_interference: hadInterference,
          interference_notes: hadInterference ? interferenceNotes.trim() || null : null,
          end_notes: endNotes.trim() || null,
        },
      },
    });
    setSaving(false);

    if (result.queued) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Alert.alert(
        'Salvo offline',
        'Sem rede no momento. O encerramento foi guardado e sera enviado automaticamente assim que houver conexao.',
      );
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    reset();
    onFinished();
  }

  return (
    <Modal visible={!!checklist} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={commonStyles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={commonStyles.modalContent}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: spacing.xl }}
          >
            <View style={commonStyles.modalHeader}>
              <Text variant="h2">Finalizar checklist</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={st.context}>
              <Text variant="bodyStrong">{checklist?.machine_name}</Text>
              {checklist?.tag && (
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                  TAG: {checklist.tag}
                </Text>
              )}
            </View>

            <View style={commonStyles.inputGroup}>
              <Text style={commonStyles.label}>Houve alguma interferência?</Text>
              <View style={st.toggleRow}>
                <TouchableOpacity
                  style={hadInterference === true ? [st.toggleBtn, st.toggleYes] : st.toggleBtn}
                  onPress={() => setHadInterference(true)}
                >
                  <Text style={hadInterference === true ? [st.toggleText, st.toggleTextActive] : st.toggleText}>Sim</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={hadInterference === false ? [st.toggleBtn, st.toggleNo] : st.toggleBtn}
                  onPress={() => { setHadInterference(false); setInterferenceNotes(''); }}
                >
                  <Text style={hadInterference === false ? [st.toggleText, st.toggleTextActive] : st.toggleText}>Não</Text>
                </TouchableOpacity>
              </View>
            </View>

            {hadInterference === true && (
              <View style={commonStyles.inputGroup}>
                <Text style={commonStyles.label}>Detalhes da interferência *</Text>
                <TextInput
                  style={[commonStyles.input, commonStyles.textArea]}
                  placeholder="Descreva a interferência..."
                  placeholderTextColor={colors.textLight}
                  value={interferenceNotes}
                  onChangeText={setInterferenceNotes}
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}

            <View style={commonStyles.inputGroup}>
              <Text style={commonStyles.label}>Observação de encerramento</Text>
              <TextInput
                style={[commonStyles.input, commonStyles.textArea]}
                placeholder="Observação sobre o encerramento..."
                placeholderTextColor={colors.textLight}
                value={endNotes}
                onChangeText={setEndNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            <Button
              label={saving ? 'Finalizando...' : 'Finalizar checklist'}
              variant="primary"
              size="lg"
              fullWidth
              loading={saving}
              disabled={saving}
              onPress={handleEnd}
              style={{ marginBottom: spacing.lg }}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  context: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  toggleYes: { backgroundColor: colors.warning, borderColor: colors.warning },
  toggleNo: { backgroundColor: colors.success, borderColor: colors.success },
  toggleText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary },
  toggleTextActive: { color: colors.white },
});
