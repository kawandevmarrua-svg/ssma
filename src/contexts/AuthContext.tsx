import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { registerPushTokenForUser } from '../lib/pushNotifications';
import { bindOfflineQueueToUser } from '../lib/offlineQueue';
import { markOperatorOffline } from '../lib/operatorPresence';
import { Profile, Operator } from '../types/database';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  operatorData: Operator | null;
  isOperator: boolean;
  loading: boolean;
  mustResetPassword: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  clearMustResetPassword: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [operatorData, setOperatorData] = useState<Operator | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustResetPassword, setMustResetPassword] = useState(false);
  const mountedRef = useRef(true);
  // Memoria fora do React para o handler de onAuthStateChange ler o
  // operator id corrente sem re-criar listeners. Necessario para chamar
  // markOperatorOffline em casos de expiracao de sessao (session=null
  // sem o usuario ter chamado signOut explicito).
  const lastOperatorIdRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return;
      setSession(session);
      setMustResetPassword(session?.user?.user_metadata?.must_reset_password === true);
      bindOfflineQueueToUser(session?.user?.id ?? null);
      if (session?.user) void fetchProfile(session.user.id);
      else setLoading(false);
    }).catch(() => {
      if (mountedRef.current) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      // Sessao perdida (logout, token expirou, refresh falhou): se ainda
      // havia um operador ativo, marca offline antes do JWT desaparecer
      // de vez. Sem isso, o dashboard mostra o operador como online
      // eternamente quando a sessao expira em background.
      if (!session?.user && lastOperatorIdRef.current) {
        const opId = lastOperatorIdRef.current;
        lastOperatorIdRef.current = null;
        void markOperatorOffline(opId);
      }
      setSession(session);
      setMustResetPassword(session?.user?.user_metadata?.must_reset_password === true);
      // Cada usuario tem sua propria fila offline para nao misturar jobs
      // entre logins no mesmo aparelho.
      bindOfflineQueueToUser(session?.user?.id ?? null);
      if (session?.user) void fetchProfile(session.user.id);
      else {
        setProfile(null);
        setOperatorData(null);
        setMustResetPassword(false);
        setLoading(false);
      }
    });

    // Ao voltar do background, revalida a sessao para o autoRefresh do Supabase
    // executar com a rede ja restabelecida e destravar o app.
    function handleAppStateChange(state: AppStateStatus) {
      if (state !== 'active') return;
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (!mountedRef.current) return;
        // Mesmo tratamento que onAuthStateChange: se a sessao caiu enquanto
        // o app estava em background, marca offline antes do JWT sumir.
        if (!s?.user && lastOperatorIdRef.current) {
          const opId = lastOperatorIdRef.current;
          lastOperatorIdRef.current = null;
          void markOperatorOffline(opId);
        }
        setSession(s);
        setMustResetPassword(s?.user?.user_metadata?.must_reset_password === true);
        bindOfflineQueueToUser(s?.user?.id ?? null);
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

  // Mantem o ref atualizado para que o handler de session=null (que nao
  // re-cria com cada render) consiga marcar o operador offline.
  useEffect(() => {
    lastOperatorIdRef.current = operatorData?.id ?? null;
  }, [operatorData]);

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

  function clearMustResetPassword() {
    setMustResetPassword(false);
  }

  async function signOut() {
    // Marca operador como offline ANTES do signOut: depois o JWT vai embora
    // e o RLS bloqueia o update, deixando o status como "online" eterno
    // no dashboard ate o proximo login.
    if (operatorData?.id) {
      await markOperatorOffline(operatorData.id);
      // Limpa o ref para o handler de onAuthStateChange (que vai disparar
      // logo a seguir com session=null) nao re-chamar markOperatorOffline.
      lastOperatorIdRef.current = null;
    }
    await supabase.auth.signOut();
    bindOfflineQueueToUser(null);
    setSession(null);
    setProfile(null);
    setOperatorData(null);
    setMustResetPassword(false);
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
        mustResetPassword,
        signIn,
        signOut,
        clearMustResetPassword,
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
