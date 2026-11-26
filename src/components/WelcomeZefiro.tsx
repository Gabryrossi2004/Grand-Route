"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Circle, Pointer, Sparkles, X } from "lucide-react";
import Zefiro from "@/components/Zefiro";
import { markOnboardingSeen } from "@/lib/actions/onboarding";
import { progressOf, type OnboardingStep } from "@/lib/onboarding";

export type WelcomeLabels = {
  hello: string; // saluto (già con il nome)
  intro: string; // «Sono Zefiro…»
  explain: string; // spiega il pulsante
  cta: string; // testo del pulsante
  listDone: string; // dopo il clic sul pulsante
  listAgain: string; // lista riaperta dal menu
  skip: string;
  close: string;
};

export const defaultWelcomeLabels = (name?: string): WelcomeLabels => ({
  hello: name ? `Ciao ${name}!` : "Ciao!",
  intro: "Sono Zefiro, il tuo assistente di viaggio.",
  explain: "Per cominciare bene premi il pulsante qui sotto: ti mostro i primi passi, uno alla volta. Si spuntano da soli man mano che li fai.",
  cta: "Per iniziare",
  listDone: "Perfetto! Ecco da dove iniziare. Tocca un passo per andarci.",
  listAgain: "Ecco i tuoi primi passi. Tocca un passo per andarci.",
  skip: "Più tardi",
  close: "Chiudi",
});

// Scrive il testo lettera per lettera, come se Zefiro stesse parlando (subito intero se si preferiscono meno animazioni)
function Typed({ text, speed = 26 }: { text: string; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setN((v) => (reduced ? text.length : Math.min(v + 1, text.length)));
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden>{text.slice(0, n)}</span>
    </>
  );
}

// Primo accesso: Zefiro entra con un'animazione, si presenta e indica il pulsante «Per iniziare», che apre la lista dei primi passi.
// Compare una volta sola; la lista si riapre quando si vuole (reopen = apri direttamente la lista).
export default function WelcomeZefiro({
  steps,
  name,
  reopen = false,
  labels,
}: {
  steps: OnboardingStep[];
  name?: string;
  reopen?: boolean;
  labels?: Partial<WelcomeLabels>;
}) {
  const L = { ...defaultWelcomeLabels(name), ...labels };
  const [phase, setPhase] = useState<"hello" | "point" | "list">(reopen ? "list" : "hello");
  const [closed, setClosed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // dal saluto si passa da soli al pulsante
  useEffect(() => {
    if (phase !== "hello") return;
    const id = setTimeout(() => setPhase("point"), 3600);
    return () => clearTimeout(id);
  }, [phase]);

  const finish = () => {
    setClosed(true);
    void markOnboardingSeen();
    if (reopen) router.replace(pathname);
  };

  // Esc = «più tardi»; la pagina sotto non scorre mentre Zefiro parla
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (closed) return null;
  const { done, total } = progressOf(steps);
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={L.cta}
      className="modal-backdrop fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#17283f]/70 p-4 backdrop-blur-sm"
    >
      <div className="my-auto flex w-full max-w-md flex-col items-center">
        <div className="zf-enter">
          <div className="zf-float">
            <Zefiro size={phase === "list" ? 96 : 140} state={phase === "hello" ? "happy" : "idle"} />
          </div>
        </div>

        <div
          key={phase}
          className="zf-bubble relative mt-3 w-full rounded-3xl bg-[#fffaf0] p-5 text-center shadow-2xl ring-1 ring-[#cda876]/60"
          onClick={() => phase === "hello" && setPhase("point")}
        >
          <span aria-hidden className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-[#fffaf0]" />

          {phase === "hello" && (
            <p className="min-h-16 text-lg font-medium leading-snug text-[#233c5e]">
              <Typed text={`${L.hello} ${L.intro}`} />
            </p>
          )}

          {phase === "point" && (
            <>
              <p className="text-base leading-snug text-[#233c5e]">
                <Typed text={L.explain} speed={16} />
              </p>
              <div className="relative mt-6 mb-10 flex justify-center">
                <button
                  type="button"
                  autoFocus
                  onClick={() => {
                    void markOnboardingSeen();
                    setPhase("list");
                  }}
                  className="zf-ring relative inline-flex items-center gap-2.5 rounded-full bg-[#233c5e] px-8 py-4 text-lg font-semibold text-[#fffaf0] shadow-lg transition hover:scale-105 hover:bg-[#17283f]"
                >
                  <Sparkles size={22} className="text-[#cda876]" aria-hidden /> {L.cta}
                </button>
                <Pointer aria-hidden size={40} className="zf-point pointer-events-none absolute -bottom-10 right-[18%] fill-white text-[#233c5e] drop-shadow" />
              </div>
            </>
          )}

          {phase === "list" && (
            <div className="text-left">
              <p className="text-center text-base leading-snug text-[#233c5e]">{reopen ? L.listAgain : L.listDone}</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e6d7bb]" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
                  <div className="h-full rounded-full bg-[#233c5e] transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-[#233c5e]">{done}/{total}</span>
              </div>
              <ul className="mt-3 flex flex-col gap-1">
                {steps.map((s) => (
                  <li key={s.key}>
                    <Link href={s.href} className={`flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-[#faf3e6] ${s.done ? "opacity-70" : ""}`}>
                      {s.done === null ? (
                        <ArrowRight size={18} className="mt-0.5 shrink-0 text-[#c58f2d]" aria-hidden />
                      ) : s.done ? (
                        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />
                      ) : (
                        <Circle size={18} className="mt-0.5 shrink-0 text-[#c58f2d]" aria-hidden />
                      )}
                      <span className="min-w-0">
                        <span className={`block text-sm font-semibold text-[#233c5e] ${s.done ? "line-through decoration-[#233c5e]/30" : ""}`}>{s.label}</span>
                        <span className="block text-xs text-slate-500">{s.hint}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={finish} className="mt-4 w-full rounded-full bg-[#233c5e] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17283f]">
                {L.close}
              </button>
            </div>
          )}
        </div>

        {phase !== "list" && (
          <button type="button" onClick={finish} className="mt-4 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-[#f2e9d8] transition hover:bg-white/10">
            <X size={14} aria-hidden /> {L.skip}
          </button>
        )}
      </div>
    </div>
  );
}
