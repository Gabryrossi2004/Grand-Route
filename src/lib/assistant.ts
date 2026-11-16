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
// Impostazioni (preferenza salvata in ai_preferences.avatar_style).
export type ZefiroVariantId = "classico" | "seta" | "grecia" | "egitto";

export const ZEFIRO_VARIANTS: { id: ZefiroVariantId; name: string; description: string }[] = [
  { id: "classico", name: "Classico", description: "Berretto blu notte e sciarpa dorata" },
  { id: "seta", name: "Via della Seta", description: "Cappello conico di paglia e sciarpa di seta rossa" },
  { id: "grecia", name: "Grecia", description: "Corona d'alloro e sciarpa blu Egeo" },
  { id: "egitto", name: "Egitto", description: "Copricapo a strisce e collare dorato con perle" },
];

export function getAvatarStyle(preferences: Record<string, string> | null | undefined): ZefiroVariantId {
  const style = preferences?.avatar_style;
  return ZEFIRO_VARIANTS.some((variant) => variant.id === style) ? (style as ZefiroVariantId) : "classico";
}
