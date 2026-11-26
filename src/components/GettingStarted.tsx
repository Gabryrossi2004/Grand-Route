import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Sparkles, X } from "lucide-react";
import { hideOnboarding } from "@/lib/actions/onboarding";
import { progressOf, type OnboardingStep } from "@/lib/onboarding";

// Lista «Per iniziare» in cima alla Home: si spunta da sola, si può nascondere e si riapre dal menu Account.
// Sparisce da sola quando tutte le voci sono fatte.
export default function GettingStarted({
  steps,
  name,
  title = "Per iniziare",
  intro,
  hideLabel = "Nascondi",
}: {
  steps: OnboardingStep[];
  name?: string;
  title?: string;
  intro?: string;
  hideLabel?: string;
}) {
  const { done, total, complete } = progressOf(steps);
  if (complete) return null;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <section className="rounded-2xl border border-[#cda876] bg-gradient-to-b from-[#fdf6e6] to-[#faf3e6] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-medium text-[#233c5e]">
            <Sparkles size={19} className="shrink-0 text-[#c58f2d]" aria-hidden /> {title}
          </h2>
          {(intro || name) && <p className="mt-1 text-sm text-slate-600">{intro ?? `Benvenuto${name ? `, ${name}` : ""}! Pochi passi per cominciare bene.`}</p>}
        </div>
        <form action={hideOnboarding}>
          <button
            type="submit"
            aria-label={hideLabel}
            title={hideLabel}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </form>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e6d7bb]" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
          <div className="h-full rounded-full bg-[#233c5e] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-[#233c5e]">{done}/{total}</span>
      </div>

      <ul className="mt-3 grid gap-1 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className={`flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-white/80 ${s.done ? "opacity-70" : ""}`}
            >
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
    </section>
  );
}
