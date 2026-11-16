// L'assistente di Grand Route: nome e descrizione in UN solo posto.
// Per cambiargli nome basta modificare ASSISTANT_NAME qui sotto: compare
// ovunque nelle schermate. (Le frasi sono scritte in modo da non dipendere
// dal genere del nome.)
export const ASSISTANT_NAME = "Zefiro";
export const ASSISTANT_TAGLINE = "il tuo assistente di viaggio";

// Zefiro fluttuante sullo schermo: acceso di default, si spegne dalle
// Impostazioni (preferenza salvata nel profilo, in ai_preferences.avatar).
export function isAvatarVisible(preferences: Record<string, string> | null | undefined): boolean {
  return (preferences?.avatar ?? "on") !== "off";
}

// I costumi di Zefiro: l'agenzia sceglie quello che preferisce nelle
// Impostazioni (preferenza salvata in ai_preferences.avatar_style), oppure
// "dinamico": Zefiro si veste secondo la meta del viaggio che sta guardando.
export type ZefiroVariantId =
  | "classico"
  | "seta"
  | "giappone"
  | "grecia"
  | "egitto"
  | "arabo"
  | "africa"
  | "messico"
  | "nordico"
  | "tropicale";

export type ZefiroMode = ZefiroVariantId | "dinamico";

export const ZEFIRO_VARIANTS: { id: ZefiroVariantId; name: string; description: string }[] = [
  { id: "classico", name: "Classico", description: "Berretto blu notte e sciarpa dorata" },
  { id: "seta", name: "Via della Seta", description: "Cappello conico e seta rossa: Cina, Asia centrale, India" },
  { id: "giappone", name: "Giappone", description: "Fascia con il sole rosso, obi e fiori di ciliegio" },
  { id: "grecia", name: "Grecia", description: "Corona d'alloro e sciarpa blu Egeo" },
  { id: "egitto", name: "Egitto", description: "Copricapo a strisce e collare dorato con perle" },
  { id: "arabo", name: "Medio Oriente", description: "Turbante con gioiello: Marocco, Emirati, Giordania, Turchia" },
  { id: "africa", name: "Safari", description: "Cappello da safari e sciarpa a righe: Africa" },
  { id: "messico", name: "Messico", description: "Sombrero e poncho a righe: America Latina" },
  { id: "nordico", name: "Nord", description: "Elmo con le corna e sciarpa di lana: Scandinavia, Islanda" },
  { id: "tropicale", name: "Tropici", description: "Cappello di paglia con ibisco e collana di fiori: isole e mari caldi" },
];

export const ZEFIRO_MODES: ZefiroMode[] = ["dinamico", ...ZEFIRO_VARIANTS.map((variant) => variant.id)];

export function getAvatarStyle(preferences: Record<string, string> | null | undefined): ZefiroMode {
  const style = preferences?.avatar_style as ZefiroMode | undefined;
  return style && ZEFIRO_MODES.includes(style) ? style : "classico";
}
