'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { Machine } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Props {
  open: boolean;
  editing: Machine | null;
  supabase: SupabaseClient;
  onClose: () => void;
  onSaved: (inserted?: Machine) => void;
}

export function MachineFormModal({ open, editing, supabase, onClose, onSaved }: Props) {
  const [name, setName] = useState(editing?.name ?? '');
  const [tag, setTag] = useState(editing?.tag ?? '');
  const [maxLoadCapacity, setMaxLoadCapacity] = useState(editing?.max_load_capacity ?? '');
  const [serialNumber, setSerialNumber] = useState(editing?.serial_number ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [active, setActive] = useState(editing?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError('Nome da maquina e obrigatorio.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      tag: tag.trim() || null,
      max_load_capacity: maxLoadCapacity.trim() || null,
      serial_number: serialNumber.trim() || null,
      notes: notes.trim() || null,
      active,
    };

    if (editing) {
      const { error: updateError } = await supabase
        .from('machines')
        .update(payload)
        .eq('id', editing.id);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setSaving(false);
      onSaved();
    } else {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { data: inserted, error: insertError } = await supabase
        .from('machines')
        .insert({ ...payload, created_by: currentUser!.id })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      setSaving(false);
      onSaved(inserted as Machine);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar Maquina' : 'Nova Maquina'}
      description={editing ? 'Atualize os dados da maquina.' : 'Cadastre uma nova maquina/equipamento.'}
    >
      <form
        onSubmit={(e) => { e.preventDefault(); handleSave(); }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label>Nome da maquina *</Label>
          <Input placeholder="Ex: Caminhao Basculante 01" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Tag / Identificacao</Label>
          <Input placeholder="Ex: CB-001" value={tag} onChange={(e) => setTag(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Numero de serie</Label>
          <Input placeholder="Ex: SN-12345" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Capacidade maxima de carga</Label>
          <Input placeholder="Ex: 25 toneladas" value={maxLoadCapacity} onChange={(e) => setMaxLoadCapacity(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Observacoes</Label>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Notas adicionais sobre a maquina..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {editing && (
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${active ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-background text-muted-foreground border-input hover:bg-accent'}`}
                onClick={() => setActive(true)}
              >Ativa</button>
              <button
                type="button"
                className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${!active ? 'bg-red-500 text-white border-red-500' : 'bg-background text-muted-foreground border-input hover:bg-accent'}`}
                onClick={() => setActive(false)}
              >Inativa</button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : editing ? 'Atualizar' : 'Cadastrar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
