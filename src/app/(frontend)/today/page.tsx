//flow: sees if signed in, if so, fetches events for today from api route, displays them in hourly grid
"use client";
import { useSession } from "next-auth/react"; //lets you know if user is logged in
import { useEffect, useState } from "react";
import Link from "next/link";

const HOUR_HEIGHT = 60; 
const PX_PER_MIN = HOUR_HEIGHT/60 // tweak how “tall” the day looks. each min is 1.5px rn

type CalEvent = {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

function getEventPosition(ev: CalEvent) {
  const startStr = ev.start?.dateTime ?? ev.start?.date;
  const endStr   = ev.end?.dateTime   ?? ev.end?.date;

  if (!startStr || !endStr) {
    return { top: 0, height: 0 }; // fallback
  }

  const start = new Date(startStr);
  const end   = new Date(endStr);

  const minutesFromMidnight = start.getHours() * 60 + start.getMinutes(); // how many minutes since 00:00, e.g. 1:30am = 90
  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60); // duration in minutes

  const topPx = minutesFromMidnight * PX_PER_MIN; // position from top
  const heightPx = Math.max(20, durationMinutes * PX_PER_MIN); // min height

  return { top: topPx, height: heightPx };
}

export default function TodayPage() {
  const { data: session, status } = useSession(); //synta: data: name, fields. saying data is renamed to session, has status fields
  // data is object storing info about user. status is to check if user is loading/authentictated/unauthenticated.

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalEvent[]>([]); 
  const [error, setError] = useState<string | null>(null);

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

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        //calls api route to get events from startOfDay to endOfDay (essentially just today)
        const response = await fetch(
          `/api/calendar/events?timeMin=${encodeURIComponent(
            startOfDay.toISOString()
          )}&timeMax=${encodeURIComponent(endOfDay.toISOString())}`
        );
        if (!response.ok) {
          console.log("lalalalala")
          throw new Error(await response.text()); // how to store in setError?
        }

        const data = await response.json();
        setEvents(data.items ?? []);
      } catch (err: any) {
        setError(err.message ?? "Failed to load events");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [status]);

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
          Sign in to see your Google Calendar events for today.
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

          {/* scrollable vertical timeline with absolute event blocks */}
          <div className="today-timeline">
            {/* optional faint hour lines */}
            {hours.map((hour) => (
              <div key={hour} className="today-timeline-hour-line" />
            ))}

            {status === "authenticated" &&
              events.map((ev) => {
                const { top, height } = getEventPosition(ev as CalEvent);
                return (
                  <div
                    key={ev.id}
                    className="today-event-block"
                    style={{ top, height }}
                  >
                    <div className="today-event-block-title">
                      {ev.summary || "(no title)"}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </section>
    </main>
  );

}
