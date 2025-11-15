"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateCalendar() {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [tz, setTz] = useState("America/Toronto");
  const [isPrimary, setIsPrimary] = useState(true);
  const [provider, setProvider] = useState("");
  const [externalId, setExternalId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          color,
          tz,
          is_primary: isPrimary,
          provider: provider || null,
          external_id: externalId || null,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create calendar");
      }

      setName("");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="cal-root">
      <div className="cal-inner">
        <header className="cal-header">
          <div>
            <h1 className="cal-title">Create calendar</h1>
            <p className="cal-subtitle">
              Name it, pick a color, set the timezone and (optionally) link a provider.
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="cal-form">
          <div className="cal-field">
            <label className="cal-label">Name</label>
            <input
              className="cal-input"
              placeholder="e.g. School, Deep work, Gym"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="cal-field">
            <label className="cal-label">Color</label>
            <input
              type="color"
              className="cal-input"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>

          <div className="cal-field">
            <label className="cal-label">Time zone</label>
            <input
              className="cal-input"
              placeholder="America/Toronto"
              value={tz}
              onChange={(e) => setTz(e.target.value)}
            />
          </div>

          <label className="cal-checkbox-row">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
            />
            Primary calendar
          </label>

          <div className="cal-field">
            <label className="cal-label">Provider (optional)</label>
            <input
              className="cal-input"
              placeholder="google, local, ..."
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
          </div>

          <div className="cal-field">
            <label className="cal-label">External ID (optional)</label>
            <input
              className="cal-input"
              placeholder="Google calendar id, etc."
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
            />
          </div>

          {error && <p className="cal-error">{error}</p>}

          <button type="submit" disabled={loading} className="cal-submit">
            {loading ? "Creating…" : "Create calendar"}
          </button>
        </form>
      </div>
    </div>
  );
}
