'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDuration, formatTime } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
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
  ShieldCheck,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
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
  ended_at: string | null;
}

interface InspectionEvent {
  id: string;
  date: string;
  status: string | null;
  overall_classification: string | null;
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
  admin: 'bg-orange-100 text-orange-800 border-orange-200',
  manager: 'bg-orange-50 text-orange-700 border-orange-200',
  supervisor: 'bg-gray-100 text-gray-700 border-gray-200',
  encarregado: 'bg-gray-100 text-gray-700 border-gray-200',
  operator: 'bg-gray-50 text-gray-600 border-gray-200',
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
  const [inspections, setInspections] = useState<InspectionEvent[]>([]);

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
      .select('id, date, machine_name, status, result, created_at, ended_at')
      .eq('operator_id', userId)
      .order('created_at', { ascending: true });
    if (fromIso) chkQuery = chkQuery.gte('created_at', fromIso);

    let insQuery = supabase
      .from('behavioral_inspections')
      .select('id, date, status, overall_classification, created_at')
      .eq('operator_id', userId)
      .order('created_at', { ascending: true });
    if (fromIso) insQuery = insQuery.gte('created_at', fromIso);

    const [{ data: actData }, { data: chkData }, { data: insData }] = await Promise.all([actQuery, chkQuery, insQuery]);
    setActivities((actData as ActivityEvent[] | null) ?? []);
    setChecklists((chkData as ChecklistEvent[] | null) ?? []);
    setInspections((insData as InspectionEvent[] | null) ?? []);
    setDetailLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (selected && selected.role === 'operator') loadOperatorDetail(selected.id, period);
  }, [selected, period, loadOperatorDetail]);

  function openDetail(u: UserProfile) {
    setSelected(u);
    setActivities([]);
    setChecklists([]);
    setInspections([]);
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setSelected(null); setActivities([]); setChecklists([]); setInspections([]); }}
          className="-ml-2 gap-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar para lista
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold border ${
                selected.active
                  ? 'bg-gradient-to-br from-primary/20 to-primary/5 text-primary border-primary/20'
                  : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{displayName}</h1>
                <Badge variant="plain" className={cn('border font-medium', ROLE_COLORS[selected.role] || ROLE_COLORS.pending)}>
                  {ROLE_LABELS[selected.role] || selected.role}
                </Badge>
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
              type="button"
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
                selected.active
                  ? 'border-orange-200 bg-orange-50 text-orange-700'
                  : 'border-gray-200 bg-gray-50 text-gray-600',
              )}
              onClick={() => handleToggleActive(selected)}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${selected.active ? 'bg-orange-500' : 'bg-gray-400'}`} />
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
                  type="button"
                  key={v}
                  onClick={() => setPeriod(v)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                    period === v
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted',
                  )}
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
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
                      {(() => {
                        const rel = checklists.filter((c) => c.result === 'released').length;
                        const blk = checklists.filter((c) => c.result === 'not_released').length;
                        return (
                          <p className="text-xs text-muted-foreground">
                            <span className="text-emerald-600">{rel} lib.</span>
                            {blk > 0 && <span className="text-red-600 ml-1.5">{blk} bloq.</span>}
                          </p>
                        );
                      })()}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Inspeções
                      </div>
                      <p className="text-2xl font-bold">{inspections.length}</p>
                      <p className="text-xs text-muted-foreground">comportamentais</p>
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

                {/* Charts */}
                {(activities.length > 0 || checklists.length > 0 || inspections.length > 0) && (() => {
                  // Daily breakdown — when period = 'all', range = earliest record → today
                  let daysCount: number;
                  if (period === '1') daysCount = 1;
                  else if (period === 'all') {
                    const allDates = [
                      ...activities.map((a) => a.date),
                      ...checklists.map((c) => c.date),
                      ...inspections.map((i) => i.date),
                    ].filter(Boolean);
                    if (allDates.length === 0) daysCount = 1;
                    else {
                      const minDate = allDates.reduce((min, d) => (d < min ? d : min), allDates[0]);
                      const diffMs = Date.now() - new Date(minDate + 'T00:00:00').getTime();
                      daysCount = Math.max(1, Math.min(365, Math.ceil(diffMs / 86400000) + 1));
                    }
                  } else daysCount = parseInt(period, 10);

                  const daily: { label: string; activities: number; checklists: number; inspections: number }[] = [];
                  const now = new Date();
                  for (let i = daysCount - 1; i >= 0; i--) {
                    const d = new Date(now);
                    d.setDate(d.getDate() - i);
                    const ds = d.toISOString().split('T')[0];
                    const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    daily.push({
                      label,
                      activities: activities.filter((a) => a.date === ds).length,
                      checklists: checklists.filter((c) => c.date === ds).length,
                      inspections: inspections.filter((ins) => ins.date === ds).length,
                    });
                  }

                  const clReleased = checklists.filter((c) => c.result === 'released').length;
                  const clBlocked = checklists.filter((c) => c.result === 'not_released').length;
                  const clPending = checklists.length - clReleased - clBlocked;
                  const donutData = [
                    { name: 'Liberados', value: clReleased, fill: '#10b981' },
                    { name: 'Bloqueados', value: clBlocked, fill: '#dc2626' },
                    { name: 'Pendentes', value: clPending, fill: '#facc15' },
                  ].filter((d) => d.value > 0);

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      <Card className="lg:col-span-2">
                        <CardContent className="p-4">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Atividade diária</p>
                          <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={daily} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="u-grad-act" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.7} />
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                                </linearGradient>
                                <linearGradient id="u-grad-cl" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.7} />
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                                </linearGradient>
                                <linearGradient id="u-grad-ins" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.7} />
                                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} />
                              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }} />
                              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} iconType="circle" iconSize={8} />
                              <Area type="monotone" dataKey="activities" name="Atividades" stroke="#10b981" strokeWidth={2} fill="url(#u-grad-act)" />
                              <Area type="monotone" dataKey="checklists" name="Checklists" stroke="#3b82f6" strokeWidth={2} fill="url(#u-grad-cl)" />
                              <Area type="monotone" dataKey="inspections" name="Inspeções" stroke="#8b5cf6" strokeWidth={2} fill="url(#u-grad-ins)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {donutData.length > 0 && (
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Resultado dos Checklists</p>
                            <div className="flex items-center gap-4">
                              <div className="relative shrink-0" style={{ width: 130, height: 130 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <RePieChart>
                                    <Pie
                                      data={donutData}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={42}
                                      outerRadius={58}
                                      dataKey="value"
                                      strokeWidth={2}
                                      stroke="hsl(var(--background))"
                                      paddingAngle={2}
                                    >
                                      {donutData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }} />
                                  </RePieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                  <span className="text-xl font-bold leading-none">{checklists.length}</span>
                                  <span className="text-xs text-muted-foreground mt-0.5">total</span>
                                </div>
                              </div>
                              <div className="space-y-1.5 text-xs flex-1">
                                {clReleased > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                                    <span className="font-medium text-emerald-700">{clReleased} liberados</span>
                                  </div>
                                )}
                                {clBlocked > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-red-600" />
                                    <span className="font-medium text-red-700">{clBlocked} bloqueados</span>
                                  </div>
                                )}
                                {clPending > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-yellow-400" />
                                    <span className="font-medium text-yellow-700">{clPending} pendentes</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  );
                })()}

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
                  ) : (() => {
                    // Group: only RELEASED checklists open a group that collects subsequent activities.
                    // Blocked/pending checklists render as isolated cards (no activities attached).
                    // Activities before any released checklist (or after a blocked one) → orphan group.
                    type Group =
                      | { kind: 'released'; checklist: ChecklistEvent; activities: ActivityEvent[] }
                      | { kind: 'blocked'; checklist: ChecklistEvent }
                      | { kind: 'orphan'; activities: ActivityEvent[] };

                    const groups: Group[] = [];
                    let openReleased: Extract<Group, { kind: 'released' }> | null = null;
                    let orphan: Extract<Group, { kind: 'orphan' }> | null = null;

                    for (const ev of events) {
                      if (ev.kind === 'checklist') {
                        openReleased = null;
                        orphan = null;
                        if (ev.ref.result === 'released') {
                          openReleased = { kind: 'released', checklist: ev.ref, activities: [] };
                          groups.push(openReleased);
                        } else {
                          groups.push({ kind: 'blocked', checklist: ev.ref });
                        }
                      } else {
                        if (openReleased) {
                          openReleased.activities.push(ev.ref);
                        } else {
                          if (!orphan) {
                            orphan = { kind: 'orphan', activities: [] };
                            groups.push(orphan);
                          }
                          orphan.activities.push(ev.ref);
                        }
                      }
                    }

                    const resultStyle: Record<string, { label: string; cls: string; border: string; bg: string }> = {
                      released: { label: 'Liberado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', border: 'border-emerald-500', bg: 'bg-emerald-50/30' },
                      not_released: { label: 'Bloqueado', cls: 'bg-red-50 text-red-700 border-red-200', border: 'border-red-500', bg: 'bg-red-50/30' },
                      pending: { label: 'Pendente', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', border: 'border-yellow-500', bg: 'bg-yellow-50/30' },
                    };

                    function fillMs(cl: ChecklistEvent): number {
                      if (!cl.ended_at) return 0;
                      const d = new Date(cl.ended_at).getTime() - new Date(cl.created_at).getTime();
                      return d > 0 && d < 86400000 ? d : 0;
                    }

                    return (
                      <div className="space-y-3">
                        {groups.map((g, gIdx) => {
                          if (g.kind === 'orphan') {
                            return (
                              <Card key={`orphan-${gIdx}`} className="overflow-hidden">
                                <div className="border-l-4 border-muted-foreground/30 bg-muted/20 px-4 py-2">
                                  <p className="text-xs text-muted-foreground">
                                    Atividades sem checklist liberado precedente ({g.activities.length})
                                  </p>
                                </div>
                                <div className="divide-y">
                                  {g.activities.map((a) => renderActivity(a))}
                                </div>
                              </Card>
                            );
                          }

                          if (g.kind === 'blocked') {
                            const cl = g.checklist;
                            const meta = resultStyle[cl.result || 'not_released'];
                            const fill = fillMs(cl);
                            return (
                              <Card key={`cl-${cl.id}`} className="overflow-hidden">
                                <div className={`border-l-4 ${meta.border} ${meta.bg} p-4`}>
                                  <div className="flex items-start gap-3 min-w-0">
                                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${cl.result === 'pending' ? 'bg-yellow-500' : 'bg-red-500'}`}>
                                      <ClipboardCheck className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-sm">Checklist · {cl.machine_name}</p>
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                                        <span>{formatDateTimeShort(new Date(cl.created_at).getTime())}</span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${meta.cls}`}>
                                          {meta.label}
                                        </span>
                                        {fill > 0 && (
                                          <span>preenchimento {formatDuration(fill)}</span>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground italic mt-2">
                                        {cl.result === 'pending' ? 'Checklist pendente — máquina não liberada.' : 'Máquina não liberada — sem operação.'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            );
                          }

                          // released
                          const cl = g.checklist;
                          const meta = resultStyle.released;
                          const fill = fillMs(cl);
                          const operationMs = g.activities.reduce((s, a) => {
                            if (a.start_time && a.end_time) {
                              const d = new Date(a.end_time).getTime() - new Date(a.start_time).getTime();
                              if (d > 0 && d < 86400000) return s + d;
                            }
                            return s;
                          }, 0);
                          const interfInGroup = g.activities.filter((a) => a.had_interference).length;

                          return (
                            <Card key={`cl-${cl.id}`} className="overflow-hidden">
                              <div className={`border-l-4 ${meta.border} ${meta.bg} p-4`}>
                                <div className="flex items-start gap-3 min-w-0">
                                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                                    <ClipboardCheck className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-sm">Checklist · {cl.machine_name}</p>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                                      <span>{formatDateTimeShort(new Date(cl.created_at).getTime())}</span>
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${meta.cls}`}>
                                        {meta.label}
                                      </span>
                                      {fill > 0 && (
                                        <span>preenchimento {formatDuration(fill)}</span>
                                      )}
                                      <span>{g.activities.length} {g.activities.length === 1 ? 'atividade' : 'atividades'}</span>
                                      {operationMs > 0 && (
                                        <span>{formatDuration(operationMs)} de operação</span>
                                      )}
                                      {interfInGroup > 0 && (
                                        <span className="inline-flex items-center gap-1 text-yellow-700">
                                          <AlertTriangle className="h-3 w-3" />
                                          {interfInGroup} interferência{interfInGroup > 1 ? 's' : ''}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {g.activities.length > 0 ? (
                                <div className="divide-y">
                                  {g.activities.map((a) => renderActivity(a))}
                                </div>
                              ) : (
                                <div className="px-4 py-3 text-xs text-muted-foreground italic">
                                  Liberado, mas sem atividade registrada após o checklist.
                                </div>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    );

                    function renderActivity(a: ActivityEvent) {
                      const startTs = a.start_time ? new Date(a.start_time).getTime() : new Date(a.created_at).getTime();
                      const endTs = a.end_time ? new Date(a.end_time).getTime() : startTs;
                      const dur = endTs - startTs;
                      return (
                        <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <p className="font-medium text-sm truncate">
                                {a.description || 'Atividade'}
                              </p>
                              <Badge variant="success" className="shrink-0 font-medium">
                                <ActivityIcon className="h-3 w-3" />
                                Atividade
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                              <span>{formatDateTimeShort(startTs)}</span>
                              {a.end_time && <span>→ {formatTime(a.end_time)}</span>}
                              {dur > 0 && <span className="font-medium">duração {formatDuration(dur)}</span>}
                              {a.location && <span>{a.location}</span>}
                              {a.equipment_tag && <span>{a.equipment_tag}</span>}
                              {a.had_interference && (
                                <span className="text-yellow-700 inline-flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  interferência
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })()}
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Usuários</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {counts.total} no total · {counts.active} ativos
          </p>
        </div>
        <UserFormModal onSaved={() => loadUsers()} />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email"
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {([
            { v: 'all' as RoleFilter, label: 'Todos', count: counts.total },
            { v: 'operator' as RoleFilter, label: 'Operadores', count: counts.operator },
            { v: 'encarregado' as RoleFilter, label: 'Encarregados', count: counts.encarregado },
            { v: 'supervisor' as RoleFilter, label: 'Supervisores', count: counts.supervisor },
            { v: 'manager' as RoleFilter, label: 'Gestores', count: counts.manager },
            { v: 'admin' as RoleFilter, label: 'Admins', count: counts.admin },
          ]).map(({ v, label, count }) => (
            <button
              type="button"
              key={v}
              onClick={() => setRoleFilter(v)}
              className={cn(
                'shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                roleFilter === v
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {label}
              <span className={`ml-1.5 ${roleFilter === v ? 'opacity-70' : 'opacity-60'}`}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card flex flex-col items-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">
            {search || roleFilter !== 'all' ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {search || roleFilter !== 'all' ? 'Tente ajustar busca ou filtros.' : 'Adicione o primeiro usuário para começar.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="border-b bg-muted/30 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:bg-transparent">
                  <TableHead className="text-left px-4 py-2.5 font-medium">Usuário</TableHead>
                  <TableHead className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Cargo</TableHead>
                  <TableHead className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Contato</TableHead>
                  <TableHead className="text-left px-4 py-2.5 font-medium">Status</TableHead>
                  <TableHead className="w-px px-4 py-2.5"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y">
                {filtered.map((u) => {
                  const displayName = u.full_name || 'Sem nome';
                  return (
                    <TableRow
                      key={u.id}
                      className="group cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => openDetail(u)}
                    >
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-sm font-semibold text-primary border border-primary/10">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate leading-tight">{displayName}</p>
                            {u.email && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{u.email}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 hidden md:table-cell">
                        <Badge variant="plain" className={cn('border font-medium', ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700 border-gray-200')}>
                          {ROLE_LABELS[u.role] || u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 hidden lg:table-cell">
                        {u.phone ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            {u.phone}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                          <span className="relative flex h-2 w-2">
                            {u.active && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-60" />
                            )}
                            <span className={`relative inline-flex h-2 w-2 rounded-full ${u.active ? 'bg-orange-500' : 'bg-gray-300'}`} />
                          </span>
                          <span className={u.active ? 'text-orange-700' : 'text-muted-foreground'}>
                            {u.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(u);
                            }}
                            title="Editar usuário"
                            aria-label="Editar usuário"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <button
                            type="button"
                            className={cn(
                              'inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
                              u.active
                                ? 'border-transparent text-red-600 hover:border-red-200 hover:bg-red-50'
                                : 'border-transparent text-orange-600 hover:border-orange-200 hover:bg-orange-50',
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(u);
                            }}
                            title={u.active ? 'Desativar usuário' : 'Reativar usuário'}
                            aria-label={u.active ? 'Desativar usuário' : 'Reativar usuário'}
                          >
                            {u.active ? <Trash2 className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>{filtered.length} {filtered.length === 1 ? 'usuário' : 'usuários'}</span>
            {roleFilter !== 'all' && (
              <span>filtrado por <span className="font-medium text-foreground">{ROLE_LABELS[roleFilter]}</span></span>
            )}
          </div>
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
