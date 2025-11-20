import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabase } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const email = session.user.email;

  // get user_id
  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (userErr || !userRow) {
    return new Response("User not found", { status: 404 });
  }

  // fetch classes for this user (adjust columns/filters to your schema)
  const { data, error } = await supabase
    .from("classes")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("classes error", error);
    return new Response("Failed to load classes", { status: 500 });
  }

  return Response.json({ classes: data ?? [] });
}
