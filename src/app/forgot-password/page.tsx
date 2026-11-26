"use client";

import { CLIENT_LOGIN, PRO_LOGIN } from "@/lib/areas";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthBrandHeader from "@/components/AuthBrandHeader";
import AuthShell from "@/components/AuthShell";
import { useI18n } from "@/components/I18nProvider";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPassword />
    </Suspense>
  );
}

function ForgotPassword() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, undefined);
  const { t } = useI18n();
  // chi arriva dall'accesso dei professionisti torna lì, gli altri all'area clienti
  const back = useSearchParams().get("area") === "professionisti" ? PRO_LOGIN : CLIENT_LOGIN;

  if (state?.success) {
    return (
      <AuthShell>
        <div className="text-center">
          <AuthBrandHeader />
          <h1 className="mb-2 text-xl font-semibold text-slate-900">{t("auth.checkEmail")}</h1>
          <p className="text-sm text-slate-500">
            {t("auth.forgotSent")}
          </p>
          <Link href={back} className="mt-6 inline-block text-sm font-medium text-[#233c5e] hover:underline">
            {t("auth.backToLogin")}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthBrandHeader />
        <h1 className="mb-1 text-xl font-semibold text-slate-900">{t("auth.forgotTitle")}</h1>
        <p className="mb-6 text-sm text-slate-500">
          {t("auth.forgotIntro")}
        </p>

        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              {t("auth.email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
            />
          </div>

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-[#233c5e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#e6d7bb] transition hover:bg-[#17283f] disabled:opacity-60"
          >
            {pending ? t("auth.sending") : t("auth.sendLink")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href={back} className="font-medium text-[#233c5e] hover:underline">
            {t("auth.backToLogin")}
          </Link>
        </p>
    </AuthShell>
  );
}
