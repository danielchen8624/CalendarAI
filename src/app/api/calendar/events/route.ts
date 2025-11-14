import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { NextRequest } from "next/server";

const CALENDAR_ID = "primary";

async function authedFetch(path: string, init: RequestInit = {}) {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).access_token) {
    return new Response("Unauthorized", { status: 401 });
  }
  const accessToken = (session as any).access_token as string;
  return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

// GET /api/calendar/events?timeMin=ISO&timeMax=ISO
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const timeMin = searchParams.get("timeMin") ?? new Date().toISOString();
  const timeMax = searchParams.get("timeMax") ?? new Date(Date.now()+7*864e5).toISOString();

  const r = await authedFetch(`/calendars/${encodeURIComponent(CALENDAR_ID)}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`);
  if (r instanceof Response && r.status === 401) return r;
  const data = await (r as Response).json();
  return Response.json(data);
}

// POST create { summary, start, end, description?, location? }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const r = await authedFetch(`/calendars/${encodeURIComponent(CALENDAR_ID)}/events`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (r instanceof Response && !r.ok) return new Response(await r.text(), { status: r.status });
  return new Response(await (r as Response).text(), { status: (r as Response).status });
}

// PATCH update ?id=evtId  body: partial Google event
export async function PATCH(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });
  const body = await req.json();
  const r = await authedFetch(`/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return new Response(await (r as Response).text(), { status: (r as Response).status });
}

// DELETE ?id=evtId
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });
  const r = await authedFetch(`/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return new Response(null, { status: (r as Response).status });
}
