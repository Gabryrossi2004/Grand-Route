// Modelli di messaggio pronti, compilati con i dati del viaggio: nessuna AI, quindi gratis e immediati.
// L'agenzia li rilegge e li modifica prima di inviarli.

import { ENTRY_REQUIREMENTS, ID_CARD_OK } from "@/data/entryRequirements";
import { librarySheet } from "@/lib/countrySheetLibrary";
import type { Activity, Trip, TripDay, TripPayment } from "@/lib/types";

export type TemplateKind = "conferma" | "pagamento" | "documenti" | "valigia" | "buonviaggio" | "bentornato";

export const TEMPLATE_KINDS: { id: TemplateKind; label: string }[] = [
  { id: "conferma", label: "Conferma" },
  { id: "pagamento", label: "Sollecito pagamento" },
  { id: "documenti", label: "Documenti e visti" },
  { id: "valigia", label: "Lista per la partenza" },
  { id: "buonviaggio", label: "Buon viaggio" },
  { id: "bentornato", label: "Bentornato" },
];

type Ctx = {
  trip: Trip & { countries?: string[] | null; auto_countries?: string[] | null };
  days: (TripDay & { activities: Activity[] })[];
  payments: TripPayment[];
  clientName: string | null;
  agencyName: string;
  emergencyPhone: string | null;
  formal: boolean; // true = Lei
};

const regionName = new Intl.DisplayNames(["it"], { type: "region" });
const longDate = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
const euro = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

export function buildTemplate(kind: TemplateKind, ctx: Ctx): string {
  const { trip, formal } = ctx;
  const first = (ctx.clientName ?? "").trim().split(/\s+/)[0] ?? "";
  const hello = first ? (formal ? `Gentile ${ctx.clientName},` : `Ciao ${first},`) : formal ? "Gentile cliente," : "Ciao,";
  const you = (lei: string, tu: string) => (formal ? lei : tu);
  const sign = `\n\nUn caro saluto,\n${ctx.agencyName}`;
  const when = trip.start_date ? ` dal ${longDate(trip.start_date)}${trip.end_date ? ` al ${longDate(trip.end_date)}` : ""}` : "";
  const countries = [...new Set([...(trip.countries ?? []), ...(trip.auto_countries ?? [])])];

  switch (kind) {
    case "conferma":
      return `${hello}\n\n${you("le confermiamo", "ti confermiamo")} il viaggio «${trip.title}»${when}.\n${you("Nella sua area riservata trova", "Nella tua area riservata trovi")} il programma giorno per giorno, i documenti di viaggio e il riepilogo dei pagamenti, sempre aggiornati.\n\n${you("Per qualsiasi domanda può scriverci", "Per qualsiasi domanda scrivici")} direttamente da lì.${sign}`;

    case "pagamento": {
      const open = ctx.payments
        .filter((p) => p.direction === "incasso" && !p.paid_date)
        .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
      if (open.length === 0) return `${hello}\n\n${you("le confermiamo", "ti confermiamo")} che per «${trip.title}» risultano saldati tutti i pagamenti. Grazie!${sign}`;
      const lines = open.map((p) => `• ${euro(Number(p.amount))}${p.due_date ? ` entro ${longDate(p.due_date)}` : ""}`).join("\n");
      return `${hello}\n\n${you("le ricordiamo", "ti ricordiamo")} i prossimi pagamenti per il viaggio «${trip.title}»:\n${lines}\n\n${you("Se ha già provveduto, non tenga conto di questo messaggio.", "Se hai già provveduto, non tenere conto di questo messaggio.")}${sign}`;
    }

    case "documenti": {
      const needsPassport = countries.some((c) => !ID_CARD_OK.has(c));
      const rows: string[] = [];
      rows.push(
        needsPassport
          ? `• Passaporto valido almeno 6 mesi oltre la data di rientro${trip.end_date ? ` (quindi oltre il ${longDate(addMonths(trip.end_date, 6))})` : ""}.`
          : "• Carta d'identità valida per l'espatrio o passaporto.",
      );
      for (const c of countries) {
        const r = ENTRY_REQUIREMENTS[c];
        if (r) rows.push(`• ${regionName.of(c) ?? c}: ${r.doc} — ${r.how}. Da richiedere almeno ${r.days} giorni prima della partenza.`);
      }
      rows.push("• Tessera sanitaria e assicurazione di viaggio.");
      rows.push("• Per i minori: documento personale e, se viaggiano con un solo genitore, i documenti richiesti dal paese.");
      return `${hello}\n\nin vista della partenza per «${trip.title}» ${you("le riassumiamo", "ti riassumiamo")} i documenti necessari:\n${rows.join("\n")}\n\nLe regole possono cambiare: ${you("le consigliamo", "ti consigliamo")} di verificarle anche su viaggiaresicuri.it. ${you("Se ha dubbi ci scriva pure.", "Se hai dubbi scrivici pure.")}${sign}`;
    }

    case "valigia": {
      const parts: string[] = [];
      for (const c of countries.slice(0, 3)) {
        const s = librarySheet(c)?.content;
        if (!s) continue;
        parts.push(
          [
            `${regionName.of(c) ?? c}:`,
            `• Prese elettriche: ${s.facts.plugs}`,
            `• Moneta: ${s.facts.currency}`,
            `• Fuso orario: ${s.facts.timezone}`,
            `• Clima: ${s.facts.climate}`,
          ].join("\n"),
        );
      }
      const base = [
        "• Documenti (e una copia digitale sul telefono)",
        "• Carta di credito e un po' di contanti",
        "• Caricabatterie, adattatore per le prese e power bank",
        "• Farmaci personali nel bagaglio a mano",
        "• Abbigliamento adatto al clima e scarpe comode",
      ];
      return `${hello}\n\necco una piccola lista per preparare la valigia per «${trip.title}»:\n${base.join("\n")}${parts.length ? `\n\nUtile da sapere:\n${parts.join("\n\n")}` : ""}\n\nBuona preparazione!${sign}`;
    }

    case "buonviaggio": {
      const flight = ctx.days
        .flatMap((d) => d.activities.map((a) => ({ a, date: d.day_date })))
        .find(({ a }) => a.activity_type === "volo");
      const det = flight?.a.details ?? {};
      const flightLine = flight
        ? `\nIl primo volo: ${flight.a.title}${det.numero_volo ? ` (${[det.compagnia, det.numero_volo].filter(Boolean).join(" ")})` : ""}${flight.date ? `, ${longDate(flight.date)}` : ""}${flight.a.start_time ? ` alle ${flight.a.start_time.slice(0, 5)}` : ""}.`
        : "";
      const phone = ctx.emergencyPhone ? `\nPer qualsiasi urgenza durante il viaggio ${you("può chiamarci", "chiamaci")} al ${ctx.emergencyPhone}.` : "";
      return `${hello}\n\nci siamo: ${you("le auguriamo", "ti auguriamo")} buon viaggio per «${trip.title}»!${flightLine}\n${you("Nella sua area trova", "Nella tua area trovi")} programma, documenti e contatti, anche senza connessione.${phone}${sign}`;
    }

    case "bentornato":
      return `${hello}\n\nbentornato/a! Speriamo che «${trip.title}» sia stato un viaggio indimenticabile.\n${you("Ci farebbe piacere sapere com'è andata: le basta rispondere a questo messaggio.", "Ci farebbe piacere sapere com'è andata: ti basta rispondere a questo messaggio.")} E se ${you("ha", "hai")} un minuto, una recensione ci aiuta molto.\n\nQuando ${you("vorrà", "vorrai")} pensare al prossimo viaggio, siamo qui.${sign}`;
  }
}

function addMonths(iso: string, months: number) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
