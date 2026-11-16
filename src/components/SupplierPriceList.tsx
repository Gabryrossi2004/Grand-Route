"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import type { Supplier, SupplierCategory, SupplierPriceListItem } from "@/lib/types";
import { supplierCategories, supplierCategoryOptions } from "@/lib/serviceStatus";
import Modal from "@/components/Modal";
import SubmitButton from "@/components/SubmitButton";
import DropzoneUpload from "@/components/DropzoneUpload";
import {
  createPriceListItem,
  deletePriceListItem,
  extractPriceListFromFile,
  savePriceListItems,
  updatePriceListItem,
} from "@/app/dashboard/suppliers/actions";
import DateField from "@/components/DateField";

type ProposedItem = {
  category: SupplierCategory;
  title: string;
  description: string | null;
  price: number | null;
  unit: string | null;
  valid_from: string | null;
  valid_to: string | null;
  notes: string | null;
};

function formatValidity(item: SupplierPriceListItem) {
  if (!item.valid_from && !item.valid_to) return null;
  if (item.valid_from && item.valid_to) {
    return `${new Date(item.valid_from).toLocaleDateString("it-IT")} – ${new Date(item.valid_to).toLocaleDateString("it-IT")}`;
  }
  return item.valid_from
    ? `da ${new Date(item.valid_from).toLocaleDateString("it-IT")}`
    : `fino al ${new Date(item.valid_to!).toLocaleDateString("it-IT")}`;
}

function ItemForm({
  supplierId,
  item,
  onDone,
}: {
  supplierId: string;
  item?: SupplierPriceListItem;
  onDone: () => void;
}) {
  const isEdit = Boolean(item);
  const action = isEdit ? updatePriceListItem.bind(null, item!.id) : createPriceListItem.bind(null, supplierId);
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
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700">
            Nome servizio *
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={item?.title ?? ""}
            placeholder="Es. Camera doppia vista mare"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </div>
        <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium text-slate-700">
            Categoria
          </label>
          <select
            id="category"
            name="category"
            defaultValue={item?.category ?? "altro"}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          >
            {supplierCategoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">
          Descrizione
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={item?.description ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="price" className="mb-1 block text-sm font-medium text-slate-700">
            Prezzo (€)
          </label>
          <input
            id="price"
            name="price"
            type="number"
            step="0.01"
            defaultValue={item?.price ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </div>
        <div>
          <label htmlFor="unit" className="mb-1 block text-sm font-medium text-slate-700">
            Unità
          </label>
          <input
            id="unit"
            name="unit"
            placeholder="a notte, a persona…"
            defaultValue={item?.unit ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="valid_from" className="mb-1 block text-sm font-medium text-slate-700">
            Valido dal
          </label>
          <DateField id="valid_from" name="valid_from" defaultValue={item?.valid_from ?? ""} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]" />
        </div>
        <div>
          <label htmlFor="valid_to" className="mb-1 block text-sm font-medium text-slate-700">
            Valido al
          </label>
          <DateField id="valid_to" name="valid_to" defaultValue={item?.valid_to ?? ""} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]" />
        </div>
      </div>
      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-700">
          Note/condizioni
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={item?.notes ?? ""}
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
          pendingLabel={isEdit ? "Salvataggio…" : "Aggiunta…"}
          className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
        >
          {isEdit ? "Salva modifiche" : "Aggiungi voce"}
        </SubmitButton>
      </div>
    </form>
  );
}

// Carica un listino (Excel/CSV/testo): l'AI propone le voci, ma non viene
// salvato nulla finché l'agente non rivede e confirma — un'estrazione
// imprecisa non deve mai finire in rubrica senza controllo.
function ImportPanel({ supplierId, onSaved }: { supplierId: string; onSaved: () => void }) {
  const [proposed, setProposed] = useState<ProposedItem[] | null>(null);
  const [extractState, runExtract, extracting] = useActionState(
    async (_prev: { error: string | null }, formData: FormData) => {
      const result = await extractPriceListFromFile(formData);
      if ("error" in result) return { error: result.error };
      setProposed(result.items);
      return { error: null };
    },
    { error: null },
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!proposed || proposed.length === 0) return;
    setSaving(true);
    await savePriceListItems(supplierId, proposed);
    setSaving(false);
    setProposed(null);
    onSaved();
  }

  function updateProposed(index: number, patch: Partial<ProposedItem>) {
    setProposed((prev) => (prev ? prev.map((item, i) => (i === index ? { ...item, ...patch } : item)) : prev));
  }

  function removeProposed(index: number) {
    setProposed((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  if (proposed) {
    return (
      <div className="rounded-lg border border-[#e6d7bb] bg-[#faf7ee] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Sparkles size={14} className="text-[#cda876]" /> Voci trovate ({proposed.length}) — rivedi prima di
            salvare
          </h4>
          <button
            type="button"
            onClick={() => setProposed(null)}
            className="text-xs font-medium text-slate-500 hover:underline"
          >
            Annulla importazione
          </button>
        </div>
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {proposed.map((item, index) => (
            <div key={index} className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-2.5">
              <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-[1fr_auto_auto]">
                <input
                  value={item.title}
                  onChange={(e) => updateProposed(index, { title: e.target.value })}
                  className="min-w-0 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-[#cda876]"
                />
                <select
                  value={item.category}
                  onChange={(e) => updateProposed(index, { category: e.target.value as SupplierCategory })}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-[#cda876]"
                >
                  {supplierCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={item.price ?? ""}
                  onChange={(e) => updateProposed(index, { price: e.target.value ? Number(e.target.value) : null })}
                  placeholder="Prezzo €"
                  className="w-24 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-[#cda876]"
                />
              </div>
              <button
                type="button"
                onClick={() => removeProposed(index)}
                title="Rimuovi questa voce"
                className="shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-500"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || proposed.length === 0}
            className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
          >
            {saving ? "Salvataggio…" : `Salva ${proposed.length} voci`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={runExtract} className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
      <h4 className="mb-2 text-sm font-semibold text-slate-700">Importa da file</h4>
      <DropzoneUpload name="file" accept=".xlsx,.csv,.txt,.md" label="Carica il listino (Excel, CSV o testo)" autoSubmit={false} />
      {extractState.error && <p className="mt-2 text-sm text-red-600">{extractState.error}</p>}
      <div className="mt-3 flex justify-end">
        <SubmitButton
          pendingLabel="Leggo il listino…"
          className="flex items-center gap-1.5 rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
        >
          <Sparkles size={14} /> Leggi il listino con l&apos;AI
        </SubmitButton>
      </div>
      {extracting && <p className="mt-1 text-xs text-slate-500">Può richiedere qualche secondo…</p>}
    </form>
  );
}

export default function SupplierPriceList({
  supplier,
  items,
  onClose,
}: {
  supplier: Supplier;
  items: SupplierPriceListItem[];
  onClose: () => void;
}) {
  const [itemModal, setItemModal] = useState<"new" | SupplierPriceListItem | null>(null);
  const router = useRouter();

  return (
    <Modal title={`Listino: ${supplier.full_name}`} onClose={onClose} wide>
      <div className="flex flex-col gap-5">
        <ImportPanel supplierId={supplier.id} onSaved={() => router.refresh()} />

        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">Voci in listino ({items.length})</h4>
          <button
            type="button"
            onClick={() => setItemModal("new")}
            className="flex items-center gap-1 rounded-md border border-[#233c5e]/30 px-3 py-1.5 text-xs font-medium text-[#233c5e] hover:bg-[#233c5e]/5"
          >
            <Plus size={13} /> Aggiungi manualmente
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Nessuna voce in listino: importa un file o aggiungine una a mano.</p>
        ) : (
          <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-[#e6d7bb] bg-white">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      {supplierCategories[item.category]}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {[
                      item.price != null ? `€${item.price.toFixed(2)}${item.unit ? ` ${item.unit}` : ""}` : null,
                      formatValidity(item),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setItemModal(item)}
                    title="Modifica voce"
                    className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Pencil size={14} />
                  </button>
                  <form action={deletePriceListItem.bind(null, item.id)}>
                    <SubmitButton
                      pendingLabel="…"
                      className="rounded-md p-2 text-red-500 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 size={14} />
                    </SubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {itemModal && (
        <Modal
          title={itemModal === "new" ? "Nuova voce di listino" : `Modifica: ${itemModal.title}`}
          onClose={() => setItemModal(null)}
        >
          <ItemForm
            supplierId={supplier.id}
            item={itemModal === "new" ? undefined : itemModal}
            onDone={() => setItemModal(null)}
          />
        </Modal>
      )}
    </Modal>
  );
}
