'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
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
} from 'lucide-react';

interface ActivityRow {
  id: string;
  date: string;
  location: string | null;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  equipment_tag: string | null;
  had_interference: boolean;
  interference_notes: string | null;
  notes: string | null;
  transit_start: string | null;
  transit_end: string | null;
  equipment_photo_url: string | null;
  start_photo_url: string | null;
  end_photo_url: string | null;
  created_at: string;
  operator_id: string;
  checklist_id: string | null;
  operators: { name: string } | null;
}

const STATUS_CONFIG = {
  in_progress: { label: 'Em Andamento', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500', icon: Clock },
  completed: { label: 'Concluída', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', icon: CheckCircle2 },
} as const;

export default function AtividadesPage() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get('id');

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterOperator, setFilterOperator] = useState<string>('');

  // Detail view
  const [selected, setSelected] = useState<ActivityRow | null>(null);
  const [photoModal, setPhotoModal] = useState<string | null>(null);
  const [resolvedPhotos, setResolvedPhotos] = useState<Record<string, string>>({});
  const [deepLinked, setDeepLinked] = useState(false);

  const loadActivities = useCallback(async () => {
    const { data } = await supabase
      .from('activities')
      .select('id, date, location, description, start_time, end_time, equipment_tag, had_interference, interference_notes, notes, transit_start, transit_end, equipment_photo_url, start_photo_url, end_photo_url, created_at, operator_id, checklist_id, operators(name)')
      .order('created_at', { ascending: false })
      .limit(200);
    setActivities((data as ActivityRow[] | null) ?? []);
    setLoading(false);
    return (data as ActivityRow[] | null) ?? [];
  }, [supabase]);

  useEffect(() => {
    loadActivities().then((data) => {
      if (deepLinkId && !deepLinked && data.length > 0) {
        const match = data.find((a) => a.id === deepLinkId);
        if (match) {
          setDeepLinked(true);
          openDetail(match);
        }
      }
    });
  }, [loadActivities, deepLinkId]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('web-activities')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, () => loadActivities())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, loadActivities]);

  function getStatusKey(a: ActivityRow): keyof typeof STATUS_CONFIG {
    return a.end_time ? 'completed' : 'in_progress';
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function formatTime(iso: string | null) {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function getDuration(start: string | null, end: string | null) {
    if (!start) return null;
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const diffMin = Math.round((e - s) / 60000);
    if (diffMin < 60) return `${diffMin}min`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  }

  async function resolveSignedUrl(bucket: string, path: string | null): Promise<string | null> {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
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
        const url = await resolveSignedUrl('activity-photos', path);
        if (url) urlMap[key] = url;
      }),
    );
    setResolvedPhotos(urlMap);
  }

  const operators = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of activities) {
      if (a.operator_id && a.operators?.name) {
        map.set(a.operator_id, a.operators.name);
      }
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [activities]);

  const filtered = activities.filter((a) => {
    const matchSearch = !search || [
      a.description,
      a.operators?.name,
      a.equipment_tag,
      a.location,
    ].some((v) => v?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !filterStatus || getStatusKey(a) === filterStatus;
    const matchOperator = !filterOperator || a.operator_id === filterOperator;
    return matchSearch && matchStatus && matchOperator;
  });

  const stats = {
    total: activities.length,
    in_progress: activities.filter((a) => !a.end_time).length,
    completed: activities.filter((a) => !!a.end_time).length,
    interference: activities.filter((a) => a.had_interference).length,
  };

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
              {selected.operators?.name || 'Operador'}{selected.equipment_tag ? ` · TAG: ${selected.equipment_tag}` : ''}
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
                  <img src={p.url!} alt={p.label} className="h-full w-full object-cover" />
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
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Atividades dos Operadores</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe as atividades registradas pelos operadores
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
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
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
                          <p className="font-medium truncate">
                            {activity.description || 'Atividade'}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {activity.operators?.name || 'Operador'}
                            </span>
                            <span>{formatDate(activity.date)}</span>
                            <span className="text-xs">
                              {formatTime(activity.start_time)} — {formatTime(activity.end_time)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
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
        </div>
      )}
    </div>
  );
}
