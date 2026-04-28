'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDate, formatDateTime, resolveSignedUrl as resolveUrl } from '@/lib/formatters';
import type { ChecklistRow, ChecklistResponseRow } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import Image from 'next/image';
import {
  Loader2,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  Search,
  User,
  Calendar,
  Truck,
  Camera,
  AlertTriangle,
  X,
} from 'lucide-react';

type ResponseRow = ChecklistResponseRow;

const RESULT_CONFIG = {
  released: { label: 'Liberado', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', icon: CheckCircle2 },
  not_released: { label: 'Não Liberado', color: 'text-red-700', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', icon: XCircle },
  pending: { label: 'Pendente', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500', icon: Clock },
} as const;

const STATUS_CONFIG = {
  C: { label: 'Conforme', short: 'C', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  NC: { label: 'Não Conforme', short: 'NC', color: 'text-red-700', bg: 'bg-red-100' },
  NA: { label: 'N/A', short: 'NA', color: 'text-gray-500', bg: 'bg-gray-100' },
} as const;

export default function ChecklistsPage() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get('id');

  const PAGE_SIZE = 50;
  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterResult, setFilterResult] = useState<string>('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Detail view
  const [selected, setSelected] = useState<ChecklistRow | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [photoModal, setPhotoModal] = useState<string | null>(null);
  const [resolvedPhotos, setResolvedPhotos] = useState<Record<string, string>>({});
  const [deepLinked, setDeepLinked] = useState(false);

  const CHECKLIST_SELECT = 'id, machine_name, date, status, result, brand, model, tag, shift, max_load_capacity, inspector_name, inspector_registration, notes, end_notes, ended_at, had_interference, interference_notes, created_at, operator_id, operators(name), equipment_types(name), equipment_photo_1_url, equipment_photo_2_url, equipment_photo_3_url, equipment_photo_4_url, environment_photo_url';

  const loadChecklists = useCallback(async (term = '') => {
    let query = supabase
      .from('checklists')
      .select(CHECKLIST_SELECT)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (term) query = query.or(`machine_name.ilike.%${term}%,tag.ilike.%${term}%`);
    const { data } = await query;
    const rows = (data as ChecklistRow[] | null) ?? [];
    setChecklists(rows);
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
    return rows;
  }, [supabase]);

  async function loadMoreChecklists() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const lastItem = checklists[checklists.length - 1];
    if (!lastItem) { setLoadingMore(false); return; }
    let query = supabase
      .from('checklists')
      .select(CHECKLIST_SELECT)
      .order('created_at', { ascending: false })
      .lt('created_at', lastItem.created_at)
      .limit(PAGE_SIZE);
    if (debouncedSearch) query = query.or(`machine_name.ilike.%${debouncedSearch}%,tag.ilike.%${debouncedSearch}%`);
    const { data } = await query;
    const rows = (data as ChecklistRow[] | null) ?? [];
    setChecklists((prev) => [...prev, ...rows]);
    setHasMore(rows.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  useEffect(() => {
    loadChecklists(debouncedSearch).then((data) => {
      if (deepLinkId && !deepLinked && data.length > 0) {
        const match = data.find((c) => c.id === deepLinkId);
        if (match) {
          setDeepLinked(true);
          openDetail(match);
        }
      }
    });
  }, [loadChecklists, deepLinkId, debouncedSearch]);

  // Realtime: only full reload on INSERT (needs join), patch on UPDATE/DELETE
  useEffect(() => {
    const channel = supabase
      .channel('web-checklists')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checklists' }, () => loadChecklists())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'checklists' }, (payload) => {
        const updated = payload.new as ChecklistRow;
        setChecklists((prev) => prev.map((c) => c.id === updated.id ? { ...c, ...updated } : c));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'checklists' }, (payload) => {
        const oldId = (payload.old as { id?: string })?.id;
        if (oldId) setChecklists((prev) => prev.filter((c) => c.id !== oldId));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, loadChecklists]);

  async function openDetail(checklist: ChecklistRow) {
    setSelected(checklist);
    setLoadingDetail(true);
    setResolvedPhotos({});

    const { data } = await supabase
      .from('checklist_responses')
      .select('id, status, photo_url, notes, response_value, checklist_template_items(description, section, is_blocking, order_index), machine_checklist_items(description, section, is_blocking, order_index)')
      .eq('checklist_id', checklist.id)
      .order('created_at');
    setResponses((data as ResponseRow[] | null) ?? []);

    // Resolve all photo signed URLs
    const allPaths: { key: string; path: string | null }[] = [
      { key: 'equipment_1', path: checklist.equipment_photo_1_url },
      { key: 'equipment_2', path: checklist.equipment_photo_2_url },
      { key: 'equipment_3', path: checklist.equipment_photo_3_url },
      { key: 'equipment_4', path: checklist.equipment_photo_4_url },
      { key: 'environment', path: checklist.environment_photo_url },
      ...((data as ResponseRow[] | null) ?? []).map((r) => ({ key: `resp_${r.id}`, path: r.photo_url })),
    ];

    const urlMap: Record<string, string> = {};
    await Promise.all(
      allPaths.map(async ({ key, path }) => {
        const url = await resolveUrl(supabase, 'checklist-photos', path);
        if (url) urlMap[key] = url;
      }),
    );
    setResolvedPhotos(urlMap);
    setLoadingDetail(false);
  }

  function getResultKey(c: ChecklistRow): keyof typeof RESULT_CONFIG {
    if (c.status === 'pending') return 'pending';
    return (c.result as 'released' | 'not_released') || 'pending';
  }

  function getItemData(resp: ResponseRow) {
    return resp.checklist_template_items || resp.machine_checklist_items || null;
  }

  // Grouped responses by section
  function groupBySection(items: ResponseRow[]) {
    const sorted = [...items].sort((a, b) => (getItemData(a)?.order_index ?? 0) - (getItemData(b)?.order_index ?? 0));
    const groups: { section: string; items: ResponseRow[] }[] = [];
    for (const item of sorted) {
      const section = getItemData(item)?.section || 'Geral';
      const existing = groups.find((g) => g.section === section);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({ section, items: [item] });
      }
    }
    return groups;
  }

  const filtered = useMemo(() => checklists.filter((c) => {
    const matchResult = !filterResult || getResultKey(c) === filterResult;
    return matchResult;
  }), [checklists, filterResult]);

  const stats = useMemo(() => ({
    total: checklists.length,
    released: checklists.filter((c) => c.result === 'released').length,
    not_released: checklists.filter((c) => c.result === 'not_released').length,
    pending: checklists.filter((c) => c.status === 'pending').length,
  }), [checklists]);

  // ── Detail view ──
  if (selected) {
    const rk = getResultKey(selected);
    const cfg = RESULT_CONFIG[rk];
    const Icon = cfg.icon;
    const groups = groupBySection(responses);
    const totalC = responses.filter((r) => r.status === 'C').length;
    const totalNC = responses.filter((r) => r.status === 'NC').length;
    const totalNA = responses.filter((r) => r.status === 'NA').length;

    return (
      <div className="space-y-6">
        <button
          onClick={() => { setSelected(null); setResponses([]); setResolvedPhotos({}); }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar para lista
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {selected.equipment_types?.name || selected.machine_name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {selected.machine_name}{selected.tag ? ` · TAG: ${selected.tag}` : ''}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${cfg.bg} ${cfg.color}`}>
            <Icon className="h-4 w-4" />
            {cfg.label}
          </span>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <User className="h-3.5 w-3.5" />
                Operador
              </div>
              <p className="font-semibold">{selected.operators?.name || '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calendar className="h-3.5 w-3.5" />
                Data
              </div>
              <p className="font-semibold">{formatDate(selected.date)}</p>
              <p className="text-xs text-muted-foreground">Início: {formatDateTime(selected.created_at)}</p>
              {selected.ended_at && (
                <p className="text-xs text-muted-foreground">Fim: {formatDateTime(selected.ended_at)}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Truck className="h-3.5 w-3.5" />
                Equipamento
              </div>
              <p className="font-semibold text-sm">
                {[selected.brand, selected.model].filter(Boolean).join(' ') || '—'}
              </p>
              {selected.shift && <p className="text-xs text-muted-foreground">Turno: {selected.shift}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Respostas
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-emerald-600">{totalC} C</span>
                <span className="text-sm font-semibold text-red-600">{totalNC} NC</span>
                <span className="text-sm font-semibold text-gray-500">{totalNA} NA</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {selected.inspector_name && (
          <div className="text-sm text-muted-foreground">
            Responsável: <span className="font-medium text-foreground">{selected.inspector_name}</span>
            {selected.inspector_registration && ` · Matrícula: ${selected.inspector_registration}`}
          </div>
        )}

        {selected.notes && (
          <div className="rounded-md border bg-muted/50 p-3 text-sm">
            <p className="font-medium mb-1">Observações:</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{selected.notes}</p>
          </div>
        )}

        {selected.end_notes && (
          <div className="rounded-md border bg-muted/50 p-3 text-sm">
            <p className="font-medium mb-1">Observação de encerramento:</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{selected.end_notes}</p>
          </div>
        )}

        <div className="rounded-md border p-3 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className={`h-4 w-4 ${selected.had_interference ? 'text-red-600' : 'text-emerald-600'}`} />
            <p className="font-medium">
              {selected.had_interference ? 'Houve interferência' : 'Sem interferência'}
            </p>
          </div>
          {selected.had_interference && selected.interference_notes && (
            <p className="text-muted-foreground whitespace-pre-wrap ml-6">{selected.interference_notes}</p>
          )}
        </div>

        {/* Fotos do equipamento e ambiente */}
        {(() => {
          const photos = [
            { label: 'Equipamento 1', url: resolvedPhotos['equipment_1'] },
            { label: 'Equipamento 2', url: resolvedPhotos['equipment_2'] },
            { label: 'Equipamento 3', url: resolvedPhotos['equipment_3'] },
            { label: 'Equipamento 4', url: resolvedPhotos['equipment_4'] },
            { label: 'Ambiente', url: resolvedPhotos['environment'] },
          ].filter((p) => p.url);
          if (photos.length === 0) return null;
          return (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Fotos Anexadas ({photos.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {photos.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setPhotoModal(p.url!)}
                    className="group relative aspect-square rounded-lg border overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                  >
                    <Image src={p.url!} alt={p.label} fill className="object-cover" sizes="(min-width: 640px) 20vw, 50vw" />
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1">
                      <p className="text-xs text-white font-medium truncate">{p.label}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Responses */}
        {loadingDetail ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : responses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhuma resposta registrada para este checklist.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.section}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {group.section}
                </h3>
                <div className="space-y-2">
                  {group.items.map((resp) => {
                    const st = STATUS_CONFIG[resp.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.NA;
                    const itemData = getItemData(resp);
                    const isBlocking = itemData?.is_blocking;
                    const isNC = resp.status === 'NC';
                    const url = resolvedPhotos[`resp_${resp.id}`] || null;

                    return (
                      <div
                        key={resp.id}
                        className={`rounded-md border p-3 ${isNC && isBlocking ? 'border-red-300 bg-red-50/50' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`mt-0.5 inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-bold ${st.bg} ${st.color}`}>
                            {st.short}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">
                              {itemData?.description || 'Item'}
                            </p>
                            {isBlocking && (
                              <span className="inline-flex items-center gap-1 text-xs text-orange-600 mt-0.5">
                                <AlertTriangle className="h-3 w-3" />
                                Impeditivo
                              </span>
                            )}
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Resposta:</span>
                              <span className={`font-semibold ${st.color}`}>{st.label}</span>
                            </div>
                            {resp.response_value && (
                              <p className="text-sm text-foreground mt-1.5 bg-muted/50 rounded px-2 py-1">{resp.response_value}</p>
                            )}
                            {resp.notes && (
                              <p className="text-xs text-muted-foreground mt-1">{resp.notes}</p>
                            )}
                          </div>
                        </div>
                        {url && (
                          <button
                            onClick={() => setPhotoModal(url)}
                            className="mt-2 ml-8 block rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
                            title="Clique para ampliar"
                          >
                            <Image src={url} alt="Foto da resposta" width={112} height={80} className="object-cover" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Photo modal */}
        {photoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPhotoModal(null)}>
            <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setPhotoModal(null)}
                className="absolute -top-3 -right-3 rounded-full bg-white p-1 shadow-md hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
              <img src={photoModal} alt="Foto do item" className="max-h-[85vh] rounded-lg object-contain" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Checklists Realizados</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe os checklists preenchidos pelos operadores
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.released}</p>
            <p className="text-xs text-muted-foreground">Liberados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.not_released}</p>
            <p className="text-xs text-muted-foreground">Não Liberados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por operador, equipamento, TAG..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['', 'released', 'not_released', 'pending'] as const).map((val) => {
            const labels: Record<string, string> = { '': 'Todos', released: 'Liberados', not_released: 'Não Liberados', pending: 'Pendentes' };
            return (
              <button
                key={val}
                onClick={() => setFilterResult(val)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                  filterResult === val
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {labels[val]}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <ClipboardCheck className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {checklists.length === 0 ? 'Nenhum checklist realizado ainda.' : 'Nenhum checklist encontrado com esses filtros.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((checklist) => {
            const rk = getResultKey(checklist);
            const cfg = RESULT_CONFIG[rk];
            const Icon = cfg.icon;

            return (
              <Card
                key={checklist.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openDetail(checklist)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {checklist.equipment_types?.name || checklist.machine_name}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {checklist.operators?.name || 'Operador'}
                            </span>
                            <span>{formatDate(checklist.date)}</span>
                            {checklist.tag && (
                              <span className="text-xs">TAG: {checklist.tag}</span>
                            )}
                          </div>
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {hasMore && (
            <button
              onClick={loadMoreChecklists}
              disabled={loadingMore}
              className="w-full rounded-md border bg-card py-3 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'Carregando...' : 'Carregar mais'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
