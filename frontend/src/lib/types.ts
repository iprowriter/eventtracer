// Mirrors the shared contracts in the backend's libs/events.
// The browser only ever READS these (events flow in over the WebSocket);
// it never constructs an envelope itself. (Inviolable rule #1)

/** Every domain event carries this envelope. `correlationId` = the saga/order id. */
export interface EventEnvelope<T = unknown> {
  eventId: string;
  eventType: string; // e.g. "order.created", "payment.succeeded", "order.created.DLQ"
  occurredAt: string; // ISO timestamp
  correlationId: string; // groups one saga run
  version: number;
  payload: T;
  /** Set by the monitor when an event is re-streamed from the replay endpoint. */
  replayed?: boolean;
}

/** Per-service consumer health, pushed by the monitor on the 'status' channel. */
export interface ConsumerStatus {
  service: string;
  /** 'paused' = deliberately paused via the kill-a-consumer control plane. */
  status: "up" | "down" | "paused";
  lag: number;
}
