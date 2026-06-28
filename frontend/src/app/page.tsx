"use client";

import { useCallback, useMemo, useState } from "react";
import { CommandPanel } from "@/components/CommandPanel";
import { Footer } from "@/components/Footer";
import { MetricCards } from "@/components/MetricCards";
import { RawMessageDrawer } from "@/components/RawMessageDrawer";
import { ServiceBar } from "@/components/ServiceBar";
import { Timeline } from "@/components/Timeline";
import { TopBar } from "@/components/TopBar";
import {
  controlConsumer,
  placeOrder,
  replayLog,
  type PlaceOrderBody,
} from "@/lib/api";
import { eventKey } from "@/lib/events-meta";
import type { EventEnvelope } from "@/lib/types";
import { useMonitor } from "@/hooks/useMonitor";

export default function Home() {
  const { connected, events, statuses, clear } = useMonitor();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<EventEnvelope | null>(null);
  const [dlqOnly, setDlqOnly] = useState(false);

  // DLQ view: filter the stream to dead-letter events only.
  const isDlq = (e: EventEnvelope) => e.eventType.endsWith(".DLQ");
  const dlqCount = useMemo(() => events.filter(isDlq).length, [events]);
  const visibleEvents = useMemo(
    () => (dlqOnly ? events.filter(isDlq) : events),
    [events, dlqOnly],
  );

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
  // Replay rebuilds the timeline from the Kafka log, so wipe the board first —
  // otherwise the replayed copies stack under the live events (and collide on key).
  const onReplay = useCallback(
    () =>
      act(async () => {
        clear();
        await replayLog();
      }),
    [act, clear],
  );
  const onControl = useCallback(
    (service: string, action: "pause" | "resume") =>
      act(() => controlConsumer(service, action)),
    [act],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        connected={connected}
        busy={busy}
        statuses={statuses}
        onControl={onControl}
        dlqOnly={dlqOnly}
        dlqCount={dlqCount}
        onToggleDlq={() => setDlqOnly((v) => !v)}
        onReplay={onReplay}
        onClear={clear}
      />

      {/* Dashboard fills exactly one viewport (minus the 3.5rem top bar); the
          footer flows below the fold. */}
      <div className="relative h-[calc(100vh-3.5rem)] overflow-hidden">
        <div className="grid h-full grid-cols-[260px_1fr] gap-4 p-4">
          {/* Left rail: scenarios → services → metrics */}
          <aside className="flex flex-col gap-5 overflow-y-auto rounded-lg border border-border bg-surface p-4">
            <CommandPanel onRun={onRun} busy={busy} />
            <ServiceBar statuses={statuses} onControl={onControl} />
            <MetricCards eventCount={events.length} statuses={statuses} />
          </aside>

          {/* Main: live timeline */}
          <main className="overflow-hidden">
            <Timeline
              events={visibleEvents}
              selectedKey={selected ? eventKey(selected) : null}
              onSelect={setSelected}
              filterNote={dlqOnly ? "DLQ only" : null}
              emptyMessage={
                dlqOnly
                  ? "No dead-letter events yet — try the poison → DLQ scenario."
                  : "Waiting for events…"
              }
            />
          </main>
        </div>

        {/* Right: raw-envelope reader, slides in over the timeline */}
        <RawMessageDrawer event={selected} onClose={() => setSelected(null)} />
      </div>

      <Footer />
    </div>
  );
}
