import { createClient, getCachedUser } from "@/lib/supabase/server";
import ClientTripsGrid, { type TripWithAgency } from "@/components/ClientTripsGrid";
import { darkenForWhiteText, mixColors, sanitizeHex } from "@/lib/brandColor";
import { getT } from "@/lib/i18n/server";
import NextTripCard from "@/components/NextTripCard";
import TodayTripCard from "@/components/TodayTripCard";
import { romeToday } from "@/lib/destinationInfo";
import WelcomeZefiro from "@/components/WelcomeZefiro";
import Link from "next/link";
import { clientStepKeys, progressOf, shouldShowWelcome, type OnboardingStatus, type OnboardingStep } from "@/lib/onboarding";

export default async function ClientHomePage({ searchParams }: { searchParams: Promise<{ iniziare?: string }> }) {
  const { t, locale } = await getT();
  const supabase = await createClient();
  const user = await getCachedUser();
  const reopenStart = Boolean((await searchParams).iniziare);
  const { data: onboardingData } = await supabase.rpc("onboarding_status");
  const ob = (onboardingData as OnboardingStatus | null) ?? null;
  const startSteps: OnboardingStep[] = ob
    ? clientStepKeys(ob).map((x) => ({ key: x.key, href: x.href, done: x.done, label: t(`portal.start.${x.key}`), hint: t(`portal.start.${x.key}Hint`) }))
    : [];

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

  const today = romeToday();
  type WithCountries = { countries?: string[] | null; auto_countries?: string[] | null; start_date: string | null; end_date: string | null };
  const current = typedTrips.find((trip) => {
    const t = trip as unknown as WithCountries;
    return t.start_date && t.end_date && t.start_date <= today && t.end_date >= today;
  });
  // paesi già visitati (viaggi conclusi), dal più vecchio al più recente
  const visited = [...typedTrips]
    .filter((trip) => {
      const t = trip as unknown as WithCountries;
      return t.end_date && t.end_date < today;
    })
    .reverse()
    .flatMap((trip) => {
      const t = trip as unknown as WithCountries;
      return [...(t.countries ?? []), ...(t.auto_countries ?? [])];
    });

  return (
    <div>
      {current && <TodayTripCard trip={current as unknown as Parameters<typeof TodayTripCard>[0]["trip"]} today={today} />}
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
      {ob && shouldShowWelcome(ob, startSteps, reopenStart) && (
        <WelcomeZefiro
          steps={startSteps}
          reopen={reopenStart}
          labels={{
            hello: firstName ? t("portal.start.hello", { name: firstName }) : t("portal.start.helloAnon"),
            intro: t("portal.start.intro"),
            explain: t("portal.start.explain"),
            cta: t("portal.start.title"),
            listDone: t("portal.start.listDone"),
            listAgain: t("portal.start.listAgain"),
            skip: t("portal.start.skip"),
            close: t("portal.start.hide"),
          }}
        />
      )}
      {ob && !shouldShowWelcome(ob, startSteps, reopenStart) && !progressOf(startSteps).complete && (
        <Link href="/client?iniziare=1" className="mb-6 inline-block text-xs font-medium text-[#756548] hover:text-[#233c5e] hover:underline">{t("portal.start.reopen")}</Link>
      )}
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
      {typedTrips.length > 0 && <NextTripCard visited={[...new Set(visited)]} />}
    </div>
  );
}
