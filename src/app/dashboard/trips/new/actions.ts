"use server";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { generatePublicSlug } from "@/lib/slug";
import {
  detectFileMime,
  validateImageFile,
  validateTextFile,
  verifyFileSignature,
} from "@/lib/fileValidation";
import { reserveAiCall, MAX_DRAFT_CHARS, tooLongMessage } from "@/lib/aiQuota";
import {
  extractClientRequest as extractClientRequestAi,
  type ClientRequest,
} from "@/lib/clientRequestAi";
import type { DraftImage } from "@/lib/itineraryAi";
import { parseMode } from "@/lib/itineraryMode";
import { companyIdOf, getTeamContext } from "@/lib/team";

const MAX_AUTO_DAYS = 90;

function dateRange(start: string, end: string): string[] {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    startDate > endDate
  )
    return [];

  const dates: string[] = [];
  const cursor = startDate;
  while (cursor <= endDate && dates.length < MAX_AUTO_DAYS) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

type NewTripFields = {
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  clientId: string | null;
  clientRequestNotes?: string | null;
  priceMode?: string;
  priceAmount?: number | null;
  priceNet?: number | null;
  priceCommission?: number | null;
  itineraryMode?: string;
};

// Crea il viaggio e, se ci sono le date, un giorno vuoto per ciascuna.
async function insertTripWithDays(
  supabase: SupabaseClient,
  userId: string,
  fields: NewTripFields,
): Promise<{ id: string } | { error: string }> {
  const priceMode = fields.priceMode ?? "nessuno";
  const row = {
    owner_id: userId,
    title: fields.title,
    destination: fields.destination,
    start_date: fields.startDate,
    end_date: fields.endDate,
    client_id: fields.clientId,
    client_request_notes: fields.clientRequestNotes ?? null,
    public_slug: generatePublicSlug(),
    price_mode: priceMode,
    price_amount: priceMode === "lordo" ? (fields.priceAmount ?? null) : null,
    price_net: priceMode === "commissioni" ? (fields.priceNet ?? null) : null,
    price_commission:
      priceMode === "commissioni" ? (fields.priceCommission ?? null) : null,
  };
  // Se la migrazione 0043 non c'è ancora la colonna non esiste: si crea il viaggio senza (solo per attività)
  let { data: trip, error } = await supabase
    .from("trips")
    .insert({ ...row, itinerary_mode: parseMode(fields.itineraryMode) })
    .select("id")
    .single();
  if (error)
    ({ data: trip, error } = await supabase
      .from("trips")
      .insert(row)
      .select("id")
      .single());

  if (error || !trip) {
    return { error: "Errore durante la creazione del viaggio. Riprova." };
  }

  if (fields.startDate && fields.endDate) {
    const days = dateRange(fields.startDate, fields.endDate);
    if (days.length > 0) {
      await supabase.from("trip_days").insert(
        days.map((day_date, index) => ({
          trip_id: trip.id,
          day_date,
          day_order: index,
        })),
      );
    }
  }

  return { id: trip.id };
}

export async function createTrip(
  _prevState: { error?: string } | undefined,
  formData: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Devi essere loggato." };
  }
  const companyId = await companyIdOf(user.id);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return { error: "Il titolo del viaggio è obbligatorio." };
  }

  const created = await insertTripWithDays(supabase, companyId, {
    title,
    destination: String(formData.get("destination") ?? "").trim() || null,
    startDate: String(formData.get("start_date") ?? "") || null,
    endDate: String(formData.get("end_date") ?? "") || null,
    clientId: String(formData.get("client_id") ?? "") || null,
    clientRequestNotes:
      String(formData.get("client_request_notes") ?? "").trim() || null,
    priceMode: String(formData.get("price_mode") ?? "nessuno"),
    priceAmount: formData.get("price_amount")
      ? Number(formData.get("price_amount"))
      : null,
    priceNet: formData.get("price_net")
      ? Number(formData.get("price_net"))
      : null,
    priceCommission: formData.get("price_commission")
      ? Number(formData.get("price_commission"))
      : null,
    itineraryMode: String(formData.get("itinerary_mode") ?? "activities"),
  });
  if ("error" in created) return created;

  // Con il team il viaggio nuovo lo segue chi l'ha creato (si cambia dalla pagina del viaggio)
  const team = await getTeamContext();
  if (team && (team.isMember || team.accountMode === "azienda")) {
    await supabase.from("trips").update({ assigned_to: user.id }).eq("id", created.id);
  }

  redirect(`/dashboard/trips/${created.id}`);
}

// Legge la mail/richiesta di un cliente (testo e/o foto) e la fa
// interpretare dall'AI, restituendo i dati suggeriti SENZA creare nulla:
// l'agente li rivede e corregge nel form prima di creare il viaggio.
export async function extractClientRequest(
  formData: FormData,
): Promise<{ data: ClientRequest } | { error: string }> {
  let text = String(formData.get("text") ?? "").trim();
  let image: DraftImage | null = null;

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.type.startsWith("image/")) {
      const validationError =
        validateImageFile(file) ?? (await verifyFileSignature(file));
      if (validationError) return { error: validationError };
      const buffer = Buffer.from(await file.arrayBuffer());
      image = {
        base64: buffer.toString("base64"),
        mediaType: ((await detectFileMime(file)) ??
          file.type) as DraftImage["mediaType"],
      };
    } else if (
      file.name.toLowerCase().endsWith(".txt") ||
      file.name.toLowerCase().endsWith(".md")
    ) {
      const validationError = validateTextFile(file);
      if (validationError) return { error: validationError };
      const buffer = Buffer.from(await file.arrayBuffer());
      text = [text, buffer.toString("utf-8")].filter(Boolean).join("\n\n");
    } else {
      return {
        error:
          "Formato non supportato: carica una foto (JPG/PNG) o un file di testo (.txt/.md).",
      };
    }
  }

  if (!text && !image) {
    return {
      error:
        "Incolla il testo della mail, oppure carica una foto o un file di testo.",
    };
  }
  if (text.length > MAX_DRAFT_CHARS)
    return { error: tooLongMessage(MAX_DRAFT_CHARS) };

  const quota = await reserveAiCall("client_request");
  if (!quota.ok) return { error: quota.error };

  try {
    const data = await extractClientRequestAi({ text, image });
    return { data };
  } catch {
    return {
      error:
        "Non sono riuscito a interpretare la richiesta. Riprova, o compila il viaggio a mano.",
    };
  }
}
