'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Eye,
  TrendingUp,
  Users,
} from 'lucide-react';

type Period = '7d' | '30d' | '90d';
type Classification = 'safe' | 'attention' | 'critical';
type Category = 'risk_perception' | 'attitude' | 'ppe' | 'operation' | 'communication' | 'environment';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface Inspection {
  id: string;
  observer_id: string;
  operator_id: string;
  date: string;
  observation_type: string;
  overall_classification: Classification | null;
  status: string;
  created_at: string;
}

interface InspectionItem {
  inspection_id: string;
  category: Category;
  description: string;
  status: string; // sim | nao | na
}

interface Deviation {
  inspection_id: string;
  description: string;
  risk_level: RiskLevel;
  status: string;
}

interface Profile {
  id: string;
  full_name: string | null;
}

const CATEGORY_LABELS: Record<Category, string> = {
  risk_perception: 'Percepção de Risco',
  attitude: 'Postura e Atitude',
  ppe: 'Uso de EPI',
  operation: 'Operação / Execução',
  communication: 'Comunicação',
  environment: 'Condições Ambiente',
};

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  critical: 'Crítico',
};

const RISK_COLORS: Record<RiskLevel, string> = {
  low: '#3b82f6',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
};

const CLASSIFICATION_LABELS: Record<Classification, string> = {
  safe: 'Comportamento Seguro',
  attention: 'Oportunidade de Melhoria',
  critical: 'Comportamento de Risco',
};

const CLASSIFICATION_COLORS: Record<Classification, string> = {
  safe: '#10b981',
  attention: '#eab308',
  critical: '#ef4444',
};

function getDateFrom(period: Period): string {
  const d = new Date();
  if (period === '7d') d.setDate(d.getDate() - 7);
  else if (period === '30d') d.setDate(d.getDate() - 30);
  else d.setDate(d.getDate() - 90);
  return d.toISOString().split('T')[0];
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

export default function DashboardInspecoesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [period, setPeriod] = useState<Period>('30d');
  const [loading, setLoading] = useState(true);

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const dateFrom = getDateFrom(period);

    const inspRes = await supabase
      .from('behavioral_inspections')
      .select('id, observer_id, operator_id, date, observation_type, overall_classification, status, created_at')
      .gte('date', dateFrom)
      .order('date', { ascending: false })
      .limit(2000);

    const insps = (inspRes.data ?? []) as Inspection[];
    setInspections(insps);

    // Fetch items/deviations only for inspections in period (batched to avoid Supabase .in() limits)
    const inspIds = insps.map((i) => i.id);
    let allItems: InspectionItem[] = [];
    let allDevs: Deviation[] = [];

    if (inspIds.length > 0) {
      const chunks: string[][] = [];
      for (let i = 0; i < inspIds.length; i += 200) {
        chunks.push(inspIds.slice(i, i + 200));
      }

      const [itemChunks, devChunks] = await Promise.all([
        Promise.all(
          chunks.map((chunk) =>
            supabase
              .from('behavioral_inspection_items')
              .select('inspection_id, category, description, status')
              .in('inspection_id', chunk),
          ),
        ),
        Promise.all(
          chunks.map((chunk) =>
            supabase
              .from('behavioral_deviations')
              .select('inspection_id, description, risk_level, status')
              .in('inspection_id', chunk),
          ),
        ),
      ]);

      itemChunks.forEach((r) => { if (r.data) allItems.push(...(r.data as InspectionItem[])); });
      devChunks.forEach((r) => { if (r.data) allDevs.push(...(r.data as Deviation[])); });
    }

    setItems(allItems);
    setDeviations(allDevs);

    // Load profile names
    const userIds = [...new Set(insps.flatMap((i) => [i.observer_id, i.operator_id]))];
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      setProfiles(
        Object.fromEntries((profs ?? []).map((p) => [p.id, p as Profile])),
      );
    }

    setLoading(false);
  }, [supabase, period]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Computed stats ──
  const stats = useMemo(() => {
    const total = inspections.length;
    const safe = inspections.filter((i) => i.overall_classification === 'safe').length;
    const attention = inspections.filter((i) => i.overall_classification === 'attention').length;
    const critical = inspections.filter((i) => i.overall_classification === 'critical').length;
    const totalDeviations = deviations.length;
    const openDeviations = deviations.filter((d) => d.status === 'open').length;
    const safeRate = total > 0 ? Math.round((safe / total) * 100) : 0;
    const uniqueObservers = new Set(inspections.map((i) => i.observer_id)).size;
    const uniqueOperators = new Set(inspections.map((i) => i.operator_id)).size;
    return {
      total,
      safe,
      attention,
      critical,
      totalDeviations,
      openDeviations,
      safeRate,
      uniqueObservers,
      uniqueOperators,
    };
  }, [inspections, deviations]);

  // NC rate by category
  const ncByCategory = useMemo(() => {
    const catMap: Record<Category, { total: number; nao: number }> = {} as Record<Category, { total: number; nao: number }>;
    const cats = Object.keys(CATEGORY_LABELS) as Category[];
    cats.forEach((c) => (catMap[c] = { total: 0, nao: 0 }));
    items.forEach((it) => {
      if (catMap[it.category]) {
        catMap[it.category].total++;
        if (it.status === 'nao') catMap[it.category].nao++;
      }
    });
    return cats.map((c) => ({
      category: c,
      label: CATEGORY_LABELS[c],
      total: catMap[c].total,
      nao: catMap[c].nao,
      rate: catMap[c].total > 0 ? Math.round((catMap[c].nao / catMap[c].total) * 100) : 0,
    }));
  }, [items]);

  // Deviations by risk level
  const devsByRisk = useMemo(() => {
    const map: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    deviations.forEach((d) => {
      if (map[d.risk_level as RiskLevel] !== undefined) map[d.risk_level as RiskLevel]++;
    });
    return (Object.entries(map) as [RiskLevel, number][]).map(([k, v]) => ({
      level: k,
      label: RISK_LABELS[k],
      count: v,
      color: RISK_COLORS[k],
    }));
  }, [deviations]);

  // Classification distribution
  const classificationDist = useMemo(() => {
    const map: Record<Classification, number> = { safe: 0, attention: 0, critical: 0 };
    inspections.forEach((i) => {
      if (i.overall_classification && map[i.overall_classification] !== undefined)
        map[i.overall_classification]++;
    });
    return (Object.entries(map) as [Classification, number][]).map(([k, v]) => ({
      key: k,
      label: CLASSIFICATION_LABELS[k],
      count: v,
      color: CLASSIFICATION_COLORS[k],
    }));
  }, [inspections]);

  // Inspections per day
  const days = useMemo(() => fillDays(period), [period]);
  const inspByDay = useMemo(() => {
    const map: Record<string, number> = {};
    inspections.forEach((i) => {
      map[i.date] = (map[i.date] || 0) + 1;
    });
    return map;
  }, [inspections]);

  // Top operators with most deviations
  const topOperatorsDeviations = useMemo(() => {
    const inspMap = new Map<string, string>();
    inspections.forEach((i) => inspMap.set(i.id, i.operator_id));

    const countMap = new Map<string, number>();
    deviations.forEach((d) => {
      const opId = inspMap.get(d.inspection_id);
      if (opId) countMap.set(opId, (countMap.get(opId) || 0) + 1);
    });

    return [...countMap.entries()]
      .map(([id, count]) => ({
        name: profiles[id]?.full_name ?? 'Desconhecido',
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [deviations, inspections, profiles]);

  // Top observers
  const topObservers = useMemo(() => {
    const map = new Map<string, number>();
    inspections.forEach((i) => map.set(i.observer_id, (map.get(i.observer_id) || 0) + 1));
    return [...map.entries()]
      .map(([id, count]) => ({
        name: profiles[id]?.full_name ?? 'Desconhecido',
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [inspections, profiles]);

  const periodLabels: Record<Period, string> = { '7d': '7 dias', '30d': '30 dias', '90d': '90 dias' };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Dashboard — Inspeções Comportamentais
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Análise de desvios, conformidade e tendências comportamentais
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
          {/* KPIs */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Total Inspeções', value: stats.total, icon: Eye, color: 'text-foreground' },
              { label: 'Comportamento Seguro', value: `${stats.safeRate}%`, icon: TrendingUp, color: 'text-emerald-600' },
              { label: 'Seguros', value: stats.safe, icon: CheckCircle2, color: 'text-emerald-600' },
              { label: 'Atenção', value: stats.attention, icon: AlertTriangle, color: 'text-yellow-600' },
              { label: 'Risco', value: stats.critical, icon: ShieldCheck, color: 'text-red-600' },
              { label: 'Total Desvios', value: stats.totalDeviations, icon: AlertTriangle, color: 'text-red-600' },
              { label: 'Desvios Abertos', value: stats.openDeviations, icon: AlertTriangle, color: 'text-orange-600' },
              { label: 'Observadores', value: stats.uniqueObservers, icon: Users, color: 'text-blue-600' },
              { label: 'Observados', value: stats.uniqueOperators, icon: Users, color: 'text-purple-600' },
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

          {/* Row: Classification + Risk Level */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Classificação das Inspeções</CardTitle>
                <CardDescription>Distribuição por resultado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {classificationDist.map((c) => {
                    const pct = stats.total > 0 ? (c.count / stats.total) * 100 : 0;
                    return (
                      <div key={c.key}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-sm shrink-0"
                              style={{ backgroundColor: c.color }}
                            />
                            {c.label}
                          </span>
                          <span className="font-semibold">
                            {c.count}{' '}
                            <span className="text-muted-foreground font-normal">
                              ({Math.round(pct)}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: c.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Desvios por Nível de Risco</CardTitle>
                <CardDescription>Classificação dos desvios registrados</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.totalDeviations === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Nenhum desvio registrado no período.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {devsByRisk.map((d) => {
                      const pct =
                        stats.totalDeviations > 0
                          ? (d.count / stats.totalDeviations) * 100
                          : 0;
                      return (
                        <div key={d.level}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 rounded-sm shrink-0"
                                style={{ backgroundColor: d.color }}
                              />
                              {d.label}
                            </span>
                            <span className="font-semibold">
                              {d.count}{' '}
                              <span className="text-muted-foreground font-normal">
                                ({Math.round(pct)}%)
                              </span>
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: d.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* NC Rate by Category */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Taxa de Não Conformidade por Categoria
              </CardTitle>
              <CardDescription>
                Percentual de respostas &quot;Não&quot; por categoria do checklist comportamental
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ncByCategory.map((cat) => (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{cat.label}</span>
                      <span className="text-muted-foreground">
                        {cat.nao}/{cat.total} ({cat.rate}%)
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${cat.rate}%`,
                          backgroundColor:
                            cat.rate > 30
                              ? '#ef4444'
                              : cat.rate > 15
                                ? '#f97316'
                                : cat.rate > 5
                                  ? '#eab308'
                                  : '#10b981',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inspeções por Dia</CardTitle>
              <CardDescription>Volume de inspeções realizadas no período</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-[2px] h-32">
                {(() => {
                  const maxVal = Math.max(...days.map((d) => inspByDay[d] || 0), 1);
                  return days.map((day) => {
                  const count = inspByDay[day] || 0;
                  const height = (count / maxVal) * 100;
                  return (
                    <div
                      key={day}
                      className="flex-1 group relative"
                      title={`${new Date(day + 'T12:00:00').toLocaleDateString('pt-BR')}: ${count}`}
                    >
                      <div
                        className="w-full rounded-t bg-primary/70 hover:bg-primary transition-colors"
                        style={{
                          height: `${Math.max(height, count > 0 ? 4 : 0)}%`,
                          minHeight: count > 0 ? '4px' : '0',
                        }}
                      />
                    </div>
                  );
                });
                })()}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>
                  {new Date(days[0] + 'T12:00:00').toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
                <span>
                  {new Date(days[days.length - 1] + 'T12:00:00').toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Rankings */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Operadores com Mais Desvios
                </CardTitle>
                <CardDescription>Top 10 colaboradores observados</CardDescription>
              </CardHeader>
              <CardContent>
                {topOperatorsDeviations.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Nenhum desvio registrado no período.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {topOperatorsDeviations.map((op, idx) => {
                      const maxCount = topOperatorsDeviations[0]?.count || 1;
                      const pct = (op.count / maxCount) * 100;
                      return (
                        <div key={idx}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="truncate flex-1 mr-2">{op.name}</span>
                            <span className="font-semibold text-red-600 shrink-0">
                              {op.count}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-red-400 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Observadores</CardTitle>
                <CardDescription>Quem mais realizou inspeções</CardDescription>
              </CardHeader>
              <CardContent>
                {topObservers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Nenhuma inspeção no período.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {topObservers.map((ob, idx) => {
                      const maxCount = topObservers[0]?.count || 1;
                      const pct = (ob.count / maxCount) * 100;
                      return (
                        <div key={idx}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="truncate flex-1 mr-2">{ob.name}</span>
                            <span className="font-semibold text-blue-600 shrink-0">
                              {ob.count}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-400 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
