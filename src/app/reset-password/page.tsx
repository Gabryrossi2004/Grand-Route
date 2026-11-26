"use client";

import { areaHref, CLIENT_LOGIN, PRO_LOGIN } from "@/lib/areas";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import AuthBrandHeader from "@/components/AuthBrandHeader";
import AuthShell from "@/components/AuthShell";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { t } = useI18n();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(t("auth.passwordShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.mismatch"));
      return;
    }

    setStatus("loading");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setStatus("idle");
      setError(t("auth.updateFailed"));
      return;
    }

    // Capiamo da che parte sta chi ha reimpostato la password (cliente, viaggiatore o professionista) prima di
    // disconnetterlo, così il passo successivo lo porta alla sua porta d'accesso.
    const { data: auth } = await supabase.auth.getUser();
    const [{ data: me }, { data: linkedClient }] = await Promise.all([
      supabase.from("profiles").select("is_professional, is_traveler").eq("id", auth.user?.id ?? "").maybeSingle(),
      supabase.from("clients").select("id").limit(1).maybeSingle(),
    ]);
    const flags = me as { is_professional?: boolean | null; is_traveler?: boolean | null } | null;
    setIsClient(Boolean(flags?.is_traveler) || flags?.is_professional === false || Boolean(linkedClient));

    await supabase.auth.signOut();
    setStatus("success");
  }

  if (status === "success") {
    return (
      <AuthShell>
        <div className="text-center">
          <AuthBrandHeader />
          <h1 className="mb-2 text-xl font-semibold text-slate-900">{t("auth.passwordUpdated")}</h1>
          <p className="mb-6 text-sm text-slate-500">{t("auth.passwordUpdatedText")}</p>
          <Link
            href={isClient ? CLIENT_LOGIN : PRO_LOGIN}
            className="inline-block rounded-lg bg-[#233c5e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#e6d7bb] transition hover:bg-[#17283f]"
          >
            {t("auth.goLogin")}
          </Link>
          <p className="mt-4 text-xs text-slate-500">
            {isClient ? (
              <>
                {t("auth.proQ")}{" "}
                <a href={areaHref("pro", PRO_LOGIN)} className="font-medium hover:underline">
                  {t("auth.proLogin")}
                </a>
              </>
            ) : (
              <>
                {t("auth.clientAreaQ")}{" "}
                <a href={areaHref("client", CLIENT_LOGIN)} className="font-medium hover:underline">
                  {t("auth.agencyLogin")}
                </a>
              </>
            )}
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthBrandHeader />
        <h1 className="mb-1 text-xl font-semibold text-slate-900">{t("auth.newPasswordTitle")}</h1>
        <p className="mb-6 text-sm text-slate-500">{t("auth.newPasswordHint")}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              {t("auth.newPassword")}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-slate-700">
              {t("auth.repeatPassword")}
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={status === "loading"}
            className="mt-2 rounded-lg bg-[#233c5e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#e6d7bb] transition hover:bg-[#17283f] disabled:opacity-60"
          >
            {status === "loading" ? t("common.saving") : t("auth.saveNewPassword")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="font-medium text-[#233c5e] hover:underline">
            {t("auth.backToLogin")}
          </Link>
        </p>
    </AuthShell>
  );
}
