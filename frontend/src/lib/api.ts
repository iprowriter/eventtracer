// Thin wrappers over the two backend entry points. The browser only ever sends
// COMMANDS here (rule #1) — it never publishes to Kafka. Events come back over
// the WebSocket (see useMonitor).

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:5000";
const MONITOR = process.env.NEXT_PUBLIC_MONITOR_URL ?? "http://localhost:4000";

export interface OrderItem {
  sku: string;
  quantity: number;
}
export interface PlaceOrderBody {
  items: OrderItem[];
  amount: number;
}

async function post(url: string): Promise<Response> {
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res;
}

/** Start a saga. Returns the minted orderId (the run's correlationId). */
export async function placeOrder(
  body: PlaceOrderBody,
): Promise<{ orderId: string }> {
  const res = await fetch(`${GATEWAY}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`placeOrder → ${res.status}`);
  return res.json();
}

/** Pause/resume a controllable consumer (kill-a-consumer demo). */
export async function controlConsumer(
  service: string,
  action: "pause" | "resume",
): Promise<void> {
  await post(`${GATEWAY}/control/${service}/${action}`);
}

/** Re-emit an order's original order.created (duplicate-delivery demo). */
export async function redeliverOrder(orderId: string): Promise<void> {
  await post(`${GATEWAY}/orders/${orderId}/redeliver`);
}

/** Read-only timeline rebuild from the Kafka log. */
export async function replayLog(): Promise<void> {
  await post(`${MONITOR}/replay`);
}
