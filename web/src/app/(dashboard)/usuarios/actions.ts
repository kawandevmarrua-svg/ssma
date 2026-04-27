'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { CARGOS, type Cargo } from './cargos';

interface CreateUserInput {
  nome: string;
  email: string;
  senha: string;
  cargo: string;
  ativo: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;

export async function createUserAction(input: CreateUserInput) {
  const supabaseAuth = await createServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) return { error: 'Nao autenticado.' };

  const { data: callerProfile, error: profileErr } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileErr || callerProfile?.role !== 'admin') {
    return { error: 'Apenas administradores podem criar usuarios.' };
  }

  const nome = input.nome.trim();
  const email = input.email.trim().toLowerCase();
  const senha = input.senha;

  if (!nome || nome.length < 2) return { error: 'Nome invalido.' };
  if (!EMAIL_REGEX.test(email)) return { error: 'E-mail invalido.' };
  if (!STRONG_PASSWORD.test(senha)) {
    return {
      error:
        'A senha deve ter no minimo 10 caracteres, com letra maiuscula, minuscula e numero.',
    };
  }
  if (!CARGOS.includes(input.cargo as Cargo)) return { error: 'Cargo invalido.' };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return {
      error:
        'SUPABASE_SERVICE_ROLE_KEY nao configurada no servidor. Adicione no host (Vercel/etc) e reinicie.',
    };
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: {
      full_name: nome,
      cargo: input.cargo,
      must_reset_password: true,
      password_set_by_admin: true,
    },
  });

  if (createErr || !created.user) {
    return { error: createErr?.message ?? 'Falha ao criar usuario.' };
  }

  const { error: insertErr } = await admin.from('usuarios').insert({
    nome,
    email,
    cargo: input.cargo,
    ativo: input.ativo,
    auth_user_id: created.user.id,
  });

  if (insertErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: insertErr.message };
  }

  revalidatePath('/usuarios');
  return { success: true };
}
