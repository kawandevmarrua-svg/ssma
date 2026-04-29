import { useEffect, useState, useCallback } from 'react';
import {
  View,
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
import { colors, elevation, radius, spacing } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';
import { Badge, Button, Text } from '../../src/components/ui';

const SEVERITY_CONFIG = {
  low: { variant: 'info' as const, label: 'Baixo', icon: 'information-circle-outline' as const },
  medium: { variant: 'warning' as const, label: 'Médio', icon: 'alert-circle-outline' as const },
  high: { variant: 'primary' as const, label: 'Alto', icon: 'warning-outline' as const },
  critical: { variant: 'danger' as const, label: 'Crítico', icon: 'alert-outline' as const },
};

export default function OperatorAlertsScreen() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingAlert, setRespondingAlert] = useState<SafetyAlert | null>(null);
  const [responseText, setResponseText] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, validate, clearErrors } = useFormValidation(alertResponseSchema);

  const loadAlerts = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('safety_alerts')
      .select('*')
      .or(`operator_id.eq.${user.id},operator_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      Alert.alert('Erro', 'Falha ao carregar alertas.');
    }
    setAlerts(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('operator-alerts-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'safety_alerts' }, () => {
        loadAlerts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadAlerts]);

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
        activeOpacity={0.95}
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={() => {
          if (!item.read) markAsRead(item.id);
        }}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Ionicons name={config.icon} size={14} color={colors.textSecondary} />
            <Text variant="captionStrong" tone="muted">
              {new Date(item.created_at).toLocaleDateString('pt-BR')}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Badge label={config.label.toUpperCase()} variant={config.variant} size="sm" />
            {!item.read && <View style={styles.unreadDot} />}
          </View>
        </View>

        <Text variant="h3" style={styles.cardTitle}>{item.title}</Text>
        <Text variant="body" tone="muted" numberOfLines={3} style={styles.cardMessage}>
          {item.message}
        </Text>

        {item.response ? (
          <View style={styles.responseContainer}>
            <Text variant="captionStrong" tone="success">SUA RESPOSTA</Text>
            <Text variant="bodyMedium" style={{ marginTop: 4 }}>{item.response}</Text>
          </View>
        ) : (
          <Button
            label="Responder"
            icon="chatbubble-outline"
            variant="secondary"
            size="sm"
            onPress={() => {
              setRespondingAlert(item);
              setResponseText('');
              clearErrors();
            }}
            style={{ marginTop: spacing.md }}
          />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={commonStyles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={renderAlert}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={commonStyles.empty}>
              <Ionicons name="shield-checkmark-outline" size={40} color={colors.textLight} />
              <Text variant="callout" tone="muted" style={{ marginTop: spacing.md }}>
                Nenhum alerta recebido
              </Text>
            </View>
          ) : null
        }
      />

      <Modal visible={!!respondingAlert} animationType="slide" transparent>
        <KeyboardAvoidingView style={commonStyles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={commonStyles.modalContent}>
            <View style={commonStyles.modalHeader}>
              <Text variant="h2">Responder alerta</Text>
              <TouchableOpacity onPress={() => { setRespondingAlert(null); clearErrors(); }} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {respondingAlert && (
              <View style={styles.alertPreview}>
                <Text variant="bodyStrong">{respondingAlert.title}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                  {respondingAlert.message}
                </Text>
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
              {errors.response && <Text variant="caption" tone="danger" style={{ marginTop: 4 }}>{errors.response}</Text>}
            </View>

            <Button
              label={saving ? 'Enviando...' : 'Enviar resposta'}
              variant="primary"
              size="lg"
              fullWidth
              loading={saving}
              disabled={saving}
              onPress={handleRespond}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.md, gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...elevation.sm,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  cardTitle: { marginBottom: 4 },
  cardMessage: { lineHeight: 20 },

  responseContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.successSurface,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },

  alertPreview: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
});
