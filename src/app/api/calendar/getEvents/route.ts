import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabase } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  // 1) Figures out who this is
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
    console.error("No user row for email", email, userErr);
    return new Response("No user found", { status: 500 });
  }

  const user_id = userRow.id;

  // 2) Time window from query params 
  const { searchParams } = new URL(req.url); //kinda like useLocalSearchParams from expo
  const timeMin = searchParams.get("timeMin");
  const timeMax = searchParams.get("timeMax");

  if (!timeMin || !timeMax) {
    return new Response("Missing timeMin/timeMax", { status: 400 });
  }

  // 3) Query both tables in parallel
  const [itemsRes, outsideRes] = await Promise.all([
    supabase
      .from("items")
      .select("id, title, start_at, duration_min, calendar_id, object_id, location")
      .eq("user_id", user_id)
      .gte("start_at", timeMin)
      .lt("start_at", timeMax),

    supabase
      .from("outside_calendar_events")
      .select("id, title, start_at, end_at, calendar_id, object_id, location")
      .eq("user_id", user_id)
      .gte("start_at", timeMin)
      .lt("start_at", timeMax),
  ]);

  if (itemsRes.error) {
    console.error("Items error", itemsRes.error);
    return new Response("Items query failed", { status: 500 });
  }

  if (outsideRes.error) {
    console.error("Outside events error", outsideRes.error);
    return new Response("Outside events query failed", { status: 500 });
  }

  const items = itemsRes.data ?? [];
  const outsideEvents = outsideRes.data ?? [];

  // Map to common Block shape
  const itemBlocks = items
    .filter((i) => i.start_at) // guard against null start_at
    .map((i) => {
      const start = new Date(i.start_at as string);
      const durationMin = (i as any).duration_min as number; // schema says NOT NULL
      const end = new Date(start.getTime() + durationMin * 60_000);

      return {
        id: i.id,
        kind: "item" as const,
        title: i.title,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        calendarId: i.calendar_id,
        objectId: i.object_id,
      };
    });

  const externalBlocks = outsideEvents.map((e) => ({
    id: e.id,
    kind: "external" as const,
    title: e.title,
    startAt: e.start_at,
    endAt: e.end_at,
    calendarId: e.calendar_id,
    objectId: e.object_id,
  }));

  // 5) Merge + sort by startAt
  const blocks = [...itemBlocks, ...externalBlocks].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  return Response.json({ blocks });
}
