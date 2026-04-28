import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { registerPushTokenForUser } from '../lib/pushNotifications';
import { Profile, Operator } from '../types/database';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  operatorData: Operator | null;
  isOperator: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [operatorData, setOperatorData] = useState<Operator | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return;
      setSession(session);
      if (session?.user) void fetchProfile(session.user.id);
      else setLoading(false);
    }).catch(() => {
      if (mountedRef.current) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      setSession(session);
      if (session?.user) void fetchProfile(session.user.id);
      else {
        setProfile(null);
        setOperatorData(null);
        setLoading(false);
      }
    });

    // Ao voltar do background, revalida a sessao para o autoRefresh do Supabase
    // executar com a rede ja restabelecida e destravar o app.
    function handleAppStateChange(state: AppStateStatus) {
      if (state !== 'active') return;
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (!mountedRef.current) return;
        setSession(s);
        if (s?.user) void fetchProfile(s.user.id);
      }).catch(() => { /* swallow */ });
    }
    const appSub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      appSub.remove();
    };
  }, []);

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (!mountedRef.current) return;

      // Profile inexistente ou ainda pendente: limpa sessao para forcar novo login.
      // Erros de rede NAO derrubam a sessao — mantem o que ja estava em memoria.
      if (!error && (!data || data.role === 'pending')) {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setOperatorData(null);
        return;
      }

      if (error || !data) {
        if (error) console.log('[Auth] fetchProfile falhou, mantendo sessao:', error.message);
        return;
      }

      setProfile(data);
      registerPushTokenForUser(userId).catch((err) => {
        console.error('[Push] registerPushTokenForUser falhou:', err);
      });

      if (data.role === 'operator') {
        const { data: opData, error: opError } = await supabase
          .from('operators')
          .select('*')
          .eq('auth_user_id', userId)
          .maybeSingle();
        if (!mountedRef.current) return;
        if (!opError && opData) setOperatorData(opData);
      } else {
        setOperatorData(null);
      }
    } catch (e) {
      console.log('[Auth] fetchProfile excecao:', e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setOperatorData(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        operatorData,
        isOperator: profile?.role === 'operator',
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
