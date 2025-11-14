//flow: sees if signed in, if so, fetches events for today from api route, displays them in hourly grid
"use client";
import { useSession } from "next-auth/react"; //lets you know if user is logged in
import { useEffect, useState } from "react";
import Link from "next/link";

export default function TodayPage() {
  const { data: session, status } = useSession(); //synta: data: name, fields. saying data is renamed to session, has status fields
  // data is object storing info about user. status is to check if user is loading/authentictated/unauthenticated.

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]); //change this to type Event later. These are all the events (blocks) today
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

      {/* auth + loading + events list */}
      {status === "loading" && (
        <p className="today-info">Checking your session…</p>
      )}

      {status === "unauthenticated" && !loading && (
        <p className="today-info">
          Sign in to see your Google Calendar events for today.
        </p>
      )}

      {status === "authenticated" && (
        <section className="today-events">
          {loading && (
            <p className="today-info">Loading today&apos;s events…</p>
          )}

          {error && <p className="today-info">{error}</p>}

          {!loading && !error && events.length === 0 && (
            <p className="today-info">No events found for today.</p>
          )}

          <ul className="today-events-list">
            {events.map((ev) => (
              <li key={ev.id} className="today-event-card">
                <div className="today-event-title">
                  {ev.summary || "(no title)"}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* hourly grid background */}
      <section className="today-calendar today-calendar-day">
        <div className="today-day-header">
          <div className="today-time-col" />
          <div className="today-day-label">Today</div>
        </div>

        <div className="today-day-grid">
          {hours.map((hour) => (
            <div key={hour} className="today-row">
              <div className="today-time">
                {hour.toString().padStart(2, "0")}:00
              </div>
              <div className="today-day-cell">
                {/* later: render blocks in the right hour */}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
