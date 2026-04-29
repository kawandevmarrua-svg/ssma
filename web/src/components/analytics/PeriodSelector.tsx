'use client';

export type AnalyticsPeriod = '7d' | '30d' | '90d';

const LABELS: Record<AnalyticsPeriod, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
};

const INLINE: Record<AnalyticsPeriod, string> = {
  '7d': 'nos ultimos 7 dias',
  '30d': 'nos ultimos 30 dias',
  '90d': 'nos ultimos 90 dias',
};

const SHORT: Record<AnalyticsPeriod, string> = {
  '7d': '7d',
  '30d': '30d',
  '90d': '90d',
};

const DAYS: Record<AnalyticsPeriod, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export function periodToDays(p: AnalyticsPeriod) {
  return DAYS[p];
}

export function periodLabel(p: AnalyticsPeriod) {
  return LABELS[p];
}

export function periodInline(p: AnalyticsPeriod) {
  return INLINE[p];
}

export function periodShort(p: AnalyticsPeriod) {
  return SHORT[p];
}

interface PeriodSelectorProps {
  value: AnalyticsPeriod;
  onChange: (p: AnalyticsPeriod) => void;
  className?: string;
}

export function PeriodSelector({ value, onChange, className }: PeriodSelectorProps) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      {(['7d', '30d', '90d'] as AnalyticsPeriod[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
            value === p
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:bg-muted'
          }`}
        >
          {LABELS[p]}
        </button>
      ))}
    </div>
  );
}
