"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Briefcase, Compass } from "lucide-react";
import AuthBrandHeader from "@/components/AuthBrandHeader";
import AuthShell from "@/components/AuthShell";
import LanguageSwitch from "@/components/LanguageSwitch";
import { useI18n } from "@/components/I18nProvider";
import { areaHref, PRO_LOGIN } from "@/lib/areas";
import { clientsLogin } from "./actions";

const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]";

// Ingresso dei clienti: chi viaggia con un'agenzia e chi organizza il viaggio da solo, con un solo accesso.
export default function ClientsPage() {
  return (
    <Suspense>
      <ClientsLogin />
    </Suspense>
  );
}

function ClientsLogin() {
  const [state, formAction, pending] = useActionState(clientsLogin, undefined);
  const next = useSearchParams().get("next") ?? "";
  const { t } = useI18n();
  const proUrl = areaHref("pro", PRO_LOGIN);

  return (
    <AuthShell>
      <AuthBrandHeader area="client" label={t("auth.travellersLabel")} />
      <div className="mb-3 flex justify-end"><LanguageSwitch /></div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">{t("auth.clientArea")}</h1>
      <p className="mb-6 text-sm text-slate-500">{t("auth.loginIntro")}</p>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">{t("auth.email")}</label>
          <input id="email" name="email" type="email" required autoComplete="username" className={field} />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">{t("auth.password")}</label>
            <Link href="/forgot-password?area=clienti" className="text-xs font-medium text-[#233c5e] hover:underline">{t("auth.forgot")}</Link>
          </div>
          <input id="password" name="password" type="password" required autoComplete="current-password" className={field} />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
            {state.otherDoor && (
              <>
                {" "}
                <a href={proUrl} className="font-semibold underline">{t("auth.proLogin")}</a>
              </>
            )}
          </p>
        )}

        <button type="submit" disabled={pending} className="mt-2 rounded-lg bg-[#233c5e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#e6d7bb] transition hover:bg-[#17283f] disabled:opacity-60">
          {pending ? t("auth.loggingIn") : t("auth.loginButton")}
        </button>
      </form>

      <div className="mt-6">
        <p className="mb-2 text-center text-sm font-medium text-slate-800">{t("auth.firstTime")}</p>
        <div className="space-y-2">
          <Link href="/client/signup" className="flex items-start gap-3 rounded-xl border border-[#e6d7bb] p-3 text-left transition hover:border-[#c58f2d] hover:bg-[#faf3e6]">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#233c5e] text-[#faf3e6]"><Briefcase size={16} /></span>
            <span>
              <span className="block text-sm font-semibold text-[#233c5e]">{t("auth.optAgency")}</span>
              <span className="block text-xs text-slate-500">{t("auth.optAgencyHint")}</span>
            </span>
          </Link>
          <Link href="/viaggiatore/signup" className="flex items-start gap-3 rounded-xl border border-[#e6d7bb] p-3 text-left transition hover:border-[#c58f2d] hover:bg-[#faf3e6]">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#cda876] text-[#233c5e]"><Compass size={16} /></span>
            <span>
              <span className="block text-sm font-semibold text-[#233c5e]">{t("auth.optSolo")}</span>
              <span className="block text-xs text-slate-500">{t("auth.optSoloHint")}</span>
            </span>
          </Link>
        </div>
      </div>
      <p className="mt-5 text-center text-xs text-slate-500">
        {t("auth.proQ")}{" "}
        <a href={proUrl} className="font-medium hover:underline">{t("auth.proLogin")}</a>
      </p>
    </AuthShell>
  );
}
