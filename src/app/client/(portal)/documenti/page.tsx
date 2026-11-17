import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { decryptField } from "@/lib/encryption";
import type { Client } from "@/lib/types";
import ClientDetailsFields from "@/components/ClientDetailsFields";
import SubmitButton from "@/components/SubmitButton";
import { updateClientTravelDocuments } from "../actions";
import { getT } from "@/lib/i18n/server";

export default async function ClientDocumentsPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const user = await getCachedUser();

  const { data: rows } = await supabase.from("clients").select("*").eq("user_id", user?.id ?? "");
  const clients = ((rows as Client[]) || []).map((client) => ({
    ...client,
    date_of_birth: decryptField(client.date_of_birth),
    place_of_birth: decryptField(client.place_of_birth),
    nationality: decryptField(client.nationality),
    fiscal_code: decryptField(client.fiscal_code),
    residence_address: decryptField(client.residence_address),
    id_card_number: decryptField(client.id_card_number),
    id_card_expiry: decryptField(client.id_card_expiry),
    passport_number: decryptField(client.passport_number),
    passport_expiry: decryptField(client.passport_expiry),
  }));

  return (
    <div>
      <Link href="/client" className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft size={14} /> {t("portal.backToTrips")}
      </Link>
      <h1 className="mb-2 text-3xl font-medium tracking-tight text-[#233c5e]">
        {t("details.title")}
      </h1>
      <p className="mb-6 pl-3 text-sm text-slate-500">
        {t("details.intro")}
      </p>

      {clients.length === 0 && (
        <p className="text-sm text-slate-500">{t("details.noClient")}</p>
      )}

      {clients.map((client, index) => (
        <form key={client.id} action={updateClientTravelDocuments.bind(null, client.id)} className="mb-6">
          {clients.length > 1 && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("details.recordOf", { n: index + 1, total: clients.length })}
            </p>
          )}
          <ClientDetailsFields client={client} defaultOpen summaryLabel={t("details.summary")} />
          <div className="mt-3 flex justify-end">
            <SubmitButton
              pendingLabel={t("common.saving")}
              className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
            >
              {t("common.save")}
            </SubmitButton>
          </div>
        </form>
      ))}
    </div>
  );
}
