"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/shrinkImage";
import { addCountryPhoto, listCountryPhotos, type CountryPhoto } from "@/lib/actions/clientPhotos";

const MAX_FILES = 12;
const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "foto";

// Foto di oggi dalla pagina del diario (aperta dalla notifica della sera): finiscono nella bacheca
// dei ricordi del paese, con il luogo del giorno come didascalia.
export default function DiaryPhotoButton({
  userId,
  country,
  tripId,
  place,
}: {
  userId: string;
  country: string;
  tripId: string;
  place: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<CountryPhoto[]>([]);

  async function loadToday() {
    const res = await listCountryPhotos(country);
    if (!res.ok) return;
    const day = new Date().toDateString();
    setToday(res.photos.filter((p) => new Date(p.createdAt).toDateString() === day));
  }

  useEffect(() => {
    let alive = true;
    listCountryPhotos(country).then((res) => {
      if (!alive || !res.ok) return;
      const day = new Date().toDateString();
      setToday(res.photos.filter((p) => new Date(p.createdAt).toDateString() === day));
    });
    return () => {
      alive = false;
    };
  }, [country]);

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
        const saved = await addCountryPhoto({ country, path, tripId, caption: place });
        if (!saved.ok) throw new Error(saved.error);
      } catch (err) {
        failed++;
        lastError = err instanceof Error && err.message !== "formato" && err.message !== "canvas" ? err.message : "Non riesco a leggere questa foto: prova con un'altra.";
      }
    }
    setBusy(null);
    if (failed > 0) setError(failed === files.length ? lastError : `${failed} foto su ${files.length} non sono state caricate. ${lastError}`);
    await loadToday();
  }

  return (
    <div className="rounded-2xl border border-[#e6d7bb] bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy !== null}
          className="flex items-center gap-2 rounded-full border border-[#233c5e] px-4 py-2 text-sm font-semibold text-[#233c5e] hover:bg-[#233c5e] hover:text-white disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {busy ?? "Aggiungi le foto di oggi"}
        </button>
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
        <p className="min-w-0 flex-1 text-xs text-slate-500">
          Le foto restano private e le ritrovi nella bacheca dei ricordi{place ? `, con «${place}» come didascalia` : ""}.
        </p>
      </div>
      {error && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>}
      {today.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-slate-600">
            {today.length === 1 ? "1 foto aggiunta oggi" : `${today.length} foto aggiunte oggi`}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {today.slice(0, 12).map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.url} alt={p.caption ?? "Foto di oggi"} className="h-16 w-16 rounded-lg object-cover" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
