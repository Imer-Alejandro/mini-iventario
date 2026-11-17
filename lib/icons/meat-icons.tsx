import React from "react";

export interface MeatIconDefinition {
  id: string;
  name: string;
  category: "res" | "cerdo" | "pollo" | "embutidos" | "otros";
  bgClass: string;
  textClass: string;
  borderClass: string;
  emoji: string;
}

export const MEAT_ICONS: MeatIconDefinition[] = [
  {
    id: "beef-cut",
    name: "Corte de Res / Filete",
    category: "res",
    bgClass: "bg-rose-50",
    textClass: "text-rose-700",
    borderClass: "border-rose-200",
    emoji: "🥩",
  },
  {
    id: "minced-meat",
    name: "Carne Molida Especial",
    category: "res",
    bgClass: "bg-red-50",
    textClass: "text-red-700",
    borderClass: "border-red-200",
    emoji: "🥣",
  },
  {
    id: "pork-chop",
    name: "Chuleta de Cerdo / Pernil",
    category: "cerdo",
    bgClass: "bg-amber-50",
    textClass: "text-amber-700",
    borderClass: "border-amber-200",
    emoji: "🍖",
  },
  {
    id: "ribs-rack",
    name: "Costillitas BBQ",
    category: "cerdo",
    bgClass: "bg-orange-50",
    textClass: "text-orange-700",
    borderClass: "border-orange-200",
    emoji: "🥓",
  },
  {
    id: "chicken-breast",
    name: "Pechuga de Pollo",
    category: "pollo",
    bgClass: "bg-yellow-50",
    textClass: "text-yellow-800",
    borderClass: "border-yellow-200",
    emoji: "🍗",
  },
  {
    id: "chicken-whole",
    name: "Pollo Entero Limpio",
    category: "pollo",
    bgClass: "bg-emerald-50",
    textClass: "text-emerald-800",
    borderClass: "border-emerald-200",
    emoji: "🐔",
  },
  {
    id: "sausage-link",
    name: "Longaniza / Salchicha",
    category: "embutidos",
    bgClass: "bg-teal-50",
    textClass: "text-teal-800",
    borderClass: "border-teal-200",
    emoji: "🌭",
  },
  {
    id: "salami-roll",
    name: "Salami Especial",
    category: "embutidos",
    bgClass: "bg-purple-50",
    textClass: "text-purple-800",
    borderClass: "border-purple-200",
    emoji: "🥪",
  },
  {
    id: "soup-bone",
    name: "Hueso para Sopa / Rabo",
    category: "res",
    bgClass: "bg-slate-100",
    textClass: "text-slate-800",
    borderClass: "border-slate-300",
    emoji: "🦴",
  },
  {
    id: "bacon-strips",
    name: "Tocineta / Panceta",
    category: "cerdo",
    bgClass: "bg-pink-50",
    textClass: "text-pink-700",
    borderClass: "border-pink-200",
    emoji: "🥓",
  },
  {
    id: "cheese-dairy",
    name: "Queso de Hoja / Lácteo",
    category: "otros",
    bgClass: "bg-sky-50",
    textClass: "text-sky-800",
    borderClass: "border-sky-200",
    emoji: "🧀",
  },
  {
    id: "seasoning-pack",
    name: "Sazón / Carbón Vegetal",
    category: "otros",
    bgClass: "bg-lime-50",
    textClass: "text-lime-800",
    borderClass: "border-lime-200",
    emoji: "🧂",
  },
];

export function getMeatIcon(iconId?: string): MeatIconDefinition {
  return (
    MEAT_ICONS.find((i) => i.id === iconId) || {
      id: "beef-cut",
      name: "Corte General",
      category: "res",
      bgClass: "bg-rose-50",
      textClass: "text-rose-700",
      borderClass: "border-rose-200",
      emoji: "🥩",
    }
  );
}

interface MeatBadgeProps {
  iconId?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function MeatBadge({ iconId, size = "md", className = "" }: MeatBadgeProps) {
  const icon = getMeatIcon(iconId);

  const sizeClasses = {
    sm: "w-8 h-8 text-base rounded-xl",
    md: "w-11 h-11 text-xl rounded-2xl",
    lg: "w-14 h-14 text-2xl rounded-2xl",
  };

  return (
    <div
      className={`inline-flex items-center justify-center border font-sans select-none shrink-0 shadow-xs transition-transform group-hover:scale-105 ${icon.bgClass} ${icon.textClass} ${icon.borderClass} ${sizeClasses[size]} ${className}`}
      title={icon.name}
    >
      <span>{icon.emoji}</span>
    </div>
  );
}
