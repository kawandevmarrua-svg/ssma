import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import {
  DAYS_PT,
  parseTime,
  Recurrence,
  scheduleNotifications,
  setupReminderChannel,
} from '../../src/lib/reminders';
import { AppHeader } from '../../src/components/AppHeader';
import { Text } from '../../src/components/ui';
import { colors, radius, spacing, fontSize } from '../../src/theme/colors';

const TECH_BG = '#FFFFFF';
const TECH_BG_SOFT = '#F8FAFC';
const TECH_BORDER = '#E5E7EB';
const TECH_TEXT = '#0F172A';
const TECH_TEXT_MUTED = '#64748B';
const ACCENT = colors.primary;

export default function CriarLembreteScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [time, setTime] = useState('08:00');
  const [recurrence, setRecurrence] = useState<Recurrence>('daily');
  const [days, setDays] = useState<number[]>([]);
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  function toggleDay(day: number) {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSave() {
    if (!user) return;
    if (!title.trim()) {
      Alert.alert('Atenção', 'Informe o título do lembrete.');
      return;
    }
    if (!parseTime(time)) {
      Alert.alert('Atenção', 'Horário inválido. Use o formato HH:MM (ex: 08:30).');
      return;
    }
    if (recurrence === 'weekly' && days.length === 0) {
      Alert.alert('Atenção', 'Selecione pelo menos um dia da semana.');
      return;
    }
    let specificDate: string | null = null;
    if (recurrence === 'once') {
      if (!date.trim()) {
        Alert.alert('Atenção', 'Informe a data no formato DD/MM/AAAA.');
        return;
      }
      const parts = date.trim().split('/');
      if (parts.length !== 3 || parts[2].length !== 4) {
        Alert.alert('Atenção', 'Data inválida. Use DD/MM/AAAA.');
        return;
      }
      specificDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    setSaving(true);
    await setupReminderChannel();

    const draft = {
      title: title.trim(),
      description: desc.trim() || null,
      reminder_time: time.trim(),
      recurrence,
      days_of_week: recurrence === 'weekly' ? days : null,
      specific_date: specificDate,
      is_active: true,
    };

    const notifIds = await scheduleNotifications(draft);

    const { error } = await supabase.from('reminders').insert({
      user_id: user.id,
      ...draft,
      notification_ids: notifIds.length > 0 ? notifIds : null,
    });

    setSaving(false);
    if (error) {
      Alert.alert('Erro', 'Falha ao salvar lembrete.');
      return;
    }
    router.back();
  }

  return (
    <View style={styles.container}>
      <AppHeader onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>Novo lembrete</Text>
          <Text style={styles.pageSubtitle}>
            Configure título, horário e recorrência.
          </Text>

          {/* Title */}
          <Text style={styles.label}>TÍTULO</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Tomar remédio, Consulta médica..."
            placeholderTextColor={TECH_TEXT_MUTED}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          {/* Description */}
          <Text style={styles.label}>DESCRIÇÃO (opcional)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder="Detalhes adicionais..."
            placeholderTextColor={TECH_TEXT_MUTED}
            value={desc}
            onChangeText={setDesc}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={300}
          />

          {/* Time */}
          <Text style={styles.label}>HORÁRIO</Text>
          <TextInput
            style={[styles.input, styles.inputSingle]}
            placeholder="08:00"
            placeholderTextColor={TECH_TEXT_MUTED}
            value={time}
            onChangeText={setTime}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />

          {/* Recurrence */}
          <Text style={styles.label}>RECORRÊNCIA</Text>
          <View style={styles.row}>
            {(
              [
                { key: 'daily' as Recurrence, label: 'Diário' },
                { key: 'weekly' as Recurrence, label: 'Semanal' },
                { key: 'once' as Recurrence, label: 'Uma vez' },
              ]
            ).map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => setRecurrence(key)}
                style={[
                  styles.pill,
                  recurrence === key && { backgroundColor: ACCENT, borderColor: ACCENT },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    recurrence === key && { color: '#fff' },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Days of week */}
          {recurrence === 'weekly' && (
            <>
              <Text style={styles.label}>DIAS DA SEMANA</Text>
              <View style={styles.daysRow}>
                {DAYS_PT.map((day, idx) => {
                  const active = days.includes(idx);
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => toggleDay(idx)}
                      style={[
                        styles.dayBtn,
                        active && { backgroundColor: ACCENT, borderColor: ACCENT },
                      ]}
                    >
                      <Text style={[styles.dayLetter, active && { color: '#fff' }]}>
                        {day.charAt(0)}
                      </Text>
                      <Text style={[styles.daySub, active && { color: '#fff' }]}>
                        {day.slice(1, 3)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* Specific date */}
          {recurrence === 'once' && (
            <>
              <Text style={styles.label}>DATA</Text>
              <TextInput
                style={[styles.input, styles.inputSingle]}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={TECH_TEXT_MUTED}
                value={date}
                onChangeText={setDate}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </>
          )}

          {/* Submit */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveBtn,
              saving && { opacity: 0.6 },
              pressed && !saving && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            ]}
          >
            <Ionicons name="alarm" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>
              {saving ? 'Salvando...' : 'Salvar lembrete'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TECH_BG },

  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
    gap: 12,
  },

  pageTitle: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: TECH_TEXT,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  pageSubtitle: {
    fontSize: fontSize.sm,
    color: TECH_TEXT_MUTED,
    marginBottom: spacing.sm,
  },

  label: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: TECH_TEXT_MUTED,
    textTransform: 'uppercase',
    marginBottom: -4,
  },

  input: {
    backgroundColor: TECH_BG_SOFT,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: TECH_BORDER,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: fontSize.base,
    color: TECH_TEXT,
    minHeight: 52,
  },
  inputMulti: {
    minHeight: 90,
    paddingTop: 14,
  },
  inputSingle: {
    minHeight: 52,
  },

  row: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: TECH_BORDER,
    backgroundColor: TECH_BG_SOFT,
  },
  pillText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: TECH_TEXT_MUTED,
  },

  daysRow: {
    flexDirection: 'row',
    gap: 5,
  },
  dayBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: TECH_BORDER,
    backgroundColor: TECH_BG_SOFT,
  },
  dayLetter: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    color: TECH_TEXT_MUTED,
    lineHeight: 16,
  },
  daySub: {
    fontSize: fontSize['2xs'],
    fontWeight: '600',
    color: TECH_TEXT_MUTED,
    lineHeight: 11,
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 17,
    borderRadius: radius.lg,
    backgroundColor: ACCENT,
    marginTop: spacing.sm,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: fontSize.base,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
