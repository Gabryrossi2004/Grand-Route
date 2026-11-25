"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImagePlus, Loader2, Lock, Trash2, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/shrinkImage";
import { addGalleryPhoto, addNetworkFile, removeGalleryPhoto, removeNetworkFile, saveShowcaseText, setNetworkFileVisibility, setShowcaseImage } from "@/lib/actions/network";
import { BRAND_COLORS, FILES_BUCKET, MAX_FILES, MAX_GALLERY, MEDIA_BUCKET, brandOf, mediaUrl } from "@/lib/network/media";

export type ShowcaseData = {
  cover_path: string | null;
  logo_path: string | null;
  tagline: string | null;
  brand_color: string | null;
  gallery: string[];
};
export type ShowcaseFile = { id: string; title: string; path: string; size_bytes: number | null; visibility: "rete" | "partner" };

const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const btn = "rounded-full border border-[#233c5e] px-4 py-2 text-sm font-semibold text-[#233c5e] hover:bg-[#233c5e] hover:text-white disabled:opacity-60";
const card = "rounded-2xl border border-[#e6d7bb] bg-white p-5";

// La vetrina del profilo: copertina, logo, slogan, colore, galleria e listini.
export default function ShowcaseEditor({ userId, data, files }: { userId: string; data: ShowcaseData; files: ShowcaseFile[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const [color, setColor] = useState(brandOf(data.brand_color));
  const [tagline, setTagline] = useState(data.tagline ?? "");
  const coverInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileTitle, setFileTitle] = useState("");
  const [fileVis, setFileVis] = useState<"rete" | "partner">("rete");

  const fail = (e: unknown, fallback: string) => setError(e instanceof Error && e.message && e.message !== "formato" && e.message !== "canvas" ? e.message : fallback);

  async function uploadImage(file: File, maxSide: number): Promise<string> {
    if (!file.type.startsWith("image/")) throw new Error("Questo file non è una foto.");
    const blob = await shrinkImage(file, maxSide);
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const up = await createClient().storage.from(MEDIA_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (up.error) throw new Error("Caricamento non riuscito. Controlla la connessione e riprova.");
    return path;
  }

  async function onSingle(which: "cover" | "logo", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy(which === "cover" ? "Carico la copertina…" : "Carico il logo…");
    try {
      const path = await uploadImage(file, which === "cover" ? 1800 : 600);
      const r = await setShowcaseImage(which, path);
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      fail(err, "Non riesco a leggere questa foto: prova con un'altra.");
    }
    setBusy(null);
  }

  async function onGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).slice(0, MAX_GALLERY - data.gallery.length);
    e.target.value = "";
    if (picked.length === 0) return;
    setError(null);
    for (let i = 0; i < picked.length; i++) {
      setBusy(`Carico la foto ${i + 1} di ${picked.length}…`);
      try {
        const path = await uploadImage(picked[i], 1600);
        const r = await addGalleryPhoto(path);
        if (!r.ok) throw new Error(r.error);
      } catch (err) {
        fail(err, "Non riesco a leggere questa foto: prova con un'altra.");
        break;
      }
    }
    setBusy(null);
    router.refresh();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mime = FILE_TYPES[ext];
    if (!mime) return setError("Formato non supportato: carica un PDF, un file Excel (.xlsx) o un'immagine.");
    if (file.size > MAX_FILE_BYTES) return setError("Il file supera i 15 MB.");
    const title = (fileTitle.trim() || file.name.replace(/\.[^.]+$/, "")).slice(0, 80);
    setBusy("Carico il documento…");
    try {
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const up = await createClient().storage.from(FILES_BUCKET).upload(path, file, { contentType: mime, upsert: false });
      if (up.error) throw new Error("Caricamento non riuscito. Controlla la connessione e riprova.");
      const r = await addNetworkFile({ title, path, size: file.size, mime, visibility: fileVis });
      if (!r.ok) {
        await createClient().storage.from(FILES_BUCKET).remove([path]);
        throw new Error(r.error);
      }
      setFileTitle("");
      router.refresh();
    } catch (err) {
      fail(err, "Caricamento non riuscito.");
    }
    setBusy(null);
  }

  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Errore");
      else router.refresh();
    });

  const cover = mediaUrl(data.cover_path, 1200);
  const logo = mediaUrl(data.logo_path, 300);
  const sizeLabel = (n: number | null) => (n ? (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`) : "");

  return (
    <section className="flex flex-col gap-4">
      <div className={card}>
        <h2 className="text-xl font-semibold text-[#233c5e]">Come ti vedono gli altri</h2>
        <p className="mt-1 text-sm text-slate-600">Copertina, logo, foto e listini compaiono nell&apos;elenco e nella tua scheda. La copertina si vede già nei risultati di ricerca.</p>

        <div className="relative mt-4 overflow-hidden rounded-2xl border border-[#e6d7bb] bg-[#faf3e6]" style={{ minHeight: 140 }}>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="Copertina" className="h-44 w-full object-cover sm:h-56" />
          ) : (
            <div className="flex h-44 items-center justify-center text-sm text-slate-500 sm:h-56">Nessuna copertina: nell&apos;elenco comparirai senza foto in alto.</div>
          )}
          <span className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: color }} />
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Logo" className="absolute bottom-3 left-3 h-16 w-16 rounded-xl border-2 border-white bg-white object-cover shadow" />
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={btn} disabled={!!busy || pending} onClick={() => coverInput.current?.click()}>
            {busy?.startsWith("Carico la cop") ? <Loader2 size={15} className="mr-1 inline animate-spin" /> : <ImagePlus size={15} className="mr-1 inline" />}
            {cover ? "Cambia la copertina" : "Aggiungi la copertina"}
          </button>
          {cover && (
            <button type="button" className="rounded-full px-3 py-2 text-sm font-medium text-slate-500 hover:text-[#b0413e]" disabled={!!busy || pending} onClick={() => run(() => setShowcaseImage("cover", null))}>
              Togli
            </button>
          )}
          <button type="button" className={btn} disabled={!!busy || pending} onClick={() => logoInput.current?.click()}>
            <ImagePlus size={15} className="mr-1 inline" /> {logo ? "Cambia il logo" : "Aggiungi il logo"}
          </button>
          {logo && (
            <button type="button" className="rounded-full px-3 py-2 text-sm font-medium text-slate-500 hover:text-[#b0413e]" disabled={!!busy || pending} onClick={() => run(() => setShowcaseImage("logo", null))}>
              Togli
            </button>
          )}
        </div>
        <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(e) => onSingle("cover", e)} />
        <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={(e) => onSingle("logo", e)} />

        <form
          className="mt-5 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setSaved(false);
            start(async () => {
              setError(null);
              const r = await saveShowcaseText(fd);
              if (r.ok) {
                setSaved(true);
                router.refresh();
              } else setError(r.error ?? "Errore");
            });
          }}
        >
          <div>
            <label htmlFor="tagline" className="mb-1 block text-sm font-medium text-slate-700">Slogan (una riga, max 90 caratteri)</label>
            <input id="tagline" name="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={90} placeholder="Es. Roma senza la fila, con chi la conosce davvero" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]" />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Colore del tuo profilo</p>
            <div className="flex flex-wrap gap-2">
              {BRAND_COLORS.map((c) => (
                <button key={c.value} type="button" onClick={() => setColor(c.value)} aria-pressed={color === c.value} aria-label={c.label} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${color === c.value ? "border-[#233c5e] bg-[#faf3e6]" : "border-[#e6d7bb] bg-white"}`}>
                  <span className="h-4 w-4 rounded-full" style={{ background: c.value }} /> {c.label}
                </button>
              ))}
            </div>
            <input type="hidden" name="brand_color" value={color} />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending || !!busy} className="rounded-full bg-[#233c5e] px-5 py-2 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-60">Salva slogan e colore</button>
            {saved && <span className="text-sm text-emerald-700">Salvato.</span>}
          </div>
        </form>
      </div>

      <div className={card}>
        <h3 className="text-lg font-semibold text-[#233c5e]">Galleria foto <span className="text-sm font-normal text-slate-500">({data.gallery.length}/{MAX_GALLERY})</span></h3>
        <p className="mt-1 text-sm text-slate-600">Fino a {MAX_GALLERY} foto: ambienti, mezzi, camere, esperienze. Si ridimensionano da sole.</p>
        {data.gallery.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.gallery.map((p) => (
              <div key={p} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#e9dfc9]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(p, 400) ?? ""} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => run(() => removeGalleryPhoto(p))} disabled={pending || !!busy} className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white hover:bg-[#b0413e]" aria-label="Togli la foto"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
        {data.gallery.length < MAX_GALLERY && (
          <button type="button" className={`${btn} mt-3`} disabled={!!busy || pending} onClick={() => galleryInput.current?.click()}>
            <ImagePlus size={15} className="mr-1 inline" /> Aggiungi foto
          </button>
        )}
        <input ref={galleryInput} type="file" accept="image/*" multiple className="hidden" onChange={onGallery} />
      </div>

      <div className={card}>
        <h3 className="text-lg font-semibold text-[#233c5e]">Listini e documenti <span className="text-sm font-normal text-slate-500">({files.length}/{MAX_FILES})</span></h3>
        <p className="mt-1 text-sm text-slate-600">PDF, Excel (.xlsx) o immagini fino a 15 MB. Scegli chi può aprirli: tutti nella Rete, oppure solo i tuoi partner (chi ha accettato una collaborazione).</p>
        {files.length > 0 && (
          <ul className="mt-3 divide-y divide-[#f2e2c4] rounded-xl border border-[#e6d7bb]">
            {files.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                <FileText size={18} className="shrink-0 text-[#c58f2d]" />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{f.title} <span className="font-normal text-slate-400">{sizeLabel(f.size_bytes)}</span></span>
                <select value={f.visibility} onChange={(e) => run(() => setNetworkFileVisibility(f.id, e.target.value as "rete" | "partner"))} disabled={pending} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs" aria-label="Chi può aprirlo">
                  <option value="rete">Tutta la Rete</option>
                  <option value="partner">Solo i partner</option>
                </select>
                <button type="button" onClick={() => run(() => removeNetworkFile(f.id))} disabled={pending} className="rounded-full p-1.5 text-slate-400 hover:text-[#b0413e]" aria-label="Cancella il documento"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}
        {files.length < MAX_FILES && (
          <div className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_1fr_auto]">
            <input value={fileTitle} onChange={(e) => setFileTitle(e.target.value)} maxLength={80} placeholder="Titolo (es. Listino 2027)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]" />
            <select value={fileVis} onChange={(e) => setFileVis(e.target.value as "rete" | "partner")} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" aria-label="Chi può aprirlo">
              <option value="rete">Visibile a tutta la Rete</option>
              <option value="partner">Solo ai partner</option>
            </select>
            <button type="button" className={btn} disabled={!!busy || pending} onClick={() => fileInput.current?.click()}>
              {busy === "Carico il documento…" ? <Loader2 size={15} className="mr-1 inline animate-spin" /> : null}Scegli il file
            </button>
          </div>
        )}
        <input ref={fileInput} type="file" accept=".pdf,.xlsx,.jpg,.jpeg,.png" className="hidden" onChange={onFile} />
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Lock size={12} /> I documenti non sono pubblici: li apre solo chi ha un accesso attivo alla Rete{fileVis === "partner" ? " e ha una collaborazione con te" : ""}. <Users size={12} className="ml-1" /></p>
      </div>

      {busy && <p className="flex items-center gap-2 rounded-xl bg-[#faf3e6] px-4 py-3 text-sm text-slate-700"><Loader2 size={16} className="animate-spin" /> {busy}</p>}
      {error && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>}
    </section>
  );
}
