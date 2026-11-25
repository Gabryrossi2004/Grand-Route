import { ShieldAlert } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import AuthBrandHeader from "@/components/AuthBrandHeader";
import { signOut } from "@/lib/actions/auth";
import { getSuspension } from "@/lib/suspension";

export const metadata = { title: "Account sospeso" };

// Dove finisce chi è stato sospeso dall'amministrazione
export default async function SuspendedPage() {
  const s = await getSuspension();
  return (
    <AuthShell>
      <div className="text-center">
        <AuthBrandHeader />
        <ShieldAlert className="mx-auto mb-3 text-[#b0413e]" size={36} />
        <h1 className="mb-2 text-xl font-semibold text-slate-900">Account sospeso</h1>
        <p className="text-sm text-slate-600">
          Il tuo account è stato sospeso dal team di Grand Route.
          {s?.reason ? ` Motivo: ${s.reason}.` : ""}
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Per capire come riattivarlo scrivi a{" "}
          <a href="mailto:privacy@grandroute.it" className="font-medium text-[#233c5e] hover:underline">
            privacy@grandroute.it
          </a>
          .
        </p>
        <form action={signOut} className="mt-6">
          <button type="submit" className="rounded-lg border border-[#e6d7bb] bg-white px-5 py-2 text-sm font-semibold text-[#233c5e] hover:bg-[#faf3e6]">
            Esci
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
