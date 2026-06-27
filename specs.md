# EventTracer — Specification

> A distributed order-processing simulator that makes event-driven architecture **visible**.
> Click a scenario, watch the saga propagate through Kafka in real time.

---

## 1. Purpose & scope

EventTracer is a portfolio/educational project that demonstrates a production-shaped
event-driven backend. It is **not** a real e-commerce platform — it is a *simulator*
whose primary product is the live visualization of how services choreograph through a
Kafka event log.

The differentiator is observability: every publish, consume, background job, and
notification is streamed to a UI in real time so the normally-invisible event flow
becomes something you can watch and explain.

### In scope
- 5 domain services choreographing a distributed order saga over Kafka.
- An event-monitor service that taps every topic and streams to the browser.
- A frontend with a control panel (scenarios) and a live event timeline.
- Failure scenarios: failed payment + refund (compensation), delayed processing,
  consumer-down with lag, replay.
- Local orchestration via Docker Compose.

### Out of scope
- Real payment processors, real shipping carriers, real email/SMS delivery
  (all simulated with deterministic/seeded latency and outcomes).
- Authentication of end users, multi-tenancy, production hardening.
- Horizontal scaling / multi-broker clusters (single broker is fine for the demo).

---

## 2. Core concepts

| Concept | Meaning in this project |
|---|---|
| **Command** | A synchronous intent from the client (`POST /orders`). Validated, persisted, then translated into an event. The browser only ever issues commands. |
| **Event** | An immutable fact on a Kafka topic (`order.created`). Past tense. Services react to events, never call each other directly. |
| **Choreography saga** | Services coordinate by reacting to each other's events with no central orchestrator. The refund flow is the compensating transaction. |
| **Transactional outbox** | Each service writes its domain row **and** its outgoing event to an `outbox` table in one DB transaction; a relay publishes from the outbox to Kafka. Solves the dual-write problem. |
| **Event monitor** | A dedicated consumer group subscribed to all topics that pushes every event to the UI over WebSocket. Keeps domain services decoupled from the UI. |
| **DLQ** | Dead-letter topic for messages that fail processing after N retries. |

---

## 3. Architecture overview

```
Browser UI ──POST /orders (HTTPS)──▶ API Gateway ──▶ Order Service
   ▲                                                      │ writes order + outbox (1 tx)
   │ WebSocket (events out)                               ▼ relay publishes
   │                                          ┌──── Kafka event log (KRaft) ────┐
Event Monitor ◀── consumes all topics ────────┤  order.created                  │
                                              │  payment.succeeded / .failed     │
                                              │  shipment.created                │
                                              │  refund.initiated                │
                                              │  *.DLQ                           │
                                              └──┬────────┬─────────┬─────────┬──┘
                                          Payment   Shipping   Notification  Refund
```

- **Command path is synchronous HTTP.** The browser never talks to Kafka directly
  (no broker credentials in the client, no protocol access, no trust boundary break).
- **Event feedback path is WebSocket.** The event monitor is the only component that
  pushes to the browser.
- Kafka runs in **KRaft mode** (no Zookeeper).

See `ARD.md` for the decisions behind each of these.

---

## 4. Services

NestJS monorepo. Each service is an independent Nest application with its own Kafka
consumer group and (logically) its own Postgres schema.

### 4.1 API Gateway
- Exposes the public REST surface; the only inbound HTTP entry point.
- `POST /orders` — accept order command, forward to Order Service, return `202 Accepted`
  with `{ orderId }`. Honors an `Idempotency-Key` header.
- `GET /orders/:id` — current order status (read model).
- Hosts (or proxies) the WebSocket endpoint used by the UI.

### 4.2 Order Service
- Consumes the create-order command (via gateway).
- Persists the order **and** an `OrderCreated` event into the outbox in one transaction.
- Outbox relay publishes `order.created`.

### 4.3 Payment Service
- Consumes `order.created`.
- Simulates charging (seeded success/failure + latency).
- Publishes `payment.succeeded` **or** `payment.failed` via its outbox.
- **Idempotent**: a repeated `order.created` for the same order must not double-charge.

### 4.4 Shipping Service
- Consumes `payment.succeeded`.
- Creates a shipment, publishes `shipment.created`.

### 4.5 Notification Service
- Consumes all customer-relevant events (`order.created`, `payment.succeeded`,
  `payment.failed`, `shipment.created`).
- Simulates email/SMS ("order confirmed", "payment failed", "shipped").
- Publishes `notification.sent` (one per notification, via its outbox) **purely so the
  visualization shows the customer was notified** — see ADR-011. It is *not* a domain
  input: nothing consumes `notification.sent` except the Event Monitor.

### 4.6 Refund Service
- Consumes `payment.failed`.
- Runs the refund workflow (the saga's **compensating transaction**),
  publishes `refund.initiated`.

### 4.7 Event Monitor (observability)
- Joins a unique consumer group subscribed to **all** topics.
- Normalizes each record into a UI event and pushes it over WebSocket.
- Exposes a replay endpoint that re-reads a topic from offset 0.
- Surfaces consumer-lag metrics to the UI.

---

## 5. Topics & events

| Topic | Produced by | Consumed by | Payload (illustrative) |
|---|---|---|---|
| `order.created` | Order | Payment, Notification, Monitor | `{ orderId, items, amount, idempotencyKey }` |
| `payment.succeeded` | Payment | Shipping, Notification, Monitor | `{ orderId, paymentId, amount }` |
| `payment.failed` | Payment | Refund, Notification, Monitor | `{ orderId, reason }` |
| `shipment.created` | Shipping | Notification, Monitor | `{ orderId, shipmentId, carrier }` |
| `refund.initiated` | Refund | Notification, Monitor | `{ orderId, refundId, amount }` |
| `notification.sent` | Notification | Monitor | `{ orderId, notificationId, channel, message, triggeredBy }` |
| `<topic>.DLQ` | any consumer | Monitor | original message + failure metadata |

**Envelope** (every event shares this shape):

```json
{
  "eventId": "uuid",
  "eventType": "order.created",
  "occurredAt": "ISO-8601",
  "correlationId": "orderId or saga id",
  "version": 1,
  "payload": { }
}
```

`correlationId` ties every event in one saga together — it's what the UI groups a run by.

---

## 6. Frontend specification

Two-column layout (Next.js + TypeScript).

### Left — control panel
- Scenario buttons: **Place order**, **Failed payment**, **Delayed order**,
  **Kill shipping consumer**, **Replay events**.
- Service status column (Order, Payment, Shipping, Notification, Refund) with live
  state dots (idle / active / done / error).
- Metric cards: total events, consumer lag.

### Right — live event stream
- Timestamped timeline rail, newest events appended in real time over WebSocket.
- Each row: timestamp · color-coded type dot · service · action · topic pill.
- Color legend encodes type: publish, consume, background job, notification, failure.
- Grouped/filterable by `correlationId` (one saga run).

### Realtime contract
- Client opens a WebSocket on load and renders events as they arrive.
- Client **never** publishes to Kafka. User intents are `POST`s to the gateway;
  resulting events flow back over the socket.

---

## 7. Failure & resilience scenarios (the memorable part)

| Scenario | What it demonstrates |
|---|---|
| **Failed payment** | `payment.failed` → Refund consumes → compensation saga → notification. |
| **Delayed order** | Injected processing latency; consumer lag rises then drains. |
| **Kill shipping consumer** | Events buffer in the partition while the consumer is down; on restart it catches up and lag returns to 0 — the clearest "this isn't a REST call" moment. |
| **Duplicate delivery** | Re-deliver `order.created`; idempotency key prevents a second charge. |
| **Poison message → DLQ** | A malformed event is retried N times then routed to the DLQ. |
| **Replay** | Reset a consumer offset and replay the log from the beginning. |

---

## 8. Non-functional requirements

- **Determinism**: scenario outcomes are seeded so demos are repeatable.
- **Idempotency**: all consumers are safe under at-least-once delivery.
- **Decoupling**: domain services know only Kafka; the UI is just another consumer.
- **Observability**: every event is inspectable; consumer lag is surfaced.
- **One-command startup**: `docker compose up` brings up the whole system.

---

## 9. Tech stack

| Layer | Choice |
|---|---|
| Backend services | NestJS (monorepo, microservice + Kafka transport) |
| Messaging | Apache Kafka (KRaft mode, no Zookeeper) |
| Persistence | PostgreSQL (schema-per-service + outbox tables) |
| Realtime | WebSocket (event monitor → browser) |
| Frontend | Next.js + TypeScript + Tailwind |
| Orchestration | Docker Compose |

---

## 10. Milestones

1. **Phase 1 — happy path + visualization.** Order → Payment → Shipping, the event
   monitor, WebSocket timeline. A complete, demoable slice on its own.
2. **Phase 2 — notification + failure/refund saga.** Notification service and the
   `payment.failed` → Refund compensation flow.
3. **Phase 3 — resilience demos.** Kill-a-consumer, DLQ, idempotency, replay.

Ship Phase 1 end-to-end before starting Phase 2.
