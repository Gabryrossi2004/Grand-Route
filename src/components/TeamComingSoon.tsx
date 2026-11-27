import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";

// Sezioni riservate a chi ha aperto l'account o ai titolari.
export default function TeamComingSoon({
  title = "In arrivo per i collaboratori",
  text = "Questa sezione per ora la usa solo chi ha aperto l'account dell'agenzia.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-[#233c5e]">
        <ArrowLeft size={15} aria-hidden /> Home
      </Link>
      <section className="rounded-2xl border border-[#e6d7bb] bg-white p-6 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#faf3e6] text-[#c58f2d]">
          <Users size={22} aria-hidden />
        </span>
        <h1 className="mt-3 text-2xl font-medium tracking-tight text-[#233c5e]">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{text}</p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex rounded-full bg-[#233c5e] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1b2f4a]"
        >
          Torna alla Home
        </Link>
      </section>
    </div>
  );
}

export const ONLY_TITOLARE_TEXT = "Questa sezione la vede solo il titolare dell'agenzia. Se ti serve, chiedi a lui di darti il ruolo di titolare.";
