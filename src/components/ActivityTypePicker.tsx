import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { ActivityType } from '../types/database';
import { colors, spacing, radius, fontSize } from '../theme/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: ActivityType) => void;
}

const CATEGORY_LABELS: Record<ActivityType['category'], string> = {
  parada: 'Paradas (P)',
  servico: 'Servicos (S)',
  outro: 'Outros',
};

export function ActivityTypePicker({ visible, onClose, onSelect }: Props) {
  const [types, setTypes] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setSearch('');
    supabase
      .from('activity_types')
      .select('*')
      .eq('active', true)
      .order('category', { ascending: true })
      .order('order_index', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[ActivityTypePicker] erro ao carregar tipos:', error.message);
        setTypes((data ?? []) as ActivityType[]);
        setLoading(false);
      });
  }, [visible]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return types;
    return types.filter(
      (t) =>
        t.code.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term),
    );
  }, [types, search]);

  const sections = useMemo(() => {
    const map = new Map<ActivityType['category'], ActivityType[]>();
    for (const t of filtered) {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    }
    return Array.from(map, ([category, items]) => ({ category, items }));
  }, [filtered]);

  const flatData = useMemo(() => {
    const out: Array<
      | { kind: 'header'; category: ActivityType['category'] }
      | { kind: 'item'; type: ActivityType }
    > = [];
    for (const s of sections) {
      out.push({ kind: 'header', category: s.category });
      for (const t of s.items) out.push({ kind: 'item', type: t });
    }
    return out;
  }, [sections]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Selecionar atividade</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.textLight} />
            <TextInput
              style={styles.searchInput}
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
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : flatData.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>Nenhuma atividade encontrada.</Text>
            </View>
          ) : (
            <FlatList
              data={flatData}
              keyExtractor={(it, idx) =>
                it.kind === 'header' ? `h-${it.category}` : `t-${it.type.id}-${idx}`
              }
              renderItem={({ item }) => {
                if (item.kind === 'header') {
                  return (
                    <Text style={styles.sectionHeader}>{CATEGORY_LABELS[item.category]}</Text>
                  );
                }
                const t = item.type;
                return (
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => {
                      onSelect(t);
                      onClose();
                    }}
                  >
                    <Text style={styles.code}>{t.code}</Text>
                    <Text style={styles.desc} numberOfLines={2}>
                      {t.description}
                    </Text>
                    {t.allow_custom && (
                      <View style={styles.customBadge}>
                        <Text style={styles.customText}>livre</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '85%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
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
