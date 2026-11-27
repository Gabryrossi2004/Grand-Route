// «Invita un collega»: sconto per chi invita e per chi arriva dal suo link, quando il collega è verificato e attivo.
// I conti veri li fa il database (migrazione 0074); qui solo testi e costanti.

export const REWARD_PCT = 20;
export const REWARD_MONTHS = 3;
export const MAX_BANKED_MONTHS = 12;

export type ReferralState = "registrato" | "verificato" | "attivo" | "non_valido";

export type ReferralOverview = {
  code: string;
  invited_by: { name: string; state: ReferralState } | null;
  invitees: { name: string; state: ReferralState; since: string }[];
  active: number;
  banked_months: number;
};

export const STATE_LABEL: Record<ReferralState, { label: string; hint: string; tone: string }> = {
  registrato: { label: "Registrato", hint: "Aspetta la verifica del nostro team.", tone: "bg-slate-100 text-slate-700" },
  verificato: { label: "Verificato", hint: "Manca che inizi a lavorare su Grand Route (un viaggio, un ordine o una collaborazione).", tone: "bg-amber-50 text-amber-800" },
  attivo: { label: "Attivo", hint: "Lo sconto è maturato.", tone: "bg-emerald-50 text-emerald-800" },
  non_valido: { label: "Non valido", hint: "Stessa partita IVA: l'invito non conta.", tone: "bg-slate-100 text-slate-500" },
};

// Solo i codici fatti come li crea il database (8 caratteri esadecimali): evita di salvare testo strano nel profilo
export const cleanReferralCode = (v: unknown): string | null => {
  const s = String(v ?? "").trim().toLowerCase();
  return /^[a-f0-9]{8}$/.test(s) ? s : null;
};

export const inviteMessage = (link: string) =>
  `Ti invito su Grand Route, il gestionale per chi lavora nel turismo (agenzie, guide, autisti, strutture). Registrati da questo link e avrai uno sconto di benvenuto: ${link}`;
