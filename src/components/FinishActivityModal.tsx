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
  const [transitStartTime, setTransitStartTime] = useState<string | null>(null);
  const [transitEndTime, setTransitEndTime] = useState<string | null>(null);
  const [endNotes, setEndNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setEndPhotoUri(null);
    setHadInterference(false);
    setInterferenceNotes('');
    setTransitStartTime(null);
    setTransitEndTime(null);
    setEndNotes('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function formatTime(iso: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  async function handleEnd() {
    if (saving) return;
    if (!activity) return;
    setSaving(true);
    let endPhotoPath: string | null = null;
    if (endPhotoUri && userId) {
      endPhotoPath = await uploadPhoto(endPhotoUri, 'activity-photos', `${userId}/${activity.id}/end`);
    }

    const { error } = await supabase.from('activities').update({
      end_time: new Date().toISOString(),
      had_interference: hadInterference,
      interference_notes: hadInterference ? interferenceNotes.trim() || null : null,
      transit_start: transitStartTime || null,
      transit_end: transitEndTime || null,
      notes: endNotes.trim() || null,
      end_photo_url: endPhotoPath,
    }).eq('id', activity.id);
    setSaving(false);

    if (error) { Alert.alert('Erro', error.message); return; }
    reset();
    onFinished();
  }

  return (
    <Modal visible={!!activity} animationType="slide" transparent>
      <KeyboardAvoidingView style={commonStyles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={commonStyles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
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
              <Text style={commonStyles.label}>Translado</Text>
              <View style={st.transitRow}>
                <TouchableOpacity
                  style={[st.transitBtn, transitStartTime && st.transitBtnActive]}
                  onPress={() => setTransitStartTime(new Date().toISOString())}
                >
                  <Ionicons name="car" size={16} color={transitStartTime ? colors.white : colors.primary} />
                  <Text style={[st.transitBtnText, transitStartTime && st.transitBtnTextActive]}>
                    {transitStartTime ? `Inicio: ${formatTime(transitStartTime)}` : 'Marcar Inicio'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.transitBtn, transitEndTime && st.transitBtnActive]}
                  onPress={() => setTransitEndTime(new Date().toISOString())}
                >
                  <Ionicons name="flag" size={16} color={transitEndTime ? colors.white : colors.primary} />
                  <Text style={[st.transitBtnText, transitEndTime && st.transitBtnTextActive]}>
                    {transitEndTime ? `Fim: ${formatTime(transitEndTime)}` : 'Marcar Fim'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

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
  transitRow: { flexDirection: 'row', gap: spacing.sm },
  transitBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.sm, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.primary, gap: spacing.xs,
  },
  transitBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  transitBtnText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.primary },
  transitBtnTextActive: { color: colors.white },
});
