import { notFound } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import TripHeader from "../TripHeader";
import ExpensesPanel, { type ExpenseRow, type PersonRow } from "./ExpensesPanel";

export const metadata = { title: "Spese" };

export default async function ExpensesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCachedUser();
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).eq("owner_id", user?.id ?? "").maybeSingle();
  if (!trip) notFound();

  const [peopleRes, expensesRes, { data: profile }] = await Promise.all([
    supabase.from("trip_people").select("id, name").eq("trip_id", id).order("created_at"),
    supabase.from("trip_expenses").select("id, description, amount, category, paid_by, shared_with, expense_date, created_at").eq("trip_id", id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("full_name").eq("id", user?.id ?? "").maybeSingle(),
  ]);
  const notReady = Boolean(peopleRes.error || expensesRes.error);

  return (
    <div className="flex flex-col gap-5">
      <TripHeader trip={trip} active="spese" />
      <ExpensesPanel
        tripId={id}
        notReady={notReady}
        people={(peopleRes.data as PersonRow[] | null) ?? []}
        expenses={((expensesRes.data as (Omit<ExpenseRow, "amount"> & { amount: number | string })[] | null) ?? []).map((e) => ({ ...e, amount: Number(e.amount) }))}
        budget={"budget_eur" in trip && trip.budget_eur !== null ? Number(trip.budget_eur) : null}
        budgetReady={"budget_eur" in trip}
        myName={String(profile?.full_name ?? "").split(" ")[0]}
      />
    </div>
  );
}
