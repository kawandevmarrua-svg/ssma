"use client";
import React, { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/* Contador que sobe até o valor quando entra na tela */
function CountUp({
  value,
  suffix = "",
  className,
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, reduceMotion]);

  return (
    <span ref={ref} className={className}>
      {display}
      {suffix}
    </span>
  );
}

/* Entrada padrão dos cards */
const cardReveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.4 },
} as const;

/* Inspeções por semana do mês (demonstração) */
const semanas = [
  { label: "S1", valor: 7 },
  { label: "S2", valor: 9 },
  { label: "S3", valor: 10 },
  { label: "S4", valor: 12 },
];
const maxSemana = Math.max(...semanas.map((s) => s.valor));

export const StatsBento = () => {
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-2">
      {/* Destaque: conformidade */}
      <motion.div
        {...cardReveal}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative flex flex-col justify-between overflow-hidden rounded-3xl bg-primary p-10 md:col-span-3 md:row-span-2"
      >
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(45deg,#808080_0px_1px,transparent_1px_10px)] opacity-30 [mask-image:radial-gradient(ellipse_80%_50%_at_100%_0%,#000_70%,transparent_110%)]" />
        <div>
          <span className="mb-6 inline-block rounded-full bg-primary-foreground/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/70">
            Conformidade
          </span>
          <h3 className="text-6xl tracking-tighter text-primary-foreground">
            <CountUp value={96} suffix="%" />
          </h3>
          {/* Barra de progresso até 96% */}
          <div className="mt-6 h-2 w-full max-w-xs overflow-hidden rounded-full bg-primary-foreground/20">
            <motion.div
              className="h-full rounded-full bg-primary-foreground"
              initial={{ width: 0 }}
              whileInView={{ width: "96%" }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            />
          </div>
        </div>
        <p className="max-w-xs text-sm text-primary-foreground/70">
          Itens conformes nas inspeções comportamentais dos últimos 30 dias,
          em todas as unidades.
        </p>
      </motion.div>

      {/* Inspeções no mês, por semana */}
      <motion.div
        {...cardReveal}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.08 }}
        className="flex items-center justify-between rounded-3xl border border-border bg-slate-50 p-8 md:col-span-3"
      >
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Inspeções no mês
          </p>
          <p className="text-3xl text-foreground">
            <CountUp value={38} />
          </p>
        </div>
        <div className="flex items-end gap-3">
          {semanas.map((s, i) => (
            <div key={s.label} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-medium text-slate-400">
                {s.valor}
              </span>
              <div className="flex h-16 w-4 items-end">
                <motion.div
                  className={cn(
                    "w-full rounded-t-[4px]",
                    i === semanas.length - 1 ? "bg-primary" : "bg-slate-700",
                  )}
                  initial={{ height: 0 }}
                  whileInView={{
                    height: `${(s.valor / maxSemana) * 100}%`,
                  }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{
                    duration: 0.7,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.15 + i * 0.09,
                  }}
                />
              </div>
              <span className="text-[10px] text-slate-400">{s.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Desvios tratados */}
      <motion.div
        {...cardReveal}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.16 }}
        className="flex flex-col justify-center rounded-3xl border border-border bg-white p-6 text-center md:col-span-1"
      >
        <p className="text-2xl text-foreground">
          <CountUp value={12} />
        </p>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Desvios tratados
        </p>
      </motion.div>

      {/* Tempo de resposta */}
      <motion.div
        {...cardReveal}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.24 }}
        className="flex items-center gap-4 rounded-3xl border border-border bg-slate-50 p-6 md:col-span-2"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm leading-none text-foreground">2h em média</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            do desvio registrado ao plano de ação
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default StatsBento;
