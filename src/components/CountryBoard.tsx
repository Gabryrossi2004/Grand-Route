"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ImagePlus, Loader2, Share2, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/shrinkImage";
import { addCountryPhoto, deleteCountryPhoto, listCountryPhotos, setPhotoCaption, type CountryPhoto } from "@/lib/actions/clientPhotos";

export type BoardTrip = { id: string; title: string; from: string | null; status: "done" | "current" | "upcoming" };

const STATUS_LABEL = { done: "Fatto", current: "In corso", upcoming: "In programma" } as const;
const MAX_FILES = 12;

const monthYear = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("it-IT", { month: "long", year: "numeric" }) : "");
const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "foto";

// La bacheca dei ricordi di un paese visitato: foto private del cliente, che può condividerle sui social
export default function CountryBoard({
  country,
  nameIt,
  userId,
  trips,
  onClose,
  onCountChange,
}: {
  country: string;
  nameIt: string;
  userId: string;
  trips: BoardTrip[];
  onClose: () => void;
  onCountChange: (count: number) => void;
}) {
  const [photos, setPhotos] = useState<CountryPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tripId, setTripId] = useState<string>(trips.length === 1 ? trips[0].id : "");
  const [open, setOpen] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await listCountryPhotos(country);
    if (res.ok) {
      setPhotos(res.photos);
      onCountChange(res.photos.length);
    } else {
      setError(res.error);
      setPhotos([]);
    }
  }, [country, onCountChange]);

  useEffect(() => {
    let alive = true;
    listCountryPhotos(country).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setPhotos(res.photos);
        onCountChange(res.photos.length);
      } else {
        setError(res.error);
        setPhotos([]);
      }
    });
    return () => {
      alive = false;
    };
  }, [country, onCountChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (open !== null) setOpen(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_FILES);
    e.target.value = "";
    if (files.length === 0) return;
    setError(null);
    const supabase = createClient();
    let failed = 0;
    let lastError = "";
    for (let i = 0; i < files.length; i++) {
      setBusy(`Carico la foto ${i + 1} di ${files.length}…`);
      try {
        if (!files[i].type.startsWith("image/")) throw new Error("Questo file non è una foto.");
        const blob = await shrinkImage(files[i]);
        const path = `${userId}/${slug(country)}/${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage.from("client-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (up.error) throw new Error("Caricamento non riuscito. Controlla la connessione e riprova.");
        const saved = await addCountryPhoto({ country, path, tripId: tripId || null, caption: null });
        if (!saved.ok) throw new Error(saved.error);
      } catch (err) {
        failed++;
        lastError = err instanceof Error && err.message !== "formato" && err.message !== "canvas" ? err.message : "Non riesco a leggere questa foto: prova con un'altra.";
      }
    }
    setBusy(null);
    if (failed > 0) setError(failed === files.length ? lastError : `${failed} foto su ${files.length} non sono state caricate. ${lastError}`);
    await load();
  }

  const current = open !== null && photos ? photos[open] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`Bacheca: ${nameIt}`}>
      <button type="button" aria-label="Chiudi" onClick={onClose} className="absolute inset-0 bg-[#0b1626]/70 backdrop-blur-sm" />
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-[#faf3e6] text-[#1d2b40] shadow-2xl sm:rounded-3xl">
        <div className="flex items-start gap-3 border-b border-[#e6d7bb] px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#a87a1e]">Bacheca dei ricordi</p>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold leading-tight text-[#233c5e]">{nameIt}</h2>
            {trips.length > 0 && (
              <p className="mt-1 text-sm text-slate-600">
                {trips.map((t, i) => (
                  <span key={t.id}>
                    {i > 0 && " · "}
                    <a href={`/client/trips/${t.id}`} className="underline decoration-[#c58f2d] underline-offset-2 hover:text-[#233c5e]">
                      {t.title}
                    </a>
                    <span className="text-slate-500"> ({STATUS_LABEL[t.status].toLowerCase()}{t.from ? `, ${monthYear(t.from)}` : ""})</span>
                  </span>
                ))}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi la bacheca" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-black/5">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy !== null}
              className="flex items-center gap-2 rounded-full bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b3050] disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              {busy ?? "Aggiungi foto"}
            </button>
            <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
            {trips.length > 1 && (
              <select
                value={tripId}
                onChange={(e) => setTripId(e.target.value)}
                aria-label="A quale viaggio appartengono le foto"
                className="rounded-full border border-[#e6d7bb] bg-white px-3 py-2 text-sm"
              >
                <option value="">Nessun viaggio in particolare</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          {error && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>}

          {photos === null ? (
            <p className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Carico le foto…
            </p>
          ) : photos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e6d7bb] bg-white/70 p-6 text-center text-sm text-slate-600">
              Qui puoi raccogliere le foto più belle di questo paese e condividerle con chi vuoi.
              <br />
              Sono private: le vedi solo tu.
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p, i) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setOpen(i)} className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-[#efe3c8]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption || `Foto: ${nameIt}`} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-slate-500">Le foto vengono ridotte e salvate nel tuo spazio personale. Dal telefono puoi condividerle su Instagram e sugli altri social.</p>
        </div>
      </div>

      {current && photos && open !== null && (
        <Lightbox
          key={current.id}
          photo={current}
          nameIt={nameIt}
          index={open}
          total={photos.length}
          onPrev={() => setOpen((open - 1 + photos.length) % photos.length)}
          onNext={() => setOpen((open + 1) % photos.length)}
          onClose={() => setOpen(null)}
          onDeleted={async () => {
            setOpen(null);
            await load();
          }}
          onCaption={(text) => setPhotos((list) => list?.map((p) => (p.id === current.id ? { ...p, caption: text || null } : p)) ?? list)}
        />
      )}
    </div>
  );
}

function Lightbox({
  photo,
  nameIt,
  index,
  total,
  onPrev,
  onNext,
  onClose,
  onDeleted,
  onCaption,
}: {
  photo: CountryPhoto;
  nameIt: string;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onDeleted: () => void;
  onCaption: (text: string) => void;
}) {
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [note, setNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<File | null>(null);

  // Prepara già il file, così la condivisione parte subito al tocco (i telefoni la vogliono immediata)
  useEffect(() => {
    let alive = true;
    fetch(photo.url)
      .then((r) => r.blob())
      .then((b) => {
        if (alive) fileRef.current = new File([b], `${slug(nameIt)}.jpg`, { type: "image/jpeg" });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [photo.url, nameIt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.tagName === "INPUT";
      if (typing) return;
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext]);

  async function getFile(): Promise<File | null> {
    if (fileRef.current) return fileRef.current;
    try {
      const blob = await (await fetch(photo.url)).blob();
      fileRef.current = new File([blob], `${slug(nameIt)}.jpg`, { type: "image/jpeg" });
      return fileRef.current;
    } catch {
      return null;
    }
  }

  async function download() {
    const file = await getFile();
    if (!file) {
      setNote("Non riesco a scaricare la foto. Riprova.");
      return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function share() {
    setNote(null);
    const file = await getFile();
    if (!file) {
      setNote("Non riesco a preparare la foto. Riprova.");
      return;
    }
    const text = caption.trim() || nameIt;
    try {
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: nameIt, text });
        return;
      }
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return; // ha chiuso lui la finestra di condivisione
    }
    // Computer o browser senza condivisione di file: si scarica la foto, da caricare poi sul social
    await download();
    setNote("Su questo dispositivo non posso aprire direttamente Instagram: ho scaricato la foto, caricala dal social che preferisci. Dal telefono la condivisione è diretta.");
  }

  async function saveCaption() {
    const text = caption.trim();
    if (text === (photo.caption ?? "")) return;
    const res = await setPhotoCaption(photo.id, text);
    if (res.ok) onCaption(text);
    else setNote(res.error);
  }

  async function remove() {
    setBusy(true);
    const res = await deleteCountryPhoto(photo.id);
    setBusy(false);
    if (res.ok) onDeleted();
    else setNote(res.error);
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0b1626]/95" role="dialog" aria-modal="true" aria-label="Foto">
      <div className="flex items-center justify-between px-4 py-3 text-white/80">
        <span className="text-sm">
          {index + 1} / {total}
        </span>
        <button type="button" onClick={onClose} aria-label="Chiudi la foto" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10">
          <X size={20} />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.caption || `Foto: ${nameIt}`} className="max-h-full max-w-full rounded-lg object-contain" />
        {total > 1 && (
          <>
            <button type="button" onClick={onPrev} aria-label="Foto precedente" className="absolute left-2 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60">
              <ChevronLeft size={22} />
            </button>
            <button type="button" onClick={onNext} aria-label="Foto successiva" className="absolute right-2 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60">
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>
      <div className="mx-auto w-full max-w-xl space-y-2 px-4 pb-5 pt-3">
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={saveCaption}
          maxLength={300}
          placeholder="Scrivi una didascalia (la userai quando condividi)"
          className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:border-[#c58f2d] focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={share} className="flex items-center gap-2 rounded-full bg-[#c58f2d] px-4 py-2 text-sm font-semibold text-[#14233a] hover:bg-[#d49a35]">
            <Share2 size={16} /> Condividi
          </button>
          <button type="button" onClick={download} className="flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
            <Download size={16} /> Scarica
          </button>
          <span className="flex-1" />
          {confirmDelete ? (
            <span className="flex items-center gap-2 text-sm text-white">
              Eliminare?
              <button type="button" onClick={remove} disabled={busy} className="rounded-full bg-red-600 px-3 py-1.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-60">
                Sì, elimina
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-full border border-white/25 px-3 py-1.5 text-sm hover:bg-white/10">
                No
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} aria-label="Elimina la foto" className="grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
              <Trash2 size={18} />
            </button>
          )}
        </div>
        {note && <p className="text-xs text-amber-200">{note}</p>}
      </div>
    </div>
  );
}
