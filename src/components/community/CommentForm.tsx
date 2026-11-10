"use client";

import { useActionState, useEffect, useRef } from "react";

export default function CommentForm({
  action,
}: {
  action: (prevState: { error?: string } | undefined, formData: FormData) => Promise<{ error?: string }>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const prevStateRef = useRef(state);

  useEffect(() => {
    if (state !== prevStateRef.current && !state?.error) {
      formRef.current?.reset();
    }
    prevStateRef.current = state;
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-2 flex items-start gap-2">
      <input
        type="text"
        name="body"
        required
        placeholder="Scrivi un commento…"
        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
      />
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded-lg bg-[#2b333e] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1e242d] disabled:opacity-60"
      >
        Invia
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
