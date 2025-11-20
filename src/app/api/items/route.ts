import { supabase } from "@/lib/supabaseServer";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(req: NextRequest) {
  // 1) who is this?
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }
  const email = session.user.email;

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (userErr || !userRow) {
    return new Response("User not found", { status: 404 });
  }

  const user_id = userRow.id as string;

  // 2) find this user's calendar instead of hard-coding it
  const { data: calRow, error: calErr } = await supabase
    .from("calendar")
    .select("id")
    .eq("user_id", user_id)        // <- adjust if your calendar schema differs
    .limit(1)
    .single();

  if (calErr || !calRow) {
    console.error("No calendar row for user", user_id, calErr);
    return new Response("No calendar configured for user", { status: 500 });
  }

  const calendar_id = calRow.id as string;

  // 3) parse body and require the important bits
  const body = await req.json();

  const {
    title,
    description,
    location,
    start_at,          // ISO string
    duration_min,
    recurrence_rrule,
    object_id,         // from "select object" in your modal
  } = body;

  if (!title || !start_at || !duration_min || !object_id) {
    return new Response("Missing required fields", { status: 400 });
  }

  // 4) insert full row into items
  const { data, error } = await supabase
    .from("items")
    .insert({
      user_id,
      calendar_id,
      object_id,
      title,
      description: description ?? "",      // your schema default is ''::text
      location: location ?? null,
      start_at,                            // matches column name
      duration_min,                        // already validated above
      recurrence_rrule: recurrence_rrule ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("items insert failed", error);
    return new Response(error.message, { status: 500 });
  }

  return Response.json({ item: data });
}
