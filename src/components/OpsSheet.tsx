"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  MoreVertical,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { createOpsRow, deleteOpsRow, importOpsFromTrips, updateOpsRow } from "@/lib/actions/opsSheet";
import {
  OPS_COLOR_STYLE,
  OPS_COLORS,
  OPS_COLUMNS,
  isoDate,
  normalizeTripCode,
  opsTimeMinutes,
  parseIsoDate,
  type OpsColor,
  type OpsColumn,
  type OpsRow,
  type OpsTextKey,
  type OpsTripRef,
  type OpsView,
} from "@/lib/opsSheet";

type Props = {
  initialRows: OpsRow[];
  view: OpsView;
  anchor: string;
  from: string;
  to: string;
  today: string;
  trip: OpsTripRef | null;
  missingCode: string | null;
  trips: OpsTripRef[];
  importEnabled: boolean;
  suppliers: { name: string; phone: string }[];
  clientNames: string[];
  suggestions: { client: string[]; agent: string[]; supplier: string[]; responsible: string[] };
};

type ColKey = OpsColumn["key"];
type Filters = { client: string; agent: string; supplier: string; responsible: string; day: string; color: string };
const NO_FILTERS: Filters = { client: "", agent: "", supplier: "", responsible: "", day: "", color: "" };
const MENU_W = 30;
const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const norm = (s: string) => s.trim().toLocaleLowerCase("it");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dayLabel = (iso: string) => cap(parseIsoDate(iso).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }));
const shortDate = (iso: string) => parseIsoDate(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
const shiftDays = (iso: string, n: number) => {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
};
const shiftMonths = (iso: string, n: number) => {
  const d = parseIsoDate(iso);
  return isoDate(new Date(d.getFullYear(), d.getMonth() + n, 1));
};

function periodLabel(view: OpsView, from: string, to: string) {
  const f = parseIsoDate(from);
  if (view === "mese") return cap(f.toLocaleDateString("it-IT", { month: "long", year: "numeric" }));
  if (view === "giorno") return cap(f.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  const t = parseIsoDate(to);
  const sameMonth = f.getMonth() === t.getMonth();
  return `${f.toLocaleDateString("it-IT", sameMonth ? { day: "numeric" } : { day: "numeric", month: "long" })} – ${t.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}`;
}

function sortRows(a: OpsRow, b: OpsRow, mode: "cliente" | "orario", fresh: Set<string>) {
  // le righe appena aggiunte restano in fondo al loro giorno finché si lavora, così non "saltano" mentre le compili
  const fa = fresh.has(a.id) ? 1 : 0;
  const fb = fresh.has(b.id) ? 1 : 0;
  if (fa !== fb) return fa - fb;
  if (fa && fb) return a.created_at.localeCompare(b.created_at);
  const ta = a.meeting_time.trim() ? (opsTimeMinutes(a.meeting_time) ?? -1) : 24 * 60;
  const tb = b.meeting_time.trim() ? (opsTimeMinutes(b.meeting_time) ?? -1) : 24 * 60;
  const byClient = a.client.localeCompare(b.client, "it", { sensitivity: "base" });
  if (mode === "cliente") return byClient || ta - tb || a.created_at.localeCompare(b.created_at);
  return ta - tb || byClient || a.created_at.localeCompare(b.created_at);
}

// colonne che restano ferme scorrendo di lato: la data sempre, codice e cliente sugli schermi larghi
const STICKY_TD: Record<number, string> = { 0: "sticky left-[30px] z-10", 1: "relative lg:sticky lg:left-[94px] lg:z-10", 2: "relative lg:sticky lg:left-[180px] lg:z-10" };
const STICKY_TH: Record<number, string> = { 0: "left-[30px] z-30", 1: "z-20 lg:left-[94px] lg:z-30", 2: "z-20 lg:left-[180px] lg:z-30" };

export default function OpsSheet({ initialRows, view, anchor, from, to, today, trip, missingCode, trips, importEnabled, suppliers, clientNames, suggestions }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<OpsRow[]>(initialRows);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<{ id: string; key: ColKey; token: number; selectAll?: boolean } | null>(null);
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sortMode, setSortMode] = useState<"cliente" | "orario">("cliente");
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<OpsRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importAll, setImportAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const editToken = useRef(0);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (v: OpsView, d: string) => router.push(`/dashboard/operativo?v=${v}&d=${d}`);
  const openTrip = (code: string) => router.push(`/dashboard/operativo?codice=${code}`);
  const searchCode = normalizeTripCode(search);
  const codeMatch = searchCode.length === 6 && searchCode !== trip?.code ? trips.find((t) => t.code === searchCode) : undefined;
  const step = (dir: 1 | -1) => go(view, view === "mese" ? shiftMonths(anchor, dir) : shiftDays(anchor, dir * (view === "settimana" ? 7 : 1)));
  const anchorYear = parseIsoDate(anchor).getFullYear();
  const anchorMonth = parseIsoDate(anchor).getMonth();
  const tomorrow = shiftDays(today, 1);

  // ── Suggerimenti per le celle (clienti, fornitori, agenti, responsabili già usati) ──
  const options = useMemo(() => {
    const set = (base: string[], key: OpsTextKey) =>
      [...new Set([...base, ...rows.map((r) => r[key])].map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "it"));
    return {
      client: set([...clientNames, ...suggestions.client], "client"),
      agent: set(suggestions.agent, "agent"),
      supplier: set([...suppliers.map((s) => s.name), ...suggestions.supplier], "supplier"),
      responsible: set(suggestions.responsible, "responsible"),
    };
  }, [rows, clientNames, suppliers, suggestions]);

  const filterOptions = useMemo(() => {
    const vals = (key: OpsTextKey) => [...new Set(rows.map((r) => r[key].trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "it"));
    return {
      client: vals("client"),
      agent: vals("agent"),
      supplier: vals("supplier"),
      responsible: vals("responsible"),
      day: [...new Set(rows.map((r) => r.service_date))].sort(),
    };
  }, [rows]);

  const visible = useMemo(() => {
    const q = norm(search);
    return rows.filter((r) => {
      if (q) {
        const hay = norm(
          [shortDate(r.service_date), r.trip_code, r.client, r.agent, r.supplier, r.supplier_contact, r.pax, r.service, r.meeting_time, r.meeting_point, r.notes, r.responsible].join(" "),
        );
        if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      for (const k of ["client", "agent", "supplier", "responsible"] as const) if (filters[k] && norm(r[k]) !== norm(filters[k])) return false;
      if (filters.day && r.service_date !== filters.day) return false;
      if (filters.color) {
        const colors = [r.row_color, ...Object.values(r.cell_colors ?? {})].filter(Boolean);
        if (filters.color === "evidenziate" ? colors.length === 0 : !colors.includes(filters.color as OpsColor)) return false;
      }
      return true;
    });
  }, [rows, search, filters]);

  const groups = useMemo(() => {
    const byDay = new Map<string, OpsRow[]>();
    for (const r of visible) byDay.set(r.service_date, [...(byDay.get(r.service_date) ?? []), r]);
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => ({ day, rows: list.sort((a, b) => sortRows(a, b, sortMode, fresh)) }));
  }, [visible, sortMode, fresh]);

  const activeFilters = search.trim() !== "" || Object.values(filters).some(Boolean);

  // ── Salvataggi ──
  function patchLocal(id: string, patch: Partial<OpsRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function save(id: string, patch: Partial<OpsRow>) {
    const before = rows.find((r) => r.id === id);
    if (!before) return;
    patchLocal(id, patch);
    const res = await updateOpsRow(id, patch);
    if (!res.ok) {
      const revert = Object.fromEntries(Object.keys(patch).map((k) => [k, before[k as keyof OpsRow]])) as Partial<OpsRow>;
      patchLocal(id, revert);
      setError(res.error);
    }
  }

  function startEdit(id: string, key: ColKey, selectAll = false) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    editToken.current = Math.abs(editToken.current) + 1;
    setMenu(null);
    setEditing({ id, key, token: editToken.current, selectAll });
    setDraft(row[key] ?? "");
  }

  function commit(next?: { id: string; key: ColKey } | null, selectNext = true) {
    if (!editing || editing.token !== editToken.current) return;
    editToken.current = -editToken.current; // una sola conferma per ogni modifica
    const row = rows.find((r) => r.id === editing.id);
    const value = editing.key === "service_date" ? draft : draft.replace(/\s+$/, "");
    if (row && value !== row[editing.key] && !(editing.key === "service_date" && !/^\d{4}-\d{2}-\d{2}$/.test(value))) {
      const patch: Partial<OpsRow> = { [editing.key]: editing.key === "trip_code" ? normalizeTripCode(value) : value };
      // codice di un viaggio: la riga si collega al viaggio e prende il cliente se manca
      if (editing.key === "trip_code") {
        const t = trips.find((x) => x.code === patch.trip_code);
        if (t) {
          patch.trip_id = t.id;
          if (!row.client.trim()) patch.client = t.client || t.title;
        }
      }
      // fornitore dalla rubrica: il contatto si compila da solo se vuoto
      if (editing.key === "supplier" && !row.supplier_contact.trim()) {
        const s = suppliers.find((x) => norm(x.name) === norm(value));
        if (s?.phone) patch.supplier_contact = s.phone;
      }
      void save(row.id, patch);
    }
    if (next) startEdit(next.id, next.key, selectNext);
    else setEditing(null);
  }

  function cancelEdit() {
    editToken.current = -editToken.current;
    setEditing(null);
  }

  function onEditorKey(e: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (!editing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      commit(null);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const idx = OPS_COLUMNS.findIndex((c) => c.key === editing.key) + (e.shiftKey ? -1 : 1);
      const col = OPS_COLUMNS[idx];
      commit(col ? { id: editing.id, key: col.key } : null);
    }
  }

  function setCellColor(id: string, key: OpsTextKey, color: OpsColor | null) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const cell_colors = { ...(row.cell_colors ?? {}) };
    if (color) cell_colors[key] = color;
    else delete cell_colors[key];
    void save(id, { cell_colors });
  }

  function defaultDate() {
    if (filters.day) return filters.day;
    if (view === "viaggio") return groups[groups.length - 1]?.day ?? from;
    return today >= from && today <= to ? today : from;
  }

  async function addRow(date: string, copy?: OpsRow) {
    const id = crypto.randomUUID();
    const base: OpsRow = copy
      ? { ...copy, id, trip_id: copy.trip_id, activity_id: null, created_at: new Date().toISOString() }
      : {
          id,
          service_date: date,
          trip_code: trip?.code ?? "",
          client: filters.client || trip?.client || "",
          agent: filters.agent,
          supplier: filters.supplier,
          supplier_contact: "",
          pax: "",
          service: "",
          meeting_time: "",
          meeting_point: "",
          notes: "",
          responsible: filters.responsible,
          row_color: null,
          cell_colors: {},
          trip_id: trip?.id ?? null,
          activity_id: null,
          created_at: new Date().toISOString(),
        };
    setRows((prev) => [...prev, base]);
    setFresh((prev) => new Set(prev).add(id));
    setMenu(null);
    if (!copy) {
      editToken.current = Math.abs(editToken.current) + 1;
      setEditing({ id, key: "client", token: editToken.current });
      setDraft(base.client);
    }
    const { created_at: _c, ...payload } = base;
    void _c;
    const res = await createOpsRow(payload);
    if (!res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      setEditing((e) => (e?.id === id ? null : e));
      setError(res.error);
    }
  }

  async function removeRow(row: OpsRow) {
    setMenu(null);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    const res = await deleteOpsRow(row.id);
    if (!res.ok) {
      setRows((prev) => [...prev, row]);
      setError(res.error);
      return;
    }
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(row);
    undoTimer.current = setTimeout(() => setUndo(null), 7000);
  }

  async function restore() {
    const row = undo;
    if (!row) return;
    setUndo(null);
    setRows((prev) => [...prev, row]);
    const { created_at: _c, ...payload } = row;
    void _c;
    const res = await createOpsRow(payload);
    if (!res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setError(res.error);
    }
  }

  async function runImport() {
    setImporting(true);
    setImportMsg(null);
    const res = await importOpsFromTrips(from, to, importAll, trip?.id);
    setImporting(false);
    if (!res.ok) {
      setImportMsg(res.error);
      return;
    }
    setRows((prev) => [...prev, ...res.rows]);
    setImportMsg(
      res.rows.length === 0
        ? res.skipped > 0
          ? "Nessuna novità: i servizi di questo periodo sono già tutti nella scheda."
          : importAll
            ? "Non ho trovato servizi negli itinerari di questo periodo."
            : "Non ho trovato servizi nei viaggi confermati di questo periodo. Puoi includere anche quelli non confermati."
        : `Aggiunte ${res.rows.length} ${res.rows.length === 1 ? "riga" : "righe"}${res.skipped ? ` (${res.skipped} già presenti, non toccate)` : ""}.`,
    );
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(periodLabel(view, from, to).slice(0, 31).replace(/[\\/?*[\]:]/g, "-"), {
        views: [{ state: "frozen", ySplit: 1 }],
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
      });
      ws.columns = OPS_COLUMNS.map((c) => ({ header: c.label.toUpperCase(), key: c.key, width: Math.max(8, Math.round(c.width / 7)) }));
      const head = ws.getRow(1);
      head.font = { bold: true, color: { argb: "FFFFFFFF" } };
      head.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      head.height = 30;
      head.eachCell((cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF233C5E" } }));
      for (const g of groups) {
        for (const r of g.rows) {
          const line = ws.addRow({ ...r, service_date: shortDate(r.service_date) });
          line.alignment = { vertical: "top", wrapText: true };
          OPS_COLUMNS.forEach((c, i) => {
            const cell = line.getCell(i + 1);
            const cellColor = c.key !== "service_date" ? r.cell_colors?.[c.key] : undefined;
            const argb = cellColor ? OPS_COLOR_STYLE[cellColor].excelCell : r.row_color ? OPS_COLOR_STYLE[r.row_color].excelRow : null;
            if (argb) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
            cell.border = { bottom: { style: "thin", color: { argb: "FFD9D9D9" } }, right: { style: "thin", color: { argb: "FFD9D9D9" } } };
          });
        }
      }
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `operativo-${from}${from !== to ? `_${to}` : ""}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      console.error(e);
      setError("Non sono riuscito a creare il file Excel. Riprova.");
    } finally {
      setExporting(false);
    }
  }

  // chiude il menù della riga cliccando fuori, scorrendo o con Esc
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const tableWidth = MENU_W + OPS_COLUMNS.reduce((s, c) => s + c.width, 0);
  const menuRow = menu ? rows.find((r) => r.id === menu.id) : null;
  const selectCls = "h-9 w-[calc(50%-4px)] rounded-lg border border-[#e6d7bb] bg-white px-2 text-sm text-[#233c5e] sm:w-auto sm:max-w-[11rem]";

  return (
    <div className="flex flex-col gap-4" style={{ width: "calc(100vw - 32px)", marginLeft: "calc(50% - 50vw + 16px)" }}>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body * { visibility: hidden !important; }
          #ops-print, #ops-print * { visibility: visible !important; }
          #ops-print { position: absolute; left: 0; top: 0; width: auto !important; }
          #ops-print .ops-scroll { max-height: none !important; overflow: visible !important; border: 0 !important; }
          #ops-print table { zoom: 0.56; }
          #ops-print .ops-noprint { display: none !important; }
          #ops-print td, #ops-print th { position: static !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* ── Intestazione ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Operativo day by day</h1>
          <p className="text-sm text-slate-500">Tutti i servizi giorno per giorno: clicca una cella per scrivere, Tab per passare alla successiva.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {importEnabled && (view !== "viaggio" || trip?.start) && (
            <button
              type="button"
              onClick={() => {
                setImportOpen((v) => !v);
                setImportMsg(null);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e6d7bb] bg-white px-3 text-sm text-[#233c5e] hover:bg-[#faf3e6]"
            >
              <Download className="h-4 w-4" /> Importa dai viaggi
            </button>
          )}
          <button
            type="button"
            onClick={exportExcel}
            disabled={exporting || visible.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e6d7bb] bg-white px-3 text-sm text-[#233c5e] hover:bg-[#faf3e6] disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" /> {exporting ? "Preparo…" : "Excel"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={visible.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e6d7bb] bg-white px-3 text-sm text-[#233c5e] hover:bg-[#faf3e6] disabled:opacity-50"
          >
            <Printer className="h-4 w-4" /> Stampa / PDF
          </button>
          <button
            type="button"
            onClick={() => addRow(defaultDate())}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#233c5e] px-3 text-sm font-medium text-white hover:bg-[#1b3050]"
          >
            <Plus className="h-4 w-4" /> Nuova riga
          </button>
        </div>
      </div>

      {importOpen && importEnabled && (
        <div className="rounded-2xl border border-[#e6d7bb] bg-white p-4 text-sm text-slate-700 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-[#233c5e]">
                {trip
                  ? `Importa i servizi dell'itinerario del viaggio ${trip.code}`
                  : `Importa i servizi degli itinerari ${from === to ? `del ${shortDate(from)}` : `dal ${shortDate(from)} al ${shortDate(to)}`}`}
              </p>
              <p className="mt-1 text-slate-500">
                Ogni attività dell&apos;itinerario diventa una riga, con cliente, fornitore e contatto (dai «Servizi e fornitori» del viaggio), orario, punto di
                ritrovo e numero di conferma. Le attività già importate non si duplicano e le righe che hai modificato restano come sono. Agente, persone e
                responsabile si completano qui.
              </p>
            </div>
            <button type="button" onClick={() => setImportOpen(false)} className="rounded p-1 text-slate-400 hover:text-slate-600" aria-label="Chiudi">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {!trip && (
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={importAll} onChange={(e) => setImportAll(e.target.checked)} />
                Includi anche i viaggi non confermati (preliminari e varianti)
              </label>
            )}
            <button
              type="button"
              onClick={runImport}
              disabled={importing}
              className="inline-flex h-9 items-center rounded-lg bg-[#233c5e] px-4 font-medium text-white hover:bg-[#1b3050] disabled:opacity-60"
            >
              {importing ? "Importo…" : "Importa"}
            </button>
            {importMsg && <span className="text-[#233c5e]">{importMsg}</span>}
          </div>
        </div>
      )}

      {/* ── Periodo ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-[#e6d7bb] bg-white p-0.5 text-sm">
          {(
            [
              ["Oggi", "giorno", today],
              ["Domani", "giorno", tomorrow],
              ["Settimana", "settimana", view === "settimana" ? anchor : today >= from && today <= to ? today : from],
              ["Mese", "mese", view === "mese" ? anchor : from],
            ] as [string, OpsView, string][]
          ).map(([label, v, d]) => {
            const active = v === view && (v !== "giorno" || d === anchor);
            return (
              <button
                key={label}
                type="button"
                onClick={() => go(v, d)}
                className={`rounded-md px-3 py-1.5 ${active ? "bg-[#233c5e] text-white" : "text-[#233c5e] hover:bg-[#faf3e6]"}`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {view === "viaggio" && trip ? (
          <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-[#cda876] bg-[#faf3e6] px-3 py-1.5 text-sm text-[#233c5e]">
            <span className="rounded bg-[#233c5e] px-1.5 py-0.5 font-mono text-xs tracking-wider text-white">{trip.code}</span>
            <span className="font-medium">{trip.client ? `${trip.client} · ` : ""}{trip.title}</span>
            {trip.start && <span className="text-slate-500">{trip.end && trip.end !== trip.start ? `dal ${shortDate(trip.start)} al ${shortDate(trip.end)}` : shortDate(trip.start)}</span>}
            <a href={`/dashboard/trips/${trip.id}`} className="inline-flex items-center gap-1 text-[#a08a5e] hover:text-[#233c5e]">
              <ExternalLink className="h-3.5 w-3.5" /> viaggio
            </a>
            <button type="button" onClick={() => go("mese", trip.start ?? today)} className="inline-flex items-center gap-1 text-slate-500 hover:text-[#233c5e]" aria-label="Chiudi il viaggio">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
        <div className="inline-flex items-center gap-1">
          <button type="button" onClick={() => step(-1)} className="rounded-lg p-2 text-[#233c5e] hover:bg-white" aria-label="Periodo precedente">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[9rem] text-center font-medium text-[#233c5e]">{periodLabel(view, from, to)}</span>
          <button type="button" onClick={() => step(1)} className="rounded-lg p-2 text-[#233c5e] hover:bg-white" aria-label="Periodo successivo">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        )}
        {view === "mese" && (
          <div className="flex flex-wrap items-center gap-0.5 text-sm">
            {MONTHS.map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => go("mese", isoDate(new Date(anchorYear, i, 1)))}
                className={`rounded-md px-2 py-1 ${i === anchorMonth ? "bg-[#cda876] font-medium text-white" : "text-slate-600 hover:bg-white"}`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Ricerca e filtri ── */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-auto">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && codeMatch) openTrip(codeMatch.code);
            }}
            placeholder="Cerca codice viaggio, cliente, fornitore, servizio…"
            className="h-9 w-[calc(100vw-32px)] rounded-lg border sm:w-72 border-[#e6d7bb] bg-white pl-8 pr-2 text-sm"
          />
        </label>
        {(
          [
            ["client", "Cliente"],
            ["agent", "Agente"],
            ["supplier", "Fornitore"],
            ["responsible", "Responsabile"],
          ] as const
        ).map(([k, label]) => (
          <select key={k} value={filters[k]} onChange={(e) => setFilters((f) => ({ ...f, [k]: e.target.value }))} className={selectCls} aria-label={label}>
            <option value="">{label}: tutti</option>
            {filterOptions[k].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ))}
        {view !== "giorno" && (
          <select value={filters.day} onChange={(e) => setFilters((f) => ({ ...f, day: e.target.value }))} className={selectCls} aria-label="Giorno">
            <option value="">Giorno: tutti</option>
            {filterOptions.day.map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)}
              </option>
            ))}
          </select>
        )}
        <select value={filters.color} onChange={(e) => setFilters((f) => ({ ...f, color: e.target.value }))} className={selectCls} aria-label="Evidenziate">
          <option value="">Evidenziate: tutte le righe</option>
          <option value="evidenziate">Solo evidenziate</option>
          {OPS_COLORS.map((c) => (
            <option key={c} value={c}>
              Solo {OPS_COLOR_STYLE[c].label.toLowerCase()}
            </option>
          ))}
        </select>
        <select value={sortMode} onChange={(e) => setSortMode(e.target.value as "cliente" | "orario")} className={selectCls} aria-label="Ordine">
          <option value="cliente">Ordina per cliente</option>
          <option value="orario">Ordina per orario</option>
        </select>
        {activeFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilters(NO_FILTERS);
            }}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm text-slate-600 hover:bg-white"
          >
            <X className="h-4 w-4" /> Azzera filtri
          </button>
        )}
        <span className="text-sm text-slate-500">
          {visible.length} {visible.length === 1 ? "riga" : "righe"}
          {activeFilters && rows.length !== visible.length ? ` su ${rows.length}` : ""}
        </span>
      </div>

      {codeMatch && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#cda876] bg-[#faf3e6] px-4 py-2.5 text-sm text-[#233c5e]">
          <span>
            Codice <strong className="font-mono tracking-wider">{codeMatch.code}</strong>: {codeMatch.client ? `${codeMatch.client} · ` : ""}
            {codeMatch.title}
          </span>
          <button type="button" onClick={() => openTrip(codeMatch.code)} className="rounded-lg bg-[#233c5e] px-3 py-1.5 font-medium text-white hover:bg-[#1b3050]">
            Mostra tutte le righe del viaggio
          </button>
        </div>
      )}
      {missingCode && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Non ho trovato nessun viaggio con il codice <strong className="font-mono">{missingCode}</strong>: controlla di averlo scritto giusto.
        </div>
      )}
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Chiudi" className="text-red-500">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Foglio ── */}
      <div id="ops-print">
        <p className="mb-2 hidden text-lg font-semibold text-[#233c5e] print:block">
          Operativo · {trip ? `Viaggio ${trip.code} · ` : ""}
          {periodLabel(view, from, to)}
        </p>
        <div className="ops-scroll max-h-[calc(100vh-150px)] min-h-[320px] overflow-auto rounded-2xl border border-[#e6d7bb] bg-white shadow-sm">
          <table className="table-fixed border-separate border-spacing-0 text-[13px] text-slate-800" style={{ width: tableWidth }}>
            <colgroup>
              <col className="ops-noprint" style={{ width: MENU_W }} />
              {OPS_COLUMNS.map((c) => (
                <col key={c.key} style={{ width: c.width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="ops-noprint sticky left-0 top-0 z-30 border-b-2 border-[#cdbb97] bg-[#f3ead8]" />
                {OPS_COLUMNS.map((c, i) => (
                  <th
                    key={c.key}
                    className={`sticky top-0 border-b-2 border-r border-[#cdbb97] border-r-[#e6d7bb] bg-[#f3ead8] px-2 py-2.5 text-center text-[12.5px] font-semibold uppercase leading-tight tracking-wide text-[#233c5e] ${STICKY_TH[i] ?? "z-20"}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <DayGroup
                  key={g.day}
                  day={g.day}
                  isToday={g.day === today}
                  showHeader={view !== "giorno"}
                  rows={g.rows}
                  editing={editing}
                  draft={draft}
                  setDraft={setDraft}
                  onStartEdit={startEdit}
                  onBlurCommit={(token) => token === editToken.current && commit(null)}
                  onKey={onEditorKey}
                  onCellColor={setCellColor}
                  onMenu={(id, el) => {
                    const r = el.getBoundingClientRect();
                    setMenu((m) => (m?.id === id ? null : { id, x: Math.min(r.left, window.innerWidth - 230), y: Math.min(r.bottom + 4, window.innerHeight - 330) }));
                  }}
                  onAdd={() => addRow(g.day)}
                />
              ))}
              {groups.length > 0 && (
                <tr className="ops-noprint">
                  <td colSpan={OPS_COLUMNS.length + 1} className="p-0">
                    <div className="sticky left-0 w-max px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => addRow(defaultDate())}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#cda876] px-3 py-1.5 text-sm font-medium text-[#233c5e] hover:bg-[#faf3e6]"
                      >
                        <Plus className="h-4 w-4" /> Aggiungi riga
                        {view !== "giorno" && <span className="font-normal text-slate-500">({dayLabel(defaultDate()).toLowerCase()})</span>}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {groups.length === 0 && (
            <div className="sticky left-0 flex w-[min(100%,calc(100vw-34px))] flex-col items-center gap-3 px-4 py-14 text-center text-sm text-slate-500">
              {rows.length === 0 ? (
                <>
                  <p>{view === "viaggio" ? "Nessuna riga per questo viaggio." : "Nessun servizio in questo periodo."}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {importEnabled && (view !== "viaggio" || trip?.start) && (
                      <button type="button" onClick={() => setImportOpen(true)} className="rounded-lg border border-[#e6d7bb] px-3 py-2 text-[#233c5e] hover:bg-[#faf3e6]">
                        Importa dai viaggi
                      </button>
                    )}
                    <button type="button" onClick={() => addRow(defaultDate())} className="inline-flex items-center gap-1.5 rounded-lg bg-[#233c5e] px-4 py-2 font-medium text-white">
                      <Plus className="h-4 w-4" /> Aggiungi una riga
                    </button>
                  </div>
                </>
              ) : (
                <p>Nessuna riga corrisponde alla ricerca o ai filtri.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <datalist id="ops-dl-trip_code">
        {trips.map((t) => (
          <option key={t.id} value={t.code} label={[t.client, t.title].filter(Boolean).join(" · ")} />
        ))}
      </datalist>
      <datalist id="ops-dl-client">{options.client.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="ops-dl-agent">{options.agent.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="ops-dl-supplier">{options.supplier.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="ops-dl-responsible">{options.responsible.map((v) => <option key={v} value={v} />)}</datalist>

      {/* ── Menù della riga ── */}
      {menu && menuRow && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div className="fixed z-50 w-56 rounded-xl border border-[#e6d7bb] bg-white p-2 text-sm shadow-xl" style={{ left: Math.max(8, menu.x), top: Math.max(8, menu.y) }}>
            <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Colore della riga</p>
            <div className="flex flex-wrap gap-1.5 px-2 pb-2">
              {OPS_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={OPS_COLOR_STYLE[c].label}
                  aria-label={OPS_COLOR_STYLE[c].label}
                  onClick={() => {
                    void save(menuRow.id, { row_color: menuRow.row_color === c ? null : c });
                    setMenu(null);
                  }}
                  className={`h-6 w-6 rounded-full border ${menuRow.row_color === c ? "ring-2 ring-[#233c5e] ring-offset-1" : "border-slate-300"}`}
                  style={{ background: OPS_COLOR_STYLE[c].cell }}
                />
              ))}
              <button
                type="button"
                title="Nessun colore"
                aria-label="Nessun colore"
                onClick={() => {
                  void save(menuRow.id, { row_color: null, cell_colors: {} });
                  setMenu(null);
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-slate-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="px-2 pb-2 text-xs text-slate-400">Per evidenziare una sola cella: cliccala e scegli il colore sotto.</p>
            <div className="border-t border-slate-100 pt-1">
              <MenuItem icon={<Plus className="h-4 w-4" />} label="Nuova riga nello stesso giorno" onClick={() => addRow(menuRow.service_date)} />
              <MenuItem icon={<Copy className="h-4 w-4" />} label="Duplica la riga" onClick={() => addRow(menuRow.service_date, menuRow)} />
              {menuRow.trip_id && (
                <MenuItem
                  icon={<ExternalLink className="h-4 w-4" />}
                  label="Apri il viaggio"
                  onClick={() => {
                    setMenu(null);
                    window.open(`/dashboard/trips/${menuRow.trip_id}`, "_blank");
                  }}
                />
              )}
              <MenuItem icon={<Trash2 className="h-4 w-4" />} label="Elimina la riga" danger onClick={() => removeRow(menuRow)} />
            </div>
          </div>
        </>
      )}

      {undo && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-[#233c5e] px-4 py-3 text-sm text-white shadow-xl">
          Riga eliminata
          <button type="button" onClick={restore} className="font-semibold text-[#e4cc98] hover:underline">
            Annulla
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${danger ? "text-red-700 hover:bg-red-50" : "text-[#233c5e] hover:bg-[#faf3e6]"}`}
    >
      {icon}
      {label}
    </button>
  );
}

type GroupProps = {
  day: string;
  isToday: boolean;
  rows: OpsRow[];
  editing: { id: string; key: ColKey; token: number; selectAll?: boolean } | null;
  draft: string;
  setDraft: (v: string) => void;
  onStartEdit: (id: string, key: ColKey) => void;
  onBlurCommit: (token: number) => void;
  onKey: (e: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onCellColor: (id: string, key: OpsTextKey, color: OpsColor | null) => void;
  onMenu: (id: string, el: HTMLElement) => void;
  onAdd: () => void;
  showHeader: boolean;
};

function DayGroup({ day, isToday, rows, editing, draft, setDraft, onStartEdit, onBlurCommit, onKey, onCellColor, onMenu, onAdd, showHeader }: GroupProps) {
  const d = parseIsoDate(day);
  return (
    <>
      {/* nella vista di un solo giorno la fascia non serve: le righe stanno subito sotto i titoli */}
      {showHeader && (
      <tr>
        <td colSpan={OPS_COLUMNS.length + 1} className={`border-b border-[#e6d7bb] px-0 py-0 ${isToday ? "bg-[#f6e7c4]" : "bg-[#faf6ec]"}`}>
          <div className="sticky left-0 flex w-max items-center gap-3 px-3 py-1.5">
            <span className="text-sm font-semibold text-[#233c5e]">
              {dayLabel(day)}
              {isToday && <span className="ml-2 rounded-full bg-[#233c5e] px-2 py-0.5 text-[11px] font-medium text-white">oggi</span>}
            </span>
            <span className="text-xs text-slate-500">
              {rows.length} {rows.length === 1 ? "servizio" : "servizi"}
            </span>
            <button
              type="button"
              onClick={onAdd}
              className="ops-noprint inline-flex items-center gap-1 rounded-md border border-[#cda876] bg-white px-2 py-0.5 text-xs font-medium text-[#233c5e] hover:bg-[#233c5e] hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Aggiungi riga
            </button>
          </div>
        </td>
      </tr>
      )}
      {rows.map((r) => {
        const rowBg = r.row_color ? OPS_COLOR_STYLE[r.row_color].row : "#ffffff";
        return (
          <tr key={r.id} className="group">
            <td className="ops-noprint sticky left-0 z-10 border-b border-r border-slate-200 px-0 py-1 text-center align-top" style={{ background: rowBg }}>
              <button
                type="button"
                onClick={(e) => onMenu(r.id, e.currentTarget)}
                className="rounded p-0.5 text-slate-400 opacity-60 hover:bg-black/5 hover:text-[#233c5e] group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                aria-label="Azioni della riga"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </td>
            {OPS_COLUMNS.map((c, i) => {
              const isEditing = editing?.id === r.id && editing.key === c.key;
              const cellColor = c.key !== "service_date" ? r.cell_colors?.[c.key] : undefined;
              const bg = cellColor ? OPS_COLOR_STYLE[cellColor].cell : rowBg;
              const sticky = STICKY_TD[i] ?? "";
              const align = c.key === "pax" || c.key === "service_date" ? "text-center" : c.key === "meeting_time" ? "text-right" : "";
              return (
                <td
                  key={c.key}
                  onClick={() => !isEditing && onStartEdit(r.id, c.key)}
                  className={`${sticky || "relative"} cursor-text border-b border-r border-slate-200 px-2 py-1.5 align-top ${align} ${isEditing ? "outline outline-2 -outline-offset-2 outline-[#233c5e]" : "hover:shadow-[inset_0_0_0_1px_#cda876]"} ${c.key === "client" && !isEditing ? "font-medium" : ""} ${c.key === "trip_code" ? "font-mono text-[12px] tracking-wider" : ""}`}
                  style={{ background: isEditing ? "#ffffff" : bg, zIndex: isEditing ? 25 : undefined }}
                >
                  {isEditing ? (
                    <CellEditor column={c} selectAll={!!editing?.selectAll} draft={draft} setDraft={setDraft} onCommit={() => onBlurCommit(editing!.token)} onKey={onKey} />
                  ) : c.key === "service_date" ? (
                    <span className="flex flex-col leading-tight">
                      <span className="text-[15px] font-semibold text-[#233c5e]">{d.getDate()}</span>
                      <span className="text-[10px] uppercase text-slate-400">{d.toLocaleDateString("it-IT", { weekday: "short" })}</span>
                    </span>
                  ) : (
                    <span className="block min-h-[1.25rem] whitespace-pre-wrap break-words">{r[c.key]}</span>
                  )}
                  {isEditing && c.key !== "service_date" && (
                    <div
                      className="ops-noprint absolute left-0 top-full z-30 mt-0.5 flex items-center gap-1 rounded-lg border border-[#e6d7bb] bg-white px-2 py-1 shadow-lg"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <span className="mr-1 whitespace-nowrap text-[11px] text-slate-500">Evidenzia cella</span>
                      {OPS_COLORS.map((col) => (
                        <button
                          key={col}
                          type="button"
                          title={OPS_COLOR_STYLE[col].label}
                          aria-label={`Evidenzia in ${OPS_COLOR_STYLE[col].label.toLowerCase()}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onCellColor(r.id, c.key as OpsTextKey, cellColor === col ? null : col);
                          }}
                          className={`h-4 w-4 shrink-0 rounded-full border ${cellColor === col ? "ring-2 ring-[#233c5e] ring-offset-1" : "border-slate-300"}`}
                          style={{ background: OPS_COLOR_STYLE[col].cell }}
                        />
                      ))}
                      {cellColor && (
                        <button
                          type="button"
                          aria-label="Togli evidenziazione"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCellColor(r.id, c.key as OpsTextKey, null);
                          }}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

function CellEditor({
  column,
  selectAll,
  draft,
  setDraft,
  onCommit,
  onKey,
}: {
  column: OpsColumn;
  selectAll: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onCommit: () => void;
  onKey: (e: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const cls = "block w-full resize-none border-0 bg-transparent p-0 text-[13px] leading-[1.25rem] text-slate-900 outline-none focus:shadow-none";
  if (column.key === "service_date")
    return (
      <input
        type="date"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={onCommit}
        onKeyDown={onKey}
        className={`${cls} -mx-1 text-[12px]`}
        style={{ width: "calc(100% + 8px)" }}
      />
    );
  if (column.multiline)
    return (
      <textarea
        ref={areaRef}
        autoFocus
        rows={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={onCommit}
        onKeyDown={onKey}
        onFocus={(e) => (selectAll ? e.currentTarget.select() : e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length))}
        className={cls}
        style={{ boxShadow: "none" }}
      />
    );
  return (
    <input
      autoFocus
      value={draft}
      list={column.suggest ? `ops-dl-${column.key}` : undefined}
      onFocus={(e) => (selectAll ? e.currentTarget.select() : e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={onCommit}
      onKeyDown={onKey}
      className={`${cls} ${column.key === "pax" ? "text-center" : column.key === "meeting_time" ? "text-right" : ""}`}
      style={{ boxShadow: "none" }}
    />
  );
}
