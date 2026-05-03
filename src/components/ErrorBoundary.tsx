import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { colors } from '../theme/colors';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.log('[ErrorBoundary]', error.message, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Algo deu errado</Text>
        <ScrollView style={styles.body}>
          <Text style={styles.msg}>{this.state.error.message}</Text>
          {this.state.error.stack ? (
            <Text style={styles.stack}>{this.state.error.stack}</Text>
          ) : null}
        </ScrollView>
        <Pressable style={styles.btn} onPress={this.reset}>
          <Text style={styles.btnText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 64 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 16 },
  body: { flex: 1, marginBottom: 16 },
  msg: { fontSize: 14, color: colors.text, marginBottom: 12, fontWeight: '600' },
  stack: { fontSize: 11, color: colors.textSecondary, fontFamily: 'monospace' },
  btn: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
