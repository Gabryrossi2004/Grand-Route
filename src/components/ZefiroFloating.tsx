"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { EyeOff, Route, Settings, Wand2 } from "lucide-react";
import Zefiro from "@/components/Zefiro";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { setAvatarVisible } from "@/app/dashboard/settings/actions";

const POSITION_KEY = "zefiro:pos";
const SEEN_KEY = "zefiro:seen";
const MARGIN = 8;
const DRAG_THRESHOLD = 6;

// Eventi con cui il personaggio chiede alle pagine di aprire le loro finestre.
export const ZEFIRO_ACTION_EVENT = "zefiro:action";
export const ZEFIRO_RESET_EVENT = "zefiro:reset-position";
export type ZefiroAction = "new-trip" | "trip-assist";

export function triggerZefiroAction(action: ZefiroAction) {
  window.dispatchEvent(new CustomEvent<ZefiroAction>(ZEFIRO_ACTION_EVENT, { detail: action }));
}

type Position = { x: number; y: number };

function readStored(): { fx: number; fy: number } | null {
  try {
    const raw = window.localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.fx === "number" && typeof parsed?.fy === "number" ? parsed : null;
  } catch {
    return null;
  }
}

// Zefiro che fluttua sullo schermo: piccolo e discreto, si trascina dove si
// vuole (la posizione viene ricordata su questo dispositivo) e, con un clic,
// apre le sue azioni. Si nasconde dalle Impostazioni (o dal suo menu).
export default function ZefiroFloating() {
  const pathname = usePathname();
  const router = useRouter();

  const [size, setSize] = useState(96);
  const [pos, setPos] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mood, setMood] = useState<"idle" | "happy">("idle");
  const [hint, setHint] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const fractions = useRef<{ fx: number; fy: number } | null>(null);

  const clamp = useCallback(
    (x: number, y: number, s: number): Position => ({
      x: Math.min(Math.max(x, MARGIN), Math.max(MARGIN, window.innerWidth - s - MARGIN)),
      y: Math.min(Math.max(y, MARGIN), Math.max(MARGIN, window.innerHeight - s - MARGIN)),
    }),
    [],
  );

  // Calcola la posizione in pixel dalla posizione salvata (in frazioni dello
  // schermo, così resta sensata se cambia la finestra) o dal basso a destra.
  const place = useCallback(
    (s: number) => {
      const stored = fractions.current;
      const spaceX = Math.max(window.innerWidth - s - MARGIN * 2, 0);
      const spaceY = Math.max(window.innerHeight - s - MARGIN * 2, 0);
      if (stored) setPos(clamp(MARGIN + stored.fx * spaceX, MARGIN + stored.fy * spaceY, s));
      else setPos(clamp(window.innerWidth - s - 20, window.innerHeight - s - 28, s));
    },
    [clamp],
  );

  useEffect(() => {
    fractions.current = readStored();
    const apply = () => {
      const s = window.innerWidth < 640 ? 76 : 96;
      setSize(s);
      place(s);
    };
    apply();
    window.addEventListener("resize", apply);

    const reset = () => {
      fractions.current = null;
      try {
        window.localStorage.removeItem(POSITION_KEY);
      } catch {}
      apply();
    };
    window.addEventListener(ZEFIRO_RESET_EVENT, reset);

    // Primo saluto, una volta sola
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!window.localStorage.getItem(SEEN_KEY)) {
        showTimer = setTimeout(() => setHint(true), 1200);
        hideTimer = setTimeout(() => {
          setHint(false);
          window.localStorage.setItem(SEEN_KEY, "1");
        }, 9000);
      }
    } catch {}

    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener(ZEFIRO_RESET_EVENT, reset);
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [place]);

  // Chiude il menu con Esc o cliccando altrove
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    const onDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [menuOpen]);

  function celebrate() {
    setMood("happy");
    setTimeout(() => setMood("idle"), 1600);
  }

  function dismissHint() {
    if (!hint) return;
    setHint(false);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!pos || event.button > 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startY: event.clientY, originX: pos.x, originY: pos.y, moved: false };
    dismissHint();
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      state.moved = true;
      setDragging(true);
      setMenuOpen(false);
    }
    if (state.moved) setPos(clamp(state.originX + dx, state.originY + dy, size));
  }

  function finishDrag(event: React.PointerEvent<HTMLDivElement>, cancelled = false) {
    const state = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!state) return;
    if (state.moved) {
      setDragging(false);
      if (pos) {
        const spaceX = Math.max(window.innerWidth - size - MARGIN * 2, 1);
        const spaceY = Math.max(window.innerHeight - size - MARGIN * 2, 1);
        fractions.current = { fx: (pos.x - MARGIN) / spaceX, fy: (pos.y - MARGIN) / spaceY };
        try {
          window.localStorage.setItem(POSITION_KEY, JSON.stringify(fractions.current));
        } catch {}
      }
      celebrate();
    } else if (!cancelled) {
      setMenuOpen((open) => !open);
      celebrate();
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setMenuOpen((open) => !open);
    }
  }

  async function hide() {
    setMenuOpen(false);
    await setAvatarVisible(false);
    router.refresh();
  }

  function startNewTrip() {
    setMenuOpen(false);
    if (pathname === "/dashboard/trips/new") triggerZefiroAction("new-trip");
    else router.push("/dashboard/trips/new?zefiro=1");
  }

  function helpWithTrip() {
    setMenuOpen(false);
    triggerZefiroAction("trip-assist");
  }

  if (!pos) return null;

  const onTripPage = /^\/dashboard\/trips\/(?!new(\/|$))[^/]+\/?$/.test(pathname);
  // Il menu si apre dal lato dove c'è più spazio
  const menuBelow = pos.y < window.innerHeight / 2;
  const menuRight = pos.x > window.innerWidth / 2;

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-[#faf3e6]";

  return (
    <div
      ref={containerRef}
      className="fixed z-40 print:hidden"
      style={{ left: pos.x, top: pos.y, width: size, height: size, touchAction: "none" }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`${ASSISTANT_NAME}: trascinami o clicca per chiedere aiuto`}
        aria-expanded={menuOpen}
        title={`${ASSISTANT_NAME}: trascinami dove vuoi, clicca per chiedermi aiuto`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => finishDrag(event)}
        onPointerCancel={(event) => finishDrag(event, true)}
        onKeyDown={onKeyDown}
        className={`select-none rounded-full outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-[#cda876] ${
          dragging ? "cursor-grabbing opacity-100" : "cursor-grab opacity-95 hover:opacity-100"
        }`}
        style={{ width: size, height: size, filter: "drop-shadow(0 6px 8px rgba(35, 60, 94, 0.22))" }}
      >
        <div className="pointer-events-none">
          <Zefiro size={size} state={mood} />
        </div>
      </div>

      {hint && !menuOpen && (
        <div
          className={`pointer-events-none absolute w-52 rounded-2xl bg-white px-3 py-2 text-xs leading-snug text-slate-700 shadow-lg ring-1 ring-[#e6d7bb] ${
            menuBelow ? "top-full mt-2" : "bottom-full mb-2"
          } ${menuRight ? "right-0" : "left-0"}`}
        >
          Ciao, sono <strong>{ASSISTANT_NAME}</strong>! Trascinami dove vuoi e cliccami quando ti serve una mano.
        </div>
      )}

      {menuOpen && (
        <div
          role="menu"
          className={`absolute w-64 rounded-2xl border border-[#e6d7bb] bg-white p-2 shadow-xl ${
            menuBelow ? "top-full mt-2" : "bottom-full mb-2"
          } ${menuRight ? "right-0" : "left-0"}`}
        >
          <p className="px-3 pb-1 pt-1.5 text-xs text-slate-500">Ciao! Come posso aiutarti?</p>
          <button type="button" role="menuitem" onClick={startNewTrip} className={itemClass}>
            <Route size={16} className="shrink-0 text-[#233c5e]" />
            Creami un viaggio
          </button>
          {onTripPage && (
            <button type="button" role="menuitem" onClick={helpWithTrip} className={itemClass}>
              <Wand2 size={16} className="shrink-0 text-[#233c5e]" />
              Aiutami con questo viaggio
            </button>
          )}
          <div className="my-1 border-t border-[#f2e2c4]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              router.push("/dashboard/settings#zefiro");
            }}
            className={itemClass}
          >
            <Settings size={16} className="shrink-0 text-slate-500" />
            Impostazioni di {ASSISTANT_NAME}
          </button>
          <button type="button" role="menuitem" onClick={hide} className={itemClass}>
            <EyeOff size={16} className="shrink-0 text-slate-500" />
            <span>
              Nascondimi
              <span className="block text-[11px] text-slate-500">Mi riattivi da Impostazioni</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
