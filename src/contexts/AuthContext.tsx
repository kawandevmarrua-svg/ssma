import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      setSession(session);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setOperatorData(null);
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!mountedRef.current) return;
    if (error) {
      console.error('Failed to fetch profile:', error.message);
    }
    setProfile(data);

    if (data) {
      console.log('[Auth] Profile loaded:', { role: data.role, id: data.id });
      registerPushTokenForUser(userId).catch((err) => {
        console.warn('Push token registration failed:', err);
      });
    }

    if (data?.role === 'operator') {
      const { data: opData, error: opError } = await supabase
        .from('operators')
        .select('*')
        .eq('auth_user_id', userId)
        .single();
      console.log('[Auth] Operator data:', opData ? { id: opData.id, name: opData.name } : null, opError?.message);
      if (mountedRef.current) {
        setOperatorData(opData);
      }
    } else {
      console.log('[Auth] Not operator role, skipping operatorData fetch. Role:', data?.role);
      setOperatorData(null);
    }

    setLoading(false);
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
