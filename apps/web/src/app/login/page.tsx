'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SignInPage, type Highlight } from '@/components/ui/sign-in';
import { ClipboardCheck, BellRing, MapPin } from 'lucide-react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HIGHLIGHTS: Highlight[] = [
  {
    icon: ClipboardCheck,
    title: 'Checklists em campo',
    text: 'Pré-operação registrada pelo operador, direto no seu painel.',
  },
  {
    icon: BellRing,
    title: 'Alertas na hora',
    text: 'Não conformidade chega ao gestor em tempo real.',
  },
  {
    icon: MapPin,
    title: 'Equipes no mapa',
    text: 'Localização das frentes de trabalho ao vivo.',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const trimmedEmail = email.trim();

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('Informe um e-mail válido.');
      setLoading(false);
      return;
    }

    if (!password) {
      setError('Informe sua senha.');
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (signInError) {
      setError('Credenciais inválidas.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <SignInPage
      highlights={HIGHLIGHTS}
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      error={error}
      loading={loading}
      onSignIn={handleSubmit}
    />
  );
}
