"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ConsumerStatus, EventEnvelope } from "@/lib/types";

const MONITOR_URL =
  process.env.NEXT_PUBLIC_MONITOR_URL ?? "http://localhost:4000";

/**
 * Single source of truth for the live feed from the Event Monitor.
 * Connects once, listens on two channels:
 *   - 'event'  → an EventEnvelope (DLQ + replayed events ride the same channel)
 *   - 'status' → ConsumerStatus[] (per-service health + lag)
 * The browser is a pure subscriber here; it never publishes to Kafka.
 */
export function useMonitor() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [statuses, setStatuses] = useState<ConsumerStatus[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(MONITOR_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("event", (envelope: EventEnvelope) => {
      // Step 1: prove the pipe — log every envelope as it arrives.
      console.log("[event]", envelope.eventType, envelope.correlationId);
      setEvents((prev) => [...prev, envelope]);
    });

    socket.on("status", (next: ConsumerStatus[]) => setStatuses(next));

    return () => {
      socket.disconnect();
    };
  }, []);

  /** Wipe the local board (used later by the Clear button). */
  const clear = () => setEvents([]);

  return { connected, events, statuses, clear };
}
