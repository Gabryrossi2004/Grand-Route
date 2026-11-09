import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Geist, Geist_Mono, Lora } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Alternative di lettura scelte in Impostazioni (dimensione e stile del
// carattere): "leggibile" privilegia la chiarezza dei caratteri, "classico"
// è un serif elegante. Il default resta Geist (sopra).
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
      className={`${geistSans.variable} ${geistMono.variable} ${readableFont.variable} ${classicFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
