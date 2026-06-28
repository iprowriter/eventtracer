"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
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
  dimmed,
  onSelect,
  onHover,
  isFirst,
  isLast,
}: {
  e: EventEnvelope;
  selected: boolean;
  dimmed: boolean;
  onSelect: (e: EventEnvelope) => void;
  onHover: (correlationId: string | null) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const isDlq = e.eventType.endsWith(".DLQ");
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(e)}
        onMouseEnter={() => onHover(e.correlationId)}
        onMouseLeave={() => onHover(null)}
        title="Open the raw envelope"
        className={`animate-row-in group flex w-full items-stretch gap-3 rounded-md px-2 text-left transition hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--order)] ${
          selected ? "bg-surface-2 ring-1 ring-[var(--order)]/40" : ""
        } ${dimmed ? "opacity-30" : e.replayed ? "opacity-60" : ""}`}
      >
        <span className="w-20 shrink-0 pt-2 font-mono text-xs text-muted tabular-nums">
          {timeOf(e.occurredAt)}
        </span>

        {/* Timeline rail: a short stub above the dot + a fill below it, so the
            line runs continuously from one event's dot to the next. */}
        <span className="flex w-3 flex-col items-center">
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
        </span>

        <span className="min-w-0 flex-1 py-2">
          <span className="flex items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-xs ${
                isDlq
                  ? "bg-[var(--failure)]/15 text-[var(--failure)]"
                  : "bg-surface-2"
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
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            triggeredBy{" "}
            <span className="text-foreground/80">{triggeredBy(e)}</span>
          </span>
        </span>

        {/* Affordance: a chevron that brightens on hover so rows read as clickable. */}
        <span className="flex items-center pr-1 text-muted/30 transition group-hover:translate-x-0.5 group-hover:text-foreground">
          ›
        </span>
      </button>
    </li>
  );
}

/** A list of event rows, with the timeline rail trimmed at its own ends. */
function EventList({
  events,
  selectedKey,
  activeCid,
  onSelect,
  onHover,
}: {
  events: EventEnvelope[];
  selectedKey: string | null;
  activeCid: string | null;
  onSelect: (e: EventEnvelope) => void;
  onHover: (correlationId: string | null) => void;
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
          dimmed={activeCid != null && e.correlationId !== activeCid}
          onSelect={onSelect}
          onHover={onHover}
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
  activeCid,
  onSelect,
  onHover,
  collapsed,
  onToggle,
}: {
  cid: string;
  events: EventEnvelope[];
  selectedKey: string | null;
  activeCid: string | null;
  onSelect: (e: EventEnvelope) => void;
  onHover: (correlationId: string | null) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const status = sagaStatus(events);
  // In grouped view all rows share a cid, so dim at the card level.
  const dimmed = activeCid != null && activeCid !== cid;
  return (
    <div
      className={`rounded-lg border border-border transition ${
        dimmed ? "opacity-30" : ""
      }`}
      onMouseEnter={() => onHover(cid)}
      onMouseLeave={() => onHover(null)}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-t-lg px-3 py-2 text-left transition hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--order)]"
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
            activeCid={null} /* card already dims; don't double-dim rows */
            onSelect={onSelect}
            onHover={onHover}
          />
        </div>
      )}
    </div>
  );
}

export function Timeline({
  events,
  selectedKey,
  selectedCorrelationId = null,
  onSelect,
  filterNote = null,
  emptyMessage = "Waiting for events…",
  maxEvents,
}: {
  events: EventEnvelope[];
  selectedKey: string | null;
  selectedCorrelationId?: string | null;
  onSelect: (e: EventEnvelope) => void;
  filterNote?: string | null;
  emptyMessage?: string;
  maxEvents?: number;
}) {
  const latest = events[events.length - 1];
  const [grouped, setGrouped] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [hoverCid, setHoverCid] = useState<string | null>(null);
  const [following, setFollowing] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // The saga to spotlight: hovered row wins, else the one open in the drawer.
  const activeCid = hoverCid ?? selectedCorrelationId;
  const atCap = maxEvents != null && events.length >= maxEvents;

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

  // Auto-scroll to the newest event while "following" (user is at the bottom).
  useEffect(() => {
    if (!following) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events, following, grouped]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setFollowing(atBottom);
  }

  function jumpToLatest() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setFollowing(true);
  }

  function toggleGroup(cid: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      return next;
    });
  }

  return (
    <section className="relative flex h-full flex-col rounded-lg border border-border bg-surface">
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
          <span className="text-xs text-muted">
            {atCap ? `latest ${maxEvents}` : `${events.length} events`}
          </span>
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

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2"
      >
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
                activeCid={activeCid}
                onSelect={onSelect}
                onHover={setHoverCid}
                collapsed={collapsed.has(cid)}
                onToggle={() => toggleGroup(cid)}
              />
            ))}
          </div>
        ) : (
          <EventList
            events={events}
            selectedKey={selectedKey}
            activeCid={activeCid}
            onSelect={onSelect}
            onHover={setHoverCid}
          />
        )}
      </div>

      {/* "Jump to latest" appears when the user has scrolled up off the bottom. */}
      {!following && events.length > 0 && (
        <button
          onClick={jumpToLatest}
          className="absolute bottom-16 right-5 flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs shadow-lg transition hover:bg-surface"
        >
          <ArrowDown size={14} /> jump to latest
        </button>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-5 py-2.5">
        {LEGEND.map((f) => (
          <span
            key={f.key}
            className="flex items-center gap-1.5 text-xs text-muted"
          >
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
