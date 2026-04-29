'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  HardHat,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Settings,
  TrendingUp,
  Clock,
  Download,
  Target,
  HelpCircle,
  X,
} from 'lucide-react';
import {
  USE_MOCK,
  MOCK_MACHINES,
  seededRandom,
  pick,
} from '@/lib/mock-data';
import { PeriodSelector, type AnalyticsPeriod, periodToDays } from '@/components/analytics/PeriodSelector';
import { exportCSV as sharedExportCSV, csvFilename } from '@/lib/export-csv';

// ── Types ──

interface MachineDMUF {
  id: string;
  name: string;
  tag: string | null;
  active: boolean;
  calendarH: number;
  maintenanceH: number;
  availableH: number;
  workedH: number;
  dm: number; // 0-100
  uf: number; // 0-100
  daily: { date: string; dm: number; uf: number; calH: number; maintH: number; workH: number }[];
}

type Period = AnalyticsPeriod;

const META_DM = 85;
const META_UF = 70;
const SHIFT_HOURS = 10;

// ── Mock ──

function generateMock(period: Period): MachineDMUF[] {
  const numDays = periodToDays(period);
  // Unified seed across all "Analises" pages so data is coherent between screens
  const rand = seededRandom(77);

  return MOCK_MACHINES.filter((m) => m.active).map((machine, mi) => {
    const reliability = 0.7 + rand() * 0.28; // base reliability per machine
    const utilBase = 0.5 + rand() * 0.4;
    let totalCal = 0;
    let totalMaint = 0;
    let totalWorked = 0;

    const daily: MachineDMUF['daily'] = [];

    for (let d = 0; d < numDays; d++) {
      const date = new Date();
      date.setDate(date.getDate() - (numDays - 1 - d));
      const iso = date.toISOString().split('T')[0];

      const calH = SHIFT_HOURS;
      // Some days have maintenance events
      const hasMaint = rand() > reliability;
      const maintH = hasMaint ? Math.round((1 + rand() * 4) * 10) / 10 : 0;
      const availH = Math.max(calH - maintH, 0);
      const workH = Math.round(availH * (utilBase + (rand() - 0.5) * 0.3) * 10) / 10;
      const clampedWork = Math.min(Math.max(workH, 0), availH);

      totalCal += calH;
      totalMaint += maintH;
      totalWorked += clampedWork;

      const dayDm = calH > 0 ? ((calH - maintH) / calH) * 100 : 100;
      const dayUf = availH > 0 ? (clampedWork / availH) * 100 : 0;

      daily.push({
        date: iso,
        dm: Math.round(Math.max(dayDm, 0) * 10) / 10,
        uf: Math.round(Math.min(Math.max(dayUf, 0), 100) * 10) / 10,
        calH,
        maintH: Math.round(maintH * 10) / 10,
        workH: Math.round(clampedWork * 10) / 10,
      });
    }

    const availableH = totalCal - totalMaint;
    const dm = totalCal > 0 ? ((totalCal - totalMaint) / totalCal) * 100 : 100;
    const uf = availableH > 0 ? (totalWorked / availableH) * 100 : 0;

    return {
      id: machine.id,
      name: machine.name,
      tag: machine.tag,
      active: machine.active,
      calendarH: Math.round(totalCal * 10) / 10,
      maintenanceH: Math.round(totalMaint * 10) / 10,
      availableH: Math.round(availableH * 10) / 10,
      workedH: Math.round(totalWorked * 10) / 10,
      dm: Math.round(Math.max(dm, 0) * 10) / 10,
      uf: Math.round(Math.min(Math.max(uf, 0), 100) * 10) / 10,
      daily,
    };
  });
}

// ── Gauge bar ──

function GaugeBar({ value, meta, label, colorAbove, colorBelow }: {
  value: number;
  meta: number;
  label: string;
  colorAbove: string;
  colorBelow: string;
}) {
  const ok = value >= meta;
  const color = ok ? colorAbove : colorBelow;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={`text-sm font-bold ${ok ? 'text-emerald-700' : 'text-red-600'}`}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-muted/60 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
        {/* meta line */}
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground/40"
          style={{ left: `${meta}%` }}
          title={`Meta: ${meta}%`}
        />
      </div>
    </div>
  );
}

// ── Mini daily chart ──

function DailyDMUFChart({ daily }: { daily: MachineDMUF['daily'] }) {
  const last = daily.slice(-14); // show last 14 days max
  const maxH = SHIFT_HOURS;

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-2">Ultimos {last.length} dias</p>
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {last.map((d, i) => {
          const dmOk = d.dm >= META_DM;
          const ufOk = d.uf >= META_UF;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
              {/* Stacked bar: maintenance (red) + worked (blue) + idle (gray) */}
              <div className="w-full flex flex-col-reverse rounded-t overflow-hidden" style={{ height: 90 }}>
                <div
                  className="bg-red-400"
                  style={{ height: `${(d.maintH / maxH) * 90}px` }}
                  title={`Manut: ${d.maintH}h`}
                />
                <div
                  className={dmOk && ufOk ? 'bg-emerald-500' : dmOk ? 'bg-amber-400' : 'bg-red-500'}
                  style={{ height: `${(d.workH / maxH) * 90}px` }}
                  title={`Trab: ${d.workH}h`}
                />
                <div
                  className="bg-slate-200"
                  style={{ height: `${(Math.max(maxH - d.maintH - d.workH, 0) / maxH) * 90}px` }}
                  title="Ocioso"
                />
              </div>
              <span className="text-[9px] text-muted-foreground leading-none">
                {d.date.slice(8)}/{d.date.slice(5, 7)}
              </span>
              {/* tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-background border rounded-lg shadow-lg px-2 py-1.5 text-[10px] whitespace-nowrap">
                <p className="font-semibold">{d.date.slice(8)}/{d.date.slice(5, 7)}</p>
                <p>DM: <span className={d.dm >= META_DM ? 'text-emerald-600' : 'text-red-600'}>{d.dm}%</span></p>
                <p>UF: <span className={d.uf >= META_UF ? 'text-emerald-600' : 'text-red-600'}>{d.uf}%</span></p>
                <p>Trab: {d.workH}h | Manut: {d.maintH}h</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-500" /> Trabalhado</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-red-400" /> Manutencao</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-slate-200 border" /> Ocioso</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-foreground/40" /> Meta</span>
      </div>
    </div>
  );
}

// ── Hours breakdown bar ──

function HoursBreakdown({ calH, maintH, workH }: { calH: number; maintH: number; workH: number }) {
  const idleH = Math.max(calH - maintH - workH, 0);
  const total = calH || 1;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-2">Distribuicao de Horas</p>
      <div className="flex rounded-full overflow-hidden h-5">
        <div className="bg-emerald-500 flex items-center justify-center" style={{ width: `${(workH / total) * 100}%` }}>
          {workH > 0 && <span className="text-[9px] text-white font-bold">{workH.toFixed(0)}h</span>}
        </div>
        <div className="bg-slate-300 flex items-center justify-center" style={{ width: `${(idleH / total) * 100}%` }}>
          {idleH > 5 && <span className="text-[9px] text-slate-700 font-bold">{idleH.toFixed(0)}h</span>}
        </div>
        <div className="bg-red-400 flex items-center justify-center" style={{ width: `${(maintH / total) * 100}%` }}>
          {maintH > 3 && <span className="text-[9px] text-white font-bold">{maintH.toFixed(0)}h</span>}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>Trabalhado: {workH.toFixed(1)}h</span>
        <span>Ocioso: {idleH.toFixed(1)}h</span>
        <span>Manutencao: {maintH.toFixed(1)}h</span>
      </div>
    </div>
  );
}

// ── CSV export ──

function exportCSV(machines: MachineDMUF[]) {
  const headers = ['Maquina', 'Tag', 'DM (%)', 'UF (%)', 'Horas Calendario', 'Horas Manutencao', 'Horas Disponivel', 'Horas Trabalhadas'];
  const rows = machines.map((m) => [
    m.name, m.tag || '-', m.dm.toFixed(1), m.uf.toFixed(1),
    m.calendarH, m.maintenanceH.toFixed(1), m.availableH.toFixed(1), m.workedH.toFixed(1),
  ]);
  sharedExportCSV(csvFilename('disponibilidade'), headers, rows);
}

// ── Page ──

export default function DisponibilidadePage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<MachineDMUF[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'dm' | 'uf' | 'name'>('dm');
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      if (USE_MOCK) {
        setMachines(generateMock(period));
      }
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [period]);

  const sorted = useMemo(() => {
    const arr = [...machines];
    if (sortBy === 'dm') arr.sort((a, b) => a.dm - b.dm); // worst first
    else if (sortBy === 'uf') arr.sort((a, b) => a.uf - b.uf);
    else arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [machines, sortBy]);

  // KPIs
  const avgDM = machines.length ? machines.reduce((s, m) => s + m.dm, 0) / machines.length : 0;
  const avgUF = machines.length ? machines.reduce((s, m) => s + m.uf, 0) / machines.length : 0;
  const criticalDM = machines.filter((m) => m.dm < META_DM).length;
  const criticalUF = machines.filter((m) => m.uf < META_UF).length;
  const totalLostH = machines.reduce((s, m) => s + m.maintenanceH, 0);
  const totalIdleH = machines.reduce((s, m) => s + Math.max(m.availableH - m.workedH, 0), 0);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6 text-emerald-600" />
            Disponibilidade &amp; Utilizacao
            <button onClick={() => setShowHelp(!showHelp)} className="ml-1 text-muted-foreground hover:text-foreground transition-colors">
              <HelpCircle className="h-5 w-5" />
            </button>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            DM e UF por maquina — metas: DM {'>'}  {META_DM}% | UF {'>'} {META_UF}%
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button
            onClick={() => exportCSV(machines)}
            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Help panel */}
      {showHelp && (
        <Card className="border-2 border-emerald-200 bg-emerald-50/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-sm">O que esta pagina mostra?</h3>
              <button onClick={() => setShowHelp(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Esta pagina mede se suas maquinas estao <strong>disponiveis</strong> e se, quando disponiveis, estao sendo <strong>usadas</strong>.
            </p>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-background rounded-lg p-3 border">
                <p className="font-bold text-emerald-700 mb-1">DM — Disponibilidade Mecanica</p>
                <p className="text-muted-foreground text-xs mb-2">
                  Percentual do tempo em que a maquina <strong>nao estava em manutencao</strong>. Mede a confiabilidade do equipamento.
                </p>
                <div className="bg-muted/60 rounded p-2 text-xs font-mono">
                  DM = (Horas Calendario - Horas Manutencao) / Horas Calendario x 100
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  <strong>Meta: {META_DM}%</strong> — Se a DM esta baixa, a maquina quebra muito. Acao: revisar plano de manutencao preventiva.
                </p>
              </div>
              <div className="bg-background rounded-lg p-3 border">
                <p className="font-bold text-blue-700 mb-1">UF — Utilizacao Fisica</p>
                <p className="text-muted-foreground text-xs mb-2">
                  Percentual do tempo disponivel em que a maquina <strong>realmente trabalhou</strong>. Mede a eficiencia da gestao.
                </p>
                <div className="bg-muted/60 rounded p-2 text-xs font-mono">
                  UF = Horas Trabalhadas / Horas Disponiveis x 100
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  <strong>Meta: {META_UF}%</strong> — Se a UF esta baixa com DM alta, a maquina funciona mas ninguem usa. Acao: realocar operador ou dispensar equipamento.
                </p>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              <strong>Decisoes que esta pagina responde:</strong> Qual maquina precisa de manutencao urgente? Qual esta ociosa e pode ser realocada? A frota esta superdimensionada ou subdimensionada?
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={`border-2 ${avgDM >= META_DM ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/40'}`}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${avgDM >= META_DM ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">DM Media Frota</p>
                <p className={`text-2xl font-bold ${avgDM >= META_DM ? 'text-emerald-700' : 'text-red-700'}`}>
                  {avgDM.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-2 ${avgUF >= META_UF ? 'border-blue-200 bg-blue-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${avgUF >= META_UF ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                <Target className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">UF Media Frota</p>
                <p className={`text-2xl font-bold ${avgUF >= META_UF ? 'text-blue-700' : 'text-amber-700'}`}>
                  {avgUF.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-2 ${criticalDM === 0 ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/40'}`}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${criticalDM === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Maquinas DM Critica</p>
                <p className="text-2xl font-bold">{criticalDM}</p>
                <p className="text-[10px] text-muted-foreground">abaixo de {META_DM}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-violet-200 bg-violet-50/40">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-violet-100 text-violet-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Horas Perdidas</p>
                <p className="text-2xl font-bold text-violet-700">{totalLostH.toFixed(0)}h</p>
                <p className="text-[10px] text-muted-foreground">manutencao + {totalIdleH.toFixed(0)}h ociosas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Ordenar:</span>
        {[
          { key: 'dm' as const, label: 'Pior DM' },
          { key: 'uf' as const, label: 'Pior UF' },
          { key: 'name' as const, label: 'Nome' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setSortBy(s.key)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              sortBy === s.key ? 'bg-emerald-100 text-emerald-700' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{machines.length} maquinas ativas</span>
      </div>

      {/* Machine list */}
      <div className="space-y-3">
        {sorted.map((m) => {
          const isExpanded = expanded === m.id;
          return (
            <Card key={m.id} className="border overflow-hidden">
              <button
                className="w-full text-left"
                onClick={() => setExpanded(isExpanded ? null : m.id)}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                      m.dm >= META_DM && m.uf >= META_UF
                        ? 'bg-emerald-100 text-emerald-600'
                        : m.dm >= META_DM
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-red-100 text-red-600'
                    }`}>
                      <HardHat className="h-6 w-6" />
                    </div>

                    {/* Name + tag */}
                    <div className="min-w-0 w-44 shrink-0">
                      <p className="font-semibold text-sm truncate">{m.name}</p>
                      {m.tag && (
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          {m.tag}
                        </span>
                      )}
                    </div>

                    {/* DM + UF gauges */}
                    <div className="flex-1 flex gap-6 min-w-0">
                      <GaugeBar
                        value={m.dm}
                        meta={META_DM}
                        label="DM"
                        colorAbove="bg-emerald-500"
                        colorBelow="bg-red-500"
                      />
                      <GaugeBar
                        value={m.uf}
                        meta={META_UF}
                        label="UF"
                        colorAbove="bg-blue-500"
                        colorBelow="bg-amber-500"
                      />
                    </div>

                    {/* Hours summary */}
                    <div className="text-right shrink-0 hidden md:block">
                      <p className="text-xs text-muted-foreground">Trabalhadas</p>
                      <p className="text-lg font-bold">{m.workedH.toFixed(0)}h</p>
                      <p className="text-[10px] text-muted-foreground">de {m.calendarH}h</p>
                    </div>

                    {/* Chevron */}
                    <div className="shrink-0 text-muted-foreground">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </CardContent>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t bg-muted/20 px-5 py-4">
                  <div className="grid md:grid-cols-2 gap-6">
                    <DailyDMUFChart daily={m.daily} />
                    <HoursBreakdown calH={m.calendarH} maintH={m.maintenanceH} workH={m.workedH} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div className="bg-background rounded-lg p-2.5 border">
                      <p className="text-[10px] text-muted-foreground">Horas Calendario</p>
                      <p className="text-base font-bold">{m.calendarH}h</p>
                    </div>
                    <div className="bg-background rounded-lg p-2.5 border">
                      <p className="text-[10px] text-muted-foreground">Manutencao</p>
                      <p className="text-base font-bold text-red-600">{m.maintenanceH.toFixed(1)}h</p>
                    </div>
                    <div className="bg-background rounded-lg p-2.5 border">
                      <p className="text-[10px] text-muted-foreground">Disponivel</p>
                      <p className="text-base font-bold text-emerald-600">{m.availableH.toFixed(1)}h</p>
                    </div>
                    <div className="bg-background rounded-lg p-2.5 border">
                      <p className="text-[10px] text-muted-foreground">Trabalhadas</p>
                      <p className="text-base font-bold text-blue-600">{m.workedH.toFixed(1)}h</p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
