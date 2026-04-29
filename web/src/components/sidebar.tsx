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
  { href: '/maquinas', label: 'Maquinas', icon: HardHat },
  { href: '/checklists', label: 'Checklists', icon: ListChecks },
  {
    label: 'Gestão de Atividades',
    icon: Activity,
    children: [
      { href: '/atividades', label: 'Atividades', icon: Activity },
      { href: '/tipos-atividade', label: 'Tipos Atividade', icon: Tags },
      { href: '/perguntas-pre-operacao', label: 'Pre-Operacao', icon: HelpCircle },
      { href: '/localidades', label: 'Localidades', icon: MapPin },
    ],
  },
  { href: '/alertas', label: 'Alertas', icon: Bell },
  { href: '/mapa', label: 'Mapa', icon: Map },
  {
    label: 'Analises',
    icon: Activity,
    children: [
      { href: '/deslocamento', label: 'Deslocamento', icon: Route },
      { href: '/analise-maquinas', label: 'Analise Maquinas', icon: Wrench },
      { href: '/disponibilidade', label: 'DM & UF', icon: Gauge },
      { href: '/improdutividade', label: 'Improdutividade', icon: TrendingDown },
    ],
  },
  { href: '/organograma', label: 'Organograma', icon: Network },
  { href: '/usuarios', label: 'Usuários', icon: UserCog },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
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
      <div className="flex items-center justify-between gap-2 border-b px-5 py-4 text-primary">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">Segurança 360</p>
            <p className="text-xs text-muted-foreground">Smart Vision</p>
          </div>
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
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    anyChildActive && !isExpanded
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isExpanded ? 'rotate-180' : ''
                    )}
                  />
                </button>
                {isExpanded && (
                  <div className="mt-1 ml-7 space-y-1 border-l border-border/60 pl-4">
                    {item.children.map(({ href, label, icon: ChildIcon }) => {
                      const active = isActive(pathname, href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={cn(
                            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            active
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          )}
                        >
                          <ChildIcon className="h-4 w-4" />
                          {label}
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
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
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
