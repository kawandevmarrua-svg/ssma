import { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { ActivityType } from '../../src/types/database';
import { colors, spacing, radius, fontSize } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';
import { Button, Text } from '../../src/components/ui';

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseHHMMToISO(hhmm: string): string | null {
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d.toISOString();
}

function maskHHMM(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export default function ParadaScreen() {
  const { user } = useAuth();
  const { type_id } = useLocalSearchParams<{ type_id?: string }>();
  const [activityType, setActivityType] = useState<ActivityType | null>(null);
  const [loadingType, setLoadingType] = useState(true);
  const [start, setStart] = useState(nowHHMM());
  const [end, setEnd] = useState(nowHHMM());
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!type_id) {
        setLoadingType(false);
        return;
      }
      const { data, error } = await supabase
        .from('activity_types')
        .select('*')
        .eq('id', type_id)
        .single();
      if (cancelled) return;
      if (error || !data) {
        Alert.alert('Erro', 'Tipo de parada nao encontrado.');
        router.replace('/(operator)/atividade');
        return;
      }
      setActivityType(data as ActivityType);
      setLoadingType(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [type_id]);

  async function handleSave() {
    if (saving) return;
    if (!user || !activityType) return;

    const startISO = parseHHMMToISO(start);
    const endISO = parseHHMMToISO(end);
    if (!startISO) {
      Alert.alert('Atencao', 'Informe a hora de entrada no formato HH:MM.');
      return;
    }
    if (!endISO) {
      Alert.alert('Atencao', 'Informe a hora de saida no formato HH:MM.');
      return;
    }
    if (new Date(endISO).getTime() < new Date(startISO).getTime()) {
      Alert.alert('Atencao', 'A hora de saida nao pode ser antes da hora de entrada.');
      return;
    }
    if (activityType.allow_custom && !description.trim()) {
      Alert.alert('Atencao', 'Descreva a parada.');
      return;
    }

    const finalDescription = activityType.allow_custom
      ? `${activityType.code} - ${description.trim()}`
      : activityType.description;

    setSaving(true);
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('activities').insert({
      operator_id: user.id,
      activity_type_id: activityType.id,
      date: today,
      description: finalDescription,
      start_time: startISO,
      end_time: endISO,
    });

    if (error) {
      setSaving(false);
      Alert.alert('Erro', error.message);
      return;
    }

    setSaving(false);
    router.replace('/(operator)/atividade');
  }

  return (
    <View style={commonStyles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
          {activityType && (
            <View style={commonStyles.inputGroup}>
              <Text style={commonStyles.label}>Tipo de parada</Text>
              <View style={st.typeBox}>
                <View style={{ flex: 1 }}>
                  <Text style={st.typeCode}>{activityType.code}</Text>
                  <Text style={st.typeDesc}>{activityType.description}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              </View>
            </View>
          )}

          <View style={st.timeRow}>
            <View style={[commonStyles.inputGroup, { flex: 1 }]}>
              <Text style={commonStyles.label}>Hora de entrada *</Text>
              <TextInput
                style={commonStyles.input}
                placeholder="HH:MM"
                placeholderTextColor={colors.textLight}
                keyboardType="numeric"
                value={start}
                onChangeText={(v) => setStart(maskHHMM(v))}
                maxLength={5}
              />
            </View>
            <View style={[commonStyles.inputGroup, { flex: 1 }]}>
              <Text style={commonStyles.label}>Hora de saida *</Text>
              <TextInput
                style={commonStyles.input}
                placeholder="HH:MM"
                placeholderTextColor={colors.textLight}
                keyboardType="numeric"
                value={end}
                onChangeText={(v) => setEnd(maskHHMM(v))}
                maxLength={5}
              />
            </View>
          </View>

          <View style={commonStyles.inputGroup}>
            <Text style={commonStyles.label}>
              Descricao{activityType?.allow_custom ? ' *' : ''}
            </Text>
            <TextInput
              style={[commonStyles.input, commonStyles.textArea]}
              placeholder="Descreva a parada"
              placeholderTextColor={colors.textLight}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>

          <Button
            label={saving ? 'Salvando...' : 'Salvar parada'}
            variant="primary"
            size="lg"
            fullWidth
            loading={saving}
            disabled={saving || loadingType}
            onPress={handleSave}
            style={{ marginTop: spacing.md }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  typeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: 52,
  },
  typeCode: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  typeDesc: { fontSize: fontSize.sm, color: colors.text, marginTop: 2 },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
});
