'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

interface CreateUserInput {
  nome: string;
  email: string;
  senha: string;
  role: 'admin' | 'manager' | 'supervisor' | 'encarregado' | 'operator';
  phone?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const VALID_ROLES = new Set(['admin', 'manager', 'supervisor', 'encarregado', 'operator']);

// Hierarquia de roles: quem pode criar/editar quem.
// Ninguém pode atribuir um role igual ou superior ao seu próprio
// (exceto admin, que pode atribuir qualquer role inclusive admin).
const ASSIGNABLE_ROLES: Record<string, string[]> = {
  encarregado: ['operator'],
  supervisor:  ['operator', 'encarregado'],
  manager:     ['operator', 'encarregado', 'supervisor', 'manager', 'admin'],
  admin:       ['operator', 'encarregado', 'supervisor', 'manager', 'admin'],
};

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

  if (profileErr || !callerProfile || !['admin', 'manager', 'supervisor', 'encarregado'].includes(callerProfile.role)) {
    return { error: 'Sem permissao para criar usuarios.' };
  }

  const allowedToCreate = ASSIGNABLE_ROLES[callerProfile.role] ?? [];
  if (!allowedToCreate.includes(input.role)) {
    return { error: 'Sem permissao para atribuir este cargo.' };
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
    console.error('[createUserAction] auth.admin.createUser error:', createErr?.message);
    return { error: 'Falha ao criar usuario. Verifique se o e-mail ja esta em uso.' };
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
    console.error('[createUserAction] profiles upsert error:', upsertErr.message);
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: 'Falha ao configurar perfil do usuario.' };
  }

  revalidatePath('/usuarios');
  return { success: true };
}

interface UpdateUserInput {
  id: string;
  full_name: string;
  role: 'admin' | 'manager' | 'supervisor' | 'encarregado' | 'operator';
  phone?: string;
  active: boolean;
}

export async function updateUserAction(input: UpdateUserInput) {
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

  if (profileErr || !callerProfile || !['admin', 'manager', 'supervisor', 'encarregado'].includes(callerProfile.role)) {
    return { error: 'Sem permissao para editar usuarios.' };
  }

  // Impede escalada de privilege: caller só pode atribuir roles abaixo do seu.
  const allowedToAssign = ASSIGNABLE_ROLES[callerProfile.role] ?? [];
  if (!allowedToAssign.includes(input.role)) {
    return { error: 'Sem permissao para atribuir este cargo.' };
  }

  // Impede rebaixar alguém com role igual ou superior (ex: encarregado editando manager).
  const { data: targetProfile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', input.id)
    .single();
  if (targetProfile && !allowedToAssign.includes(targetProfile.role)) {
    return { error: 'Sem permissao para editar este usuario.' };
  }

  const name = input.full_name.trim();
  if (!name || name.length < 2) return { error: 'Nome invalido.' };
  if (!VALID_ROLES.has(input.role)) return { error: 'Cargo invalido.' };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return {
      error:
        'SUPABASE_SERVICE_ROLE_KEY nao configurada no servidor.',
    };
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: updateErr } = await admin
    .from('profiles')
    .update({
      full_name: name,
      role: input.role,
      phone: input.phone?.trim() || null,
      active: input.active,
    })
    .eq('id', input.id);

  if (updateErr) {
    console.error('[updateUserAction] profiles update error:', updateErr.message);
    return { error: 'Falha ao atualizar usuario.' };
  }

  revalidatePath('/usuarios');
  return { success: true };
}
