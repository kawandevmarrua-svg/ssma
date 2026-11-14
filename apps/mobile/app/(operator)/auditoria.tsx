import { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { generateAuditReport, shareAuditReport } from '../../src/lib/auditReport';
import { todayLocal, localDateMinusDays } from '../../src/lib/dates';
import { colors, spacing, radius, fontSize } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';
import { Button, Text } from '../../src/components/ui';

// Wrappers locais (mantidos para legibilidade do componente).
const todayISO = todayLocal;
const isoMinusDays = localDateMinusDays;

function maskDate(input: string): string {
  // Aceita digitacao incremental e formata como YYYY-MM-DD
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const PRESETS: Array<{ label: string; days: number }> = [
  { label: '7 dias', days: 7 },
  { label: '15 dias', days: 15 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
];

export default function AuditoriaScreen() {
  const { user, profile } = useAuth();
  const [from, setFrom] = useState<string>(isoMinusDays(30));
  const [to, setTo] = useState<string>(todayISO());
  const [generating, setGenerating] = useState(false);

  const validation = useMemo(() => {
    if (!isValidISODate(from)) return 'Data inicial invalida (use AAAA-MM-DD).';
    if (!isValidISODate(to)) return 'Data final invalida (use AAAA-MM-DD).';
    if (from > to) return 'A data inicial nao pode ser depois da final.';
    return null;
  }, [from, to]);

  function applyPreset(days: number) {
    setFrom(isoMinusDays(days));
    setTo(todayISO());
  }

  async function handleGenerate() {
    if (!user || !profile) {
      Alert.alert('Erro', 'Sessao expirada. Faca login novamente.');
      return;
    }
    if (validation) {
      Alert.alert('Atencao', validation);
      return;
    }

    setGenerating(true);
    try {
      const uri = await generateAuditReport({
        operatorId: user.id,
        operatorName: profile.full_name || profile.email || 'Operador',
        from,
        to,
      });
      await shareAuditReport(uri);
    } catch (e: any) {
      Alert.alert('Erro ao gerar relatorio', e?.message ?? 'Falha desconhecida.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <View style={commonStyles.container}>
      <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        <View style={st.intro}>
          <Ionicons name="document-text" size={28} color={colors.primary} />
          <Text variant="h3" style={st.introTitle}>Auditoria de atividades</Text>
          <Text style={st.introHint}>
            Gere um PDF com todos os checklists realizados e atividades executadas no periodo
            escolhido. Use para comprovar o pareamento entre checklist e atividade.
          </Text>
        </View>

        <Text style={st.sectionTitle}>Atalhos</Text>
        <View style={st.presetRow}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.days}
              style={st.presetBtn}
              onPress={() => applyPreset(p.days)}
            >
              <Text style={st.presetText}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={st.sectionTitle}>Periodo</Text>
        <View style={st.dateRow}>
          <View style={[commonStyles.inputGroup, { flex: 1 }]}>
            <Text style={commonStyles.label}>De</Text>
            <TextInput
              style={commonStyles.input}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={colors.textLight}
              keyboardType="numeric"
              value={from}
              onChangeText={(v) => setFrom(maskDate(v))}
              maxLength={10}
            />
          </View>
          <View style={[commonStyles.inputGroup, { flex: 1 }]}>
            <Text style={commonStyles.label}>Ate</Text>
            <TextInput
              style={commonStyles.input}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={colors.textLight}
              keyboardType="numeric"
              value={to}
              onChangeText={(v) => setTo(maskDate(v))}
              maxLength={10}
            />
          </View>
        </View>

        {validation && (
          <View style={st.warnBox}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={st.warnText}>{validation}</Text>
          </View>
        )}

        <Button
          label={generating ? 'Gerando PDF...' : 'Gerar relatorio em PDF'}
          icon="document-text-outline"
          variant="primary"
          size="lg"
          fullWidth
          loading={generating}
          disabled={generating || !!validation}
          onPress={handleGenerate}
          style={{ marginTop: spacing.lg }}
        />

        {generating && (
          <View style={st.generatingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={st.generatingText}>
              Consultando registros e montando o PDF. Pode levar alguns segundos.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  intro: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  introTitle: { marginTop: spacing.sm, marginBottom: spacing.xs },
  introHint: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  presetBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  presetText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },

  dateRow: { flexDirection: 'row', gap: spacing.sm },

  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSurface,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  warnText: { flex: 1, fontSize: fontSize.sm, color: colors.danger, fontWeight: '600' },

  generatingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySurface,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  generatingText: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary },
});
