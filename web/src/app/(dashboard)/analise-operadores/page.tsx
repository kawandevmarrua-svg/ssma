'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/select';
import {
  Users,
  Search,
  Loader2,
  Clock,
  ListChecks,
  Activity,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  Award,
  Trophy,
  Medal,
  Download,
  HelpCircle,
  X,
  ArrowUpDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';
import {
  PeriodSelector,
  type AnalyticsPeriod,
  periodToDays,
  periodLabel as fmtPeriodLabel,
  periodInline as fmtPeriodInline,
} from '@/components/analytics/PeriodSelector';
import { exportCSV as sharedExportCSV, csvFilename } from '@/lib/export-csv';

type Period = AnalyticsPeriod;

interface OperatorRow {
  id: string;
  full_name: string | null;
}

interface ActivityRow {
  id: string;
  operator_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  had_interference: boolean;
}

interface ChecklistRow {
  id: string;
  operator_id: string;
  date: string;
  created_at: string;
  ended_at: string | null;
  result: string | null;
  had_interference: boolean;
}

interface InspectionRow {
  id: string;
  operator_id: string;
  date: string;
}

interface OperatorMetrics {
  id: string;
  name: string;
  hours: number;
  activitiesCount: number;
  activitiesCompleted: number;
  checklistsCount: number;
  checklistsReleased: number;
  checklistsBlocked: number;
  inspectionsCount: number;
  interferenceCount: number;
  releaseRate: number;
  completionRate: number;
  score: number;
}

type SortKey = 'score' | 'hours' | 'activities' | 'checklists' | 'inspections' | 'interferences';

const SCORE_PALETTE = ['#f97316', '#fb923c', '#fdba74', '#fed7aa'];
const MEDAL_COLORS = ['#fbbf24', '#9ca3af', '#d97706'];

function msToH(ms: number) { return ms / 3600000; }

function fmtH(h: number): string {
  if (h < 0.01) return '0h';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}min`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h${mins}min`;
}

function getPeriodFrom(period: Period) {
  const d = new Date();
  d.setDate(d.getDate() - periodToDays(period));
  return d.toISOString().split('T')[0];
}

// Composite productivity score 0-100
function computeScore(m: Omit<OperatorMetrics, 'score' | 'releaseRate' | 'completionRate'>, maxHours: number, maxActivities: number, maxInspections: number) {
  const hoursScore = maxHours > 0 ? (m.hours / maxHours) * 40 : 0;
  const releaseRate = m.checklistsCount > 0 ? m.checklistsReleased / m.checklistsCount : 1;
  const releaseScore = releaseRate * 20;
  const activityScore = maxActivities > 0 ? (m.activitiesCompleted / maxActivities) * 20 : 0;
  const inspectionScore = maxInspections > 0 ? (m.inspectionsCount / maxInspections) * 10 : 0;
  const interfRate = (m.activitiesCount + m.checklistsCount) > 0
    ? m.interferenceCount / (m.activitiesCount + m.checklistsCount) : 0;
  const interfScore = (1 - Math.min(interfRate, 1)) * 10;
  return Math.round(hoursScore + releaseScore + activityScore + inspectionScore + interfScore);
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (score >= 50) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-medium text-foreground mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color || p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{typeof p.value === 'number' ? p.value : p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function AnaliseOperadoresPage() {
  const supabase = useMemo(() => createClient(), []);
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('30d');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [showHelp, setShowHelp] = useState(false);

  const periodFrom = useMemo(() => getPeriodFrom(period), [period]);
  const periodInline = fmtPeriodInline(period);
  const periodLabel = fmtPeriodLabel(period);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [opRes, actRes, clRes, insRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name').eq('role', 'operator').eq('active', true).order('full_name'),
      supabase.from('activities').select('id, operator_id, date, start_time, end_time, had_interference').gte('date', periodFrom),
      supabase.from('checklists').select('id, operator_id, date, created_at, ended_at, result, had_interference').gte('date', periodFrom),
      supabase.from('behavioral_inspections').select('id, operator_id, date').gte('date', periodFrom),
    ]);
    setOperators((opRes.data as OperatorRow[] | null) ?? []);
    setActivities((actRes.data as ActivityRow[] | null) ?? []);
    setChecklists((clRes.data as ChecklistRow[] | null) ?? []);
    setInspections((insRes.data as InspectionRow[] | null) ?? []);
    setLoading(false);
  }, [supabase, periodFrom]);

  useEffect(() => { loadData(); }, [loadData]);

  // Compute metrics per operator
  const metrics = useMemo<OperatorMetrics[]>(() => {
    if (operators.length === 0) return [];

    const map = new Map<string, OperatorMetrics>();
    for (const op of operators) {
      map.set(op.id, {
        id: op.id,
        name: op.full_name || 'Sem nome',
        hours: 0,
        activitiesCount: 0,
        activitiesCompleted: 0,
        checklistsCount: 0,
        checklistsReleased: 0,
        checklistsBlocked: 0,
        inspectionsCount: 0,
        interferenceCount: 0,
        releaseRate: 0,
        completionRate: 0,
        score: 0,
      });
    }

    for (const a of activities) {
      const m = map.get(a.operator_id);
      if (!m) continue;
      m.activitiesCount++;
      if (a.start_time && a.end_time) {
        const dur = new Date(a.end_time).getTime() - new Date(a.start_time).getTime();
        if (dur > 0 && dur < 86400000) {
          m.hours += msToH(dur);
          m.activitiesCompleted++;
        }
      }
      if (a.had_interference) m.interferenceCount++;
    }
    for (const c of checklists) {
      const m = map.get(c.operator_id);
      if (!m) continue;
      m.checklistsCount++;
      if (c.created_at && c.ended_at) {
        const dur = new Date(c.ended_at).getTime() - new Date(c.created_at).getTime();
        if (dur > 0 && dur < 86400000) m.hours += msToH(dur);
      }
      if (c.result === 'released') m.checklistsReleased++;
      else if (c.result === 'not_released') m.checklistsBlocked++;
      if (c.had_interference) m.interferenceCount++;
    }
    for (const i of inspections) {
      const m = map.get(i.operator_id);
      if (m) m.inspectionsCount++;
    }

    const all = [...map.values()];
    const maxHours = Math.max(...all.map((m) => m.hours), 0.01);
    const maxActivities = Math.max(...all.map((m) => m.activitiesCompleted), 1);
    const maxInspections = Math.max(...all.map((m) => m.inspectionsCount), 1);

    for (const m of all) {
      m.releaseRate = m.checklistsCount > 0 ? m.checklistsReleased / m.checklistsCount : 0;
      m.completionRate = m.activitiesCount > 0 ? m.activitiesCompleted / m.activitiesCount : 0;
      m.score = computeScore(m, maxHours, maxActivities, maxInspections);
    }

    return all.filter((m) => m.activitiesCount > 0 || m.checklistsCount > 0 || m.inspectionsCount > 0);
  }, [operators, activities, checklists, inspections]);

  const sorted = useMemo(() => {
    const arr = [...metrics];
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'hours': return b.hours - a.hours;
        case 'activities': return b.activitiesCompleted - a.activitiesCompleted;
        case 'checklists': return b.checklistsCount - a.checklistsCount;
        case 'inspections': return b.inspectionsCount - a.inspectionsCount;
        case 'interferences': return a.interferenceCount - b.interferenceCount;
        default: return b.score - a.score;
      }
    });
    return arr;
  }, [metrics, sortKey]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter((m) => m.name.toLowerCase().includes(q));
  }, [sorted, search]);

  const summary = useMemo(() => {
    const totalH = metrics.reduce((s, m) => s + m.hours, 0);
    const totalAct = metrics.reduce((s, m) => s + m.activitiesCompleted, 0);
    const totalCl = metrics.reduce((s, m) => s + m.checklistsCount, 0);
    const totalIns = metrics.reduce((s, m) => s + m.inspectionsCount, 0);
    const totalInterf = metrics.reduce((s, m) => s + m.interferenceCount, 0);
    const avgScore = metrics.length > 0 ? Math.round(metrics.reduce((s, m) => s + m.score, 0) / metrics.length) : 0;
    return { totalH, totalAct, totalCl, totalIns, totalInterf, avgScore };
  }, [metrics]);

  const top3 = useMemo(() => sorted.slice(0, 3), [sorted]);

  // Short display name with dedup suffix when first name collides
  const shortNameById = useMemo(() => {
    const firstNameUsage = new Map<string, OperatorMetrics[]>();
    for (const m of sorted) {
      const first = m.name.split(' ')[0] || m.name;
      const list = firstNameUsage.get(first) ?? [];
      list.push(m);
      firstNameUsage.set(first, list);
    }
    const result = new Map<string, string>();
    for (const [first, list] of firstNameUsage) {
      if (list.length === 1) {
        result.set(list[0].id, first);
      } else {
        for (const m of list) {
          const parts = m.name.split(' ');
          const surname = parts.length > 1 ? ` ${parts[parts.length - 1][0]}.` : '';
          result.set(m.id, `${first}${surname}`);
        }
      }
    }
    return result;
  }, [sorted]);

  // Bar chart data — top 10 by score (keyed by id, displayed by short name)
  const barData = useMemo(() => {
    return sorted.slice(0, 10).map((m) => ({
      id: m.id,
      name: shortNameById.get(m.id) ?? m.name,
      score: m.score,
      hours: Math.round(m.hours * 10) / 10,
    }));
  }, [sorted, shortNameById]);

  // Radar — top 5 normalized. Series keyed by operator id (collision-safe).
  const radarSeries = useMemo(() => sorted.slice(0, 5).map((m) => ({
    id: m.id,
    label: shortNameById.get(m.id) ?? m.name,
  })), [sorted, shortNameById]);

  const radarData = useMemo(() => {
    if (metrics.length === 0) return [];
    const top5 = sorted.slice(0, 5);
    const maxH = Math.max(...metrics.map((m) => m.hours), 0.01);
    const maxAct = Math.max(...metrics.map((m) => m.activitiesCompleted), 1);
    const maxCl = Math.max(...metrics.map((m) => m.checklistsCount), 1);
    const maxIns = Math.max(...metrics.map((m) => m.inspectionsCount), 1);
    const axes = ['Horas', 'Atividades', 'Checklists', 'Inspecoes', 'Sem Interf.'];
    return axes.map((axis) => {
      const row: Record<string, number | string> = { axis };
      top5.forEach((m) => {
        const interfRate = (m.activitiesCount + m.checklistsCount) > 0
          ? m.interferenceCount / (m.activitiesCount + m.checklistsCount) : 0;
        let v = 0;
        if (axis === 'Horas') v = (m.hours / maxH) * 100;
        else if (axis === 'Atividades') v = (m.activitiesCompleted / maxAct) * 100;
        else if (axis === 'Checklists') v = (m.checklistsCount / maxCl) * 100;
        else if (axis === 'Inspecoes') v = (m.inspectionsCount / maxIns) * 100;
        else v = (1 - Math.min(interfRate, 1)) * 100;
        row[m.id] = Math.round(v);
      });
      return row;
    });
  }, [metrics, sorted]);

  function exportCSV() {
    const headers = ['Operador', 'Score', 'Horas', 'Atividades', 'Concluidas', 'Checklists', 'Liberados', 'Bloqueados', 'Inspecoes', 'Interferencias'];
    const rows = filtered.map((m) => [
      m.name, m.score, fmtH(m.hours), m.activitiesCount, m.activitiesCompleted,
      m.checklistsCount, m.checklistsReleased, m.checklistsBlocked, m.inspectionsCount, m.interferenceCount,
    ]);
    sharedExportCSV(csvFilename('operadores'), headers, rows);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            Analise de Operadores
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHelp(!showHelp)}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <HelpCircle className="h-5 w-5" />
            </Button>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Comparativo de produtividade entre operadores.</p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {showHelp && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-sm">Como o score é calculado?</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHelp(false)}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Score composto 0–100 que pondera 5 dimensões de produtividade:
            </p>
            <div className="grid md:grid-cols-5 gap-2 text-xs">
              <div className="rounded-lg p-3 border bg-muted/30">
                <p className="font-semibold mb-1">Horas (40%)</p>
                <p className="text-muted-foreground">Tempo trabalhado em atividades e checklists.</p>
              </div>
              <div className="rounded-lg p-3 border bg-muted/30">
                <p className="font-semibold mb-1">Liberação (20%)</p>
                <p className="text-muted-foreground">% de checklists liberados sobre total.</p>
              </div>
              <div className="rounded-lg p-3 border bg-muted/30">
                <p className="font-semibold mb-1">Atividades (20%)</p>
                <p className="text-muted-foreground">Atividades concluídas no período.</p>
              </div>
              <div className="rounded-lg p-3 border bg-muted/30">
                <p className="font-semibold mb-1">Inspeções (10%)</p>
                <p className="text-muted-foreground">Inspeções comportamentais registradas.</p>
              </div>
              <div className="rounded-lg p-3 border bg-muted/30">
                <p className="font-semibold mb-1">Sem interferência (10%)</p>
                <p className="text-muted-foreground">Baixa frequência de interferência.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar operador..." className="pl-9 h-8 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>Ordenar:</span>
            <Select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-7 w-auto min-w-[140px] text-xs"
            >
              <option value="score">Score</option>
              <option value="hours">Horas</option>
              <option value="activities">Atividades</option>
              <option value="checklists">Checklists</option>
              <option value="inspections">Inspeções</option>
              <option value="interferences">Menos interferências</option>
            </Select>
          </div>
          {filtered.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              className="ml-auto h-8 gap-1 px-2.5 text-xs text-muted-foreground"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : metrics.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Sem dados no período ({periodLabel}).</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="md:col-span-2 bg-gradient-to-br from-orange-50 to-orange-100/40 border-orange-200/60">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-orange-700" />
                  <span className="text-xs text-orange-900/70 font-medium uppercase tracking-wide">Score Médio da Equipe</span>
                </div>
                <div className="flex items-end gap-4 flex-wrap">
                  <p className="text-4xl font-bold text-orange-900 leading-none">{summary.avgScore}<span className="text-xl text-orange-900/50">/100</span></p>
                  <p className="text-xs text-orange-900/60 pb-1">
                    {metrics.length} operadores ativos · {fmtH(summary.totalH)} totais · {periodInline}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" /> Atividades
                  </span>
                  <span className="text-lg font-semibold tabular-nums">{summary.totalAct}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ListChecks className="h-3.5 w-3.5" /> Checklists
                  </span>
                  <span className="text-lg font-semibold tabular-nums">{summary.totalCl}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" /> Inspeções
                  </span>
                  <span className="text-lg font-semibold tabular-nums">{summary.totalIns}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className={`text-xs flex items-center gap-1.5 ${summary.totalInterf > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                    <AlertTriangle className="h-3.5 w-3.5" /> Interferências
                  </span>
                  <span className={`text-lg font-semibold tabular-nums ${summary.totalInterf > 0 ? 'text-red-600' : ''}`}>{summary.totalInterf}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Podium top 3 */}
          {top3.length >= 1 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Pódio — Top 3 Operadores
                </CardTitle>
                <CardDescription>Maiores scores no período</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {top3.map((m, i) => (
                    <div key={m.id} className="rounded-xl border bg-card p-4 relative overflow-hidden">
                      <div
                        className="absolute top-0 right-0 px-3 py-1 rounded-bl-lg text-xs font-bold text-white"
                        style={{ backgroundColor: MEDAL_COLORS[i] }}
                      >
                        #{i + 1}
                      </div>
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white text-lg font-bold shadow-sm"
                          style={{ backgroundColor: MEDAL_COLORS[i] }}
                        >
                          <Medal className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{m.name}</p>
                          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${scoreColor(m.score)}`}>
                            score {m.score}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">Horas</span>
                          <span className="font-semibold tabular-nums">{fmtH(m.hours)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">Atividades</span>
                          <span className="font-semibold tabular-nums">{m.activitiesCompleted}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">Checklists</span>
                          <span className="font-semibold tabular-nums">{m.checklistsCount}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">Inspeções</span>
                          <span className="font-semibold tabular-nums">{m.inspectionsCount}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bar — top 10 by score */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ranking de Score</CardTitle>
                <CardDescription>Top 10 operadores no período</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData} layout="vertical" margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="score" name="Score" fill="#f97316" radius={[0, 6, 6, 0]} animationDuration={700} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Radar — top 5 multidimensional */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Perfil Multidimensional</CardTitle>
                <CardDescription>Top 5 normalizado por dimensão</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <PolarRadiusAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} domain={[0, 100]} />
                    {radarSeries.map((s, idx) => (
                      <Radar
                        key={s.id}
                        name={s.label}
                        dataKey={s.id}
                        stroke={SCORE_PALETTE[idx % SCORE_PALETTE.length]}
                        fill={SCORE_PALETTE[idx % SCORE_PALETTE.length]}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
                    <Tooltip content={<ChartTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Detailed list — table style like Usuários */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="border-b px-4 py-3">
              <h3 className="text-base font-semibold">Todos os Operadores</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{filtered.length} operadores com atividade no período</p>
            </div>
            <div className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="border-b bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:bg-transparent">
                    <TableHead className="text-left px-4 py-2.5 font-medium w-12">#</TableHead>
                    <TableHead className="text-left px-4 py-2.5 font-medium">Operador</TableHead>
                    <TableHead className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Horas</TableHead>
                    <TableHead className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Atividades</TableHead>
                    <TableHead className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Checklists</TableHead>
                    <TableHead className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Inspeções</TableHead>
                    <TableHead className="text-left px-4 py-2.5 font-medium hidden xl:table-cell">Interf.</TableHead>
                    <TableHead className="text-right px-4 py-2.5 font-medium">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y">
                  {filtered.map((m, idx) => {
                    const totalEv = m.activitiesCount + m.checklistsCount;
                    const interfPct = totalEv > 0 ? (m.interferenceCount / totalEv) * 100 : 0;
                    const rankColor = idx < 3 ? MEDAL_COLORS[idx] : '#94a3b8';
                    return (
                      <TableRow
                        key={m.id}
                        className="hover:bg-muted/40 transition-colors animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                        style={{
                          animationDuration: '420ms',
                          animationDelay: `${Math.min(idx, 15) * 40}ms`,
                          animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                        }}
                      >
                        <TableCell className="px-4 py-3">
                          <span
                            className="text-sm font-bold tabular-nums"
                            style={{ color: rankColor }}
                          >
                            #{idx + 1}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-sm font-semibold text-primary border border-primary/10">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate leading-tight">{m.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {m.releaseRate > 0 ? `${Math.round(m.releaseRate * 100)}% liberação` : '—'}
                                {interfPct > 0 && ` · ${interfPct.toFixed(0)}% interf`}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 hidden md:table-cell">
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                            <Clock className="h-3.5 w-3.5" />
                            {fmtH(m.hours)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 hidden md:table-cell">
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                            <Activity className="h-3.5 w-3.5" />
                            {m.activitiesCompleted}/{m.activitiesCount}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 hidden lg:table-cell">
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                            <ListChecks className="h-3.5 w-3.5" />
                            {m.checklistsCount}
                            {m.checklistsBlocked > 0 && <span className="text-red-600">({m.checklistsBlocked} bloq)</span>}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 hidden lg:table-cell">
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {m.inspectionsCount}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 hidden xl:table-cell">
                          {m.interferenceCount > 0 ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-red-600 tabular-nums">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {m.interferenceCount}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <Badge variant="plain" className={cn('text-sm font-bold px-2.5 py-1 border tabular-nums', scoreColor(m.score))}>
                            <Award className="h-3.5 w-3.5" />
                            {m.score}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
              <span>{filtered.length} {filtered.length === 1 ? 'operador' : 'operadores'}</span>
              <span>período <span className="font-medium text-foreground">{periodInline}</span></span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
