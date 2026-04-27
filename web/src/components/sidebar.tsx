'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  HardHat,
  ListChecks,
  Activity,
  Bell,
  Eye,
  BarChart3,
  Settings,
  ShieldCheck,
  UserCog,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/operadores', label: 'Operadores', icon: Users },
  { href: '/maquinas', label: 'Maquinas', icon: HardHat },
  { href: '/checklists', label: 'Checklists', icon: ListChecks },
  { href: '/atividades', label: 'Atividades', icon: Activity },
  { href: '/alertas', label: 'Alertas', icon: Bell },
  { href: '/inspecoes', label: 'Inspeções', icon: Eye },
  { href: '/indicadores', label: 'Indicadores', icon: BarChart3 },
  { href: '/usuarios', label: 'Usuários', icon: UserCog },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
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
              <Icon className="h-4 w-4" />
              {label}
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
