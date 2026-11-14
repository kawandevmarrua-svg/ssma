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
import * as Haptics from 'expo-haptics';
import { pickPhoto, persistPhotoForQueue } from '../lib/imageUtils';
import { enqueueOrExecute } from '../lib/offlineQueue';
import { recordTrackingEvent } from '../lib/trackingEvents';
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

const MAX_END_PHOTOS = 5;

export function FinishActivityModal({ activity, userId, onClose, onFinished }: Props) {
  const [endPhotoUris, setEndPhotoUris] = useState<string[]>([]);
  const [hadInterference, setHadInterference] = useState(false);
  const [interferenceNotes, setInterferenceNotes] = useState('');
  const [endNotes, setEndNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setEndPhotoUris([]);
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

    // Fotos sao tratadas via fila: copiamos cada uma para diretorio persistente
    // (cache da camera pode ser limpo pelo OS) e o job faz upload + update
    // atomicamente. Assim nao se perdem se estivermos offline.
    const photoList: { localPath: string }[] = [];
    if (userId) {
      for (let i = 0; i < endPhotoUris.length; i++) {
        const localPath = await persistPhotoForQueue(endPhotoUris[i], `activity-${activity.id}-end-${i}`);
        if (!localPath) {
          // Falha ao persistir = foto sera perdida se prosseguirmos. Aborta
          // para o operador refazer (disco cheio, permissao, formato invalido).
          setSaving(false);
          Alert.alert(
            'Erro ao salvar foto',
            'Nao foi possivel salvar uma das fotos de encerramento localmente. Tire as fotos novamente ou tente sem foto.',
          );
          return;
        }
        photoList.push({ localPath });
      }
    }

    const now = new Date().toISOString();
    const result = await enqueueOrExecute({
      kind: 'updateActivityWithPhoto',
      payload: {
        id: activity.id,
        patch: {
          end_time: now,
          had_interference: hadInterference,
          interference_notes: hadInterference ? interferenceNotes.trim() || null : null,
          transit_start: now,
          transit_end: now,
          notes: endNotes.trim() || null,
        },
        photo: null,
        photoList,
        photoListBucket: 'activity-photos',
        photoListPrefix: `${userId}/${activity.id}/end`,
        photoListField: 'end_photo_urls',
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

    if (userId && activity) {
      void recordTrackingEvent(userId, 'activity_end', { activityId: activity.id });
    }

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

            <Text style={commonStyles.label}>Fotos de término ({endPhotoUris.length}/{MAX_END_PHOTOS})</Text>
            <View style={st.photoGrid}>
              {endPhotoUris.map((uri, idx) => (
                <View key={`${uri}-${idx}`} style={st.photoThumb}>
                  <Image source={{ uri }} style={st.photoPreviewFull} />
                  <TouchableOpacity
                    style={st.photoRemove}
                    onPress={() => setEndPhotoUris((prev) => prev.filter((_, i) => i !== idx))}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={22} color={colors.white} />
                  </TouchableOpacity>
                </View>
              ))}
              {endPhotoUris.length < MAX_END_PHOTOS && (
                <TouchableOpacity
                  style={[st.photoThumb, st.photoAdd]}
                  onPress={async () => { const uri = await pickPhoto(); if (uri) setEndPhotoUris((prev) => [...prev, uri]); }}
                >
                  <Ionicons name="camera-outline" size={26} color={colors.textSecondary} />
                  <Text variant="caption" tone="muted" style={{ marginTop: 2, fontWeight: '500' }}>
                    Adicionar
                  </Text>
                </TouchableOpacity>
              )}
            </View>

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
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md, marginTop: spacing.xs },
  photoThumb: {
    width: 92,
    height: 92,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  photoAdd: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 12,
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
