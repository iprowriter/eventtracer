"use client";

import { useEffect, useState } from "react";
import { colorOf } from "@/lib/events-meta";
import type { EventEnvelope } from "@/lib/types";

export function RawMessageDrawer({
  event,
  onClose,
}: {
  event: EventEnvelope | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  // Keep showing the last event while the drawer slides out, so the content
  // doesn't blank mid-animation. React's "adjust state during render" pattern:
  // remember the last non-null event without an effect.
  const [shown, setShown] = useState<EventEnvelope | null>(event);
  const [prev, setPrev] = useState<EventEnvelope | null>(event);
  if (event !== prev) {
    setPrev(event);
    if (event) setShown(event);
  }

  // Close on Escape.
  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [event, onClose]);

  const open = !!event;
  const json = shown ? JSON.stringify(shown, null, 2) : "";

  async function copy() {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <aside
      aria-hidden={!open}
      className={`absolute right-0 top-0 bottom-0 z-10 flex w-[420px] max-w-[85%] flex-col border-l border-border bg-surface shadow-2xl transition-transform duration-200 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: shown ? colorOf(shown.eventType) : undefined }}
          />
          <div className="min-w-0">
            <div className="truncate font-mono text-sm">{shown?.eventType}</div>
            <div className="truncate font-mono text-xs text-muted">
              {shown?.correlationId}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-muted transition hover:bg-surface-2 hover:text-foreground"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs text-muted">published envelope</span>
        <button
          onClick={copy}
          className="rounded border border-border px-2 py-1 text-xs transition hover:bg-surface-2"
        >
          {copied ? "✓ copied" : "copy JSON"}
        </button>
      </div>

      <pre className="flex-1 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed text-foreground/90">
        {json}
      </pre>
    </aside>
  );
}
