"use client";

import { useActionState } from "react";
import Link from "next/link";
import AuthBrandHeader from "@/components/AuthBrandHeader";
import AuthShell from "@/components/AuthShell";
import LanguageSwitch from "@/components/LanguageSwitch";
import { useI18n } from "@/components/I18nProvider";
import { clientSignup } from "./actions";

export default function ClientSignupPage() {
  const [state, formAction, pending] = useActionState(clientSignup, undefined);
  const { t } = useI18n();

  if (state?.success) {
    return (
      <AuthShell>
        <div className="text-center">
          <AuthBrandHeader />
          <h1 className="mb-2 text-xl font-semibold text-slate-900">{t("auth.checkEmail")}</h1>
          <p className="text-sm text-slate-500">
            {t("auth.checkEmailText")}
          </p>
          <Link href="/client/login" className="mt-6 inline-block text-sm font-medium text-[#233c5e] hover:underline">
            {t("auth.goLogin")}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthBrandHeader />
        <div className="mb-3 flex justify-end"><LanguageSwitch /></div>
        <h1 className="mb-1 text-xl font-semibold text-slate-900">{t("auth.clientArea")}</h1>
        <p className="mb-6 text-sm text-slate-500">{t("auth.signupIntro")}</p>

        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-slate-700">
              {t("auth.fullName")}
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
            />
          </div>
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
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              {t("auth.password")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              name="acceptTerms"
              required
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#233c5e] focus:ring-[#cda876]"
            />
            <span>
              {t("auth.acceptStart")}{" "}
              <Link href="/termini" target="_blank" className="font-medium text-[#233c5e] hover:underline">
                {t("auth.terms")}
              </Link>{" "}
              {" "}{t("auth.acceptAnd")}{" "}
              <Link href="/privacy" target="_blank" className="font-medium text-[#233c5e] hover:underline">
                {t("auth.privacy")}
              </Link>{" "}
              <span className="text-slate-400">{t("auth.legalNote")}</span>
            </span>
          </label>

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-[#233c5e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#e6d7bb] transition hover:bg-[#17283f] disabled:opacity-60"
          >
            {pending ? t("auth.signingUp") : t("auth.register")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {t("auth.haveAccount")}{" "}
          <Link href="/client/login" className="font-medium text-[#233c5e] hover:underline">
            {t("auth.loginButton")}
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-500">
          Organizzi il viaggio da solo?{" "}
          <Link href="/viaggiatore/signup" className="font-medium text-slate-500 hover:underline">
            Area viaggiatori
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-500">
          {t("auth.isAgency")}{" "}
          <Link href="/signup" className="font-medium text-slate-500 hover:underline">
            {t("auth.agencySignup")}
          </Link>
        </p>
    </AuthShell>
  );
}
