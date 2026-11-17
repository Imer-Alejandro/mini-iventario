import React from "react";

export type MeatIconCategory = "res" | "cerdo" | "pollo" | "embutidos" | "otros";

export interface MeatIconDefinition {
  id: string;
  name: string;
  category: MeatIconCategory;
  bgClass: string;
  textClass: string;
  borderClass: string;
  src: string;
}

const CATEGORY_STYLES: Record<
  MeatIconCategory,
  { bgClass: string; textClass: string; borderClass: string }
> = {
  res: { bgClass: "bg-rose-50", textClass: "text-rose-700", borderClass: "border-rose-200" },
  cerdo: { bgClass: "bg-amber-50", textClass: "text-amber-800", borderClass: "border-amber-200" },
  pollo: { bgClass: "bg-yellow-50", textClass: "text-yellow-800", borderClass: "border-yellow-200" },
  embutidos: { bgClass: "bg-teal-50", textClass: "text-teal-800", borderClass: "border-teal-200" },
  otros: { bgClass: "bg-sky-50", textClass: "text-sky-800", borderClass: "border-sky-200" },
};

function icon(id: string, name: string, category: MeatIconCategory, file: string): MeatIconDefinition {
  return {
    id,
    name,
    category,
    src: `/productos/${encodeURI(file)}`,
    ...CATEGORY_STYLES[category],
  };
}

export const MEAT_ICONS: MeatIconDefinition[] = [
  icon("carne", "Filete de res", "res", "carne.png"),
  icon("carne_2", "Corte de res", "res", "carne_2.png"),
  icon("chuleta", "Chuleta de cerdo", "cerdo", "chuleta.png"),
  icon("chuleta_3", "Chuleta ahumada", "cerdo", "chuleta_3.png"),
  icon("chuleta_4", "Chuleta con hueso", "cerdo", "chuleta_4.png"),
  icon("costillas", "Costillas BBQ", "cerdo", "costillas.png"),
  icon("costillas_3", "Costilla recortada", "cerdo", "costillas_3.png"),
  icon("costillas_4", "Rack de costilla", "cerdo", "costillas_4.png"),
  icon("costillas_chulta_2", "Costilla y chuleta", "cerdo", "costillas_chulta_2.png"),
  icon("pierna-de-jamon_1", "Pierna de jamón", "cerdo", "pierna-de-jamon_1.png"),
  icon("pierna-de-jamon_2", "Pernil entero", "cerdo", "pierna-de-jamon_2.png"),
  icon("jamon_1", "Jamón rebanado", "cerdo", "jamon_1.png"),
  icon("jamon_2", "Jamón de pierna", "cerdo", "jamon_2.png"),
  icon("jamon_3", "Jamón premium", "cerdo", "jamon_3.png"),
  icon("jamon_4", "Bloque de jamón", "cerdo", "jamon_4.png"),
  icon("jamoneta", "Jamoneta", "cerdo", "jamoneta.png"),
  icon("chicken-leg", "Muslo / pierna", "pollo", "chicken-leg.png"),
  icon("chicken-wings", "Alitas de pollo", "pollo", "chicken-wings.png"),
  icon("chicken-wings-2", "Alitas crujientes", "pollo", "chicken-wings (2).png"),
  icon("muslo_pollo", "Muslo de pollo", "pollo", "muslo_pollo.png"),
  icon("muslo_pollo_2", "Muslo con piel", "pollo", "muslo_pollo_2.png"),
  icon("pollo_1", "Pollo entero", "pollo", "pollo_1.png"),
  icon("pollo_2", "Pollo limpio", "pollo", "pollo_2.png"),
  icon("pollo-asado_1", "Pollo asado", "pollo", "pollo-asado_1.png"),
  icon("longaniza", "Longaniza criolla", "embutidos", "longaniza.png"),
  icon("loganiza_2", "Longaniza artesanal", "embutidos", "loganiza_2.png"),
  icon("longaniza_4", "Longaniza en sartén", "embutidos", "longaniza_4.png"),
  icon("longaniza_5", "Longaniza en rama", "embutidos", "longaniza_5.png"),
  icon("longaniza_6", "Longaniza especial", "embutidos", "longaniza_6.png"),
  icon("salami", "Salami mallita", "embutidos", "salami.png"),
  icon("salami_2", "Salami rebanado", "embutidos", "salami_2.png"),
  icon("salami_3", "Salami en barra", "embutidos", "salami_3.png"),
  icon("salami_4", "Salami premium", "embutidos", "salami_4.png"),
  icon("salami_5", "Salami de campo", "embutidos", "salami_5.png"),
  icon("salami_6", "Salami italiano", "embutidos", "salami_6.png"),
  icon("salchichas", "Salchichas", "embutidos", "salchichas.png"),
  icon("paquete_salchichas", "Paquete de salchichas", "embutidos", "paquete_salchichas.png"),
  icon("queso", "Queso de hoja", "otros", "queso.png"),
  icon("queso_1", "Queso fresco", "otros", "queso_1.png"),
  icon("queso_2", "Queso amarillo", "otros", "queso_2.png"),
  icon("queso_3", "Queso en barra", "otros", "queso_3.png"),
  icon("queso_4", "Queso para rallar", "otros", "queso_4.png"),
  icon("queso_5", "Queso crema", "otros", "queso_5.png"),
  icon("queso_6", "Queso fundido", "otros", "queso_6.png"),
  icon("queso_7", "Queso gourmet", "otros", "queso_7.png"),
  icon("huevos-blancos", "Huevos blancos", "otros", "huevos-blancos.png"),
  icon("huevos-criollo", "Huevos criollos", "otros", "huevos-criollo.png"),
  icon("papas-fritas", "Papas fritas", "otros", "papas-fritas.png"),
  icon("papas-fritas_1", "Papas rústicas", "otros", "papas-fritas_1.png"),
  icon("papas-fritas_2", "Papas crujientes", "otros", "papas-fritas_2.png"),
  icon("seasoning", "Sazón y condimento", "otros", "seasoning.png"),
  icon("seasoning-1", "Especia molida", "otros", "seasoning (1).png"),
  icon("donacion-de-alimentos", "Combo / donación", "otros", "donacion-de-alimentos.png"),
];

const LEGACY_ICON_ALIASES: Record<string, string> = {
  "beef-cut": "carne",
  "minced-meat": "carne_2",
  "pork-chop": "chuleta",
  "ribs-rack": "costillas",
  "chicken-breast": "chicken-leg",
  "chicken-whole": "pollo_1",
  "sausage-link": "longaniza",
  "salami-roll": "salami",
  "soup-bone": "carne",
  "bacon-strips": "jamon_1",
  "cheese-dairy": "queso",
  "seasoning-pack": "seasoning",
};

export const DEFAULT_MEAT_ICON_ID = "carne";

export const MEAT_ICON_CATEGORIES: { id: "ALL" | MeatIconCategory; label: string }[] = [
  { id: "ALL", label: "Todos" },
  { id: "res", label: "Res" },
  { id: "cerdo", label: "Cerdo" },
  { id: "pollo", label: "Pollo" },
  { id: "embutidos", label: "Embutidos" },
  { id: "otros", label: "Otros" },
];

export function getMeatIcon(iconId?: string): MeatIconDefinition {
  const resolvedId = iconId ? LEGACY_ICON_ALIASES[iconId] || iconId : DEFAULT_MEAT_ICON_ID;
  return MEAT_ICONS.find((item) => item.id === resolvedId) || MEAT_ICONS[0];
}

interface MeatBadgeProps {
  iconId?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function MeatBadge({ iconId, size = "md", className = "" }: MeatBadgeProps) {
  const iconDef = getMeatIcon(iconId);

  const sizeClasses = {
    sm: "w-9 h-9 rounded-xl",
    md: "w-12 h-12 rounded-2xl",
    lg: "w-16 h-16 rounded-2xl",
    xl: "w-20 h-20 rounded-[1.4rem]",
  };

  const imageSizes = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-11 h-11",
    xl: "w-14 h-14",
  };

  return (
    <div
      className={`inline-flex items-center justify-center border shrink-0 shadow-xs overflow-hidden ${iconDef.bgClass} ${iconDef.borderClass} ${sizeClasses[size]} ${className}`}
      title={iconDef.name}
    >
      <img
        src={iconDef.src}
        alt={iconDef.name}
        className={`${imageSizes[size]} object-contain pointer-events-none select-none`}
        draggable={false}
      />
    </div>
  );
}
