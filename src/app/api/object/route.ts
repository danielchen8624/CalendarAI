// app/api/items/route.ts
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabase } from "@/lib/supabaseServer";


export async function POST(req: NextRequest) {

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
    console.error("User lookup error", userErr);
    return new Response("User not found", { status: 404 });
  }
  const userId = userRow.id;

  // 3) Parse request body (what the frontend sent)
  const body = await req.json(); // { title, start, duration_min, ... }

 // require name
  if (!body.name) {
    return new Response("Missing title", { status: 400 });
  }

  
  let baseWeight = body.base_weight ?? 1; // must be between 0 and 10 for your check //change this to depend on class
  baseWeight = Math.min(10, Math.max(0, baseWeight));

  // 5) Create the item row linked to that object
  const duration = body.duration_min ?? 60; // minutes (5–1440 per schema)

  const { data: objRow, error: objErr } = await supabase
    .from("object")
    .insert({
      owner_user_id: userId,
      class_id: body.class_id ?? null,
      template_id: null,          
      template_version: body.template_version ?? null,
      name: body.name,
      base_weight: baseWeight,
      current_weight: baseWeight,
      valid_until: body.valid_until ?? null,
      override_class: body.override_class ?? false,
    })
    .select()
    .single();

  if (objErr || !objRow) {
    console.error("Object insert error", objErr);
    return new Response(objErr?.message ?? "Failed to create object", {
      status: 500,
    });
  }

  // 6) Return just the new item to the frontend
  return Response.json({ object: objRow });
}