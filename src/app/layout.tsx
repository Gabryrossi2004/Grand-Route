import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Fraunces, Lora, Work_Sans } from "next/font/google";
import "./globals.css";

const uiSans = Work_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
});

const displaySerif = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "variable",
});

// Alternative di lettura scelte in Impostazioni (dimensione e stile del
// carattere): "leggibile" privilegia la chiarezza dei caratteri, "classico"
// è un serif elegante. Il default resta Work Sans (sopra).
const readableFont = Atkinson_Hyperlegible({
  variable: "--font-readable",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const classicFont = Lora({
  variable: "--font-classic",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Grand Route",
  description: "Grand Route: crea itinerari di viaggio brandizzati da condividere con i tuoi clienti",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      className={`${uiSans.variable} ${displaySerif.variable} ${readableFont.variable} ${classicFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
