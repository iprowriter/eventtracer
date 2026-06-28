"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ConsumerStatus, EventEnvelope } from "@/lib/types";

const MONITOR_URL =
  process.env.NEXT_PUBLIC_MONITOR_URL ?? "http://localhost:4000";

/** Keep only the most recent N events so a long session / big replay stays snappy. */
export const MAX_EVENTS = 500;

/**
 * Single source of truth for the live feed from the Event Monitor.
 * Connects once, listens on two channels:
 *   - 'event'  → an EventEnvelope (DLQ + replayed events ride the same channel)
 *   - 'status' → ConsumerStatus[] (per-service health + lag)
 * The browser is a pure subscriber here; it never publishes to Kafka.
 */
export function useMonitor() {
  const [connected, setConnected] = useState(false);
  // True only after we were connected and then dropped — drives a reconnect banner.
  const [reconnecting, setReconnecting] = useState(false);
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [statuses, setStatuses] = useState<ConsumerStatus[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(MONITOR_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setReconnecting(false);
    });
    socket.on("disconnect", () => {
      setConnected(false);
      setReconnecting(true); // we were live, so this is a real drop
    });

    socket.on("event", (envelope: EventEnvelope) => {
      // Cap the buffer to the latest MAX_EVENTS to bound memory + render cost.
      setEvents((prev) => [...prev, envelope].slice(-MAX_EVENTS));
    });

    socket.on("status", (next: ConsumerStatus[]) => setStatuses(next));

    return () => {
      socket.disconnect();
    };
  }, []);

  /** Wipe the local board (Clear button + before a replay). */
  const clear = () => setEvents([]);

  return { connected, reconnecting, events, statuses, clear, maxEvents: MAX_EVENTS };
}
