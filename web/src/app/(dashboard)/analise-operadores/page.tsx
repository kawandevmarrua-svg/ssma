'use client';

import { useEffect, useMemo, useState, useCallback, Fragment } from 'react';
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
  TrendingDown,
  Minus,
  ChevronDown,
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
  scoreParts: ScoreParts;
}

interface ScoreParts {
  hours: number;
  release: number;
  activity: number;
  inspection: number;
  interf: number;
}

const SCORE_DIMENSIONS: { key: keyof ScoreParts; label: string; max: number; color: string }[] = [
  { key: 'hours', label: 'Horas trabalhadas', max: 40, color: '#f97316' },
  { key: 'release', label: 'Liberação de checklists', max: 20, color: '#10b981' },
  { key: 'activity', label: 'Atividades concluídas', max: 20, color: '#3b82f6' },
  { key: 'inspection', label: 'Inspeções registradas', max: 10, color: '#8b5cf6' },
  { key: 'interf', label: 'Sem interferência', max: 10, color: '#64748b' },
];

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

// Composite productivity score 0-100, with per-dimension breakdown
function computeScore(m: OperatorMetrics, maxHours: number, maxActivities: number, maxInspections: number): { total: number; parts: ScoreParts } {
  const releaseRate = m.checklistsCount > 0 ? m.checklistsReleased / m.checklistsCount : 1;
  const interfRate = (m.activitiesCount + m.checklistsCount) > 0
    ? m.interferenceCount / (m.activitiesCount + m.checklistsCount) : 0;
  const parts: ScoreParts = {
    hours: maxHours > 0 ? (m.hours / maxHours) * 40 : 0,
    release: releaseRate * 20,
    activity: maxActivities > 0 ? (m.activitiesCompleted / maxActivities) * 20 : 0,
    inspection: maxInspections > 0 ? (m.inspectionsCount / maxInspections) * 10 : 0,
    interf: (1 - Math.min(interfRate, 1)) * 10,
  };
  const total = Math.round(parts.hours + parts.release + parts.activity + parts.inspection + parts.interf);
  return { total, parts };
}

// Pure metric builder — reusable for current and previous periods
function buildMetrics(
  operators: OperatorRow[],
  activities: ActivityRow[],
  checklists: ChecklistRow[],
  inspections: InspectionRow[],
): OperatorMetrics[] {
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
      scoreParts: { hours: 0, release: 0, activity: 0, inspection: 0, interf: 0 },
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
    const res = computeScore(m, maxHours, maxActivities, maxInspections);
    m.score = res.total;
    m.scoreParts = res.parts;
  }
  return all.filter((m) => m.activitiesCount > 0 || m.checklistsCount > 0 || m.inspectionsCount > 0);
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (score >= 50) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

const KPI_TONES = {
  good: 'text-emerald-700 [&_.kpi-icon]:text-emerald-500',
  warn: 'text-amber-700 [&_.kpi-icon]:text-amber-500',
  bad: 'text-red-700 [&_.kpi-icon]:text-red-500',
  neutral: 'text-foreground [&_.kpi-icon]:text-muted-foreground',
} as const;

function KpiCard({ icon, label, value, hint, tone }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: keyof typeof KPI_TONES;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
          <span className="kpi-icon">{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        <p className={cn('text-2xl font-bold leading-none tabular-nums', KPI_TONES[tone])}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1.5 truncate" title={hint}>{hint}</p>
      </CardContent>
    </Card>
  );
}

// Trend pill comparing to previous period. `delta` in score points.
function DeltaBadge({ delta, className }: { delta: number | null; className?: string }) {
  if (delta == null) {
    return <span className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground', className)}><Minus className="h-3 w-3" />sem base anterior</span>;
  }
  if (delta === 0) {
    return <span className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground', className)}><Minus className="h-3 w-3" />estável</span>;
  }
  const up = delta > 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', up ? 'text-emerald-600' : 'text-red-600', className)}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{delta} pts
    </span>
  );
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
  const [prevActivities, setPrevActivities] = useState<ActivityRow[]>([]);
  const [prevChecklists, setPrevChecklists] = useState<ChecklistRow[]>([]);
  const [prevInspections, setPrevInspections] = useState<InspectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('30d');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [showHelp, setShowHelp] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const periodFrom = useMemo(() => getPeriodFrom(period), [period]);
  // Previous window of equal length, immediately before periodFrom
  const prevFrom = useMemo(() => {
    const d = new Date(periodFrom);
    d.setDate(d.getDate() - periodToDays(period));
    return d.toISOString().split('T')[0];
  }, [periodFrom, period]);
  const periodInline = fmtPeriodInline(period);
  const periodLabel = fmtPeriodLabel(period);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [opRes, actRes, clRes, insRes, pActRes, pClRes, pInsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name').eq('role', 'operator').eq('active', true).order('full_name'),
      supabase.from('activities').select('id, operator_id, date, start_time, end_time, had_interference').gte('date', periodFrom),
      supabase.from('checklists').select('id, operator_id, date, created_at, ended_at, result, had_interference').gte('date', periodFrom),
      supabase.from('behavioral_inspections').select('id, operator_id, date').gte('date', periodFrom),
      supabase.from('activities').select('id, operator_id, date, start_time, end_time, had_interference').gte('date', prevFrom).lt('date', periodFrom),
      supabase.from('checklists').select('id, operator_id, date, created_at, ended_at, result, had_interference').gte('date', prevFrom).lt('date', periodFrom),
      supabase.from('behavioral_inspections').select('id, operator_id, date').gte('date', prevFrom).lt('date', periodFrom),
    ]);
    setOperators((opRes.data as OperatorRow[] | null) ?? []);
    setActivities((actRes.data as ActivityRow[] | null) ?? []);
    setChecklists((clRes.data as ChecklistRow[] | null) ?? []);
    setInspections((insRes.data as InspectionRow[] | null) ?? []);
    setPrevActivities((pActRes.data as ActivityRow[] | null) ?? []);
    setPrevChecklists((pClRes.data as ChecklistRow[] | null) ?? []);
    setPrevInspections((pInsRes.data as InspectionRow[] | null) ?? []);
    setLoading(false);
  }, [supabase, periodFrom, prevFrom]);

  useEffect(() => { loadData(); }, [loadData]);

  // Compute metrics per operator (current + previous period)
  const metrics = useMemo(
    () => buildMetrics(operators, activities, checklists, inspections),
    [operators, activities, checklists, inspections],
  );
  const prevMetrics = useMemo(
    () => buildMetrics(operators, prevActivities, prevChecklists, prevInspections),
    [operators, prevActivities, prevChecklists, prevInspections],
  );
  const prevScoreById = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of prevMetrics) map.set(m.id, m.score);
    return map;
  }, [prevMetrics]);

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
    const n = metrics.length;
    const totalH = metrics.reduce((s, m) => s + m.hours, 0);
    const totalAct = metrics.reduce((s, m) => s + m.activitiesCompleted, 0);
    const totalActAll = metrics.reduce((s, m) => s + m.activitiesCount, 0);
    const totalCl = metrics.reduce((s, m) => s + m.checklistsCount, 0);
    const totalClReleased = metrics.reduce((s, m) => s + m.checklistsReleased, 0);
    const totalClBlocked = metrics.reduce((s, m) => s + m.checklistsBlocked, 0);
    const totalIns = metrics.reduce((s, m) => s + m.inspectionsCount, 0);
    const totalInterf = metrics.reduce((s, m) => s + m.interferenceCount, 0);
    const avgScore = n > 0 ? Math.round(metrics.reduce((s, m) => s + m.score, 0) / n) : 0;
    const avgHours = n > 0 ? totalH / n : 0;
    const releaseRate = totalCl > 0 ? (totalClReleased / totalCl) * 100 : 0;
    const completionRate = totalActAll > 0 ? (totalAct / totalActAll) * 100 : 0;
    const interfRate = (totalActAll + totalCl) > 0 ? (totalInterf / (totalActAll + totalCl)) * 100 : 0;
    const pn = prevMetrics.length;
    const prevAvgScore = pn > 0 ? Math.round(prevMetrics.reduce((s, m) => s + m.score, 0) / pn) : null;
    const scoreDelta = prevAvgScore == null ? null : avgScore - prevAvgScore;
    return {
      n, totalH, totalAct, totalActAll, totalCl, totalClReleased, totalClBlocked,
      totalIns, totalInterf, avgScore, avgHours, releaseRate, completionRate, interfRate,
      prevAvgScore, scoreDelta,
    };
  }, [metrics, prevMetrics]);

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
    const axes = ['Horas', 'Atividades', 'Checklists', 'Inspeções', 'Sem Interf.'];
    return axes.map((axis) => {
      const row: Record<string, number | string> = { axis };
      top5.forEach((m) => {
        const interfRate = (m.activitiesCount + m.checklistsCount) > 0
          ? m.interferenceCount / (m.activitiesCount + m.checklistsCount) : 0;
        let v = 0;
        if (axis === 'Horas') v = (m.hours / maxH) * 100;
        else if (axis === 'Atividades') v = (m.activitiesCompleted / maxAct) * 100;
        else if (axis === 'Checklists') v = (m.checklistsCount / maxCl) * 100;
        else if (axis === 'Inspeções') v = (m.inspectionsCount / maxIns) * 100;
        else v = (1 - Math.min(interfRate, 1)) * 100;
        row[m.id] = Math.round(v);
      });
      return row;
    });
  }, [metrics, sorted]);

  function exportCSV() {
    const headers = ['Operador', 'Score', 'Horas', 'Atividades', 'Concluídas', 'Checklists', 'Liberados', 'Bloqueados', 'Inspeções', 'Interferências'];
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
            Análise de Operadores
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
              <CardContent className="p-5 h-full flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-orange-700" />
                  <span className="text-xs text-orange-900/70 font-medium uppercase tracking-wide">Score Médio da Equipe</span>
                </div>
                <div className="flex items-end gap-4 flex-wrap">
                  <p className="text-4xl font-bold text-orange-900 leading-none">{summary.avgScore}<span className="text-xl text-orange-900/50">/100</span></p>
                  <div className="pb-1 space-y-0.5">
                    <DeltaBadge delta={summary.scoreDelta} />
                    <p className="text-xs text-orange-900/60">
                      {summary.n} {summary.n === 1 ? 'operador ativo' : 'operadores ativos'} · {periodInline}
                      {summary.prevAvgScore != null && <span> · período anterior {summary.prevAvgScore}</span>}
                    </p>
                  </div>
                </div>
                <div className="mt-auto pt-4 grid grid-cols-3 gap-3 text-xs">
                  <div className="flex flex-col">
                    <span className="text-orange-900/60">Horas totais</span>
                    <span className="font-semibold text-orange-900 tabular-nums">{fmtH(summary.totalH)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-orange-900/60">Média / operador</span>
                    <span className="font-semibold text-orange-900 tabular-nums">{fmtH(summary.avgHours)}</span>
                  </div>
                  {top3[0] && (
                    <div className="flex flex-col min-w-0">
                      <span className="text-orange-900/60">Melhor score</span>
                      <span className="font-semibold text-orange-900 truncate" title={top3[0].name}>
                        {top3[0].name.split(' ')[0]} · {top3[0].score}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" /> Atividades
                  </span>
                  <span className="text-lg font-semibold tabular-nums">{summary.totalAct}<span className="text-xs text-muted-foreground font-normal">/{summary.totalActAll}</span></span>
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

          {/* KPIs derivados */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Taxa de liberação"
              value={`${summary.releaseRate.toFixed(0)}%`}
              hint={`${summary.totalClReleased} liberados${summary.totalClBlocked > 0 ? ` · ${summary.totalClBlocked} bloqueados` : ''}`}
              tone={summary.totalCl === 0 ? 'neutral' : summary.releaseRate >= 90 ? 'good' : summary.releaseRate >= 70 ? 'warn' : 'bad'}
            />
            <KpiCard
              icon={<Activity className="h-4 w-4" />}
              label="Conclusão de atividades"
              value={`${summary.completionRate.toFixed(0)}%`}
              hint={`${summary.totalAct} de ${summary.totalActAll} concluídas`}
              tone={summary.totalActAll === 0 ? 'neutral' : summary.completionRate >= 90 ? 'good' : summary.completionRate >= 70 ? 'warn' : 'bad'}
            />
            <KpiCard
              icon={<Clock className="h-4 w-4" />}
              label="Média de horas / operador"
              value={fmtH(summary.avgHours)}
              hint={`${fmtH(summary.totalH)} no total`}
              tone="neutral"
            />
            <KpiCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Taxa de interferência"
              value={`${summary.interfRate.toFixed(0)}%`}
              hint={`${summary.totalInterf} eventos com interferência`}
              tone={summary.interfRate === 0 ? 'good' : summary.interfRate <= 10 ? 'warn' : 'bad'}
            />
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
              <p className="text-xs text-muted-foreground mt-0.5">
                {filtered.length} operadores com atividade no período · clique numa linha para ver a composição do score
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="border-b bg-muted/30 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:bg-transparent">
                    <TableHead className="text-left px-4 py-2.5 font-medium w-12">#</TableHead>
                    <TableHead className="text-left px-4 py-2.5 font-medium">Operador</TableHead>
                    <TableHead className="text-left px-4 py-2.5 font-medium hidden md:table-cell" title="Horas trabalhadas (atividades concluídas + tempo de checklists)">Horas</TableHead>
                    <TableHead className="text-left px-4 py-2.5 font-medium hidden md:table-cell" title="Atividades concluídas / total de atividades no período">Atividades</TableHead>
                    <TableHead className="text-left px-4 py-2.5 font-medium hidden lg:table-cell" title="Checklists pré-operação realizados (bloqueados destacados em vermelho)">Checklists</TableHead>
                    <TableHead className="text-left px-4 py-2.5 font-medium hidden lg:table-cell" title="Inspeções comportamentais registradas">Inspeções</TableHead>
                    <TableHead className="text-left px-4 py-2.5 font-medium hidden xl:table-cell" title="Eventos com interferência reportada">Interf.</TableHead>
                    <TableHead className="text-right px-4 py-2.5 font-medium" title="Score composto 0–100. Seta mostra variação vs período anterior">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y">
                  {filtered.map((m, idx) => {
                    const totalEv = m.activitiesCount + m.checklistsCount;
                    const interfPct = totalEv > 0 ? (m.interferenceCount / totalEv) * 100 : 0;
                    const rankColor = idx < 3 ? MEDAL_COLORS[idx] : '#94a3b8';
                    const prevScore = prevScoreById.get(m.id);
                    const delta = prevScore == null ? null : m.score - prevScore;
                    const expanded = expandedId === m.id;
                    return (
                      <Fragment key={m.id}>
                      <TableRow
                        onClick={() => setExpandedId(expanded ? null : m.id)}
                        className="hover:bg-muted/40 transition-colors cursor-pointer animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
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
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <div className="flex flex-col items-end gap-0.5">
                              <Badge variant="plain" className={cn('text-sm font-bold px-2.5 py-1 border tabular-nums', scoreColor(m.score))}>
                                <Award className="h-3.5 w-3.5" />
                                {m.score}
                              </Badge>
                              {delta != null && delta !== 0 && (
                                <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium tabular-nums', delta > 0 ? 'text-emerald-600' : 'text-red-600')}>
                                  {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                  {delta > 0 ? '+' : ''}{delta}
                                </span>
                              )}
                            </div>
                            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', expanded && 'rotate-180')} />
                          </div>
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={8} className="px-4 py-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Composição do score — {m.name}
                                </p>
                                {prevScore != null && (
                                  <span className="text-xs text-muted-foreground">
                                    período anterior: <span className="font-medium text-foreground tabular-nums">{prevScore}</span> · <DeltaBadge delta={delta} className="align-middle" />
                                  </span>
                                )}
                              </div>
                              <div className="grid gap-2">
                                {SCORE_DIMENSIONS.map((dim) => {
                                  const val = m.scoreParts[dim.key];
                                  const pct = (val / dim.max) * 100;
                                  return (
                                    <div key={dim.key} className="flex items-center gap-3">
                                      <span className="text-xs text-muted-foreground w-44 shrink-0">{dim.label}</span>
                                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: dim.color }} />
                                      </div>
                                      <span className="text-xs font-semibold tabular-nums w-16 text-right">
                                        {val.toFixed(1)}<span className="text-muted-foreground font-normal">/{dim.max}</span>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex items-center justify-end gap-2 border-t pt-2 text-xs">
                                <span className="text-muted-foreground">Total</span>
                                <span className="font-bold tabular-nums">{m.score}/100</span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      </Fragment>
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
