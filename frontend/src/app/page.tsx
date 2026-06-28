"use client";

import { useCallback, useState } from "react";
import { CommandPanel } from "@/components/CommandPanel";
import { MetricCards } from "@/components/MetricCards";
import { ServiceBar } from "@/components/ServiceBar";
import { Timeline } from "@/components/Timeline";
import { TopBar } from "@/components/TopBar";
import {
  controlConsumer,
  placeOrder,
  replayLog,
  type PlaceOrderBody,
} from "@/lib/api";
import { useMonitor } from "@/hooks/useMonitor";

export default function Home() {
  const { connected, events, statuses, clear } = useMonitor();
  const [busy, setBusy] = useState(false);

  // Small helper so every action shares the same busy-guard + error handling.
  const act = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }, []);

  const onRun = useCallback(
    (body: PlaceOrderBody) => act(() => placeOrder(body)),
    [act],
  );
  const onReplay = useCallback(() => act(() => replayLog()), [act]);
  const onControl = useCallback(
    (service: string, action: "pause" | "resume") =>
      act(() => controlConsumer(service, action)),
    [act],
  );

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        connected={connected}
        busy={busy}
        onReplay={onReplay}
        onClear={clear}
      />

      <div className="grid flex-1 grid-cols-[260px_1fr] gap-4 overflow-hidden p-4">
        {/* Left rail: scenarios → services → metrics */}
        <aside className="flex flex-col gap-5 overflow-y-auto rounded-lg border border-border bg-surface p-4">
          <CommandPanel onRun={onRun} busy={busy} />
          <ServiceBar statuses={statuses} onControl={onControl} />
          <MetricCards eventCount={events.length} statuses={statuses} />
        </aside>

        {/* Main: live timeline */}
        <main className="overflow-hidden">
          <Timeline events={events} />
        </main>
      </div>
    </div>
  );
}
