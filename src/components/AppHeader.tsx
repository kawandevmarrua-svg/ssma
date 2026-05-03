import { useCallback, useState } from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme/colors';
import { Text } from './ui';

type Props = {
  /** Subtitle shown below the brand row (optional). */
  subtitle?: string;
};

export function AppHeader({ subtitle }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;
      (async () => {
        const { count } = await supabase
          .from('safety_alerts')
          .select('id', { count: 'exact', head: true })
          .or(`operator_id.eq.${user.id},operator_id.is.null`)
          .eq('read', false);
        if (!cancelled) setUnreadAlerts(count ?? 0);
      })();
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brand}>MARRUÁ</Text>
        </View>

        <Pressable
          onPress={() => router.push('/(operator)/alerts')}
          style={({ pressed }) => [
            styles.bellBtn,
            pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
          ]}
          hitSlop={8}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.text} />
          {unreadAlerts > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadAlerts > 9 ? '9+' : unreadAlerts}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  brand: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.text,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
