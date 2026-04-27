import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { alertResponseSchema } from '../../src/schemas';
import { useFormValidation } from '../../src/hooks/useFormValidation';
import { SafetyAlert } from '../../src/types/database';
import { colors, spacing, radius, fontSize } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';

const SEVERITY_CONFIG = {
  low: { color: colors.primaryLight, bg: colors.primaryLight + '20', label: 'Baixo', icon: 'information-circle' as const },
  medium: { color: colors.warning, bg: colors.warningLight, label: 'Medio', icon: 'alert-circle' as const },
  high: { color: '#F97316', bg: '#FFF7ED', label: 'Alto', icon: 'warning' as const },
  critical: { color: colors.danger, bg: colors.dangerLight, label: 'Critico', icon: 'alert' as const },
};

export default function OperatorAlertsScreen() {
  const { operatorData } = useAuth();
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingAlert, setRespondingAlert] = useState<SafetyAlert | null>(null);
  const [responseText, setResponseText] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, validate, clearErrors } = useFormValidation(alertResponseSchema);

  const loadAlerts = useCallback(async () => {
    if (!operatorData) {
      console.log('[Alerts] No operatorData, skipping load');
      setLoading(false);
      return;
    }

    console.log('[Alerts] Loading alerts for operator:', operatorData.id);
    // Buscar alertas direcionados ao operador + alertas broadcast
    const { data, error } = await supabase
      .from('safety_alerts')
      .select('*')
      .or(`operator_id.eq.${operatorData.id},operator_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Alerts] Error loading alerts:', error.message);
      Alert.alert('Erro', 'Falha ao carregar alertas.');
    }
    console.log('[Alerts] Loaded:', data?.length ?? 0, 'alerts');
    setAlerts(data ?? []);
    setLoading(false);
  }, [operatorData]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Realtime: auto-refresh quando alertas mudam
  useEffect(() => {
    if (!operatorData) return;

    const channel = supabase
      .channel('operator-alerts-refresh')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'safety_alerts',
      }, () => {
        loadAlerts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [operatorData, loadAlerts]);

  async function onRefresh() {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  }

  async function markAsRead(id: string) {
    await supabase.from('safety_alerts').update({ read: true }).eq('id', id);
    loadAlerts();
  }

  async function handleRespond() {
    if (!respondingAlert) return;

    const result = validate({ response: responseText });
    if (!result.success) return;

    setSaving(true);
    const { error } = await supabase
      .from('safety_alerts')
      .update({
        response: responseText,
        responded_at: new Date().toISOString(),
        read: true,
      })
      .eq('id', respondingAlert.id);
    setSaving(false);

    if (error) {
      Alert.alert('Erro', 'Falha ao enviar resposta.');
      return;
    }

    setRespondingAlert(null);
    setResponseText('');
    clearErrors();
    loadAlerts();
  }

  function renderAlert({ item }: { item: SafetyAlert }) {
    const config = SEVERITY_CONFIG[item.severity];
    return (
      <TouchableOpacity
        style={[commonStyles.card, !item.read && styles.cardUnread]}
        onPress={() => {
          if (!item.read) markAsRead(item.id);
        }}
      >
        <View style={styles.cardRow}>
          <View style={[styles.severityIcon, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon} size={24} color={config.color} />
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {!item.read && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.cardMessage} numberOfLines={3}>{item.message}</Text>
            <View style={styles.cardMeta}>
              <View style={[styles.severityBadge, { backgroundColor: config.bg }]}>
                <Text style={[styles.severityText, { color: config.color }]}>{config.label}</Text>
              </View>
              <Text style={styles.cardDate}>
                {new Date(item.created_at).toLocaleDateString('pt-BR')}
              </Text>
            </View>

            {item.response ? (
              <View style={styles.responseContainer}>
                <Text style={styles.responseLabel}>Sua resposta:</Text>
                <Text style={styles.responseText}>{item.response}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.respondBtn}
                onPress={() => {
                  setRespondingAlert(item);
                  setResponseText('');
                  clearErrors();
                }}
              >
                <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
                <Text style={styles.respondBtnText}>Responder</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={commonStyles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={renderAlert}
        contentContainerStyle={commonStyles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={commonStyles.empty}>
              <Ionicons name="shield-checkmark-outline" size={48} color={colors.textLight} />
              <Text style={commonStyles.emptyText}>Nenhum alerta recebido</Text>
            </View>
          ) : null
        }
      />

      <Modal visible={!!respondingAlert} animationType="slide" transparent>
        <KeyboardAvoidingView style={commonStyles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={commonStyles.modalContent}>
            <View style={commonStyles.modalHeader}>
              <Text style={commonStyles.modalTitle}>Responder Alerta</Text>
              <TouchableOpacity onPress={() => { setRespondingAlert(null); clearErrors(); }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {respondingAlert && (
              <View style={styles.alertPreview}>
                <Text style={styles.alertPreviewTitle}>{respondingAlert.title}</Text>
                <Text style={styles.alertPreviewMessage}>{respondingAlert.message}</Text>
              </View>
            )}

            <View style={commonStyles.inputGroup}>
              <Text style={commonStyles.label}>Sua resposta *</Text>
              <TextInput
                style={[commonStyles.input, commonStyles.textArea, errors.response && commonStyles.inputError]}
                placeholder="Escreva sua resposta..."
                placeholderTextColor={colors.textLight}
                value={responseText}
                onChangeText={setResponseText}
                multiline
                numberOfLines={4}
              />
              {errors.response && <Text style={commonStyles.error}>{errors.response}</Text>}
            </View>

            <TouchableOpacity
              style={[commonStyles.saveButton, saving && commonStyles.buttonDisabled]}
              onPress={handleRespond}
              disabled={saving}
            >
              <Text style={commonStyles.saveButtonText}>{saving ? 'Enviando...' : 'Enviar Resposta'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  severityIcon: { width: 44, height: 44, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, marginLeft: spacing.md },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: fontSize.base, fontWeight: '700', color: colors.text, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: spacing.sm },
  cardMessage: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm },
  severityBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  severityText: { fontSize: fontSize.xs, fontWeight: '600' },
  cardDate: { fontSize: fontSize.xs, color: colors.textLight },
  responseContainer: {
    marginTop: spacing.sm, padding: spacing.sm,
    backgroundColor: colors.success + '10', borderRadius: radius.sm,
    borderLeftWidth: 3, borderLeftColor: colors.success,
  },
  responseLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.success, marginBottom: 2 },
  responseText: { fontSize: fontSize.sm, color: colors.text },
  respondBtn: {
    flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm,
    paddingVertical: spacing.xs, gap: spacing.xs,
  },
  respondBtnText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
  alertPreview: {
    backgroundColor: colors.inputBg, padding: spacing.md,
    borderRadius: radius.sm, marginBottom: spacing.md,
  },
  alertPreviewTitle: { fontSize: fontSize.base, fontWeight: '700', color: colors.text },
  alertPreviewMessage: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
});
