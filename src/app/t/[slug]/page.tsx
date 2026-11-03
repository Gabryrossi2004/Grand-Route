import { createClient } from "@/lib/supabase/server";

export default async function PublicTripPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("*")
    .eq("public_slug", slug)
    .eq("is_published", true)
    .single();

  if (tripError) {
    return <pre>TRIP_ERROR: {JSON.stringify(tripError)}</pre>;
  }
  if (!trip) {
    return <div>TRIP NULL</div>;
  }

  const daysResult = await supabase
    .from("trip_days")
    .select("*, activities(*, activity_photos(*))")
    .eq("trip_id", trip.id)
    .order("day_order", { ascending: true });

  const ownerResult = await supabase.from("profiles").select("*").eq("id", trip.owner_id).single();

  return (
    <pre style={{ whiteSpace: "pre-wrap", padding: 20 }}>
      TRIP OK: {JSON.stringify(trip)}
      {"\n\nDAYS ERROR: "} {JSON.stringify(daysResult.error)}
      {"\nDAYS DATA: "} {JSON.stringify(daysResult.data)}
      {"\n\nOWNER ERROR: "} {JSON.stringify(ownerResult.error)}
      {"\nOWNER DATA: "} {JSON.stringify(ownerResult.data)}
    </pre>
  );
}
