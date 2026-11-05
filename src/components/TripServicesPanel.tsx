"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Pencil, Trash2 } from "lucide-react";
import type { Supplier, TripService } from "@/lib/types";
import { serviceStatusOptions, serviceStatuses } from "@/lib/serviceStatus";
import { formatEuro } from "@/lib/price";
import Modal from "@/components/Modal";
import SubmitButton from "@/components/SubmitButton";
import { addTripService, deleteTripService, updateTripService } from "@/app/dashboard/trips/[id]/actions";

type ActivityOption = { id: string; label: string };

function ServiceForm({
  tripId,
  service,
  suppliers,
  activityOptions,
  onDone,
}: {
  tripId: string;
  service?: TripService;
  suppliers: Supplier[];
  activityOptions: ActivityOption[];
  onDone: () => void;
}) {
  const isEdit = Boolean(service);
  const action = isEdit ? updateTripService.bind(null, tripId, service!.id) : addTripService.bind(null, tripId);
  const router = useRouter();

  const [, dispatch, pending] = useActionState(async (_prevState: null, formData: FormData) => {
    await action(formData);
    router.refresh();
    onDone();
    return null;
  }, null);

  return (
    <form action={dispatch} className="flex flex-col gap-3">
      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700">
          Servizio *
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={service?.title ?? ""}
          placeholder="Es. Hotel Lotus - 3 notti"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="supplier_id" className="mb-1 block text-sm font-medium text-slate-700">
            Fornitore
          </label>
          <select
            id="supplier_id"
            name="supplier_id"
            defaultValue={service?.supplier_id ?? ""}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          >
            <option value="">Nessuno</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">
            Stato
          </label>
          <select
            id="status"
            name="status"
            defaultValue={service?.status ?? "da_prenotare"}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          >
            {serviceStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activityOptions.length > 0 && (
        <div>
          <label htmlFor="activity_id" className="mb-1 block text-sm font-medium text-slate-700">
            Collega a un&apos;attività dell&apos;itinerario (opzionale)
          </label>
          <select
            id="activity_id"
            name="activity_id"
            defaultValue={service?.activity_id ?? ""}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          >
            <option value="">Nessuna</option>
            {activityOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="net_cost" className="mb-1 block text-sm font-medium text-slate-700">
            Costo netto (€)
          </label>
          <input
            id="net_cost"
            name="net_cost"
            type="number"
            step="0.01"
            min="0"
            defaultValue={service?.net_cost ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </div>
        <div>
          <label htmlFor="confirmation_number" className="mb-1 block text-sm font-medium text-slate-700">
            Numero conferma
          </label>
          <input
            id="confirmation_number"
            name="confirmation_number"
            defaultValue={service?.confirmation_number ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-700">
          Note
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={service?.notes ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        />
      </div>

      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60"
        >
          Annulla
        </button>
        <SubmitButton
          pendingLabel={isEdit ? "Salvataggio…" : "Creazione…"}
          className="rounded-md bg-[#2b333e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#1e242d] disabled:opacity-60"
        >
          {isEdit ? "Salva modifiche" : "Aggiungi servizio"}
        </SubmitButton>
      </div>
    </form>
  );
}

export default function TripServicesPanel({
  tripId,
  services,
  suppliers,
  activityOptions,
}: {
  tripId: string;
  services: TripService[];
  suppliers: Supplier[];
  activityOptions: ActivityOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<"new" | TripService | null>(null);

  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.full_name ?? null;
  const activityLabel = (id: string | null) => activityOptions.find((a) => a.id === id)?.label ?? null;

  const sorted = [...services].sort((a, b) => a.service_order - b.service_order);
  const toBookCount = services.filter((s) => s.status === "da_prenotare" || s.status === "richiesto").length;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <ClipboardList size={15} />
        Servizi e fornitori
        {toBookCount > 0 && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
            {toBookCount}
          </span>
        )}
      </button>

      {isOpen && (
        <Modal title="Servizi e fornitori" onClose={() => setIsOpen(false)} wide>
          <p className="mb-4 -mt-2 text-sm text-slate-500">
            Tieni traccia di cosa va prenotato con i fornitori per questo viaggio. Non è obbligatorio, e non viene
            mai mostrato al cliente.
          </p>

          {sorted.length === 0 && formTarget !== "new" && (
            <p className="mb-4 text-sm text-slate-400">Nessun servizio aggiunto ancora.</p>
          )}

          {sorted.length > 0 && (
            <ul className="mb-4 flex flex-col gap-2">
              {sorted.map((service) => {
                const meta = serviceStatuses[service.status];
                const isEditingThis = formTarget !== "new" && formTarget?.id === service.id;
                return (
                  <li key={service.id} className="rounded-lg border border-slate-200 p-3">
                    {isEditingThis ? (
                      <ServiceForm
                        tripId={tripId}
                        service={service}
                        suppliers={suppliers}
                        activityOptions={activityOptions}
                        onDone={() => setFormTarget(null)}
                      />
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-900">{service.title}</span>
                            <span
                              style={{ color: meta.color, backgroundColor: meta.bg }}
                              className="rounded-full px-2 py-0.5 text-xs font-medium"
                            >
                              {meta.label}
                            </span>
                          </div>
                          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                            {supplierName(service.supplier_id) && <span>Fornitore: {supplierName(service.supplier_id)}</span>}
                            {service.net_cost != null && <span>Costo netto: {formatEuro(service.net_cost)}</span>}
                            {service.confirmation_number && <span>Conferma: {service.confirmation_number}</span>}
                            {activityLabel(service.activity_id) && <span>Collegato a: {activityLabel(service.activity_id)}</span>}
                          </p>
                          {service.notes && <p className="mt-1 text-sm text-slate-600">{service.notes}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setFormTarget(service)}
                            title="Modifica servizio"
                            className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil size={15} />
                          </button>
                          <form action={deleteTripService.bind(null, tripId, service.id)}>
                            <SubmitButton
                              pendingLabel="…"
                              className="rounded-md p-2 text-red-500 transition hover:bg-red-50 disabled:opacity-60"
                            >
                              <Trash2 size={15} />
                            </SubmitButton>
                          </form>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {formTarget === "new" ? (
            <div className="rounded-lg border border-[#cda876]/40 bg-[#faf3e6]/60 p-3">
              <ServiceForm
                tripId={tripId}
                suppliers={suppliers}
                activityOptions={activityOptions}
                onDone={() => setFormTarget(null)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFormTarget("new")}
              className="w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              + Nuovo servizio
            </button>
          )}

          {suppliers.length === 0 && (
            <p className="mt-4 text-xs text-slate-400">
              Non hai ancora fornitori in rubrica: puoi comunque aggiungere un servizio senza collegarlo a nessuno, o{" "}
              <a href="/dashboard/suppliers" className="font-medium text-[#2b333e] hover:underline">
                crearne uno
              </a>
              .
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
