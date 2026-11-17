import type { SupabaseClient } from "@supabase/supabase-js";

export type LogoShape = "squadrato" | "smussato" | "tondo" | "personalizzato";

export const LOGO_SHAPES: { id: LogoShape; label: string }[] = [
  { id: "squadrato", label: "Squadrato" },
  { id: "smussato", label: "Smussato" },
  { id: "tondo", label: "Tondo" },
  { id: "personalizzato", label: "Personalizzato" },
];

export function parseLogoShape(value: unknown): LogoShape {
  return LOGO_SHAPES.some((s) => s.id === value) ? (value as LogoShape) : "smussato";
}

// Si legge a parte e senza bloccare nulla se la colonna non c'è ancora
// (migrazione 0034): in quel caso il logo resta "smussato".
export async function fetchLogoShape(supabase: SupabaseClient, ownerId: string): Promise<LogoShape> {
  const { data } = await supabase.from("profiles").select("logo_shape").eq("id", ownerId).maybeSingle();
  return parseLogoShape((data as { logo_shape?: string } | null)?.logo_shape);
}
