'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ClipboardCheck,
  Users,
  TrendingUp,
  BarChart3,
  Activity,
  MapPin,
} from 'lucide-react';
import { PieChart, BarChart, TimelineChart } from './charts';

// ── Types ──

interface ChecklistRow {
  id: string;
  machine_name: string;
  date: string;
  status: string;
  result: string | null;
  had_interference: boolean;
  interference_notes: string | null;
  operator_id: string;
  profiles: { full_name: string } | null;
}

interface ResponseRow {
  id: string;
  status: string;
  checklist_id: string;
  notes: string | null;
  machine_checklist_items: {
    description: string;
    section: string | null;
    is_blocking: boolean;
  } | null;
  checklist_template_items: {
    description: string;
    section: string | null;
    is_blocking: boolean;
  } | null;
}

interface ActivityRow {
  id: string;
  date: string;
  description: string | null;
  equipment_tag: string | null;
  location: string | null;
  had_interference: boolean;
  interference_notes: string | null;
  operator_id: string;
  profiles: { full_name: string } | null;
}

type Period = '7d' | '30d' | '90d';

// ── Helpers ──

function getDateFrom(period: Period): string {
  const d = new Date();
  if (period === '7d') d.setDate(d.getDate() - 7);
  else if (period === '30d') d.setDate(d.getDate() - 30);
  else d.setDate(d.getDate() - 90);
  return d.toISOString().split('T')[0];
}

function groupByDay(items: { date: string }[]): Record<string, number> {
  const map: Record<string, number> = {};
  items.forEach((i) => {
    map[i.date] = (map[i.date] || 0) + 1;
  });
  return map;
}

function fillDays(period: Period): string[] {
  const days: string[] = [];
  const count = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

// ── Page ──

export default function IndicadoresPage() {
  const supabase = useMemo(() => createClient(), []);
  const [period, setPeriod] = useState<Period>('30d');
  const [loading, setLoading] = useState(true);

  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [responses, setResponses] = useState<(ResponseRow & { operator_name: string; operator_id: string; machine_name: string; checklist_date: string })[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const dateFrom = getDateFrom(period);

    const [clRes, actRes] = await Promise.all([
      supabase
        .from('checklists')
        .select('id, machine_name, date, status, result, had_interference, interference_notes, operator_id, profiles(full_name)')
        .gte('date', dateFrom)
        .order('date', { ascending: false })
        .limit(2000),
      supabase
        .from('activities')
        .select('id, date, description, equipment_tag, location, had_interference, interference_notes, operator_id, profiles(full_name)')
        .gte('date', dateFrom)
        .order('date', { ascending: false })
        .limit(2000),
    ]);

    const cls = (clRes.data as ChecklistRow[] | null) ?? [];
    setChecklists(cls);
    setActivities((actRes.data as ActivityRow[] | null) ?? []);

    // Map checklist_id -> checklist info
    const clMap = new Map<string, { operator_name: string; operator_id: string; machine_name: string; date: string }>();
    cls.forEach((c) => clMap.set(c.id, {
      operator_name: c.profiles?.full_name || 'Desconhecido',
      operator_id: c.operator_id,
      machine_name: c.machine_name,
      date: c.date,
    }));

    // Fetch NC responses only for checklists in the period
    const clIds = cls.map((c) => c.id);
    let ncResponses: (ResponseRow & { operator_name: string; operator_id: string; machine_name: string; checklist_date: string })[] = [];

    if (clIds.length > 0) {
      // Supabase `in` filter has a limit, so batch in chunks of 200
      const chunks: string[][] = [];
      for (let i = 0; i < clIds.length; i += 200) {
        chunks.push(clIds.slice(i, i + 200));
      }

      const allNcData: ResponseRow[] = [];
      for (const chunk of chunks) {
        const { data: ncData } = await supabase
          .from('checklist_responses')
          .select('id, status, checklist_id, notes, machine_checklist_items(description, section, is_blocking), checklist_template_items(description, section, is_blocking)')
          .eq('status', 'NC')
          .in('checklist_id', chunk);
        if (ncData) allNcData.push(...(ncData as unknown as ResponseRow[]));
      }

      ncResponses = allNcData.map((r) => ({
        ...r,
        operator_name: clMap.get(r.checklist_id)!.operator_name,
        operator_id: clMap.get(r.checklist_id)!.operator_id,
        machine_name: clMap.get(r.checklist_id)!.machine_name,
        checklist_date: clMap.get(r.checklist_id)!.date,
      }));
    }

    setResponses(ncResponses);

    setLoading(false);
  }, [supabase, period]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Computed stats ──

  const stats = useMemo(() => {
    const total = checklists.length;
    const released = checklists.filter((c) => c.result === 'released').length;
    const notReleased = checklists.filter((c) => c.result === 'not_released').length;
    const pending = checklists.filter((c) => c.status === 'pending').length;
    const clInterference = checklists.filter((c) => c.had_interference).length;
    const actInterference = activities.filter((a) => a.had_interference).length;
    const withInterference = clInterference + actInterference;
    const totalNC = responses.length;
    const conformityRate = total > 0 ? Math.round((released / total) * 100) : 0;
    const totalActivities = activities.length;
    const totalRegistros = total + totalActivities;
    const interferenceRate = totalRegistros > 0 ? Math.round((withInterference / totalRegistros) * 100) : 0;
    const avgNCperChecklist = total > 0 ? (totalNC / total).toFixed(1) : '0';
    const ncBlocking = responses.filter((r) => {
      const item = r.machine_checklist_items || r.checklist_template_items;
      return item?.is_blocking;
    }).length;
    const ncNonBlocking = totalNC - ncBlocking;

    return { total, released, notReleased, pending, withInterference, clInterference, actInterference, totalNC, conformityRate, totalActivities, interferenceRate, avgNCperChecklist, ncBlocking, ncNonBlocking };
  }, [checklists, responses, activities]);

  // NC por operador
  const ncByOperator = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    responses.forEach((r) => {
      const entry = map.get(r.operator_id) ?? { name: r.operator_name, count: 0 };
      entry.count += 1;
      map.set(r.operator_id, entry);
    });
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [responses]);

  // NC por item (top 10 itens mais reprovados)
  const ncByItem = useMemo(() => {
    const map = new Map<string, number>();
    responses.forEach((r) => {
      const desc = r.machine_checklist_items?.description || r.checklist_template_items?.description || 'Item desconhecido';
      map.set(desc, (map.get(desc) || 0) + 1);
    });
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [responses]);

  // NC por seção
  const ncBySection = useMemo(() => {
    const map = new Map<string, number>();
    responses.forEach((r) => {
      const section = r.machine_checklist_items?.section || r.checklist_template_items?.section || 'Geral';
      map.set(section, (map.get(section) || 0) + 1);
    });
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [responses]);

  // Checklists por dia
  const days = useMemo(() => fillDays(period), [period]);

  const checklistsByDay = useMemo(() => groupByDay(checklists), [checklists]);

  const notReleasedByDay = useMemo(() => {
    return groupByDay(checklists.filter((c) => c.result === 'not_released'));
  }, [checklists]);

  const interferenceByDay = useMemo(() => {
    const clItems = checklists.filter((c) => c.had_interference).map((c) => ({ date: c.date }));
    const actItems = activities.filter((a) => a.had_interference).map((a) => ({ date: a.date }));
    return groupByDay([...clItems, ...actItems]);
  }, [checklists, activities]);

  // Operadores com mais checklists não liberados
  const notReleasedByOperator = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    checklists.filter((c) => c.result === 'not_released').forEach((c) => {
      const entry = map.get(c.operator_id) ?? { name: c.profiles?.full_name || 'Desconhecido', count: 0 };
      entry.count += 1;
      map.set(c.operator_id, entry);
    });
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [checklists]);

  // Interferências por operador (checklists + atividades)
  const interferenceByOperator = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    checklists.filter((c) => c.had_interference).forEach((c) => {
      const entry = map.get(c.operator_id) ?? { name: c.profiles?.full_name || 'Desconhecido', count: 0 };
      entry.count += 1;
      map.set(c.operator_id, entry);
    });
    activities.filter((a) => a.had_interference).forEach((a) => {
      const entry = map.get(a.operator_id) ?? { name: a.profiles?.full_name || 'Desconhecido', count: 0 };
      entry.count += 1;
      map.set(a.operator_id, entry);
    });
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [checklists, activities]);

  // NC por equipamento
  const ncByEquipment = useMemo(() => {
    const map = new Map<string, number>();
    responses.forEach((r) => {
      map.set(r.machine_name, (map.get(r.machine_name) || 0) + 1);
    });
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [responses]);

  // ── Render ──

  const periodLabels: Record<Period, string> = { '7d': '7 dias', '30d': '30 dias', '90d': '90 dias' };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Indicadores SSMA</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Analise de conformidade, nao conformidades e interferencias dos checklists.
          </p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                period === p
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
            {[
              { label: 'Total Checklists', value: stats.total, icon: ClipboardCheck, color: 'text-foreground' },
              { label: 'Total Atividades', value: stats.totalActivities, icon: Activity, color: 'text-foreground' },
              { label: 'Liberados', value: stats.released, icon: CheckCircle2, color: 'text-emerald-600' },
              { label: 'Nao Liberados', value: stats.notReleased, icon: XCircle, color: 'text-red-600' },
              { label: 'Taxa Conformidade', value: `${stats.conformityRate}%`, icon: TrendingUp, color: 'text-emerald-600' },
              { label: 'Pendentes', value: stats.pending, icon: Clock, color: 'text-yellow-600' },
              { label: 'Interferencias', value: stats.withInterference, icon: AlertTriangle, color: 'text-orange-600' },
              { label: 'Taxa Interferencia', value: `${stats.interferenceRate}%`, icon: AlertTriangle, color: 'text-orange-600' },
              { label: 'Total NC', value: stats.totalNC, icon: BarChart3, color: 'text-red-600' },
              { label: 'Media NC/Checklist', value: stats.avgNCperChecklist, icon: BarChart3, color: 'text-red-600' },
              { label: 'NC Bloqueantes', value: stats.ncBlocking, icon: XCircle, color: 'text-red-700' },
              { label: 'NC Nao Bloqueantes', value: stats.ncNonBlocking, icon: AlertTriangle, color: 'text-yellow-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Resultado dos Checklists (Pie) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resultado dos Checklists</CardTitle>
                <CardDescription>Distribuicao por resultado no periodo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-8">
                  <PieChart
                    size={150}
                    segments={[
                      { value: stats.released, color: '#10b981', label: 'Liberados' },
                      { value: stats.notReleased, color: '#ef4444', label: 'Nao Liberados' },
                      { value: stats.pending, color: '#eab308', label: 'Pendentes' },
                    ]}
                    centerLabel={`${stats.conformityRate}%`}
                  />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm bg-emerald-500" />
                      <span className="text-sm">Liberados: <span className="font-semibold text-emerald-600">{stats.released}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm bg-red-500" />
                      <span className="text-sm">Nao Liberados: <span className="font-semibold text-red-600">{stats.notReleased}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm bg-yellow-500" />
                      <span className="text-sm">Pendentes: <span className="font-semibold text-yellow-600">{stats.pending}</span></span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* NC por Secao (Pie) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">NC por Secao</CardTitle>
                <CardDescription>Nao conformidades agrupadas por secao do checklist</CardDescription>
              </CardHeader>
              <CardContent>
                {ncBySection.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma NC registrada no periodo.</p>
                ) : (
                  <div className="flex items-center gap-8">
                    <PieChart
                      size={150}
                      segments={ncBySection.map((s, i) => ({
                        value: s.value,
                        color: ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'][i % 8],
                        label: s.label,
                      }))}
                      centerLabel={String(responses.length)}
                    />
                    <div className="space-y-2 flex-1 min-w-0">
                      {ncBySection.map((s, i) => (
                        <div key={s.label} className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-sm shrink-0"
                            style={{ backgroundColor: ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'][i % 8] }}
                          />
                          <span className="text-xs truncate flex-1" title={s.label}>{s.label}</span>
                          <span className="text-xs font-semibold">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* NC Bloqueantes vs Nao Bloqueantes (Pie) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">NC por Severidade</CardTitle>
                <CardDescription>Bloqueantes vs nao bloqueantes</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.totalNC === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma NC registrada no periodo.</p>
                ) : (
                  <div className="flex items-center gap-8">
                    <PieChart
                      size={150}
                      segments={[
                        { value: stats.ncBlocking, color: '#dc2626', label: 'Bloqueantes' },
                        { value: stats.ncNonBlocking, color: '#facc15', label: 'Nao Bloqueantes' },
                      ]}
                      centerLabel={String(stats.totalNC)}
                    />
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-red-600" />
                        <span className="text-sm">Bloqueantes: <span className="font-semibold text-red-600">{stats.ncBlocking}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-yellow-400" />
                        <span className="text-sm">Nao Bloqueantes: <span className="font-semibold text-yellow-600">{stats.ncNonBlocking}</span></span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Timeline Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Checklists por Dia</CardTitle>
                <CardDescription>Total de checklists realizados</CardDescription>
              </CardHeader>
              <CardContent>
                <TimelineChart days={days} values={checklistsByDay} color="#3b82f6" label="checklists" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nao Liberados por Dia</CardTitle>
                <CardDescription>Checklists com resultado nao liberado</CardDescription>
              </CardHeader>
              <CardContent>
                <TimelineChart days={days} values={notReleasedByDay} color="#ef4444" label="nao liberados" />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Interferencias por Dia</CardTitle>
                <CardDescription>Checklists com registro de interferencia</CardDescription>
              </CardHeader>
              <CardContent>
                <TimelineChart days={days} values={interferenceByDay} color="#f97316" label="interferencias" />
              </CardContent>
            </Card>

            {/* Lista de Checklists Nao Liberados */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Checklists Nao Liberados</CardTitle>
                <CardDescription>
                  Equipamentos reprovados — clique para ver o detalhe
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const notReleased = checklists.filter((c) => c.result === 'not_released');
                  if (notReleased.length === 0) {
                    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhum checklist nao liberado no periodo.</p>;
                  }
                  return (
                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                      {notReleased.map((c) => (
                        <Link
                          key={c.id}
                          href={`/checklists?id=${c.id}`}
                          className="flex items-start gap-3 rounded-md border border-red-200 p-3 hover:bg-red-50/50 transition-colors group"
                        >
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium group-hover:underline">{c.machine_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {c.profiles?.full_name || 'Operador'} · {new Date(c.date).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-primary font-medium underline shrink-0 mt-0.5">
                            Ver →
                          </span>
                        </Link>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Bar Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">NC por Operador</CardTitle>
                <CardDescription>Top 10 operadores com mais respostas Nao Conforme</CardDescription>
              </CardHeader>
              <CardContent>
                {ncByOperator.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma NC registrada no periodo.</p>
                ) : (
                  <BarChart
                    data={ncByOperator.map((o) => ({ label: o.name, value: o.count }))}
                    color="#ef4444"
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Equipamentos Nao Liberados por Operador</CardTitle>
                <CardDescription>Top 10 operadores com mais checklists nao liberados</CardDescription>
              </CardHeader>
              <CardContent>
                {notReleasedByOperator.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Nenhum checklist nao liberado no periodo.</p>
                ) : (
                  <BarChart
                    data={notReleasedByOperator.map((o) => ({ label: o.name, value: o.count }))}
                    color="#f97316"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* NC por Equipamento e Interferencias por Operador */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">NC por Equipamento</CardTitle>
                <CardDescription>Top 10 equipamentos com mais nao conformidades</CardDescription>
              </CardHeader>
              <CardContent>
                {ncByEquipment.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma NC registrada no periodo.</p>
                ) : (
                  <BarChart
                    data={ncByEquipment.map((o) => ({ label: o.label, value: o.value }))}
                    color="#f87171"
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Interferencias por Operador</CardTitle>
                <CardDescription>Top 10 operadores com mais interferencias (checklists + atividades)</CardDescription>
              </CardHeader>
              <CardContent>
                {interferenceByOperator.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma interferencia registrada no periodo.</p>
                ) : (
                  <BarChart
                    data={interferenceByOperator.map((o) => ({ label: o.name, value: o.count }))}
                    color="#f97316"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top NC Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 10 Itens com Nao Conformidade</CardTitle>
              <CardDescription>Perguntas do checklist que mais reprovam — foco de atencao para SSMA</CardDescription>
            </CardHeader>
            <CardContent>
              {ncByItem.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma NC registrada no periodo.</p>
              ) : (
                <BarChart
                  data={ncByItem}
                  color="#ef4444"
                  labelWidth={280}
                />
              )}
            </CardContent>
          </Card>

          {/* Registro de Irregularidades (Checklists + Atividades) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registro de Interferencias</CardTitle>
              <CardDescription>
                Checklists e atividades com interferencia no periodo — clique para ver o detalhe
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                type InterferenceItem = { id: string; type: 'checklist' | 'atividade'; label: string; operator: string; date: string; notes: string | null; badge?: string; badgeColor?: string };
                const items: InterferenceItem[] = [];

                checklists.filter((c) => c.had_interference).forEach((c) => {
                  items.push({
                    id: c.id,
                    type: 'checklist',
                    label: c.machine_name,
                    operator: c.profiles?.full_name || 'Operador',
                    date: c.date,
                    notes: c.interference_notes,
                    badge: c.result === 'released' ? 'Liberado' : c.result === 'not_released' ? 'Nao Liberado' : 'Pendente',
                    badgeColor: c.result === 'released' ? 'bg-emerald-100 text-emerald-700' : c.result === 'not_released' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700',
                  });
                });

                activities.filter((a) => a.had_interference).forEach((a) => {
                  items.push({
                    id: a.id,
                    type: 'atividade',
                    label: a.description || a.equipment_tag || 'Atividade',
                    operator: a.profiles?.full_name || 'Operador',
                    date: a.date,
                    notes: a.interference_notes,
                  });
                });

                items.sort((a, b) => b.date.localeCompare(a.date));

                if (items.length === 0) {
                  return <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma interferencia registrada no periodo.</p>;
                }
                return (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {items.map((item) => (
                      <Link
                        key={`${item.type}-${item.id}`}
                        href={item.type === 'checklist' ? `/checklists?id=${item.id}` : `/atividades?id=${item.id}`}
                        className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors group"
                      >
                        {item.type === 'checklist' ? (
                          <ClipboardCheck className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                        ) : (
                          <Activity className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              item.type === 'checklist' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {item.type === 'checklist' ? 'Checklist' : 'Atividade'}
                            </span>
                            <span className="text-sm font-medium group-hover:underline">{item.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {item.operator} · {new Date(item.date).toLocaleDateString('pt-BR')}
                            </span>
                            {item.badge && (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.badgeColor}`}>
                                {item.badge}
                              </span>
                            )}
                          </div>
                          {item.notes ? (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.notes}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground/60 mt-1 italic">Sem descricao da interferencia</p>
                          )}
                        </div>
                        <span className="text-xs text-primary font-medium shrink-0 mt-0.5 underline">
                          Ver {item.type} →
                        </span>
                      </Link>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Detalhamento de Nao Conformidades */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalhamento das Nao Conformidades</CardTitle>
              <CardDescription>
                NC de checklists e interferencias de atividades — clique para ver o detalhe completo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                type NCRow = {
                  id: string;
                  type: 'checklist' | 'atividade';
                  operator: string;
                  equipment: string;
                  issue: string;
                  section: string;
                  date: string;
                  notes: string | null;
                  linkHref: string;
                };

                const rows: NCRow[] = [];

                // NC de checklists
                responses.forEach((r) => {
                  const itemData = r.machine_checklist_items || r.checklist_template_items;
                  rows.push({
                    id: `cl-${r.id}`,
                    type: 'checklist',
                    operator: r.operator_name,
                    equipment: r.machine_name,
                    issue: itemData?.description || 'Item desconhecido',
                    section: itemData?.section || 'Geral',
                    date: r.checklist_date,
                    notes: r.notes,
                    linkHref: `/checklists?id=${r.checklist_id}`,
                  });
                });

                // Interferencias de atividades
                activities.filter((a) => a.had_interference).forEach((a) => {
                  rows.push({
                    id: `act-${a.id}`,
                    type: 'atividade',
                    operator: a.profiles?.full_name || 'Operador',
                    equipment: a.equipment_tag || a.location || '—',
                    issue: 'Interferencia registrada',
                    section: a.description || '—',
                    date: a.date,
                    notes: a.interference_notes,
                    linkHref: `/atividades?id=${a.id}`,
                  });
                });

                rows.sort((a, b) => b.date.localeCompare(a.date));

                if (rows.length === 0) {
                  return <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma irregularidade registrada no periodo.</p>;
                }

                return (
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">Origem</th>
                          <th className="py-2 pr-4 font-medium">Operador</th>
                          <th className="py-2 pr-4 font-medium">Equipamento</th>
                          <th className="py-2 pr-4 font-medium">Irregularidade</th>
                          <th className="py-2 pr-4 font-medium">Secao</th>
                          <th className="py-2 pr-4 font-medium">Data</th>
                          <th className="py-2 pr-4 font-medium">Obs.</th>
                          <th className="py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 pr-4">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                row.type === 'checklist' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                              }`}>
                                {row.type === 'checklist' ? 'Checklist' : 'Atividade'}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-2">
                                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                  row.type === 'checklist' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                }`}>
                                  {row.operator.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium">{row.operator}</span>
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 text-muted-foreground">{row.equipment}</td>
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-1.5">
                                {row.type === 'checklist' ? (
                                  <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                ) : (
                                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                )}
                                <span className="max-w-[250px] truncate" title={row.issue}>
                                  {row.issue}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 text-muted-foreground text-xs">{row.section}</td>
                            <td className="py-2.5 pr-4 text-muted-foreground text-xs whitespace-nowrap">
                              {new Date(row.date).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="py-2.5 pr-4 text-xs text-muted-foreground max-w-[150px] truncate" title={row.notes || ''}>
                              {row.notes || '—'}
                            </td>
                            <td className="py-2.5">
                              <Link
                                href={row.linkHref}
                                className="text-xs text-primary font-medium underline whitespace-nowrap"
                              >
                                Ver {row.type} →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
