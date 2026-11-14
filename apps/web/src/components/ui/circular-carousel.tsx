"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CarouselItem {
  id: string;
  title: string;
  description: string;
  tag?: string;
  icon?: LucideIcon;
  points?: string[];
  quote?: {
    text: string;
    author: string;
    role: string;
  };
}

export interface CircularCarouselProps {
  items: CarouselItem[];
  activeIndex?: number;
  onActiveChange?: (index: number) => void;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  className?: string;
}

const VISIBLE_COUNT = 5;
// Desktop / mobile: raio da elipse, deslocamento vertical do anel
const GEOMETRY = {
  desktop: { radiusX: 430, radiusY: 135, shift: 60 },
  mobile: { radiusX: 250, radiusY: 100, shift: 40 },
} as const;

function getItemPosition(
  index: number,
  activeIndex: number,
  total: number,
  geo: (typeof GEOMETRY)[keyof typeof GEOMETRY],
) {
  const offset = index - activeIndex;
  const half = Math.floor(VISIBLE_COUNT / 2);
  let adjustedOffset = offset;

  if (offset > half) adjustedOffset = offset - total;
  if (offset < -half) adjustedOffset = offset + total;

  if (Math.abs(adjustedOffset) > half * 2) return null;

  const angle = (adjustedOffset / VISIBLE_COUNT) * Math.PI;
  const x = Math.sin(angle) * geo.radiusX;
  const y = -Math.cos(angle) * geo.radiusY + geo.shift;

  const distance = Math.abs(adjustedOffset);
  const maxDistance = half + 1;
  const scale = Math.max(0, 1 - (distance / maxDistance) * 0.3);
  const opacity = Math.max(0.3, 1 - (distance / maxDistance) * 0.7);
  const zIndex = VISIBLE_COUNT - distance;

  return { x, y, scale, opacity, zIndex, adjustedOffset };
}

export function CircularCarousel({
  items,
  activeIndex: controlledIndex,
  onActiveChange,
  autoPlay = true,
  autoPlayInterval = 4000,
  className,
}: CircularCarouselProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  const activeIndex = controlledIndex ?? internalIndex;
  const total = items.length;

  const goTo = useCallback(
    (index: number) => {
      const newIndex = ((index % total) + total) % total;
      if (controlledIndex === undefined) {
        setInternalIndex(newIndex);
      }
      onActiveChange?.(newIndex);
    },
    [total, controlledIndex, onActiveChange],
  );

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  useEffect(() => {
    if (!autoPlay || reduceMotion || isHovered || isFocused) return;
    intervalRef.current = setInterval(next, autoPlayInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoPlay, autoPlayInterval, reduceMotion, isHovered, isFocused, next]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    const el = containerRef.current;
    el?.addEventListener("keydown", handler);
    return () => el?.removeEventListener("keydown", handler);
  }, [next, prev]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="region"
      aria-label="Carrossel"
      aria-roledescription="carousel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={cn(
        "relative flex flex-col items-center justify-center gap-4 outline-none",
        className,
      )}
    >
      {/* Circular track */}
      <div className="relative h-[300px] w-full max-w-6xl sm:h-[360px]">
        <AnimatePresence mode="popLayout">
          {items.map((item, i) => {
            const pos = getItemPosition(
              i,
              activeIndex,
              total,
              isMobile ? GEOMETRY.mobile : GEOMETRY.desktop,
            );
            if (!pos) return null;

            const isActive = i === activeIndex;

            return (
              <motion.button
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  x: pos.x,
                  y: pos.y,
                  scale: pos.scale,
                  opacity: pos.opacity,
                  zIndex: pos.zIndex,
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.65, ease: [0.22, 1, 0.36, 1] }
                }
                onClick={() => goTo(i)}
                aria-label={item.title}
                aria-selected={isActive}
                role="option"
                className={cn(
                  "absolute left-1/2 top-1/2 -ml-[96px] -mt-[76px] flex h-[152px] w-48 cursor-pointer flex-col items-start rounded-2xl border p-3.5 text-left transition-[box-shadow,background-color,border-color] duration-300 sm:-ml-32 sm:-mt-24 sm:h-48 sm:w-64 sm:p-5",
                  isActive
                    ? "border-primary/40 bg-white shadow-[0_0_0_1px_rgba(249,115,22,0.15),0_24px_60px_-12px_rgba(0,0,0,0.5),0_0_40px_-8px_rgba(249,115,22,0.25)]"
                    : "border-white/10 bg-slate-900 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] hover:border-white/25",
                )}
                style={{ transformOrigin: "center center" }}
              >
                <div className="flex w-full items-center justify-between">
                  {item.icon && (
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-300",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/10 text-slate-300",
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px]" />
                    </span>
                  )}
                  {item.tag && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors duration-300",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "bg-white/10 text-slate-400",
                      )}
                    >
                      {item.tag}
                    </span>
                  )}
                </div>
                <h3
                  className={cn(
                    "mt-3 font-semibold leading-tight transition-colors duration-300",
                    isActive
                      ? "text-sm text-slate-900 sm:text-base"
                      : "text-xs text-slate-200 sm:text-sm",
                  )}
                >
                  {item.title}
                </h3>
                {isActive && item.quote ? (
                  <div className="mt-3 flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                      {item.quote.author
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-xs italic leading-snug text-slate-600">
                        &ldquo;{item.quote.text}&rdquo;
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-slate-400">
                        {item.quote.author} · {item.quote.role}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p
                    className={cn(
                      "mt-1.5 line-clamp-3 text-xs leading-relaxed transition-colors duration-300",
                      isActive ? "text-slate-500" : "text-slate-400",
                    )}
                  >
                    {item.description}
                  </p>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* Detalhes do módulo ativo, no miolo do anel */}
        {items[activeIndex]?.points?.length ? (
          <motion.div
            key={items[activeIndex].id}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="pointer-events-none absolute bottom-1 left-1/2 -ml-32 w-64 sm:-ml-36 sm:w-72"
          >
            <ul className="space-y-2">
              {items[activeIndex].points!.slice(0, 3).map((point) => (
                <li
                  key={point}
                  className="flex items-start justify-center gap-2 text-center text-xs leading-snug text-slate-300 sm:text-sm"
                >
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  {point}
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={prev}
          aria-label="Item anterior"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-slate-300 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-5" />
        </motion.button>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5" role="tablist">
          {items.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === activeIndex}
              onClick={() => goTo(i)}
              className="flex h-11 items-center px-1"
              aria-label={`Ir para o item ${i + 1}`}
            >
              <span
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === activeIndex
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-slate-600 hover:bg-slate-500",
                )}
              />
            </button>
          ))}
        </div>

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={next}
          aria-label="Próximo item"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-slate-300 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="size-5" />
        </motion.button>
      </div>
    </div>
  );
}

export default CircularCarousel;
