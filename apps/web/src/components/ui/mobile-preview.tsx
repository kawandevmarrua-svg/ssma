"use client";

import React, { useEffect, useState } from "react";
import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  Bell,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clipboard,
  CirclePause,
  Clock,
  Hammer,
  Home as HomeIcon,
  Image as ImageIcon,
  List,
  Lock,
  QrCode,
  Search,
  SquareCheck,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { PhoneFrame } from "@/components/ui/phone-mockups-1-utils/phone-carousel";
import { cn } from "@/lib/utils";

/*
 * Réplica 1:1 do app de campo. A tela é desenhada em 390dp — as mesmas
 * medidas do código real (apps/mobile: theme/colors.ts, AppHeader.tsx,
 * (operator)/index.tsx e checklist.tsx) — e escalada para caber no frame.
 * Interativo: Início e Checklist; demais abas pedem o app, como no
 * preview do painel web.
 */

/* Design tokens reais (src/theme/colors.ts) */
const C = {
  primary: "#F97316",
  primarySurface: "#FFF7ED",
  primarySoft: "#FFEDD5",
  success: "#10B981",
  successLight: "#D1FAE5",
  successSurface: "#ECFDF5",
  successDark: "#059669",
  danger: "#EF4444",
  dangerLight: "#FEE2E2",
  dangerSurface: "#FEF2F2",
  dangerDark: "#DC2626",
  background: "#FAFAFA",
  surface: "#FFFFFF",
  surfaceMuted: "#F5F5F5",
  text: "#0F172A",
  textSecondary: "#64748B",
  textLight: "#94A3B8",
  border: "#EAEAEA",
  borderStrong: "#CBD5E1",
  techBorder: "#E5E7EB",
  techSoft: "#F8FAFC",
  grid: "#F1F5F9",
};

type Tab = "home" | "checklist" | "atividades" | "alertas" | "lembretes" | "perfil";
type ChecklistStep = "lista" | "pick" | "items" | "enviado";
type Resp = "C" | "NC" | "NA" | null;

/* Mensagens reais (DEFAULT_SAFETY_MESSAGES) */
const mensagens = [
  {
    title: "Segurança em primeiro lugar.",
    message:
      "Nenhuma tarefa é tão urgente que não possa ser feita com segurança. Em caso de dúvida, pare e pergunte.",
  },
  {
    title: "Você é o ponto de bloqueio.",
    message:
      "Identificou uma condição insegura? Pare a operação e comunique imediatamente o encarregado.",
  },
  {
    title: "Cuide de você e do colega.",
    message:
      "Sua vida e a do seu colega dependem das suas atitudes. Trabalhe atento e respeite os procedimentos.",
  },
  {
    title: "Antes de iniciar, reavalie.",
    message:
      "Mudou o cenário? Mudou o equipamento? Mudou a equipe? Refaça a análise de risco antes de começar.",
  },
  {
    title: "EPI sempre, sem exceção.",
    message:
      "Use os EPIs corretos para a atividade. Eles existem para te proteger e voltar bem para casa.",
  },
];

const maquinas = [
  { nome: "Escavadeira CAT 320", qr: "MAQ-ESC-001", tag: "ESC-001" },
  { nome: "Guindaste Liebherr LTM", qr: "MAQ-GUI-001", tag: "GUI-001" },
];

const perguntas = [
  { desc: "Freios e comandos funcionando?", blocking: true },
  { desc: "Extintor presente e válido?", blocking: true },
  { desc: "Faróis e sinal sonoro OK?", blocking: false },
  { desc: "Pneus/esteiras em condição?", blocking: false },
];

/* ── AppHeader real (28px logo, MARRUÁ ls2, sino 40px) ─────── */
function AppHeader({
  subtitle,
  onBack,
}: {
  subtitle?: string;
  onBack?: () => void;
}) {
  return (
    <div
      className="border-b bg-white px-6 pb-2.5 pt-2"
      style={{ borderColor: C.border }}
    >
      <div className="flex items-center justify-between gap-4 py-1">
        {onBack ? (
          <button onClick={onBack} className="flex items-center gap-1.5">
            <ArrowLeft className="h-5 w-5" style={{ color: C.text }} />
            <span className="text-base font-semibold" style={{ color: C.text }}>
              Voltar
            </span>
          </button>
        ) : (
          <span className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.jpeg"
              alt="Marruá"
              className="h-7 w-7 rounded-md object-cover"
            />
            <span
              className="text-base font-extrabold tracking-[2px]"
              style={{ color: C.text }}
            >
              MARRUÁ
            </span>
          </span>
        )}
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full border bg-white"
          style={{ borderColor: C.border }}
        >
          <Bell className="h-5 w-5" style={{ color: C.text }} strokeWidth={1.8} />
        </span>
      </div>
      {subtitle && (
        <p className="mt-1 text-sm font-medium" style={{ color: C.textSecondary }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function SectionHeaderRow({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center gap-2">
      <span className="h-px flex-1" style={{ background: C.techBorder }} />
      <span
        className="text-xs font-extrabold uppercase tracking-[1.8px]"
        style={{ color: C.textSecondary }}
      >
        {label}
      </span>
      <span className="h-px flex-1" style={{ background: C.techBorder }} />
    </div>
  );
}

/* ── TechStat real (minH 120, valor 28px, ticks 2px) ───────── */
function TechStat({
  icon: Icon,
  value,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[120px] flex-1 flex-col items-center rounded-2xl border px-2 py-4 transition-transform active:scale-[0.99]"
      style={{
        borderColor: active ? C.primary : C.techBorder,
        background: active ? `${C.primary}0D` : C.surface,
      }}
    >
      <span
        className="mb-2 flex h-[26px] w-[26px] items-center justify-center rounded-full border bg-white"
        style={{ borderColor: C.techBorder }}
      >
        <Icon
          className="h-3.5 w-3.5"
          style={{ color: active ? C.primary : C.textSecondary }}
          strokeWidth={1.8}
        />
      </span>
      <span
        className="text-[28px] font-extrabold leading-8 tracking-[-1px] tabular-nums"
        style={{ color: active ? C.primary : C.text }}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span
        className="mb-2 mt-1 text-[10px] font-bold uppercase tracking-[1.2px]"
        style={{ color: C.textSecondary }}
      >
        {label}
      </span>
      <span className="flex h-3 items-end gap-[3px]">
        {[0, 1, 0, 0, 1, 0, 0].map((tall, i) => (
          <span
            key={i}
            className="w-[2px] rounded-[1px]"
            style={{
              height: tall ? 10 : 4,
              background: tall ? (active ? C.primary : C.textLight) : C.borderStrong,
            }}
          />
        ))}
      </span>
    </button>
  );
}

/* ── Início: réplica do (operator)/index.tsx ───────────────── */
function TelaHome({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const [msg, setMsg] = useState(1);

  useEffect(() => {
    const id = setInterval(() => setMsg((m) => (m + 1) % mensagens.length), 7000);
    return () => clearInterval(id);
  }, []);

  const atual = mensagens[msg];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <AppHeader />
      <div className="flex-1 overflow-y-auto px-6 pt-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* HERO — white tech, altura 36% da janela */}
        <div
          className="relative flex h-[300px] flex-col overflow-hidden rounded-[20px] border p-6 shadow-[0_12px_24px_-8px_rgba(15,23,42,0.06)]"
          style={{ borderColor: C.techBorder, background: C.surface }}
        >
          {["25%", "50%", "75%"].map((l) => (
            <span
              key={l}
              className="pointer-events-none absolute bottom-0 top-0 w-px"
              style={{ left: l, background: C.grid }}
            />
          ))}
          {["33%", "66%"].map((t) => (
            <span
              key={t}
              className="pointer-events-none absolute left-0 right-0 h-px"
              style={{ top: t, background: C.grid }}
            />
          ))}
          {/* Cantos HUD 14px */}
          <span className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 border-l-[1.5px] border-t-[1.5px]" style={{ borderColor: C.text }} />
          <span className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 border-r-[1.5px] border-t-[1.5px]" style={{ borderColor: C.text }} />
          <span className="pointer-events-none absolute bottom-2.5 left-2.5 h-3.5 w-3.5 border-b-[1.5px] border-l-[1.5px]" style={{ borderColor: C.text }} />
          <span className="pointer-events-none absolute bottom-2.5 right-2.5 h-3.5 w-3.5 border-b-[1.5px] border-r-[1.5px]" style={{ borderColor: C.text }} />

          <div className="relative flex items-center justify-between">
            <span
              className="flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[10px] font-extrabold tracking-[1.4px] text-white"
              style={{ background: C.primary }}
            >
              <span className="h-[5px] w-[5px] rounded-full bg-white" /> SSMA
            </span>
            <span
              className="rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[1.2px]"
              style={{
                borderColor: C.techBorder,
                background: C.techSoft,
                color: C.textSecondary,
              }}
            >
              {String(msg + 1).padStart(2, "0")} /{" "}
              {String(mensagens.length).padStart(2, "0")}
            </span>
          </div>

          <div className="relative flex flex-1 flex-col justify-center">
            <p
              className="mb-2 text-xs font-extrabold tracking-[1.6px]"
              style={{ color: C.primary }}
            >
              MENSAGEM DE SEGURANÇA
            </p>
            <p
              className="mb-3 text-[24px] font-extrabold leading-[30px] tracking-[-0.7px]"
              style={{ color: C.text }}
            >
              {atual.title}
            </p>
            <span
              className="mb-3 block h-[3px] w-9 rounded-[2px]"
              style={{ background: C.primary }}
            />
            <p
              className="text-[13px] leading-[19px]"
              style={{ color: C.textSecondary }}
            >
              {atual.message}
            </p>
          </div>

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {mensagens.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setMsg(i)}
                  aria-label={`Mensagem ${i + 1}`}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === msg ? 22 : 6,
                    background: i === msg ? C.primary : C.borderStrong,
                  }}
                />
              ))}
            </div>
            <button
              onClick={() => onNavigate("alertas")}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-extrabold tracking-[1px] text-white active:opacity-90"
              style={{ background: C.primary }}
            >
              VER ALERTAS <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <SectionHeaderRow label="Hoje" />
        <div className="flex gap-2">
          <TechStat
            icon={SquareCheck}
            value={0}
            label="Checklists"
            onClick={() => onNavigate("checklist")}
          />
          <TechStat
            icon={Wrench}
            value={0}
            label="Atividades"
            onClick={() => onNavigate("atividades")}
          />
        </div>
        <div className="mt-2 flex gap-2">
          <TechStat
            icon={Bell}
            value={0}
            label="Alertas"
            onClick={() => onNavigate("alertas")}
          />
          <TechStat
            icon={AlarmClock}
            value={0}
            label="Lembretes"
            active
            onClick={() => onNavigate("lembretes")}
          />
        </div>

        <SectionHeaderRow label="Acesso rápido" />
        <div className="mb-6 flex gap-2">
          {[
            { icon: Clipboard, label: "Pré-Operação", to: "checklist" as Tab },
            { icon: CirclePause, label: "Parada", to: "atividades" as Tab },
            { icon: Hammer, label: "Serviço", to: "atividades" as Tab },
            { icon: Clock, label: "Atividade", to: "atividades" as Tab },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => onNavigate(s.to)}
              className="flex flex-1 flex-col items-center gap-1 rounded-2xl border px-1 py-4 transition-transform active:scale-[0.98]"
              style={{ borderColor: C.techBorder, background: C.surface }}
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl border"
                style={{ borderColor: C.techBorder, background: C.techSoft }}
              >
                <s.icon className="h-5 w-5" style={{ color: C.text }} strokeWidth={1.8} />
              </span>
              <span
                className="text-center text-xs font-bold"
                style={{ color: C.text }}
              >
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Checklist: réplica do (operator)/checklist.tsx ────────── */
function TelaChecklist() {
  const [step, setStep] = useState<ChecklistStep>("lista");
  const [maquina, setMaquina] = useState(maquinas[0]);
  const [turno, setTurno] = useState<"Diurno" | "Noturno">("Diurno");
  const [respostas, setRespostas] = useState<Resp[]>(perguntas.map(() => null));

  const respondidas = respostas.filter((r) => r !== null).length;
  const temNC = respostas.some((r) => r === "NC");

  /* LIST — "Checklists do equipamento" com FABs reais */
  if (step === "lista") {
    return (
      <div className="relative flex h-full flex-col" style={{ background: C.background }}>
        <AppHeader subtitle="Checklists do equipamento" />
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-10 text-center">
          <span
            className="mb-1 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white"
            style={{ boxShadow: `0 0 0 1px ${C.border}` }}
          >
            <Clipboard className="h-8 w-8" style={{ color: C.textSecondary }} strokeWidth={1.4} />
          </span>
          <p className="text-base font-extrabold tracking-[-0.2px]" style={{ color: C.text }}>
            Nenhum checklist realizado
          </p>
          <p className="text-sm leading-[19px]" style={{ color: C.textSecondary }}>
            Toque no botão de QR Code para iniciar um novo checklist.
          </p>
        </div>
        {/* FABs reais: 52px lista + 60px QR laranja */}
        <div className="absolute bottom-5 right-5 flex items-center gap-3">
          <button
            onClick={() => setStep("pick")}
            aria-label="Escolher máquina manualmente"
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full border bg-white shadow-md active:scale-95"
            style={{ borderColor: C.border }}
          >
            <List className="h-6 w-6" style={{ color: C.primary }} />
          </button>
          <button
            onClick={() => setStep("pick")}
            aria-label="Iniciar por QR Code"
            className="flex h-[60px] w-[60px] items-center justify-center rounded-full shadow-lg active:scale-95"
            style={{ background: C.primary, boxShadow: "0 4px 10px rgba(249,115,22,0.18)" }}
          >
            <QrCode className="h-7 w-7 text-white" />
          </button>
        </div>
      </div>
    );
  }

  /* PICK — "Selecionar máquina" */
  if (step === "pick") {
    return (
      <div className="flex h-full flex-col" style={{ background: C.background }}>
        <AppHeader onBack={() => setStep("lista")} />
        <div className="px-6 pt-6">
          <p className="mb-2 text-sm font-semibold" style={{ color: C.text }}>
            Selecionar máquina
          </p>
          <div
            className="mb-4 flex items-center rounded-full"
            style={{ background: C.surfaceMuted }}
          >
            <Search className="ml-4 h-5 w-5 shrink-0" style={{ color: C.textLight }} />
            <span className="flex-1 px-2.5 py-3 text-sm" style={{ color: C.textLight }}>
              Buscar por nome, tag ou codigo...
            </span>
          </div>
        </div>
        <div className="flex-1 px-6">
          {maquinas.map((m) => (
            <button
              key={m.tag}
              onClick={() => {
                setMaquina(m);
                setStep("items");
              }}
              className="mb-2 flex w-full items-center gap-4 rounded-xl border bg-white p-4 text-left transition-colors active:bg-slate-50"
              style={{ borderColor: C.border }}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ background: C.surfaceMuted }}
              >
                <Camera className="h-[22px] w-[22px]" style={{ color: C.textSecondary }} strokeWidth={1.6} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-base font-extrabold leading-[19px] tracking-[-0.3px]"
                  style={{ color: C.text }}
                >
                  {m.nome}
                </span>
                <span className="mt-[3px] flex items-center gap-2">
                  <span className="flex items-center gap-[3px]">
                    <QrCode className="h-2.5 w-2.5" style={{ color: C.primary }} />
                    <span className="font-mono text-xs" style={{ color: C.textSecondary }}>
                      {m.qr}
                    </span>
                  </span>
                  <span className="font-mono text-xs" style={{ color: C.textSecondary }}>
                    {m.tag}
                  </span>
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: C.textLight }} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* Enviado */
  if (step === "enviado") {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center"
        style={{ background: C.background }}
      >
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: temNC ? C.danger : C.success }}
        >
          {temNC ? (
            <CircleAlert className="h-7 w-7 text-white" />
          ) : (
            <CheckCircle2 className="h-7 w-7 text-white" />
          )}
        </span>
        <p className="text-base font-extrabold" style={{ color: C.text }}>
          Checklist enviado
        </p>
        <p className="text-sm leading-[19px]" style={{ color: C.textSecondary }}>
          {temNC
            ? `${maquina.tag} NÃO liberada — não conformidade registrada. O gestor recebeu o alerta.`
            : `${maquina.tag} liberada para operação. O painel já recebeu o registro.`}
        </p>
        <button
          onClick={() => {
            setStep("lista");
            setRespostas(perguntas.map(() => null));
          }}
          className="mt-1 rounded-xl px-6 py-3 text-sm font-bold text-white"
          style={{ background: C.primary }}
        >
          Novo checklist
        </button>
      </div>
    );
  }

  /* ITEMS — formulário real */
  return (
    <div className="flex h-full flex-col" style={{ background: C.background }}>
      <AppHeader onBack={() => setStep("pick")} />
      <div className="flex-1 overflow-y-auto p-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Máquina selecionada (encarregadoChoice sel) */}
        <div
          className="flex items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3"
          style={{ borderColor: C.primary }}
        >
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: C.primarySurface }}
          >
            <ImageIcon className="h-[22px] w-[22px]" style={{ color: C.primary }} strokeWidth={1.6} />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block truncate text-base font-bold tracking-[-0.2px]"
              style={{ color: C.text }}
            >
              {maquina.nome}
            </span>
            <span className="mt-0.5 block text-xs font-semibold" style={{ color: C.primary }}>
              {maquina.tag}
            </span>
          </span>
        </div>

        <p
          className="mb-2 mt-6 text-[10px] font-bold uppercase tracking-[1.2px]"
          style={{ color: C.textSecondary }}
        >
          Encarregado responsável
        </p>
        <div
          className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3"
          style={{ borderColor: C.border }}
        >
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: C.surfaceMuted }}
          >
            <ImageIcon className="h-[22px] w-[22px]" style={{ color: C.textSecondary }} strokeWidth={1.6} />
          </span>
          <span>
            <span className="block text-base font-bold tracking-[-0.2px]" style={{ color: C.text }}>
              Encarregado Local
            </span>
            <span className="mt-0.5 block text-xs font-semibold" style={{ color: C.primary }}>
              Encarregado
            </span>
          </span>
        </div>

        <p
          className="mb-2 mt-6 text-[10px] font-bold uppercase tracking-[1.2px]"
          style={{ color: C.textSecondary }}
        >
          Turno
        </p>
        <div className="flex gap-2">
          {(["Diurno", "Noturno"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTurno(t)}
              className="flex-1 rounded-xl border py-3 text-center text-sm font-semibold transition-colors"
              style={
                turno === t
                  ? { background: C.primary, borderColor: C.primary, color: "#fff" }
                  : { background: C.surface, borderColor: C.borderStrong, color: C.textSecondary }
              }
            >
              {t}
            </button>
          ))}
        </div>

        {/* Progresso — barra PRETA como no app */}
        <div className="mb-4 mt-6">
          <div className="mb-1 flex items-center justify-between">
            <span
              className="text-[10px] font-bold uppercase tracking-[1.2px]"
              style={{ color: C.textSecondary }}
            >
              Progresso
            </span>
            <span className="text-sm font-semibold" style={{ color: C.text }}>
              {respondidas} de {perguntas.length}
            </span>
          </div>
          <div
            className="h-1 overflow-hidden rounded-[2px]"
            style={{ background: C.surfaceMuted }}
          >
            <div
              className="h-full rounded-[2px] transition-all duration-300"
              style={{
                width: `${(respondidas / perguntas.length) * 100}%`,
                background: C.text,
              }}
            />
          </div>
        </div>

        {/* Grupo "Geral" */}
        <div className="mb-4 mt-6 flex items-center justify-between">
          <span className="text-base font-bold tracking-[-0.2px]" style={{ color: C.text }}>
            Geral
          </span>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-bold"
            style={
              respondidas === perguntas.length
                ? { background: C.successLight, color: C.successDark }
                : { background: C.surfaceMuted, color: C.textSecondary }
            }
          >
            {respondidas}/{perguntas.length}
          </span>
        </div>

        {perguntas.map((p, i) => {
          const resp = respostas[i];
          return (
            <div
              key={p.desc}
              className="mb-2 rounded-xl border bg-white p-4"
              style={{
                borderColor:
                  resp === "NC"
                    ? C.dangerLight
                    : resp
                      ? C.successLight
                      : C.border,
                background:
                  resp === "NC"
                    ? C.dangerSurface
                    : resp
                      ? C.successSurface
                      : C.surface,
                borderLeftWidth: p.blocking ? 3 : 1,
                borderLeftColor: p.blocking ? C.danger : undefined,
              }}
            >
              <div className="mb-3 flex items-start gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: C.surfaceMuted, color: C.textSecondary }}
                >
                  {i + 1}
                </span>
                <span
                  className="flex-1 pt-0.5 text-sm font-semibold leading-5"
                  style={{ color: C.text }}
                >
                  {p.desc}
                </span>
                {resp && resp !== "NC" && (
                  <CheckCircle2 className="h-[18px] w-[18px] shrink-0" style={{ color: C.success }} />
                )}
                {resp === "NC" && (
                  <CircleAlert className="h-[18px] w-[18px] shrink-0" style={{ color: C.danger }} />
                )}
              </div>
              {p.blocking && (
                <p
                  className="mb-2 ml-8 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.4px]"
                  style={{ color: C.danger }}
                >
                  <TriangleAlert className="h-[11px] w-[11px]" /> Item impeditivo
                </p>
              )}
              {/* Sim / Não / N.A. reais */}
              <div className="flex gap-2">
                {(
                  [
                    { v: "C", label: "Sim", bg: C.success },
                    { v: "NC", label: "Não", bg: C.danger },
                    { v: "NA", label: "N.A.", bg: C.textSecondary },
                  ] as const
                ).map((b) => (
                  <button
                    key={b.v}
                    onClick={() =>
                      setRespostas((prev) =>
                        prev.map((r, idx) => (idx === i ? b.v : r)),
                      )
                    }
                    className="flex-1 rounded-xl border py-3 text-center text-sm font-bold transition-colors"
                    style={
                      resp === b.v
                        ? { background: b.bg, borderColor: b.bg, color: "#fff" }
                        : {
                            background: C.surface,
                            borderColor: C.borderStrong,
                            color: C.textSecondary,
                          }
                    }
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              {resp === "NC" && (
                <div
                  className="mt-4 rounded-xl p-4"
                  style={{ background: C.dangerSurface }}
                >
                  <p
                    className="mb-2 text-[10px] font-bold uppercase tracking-[1.2px]"
                    style={{ color: C.dangerDark }}
                  >
                    Evidencia da nao conformidade
                  </p>
                  <div className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3" style={{ borderColor: C.border }}>
                    <Camera className="h-5 w-5" style={{ color: C.primary }} />
                    <span className="text-sm font-semibold" style={{ color: C.primary }}>
                      Tirar foto * (obrigatoria)
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-t bg-white px-6 py-3" style={{ borderColor: C.border }}>
        <button
          onClick={() => setStep("enviado")}
          disabled={respondidas < perguntas.length}
          className="flex h-11 w-full items-center justify-center rounded-xl text-sm font-bold transition-colors"
          style={
            respondidas === perguntas.length
              ? { background: C.primary, color: "#fff" }
              : { background: C.surfaceMuted, color: C.textLight }
          }
        >
          {respondidas === perguntas.length
            ? "Finalizar checklist"
            : `Responder itens (${respondidas}/${perguntas.length})`}
        </button>
      </div>
    </div>
  );
}

/* ── Aba bloqueada: pede o app, como no preview web ────────── */
function TelaBloqueada({ titulo }: { titulo: string }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <AppHeader />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-10 text-center">
        <span
          className="flex h-[72px] w-[72px] items-center justify-center rounded-3xl"
          style={{ background: C.surfaceMuted }}
        >
          <Lock className="h-8 w-8" style={{ color: C.textLight }} />
        </span>
        <div>
          <p className="text-base font-extrabold" style={{ color: C.text }}>
            {titulo}
          </p>
          <p className="mt-1.5 text-sm leading-[19px]" style={{ color: C.textSecondary }}>
            Essa tela faz parte do app completo. Baixe o app de campo e entre
            com sua conta.
          </p>
        </div>
        <a
          href="#app"
          className="rounded-xl px-6 py-3 text-sm font-bold text-white active:opacity-90"
          style={{ background: C.primary }}
        >
          Baixar o app
        </a>
      </div>
    </div>
  );
}

/* ── Componente ────────────────────────────────────────────── */

const tabs: { id: Tab; icon: React.ElementType | "avatar" }[] = [
  { id: "home", icon: HomeIcon },
  { id: "checklist", icon: SquareCheck },
  { id: "atividades", icon: Wrench },
  { id: "alertas", icon: TriangleAlert },
  { id: "lembretes", icon: AlarmClock },
  { id: "perfil", icon: "avatar" },
];

const titulosBloqueio: Record<string, string> = {
  atividades: "Atividades",
  alertas: "Alertas",
  lembretes: "Lembretes",
  perfil: "Perfil",
};

/* Tela desenhada em 390dp reais e escalada para o frame de 300px */
const DEVICE_W = 390;
const FRAME_W = 300;
const SCALE = FRAME_W / DEVICE_W;
const DEVICE_H = (FRAME_W * (20 / 9)) / SCALE; // ~866,7

export function MobilePreview({ className }: { className?: string }) {
  const [tab, setTab] = useState<Tab>("home");

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <PhoneFrame className="w-[300px]">
        <div className="relative h-full w-full overflow-hidden">
          <div
            className="absolute left-0 top-0 flex flex-col"
            style={{
              width: DEVICE_W,
              height: DEVICE_H,
              transform: `scale(${SCALE})`,
              transformOrigin: "top left",
            }}
          >
            {/* Barra de status */}
            <div className="flex items-center justify-between bg-white px-6 pb-1 pt-3">
              <span className="text-xs font-semibold" style={{ color: C.text }}>
                12:17
              </span>
              <span className="flex items-center gap-1 text-[10px]" style={{ color: C.textSecondary }}>
                ●●● <span className="font-semibold">4G</span>
              </span>
            </div>

            <div className="min-h-0 flex-1">
              {tab === "home" && <TelaHome onNavigate={setTab} />}
              {tab === "checklist" && <TelaChecklist />}
              {tab !== "home" && tab !== "checklist" && (
                <TelaBloqueada titulo={titulosBloqueio[tab]} />
              )}
            </div>

            {/* Tab bar real: h76, radius 24 no topo, ícones 24, dot 6 */}
            <div
              className="flex h-[76px] items-start justify-around rounded-t-3xl border-t bg-white px-2 pt-2.5"
              style={{
                borderColor: C.techBorder,
                boxShadow: "0 -4px 12px rgba(15,23,42,0.06)",
              }}
            >
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex flex-col items-center gap-1 px-2"
                  aria-label={t.id}
                  aria-current={tab === t.id}
                >
                  {t.icon === "avatar" ? (
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full bg-pink-100 text-[9px] font-bold text-pink-600",
                        tab === "perfil" && "ring-2 ring-[#F97316]",
                      )}
                    >
                      KA
                    </span>
                  ) : (
                    <t.icon
                      className="h-6 w-6"
                      style={{ color: tab === t.id ? C.primary : "#3C3C3C" }}
                      strokeWidth={tab === t.id ? 2.2 : 1.8}
                    />
                  )}
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: tab === t.id ? C.primary : "transparent",
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </PhoneFrame>
      <p className="text-xs text-slate-400">
        Réplica interativa do app · Início e Checklist liberados
      </p>
    </div>
  );
}

export default MobilePreview;
