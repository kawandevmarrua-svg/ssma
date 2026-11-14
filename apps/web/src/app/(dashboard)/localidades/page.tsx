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
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/modal';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Search,
  MapPin,
} from 'lucide-react';

interface Location {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  created_at: string;
}

export default function LocalidadesPage() {
  const supabase = useMemo(() => createClient(), []);
  const confirm = useConfirm();
  const [items, setItems] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Location | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  async function load() {
    const { data } = await supabase
      .from('locations')
      .select('*')
      .order('name', { ascending: true });
    setItems((data as Location[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(loc: Location) {
    await supabase.from('locations').update({ active: !loc.active }).eq('id', loc.id);
    load();
  }

  async function handleDelete(loc: Location) {
    const ok = await confirm({
      title: 'Excluir localidade?',
      description: `"${loc.name}"${loc.code ? ` (${loc.code})` : ''} será removida. Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;
    const { error } = await supabase.from('locations').delete().eq('id', loc.id);
    if (error) {
      toast.error('Falha ao excluir localidade.');
      return;
    }
    load();
    toast.success('Localidade excluída.');
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((l) =>
      l.name.toLowerCase().includes(term) ||
      (l.code?.toLowerCase().includes(term) ?? false) ||
      (l.description?.toLowerCase().includes(term) ?? false)
    );
  }, [items, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Localidades</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro de frentes de trabalho, fazendas e setores.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova localidade
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, codigo ou descricao..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {items.length === 0 ? 'Nenhuma localidade cadastrada.' : 'Nenhuma localidade encontrada.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((loc) => (
            <Card key={loc.id} className={!loc.active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex shrink-0 items-center justify-center rounded bg-primary/10 p-2 text-primary">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{loc.name}</p>
                      {loc.code && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-semibold text-muted-foreground">
                          {loc.code}
                        </span>
                      )}
                    </div>
                    {loc.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {loc.description}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => toggleActive(loc)}
                        className="underline-offset-2 hover:underline"
                      >
                        {loc.active ? 'Ativo' : 'Inativo'}
                      </button>
                      {loc.latitude !== null && loc.longitude !== null && (
                        <>
                          <span>·</span>
                          <span className="font-mono">
                            {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(loc)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(loc)}
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
      )}

      {(creating || editing) && (
        <LocationForm
          item={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}

    </div>
  );
}

interface FormProps {
  item: Location | null;
  onClose: () => void;
  onSaved: () => void;
}

function LocationForm({ item, onClose, onSaved }: FormProps) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState(item?.name ?? '');
  const [code, setCode] = useState(item?.code ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [latitude, setLatitude] = useState(item?.latitude !== null && item?.latitude !== undefined ? String(item.latitude) : '');
  const [longitude, setLongitude] = useState(item?.longitude !== null && item?.longitude !== undefined ? String(item.longitude) : '');
  const [active, setActive] = useState(item?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) { setError('Nome e obrigatorio.'); return; }

    let latNum: number | null = null;
    let lngNum: number | null = null;
    if (latitude.trim()) {
      latNum = parseFloat(latitude.replace(',', '.'));
      if (Number.isNaN(latNum)) { setError('Latitude invalida.'); return; }
    }
    if (longitude.trim()) {
      lngNum = parseFloat(longitude.replace(',', '.'));
      if (Number.isNaN(lngNum)) { setError('Longitude invalida.'); return; }
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      code: code.trim() || null,
      description: description.trim() || null,
      latitude: latNum,
      longitude: lngNum,
      active,
    };

    if (item) {
      const { error: upErr } = await supabase.from('locations').update(payload).eq('id', item.id);
      if (upErr) { setError(upErr.message); setSaving(false); return; }
    } else {
      const { error: insErr } = await supabase.from('locations').insert(payload);
      if (insErr) { setError(insErr.message); setSaving(false); return; }
    }
    setSaving(false);
    toast.success(item ? 'Localidade atualizada.' : 'Localidade criada.');
    onSaved();
  }

  return (
    <Modal open={true} onClose={onClose} title={item ? 'Editar localidade' : 'Nova localidade'}>
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
        <div className="space-y-2">
          <Label>Nome *</Label>
          <Input
            placeholder="Ex: Fazenda Sao Joao"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Codigo</Label>
          <Input
            placeholder="Ex: FAZ-01"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label>Descricao</Label>
          <Textarea
            className="min-h-[60px]"
            placeholder="Detalhes adicionais sobre a localidade"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Latitude</Label>
            <Input
              placeholder="-23.55052"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <div className="space-y-2">
            <Label>Longitude</Label>
            <Input
              placeholder="-46.63331"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              inputMode="decimal"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="active"
            checked={active}
            onCheckedChange={(c) => setActive(c === true)}
          />
          <label htmlFor="active" className="text-sm">Ativo</label>
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
