//flow: sees if signed in, if so, fetches events for today from api route, displays them in hourly grid
"use client";
import { useSession } from "next-auth/react"; //lets you know if user is logged in
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarBlock } from "@/types/calendarTypes";

const HOUR_HEIGHT = 60;
const PX_PER_MIN = HOUR_HEIGHT / 60; // tweak how “tall” the day looks. each min is 1.5px rn

function getEventPosition(block: CalendarBlock) {
  const startStr = block.startAt;
  const endStr = block.endAt;

  if (!startStr || !endStr) {
    return { top: 0, height: 0 }; // fallback
  }

  const start = new Date(startStr);
  const end = new Date(endStr);

  const minutesFromMidnight = start.getHours() * 60 + start.getMinutes();
  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

  const topPx = minutesFromMidnight * PX_PER_MIN;
  const heightPx = Math.max(20, durationMinutes * PX_PER_MIN);

  return { top: topPx, height: heightPx };
}

function formatEventTime(block: CalendarBlock): string {
  //formats time for so it looks like "10:00 AM – 11:00 AM" when displayed or smt
  const startStr = block.startAt;
  const endStr = block.endAt;
  if (!startStr || !endStr) return "";

  const start = new Date(startStr);
  const end = new Date(endStr);

  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };

  return `${start.toLocaleTimeString(
    undefined,
    opts
  )} – ${end.toLocaleTimeString(undefined, opts)}`;
}


export default function TodayPage() {
  const { data: session, status } = useSession(); //synta: data: name, fields. saying data is renamed to session, has status fields
  // data is object storing info about user. status is to check if user is loading/authentictated/unauthenticated.

  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nowLine, setNowLine] = useState<number | null>(null);

  const now = new Date();
  const weekday = now.toLocaleDateString(undefined, { weekday: "long" });
  const dateStr = now.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hours = Array.from({ length: 24 }, (_, h) => h);

 useEffect(() => {
  if (status !== "authenticated") {
    setLoading(false);
    return;
  }

  const run = async () => {
    setLoading(true);
    setError(null);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const timeMin = startOfDay.toISOString();
    const timeMax = endOfDay.toISOString();

    // helper to load blocks from DB
    const loadBlocks = async () => {
      const res = await fetch(
        `/api/calendar/getEvents?timeMin=${encodeURIComponent(
          timeMin
        )}&timeMax=${encodeURIComponent(timeMax)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const text = await res.text();
        console.error("Blocks API error", res.status, text);
        throw new Error("Failed to load schedule");
      }
      const data = await res.json();
      setBlocks(data.blocks ?? []);
    };

    try {
      // 1) initial render from DB
      await loadBlocks();

      // 2) sync Google -> DB in background
      const syncRes = await fetch(
        `/api/calendar/sync?timeMin=${encodeURIComponent(
          timeMin
        )}&timeMax=${encodeURIComponent(timeMax)}`,
        { method: "POST" }
      );
      if (!syncRes.ok) {
        const text = await syncRes.text();
        console.error("Sync error", syncRes.status, text);
        // don't throw; we still have stale blocks
      } else {
        // 3) after sync succeeds, reload from DB to get fresh blocks
        await loadBlocks();
      }
    } catch (err: any) {
      setError(err.message ?? "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  run();
}, [status]);


  useEffect(() => { 
    // update once immediately, then every minute
    const update = () => {
      const now = new Date();
      const minutesFromMidnight = now.getHours() * 60 + now.getMinutes();
      setNowLine(minutesFromMidnight * PX_PER_MIN);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="today-root">
      <header className="today-header">
        <div>
          <h1 className="today-title">{weekday}</h1>
          <p className="today-subtitle">{dateStr}</p>
        </div>
        <Link href="/weekly">
          <button className="today-today-btn">Weekly</button>
        </Link>
      </header>

      {/* status / error messages */}
      {status === "loading" && (
        <p className="today-info">Checking your session…</p>
      )}

      {status === "unauthenticated" && !loading && (
        <p className="today-info">
          Sign in to see your events for today.
        </p>
      )}

      {status === "authenticated" && error && (
        <p className="today-info">{error}</p>
      )}

      <section className="today-calendar today-calendar-day">
        <div className="today-day-header">
          <div className="today-time-col" />
          <div className="today-day-label">Today</div>
        </div>

        {/* left: hour labels, right: continuous timeline */}
        <div className="today-day-body">
          {/* hour labels */}
          <div className="today-hours-col">
            {hours.map((hour) => (
              <div key={hour} className="today-hour-row">
                {hour.toString().padStart(2, "0")}:00
              </div>
            ))}
          </div>

          <div className="today-timeline">
            {nowLine !== null && (
              <div className="today-now-line" style={{ top: nowLine }} />
            )}
            {/* optional faint hour lines */}
            {hours.map((hour) => (
              <div key={hour} className="today-timeline-hour-line" />
            ))}

            {status === "authenticated" &&
              blocks.map((block) => {
                const { top, height } = getEventPosition(block);
                return (
                  <div
                    key={block.id}
                    className="today-event-block"
                    style={{ top, height }}
                  >
                    <div className="today-event-block-title">
                      {block.title || "(no title)"}
                    </div>
                    <div className="today-event-block-time">
                      {formatEventTime(block)}
                    </div>
                    {block.location && (
                      <div className="today-event-block-location">
                        {block.location}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </section>
    </main>
  );
}
