"use client";

import { MailX, RotateCcw, Trash2 } from "lucide-react";
import { KillConsumerMenu } from "@/components/KillConsumerMenu";
import type { ConsumerStatus } from "@/lib/types";

export function TopBar({
  connected,
  busy,
  statuses,
  onControl,
  dlqOnly,
  dlqCount,
  onToggleDlq,
  onReplay,
  onClear,
}: {
  connected: boolean;
  busy: boolean;
  statuses: ConsumerStatus[];
  onControl: (service: string, action: "pause" | "resume") => void;
  dlqOnly: boolean;
  dlqCount: number;
  onToggleDlq: () => void;
  onReplay: () => void;
  onClear: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-lg bg-[var(--order)]/15 text-[var(--order)]">
          <span className="text-lg">⚡</span>
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight">EventTracer (Kafka Playground)</h1>
          <p className="text-xs text-muted">distributed order saga simulator</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <KillConsumerMenu statuses={statuses} onControl={onControl} />
        <button
          onClick={onToggleDlq}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition ${
            dlqOnly
              ? "border-[var(--failure)] bg-[var(--failure)]/15 text-[var(--failure)]"
              : "border-border hover:bg-surface-2"
          }`}
          title="Show only dead-letter (.DLQ) events"
          aria-pressed={dlqOnly}
        >
          <MailX size={16} />
          DLQ view
          {dlqCount > 0 && (
            <span className="ml-1.5 rounded-full bg-[var(--failure)]/20 px-1.5 py-0.5 text-xs text-[var(--failure)]">
              {dlqCount}
            </span>
          )}
        </button>
        <button
          onClick={onReplay}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm transition hover:bg-surface-2 disabled:opacity-50"
          title="Re-stream the whole history from the Kafka log (read-only)"
        >
          <RotateCcw size={16} />
          replay
        </button>
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm transition hover:bg-surface-2"
          title="Clear the timeline (local only)"
        >
          <Trash2 size={16} />
          clear
        </button>
        <span className="ml-2 flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs">
          <span
            className={`size-2.5 rounded-full ${connected ? "animate-pulse" : ""}`}
            style={{
              background: connected ? "var(--up, #34d399)" : "var(--down, #f87171)",
              boxShadow: connected
                ? "0 0 0 3px rgba(52,211,153,0.18)"
                : "0 0 0 3px rgba(248,113,113,0.18)",
            }}
          />
          websocket · {connected ? "live" : "offline"}
        </span>
      </div>
    </header>
  );
}
