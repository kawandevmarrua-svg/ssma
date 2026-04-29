'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDate, formatDateTime, formatTime, getDuration, resolveSignedUrl } from '@/lib/formatters';
import type { ActivityRow } from '@/lib/types';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import Image from 'next/image';
import {
  Loader2,
  Activity,
  CheckCircle2,
  Clock,
  ChevronLeft,
  Search,
  User,
  Calendar,
  MapPin,
  Tag,
  Camera,
  AlertTriangle,
  X,
  HardHat,
  FileDown,
} from 'lucide-react';
import { exportActivityPDF, exportActivityListPDF } from '@/lib/pdf';

const STATUS_CONFIG = {
  in_progress: { label: 'Em Andamento', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500', icon: Clock },
  completed: { label: 'Concluída', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', icon: CheckCircle2 },
} as const;

export default function AtividadesPage() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get('id');

  const PAGE_SIZE = 50;
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterOperator, setFilterOperator] = useState<string>('');
  const [filterMachine, setFilterMachine] = useState<string>('');
  const [machines, setMachines] = useState<{ id: string; name: string; tag: string | null }[]>([]);
  const [filterActivityType, setFilterActivityType] = useState<string>('');
  const [activityTypes, setActivityTypes] = useState<{ id: string; code: string; description: string; category: string }[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Detail view
  const [selected, setSelected] = useState<ActivityRow | null>(null);
  const [photoModal, setPhotoModal] = useState<string | null>(null);
  const [resolvedPhotos, setResolvedPhotos] = useState<Record<string, string>>({});
  const [deepLinked, setDeepLinked] = useState(false);

  const ACTIVITY_COLUMNS = 'id, date, location, description, start_time, end_time, equipment_tag, had_interference, interference_notes, notes, transit_start, transit_end, equipment_photo_url, start_photo_url, end_photo_url, created_at, operator_id, checklist_id, machine_id, activity_type_id, profiles(full_name), machines(id, name, tag), activity_types(id, code, description, allow_custom)';

  const loadActivities = useCallback(async (term = '') => {
    let query = supabase
      .from('activities')
      .select(ACTIVITY_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (term) query = query.or(`description.ilike.%${term}%,location.ilike.%${term}%,equipment_tag.ilike.%${term}%`);
    const { data } = await query;
    const rows = (data as ActivityRow[] | null) ?? [];
    setActivities(rows);
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
    return rows;
  }, [supabase]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const lastItem = activities[activities.length - 1];
    if (!lastItem) { setLoadingMore(false); return; }
    let query = supabase
      .from('activities')
      .select(ACTIVITY_COLUMNS)
      .order('created_at', { ascending: false })
      .lt('created_at', lastItem.created_at)
      .limit(PAGE_SIZE);
    if (debouncedSearch) query = query.or(`description.ilike.%${debouncedSearch}%,location.ilike.%${debouncedSearch}%,equipment_tag.ilike.%${debouncedSearch}%`);
    const { data } = await query;
    const rows = (data as ActivityRow[] | null) ?? [];
    setActivities((prev) => [...prev, ...rows]);
    setHasMore(rows.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  useEffect(() => {
    loadActivities(debouncedSearch).then((data) => {
      if (deepLinkId && !deepLinked && data.length > 0) {
        const match = data.find((a) => a.id === deepLinkId);
        if (match) {
          setDeepLinked(true);
          openDetail(match);
        }
      }
    });
  }, [loadActivities, deepLinkId, debouncedSearch]);

  useEffect(() => {
    supabase
      .from('machines')
      .select('id, name, tag')
      .eq('active', true)
      .order('name', { ascending: true })
      .then(({ data }) => setMachines(data ?? []));
    supabase
      .from('activity_types')
      .select('id, code, description, category')
      .eq('active', true)
      .order('category', { ascending: true })
      .order('order_index', { ascending: true })
      .then(({ data }) => setActivityTypes(data ?? []));
  }, [supabase]);

  // Realtime: only full reload on INSERT (new data needs join), patch on UPDATE/DELETE
  useEffect(() => {
    const channel = supabase
      .channel('web-activities')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, () => loadActivities())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'activities' }, (payload) => {
        const updated = payload.new as ActivityRow;
        setActivities((prev) => prev.map((a) => a.id === updated.id ? { ...a, ...updated } : a));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'activities' }, (payload) => {
        const oldId = (payload.old as { id?: string })?.id;
        if (oldId) setActivities((prev) => prev.filter((a) => a.id !== oldId));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, loadActivities]);

  function getStatusKey(a: ActivityRow): keyof typeof STATUS_CONFIG {
    return a.end_time ? 'completed' : 'in_progress';
  }

  async function openDetail(activity: ActivityRow) {
    setSelected(activity);
    setResolvedPhotos({});
    const allPaths = [
      { key: 'equipment', path: activity.equipment_photo_url },
      { key: 'start', path: activity.start_photo_url },
      { key: 'end', path: activity.end_photo_url },
    ];
    const urlMap: Record<string, string> = {};
    await Promise.all(
      allPaths.map(async ({ key, path }) => {
        const url = await resolveSignedUrl(supabase, 'activity-photos', path);
        if (url) urlMap[key] = url;
      }),
    );
    setResolvedPhotos(urlMap);
  }

  const operators = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of activities) {
      if (a.operator_id && a.profiles?.full_name) {
        map.set(a.operator_id, a.profiles.full_name);
      }
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [activities]);

  const filtered = useMemo(() => activities.filter((a) => {
    const matchStatus = !filterStatus || getStatusKey(a) === filterStatus;
    const matchOperator = !filterOperator || a.operator_id === filterOperator;
    const matchMachine = !filterMachine || a.machine_id === filterMachine;
    const matchType = !filterActivityType || a.activity_type_id === filterActivityType;
    return matchStatus && matchOperator && matchMachine && matchType;
  }), [activities, filterStatus, filterOperator, filterMachine, filterActivityType]);

  const stats = useMemo(() => ({
    total: activities.length,
    in_progress: activities.filter((a) => !a.end_time).length,
    completed: activities.filter((a) => !!a.end_time).length,
    interference: activities.filter((a) => a.had_interference).length,
  }), [activities]);

  // -- Detail view --
  if (selected) {
    const sk = getStatusKey(selected);
    const cfg = STATUS_CONFIG[sk];
    const Icon = cfg.icon;
    const photos = [
      { label: 'Equipamento', url: resolvedPhotos['equipment'] },
      { label: 'Início', url: resolvedPhotos['start'] },
      { label: 'Fim', url: resolvedPhotos['end'] },
    ].filter((p) => p.url);

    return (
      <div className="space-y-6">
        <button
          onClick={() => { setSelected(null); setResolvedPhotos({}); }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar para lista
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {selected.description || 'Atividade'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {selected.profiles?.full_name || 'Operador'}{selected.equipment_tag ? ` · TAG: ${selected.equipment_tag}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportActivityPDF(selected)}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Exportar PDF"
            >
              <FileDown className="h-3.5 w-3.5" />
              PDF
            </button>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${cfg.bg} ${cfg.color}`}>
              <Icon className="h-4 w-4" />
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <User className="h-3.5 w-3.5" />
                Operador
              </div>
              <p className="font-semibold">{selected.profiles?.full_name || '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calendar className="h-3.5 w-3.5" />
                Data
              </div>
              <p className="font-semibold">{formatDate(selected.date)}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(selected.created_at)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-3.5 w-3.5" />
                Horários
              </div>
              <p className="font-semibold text-sm">
                {formatTime(selected.start_time)} — {formatTime(selected.end_time)}
              </p>
              {selected.start_time && (
                <p className="text-xs text-muted-foreground">
                  Duração: {getDuration(selected.start_time, selected.end_time)}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <MapPin className="h-3.5 w-3.5" />
                Local
              </div>
              <p className="font-semibold text-sm">{selected.location || '—'}</p>
              {selected.equipment_tag && (
                <p className="text-xs text-muted-foreground">TAG: {selected.equipment_tag}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {selected.machines?.name && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <HardHat className="h-3.5 w-3.5" />
                Máquina
              </div>
              <p className="font-semibold text-sm">{selected.machines.name}</p>
              {selected.machines.tag && (
                <p className="text-xs text-muted-foreground">TAG: {selected.machines.tag}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Transit info */}
        {(selected.transit_start || selected.transit_end) && (
          <div className="rounded-md border bg-muted/50 p-3 text-sm">
            <p className="font-medium mb-1">Trânsito</p>
            <p className="text-muted-foreground">
              Saída: {formatTime(selected.transit_start)} · Chegada: {formatTime(selected.transit_end)}
              {selected.transit_start && selected.transit_end && (
                <span> · Duração: {getDuration(selected.transit_start, selected.transit_end)}</span>
              )}
            </p>
          </div>
        )}

        {/* Interference */}
        {selected.had_interference && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50/50 p-3 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <p className="font-medium text-yellow-700">Interferência Registrada</p>
            </div>
            {selected.interference_notes && (
              <p className="text-yellow-600 whitespace-pre-wrap ml-6">{selected.interference_notes}</p>
            )}
          </div>
        )}

        {/* Notes */}
        {selected.notes && (
          <div className="rounded-md border bg-muted/50 p-3 text-sm">
            <p className="font-medium mb-1">Observações:</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{selected.notes}</p>
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Fotos Anexadas ({photos.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setPhotoModal(p.url!)}
                  className="group relative aspect-square rounded-lg border overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                >
                  <Image src={p.url!} alt={p.label} fill className="object-cover" sizes="(min-width: 640px) 33vw, 50vw" />
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1">
                    <p className="text-xs text-white font-medium truncate">{p.label}</p>
                  </div>
                </button>
              ))}
            </div>
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
              <img src={photoModal} alt="Foto da atividade" className="max-h-[85vh] rounded-lg object-contain" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // -- List view --
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Atividades dos Operadores</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe as atividades registradas pelos operadores
          </p>
        </div>
        {filtered.length > 0 && (
          <button
            onClick={() => exportActivityListPDF(filtered)}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            <FileDown className="h-3.5 w-3.5" />
            Exportar PDF
          </button>
        )}
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
            <p className="text-2xl font-bold text-yellow-600">{stats.in_progress}</p>
            <p className="text-xs text-muted-foreground">Em Andamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
            <p className="text-xs text-muted-foreground">Concluídas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.interference}</p>
            <p className="text-xs text-muted-foreground">Com Interferência</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, local, TAG..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterOperator}
          onChange={(e) => setFilterOperator(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos os operadores</option>
          {operators.map((op) => (
            <option key={op.id} value={op.id}>{op.name}</option>
          ))}
        </select>
        <select
          value={filterMachine}
          onChange={(e) => setFilterMachine(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todas as máquinas</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}{m.tag ? ` · ${m.tag}` : ''}
            </option>
          ))}
        </select>
        <select
          value={filterActivityType}
          onChange={(e) => setFilterActivityType(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos os tipos</option>
          {activityTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.code} — {t.description}
            </option>
          ))}
        </select>
        <div className="flex gap-2 flex-wrap">
          {(['', 'in_progress', 'completed'] as const).map((val) => {
            const labels: Record<string, string> = { '': 'Todas', in_progress: 'Em Andamento', completed: 'Concluídas' };
            return (
              <button
                key={val}
                onClick={() => setFilterStatus(val)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                  filterStatus === val
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
            <Activity className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {activities.length === 0 ? 'Nenhuma atividade registrada ainda.' : 'Nenhuma atividade encontrada com esses filtros.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((activity) => {
            const sk = getStatusKey(activity);
            const cfg = STATUS_CONFIG[sk];
            const Icon = cfg.icon;

            return (
              <Card
                key={activity.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openDetail(activity)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate flex items-center gap-2">
                            {activity.activity_types?.code && (
                              <span className="inline-flex shrink-0 items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary">
                                {activity.activity_types.code}
                              </span>
                            )}
                            <span className="truncate">{activity.description || 'Atividade'}</span>
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {activity.profiles?.full_name || 'Operador'}
                            </span>
                            <span>{formatDate(activity.date)}</span>
                            <span className="text-xs">
                              {formatTime(activity.start_time)} — {formatTime(activity.end_time)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                            {activity.machines?.name && (
                              <span className="inline-flex items-center gap-1">
                                <HardHat className="h-3 w-3" />
                                {activity.machines.name}
                              </span>
                            )}
                            {activity.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {activity.location}
                              </span>
                            )}
                            {activity.equipment_tag && (
                              <span className="inline-flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                {activity.equipment_tag}
                              </span>
                            )}
                            {activity.had_interference && (
                              <span className="inline-flex items-center gap-1 text-yellow-600">
                                <AlertTriangle className="h-3 w-3" />
                                Interferência
                              </span>
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
              onClick={loadMore}
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
