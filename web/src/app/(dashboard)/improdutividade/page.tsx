'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Loader2,
  User,
  ChevronDown,
  ChevronUp,
  Download,
  Clock,
  TrendingDown,
  Route,
  Wrench,
  AlertTriangle,
  Zap,
  HelpCircle,
  X,
} from 'lucide-react';
import {
  USE_MOCK,
  MOCK_OPERATORS,
  MOCK_MACHINES,
  MOCK_FRENTES,
  MOCK_ACTIVITY_TYPES,
  seededRandom,
  pick,
} from '@/lib/mock-data';
import { PeriodSelector, type AnalyticsPeriod, periodToDays } from '@/components/analytics/PeriodSelector';
import { exportCSV as sharedExportCSV, csvFilename } from '@/lib/export-csv';

// ── Types ──

interface TimeCategory {
  produtivo: number;   // S-type services
  paradaPlanejada: number; // P04 manutencao, P06 abastecimento
  deslocamento: number;    // P11 locomocao, P12 deslocamento
  paradaNaoPlanejada: number; // interference / idle
}

interface OperatorAnalysis {
  id: string;
  name: string;
  total: TimeCategory;
  totalH: number;
  shiftH: number;
  pctProdutivo: number;
  daily: { date: string; cat: TimeCategory }[];
  topActivities: { code: string; desc: string; hours: number }[];
  machines: string[];
  frentes: string[];
}

type Period = AnalyticsPeriod;

const COLORS = {
  produtivo: { bg: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-100' },
  paradaPlanejada: { bg: 'bg-amber-400', text: 'text-amber-700', light: 'bg-amber-100' },
  deslocamento: { bg: 'bg-violet-500', text: 'text-violet-700', light: 'bg-violet-100' },
  paradaNaoPlanejada: { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-100' },
};

// Note: 'deslocamento' here = locomocao apontada (codigo P11/P12),
// distinta da pagina 'Deslocamento' que usa GPS real.
const CAT_LABELS: Record<string, string> = {
  produtivo: 'Produtivo',
  paradaPlanejada: 'Parada Planejada',
  deslocamento: 'Locomocao Apontada',
  paradaNaoPlanejada: 'Parada Nao-Planejada',
};

const SHIFT_HOURS = 10;

// ── Classify activity type ──

function classifyActivity(code: string, hadInterference: boolean): keyof TimeCategory {
  if (hadInterference) return 'paradaNaoPlanejada';
  if (code.startsWith('S')) return 'produtivo';
  if (code === 'P04' || code === 'P06') return 'paradaPlanejada';
  if (code === 'P11' || code === 'P12') return 'deslocamento';
  // other P codes as planned stop
  return 'paradaPlanejada';
}

// ── Mock ──

function generateMock(period: Period): OperatorAnalysis[] {
  const numDays = periodToDays(period);
  // Unified seed across all "Analises" pages so data is coherent between screens
  const rand = seededRandom(77);

  return MOCK_OPERATORS.map((op, oi) => {
    const productivity = 0.45 + rand() * 0.35; // base productivity rate
    const total: TimeCategory = { produtivo: 0, paradaPlanejada: 0, deslocamento: 0, paradaNaoPlanejada: 0 };
    const daily: OperatorAnalysis['daily'] = [];
    const activityHours: Record<string, number> = {};
    const machineSet = new Set<string>();
    const frenteSet = new Set<string>();

    for (let d = 0; d < numDays; d++) {
      const date = new Date();
      date.setDate(date.getDate() - (numDays - 1 - d));
      const iso = date.toISOString().split('T')[0];

      let remaining = SHIFT_HOURS;
      const dayCat: TimeCategory = { produtivo: 0, paradaPlanejada: 0, deslocamento: 0, paradaNaoPlanejada: 0 };

      // Generate 4-7 activities per day
      const numActs = 4 + Math.floor(rand() * 4);
      for (let a = 0; a < numActs && remaining > 0.5; a++) {
        const actType = pick(MOCK_ACTIVITY_TYPES, rand);
        const hadInterference = rand() < 0.08;
        const cat = classifyActivity(actType.code, hadInterference);
        const duration = Math.min(0.5 + rand() * 2.5, remaining);
        const rounded = Math.round(duration * 10) / 10;

        dayCat[cat] += rounded;
        total[cat] += rounded;
        remaining -= rounded;

        activityHours[actType.code] = (activityHours[actType.code] || 0) + rounded;
        machineSet.add(pick(MOCK_MACHINES, rand).name);
        frenteSet.add(pick(MOCK_FRENTES, rand));
      }

      // Remaining time as non-planned stop (idle)
      if (remaining > 0.2) {
        dayCat.paradaNaoPlanejada += Math.round(remaining * 10) / 10;
        total.paradaNaoPlanejada += Math.round(remaining * 10) / 10;
      }

      daily.push({ date: iso, cat: dayCat });
    }

    const shiftH = numDays * SHIFT_HOURS;
    const totalH = total.produtivo + total.paradaPlanejada + total.deslocamento + total.paradaNaoPlanejada;

    const topActivities = Object.entries(activityHours)
      .map(([code, hours]) => {
        const at = MOCK_ACTIVITY_TYPES.find((t) => t.code === code);
        return { code, desc: at?.description || code, hours: Math.round(hours * 10) / 10 };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    return {
      id: op.id,
      name: op.name,
      total,
      totalH: Math.round(totalH * 10) / 10,
      shiftH,
      pctProdutivo: totalH > 0 ? Math.round((total.produtivo / totalH) * 1000) / 10 : 0,
      daily,
      topActivities,
      machines: Array.from(machineSet).slice(0, 4),
      frentes: Array.from(frenteSet).slice(0, 3),
    };
  });
}

// ── Stacked bar ──

function StackedBar({ cat, totalH }: { cat: TimeCategory; totalH: number }) {
  if (totalH === 0) return null;
  const items: { key: keyof TimeCategory; value: number }[] = [
    { key: 'produtivo', value: cat.produtivo },
    { key: 'paradaPlanejada', value: cat.paradaPlanejada },
    { key: 'deslocamento', value: cat.deslocamento },
    { key: 'paradaNaoPlanejada', value: cat.paradaNaoPlanejada },
  ];

  return (
    <div className="flex rounded-full overflow-hidden h-5">
      {items.map((item) => {
        const pct = (item.value / totalH) * 100;
        if (pct < 1) return null;
        return (
          <div
            key={item.key}
            className={`${COLORS[item.key].bg} flex items-center justify-center transition-all duration-500`}
            style={{ width: `${pct}%` }}
            title={`${CAT_LABELS[item.key]}: ${item.value.toFixed(1)}h (${pct.toFixed(0)}%)`}
          >
            {pct > 8 && (
              <span className="text-[9px] text-white font-bold">{pct.toFixed(0)}%</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Daily stacked chart ──

function DailyStackedChart({ daily }: { daily: OperatorAnalysis['daily'] }) {
  const last = daily.slice(-14);
  const maxH = SHIFT_HOURS;

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-2">Ultimos {last.length} dias</p>
      <div className="flex items-end gap-1" style={{ height: 110 }}>
        {last.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div className="w-full flex flex-col-reverse rounded-t overflow-hidden" style={{ height: 85 }}>
              {(['produtivo', 'paradaPlanejada', 'deslocamento', 'paradaNaoPlanejada'] as const).map((cat) => (
                <div
                  key={cat}
                  className={COLORS[cat].bg}
                  style={{ height: `${(d.cat[cat] / maxH) * 85}px` }}
                />
              ))}
            </div>
            <span className="text-[9px] text-muted-foreground leading-none">
              {d.date.slice(8)}/{d.date.slice(5, 7)}
            </span>
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-background border rounded-lg shadow-lg px-2 py-1.5 text-[10px] whitespace-nowrap">
              <p className="font-semibold">{d.date.slice(8)}/{d.date.slice(5, 7)}</p>
              <p className="text-emerald-600">Produtivo: {d.cat.produtivo.toFixed(1)}h</p>
              <p className="text-amber-600">Planejada: {d.cat.paradaPlanejada.toFixed(1)}h</p>
              <p className="text-violet-600">Locom.: {d.cat.deslocamento.toFixed(1)}h</p>
              <p className="text-red-600">N-Planej: {d.cat.paradaNaoPlanejada.toFixed(1)}h</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top activities mini list ──

function TopActivities({ items }: { items: OperatorAnalysis['topActivities'] }) {
  const max = items[0]?.hours || 1;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-2">Top Atividades</p>
      <div className="space-y-1.5">
        {items.map((a) => (
          <div key={a.code} className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-muted-foreground w-7 shrink-0">{a.code}</span>
            <div className="flex-1 h-4 bg-muted/60 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${a.code.startsWith('S') ? 'bg-emerald-400' : a.code === 'P11' || a.code === 'P12' ? 'bg-violet-400' : 'bg-amber-400'}`}
                style={{ width: `${(a.hours / max) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground w-10 text-right shrink-0">{a.hours.toFixed(1)}h</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CSV ──

function exportCSV(operators: OperatorAnalysis[]) {
  const headers = ['Operador', 'Horas Turno', 'Produtivo (h)', 'Produtivo (%)', 'Parada Planejada (h)', 'Locomocao Apontada (h)', 'Parada N-Planejada (h)'];
  const rows = operators.map((o) => [
    o.name, o.shiftH,
    o.total.produtivo.toFixed(1),
    o.pctProdutivo.toFixed(1),
    o.total.paradaPlanejada.toFixed(1),
    o.total.deslocamento.toFixed(1),
    o.total.paradaNaoPlanejada.toFixed(1),
  ]);
  sharedExportCSV(csvFilename('improdutividade'), headers, rows);
}

// ── Avatar colors ──

const AVATAR_COLORS = [
  'bg-emerald-100 text-emerald-700',
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-cyan-100 text-cyan-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
];

// ── Page ──

export default function ImprodutividadePage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [loading, setLoading] = useState(true);
  const [operators, setOperators] = useState<OperatorAnalysis[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'pior' | 'melhor' | 'nome'>('pior');
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      if (USE_MOCK) {
        setOperators(generateMock(period));
      }
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [period]);

  const sorted = useMemo(() => {
    const arr = [...operators];
    if (sortBy === 'pior') arr.sort((a, b) => a.pctProdutivo - b.pctProdutivo);
    else if (sortBy === 'melhor') arr.sort((a, b) => b.pctProdutivo - a.pctProdutivo);
    else arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [operators, sortBy]);

  // KPIs
  const avgProd = operators.length ? operators.reduce((s, o) => s + o.pctProdutivo, 0) / operators.length : 0;
  const totalImprodH = operators.reduce((s, o) => s + o.total.paradaNaoPlanejada, 0);
  const totalDeslocH = operators.reduce((s, o) => s + o.total.deslocamento, 0);
  const worstOp = operators.length ? [...operators].sort((a, b) => a.pctProdutivo - b.pctProdutivo)[0] : null;
  const bestOp = operators.length ? [...operators].sort((a, b) => b.pctProdutivo - a.pctProdutivo)[0] : null;

  // Fleet averages for category breakdown
  const fleetTotal: TimeCategory = {
    produtivo: operators.reduce((s, o) => s + o.total.produtivo, 0),
    paradaPlanejada: operators.reduce((s, o) => s + o.total.paradaPlanejada, 0),
    deslocamento: operators.reduce((s, o) => s + o.total.deslocamento, 0),
    paradaNaoPlanejada: operators.reduce((s, o) => s + o.total.paradaNaoPlanejada, 0),
  };
  const fleetTotalH = fleetTotal.produtivo + fleetTotal.paradaPlanejada + fleetTotal.deslocamento + fleetTotal.paradaNaoPlanejada;

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
            <TrendingDown className="h-6 w-6 text-amber-600" />
            Analise de Improdutividade
            <button onClick={() => setShowHelp(!showHelp)} className="ml-1 text-muted-foreground hover:text-foreground transition-colors">
              <HelpCircle className="h-5 w-5" />
            </button>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Distribuicao do turno por operador: produtivo vs paradas vs locomocao apontada
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button
            onClick={() => exportCSV(operators)}
            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Help panel */}
      {showHelp && (
        <Card className="border-2 border-amber-200 bg-amber-50/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-sm">O que esta pagina mostra?</h3>
              <button onClick={() => setShowHelp(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Mostra como cada operador distribui seu turno de trabalho. O objetivo e identificar <strong>onde o tempo esta sendo perdido</strong>.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="bg-background rounded-lg p-3 border">
                <p className="font-bold text-emerald-700 flex items-center gap-1.5 mb-1">
                  <span className="h-2.5 w-2.5 rounded bg-emerald-500" /> Produtivo
                </p>
                <p className="text-muted-foreground">Atividades de servico real (codigos S): construcao, limpeza, confeccao. E o tempo que gera resultado.</p>
              </div>
              <div className="bg-background rounded-lg p-3 border">
                <p className="font-bold text-amber-700 flex items-center gap-1.5 mb-1">
                  <span className="h-2.5 w-2.5 rounded bg-amber-400" /> Parada Planejada
                </p>
                <p className="text-muted-foreground">Manutencao (P04) e abastecimento (P06). Sao necessarias mas devem ser controladas.</p>
              </div>
              <div className="bg-background rounded-lg p-3 border">
                <p className="font-bold text-violet-700 flex items-center gap-1.5 mb-1">
                  <span className="h-2.5 w-2.5 rounded bg-violet-500" /> Locomocao Apontada
                </p>
                <p className="text-muted-foreground">Locomocao de maquina (P11) e operador (P12). Tempo alto = operador longe da frente ou frentes mal distribuidas.</p>
              </div>
              <div className="bg-background rounded-lg p-3 border">
                <p className="font-bold text-red-700 flex items-center gap-1.5 mb-1">
                  <span className="h-2.5 w-2.5 rounded bg-red-500" /> Parada Nao-Planejada
                </p>
                <p className="text-muted-foreground">Interferencias, espera, ociosidade. E o maior inimigo da produtividade e deve ser investigado.</p>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              <strong>Decisoes que esta pagina responde:</strong> Quem sao os operadores mais produtivos? Quem esta perdendo tempo em codigos de locomocao apontada (P11/P12)? Quais paradas nao-planejadas podem ser eliminadas? Preciso realocar operadores para frentes mais proximas?
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={`border-2 ${avgProd >= 60 ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${avgProd >= 60 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Produtividade Media</p>
                <p className={`text-2xl font-bold ${avgProd >= 60 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {avgProd.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-red-200 bg-red-50/40">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Horas N-Planejadas</p>
                <p className="text-2xl font-bold text-red-700">{totalImprodH.toFixed(0)}h</p>
                <p className="text-[10px] text-muted-foreground">paradas nao previstas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-violet-200 bg-violet-50/40">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-violet-100 text-violet-600">
                <Route className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Locomocao Apontada Total</p>
                <p className="text-2xl font-bold text-violet-700">{totalDeslocH.toFixed(0)}h</p>
                <p className="text-[10px] text-muted-foreground">P11 + P12</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 bg-blue-50/40">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-blue-100 text-blue-600">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Melhor Operador</p>
                <p className="text-sm font-bold text-blue-700 truncate">{bestOp?.name.split(' ').slice(0, 2).join(' ')}</p>
                <p className="text-[10px] text-emerald-600 font-bold">{bestOp?.pctProdutivo.toFixed(1)}% produtivo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fleet breakdown bar */}
      <Card className="border">
        <CardContent className="pt-4 pb-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Distribuicao Geral da Equipe</p>
          <StackedBar cat={fleetTotal} totalH={fleetTotalH} />
          <div className="flex flex-wrap gap-4 mt-2 text-[10px]">
            {(Object.keys(COLORS) as (keyof typeof COLORS)[]).map((key) => {
              const h = fleetTotal[key];
              const pct = fleetTotalH > 0 ? (h / fleetTotalH) * 100 : 0;
              return (
                <span key={key} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded ${COLORS[key].bg}`} />
                  <span className="text-muted-foreground">{CAT_LABELS[key]}:</span>
                  <span className={`font-bold ${COLORS[key].text}`}>{h.toFixed(0)}h ({pct.toFixed(0)}%)</span>
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sort + count */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Ordenar:</span>
        {[
          { key: 'pior' as const, label: 'Menos produtivo' },
          { key: 'melhor' as const, label: 'Mais produtivo' },
          { key: 'nome' as const, label: 'Nome' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setSortBy(s.key)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              sortBy === s.key ? 'bg-amber-100 text-amber-700' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{operators.length} operadores</span>
      </div>

      {/* Operator list */}
      <div className="space-y-3">
        {sorted.map((op, idx) => {
          const isExpanded = expanded === op.id;
          const colorIdx = MOCK_OPERATORS.findIndex((o) => o.id === op.id) % AVATAR_COLORS.length;

          return (
            <Card key={op.id} className="border overflow-hidden">
              <button
                className="w-full text-left"
                onClick={() => setExpanded(isExpanded ? null : op.id)}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ${AVATAR_COLORS[colorIdx]}`}>
                      {op.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                    </div>

                    {/* Name */}
                    <div className="min-w-0 w-44 shrink-0">
                      <p className="font-semibold text-sm truncate">{op.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs font-bold ${op.pctProdutivo >= 60 ? 'text-emerald-600' : op.pctProdutivo >= 45 ? 'text-amber-600' : 'text-red-600'}`}>
                          {op.pctProdutivo.toFixed(1)}% produtivo
                        </span>
                      </div>
                    </div>

                    {/* Stacked bar */}
                    <div className="flex-1 min-w-0">
                      <StackedBar cat={op.total} totalH={op.totalH} />
                      <div className="flex gap-3 mt-1 text-[9px] text-muted-foreground">
                        <span>{op.total.produtivo.toFixed(0)}h prod</span>
                        <span>{op.total.paradaPlanejada.toFixed(0)}h plan</span>
                        <span>{op.total.deslocamento.toFixed(0)}h locom.</span>
                        <span>{op.total.paradaNaoPlanejada.toFixed(0)}h n-plan</span>
                      </div>
                    </div>

                    {/* Hours */}
                    <div className="text-right shrink-0 hidden md:block">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-lg font-bold">{op.totalH.toFixed(0)}h</p>
                      <p className="text-[10px] text-muted-foreground">de {op.shiftH}h turno</p>
                    </div>

                    <div className="shrink-0 text-muted-foreground">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </CardContent>
              </button>

              {isExpanded && (
                <div className="border-t bg-muted/20 px-5 py-4">
                  <div className="grid md:grid-cols-2 gap-6">
                    <DailyStackedChart daily={op.daily} />
                    <TopActivities items={op.topActivities} />
                  </div>

                  {/* Context info */}
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div className="bg-background rounded-lg p-2.5 border">
                      <p className="text-[10px] text-muted-foreground">Produtivo</p>
                      <p className="text-base font-bold text-emerald-600">{op.total.produtivo.toFixed(1)}h</p>
                    </div>
                    <div className="bg-background rounded-lg p-2.5 border">
                      <p className="text-[10px] text-muted-foreground">Parada Planejada</p>
                      <p className="text-base font-bold text-amber-600">{op.total.paradaPlanejada.toFixed(1)}h</p>
                    </div>
                    <div className="bg-background rounded-lg p-2.5 border">
                      <p className="text-[10px] text-muted-foreground">Locomocao Apontada</p>
                      <p className="text-base font-bold text-violet-600">{op.total.deslocamento.toFixed(1)}h</p>
                    </div>
                    <div className="bg-background rounded-lg p-2.5 border">
                      <p className="text-[10px] text-muted-foreground">N-Planejada</p>
                      <p className="text-base font-bold text-red-600">{op.total.paradaNaoPlanejada.toFixed(1)}h</p>
                    </div>
                  </div>

                  {/* Machines + Frentes */}
                  <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-muted-foreground">
                    <span>
                      <Wrench className="h-3 w-3 inline mr-1" />
                      Maquinas: {op.machines.join(', ')}
                    </span>
                    <span>
                      <Clock className="h-3 w-3 inline mr-1" />
                      Frentes: {op.frentes.join(', ')}
                    </span>
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
