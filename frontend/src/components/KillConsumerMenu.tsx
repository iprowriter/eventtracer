"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Skull } from "lucide-react";
import type { ConsumerStatus } from "@/lib/types";

// Only these consumers can be paused/resumed from the UI (ADR-014 scope).
const CONTROLLABLE = [
  { id: "payment-service", label: "payment-service" },
  { id: "shipping-service", label: "shipping-service" },
];

export function KillConsumerMenu({
  statuses,
  onControl,
}: {
  statuses: ConsumerStatus[];
  onControl: (service: string, action: "pause" | "resume") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const byId = new Map(statuses.map((s) => [s.service, s]));
  const anyPaused = CONTROLLABLE.some(
    (c) => byId.get(c.id)?.status === "paused",
  );

  // Close on click-outside while open. (Reading the ref here is fine — it's an
  // event handler, not render.)
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Pause or resume a consumer (kill-a-consumer demo)"
        className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition ${
          anyPaused
            ? "border-[var(--paused)] bg-[var(--paused)]/15 text-[var(--paused)]"
            : "border-border hover:bg-surface-2"
        }`}
      >
        <Skull size={16} />
        kill a consumer
        <ChevronDown size={14} className="opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-border bg-surface p-1 shadow-2xl">
          {CONTROLLABLE.map((c) => {
            const status = byId.get(c.id)?.status;
            const paused = status === "paused";
            const down = status === "down" || status === undefined;
            const dot = paused
              ? "var(--paused)"
              : down
                ? "var(--down)"
                : "var(--up)";
            return (
              <button
                key={c.id}
                disabled={down}
                onClick={() => {
                  onControl(c.id, paused ? "resume" : "pause");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: dot }}
                  />
                  {c.label}
                </span>
                <span className="text-xs text-muted">
                  {down ? "offline" : paused ? "▶ resume" : "⏸ pause"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
