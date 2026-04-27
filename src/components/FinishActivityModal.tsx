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
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { pickPhoto, uploadPhoto } from '../lib/imageUtils';
import { Activity } from '../types/database';
import { colors, spacing, radius, fontSize } from '../theme/colors';
import { commonStyles } from '../theme/commonStyles';

interface Props {
  activity: Activity | null;
  userId: string | undefined;
  onClose: () => void;
  onFinished: () => void;
}

export function FinishActivityModal({ activity, userId, onClose, onFinished }: Props) {
  const [endPhotoUri, setEndPhotoUri] = useState<string | null>(null);
  const [hadInterference, setHadInterference] = useState(false);
  const [interferenceNotes, setInterferenceNotes] = useState('');
  const [endNotes, setEndNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setEndPhotoUri(null);
    setHadInterference(false);
    setInterferenceNotes('');
    setEndNotes('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleEnd() {
    if (saving) return;
    if (!activity) return;
    setSaving(true);
    let endPhotoPath: string | null = null;
    if (endPhotoUri && userId) {
      endPhotoPath = await uploadPhoto(endPhotoUri, 'activity-photos', `${userId}/${activity.id}/end`);
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from('activities').update({
      end_time: now,
      had_interference: hadInterference,
      interference_notes: hadInterference ? interferenceNotes.trim() || null : null,
      transit_start: now,
      transit_end: now,
      notes: endNotes.trim() || null,
      end_photo_url: endPhotoPath,
    }).eq('id', activity.id);
    setSaving(false);

    if (error) { Alert.alert('Erro', error.message); return; }
    reset();
    onFinished();
  }

  return (
    <Modal visible={!!activity} animationType="slide" transparent statusBarTranslucent>
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
              <Text style={commonStyles.modalTitle}>Finalizar Atividade</Text>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {activity?.equipment_tag && (
              <Text style={st.context}>{activity.description || 'Atividade'} {activity.equipment_tag ? `· TAG: ${activity.equipment_tag}` : ''}</Text>
            )}

            <TouchableOpacity
              style={st.photoPickerFull}
              onPress={async () => { const uri = await pickPhoto(); if (uri) setEndPhotoUri(uri); }}
            >
              {endPhotoUri
                ? <Image source={{ uri: endPhotoUri }} style={st.photoPreviewFull} />
                : <><Ionicons name="camera" size={32} color={colors.textLight} /><Text style={st.photoLabel}>Foto de Termino</Text></>
              }
            </TouchableOpacity>

            <View style={commonStyles.inputGroup}>
              <Text style={commonStyles.label}>Houve interferencia?</Text>
              <View style={st.toggleRow}>
                <TouchableOpacity style={[st.toggleBtn, hadInterference && st.toggleYes]} onPress={() => setHadInterference(true)}>
                  <Text style={[st.toggleText, hadInterference && st.toggleTextActive]}>Sim</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.toggleBtn, !hadInterference && st.toggleNo]} onPress={() => setHadInterference(false)}>
                  <Text style={[st.toggleText, !hadInterference && st.toggleTextActive]}>Nao</Text>
                </TouchableOpacity>
              </View>
            </View>

            {hadInterference && (
              <View style={commonStyles.inputGroup}>
                <Text style={commonStyles.label}>Detalhes da interferencia</Text>
                <TextInput style={[commonStyles.input, commonStyles.textArea]} placeholder="Descreva a interferencia..." placeholderTextColor={colors.textLight} value={interferenceNotes} onChangeText={setInterferenceNotes} multiline numberOfLines={3} />
              </View>
            )}

            <View style={commonStyles.inputGroup}>
              <Text style={commonStyles.label}>Observacoes</Text>
              <TextInput style={[commonStyles.input, commonStyles.textArea]} placeholder="Anomalias que impactaram..." placeholderTextColor={colors.textLight} value={endNotes} onChangeText={setEndNotes} multiline numberOfLines={3} />
            </View>

            <TouchableOpacity
              style={[commonStyles.saveButton, { marginBottom: spacing.lg }, saving && commonStyles.buttonDisabled]}
              onPress={handleEnd}
              disabled={saving}
            >
              <Text style={commonStyles.saveButtonText}>{saving ? 'Finalizando...' : 'Finalizar Atividade'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  context: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md },
  photoPickerFull: {
    height: 120, backgroundColor: colors.inputBg, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.md, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md,
  },
  photoPreviewFull: { width: '100%', height: '100%', borderRadius: radius.md },
  photoLabel: { fontSize: fontSize.xs, color: colors.textLight, marginTop: spacing.xs },
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
