"use client";

import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";

// Drop a single walkthrough recording here and it replaces the placeholder.
const VIDEO_SRC = "/how-it-works/walkthrough.mp4";

const FEATURES: { title: string; desc: string }[] = [
  {
    title: "Place order",
    desc: "Sends a real POST to the API Gateway. The order is persisted with a transactional outbox, then choreographs through payment → shipping → notification.",
  },
  {
    title: "Failed payment",
    desc: "Uses a FAIL sku so the payment is declined; the Refund service compensates and a refund notification is sent.",
  },
  {
    title: "Delayed order",
    desc: "Uses a SLOW sku so the payment consumer stalls a few seconds — watch consumer lag rise, then drain.",
  },
  {
    title: "Poison → DLQ",
    desc: "A POISON sku can never be processed; after retries it's routed to the dead-letter queue and shows as a red card.",
  },
  {
    title: "Kill a consumer",
    desc: "Pause or resume payment/shipping's Kafka consumer. While paused, its events buffer as lag and drain on resume — proof this is async choreography, not REST calls.",
  },
  {
    title: "Replay",
    desc: "Re-streams the whole history from the Kafka log (read-only). The board rebuilds with dimmed ↻ replay rows; the saga is not re-triggered.",
  },
  {
    title: "DLQ view",
    desc: "Filters the live stream to dead-letter events only, so failures are easy to isolate.",
  },
  {
    title: "Stream / grouped + raw envelope",
    desc: "Toggle a flat timeline or saga cards grouped by correlationId. Click any event to read its full published envelope; hover to spotlight its saga.",
  },
];

export function HowItWorks() {
  const [open, setOpen] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm transition hover:bg-surface-2"
        title="What does each control do?"
      >
        <HelpCircle size={16} />
        how it works
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="How EventTracer works"
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-base font-semibold">How EventTracer works</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted transition hover:bg-surface-2 hover:text-foreground"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              <p className="mb-4 text-sm text-muted">
                EventTracer visualizes an event-driven order saga choreographing
                through Kafka in real time. Here&apos;s what each control does:
              </p>

              {/* Walkthrough video — falls back to a placeholder until added. */}
              {videoError ? (
                <div className="mb-5 grid aspect-video w-full place-items-center rounded-lg border border-dashed border-border bg-surface-2 text-center text-sm text-muted">
                  🎬 Walkthrough video coming soon
                </div>
              ) : (
                <video
                  src={VIDEO_SRC}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                  onError={() => setVideoError(true)}
                  className="mb-5 w-full rounded-lg border border-border"
                />
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {FEATURES.map((f) => (
                  <section key={f.title}>
                    <h3 className="text-sm font-medium">{f.title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">
                      {f.desc}
                    </p>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
