'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useConfirm } from '@/components/confirm-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/modal';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Search,
} from 'lucide-react';

type Category = 'parada' | 'servico' | 'outro';

interface ActivityType {
  id: string;
  code: string;
  description: string;
  category: Category;
  allow_custom: boolean;
  active: boolean;
  order_index: number;
  created_at: string;
}

const CATEGORY_LABELS: Record<Category, string> = {
  parada: 'Paradas (P)',
  servico: 'Servicos (S)',
  outro: 'Outros',
};

export default function TiposAtividadePage() {
  const supabase = useMemo(() => createClient(), []);
  const confirm = useConfirm();
  const [items, setItems] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ActivityType | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | ''>('');

  async function load() {
    const { data } = await supabase
      .from('activity_types')
      .select('*')
      .order('category', { ascending: true })
      .order('order_index', { ascending: true });
    setItems((data as ActivityType[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(t: ActivityType) {
    await supabase.from('activity_types').update({ active: !t.active }).eq('id', t.id);
    load();
  }

  async function handleDelete(t: ActivityType) {
    const ok = await confirm({
      title: 'Excluir tipo de atividade?',
      description: `${t.code} — ${t.description}. Atividades já registradas manterão a referência (ON DELETE SET NULL).`,
      confirmText: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;
    const { error } = await supabase.from('activity_types').delete().eq('id', t.id);
    if (error) {
      toast.error('Falha ao excluir tipo de atividade.');
      return;
    }
    load();
    toast.success('Tipo de atividade excluído.');
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((t) => {
      if (filterCategory && t.category !== filterCategory) return false;
      if (!term) return true;
      return t.code.toLowerCase().includes(term) || t.description.toLowerCase().includes(term);
    });
  }, [items, search, filterCategory]);

  const sectioned = useMemo(() => {
    const map = new Map<Category, ActivityType[]>();
    for (const t of filtered) {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    }
    return Array.from(map, ([category, list]) => ({ category, list }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Tipos de Atividade</h1>
          <p className="text-sm text-muted-foreground">
            Codigos P (Paradas) e S (Servicos) usados pelo operador no app mobile.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo tipo
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por codigo ou descricao..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as Category | '')}
          className="sm:w-auto sm:min-w-[180px]"
        >
          <option value="">Todas as categorias</option>
          <option value="parada">Paradas (P)</option>
          <option value="servico">Servicos (S)</option>
          <option value="outro">Outros</option>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {items.length === 0 ? 'Nenhum tipo cadastrado.' : 'Nenhum tipo encontrado.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sectioned.map(({ category, list }) => (
            <div key={category} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {CATEGORY_LABELS[category]} <span className="text-muted-foreground/60">({list.length})</span>
              </h2>
              <div className="space-y-2">
                {list.map((t) => (
                  <Card key={t.id} className={!t.active ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex shrink-0 items-center rounded bg-primary/10 px-2 py-1 text-xs font-mono font-bold text-primary">
                          {t.code}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{t.description}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>Ordem #{t.order_index}</span>
                            <span>·</span>
                            <button
                              type="button"
                              onClick={() => toggleActive(t)}
                              className="underline-offset-2 hover:underline"
                            >
                              {t.active ? 'Ativo' : 'Inativo'}
                            </button>
                            {t.allow_custom && (
                              <>
                                <span>·</span>
                                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                                  TEXTO LIVRE
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditing(t)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(t)}
                            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ActivityTypeForm
          item={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}

    </div>
  );
}

interface FormProps {
  item: ActivityType | null;
  onClose: () => void;
  onSaved: () => void;
}

function ActivityTypeForm({ item, onClose, onSaved }: FormProps) {
  const supabase = useMemo(() => createClient(), []);
  const [code, setCode] = useState(item?.code ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [category, setCategory] = useState<Category>(item?.category ?? 'parada');
  const [allowCustom, setAllowCustom] = useState(item?.allow_custom ?? false);
  const [active, setActive] = useState(item?.active ?? true);
  const [orderIndex, setOrderIndex] = useState(String(item?.order_index ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!code.trim()) { setError('Codigo e obrigatorio.'); return; }
    if (!description.trim()) { setError('Descricao e obrigatoria.'); return; }
    const orderNum = parseInt(orderIndex, 10);
    if (Number.isNaN(orderNum)) { setError('Ordem invalida.'); return; }
    setSaving(true);
    setError(null);

    const payload = {
      code: code.trim(),
      description: description.trim(),
      category,
      allow_custom: allowCustom,
      active,
      order_index: orderNum,
    };

    if (item) {
      const { error: upErr } = await supabase.from('activity_types').update(payload).eq('id', item.id);
      if (upErr) { setError(upErr.message); setSaving(false); return; }
    } else {
      const { error: insErr } = await supabase.from('activity_types').insert(payload);
      if (insErr) { setError(insErr.message); setSaving(false); return; }
    }
    setSaving(false);
    toast.success(item ? 'Tipo de atividade atualizado.' : 'Tipo de atividade criado.');
    onSaved();
  }

  return (
    <Modal open={true} onClose={onClose} title={item ? 'Editar tipo' : 'Novo tipo'}>
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Codigo *</Label>
            <Input
              placeholder="Ex: P01, S03, P_OUTROS"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              <option value="parada">Parada (P)</option>
              <option value="servico">Servico (S)</option>
              <option value="outro">Outro</option>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Descricao *</Label>
          <Textarea
            className="min-h-[60px]"
            placeholder="Ex: Dialogo Diario de Seguranca"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Ordem</Label>
            <Input type="number" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={active}
                onCheckedChange={(c) => setActive(c === true)}
              />
              Ativo
            </label>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="allow_custom"
            className="mt-0.5"
            checked={allowCustom}
            onCheckedChange={(c) => setAllowCustom(c === true)}
          />
          <label htmlFor="allow_custom" className="text-sm">
            Pedir descricao livre ao operador (use para &ldquo;Outros (informar)&rdquo;)
          </label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : item ? 'Atualizar' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
