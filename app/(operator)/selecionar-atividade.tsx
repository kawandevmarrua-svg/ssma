import { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { ActivityType } from '../../src/types/database';
import { colors, spacing, radius, fontSize } from '../../src/theme/colors';
import { commonStyles } from '../../src/theme/commonStyles';
import { Text } from '../../src/components/ui';

const CATEGORY_LABELS: Record<ActivityType['category'], string> = {
  parada: 'Paradas (P)',
  servico: 'Servicos (S)',
  outro: 'Outros',
};

export default function SelecionarAtividadeScreen() {
  const [types, setTypes] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    supabase
      .from('activity_types')
      .select('*')
      .eq('active', true)
      .order('category', { ascending: true })
      .order('order_index', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[SelecionarAtividade] erro ao carregar tipos:', error.message);
        setTypes((data ?? []) as ActivityType[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return types;
    return types.filter(
      (t) =>
        t.code.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term),
    );
  }, [types, search]);

  const flatData = useMemo(() => {
    const map = new Map<ActivityType['category'], ActivityType[]>();
    for (const t of filtered) {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    }
    const out: Array<
      | { kind: 'header'; category: ActivityType['category'] }
      | { kind: 'item'; type: ActivityType }
    > = [];
    for (const [category, items] of map) {
      out.push({ kind: 'header', category });
      for (const t of items) out.push({ kind: 'item', type: t });
    }
    return out;
  }, [filtered]);

  function handleSelect(type: ActivityType) {
    if (type.category === 'parada') {
      router.replace({
        pathname: '/(operator)/parada',
        params: { type_id: type.id },
      });
    } else {
      router.replace({
        pathname: '/(operator)/servico',
        params: { type_id: type.id },
      });
    }
  }

  return (
    <View style={commonStyles.container}>
      <View style={st.searchRow}>
        <Ionicons name="search" size={16} color={colors.textLight} />
        <TextInput
          style={st.searchInput}
          placeholder="Buscar por codigo ou descricao"
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textLight} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={st.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : flatData.length === 0 ? (
        <View style={st.center}>
          <Text style={st.emptyText}>Nenhuma atividade encontrada.</Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(it, idx) =>
            it.kind === 'header' ? `h-${it.category}` : `t-${it.type.id}-${idx}`
          }
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return <Text style={st.sectionHeader}>{CATEGORY_LABELS[item.category]}</Text>;
            }
            const t = item.type;
            return (
              <TouchableOpacity style={st.row} onPress={() => handleSelect(t)}>
                <Text style={st.code}>{t.code}</Text>
                <Text style={st.desc} numberOfLines={2}>
                  {t.description}
                </Text>
                {t.allow_custom && (
                  <View style={st.customBadge}>
                    <Text style={st.customText}>livre</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    margin: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: fontSize.base, color: colors.text, paddingVertical: 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  emptyText: { color: colors.textSecondary, fontSize: fontSize.sm },
  sectionHeader: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  code: {
    minWidth: 70,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.primary,
    fontFamily: 'monospace',
  },
  desc: { flex: 1, fontSize: fontSize.sm, color: colors.text },
  customBadge: {
    backgroundColor: colors.warningSurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  customText: { fontSize: 10, fontWeight: '700', color: colors.warningDark, letterSpacing: 0.3 },
});
