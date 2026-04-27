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
  const [endNotes, setEndNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setEndNotes('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleEnd() {
    if (saving) return;
    if (!checklist) return;
    setSaving(true);

    const now = new Date().toISOString();
    const { error } = await supabase.from('checklists').update({
      status: 'completed',
      ended_at: now,
      end_notes: endNotes.trim() || null,
    }).eq('id', checklist.id);
    setSaving(false);

    if (error) { Alert.alert('Erro', error.message); return; }
    reset();
    onFinished();
  }

  return (
    <Modal visible={!!checklist} animationType="slide" transparent>
      <KeyboardAvoidingView style={commonStyles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={commonStyles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
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
});
