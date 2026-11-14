"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Hash,
  TrendingUp,
  XCircle,
  LayoutDashboard,
  Lock,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SearchCheck,
  Settings,
  ShieldCheck,
  Timer,
  Tractor,
  Users,
  Wrench,
  X,
} from "lucide-react";
import {
  BarChart,
  PieChart,
  TimelineChart,
} from "@/app/(dashboard)/dashboard/charts";
import { cn } from "@/lib/utils";

/* ── Tipos ─────────────────────────────────────────────────── */

type NavItemData = {
  id: string;
  title: string;
  icon: React.ElementType;
  badge?: number | string;
  shortcut?: string;
  children?: NavItemData[];
};

type NavGroupData = {
  heading?: string;
  items: NavItemData[];
};

/* ── Navegação (espelha o produto real) ────────────────────── */

const navGroups: NavGroupData[] = [
  {
    items: [
      { id: "search", title: "Buscar", icon: Search, shortcut: "Ctrl K" },
      { id: "dashboard", title: "Dashboard", icon: LayoutDashboard },
      { id: "alertas", title: "Alertas", icon: Bell, badge: 3 },
      { id: "mapa", title: "Mapa da equipe", icon: MapPin },
    ],
  },
  {
    items: [
      { id: "checklists", title: "Checklists", icon: ClipboardCheck },
      { id: "inspecoes", title: "Inspeções", icon: SearchCheck },
      {
        id: "maquinas",
        title: "Máquinas",
        icon: Tractor,
        children: [
          { id: "maquinas-ativas", title: "Ativas", icon: Hash },
          { id: "maquinas-manutencao", title: "Em manutenção", icon: Hash },
        ],
      },
      { id: "atividades", title: "Atividades", icon: Timer },
    ],
  },
  {
    items: [
      { id: "manutencao", title: "Manutenção", icon: Wrench },
      { id: "usuarios", title: "Usuários", icon: Users },
    ],
  },
];

const bottomItems: NavItemData[] = [
  { id: "config", title: "Configurações", icon: Settings },
];

const flattenItems = (items: NavItemData[]): NavItemData[] =>
  items.reduce<NavItemData[]>((acc, item) => {
    acc.push(item);
    if (item.children) acc.push(...flattenItems(item.children));
    return acc;
  }, []);

const flatNav = flattenItems([
  ...navGroups.flatMap((g) => g.items),
  ...bottomItems,
]);

/* ── Dados mocados ─────────────────────────────────────────── */

/* Mesmo formato do portal: máquina por nome, resultado Liberado/Não Liberado */
const checklists = [
  { maquina: "Escavadeira CAT 320", operador: "Carlos Souza", data: "26/08/2026", resultado: "Liberado", badge: "bg-emerald-100 text-emerald-700" },
  { maquina: "Guindaste Liebherr LTM", operador: "João Pereira", data: "26/08/2026", resultado: "Não Liberado", badge: "bg-red-100 text-red-700" },
  { maquina: "Escavadeira CAT 320", operador: "Marcos Silva", data: "25/08/2026", resultado: "Liberado", badge: "bg-emerald-100 text-emerald-700" },
  { maquina: "Guindaste Liebherr LTM", operador: "Pedro Santos", data: "25/08/2026", resultado: "Pendente", badge: "bg-yellow-100 text-yellow-700" },
] as const;

const inspecoes = [
  { unidade: "Unidade Norte", inspetor: "Ana Lima", itens: 12, desvios: 1, tone: "warn" },
  { unidade: "Unidade Sul", inspetor: "Bruno Costa", itens: 12, desvios: 0, tone: "ok" },
  { unidade: "Frente 3", inspetor: "Ana Lima", itens: 8, desvios: 2, tone: "down" },
] as const;

/* ── Peças visuais ─────────────────────────────────────────── */

function StatusBadge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    ok: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    down: "bg-red-50 text-red-700",
    info: "bg-sky-50 text-sky-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        styles[tone] ?? styles.info,
      )}
    >
      {children}
    </span>
  );
}

function PanelCard({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-white p-4 shadow-sm">
      {title && (
        <div className={cn(description ? "mb-3" : "mb-3")}>
          <p className="text-[13px] font-semibold text-slate-800">{title}</p>
          {description && (
            <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function Row({
  left,
  middle,
  right,
}: {
  left: React.ReactNode;
  middle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border/40 py-2 text-[13px] last:border-0">
      <div className="min-w-0 flex-1">{left}</div>
      {middle && <div className="hidden text-slate-500 sm:block">{middle}</div>}
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/* ── Telas mocadas ─────────────────────────────────────────── */

/* Últimos 14 dias (dados de demonstração) */
const timelineDias = Array.from({ length: 14 }, (_, i) => {
  const dia = 13 + i;
  return `2026-08-${String(dia).padStart(2, "0")}`;
});
const checklistsPorDia: Record<string, number> = {
  "2026-08-13": 9,
  "2026-08-14": 12,
  "2026-08-15": 7,
  "2026-08-16": 4,
  "2026-08-17": 11,
  "2026-08-18": 13,
  "2026-08-19": 10,
  "2026-08-20": 14,
  "2026-08-21": 12,
  "2026-08-22": 8,
  "2026-08-23": 5,
  "2026-08-24": 13,
  "2026-08-25": 15,
  "2026-08-26": 11,
};

function ScreenDashboard() {
  /* KPI cards no formato do portal: ícone + label, valor grande colorido */
  const kpis = [
    { label: "Total Checklists", value: "38", icon: ClipboardCheck, color: "text-foreground" },
    { label: "Liberados", value: "35", icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Não Liberados", value: "2", icon: XCircle, color: "text-red-600" },
    { label: "Taxa Conformidade", value: "96%", icon: TrendingUp, color: "text-emerald-600" },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-border/50 bg-white p-3 shadow-sm"
          >
            <div className="mb-1.5 flex items-center gap-1.5">
              <k.icon className={cn("h-3.5 w-3.5 shrink-0", k.color)} />
              <span className="truncate text-[11px] text-slate-500">
                {k.label}
              </span>
            </div>
            <p className={cn("text-xl font-bold", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      <PanelCard
        title="Checklists por Dia"
        description="Volume diário no período"
      >
        <TimelineChart
          days={timelineDias}
          values={checklistsPorDia}
          color="#f97316"
          label="Checklists"
        />
      </PanelCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelCard
          title="Resultado dos Checklists"
          description="Distribuição por resultado no período"
        >
          <div className="flex items-center gap-6">
            <PieChart
              size={130}
              centerLabel="96%"
              segments={[
                { label: "Liberados", value: 35, color: "#10b981" },
                { label: "Não Liberados", value: 2, color: "#ef4444" },
                { label: "Pendentes", value: 1, color: "#eab308" },
              ]}
            />
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="h-3 w-3 shrink-0 rounded-sm bg-emerald-500" />
                <span>
                  Liberados:{" "}
                  <span className="font-semibold text-emerald-600">35</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-[13px]">
                <span className="h-3 w-3 shrink-0 rounded-sm bg-red-500" />
                <span>
                  Não Liberados:{" "}
                  <span className="font-semibold text-red-600">2</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-[13px]">
                <span className="h-3 w-3 shrink-0 rounded-sm bg-yellow-500" />
                <span>
                  Pendentes:{" "}
                  <span className="font-semibold text-yellow-600">1</span>
                </span>
              </div>
            </div>
          </div>
        </PanelCard>

        <PanelCard
          title="Últimos Checklists"
          description="Registros mais recentes do período"
        >
          <div className="space-y-2">
            {checklists.map((c, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-md border border-border/60 p-2.5 transition-colors hover:bg-slate-50"
              >
                <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-800">
                    {c.maquina}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {c.operador} · {c.data}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    c.badge,
                  )}
                >
                  {c.resultado}
                </span>
              </div>
            ))}
          </div>
        </PanelCard>
      </div>
    </div>
  );
}

function ScreenInspecoes() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <PanelCard title="Conformidade do mês">
          <div className="flex items-center gap-4">
            <PieChart
              size={120}
              centerLabel="96%"
              segments={[
                { label: "Conforme", value: 96, color: "#10b981" },
                { label: "Desvios", value: 4, color: "#ef4444" },
              ]}
            />
            <div className="flex flex-col gap-1.5 text-[12px] text-slate-600">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Conforme · 96%
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Desvios · 4%
              </span>
            </div>
          </div>
        </PanelCard>

        <PanelCard title="Desvios por categoria">
          <BarChart
            color="#f97316"
            labelWidth={90}
            data={[
              { label: "Uso de EPI", value: 5 },
              { label: "Isolamento", value: 3 },
              { label: "Postura", value: 2 },
              { label: "Procedimento", value: 2 },
            ]}
          />
        </PanelCard>
      </div>

      <PanelCard title="Inspeções recentes">
        {inspecoes.map((i) => (
          <Row
            key={i.unidade}
            left={
              <span className="flex flex-col">
                <span className="font-medium text-slate-800">{i.unidade}</span>
                <span className="text-[11px] text-slate-500">
                  {i.inspetor} · {i.itens} itens
                </span>
              </span>
            }
            right={
              <StatusBadge tone={i.tone}>
                {i.desvios === 0 ? "Sem desvios" : `${i.desvios} desvio(s)`}
              </StatusBadge>
            }
          />
        ))}
      </PanelCard>
    </div>
  );
}

const alertas = [
  { titulo: "Pneu com desgaste crítico", maquina: "CAM-108", hora: "10:03", tone: "down" },
  { titulo: "Desvio: operação sem isolamento", maquina: "Frente 3", hora: "09:15", tone: "warn" },
  { titulo: "Checklist reprovado", maquina: "CAM-108", hora: "06:55", tone: "warn" },
] as const;

function ScreenAlertas() {
  return (
    <PanelCard title="Alertas abertos">
      {alertas.map((a) => (
        <Row
          key={a.titulo}
          left={
            <span className="flex flex-col">
              <span className="font-medium text-slate-800">{a.titulo}</span>
              <span className="text-[11px] text-slate-500">
                {a.maquina} · {a.hora}
              </span>
            </span>
          }
          right={
            <StatusBadge tone={a.tone}>
              {a.tone === "down" ? "Crítico" : "Atenção"}
            </StatusBadge>
          }
        />
      ))}
    </PanelCard>
  );
}

function ScreenMapa() {
  const pins = [
    { left: "24%", top: "30%", label: "Carlos" },
    { left: "58%", top: "58%", label: "Marcos" },
    { left: "78%", top: "26%", label: "Pedro" },
  ];
  return (
    <PanelCard title="Equipe em campo agora">
      <div className="relative h-64 overflow-hidden rounded-lg bg-slate-100">
        <div className="absolute left-[-15%] top-[38%] h-2.5 w-[140%] -rotate-12 rounded-full bg-white" />
        <div className="absolute left-[55%] top-[-10%] h-[120%] w-2.5 rotate-12 rounded-full bg-white" />
        <div className="absolute left-[10%] top-[70%] h-2 w-[120%] rotate-3 rounded-full bg-white/70" />
        {pins.map((p) => (
          <div
            key={p.label}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: p.left, top: p.top }}
          >
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-sky-500 shadow" />
            </span>
            <span className="mt-1 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm">
              {p.label}
            </span>
          </div>
        ))}
      </div>
    </PanelCard>
  );
}

/* Tela bloqueada: convite ao login */
function LockedScreen({ titulo }: { titulo: string }) {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Lock className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-700">{titulo}</p>
        <p className="mt-1 max-w-[260px] text-[13px] text-slate-500">
          Essa tela faz parte do painel completo. Entre para ver os dados da
          sua operação.
        </p>
      </div>
      <Link
        href="/login"
        className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Entrar no painel
      </Link>
    </div>
  );
}

/* ── Sidebar ───────────────────────────────────────────────── */

function NavItem({
  item,
  activeId,
  onSelect,
  level = 0,
}: {
  item: NavItemData;
  activeId: string;
  onSelect: (id: string) => void;
  level?: number;
}) {
  const isActive = activeId === item.id;
  const hasChildren = !!item.children;
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    } else {
      onSelect(item.id);
    }
  };

  return (
    <div className="flex w-full flex-col">
      <button
        type="button"
        className={cn(
          "group flex w-full items-center justify-between rounded-md px-2.5 py-[7px] text-left transition-all duration-200",
          isActive
            ? "bg-black/5 font-medium text-foreground"
            : "text-slate-500 hover:bg-black/5 hover:text-slate-800",
        )}
        style={{ paddingLeft: `${level * 12 + 10}px` }}
        onClick={handleClick}
      >
        <span className="flex items-center gap-2.5">
          <item.icon
            className={cn(
              "h-4 w-4 transition-colors",
              isActive
                ? "text-primary"
                : "text-slate-400 group-hover:text-slate-600",
            )}
            strokeWidth={1.5}
          />
          <span className="truncate text-[13px] tracking-wide">
            {item.title}
          </span>
        </span>

        <span className="flex items-center gap-2">
          {item.shortcut && (
            <kbd className="hidden h-5 items-center justify-center rounded border border-border/50 bg-white px-1.5 font-mono text-[10px] font-medium text-slate-400 group-hover:inline-flex">
              {item.shortcut}
            </kbd>
          )}
          {item.badge && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
              {item.badge}
            </span>
          )}
          {hasChildren && (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={cn(
                "h-3.5 w-3.5 text-slate-400 transition-transform duration-200",
                isOpen && "rotate-90",
              )}
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          )}
        </span>
      </button>

      {hasChildren && (
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
            isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="relative mt-0.5 flex min-h-0 flex-col gap-0.5 overflow-hidden">
            <div
              className="absolute bottom-0 top-0 border-l border-black/5"
              style={{ left: `${level * 12 + 17.5}px` }}
            />
            {item.children!.map((child) => (
              <NavItem
                key={child.id}
                item={child}
                activeId={activeId}
                onSelect={onSelect}
                level={level + 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Componente principal ──────────────────────────────────── */

const screens: Record<string, { title: string; node: React.ReactNode }> = {
  dashboard: { title: "Dashboard", node: <ScreenDashboard /> },
  inspecoes: { title: "Inspeções", node: <ScreenInspecoes /> },
  alertas: { title: "Alertas", node: <ScreenAlertas /> },
  mapa: { title: "Mapa da equipe", node: <ScreenMapa /> },
  checklists: { title: "Checklists", node: <LockedScreen titulo="Checklists" /> },
  maquinas: { title: "Máquinas", node: <LockedScreen titulo="Máquinas" /> },
  "maquinas-ativas": {
    title: "Máquinas ativas",
    node: <LockedScreen titulo="Máquinas ativas" />,
  },
  "maquinas-manutencao": {
    title: "Em manutenção",
    node: <LockedScreen titulo="Máquinas em manutenção" />,
  },
  atividades: { title: "Atividades", node: <LockedScreen titulo="Atividades" /> },
  manutencao: { title: "Manutenção", node: <LockedScreen titulo="Manutenção" /> },
  usuarios: { title: "Usuários", node: <LockedScreen titulo="Usuários" /> },
  config: { title: "Configurações", node: <LockedScreen titulo="Configurações" /> },
};

export function DashboardPreview({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeId, setActiveId] = useState("dashboard");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Em telas estreitas a sidebar começa recolhida: sobra área útil de conteúdo
  React.useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) setIsOpen(false);
  }, []);

  const screen = screens[activeId] ?? screens.dashboard;

  const handleSelect = (id: string) => {
    if (id === "search") {
      setIsSearchOpen(true);
      return;
    }
    setActiveId(id);
  };

  const results = flatNav.filter(
    (i) =>
      i.id !== "search" &&
      i.title.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div
      className={cn(
        "relative flex h-[600px] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white text-left shadow-2xl shadow-slate-950/20 lg:h-[660px]",
        className,
      )}
    >
      {/* Barra de janela estilo macOS */}
      <div className="relative flex h-10 shrink-0 items-center border-b border-border/50 bg-slate-100/80 px-4">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-md bg-white px-3 py-1 text-[11px] text-slate-400 ring-1 ring-border/50">
          marrua.app/dashboard
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
      {/* Sidebar */}
      <div
        className={cn(
          "h-full shrink-0 overflow-hidden border-r border-border/50 bg-slate-50/60 transition-all duration-300 ease-in-out",
          isOpen ? "w-[230px] opacity-100" : "w-0 border-none opacity-0",
        )}
      >
        <div className="flex h-full w-[230px] flex-col p-3">
          <div className="mb-3 flex items-center gap-2.5 px-2 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="flex flex-col overflow-hidden">
              <span className="truncate text-[13px] font-medium leading-none text-foreground">
                Marrua Engenharia
              </span>
              <span className="mt-1 text-[11px] leading-none text-slate-500">
                Segurança em 360
              </span>
            </span>
          </div>

          <div className="mt-1 flex flex-1 flex-col gap-4 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navGroups.map((group, idx) => (
              <div key={idx} className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavItem
                    key={item.id}
                    item={item}
                    activeId={activeId}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-0.5 border-t border-border/50 pt-3">
            {bottomItems.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                activeId={activeId}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col bg-black/[0.02] transition-all duration-300">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 bg-white px-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? "Recolher menu" : "Expandir menu"}
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-black/5 hover:text-slate-800"
            >
              {isOpen ? (
                <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.5} />
              ) : (
                <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.5} />
              )}
            </button>
            <div className="flex min-w-0 items-center gap-2 text-sm text-slate-500">
              <span className="hidden truncate sm:inline">Marrua</span>
              <span className="hidden sm:inline">/</span>
              <span className="truncate font-medium text-foreground">
                {screen.title}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 rounded-md border border-border/50 bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-400 transition-colors hover:text-slate-600"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="hidden md:inline">Buscar…</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:p-5">
          {screen.node}
        </div>

        <div className="flex h-8 shrink-0 items-center justify-center border-t border-border/50 bg-white px-3">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Activity className="h-3 w-3" />
            Prévia interativa com dados de demonstração
          </span>
        </div>
      </div>
      </div>

      {/* Busca */}
      {isSearchOpen && (
        <div className="absolute inset-0 z-50 flex items-start justify-center bg-white/40 px-4 pt-[12vh] backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => {
              setIsSearchOpen(false);
              setQuery("");
            }}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-border/50 bg-white shadow-2xl">
            <div className="flex items-center border-b border-border/50 px-4">
              <Search
                className="mr-3 h-[18px] w-[18px] shrink-0 text-slate-400"
                strokeWidth={1.5}
              />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsSearchOpen(false);
                    setQuery("");
                  }
                  if (e.key === "Enter" && results[0]) {
                    setActiveId(results[0].id);
                    setIsSearchOpen(false);
                    setQuery("");
                  }
                }}
                className="flex-1 bg-transparent py-3.5 text-[14px] text-foreground outline-none placeholder:text-slate-400"
                placeholder="Buscar telas do painel…"
              />
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false);
                  setQuery("");
                }}
                aria-label="Fechar busca"
                className="ml-3 rounded-md p-1 text-slate-400 transition-colors hover:bg-black/5 hover:text-slate-700"
              >
                <X className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-slate-400">
                  Nada encontrado
                </p>
              ) : (
                results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setActiveId(r.id);
                      setIsSearchOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-slate-600 transition-colors hover:bg-black/5 hover:text-slate-900"
                  >
                    <r.icon className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
                    {r.title}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPreview;
