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
    description: "Stile pulito e raffinato, adatto a qualsiasi viaggio.",
    swatchFrom: "#f8f3ea",
    swatchTo: "#c9a227",
  },
  {
    id: "azteco",
    label: "Azteco",
    description: "Terracotta, ocra e motivi geometrici.",
    swatchFrom: "#e8c08a",
    swatchTo: "#b1442e",
  },
  {
    id: "giungla",
    label: "Giungla",
    description: "Verde intenso e foglie, per viaggi natura e avventura.",
    swatchFrom: "#d8e8d0",
    swatchTo: "#2f6b3c",
  },
  {
    id: "deserto",
    label: "Deserto",
    description: "Tonalità sabbia e dune calde.",
    swatchFrom: "#f0dfc0",
    swatchTo: "#c2703d",
  },
  {
    id: "egizio",
    label: "Egizio",
    description: "Oro e blu lapislazzuli, per l'antico Egitto.",
    swatchFrom: "#e9d9a0",
    swatchTo: "#1b3a6b",
  },
  {
    id: "nordico",
    label: "Nordico",
    description: "Blu freddi e grigi, minimal scandinavo.",
    swatchFrom: "#e3eef2",
    swatchTo: "#2e5266",
  },
  {
    id: "citta",
    label: "Città",
    description: "Moderno e urbano, linee nette.",
    swatchFrom: "#e9e9ec",
    swatchTo: "#1a1a1f",
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
    description: "Minimal e zen, con fiori di ciliegio.",
    swatchFrom: "#fbeeee",
    swatchTo: "#c0392b",
  },
  {
    id: "tropicale",
    label: "Tropicale",
    description: "Turchese e corallo, atmosfera da spiaggia.",
    swatchFrom: "#d7f3ef",
    swatchTo: "#ff6f59",
  },
];

export const themeLabels: Record<TripTheme, string> = themeOptions.reduce(
  (acc, theme) => ({ ...acc, [theme.id]: theme.label }),
  {} as Record<TripTheme, string>,
);
