"use client";

import type { ConsumerStatus } from "@/lib/types";

export function MetricCards({
  eventCount,
  statuses,
}: {
  eventCount: number;
  statuses: ConsumerStatus[];
}) {
  const totalLag = statuses.reduce((sum, s) => sum + s.lag, 0);

  return (
    <div className="grid grid-cols-2 gap-2">
      <Card label="events" value={eventCount} />
      <Card
        label="consumer lag"
        value={totalLag}
        accent={totalLag > 0 ? "var(--paused)" : undefined}
        pulse={totalLag > 0}
      />
    </div>
  );
}

function Card({
  label,
  value,
  accent,
  pulse = false,
}: {
  label: string;
  value: number;
  accent?: string;
  pulse?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div
        className={`font-mono text-2xl font-semibold tabular-nums ${
          pulse ? "animate-pulse" : ""
        }`}
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
