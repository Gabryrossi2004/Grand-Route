"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La password deve avere almeno 6 caratteri.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Le due password non coincidono.");
      return;
    }

    setStatus("loading");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setStatus("idle");
      setError(
        "Non è stato possibile aggiornare la password. Il link potrebbe essere scaduto: richiedine uno nuovo.",
      );
      return;
    }

    // Non possiamo sapere con certezza se chi ha reimpostato la password è
    // un'agenzia o un cliente: controlliamo se risulta collegato ad almeno
    // una scheda cliente prima di disconnetterlo, così sappiamo quale link
    // di accesso evidenziare nel passaggio successivo.
    const { data: linkedClient } = await supabase.from("clients").select("id").limit(1).maybeSingle();
    setIsClient(Boolean(linkedClient));

    await supabase.auth.signOut();
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg shadow-slate-200/50">
          <h1 className="mb-2 text-xl font-semibold text-slate-900">Password aggiornata</h1>
          <p className="mb-6 text-sm text-slate-500">Ora puoi accedere con la nuova password.</p>
          <Link
            href={isClient ? "/client/login" : "/login"}
            className="inline-block rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700"
          >
            Vai al login
          </Link>
          <p className="mt-4 text-xs text-slate-400">
            {isClient ? (
              <>
                Sei un&apos;agenzia?{" "}
                <Link href="/login" className="font-medium hover:underline">
                  Accedi qui
                </Link>
              </>
            ) : (
              <>
                Accedi all&apos;area clienti?{" "}
                <Link href="/client/login" className="font-medium hover:underline">
                  Accedi qui
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/50">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Scegli una nuova password</h1>
        <p className="mb-6 text-sm text-slate-500">Deve avere almeno 6 caratteri.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Nuova password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-slate-700">
              Ripeti la password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={status === "loading"}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-60"
          >
            {status === "loading" ? "Salvataggio…" : "Salva la nuova password"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            Torna al login
          </Link>
        </p>
      </div>
    </div>
  );
}
