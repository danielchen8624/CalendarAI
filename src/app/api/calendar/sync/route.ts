import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabase } from "@/lib/supabaseServer";

const CALENDAR_ID = "primary"; // fetch from google primary calendar

// same idea as in /api/calendar/events
async function authedFetch(path: string, init: RequestInit = {}) {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).access_token) {
    return new Response("Unauthorized", { status: 401 });
  }
  const accessToken = (session as any).access_token as string;

  return fetch(`https://www.googleapis.com/calendar/v3${path}`, { 
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

// helper: find a calendar row for this user (adjust to your calendar schema if needed)
async function getDefaultCalendarIdForUser(user_id: string) {
  const { data, error } = await supabase
    .from("calendar")
    .select("id")
    .eq("user_id", user_id) // <- if your calendar table doesn't have user_id, you'll tweak this
    .limit(1)
    .single();

  if (error || !data) {
    console.error("No calendar row for user", user_id, error);
    return null;
  }
  return data.id as string;
}

// POST /api/calendar/sync?timeMin=ISO&timeMax=ISO
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
    console.error("No user row for email", email, userErr);
    return new Response("No user found", { status: 500 });
  }
  const user_id = userRow.id as string;

  // 2) get calendar_id for this user
  const calendar_id = await getDefaultCalendarIdForUser(user_id);
  if (!calendar_id) {
    return new Response(
      "No calendar row for this user; create one in `calendar` table.",
      { status: 500 }
    );
  }

  // 3) time window
  const { searchParams } = new URL(req.url);
  const timeMin =
    searchParams.get("timeMin") ?? new Date().toISOString();
  const timeMax =
    searchParams.get("timeMax") ??
    new Date(Date.now() + 7 * 864e5).toISOString();

  // 4) fetch events from Google
  const r = await authedFetch(
    `/calendars/${encodeURIComponent(
      CALENDAR_ID
    )}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(
      timeMin
    )}&timeMax=${encodeURIComponent(timeMax)}`
  );

  if (r instanceof Response && !r.ok) {
    const text = await r.text();
    console.error("Google sync error", r.status, text);
    return new Response("Failed to fetch from Google", {
      status: r.status,
    });
  }

  const data = await (r as Response).json();
  const items: any[] = data.items ?? [];

  // 5) map Google events -> outside_calendar_events rows
  const rows = items
    .filter((ev) => ev.id && ev.start && ev.end)
    .map((ev) => {
      const startStr = ev.start.dateTime ?? ev.start.date;
      const endStr = ev.end.dateTime ?? ev.end.date;
      if (!startStr || !endStr) return null;

      return {
        user_id,
        calendar_id,
        object_id: null, // can be filled later when you attach objects
        title: ev.summary || "(no title)",
        description: ev.description ?? "",
        location: ev.location ?? null,
        provider_event_id: ev.id as string,
        start_at: startStr,
        end_at: endStr,
        raw: ev, // full Google payload
      };
    })
    .filter(Boolean) as any[];

  if (rows.length === 0) {
    return Response.json({ inserted: 0, updated: 0 });
  }

  // 6) upsert into outside_calendar_events
  const { data: upsertData, error: upsertError } = await supabase
    .from("outside_calendar_events")
    .upsert(rows, {
      onConflict: "calendar_id,provider_event_id",
    });

  if (upsertError) {
    console.error("Upsert error", upsertError);
    return new Response("Failed to upsert events", { status: 500 });
  }

  return Response.json({
    count: rows.length ?? 0,
  });
}
