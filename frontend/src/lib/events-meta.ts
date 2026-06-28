import type { EventEnvelope } from "./types";

// Central place for how each event family is coloured, labelled, and explained.
// The describe() text is reused by the narration strip.

export interface EventFamily {
  key: string;
  label: string;
  colorVar: string; // a CSS custom property defined in globals.css
}

export function familyOf(eventType: string): EventFamily {
  if (eventType.endsWith(".DLQ"))
    return { key: "failure", label: "dead-letter", colorVar: "--failure" };
  if (eventType === "payment.failed")
    return { key: "failure", label: "payment failed", colorVar: "--failure" };
  if (eventType.startsWith("order"))
    return { key: "order", label: "order", colorVar: "--order" };
  if (eventType.startsWith("payment"))
    return { key: "payment", label: "payment", colorVar: "--payment" };
  if (eventType.startsWith("shipment"))
    return { key: "shipping", label: "shipping", colorVar: "--shipping" };
  if (eventType.startsWith("notification"))
    return { key: "notification", label: "notification", colorVar: "--notification" };
  if (eventType.startsWith("refund"))
    return { key: "refund", label: "refund", colorVar: "--refund" };
  return { key: "order", label: eventType, colorVar: "--order" };
}

export function colorOf(eventType: string): string {
  return `var(${familyOf(eventType).colorVar})`;
}

/** The families shown in the timeline legend, in saga order. */
export const LEGEND: EventFamily[] = [
  { key: "order", label: "order", colorVar: "--order" },
  { key: "payment", label: "payment", colorVar: "--payment" },
  { key: "shipping", label: "shipping", colorVar: "--shipping" },
  { key: "notification", label: "notification", colorVar: "--notification" },
  { key: "refund", label: "refund", colorVar: "--refund" },
  { key: "failure", label: "failure / DLQ", colorVar: "--failure" },
];

/** What caused this event (the `triggeredBy` on the card). */
export function triggeredBy(e: EventEnvelope): string {
  const payload = e.payload as { triggeredBy?: string } | undefined;
  if (payload?.triggeredBy) return payload.triggeredBy;
  switch (e.eventType) {
    case "order.created":
      return "you (place order)";
    case "payment.succeeded":
    case "payment.failed":
      return "order.created";
    case "shipment.created":
      return "payment.succeeded";
    case "refund.initiated":
      return "payment.failed";
    default:
      if (e.eventType.endsWith(".DLQ")) return "3 failed attempts";
      return "—";
  }
}

/** Plain-English narration of an event as it happens. */
export function describe(e: EventEnvelope): string {
  const id = e.correlationId.slice(0, 8);
  if (e.eventType.endsWith(".DLQ"))
    return `Order ${id} couldn't be processed — after retries it was routed to the dead-letter queue.`;
  switch (e.eventType) {
    case "order.created":
      return `Order ${id} was placed. The Order Service published order.created.`;
    case "payment.succeeded":
      return `Payment for ${id} succeeded — Shipping will react next.`;
    case "payment.failed":
      return `Payment for ${id} was declined — the Refund Service will compensate.`;
    case "shipment.created":
      return `Shipping created a shipment for ${id}.`;
    case "refund.initiated":
      return `A refund was initiated for the failed order ${id}.`;
    case "notification.sent":
      return `The customer was notified about ${id}.`;
    default:
      return `${e.eventType} for order ${id}.`;
  }
}
