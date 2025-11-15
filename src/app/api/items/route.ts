import { supabase } from "@/lib/supabaseServer";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(req: NextRequest) {

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }
  const email = session.user.email;

  const { data: userRow, error: userErr } = await supabase //sees if user exists
  .from("users") //from users table
  .select("id") //select only id field
  .eq("email", email) //where email = email
  .single(); //expect only one row
  
  if (userErr || !userRow) {
    return new Response("User not found", { status: 404 });
  }

  const body = await req.json(); // { title, start, end, ... } // parse request body

  const { data, error } = await supabase
    .from("items") // insert into items table. idk why its from think of it as into
    .insert({
      user_id: userRow.id,
      calendar_id: "63ed2a7f-670e-4cec-962d-03620e29ee53",
      object_id: "9c568275-5dd6-4af9-a817-8dd88d7300d3",
      title: body.title,  
      description: body.description ?? null,
      location: body.location ?? null,
      start_at: body.start,
      duration_min: body.duration_min ?? 60,
      recurrence_rrule: body.recurrence_rrule ?? null,
    })
    .select() 
    .single();

  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ item: data });
}
