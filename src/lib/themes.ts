import type { TripTheme } from "./types";

export type ThemeOption = {
  id: TripTheme;
  label: string;
  description: string;
  // Due colori usati per mostrare un'anteprima rotonda nel selettore.
  swatchFrom: string;
  swatchTo: string;
};

export const themeOptions: ThemeOption[] = [
  {
    id: "elegante",
    label: "Elegante",
    description: "Beige e antracite, pulito e raffinato: lo stile predefinito.",
    swatchFrom: "#f5ebd9",
    swatchTo: "#2b333e",
  },
  {
    id: "azteco",
    label: "Azteco",
    description: "Terracotta, ocra e motivi geometrici messicani.",
    swatchFrom: "#e8c08a",
    swatchTo: "#b1442e",
  },
  {
    id: "giungla",
    label: "Giungla",
    description: "Verde smeraldo e oro, ispirato a Thailandia e Indonesia.",
    swatchFrom: "#cfe3c2",
    swatchTo: "#1f6b4a",
  },
  {
    id: "deserto",
    label: "Deserto",
    description: "Sabbia e oro caldo, motivi arabeschi del deserto arabo.",
    swatchFrom: "#f0dfb8",
    swatchTo: "#a9752f",
  },
  {
    id: "nordico",
    label: "Nordico",
    description: "Blu freddi e grigi, minimal scandinavo.",
    swatchFrom: "#e3eef2",
    swatchTo: "#2e5266",
  },
  {
    id: "marocco",
    label: "Marocco",
    description: "Toni gioiello e geometrie zellige.",
    swatchFrom: "#f3e2ee",
    swatchTo: "#b23b6e",
  },
  {
    id: "giapponese",
    label: "Giapponese",
    description: "Minimal e zen, indaco e fiori di ciliegio.",
    swatchFrom: "#fbeeee",
    swatchTo: "#2c3e55",
  },
  {
    id: "tropicale",
    label: "Tropicale",
    description: "Turchese e corallo, atmosfera caraibica da spiaggia.",
    swatchFrom: "#d7f3ef",
    swatchTo: "#ff6f59",
  },
];

export const themeLabels: Record<TripTheme, string> = themeOptions.reduce(
  (acc, theme) => ({ ...acc, [theme.id]: theme.label }),
  {} as Record<TripTheme, string>,
);
