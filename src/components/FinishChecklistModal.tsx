import { useState } from 'react';
import {
  View,
  Text,
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
import { supabase } from '../lib/supabase';
import { colors, spacing, radius, fontSize } from '../theme/colors';
import { commonStyles } from '../theme/commonStyles';

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
    const { error } = await supabase.from('checklists').update({
      status: 'completed',
      ended_at: now,
      had_interference: hadInterference,
      interference_notes: hadInterference ? interferenceNotes.trim() || null : null,
      end_notes: endNotes.trim() || null,
    }).eq('id', checklist.id);
    setSaving(false);

    if (error) { Alert.alert('Erro', error.message); return; }
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
              <Text style={commonStyles.modalTitle}>Finalizar Checklist</Text>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={st.context}>
              {checklist?.machine_name}{checklist?.tag ? ` · TAG: ${checklist.tag}` : ''}
            </Text>

            <View style={commonStyles.inputGroup}>
              <Text style={commonStyles.label}>Houve alguma interferencia?</Text>
              <View style={st.toggleRow}>
                <TouchableOpacity
                  style={[st.toggleBtn, hadInterference === true && st.toggleYes]}
                  onPress={() => setHadInterference(true)}
                >
                  <Text style={[st.toggleText, hadInterference === true && st.toggleTextActive]}>Sim</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.toggleBtn, hadInterference === false && st.toggleNo]}
                  onPress={() => { setHadInterference(false); setInterferenceNotes(''); }}
                >
                  <Text style={[st.toggleText, hadInterference === false && st.toggleTextActive]}>Nao</Text>
                </TouchableOpacity>
              </View>
            </View>

            {hadInterference === true && (
              <View style={commonStyles.inputGroup}>
                <Text style={commonStyles.label}>Detalhes da interferencia *</Text>
                <TextInput
                  style={[commonStyles.input, commonStyles.textArea]}
                  placeholder="Descreva a interferencia..."
                  placeholderTextColor={colors.textLight}
                  value={interferenceNotes}
                  onChangeText={setInterferenceNotes}
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}

            <View style={commonStyles.inputGroup}>
              <Text style={commonStyles.label}>Observacao de encerramento</Text>
              <TextInput style={[commonStyles.input, commonStyles.textArea]} placeholder="Observacao sobre o encerramento do checklist..." placeholderTextColor={colors.textLight} value={endNotes} onChangeText={setEndNotes} multiline numberOfLines={3} />
            </View>

            <TouchableOpacity
              style={[commonStyles.saveButton, { marginBottom: spacing.lg }, saving && commonStyles.buttonDisabled]}
              onPress={handleEnd}
              disabled={saving}
            >
              <Text style={commonStyles.saveButtonText}>{saving ? 'Finalizando...' : 'Finalizar Checklist'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  context: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggleBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  toggleYes: { backgroundColor: colors.warning, borderColor: colors.warning },
  toggleNo: { backgroundColor: colors.success, borderColor: colors.success },
  toggleText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  toggleTextActive: { color: colors.white },
});
