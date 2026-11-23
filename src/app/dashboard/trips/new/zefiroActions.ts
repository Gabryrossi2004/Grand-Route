"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { generatePublicSlug } from "@/lib/slug";
import { loadAiRules } from "@/lib/aiRulesServer";
import { MAX_DRAFT_CHARS, reserveAiCall, tooLongMessage } from "@/lib/aiQuota";
import { detectFileMime, validateImageFile, validateSpreadsheetFile, validateTextFile, verifyFileSignature } from "@/lib/fileValidation";
import { parseExcelToText } from "@/lib/itineraryFileParsing";
import { GeneratedItinerarySchema, generateItineraryFromDraft, type DraftImage, type GeneratedItinerary } from "@/lib/itineraryAi";
import { generateProposalItinerary, planTripFromBrief } from "@/lib/tripBriefAi";
import { addDaysIso, insertGeneratedItinerary } from "@/lib/itineraryInsert";
import { parseMode, type ItineraryMode } from "@/lib/itineraryMode";

export type PlanConcept = { name: string; route: string; summary: string };
export type PlanOk = {
  brief: string;
  title: string;
  destination: string | null;
  durationDays: number;
  styleId: string | null;
  mode: "single" | "variants";
  concepts: PlanConcept[];
};
export type PlanResult =
  | { error: string }
  | { questions: string[] }
  | { plan: PlanOk }
  | { direct: { title: string; itinerary: GeneratedItinerary } };

const MAX_BRIEF_CHARS = 12_000;

// Istruzioni dello "Stile" scelto dall'agenzia (Libreria → Stili). Il database lo restituisce solo se è suo.
async function loadStyle(styleId: string | null): Promise<string | null> {
  if (!styleId) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("prompt_styles").select("prompt_text").eq("id", styleId).maybeSingle();
  return (data?.prompt_text as string | undefined) ?? null;
}

// Legge la descrizione del viaggio (testo) e l'eventuale file allegato:
// foto della bozza oppure Excel/CSV/testo, che diventa testo.
async function readBrief(formData: FormData): Promise<{ text: string; image: DraftImage | null } | { error: string }> {
  let text = String(formData.get("brief") ?? "").trim();
  let image: DraftImage | null = null;

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const name = file.name.toLowerCase();
    if (file.type.startsWith("image/")) {
      const problem = validateImageFile(file) ?? (await verifyFileSignature(file));
      if (problem) return { error: problem };
      const buffer = Buffer.from(await file.arrayBuffer());
      image = { base64: buffer.toString("base64"), mediaType: ((await detectFileMime(file)) ?? file.type) as DraftImage["mediaType"] };
    } else if (name.endsWith(".txt") || name.endsWith(".md")) {
      const problem = validateTextFile(file);
      if (problem) return { error: problem };
      text = [text, Buffer.from(await file.arrayBuffer()).toString("utf-8")].filter(Boolean).join("\n\n");
    } else if (name.endsWith(".csv") || name.endsWith(".xlsx")) {
      const problem = validateSpreadsheetFile(file);
      if (problem) return { error: problem };
      const buffer = Buffer.from(await file.arrayBuffer());
      let fileText: string;
      try {
        fileText = name.endsWith(".csv") ? buffer.toString("utf-8") : await parseExcelToText(buffer);
      } catch {
        return { error: "Non riesco a leggere il file. Controlla che sia valido." };
      }
      text = [text, fileText].filter(Boolean).join("\n\n");
    } else {
      return { error: "Formato non supportato: carica una foto (JPG/PNG), un Excel/CSV o un file di testo." };
    }
  }

  if (!text && !image) return { error: "Scrivi a grandi linee che viaggio vuoi, e Zefiro lo prepara." };
  if (text.length > MAX_DRAFT_CHARS) return { error: tooLongMessage(MAX_DRAFT_CHARS) };
  return { text, image };
}

// Primo passo: capisce la richiesta. Restituisce domande (se servono) oppure il
// piano con una o tre idee di viaggio. Non crea nulla.
export async function planTripWithZefiro(formData: FormData): Promise<PlanResult> {
  const read = await readBrief(formData);
  if ("error" in read) return read;

  const clarifications = String(formData.get("clarifications") ?? "").trim().slice(0, 4000);
  const brief = (clarifications ? `${read.text}\n\nCHIARIMENTI DELL'AGENTE (risposte alle tue domande):\n${clarifications}` : read.text).trim();
  if (brief.length > MAX_BRIEF_CHARS && !read.image) return { error: tooLongMessage(MAX_BRIEF_CHARS) };

  const quota = await reserveAiCall("itinerary");
  if (!quota.ok) return { error: quota.error };
  const rules = await loadAiRules();
  const styleId = String(formData.get("prompt_style_id") ?? "") || null;

  // Foto della bozza: è già un itinerario, si legge direttamente (una sola proposta).
  if (read.image) {
    try {
      const generated = await generateItineraryFromDraft({
        draftText: brief,
        styleExamples: [],
        image: read.image,
        styleInstructions: await loadStyle(styleId),
        tripDays: null,
        rulesBlock: rules.text,
        allowQuestions: !clarifications,
      });
      if (generated.questions.length > 0 && generated.days.length === 0 && !clarifications) return { questions: generated.questions };
      if (generated.days.length === 0) return { error: "Non sono riuscito a leggere dei giorni dalla foto. Prova con una foto più nitida." };
      return { direct: { title: "Nuovo viaggio", itinerary: generated } };
    } catch {
      return { error: "Non è stato possibile leggere la bozza. Riprova." };
    }
  }

  try {
    const plan = await planTripFromBrief({ brief, rulesBlock: rules.text, allowQuestions: !clarifications });
    if (plan.questions.length > 0 && plan.concepts.length === 0 && !clarifications) return { questions: plan.questions };
    if (plan.concepts.length === 0) return { error: "Non sono riuscito a capire il viaggio. Aggiungi qualche dettaglio (destinazione, durata, chi viaggia)." };
    return {
      plan: {
        brief,
        title: plan.title.trim() || "Nuovo viaggio",
        destination: plan.destination?.trim() || null,
        durationDays: plan.duration_days ?? 7,
        styleId,
        mode: plan.concepts.length > 1 ? "variants" : "single",
        concepts: plan.concepts.slice(0, 3),
      },
    };
  } catch (error) {
    console.error("[planTripWithZefiro]", (error as Error).message);
    return { error: "Non è stato possibile preparare il piano. Riprova tra poco." };
  }
}

const ConceptInput = z.object({ name: z.string().max(120), route: z.string().max(600), summary: z.string().max(1200) });

// Secondo passo: scrive UNA proposta. Il client ne lancia fino a tre insieme, così il
// tempo totale è quello di una sola. Conta come una sola richiesta (già contata nel piano).
export async function generateProposal(input: {
  brief: string;
  concept: PlanConcept;
  durationDays: number;
  styleId?: string | null;
  // Richiesta già dettagliata: si ricostruisce com'è, senza inventare (stesso lavoro della bozza)
  faithful?: boolean;
}): Promise<{ itinerary: GeneratedItinerary } | { error: string }> {
  const parsed = z
    .object({
      brief: z.string().min(1).max(MAX_BRIEF_CHARS + 6000),
      concept: ConceptInput,
      durationDays: z.number().int().min(1).max(30),
      styleId: z.string().uuid().nullish(),
      faithful: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Richiesta non valida." };

  const quota = await reserveAiCall("itinerary", { record: false });
  if (!quota.ok) return { error: quota.error };
  const rules = await loadAiRules();
  try {
    if (parsed.data.faithful) {
      const generated = await generateItineraryFromDraft({
        draftText: parsed.data.brief,
        styleExamples: [],
        styleInstructions: await loadStyle(parsed.data.styleId ?? null),
        tripDays: null,
        rulesBlock: rules.text,
        allowQuestions: false,
      });
      if (generated.days.length === 0) return { error: "Non sono riuscito a ricavare dei giorni. Prova con più dettagli." };
      return { itinerary: generated };
    }
    const itinerary = await generateProposalItinerary({
      brief: parsed.data.brief,
      concept: parsed.data.concept,
      durationDays: parsed.data.durationDays,
      rulesBlock: rules.text,
      styleInstructions: await loadStyle(parsed.data.styleId ?? null),
    });
    return { itinerary };
  } catch (error) {
    console.error("[generateProposal]", (error as Error).message);
    return { error: "Questa proposta non è riuscita. Riprova." };
  }
}

const SaveInput = z.object({
  title: z.string().trim().min(1).max(200),
  destination: z.string().trim().max(200).nullable(),
  clientId: z.string().uuid().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  itineraryMode: z.enum(["activities", "days"]).optional(),
  proposals: z.array(z.object({ name: z.string().trim().max(120), itinerary: GeneratedItinerarySchema })).min(1).max(3),
});

// Salva le proposte scelte. Una sola: viaggio normale. Più d'una: la prima è il viaggio e le
// altre sono le sue varianti (stesso gruppo), quindi in "Viaggi" compare una sola scheda.
export async function createTripFromProposals(input: z.input<typeof SaveInput>): Promise<{ error: string }> {
  const parsed = SaveInput.safeParse(input);
  if (!parsed.success) return { error: "I dati del viaggio non sono validi. Rigenera le proposte." };
  const { title, destination, clientId, startDate, proposals } = parsed.data;
  const mode: ItineraryMode = parseMode(parsed.data.itineraryMode);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };

  const createdTripIds: string[] = [];
  let groupId: string | null = null;
  const cleanup = async () => {
    if (createdTripIds.length > 0) await supabase.from("trips").delete().in("id", createdTripIds);
    if (groupId) await supabase.from("trip_groups").delete().eq("id", groupId);
  };

  if (proposals.length > 1) {
    const { data: group } = await supabase.from("trip_groups").insert({ owner_id: user.id, client_id: clientId, title }).select("id").single();
    groupId = group?.id ?? null;
    if (!groupId) return { error: "Non è stato possibile creare il gruppo di varianti. Riprova." };
  }

  for (const proposal of proposals) {
    const days = proposal.itinerary.days.length;
    const tripTitle = proposals.length > 1 && proposal.name ? `${title} · ${proposal.name}` : title;
    const notes = proposal.itinerary.agent_notes
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => `• ${n}`)
      .join("\n");
    const base = {
      owner_id: user.id,
      title: tripTitle,
      destination,
      client_id: clientId,
      group_id: groupId,
      start_date: startDate,
      end_date: startDate ? addDaysIso(startDate, days - 1) : null,
      public_slug: generatePublicSlug(),
    };
    // Se le colonne nuove non ci sono ancora (migrazioni 0033 e 0043) si riprova senza
    const attempts: Record<string, unknown>[] = [
      { ...base, itinerary_mode: mode, ai_notes: notes || null },
      { ...base, itinerary_mode: mode },
      { ...base, ai_notes: notes || null },
      base,
    ];
    let result = await supabase.from("trips").insert(attempts[0]).select("id").single();
    for (let i = 1; i < attempts.length && result.error; i++) {
      result = await supabase.from("trips").insert(attempts[i]).select("id").single();
    }
    if (result.error || !result.data) {
      await cleanup();
      return { error: "Non è stato possibile creare il viaggio. Riprova." };
    }
    createdTripIds.push(result.data.id as string);

    const inserted = await insertGeneratedItinerary(supabase, result.data.id as string, proposal.itinerary, startDate, mode);
    if ("error" in inserted) {
      await cleanup();
      return { error: inserted.error };
    }
  }

  redirect(`/dashboard/trips/${createdTripIds[0]}`);
}


const ApplyInput = z.object({
  tripId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  itineraryMode: z.enum(["activities", "days"]).optional(),
  proposals: z.array(z.object({ name: z.string().trim().max(120), itinerary: GeneratedItinerarySchema })).min(1).max(3),
});

// Dentro un viaggio già creato: se è vuoto la prima proposta lo riempie e le altre diventano
// varianti; se ha già un itinerario NIENTE viene sovrascritto e tutte le proposte diventano varianti.
export async function applyProposalsToTrip(
  input: z.input<typeof ApplyInput>,
): Promise<{ ok: true; filled: boolean; variants: number } | { error: string }> {
  const parsed = ApplyInput.safeParse(input);
  if (!parsed.success) return { error: "I dati non sono validi. Rigenera le proposte." };
  const { tripId, proposals } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };

  const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).eq("owner_id", user.id).maybeSingle();
  if (!trip) return { error: "Viaggio non trovato." };

  const { data: dayRows } = await supabase.from("trip_days").select("id").eq("trip_id", tripId);
  const dayIds = (dayRows ?? []).map((d) => d.id as string);
  let hasContent = false;
  if (dayIds.length > 0) {
    const { count } = await supabase.from("activities").select("id", { count: "exact", head: true }).in("trip_day_id", dayIds);
    hasContent = (count ?? 0) > 0;
  }

  const startDate = parsed.data.startDate ?? (trip.start_date as string | null);
  const fillFirst = !hasContent;
  // Viaggio vuoto: si può scegliere la modalità; con un itinerario già scritto resta quella attuale
  const mode: ItineraryMode = fillFirst ? parseMode(parsed.data.itineraryMode ?? trip.itinerary_mode) : parseMode(trip.itinerary_mode);
  const variantProposals = fillFirst ? proposals.slice(1) : proposals;

  // Gruppo di varianti (si crea se serve e il viaggio non ne ha già uno)
  let groupId = (trip.group_id as string | null) ?? null;
  if (variantProposals.length > 0 && !groupId) {
    const { data: group } = await supabase
      .from("trip_groups")
      .insert({ owner_id: user.id, client_id: trip.client_id, title: trip.title })
      .select("id")
      .single();
    groupId = group?.id ?? null;
    if (!groupId) return { error: "Non è stato possibile creare il gruppo di varianti. Riprova." };
    await supabase.from("trips").update({ group_id: groupId }).eq("id", tripId);
  }

  const createdIds: string[] = [];
  const notesOf = (p: (typeof proposals)[number]) =>
    p.itinerary.agent_notes
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => `• ${n}`)
      .join("\n");

  for (const proposal of variantProposals) {
    const days = proposal.itinerary.days.length;
    const base = {
      owner_id: user.id,
      title: proposal.name ? `${trip.title} · ${proposal.name}` : `${trip.title} (variante)`,
      destination: trip.destination,
      client_id: trip.client_id,
      group_id: groupId,
      start_date: startDate,
      end_date: startDate ? addDaysIso(startDate, days - 1) : null,
      cover_image_url: trip.cover_image_url,
      title_color: trip.title_color,
      theme: trip.theme,
      public_slug: generatePublicSlug(),
    };
    const notes = notesOf(proposal);
    const attempts: Record<string, unknown>[] = [
      { ...base, itinerary_mode: mode, ai_notes: notes || null },
      { ...base, itinerary_mode: mode },
      { ...base, ai_notes: notes || null },
      base,
    ];
    let result = await supabase.from("trips").insert(attempts[0]).select("id").single();
    for (let i = 1; i < attempts.length && result.error; i++) {
      result = await supabase.from("trips").insert(attempts[i]).select("id").single();
    }
    if (result.error || !result.data) {
      if (createdIds.length > 0) await supabase.from("trips").delete().in("id", createdIds);
      return { error: "Non è stato possibile creare le varianti. Riprova." };
    }
    createdIds.push(result.data.id as string);
    const inserted = await insertGeneratedItinerary(supabase, result.data.id as string, proposal.itinerary, startDate, mode);
    if ("error" in inserted) {
      await supabase.from("trips").delete().in("id", createdIds);
      return { error: inserted.error };
    }
  }

  if (fillFirst) {
    const first = proposals[0];
    // I giorni vuoti già presenti si sostituiscono solo ora, a generazione riuscita
    if (dayIds.length > 0) await supabase.from("trip_days").delete().in("id", dayIds);
    const inserted = await insertGeneratedItinerary(supabase, tripId, first.itinerary, startDate, mode);
    if ("error" in inserted) {
      if (createdIds.length > 0) await supabase.from("trips").delete().in("id", createdIds);
      return { error: inserted.error };
    }
    const days = first.itinerary.days.length;
    const patch: Record<string, unknown> = {};
    if (startDate) {
      patch.start_date = startDate;
      patch.end_date = addDaysIso(startDate, days - 1);
    }
    const notes = notesOf(first);
    if (notes) patch.ai_notes = notes;
    if (mode !== parseMode(trip.itinerary_mode)) {
      // Se la migrazione 0043 non c'è ancora, questa modifica viene ignorata
      await supabase.from("trips").update({ itinerary_mode: mode }).eq("id", tripId);
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("trips").update(patch).eq("id", tripId);
      if (error && patch.ai_notes) {
        delete patch.ai_notes;
        if (Object.keys(patch).length > 0) await supabase.from("trips").update(patch).eq("id", tripId);
      }
    }
  }

  revalidatePath(`/dashboard/trips/${tripId}`);
  revalidatePath("/dashboard/trips");
  return { ok: true, filled: fillFirst, variants: variantProposals.length };
}

// Proposte pronte dalla libreria (Atlante e Italia): gratis, nessuna chiamata AI.
export async function findLibraryProposals(text: string): Promise<{
  label: string;
  proposals: { name: string; route: string; summary: string; itinerary: GeneratedItinerary }[];
} | null> {
  const user = await getCachedUser();
  if (!user || typeof text !== "string") return null;
  const { matchLibrary } = await import("@/lib/libraryProposals");
  const m = matchLibrary(text.slice(0, 4000));
  if (!m || m.proposals.length === 0) return null;
  return {
    label: m.label,
    proposals: m.proposals.map((p) => ({ name: p.title, route: p.route, summary: p.description, itinerary: p.itinerary })),
  };
}

// «Consulta proposte»: gli itinerari pronti per un paese o una regione (prima quelli dell'agenzia,
// poi quelli di Grand Route). Si può indicare la destinazione scelta dall'elenco o scrivere un luogo.
export async function consultProposals(input: { kind: "country" | "italy"; key: string } | { text: string }): Promise<{
  label: string;
  kind: "country" | "italy";
  key: string;
  proposals: { name: string; route: string; summary: string; itinerary: GeneratedItinerary; agency: boolean }[];
} | null> {
  const user = await getCachedUser();
  if (!user) return null;
  const { matchLibrary, libraryProposalsFor } = await import("@/lib/libraryProposals");
  let kind: "country" | "italy";
  let key: string;
  let label: string;
  if ("text" in input) {
    if (typeof input.text !== "string") return null;
    const m = matchLibrary(input.text.slice(0, 400));
    if (!m) return null;
    ({ kind, key, label } = m);
  } else {
    if (!["country", "italy"].includes(input.kind) || typeof input.key !== "string" || input.key.length > 40) return null;
    kind = input.kind;
    key = input.key;
    const { destinationOptions } = await import("@/lib/actions/agencyItineraries");
    const found = (await destinationOptions()).find((o) => o.kind === kind && o.key === key);
    if (!found) return null;
    label = found.label;
  }
  const { listAgencyItineraries } = await import("@/lib/actions/agencyItineraries");
  const own = await listAgencyItineraries({ kind, key });
  const agency = own.ok
    ? own.items.map((it) => ({ name: it.title, route: it.route ?? "", summary: it.description ?? "", itinerary: it.program, agency: true }))
    : [];
  const library = libraryProposalsFor(kind, key).map((p) => ({ name: p.title, route: p.route, summary: p.description, itinerary: p.itinerary, agency: false }));
  return { label, kind, key, proposals: [...agency, ...library] };
}

const LibraryItineraryInput = z.object({
  kind: z.enum(["country", "italy"]),
  key: z.string().trim().min(2).max(40),
  label: z.string().trim().min(1).max(80),
  itinerary: z.object({
    title: z.string().trim().min(1).max(160),
    days: z.number().int().min(1).max(60),
    route: z.string().trim().max(600),
    description: z.string().max(2000),
    plan: z.array(z.object({ t: z.string().max(200), a: z.array(z.string().max(1000)).max(12) })).max(60).optional(),
  }),
});

// «Crea il viaggio da questo itinerario» (Atlante): il programma si crea gratis dalla libreria
export async function createTripFromLibraryItinerary(input: z.input<typeof LibraryItineraryInput>): Promise<{ error: string }> {
  const parsed = LibraryItineraryInput.safeParse(input);
  if (!parsed.success) return { error: "Itinerario non valido." };
  const user = await getCachedUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const { kind, key, label, itinerary } = parsed.data;
  const { expandLibraryItinerary } = await import("@/lib/libraryProposals");
  const generated = expandLibraryItinerary(kind, key, itinerary);
  return createTripFromProposals({
    title: `${label} · ${itinerary.title}`.slice(0, 200),
    destination: label,
    clientId: null,
    startDate: null,
    proposals: [{ name: itinerary.title.slice(0, 120), itinerary: generated }],
  });
}
