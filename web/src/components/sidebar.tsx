'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  HardHat,
  ListChecks,
  Activity,
  Bell,
  MapPin,
  ShieldCheck,
  UserCog,
  Menu,
  X,
  HelpCircle,
  Tags,
  ChevronDown,
  Map,
  Route,
  Network,
  Wrench,
  Gauge,
  TrendingDown,
  ClipboardList,
  BarChart3,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem =
  | { href: string; label: string; icon: LucideIcon }
  | {
      label: string;
      icon: LucideIcon;
      children: { href: string; label: string; icon: LucideIcon }[];
    };

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/maquinas', label: 'Máquinas e Checklists', icon: HardHat },
  { href: '/checklists', label: 'Histórico de Checklists', icon: ListChecks },
  { href: '/atividades', label: 'Histórico de Atividades', icon: Activity },
  {
    label: 'Gestão de Atividades',
    icon: Tags,
    children: [
      { href: '/tipos-atividade', label: 'Tipos Atividade', icon: Tags },
      { href: '/perguntas-atividade', label: 'Perguntas Atividade', icon: HelpCircle },
      { href: '/localidades', label: 'Locais de Operação', icon: MapPin },
    ],
  },
  { href: '/alertas', label: 'Alertas', icon: Bell },
  { href: '/mapa', label: 'Mapa de Operadores', icon: Map },
  {
    label: 'Analises',
    icon: Activity,
    children: [
      { href: '/deslocamento', label: 'Deslocamento', icon: Route },
      { href: '/analise-maquinas', label: 'Analise Maquinas', icon: Wrench },
      { href: '/analise-operadores', label: 'Analise Operadores', icon: UserCog },
      { href: '/disponibilidade', label: 'DM & UF', icon: Gauge },
      { href: '/improdutividade', label: 'Improdutividade', icon: TrendingDown },
    ],
  },
  { href: '/perguntas-pre-operacao', label: 'Pre-Operacao', icon: HelpCircle },
  {
    label: 'Inspeção Comportamental',
    icon: ShieldCheck,
    children: [
      { href: '/inspecao-comportamental', label: 'Inspeções', icon: ShieldCheck },
      { href: '/dashboard-inspecoes', label: 'Dashboard Inspeções', icon: BarChart3 },
    ],
  },
  { href: '/unidades', label: 'Contratos', icon: Building2 },
  { href: '/planos-acao', label: 'Planos de Ação', icon: ClipboardList },
  { href: '/organograma', label: 'Organograma', icon: Network },
  { href: '/manutencao', label: 'Manutenção', icon: Wrench },
  { href: '/usuarios', label: 'Usuários', icon: UserCog },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

// Título da página derivado da navegação (mesma fonte de verdade dos rótulos do menu).
// Escolhe o item ativo com href mais específico (cobre rotas aninhadas).
export function getPageTitle(pathname: string): string {
  let best: { href: string; label: string } | null = null;
  for (const item of navItems) {
    const leaves = 'children' in item ? item.children : [item];
    for (const leaf of leaves) {
      if (isActive(pathname, leaf.href) && (!best || leaf.href.length > best.href.length)) {
        best = { href: leaf.href, label: leaf.label };
      }
    }
  }
  return best?.label ?? '';
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navItems.forEach((item) => {
      if ('children' in item && item.children.some((c) => isActive(pathname, c.href))) {
        initial[item.label] = true;
      }
    });
    return initial;
  });

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      navItems.forEach((item) => {
        if ('children' in item && item.children.some((c) => isActive(pathname, c.href))) {
          next[item.label] = true;
        }
      });
      return next;
    });
  }, [pathname]);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const navContent = (
    <>
      <div className="flex h-14 items-center justify-between gap-2 border-b px-5 text-primary">
        <div className="flex items-center gap-2.5">
          <img src="/logo.jpeg" alt="Segurança 360" className="h-11 w-11 rounded-md object-contain" />
          <p className="text-sm font-semibold">Segurança 360</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="md:hidden rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;

          if ('children' in item) {
            const anyChildActive = item.children.some((c) => isActive(pathname, c.href));
            const isExpanded = expanded[item.label] ?? false;
            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => ({ ...prev, [item.label]: !isExpanded }))
                  }
                  aria-expanded={isExpanded}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                    anyChildActive && !isExpanded
                      ? 'bg-primary/10 font-semibold text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate text-left">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isExpanded ? 'rotate-180' : ''
                    )}
                  />
                </button>
                {isExpanded && (
                  <div className="mt-1 ml-4 space-y-1 border-l border-border/60 pl-2">
                    {item.children.map(({ href, label, icon: ChildIcon }) => {
                      const active = isActive(pathname, href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={cn(
                            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                            active
                              ? 'bg-primary font-semibold text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          )}
                        >
                          <ChildIcon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-primary font-semibold text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-30 rounded-md border bg-card p-2 shadow-sm md:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile drawer (overlay) */}
      <div
        className={cn(
          'fixed inset-0 z-40 md:hidden transition-opacity',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        aria-hidden={!open}
      >
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => setOpen(false)}
        />
        <aside
          className={cn(
            'absolute left-0 top-0 flex h-full w-64 flex-col bg-card shadow-xl transition-transform',
            open ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {navContent}
        </aside>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-60 flex-col border-r bg-card shrink-0">
        {navContent}
      </aside>
    </>
  );
}
