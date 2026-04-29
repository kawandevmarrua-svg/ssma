'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Users, ListChecks, Bell, AlertTriangle, Activity, ClipboardCheck, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDuration } from '@/lib/formatters';

interface DashboardStats {
  activeOperators: number;
  checklistsToday: number;
  pendingAlerts: number;
  openDeviations: number;
  activitiesToday: number;
  inspectionsMonth: number;
}

interface OperatorProductivity {
  operatorId: string;
  name: string;
  activities: number;
  activitiesCompleted: number;
  checklists: number;
  workedMs: number;
  idleMs: number;
  longestGapMs: number;
  hadInterference: boolean;
}

function PieChart({
  segments,
  size = 80,
  thickness,
  centerLabel,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const innerSize = size - (thickness ?? size * 0.32) * 2;

  if (total === 0) {
    return (
      <div
        className="rounded-full bg-muted/60 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-[10px] text-muted-foreground">—</span>
      </div>
    );
  }

  let acc = 0;
  const stops: string[] = [];
  segments.forEach((seg) => {
    const startPct = (acc / total) * 100;
    acc += seg.value;
    const endPct = (acc / total) * 100;
    stops.push(`${seg.color} ${startPct}% ${endPct}%`);
  });

  return (
    <div
      className="relative rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${stops.join(', ')})`,
      }}
    >
      <div
        className="absolute rounded-full bg-background flex items-center justify-center"
        style={{
          width: innerSize,
          height: innerSize,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        {centerLabel && (
          <span className="text-xs font-bold text-foreground">{centerLabel}</span>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [stats, setStats] = useState<DashboardStats>({
    activeOperators: 0,
    checklistsToday: 0,
    pendingAlerts: 0,
    openDeviations: 0,
    activitiesToday: 0,
    inspectionsMonth: 0,
  });
  const [recentAlerts, setRecentAlerts] = useState<
    { id: string; title: string; severity: string; created_at: string }[]
  >([]);
  const [productivity, setProductivity] = useState<OperatorProductivity[]>([]);
  const [sortBy, setSortBy] = useState<'worked' | 'idle' | 'activities'>('worked');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date().toISOString().slice(0, 7) + '-01';

    async function fetchAll() {
      const [
        operatorsRes,
        checklistsRes,
        alertsRes,
        deviationsRes,
        activitiesRes,
        inspectionsRes,
        recentAlertsRes,
        todayActivitiesRes,
        todayChecklistsRes,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'operator')
          .eq('active', true),
        supabase
          .from('checklists')
          .select('id', { count: 'exact', head: true })
          .eq('date', today),
        supabase
          .from('safety_alerts')
          .select('id', { count: 'exact', head: true })
          .eq('read', false),
        supabase
          .from('behavioral_deviations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'open'),
        supabase
          .from('activities')
          .select('id', { count: 'exact', head: true })
          .eq('date', today),
        supabase
          .from('behavioral_inspections')
          .select('id', { count: 'exact', head: true })
          .gte('date', monthStart),
        supabase
          .from('safety_alerts')
          .select('id, title, severity, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('activities')
          .select('id, operator_id, start_time, end_time, had_interference, created_at, profiles!operator_id(full_name)')
          .eq('date', today),
        supabase
          .from('checklists')
          .select('id, operator_id, created_at, profiles!operator_id(full_name)')
          .eq('date', today),
      ]);

      setStats({
        activeOperators: operatorsRes.count || 0,
        checklistsToday: checklistsRes.count || 0,
        pendingAlerts: alertsRes.count || 0,
        openDeviations: deviationsRes.count || 0,
        activitiesToday: activitiesRes.count || 0,
        inspectionsMonth: inspectionsRes.count || 0,
      });

      setRecentAlerts(recentAlertsRes.data || []);

      type RawActivity = { id: string; operator_id: string; start_time: string | null; end_time: string | null; had_interference: boolean; created_at: string; profiles: { full_name: string } | null };
      type RawChecklist = { id: string; operator_id: string; created_at: string; profiles: { full_name: string } | null };
      const acts = (todayActivitiesRes.data as RawActivity[] | null) ?? [];
      const chks = (todayChecklistsRes.data as RawChecklist[] | null) ?? [];

      const byOperator = new Map<string, { name: string; events: { ts: number; endTs: number }[]; activities: number; activitiesCompleted: number; checklists: number; workedMs: number; hadInterference: boolean }>();

      for (const a of acts) {
        const startTs = a.start_time ? new Date(a.start_time).getTime() : new Date(a.created_at).getTime();
        const endTs = a.end_time ? new Date(a.end_time).getTime() : startTs;
        const entry = byOperator.get(a.operator_id) ?? { name: a.profiles?.full_name || '—', events: [], activities: 0, activitiesCompleted: 0, checklists: 0, workedMs: 0, hadInterference: false };
        entry.name = a.profiles?.full_name || entry.name;
        entry.events.push({ ts: startTs, endTs });
        entry.activities += 1;
        if (a.end_time) entry.activitiesCompleted += 1;
        if (endTs > startTs) entry.workedMs += endTs - startTs;
        if (a.had_interference) entry.hadInterference = true;
        byOperator.set(a.operator_id, entry);
      }
      for (const c of chks) {
        const ts = new Date(c.created_at).getTime();
        const entry = byOperator.get(c.operator_id) ?? { name: c.profiles?.full_name || '—', events: [], activities: 0, activitiesCompleted: 0, checklists: 0, workedMs: 0, hadInterference: false };
        entry.name = c.profiles?.full_name || entry.name;
        entry.events.push({ ts, endTs: ts });
        entry.checklists += 1;
        byOperator.set(c.operator_id, entry);
      }

      const productivityList: OperatorProductivity[] = [];
      for (const [operatorId, entry] of byOperator.entries()) {
        const sorted = [...entry.events].sort((a, b) => a.ts - b.ts);
        let idleMs = 0;
        let longestGapMs = 0;
        for (let i = 1; i < sorted.length; i++) {
          const gap = sorted[i].ts - sorted[i - 1].endTs;
          if (gap > 0) {
            idleMs += gap;
            if (gap > longestGapMs) longestGapMs = gap;
          }
        }
        productivityList.push({
          operatorId,
          name: entry.name,
          activities: entry.activities,
          activitiesCompleted: entry.activitiesCompleted,
          checklists: entry.checklists,
          workedMs: entry.workedMs,
          idleMs,
          longestGapMs,
          hadInterference: entry.hadInterference,
        });
      }
      setProductivity(productivityList);
      setLoading(false);
    }

    fetchAll();

    // Realtime: refaz todas as queries para manter dados consistentes
    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checklists' },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activities' },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'safety_alerts' },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const statCards = [
    { label: 'Operadores ativos', value: stats.activeOperators, icon: Users },
    { label: 'Checklists hoje', value: stats.checklistsToday, icon: ListChecks },
    { label: 'Alertas pendentes', value: stats.pendingAlerts, icon: Bell },
    { label: 'Desvios abertos', value: stats.openDeviations, icon: AlertTriangle },
    { label: 'Atividades hoje', value: stats.activitiesToday, icon: Activity },
    { label: 'Inspecoes no mes', value: stats.inspectionsMonth, icon: ClipboardCheck },
  ];

  const severityColor: Record<string, string> = {
    low: 'bg-blue-100 text-blue-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };

  const severityLabel: Record<string, string> = {
    low: 'Baixa',
    medium: 'Media',
    high: 'Alta',
    critical: 'Critica',
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Visao geral em tempo real. Os dados sao atualizados automaticamente.
        </p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '...' : value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Alertas Recentes</CardTitle>
            <CardDescription>Ultimos alertas do sistema (tempo real)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : recentAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum alerta recente.</p>
            ) : (
              <ul className="space-y-3">
                {recentAlerts.map((alert) => (
                  <li key={alert.id} className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        severityColor[alert.severity] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {severityLabel[alert.severity] || alert.severity}
                    </span>
                    <span className="text-sm flex-1 truncate">{alert.title}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(alert.created_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo do Dia</CardTitle>
            <CardDescription>Indicadores operacionais de hoje</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Checklists realizados</span>
                <span className="text-sm font-semibold">{loading ? '...' : stats.checklistsToday}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Atividades registradas</span>
                <span className="text-sm font-semibold">{loading ? '...' : stats.activitiesToday}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Alertas nao lidos</span>
                <span className="text-sm font-semibold">{loading ? '...' : stats.pendingAlerts}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Desvios em aberto</span>
                <span className="text-sm font-semibold">{loading ? '...' : stats.openDeviations}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Inspecoes comportamentais (mes)</span>
                <span className="text-sm font-semibold">{loading ? '...' : stats.inspectionsMonth}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base sm:text-lg">
              Produtividade dos Operadores
              <span className="block sm:inline text-xs sm:text-sm font-normal text-muted-foreground sm:ml-1">
                Hoje · {new Date().toLocaleDateString('pt-BR')}
              </span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Tempo trabalhado = soma início→fim das atividades. Tempo ocioso = intervalos entre eventos.
            </CardDescription>
          </div>
          <div className="flex gap-1 flex-wrap">
            {([
              { v: 'worked' as const, label: 'Trabalhado' },
              { v: 'idle' as const, label: 'Ocioso' },
              { v: 'activities' as const, label: 'Atividades' },
            ]).map(({ v, label }) => (
              <button
                key={v}
                onClick={() => setSortBy(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  sortBy === v
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : productivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma atividade ou checklist registrado hoje.</p>
          ) : (() => {
            const sorted = [...productivity].sort((a, b) => {
              if (sortBy === 'worked') return b.workedMs - a.workedMs;
              if (sortBy === 'idle') return b.idleMs - a.idleMs;
              return b.activities - a.activities;
            });
            const totalWorked = sorted.reduce((s, o) => s + o.workedMs, 0);
            const totalIdle = sorted.reduce((s, o) => s + o.idleMs, 0);
            const totalAll = totalWorked + totalIdle;
            const workedPct = totalAll > 0 ? Math.round((totalWorked / totalAll) * 100) : 0;

            return (
              <div className="space-y-6">
                {/* Explanation block */}
                <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 text-xs space-y-1.5">
                  <p className="font-semibold text-blue-900 uppercase tracking-wide text-[11px]">Como ler estes gráficos</p>
                  <ul className="space-y-1 text-blue-900/80">
                    <li>
                      <span className="font-semibold">Período:</span> hoje, das 00:00 até agora.
                    </li>
                    <li>
                      <span className="font-semibold">Eventos =</span> Atividades + Checklists registrados pelo operador no dia.
                    </li>
                    <li>
                      <span className="font-semibold">Tempo trabalhado:</span> soma da duração (início→fim) das atividades concluídas.
                    </li>
                    <li>
                      <span className="font-semibold">Tempo ocioso:</span> soma dos intervalos entre eventos consecutivos (gap entre o fim de um evento e o início do próximo).
                    </li>
                  </ul>
                </div>

                {/* Aggregate pie */}
                <div className="rounded-md border bg-muted/30 p-4 flex flex-col sm:flex-row items-center gap-6">
                  <PieChart
                    size={140}
                    segments={[
                      { value: totalWorked, color: '#10b981' },
                      { value: totalIdle, color: '#fb923c' },
                    ]}
                    centerLabel={`${workedPct}%`}
                  />
                  <div className="flex-1 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Tempo total da equipe (hoje)
                    </p>
                    <p className="text-xs text-muted-foreground -mt-1">
                      O número {workedPct}% no centro é a fatia de tempo trabalhado
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm bg-emerald-500" />
                      <span className="text-sm">
                        Trabalhado: <span className="font-semibold text-emerald-600">{formatDuration(totalWorked)}</span>
                        <span className="text-muted-foreground ml-1">({workedPct}%)</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm bg-orange-400" />
                      <span className="text-sm">
                        Ocioso: <span className="font-semibold text-orange-600">{formatDuration(totalIdle)}</span>
                        <span className="text-muted-foreground ml-1">({100 - workedPct}%)</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Per-operator pies */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sorted.map((op) => {
                    const opTotal = op.workedMs + op.idleMs;
                    const opWorkedPct = opTotal > 0 ? Math.round((op.workedMs / opTotal) * 100) : 0;
                    const eventsTotal = op.activities + op.checklists;

                    return (
                      <div key={op.operatorId} className="rounded-md border p-4 space-y-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                            {op.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-sm truncate flex-1">{op.name}</span>
                          {op.hadInterference && (
                            <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 shrink-0" />
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Time pie */}
                          <div className="flex flex-col items-center gap-1">
                            <PieChart
                              size={80}
                              segments={[
                                { value: op.workedMs, color: '#10b981' },
                                { value: op.idleMs, color: '#fb923c' },
                              ]}
                              centerLabel={opTotal > 0 ? `${opWorkedPct}%` : undefined}
                            />
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground text-center leading-tight">
                              Tempo<br />trab. × ocioso
                            </span>
                          </div>

                          {/* Events pie */}
                          <div className="flex flex-col items-center gap-1">
                            <PieChart
                              size={80}
                              segments={[
                                { value: op.activities, color: '#059669' },
                                { value: op.checklists, color: '#3b82f6' },
                              ]}
                              centerLabel={eventsTotal > 0 ? String(eventsTotal) : undefined}
                            />
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground text-center leading-tight">
                              Eventos<br />ativ. × check.
                            </span>
                          </div>

                          {/* Stats */}
                          <div className="flex-1 min-w-0 space-y-1 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                Trab.
                              </span>
                              <span className="font-semibold">{formatDuration(op.workedMs)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 text-orange-700">
                                <span className="h-2 w-2 rounded-full bg-orange-400" />
                                Ocioso
                              </span>
                              <span className="font-semibold">{formatDuration(op.idleMs)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 text-emerald-800">
                                <Activity className="h-3 w-3" />
                                Ativ.
                              </span>
                              <span className="font-semibold">{op.activities}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 text-blue-700">
                                <ClipboardCheck className="h-3 w-3" />
                                Check.
                              </span>
                              <span className="font-semibold">{op.checklists}</span>
                            </div>
                            {op.longestGapMs > 30 * 60 * 1000 && (
                              <div className="flex items-center justify-between gap-2 pt-1 border-t border-orange-200">
                                <span className="inline-flex items-center gap-1 text-orange-700">
                                  <Clock className="h-3 w-3" />
                                  Maior gap
                                </span>
                                <span className="font-semibold text-orange-600">{formatDuration(op.longestGapMs)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Trabalhado
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
                    Ocioso
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-700" />
                    Atividades
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    Checklists
                  </span>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
