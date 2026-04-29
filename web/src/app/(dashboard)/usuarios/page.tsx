'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDuration, formatTime } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Users,
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
import { UserFormModal } from './user-form';
import { EditUserModal } from './edit-user-modal';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  active: boolean;
  created_at: string;
  role: string;
  created_by: string | null;
}

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
type RoleFilter = 'all' | 'admin' | 'manager' | 'supervisor' | 'encarregado' | 'operator';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Gestor',
  supervisor: 'Supervisor',
  encarregado: 'Encarregado',
  operator: 'Operador',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  manager: 'bg-blue-100 text-blue-700 border-blue-200',
  supervisor: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  encarregado: 'bg-amber-100 text-amber-700 border-amber-200',
  operator: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export default function UsuariosPage() {
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  // Detail view state
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [period, setPeriod] = useState<Period>('7');
  const [detailLoading, setDetailLoading] = useState(false);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [checklists, setChecklists] = useState<ChecklistEvent[]>([]);

  // Edit modal
  const [editing, setEditing] = useState<UserProfile | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadUsers = useCallback(async (term = '') => {
    let query = supabase
      .from('profiles')
      .select('id, full_name, email, phone, active, created_at, role, created_by')
      .in('role', ['admin', 'manager', 'supervisor', 'encarregado', 'operator'])
      .order('created_at', { ascending: false });
    if (term) {
      query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
    }
    const { data } = await query;
    setUsers((data as UserProfile[] | null) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadUsers(debouncedSearch);
  }, [loadUsers, debouncedSearch]);

  const loadOperatorDetail = useCallback(async (userId: string, p: Period) => {
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
      .eq('operator_id', userId)
      .order('created_at', { ascending: true });
    if (fromIso) actQuery = actQuery.gte('created_at', fromIso);

    let chkQuery = supabase
      .from('checklists')
      .select('id, date, machine_name, status, result, created_at')
      .eq('operator_id', userId)
      .order('created_at', { ascending: true });
    if (fromIso) chkQuery = chkQuery.gte('created_at', fromIso);

    const [{ data: actData }, { data: chkData }] = await Promise.all([actQuery, chkQuery]);
    setActivities((actData as ActivityEvent[] | null) ?? []);
    setChecklists((chkData as ChecklistEvent[] | null) ?? []);
    setDetailLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (selected && selected.role === 'operator') loadOperatorDetail(selected.id, period);
  }, [selected, period, loadOperatorDetail]);

  function openDetail(u: UserProfile) {
    setSelected(u);
    setActivities([]);
    setChecklists([]);
  }

  function openEdit(u: UserProfile) {
    setEditing(u);
  }

  async function handleToggleActive(u: UserProfile) {
    await supabase.from('profiles').update({ active: !u.active }).eq('id', u.id);
    await loadUsers();
    if (selected?.id === u.id) setSelected({ ...u, active: !u.active });
  }

  function formatDateTimeShort(input: string | number) {
    return new Date(input).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  const filtered = useMemo(() => {
    if (roleFilter === 'all') return users;
    return users.filter((u) => u.role === roleFilter);
  }, [users, roleFilter]);

  const counts = useMemo(() => {
    const c = { total: users.length, active: 0, admin: 0, manager: 0, supervisor: 0, encarregado: 0, operator: 0 };
    for (const u of users) {
      if (u.active) c.active++;
      if (u.role === 'admin') c.admin++;
      else if (u.role === 'manager') c.manager++;
      else if (u.role === 'supervisor') c.supervisor++;
      else if (u.role === 'encarregado') c.encarregado++;
      else if (u.role === 'operator') c.operator++;
    }
    return c;
  }, [users]);

  // ─── Detail view (operators get timeline, others get simple view) ───
  if (selected) {
    const displayName = selected.full_name || 'Sem nome';
    const isOperator = selected.role === 'operator';

    const events: TimelineEvent[] = isOperator
      ? [
          ...activities.map<TimelineEvent>((a) => {
            const startTs = a.start_time ? new Date(a.start_time).getTime() : new Date(a.created_at).getTime();
            const endTs = a.end_time ? new Date(a.end_time).getTime() : startTs;
            return { kind: 'activity', ts: startTs, endTs, ref: a };
          }),
          ...checklists.map<TimelineEvent>((c) => {
            const ts = new Date(c.created_at).getTime();
            return { kind: 'checklist', ts, endTs: ts, ref: c };
          }),
        ].sort((a, b) => a.ts - b.ts)
      : [];

    const completedActivities = activities.filter((a) => !!a.end_time);
    const totalWorkedMs = completedActivities.reduce((sum, a) => {
      const s = a.start_time ? new Date(a.start_time).getTime() : 0;
      const e = a.end_time ? new Date(a.end_time).getTime() : 0;
      return s && e && e > s ? sum + (e - s) : sum;
    }, 0);
    const avgDurationMs = completedActivities.length > 0 ? totalWorkedMs / completedActivities.length : 0;
    const interferenceCount = activities.filter((a) => a.had_interference).length;

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

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white ${
                selected.active ? 'bg-emerald-500' : 'bg-gray-400'
              }`}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{displayName}</h1>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[selected.role] || ROLE_COLORS.pending}`}>
                  {ROLE_LABELS[selected.role] || selected.role}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Cargo: {ROLE_LABELS[selected.role] || selected.role}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openEdit(selected)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <button
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                selected.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}
              onClick={() => handleToggleActive(selected)}
            >
              {selected.active ? 'Ativo' : 'Inativo'}
            </button>
          </div>
        </div>

        {/* Contact info */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {selected.email && (
            <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{selected.email}</span>
          )}
          {selected.phone && (
            <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{selected.phone}</span>
          )}
        </div>

        {/* Operator timeline section */}
        {isOperator && (
          <>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground mr-2">Periodo:</span>
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <ActivityIcon className="h-3.5 w-3.5" />
                        Atividades
                      </div>
                      <p className="text-2xl font-bold">{activities.length}</p>
                      <p className="text-xs text-muted-foreground">{completedActivities.length} concluidas</p>
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
                      <p className="text-xs text-muted-foreground">media {formatDuration(avgDurationMs)}/ativ.</p>
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
                      {interferenceCount} {interferenceCount === 1 ? 'atividade registrou' : 'atividades registraram'} interferencia no periodo.
                    </span>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Linha do tempo
                  </h3>
                  {events.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">Nenhuma atividade ou checklist no periodo selecionado.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {events.map((ev, idx) => {
                        const prev = idx > 0 ? events[idx - 1] : null;
                        const gap = prev ? ev.ts - prev.endTs : 0;
                        return (
                          <div key={`${ev.kind}-${ev.ref.id}`}>
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
                                              duracao {formatDuration(ev.endTs - ev.ts)}
                                            </span>
                                          )}
                                          {ev.kind === 'activity' && ev.ref.location && (
                                            <span>· {ev.ref.location}</span>
                                          )}
                                          {ev.kind === 'activity' && ev.ref.had_interference && (
                                            <span className="text-yellow-600 inline-flex items-center gap-1">
                                              <AlertTriangle className="h-3 w-3" />
                                              interferencia
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
          </>
        )}

        {/* Non-operator: simple info card */}
        {!isOperator && (
          <Card>
            <CardContent className="p-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Cadastrado em {new Date(selected.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </CardContent>
          </Card>
        )}

        {editing && (
          <EditUserModal
            user={editing}
            onClose={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null);
              await loadUsers();
              if (selected?.id === editing.id) {
                const { data } = await supabase
                  .from('profiles')
                  .select('id, full_name, email, phone, active, created_at, role, created_by')
                  .eq('id', editing.id)
                  .single();
                if (data) setSelected(data as UserProfile);
              }
            }}
          />
        )}
      </div>
    );
  }

  // ─── List view ───
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Usuarios</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {counts.total} usuarios · {counts.active} ativos · {counts.operator} operadores · {counts.encarregado} encarregados · {counts.supervisor} supervisores · {counts.manager} gestores · {counts.admin} admins
          </p>
        </div>
        <UserFormModal onSaved={() => loadUsers()} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          {([
            { v: 'all' as RoleFilter, label: 'Todos' },
            { v: 'operator' as RoleFilter, label: 'Operadores' },
            { v: 'encarregado' as RoleFilter, label: 'Encarregados' },
            { v: 'supervisor' as RoleFilter, label: 'Supervisores' },
            { v: 'manager' as RoleFilter, label: 'Gestores' },
            { v: 'admin' as RoleFilter, label: 'Admins' },
          ]).map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setRoleFilter(v)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                roleFilter === v
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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
              {search || roleFilter !== 'all' ? 'Nenhum usuario encontrado.' : 'Nenhum usuario cadastrado.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((u) => {
            const displayName = u.full_name || 'Sem nome';
            return (
              <Card
                key={u.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openDetail(u)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                      u.active ? 'bg-emerald-500' : 'bg-gray-400'
                    }`}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{displayName}</p>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[u.role] || ROLE_COLORS.pending}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">Cargo: {ROLE_LABELS[u.role] || u.role}</p>
                  </div>

                  <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
                    {u.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {u.email}
                      </span>
                    )}
                    {u.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {u.phone}
                      </span>
                    )}
                  </div>

                  <button
                    className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(u);
                    }}
                    title="Editar usuario"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  <button
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      u.active
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleActive(u);
                    }}
                  >
                    {u.active ? 'Ativo' : 'Inativo'}
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await loadUsers(); }}
        />
      )}
    </div>
  );
}
