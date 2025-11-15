import React from "react";
import Link from "next/link";





export default function WeeklyPage() {
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <main className="today-root">
      <header className="today-header">
        <div>
          <h1 className="today-title">Weekly</h1>
          <p className="today-subtitle">Your week at a glance</p>
        </div>
        <Link href  = "/today">
        <button className="today-today-btn">Today</button>
        </Link>
      </header>

      <section className="today-calendar">
        <div className="today-weekdays">
          {weekdays.map((d) => (
            <div key={d} className="today-weekday">
              {d}
            </div>
          ))}
        </div>

        <div className="today-grid">
          {Array.from({ length: 24 }).map((_, hour) => (
            <div key={hour} className="today-row">
              <div className="today-time">
                {hour.toString().padStart(2, "0")}:00
              </div>
              <div className="today-cells">
                {weekdays.map((d) => (
                  <div key={d} className="today-cell" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
