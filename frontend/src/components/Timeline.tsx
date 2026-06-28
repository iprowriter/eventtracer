"use client";

import {
  colorOf,
  describe,
  LEGEND,
  triggeredBy,
} from "@/lib/events-meta";
import type { EventEnvelope } from "@/lib/types";

function timeOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return (
    d.toLocaleTimeString("en-GB", { hour12: false }) +
    "." +
    String(d.getMilliseconds()).padStart(3, "0")
  );
}

function EventRow({ e }: { e: EventEnvelope }) {
  const isDlq = e.eventType.endsWith(".DLQ");
  return (
    <li
      className={`flex items-start gap-3 rounded-md px-2 py-2 transition hover:bg-surface-2 ${
        e.replayed ? "opacity-60" : ""
      }`}
    >
      <span className="mt-0.5 w-24 shrink-0 font-mono text-xs text-muted tabular-nums">
        {timeOf(e.occurredAt)}
      </span>
      <span
        className="mt-1.5 size-2 shrink-0 rounded-full"
        style={{ background: colorOf(e.eventType) }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-xs ${
              isDlq ? "bg-[var(--failure)]/15 text-[var(--failure)]" : "bg-surface-2"
            }`}
          >
            {e.eventType}
          </span>
          <span className="font-mono text-xs text-muted">
            {e.correlationId.slice(0, 8)}
          </span>
          {e.replayed && (
            <span className="rounded bg-surface-2 px-1 text-[10px] text-muted">
              ↻ replay
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted">
          triggeredBy <span className="text-foreground/80">{triggeredBy(e)}</span>
        </div>
      </div>
    </li>
  );
}

export function Timeline({ events }: { events: EventEnvelope[] }) {
  const latest = events[events.length - 1];

  return (
    <section className="flex h-full flex-col rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-sm font-medium">live event stream</h2>
        <span className="text-xs text-muted">{events.length} events</span>
      </div>

      {/* Narration: explain the most recent event in plain English. */}
      <div className="border-b border-border bg-surface-2/50 px-5 py-2.5 text-sm">
        {latest ? (
          <span>
            <span className="mr-2 text-muted">now:</span>
            {describe(latest)}
          </span>
        ) : (
          <span className="text-muted">
            Run a scenario on the left to start a saga.
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {events.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">
            Waiting for events…
          </p>
        ) : (
          <ul className="space-y-0.5">
            {events.map((e) => (
              <EventRow key={e.eventId + e.eventType} e={e} />
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-5 py-2.5">
        {LEGEND.map((f) => (
          <span key={f.key} className="flex items-center gap-1.5 text-xs text-muted">
            <span
              className="size-2 rounded-full"
              style={{ background: `var(${f.colorVar})` }}
            />
            {f.label}
          </span>
        ))}
      </div>
    </section>
  );
}
