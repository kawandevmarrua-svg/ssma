'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDuration, formatTime } from '@/lib/formatters';
import type { Operator } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Loader2,
  ChevronLeft,
  Pencil,
  Activity as ActivityIcon,
  ClipboardCheck,
  Clock,
  TrendingUp,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { OperatorFormModal } from './operator-form-modal';

interface ActivityEvent {
  id: string;
  date: string;
  description: string | null;
  location: string | null;
  equipment_tag: string | null;
  start_time: string | null;
  end_time: string | null;
  had_interference: boolean;
  created_at: string;
}

interface ChecklistEvent {
  id: string;
  date: string;
  machine_name: string;
  status: string;
  result: string | null;
  created_at: string;
}

type TimelineEvent =
  | { kind: 'activity'; ts: number; endTs: number; ref: ActivityEvent }
  | { kind: 'checklist'; ts: number; endTs: number; ref: ChecklistEvent };

type Period = '1' | '7' | '30' | 'all';

export default function OperadoresPage() {
  const supabase = useMemo(() => createClient(), []);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Detail view state
  const [selected, setSelected] = useState<Operator | null>(null);
  const [period, setPeriod] = useState<Period>('7');
  const [detailLoading, setDetailLoading] = useState(false);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [checklists, setChecklists] = useState<ChecklistEvent[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Operator | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadOperators = useCallback(async (term = '') => {
    let query = supabase
      .from('operators')
      .select('id, name, email, phone, role, active, created_at, auth_user_id')
      .order('created_at', { ascending: false });
    if (term) {
      query = query.or(`name.ilike.%${term}%,role.ilike.%${term}%,email.ilike.%${term}%`);
    }
    const { data } = await query;
    setOperators(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadOperators(debouncedSearch);
  }, [loadOperators, debouncedSearch]);

  const loadOperatorDetail = useCallback(async (operatorId: string, p: Period) => {
    setDetailLoading(true);

    let fromIso: string | null = null;
    if (p !== 'all') {
      const days = parseInt(p, 10);
      const d = new Date();
      d.setDate(d.getDate() - (days - 1));
      d.setHours(0, 0, 0, 0);
      fromIso = d.toISOString();
    }

    let actQuery = supabase
      .from('activities')
      .select('id, date, description, location, equipment_tag, start_time, end_time, had_interference, created_at')
      .eq('operator_id', operatorId)
      .order('created_at', { ascending: true });
    if (fromIso) actQuery = actQuery.gte('created_at', fromIso);

    let chkQuery = supabase
      .from('checklists')
      .select('id, date, machine_name, status, result, created_at')
      .eq('operator_id', operatorId)
      .order('created_at', { ascending: true });
    if (fromIso) chkQuery = chkQuery.gte('created_at', fromIso);

    const [{ data: actData }, { data: chkData }] = await Promise.all([actQuery, chkQuery]);
    setActivities((actData as ActivityEvent[] | null) ?? []);
    setChecklists((chkData as ChecklistEvent[] | null) ?? []);
    setDetailLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (selected) loadOperatorDetail(selected.id, period);
  }, [selected, period, loadOperatorDetail]);

  function openDetail(op: Operator) {
    setSelected(op);
    setActivities([]);
    setChecklists([]);
  }

  function openCreate() {
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(op: Operator) {
    setEditing(op);
    setShowModal(true);
  }

  async function handleToggleActive(op: Operator) {
    await supabase
      .from('operators')
      .update({ active: !op.active })
      .eq('id', op.id);
    await loadOperators();
  }

  function formatDateTimeShort(input: string | number) {
    return new Date(input).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  const filtered = operators;

  const activeCount = useMemo(() => operators.filter((o) => o.active).length, [operators]);

  // ─── Detail view (productivity dashboard for one operator) ───
  if (selected) {
    const events: TimelineEvent[] = [
      ...activities.map<TimelineEvent>((a) => {
        const startTs = a.start_time ? new Date(a.start_time).getTime() : new Date(a.created_at).getTime();
        const endTs = a.end_time ? new Date(a.end_time).getTime() : startTs;
        return { kind: 'activity', ts: startTs, endTs, ref: a };
      }),
      ...checklists.map<TimelineEvent>((c) => {
        const ts = new Date(c.created_at).getTime();
        return { kind: 'checklist', ts, endTs: ts, ref: c };
      }),
    ].sort((a, b) => a.ts - b.ts);

    // KPIs
    const completedActivities = activities.filter((a) => !!a.end_time);
    const totalWorkedMs = completedActivities.reduce((sum, a) => {
      const s = a.start_time ? new Date(a.start_time).getTime() : 0;
      const e = a.end_time ? new Date(a.end_time).getTime() : 0;
      return s && e && e > s ? sum + (e - s) : sum;
    }, 0);
    const avgDurationMs = completedActivities.length > 0 ? totalWorkedMs / completedActivities.length : 0;
    const interferenceCount = activities.filter((a) => a.had_interference).length;

    // Compute idle gaps between consecutive events
    let totalIdleMs = 0;
    let longestGapMs = 0;
    for (let i = 1; i < events.length; i++) {
      const prevEnd = events[i - 1].endTs;
      const currStart = events[i].ts;
      const gap = currStart - prevEnd;
      if (gap > 0) {
        totalIdleMs += gap;
        if (gap > longestGapMs) longestGapMs = gap;
      }
    }

    return (
      <div className="space-y-6">
        <button
          onClick={() => { setSelected(null); setActivities([]); setChecklists([]); }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar para lista
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white ${
                selected.active ? 'bg-emerald-500' : 'bg-gray-400'
              }`}
            >
              {selected.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{selected.name}</h1>
              <p className="text-sm text-muted-foreground">{selected.role}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => openEdit(selected)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
        </div>

        {/* Period filter */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground mr-2">Período:</span>
          {([
            { v: '1' as Period, label: 'Hoje' },
            { v: '7' as Period, label: '7 dias' },
            { v: '30' as Period, label: '30 dias' },
            { v: 'all' as Period, label: 'Tudo' },
          ]).map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setPeriod(v)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                period === v
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {detailLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <ActivityIcon className="h-3.5 w-3.5" />
                    Atividades
                  </div>
                  <p className="text-2xl font-bold">{activities.length}</p>
                  <p className="text-xs text-muted-foreground">{completedActivities.length} concluídas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Checklists
                  </div>
                  <p className="text-2xl font-bold">{checklists.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Tempo trabalhado
                  </div>
                  <p className="text-2xl font-bold">{formatDuration(totalWorkedMs)}</p>
                  <p className="text-xs text-muted-foreground">média {formatDuration(avgDurationMs)}/ativ.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Clock className="h-3.5 w-3.5" />
                    Tempo ocioso
                  </div>
                  <p className="text-2xl font-bold">{formatDuration(totalIdleMs)}</p>
                  <p className="text-xs text-muted-foreground">maior gap {formatDuration(longestGapMs)}</p>
                </CardContent>
              </Card>
            </div>

            {interferenceCount > 0 && (
              <div className="rounded-md border border-yellow-300 bg-yellow-50/50 p-3 text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-yellow-700">
                  {interferenceCount} {interferenceCount === 1 ? 'atividade registrou' : 'atividades registraram'} interferência no período.
                </span>
              </div>
            )}

            {/* Timeline */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Linha do tempo
              </h3>
              {events.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Nenhuma atividade ou checklist no período selecionado.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {events.map((ev, idx) => {
                    const prev = idx > 0 ? events[idx - 1] : null;
                    const gap = prev ? ev.ts - prev.endTs : 0;
                    return (
                      <div key={`${ev.kind}-${ev.kind === 'activity' ? ev.ref.id : ev.ref.id}`}>
                        {prev && gap > 0 && (
                          <div className="flex items-center gap-2 py-1 pl-4 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span className={gap > 30 * 60 * 1000 ? 'text-orange-600 font-medium' : ''}>
                              {formatDuration(gap)} entre eventos
                            </span>
                          </div>
                        )}
                        <Card>
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                                ev.kind === 'activity' ? 'bg-emerald-500' : 'bg-blue-500'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">
                                      {ev.kind === 'activity'
                                        ? (ev.ref.description || 'Atividade')
                                        : `Checklist · ${ev.ref.machine_name}`}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                                      <span>{formatDateTimeShort(ev.ts)}</span>
                                      {ev.kind === 'activity' && ev.ref.end_time && (
                                        <span>→ {formatTime(ev.ref.end_time)}</span>
                                      )}
                                      {ev.kind === 'activity' && ev.endTs > ev.ts && (
                                        <span className="font-medium">
                                          duração {formatDuration(ev.endTs - ev.ts)}
                                        </span>
                                      )}
                                      {ev.kind === 'activity' && ev.ref.location && (
                                        <span>· {ev.ref.location}</span>
                                      )}
                                      {ev.kind === 'activity' && ev.ref.had_interference && (
                                        <span className="text-yellow-600 inline-flex items-center gap-1">
                                          <AlertTriangle className="h-3 w-3" />
                                          interferência
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                                    ev.kind === 'activity'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}>
                                    {ev.kind === 'activity' ? <ActivityIcon className="h-3 w-3" /> : <ClipboardCheck className="h-3 w-3" />}
                                    {ev.kind === 'activity' ? 'Atividade' : 'Checklist'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {showModal && (
          <OperatorFormModal
            editing={editing}
            supabase={supabase}
            onClose={() => setShowModal(false)}
            onSaved={async () => { setShowModal(false); await loadOperators(); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Operadores</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {operators.length} operadores cadastrados, {activeCount} ativos
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Novo Operador</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, funcao ou email..."
          className="pl-10"
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
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {search ? 'Nenhum operador encontrado.' : 'Nenhum operador cadastrado.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((op) => (
            <Card
              key={op.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openDetail(op)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                    op.active ? 'bg-emerald-500' : 'bg-gray-400'
                  }`}
                >
                  {op.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{op.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{op.role}</p>
                </div>

                <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
                  {op.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {op.email}
                    </span>
                  )}
                  {op.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {op.phone}
                    </span>
                  )}
                </div>

                <button
                  className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(op);
                  }}
                  title="Editar operador"
                >
                  <Pencil className="h-4 w-4" />
                </button>

                <button
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    op.active
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleActive(op);
                  }}
                >
                  {op.active ? 'Ativo' : 'Inativo'}
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <OperatorFormModal
          editing={editing}
          supabase={supabase}
          onClose={() => setShowModal(false)}
          onSaved={async () => { setShowModal(false); await loadOperators(); }}
        />
      )}
    </div>
  );
}
