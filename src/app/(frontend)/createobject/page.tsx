"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Class } from "@/types/classTypes";
import { set } from "zod";

export default function ObjectsPage() {
  const [name, setName] = useState("");
  const [baseWeight, setBaseWeight] = useState<number>(1);
  const [overrideClass, setOverrideClass] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
    const [selectedClassId, setSelectedClassId] = useState<string>("");


  const router = useRouter();

    useEffect(() => {
        const load = async () => {
      try {
        setClassesLoading(true);
        const res = await fetch("/api/classes");
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to load classes");
        }
        const data = await res.json();
        const cls: Class[] = data.classes ?? [];
        setClasses(cls);
        if (cls.length > 0) {
          setSelectedClassId(cls[0].id);
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Failed to load classes");
      } finally {
        setClassesLoading(false);
      }
    };
    load();
  }, [])


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/object", {
        // this is object-create endpoint
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          base_weight: baseWeight,
          override_class: overrideClass,
          valid_until: null,
          class_id: selectedClassId,

          // template_id / template_version will fall back to defaults in your API
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create object");
      }


      // reset
      setName("");
      setBaseWeight(1);
      setOverrideClass(false);
      if (classes.length > 0) {
        setSelectedClassId(classes[0].id);
      }

      router.refresh(); // if later need to add an objects list
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
            <h1 className="cal-title">Object</h1>
            <p className="cal-subtitle">
              Momentum uses objects to represent tasks, events, or activities.
            </p>
          </div>
        </header>

        <section className="cal-body">
          <div className="cal-form-card">
            <form onSubmit={handleSubmit} className="cal-form">
              <div className="cal-field">
                <label className="cal-label">Name</label>
                <input
                  className="cal-input"
                  placeholder="empty"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="cal-field">
                <label className="cal-label">
                  Base weight <span style={{ opacity: 0.6 }}></span>
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
                <span className="cal-subtitle">
                  Current: {baseWeight.toFixed(1)}
                </span>
              </div>

              <div className="cal-field">
                <label className="cal-label">Class</label>
                {classesLoading ? (
                  <p className="cal-form-subtitle">Loading classes…</p>
                ) : classes.length === 0 ? (
                  <p className="cal-form-subtitle">
                    No classes defined yet.
                  </p>
                ) : (
                  <select
                    className="cal-input"
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    required
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                )}
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
            </div>
            <div className="cal-list-scroll">
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}