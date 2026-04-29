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
import { Location } from '../types/database';
import { colors, spacing, radius, fontSize } from '../theme/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: Location) => void;
}

export function LocationPicker({ visible, onClose, onSelect }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setSearch('');
    supabase
      .from('locations')
      .select('id, code, name, description, active')
      .eq('active', true)
      .order('name', { ascending: true })
      .then(({ data }) => {
        setLocations((data ?? []) as Location[]);
        setLoading(false);
      });
  }, [visible]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return locations;
    return locations.filter(
      (l) =>
        l.name.toLowerCase().includes(term) ||
        (l.code && l.code.toLowerCase().includes(term)) ||
        (l.description && l.description.toLowerCase().includes(term)),
    );
  }, [locations, search]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Selecionar localidade</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nome ou codigo"
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
          ) : filtered.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {locations.length === 0
                  ? 'Nenhuma localidade cadastrada. Cadastre pelo painel web.'
                  : 'Nenhuma localidade encontrada.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  <Ionicons name="location-outline" size={18} color={colors.primary} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={styles.name}>{item.name}</Text>
                    {item.code && <Text style={styles.code}>{item.code}</Text>}
                  </View>
                </TouchableOpacity>
              )}
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
    maxHeight: '75%',
    minHeight: '45%',
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
  emptyText: { color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  code: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
});
