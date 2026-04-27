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

export async function createUserAction(input: CreateUserInput) {
  const supabaseAuth = createServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) return { error: 'Não autenticado.' };

  const nome = input.nome.trim();
  const email = input.email.trim().toLowerCase();
  const senha = input.senha;

  if (!nome || !email || !senha) return { error: 'Preencha todos os campos.' };
  if (senha.length < 8) return { error: 'A senha deve ter no mínimo 8 caracteres.' };
  if (!CARGOS.includes(input.cargo as Cargo)) return { error: 'Cargo inválido.' };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return {
      error:
        'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor. Adicione em web/.env.local e reinicie o dev server.',
    };
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { full_name: nome, cargo: input.cargo },
  });

  if (createErr || !created.user) {
    return { error: createErr?.message ?? 'Falha ao criar usuário.' };
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
