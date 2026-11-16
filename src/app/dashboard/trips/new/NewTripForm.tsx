"use client";

import { useActionState, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { createTrip } from "./actions";
import type { Client, PriceMode, PromptStyle } from "@/lib/types";
import type { ClientRequest } from "@/lib/clientRequestAi";
import Modal from "@/components/Modal";
import ClientRequestExtractor from "./ClientRequestExtractor";
import AiNewTrip from "./AiNewTrip";
import DateField from "@/components/DateField";

export default function NewTripForm({ clients, promptStyles }: { clients: Client[]; promptStyles: PromptStyle[] }) {
  const [state, formAction, pending] = useActionState(createTrip, undefined);
  const [priceMode, setPriceMode] = useState<PriceMode>("nessuno");
  const [showExtractor, setShowExtractor] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const destinationRef = useRef<HTMLInputElement>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const clientSelectRef = useRef<HTMLSelectElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  function handleExtracted(data: ClientRequest) {
    if (titleRef.current) titleRef.current.value = data.suggested_title;
    if (destinationRef.current) destinationRef.current.value = data.destination ?? "";
    setStartDate(data.start_date ?? "");
    setEndDate(data.end_date ?? "");
    if (notesRef.current) notesRef.current.value = data.notes ?? "";

    // Se il nome estratto corrisponde (anche parzialmente) a un cliente già
    // in rubrica, lo preseleziona: l'agente può comunque cambiarlo.
    if (data.client_name && clientSelectRef.current) {
      const needle = data.client_name.trim().toLowerCase();
      const match = clients.find(
        (client) =>
          client.full_name.toLowerCase().includes(needle) || needle.includes(client.full_name.toLowerCase()),
      );
      if (match) clientSelectRef.current.value = match.id;
    }

    setShowExtractor(false);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowExtractor(true)}
          className="flex items-center gap-1.5 rounded-md border border-[#233c5e]/30 px-3 py-1.5 text-sm font-medium text-[#233c5e] hover:bg-[#233c5e]/5"
        >
          <Sparkles size={14} /> Parti da una richiesta
        </button>
        <AiNewTrip clients={clients} promptStyles={promptStyles} />
      </div>

      <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-[#e6d7bb] bg-white p-6">
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700">
            Titolo del viaggio *
          </label>
          <input
            ref={titleRef}
            id="title"
            name="title"
            type="text"
            required
            placeholder="Es. Luna di miele in Giappone"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </div>

        <div>
          <label htmlFor="destination" className="mb-1 block text-sm font-medium text-slate-700">
            Destinazione
          </label>
          <input
            ref={destinationRef}
            id="destination"
            name="destination"
            type="text"
            placeholder="Es. Giappone"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="start_date" className="mb-1 block text-sm font-medium text-slate-700">
              Data inizio
            </label>
            <DateField id="start_date" name="start_date" value={startDate} onChange={setStartDate} highlightFrom={startDate} highlightTo={endDate} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]" />
          </div>
          <div>
            <label htmlFor="end_date" className="mb-1 block text-sm font-medium text-slate-700">
              Data fine
            </label>
            <DateField id="end_date" name="end_date" value={endDate} onChange={setEndDate} openAt={startDate} highlightFrom={startDate} highlightTo={endDate} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]" />
          </div>
        </div>

        {clients.length > 0 && (
          <div>
            <label htmlFor="client_id" className="mb-1 block text-sm font-medium text-slate-700">
              Cliente collegato (opzionale)
            </label>
            <select
              ref={clientSelectRef}
              id="client_id"
              name="client_id"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
            >
              <option value="">Nessuno</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="client_request_notes" className="mb-1 block text-sm font-medium text-slate-700">
            Note sulla richiesta del cliente
          </label>
          <textarea
            ref={notesRef}
            id="client_request_notes"
            name="client_request_notes"
            rows={3}
            placeholder="Numero di persone, preferenze, budget, richieste particolari…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </div>

        <div className="rounded-md bg-slate-50 p-3">
          <label htmlFor="price_mode" className="mb-1 block text-sm font-medium text-slate-700">
            Come mostrare il prezzo al cliente
          </label>
          <select
            id="price_mode"
            name="price_mode"
            value={priceMode}
            onChange={(e) => setPriceMode(e.target.value as PriceMode)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          >
            <option value="nessuno">Senza costi (non mostrare nessun prezzo)</option>
            <option value="lordo">Prezzo lordo (un unico totale)</option>
            <option value="commissioni">Con commissioni esposte (costo + commissione separati)</option>
          </select>

          {priceMode === "lordo" && (
            <div className="mt-3">
              <label htmlFor="price_amount" className="mb-1 block text-xs font-medium text-slate-600">
                Prezzo totale (€)
              </label>
              <input
                id="price_amount"
                name="price_amount"
                type="number"
                step="0.01"
                min="0"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
              />
            </div>
          )}

          {priceMode === "commissioni" && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="price_net" className="mb-1 block text-xs font-medium text-slate-600">
                  Costo netto (€)
                </label>
                <input
                  id="price_net"
                  name="price_net"
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
                />
              </div>
              <div>
                <label htmlFor="price_commission" className="mb-1 block text-xs font-medium text-slate-600">
                  Tua commissione (€)
                </label>
                <input
                  id="price_commission"
                  name="price_commission"
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
                />
              </div>
            </div>
          )}
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 w-fit rounded-md bg-[#233c5e] px-4 py-2 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
        >
          {pending ? "Creazione…" : "Crea viaggio"}
        </button>
      </form>

      {showExtractor && (
        <Modal title="Compila da richiesta cliente" onClose={() => setShowExtractor(false)}>
          <ClientRequestExtractor onExtracted={handleExtracted} onCancel={() => setShowExtractor(false)} />
        </Modal>
      )}
    </>
  );
}
