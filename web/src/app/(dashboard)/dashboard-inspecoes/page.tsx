'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Eye,
  TrendingUp,
  Users,
  ExternalLink,
} from 'lucide-react';
import { PieChart, BarChart, TimelineChart } from '../dashboard/charts';

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
  const [filterObserver, setFilterObserver] = useState('');
  const [filterOperator, setFilterOperator] = useState('');

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

  // ── Filter options ──
  const observerOptions = useMemo(() => {
    const ids = [...new Set(inspections.map((i) => i.observer_id))];
    return ids
      .map((id) => ({ id, name: profiles[id]?.full_name ?? 'Desconhecido' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inspections, profiles]);

  const operatorOptions = useMemo(() => {
    const ids = [...new Set(inspections.map((i) => i.operator_id))];
    return ids
      .map((id) => ({ id, name: profiles[id]?.full_name ?? 'Desconhecido' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inspections, profiles]);

  // ── Filtered data ──
  const filtered = useMemo(() => {
    let fi = inspections;
    if (filterObserver) fi = fi.filter((i) => i.observer_id === filterObserver);
    if (filterOperator) fi = fi.filter((i) => i.operator_id === filterOperator);
    const ids = new Set(fi.map((i) => i.id));
    return {
      inspections: fi,
      items: items.filter((it) => ids.has(it.inspection_id)),
      deviations: deviations.filter((d) => ids.has(d.inspection_id)),
    };
  }, [inspections, items, deviations, filterObserver, filterOperator]);

  // ── Computed stats ──
  const stats = useMemo(() => {
    const total = filtered.inspections.length;
    const safe = filtered.inspections.filter((i) => i.overall_classification === 'safe').length;
    const attention = filtered.inspections.filter((i) => i.overall_classification === 'attention').length;
    const critical = filtered.inspections.filter((i) => i.overall_classification === 'critical').length;
    const totalDeviations = filtered.deviations.length;
    const openDeviations = filtered.deviations.filter((d) => d.status === 'open').length;
    const safeRate = total > 0 ? Math.round((safe / total) * 100) : 0;
    const uniqueObservers = new Set(filtered.inspections.map((i) => i.observer_id)).size;
    const uniqueOperators = new Set(filtered.inspections.map((i) => i.operator_id)).size;
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
  }, [filtered]);

  // NC rate by category
  const ncByCategory = useMemo(() => {
    const catMap: Record<Category, { total: number; nao: number }> = {} as Record<Category, { total: number; nao: number }>;
    const cats = Object.keys(CATEGORY_LABELS) as Category[];
    cats.forEach((c) => (catMap[c] = { total: 0, nao: 0 }));
    filtered.items.forEach((it) => {
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
  }, [filtered.items]);

  // Deviations by risk level
  const devsByRisk = useMemo(() => {
    const map: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    filtered.deviations.forEach((d) => {
      if (map[d.risk_level as RiskLevel] !== undefined) map[d.risk_level as RiskLevel]++;
    });
    return (Object.entries(map) as [RiskLevel, number][]).map(([k, v]) => ({
      level: k,
      label: RISK_LABELS[k],
      count: v,
      color: RISK_COLORS[k],
    }));
  }, [filtered.deviations]);

  // Classification distribution
  const classificationDist = useMemo(() => {
    const map: Record<Classification, number> = { safe: 0, attention: 0, critical: 0 };
    filtered.inspections.forEach((i) => {
      if (i.overall_classification && map[i.overall_classification] !== undefined)
        map[i.overall_classification]++;
    });
    return (Object.entries(map) as [Classification, number][]).map(([k, v]) => ({
      key: k,
      label: CLASSIFICATION_LABELS[k],
      count: v,
      color: CLASSIFICATION_COLORS[k],
    }));
  }, [filtered.inspections]);

  // Inspections per day
  const days = useMemo(() => fillDays(period), [period]);
  const inspByDay = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.inspections.forEach((i) => {
      map[i.date] = (map[i.date] || 0) + 1;
    });
    return map;
  }, [filtered.inspections]);

  // Top operators with most deviations
  const topOperatorsDeviations = useMemo(() => {
    const inspMap = new Map<string, string>();
    filtered.inspections.forEach((i) => inspMap.set(i.id, i.operator_id));

    const countMap = new Map<string, number>();
    filtered.deviations.forEach((d) => {
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
  }, [filtered.deviations, filtered.inspections, profiles]);

  // Top observers
  const topObservers = useMemo(() => {
    const map = new Map<string, number>();
    filtered.inspections.forEach((i) => map.set(i.observer_id, (map.get(i.observer_id) || 0) + 1));
    return [...map.entries()]
      .map(([id, count]) => ({
        name: profiles[id]?.full_name ?? 'Desconhecido',
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filtered.inspections, profiles]);

  const [listClassFilter, setListClassFilter] = useState<'all' | Classification>('all');

  const listedInspections = useMemo(() => {
    let list = filtered.inspections;
    if (listClassFilter !== 'all') {
      list = list.filter((i) => i.overall_classification === listClassFilter);
    }
    return list.slice(0, 50);
  }, [filtered.inspections, listClassFilter]);

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
        <div className="flex flex-wrap items-center gap-2">
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

          <select
            value={filterObserver}
            onChange={(e) => setFilterObserver(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          >
            <option value="">Todos observadores</option>
            {observerOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>

          <select
            value={filterOperator}
            onChange={(e) => setFilterOperator(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          >
            <option value="">Todos observados</option>
            {operatorOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>

          {(filterObserver || filterOperator) && (
            <button
              onClick={() => { setFilterObserver(''); setFilterOperator(''); }}
              className="rounded-full px-2 py-1.5 text-xs font-medium border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              Limpar filtros
            </button>
          )}
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
              { label: 'Inspeções realizadas', value: stats.total, icon: Eye, color: 'text-foreground' },
              { label: '% Comportamento Seguro', value: `${stats.safeRate}%`, icon: TrendingUp, color: 'text-emerald-600' },
              { label: 'Classificadas como Seguras', value: stats.safe, icon: CheckCircle2, color: 'text-emerald-600' },
              { label: 'Oportunidades de Melhoria', value: stats.attention, icon: AlertTriangle, color: 'text-yellow-600' },
              { label: 'Comportamento de Risco', value: stats.critical, icon: ShieldCheck, color: 'text-red-600' },
              { label: 'Desvios registrados', value: stats.totalDeviations, icon: AlertTriangle, color: 'text-red-600' },
              { label: 'Desvios ainda abertos', value: stats.openDeviations, icon: AlertTriangle, color: 'text-orange-600' },
              { label: 'Pessoas que inspecionaram', value: stats.uniqueObservers, icon: Users, color: 'text-blue-600' },
              { label: 'Colaboradores observados', value: stats.uniqueOperators, icon: Users, color: 'text-purple-600' },
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
                <CardTitle className="text-base">Resultado geral das inspeções</CardTitle>
                <CardDescription>Quantas inspeções foram classificadas como seguras, oportunidade de melhoria ou comportamento de risco</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <PieChart
                    segments={classificationDist.map((c) => ({
                      value: c.count,
                      color: c.color,
                      label: c.label,
                    }))}
                    size={160}
                    centerLabel={`${stats.total}`}
                  />
                  <div className="space-y-2 flex-1">
                    {classificationDist.map((c) => {
                      const pct = stats.total > 0 ? Math.round((c.count / stats.total) * 100) : 0;
                      return (
                        <div key={c.key} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-sm shrink-0"
                              style={{ backgroundColor: c.color }}
                            />
                            {c.label}
                          </span>
                          <span className="font-semibold">
                            {c.count}{' '}
                            <span className="text-muted-foreground font-normal">({pct}%)</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Gravidade dos desvios encontrados</CardTitle>
                <CardDescription>Quantidade de desvios agrupados por nível de risco (baixo, médio, alto, crítico)</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.totalDeviations === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Nenhum desvio registrado no período.
                  </p>
                ) : (
                  <div className="flex items-center gap-6">
                    <PieChart
                      segments={devsByRisk.map((d) => ({
                        value: d.count,
                        color: d.color,
                        label: d.label,
                      }))}
                      size={160}
                      centerLabel={`${stats.totalDeviations}`}
                    />
                    <div className="space-y-2 flex-1">
                      {devsByRisk.map((d) => {
                        const pct = stats.totalDeviations > 0 ? Math.round((d.count / stats.totalDeviations) * 100) : 0;
                        return (
                          <div key={d.level} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 rounded-sm shrink-0"
                                style={{ backgroundColor: d.color }}
                              />
                              {d.label}
                            </span>
                            <span className="font-semibold">
                              {d.count}{' '}
                              <span className="text-muted-foreground font-normal">({pct}%)</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* NC Rate by Category */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Onde estão os problemas? (% de &quot;Não&quot; por categoria)
              </CardTitle>
              <CardDescription>
                Mostra em quais áreas do checklist comportamental os colaboradores mais descumprem — quanto maior a barra, mais respostas negativas naquela categoria
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                data={ncByCategory.map((cat) => ({
                  label: `${cat.label} (${cat.rate}%)`,
                  value: cat.rate,
                }))}
                color="#f97316"
                labelWidth={200}
              />
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Volume diário de inspeções</CardTitle>
              <CardDescription>Quantidade de inspeções realizadas por dia — mostra a frequência e regularidade das observações em campo</CardDescription>
            </CardHeader>
            <CardContent>
              <TimelineChart
                days={days}
                values={inspByDay}
                color="hsl(var(--primary))"
                label="Inspeções"
              />
            </CardContent>
          </Card>

          {/* Rankings */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Colaboradores com mais desvios
                </CardTitle>
                <CardDescription>Top 10 operadores que mais tiveram desvios comportamentais registrados — indica onde focar treinamento e acompanhamento</CardDescription>
              </CardHeader>
              <CardContent>
                {topOperatorsDeviations.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Nenhum desvio registrado no período.
                  </p>
                ) : (
                  <BarChart
                    data={topOperatorsDeviations.map((op) => ({
                      label: op.name,
                      value: op.count,
                    }))}
                    color="#ef4444"
                    labelWidth={140}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quem mais inspecionou</CardTitle>
                <CardDescription>Top 10 pessoas que mais realizaram inspeções comportamentais no período — mostra engajamento com segurança</CardDescription>
              </CardHeader>
              <CardContent>
                {topObservers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Nenhuma inspeção no período.
                  </p>
                ) : (
                  <BarChart
                    data={topObservers.map((ob) => ({
                      label: ob.name,
                      value: ob.count,
                    }))}
                    color="#3b82f6"
                    labelWidth={140}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Inspection List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inspeções realizadas no período</CardTitle>
              <CardDescription>Clique em uma inspeção para ver os detalhes na página de inspeções</CardDescription>
              <div className="flex gap-2 flex-wrap pt-2">
                {([
                  ['all', 'Todas'],
                  ['safe', 'Seguras'],
                  ['attention', 'Oportunidade de Melhoria'],
                  ['critical', 'Comportamento de Risco'],
                ] as ['all' | Classification, string][]).map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setListClassFilter(v)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      listClassFilter === v
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {listedInspections.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhuma inspeção encontrada com os filtros selecionados.
                </p>
              ) : (
                <div className="space-y-2">
                  {listedInspections.map((insp) => {
                    const cls = insp.overall_classification;
                    const badgeVariant = cls === 'safe' ? 'success' : cls === 'attention' ? 'warning' : cls === 'critical' ? 'danger' : 'outline';
                    const badgeLabel = cls ? CLASSIFICATION_LABELS[cls] : 'Sem classificação';
                    return (
                      <Link
                        key={insp.id}
                        href={`/inspecao-comportamental?id=${insp.id}`}
                        className="flex items-center justify-between gap-4 rounded-md border p-3 hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">
                              {profiles[insp.operator_id]?.full_name ?? 'Desconhecido'}
                            </span>
                            <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {insp.date}
                            {profiles[insp.observer_id]?.full_name
                              ? ` • Observador: ${profiles[insp.observer_id].full_name}`
                              : ''}
                          </p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </Link>
                    );
                  })}
                  {filtered.inspections.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      Mostrando as 50 mais recentes de {filtered.inspections.length} inspeções.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
