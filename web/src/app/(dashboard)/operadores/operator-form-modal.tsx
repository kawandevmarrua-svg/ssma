'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { Operator } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Props {
  editing: Operator | null;
  supabase: SupabaseClient;
  onClose: () => void;
  onSaved: () => void;
}

export function OperatorFormModal({ editing, supabase, onClose, onSaved }: Props) {
  const [name, setName] = useState(editing?.name ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [role, setRole] = useState(editing?.role ?? '');
  const [active, setActive] = useState(editing?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim() || !role.trim()) {
      setError('Nome e funcao sao obrigatorios.');
      return;
    }

    setSaving(true);
    setError(null);

    if (editing) {
      const { error: updateError } = await supabase
        .from('operators')
        .update({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          role: role.trim(),
          active,
        })
        .eq('id', editing.id);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setError('Email e senha sao obrigatorios para novo operador.');
        setSaving(false);
        return;
      }

      if (password.length < 8) {
        setError('Senha deve ter no minimo 8 caracteres.');
        setSaving(false);
        return;
      }

      const { createClient: rawCreateClient } = await import('@supabase/supabase-js');
      const tempClient = rawCreateClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );

      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim(), role: 'operator' } },
      });

      if (authError) {
        setError(authError.message);
        setSaving(false);
        return;
      }

      if (authData.user) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        const { error: opError } = await supabase.from('operators').insert({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          role: role.trim(),
          created_by: currentUser!.id,
          auth_user_id: authData.user.id,
          active: true,
        });

        if (opError) {
          try {
            await supabase.functions.invoke('delete-auth-user', {
              body: { user_id: authData.user.id },
            });
          } catch {
            // Best-effort cleanup
          }
          setError('Erro ao registrar operador: ' + opError.message + '. A conta de autenticacao foi removida.');
          setSaving(false);
          return;
        }
      }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={editing ? 'Editar Operador' : 'Novo Operador'}
      description={editing ? 'Atualize os dados do operador.' : 'Cadastre um operador com acesso ao app mobile.'}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label>Nome completo *</Label>
          <Input
            placeholder="Nome do operador"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {!editing && (
          <>
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Senha *</Label>
              <Input
                type="password"
                placeholder="Minimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input
            placeholder="(00) 00000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Funcao / Cargo *</Label>
          <Input
            placeholder="Ex: Operador de Guindaste"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          />
        </div>

        {editing && (
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                  active
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-background text-muted-foreground border-input hover:bg-accent'
                }`}
                onClick={() => setActive(true)}
              >
                Ativo
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                  !active
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-background text-muted-foreground border-input hover:bg-accent'
                }`}
                onClick={() => setActive(false)}
              >
                Inativo
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : editing ? (
              'Atualizar'
            ) : (
              'Cadastrar'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
