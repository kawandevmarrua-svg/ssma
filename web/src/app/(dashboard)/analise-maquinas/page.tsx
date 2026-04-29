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
import {
  HardHat,
  Search,
  Loader2,
  Clock,
  ListChecks,
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Users,
  Calendar,
  Download,
  HelpCircle,
  X,
} from 'lucide-react';
import {
  USE_MOCK,
  MOCK_OPERATORS,
  MOCK_MACHINES,
  seededRandom,
  pick,
} from '@/lib/mock-data';
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
import {
  PeriodSelector,
  type AnalyticsPeriod,
  periodToDays,
  periodLabel as fmtPeriodLabel,
  periodInline as fmtPeriodInline,
} from '@/components/analytics/PeriodSelector';
import { exportCSV as sharedExportCSV, csvFilename } from '@/lib/export-csv';

// ── Chart palette (orange-based, dashboard inspired waves) ──
const CHART = {
  checklist: '#fdba74',   // orange-300 — light wave
  activity: '#f97316',    // orange-500 — main wave
  released: '#f97316',    // orange-500
  blocked: '#dc2626',     // red-600
  pending: '#facc15',     // yellow-400
  accent: '#c2410c',      // orange-700
  light: '#fed7aa',       // orange-200
} as const;

const OPERATOR_PALETTE = [
  '#2563eb', // blue-600
  '#4f46e5', // indigo-600
  '#0891b2', // cyan-600
  '#0d9488', // teal-600
  '#059669', // emerald-600
  '#475569', // slate-600
  '#0284c7', // sky-600
  '#1d4ed8', // blue-700
];

// ── Types ──

interface MachineRow {
  id: string;
  name: string;
  tag: string | null;
  active: boolean;
}

interface ChecklistEntry {
  id: string;
  machine_name: string;
  machine_id: string | null;
  operator_id: string;
  date: string;
  created_at: string;
  ended_at: string | null;
  result: string | null;
  had_interference: boolean;
  profiles: { full_name: string | null } | null;
}

interface ActivityEntry {
  id: string;
  machine_id: string | null;
  operator_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  had_interference: boolean;
  profiles: { full_name: string | null } | null;
}

interface MachineAnalysis {
  id: string;
  name: string;
  tag: string | null;
  active: boolean;
  checklists: ChecklistEntry[];
  activities: ActivityEntry[];
}

// Standardized period across all "Analises" pages
type Period = AnalyticsPeriod;

// ── Mock ──

function generateMockMaquinas(period: Period) {
  const rand = seededRandom(77);
  const days = periodToDays(period);

  // Two showcase machines first: GOOD (high util, all released) and BAD (blocked + interferences)
  const machines: MachineRow[] = [
    { id: 'maq-good', name: 'Escavadeira EX-200', tag: 'E-12', active: true },
    { id: 'maq-bad', name: 'Retroescavadeira RB-08', tag: 'R-03', active: true },
    ...MOCK_MACHINES.slice(2).map((m) => ({ id: m.id, name: m.name, tag: m.tag, active: m.active })),
  ];
  const checklists: ChecklistEntry[] = [];
  const activities: ActivityEntry[] = [];

  const opName = (id: string) => MOCK_OPERATORS.find((o) => o.id === id)?.name || 'Operador';

  // ── GOOD CASE: Escavadeira EX-200 ──
  // ~30 checklists liberados, ~14 atividades longas, 0 interferências, distribuído entre 3 operadores
  const goodOps = ['op-joao', 'op-ricardo', 'op-andre'];
  for (let d = 0; d < Math.min(days, 30); d++) {
    const date = new Date(); date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];
    const opId = goodOps[d % 3];
    const clStart = new Date(date); clStart.setHours(6, 30 + (d % 4) * 5, 0);
    const clEnd = new Date(clStart.getTime() + (8 + (d % 3)) * 60000);
    checklists.push({
      id: `cl-good-${d}`, machine_name: 'Escavadeira EX-200', machine_id: 'maq-good',
      operator_id: opId, date: dateStr,
      created_at: clStart.toISOString(), ended_at: clEnd.toISOString(),
      result: 'released', had_interference: false,
      profiles: { full_name: opName(opId) },
    });
    if (d % 2 === 0) {
      const actStart = new Date(clEnd.getTime() + 25 * 60000);
      const actEnd = new Date(actStart.getTime() + (2 + (d % 4) * 0.3) * 3600000);
      activities.push({
        id: `act-good-${d}`, machine_id: 'maq-good', operator_id: opId, date: dateStr,
        start_time: actStart.toISOString(), end_time: actEnd.toISOString(),
        had_interference: false, profiles: { full_name: opName(opId) },
      });
    }
  }

  // ── BAD CASE: Retroescavadeira RB-08 ──
  // 8 checklists: 5 bloqueados, 1 pendente, 2 liberados; 5 interferências; 2 atividades curtas
  const badEvents: { day: number; result: 'released' | 'not_released' | 'pending'; interf: boolean; actInterf?: boolean }[] = [
    { day: 0, result: 'not_released', interf: true },
    { day: 1, result: 'not_released', interf: true },
    { day: 3, result: 'released', interf: false, actInterf: true },
    { day: 5, result: 'pending', interf: false },
    { day: 7, result: 'not_released', interf: true },
    { day: 10, result: 'released', interf: false, actInterf: true },
    { day: 14, result: 'not_released', interf: true },
    { day: 20, result: 'not_released', interf: true },
  ];
  for (const e of badEvents) {
    if (e.day >= days) continue;
    const date = new Date(); date.setDate(date.getDate() - e.day);
    const dateStr = date.toISOString().split('T')[0];
    const opId = 'op-carlos';
    const clStart = new Date(date); clStart.setHours(6, 0, 0);
    const clEnd = new Date(clStart.getTime() + (22 + (e.day % 5) * 2) * 60000);
    checklists.push({
      id: `cl-bad-${e.day}`, machine_name: 'Retroescavadeira RB-08', machine_id: 'maq-bad',
      operator_id: opId, date: dateStr,
      created_at: clStart.toISOString(), ended_at: clEnd.toISOString(),
      result: e.result, had_interference: e.interf,
      profiles: { full_name: opName(opId) },
    });
    if (e.result === 'released') {
      const actStart = new Date(clEnd.getTime() + 20 * 60000);
      const actEnd = new Date(actStart.getTime() + 1.75 * 3600000);
      activities.push({
        id: `act-bad-${e.day}`, machine_id: 'maq-bad', operator_id: opId, date: dateStr,
        start_time: actStart.toISOString(), end_time: actEnd.toISOString(),
        had_interference: !!e.actInterf, profiles: { full_name: opName(opId) },
      });
    }
  }

  // ── Other machines: light usage so the showcase pair stays at the top of the sort ──
  for (let d = 0; d < days; d++) {
    const date = new Date(); date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];
    for (const machine of MOCK_MACHINES.slice(2)) {
      if (!machine.active || rand() < 0.78) continue;
      const op = pick(MOCK_OPERATORS, rand);
      const clStart = new Date(date);
      clStart.setHours(5 + Math.floor(rand() * 2), Math.floor(rand() * 30), 0);
      const clEnd = new Date(clStart.getTime() + (10 + rand() * 18) * 60000);
      const hadInterf = rand() < 0.08;
      const result = hadInterf ? 'not_released' : rand() < 0.95 ? 'released' : 'pending';
      checklists.push({
        id: `cl-${d}-${machine.id}`, machine_name: machine.name, machine_id: machine.id,
        operator_id: op.id, date: dateStr,
        created_at: clStart.toISOString(), ended_at: clEnd.toISOString(),
        result, had_interference: hadInterf,
        profiles: { full_name: op.name },
      });
      if (result === 'released' && rand() < 0.45) {
        const actStart = new Date(clEnd.getTime() + rand() * 1200000);
        const actEnd = new Date(actStart.getTime() + (0.4 + rand() * 0.7) * 3600000);
        activities.push({
          id: `act-${d}-${machine.id}`, machine_id: machine.id,
          operator_id: op.id, date: dateStr,
          start_time: actStart.toISOString(), end_time: actEnd.toISOString(),
          had_interference: rand() < 0.04, profiles: { full_name: op.name },
        });
      }
    }
  }

  return { machines, checklists, activities };
}

// ── Helpers ──

function msToH(ms: number) { return ms / 3600000; }

function fmtH(h: number): string {
  if (h < 0.01) return '0h';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}min`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h${mins}min`;
}

function getPeriodRange(period: Period) {
  const days = periodToDays(period);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return { from: d.toISOString().split('T')[0], label: fmtPeriodLabel(period), days };
}

function clHours(list: ChecklistEntry[]) {
  let t = 0;
  for (const c of list) { if (c.ended_at && c.created_at) { const d = new Date(c.ended_at).getTime() - new Date(c.created_at).getTime(); if (d > 0 && d < 86400000) t += d; } }
  return msToH(t);
}

function actHours(list: ActivityEntry[]) {
  let t = 0;
  for (const a of list) { if (a.start_time && a.end_time) { const d = new Date(a.end_time).getTime() - new Date(a.start_time).getTime(); if (d > 0 && d < 86400000) t += d; } }
  return msToH(t);
}

function groupByOp(chk: ChecklistEntry[], act: ActivityEntry[]) {
  const map = new Map<string, { name: string; hours: number; count: number }>();
  for (const c of chk) {
    const e = map.get(c.operator_id) ?? { name: c.profiles?.full_name || 'Operador', hours: 0, count: 0 };
    e.count++;
    if (c.ended_at && c.created_at) { const d = new Date(c.ended_at).getTime() - new Date(c.created_at).getTime(); if (d > 0 && d < 86400000) e.hours += msToH(d); }
    map.set(c.operator_id, e);
  }
  for (const a of act) {
    const e = map.get(a.operator_id) ?? { name: a.profiles?.full_name || 'Operador', hours: 0, count: 0 };
    e.count++;
    if (a.start_time && a.end_time) { const d = new Date(a.end_time).getTime() - new Date(a.start_time).getTime(); if (d > 0 && d < 86400000) e.hours += msToH(d); }
    map.set(a.operator_id, e);
  }
  return [...map.entries()].map(([id, d]) => ({ id, ...d })).sort((a, b) => b.hours - a.hours);
}

function dailyBreakdown(chk: ChecklistEntry[], act: ActivityEntry[], days: number) {
  const result: { label: string; date: string; clH: number; actH: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    let cH = 0, aH = 0;
    for (const c of chk) { if (c.date === ds && c.ended_at && c.created_at) { const df = new Date(c.ended_at).getTime() - new Date(c.created_at).getTime(); if (df > 0 && df < 86400000) cH += msToH(df); } }
    for (const a of act) { if (a.date === ds && a.start_time && a.end_time) { const df = new Date(a.end_time).getTime() - new Date(a.start_time).getTime(); if (df > 0 && df < 86400000) aH += msToH(df); } }
    result.push({ label, date: ds, clH: cH, actH: aH });
  }
  return result;
}

function exportCSV(analyses: MachineAnalysis[]) {
  const headers = ['Maquina', 'Tag', 'Horas', 'Checklists', 'Atividades', 'Liberados', 'Bloqueados', 'Interferencias'];
  const rows = analyses.map((m) => {
    const h = clHours(m.checklists) + actHours(m.activities);
    const rel = m.checklists.filter((c) => c.result === 'released').length;
    const blk = m.checklists.filter((c) => c.result === 'not_released').length;
    const itf = m.checklists.filter((c) => c.had_interference).length + m.activities.filter((a) => a.had_interference).length;
    return [m.name, m.tag || '', fmtH(h), m.checklists.length, m.activities.length, rel, blk, itf];
  });
  sharedExportCSV(csvFilename('maquinas'), headers, rows);
}

// ── Tooltip for recharts ──

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-medium text-foreground mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color || p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{typeof p.value === 'number' ? fmtH(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Daily area chart with overlapping smooth curves (recharts) ──

function DailyChart({ data }: { data: { label: string; clH: number; actH: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-cl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.checklist} stopOpacity={0.7} />
            <stop offset="95%" stopColor={CHART.checklist} stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="grad-act" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.activity} stopOpacity={0.75} />
            <stop offset="95%" stopColor={CHART.activity} stopOpacity={0.15} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(0)}h`} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} iconType="circle" iconSize={8} />
        <Area type="monotone" dataKey="clH" name="Checklist" stroke={CHART.checklist} strokeWidth={2} fill="url(#grad-cl)" animationDuration={700} dot={false} activeDot={{ r: 4 }} />
        <Area type="monotone" dataKey="actH" name="Atividade" stroke={CHART.activity} strokeWidth={2} fill="url(#grad-act)" animationDuration={700} dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Donut chart for checklist results (recharts) ──

function ChecklistDonut({ released, blocked, pending }: { released: number; blocked: number; pending: number }) {
  const total = released + blocked + pending;
  if (total === 0) return null;
  const data = [
    { name: 'Liberados', value: released, fill: CHART.released },
    { name: 'Bloqueados', value: blocked, fill: CHART.blocked },
    { name: 'Pendentes', value: pending, fill: CHART.pending },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RePieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={56}
              dataKey="value"
              strokeWidth={2}
              stroke="hsl(var(--background))"
              animationDuration={700}
              paddingAngle={2}
            >
              {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </RePieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold text-foreground leading-none">{total}</span>
          <span className="text-[9px] text-muted-foreground mt-0.5">total</span>
        </div>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART.released }} /><span className="font-medium" style={{ color: CHART.accent }}>{released} liberados</span></div>
        {blocked > 0 && <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART.blocked }} /><span className="text-red-700 font-medium">{blocked} bloqueados</span></div>}
        {pending > 0 && <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART.pending }} /><span className="text-yellow-700 font-medium">{pending} pendentes</span></div>}
      </div>
    </div>
  );
}

// ── Hours split bar (checklist vs activity) ──

function HoursSplitBar({ clH, actH }: { clH: number; actH: number }) {
  const total = clH + actH;
  if (total < 0.01) return <div className="h-3 rounded-full bg-muted" />;
  const clPct = (clH / total) * 100;
  return (
    <div className="space-y-1">
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        <div className="transition-all" style={{ width: `${clPct}%`, backgroundColor: CHART.checklist }} />
        <div className="transition-all" style={{ width: `${100 - clPct}%`, backgroundColor: CHART.activity }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CHART.checklist }} />Checklist {fmtH(clH)}</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CHART.activity }} />Atividade {fmtH(actH)}</span>
      </div>
    </div>
  );
}

// ── Page ──

export default function AnaliseMaquinasPage() {
  const supabase = useMemo(() => createClient(), []);
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [checklists, setChecklists] = useState<ChecklistEntry[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('30d');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterOperator, setFilterOperator] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const { from: periodFrom, label: periodLabel, days: periodDays } = useMemo(() => getPeriodRange(period), [period]);
  const periodInline = fmtPeriodInline(period);

  const loadData = useCallback(async () => {
    setLoading(true);
    if (USE_MOCK) {
      const mock = generateMockMaquinas(period);
      setMachines(mock.machines); setChecklists(mock.checklists); setActivities(mock.activities);
      setLoading(false); return;
    }
    const [machRes, clRes, actRes] = await Promise.all([
      supabase.from('machines').select('id, name, tag, active').order('name'),
      supabase.from('checklists').select('id, machine_name, machine_id, operator_id, date, created_at, ended_at, result, had_interference, profiles(full_name)').gte('date', periodFrom).order('date', { ascending: false }),
      supabase.from('activities').select('id, machine_id, operator_id, date, start_time, end_time, had_interference, profiles(full_name)').gte('date', periodFrom).order('date', { ascending: false }),
    ]);
    setMachines((machRes.data as MachineRow[] | null) ?? []);
    setChecklists((clRes.data as ChecklistEntry[] | null) ?? []);
    setActivities((actRes.data as ActivityEntry[] | null) ?? []);
    setLoading(false);
  }, [supabase, period, periodFrom]);

  useEffect(() => { loadData(); }, [loadData]);

  // Operator filter list
  const operatorList = useMemo(() => {
    const map = new Map<string, string>();
    checklists.forEach((c) => { if (c.profiles?.full_name) map.set(c.operator_id, c.profiles.full_name); });
    activities.forEach((a) => { if (a.profiles?.full_name) map.set(a.operator_id, a.profiles.full_name); });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [checklists, activities]);

  // Apply operator filter
  const fChk = useMemo(() => filterOperator ? checklists.filter((c) => c.operator_id === filterOperator) : checklists, [checklists, filterOperator]);
  const fAct = useMemo(() => filterOperator ? activities.filter((a) => a.operator_id === filterOperator) : activities, [activities, filterOperator]);

  // Machine analyses
  const machineAnalyses = useMemo(() => {
    const analyses: MachineAnalysis[] = [];
    for (const m of machines) {
      const mc = fChk.filter((c) => c.machine_id === m.id || c.machine_name?.toLowerCase() === m.name.toLowerCase());
      const ma = fAct.filter((a) => a.machine_id === m.id);
      if (mc.length > 0 || ma.length > 0) analyses.push({ ...m, checklists: mc, activities: ma });
    }
    const matchedNames = new Set(machines.map((m) => m.name.toLowerCase()));
    const matchedIds = new Set(machines.map((m) => m.id));
    const unmatched = new Map<string, ChecklistEntry[]>();
    for (const c of fChk) {
      if (c.machine_id && matchedIds.has(c.machine_id)) continue;
      if (matchedNames.has(c.machine_name?.toLowerCase() || '')) continue;
      const k = c.machine_name || 'Desconhecida';
      if (!unmatched.has(k)) unmatched.set(k, []);
      unmatched.get(k)!.push(c);
    }
    for (const [name, cls] of unmatched) analyses.push({ id: `u-${name}`, name, tag: null, active: true, checklists: cls, activities: [] });
    analyses.sort((a, b) => (clHours(b.checklists) + actHours(b.activities)) - (clHours(a.checklists) + actHours(a.activities)));
    return analyses;
  }, [machines, fChk, fAct]);

  const filtered = useMemo(() => {
    if (!search.trim()) return machineAnalyses;
    const q = search.toLowerCase();
    return machineAnalyses.filter((m) => m.name.toLowerCase().includes(q) || (m.tag || '').toLowerCase().includes(q));
  }, [machineAnalyses, search]);

  // Summary
  const summary = useMemo(() => {
    const totalH = clHours(fChk) + actHours(fAct);
    const interf = fChk.filter((c) => c.had_interference).length + fAct.filter((a) => a.had_interference).length;
    const released = fChk.filter((c) => c.result === 'released').length;
    const blocked = fChk.filter((c) => c.result === 'not_released').length;
    const activeMachines = machines.filter((m) => m.active).length;
    return { totalH, interf, released, blocked, clCount: fChk.length, actCount: fAct.length, used: machineAnalyses.length, active: activeMachines };
  }, [fChk, fAct, machineAnalyses, machines]);

  const maxH = useMemo(() => Math.max(...filtered.map((m) => clHours(m.checklists) + actHours(m.activities)), 0.1), [filtered]);

  // Idle machines
  const idle = useMemo(() => {
    const usedIds = new Set(machineAnalyses.map((m) => m.id));
    return machines.filter((m) => m.active && !usedIds.has(m.id));
  }, [machines, machineAnalyses]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            Analise de Maquinas
            <button onClick={() => setShowHelp(!showHelp)} className="text-muted-foreground hover:text-foreground transition-colors">
              <HelpCircle className="h-5 w-5" />
            </button>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Horas trabalhadas e desempenho por maquina.</p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Help panel */}
      {showHelp && (
        <Card className="border-2 border-violet-200 bg-violet-50/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-sm">O que esta pagina mostra?</h3>
              <button onClick={() => setShowHelp(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Mostra o <strong>desempenho de cada maquina</strong> com base em horas de checklist e atividades. Permite identificar maquinas com problemas e comparar a frota.
            </p>
            <div className="grid md:grid-cols-3 gap-3 text-xs">
              <div className="bg-background rounded-lg p-3 border">
                <p className="font-bold text-blue-700 mb-1">Horas por Maquina</p>
                <p className="text-muted-foreground">Soma de horas de checklist (inspecao) + atividades (servico). Maquinas com poucas horas podem estar ociosas ou com problemas.</p>
              </div>
              <div className="bg-background rounded-lg p-3 border">
                <p className="font-bold text-violet-700 mb-1">Resultado dos Checklists</p>
                <p className="text-muted-foreground">Liberados, bloqueados e pendentes. Muitos bloqueios = maquina com defeitos recorrentes que precisa de manutencao.</p>
              </div>
              <div className="bg-background rounded-lg p-3 border">
                <p className="font-bold text-red-700 mb-1">Interferencias</p>
                <p className="text-muted-foreground">Eventos que impediram o trabalho normal. Alta frequencia de interferencia indica problemas sistematicos.</p>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              <strong>Decisoes que esta pagina responde:</strong> Quais maquinas estao produzindo mais? Quais estao sempre bloqueadas no checklist? Quais operadores mais usam cada maquina? A carga de trabalho esta balanceada entre os equipamentos?
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      {!loading && (
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)} className="rounded-md border border-border bg-background px-3 py-1.5 text-xs">
            <option value="">Todos os operadores</option>
            {operatorList.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar maquina..." className="pl-9 h-8 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {(filterOperator || search) && (
            <button onClick={() => { setFilterOperator(''); setSearch(''); }} className="text-xs text-muted-foreground hover:text-foreground underline">Limpar</button>
          )}
          {machineAnalyses.length > 0 && (
            <button onClick={() => exportCSV(machineAnalyses)} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors ml-auto">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Summary — 5 cards with cool palette */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2"><Clock className="h-4 w-4 text-blue-600" /><span className="text-xs text-muted-foreground font-medium">Horas Trabalhadas</span></div>
                <p className="text-3xl font-bold text-blue-700">{fmtH(summary.totalH)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{periodInline} ({periodLabel})</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2"><HardHat className="h-4 w-4 text-slate-600" /><span className="text-xs text-muted-foreground font-medium">Maquinas</span></div>
                <p className="text-3xl font-bold text-slate-700">{summary.used}<span className="text-base font-normal text-slate-400">/{summary.active}</span></p>
                <p className="text-[10px] text-muted-foreground mt-1">com registro {periodInline}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2"><ListChecks className="h-4 w-4 text-emerald-600" /><span className="text-xs text-muted-foreground font-medium">Checklists</span></div>
                <p className="text-3xl font-bold">{summary.clCount}</p>
                <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                  <span className="text-emerald-600 font-medium">{summary.released} lib.</span>
                  {summary.blocked > 0 && <span className="text-red-600 font-medium">{summary.blocked} bloq.</span>}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{periodInline}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2"><Activity className="h-4 w-4 text-indigo-600" /><span className="text-xs text-muted-foreground font-medium">Atividades</span></div>
                <p className="text-3xl font-bold text-indigo-700">{summary.actCount}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{periodInline}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2"><AlertTriangle className={`h-4 w-4 ${summary.interf > 0 ? 'text-red-600' : 'text-muted-foreground'}`} /><span className="text-xs text-muted-foreground font-medium">Interferencias</span></div>
                <p className={`text-3xl font-bold ${summary.interf > 0 ? 'text-red-600' : ''}`}>{summary.interf}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{periodInline}</p>
              </CardContent>
            </Card>
          </div>

          {/* Idle machines — subtle */}
          {idle.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-dashed p-3">
              <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium">
                  {idle.length} maquina{idle.length > 1 ? 's' : ''} sem registro no periodo
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {idle.map((m) => m.tag ? `${m.name} (${m.tag})` : m.name).join(' · ')}
                </p>
              </div>
            </div>
          )}

          {/* Machine list */}
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <HardHat className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">{search ? 'Nenhuma maquina encontrada.' : `Sem dados no periodo (${periodLabel}).`}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((m) => {
                const mClH = clHours(m.checklists);
                const mActH = actHours(m.activities);
                const totalH = mClH + mActH;
                const released = m.checklists.filter((c) => c.result === 'released').length;
                const blocked = m.checklists.filter((c) => c.result === 'not_released').length;
                const pending = m.checklists.length - released - blocked;
                const interf = m.checklists.filter((c) => c.had_interference).length + m.activities.filter((a) => a.had_interference).length;
                const isExpanded = expandedId === m.id;
                const ops = isExpanded ? groupByOp(m.checklists, m.activities) : [];
                const opSet = new Set<string>();
                m.checklists.forEach((c) => opSet.add(c.operator_id));
                m.activities.forEach((a) => opSet.add(a.operator_id));
                const opCount = opSet.size;
                const blockRate = m.checklists.length > 0 ? Math.round((blocked / m.checklists.length) * 100) : 0;
                const status: 'saudavel' | 'atencao' | 'critico' =
                  blocked >= 3 || interf >= 3 ? 'critico'
                  : blocked > 0 || pending > 0 || interf > 0 ? 'atencao'
                  : 'saudavel';
                const statusStyle = {
                  saudavel: { label: 'Saudavel', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                  atencao: { label: 'Atencao', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
                  critico: { label: 'Critico', cls: 'bg-red-50 text-red-700 border-red-200' },
                }[status];
                const numDays = periodToDays(period);
                const daily = isExpanded && numDays > 1 ? dailyBreakdown(m.checklists, m.activities, Math.min(numDays, 14)) : [];
                const pct = maxH > 0 ? (totalH / maxH) * 100 : 0;
                const clPct = totalH > 0 ? (mClH / totalH) * 100 : 0;

                return (
                  <Card key={m.id} className="overflow-hidden">
                    <button onClick={() => setExpandedId(isExpanded ? null : m.id)} className="w-full text-left">
                      <CardContent className="p-[23px]">
                        <div className="flex items-center gap-[19px]">
                          <div className={`flex h-[49px] w-[49px] shrink-0 items-center justify-center rounded-xl ${m.active ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}>
                            <HardHat className="h-[23px] w-[23px]" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-lg font-semibold truncate">{m.name}</span>
                              {m.tag && <span className="text-[13px] text-orange-700 font-mono bg-orange-100 px-2 py-[4px] rounded">{m.tag}</span>}
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-[4px] rounded-full border ${statusStyle.cls}`}>
                                {statusStyle.label}
                              </span>
                            </div>

                            {/* Stacked progress bar */}
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden max-w-md">
                                {totalH > 0 && <>
                                  <div className="h-full float-left rounded-l-full" style={{ width: `${clPct * pct / 100}%`, backgroundColor: CHART.checklist }} />
                                  <div className="h-full float-left rounded-r-full" style={{ width: `${(100 - clPct) * pct / 100}%`, backgroundColor: CHART.activity }} />
                                </>}
                              </div>
                              <div className="w-[92px] text-right shrink-0">
                                <p className="text-[21px] font-bold text-orange-700 leading-tight">{fmtH(totalH)}</p>
                                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{periodInline}</p>
                              </div>
                            </div>

                            <div className="mt-2.5 space-y-1 text-[13px] max-w-md">
                              <div className="flex items-start gap-2">
                                <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: CHART.checklist }} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="font-medium text-foreground">Inspeção pré-operação</span>
                                    <span className="text-foreground tabular-nums shrink-0"><span className="font-semibold">{fmtH(mClH)}</span> · {m.checklists.length} checklists</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-tight">tempo gasto preenchendo o checklist — não é produção</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: CHART.activity }} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="font-medium text-foreground">Operação produtiva</span>
                                    <span className="text-foreground tabular-nums shrink-0"><span className="font-semibold">{fmtH(mActH)}</span> · {m.activities.length} atividades</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-tight">tempo de trabalho real da máquina após liberação</p>
                                </div>
                              </div>
                            </div>

                            {/* Decision-support chips */}
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              {released > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-[4px] rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />{released} liberados
                                </span>
                              )}
                              {blocked > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-[4px] rounded-full bg-red-50 text-red-700 border border-red-200">
                                  <span className="w-2 h-2 rounded-full bg-red-500" />{blocked} bloqueados
                                </span>
                              )}
                              {pending > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-[4px] rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                                  <span className="w-2 h-2 rounded-full bg-yellow-500" />{pending} pendentes
                                </span>
                              )}
                              {interf > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-[4px] rounded-full bg-red-50 text-red-700 border border-red-200">
                                  <AlertTriangle className="h-[13px] w-[13px]" />{interf} interferencias
                                </span>
                              )}
                              {blockRate >= 30 && blocked > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-[4px] rounded-full bg-red-100 text-red-800 border border-red-300">
                                  Taxa bloqueio {blockRate}%
                                </span>
                              )}
                              {opCount > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-[4px] rounded-full bg-muted text-muted-foreground border">
                                  <Users className="h-[13px] w-[13px]" />{opCount} op.
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isExpanded ? <ChevronUp className="h-[23px] w-[23px] text-muted-foreground" /> : <ChevronDown className="h-[23px] w-[23px] text-muted-foreground" />}
                          </div>
                        </div>
                      </CardContent>
                    </button>

                    {isExpanded && (
                      <div className="border-t px-5 pb-5 pt-4">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                          {/* Left 2/3: charts & metrics */}
                          <div className="lg:col-span-2 space-y-5">
                            {/* Hours split */}
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Distribuicao de Horas</p>
                              <HoursSplitBar clH={mClH} actH={mActH} />
                            </div>

                            {/* Daily chart */}
                            {daily.length > 1 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Horas por Dia</p>
                                <DailyChart data={daily} />
                              </div>
                            )}

                            {/* Metrics row */}
                            <div className="grid grid-cols-4 gap-3">
                              <div className="rounded-xl border p-3 text-center">
                                <p className="text-lg font-bold text-foreground">{fmtH(mClH)}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CHART.checklist }} />Checklist</p>
                              </div>
                              <div className="rounded-xl border p-3 text-center">
                                <p className="text-lg font-bold text-foreground">{fmtH(mActH)}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CHART.activity }} />Atividade</p>
                              </div>
                              <div className="rounded-xl border p-3 text-center">
                                <p className="text-lg font-bold text-foreground">{fmtH(totalH)}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Total</p>
                              </div>
                              <div className="rounded-xl border p-3 text-center">
                                <p className={`text-lg font-bold ${interf > 0 ? 'text-red-600' : 'text-foreground'}`}>{interf}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Interf.</p>
                              </div>
                            </div>

                            {/* Checklist donut */}
                            {m.checklists.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Resultado dos Checklists</p>
                                <ChecklistDonut released={released} blocked={blocked} pending={pending} />
                              </div>
                            )}
                          </div>

                          {/* Right 1/3: operators (narrow) */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                              Operadores ({ops.length})
                            </p>
                            {ops.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Sem dados.</p>
                            ) : (
                              <div className="space-y-1 max-h-80 overflow-y-auto">
                                {ops.map((op, idx) => {
                                  const opPct = (ops[0]?.hours || 1) > 0 ? (op.hours / ops[0].hours) * 100 : 0;
                                  const bgColor = OPERATOR_PALETTE[idx % OPERATOR_PALETTE.length];
                                  return (
                                    <div key={op.id} className="flex items-center gap-2.5 rounded-lg border bg-card p-2.5 hover:bg-muted/40 transition-colors">
                                      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm" style={{ backgroundColor: bgColor }}>
                                        {(op.name || '?')[0].toUpperCase()}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                          <p className="text-[11px] font-semibold truncate text-foreground">{op.name}</p>
                                          <span className="text-[11px] font-bold shrink-0 tabular-nums" style={{ color: bgColor }}>{fmtH(op.hours)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                                            <div className="h-full rounded-full transition-all" style={{ width: `${opPct}%`, backgroundColor: bgColor }} />
                                          </div>
                                          <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">{op.count}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
