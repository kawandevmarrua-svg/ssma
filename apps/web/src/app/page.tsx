"use client";

import { useEffect, useState } from "react";
import { AnimatedGroup } from "@/components/ui/animated-group";
import { Button } from "@/components/ui/button";
import {
  type CarouselItem,
  CircularCarousel,
} from "@/components/ui/circular-carousel";
import { DashboardPreview } from "@/components/ui/dashboard-preview";
import { MobilePreview } from "@/components/ui/mobile-preview";
import PhoneMockupBasic from "@/components/ui/phone-mockups-1";
import { cn } from "@/lib/utils";
import { AnimatedFolder } from "@/components/ui/3d-folder";
import { LocationMap } from "@/components/ui/expand-map";
import { StatsBento } from "@/components/ui/stats-bento";
import {
  ArrowRight,
  Bell,
  ClipboardCheck,
  MapPin,
  Menu,
  Monitor,
  SearchCheck,
  ShieldCheck,
  Smartphone,
  Timer,
  Wrench,
  X,
} from "lucide-react";
import type { Variants } from "framer-motion";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

const APP_RELEASE_URL =
  "https://github.com/kawandevmarrua-svg/ssma/releases/tag/v1.0.5";

const transitionVariants: { item: Variants } = {
  item: {
    hidden: {
      opacity: 0,
      filter: "blur(12px)",
      y: 12,
    },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        type: "spring",
        bounce: 0.3,
        duration: 1.5,
      },
    },
  },
};

/* ── Header flutuante ──────────────────────────────────────── */
const menuItems = [
  { name: "Plataforma", href: "#plataforma" },
  { name: "Mapa", href: "#mapa" },
  { name: "Segurança", href: "#ssma" },
  { name: "App de campo", href: "#app" },
];

function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header>
      <nav className="group fixed z-40 w-full px-2">
        <div
          className={cn(
            "mx-auto mt-2 max-w-6xl px-4 transition-all duration-300 sm:px-6 lg:px-8",
            isScrolled &&
              "max-w-4xl rounded-2xl border border-border/60 bg-white/70 shadow-sm backdrop-blur-lg lg:px-5",
          )}
        >
          <div className="relative flex items-center justify-between gap-6 py-3">
            <Link href="/" aria-label="Início" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold tracking-tight">
                Segurança em 360
              </span>
            </Link>

            <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-sm sm:flex">
              {menuItems.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className="text-slate-600 transition-colors duration-150 hover:text-foreground"
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <Link href="/login" className="hidden sm:block">
                <Button size="sm" className="px-5">
                  Entrar
                </Button>
              </Link>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
                className="relative -m-2 block p-2 sm:hidden"
              >
                {menuOpen ? (
                  <X className="size-5" />
                ) : (
                  <Menu className="size-5" />
                )}
              </button>
            </div>
          </div>

          {menuOpen && (
            <div className="border-t border-border/60 py-4 sm:hidden">
              <ul className="space-y-1 text-sm">
                {menuItems.map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-lg px-2 py-3 text-slate-600 active:bg-slate-50"
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
                <li>
                  <Link href="/login" onClick={() => setMenuOpen(false)}>
                    <Button size="sm" className="w-full">
                      Entrar
                    </Button>
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

/* ── Dados ─────────────────────────────────────────────────── */
const modules: CarouselItem[] = [
  {
    id: "checklists",
    tag: "Campo",
    title: "Checklists pré-operação",
    description: "QR Code da máquina, checklist e fotos antes de operar.",
    icon: ClipboardCheck,
    points: [
      "QR Code identifica a máquina",
      "Foto obrigatória como evidência",
      "Funciona offline e sincroniza depois",
    ],
    quote: {
      text: "Escaneio o QR e em dois minutos a máquina está liberada.",
      author: "Carlos Souza",
      role: "Operador",
    },
  },
  {
    id: "inspecoes",
    tag: "Segurança",
    title: "Inspeções comportamentais",
    description: "Desvios com evidências, consolidados por unidade e período.",
    icon: SearchCheck,
    points: [
      "Desvios registrados com evidência",
      "Consolidado por unidade e período",
    ],
    quote: {
      text: "O desvio sai do papel e chega ao painel com foto.",
      author: "Ana Lima",
      role: "Técnica de segurança",
    },
  },
  {
    id: "mapa",
    tag: "Tempo real",
    title: "Mapa da equipe",
    description: "Localização e status de atividade de cada operador.",
    icon: MapPin,
    points: [
      "Posição de cada operador no mapa",
      "Status de atividade ao vivo",
    ],
    quote: {
      text: "Sei onde cada equipe está sem precisar ligar.",
      author: "Roberto Dias",
      role: "Encarregado",
    },
  },
  {
    id: "alertas",
    tag: "Gestão",
    title: "Alertas",
    description: "Não conformidades chegam ao gestor na hora do registro.",
    icon: Bell,
    points: [
      "Notificação na hora do registro",
      "Fila de pendências por unidade",
    ],
    quote: {
      text: "Fico sabendo da falha na hora, não no fim do dia.",
      author: "Márcia Alves",
      role: "Gestora SSMA",
    },
  },
  {
    id: "manutencao",
    tag: "Máquinas",
    title: "Manutenção",
    description: "Ordens abertas a partir das falhas dos checklists.",
    icon: Wrench,
    points: [
      "Ordem aberta direto da falha",
      "Histórico completo por máquina",
    ],
    quote: {
      text: "A ordem já chega com a falha e a foto do checklist.",
      author: "Paulo Reis",
      role: "Mecânico",
    },
  },
  {
    id: "atividades",
    tag: "Produção",
    title: "Atividades",
    description: "Apontamento de trabalho, tempos e improdutividade.",
    icon: Timer,
    points: [
      "Tempos e paradas por operador",
      "Improdutividade consolidada",
    ],
    quote: {
      text: "O apontamento acontece no campo, não na planilha.",
      author: "Diego Costa",
      role: "Planejamento",
    },
  },
];

/* ── Página ────────────────────────────────────────────────── */
export default function LandingPage() {
  const [previewMode, setPreviewMode] = useState<"web" | "mobile">("web");

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-white text-foreground">
        <SiteHeader />

        <main className="overflow-hidden">
          {/* Hero */}
          <section className="relative">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 [background:radial-gradient(80%_55%_at_50%_0%,rgba(249,115,22,0.07)_0%,transparent_70%)]"
            />
            <div className="relative pt-28 md:pt-36">
              <div className="mx-auto max-w-7xl px-6">
                <div className="text-center">
                  <AnimatedGroup variants={transitionVariants}>
                    <h1 className="mx-auto max-w-4xl text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl xl:text-7xl">
                      Segurança operacional, do campo ao painel.
                    </h1>
                    <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-relaxed text-slate-600 sm:mt-8 sm:text-lg">
                      Operadores registram checklists e inspeções pelo app.
                      Gestores acompanham conformidade, alertas e a localização
                      das equipes em tempo real.
                    </p>
                  </AnimatedGroup>

                  <AnimatedGroup
                    variants={{
                      container: {
                        visible: {
                          transition: {
                            staggerChildren: 0.05,
                            delayChildren: 0.75,
                          },
                        },
                      },
                      item: transitionVariants.item,
                    }}
                    className="mt-12 flex flex-col items-center justify-center gap-3 md:flex-row"
                  >
                    <div className="rounded-[14px] border border-border/60 bg-foreground/5 p-0.5">
                      <Link href="/login">
                        <Button size="lg" className="gap-2 rounded-xl px-6 text-base">
                          Acessar painel
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                    <a href="#app">
                      <Button
                        size="lg"
                        variant="ghost"
                        className="rounded-xl px-6 text-base"
                      >
                        Baixar app de campo
                      </Button>
                    </a>
                  </AnimatedGroup>
                </div>
              </div>

              <AnimatedGroup
                variants={{
                  container: {
                    visible: {
                      transition: {
                        staggerChildren: 0.05,
                        delayChildren: 0.75,
                      },
                    },
                  },
                  item: transitionVariants.item,
                }}
              >
                <div className="relative mt-10 flex flex-col items-center gap-6 px-2 sm:mt-14 md:mt-16">
                  {/* Alternador web / mobile */}
                  <div className="flex items-center gap-1 rounded-full border border-border/60 bg-white p-1 shadow-sm">
                    {(
                      [
                        { id: "web", label: "Painel web", icon: Monitor },
                        { id: "mobile", label: "App de campo", icon: Smartphone },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPreviewMode(opt.id)}
                        aria-pressed={previewMode === opt.id}
                        className={cn(
                          "flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                          previewMode === opt.id
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-slate-500 hover:text-slate-800",
                        )}
                      >
                        <opt.icon className="h-4 w-4" />
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    {previewMode === "web" ? (
                      <motion.div
                        key="web"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="flex w-full justify-center"
                      >
                        <DashboardPreview />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="mobile"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="flex w-full justify-center"
                      >
                        <MobilePreview />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </AnimatedGroup>
            </div>
          </section>

          {/* Plataforma */}
          <section id="plataforma" className="relative overflow-hidden bg-slate-950">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_110%,rgba(249,115,22,0.1)_0%,transparent_70%)]"
            />
            <div className="container relative py-20 md:py-28">
              <div className="max-w-xl">
                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  O que está na plataforma
                </h2>
                <p className="mt-4 leading-relaxed text-slate-400">
                  Seis módulos cobrem o ciclo inteiro: do checklist na máquina
                  ao indicador no painel do gestor.
                </p>
              </div>

              <div className="mt-10 overflow-hidden py-4">
                <CircularCarousel items={modules} />
              </div>
            </div>
          </section>

          {/* Mapa da equipe */}
          <section id="mapa" className="relative overflow-hidden border-t border-border/60">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 [background:radial-gradient(50%_50%_at_75%_50%,rgba(249,115,22,0.08)_0%,transparent_70%)]"
            />
            <div className="container relative grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2 lg:gap-16">
              <div className="max-w-xl">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  A equipe inteira no mapa
                </h2>
                <p className="mt-4 leading-relaxed text-slate-600">
                  Cada operador em campo aparece no painel com posição e status
                  de atividade, atualizados em tempo real. O gestor sabe onde
                  cada frente está sem sair da tela.
                </p>
                <ul className="mt-6 space-y-2.5 text-sm text-slate-600">
                  {[
                    "Localização enviada pelo app durante a jornada",
                    "Status de atividade junto da posição: operando, parado, em deslocamento",
                    "Histórico de deslocamento por operador e por dia",
                  ].map((item, i) => (
                    <motion.li
                      key={item}
                      className="flex items-start gap-2.5"
                      initial={{ opacity: 0, x: -16 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.6 }}
                      transition={{ duration: 0.45, delay: i * 0.12, ease: "easeOut" }}
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {item}
                    </motion.li>
                  ))}
                </ul>
              </div>

              <motion.div
                className="flex flex-col items-center gap-6 justify-self-center pb-8"
                initial={{ opacity: 0, y: 32, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ type: "spring", bounce: 0.25, duration: 0.9 }}
              >
                <LocationMap
                  location="Frente de serviço · Obra 12"
                  coordinates="15.6014° S, 56.0979° O"
                />
              </motion.div>
            </div>
          </section>

          {/* Inspeções em números */}
          <section id="inspecoes" className="border-t border-border/60">
            <div className="container py-16 md:py-24">
              <div className="max-w-xl">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Inspeções que viram número
                </h2>
                <p className="mt-4 leading-relaxed text-slate-600">
                  Cada inspeção comportamental registrada no campo alimenta os
                  indicadores do painel. Valores de demonstração:
                </p>
              </div>
              <div className="mt-10">
                <StatsBento />
              </div>
            </div>
          </section>

          {/* Segurança SSMA */}
          <section id="ssma" className="relative overflow-hidden bg-slate-950">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 [background:radial-gradient(50%_60%_at_25%_50%,rgba(249,115,22,0.08)_0%,transparent_70%)]"
            />
            <div className="container relative grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2 lg:gap-16">
              <div className="max-w-xl">
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  O registro que protege a operação
                </h2>
                <p className="mt-4 leading-relaxed text-slate-400">
                  Todo dado de SSMA nasce no campo e chega ao painel sem
                  edição no caminho. Quatro garantias sustentam isso:
                </p>
                <ul className="mt-6 space-y-2.5 text-sm text-slate-300">
                  {[
                    "Checklist reprovado bloqueia a operação e abre alerta na hora",
                    "Evidência fotográfica anexada no ato do registro",
                    "Autor, data, hora e localização gravados em cada registro",
                    "Cada função vê apenas o que lhe cabe: operador, encarregado, gestor",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="justify-self-center">
                <AnimatedFolder
                  title="Registros do dia"
                  projects={[
                    {
                      id: "checklist",
                      image: "/registros/checklist.svg",
                      title: "Checklist ESC-204",
                    },
                    {
                      id: "inspecao",
                      image: "/registros/inspecao.svg",
                      title: "Inspeção comportamental",
                    },
                    {
                      id: "alerta",
                      image: "/registros/alerta.svg",
                      title: "Alerta CAM-108",
                    },
                  ]}
                />
              </div>
            </div>
          </section>

          {/* App de campo */}
          <section id="app" className="border-t border-border/60">
            <div className="container grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2 lg:gap-16">
              <div className="max-w-xl">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  O app de campo
                </h2>
                <p className="mt-4 leading-relaxed text-slate-600">
                  Feito para o operador: leitura de QR Code, checklists com foto e
                  funcionamento offline. Android, direto no aparelho.
                </p>

                <ul className="mt-6 space-y-2.5 text-sm text-slate-600">
                  {[
                    "Identificação da máquina por QR Code, sem digitação",
                    "Checklist com evidência fotográfica obrigatória",
                    "Funciona sem sinal e sincroniza quando conectar",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex flex-wrap items-center gap-6">
                  <div className="rounded-xl bg-white p-3 ring-1 ring-border/60">
                    <QRCodeSVG value={APP_RELEASE_URL} size={112} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">
                      Escaneie com o celular
                    </p>
                    <a
                      href={APP_RELEASE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Baixar APK
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>

              <PhoneMockupBasic />
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/60">
          <div className="container flex flex-col items-center justify-between gap-3 py-6 text-sm text-slate-500 sm:flex-row">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Segurança em 360</span>
            </div>
            <p>&copy; {new Date().getFullYear()} Marrua Engenharia</p>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
