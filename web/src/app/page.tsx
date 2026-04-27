import Link from 'next/link';
import {
  ShieldCheck,
  Eye,
  ClipboardCheck,
  AlertTriangle,
  BarChart3,
  Users,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: Eye,
    title: 'Smart Vision',
    description:
      'Monitoramento inteligente em tempo real com visão 360° das suas operações de SSMA.',
  },
  {
    icon: ClipboardCheck,
    title: 'Checklists Digitais',
    description:
      'Inspeções padronizadas, rastreáveis e disponíveis no app mobile dos operadores.',
  },
  {
    icon: AlertTriangle,
    title: 'Alertas Imediatos',
    description:
      'Receba notificações automáticas de ocorrências críticas e tome decisões mais rápido.',
  },
  {
    icon: BarChart3,
    title: 'Indicadores em Tempo Real',
    description:
      'KPIs de segurança, manutenção e produtividade consolidados em um único painel.',
  },
  {
    icon: Users,
    title: 'Gestão de Operadores',
    description:
      'Controle de cargos, atividades e permissões com auditoria completa de acessos.',
  },
  {
    icon: ShieldCheck,
    title: 'Conformidade Total',
    description:
      'Atenda às normas de SSMA com registros auditáveis e rastreabilidade ponta a ponta.',
  },
];

const benefits = [
  'Reduza incidentes com visibilidade total das operações',
  'Centralize inspeções, máquinas e equipes em um só lugar',
  'Acelere tomadas de decisão com dados confiáveis',
  'Garanta conformidade com auditoria nativa',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/30">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-primary">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="text-base font-semibold tracking-tight text-foreground">
              Segurança em 360
            </span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Recursos
            </a>
            <a href="#beneficios" className="transition-colors hover:text-foreground">
              Benefícios
            </a>
            <a href="#cta" className="transition-colors hover:text-foreground">
              Começar
            </a>
          </nav>
          <Link href="/login">
            <Button size="sm" className="gap-1.5">
              Login
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute right-0 top-40 h-[320px] w-[320px] rounded-full bg-accent/40 blur-3xl" />
          </div>

          <div className="container flex flex-col items-center gap-8 py-20 text-center md:py-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              SSMA · Smart Vision
            </span>
            <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Gestão de SSMA com{' '}
              <span className="bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent">
                visão 360°
              </span>{' '}
              da sua operação
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              Inspeções, alertas, indicadores e equipes integrados em uma única
              plataforma. Tome decisões mais seguras, em tempo real, com dados
              confiáveis e rastreáveis.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Link href="/login">
                <Button size="lg" className="gap-2 px-8 text-base shadow-lg shadow-primary/20">
                  Acessar painel
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="px-8 text-base">
                  Conhecer recursos
                </Button>
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Inspeções padronizadas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Alertas em tempo real
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Indicadores acionáveis
              </span>
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-border/60 bg-background/40 py-20">
          <div className="container">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Tudo que sua operação de SSMA precisa
              </h2>
              <p className="mt-4 text-muted-foreground">
                Da inspeção de campo ao indicador estratégico — um fluxo único,
                conectado e auditável.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="group relative rounded-xl border border-border/60 bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="beneficios" className="py-20">
          <div className="container grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Mais segurança, menos retrabalho
              </h2>
              <p className="mt-4 text-muted-foreground">
                Centralize informações de máquinas, atividades, operadores e
                inspeções. Substitua planilhas e papéis por um fluxo digital
                que entrega dados prontos para decisão.
              </p>
              <ul className="mt-8 space-y-4">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <span className="text-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-10">
                <Link href="/login">
                  <Button size="lg" className="gap-2">
                    Entrar agora
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 via-accent/40 to-transparent blur-2xl" />
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'Inspeções', value: '+100%', sub: 'rastreabilidade' },
                  { label: 'Alertas', value: 'tempo real', sub: 'sem atraso' },
                  { label: 'KPIs', value: '360°', sub: 'visão integrada' },
                  { label: 'Conformidade', value: 'auditável', sub: 'fim a fim' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-border/60 bg-card p-6 shadow-sm"
                  >
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-foreground">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {stat.sub}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="cta" className="pb-24">
          <div className="container">
            <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary to-orange-600 p-10 text-center shadow-xl sm:p-16">
              <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-12 -right-12 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
              <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
                Pronto para elevar sua gestão de SSMA?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-primary-foreground/90">
                Acesse o painel e comece a operar com a visão 360° que sua
                equipe precisa para decidir com confiança.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="gap-2 bg-white px-8 text-base text-primary hover:bg-white/90"
                  >
                    Fazer login
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-background/60">
        <div className="container flex flex-col items-center justify-between gap-3 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Segurança em 360 · Smart Vision</span>
          </div>
          <p>© {new Date().getFullYear()} Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
