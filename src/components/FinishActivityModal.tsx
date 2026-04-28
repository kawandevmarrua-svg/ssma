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
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { pickPhoto, uploadPhoto } from '../lib/imageUtils';
import { Activity } from '../types/database';
import { colors, spacing, radius, fontSize } from '../theme/colors';
import { commonStyles } from '../theme/commonStyles';
import { Button, Text } from './ui';

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
              <Text variant="h2">Finalizar atividade</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {activity && (
              <View style={st.context}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {activity.description || 'Atividade'}
                </Text>
                {activity.equipment_tag && (
                  <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                    TAG: {activity.equipment_tag}
                  </Text>
                )}
              </View>
            )}

            <TouchableOpacity
              style={st.photoPickerFull}
              onPress={async () => { const uri = await pickPhoto(); if (uri) setEndPhotoUri(uri); }}
            >
              {endPhotoUri ? (
                <Image source={{ uri: endPhotoUri }} style={st.photoPreviewFull} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={28} color={colors.textSecondary} />
                  <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs, fontWeight: '500' }}>
                    Foto de término
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={commonStyles.inputGroup}>
              <Text style={commonStyles.label}>Houve interferência?</Text>
              <View style={st.toggleRow}>
                <TouchableOpacity
                  style={hadInterference ? [st.toggleBtn, st.toggleYes] : st.toggleBtn}
                  onPress={() => setHadInterference(true)}
                >
                  <Text style={hadInterference ? [st.toggleText, st.toggleTextActive] : st.toggleText}>Sim</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={!hadInterference ? [st.toggleBtn, st.toggleNo] : st.toggleBtn}
                  onPress={() => setHadInterference(false)}
                >
                  <Text style={!hadInterference ? [st.toggleText, st.toggleTextActive] : st.toggleText}>Não</Text>
                </TouchableOpacity>
              </View>
            </View>

            {hadInterference && (
              <View style={commonStyles.inputGroup}>
                <Text style={commonStyles.label}>Detalhes da interferência</Text>
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
              <Text style={commonStyles.label}>Observações</Text>
              <TextInput
                style={[commonStyles.input, commonStyles.textArea]}
                placeholder="Anomalias que impactaram..."
                placeholderTextColor={colors.textLight}
                value={endNotes}
                onChangeText={setEndNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            <Button
              label={saving ? 'Finalizando...' : 'Finalizar atividade'}
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
  photoPickerFull: {
    height: 120,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  photoPreviewFull: { width: '100%', height: '100%' },
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
