import { createClient, getCachedUser } from "@/lib/supabase/server";
import ClientTripsGrid, { type TripWithAgency } from "@/components/ClientTripsGrid";
import { darkenForWhiteText, mixColors, sanitizeHex } from "@/lib/brandColor";
import { getT } from "@/lib/i18n/server";

export default async function ClientHomePage() {
  const { t, locale } = await getT();
  const supabase = await createClient();
  const user = await getCachedUser();

  let firstName: string | null = null;
  if (user) {
    const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    firstName = me?.full_name?.split(" ")[0] ?? null;
  }

  const { data: myClientRows } = await supabase.from("clients").select("id").eq("user_id", user?.id ?? "");
  const clientIds = (myClientRows || []).map((row) => row.id);

  const { data: trips } =
    clientIds.length > 0
      ? await supabase
          .from("trips")
          .select("*, profiles(agency_name, logo_url, brand_color)")
          .in("client_id", clientIds)
          .order("start_date", { ascending: false })
      : { data: [] };

  // Se tutti i viaggi sono della stessa agenzia, il riquadro di benvenuto
  // prende il colore del suo brand e ne mostra nome e logo.
  const typedTrips = (trips as TripWithAgency[]) || [];
  const agencyIds = new Set(typedTrips.map((trip) => trip.owner_id));
  const singleAgency = agencyIds.size === 1 ? typedTrips[0]?.profiles ?? null : null;
  const brand = sanitizeHex(singleAgency?.brand_color);
  const heroFrom = brand ? darkenForWhiteText(brand) : null;
  const heroStyle = heroFrom
    ? { backgroundImage: `linear-gradient(135deg, ${heroFrom}, ${mixColors(heroFrom, "#ffffff", 0.16)})` }
    : undefined;

  return (
    <div>
      <div
        style={heroStyle}
        className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-[#233c5e] to-[#34527c] px-7 py-9 text-white"
      >
        <div className="pointer-events-none absolute -right-14 -top-14 h-56 w-56 rounded-full bg-[#cda876]/25" />
        <p className="eyebrow !text-white/70">{firstName ? t("portal.hello", { name: firstName }) : t("portal.welcome")}</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-white sm:text-4xl">{t("portal.homeTitle")}</h1>
        <p className="mt-2 max-w-md text-sm text-white/80">
          {singleAgency?.agency_name
            ? t("portal.homeIntroAgency", { agency: singleAgency.agency_name })
            : t("portal.homeIntro")}
        </p>
        {singleAgency?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={singleAgency.logo_url}
            alt=""
            className="absolute right-6 top-6 h-12 w-12 rounded-xl bg-white/90 object-contain p-1.5"
          />
        )}
      </div>
      <ClientTripsGrid
        trips={typedTrips}
        tripHref={(tripId) => `/client/trips/${tripId}`}
        emptyMessage={t("portal.emptyTrips")}
        emptyHint={t("portal.emptyHint")}
        locale={locale}
        labels={{
          confirmed: t("portal.tripConfirmed"),
          inPreparation: t("portal.tripInPreparation"),
          organizedBy: (agency) => t("portal.organizedBy", { agency }),
        }}
      />
    </div>
  );
}
