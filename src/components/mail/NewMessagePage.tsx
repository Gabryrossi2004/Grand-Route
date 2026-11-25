import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Composer from "@/components/mail/Composer";
import type { OrderPartner } from "@/lib/orders/shared";

export default async function NewMessagePage({ base, a, oggetto }: { base: string; a?: string; oggetto?: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("network_order_partners");
  const partners = (data ?? []) as OrderPartner[];
  const to = a && partners.some((p) => p.user_id === a) ? [a] : [];
  return (
    <div>
      <Link href={base} className="mb-3 flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"><ArrowLeft size={14} /> Posta</Link>
      <h1 className="mb-4 text-3xl text-[#233c5e]">Nuovo messaggio</h1>
      <Composer base={base} partners={partners} initialTo={to} initialSubject={(oggetto ?? "").slice(0, 200)} />
    </div>
  );
}
