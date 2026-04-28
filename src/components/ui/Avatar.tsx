import { StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Text } from './Text';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name?: string | null;
  size?: Size;
  style?: ViewStyle;
}

const sizeMap: Record<Size, { box: number; font: number; icon: number }> = {
  xs: { box: 28, font: 11, icon: 14 },
  sm: { box: 36, font: 13, icon: 18 },
  md: { box: 48, font: 16, icon: 22 },
  lg: { box: 64, font: 22, icon: 28 },
  xl: { box: 88, font: 30, icon: 40 },
};

const palette = [
  { bg: '#FEE2E2', fg: '#B91C1C' },
  { bg: '#FFEDD5', fg: '#C2410C' },
  { bg: '#FEF3C7', fg: '#B45309' },
  { bg: '#D1FAE5', fg: '#047857' },
  { bg: '#DBEAFE', fg: '#1D4ED8' },
  { bg: '#E0E7FF', fg: '#4338CA' },
  { bg: '#FCE7F3', fg: '#BE185D' },
  { bg: '#CFFAFE', fg: '#0E7490' },
];

function hashColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 'md', style }: AvatarProps) {
  const s = sizeMap[size];
  const trimmed = name?.trim() ?? '';
  const colorPair = trimmed ? hashColor(trimmed) : { bg: colors.surfaceMuted, fg: colors.textSecondary };

  return (
    <View
      style={[
        styles.base,
        {
          width: s.box,
          height: s.box,
          borderRadius: s.box / 2,
          backgroundColor: colorPair.bg,
        },
        style,
      ]}
    >
      {trimmed ? (
        <Text style={{ fontSize: s.font, fontWeight: '700', color: colorPair.fg }}>
          {getInitials(trimmed)}
        </Text>
      ) : (
        <Ionicons name="person" size={s.icon} color={colorPair.fg} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
