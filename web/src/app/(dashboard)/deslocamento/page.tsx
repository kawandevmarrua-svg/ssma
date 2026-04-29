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
import {
  Loader2,
  Route,
  MapPin,
  Gauge,
  User,
  Navigation,
  ArrowUpRight,
  Download,
  AlertTriangle,
  Percent,
  Calendar as CalendarIcon,
  HelpCircle,
  X,
} from 'lucide-react';
import { BarChart, TimelineChart } from '../dashboard/charts';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
} from 'recharts';
import { formatDate, formatTime, getDuration } from '@/lib/formatters';
import { PeriodSelector, type AnalyticsPeriod, periodToDays } from '@/components/analytics/PeriodSelector';
import { exportCSV as sharedExportCSV, csvFilename } from '@/lib/export-csv';
import {
  USE_MOCK,
  MOCK_OPERATORS,
  MOCK_MACHINES,
  MOCK_FRENTES,
  MOCK_ACTIVITY_TYPES,
  seededRandom,
  pick,
} from '@/lib/mock-data';

// ── Types ──

interface ActivityRow {
  id: string;
  date: string;
  location: string | null;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  equipment_tag: string | null;
  operator_id: string;
  activity_type_id: string | null;
  profiles: { full_name: string | null } | null;
  activity_types: { code: string; description: string } | null;
}

interface TravelMetric {
  activity_id: string;
  distance_km: number;
  point_count: number;
  first_move_at: string | null;
  last_point_at: string | null;
  max_speed: number;
}

interface LocationRow {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

type Period = AnalyticsPeriod;

// ── Mock generator ──

function generateMockDeslocamento(period: Period): { activities: ActivityRow[]; metrics: TravelMetric[] } {
  const numDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const activities: ActivityRow[] = [];
  const metrics: TravelMetric[] = [];
  const rand = seededRandom(42);

  // ── Showcase examples on day 0 (today): one healthy, one with anomalies ──
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // GOOD: João Victor — Frente Norte — escavadeira saudável
  const goodStart = new Date(today); goodStart.setHours(6, 30, 0);
  const goodEnd = new Date(goodStart.getTime() + (4 * 3600000 + 12 * 60000));
  activities.push({
    id: 'showcase-good', date: todayStr, location: 'Frente Norte',
    description: 'Construcao de talude',
    start_time: goodStart.toISOString(), end_time: goodEnd.toISOString(),
    equipment_tag: 'PC-003', operator_id: 'op-joao',
    activity_type_id: 'S02',
    profiles: { full_name: 'João Victor Mendes' },
    activity_types: { code: 'S02', description: 'Construcao de talude' },
  });
  metrics.push({
    activity_id: 'showcase-good',
    distance_km: 6.8, point_count: 184,
    first_move_at: new Date(goodStart.getTime() + 18 * 60000).toISOString(),
    last_point_at: goodEnd.toISOString(),
    max_speed: 18 / 3.6,
  });

  // BAD: Carlos Eduardo — Frente Sul — retroescavadeira com anomalias
  const badStart = new Date(today); badStart.setHours(7, 0, 0);
  const badEnd = new Date(badStart.getTime() + (3 * 3600000 + 45 * 60000));
  activities.push({
    id: 'showcase-bad', date: todayStr, location: 'Frente Sul',
    description: 'Locomocao propria (Maquina x frente)',
    start_time: badStart.toISOString(), end_time: badEnd.toISOString(),
    equipment_tag: 'RE-005', operator_id: 'op-carlos',
    activity_type_id: 'P11',
    profiles: { full_name: 'Carlos Eduardo Silva' },
    activity_types: { code: 'P11', description: 'Locomocao propria (Maquina x frente)' },
  });
  metrics.push({
    activity_id: 'showcase-bad',
    distance_km: 0.4, point_count: 22,
    first_move_at: null,
    last_point_at: badEnd.toISOString(),
    max_speed: 52 / 3.6,
  });

  // ── Other activities ──
  for (let d = 0; d < numDays; d++) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];
    const count = 3 + Math.floor(rand() * 4);

    for (let i = 0; i < count; i++) {
      const id = `mock-${d}-${i}`;
      const op = pick(MOCK_OPERATORS, rand);
      const frente = pick(MOCK_FRENTES, rand);
      const type = pick(MOCK_ACTIVITY_TYPES, rand);
      const machine = pick(MOCK_MACHINES, rand);

      const startHour = 6 + Math.floor(rand() * 10);
      const durationHours = 1 + rand() * 6;
      const startDate = new Date(date);
      startDate.setHours(startHour, Math.floor(rand() * 60), 0);
      const endDate = new Date(startDate.getTime() + durationHours * 3600000);

      activities.push({
        id, date: dateStr, location: frente,
        description: type.description,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        equipment_tag: machine.tag, operator_id: op.id,
        activity_type_id: type.code,
        profiles: { full_name: op.name },
        activity_types: type,
      });

      if (rand() < 0.75) {
        const distKm = 0.5 + rand() * 25;
        const maxSpeedMs = (15 + rand() * 25) / 3.6;
        const firstMove = new Date(startDate.getTime() + rand() * 1800000);
        metrics.push({
          activity_id: id,
          distance_km: Math.round(distKm * 100) / 100,
          point_count: 20 + Math.floor(rand() * 200),
          first_move_at: firstMove.toISOString(),
          last_point_at: endDate.toISOString(),
          max_speed: Math.round(maxSpeedMs * 100) / 100,
        });
      }
    }
  }

  return { activities, metrics };
}

// ── Helpers ──

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

function fmtKm(km: number): string {
  if (km < 0.01) return '0 m';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function fmtSpeed(ms: number | null): string {
  if (!ms || ms <= 0) return '--';
  return `${(ms * 3.6).toFixed(0)} km/h`;
}

// ── Coherence analysis per activity ──
// Returns: 'saudavel' | 'ociosa' | 'velocidade' | 'sem_gps'
type Coerencia = 'saudavel' | 'ociosa' | 'velocidade' | 'sem_gps';

function coerenciaAtividade(travel: TravelMetric | null, durationH: number): { status: Coerencia; reason: string } {
  if (!travel || travel.point_count <= 1) {
    return { status: 'sem_gps', reason: 'Atividade sem dados GPS — apontamento sem rastreamento' };
  }
  const speedKmh = travel.max_speed * 3.6;
  if (speedKmh > 40) {
    return { status: 'velocidade', reason: `Vel. máx ${speedKmh.toFixed(0)} km/h — possível transporte/anomalia` };
  }
  // Idle: more than 1h of activity but < 0.3 km/h average movement
  if (durationH >= 1 && travel.distance_km / Math.max(durationH, 0.1) < 0.3) {
    return { status: 'ociosa', reason: `${travel.distance_km.toFixed(1)} km em ${durationH.toFixed(1)}h — máquina parada` };
  }
  return { status: 'saudavel', reason: 'Distância e velocidade compatíveis com a duração' };
}

// ── Km type classifier (heuristic by avg + max speed) ──
// 'operacional' = trabalho dentro da frente (mov. lento e contínuo)
// 'deslocamento' = trajeto entre frentes/abastecimento (vel. moderada)
// 'transporte' = máquina sendo rebocada/transportada (vel. alta)
// 'idle' = parada com ruído de GPS (mov. ínfimo)
type TipoKm = 'operacional' | 'deslocamento' | 'transporte' | 'idle';

function classificarTipoKm(travel: TravelMetric, durationH: number): TipoKm {
  const maxKmh = travel.max_speed * 3.6;
  const avgKmh = durationH > 0 ? travel.distance_km / durationH : 0;
  if (maxKmh > 40) return 'transporte';
  if (avgKmh < 0.3) return 'idle';
  if (avgKmh >= 0.3 && avgKmh < 8) return 'operacional';
  return 'deslocamento';
}

function durationHours(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0 || ms > 24 * 3600000) return 0;
  return ms / 3600000;
}

function exportCSV(rows: { date: string; operator: string; activity: string; frente: string; equipment: string; duration: string; distance: string; maxSpeed: string }[]) {
  const headers = ['Data', 'Operador', 'Atividade', 'Frente', 'Equipamento', 'Duracao', 'Distancia', 'Vel.Max'];
  const data = rows.map((r) => [r.date, r.operator, r.activity, r.frente, r.equipment, r.duration, r.distance, r.maxSpeed]);
  sharedExportCSV(csvFilename('deslocamento'), headers, data);
}

// ── Page ──

export default function DeslocamentoPage() {
  const supabase = useMemo(() => createClient(), []);
  const [period, setPeriod] = useState<Period>('30d');
  const [loading, setLoading] = useState(true);

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [metrics, setMetrics] = useState<TravelMetric[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);

  // Filtros
  const [filterOperator, setFilterOperator] = useState('');
  const [filterFrente, setFilterFrente] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    if (USE_MOCK) {
      const mock = generateMockDeslocamento(period);
      setActivities(mock.activities);
      setMetrics(mock.metrics);
      setLocations([]);
      setLoading(false);
      return;
    }

    const dateFrom = getDateFrom(period);
    const dateTo = new Date().toISOString().split('T')[0];

    const [actRes, metRes, locRes] = await Promise.all([
      supabase
        .from('activities')
        .select('id, date, location, description, start_time, end_time, equipment_tag, operator_id, activity_type_id, profiles(full_name), activity_types(code, description)')
        .gte('date', dateFrom)
        .order('date', { ascending: false })
        .limit(2000),
      supabase.rpc('get_activity_travel_metrics', { p_from: dateFrom, p_to: dateTo }),
      supabase.from('locations').select('id, name, latitude, longitude').eq('active', true),
    ]);

    setActivities((actRes.data as ActivityRow[] | null) ?? []);
    setMetrics((metRes.data as TravelMetric[] | null) ?? []);
    setLocations((locRes.data as LocationRow[] | null) ?? []);
    setLoading(false);
  }, [supabase, period]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Merge activities + metrics ──

  const metricsMap = useMemo(() => {
    const map = new Map<string, TravelMetric>();
    metrics.forEach((m) => map.set(m.activity_id, m));
    return map;
  }, [metrics]);

  const merged = useMemo(() =>
    activities.map((a) => ({
      ...a,
      travel: metricsMap.get(a.id) ?? null,
    })),
  [activities, metricsMap]);

  // ── Listas únicas para filtros ──

  const operators = useMemo(() => {
    const map = new Map<string, string>();
    activities.forEach((a) => {
      if (a.operator_id && a.profiles?.full_name) map.set(a.operator_id, a.profiles.full_name);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [activities]);

  const frentes = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((a) => { if (a.location) set.add(a.location); });
    return [...set].sort();
  }, [activities]);

  // ── Filtered merged ──

  const filteredMerged = useMemo(() => {
    return merged.filter((a) => {
      if (filterOperator && a.operator_id !== filterOperator) return false;
      if (filterFrente && a.location !== filterFrente) return false;
      return true;
    });
  }, [merged, filterOperator, filterFrente]);

  // Only activities with tracking data
  const tracked = useMemo(() => filteredMerged.filter((a) => a.travel && a.travel.point_count > 1), [filteredMerged]);

  // ── KPIs ──

  const periodDays = periodToDays(period);

  const kpis = useMemo(() => {
    const totalKm = tracked.reduce((s, a) => s + (a.travel?.distance_km ?? 0), 0);
    const avgKm = tracked.length > 0 ? totalKm / tracked.length : 0;
    const maxSpeed = tracked.reduce((s, a) => Math.max(s, a.travel?.max_speed ?? 0), 0);
    const operatorCount = new Set(tracked.map((a) => a.operator_id)).size;
    const trackingPct = filteredMerged.length > 0
      ? Math.round((tracked.length / filteredMerged.length) * 100)
      : 0;
    const kmPerDay = totalKm / periodDays;

    // Segmenta km por tipo
    let kmOperacional = 0, kmDeslocamento = 0, kmTransporte = 0, kmIdle = 0;
    let countOperacional = 0, countDeslocamento = 0, countTransporte = 0, countIdle = 0;
    for (const a of tracked) {
      if (!a.travel) continue;
      const dh = durationHours(a.start_time, a.end_time);
      const tipo = classificarTipoKm(a.travel, dh);
      if (tipo === 'operacional') { kmOperacional += a.travel.distance_km; countOperacional++; }
      else if (tipo === 'deslocamento') { kmDeslocamento += a.travel.distance_km; countDeslocamento++; }
      else if (tipo === 'transporte') { kmTransporte += a.travel.distance_km; countTransporte++; }
      else { kmIdle += a.travel.distance_km; countIdle++; }
    }
    const speedAlerts = countTransporte;
    const idleCount = countIdle;

    return {
      totalKm, avgKm, maxSpeed,
      trackedCount: tracked.length, totalCount: filteredMerged.length,
      operators: operatorCount, trackingPct, kmPerDay, speedAlerts, idleCount,
      kmOperacional, kmDeslocamento, kmTransporte, kmIdle,
      countOperacional, countDeslocamento, countTransporte, countIdle,
    };
  }, [tracked, filteredMerged, periodDays]);

  // ── Km per day (timeline) ──

  const days = useMemo(() => fillDays(period), [period]);

  const kmByDay = useMemo(() => {
    const map: Record<string, number> = {};
    tracked.forEach((a) => {
      map[a.date] = (map[a.date] || 0) + (a.travel?.distance_km ?? 0);
    });
    Object.keys(map).forEach((k) => { map[k] = Math.round(map[k] * 10) / 10; });
    return map;
  }, [tracked]);

  // Daily km split by movement type — for stacked area chart
  const kmByDayStacked = useMemo(() => {
    const fmtDay = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };
    const byDay = new Map<string, { operacional: number; deslocamento: number; transporte: number; idle: number }>();
    days.forEach((d) => byDay.set(d, { operacional: 0, deslocamento: 0, transporte: 0, idle: 0 }));
    tracked.forEach((a) => {
      if (!a.travel) return;
      const bucket = byDay.get(a.date);
      if (!bucket) return;
      const dh = durationHours(a.start_time, a.end_time);
      const tipo = classificarTipoKm(a.travel, dh);
      bucket[tipo] += a.travel.distance_km;
    });
    return days.map((d) => {
      const b = byDay.get(d)!;
      return {
        day: fmtDay(d),
        Operacional: Math.round(b.operacional * 10) / 10,
        Deslocamento: Math.round(b.deslocamento * 10) / 10,
        Transporte: Math.round(b.transporte * 10) / 10,
        Idle: Math.round(b.idle * 10) / 10,
      };
    });
  }, [tracked, days]);

  // ── Km per operator (bar) ──

  const kmByOperator = useMemo(() => {
    const map = new Map<string, { name: string; km: number }>();
    tracked.forEach((a) => {
      const entry = map.get(a.operator_id) ?? { name: a.profiles?.full_name || 'Operador', km: 0 };
      entry.km += a.travel?.distance_km ?? 0;
      map.set(a.operator_id, entry);
    });
    return [...map.values()]
      .map((o) => ({ label: o.name, value: Math.round(o.km * 10) / 10 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [tracked]);

  // ── Km per frente (bar) ──

  const kmByFrente = useMemo(() => {
    const map = new Map<string, number>();
    tracked.forEach((a) => {
      const loc = a.location || 'Sem local';
      map.set(loc, (map.get(loc) || 0) + (a.travel?.distance_km ?? 0));
    });
    return [...map.entries()]
      .map(([label, value]) => ({ label, value: Math.round(value * 10) / 10 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [tracked]);

  // ── Km per activity type (bar) ──

  const kmByType = useMemo(() => {
    const map = new Map<string, { desc: string; km: number }>();
    tracked.forEach((a) => {
      const code = a.activity_types?.code || 'N/A';
      const desc = a.activity_types?.description || code;
      const entry = map.get(code) ?? { desc, km: 0 };
      entry.km += a.travel?.distance_km ?? 0;
      map.set(code, entry);
    });
    return [...map.values()]
      .map((o) => ({ label: o.desc, value: Math.round(o.km * 10) / 10 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [tracked]);

  // ── Speed alerts ──

  const speedAlertRows = useMemo(() =>
    tracked
      .filter((a) => (a.travel?.max_speed ?? 0) * 3.6 > 40)
      .sort((a, b) => (b.travel?.max_speed ?? 0) - (a.travel?.max_speed ?? 0))
      .slice(0, 10),
  [tracked]);

  // ── Sorted table ──

  const [sortBy, setSortBy] = useState<'date' | 'distance'>('date');

  const tableData = useMemo(() => {
    const list = [...filteredMerged];
    if (sortBy === 'distance') {
      list.sort((a, b) => (b.travel?.distance_km ?? 0) - (a.travel?.distance_km ?? 0));
    }
    return list;
  }, [filteredMerged, sortBy]);

  // ── Export CSV ──

  function handleExport() {
    const rows = tableData.map((row) => ({
      date: formatDate(row.date),
      operator: row.profiles?.full_name || '--',
      activity: row.activity_types ? `${row.activity_types.code} - ${row.activity_types.description}` : '--',
      frente: row.location || '--',
      equipment: row.equipment_tag || '--',
      duration: getDuration(row.start_time, row.end_time) || '--',
      distance: row.travel ? fmtKm(row.travel.distance_km) : '--',
      maxSpeed: row.travel ? fmtSpeed(row.travel.max_speed) : '--',
    }));
    exportCSV(rows);
  }

  // ── Render ──


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            Deslocamento
            <button onClick={() => setShowHelp(!showHelp)} className="text-muted-foreground hover:text-foreground transition-colors">
              <HelpCircle className="h-5 w-5" />
            </button>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Distancia percorrida e metricas de movimentacao por atividade.
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Help panel */}
      {showHelp && (
        <Card className="border-2 border-blue-200 bg-blue-50/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-sm">O que esta pagina mostra?</h3>
              <button onClick={() => setShowHelp(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Analisa a <strong>movimentacao fisica</strong> de operadores e maquinas durante as atividades, usando dados de GPS e apontamentos de horas.
            </p>
            <div className="grid md:grid-cols-3 gap-3 text-xs">
              <div className="bg-background rounded-lg p-3 border">
                <p className="font-bold text-blue-700 mb-1">Distancia e Velocidade</p>
                <p className="text-muted-foreground">Km percorridos, velocidade maxima, e alertas de excesso. Identifica transporte irregular e riscos de seguranca.</p>
              </div>
              <div className="bg-background rounded-lg p-3 border">
                <p className="font-bold text-amber-700 mb-1">Coerencia GPS</p>
                <p className="text-muted-foreground">% de atividades com rastreamento GPS. Atividades sem GPS podem ser apontamentos falsos ou problemas de dispositivo.</p>
              </div>
              <div className="bg-background rounded-lg p-3 border">
                <p className="font-bold text-violet-700 mb-1">Tipo de Km</p>
                <p className="text-muted-foreground">Classifica a distancia em operacional (trabalho), deslocamento (entre frentes), transporte (reboque) e idle (parado).</p>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              <strong>Decisoes que esta pagina responde:</strong> Operadores estao gastando muito tempo se deslocando? Algum operador dirige em velocidade perigosa? As frentes estao proximas o suficiente? Quais atividades nao tem rastreamento GPS?
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      {!loading && (
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterOperator}
            onChange={(e) => setFilterOperator(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs"
          >
            <option value="">Todos os operadores</option>
            {operators.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <select
            value={filterFrente}
            onChange={(e) => setFilterFrente(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs"
          >
            <option value="">Todas as frentes</option>
            {frentes.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          {(filterOperator || filterFrente) && (
            <button
              onClick={() => { setFilterOperator(''); setFilterFrente(''); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Top KPIs — quantidades e cobertura */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {[
              { label: 'Total Atividades', value: String(kpis.totalCount), icon: Route, color: 'text-foreground', hint: `${kpis.totalCount} apontamentos no periodo` },
              { label: 'Com Rastreamento', value: `${kpis.trackedCount} (${kpis.trackingPct}%)`, icon: Navigation, color: 'text-blue-600', hint: 'cobertura efetiva do app movel' },
              { label: `Km Medio/Dia (${periodDays}d)`, value: fmtKm(kpis.kmPerDay), icon: CalendarIcon, color: 'text-teal-600', hint: 'intensidade diaria de movimentacao' },
              { label: 'Operadores', value: String(kpis.operators), icon: User, color: 'text-violet-600', hint: 'distintos com GPS no periodo' },
            ].map(({ label, value, icon: Icon, color, hint }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
                </CardContent>
              </Card>
            ))}
          </div>


          {/* Speed Alerts */}
          {kpis.speedAlerts > 0 && (
            <Card className="border-red-200 bg-red-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  Alertas de Velocidade ({kpis.speedAlerts})
                </CardTitle>
                <CardDescription>Atividades com velocidade maxima acima de 40 km/h</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {speedAlertRows.map((row) => (
                    <div key={row.id} className="flex items-center gap-3 rounded-lg border border-red-200 bg-white p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                        {fmtSpeed(row.travel?.max_speed ?? 0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{row.profiles?.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(row.date)} - {row.location}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Distancia por Dia — full width, segmentada por tipo */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base">Distancia por Dia</CardTitle>
                  <CardDescription>Km por dia separados pelo tipo real de movimento — total {fmtKm(kpis.totalKm)} no periodo.</CardDescription>
                </div>
                <div className="flex items-center gap-3 flex-wrap text-xs">
                  <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-emerald-700 font-semibold">{fmtKm(kpis.kmOperacional)}</span><span className="text-muted-foreground">operacional</span></span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /><span className="text-blue-700 font-semibold">{fmtKm(kpis.kmDeslocamento)}</span><span className="text-muted-foreground">deslocamento</span></span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /><span className="text-red-700 font-semibold">{fmtKm(kpis.kmTransporte)}</span><span className="text-muted-foreground">transporte</span></span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /><span className="text-amber-700 font-semibold">{fmtKm(kpis.kmIdle)}</span><span className="text-muted-foreground">idle</span></span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {tracked.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhum dado de rastreamento no periodo.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={kmByDayStacked} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="g-operacional" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.75} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.2} />
                      </linearGradient>
                      <linearGradient id="g-deslocamento" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.75} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.2} />
                      </linearGradient>
                      <linearGradient id="g-transporte" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.25} />
                      </linearGradient>
                      <linearGradient id="g-idle" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.25} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={kmByDayStacked.length > 30 ? Math.ceil(kmByDayStacked.length / 15) - 1 : 0} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v} km`} width={55} />
                    <ReTooltip
                      contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }}
                      formatter={(value, name) => [`${value} km`, name as string]}
                    />
                    <Area type="monotone" dataKey="Operacional" stackId="1" stroke="#10b981" strokeWidth={2} fill="url(#g-operacional)" />
                    <Area type="monotone" dataKey="Deslocamento" stackId="1" stroke="#3b82f6" strokeWidth={2} fill="url(#g-deslocamento)" />
                    <Area type="monotone" dataKey="Transporte" stackId="1" stroke="#ef4444" strokeWidth={2} fill="url(#g-transporte)" />
                    <Area type="monotone" dataKey="Idle" stackId="1" stroke="#f59e0b" strokeWidth={2} fill="url(#g-idle)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Other charts in 2-col */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distancia por Operador</CardTitle>
                <CardDescription>Top 10 operadores com mais km percorridos</CardDescription>
              </CardHeader>
              <CardContent>
                {kmByOperator.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sem dados.</p>
                ) : (
                  <BarChart data={kmByOperator} color="#3b82f6" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distancia por Frente de Servico</CardTitle>
                <CardDescription>Km percorridos agrupados pela localidade da atividade</CardDescription>
              </CardHeader>
              <CardContent>
                {kmByFrente.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sem dados.</p>
                ) : (
                  <BarChart data={kmByFrente} color="#10b981" labelWidth={160} />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distancia por Tipo de Atividade</CardTitle>
              <CardDescription>Km percorridos agrupados pelo tipo de servico/parada — codigos S* sao serviço produtivo, P* sao paradas/improdutivas.</CardDescription>
            </CardHeader>
            <CardContent>
              {kmByType.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem dados.</p>
              ) : (
                <BarChart data={kmByType} color="#8b5cf6" labelWidth={220} />
              )}
            </CardContent>
          </Card>

          {/* Activities Table */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Atividades e Deslocamento</CardTitle>
                  <CardDescription>
                    Detalhe por atividade — distancia percorrida, saida da frente e duracao.
                    {kpis.trackedCount === 0 && activities.length > 0 && (
                      <span className="block mt-1 text-yellow-600">
                        Nenhuma atividade possui dados GPS ainda. Os breadcrumbs serao coletados pelo app mobile nas proximas atividades.
                      </span>
                    )}
                  </CardDescription>
                </div>
                <button
                  onClick={handleExport}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar CSV
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                {(['date', 'distance'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      sortBy === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {s === 'date' ? 'Por data' : 'Por distancia'}
                  </button>
                ))}
                <span className="text-xs text-muted-foreground self-center ml-2">
                  {tableData.length} registro{tableData.length !== 1 ? 's' : ''}
                </span>
              </div>

              {tableData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhuma atividade registrada no periodo.
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background z-10">
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Coerencia</th>
                        <th className="py-2 pr-4 font-medium">Data</th>
                        <th className="py-2 pr-4 font-medium">Operador</th>
                        <th className="py-2 pr-4 font-medium">Atividade</th>
                        <th className="py-2 pr-4 font-medium">Frente</th>
                        <th className="py-2 pr-4 font-medium">Equipamento</th>
                        <th className="py-2 pr-4 font-medium">Horario</th>
                        <th className="py-2 pr-4 font-medium">Duracao</th>
                        <th className="py-2 pr-4 font-medium">Distancia</th>
                        <th className="py-2 pr-4 font-medium" title="Horario do primeiro movimento detectado pelo GPS">Inicio GPS</th>
                        <th className="py-2 font-medium">Vel. Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row) => {
                        const t = row.travel;
                        const hasData = !!(t && t.point_count > 1);
                        const dh = durationHours(row.start_time, row.end_time);
                        const coer = coerenciaAtividade(t, dh);
                        const coerStyle: Record<Coerencia, { label: string; cls: string }> = {
                          saudavel: { label: 'Saudavel', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                          ociosa: { label: 'Ociosa', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
                          velocidade: { label: 'Vel. anomala', cls: 'bg-red-50 text-red-700 border-red-200' },
                          sem_gps: { label: 'Sem GPS', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
                        };
                        const style = coerStyle[coer.status];
                        return (
                          <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 pr-4">
                              <span title={coer.reason} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${style.cls} cursor-help`}>
                                {style.label}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 text-xs whitespace-nowrap">
                              {formatDate(row.date)}
                            </td>
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                                  {(row.profiles?.full_name || 'O').charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-sm">{row.profiles?.full_name || 'Operador'}</span>
                              </div>
                            </td>
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-1.5">
                                {row.activity_types?.code && (
                                  <span className="inline-flex shrink-0 items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary">
                                    {row.activity_types.code}
                                  </span>
                                )}
                                <span className="max-w-[200px] truncate text-xs" title={row.description || ''}>
                                  {row.description || '--'}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {row.location || '--'}
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 text-xs text-muted-foreground font-mono">
                              {row.equipment_tag || '--'}
                            </td>
                            <td className="py-2.5 pr-4 text-xs whitespace-nowrap text-muted-foreground">
                              {formatTime(row.start_time)} — {formatTime(row.end_time)}
                            </td>
                            <td className="py-2.5 pr-4 text-xs whitespace-nowrap">
                              {getDuration(row.start_time, row.end_time) || '--'}
                            </td>
                            <td className="py-2.5 pr-4">
                              {hasData ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className={`inline-flex items-center gap-1 font-semibold text-sm ${coer.status === 'ociosa' ? 'text-amber-700' : 'text-emerald-700'}`}>
                                    <Route className="h-3.5 w-3.5" />
                                    {fmtKm(t!.distance_km)}
                                  </span>
                                  {(() => {
                                    const tipoKm = classificarTipoKm(t!, dh);
                                    const tipoStyle: Record<TipoKm, { label: string; cls: string }> = {
                                      operacional: { label: 'operacional', cls: 'text-emerald-600' },
                                      deslocamento: { label: 'deslocamento', cls: 'text-blue-600' },
                                      transporte: { label: 'transporte', cls: 'text-red-600' },
                                      idle: { label: 'idle', cls: 'text-amber-600' },
                                    };
                                    const ts = tipoStyle[tipoKm];
                                    return <span className={`text-[10px] font-medium ${ts.cls}`}>{ts.label}</span>;
                                  })()}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground/50">--</span>
                              )}
                            </td>
                            <td className="py-2.5 pr-4 text-xs whitespace-nowrap text-muted-foreground">
                              {hasData && t!.first_move_at ? formatTime(t!.first_move_at) : '--'}
                            </td>
                            <td className="py-2.5 text-xs whitespace-nowrap">
                              {hasData ? (
                                <span className={t!.max_speed * 3.6 > 40 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
                                  {fmtSpeed(t!.max_speed)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">--</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
