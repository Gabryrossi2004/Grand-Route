import { getTravelerAllowance } from "@/lib/travelerAi";
import TravelerNewTrip from "./TravelerNewTrip";

export const metadata = { title: "Nuovo viaggio" };
export const maxDuration = 60;

export default async function TravelerNewTripPage() {
  const allowance = await getTravelerAllowance();
  return <TravelerNewTrip left={allowance.left} total={allowance.total} />;
}
