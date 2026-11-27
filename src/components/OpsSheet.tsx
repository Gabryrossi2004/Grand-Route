"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BellRing,
  CalendarDays,
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
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { createOpsRow, deleteOpsRow, importOpsFromTrips, opsServiceDays, updateOpsRow } from "@/lib/actions/opsSheet";
import OpsRiconferme from "@/components/OpsRiconferme";
import {
  OPS_COLOR_STYLE,
  OPS_COLORS,
  OPS_COLUMNS,
  OPS_FIELD_LABEL,
  OPS_STATUSES,
  isoDate,
  opsStatusInfo,
  normalizeTripCode,
  opsTimeMinutes,
  parseIsoDate,
  type OpsColor,
  type OpsChanges,
  type OpsColumn,
  type OpsRow,
  type OpsSourceKey,
  type OpsStatus,
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
  suppliers: { name: string; phone: string; email: string }[];
  agencyName: string;
  openRiconferme: boolean;
  clientNames: string[];
  suggestions: { client: string[]; agent: string[]; supplier: string[]; responsible: string[] };
  // cambio di periodo senza ricaricare la pagina (vedi OpsNavigator)
  onNavigate?: (view: OpsView, anchor: string) => void;
  busy?: boolean;
};

type ColKey = OpsColumn["key"];
type Filters = { client: string; agent: string; supplier: string; responsible: string; day: string; color: string; status: string };
const NO_FILTERS: Filters = { client: "", agent: "", supplier: "", responsible: "", day: "", color: "", status: "" };
const hasChanges = (r: OpsRow) => Object.keys(r.changes ?? {}).length > 0;
const MENU_W = 30;

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
// Le prime tre colonne restano bloccate a sinistra: la posizione (--l) dipende dalle larghezze scelte
const STICKY_TD: Record<number, string> = { 0: "sticky left-(--l) z-10", 1: "relative lg:sticky lg:left-(--l) lg:z-10", 2: "relative lg:sticky lg:left-(--l) lg:z-10" };
const STICKY_TH: Record<number, string> = { 0: "left-(--l) z-30", 1: "z-20 lg:left-(--l) lg:z-30", 2: "z-20 lg:left-(--l) lg:z-30" };
const MIN_COL = 64;
const MAX_COL = 700;
const WIDTHS_KEY = "gr-ops-widths";
type Widths = Record<string, number>;
const defaultWidths = (): Widths => Object.fromEntries(OPS_COLUMNS.map((c) => [c.key, c.width]));

export default function OpsSheet({ initialRows, view, anchor, from, to, today, trip, missingCode, trips, importEnabled, openRiconferme, suppliers, agencyName, clientNames, suggestions, onNavigate, busy = false }: Props) {
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
  const [riconfermeOpen, setRiconfermeOpen] = useState(openRiconferme);
  const [changesFor, setChangesFor] = useState<{ id: string; x: number; y: number } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // larghezze delle colonne: si trascinano dal bordo dell'intestazione (doppio clic = larghezza di partenza) e si ricordano
  const [widths, setWidths] = useState<Widths>(defaultWidths);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(WIDTHS_KEY) ?? "null") as Widths | null;
      if (saved) setWidths((cur) => ({ ...cur, ...Object.fromEntries(Object.entries(saved).filter(([k, v]) => k in cur && Number.isFinite(v)).map(([k, v]) => [k, Math.min(MAX_COL, Math.max(MIN_COL, v))])) }));
    } catch {
      // senza memoria del browser si parte dalle larghezze standard
    }
  }, []);
  const saveWidths = (next: Widths) => {
    try {
      window.localStorage.setItem(WIDTHS_KEY, JSON.stringify(next));
    } catch {
      // niente: le larghezze valgono per questa visita
    }
  };
  const resizeCol = (key: string, w: number, commit = false) =>
    setWidths((cur) => {
      const next = { ...cur, [key]: Math.round(Math.min(MAX_COL, Math.max(MIN_COL, w))) };
      if (commit) saveWidths(next);
      return next;
    });
  const widthsChanged = OPS_COLUMNS.some((c) => widths[c.key] !== c.width);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const editToken = useRef(0);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (v: OpsView, d: string) => (onNavigate && v !== "viaggio" ? onNavigate(v, d) : router.push(`/dashboard/operativo?v=${v}&d=${d}`));
  const openTrip = (code: string) => router.push(`/dashboard/operativo?codice=${code}`);
  const searchCode = normalizeTripCode(search);
  const codeMatch = searchCode.length === 6 && searchCode !== trip?.code ? trips.find((t) => t.code === searchCode) : undefined;
  const step = (dir: 1 | -1) => go(view, view === "mese" ? shiftMonths(anchor, dir) : shiftDays(anchor, dir * (view === "settimana" ? 7 : 1)));
  const tomorrow = shiftDays(today, 1);

  // ── Suggerimenti per le celle, come nei fogli di calcolo: i testi già scritti nella stessa colonna
  //    (più le rubriche di clienti e fornitori), dal più usato ──
  const options = useMemo(() => {
    const out: Record<string, Suggestion[]> = {};
    const extra: Partial<Record<OpsTextKey, string[]>> = {
      client: [...clientNames, ...suggestions.client],
      agent: suggestions.agent,
      supplier: [...suppliers.map((s) => s.name), ...suggestions.supplier],
      responsible: suggestions.responsible,
    };
    for (const c of OPS_COLUMNS) {
      if (c.key === "service_date" || c.key === "status" || c.key === "pax") continue;
      const key = c.key as OpsTextKey;
      const count = new Map<string, { value: string; n: number }>();
      for (const v of [...rows.map((r) => r[key] ?? ""), ...(extra[key] ?? [])]) {
        const value = v.trim();
        if (value.length < 2) continue;
        const k = value.toLocaleLowerCase("it");
        const cur = count.get(k);
        if (cur) cur.n += 1;
        else count.set(k, { value, n: 1 });
      }
      out[key] = [...count.values()].sort((a, b) => b.n - a.n || a.value.localeCompare(b.value, "it")).map((x) => ({ value: x.value }));
    }
    out.trip_code = trips.map((t) => ({ value: t.code, hint: [t.client, t.title].filter(Boolean).join(" · ") })).filter((t) => t.value);
    return out;
  }, [rows, clientNames, suppliers, suggestions, trips]);

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
          [shortDate(r.service_date), r.trip_code, r.client, r.agent, r.supplier, r.supplier_contact, r.pax, r.service, r.meeting_time, r.meeting_point, r.notes, r.responsible, opsStatusInfo(r.status)?.label ?? ""].join(" "),
        );
        if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      for (const k of ["client", "agent", "supplier", "responsible"] as const) if (filters[k] && norm(r[k]) !== norm(filters[k])) return false;
      if (filters.day && r.service_date !== filters.day) return false;
      if (filters.status === "cambiate" ? !hasChanges(r) : filters.status === "nessuno" ? r.status !== "" : filters.status && r.status !== filters.status) return false;
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
  const activeCount = (search.trim() ? 1 : 0) + Object.values(filters).filter(Boolean).length;

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

  function commit(next?: { id: string; key: ColKey } | null, selectNext = true, picked?: string) {
    if (!editing || editing.token !== editToken.current) return;
    editToken.current = -editToken.current; // una sola conferma per ogni modifica
    const row = rows.find((r) => r.id === editing.id);
    const raw = picked ?? draft;
    const value = editing.key === "service_date" ? raw : raw.replace(/\s+$/, "");
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

  // Frecce: passa alla cella accanto (sinistra/destra) o alla stessa colonna della riga sopra/sotto
  function moveCell(dir: "up" | "down" | "left" | "right", picked?: string) {
    if (!editing) return;
    const editable = OPS_COLUMNS.filter((c) => c.key !== "status");
    const flat = groups.flatMap((g) => g.rows);
    const ri = flat.findIndex((r) => r.id === editing.id);
    const ci = editable.findIndex((c) => c.key === editing.key);
    if (ri < 0 || ci < 0) return;
    let target: { id: string; key: ColKey } | null = null;
    if (dir === "left" && ci > 0) target = { id: editing.id, key: editable[ci - 1].key };
    if (dir === "right" && ci < editable.length - 1) target = { id: editing.id, key: editable[ci + 1].key };
    if (dir === "up" && ri > 0) target = { id: flat[ri - 1].id, key: editing.key };
    if (dir === "down" && ri < flat.length - 1) target = { id: flat[ri + 1].id, key: editing.key };
    if (target) commit(target, true, picked);
  }

  function cancelEdit() {
    editToken.current = -editToken.current;
    setEditing(null);
  }

  function onEditorKey(e: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, picked?: string) {
    if (!editing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      commit(null, true, picked);
    } else if (e.key === "Tab") {
      e.preventDefault();
      let idx = OPS_COLUMNS.findIndex((c) => c.key === editing.key) + (e.shiftKey ? -1 : 1);
      if (OPS_COLUMNS[idx]?.key === "status") idx += e.shiftKey ? -1 : 1; // lo stato si sceglie dal menù
      const col = OPS_COLUMNS[idx];
      commit(col ? { id: editing.id, key: col.key } : null, true, picked);
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
      ? { ...copy, id, trip_id: copy.trip_id, activity_id: null, changes: {}, created_at: new Date().toISOString() }
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
          status: "",
          changes: {},
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
    const { created_at: _c, changes: _ch, ...payload } = base;
    void _c;
    void _ch;
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
    const { created_at: _c, changes: _ch, ...payload } = row;
    void _c;
    void _ch;
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
      ws.columns = OPS_COLUMNS.map((c) => ({ header: c.label.toUpperCase(), key: c.key, width: Math.max(8, Math.round((widths[c.key] ?? c.width) / 7)) }));
      const head = ws.getRow(1);
      head.font = { bold: true, color: { argb: "FFFFFFFF" } };
      head.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      head.height = 30;
      head.eachCell((cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF233C5E" } }));
      for (const g of groups) {
        for (const r of g.rows) {
          const line = ws.addRow({ ...r, service_date: shortDate(r.service_date), status: opsStatusInfo(r.status)?.label ?? "" });
          line.alignment = { vertical: "top", wrapText: true };
          OPS_COLUMNS.forEach((c, i) => {
            const cell = line.getCell(i + 1);
            const cellColor = c.key !== "service_date" && c.key !== "status" ? r.cell_colors?.[c.key] : undefined;
            const st = c.key === "status" ? opsStatusInfo(r.status) : undefined;
            // servizio cancellato: tutta la riga in rosso anche nel file Excel
            const argb = st ? st.excel : r.status === "cancellato" ? "FFF4CCCC" : cellColor ? OPS_COLOR_STYLE[cellColor].excelCell : r.row_color ? OPS_COLOR_STYLE[r.row_color].excelRow : null;
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

  const changesRow = changesFor ? rows.find((r) => r.id === changesFor.id) : null;
  const changedCount = rows.filter(hasChanges).length;

  function applyChange(row: OpsRow, key: OpsSourceKey) {
    const ch = row.changes[key];
    if (!ch) return;
    const rest = { ...row.changes };
    delete rest[key];
    void save(row.id, { [key]: ch.to, changes: rest } as Partial<OpsRow>);
  }

  const tableWidth = MENU_W + OPS_COLUMNS.reduce((s, c) => s + (widths[c.key] ?? c.width), 0);
  // dove si ferma ogni colonna bloccata a sinistra
  const lefts = [MENU_W, MENU_W + (widths[OPS_COLUMNS[0].key] ?? OPS_COLUMNS[0].width), MENU_W + (widths[OPS_COLUMNS[0].key] ?? OPS_COLUMNS[0].width) + (widths[OPS_COLUMNS[1].key] ?? OPS_COLUMNS[1].width)];
  const menuRow = menu ? rows.find((r) => r.id === menu.id) : null;
  const filterCls = "h-9 w-full rounded-lg border border-[#e6d7bb] bg-white px-2 text-sm font-normal text-[#233c5e]";

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
          <p className="text-sm text-slate-500">Tutti i servizi giorno per giorno: clicca una cella per scrivere; con Tab e le frecce passi da una cella all&apos;altra.</p>
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
            onClick={() => setRiconfermeOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#1f9d55] bg-white px-3 text-sm font-medium text-[#1f7a45] hover:bg-green-50"
          >
            <BellRing className="h-4 w-4" /> Riconferme
          </button>
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

      {/* ── Periodo: Oggi / Domani / Settimana / Mese, frecce e agenda ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-[#e6d7bb] bg-white p-1 text-sm shadow-sm">
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
                className={`rounded-full px-3.5 py-1.5 font-medium transition ${active ? "bg-[#233c5e] text-white shadow-sm" : "text-[#233c5e] hover:bg-[#faf3e6]"}`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {view === "viaggio" && trip ? (
          <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[#cda876] bg-[#faf3e6] px-3 py-1.5 text-sm text-[#233c5e]">
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
          <div className="relative inline-flex items-center gap-0.5 rounded-full border border-[#e6d7bb] bg-white p-1 shadow-sm">
            <button type="button" onClick={() => step(-1)} className="rounded-full p-1.5 text-[#233c5e] hover:bg-[#faf3e6]" aria-label="Indietro">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setAgendaOpen((o) => !o)}
              aria-expanded={agendaOpen}
              className="inline-flex min-w-[10rem] items-center justify-center gap-2 rounded-full px-3 py-1 text-sm font-semibold text-[#233c5e] hover:bg-[#faf3e6]"
            >
              <CalendarDays className={`h-4 w-4 text-[#c58f2d] ${busy ? "animate-pulse" : ""}`} aria-hidden /> {periodLabel(view, from, to)}
            </button>
            <button type="button" onClick={() => step(1)} className="rounded-full p-1.5 text-[#233c5e] hover:bg-[#faf3e6]" aria-label="Avanti">
              <ChevronRight className="h-4 w-4" />
            </button>
            {agendaOpen && (
              <OpsAgenda
                anchor={view === "giorno" ? anchor : from}
                from={from}
                to={to}
                today={today}
                onClose={() => setAgendaOpen(false)}
                onDay={(d) => {
                  setAgendaOpen(false);
                  go("giorno", d);
                }}
                onMonth={(d) => {
                  setAgendaOpen(false);
                  go("mese", d);
                }}
              />
            )}
          </div>
        )}

        {/* ── Filtri: un solo pulsante con tutto dentro ── */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium shadow-sm transition ${activeFilters ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#233c5e] hover:bg-[#faf3e6]"}`}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filtri
            {activeCount > 0 && <span className="rounded-full bg-[#cda876] px-1.5 text-xs font-bold text-[#17283f]">{activeCount}</span>}
          </button>
          {filtersOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setFiltersOpen(false)} />
              <div className="picker-pop absolute left-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[#e6d7bb] bg-[#fffaf0] p-4 shadow-xl">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={search}
                    autoFocus
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && codeMatch) openTrip(codeMatch.code);
                    }}
                    placeholder="Cerca codice, cliente, fornitore, servizio…"
                    className="h-9 w-full rounded-lg border border-[#e6d7bb] bg-white pl-8 pr-2 text-sm"
                  />
                </label>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["client", "Cliente"],
                      ["agent", "Agente"],
                      ["supplier", "Fornitore"],
                      ["responsible", "Responsabile"],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                      {label}
                      <select value={filters[k]} onChange={(e) => setFilters((f) => ({ ...f, [k]: e.target.value }))} className={filterCls}>
                        <option value="">Tutti</option>
                        {filterOptions[k].map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  {view !== "giorno" && (
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                      Giorno
                      <select value={filters.day} onChange={(e) => setFilters((f) => ({ ...f, day: e.target.value }))} className={filterCls}>
                        <option value="">Tutti</option>
                        {filterOptions.day.map((d) => (
                          <option key={d} value={d}>
                            {dayLabel(d)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                    Stato
                    <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className={filterCls}>
                      <option value="">Tutti</option>
                      {OPS_STATUSES.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.label}
                        </option>
                      ))}
                      <option value="nessuno">Senza stato</option>
                      <option value="cambiate">Cambiate nell&apos;itinerario</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                    Evidenziate
                    <select value={filters.color} onChange={(e) => setFilters((f) => ({ ...f, color: e.target.value }))} className={filterCls}>
                      <option value="">Tutte le righe</option>
                      <option value="evidenziate">Solo evidenziate</option>
                      {OPS_COLORS.map((c) => (
                        <option key={c} value={c}>
                          Solo {OPS_COLOR_STYLE[c].label.toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                    Ordine
                    <select value={sortMode} onChange={(e) => setSortMode(e.target.value as "cliente" | "orario")} className={filterCls}>
                      <option value="cliente">Per cliente</option>
                      <option value="orario">Per orario</option>
                    </select>
                  </label>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#efe3cb] pt-3">
                  <button
                    type="button"
                    disabled={!activeFilters}
                    onClick={() => {
                      setSearch("");
                      setFilters(NO_FILTERS);
                    }}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-white disabled:opacity-40"
                  >
                    <X className="h-4 w-4" /> Azzera
                  </button>
                  <button type="button" onClick={() => setFiltersOpen(false)} className="rounded-full bg-[#233c5e] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#17283f]">
                    Fatto
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        <span className="text-sm text-slate-500">
          {visible.length} {visible.length === 1 ? "servizio" : "servizi"}
          {activeFilters && rows.length !== visible.length ? ` su ${rows.length}` : ""}
        </span>
        {widthsChanged && (
          <button
            type="button"
            onClick={() => {
              const base = defaultWidths();
              setWidths(base);
              saveWidths(base);
            }}
            className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm text-slate-500 hover:bg-white hover:text-[#233c5e]"
            title="Rimette le colonne alla larghezza di partenza"
          >
            <X className="h-3.5 w-3.5" /> Larghezze standard
          </button>
        )}
      </div>

      {/* filtri attivi: si tolgono uno per uno */}
      {activeFilters && (
        <div className="-mt-1 flex flex-wrap items-center gap-1.5">
          {search.trim() && <FilterChip label={`«${search.trim()}»`} onClear={() => setSearch("")} />}
          {(["client", "agent", "supplier", "responsible"] as const).map((k) => filters[k] && <FilterChip key={k} label={filters[k]} onClear={() => setFilters((f) => ({ ...f, [k]: "" }))} />)}
          {filters.day && <FilterChip label={dayLabel(filters.day)} onClear={() => setFilters((f) => ({ ...f, day: "" }))} />}
          {filters.status && (
            <FilterChip
              label={filters.status === "nessuno" ? "Senza stato" : filters.status === "cambiate" ? "Cambiate" : (opsStatusInfo(filters.status)?.label ?? filters.status)}
              onClear={() => setFilters((f) => ({ ...f, status: "" }))}
            />
          )}
          {filters.color && (
            <FilterChip
              label={filters.color === "evidenziate" ? "Evidenziate" : `Solo ${OPS_COLOR_STYLE[filters.color as OpsColor].label.toLowerCase()}`}
              onClear={() => setFilters((f) => ({ ...f, color: "" }))}
            />
          )}
        </div>
      )}

      {changedCount > 0 && filters.status !== "cambiate" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {changedCount === 1 ? "Una riga è cambiata" : `${changedCount} righe sono cambiate`} nell&apos;itinerario dopo l&apos;importazione: i campi che non avevi
            toccato si sono aggiornati da soli, gli altri te li segnalo (triangolo arancione a inizio riga).
          </span>
          <button type="button" onClick={() => setFilters((f) => ({ ...f, status: "cambiate" }))} className="rounded-lg bg-amber-600 px-3 py-1 font-medium text-white hover:bg-amber-700">
            Mostra solo queste
          </button>
        </div>
      )}
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
                <col key={c.key} style={{ width: widths[c.key] ?? c.width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="ops-noprint sticky left-0 top-0 z-30 border-b-2 border-[#cdbb97] bg-[#f3ead8]" />
                {OPS_COLUMNS.map((c, i) => (
                  <th
                    key={c.key}
                    className={`sticky top-0 border-b-2 border-r border-[#cdbb97] border-r-[#e6d7bb] bg-[#f3ead8] px-2 py-2.5 text-center text-[12.5px] font-semibold uppercase leading-tight tracking-wide text-[#233c5e] [overflow-wrap:anywhere] ${STICKY_TH[i] ?? "z-20"}`}
                    style={i < 3 ? ({ "--l": `${lefts[i]}px` } as React.CSSProperties) : undefined}
                  >
                    {c.label}
                    <ColResizer
                      label={c.label}
                      width={widths[c.key] ?? c.width}
                      onResize={(w, commit) => resizeCol(c.key, w, commit)}
                      onReset={() => resizeCol(c.key, c.width, true)}
                    />
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
                  onPick={(v) => commit(null, true, v)}
                  onNavigate={moveCell}
                  lefts={lefts}
                  suggestFor={(key) => options[key] ?? []}
                  onCellColor={setCellColor}
                  onChanges={(id, el) => {
                    const r = el.getBoundingClientRect();
                    setChangesFor({ id, x: Math.min(r.left, window.innerWidth - 360), y: Math.min(r.bottom + 4, window.innerHeight - 340) });
                  }}
                  onStatus={(id, st) => void save(id, { status: st })}
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

      {riconfermeOpen && (
        <OpsRiconferme
          today={today}
          agencyName={agencyName}
          suppliers={suppliers}
          onClose={() => setRiconfermeOpen(false)}
          onStatusChange={(ids, st) => setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, status: st } : r)))}
        />
      )}

      {changesFor && changesRow && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setChangesFor(null)} />
          <div
            className="fixed z-50 w-[22rem] max-w-[calc(100vw-16px)] rounded-xl border border-amber-300 bg-white p-3 text-sm shadow-xl"
            style={{ left: Math.max(8, changesFor.x), top: Math.max(8, changesFor.y) }}
          >
            <p className="mb-2 flex items-center gap-1.5 font-medium text-amber-800">
              <AlertTriangle className="h-4 w-4" /> Cambiato nell&apos;itinerario
            </p>
            <ul className="flex flex-col gap-2">
              {changesRow.changes._removed && (
                <li className="rounded-lg bg-red-50 p-2 text-red-800">
                  L&apos;attività è stata tolta dall&apos;itinerario.
                  <button type="button" onClick={() => removeRow(changesRow)} className="ml-2 font-medium underline">
                    Elimina la riga
                  </button>
                </li>
              )}
              {(Object.entries(changesRow.changes) as [string, { from: string; to: string; applied: boolean }][])
                .filter(([k]) => k !== "_removed")
                .map(([k, ch]) => (
                  <li key={k} className="rounded-lg bg-amber-50 p-2 text-slate-700">
                    <span className="font-medium text-[#233c5e]">{OPS_FIELD_LABEL[k as OpsSourceKey]}</span>
                    {ch.applied ? (
                      <span className="block">
                        aggiornato: <s className="text-slate-400">{fmtValue(k, ch.from)}</s> → <strong>{fmtValue(k, ch.to)}</strong>
                      </span>
                    ) : (
                      <span className="block">
                        nell&apos;itinerario ora è <strong>{fmtValue(k, ch.to)}</strong>; qui c&apos;è «{fmtValue(k, ch.from)}», scritto a mano, e non l&apos;ho toccato.
                        <button type="button" onClick={() => applyChange(changesRow, k as OpsSourceKey)} className="ml-1 font-medium text-[#233c5e] underline">
                          Usa quello dell&apos;itinerario
                        </button>
                      </span>
                    )}
                  </li>
                ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                void save(changesRow.id, { changes: {} });
                setChangesFor(null);
              }}
              className="mt-3 w-full rounded-lg bg-[#233c5e] py-1.5 font-medium text-white hover:bg-[#1b3050]"
            >
              Ho visto
            </button>
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

function fmtValue(key: string, v: string) {
  if (!v) return "vuoto";
  return key === "service_date" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? shortDate(v) : v;
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
  onKey: (e: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, picked?: string) => void;
  onPick: (value: string) => void;
  onNavigate: (dir: "up" | "down" | "left" | "right") => void;
  lefts: number[];
  suggestFor: (key: ColKey) => Suggestion[];
  onCellColor: (id: string, key: OpsTextKey, color: OpsColor | null) => void;
  onMenu: (id: string, el: HTMLElement) => void;
  onChanges: (id: string, el: HTMLElement) => void;
  onStatus: (id: string, status: OpsStatus | "") => void;
  onAdd: () => void;
  showHeader: boolean;
};

function DayGroup({ day, isToday, rows, editing, draft, setDraft, onStartEdit, onBlurCommit, onKey, onPick, onNavigate, lefts, suggestFor, onCellColor, onMenu, onChanges, onStatus, onAdd, showHeader }: GroupProps) {
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
        const cancelled = r.status === "cancellato";
        // servizio cancellato: tutta la riga in rosso
        const rowBg = cancelled ? "#fecaca" : r.row_color ? OPS_COLOR_STYLE[r.row_color].row : "#ffffff";
        const changed = hasChanges(r);
        return (
          <tr key={r.id} className="group">
            <td
              className="ops-noprint sticky left-0 z-10 border-b border-r border-slate-200 px-0 py-1 text-center align-top"
              style={{ background: rowBg, boxShadow: changed ? "inset 3px 0 0 #f59e0b" : undefined }}
            >
              {changed && (
                <button
                  type="button"
                  onClick={(e) => onChanges(r.id, e.currentTarget)}
                  className="mb-0.5 rounded p-0.5 text-amber-500 hover:bg-amber-50"
                  aria-label="Cambiato nell'itinerario"
                  title="Cambiato nell'itinerario: clicca per vedere cosa"
                >
                  <AlertTriangle className="h-4 w-4" />
                </button>
              )}
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
              const cellColor = c.key !== "service_date" && c.key !== "status" ? r.cell_colors?.[c.key] : undefined;
              const bg = cellColor && !cancelled ? OPS_COLOR_STYLE[cellColor].cell : rowBg;
              const fieldChanged = !!(r.changes as OpsChanges)?.[c.key as OpsSourceKey];
              if (c.key === "status") {
                return (
                  <td key={c.key} className="relative border-b border-r border-slate-200 px-1.5 py-1.5 align-top" style={{ background: rowBg }}>
                    <StatusPicker value={r.status} onChange={(next) => onStatus(r.id, next)} />
                  </td>
                );
              }
              const sticky = STICKY_TD[i] ?? "";
              const align = c.key === "pax" || c.key === "service_date" ? "text-center" : c.key === "meeting_time" ? "text-right" : "";
              return (
                <td
                  key={c.key}
                  onClick={() => !isEditing && onStartEdit(r.id, c.key)}
                  className={`${sticky || "relative"} cursor-text border-b border-r border-slate-200 px-2 py-1.5 align-top ${align} ${isEditing ? "outline outline-2 -outline-offset-2 outline-[#233c5e]" : "hover:shadow-[inset_0_0_0_1px_#cda876]"} ${c.key === "client" && !isEditing ? "font-medium" : ""} ${c.key === "trip_code" ? "font-mono text-[12px] tracking-wider" : ""} ${fieldChanged && !isEditing ? "ring-2 ring-inset ring-amber-300" : ""} ${cancelled && c.key !== "service_date" ? "text-red-900 line-through decoration-red-900/50" : ""}`}
                  style={{ background: isEditing ? "#ffffff" : bg, zIndex: isEditing ? 25 : undefined, ...(i < 3 ? ({ "--l": `${lefts[i]}px` } as React.CSSProperties) : {}) }}
                >
                  {isEditing ? (
                    <CellEditor column={c} selectAll={!!editing?.selectAll} draft={draft} setDraft={setDraft} onCommit={() => onBlurCommit(editing!.token)} onKey={onKey} onPick={onPick} onNavigate={onNavigate} suggestions={suggestFor(c.key)} />
                  ) : c.key === "service_date" ? (
                    <span className="flex flex-col leading-tight">
                      <span className="text-[15px] font-semibold text-[#233c5e]">{d.getDate()}</span>
                      <span className="text-[10px] uppercase text-slate-400">{d.toLocaleDateString("it-IT", { weekday: "short" })}</span>
                    </span>
                  ) : (
                    <span className="block min-h-[1.25rem] whitespace-pre-wrap [overflow-wrap:anywhere]">{r[c.key]}</span>
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

type Suggestion = { value: string; hint?: string };

// Suggerimenti mentre si scrive (come Google Sheets): bastano 2 lettere; prima chi inizia così, poi chi contiene una parola
// che inizia così. Frecce per scegliere, Invio o Tab per accettare, Esc per chiudere il suggerimento.
function matchSuggestions(all: Suggestion[], typed: string): Suggestion[] {
  const q = typed.trim().toLocaleLowerCase("it");
  if (q.length < 2) return [];
  const starts: Suggestion[] = [];
  const words: Suggestion[] = [];
  for (const s of all) {
    const v = s.value.toLocaleLowerCase("it");
    if (v === q) continue;
    if (v.startsWith(q)) starts.push(s);
    else if (v.split(/[\s,/·-]+/).some((w) => w.startsWith(q))) words.push(s);
    if (starts.length >= 6) break;
  }
  return [...starts, ...words].slice(0, 6);
}

function CellEditor({
  column,
  selectAll,
  draft,
  setDraft,
  onCommit,
  onKey,
  onPick,
  onNavigate,
  suggestions,
}: {
  column: OpsColumn;
  selectAll: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onCommit: () => void;
  onKey: (e: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, picked?: string) => void;
  onPick: (value: string) => void;
  onNavigate: (dir: "up" | "down" | "left" | "right") => void;
  suggestions: Suggestion[];
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);
  const [closed, setClosed] = useState(false);
  // finché non si scrive, le frecce spostano tra le celle (come nei fogli di calcolo); dopo muovono il cursore nel testo
  const [typed, setTyped] = useState(false);
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);
  const matches = closed ? [] : matchSuggestions(suggestions, draft);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  // il riquadro dei suggerimenti sta sotto la cella (posizione fissa: non viene tagliato dalla tabella)
  useLayoutEffect(() => {
    const el = areaRef.current ?? inputRef.current;
    const cell = el?.closest("td");
    if (!cell || matches.length === 0) return;
    const r = cell.getBoundingClientRect();
    const width = Math.max(r.width, 220);
    setBox({ left: Math.min(r.left, window.innerWidth - width - 8), top: r.bottom + 2, width });
  }, [draft, matches.length]);

  const handleKey = (e: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (matches.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setClosed(true);
        return;
      }
      if ((e.key === "Enter" && !e.shiftKey && !e.altKey) || e.key === "Tab") {
        onKey(e, matches[Math.min(active, matches.length - 1)].value);
        return;
      }
    }
    if (e.key.startsWith("Arrow") && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
      const el = e.currentTarget;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const len = el.value.length;
      const before = el.value.slice(0, start);
      const after = el.value.slice(end);
      const dir = e.key === "ArrowUp" ? "up" : e.key === "ArrowDown" ? "down" : e.key === "ArrowLeft" ? "left" : "right";
      const go =
        !typed ||
        (dir === "up" && !before.includes("\n")) ||
        (dir === "down" && !after.includes("\n")) ||
        (dir === "left" && start === 0 && end === 0) ||
        (dir === "right" && start === len && end === len);
      if (go) {
        e.preventDefault();
        onNavigate(dir);
        return;
      }
    }
    onKey(e);
  };
  const change = (v: string) => {
    setTyped(true);
    setDraft(v);
    setActive(0);
    setClosed(false);
  };

  const list =
    matches.length > 0 && box ? (
      <ul
        role="listbox"
        aria-label="Suggerimenti"
        className="fixed z-50 overflow-hidden rounded-lg border border-[#e6d7bb] bg-white py-1 text-[13px] shadow-xl"
        style={{ left: box.left, top: box.top, width: box.width }}
      >
        {matches.map((m, i) => (
          <li key={m.value}>
            <button
              type="button"
              role="option"
              aria-selected={i === active}
              // mousedown: sceglie prima che la cella perda il fuoco
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(m.value);
              }}
              onMouseEnter={() => setActive(i)}
              className={`block w-full truncate px-3 py-1.5 text-left ${i === active ? "bg-[#233c5e] text-white" : "text-slate-800 hover:bg-[#faf3e6]"}`}
            >
              {m.value}
              {m.hint && <span className={`ml-2 text-[11px] ${i === active ? "text-white/70" : "text-slate-400"}`}>{m.hint}</span>}
            </button>
          </li>
        ))}
        <li className="border-t border-slate-100 px-3 pt-1 text-[10.5px] text-slate-400">Invio o Tab per scegliere · Esc per chiudere</li>
      </ul>
    ) : null;

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
      <>
        <textarea
          ref={areaRef}
          autoFocus
          rows={1}
          value={draft}
          onChange={(e) => change(e.target.value)}
          onBlur={onCommit}
          onKeyDown={handleKey}
          onFocus={(e) => (selectAll ? e.currentTarget.select() : e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length))}
          className={cls}
          style={{ boxShadow: "none" }}
        />
        {list}
      </>
    );
  return (
    <>
      <input
        ref={inputRef}
        autoFocus
        value={draft}
        autoComplete="off"
        onFocus={(e) => (selectAll ? e.currentTarget.select() : e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length))}
        onChange={(e) => change(e.target.value)}
        onBlur={onCommit}
        onKeyDown={handleKey}
        className={`${cls} ${column.key === "pax" ? "text-center" : column.key === "meeting_time" ? "text-right" : ""}`}
        style={{ boxShadow: "none" }}
      />
      {list}
    </>
  );
}

// Stato del servizio: tendina con ogni voce già del suo colore (la tendina del browser non si può colorare ovunque).
// Si apre «sopra» la tabella (posizione fissa), così non viene tagliata dallo scorrimento della scheda.
export function StatusPicker({ value, onChange }: { value: string; onChange: (next: OpsStatus) => void }) {
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const st = opsStatusInfo(value);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [pos]);

  const open = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const height = OPS_STATUSES.length * 34 + 12;
    const up = r.bottom + height > window.innerHeight - 8 && r.top > height;
    const width = Math.max(r.width, 176);
    setPos({ left: Math.min(r.left, window.innerWidth - width - 8), top: up ? r.top - height - 4 : r.bottom + 4, width, up });
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => (pos ? setPos(null) : open())}
        aria-haspopup="listbox"
        aria-expanded={!!pos}
        aria-label={`Stato del servizio: ${st?.label ?? "nessuno"}`}
        className="w-full cursor-pointer rounded-full px-2 py-0.5 text-center text-[11.5px] font-semibold leading-5"
        style={{ background: st?.bg ?? "#f1f5f9", color: st?.fg ?? "#94a3b8" }}
      >
        {st?.label ?? "—"}
      </button>
      {pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPos(null)} />
          <ul
            role="listbox"
            aria-label="Stato del servizio"
            className="picker-pop fixed z-50 flex flex-col gap-1 rounded-xl border border-[#e6d7bb] bg-white p-1.5 shadow-xl"
            style={{ left: pos.left, top: pos.top, width: pos.width }}
          >
            {OPS_STATUSES.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  onClick={() => {
                    setPos(null);
                    if (o.id !== value) onChange(o.id);
                  }}
                  className={`w-full rounded-full px-3 py-1 text-center text-[12px] font-semibold leading-5 transition hover:brightness-95 ${o.id === value ? "ring-2 ring-[#233c5e] ring-offset-1" : ""}`}
                  style={{ background: o.bg, color: o.fg }}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex max-w-[16rem] items-center gap-1 rounded-full border border-[#cda876] bg-[#fdf6e6] py-0.5 pl-3 pr-1 text-xs font-medium text-[#233c5e]">
      <span className="truncate">{label}</span>
      <button type="button" onClick={onClear} className="rounded-full p-0.5 text-[#a08a5e] hover:bg-white hover:text-[#233c5e]" aria-label={`Togli il filtro ${label}`}>
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

const WEEKDAYS = ["L", "M", "M", "G", "V", "S", "D"];
const MONTH_NAMES = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

// Agenda del mese: ogni giorno segna quanti servizi ci sono; si sceglie un giorno o si apre tutto il mese
function OpsAgenda({
  anchor,
  from,
  to,
  today,
  onDay,
  onMonth,
  onClose,
}: {
  anchor: string;
  from: string;
  to: string;
  today: string;
  onDay: (d: string) => void;
  onMonth: (firstDay: string) => void;
  onClose: () => void;
}) {
  const start = parseIsoDate(anchor);
  const [month, setMonth] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const first = new Date(month.y, month.m, 1);
  const days = new Date(month.y, month.m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // lunedì per primo
  const monthFrom = isoDate(first);
  const monthTo = isoDate(new Date(month.y, month.m, days));

  useEffect(() => {
    let alive = true;
    opsServiceDays(monthFrom, monthTo).then(
      (c) => alive && setCounts(c),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [monthFrom, monthTo]);

  const shift = (n: number) => setMonth((cur) => ({ y: cur.m + n < 0 ? cur.y - 1 : cur.m + n > 11 ? cur.y + 1 : cur.y, m: (cur.m + n + 12) % 12 }));
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => isoDate(new Date(month.y, month.m, i + 1)))];

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="picker-pop absolute left-1/2 top-full z-30 mt-2 w-[19rem] -translate-x-1/2 rounded-2xl border border-[#e6d7bb] bg-[#fffaf0] p-3 shadow-xl">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => shift(-1)} className="rounded-full p-1.5 text-[#233c5e] hover:bg-white" aria-label="Mese precedente">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onMonth(monthFrom)} className="rounded-full px-3 py-1 font-[family-name:var(--font-display)] text-base font-semibold text-[#233c5e] hover:bg-white" title="Apri tutto il mese">
            {MONTH_NAMES[month.m]} {month.y}
          </button>
          <button type="button" onClick={() => shift(1)} className="rounded-full p-1.5 text-[#233c5e] hover:bg-white" aria-label="Mese successivo">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-400">
          {WEEKDAYS.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <span key={`v${i}`} />;
            const n = counts[d] ?? 0;
            const inRange = d >= from && d <= to;
            const isToday = d === today;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onDay(d)}
                title={n ? `${n} ${n === 1 ? "servizio" : "servizi"}` : "Nessun servizio"}
                className={`relative flex h-10 flex-col items-center justify-center rounded-xl text-sm transition ${
                  inRange ? "bg-[#233c5e] font-semibold text-white" : isToday ? "bg-[#cda876]/30 font-semibold text-[#233c5e]" : "text-[#233c5e] hover:bg-white"
                }`}
              >
                {Number(d.slice(8))}
                {n > 0 && (
                  <span className={`mt-0.5 min-w-4 rounded-full px-1 text-[9.5px] font-bold leading-[14px] ${inRange ? "bg-[#cda876] text-[#17283f]" : "bg-[#c58f2d] text-white"}`}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[#efe3cb] pt-2 text-xs text-slate-500">
          <span>Il numero indica i servizi del giorno</span>
          <button type="button" onClick={() => onDay(today)} className="rounded-full px-2.5 py-1 font-semibold text-[#233c5e] hover:bg-white">
            Oggi
          </button>
        </div>
      </div>
    </>
  );
}

// Maniglia sul bordo destro dell'intestazione: si trascina per cambiare la larghezza (anche col dito), con le frecce
// da tastiera e doppio clic per tornare alla larghezza di partenza. Il testo delle celle va a capo da solo.
function ColResizer({ label, width, onResize, onReset }: { label: string; width: number; onResize: (w: number, commit?: boolean) => void; onReset: () => void }) {
  const drag = useRef<{ x: number; w: number } | null>(null);
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Larghezza della colonna ${label}`}
      tabIndex={0}
      title="Trascina per cambiare la larghezza · doppio clic per ripristinarla"
      className="ops-noprint group/rz absolute -right-1.5 top-0 z-40 flex h-full w-3 cursor-col-resize touch-none select-none items-stretch justify-center outline-none"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, w: width };
      }}
      onPointerMove={(e) => {
        if (drag.current) onResize(drag.current.w + (e.clientX - drag.current.x));
      }}
      onPointerUp={(e) => {
        if (!drag.current) return;
        onResize(drag.current.w + (e.clientX - drag.current.x), true);
        drag.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          onResize(width + (e.key === "ArrowRight" ? 12 : -12), true);
        }
      }}
    >
      <span className="w-0.5 rounded-full bg-transparent transition group-hover/rz:bg-[#cda876] group-focus-visible/rz:bg-[#233c5e]" />
    </span>
  );
}
