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
import { AppHeader } from '../../src/components/AppHeader';

const CATEGORY_LABELS: Record<ActivityType['category'], string> = {
  parada: 'Paradas',
  servico: 'Serviços',
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
      | { kind: 'header'; category: ActivityType['category']; count: number }
      | { kind: 'item'; type: ActivityType }
    > = [];
    for (const [category, items] of map) {
      out.push({ kind: 'header', category, count: items.length });
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
      <AppHeader />

      <View style={st.headerArea}>
        <TouchableOpacity style={st.backRow} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
          <Text style={st.backText}>Voltar</Text>
        </TouchableOpacity>
        <Text style={st.fieldLabel}>Selecionar atividade</Text>
        <View style={st.searchRow}>
          <Ionicons name="search" size={18} color={colors.textLight} style={{ paddingLeft: spacing.md }} />
          <TextInput
            style={st.searchInput}
            placeholder="Buscar por código ou descrição"
            placeholderTextColor={colors.textLight}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8} style={{ paddingRight: spacing.md }}>
              <Ionicons name="close-circle" size={18} color={colors.textLight} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={st.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : flatData.length === 0 ? (
        <View style={st.center}>
          <Ionicons name="search-outline" size={40} color={colors.textLight} />
          <Text style={st.emptyText}>Nenhuma atividade encontrada.</Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(it, idx) =>
            it.kind === 'header' ? `h-${it.category}` : `t-${it.type.id}-${idx}`
          }
          contentContainerStyle={st.listContent}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <View style={st.groupHeader}>
                  <Text style={st.groupTitle}>{CATEGORY_LABELS[item.category]}</Text>
                  <View style={st.groupCount}>
                    <Text style={st.groupCountText}>{item.count}</Text>
                  </View>
                </View>
              );
            }
            const t = item.type;
            return (
              <TouchableOpacity style={st.row} onPress={() => handleSelect(t)} activeOpacity={0.85}>
                <View style={st.codeBadge}>
                  <Text style={st.codeText}>{t.code}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.desc} numberOfLines={2}>
                    {t.description}
                  </Text>
                  {t.allow_custom && (
                    <Text style={st.customText}>Descrição livre</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  topBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  backText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },

  headerArea: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm + 4,
  },

  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  groupTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  groupCount: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  groupCountText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  codeBadge: {
    minWidth: 56,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
  },
  codeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.primary,
    fontFamily: 'monospace',
    letterSpacing: 0.4,
  },
  desc: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600', lineHeight: 20 },
  customText: { fontSize: fontSize.xs, color: colors.warningDark, fontWeight: '600', marginTop: 2 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
  emptyText: { color: colors.textSecondary, fontSize: fontSize.sm },
});
