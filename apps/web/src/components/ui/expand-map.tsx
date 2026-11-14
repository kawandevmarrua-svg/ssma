"use client";

import type React from "react";

import { useState, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useSpring,
} from "framer-motion";
import { MousePointerClick } from "lucide-react";

interface LocationMapProps {
  location?: string;
  coordinates?: string;
  className?: string;
}

export function LocationMap({
  location = "Frente de serviço",
  coordinates = "15.6014° S, 56.0979° O",
  className,
}: LocationMapProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useTransform(mouseY, [-50, 50], [8, -8]);
  const rotateY = useTransform(mouseX, [-50, 50], [-8, 8]);

  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 30 });
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 30 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set(e.clientX - centerX);
    mouseY.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setIsHovered(false);
  };

  const handleClick = () => {
    setHasInteracted(true);
    setIsExpanded(!isExpanded);
  };

  return (
    <motion.div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={`Mapa de ${location}. ${isExpanded ? "Recolher" : "Expandir"}`}
      className={`relative cursor-pointer select-none rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
      style={{
        perspective: 1000,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <motion.div
        className="relative overflow-hidden rounded-2xl border border-border bg-background"
        style={{
          rotateX: springRotateX,
          rotateY: springRotateY,
          transformStyle: "preserve-3d",
        }}
        animate={{
          width: isExpanded ? 360 : 240,
          height: isExpanded ? 280 : 140,
          // Pulso sutil convidando ao clique, até a primeira interação
          scale: hasInteracted || isHovered ? 1 : [1, 1.025, 1],
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 35,
          scale: {
            duration: 2.2,
            repeat: hasInteracted || isHovered ? 0 : Infinity,
            ease: "easeInOut",
          },
        }}
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-muted/20 via-transparent to-muted/40" />

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="absolute inset-0 bg-muted" />

              <svg
                className="absolute inset-0 h-full w-full"
                preserveAspectRatio="none"
              >
                {/* Vias principais */}
                <motion.line
                  x1="0%"
                  y1="35%"
                  x2="100%"
                  y2="35%"
                  className="stroke-foreground/25"
                  strokeWidth="4"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
                <motion.line
                  x1="0%"
                  y1="65%"
                  x2="100%"
                  y2="65%"
                  className="stroke-foreground/25"
                  strokeWidth="4"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />

                <motion.line
                  x1="30%"
                  y1="0%"
                  x2="30%"
                  y2="100%"
                  className="stroke-foreground/20"
                  strokeWidth="3"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                />
                <motion.line
                  x1="70%"
                  y1="0%"
                  x2="70%"
                  y2="100%"
                  className="stroke-foreground/20"
                  strokeWidth="3"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                />

                {/* Vias secundárias */}
                {[20, 50, 80].map((y, i) => (
                  <motion.line
                    key={`h-${i}`}
                    x1="0%"
                    y1={`${y}%`}
                    x2="100%"
                    y2={`${y}%`}
                    className="stroke-foreground/10"
                    strokeWidth="1.5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 + i * 0.1 }}
                  />
                ))}
                {[15, 45, 55, 85].map((x, i) => (
                  <motion.line
                    key={`v-${i}`}
                    x1={`${x}%`}
                    y1="0%"
                    x2={`${x}%`}
                    y2="100%"
                    className="stroke-foreground/10"
                    strokeWidth="1.5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.7 + i * 0.1 }}
                  />
                ))}
              </svg>

              {/* Edificações */}
              <motion.div
                className="absolute left-[10%] top-[40%] h-[20%] w-[15%] rounded-sm border border-muted-foreground/20 bg-muted-foreground/30"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.5 }}
              />
              <motion.div
                className="absolute left-[35%] top-[15%] h-[15%] w-[12%] rounded-sm border border-muted-foreground/15 bg-muted-foreground/25"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.6 }}
              />
              <motion.div
                className="absolute left-[75%] top-[70%] h-[18%] w-[18%] rounded-sm border border-muted-foreground/18 bg-muted-foreground/28"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.7 }}
              />
              <motion.div
                className="absolute right-[10%] top-[20%] h-[25%] w-[10%] rounded-sm border border-muted-foreground/15 bg-muted-foreground/22"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.55 }}
              />
              <motion.div
                className="absolute left-[5%] top-[55%] h-[12%] w-[8%] rounded-sm border border-muted-foreground/12 bg-muted-foreground/20"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.65 }}
              />
              <motion.div
                className="absolute left-[75%] top-[8%] h-[10%] w-[14%] rounded-sm border border-muted-foreground/15 bg-muted-foreground/22"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.75 }}
              />

              <motion.div
                className="absolute left-1/2 top-1/2 -ml-4 -mt-4"
                initial={{ scale: 0, y: -20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 20,
                  delay: 0.3,
                }}
              >
                {/* Anel de radar pulsando atrás do pin */}
                <motion.span
                  aria-hidden
                  className="absolute left-1/2 top-1/2 -ml-5 -mt-5 h-10 w-10 rounded-full border-2 border-primary/60"
                  animate={{ scale: [0.4, 2.2], opacity: [0.7, 0] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeOut",
                    delay: 0.6,
                  }}
                />
                <motion.span
                  aria-hidden
                  className="absolute left-1/2 top-1/2 -ml-5 -mt-5 h-10 w-10 rounded-full border border-primary/40"
                  animate={{ scale: [0.4, 2.2], opacity: [0.5, 0] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeOut",
                    delay: 1.3,
                  }}
                />
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="relative drop-shadow-lg"
                  style={{
                    filter: "drop-shadow(0 0 10px rgba(249, 115, 22, 0.5))",
                  }}
                >
                  <path
                    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                    fill="#F97316"
                  />
                  <circle cx="12" cy="9" r="2.5" className="fill-background" />
                </svg>
              </motion.div>

              {/* Operadores em campo: pontos pulsando pelo mapa */}
              {[
                { left: "22%", top: "28%", delay: 0 },
                { left: "62%", top: "72%", delay: 0.5 },
                { left: "80%", top: "35%", delay: 1 },
              ].map((dot) => (
                <motion.span
                  key={`${dot.left}-${dot.top}`}
                  aria-hidden
                  className="absolute h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(249,115,22,0.8)]"
                  style={{ left: dot.left, top: dot.top }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0.5, 1, 0.5], scale: 1 }}
                  transition={{
                    opacity: {
                      duration: 1.8,
                      repeat: Infinity,
                      delay: 0.9 + dot.delay,
                    },
                    scale: { duration: 0.3, delay: 0.9 + dot.delay },
                  }}
                />
              ))}

              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grade de fundo — só quando recolhido */}
        <motion.div
          className="absolute inset-0 opacity-[0.03]"
          animate={{ opacity: isExpanded ? 0 : 0.03 }}
          transition={{ duration: 0.3 }}
        >
          <svg width="100%" height="100%" className="absolute inset-0">
            <defs>
              <pattern
                id="grid"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  className="stroke-foreground"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </motion.div>

        {/* Conteúdo */}
        <div className="relative z-10 flex h-full flex-col justify-between p-5">
          <div className="flex items-start justify-between">
            <div className="relative">
              <motion.div
                className="relative"
                animate={{
                  opacity: isExpanded ? 0 : 1,
                }}
                transition={{ duration: 0.3 }}
              >
                <motion.svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                  animate={{
                    filter: isHovered
                      ? "drop-shadow(0 0 8px rgba(249, 115, 22, 0.6))"
                      : "drop-shadow(0 0 4px rgba(249, 115, 22, 0.3))",
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                  <line x1="9" x2="9" y1="3" y2="18" />
                  <line x1="15" x2="15" y1="6" y2="21" />
                </motion.svg>
              </motion.div>
            </div>

            {/* Indicador de status */}
            <motion.div
              className="flex items-center gap-1.5 rounded-full bg-foreground/5 px-2 py-1 backdrop-blur-sm"
              animate={{
                scale: isHovered ? 1.05 : 1,
                backgroundColor: isHovered
                  ? "hsl(var(--foreground) / 0.08)"
                  : "hsl(var(--foreground) / 0.05)",
              }}
              transition={{ duration: 0.2 }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Ao vivo
              </span>
            </motion.div>
          </div>

          <div className="space-y-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Posição atual
            </p>
            <motion.h3
              className="text-sm font-medium tracking-tight text-foreground"
              animate={{
                x: isHovered ? 4 : 0,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              {location}
            </motion.h3>

            <AnimatePresence>
              {isExpanded && (
                <motion.p
                  className="font-mono text-xs text-muted-foreground"
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {coordinates}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div
              className="h-px bg-gradient-to-r from-primary/50 via-primary/30 to-transparent"
              initial={{ scaleX: 0, originX: 0 }}
              animate={{
                scaleX: isHovered || isExpanded ? 1 : 0.3,
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>
      </motion.div>

      {/* Dica de clique — visível até a primeira interação */}
      <motion.div
        className="absolute -top-10 left-1/2 -ml-24 flex w-48 items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold text-primary"
        initial={{ opacity: 0 }}
        animate={{
          opacity: isExpanded ? 0 : hasInteracted && !isHovered ? 0 : 1,
        }}
        transition={{ duration: 0.25 }}
      >
        <motion.span
          animate={hasInteracted ? { y: 0 } : { y: [0, -3, 0] }}
          transition={{
            duration: 1.1,
            repeat: hasInteracted ? 0 : Infinity,
            ease: "easeInOut",
          }}
          className="flex"
        >
          <MousePointerClick className="h-4 w-4" />
        </motion.span>
        Clique para expandir
      </motion.div>
    </motion.div>
  );
}
