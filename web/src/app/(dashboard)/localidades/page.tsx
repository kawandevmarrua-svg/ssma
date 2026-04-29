'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [items, setItems] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Location | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Location | null>(null);
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

  async function confirmDelete() {
    if (!deleting) return;
    await supabase.from('locations').delete().eq('id', deleting.id);
    setDeleting(null);
    load();
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
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
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
                    <button
                      onClick={() => setEditing(loc)}
                      className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleting(loc)}
                      className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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

      {deleting && (
        <Modal
          open={true}
          onClose={() => setDeleting(null)}
          title="Excluir localidade"
          description="Esta acao nao pode ser desfeita."
        >
          <div className="space-y-4">
            <p className="text-sm">
              <span className="font-medium">{deleting.name}</span>
              {deleting.code && <span className="ml-2 font-mono text-muted-foreground">({deleting.code})</span>}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleting(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" className="flex-1" onClick={confirmDelete}>
                Excluir
              </Button>
            </div>
          </div>
        </Modal>
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
          <textarea
            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
          <input
            id="active"
            type="checkbox"
            className="h-4 w-4 rounded border"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
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
