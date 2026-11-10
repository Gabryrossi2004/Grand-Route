"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, ClipboardList, Inbox, Mail, Pencil, Trash2 } from "lucide-react";
import type { PaymentDirection, Supplier, TripPayment, TripService } from "@/lib/types";
import { serviceStatusOptions, serviceStatuses } from "@/lib/serviceStatus";
import { formatEuro } from "@/lib/price";
import { parseSupplierReply } from "@/lib/replyParser";
import Modal from "@/components/Modal";
import SubmitButton from "@/components/SubmitButton";
import {
  addTripPayment,
  addTripService,
  deleteTripPayment,
  deleteTripService,
  toggleTripPaymentPaid,
  updateTripPayment,
  updateTripService,
} from "@/app/dashboard/trips/[id]/actions";

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
        <label htmlFor="service_title" className="mb-1 block text-sm font-medium text-slate-700">
          Servizio *
        </label>
        <input
          id="service_title"
          name="title"
          required
          defaultValue={service?.title ?? ""}
          placeholder="Es. Hotel Lotus - 3 notti"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="service_supplier_id" className="mb-1 block text-sm font-medium text-slate-700">
            Fornitore
          </label>
          <select
            id="service_supplier_id"
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
          <label htmlFor="service_status" className="mb-1 block text-sm font-medium text-slate-700">
            Stato
          </label>
          <select
            id="service_status"
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
          <label htmlFor="service_activity_id" className="mb-1 block text-sm font-medium text-slate-700">
            Collega a un&apos;attività dell&apos;itinerario (opzionale)
          </label>
          <select
            id="service_activity_id"
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
          <label htmlFor="service_net_cost" className="mb-1 block text-sm font-medium text-slate-700">
            Costo netto (€)
          </label>
          <input
            id="service_net_cost"
            name="net_cost"
            type="number"
            step="0.01"
            min="0"
            defaultValue={service?.net_cost ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </div>
        <div>
          <label htmlFor="service_confirmation_number" className="mb-1 block text-sm font-medium text-slate-700">
            Numero conferma
          </label>
          <input
            id="service_confirmation_number"
            name="confirmation_number"
            defaultValue={service?.confirmation_number ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </div>
      </div>

      <div>
        <label htmlFor="service_notes" className="mb-1 block text-sm font-medium text-slate-700">
          Note
        </label>
        <textarea
          id="service_notes"
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

function PaymentForm({
  tripId,
  payment,
  services,
  onDone,
}: {
  tripId: string;
  payment?: TripPayment;
  services: TripService[];
  onDone: () => void;
}) {
  const isEdit = Boolean(payment);
  const action = isEdit ? updateTripPayment.bind(null, tripId, payment!.id) : addTripPayment.bind(null, tripId);
  const router = useRouter();

  const [, dispatch, pending] = useActionState(async (_prevState: null, formData: FormData) => {
    await action(formData);
    router.refresh();
    onDone();
    return null;
  }, null);

  return (
    <form action={dispatch} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="payment_direction" className="mb-1 block text-sm font-medium text-slate-700">
            Tipo
          </label>
          <select
            id="payment_direction"
            name="direction"
            defaultValue={payment?.direction ?? "incasso"}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          >
            <option value="incasso">Incasso dal cliente</option>
            <option value="pagamento">Pagamento a un fornitore</option>
          </select>
        </div>
        <div>
          <label htmlFor="payment_amount" className="mb-1 block text-sm font-medium text-slate-700">
            Importo (€) *
          </label>
          <input
            id="payment_amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={payment?.amount ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </div>
      </div>

      {services.length > 0 && (
        <div>
          <label htmlFor="payment_service_id" className="mb-1 block text-sm font-medium text-slate-700">
            Collega a un servizio (opzionale)
          </label>
          <select
            id="payment_service_id"
            name="service_id"
            defaultValue={payment?.service_id ?? ""}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          >
            <option value="">Nessuno</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="payment_due_date" className="mb-1 block text-sm font-medium text-slate-700">
          Scadenza
        </label>
        <input
          id="payment_due_date"
          name="due_date"
          type="date"
          defaultValue={payment?.due_date ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        />
      </div>

      <div>
        <label htmlFor="payment_notes" className="mb-1 block text-sm font-medium text-slate-700">
          Note
        </label>
        <textarea
          id="payment_notes"
          name="notes"
          rows={2}
          defaultValue={payment?.notes ?? ""}
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
          {isEdit ? "Salva modifiche" : "Aggiungi scadenza"}
        </SubmitButton>
      </div>
    </form>
  );
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toLocaleDateString("it-IT");
}

// Costruisce il FormData completo per updateTripService partendo dal
// servizio esistente, con alcuni campi sovrascritti: serve perché l'azione
// aggiorna sempre tutti i campi insieme, e qui modifichiamo solo quelli che
// ci interessano (es. solo lo stato, oppure i dati estratti da una risposta).
function serviceToFormData(service: TripService, overrides: Record<string, string>) {
  const fd = new FormData();
  fd.set("title", service.title);
  fd.set("supplier_id", service.supplier_id ?? "");
  fd.set("activity_id", service.activity_id ?? "");
  fd.set("status", service.status);
  fd.set("net_cost", service.net_cost != null ? String(service.net_cost) : "");
  fd.set("confirmation_number", service.confirmation_number ?? "");
  fd.set("notes", service.notes ?? "");
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value);
  return fd;
}

function MailComposer({
  tripId,
  service,
  supplierEmail,
  onClose,
}: {
  tripId: string;
  service: TripService;
  supplierEmail: string;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(`Richiesta disponibilità: ${service.title}`);
  const [body, setBody] = useState(
    `Buongiorno,\n\nvorremmo verificare la disponibilità per il seguente servizio:\n\n${service.title}\n\nRestiamo in attesa di un vostro riscontro.\n\nCordiali saluti`,
  );
  const router = useRouter();

  const mailtoHref = `mailto:${encodeURIComponent(supplierEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function handleOpenMail() {
    if (service.status === "da_prenotare") {
      await updateTripService(tripId, service.id, serviceToFormData(service, { status: "richiesto" }));
      router.refresh();
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-[#cda876]/40 bg-[#faf3e6]/60 p-3">
      <p className="text-xs text-slate-500">
        Si aprirà la tua app di posta (Gmail, Outlook o quella che usi di solito), già pronta con questo testo: la
        invii tu, dal tuo indirizzo. A: <span className="font-medium text-slate-700">{supplierEmail}</span>
      </p>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
        >
          Chiudi
        </button>
        <a
          href={mailtoHref}
          onClick={handleOpenMail}
          className="rounded-md bg-[#2b333e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#1e242d]"
        >
          Apri nella tua email
        </a>
      </div>
    </div>
  );
}

function ReplyAnalyzer({
  tripId,
  service,
  onDone,
}: {
  tripId: string;
  service: TripService;
  onDone: () => void;
}) {
  const [rawText, setRawText] = useState("");
  const [analyzed, setAnalyzed] = useState(false);
  const [confirmationNumber, setConfirmationNumber] = useState(service.confirmation_number ?? "");
  const [amount, setAmount] = useState(service.net_cost != null ? String(service.net_cost) : "");
  const [status, setStatus] = useState(service.status);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  function analyze() {
    const result = parseSupplierReply(rawText);
    setConfirmationNumber(result.confirmationNumber ?? service.confirmation_number ?? "");
    setAmount(result.amount != null ? String(result.amount) : service.net_cost != null ? String(service.net_cost) : "");
    setStatus(result.suggestedStatus ?? service.status);
    setAnalyzed(true);
  }

  async function apply() {
    setPending(true);
    const stamp = new Date().toLocaleDateString("it-IT");
    const notes = service.notes
      ? `${service.notes}\n\n— Risposta fornitore (${stamp}) —\n${rawText}`
      : `— Risposta fornitore (${stamp}) —\n${rawText}`;
    await updateTripService(
      tripId,
      service.id,
      serviceToFormData(service, {
        confirmation_number: confirmationNumber,
        net_cost: amount,
        status,
        notes,
      }),
    );
    router.refresh();
    setPending(false);
    onDone();
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-[#cda876]/40 bg-[#faf3e6]/60 p-3">
      {!analyzed ? (
        <>
          <label className="text-sm font-medium text-slate-700">
            Incolla qui il testo della risposta del fornitore
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={5}
            placeholder="Es. Buongiorno, confermiamo la prenotazione. Numero conferma: ABC123. Totale: 250€..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onDone}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={analyze}
              disabled={!rawText.trim()}
              className="rounded-md bg-[#2b333e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#1e242d] disabled:opacity-60"
            >
              Analizza risposta
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            Questo è quello che ho trovato nel testo: controllalo e correggilo se serve prima di applicarlo al
            servizio. Il testo originale resta comunque salvato nelle note.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Numero di conferma</label>
              <input
                value={confirmationNumber}
                onChange={(e) => setConfirmationNumber(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Costo netto (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Stato del servizio</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TripService["status"])}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
            >
              {serviceStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAnalyzed(false)}
              disabled={pending}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60"
            >
              Indietro
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={pending}
              className="rounded-md bg-[#2b333e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#1e242d] disabled:opacity-60"
            >
              {pending ? "Applicazione…" : "Applica al servizio"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function TripServicesPanel({
  tripId,
  services,
  suppliers,
  payments,
  activityOptions,
}: {
  tripId: string;
  services: TripService[];
  suppliers: Supplier[];
  payments: TripPayment[];
  activityOptions: ActivityOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<"servizi" | "pagamenti">("servizi");
  const [serviceFormTarget, setServiceFormTarget] = useState<"new" | TripService | null>(null);
  const [paymentFormTarget, setPaymentFormTarget] = useState<"new" | TripPayment | null>(null);
  const [mailOpenId, setMailOpenId] = useState<string | null>(null);
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);

  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.full_name ?? null;
  const supplierEmail = (id: string | null) => suppliers.find((s) => s.id === id)?.email ?? null;
  const activityLabel = (id: string | null) => activityOptions.find((a) => a.id === id)?.label ?? null;
  const serviceTitle = (id: string | null) => services.find((s) => s.id === id)?.title ?? null;

  const sortedServices = [...services].sort((a, b) => a.service_order - b.service_order);
  const toBookCount = services.filter((s) => s.status === "da_prenotare" || s.status === "richiesto").length;

  const sortedPayments = [...payments].sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });
  const sumUnpaid = (direction: PaymentDirection) =>
    payments
      .filter((p) => p.direction === direction && !p.paid_date)
      .reduce((sum, p) => sum + p.amount, 0);
  const daIncassare = sumUnpaid("incasso");
  const daPagare = sumUnpaid("pagamento");

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
            Tieni traccia di cosa va prenotato con i fornitori e dei pagamenti di questo viaggio. Non è
            obbligatorio, e non viene mai mostrato al cliente.
          </p>

          <div className="mb-4 flex gap-1 border-b border-[#e6d7bb]">
            <button
              type="button"
              onClick={() => setTab("servizi")}
              className={`px-3 py-2 text-sm font-medium transition ${
                tab === "servizi"
                  ? "border-b-2 border-[#2b333e] text-[#2b333e]"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Servizi
            </button>
            <button
              type="button"
              onClick={() => setTab("pagamenti")}
              className={`px-3 py-2 text-sm font-medium transition ${
                tab === "pagamenti"
                  ? "border-b-2 border-[#2b333e] text-[#2b333e]"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Pagamenti e scadenze
            </button>
          </div>

          {tab === "servizi" && (
            <>
              {sortedServices.length === 0 && serviceFormTarget !== "new" && (
                <p className="mb-4 text-sm text-slate-400">Nessun servizio aggiunto ancora.</p>
              )}

              {sortedServices.length > 0 && (
                <ul className="mb-4 flex flex-col gap-2">
                  {sortedServices.map((service) => {
                    const meta = serviceStatuses[service.status];
                    const isEditingThis = serviceFormTarget !== "new" && serviceFormTarget?.id === service.id;
                    return (
                      <li key={service.id} className="rounded-lg border border-[#e6d7bb] p-3">
                        {isEditingThis ? (
                          <ServiceForm
                            tripId={tripId}
                            service={service}
                            suppliers={suppliers}
                            activityOptions={activityOptions}
                            onDone={() => setServiceFormTarget(null)}
                          />
                        ) : (
                          <>
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
                                  {supplierName(service.supplier_id) && (
                                    <span>Fornitore: {supplierName(service.supplier_id)}</span>
                                  )}
                                  {service.net_cost != null && <span>Costo netto: {formatEuro(service.net_cost)}</span>}
                                  {service.confirmation_number && <span>Conferma: {service.confirmation_number}</span>}
                                  {activityLabel(service.activity_id) && (
                                    <span>Collegato a: {activityLabel(service.activity_id)}</span>
                                  )}
                                </p>
                                {service.notes && (
                                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{service.notes}</p>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                {supplierEmail(service.supplier_id) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMailOpenId(mailOpenId === service.id ? null : service.id);
                                      setReplyOpenId(null);
                                    }}
                                    title="Invia richiesta via email"
                                    className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                                  >
                                    <Mail size={15} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyOpenId(replyOpenId === service.id ? null : service.id);
                                    setMailOpenId(null);
                                  }}
                                  title="Incolla la risposta del fornitore"
                                  className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                                >
                                  <Inbox size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setServiceFormTarget(service)}
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
                            {mailOpenId === service.id && (
                              <MailComposer
                                tripId={tripId}
                                service={service}
                                supplierEmail={supplierEmail(service.supplier_id)!}
                                onClose={() => setMailOpenId(null)}
                              />
                            )}
                            {replyOpenId === service.id && (
                              <ReplyAnalyzer tripId={tripId} service={service} onDone={() => setReplyOpenId(null)} />
                            )}
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {serviceFormTarget === "new" ? (
                <div className="rounded-lg border border-[#cda876]/40 bg-[#faf3e6]/60 p-3">
                  <ServiceForm
                    tripId={tripId}
                    suppliers={suppliers}
                    activityOptions={activityOptions}
                    onDone={() => setServiceFormTarget(null)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setServiceFormTarget("new")}
                  className="w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  + Nuovo servizio
                </button>
              )}

              {suppliers.length === 0 && (
                <p className="mt-4 text-xs text-slate-400">
                  Non hai ancora fornitori in rubrica: puoi comunque aggiungere un servizio senza collegarlo a
                  nessuno, o{" "}
                  <a href="/dashboard/suppliers" className="font-medium text-[#2b333e] hover:underline">
                    crearne uno
                  </a>
                  .
                </p>
              )}
            </>
          )}

          {tab === "pagamenti" && (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-green-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-green-700">Da incassare dal cliente</p>
                  <p className="text-lg font-semibold text-green-700">{formatEuro(daIncassare)}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Da pagare ai fornitori</p>
                  <p className="text-lg font-semibold text-amber-700">{formatEuro(daPagare)}</p>
                </div>
              </div>

              {sortedPayments.length === 0 && paymentFormTarget !== "new" && (
                <p className="mb-4 text-sm text-slate-400">Nessuna scadenza aggiunta ancora.</p>
              )}

              {sortedPayments.length > 0 && (
                <ul className="mb-4 flex flex-col gap-2">
                  {sortedPayments.map((payment) => {
                    const isEditingThis = paymentFormTarget !== "new" && paymentFormTarget?.id === payment.id;
                    const isIncasso = payment.direction === "incasso";
                    return (
                      <li key={payment.id} className="rounded-lg border border-[#e6d7bb] p-3">
                        {isEditingThis ? (
                          <PaymentForm
                            tripId={tripId}
                            payment={payment}
                            services={services}
                            onDone={() => setPaymentFormTarget(null)}
                          />
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-2">
                              <form action={toggleTripPaymentPaid.bind(null, tripId, payment.id, !payment.paid_date)}>
                                <button
                                  type="submit"
                                  title={payment.paid_date ? "Segna come non fatto" : isIncasso ? "Segna come incassato" : "Segna come pagato"}
                                  className="mt-0.5 shrink-0 text-slate-400 transition hover:text-[#2b333e]"
                                >
                                  {payment.paid_date ? (
                                    <CheckCircle2 size={18} className="text-green-600" />
                                  ) : (
                                    <Circle size={18} />
                                  )}
                                </button>
                              </form>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                      isIncasso ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                                    }`}
                                  >
                                    {isIncasso ? "Incasso cliente" : "Pagamento fornitore"}
                                  </span>
                                  <span className="font-medium text-slate-900">{formatEuro(payment.amount)}</span>
                                  {payment.paid_date && (
                                    <span className="text-xs text-green-600">
                                      {isIncasso ? "Incassato" : "Pagato"} il {formatDate(payment.paid_date)}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                                  {payment.due_date && <span>Scadenza: {formatDate(payment.due_date)}</span>}
                                  {serviceTitle(payment.service_id) && <span>Servizio: {serviceTitle(payment.service_id)}</span>}
                                </p>
                                {payment.notes && <p className="mt-1 text-sm text-slate-600">{payment.notes}</p>}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setPaymentFormTarget(payment)}
                                title="Modifica scadenza"
                                className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Pencil size={15} />
                              </button>
                              <form action={deleteTripPayment.bind(null, tripId, payment.id)}>
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

              {paymentFormTarget === "new" ? (
                <div className="rounded-lg border border-[#cda876]/40 bg-[#faf3e6]/60 p-3">
                  <PaymentForm
                    tripId={tripId}
                    services={services}
                    onDone={() => setPaymentFormTarget(null)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPaymentFormTarget("new")}
                  className="w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  + Nuova scadenza
                </button>
              )}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
