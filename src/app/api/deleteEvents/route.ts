// app/api/deleteEvent/route.ts
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabase } from "@/lib/supabaseServer";

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { source, id } = body ?? {};

  if ((source !== "item" && source !== "outside") || !id) {
    return new Response("Missing or invalid fields", { status: 400 });
  }

  // look up user to ensure we only delete our own stuff
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

  const tableName =
    source === "item" ? "items" : "outside_calendar_events";

  const { error: deleteErr } = await supabase
    .from(tableName)
    .delete()
    .eq("id", id)
    .eq("user_id", userId); // ensures you only delete your own stuff

  if (deleteErr) {
    console.error("Delete event error", deleteErr);
    return new Response("Failed to delete event", { status: 500 });
  }

  return new Response(null, { status: 204 });
}
