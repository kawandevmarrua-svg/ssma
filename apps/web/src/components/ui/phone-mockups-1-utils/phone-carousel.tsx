"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ImageItem {
  /** Screenshot da tela. Opcional quando `content` é usado. */
  src?: string;
  alt: string;
  /** Alternativa a `src`: tela renderizada em JSX dentro do frame. */
  content?: React.ReactNode;
}

/* ── Screenshot real com fallback para o mockup JSX ────────── */
function ScreenImage({
  src,
  alt,
  fallback,
}: {
  src: string;
  alt: string;
  fallback?: React.ReactNode;
}) {
  const [failed, setFailed] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const ref = React.useRef<HTMLImageElement>(null);

  // O erro de carregamento pode disparar antes da hidratação (onError se
  // perde); ao montar, confere se a imagem já falhou ou já carregou.
  React.useEffect(() => {
    const img = ref.current;
    if (!img?.complete) return;
    if (img.naturalWidth === 0) setFailed(true);
    else setLoaded(true);
  }, [src]);

  if (failed && fallback) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      className={cn(
        "h-full w-full object-cover transition-[opacity,transform] duration-500 ease-out",
        loaded ? "scale-100 opacity-100" : "scale-[1.04] opacity-0",
      )}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  );
}

/* ── Frames ────────────────────────────────────────────────── */

export function PhoneFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative w-[220px] rounded-[2.5rem] border-2 border-slate-700 bg-slate-950 p-2 shadow-2xl",
        className,
      )}
    >
      <div className="absolute left-1/2 top-3 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-black" />
      <div className="isolate overflow-hidden rounded-[2rem] bg-slate-50">
        <div className="relative aspect-[9/20] w-full">{children}</div>
      </div>
    </div>
  );
}

export function TabletFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-[1.75rem] border-2 border-slate-700 bg-slate-950 p-2.5 shadow-2xl",
        className,
      )}
    >
      <div className="absolute left-1/2 top-[5px] z-10 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-slate-600" />
      <div className="overflow-hidden rounded-[1.25rem] bg-white">
        <div className="relative aspect-[4/3] w-full">{children}</div>
      </div>
    </div>
  );
}

/* ── Carrossel de celulares ────────────────────────────────── */

interface PhoneCarouselProps {
  images: ImageItem[];
  /** Intervalo do avanço automático em ms. */
  interval?: number;
  className?: string;
}

export function PhoneCarousel({
  images,
  interval = 4000,
  className,
}: PhoneCarouselProps) {
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const reduceMotion = useReducedMotion();
  const count = images.length;

  React.useEffect(() => {
    if (paused || reduceMotion || count < 2) return;
    const id = window.setInterval(
      () => setActive((a) => (a + 1) % count),
      interval,
    );
    return () => window.clearInterval(id);
  }, [paused, reduceMotion, count, interval]);

  return (
    <div
      className={cn("flex flex-col items-center", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative flex h-[510px] w-full max-w-[560px] items-center justify-center overflow-hidden">
        {images.map((item, i) => {
          // Distância circular com sinal em relação à tela ativa.
          let off = (i - active + count) % count;
          if (off > count / 2) off -= count;
          const isActive = off === 0;
          const visible = Math.abs(off) <= 1;

          return (
            <motion.div
              key={item.alt}
              className={cn("absolute", !isActive && "cursor-pointer")}
              initial={false}
              animate={{
                x: off * 170,
                scale: isActive ? 1 : 0.82,
                opacity: visible ? (isActive ? 1 : 0.4) : 0,
                zIndex: isActive ? 10 : 5,
              }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "tween", duration: 0.5, ease: [0.22, 1, 0.36, 1] }
              }
              onClick={() => setActive(i)}
              aria-hidden={!visible}
            >
              <PhoneFrame>
                {item.src ? (
                  <ScreenImage
                    src={item.src}
                    alt={item.alt}
                    fallback={
                      item.content ? (
                        <div
                          key={isActive ? "active" : "idle"}
                          className="h-full"
                        >
                          {item.content}
                        </div>
                      ) : undefined
                    }
                  />
                ) : item.content ? (
                  // Key troca quando a tela vira ativa: remonta e reexecuta
                  // animações de entrada (ex.: sheet do DownloadScreen).
                  <div key={isActive ? "active" : "idle"} className="h-full">
                    {item.content}
                  </div>
                ) : null}
              </PhoneFrame>
            </motion.div>
          );
        })}
      </div>

      {count > 1 && (
        <div className="mt-6 flex gap-2">
          {images.map((item, i) => (
            <button
              key={item.alt}
              type="button"
              aria-label={`Mostrar tela: ${item.alt}`}
              aria-current={i === active}
              onClick={() => setActive(i)}
              className="flex h-11 items-center px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === active
                    ? "w-6 bg-primary"
                    : "w-2 bg-slate-500/60 hover:bg-slate-400",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
