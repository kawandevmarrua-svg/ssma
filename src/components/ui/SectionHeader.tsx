import { StyleSheet, View } from 'react-native';
import { ReactNode } from 'react';
import { spacing } from '../../theme/colors';
import { Text } from './Text';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

export function SectionHeader({ title, subtitle, right }: SectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        <Text variant="h3">{title}</Text>
        {subtitle && (
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  left: { flex: 1 },
});
