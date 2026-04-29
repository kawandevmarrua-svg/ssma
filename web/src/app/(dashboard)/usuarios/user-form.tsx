'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/modal';
import { UserPlus, Eye, EyeOff, Loader2 } from 'lucide-react';
import { createUserAction } from './actions';

const CARGO_OPTIONS = [
  { value: 'operator' as const, label: 'Operador' },
  { value: 'encarregado' as const, label: 'Encarregado' },
  { value: 'supervisor' as const, label: 'Supervisor' },
  { value: 'manager' as const, label: 'Gestor' },
  { value: 'admin' as const, label: 'Administrador' },
];

interface Props {
  onSaved: () => void;
}

export function UserFormModal({ onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'supervisor' | 'encarregado' | 'operator'>('operator');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);

  function reset() {
    setNome('');
    setEmail('');
    setSenha('');
    setConfirmar('');
    setRole('operator');
    setPhone('');
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (senha !== confirmar) {
      setError('As senhas nao coincidem.');
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(senha)) {
      setError('A senha deve ter no minimo 8 caracteres, com letra maiuscula, minuscula e numero.');
      return;
    }

    setSaving(true);
    const result = await createUserAction({
      nome,
      email,
      senha,
      role,
      phone: phone || undefined,
    });
    setSaving(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    close();
    onSaved();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="shrink-0">
        <UserPlus className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Novo Usuario</span>
        <span className="sm:hidden">Novo</span>
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Cadastrar usuario"
        description="Crie um novo usuario com acesso ao sistema."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome completo *</Label>
            <Input
              placeholder="Nome do usuario"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>E-mail *</Label>
            <Input
              type="email"
              placeholder="usuario@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Senha *</Label>
              <div className="relative">
                <Input
                  type={showSenha ? 'text' : 'password'}
                  placeholder="Minimo 8 caracteres"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirmar senha *</Label>
              <div className="relative">
                <Input
                  type={showConfirmar ? 'text' : 'password'}
                  placeholder="Repita a senha"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  required
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmar((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cargo *</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={close} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Cadastrar'
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
