//flow: sees if signed in, if so, fetches events for today from api route, displays them in hourly grid
"use client";
import { useSession } from "next-auth/react"; //lets you know if user is logged in
import { useEffect, useState, useRef } from "react";
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

// NEW: positioned block type + layout helper
type PositionedBlock = {
  block: CalendarBlock;
  column: number;
  columnCount: number;
};

// assign columns to overlapping blocks so they can sit side-by-side
function layoutBlocks(blocks: CalendarBlock[]): PositionedBlock[] {
  type Meta = {
    id: CalendarBlock["id"];
    startMs: number;
    endMs: number;
  };

  const metaList: Meta[] = [];

  for (const b of blocks) {
    if (!b.startAt || !b.endAt) continue;
    const startMs = new Date(b.startAt).getTime();
    const endMs = new Date(b.endAt).getTime();
    metaList.push({ id: b.id, startMs, endMs });
  }

  // sort by start time
  metaList.sort((a, b) => a.startMs - b.startMs);

  type Active = {
    id: CalendarBlock["id"];
    endMs: number;
    col: number;
    cluster: number;
  };

  const active: Active[] = [];
  const metaById = new Map<
    CalendarBlock["id"],
    { col: number; cluster: number }
  >();
  const clusterCols = new Map<number, number>();
  let currentCluster = 0;

  for (const ev of metaList) {
    // drop events that ended before this one starts
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endMs <= ev.startMs) {
        active.splice(i, 1);
      }
    }

    // if no active events, we’re starting a new overlap cluster
    if (active.length === 0 && metaById.size > 0) {
      currentCluster++;
    }

    const usedCols = new Set(active.map((a) => a.col));
    let col = 0;
    while (usedCols.has(col)) col++;

    metaById.set(ev.id, { col, cluster: currentCluster });
    active.push({ id: ev.id, endMs: ev.endMs, col, cluster: currentCluster });

    const prev = clusterCols.get(currentCluster) ?? 0;
    if (col + 1 > prev) {
      clusterCols.set(currentCluster, col + 1);
    }
  }

  return blocks.map((block) => {
    const meta = metaById.get(block.id);
    if (!meta) {
      return { block, column: 0, columnCount: 1 };
    }
    const cols = clusterCols.get(meta.cluster) ?? 1;
    return {
      block,
      column: meta.col,
      columnCount: cols,
    };
  });
}

// NEW: drag state type
type DragState = {
  id: CalendarBlock["id"];
  originalStart: Date;
  originalEnd: Date;
  offsetMinutes: number;
};

// NEW: resize state type
type ResizeState = {
  id: CalendarBlock["id"];
  originalStart: Date;
  originalEnd: Date;
};

export default function TodayPage() {
  const { data: session, status } = useSession(); //synta: data: name, fields. saying data is renamed to session, has status fields
  // data is object storing info about user. status is to check if user is loading/authentictated/unauthenticated.

  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nowLine, setNowLine] = useState<number | null>(null);

  // NEW: modal + click state
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<Date | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  // NEW: drag state
  const [dragState, setDragState] = useState<DragState | null>(null);

  // NEW: resize state
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);

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
        <p className="today-info">Sign in to see your events for today.</p>
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

          <div
            className="today-timeline"
            ref={timelineRef}
            onClick={(e) => {
              if (!timelineRef.current) return;

              const rect = timelineRef.current.getBoundingClientRect();
              const y = e.clientY - rect.top; // pixels from top of grid
              const rawMinutes = y / PX_PER_MIN;
              const SLOT = 30; // minutes per slot

              const minutesFromMidnight = Math.max(
                0,
                Math.min(
                  24 * 60,
                  Math.round(rawMinutes / SLOT) * SLOT // snap to nearest 30-min mark
                )
              );

              const start = new Date();
              start.setHours(0, 0, 0, 0);
              start.setMinutes(minutesFromMidnight);

              setDraftStart(start);
              setIsNewOpen(true);
            }}
            onMouseMove={(e) => {
              if (!timelineRef.current) return;

              const rect = timelineRef.current.getBoundingClientRect();
              const y = e.clientY - rect.top;
              const rawMinutes = y / PX_PER_MIN;
              const DRAG_SLOT_MIN = 15;

              // RESIZE has priority
              if (resizeState) {
                let newEndMinutes = rawMinutes;
                newEndMinutes = Math.max(
                  0,
                  Math.min(24 * 60, newEndMinutes)
                );

                const snappedEndMinutes =
                  Math.round(newEndMinutes / DRAG_SLOT_MIN) * DRAG_SLOT_MIN;

                const candidateEnd = new Date();
                candidateEnd.setHours(0, 0, 0, 0);
                candidateEnd.setMinutes(snappedEndMinutes);

                const minDuration = 15; // don't let it collapse below 15min

                setBlocks((prev) =>
                  prev.map((b) => {
                    if (b.id !== resizeState.id || !b.startAt) return b;
                    const start = new Date(b.startAt);
                    const durationMin =
                      (candidateEnd.getTime() - start.getTime()) / 60000;
                    if (durationMin < minDuration) return b;
                    return { ...b, endAt: candidateEnd.toISOString() };
                  })
                );
                return;
              }

              // DRAG if active
              if (!dragState) return;

              // where the block's top should be, before snapping
              let newStartMinutes = rawMinutes - dragState.offsetMinutes;

              newStartMinutes = Math.max(
                0,
                Math.min(24 * 60, newStartMinutes)
              );

              const snappedStartMinutes =
                Math.round(newStartMinutes / DRAG_SLOT_MIN) * DRAG_SLOT_MIN;

              const newStart = new Date();
              newStart.setHours(0, 0, 0, 0);
              newStart.setMinutes(snappedStartMinutes);

              const durationMin =
                (dragState.originalEnd.getTime() -
                  dragState.originalStart.getTime()) /
                60000;
              const newEnd = new Date(
                newStart.getTime() + durationMin * 60_000
              );

              setBlocks((prev) =>
                prev.map((b) =>
                  b.id === dragState.id
                    ? {
                        ...b,
                        startAt: newStart.toISOString(),
                        endAt: newEnd.toISOString(),
                      }
                    : b
                )
              );
            }}
            onMouseUp={async () => {
              if (!dragState && !resizeState) return;

              // figure out which block was moved/resized
              const movedId = dragState?.id ?? resizeState?.id;
              const movedBlock = blocks.find((b) => b.id === movedId);

              if (movedBlock && movedBlock.startAt && movedBlock.endAt) {
                const durationMin =
                  (new Date(movedBlock.endAt).getTime() -
                    new Date(movedBlock.startAt).getTime()) /
                  60000;

                // decide whether this was a local item or an outside event
                const kind = (movedBlock as any).kind;
                const source = kind === "item" ? "item" : "outside";

                try {
                  await fetch("/api/patchEventsAfterMoving", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      source,
                      id: movedBlock.id,
                      start_at: movedBlock.startAt,
                      duration_min: durationMin,
                    }),
                  });
                } catch (err) {
                  console.error("Failed to persist block move/resize", err);
                }
              }

              setDragState(null);
              setResizeState(null);
            }}
            onMouseLeave={() => {
              if (!dragState && !resizeState) return;
              setDragState(null);
              setResizeState(null);
            }}
          >
            {nowLine !== null && (
              <div className="today-now-line" style={{ top: nowLine }} />
            )}
            {/* optional faint hour lines */}
            {hours.map((hour) => (
              <div key={hour} className="today-timeline-hour-line" />
            ))}

            {/* placeholder block for draftStart */}
            {draftStart &&
              (() => {
                const placeholderDurationMin = 60; // 1-hour placeholder
                const placeholderEnd = new Date(
                  draftStart.getTime() + placeholderDurationMin * 60_000
                );
                const draftBlock = {
                  startAt: draftStart.toISOString(),
                  endAt: placeholderEnd.toISOString(),
                } as CalendarBlock;

                const { top, height } = getEventPosition(draftBlock);

                return (
                  <div
                    className="today-event-block"
                    style={{
                      top,
                      height,
                      opacity: 0.5,
                      borderStyle: "dashed",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="today-event-block-title">(new event)</div>
                    <div className="today-event-block-time">
                      {formatEventTime(draftBlock)}
                    </div>
                  </div>
                );
              })()}

            {status === "authenticated" &&
              layoutBlocks(blocks).map(({ block, column, columnCount }) => {
                const { top, height } = getEventPosition(block);

                const widthPct = 100 / columnCount;
                const leftPct = column * widthPct;

                return (
                  <div
                    key={block.id}
                    className="today-event-block"
                    style={{
                      top,
                      height,
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                    }}
                    onClick={(e) => e.stopPropagation()} // don't open modal when clicking an event
                  >
                    {/* DRAG BODY: top/middle */}
                    <div
                      className="today-event-drag-body"
                      style={{ height: "calc(100% - 6px)" }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (e.button !== 0) return; // only left click
                        if (!timelineRef.current) return;
                        if (!block.startAt || !block.endAt) return;

                        const rect =
                          timelineRef.current.getBoundingClientRect();
                        const y = e.clientY - rect.top;
                        const rawMinutes = y / PX_PER_MIN;

                        const start = new Date(block.startAt);
                        const end = new Date(block.endAt);
                        const blockStartMinutes =
                          start.getHours() * 60 + start.getMinutes();

                        setResizeState(null);
                        setDragState({
                          id: block.id,
                          originalStart: start,
                          originalEnd: end,
                          offsetMinutes: rawMinutes - blockStartMinutes,
                        });
                      }}
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

                    {/* RESIZE HANDLE: bottom strip */}
                    <div
                      className="today-event-resize-handle"
                      style={{
                        height: "6px",
                        cursor: "ns-resize",
                        borderTop: "1px solid rgba(0, 0, 0, 0.1)",
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (e.button !== 0) return;
                        if (!block.startAt || !block.endAt) return;

                        const start = new Date(block.startAt);
                        const end = new Date(block.endAt);

                        setDragState(null);
                        setResizeState({
                          id: block.id,
                          originalStart: start,
                          originalEnd: end,
                        });
                      }}
                    />
                  </div>
                );
              })}
          </div>
        </div>
      </section>

      {isNewOpen && draftStart &&
        (
          <NewEventModal
            start={draftStart}
            onClose={() => {
              setIsNewOpen(false);
              setDraftStart(null); // clear placeholder on cancel
            }}
            onCreated={async () => {
              setIsNewOpen(false);
              setDraftStart(null); // clear placeholder on create
              try {
                setLoading(true);
                setError(null);

                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date();
                endOfDay.setHours(23, 59, 59, 999);

                const timeMin = startOfDay.toISOString();
                const timeMax = endOfDay.toISOString();

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
              } catch (err: any) {
                setError(err.message ?? "Failed to load events");
              } finally {
                setLoading(false);
              }
            }}
          />
        )}
    </main>
  );
}

type NewEventModalProps = {
  start: Date;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
};

function NewEventModal({ start, onClose, onCreated }: NewEventModalProps) {
  const [title, setTitle] = useState("");
  const [durationMin, setDurationMin] = useState(60);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [objectId, setObjectId] = useState(""); // selected object id
  const [saving, setSaving] = useState(false);

  // NEW: objects for dropdown
  const [objects, setObjects] = useState<{ id: string; name: string }[]>([]);
  const [objectsLoading, setObjectsLoading] = useState(true);
  const [objectsError, setObjectsError] = useState<string | null>(null);

  useEffect(() => {
    const loadObjects = async () => {
      try {
        setObjectsLoading(true);
        setObjectsError(null);

        const res = await fetch("/api/object", { cache: "no-store" });
        if (!res.ok) {
          const text = await res.text();
          console.error("Load objects error", res.status, text);
          throw new Error("Failed to load objects");
        }

        const data = await res.json();
        setObjects(data.objects ?? []);
      } catch (err: any) {
        setObjectsError(err.message ?? "Failed to load your objects");
      } finally {
        setObjectsLoading(false);
      }
    };

    loadObjects();
  }, []);

  const startStr = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          location,
          start_at: start.toISOString(),
          duration_min: durationMin,
          recurrence_rrule: recurrence || null,
          object_id: objectId || null, // selected from dropdown
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("Create item error", res.status, text);
        throw new Error("Failed to create item");
      }
      await onCreated();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-5 today-modal">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              New event
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Starts at{" "}
              <span className="font-medium text-slate-800">{startStr}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs"
            disabled={saving}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Title
            </label>
            <input
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Location
              </label>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                min={5}
                max={1440}
                className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Recurrence RRULE
            </label>
            <input
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
              placeholder="e.g. FREQ=DAILY;INTERVAL=1"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
            />
          </div>

          {/* UPDATED: object dropdown */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Object
            </label>

            {objectsLoading ? (
              <p className="text-[11px] text-slate-500">
                Loading your objects…
              </p>
            ) : objectsError ? (
              <p className="text-[11px] text-red-500">{objectsError}</p>
            ) : objects.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                You don’t have any objects yet. Create one on the Objects page
                first.
              </p>
            ) : (
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                value={objectId}
                onChange={(e) => setObjectId(e.target.value)}
                required
              >
                <option value="">Select an object</option>
                {objects.map((obj) => (
                  <option key={obj.id} value={obj.id}>
                    {obj.name}
                  </option>
                ))}
              </select>
            )}

            <p className="mt-1 text-[10px] text-slate-500">
              This links the block to one of your saved objects (CS135, gym,
              etc.).
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="text-xs px-3.5 py-1.5 rounded-md bg-sky-600 text-white font-medium hover:bg-sky-500 disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={saving}
            >
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
