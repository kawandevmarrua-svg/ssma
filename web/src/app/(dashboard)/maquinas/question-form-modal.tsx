'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { Machine, ChecklistItem, ResponseType } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESPONSE_TYPE_LABELS: Record<ResponseType, string> = {
  yes_no: 'Sim / Nao',
  yes_no_na: 'Sim / Nao / N.A.',
  text: 'Texto livre',
  photo: 'Foto',
  numeric: 'Numero',
};

interface Props {
  machine: Machine;
  item: ChecklistItem | null;
  nextOrder: number;
  supabase: SupabaseClient;
  onClose: () => void;
  onSaved: () => void;
}

export function QuestionFormModal({ machine, item, nextOrder, supabase, onClose, onSaved }: Props) {
  const [description, setDescription] = useState(item?.description ?? '');
  const [section, setSection] = useState(item?.section ?? '');
  const [orderIndex, setOrderIndex] = useState(String(item?.order_index ?? nextOrder));
  const [responseType, setResponseType] = useState<ResponseType>(item?.response_type ?? 'yes_no');
  const [isBlocking, setIsBlocking] = useState(item?.is_blocking ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!description.trim()) {
      setError('A pergunta e obrigatoria.');
      return;
    }
    const orderNum = parseInt(orderIndex, 10);
    if (Number.isNaN(orderNum)) {
      setError('Ordem invalida.');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      machine_id: machine.id,
      order_index: orderNum,
      section: section.trim() || null,
      description: description.trim(),
      response_type: responseType,
      is_blocking: isBlocking,
    };

    if (item) {
      const { error: upErr } = await supabase.from('machine_checklist_items').update(payload).eq('id', item.id);
      if (upErr) { setError(upErr.message); setSaving(false); return; }
    } else {
      const { error: insErr } = await supabase.from('machine_checklist_items').insert(payload);
      if (insErr) { setError(insErr.message); setSaving(false); return; }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={item ? 'Editar pergunta' : 'Nova pergunta'}
      description={machine.name}
    >
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
        <div className="space-y-2">
          <Label>Pergunta *</Label>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Ex: Cinto de seguranca em boas condicoes?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo de resposta *</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={responseType}
            onChange={(e) => setResponseType(e.target.value as ResponseType)}
          >
            {(Object.keys(RESPONSE_TYPE_LABELS) as ResponseType[]).map((k) => (
              <option key={k} value={k}>{RESPONSE_TYPE_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Ordem</Label>
            <Input type="number" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Secao (opcional)</Label>
            <Input placeholder="Ex: Obrigatorio para lavra" value={section} onChange={(e) => setSection(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input id="is_blocking" type="checkbox" className="h-4 w-4 rounded border" checked={isBlocking} onChange={(e) => setIsBlocking(e.target.checked)} />
          <label htmlFor="is_blocking" className="text-sm">Pergunta impeditiva (NC bloqueia a liberacao da maquina)</label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : item ? 'Atualizar' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
