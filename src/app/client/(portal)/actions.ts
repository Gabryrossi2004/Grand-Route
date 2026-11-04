"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function clientSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/client/login");
}
