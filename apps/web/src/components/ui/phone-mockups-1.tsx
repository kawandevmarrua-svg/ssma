"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  Camera,
  Check,
  ClipboardCheck,
  Eye,
  MapPin,
  QrCode,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import {
  type ImageItem,
  PhoneCarousel,
} from "@/components/ui/phone-mockups-1-utils/phone-carousel";

/* ── Barra de status (dentro do celular) ───────────────────── */
function StatusBar({ light = false }: { light?: boolean }) {
  const tone = light ? "text-white/70" : "text-slate-400";
  return (
    <div
      className={`flex items-center justify-between px-4 pb-1 pt-3 text-xs font-semibold ${tone}`}
    >
      <span>9:41</span>
      <Wifi className="h-3 w-3" />
    </div>
  );
}

/* ── Tela 1: checklist pré-operação ────────────────────────── */
export function ChecklistScreen() {
  const checks = [
    { label: "Freios verificados", done: true },
    { label: "Extintor presente", done: true },
    { label: "Faróis funcionando", done: true },
    { label: "Pneus em condição", done: false },
  ];

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <StatusBar />

      <div className="mx-3">
        <p className="text-xs font-bold text-slate-900">Pré-operação</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded bg-slate-900 px-1.5 py-0.5 text-xs font-bold text-white">
            ESC-204
          </span>
          <span className="text-xs text-slate-400">Escavadeira</span>
        </div>
      </div>

      <div className="mx-3 mt-2.5 rounded-xl bg-slate-900 p-2.5">
        <div className="relative flex h-16 items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/5">
          <QrCode className="h-6 w-6 text-white/40" />
          <div className="absolute left-1.5 top-1.5 h-2.5 w-2.5 rounded-tl border-l-2 border-t-2 border-primary/70" />
          <div className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-tr border-r-2 border-t-2 border-primary/70" />
          <div className="absolute bottom-1.5 left-1.5 h-2.5 w-2.5 rounded-bl border-b-2 border-l-2 border-primary/70" />
          <div className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-br border-b-2 border-r-2 border-primary/70" />
        </div>
        <p className="mt-1.5 text-center text-xs text-white/40">
          QR Code da máquina
        </p>
      </div>

      <div className="mx-3 mt-2.5 flex-1 space-y-1.5">
        {checks.map((c) => (
          <div
            key={c.label}
            className="flex items-center gap-2 rounded-lg bg-white p-2 shadow-sm"
          >
            <span
              className={`flex h-[18px] w-[18px] items-center justify-center rounded ${
                c.done ? "bg-emerald-500" : "border-2 border-slate-200 bg-white"
              }`}
            >
              {c.done && <Check className="h-3 w-3 text-white" />}
            </span>
            <span
              className={`text-xs ${
                c.done ? "text-slate-500" : "font-medium text-slate-900"
              }`}
            >
              {c.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mx-3 mb-3 mt-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white">
          <Camera className="h-3.5 w-3.5 text-slate-400" />
        </span>
        <span className="flex h-8 flex-1 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-white">
          Enviar
        </span>
      </div>
    </div>
  );
}

/* ── Tela 2: resumo do operador ────────────────────────────── */
export function HomeScreen() {
  const items = [
    {
      icon: Check,
      label: "ESC-204",
      sub: "Checklist enviado",
      tone: "text-emerald-500",
      bg: "bg-emerald-50",
    },
    {
      icon: AlertTriangle,
      label: "CAM-108",
      sub: "Alerta pendente",
      tone: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      icon: Check,
      label: "RET-042",
      sub: "Inspeção concluída",
      tone: "text-emerald-500",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <StatusBar />

      <div className="mx-3 flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-white">Hoje</span>
        </div>
        <Bell className="h-3.5 w-3.5 text-white/70" />
      </div>

      <div className="mx-3 mt-2.5 grid grid-cols-3 gap-1.5">
        {[
          { n: "12", l: "Checklists", c: "text-slate-900" },
          { n: "3", l: "Alertas", c: "text-amber-600" },
          { n: "96%", l: "Conforme", c: "text-emerald-600" },
        ].map((s) => (
          <div
            key={s.l}
            className="rounded-lg bg-white p-2 text-center shadow-sm"
          >
            <p className={`text-sm font-bold ${s.c}`}>{s.n}</p>
            <p className="mt-0.5 text-xs text-slate-400">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="mx-3 mt-2.5 flex-1">
        <p className="text-xs font-semibold text-slate-400">
          Atividade recente
        </p>
        <div className="mt-1.5 space-y-1.5">
          {items.map((a) => (
            <div
              key={a.label}
              className="flex items-center gap-2 rounded-lg bg-white p-2 shadow-sm"
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-md ${a.bg}`}
              >
                <a.icon className={`h-3 w-3 ${a.tone}`} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800">
                  {a.label}
                </p>
                <p className="text-xs text-slate-400">{a.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-3 mb-3 mt-2 flex items-center justify-around rounded-xl bg-white p-2 shadow-sm">
        {[Eye, ClipboardCheck, QrCode, MapPin].map((Icon, i) => (
          <span
            key={i}
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              i === 0 ? "bg-primary/10" : ""
            }`}
          >
            <Icon
              className={`h-3.5 w-3.5 ${i === 0 ? "text-primary" : "text-slate-300"}`}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Tela 3: mapa da equipe ────────────────────────────────── */
export function MapScreen() {
  const pins = [
    { top: "22%", left: "30%", tone: "bg-emerald-500" },
    { top: "42%", left: "62%", tone: "bg-sky-500" },
    { top: "60%", left: "38%", tone: "bg-amber-500" },
  ];

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <StatusBar />

      <div className="mx-3 flex items-center justify-between">
        <p className="text-xs font-bold text-slate-900">Equipe em campo</p>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
          3 ativos
        </span>
      </div>

      <div
        className="relative mx-3 mb-3 mt-2.5 flex-1 overflow-hidden rounded-xl bg-emerald-50/70"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.06) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        <div className="absolute left-[-20%] top-[35%] h-2 w-[140%] -rotate-12 rounded-full bg-white/80" />
        <div className="absolute left-[55%] top-[-10%] h-[120%] w-2 rotate-12 rounded-full bg-white/80" />

        {pins.map((p, i) => (
          <span
            key={i}
            className="absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ top: p.top, left: p.left }}
          >
            <span
              className={`absolute h-4 w-4 rounded-full ${p.tone} opacity-25`}
            />
            <span
              className={`h-2.5 w-2.5 rounded-full border-2 border-white ${p.tone} shadow`}
            />
          </span>
        ))}

        <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-lg bg-white/95 p-2 shadow-md">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
            <MapPin className="h-3.5 w-3.5 text-emerald-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-800">
              João Silva
            </p>
            <p className="text-xs text-slate-400">ESC-204 · Em atividade</p>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
        </div>
      </div>
    </div>
  );
}

/* ── Tela 4: baixar o app (sheet animado) ──────────────────── */
export function DownloadScreen() {
  const reduceMotion = useReducedMotion();

  const features = [
    { icon: QrCode, text: "Leitura de QR Code" },
    { icon: Camera, text: "Checklists com foto" },
    { icon: Wifi, text: "Funciona offline" },
    { icon: MapPin, text: "Localização da equipe" },
  ];

  return (
    <div className="relative flex h-full flex-col justify-end overflow-hidden bg-slate-900">
      {/* Fundo: grade + brilho */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="absolute -top-10 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <ShieldCheck className="absolute left-1/2 top-14 h-16 w-16 -translate-x-1/2 text-white/10" />

      <div className="relative z-10 px-4 pt-4">
        <StatusBar light />
      </div>

      {/* Sheet que sobe */}
      <motion.div
        initial={reduceMotion ? false : { y: "100%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
        className="relative z-10 flex flex-col items-center rounded-t-3xl bg-white/90 px-4 pb-4 pt-3 backdrop-blur-xl"
      >
        <motion.span
          initial={reduceMotion ? false : { y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.45, ease: "easeOut" }}
          className="absolute -top-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30"
        >
          <ShieldCheck className="h-7 w-7 text-white" />
        </motion.span>

        <p className="mt-8 text-center text-sm font-bold text-slate-900">
          Segurança em 360{" "}
          <span className="font-semibold text-primary">APP</span>
        </p>

        <ul className="mt-3 space-y-2 self-start">
          {features.map((f, i) => (
            <motion.li
              key={f.text}
              initial={reduceMotion ? false : { opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.45,
                delay: 0.55 + i * 0.1,
                ease: "easeOut",
              }}
              className="flex items-center gap-2 text-xs text-slate-600"
            >
              <f.icon className="h-3.5 w-3.5 text-primary" />
              {f.text}
            </motion.li>
          ))}
        </ul>

        <span className="mt-4 flex h-9 w-full items-center justify-center rounded-lg bg-primary text-xs font-semibold text-white">
          Baixar app
        </span>
        <p className="mt-2 text-center text-xs text-slate-400">
          Android · grátis para a equipe
        </p>
      </motion.div>
    </div>
  );
}

/* ── Carrossel configurado com as telas do Marrua ──────────── */
// Screenshots reais do app (capturados do emulador, 1080x2400) em
// apps/web/public/screenshots/; sem o arquivo, o mockup JSX é o fallback.
const marruaScreens: ImageItem[] = [
  {
    alt: "Checklist pré-operação",
    src: "/screenshots/checklist.png",
    content: <ChecklistScreen />,
  },
  {
    alt: "Início do operador",
    src: "/screenshots/home.png",
    content: <HomeScreen />,
  },
  {
    alt: "Seleção de máquina",
    src: "/screenshots/maquinas.png",
    content: <MapScreen />,
  },
  { alt: "Baixar o app", content: <DownloadScreen /> },
];

export default function PhoneMockupBasic() {
  return <PhoneCarousel images={marruaScreens} />;
}
