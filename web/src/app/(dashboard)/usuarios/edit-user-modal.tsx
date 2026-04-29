'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  active: boolean;
  role: string;
}

interface Props {
  user: UserProfile;
  supabase: SupabaseClient;
  onClose: () => void;
  onSaved: () => void;
}

const CARGO_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  encarregado: 'Encarregado',
  operator: 'Operador',
};

export function EditUserModal({ user, supabase, onClose, onSaved }: Props) {
  const [name, setName] = useState(user.full_name ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [active, setActive] = useState(user.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError('Nome e obrigatorio.');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: name.trim(),
        phone: phone.trim() || null,
        active,
      })
      .eq('id', user.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Editar Usuario"
      description={`${user.full_name || user.email} — Cargo: ${CARGO_LABELS[user.role] || user.role}`}
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
            placeholder="Nome do usuario"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input
            placeholder="(00) 00000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

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
            ) : (
              'Atualizar'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
