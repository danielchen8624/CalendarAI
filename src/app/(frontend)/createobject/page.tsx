// app/objects/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ObjectsPage() {
  const [name, setName] = useState("");
  const [baseWeight, setBaseWeight] = useState<number>(1);
  const [overrideClass, setOverrideClass] = useState(false);
  const [validUntil, setValidUntil] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/items", {
        // this is your object-create endpoint
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          base_weight: baseWeight,
          override_class: overrideClass,
          valid_until: validUntil
            ? new Date(validUntil).toISOString()
            : null,
          // template_id / template_version will fall back to defaults in your API
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create object");
      }

      // optional: const { object } = await res.json();

      // reset
      setName("");
      setBaseWeight(1);
      setOverrideClass(false);
      setValidUntil("");

      router.refresh(); // if you later add an objects list
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
          <div className="cal-title-block">
            <h1 className="cal-title">Objects</h1>
            <p className="cal-subtitle">
              Define weighted things Momentum can schedule (courses, habits, tasks).
            </p>
          </div>
          <div className="cal-header-actions">
            <span className="cal-pill-muted">Stored in Supabase · per user</span>
          </div>
        </header>

        <section className="cal-body">
          <div className="cal-form-card">
            <h2 className="cal-form-title">New object</h2>
            <p className="cal-form-subtitle">
              Name it and give it a weight; Momentum will use this when ranking.
            </p>

            <form onSubmit={handleSubmit} className="cal-form">
              <div className="cal-field">
                <label className="cal-label">Name</label>
                <input
                  className="cal-input"
                  placeholder="e.g. CS135, Deep work, Gym session"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="cal-field">
                <label className="cal-label">
                  Base weight <span style={{ opacity: 0.6 }}>(0–10)</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={baseWeight}
                  onChange={(e) => setBaseWeight(Number(e.target.value))}
                  className="cal-input"
                />
                <span className="cal-form-subtitle">
                  Current: {baseWeight.toFixed(1)}
                </span>
              </div>

              <div className="cal-field">
                <label className="cal-label">Valid until (optional)</label>
                <input
                  type="datetime-local"
                  className="cal-input"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>

              <label className="cal-checkbox-row">
                <input
                  type="checkbox"
                  checked={overrideClass}
                  onChange={(e) => setOverrideClass(e.target.checked)}
                />
                Override class defaults for this object
              </label>

              {error && <p className="cal-error">{error}</p>}

              <button type="submit" disabled={loading} className="cal-submit">
                {loading ? "Creating…" : "Create object"}
              </button>
            </form>
          </div>

          {/* Right side kept as a blank card for now */}
          <div className="cal-list-card">
            <div className="cal-list-header">
              <h2 className="cal-list-title">Your objects</h2>
              <span className="cal-list-count">0 total</span>
            </div>
            <div className="cal-list-scroll">
              <p className="cal-subtitle">
                No objects yet — create one on the left.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
