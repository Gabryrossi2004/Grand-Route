"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { LANGS, LANGUAGE_SWITCH_ENABLED } from "@/lib/i18n";
import { setLanguage } from "@/lib/actions/language";
import { useI18n } from "@/components/I18nProvider";

// Piccolo interruttore IT | EN.
export default function LanguageSwitch({ className = "" }: { className?: string }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!LANGUAGE_SWITCH_ENABLED) return null;

  return (
    <div
      role="group"
      aria-label={t("auth.langSwitchAria")}
      className={`inline-flex items-center gap-0.5 rounded-full border border-[#e6d7bb] bg-white p-0.5 text-xs font-semibold ${className}`}
    >
      <Globe size={12} className="ml-1.5 text-slate-400" aria-hidden />
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          disabled={pending}
          aria-pressed={lang === l.code}
          title={l.label}
          onClick={() => {
            if (lang === l.code) return;
            startTransition(async () => {
              await setLanguage(l.code);
              router.refresh();
            });
          }}
          className={`min-h-7 rounded-full px-2 py-0.5 transition ${
            lang === l.code ? "bg-[#233c5e] text-white" : "text-[#6b5f4a] hover:bg-[#faf3e6]"
          }`}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
