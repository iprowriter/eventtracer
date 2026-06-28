"use client";

import type { ConsumerStatus } from "@/lib/types";

// The saga services, in order. The two CONTROLLABLE ones can be paused/resumed
// from the UI (kill-a-consumer); the rest are status-only.
const SERVICES: { id: string; label: string }[] = [
  { id: "order-service", label: "order" },
  { id: "payment-service", label: "payment" },
  { id: "shipping-service", label: "shipping" },
  { id: "notification-service", label: "notification" },
  { id: "refund-service", label: "refund" },
];
const CONTROLLABLE = new Set(["payment-service", "shipping-service"]);

const DOT: Record<ConsumerStatus["status"] | "unknown", string> = {
  up: "var(--up)",
  paused: "var(--paused)",
  down: "var(--down)",
  unknown: "var(--muted)",
};

export function ServiceBar({
  statuses,
  onControl,
}: {
  statuses: ConsumerStatus[];
  onControl: (service: string, action: "pause" | "resume") => void;
}) {
  const byId = new Map(statuses.map((s) => [s.service, s]));

  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
        services
      </h3>
      <ul className="space-y-1">
        {SERVICES.map(({ id, label }) => {
          const s = byId.get(id);
          const state = s?.status ?? "unknown";
          const controllable = CONTROLLABLE.has(id);
          const paused = state === "paused";

          return (
            <li
              key={id}
              className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${
                controllable ? "cursor-pointer hover:bg-surface-2" : ""
              }`}
              onClick={
                controllable
                  ? () => onControl(id, paused ? "resume" : "pause")
                  : undefined
              }
              title={
                controllable
                  ? paused
                    ? "Click to resume this consumer"
                    : "Click to pause (kill) this consumer"
                  : undefined
              }
            >
              <span className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ background: DOT[state] }}
                />
                {label}
              </span>
              <span className="flex items-center gap-2">
                {s && s.lag > 0 && (
                  <span className="font-mono text-xs text-[var(--paused)]">
                    lag {s.lag}
                  </span>
                )}
                {controllable && (
                  <span className="text-xs text-muted opacity-0 transition group-hover:opacity-100">
                    {paused ? "▶ resume" : "⏸ pause"}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
