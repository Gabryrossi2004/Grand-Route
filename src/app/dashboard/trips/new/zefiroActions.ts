"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generatePublicSlug } from "@/lib/slug";
import { loadAiRules } from "@/lib/aiRulesServer";
import { MAX_DRAFT_CHARS, reserveAiCall, tooLongMessage } from "@/lib/aiQuota";
import { detectFileMime, validateImageFile, validateSpreadsheetFile, validateTextFile, verifyFileSignature } from "@/lib/fileValidation";
import { parseExcelToText } from "@/lib/itineraryFileParsing";
import { GeneratedItinerarySchema, generateItineraryFromDraft, type DraftImage, type GeneratedItinerary } from "@/lib/itineraryAi";
import { generateProposalItinerary, planTripFromBrief } from "@/lib/tripBriefAi";
import { addDaysIso, insertGeneratedItinerary } from "@/lib/itineraryInsert";

export type PlanConcept = { name: string; route: string; summary: string };
export type PlanOk = {
  brief: string;
  title: string;
  destination: string | null;
  durationDays: number;
  mode: "single" | "variants";
  concepts: PlanConcept[];
};
export type PlanResult =
  | { error: string }
  | { questions: string[] }
  | { plan: PlanOk }
  | { direct: { title: string; itinerary: GeneratedItinerary } };

const MAX_BRIEF_CHARS = 12_000;

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

  // Foto della bozza: è già un itinerario, si legge direttamente (una sola proposta).
  if (read.image) {
    try {
      const generated = await generateItineraryFromDraft({
        draftText: brief,
        styleExamples: [],
        image: read.image,
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
}): Promise<{ itinerary: GeneratedItinerary } | { error: string }> {
  const parsed = z
    .object({ brief: z.string().min(1).max(MAX_BRIEF_CHARS + 6000), concept: ConceptInput, durationDays: z.number().int().min(1).max(30) })
    .safeParse(input);
  if (!parsed.success) return { error: "Richiesta non valida." };

  const quota = await reserveAiCall("itinerary", { record: false });
  if (!quota.ok) return { error: quota.error };
  const rules = await loadAiRules();
  try {
    const itinerary = await generateProposalItinerary({ ...parsed.data, rulesBlock: rules.text });
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
  proposals: z.array(z.object({ name: z.string().trim().max(120), itinerary: GeneratedItinerarySchema })).min(1).max(3),
});

// Salva le proposte scelte. Una sola: viaggio normale. Più d'una: la prima è il viaggio e le
// altre sono le sue varianti (stesso gruppo), quindi in "Viaggi" compare una sola scheda.
export async function createTripFromProposals(input: z.input<typeof SaveInput>): Promise<{ error: string }> {
  const parsed = SaveInput.safeParse(input);
  if (!parsed.success) return { error: "I dati del viaggio non sono validi. Rigenera le proposte." };
  const { title, destination, clientId, startDate, proposals } = parsed.data;

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
    let result = await supabase.from("trips").insert({ ...base, ai_notes: notes || null }).select("id").single();
    // Se la colonna delle note non c'è ancora (migrazione 0033) si salva senza
    if (result.error) result = await supabase.from("trips").insert(base).select("id").single();
    if (result.error || !result.data) {
      await cleanup();
      return { error: "Non è stato possibile creare il viaggio. Riprova." };
    }
    createdTripIds.push(result.data.id as string);

    const inserted = await insertGeneratedItinerary(supabase, result.data.id as string, proposal.itinerary, startDate);
    if ("error" in inserted) {
      await cleanup();
      return { error: inserted.error };
    }
  }

  redirect(`/dashboard/trips/${createdTripIds[0]}`);
}
