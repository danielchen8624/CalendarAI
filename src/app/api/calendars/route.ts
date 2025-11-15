import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabase } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  // 1) Who is calling?
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const email = session.user.email;


  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id, name")
    .eq("email", email)
    .single();

  if (userErr || !userRow) {
    console.error("User lookup error", userErr);
    return new Response("User not found", { status: 404 });
  }


  if (userErr || !userRow) {
    console.error("User lookup error", userErr);
    return new Response("User not found", { status: 404 });
  }
  
  const userId = userRow.id;
  const name = userRow.name;
  
  // 3) Body from frontend
  const body = await req.json(); // { name, color?, tz?, is_primary?, provider?, external_id? }

  if (!body.name) {
    return new Response("Missing calendar name", { status: 400 });
  }

  const { data: calRow, error: calErr } = await supabase
    .from("calendar")
    .insert({
        user_id: userId,
        name: name,
        color: body.color ?? undefined,
        tz: body.tz ?? Date.now(),
        is_primary: body.is_primary ?? undefined,
        provider: body.provider ?? null,
        external_id: body.external_id ?? null,

    })
    .select()
    .single();

  if (calErr || !calRow) {
    // handle unique(user_id, name) conflict nicely
    if ((calErr as any).code === "23505") {
      return new Response("You already have a calendar with that name", { status: 409 });
    }
    console.error("Calendar insert error", calErr);
    return new Response(calErr?.message ?? "Failed to create calendar", { status: 500 });
  }

  return Response.json({ calendar: calRow });
}
