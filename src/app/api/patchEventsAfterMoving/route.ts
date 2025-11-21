// app/api/blocks/route.ts
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabase } from "@/lib/supabaseServer";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { source, id, start_at, duration_min } = body ?? {};

  // source: "item" | "outside"
  if (
    (source !== "item" && source !== "outside") ||
    !id ||
    !start_at ||
    typeof duration_min !== "number"
  ) {
    return new Response("Missing or invalid fields", { status: 400 });
  }

  // Look up user (so we can .eq("user_id", userId))
  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("email", session.user.email)
    .single();

  if (userErr || !userRow) {
    console.error("User lookup error", userErr);
    return new Response("User not found", { status: 404 });
  }
  const userId = userRow.id;

  if (source === "item") {
    // LOCAL ITEMS: start_at + duration_min
    const { error: updateErr } = await supabase
      .from("items")
      .update({
        start_at,
        duration_min,
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (updateErr) {
      console.error("Item update error", updateErr);
      return new Response("Failed to update item", { status: 500 });
    }
  } else {
    // EXTERNAL EVENTS: start_at + end_at
    const startDate = new Date(start_at);
    const endDate = new Date(startDate.getTime() + duration_min * 60_000);

    const { error: updateErr } = await supabase
      .from("outside_calendar_events")
      .update({
        start_at,
        end_at: endDate.toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (updateErr) {
      console.error("Outside event update error", updateErr);
      return new Response("Failed to update external event", { status: 500 });
    }
  }

  return new Response(null, { status: 204 });
}
