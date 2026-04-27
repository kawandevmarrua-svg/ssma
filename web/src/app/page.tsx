import fs from 'node:fs';
import path from 'node:path';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: Eye,
    title: 'Visao clara',
    description: 'Operacao, alertas e indicadores em um painel simples e direto.',
  },
  {
    icon: ClipboardCheck,
    title: 'Execucao em campo',
    description: 'Checklist digital com evidencias e rastreabilidade do inicio ao fim.',
  },
  {
    icon: QrCode,
    title: 'Fluxo rapido',
    description: 'Leitura por QR Code para acelerar o uso do app no dia a dia.',
  },
];

const benefits = [
  'Menos planilha e menos retrabalho',
  'Mais velocidade para agir em campo',
  'Conformidade com registro auditavel',
];

export default function LandingPage() {
  const mobileImagePath = path.join(process.cwd(), 'public', 'app-mobile.png');
  const hasMobileScreenshot = fs.existsSync(mobileImagePath);

  return (
    <div className="min-h-screen bg-white text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-white/92 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
              Seguranca em 360
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#recursos" className="transition-colors hover:text-foreground">
              Recursos
            </a>
            <a href="#app" className="transition-colors hover:text-foreground">
              App
            </a>
            <a href="#cta" className="transition-colors hover:text-foreground">
              Acessar
            </a>
          </nav>

          <Link href="/login">
            <Button size="sm" className="rounded-full px-5">
              Login
            </Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="border-b border-border/50">
          <div className="container grid items-center gap-14 py-16 md:py-24 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-20">
            <div className="animate-enter-up max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                SSMA Smart Vision
              </span>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
                Gestao de SSMA
                <span className="block text-primary">clean, rapida e objetiva.</span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                Inspecoes, alertas, indicadores e operacao mobile em um fluxo unico.
                Sem excesso visual. Sem complexidade desnecessaria.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/login">
                  <Button size="lg" className="gap-2 rounded-full px-8">
                    Acessar painel
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <a href="#app">
                  <Button size="lg" variant="outline" className="rounded-full px-8">
                    Ver app
                  </Button>
                </a>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {benefits.map((item, index) => (
                  <div
                    key={item}
                    className="animate-enter-up rounded-2xl border border-border/70 bg-white p-4"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-primary" />
                      <p className="text-sm leading-6 text-foreground">{item}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="animate-enter-up animation-delay-150 mx-auto">
              <div className="relative mx-auto w-[224px] rounded-[2.4rem] border border-slate-900 bg-[#101010] p-2.5 shadow-[0_24px_70px_-28px_rgba(15,23,42,0.45)]">
                <div className="absolute left-1/2 top-2.5 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
                <div className="overflow-hidden rounded-[2rem] bg-[#f4f5f7]">
                  <div className="relative aspect-[9/19.5] w-full bg-[#f4f5f7]">
                    {hasMobileScreenshot ? (
                      <Image
                        src="/app-mobile.png"
                        alt="Tela do app Seguranca em 360"
                        fill
                        className="object-cover"
                        sizes="224px"
                        priority
                      />
                    ) : (
                      <div className="flex h-full flex-col bg-[#f7f7f8] p-3 text-slate-900">
                        <div className="rounded-[1.4rem] bg-[#111827] p-3 text-white">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">
                            Operador
                          </p>
                          <p className="mt-1 text-sm font-semibold">Checklist pre-uso</p>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                            <div className="rounded-xl bg-white/10 p-2">
                              <p className="text-white/50">Maquina</p>
                              <p className="mt-1">ESC-204</p>
                            </div>
                            <div className="rounded-xl bg-white/10 p-2">
                              <p className="text-white/50">Status</p>
                              <p className="mt-1 text-emerald-300">Liberada</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 space-y-2">
                          {[
                            'Escanear QR Code',
                            'Responder checklist',
                            'Registrar fotos',
                            'Enviar evidencia',
                          ].map((item) => (
                            <div
                              key={item}
                              className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-medium"
                            >
                              {item}
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 rounded-2xl border border-dashed border-primary/25 bg-primary/5 px-3 py-3 text-center text-[10px] leading-5 text-slate-500">
                          Adicione sua screenshot em `web/public/app-mobile.png`
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Screenshot real do app em `web/public/app-mobile.png`
              </p>
            </div>
          </div>
        </section>

        <section id="recursos" className="py-20">
          <div className="container">
            <div className="animate-enter-up mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                O essencial, muito bem resolvido.
              </h2>
              <p className="mt-4 text-muted-foreground">
                A plataforma foi pensada para reduzir ruido operacional e facilitar a tomada de decisao.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {features.map(({ icon: Icon, title, description }, index) => (
                <div
                  key={title}
                  className="animate-enter-up rounded-3xl border border-border/70 bg-white p-7 transition-transform duration-300 hover:-translate-y-1"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="app" className="border-y border-border/50 bg-slate-50/60 py-20">
          <div className="container grid items-center gap-12 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-20">
            <div className="animate-enter-up mx-auto lg:mx-0">
              <div className="relative mx-auto w-[224px] rounded-[2.4rem] border border-slate-900 bg-[#101010] p-2.5 shadow-[0_24px_70px_-28px_rgba(15,23,42,0.38)]">
                <div className="absolute left-1/2 top-2.5 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
                <div className="overflow-hidden rounded-[2rem] bg-white">
                  <div className="relative aspect-[9/19.5] w-full bg-[#f4f5f7]">
                    {hasMobileScreenshot ? (
                      <Image
                        src="/app-mobile.png"
                        alt="Preview do aplicativo mobile"
                        fill
                        className="object-cover"
                        sizes="224px"
                      />
                    ) : (
                      <div className="flex h-full flex-col justify-between bg-[#f7f7f8] p-3 text-slate-900">
                        <div>
                          <div className="rounded-[1.4rem] bg-white p-3 shadow-sm">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-primary">
                              Smart Vision
                            </p>
                            <p className="mt-1 text-sm font-semibold">Fluxo em campo</p>
                          </div>
                          <div className="mt-3 space-y-2">
                            {[
                              'Checklist digital',
                              'Fotos obrigatorias',
                              'Alerta imediato',
                            ].map((item) => (
                              <div
                                key={item}
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[11px]"
                              >
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-[#111827] px-3 py-3 text-[10px] leading-5 text-white/80">
                          Coloque a imagem real em `web/public/app-mobile.png`
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="animate-enter-up animation-delay-150 max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                App mobile
              </span>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Um app real para operar em campo.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                O operador escaneia a maquina, responde o checklist, registra evidencias e envia tudo no mesmo fluxo.
                A gestao recebe informacao pronta para agir.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  'Checklist pre-uso com QR Code',
                  'Registro de fotos e evidencias',
                  'Alertas com resposta rapida',
                  'Historico rastreavel da operacao',
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-border/70 bg-white px-4 py-4 text-sm text-foreground">
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="https://github.com/kawandevmarrua-svg/ssma/releases/latest"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="lg" className="rounded-full px-8">
                    Baixar APK
                  </Button>
                </a>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="rounded-full px-8">
                    Abrir plataforma
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="cta" className="py-20">
          <div className="container">
            <div className="animate-enter-up rounded-[2rem] border border-border/70 bg-white px-8 py-12 text-center sm:px-12">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Pronto para simplificar sua operacao?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Entre no painel e acompanhe a operacao com mais clareza, mais rastreabilidade e menos atrito.
              </p>
              <div className="mt-8 flex justify-center">
                <Link href="/login">
                  <Button size="lg" className="gap-2 rounded-full px-8">
                    Fazer login
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-white">
        <div className="container flex flex-col items-center justify-between gap-3 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Seguranca em 360</span>
          </div>
          <p>© {new Date().getFullYear()} Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
