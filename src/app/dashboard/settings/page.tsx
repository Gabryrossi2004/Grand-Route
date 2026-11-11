import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const user = await getCachedUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 border-l-4 border-[#233c5e] pl-3 text-2xl font-semibold text-slate-900">Impostazioni</h1>

      <Link
        href="/dashboard/settings/guida"
        className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-[#e6d7bb] bg-gradient-to-r from-[#faf3e6] to-white px-5 py-4 transition hover:shadow-sm"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#233c5e] text-white">
            <BookOpen size={16} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">Guida all&apos;uso del gestionale</span>
            <span className="block text-xs text-slate-500">
              Spiegazione passo per passo con schermate, pensata per chi parte da zero.
            </span>
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-slate-400" />
      </Link>

      <SettingsForm profile={profile as Profile} />
    </div>
  );
}
