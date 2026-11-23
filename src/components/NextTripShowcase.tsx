"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import {
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  Compass,
  Dices,
  Expand,
  Heart,
  Lightbulb,
  Loader2,
  MapPinned,
  Plane,
  Send,
  Sparkles,
  Sun,
  Trophy,
  UtensilsCrossed,
  X,
} from "lucide-react";
import RequestQuoteButton from "@/components/RequestQuoteButton";
import { getDestinationDetail } from "@/lib/actions/nextTrip";
import { requestQuote } from "@/app/client/(portal)/actions";
import { MOOD_LABELS, type Mood } from "@/data/travelMoods";
import type { DestinationLite, NextTripIdea } from "@/lib/nextTripData";

// ── Piccola memoria nel browser: mete sognate, mete scoperte e record del gioco ──
const DREAMS = "gr-dreams";
const EXPLORED = "gr-explored";
const BEST = "gr-quiz-best";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener("gr-store", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("gr-store", cb);
  };
};
function readKey(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeKey(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* navigazione privata: pazienza */
  }
  window.dispatchEvent(new Event("gr-store"));
}
function useStoredList(key: string): [string[], (next: string[]) => void] {
  const raw = useSyncExternalStore(subscribe, () => readKey(key, "[]"), () => "[]");
  const list = useMemo(() => {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? (v as string[]) : [];
    } catch {
      return [];
    }
  }, [raw]);
  return [list, (next) => writeKey(key, JSON.stringify(next))];
}

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

// ── Foto a tutto schermo ──
function Lightbox({ photos, start, onClose }: { photos: NextTripIdea["photos"]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const go = (d: number) => setI((v) => (v + d + photos.length) % photos.length);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((v) => (v + 1) % photos.length);
      if (e.key === "ArrowLeft") setI((v) => (v - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, photos.length]);
  const p = photos[i];
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/92" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm">
          {i + 1} / {photos.length} · {p.title}
        </span>
        <button type="button" aria-label="Chiudi" className="rounded-full bg-white/15 p-2 hover:bg-white/25">
          <X size={20} />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.src} alt={p.title} referrerPolicy="no-referrer" className="max-h-full max-w-full rounded-lg object-contain" />
        {photos.length > 1 && (
          <>
            <button type="button" aria-label="Foto precedente" onClick={() => go(-1)} className="absolute left-3 rounded-full bg-white/20 p-3 text-white hover:bg-white/35">
              <ChevronLeft size={24} />
            </button>
            <button type="button" aria-label="Foto successiva" onClick={() => go(1)} className="absolute right-3 rounded-full bg-white/20 p-3 text-white hover:bg-white/35">
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>
      <p className="px-4 py-3 text-center text-xs text-white/60">Foto: {p.credit} · Wikimedia Commons</p>
    </div>
  );
}

// ── La scheda di una meta: galleria, curiosità a rotazione, cosa vivere, quando andare, itinerario ──
function DestinationDetail({ x, dreamed, onDream }: { x: NextTripIdea; dreamed: boolean; onDream: () => void }) {
  const [photo, setPhoto] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const [tip, setTip] = useState(0);
  const tips = [
    ...x.facts.map((text) => ({ kind: "fact" as const, text })),
    ...x.food.map((text) => ({ kind: "food" as const, text })),
  ];
  const t = tips[tip % Math.max(tips.length, 1)];
  const main = x.photos[photo];

  return (
    <div className="gr-fade">
      <div className="relative h-80 overflow-hidden bg-gradient-to-br from-[#243f66] to-[#c58f2d] sm:h-[430px]">
        {main && (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={main.src} src={main.src} alt={main.title} referrerPolicy="no-referrer" className="gr-fade absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />
        <button type="button" onClick={() => setZoom(photo)} className="absolute inset-0" aria-label="Guarda la foto a tutto schermo" />
        {x.season && (
          <span
            className={`pointer-events-none absolute left-4 top-4 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold shadow ${
              x.season.now ? "bg-[#f2c14e] text-[#3a2a06]" : "bg-white/90 text-[#233c5e]"
            }`}
          >
            <Sun size={15} /> {x.season.text}
          </span>
        )}
        <button
          type="button"
          onClick={onDream}
          aria-pressed={dreamed}
          aria-label={dreamed ? "Nei tuoi sogni" : "Lo sogno"}
          className={`absolute right-4 top-4 flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold shadow transition active:scale-95 ${
            dreamed ? "bg-[#e0475b] text-white" : "bg-white/90 text-[#233c5e] hover:bg-white"
          }`}
        >
          <Heart size={16} className={dreamed ? "fill-current" : ""} />
          <span className="hidden sm:inline">{dreamed ? "Nei tuoi sogni" : "Lo sogno"}</span>
        </button>
        {x.photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Foto precedente"
              onClick={() => setPhoto((p) => (p - 1 + x.photos.length) % x.photos.length)}
              className="absolute left-2 top-[38%] -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur hover:bg-black/50"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              aria-label="Foto successiva"
              onClick={() => setPhoto((p) => (p + 1) % x.photos.length)}
              className="absolute right-2 top-[38%] -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur hover:bg-black/50"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 sm:p-7">
          {x.because && (
            <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-white/85">
              <Sparkles size={14} /> Ispirata al tuo viaggio: {x.because}
            </p>
          )}
          <h3 className="text-4xl leading-tight text-white drop-shadow sm:text-5xl">{x.name}</h3>
          <p className="mt-2 max-w-xl text-base italic leading-snug text-white/90 sm:text-lg">{x.tagline}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-white/70">
            <Expand size={12} /> {main?.title}<span className="hidden sm:inline"> · tocca la foto per ingrandirla</span>
          </p>
        </div>
      </div>
      {x.photos.length > 1 && (
        <div className="grid grid-cols-4 gap-1.5 bg-[#f6efe2] p-1.5">
          {x.photos.map((p, i) => (
            <button
              key={p.src}
              type="button"
              onClick={() => setPhoto(i)}
              aria-label={p.title}
              className={`relative h-16 w-full overflow-hidden rounded-lg sm:h-24 ${i === photo ? "ring-2 ring-[#c58f2d] ring-offset-1" : "opacity-70 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 p-5 sm:grid-cols-[1.15fr_1fr] sm:p-7">
        <div className="space-y-5">
          {t && (
            <div className="rounded-2xl border-l-4 border-[#c58f2d] bg-[#fbf6ec] p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#8a6418]">
                {t.kind === "fact" ? <Lightbulb size={18} /> : <UtensilsCrossed size={17} />}
                {t.kind === "fact" ? "Lo sapevi?" : "A tavola"}
              </p>
              <p key={tip} className="gr-fade min-h-[3.5rem] text-sm leading-relaxed text-slate-700">
                {t.text}
              </p>
              {tips.length > 1 && (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex gap-1">
                    {tips.map((_, i) => (
                      <span key={i} className={`h-1.5 rounded-full transition-all ${i === tip % tips.length ? "w-5 bg-[#c58f2d]" : "w-1.5 bg-[#e6d7bb]"}`} />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setTip((v) => v + 1)}
                    className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#8a6418] shadow-sm hover:bg-[#fff8ea]"
                  >
                    Un&apos;altra curiosità <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
          {x.experiences.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Da vivere</p>
              <div className="flex flex-wrap gap-2">
                {x.experiences.map((e) => (
                  <span key={e} className="rounded-full border border-[#e6d7bb] bg-white px-3 py-1.5 text-xs text-[#233c5e]">
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <p className="flex gap-3 text-sm text-slate-700">
            <CalendarHeart size={20} className="mt-0.5 shrink-0 text-[#c58f2d]" />
            <span>
              <span className="block text-xs font-semibold text-slate-500">Quando andare</span>
              {x.bestPeriod}
            </span>
          </p>
          <p className="flex gap-3 text-sm text-slate-700">
            <Plane size={20} className="mt-0.5 shrink-0 text-[#c58f2d]" />
            <span>
              <span className="block text-xs font-semibold text-slate-500">Volo dall&apos;Italia</span>
              {x.flight}
            </span>
          </p>
          <div className="flex gap-3 text-sm text-slate-700">
            <MapPinned size={20} className="mt-0.5 shrink-0 text-[#c58f2d]" />
            <div>
              <span className="block text-xs font-semibold text-slate-500">Un itinerario per iniziare</span>
              <p className="font-semibold text-slate-900">
                {x.itinerary.title} <span className="font-normal text-[#a87a1e]">· {x.itinerary.days} giorni</span>
              </p>
              <p className="text-xs text-[#233c5e]">{x.itinerary.route}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{x.itinerary.description}</p>
            </div>
          </div>
          <div className="mt-auto pt-2">
            <RequestQuoteButton size="lg" title={`${x.name}: ${x.itinerary.title} (${x.itinerary.days} giorni)`} />
          </div>
        </div>
      </div>
      {zoom !== null && <Lightbox photos={x.photos} start={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

// ── Gioco: indovina la meta dalla foto ──
type Round = { answer: DestinationLite; photo: string; options: DestinationLite[] };
function GuessGame({ pool, onOpen }: { pool: DestinationLite[]; onOpen: (code: string) => void }) {
  const [round, setRound] = useState<Round | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ played: 0, right: 0, streak: 0 });
  const bestRaw = useSyncExternalStore(subscribe, () => readKey(BEST, "0"), () => "0");
  const best = Number(bestRaw) || 0;

  const next = () => {
    const [answer, ...others] = shuffle(pool);
    const options = shuffle([answer, ...others.slice(0, 3)]);
    setRound({ answer, photo: answer.photos[Math.floor(Math.random() * answer.photos.length)], options });
    setPicked(null);
  };
  const choose = (code: string) => {
    if (!round || picked) return;
    setPicked(code);
    const right = code === round.answer.code;
    const streak = right ? score.streak + 1 : 0;
    setScore({ played: score.played + 1, right: score.right + (right ? 1 : 0), streak });
    if (streak > best) writeKey(BEST, String(streak));
  };

  if (pool.length < 4) return null;
  return (
    <div className="overflow-hidden rounded-3xl border border-[#e6d7bb] bg-[#233c5e] text-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e4cc98]">Gioco</p>
          <h3 className="text-2xl text-white">Indovina la meta</h3>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/80">
          {score.played > 0 && (
            <span>
              {score.right}/{score.played} · serie {score.streak}
            </span>
          )}
          <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
            <Trophy size={14} className="text-[#f2c14e]" /> Record {best}
          </span>
        </div>
      </div>
      {!round ? (
        <div className="px-5 pb-6 pt-3">
          <p className="text-sm text-white/80">Ti mostriamo una foto: riconosci il paese? Ogni risposta svela una curiosità.</p>
          <button type="button" onClick={next} className="mt-4 rounded-full bg-[#f2c14e] px-5 py-2.5 text-sm font-semibold text-[#3a2a06] hover:bg-[#f5cd68]">
            Gioca
          </button>
        </div>
      ) : (
        <div className="p-5 pt-3">
          <div className="relative h-56 overflow-hidden rounded-2xl bg-white/10 sm:h-72">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={round.photo} src={round.photo} alt="" referrerPolicy="no-referrer" className="gr-fade h-full w-full object-cover" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {round.options.map((o) => {
              const isAnswer = o.code === round.answer.code;
              const state = !picked ? "idle" : isAnswer ? "right" : o.code === picked ? "wrong" : "off";
              return (
                <button
                  key={o.code}
                  type="button"
                  disabled={Boolean(picked)}
                  onClick={() => choose(o.code)}
                  className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${
                    state === "idle"
                      ? "bg-white/10 hover:bg-white/20"
                      : state === "right"
                        ? "bg-emerald-500 text-white"
                        : state === "wrong"
                          ? "bg-[#e0475b] text-white"
                          : "bg-white/5 text-white/50"
                  }`}
                >
                  {o.name}
                </button>
              );
            })}
          </div>
          {picked && (
            <div className="gr-fade mt-4 rounded-2xl bg-white/10 p-4">
              <p className="font-semibold">{picked === round.answer.code ? "Esatto! 🎉" : `Era ${round.answer.name}!`}</p>
              {round.answer.fact && <p className="mt-1 text-sm text-white/85">{round.answer.fact}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={next} className="rounded-full bg-[#f2c14e] px-4 py-2 text-sm font-semibold text-[#3a2a06]">
                  Prossima foto
                </button>
                <button type="button" onClick={() => onOpen(round.answer.code)} className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25">
                  Scopri {round.answer.name}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tutta la sezione ──
export default function NextTripShowcase({ ideas, pool, hasVisited }: { ideas: NextTripIdea[]; pool: DestinationLite[]; hasVisited: boolean }) {
  const [active, setActive] = useState(0);
  const [dreams, setDreams] = useStoredList(DREAMS);
  const [explored, setExplored] = useStoredList(EXPLORED);
  const [mood, setMood] = useState<Mood | "ora" | null>(null);
  const [shown, setShown] = useState(6);
  const [open, setOpen] = useState<NextTripIdea | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [sending, startSend] = useTransition();

  const toggleDream = (code: string) => setDreams(dreams.includes(code) ? dreams.filter((c) => c !== code) : [...dreams, code]);
  const markExplored = (code: string) => {
    if (!explored.includes(code)) setExplored([...explored, code]);
  };
  const nameOf = (code: string) => pool.find((p) => p.code === code)?.name ?? ideas.find((i) => i.code === code)?.name ?? code;

  const openDestination = async (code: string) => {
    markExplored(code);
    const ready = ideas.find((i) => i.code === code);
    if (ready) return setOpen(ready);
    setLoading(code);
    const d = await getDestinationDetail(code);
    setLoading(null);
    if (d) setOpen(d);
  };

  const filtered = pool.filter((p) => (mood === "ora" ? p.seasonNow : mood ? p.moods.includes(mood) : true));
  const surprise = () => {
    const list = filtered.length ? filtered : pool;
    const fresh = list.filter((p) => !explored.includes(p.code));
    const from = fresh.length ? fresh : list;
    void openDestination(from[Math.floor(Math.random() * from.length)].code);
  };
  const x = ideas[active];
  const exploredCount = pool.filter((p) => explored.includes(p.code)).length;
  const moods = (Object.keys(MOOD_LABELS) as Mood[]).filter((m) => pool.some((p) => p.moods.includes(m)));

  return (
    <section className="mt-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a87a1e]">Idee per te</p>
      <h2 className="mt-1 text-2xl text-[#233c5e] sm:text-3xl">Il tuo prossimo viaggio</h2>
      <p className="mb-4 mt-1 text-sm text-slate-600">
        {hasVisited ? "Scelto in base ai paesi che hai già visitato." : "Qualche idea per la prossima partenza."} La tua agenzia lo prepara su misura per te.
      </p>

      {ideas.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {ideas.map((o, i) => (
            <button
              key={o.code}
              type="button"
              onClick={() => {
                setActive(i);
                markExplored(o.code);
              }}
              className={`flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-4 text-sm font-semibold transition ${
                i === active ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#233c5e] hover:border-[#c58f2d]"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.photos[0]?.src} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
              {o.name}
            </button>
          ))}
        </div>
      )}

      <article className="overflow-hidden rounded-3xl border border-[#e6d7bb] bg-white shadow-sm">
        <DestinationDetail key={x.code} x={x} dreamed={dreams.includes(x.code)} onDream={() => toggleDream(x.code)} />
      </article>

      {/* Esploratore: tutte le mete, con filtri e «Sorprendimi» */}
      <div className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#a87a1e]">
              <Compass size={14} /> Esplora il mondo
            </p>
            <h3 className="mt-1 text-2xl text-[#233c5e]">Che viaggio sogni?</h3>
          </div>
          <button
            type="button"
            onClick={surprise}
            className="flex items-center gap-2 rounded-full bg-[#c58f2d] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#ad7c22] active:scale-95"
          >
            <Dices size={18} /> Sorprendimi
          </button>
        </div>
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Hai scoperto <strong className="text-[#233c5e]">{exploredCount}</strong> mete su {pool.length}
            </span>
            {exploredCount >= pool.length && <span className="font-semibold text-[#a87a1e]">Giramondo! 🌍</span>}
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#efe3cc]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#c58f2d] to-[#f2c14e] transition-all" style={{ width: `${(exploredCount / Math.max(pool.length, 1)) * 100}%` }} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { key: null, label: "Tutte" },
            { key: "ora" as const, label: "☀️ Perfette adesso" },
            ...moods.map((m) => ({ key: m, label: MOOD_LABELS[m] })),
          ].map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => {
                setMood(c.key);
                setShown(6);
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                mood === c.key ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#233c5e] hover:border-[#c58f2d]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.slice(0, shown).map((p) => (
            <div key={p.code} className="group relative overflow-hidden rounded-2xl border border-[#e6d7bb] bg-white shadow-sm">
              <button type="button" onClick={() => void openDestination(p.code)} className="block w-full text-left">
                <div className="relative h-32 overflow-hidden bg-gradient-to-br from-[#243f66] to-[#c58f2d] sm:h-40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.photos[0]} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <span className="absolute bottom-2 left-3 right-3 text-lg font-semibold leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
                    {p.name}
                  </span>
                  {loading === p.code && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Loader2 className="animate-spin text-white" />
                    </span>
                  )}
                  {explored.includes(p.code) && (
                    <span className="absolute left-2 top-2 rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-[#233c5e]">Scoperta</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-xs text-slate-600">{p.tagline}</p>
                </div>
              </button>
              <button
                type="button"
                aria-label={dreams.includes(p.code) ? "Togli dai sogni" : "Aggiungi ai sogni"}
                onClick={() => toggleDream(p.code)}
                className={`absolute right-2 top-2 rounded-full p-2 shadow transition active:scale-90 ${dreams.includes(p.code) ? "bg-[#e0475b] text-white" : "bg-white/85 text-[#233c5e]"}`}
              >
                <Heart size={16} className={dreams.includes(p.code) ? "fill-current" : ""} />
              </button>
            </div>
          ))}
        </div>
        {filtered.length === 0 && <p className="mt-4 text-sm text-slate-500">Nessuna meta con questo filtro: prova un&apos;altra atmosfera.</p>}
        {filtered.length > shown && (
          <div className="mt-4 text-center">
            <button type="button" onClick={() => setShown((s) => s + 6)} className="rounded-full border border-[#e6d7bb] bg-white px-5 py-2 text-sm font-semibold text-[#233c5e] hover:border-[#c58f2d]">
              Mostrane altre ({filtered.length - shown})
            </button>
          </div>
        )}
      </div>

      {/* I sogni salvati, da mandare all'agenzia */}
      {dreams.length > 0 && (
        <div className="mt-8 rounded-3xl border border-[#f3c6cc] bg-[#fff5f6] p-5">
          <p className="flex items-center gap-2 text-lg font-semibold text-[#9b2c3c]">
            <Heart size={18} className="fill-current" /> I tuoi sogni di viaggio
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {dreams.map((c) => (
              <span key={c} className="flex items-center gap-1 rounded-full bg-white py-1 pl-3 pr-1 text-sm text-[#233c5e] shadow-sm">
                <button type="button" onClick={() => void openDestination(c)} className="font-semibold hover:underline">
                  {nameOf(c)}
                </button>
                <button type="button" aria-label={`Togli ${nameOf(c)}`} onClick={() => toggleDream(c)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
          {sent ? (
            <p className="mt-3 text-sm text-emerald-700">{sent}</p>
          ) : (
            <button
              type="button"
              disabled={sending}
              onClick={() =>
                startSend(async () => {
                  const names = dreams.map(nameOf).join(", ");
                  const r = await requestQuote(`I miei sogni di viaggio: ${names}`.slice(0, 200), "Mi piacerebbe ricevere qualche idea per queste mete.");
                  setSent(r.ok ? "Fatto! La tua agenzia ha ricevuto i tuoi sogni e ti proporrà qualcosa." : (r.error ?? "Errore"));
                })
              }
              className="mt-4 flex items-center gap-2 rounded-full bg-[#9b2c3c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#82222f] disabled:opacity-60"
            >
              <Send size={15} /> {sending ? "Invio…" : "Manda i miei sogni all'agenzia"}
            </button>
          )}
        </div>
      )}

      <div className="mt-10">
        <GuessGame pool={pool} onOpen={(c) => void openDestination(c)} />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#17283f]/60 p-2 backdrop-blur-sm sm:p-6" onClick={() => setOpen(null)}>
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#f2e2c4] px-4 py-2.5">
              <button type="button" onClick={() => setOpen(null)} className="flex items-center gap-1 text-sm font-semibold text-[#233c5e] hover:text-[#c58f2d]">
                <ChevronLeft size={18} /> Torna alle mete
              </button>
              <button type="button" aria-label="Chiudi" onClick={() => setOpen(null)} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <DestinationDetail key={open.code} x={open} dreamed={dreams.includes(open.code)} onDream={() => toggleDream(open.code)} />
          </div>
        </div>
      )}
    </section>
  );
}
