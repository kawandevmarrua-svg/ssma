'use client';

import {
  PieChart as RePieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';

// ── Helpers ──

function formatDay(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// ── Custom Tooltip ──

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-medium text-foreground mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color || p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Charts (Recharts) ──

export function PieChart({
  segments,
  size = 150,
  centerLabel,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  centerLabel?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return (
      <div className="rounded-full bg-muted/60 flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-xs text-muted-foreground">Sem dados</span>
      </div>
    );
  }

  const data = segments.map((s) => ({ name: s.label, value: s.value, fill: s.color }));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RePieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={size * 0.3}
            outerRadius={size * 0.47}
            dataKey="value"
            strokeWidth={2}
            stroke="hsl(var(--background))"
            animationBegin={0}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </RePieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-sm font-bold text-foreground">{centerLabel}</span>
        </div>
      )}
    </div>
  );
}

export function BarChart({
  data,
  color = '#3b82f6',
  labelWidth = 110,
}: {
  data: { label: string; value: number }[];
  color?: string;
  labelWidth?: number;
}) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={data.length * 40 + 20}>
      <ReBarChart data={data} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
        <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={labelWidth}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
        <Bar
          dataKey="value"
          name="Quantidade"
          fill={color}
          radius={[0, 6, 6, 0]}
          animationBegin={0}
          animationDuration={600}
          animationEasing="ease-out"
          barSize={24}
        />
      </ReBarChart>
    </ResponsiveContainer>
  );
}

export function TimelineChart({
  days,
  values,
  color = '#3b82f6',
  label,
}: {
  days: string[];
  values: Record<string, number>;
  color?: string;
  label: string;
}) {
  const data = days.map((day) => ({
    day: formatDay(day),
    [label]: values[day] || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ left: -20, right: 10, top: 5, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          interval={days.length > 14 ? Math.ceil(days.length / 10) - 1 : 0}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey={label}
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#grad-${label})`}
          animationBegin={0}
          animationDuration={800}
          animationEasing="ease-out"
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
