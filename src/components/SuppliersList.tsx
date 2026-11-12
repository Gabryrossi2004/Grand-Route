"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Pencil, Search, Trash2 } from "lucide-react";
import type { Supplier, SupplierCategory, SupplierPriceListItem } from "@/lib/types";
import { supplierCategories, supplierCategoryOptions } from "@/lib/serviceStatus";
import Modal from "@/components/Modal";
import SubmitButton from "@/components/SubmitButton";
import SupplierPriceList from "@/components/SupplierPriceList";
import { createSupplier, deleteSupplier, updateSupplier } from "@/app/dashboard/suppliers/actions";

function SupplierForm({ supplier, onDone }: { supplier?: Supplier; onDone: () => void }) {
  const isEdit = Boolean(supplier);
  const action = isEdit ? updateSupplier.bind(null, supplier!.id) : createSupplier;
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
        <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-slate-700">
          Nome fornitore *
        </label>
        <input
          id="full_name"
          name="full_name"
          required
          defaultValue={supplier?.full_name ?? ""}
          placeholder="Es. Hotel Lotus, Transfer Express..."
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
          defaultValue={supplier?.category ?? "altro"}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        >
          {supplierCategoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={supplier?.email ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700">
            Telefono
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={supplier?.phone ?? ""}
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
          defaultValue={supplier?.notes ?? ""}
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
          className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
        >
          {isEdit ? "Salva modifiche" : "Aggiungi fornitore"}
        </SubmitButton>
      </div>
    </form>
  );
}

export default function SuppliersList({
  suppliers,
  itemsBySupplier,
}: {
  suppliers: Supplier[];
  itemsBySupplier: Record<string, SupplierPriceListItem[]>;
}) {
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<"new" | Supplier | null>(null);
  const [priceListSupplier, setPriceListSupplier] = useState<Supplier | null>(null);

  const filtered = suppliers.filter((supplier) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const haystack = `${supplier.full_name} ${supplier.email ?? ""} ${supplier.phone ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {suppliers.length > 0 && (
          <div className="relative w-full max-w-sm">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca per nome, email o telefono…"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => setModal("new")}
          className="shrink-0 rounded-md bg-[#233c5e] px-4 py-2 text-sm font-medium text-white hover:bg-[#17283f]"
        >
          + Nuovo fornitore
        </button>
      </div>

      {suppliers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-500">Non hai ancora nessun fornitore in rubrica.</p>
          <p className="mt-1 text-sm text-slate-400">
            Hotel, compagnie di trasporto, guide: aggiungili qui per collegarli ai servizi dei tuoi viaggi.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400">Nessun fornitore corrisponde alla ricerca.</p>
      ) : (
        <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-[#e6d7bb] bg-white">
          {filtered.map((supplier) => (
            <div key={supplier.id} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-slate-900">{supplier.full_name}</p>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    {supplierCategories[supplier.category as SupplierCategory]}
                  </span>
                </div>
                {(supplier.email || supplier.phone) && (
                  <p className="truncate text-sm text-slate-500">
                    {[supplier.email, supplier.phone].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPriceListSupplier(supplier)}
                  title="Listino prezzi"
                  className="flex items-center gap-1 rounded-md px-2 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <ClipboardList size={15} />
                  {(itemsBySupplier[supplier.id]?.length ?? 0) > 0 && (
                    <span className="rounded-full bg-[#f2e2c4] px-1.5 text-[10px] font-semibold text-[#8c7a5e]">
                      {itemsBySupplier[supplier.id].length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(supplier)}
                  title="Modifica fornitore"
                  className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <Pencil size={15} />
                </button>
                <form action={deleteSupplier.bind(null, supplier.id)}>
                  <SubmitButton
                    pendingLabel="…"
                    className="rounded-md p-2 text-red-500 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    <Trash2 size={15} />
                  </SubmitButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal
          title={modal === "new" ? "Nuovo fornitore" : `Modifica: ${modal.full_name}`}
          onClose={() => setModal(null)}
        >
          <SupplierForm supplier={modal === "new" ? undefined : modal} onDone={() => setModal(null)} />
        </Modal>
      )}

      {priceListSupplier && (
        <SupplierPriceList
          supplier={priceListSupplier}
          items={itemsBySupplier[priceListSupplier.id] ?? []}
          onClose={() => setPriceListSupplier(null)}
        />
      )}
    </div>
  );
}
