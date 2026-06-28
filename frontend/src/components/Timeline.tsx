"use client";

import { useMemo, useState } from "react";
import {
  colorOf,
  describe,
  eventKey,
  LEGEND,
  sagaStatus,
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

function EventRow({
  e,
  selected,
  onSelect,
  isFirst,
  isLast,
}: {
  e: EventEnvelope;
  selected: boolean;
  onSelect: (e: EventEnvelope) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const isDlq = e.eventType.endsWith(".DLQ");
  return (
    <li
      onClick={() => onSelect(e)}
      title="Click to read the raw envelope"
      className={`animate-row-in group flex cursor-pointer items-stretch gap-3 rounded-md px-2 transition hover:bg-surface-2 ${
        selected ? "bg-surface-2 ring-1 ring-[var(--order)]/40" : ""
      } ${e.replayed ? "opacity-60" : ""}`}
    >
      <span className="w-20 shrink-0 pt-2 font-mono text-xs text-muted tabular-nums">
        {timeOf(e.occurredAt)}
      </span>

      {/* Timeline rail: a short stub above the dot + a fill below it, so the
          line runs continuously from one event's dot to the next. The dot is
          coloured per event family and ringed so it stands out against the line. */}
      <div className="flex w-3 flex-col items-center">
        <span
          className={`h-3 w-px ${isFirst ? "bg-transparent" : "bg-border"}`}
        />
        <span
          className="size-3 shrink-0 rounded-full ring-2 ring-surface"
          style={{ background: colorOf(e.eventType) }}
        />
        <span
          className={`w-px flex-1 ${isLast ? "bg-transparent" : "bg-border"}`}
        />
      </div>

      <div className="min-w-0 flex-1 py-2">
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

      {/* Affordance: a chevron that brightens on hover so rows read as clickable. */}
      <span className="flex items-center pr-1 text-muted/30 transition group-hover:translate-x-0.5 group-hover:text-foreground">
        ›
      </span>
    </li>
  );
}

/** A list of event rows, with the timeline rail trimmed at its own ends. */
function EventList({
  events,
  selectedKey,
  onSelect,
}: {
  events: EventEnvelope[];
  selectedKey: string | null;
  onSelect: (e: EventEnvelope) => void;
}) {
  return (
    <ul>
      {events.map((e, i) => (
        <EventRow
          // Position-qualified so a legitimately duplicated event (e.g. a
          // redelivery reusing the same eventId) can't collide on key.
          key={`${eventKey(e)}::${i}`}
          e={e}
          selected={eventKey(e) === selectedKey}
          onSelect={onSelect}
          isFirst={i === 0}
          isLast={i === events.length - 1}
        />
      ))}
    </ul>
  );
}

/** One saga (all events sharing a correlationId), collapsible, with an outcome. */
function SagaGroup({
  cid,
  events,
  selectedKey,
  onSelect,
  collapsed,
  onToggle,
}: {
  cid: string;
  events: EventEnvelope[];
  selectedKey: string | null;
  onSelect: (e: EventEnvelope) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const status = sagaStatus(events);
  return (
    <div className="rounded-lg border border-border">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-t-lg px-3 py-2 text-left transition hover:bg-surface-2"
      >
        <span className="flex items-center gap-2">
          <span className="text-muted">{collapsed ? "▸" : "▾"}</span>
          <span className="font-mono text-sm">{cid.slice(0, 8)}</span>
          <span
            className="rounded-full border px-2 py-0.5 text-xs"
            style={{
              color: `var(${status.colorVar})`,
              borderColor: `var(${status.colorVar})`,
            }}
          >
            {status.label}
          </span>
        </span>
        <span className="text-xs text-muted">{events.length} events</span>
      </button>
      {!collapsed && (
        <div className="border-t border-border px-2 py-1">
          <EventList
            events={events}
            selectedKey={selectedKey}
            onSelect={onSelect}
          />
        </div>
      )}
    </div>
  );
}

export function Timeline({
  events,
  selectedKey,
  onSelect,
  filterNote = null,
  emptyMessage = "Waiting for events…",
}: {
  events: EventEnvelope[];
  selectedKey: string | null;
  onSelect: (e: EventEnvelope) => void;
  filterNote?: string | null;
  emptyMessage?: string;
}) {
  const latest = events[events.length - 1];
  const [grouped, setGrouped] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  // Bucket events by correlationId, preserving the order each saga first appeared.
  const groups = useMemo(() => {
    const m = new Map<string, EventEnvelope[]>();
    for (const e of events) {
      const arr = m.get(e.correlationId);
      if (arr) arr.push(e);
      else m.set(e.correlationId, [e]);
    }
    return [...m.entries()];
  }, [events]);

  function toggleGroup(cid: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      return next;
    });
  }

  return (
    <section className="flex h-full flex-col rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">live event stream</h2>
          {filterNote && (
            <span className="rounded-full border border-[var(--failure)]/40 px-2 py-0.5 text-xs text-[var(--failure)]">
              filtered · {filterNote}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {events.length > 0 && (
            <span className="text-xs text-muted/60">
              click an event to inspect →
            </span>
          )}
          {/* View toggle: flat stream vs grouped by correlationId (saga). */}
          <div className="flex rounded-md border border-border p-0.5 text-xs">
            {(["stream", "grouped"] as const).map((m) => {
              const isActive = grouped === (m === "grouped");
              return (
                <button
                  key={m}
                  onClick={() => setGrouped(m === "grouped")}
                  className={`rounded px-2 py-0.5 capitalize transition ${
                    isActive
                      ? "bg-surface-2 text-foreground"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
          <span className="text-xs text-muted">{events.length} events</span>
        </div>
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
          <p className="animate-pulse py-12 text-center text-sm text-muted">
            {emptyMessage}
          </p>
        ) : grouped ? (
          <div className="space-y-2">
            {groups.map(([cid, evs]) => (
              <SagaGroup
                key={cid}
                cid={cid}
                events={evs}
                selectedKey={selectedKey}
                onSelect={onSelect}
                collapsed={collapsed.has(cid)}
                onToggle={() => toggleGroup(cid)}
              />
            ))}
          </div>
        ) : (
          <EventList
            events={events}
            selectedKey={selectedKey}
            onSelect={onSelect}
          />
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
