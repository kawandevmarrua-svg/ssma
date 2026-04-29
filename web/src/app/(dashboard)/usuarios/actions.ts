'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

interface CreateUserInput {
  nome: string;
  email: string;
  senha: string;
  role: 'admin' | 'manager' | 'encarregado' | 'operator';
  phone?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const VALID_ROLES = new Set(['admin', 'manager', 'encarregado', 'operator']);

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

  if (profileErr || !callerProfile || !['admin', 'manager', 'encarregado'].includes(callerProfile.role)) {
    return { error: 'Sem permissao para criar usuarios.' };
  }

  if (callerProfile.role !== 'admin' && input.role === 'admin') {
    return { error: 'Apenas administradores podem criar outros administradores.' };
  }

  const nome = input.nome.trim();
  const email = input.email.trim().toLowerCase();
  const senha = input.senha;

  if (!nome || nome.length < 2) return { error: 'Nome invalido.' };
  if (!EMAIL_REGEX.test(email)) return { error: 'E-mail invalido.' };
  if (!STRONG_PASSWORD.test(senha)) {
    return {
      error:
        'A senha deve ter no minimo 8 caracteres, com letra maiuscula, minuscula e numero.',
    };
  }
  if (!VALID_ROLES.has(input.role)) return { error: 'Cargo invalido.' };

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
      role: input.role,
      must_reset_password: true,
      password_set_by_admin: true,
    },
  });

  if (createErr || !created.user) {
    return { error: createErr?.message ?? 'Falha ao criar usuario.' };
  }

  const { error: upsertErr } = await admin.from('profiles').upsert({
    id: created.user.id,
    email,
    full_name: nome,
    role: input.role,
    phone: input.phone?.trim() || null,
    active: true,
    created_by: user.id,
  });

  if (upsertErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: upsertErr.message };
  }

  revalidatePath('/usuarios');
  return { success: true };
}
