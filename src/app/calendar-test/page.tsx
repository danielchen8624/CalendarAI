"use client";
import { useState } from "react";

export default function CalendarTest() {
  const [log, setLog] = useState<string>("");     // quick debug
  const [lastId, setLastId] = useState<string>("");

  const j = (x: any) => JSON.stringify(x, null, 2);

  async function listEvents() {
    const r = await fetch(`/api/calendar/events?timeMin=${encodeURIComponent(new Date().toISOString())}`);
    const data = await r.json();
    setLog(j(data.items?.slice(0,5) ?? data));
    if (data.items?.[0]?.id) setLastId(data.items[0].id); 
  }

  async function createEvent() {
    const now = new Date();
    const start = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // +15 min
    const end   = new Date(now.getTime() + 45 * 60 * 1000).toISOString(); // +45 min
    const body = {
      summary: "MVP test",
      description: "Created from /calendar-test",
      start: { dateTime: start },
      end:   { dateTime: end  },
    };
    const r = await fetch("/api/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    setLog(j(data));
    if (data.id) setLastId(data.id);
  }

  async function renameEvent() {
    if (!lastId) return setLog("No lastId. Click List or Create first.");
    const r = await fetch(`/api/calendar/events?id=${encodeURIComponent(lastId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: "Renamed (MVP test)" }),
    });
    setLog(await r.text());
  }

  async function deleteEvent() {
    if (!lastId) return setLog("No lastId. Click List or Create first.");
    const r = await fetch(`/api/calendar/events?id=${encodeURIComponent(lastId)}`, { method: "DELETE" });
    setLog(`DELETE status: ${r.status}`);
  }

  return (
    <main className="p-6 space-y-4">
      <div className="flex gap-2">
        <button onClick={listEvents} className="px-3 py-1 border rounded">List</button>
        <button onClick={createEvent} className="px-3 py-1 border rounded">Create</button>
        <button onClick={renameEvent} className="px-3 py-1 border rounded">Rename</button>
        <button onClick={deleteEvent} className="px-3 py-1 border rounded">Delete</button>
      </div>
      <pre className="text-sm whitespace-pre-wrap border p-3 rounded max-h-[60vh] overflow-auto">{log}</pre>
      <p className="text-xs text-gray-500">Last event id: {lastId || "—"}</p>
    </main>
  );
}
