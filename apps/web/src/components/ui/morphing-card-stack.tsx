"use client";

import { useState, type ReactNode } from "react";
import {
  motion,
  AnimatePresence,
  LayoutGroup,
  type PanInfo,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { Grid3X3, Layers, LayoutList } from "lucide-react";

export type LayoutMode = "stack" | "grid" | "list";

export interface CardData {
  id: string;
  title: string;
  description: string;
  icon?: ReactNode;
  color?: string;
}

export interface MorphingCardStackProps {
  cards?: CardData[];
  className?: string;
  defaultLayout?: LayoutMode;
  onCardClick?: (card: CardData) => void;
}

const layoutIcons = {
  stack: Layers,
  grid: Grid3X3,
  list: LayoutList,
};

const layoutLabels: Record<LayoutMode, string> = {
  stack: "pilha",
  grid: "grade",
  list: "lista",
};

const SWIPE_THRESHOLD = 50;

export function MorphingCardStack({
  cards = [],
  className,
  defaultLayout = "stack",
  onCardClick,
}: MorphingCardStackProps) {
  const [layout, setLayout] = useState<LayoutMode>(defaultLayout);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  if (!cards || cards.length === 0) {
    return null;
  }

  const handleDragEnd = (
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const { offset, velocity } = info;
    const swipe = Math.abs(offset.x) * velocity.x;

    if (offset.x < -SWIPE_THRESHOLD || swipe < -1000) {
      setActiveIndex((prev) => (prev + 1) % cards.length);
    } else if (offset.x > SWIPE_THRESHOLD || swipe > 1000) {
      setActiveIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }
    setIsDragging(false);
  };

  const getStackOrder = () => {
    const reordered = [];
    for (let i = 0; i < cards.length; i++) {
      const index = (activeIndex + i) % cards.length;
      reordered.push({ ...cards[index], stackPosition: i });
    }
    return reordered.reverse();
  };

  const getLayoutStyles = (stackPosition: number) => {
    switch (layout) {
      case "stack":
        return {
          top: stackPosition * 8,
          left: stackPosition * 8,
          zIndex: cards.length - stackPosition,
          rotate: (stackPosition - 1) * 2,
        };
      case "grid":
        return {
          top: 0,
          left: 0,
          zIndex: 1,
          rotate: 0,
        };
      case "list":
        return {
          top: 0,
          left: 0,
          zIndex: 1,
          rotate: 0,
        };
    }
  };

  const containerStyles = {
    stack: "relative h-64 w-64",
    grid: "grid grid-cols-2 gap-3",
    list: "flex flex-col gap-3",
  };

  const displayCards =
    layout === "stack"
      ? getStackOrder()
      : cards.map((c, i) => ({ ...c, stackPosition: i }));

  return (
    <div className={cn("space-y-4", className)}>
      {/* Alternador de layout */}
      <div className="mx-auto flex w-fit items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        {(Object.keys(layoutIcons) as LayoutMode[]).map((mode) => {
          const Icon = layoutIcons[mode];
          return (
            <button
              key={mode}
              onClick={() => setLayout(mode)}
              className={cn(
                "rounded-lg p-2 transition-all",
                layout === mode
                  ? "bg-primary text-primary-foreground shadow-[0_0_16px_-4px_rgba(249,115,22,0.6)]"
                  : "text-slate-400 hover:bg-white/10 hover:text-white",
              )}
              aria-label={`Mudar para layout de ${layoutLabels[mode]}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      {/* Container dos cards */}
      <LayoutGroup>
        <motion.div layout className={cn(containerStyles[layout], "mx-auto")}>
          <AnimatePresence mode="popLayout">
            {displayCards.map((card) => {
              const styles = getLayoutStyles(card.stackPosition);
              const isExpanded = expandedCard === card.id;
              const isTopCard = layout === "stack" && card.stackPosition === 0;

              return (
                <motion.div
                  key={card.id}
                  layoutId={card.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: 1,
                    scale: isExpanded ? 1.05 : 1,
                    x: 0,
                    ...styles,
                  }}
                  exit={{ opacity: 0, scale: 0.8, x: -200 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 25,
                  }}
                  drag={isTopCard ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.7}
                  onDragStart={() => setIsDragging(true)}
                  onDragEnd={handleDragEnd}
                  whileDrag={{ scale: 1.02, cursor: "grabbing" }}
                  onClick={() => {
                    if (isDragging) return;
                    setExpandedCard(isExpanded ? null : card.id);
                    onCardClick?.(card);
                  }}
                  className={cn(
                    "cursor-pointer rounded-xl border border-border/70 bg-white p-4 shadow-xl shadow-black/30",
                    "transition-colors hover:border-primary/50",
                    layout === "stack" && "absolute h-48 w-56",
                    layout === "stack" &&
                      isTopCard &&
                      "cursor-grab active:cursor-grabbing",
                    layout === "grid" && "aspect-square w-full",
                    layout === "list" && "w-full",
                    isExpanded && "ring-2 ring-primary",
                  )}
                  style={{
                    backgroundColor: card.color || undefined,
                  }}
                >
                  <div className="flex items-start gap-3">
                    {card.icon && (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {card.icon}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 font-semibold leading-snug text-slate-900">
                        {card.title}
                      </h3>
                      <p
                        className={cn(
                          "mt-1 text-sm text-slate-500",
                          layout === "stack" && "line-clamp-3",
                          layout === "grid" && "line-clamp-2",
                          layout === "list" && "line-clamp-1",
                        )}
                      >
                        {card.description}
                      </p>
                    </div>
                  </div>

                  {isTopCard && (
                    <div className="absolute bottom-2 left-0 right-0 text-center">
                      <span className="text-xs text-slate-400">
                        Arraste para navegar
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>

      {layout === "stack" && cards.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {cards.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === activeIndex
                  ? "w-5 bg-primary"
                  : "w-1.5 bg-white/25 hover:bg-white/45",
              )}
              aria-label={`Ir para o card ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
