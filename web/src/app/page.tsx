'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  QrCode,
  ShieldCheck,
  Menu,
  X,
  Camera,
  Check,
  AlertTriangle,
  Bell,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/* ── Scroll-reveal ─────────────────────────────────────────── */
function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          io.unobserve(el);
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ── Animated counter ──────────────────────────────────────── */
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(0);
  const ran = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !ran.current) {
          ran.current = true;
          const duration = 1500;
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

/* ── Phone shell ───────────────────────────────────────────── */
function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-[240px] rounded-[2.5rem] border-2 border-slate-800 bg-slate-900 p-3 shadow-2xl">
      <div className="absolute left-1/2 top-3 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
      <div className="overflow-hidden rounded-[2rem] bg-white">
        <div className="relative aspect-[9/19.5] w-full">{children}</div>
      </div>
    </div>
  );
}

/* ── Status bar (inside phone) ─────────────────────────────── */
function StatusBar({ light = false }: { light?: boolean }) {
  const c = light ? 'text-white/70' : 'text-slate-500';
  return (
    <div className={`flex items-center justify-between px-5 pt-3 pb-1 text-[9px] font-semibold ${c}`}>
      <span>9:41</span>
      <div className="flex items-center gap-1">
        <div className="flex gap-px">
          {[8, 10, 12, 14].map((h) => (
            <div
              key={h}
              className={`w-[3px] rounded-sm ${light ? 'bg-white/60' : 'bg-slate-400'}`}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
        <div
          className={`ml-1 h-[10px] w-[18px] rounded-sm border ${
            light ? 'border-white/50' : 'border-slate-400'
          }`}
        >
          <div
            className={`m-px h-[6px] w-[12px] rounded-[1px] ${
              light ? 'bg-white/60' : 'bg-slate-400'
            }`}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Hero phone – Dashboard view ───────────────────────────── */
function HeroPhone() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setActive(true);
          io.unobserve(el);
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const activities = [
    { icon: Check, label: 'ESC-204', sub: 'Inspecao concluida', color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { icon: AlertTriangle, label: 'CAM-108', sub: 'Alerta pendente', color: 'text-amber-500', bg: 'bg-amber-50' },
    { icon: Check, label: 'RET-042', sub: 'Checklist OK', color: 'text-emerald-500', bg: 'bg-emerald-50' },
  ];

  return (
    <div ref={ref} className="relative">
      {/* Floating geometric shapes */}
      <div className="absolute -right-7 -top-7 h-14 w-14 animate-float rounded-full border-2 border-primary/20" />
      <div className="absolute -left-5 top-1/4 h-4 w-4 animate-float animation-delay-2000 rotate-45 bg-primary/15 rounded-sm" />
      <div className="absolute -right-4 bottom-1/3 h-3 w-3 animate-float animation-delay-4000 rounded-full bg-amber-400/30" />
      <div className="absolute -left-8 bottom-16 h-10 w-10 animate-spin-slow rounded-lg border border-dashed border-orange-300/30" />
      <div className="absolute -right-10 top-1/2 h-6 w-6 animate-float animation-delay-200">
        <ShieldCheck className="h-6 w-6 text-primary/20" />
      </div>
      <div className="absolute -left-3 -top-3 h-2 w-2 rounded-full bg-primary/25 animate-pulse-dot" />

      <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-b from-primary/10 to-transparent blur-2xl" />

      <PhoneShell>
        <div className="flex h-full flex-col bg-slate-50">
          <StatusBar />

          {/* Header */}
          <div className="mx-3 mt-1 flex items-center justify-between rounded-2xl bg-slate-900 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold text-white">Dashboard</span>
            </div>
            <div className="relative">
              <Bell className="h-3.5 w-3.5 text-white/70" />
              {active && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 animate-pulse-dot" />
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="mx-3 mt-2.5 grid grid-cols-3 gap-1.5">
            {[
              { n: '12', l: 'Inspecoes', c: 'text-slate-900' },
              { n: '3', l: 'Alertas', c: 'text-amber-600' },
              { n: '98%', l: 'Conforme', c: 'text-emerald-600' },
            ].map((s, i) => (
              <div
                key={s.l}
                className={`rounded-xl bg-white p-2 text-center shadow-sm ${
                  active ? 'animate-slide-item' : 'opacity-0'
                }`}
                style={{ animationDelay: `${300 + i * 100}ms` }}
              >
                <p className={`text-sm font-bold ${s.c}`}>{s.n}</p>
                <p className="text-[8px] text-slate-400 mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mx-3 mt-2.5 rounded-xl bg-white p-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-medium text-slate-600">Conformidade</span>
              <span className="text-[9px] font-bold text-emerald-600">98%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 ${
                  active ? 'animate-progress-fill' : 'w-0'
                }`}
                style={{ animationDelay: '600ms' }}
              />
            </div>
          </div>

          {/* Activity */}
          <div className="mx-3 mt-2.5 flex-1">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
              Atividade recente
            </p>
            <div className="mt-1.5 space-y-1.5">
              {activities.map((a, i) => (
                <div
                  key={a.label}
                  className={`flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm ${
                    active ? 'animate-slide-item' : 'opacity-0'
                  }`}
                  style={{ animationDelay: `${800 + i * 200}ms` }}
                >
                  <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${a.bg}`}>
                    <a.icon className={`h-3 w-3 ${a.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-slate-800">{a.label}</p>
                    <p className="text-[8px] text-slate-400">{a.sub}</p>
                  </div>
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                </div>
              ))}
            </div>
          </div>

          {/* Bottom nav */}
          <div className="mx-3 mb-3 mt-2 flex items-center justify-around rounded-2xl bg-white p-2 shadow-sm">
            {[
              { icon: Eye, active: true },
              { icon: ClipboardCheck, active: false },
              { icon: QrCode, active: false },
              { icon: ShieldCheck, active: false },
            ].map(({ icon: Icon, active: isActive }, i) => (
              <div
                key={i}
                className={`flex h-7 w-7 items-center justify-center rounded-xl ${
                  isActive ? 'bg-primary/10' : ''
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${
                    isActive ? 'text-primary' : 'text-slate-300'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      </PhoneShell>
    </div>
  );
}

/* ── Field phone – Checklist view ──────────────────────────── */
function FieldPhone() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setActive(true);
          io.unobserve(el);
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const checks = [
    { label: 'Freios verificados', done: true },
    { label: 'Extintor presente', done: true },
    { label: 'Farois funcionando', done: true },
    { label: 'Pneus em condicao', done: false },
  ];

  return (
    <div ref={ref} className="relative">
      {/* Floating geometric shapes */}
      <div className="absolute -left-6 -top-5 h-12 w-12 animate-float rounded-full border-2 border-dashed border-primary/15" />
      <div className="absolute -right-5 top-1/4 h-3.5 w-3.5 animate-float animation-delay-4000 rounded-full bg-emerald-400/25" />
      <div className="absolute -left-4 bottom-1/3 h-5 w-5 animate-float animation-delay-2000 rotate-12">
        <QrCode className="h-5 w-5 text-primary/15" />
      </div>
      <div className="absolute -right-8 bottom-20 h-8 w-8 animate-spin-slow border border-orange-200/30 rounded-md" />
      <div className="absolute -right-3 -top-3 h-2 w-2 rounded-full bg-emerald-400/30 animate-pulse-dot animation-delay-200" />
      <div className="absolute -left-7 top-1/2 h-5 w-5 animate-float animation-delay-150">
        <ClipboardCheck className="h-5 w-5 text-primary/15" />
      </div>

      <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-b from-primary/10 to-transparent blur-2xl" />

      <PhoneShell>
        <div className="flex h-full flex-col bg-slate-50">
          <StatusBar />

          {/* Header */}
          <div className="mx-3 mt-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <ChevronLeft className="h-3 w-3" />
              <span className="text-[9px]">Voltar</span>
            </div>
            <p className="mt-1 text-[12px] font-bold text-slate-900">Pre-operacao</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[8px] font-bold text-white">
                ESC-204
              </span>
              <span className="text-[9px] text-slate-400">Escavadeira</span>
            </div>
          </div>

          {/* QR scan area */}
          <div className="mx-3 mt-3 overflow-hidden rounded-xl bg-slate-900 p-3">
            <div className="relative flex aspect-square items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/5">
              {/* QR pattern */}
              <div className="grid grid-cols-3 gap-1.5 opacity-30">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-3 w-3 rounded-sm ${
                      [0, 2, 3, 5, 6, 8].includes(i) ? 'bg-white' : 'bg-transparent'
                    }`}
                  />
                ))}
              </div>

              {/* Scan line */}
              {active && (
                <div className="absolute left-2 right-2 h-px animate-scan-line bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
              )}

              {/* Corner brackets */}
              <div className="absolute left-1.5 top-1.5 h-3 w-3 border-l-2 border-t-2 border-primary/70 rounded-tl" />
              <div className="absolute right-1.5 top-1.5 h-3 w-3 border-r-2 border-t-2 border-primary/70 rounded-tr" />
              <div className="absolute bottom-1.5 left-1.5 h-3 w-3 border-b-2 border-l-2 border-primary/70 rounded-bl" />
              <div className="absolute bottom-1.5 right-1.5 h-3 w-3 border-b-2 border-r-2 border-primary/70 rounded-br" />
            </div>
            <p className="mt-2 text-center text-[8px] text-white/40">
              Aponte para o QR Code da maquina
            </p>
          </div>

          {/* Checklist */}
          <div className="mx-3 mt-3 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              Checklist
            </p>
            <div className="mt-1.5 space-y-1.5">
              {checks.map((c, i) => (
                <div
                  key={c.label}
                  className={`flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm ${
                    active ? 'animate-slide-item' : 'opacity-0'
                  }`}
                  style={{ animationDelay: `${500 + i * 200}ms` }}
                >
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-md ${
                      c.done
                        ? 'bg-emerald-500'
                        : 'border-2 border-slate-200 bg-white'
                    }`}
                  >
                    {c.done && active && (
                      <Check
                        className="h-3 w-3 text-white animate-check-pop"
                        style={{ animationDelay: `${700 + i * 200}ms` }}
                      />
                    )}
                  </div>
                  <span
                    className={`text-[10px] ${
                      c.done
                        ? 'text-slate-600'
                        : 'font-medium text-slate-900'
                    }`}
                  >
                    {c.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action bar */}
          <div className="mx-3 mb-3 mt-2 flex items-center gap-2">
            <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
              <Camera className="h-4 w-4 text-slate-400" />
            </button>
            <div className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 shadow-md shadow-primary/25">
              <span className="text-[10px] font-semibold text-white">Enviar</span>
              <ArrowRight className="h-3 w-3 text-white" />
            </div>
          </div>
        </div>
      </PhoneShell>
    </div>
  );
}

/* ── Data ──────────────────────────────────────────────────── */
const features = [
  {
    icon: Eye,
    title: 'Visao em tempo real',
    description:
      'Painel limpo com alertas, indicadores e status da operacao. Tudo o que importa, nada que distrai.',
  },
  {
    icon: ClipboardCheck,
    title: 'Execucao digital',
    description:
      'Checklist com evidencias fotograficas, rastreabilidade completa e envio instantaneo.',
  },
  {
    icon: QrCode,
    title: 'Fluxo por QR Code',
    description:
      'Leitura rapida para identificar maquinas e iniciar inspecoes sem digitacao.',
  },
];

const metrics = [
  { value: 98, suffix: '%', label: 'Conformidade alcancada' },
  { value: 3, suffix: 'x', label: 'Mais rapido que planilha' },
  { value: 100, suffix: '%', label: 'Digital e rastreavel' },
];

const steps = [
  { num: '01', title: 'Escaneie', desc: 'Aponte para o QR Code da maquina.' },
  { num: '02', title: 'Preencha', desc: 'Responda o checklist e registre fotos.' },
  { num: '03', title: 'Envie', desc: 'A gestao recebe tudo em tempo real.' },
];

/* ── Page ──────────────────────────────────────────────────── */
export default function LandingPage() {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* ── Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-white/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Seguranca em 360
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#recursos" className="transition-colors hover:text-foreground">
              Recursos
            </a>
            <a href="#como-funciona" className="transition-colors hover:text-foreground">
              Como funciona
            </a>
            <a href="#app" className="transition-colors hover:text-foreground">
              App
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden md:block">
              <Button size="sm" className="rounded-full px-6">
                Entrar
              </Button>
            </Link>
            <button
              className="p-2 text-muted-foreground md:hidden"
              onClick={() => setMobileNav(!mobileNav)}
              aria-label="Menu"
            >
              {mobileNav ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {mobileNav && (
          <div className="animate-in fade-in slide-in-from-top-2 border-t border-border/40 bg-white px-6 py-4 duration-200 md:hidden">
            <nav className="flex flex-col gap-4 text-sm">
              <a href="#recursos" onClick={() => setMobileNav(false)} className="text-muted-foreground hover:text-foreground">
                Recursos
              </a>
              <a href="#como-funciona" onClick={() => setMobileNav(false)} className="text-muted-foreground hover:text-foreground">
                Como funciona
              </a>
              <a href="#app" onClick={() => setMobileNav(false)} className="text-muted-foreground hover:text-foreground">
                App
              </a>
              <Link href="/login" onClick={() => setMobileNav(false)}>
                <Button size="sm" className="w-full rounded-full">Entrar</Button>
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* ── Hero ──────────────────────────────────────────── */}
        <section>
          <div className="container grid items-center gap-12 py-20 md:py-28 lg:grid-cols-[1fr_300px] lg:gap-20 lg:py-36">
            {/* Text */}
            <div className="max-w-2xl">
              <Reveal>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                  Seguranca que se ve.{' '}
                  <span className="bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
                    Resultado que se mede.
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={100}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                  Centralize inspecoes, alertas e indicadores em uma unica
                  plataforma. Menos planilha, mais acao.
                </p>
              </Reveal>

              <Reveal delay={200}>
                <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                  <Link href="/login">
                    <Button
                      size="lg"
                      className="gap-2 rounded-full px-8 shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
                    >
                      Acessar painel
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <a href="#recursos">
                    <Button
                      size="lg"
                      variant="ghost"
                      className="rounded-full px-8 text-muted-foreground"
                    >
                      Conhecer recursos
                    </Button>
                  </a>
                </div>
              </Reveal>
            </div>

            {/* Phone */}
            <Reveal delay={200} className="mx-auto lg:mx-0">
              <HeroPhone />
            </Reveal>
          </div>
        </section>

        {/* ── Metrics ───────────────────────────────────────── */}
        <section className="border-y border-border/40">
          <div className="container py-16">
            <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
              {metrics.map((m, i) => (
                <Reveal key={m.label} delay={i * 100}>
                  <div className="text-center">
                    <p className="text-4xl font-bold tracking-tight md:text-5xl">
                      <Counter target={m.value} suffix={m.suffix} />
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{m.label}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────── */}
        <section id="recursos" className="py-24 md:py-32">
          <div className="container">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Tudo que voce precisa.
                  <br />
                  <span className="font-normal text-muted-foreground">
                    Nada que nao precisa.
                  </span>
                </h2>
              </div>
            </Reveal>

            <div className="mt-16 grid gap-6 md:grid-cols-3">
              {features.map(({ icon: Icon, title, description }, i) => (
                <Reveal key={title} delay={i * 120}>
                  <div className="group rounded-2xl border border-border/50 bg-white p-8 transition-all duration-300 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-6 text-lg font-semibold">{title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────── */}
        <section
          id="como-funciona"
          className="border-y border-border/40 py-24 md:py-32"
        >
          <div className="container">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Tres passos. Zero atrito.
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Do campo ao painel em segundos.
                </p>
              </div>
            </Reveal>

            <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
              {steps.map((s, i) => (
                <Reveal key={s.num} delay={i * 150}>
                  <div className="relative text-center md:text-left">
                    <span className="text-7xl font-bold leading-none text-primary/10">
                      {s.num}
                    </span>
                    <h3 className="-mt-2 text-xl font-semibold">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {s.desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── App Mobile ────────────────────────────────────── */}
        <section id="app" className="py-24 md:py-32">
          <div className="container grid items-center gap-16 lg:grid-cols-[280px_1fr] lg:gap-24">
            <Reveal className="mx-auto lg:mx-0">
              <FieldPhone />
            </Reveal>

            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-4 py-1.5 text-xs font-medium tracking-wide text-primary">
                  App mobile
                </span>
                <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
                  Feito para o campo.
                </h2>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
                  O operador escaneia, preenche e envia — tudo no mesmo fluxo. A
                  gestao recebe dados prontos para agir.
                </p>
              </Reveal>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {[
                  'Checklist com QR Code',
                  'Registro de evidencias',
                  'Alertas em tempo real',
                  'Historico rastreavel',
                ].map((item, i) => (
                  <Reveal key={item} delay={i * 80}>
                    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-white p-4 text-sm transition-colors hover:border-primary/20">
                      <CheckCircle2 className="h-4 w-4 flex-none text-primary" />
                      {item}
                    </div>
                  </Reveal>
                ))}
              </div>

              <Reveal delay={350}>
                <div className="mt-8">
                  <Link href="/login">
                    <Button size="lg" className="rounded-full px-8">
                      Acessar plataforma
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────── */}
        <section id="cta" className="border-t border-border/40">
          <div className="container py-24 md:py-32">
            <Reveal>
              <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl bg-slate-900 px-8 py-16 text-center sm:px-16">
                <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-primary/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />

                <div className="relative">
                  <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    Pronto para simplificar?
                  </h2>
                  <p className="mx-auto mt-4 max-w-md text-base text-slate-400">
                    Entre no painel e acompanhe sua operacao com mais clareza e
                    menos atrito.
                  </p>
                  <div className="mt-8">
                    <Link href="/login">
                      <Button
                        size="lg"
                        className="rounded-full px-10 shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:shadow-primary/40"
                      >
                        Comecar agora
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-border/40">
        <div className="container flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Seguranca em 360</span>
          </div>
          <p>&copy; {new Date().getFullYear()} Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
