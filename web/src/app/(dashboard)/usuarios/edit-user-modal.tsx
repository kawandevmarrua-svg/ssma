'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { updateUserAction } from './actions';

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
  onClose: () => void;
  onSaved: () => void;
}

const CARGO_OPTIONS = [
  { value: 'operator' as const, label: 'Operador' },
  { value: 'encarregado' as const, label: 'Encarregado' },
  { value: 'supervisor' as const, label: 'Supervisor' },
  { value: 'manager' as const, label: 'Gestor' },
  { value: 'admin' as const, label: 'Administrador' },
];

export function EditUserModal({ user, onClose, onSaved }: Props) {
  const [name, setName] = useState(user.full_name ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [role, setRole] = useState(user.role);
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

    const result = await updateUserAction({
      id: user.id,
      full_name: name.trim(),
      role: role as 'admin' | 'manager' | 'encarregado' | 'operator',
      phone: phone.trim() || undefined,
      active,
    });

    setSaving(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    onSaved();
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Editar Usuario"
      description={`${user.full_name || user.email}`}
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
          <Label>Cargo *</Label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {CARGO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
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
