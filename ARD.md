# EventTracer — Architecture Decision Record (ARD)

This document captures the significant architectural decisions for EventTracer, the
reasoning behind each, the alternatives considered, and the consequences. It is the
"why" companion to `specs.md` (the "what").

Status legend: **Accepted** · Proposed · Superseded

---

## ADR-001 — The browser issues commands over HTTP; it never publishes to Kafka

**Status:** Accepted

**Context.** The UI needs to trigger orders and see resulting events. A naive design
might let the browser publish to Kafka directly.

**Decision.** The browser sends commands to the API Gateway over HTTPS
(`POST /orders`). Backend services are the only Kafka producers.

**Rationale.**
- Kafka speaks a binary TCP protocol — browsers cannot open a native Kafka connection.
- Direct publishing would require shipping broker credentials/ACLs to the client and
  would let anyone forge events (e.g. a fake `payment.succeeded`) — a fatal trust-boundary
  break. Kafka topics are an internal bus that assumes trusted producers.
- The API layer is where validation, authn/z, rate limiting, idempotency, and schema
  enforcement belong.

**Consequences.** A clean command/event split: commands in over HTTP, events out over
WebSocket, and the browser never knows Kafka exists.

---

## ADR-002 — Events flow back to the UI over WebSocket via a dedicated Event Monitor

**Status:** Accepted

**Context.** The UI must reflect events as they happen. Domain services could push to the
UI themselves, but that couples business logic to presentation.

**Decision.** A standalone Event Monitor service joins its own consumer group, subscribes
to all topics, and streams normalized events to the browser over WebSocket. Domain
services push nothing to the UI.

**Alternatives considered.**
- *Each service pushes to the UI directly* — rejected: couples every service to the
  frontend and duplicates transport concerns.
- *Polling a read API* — rejected: higher latency, not "real time", more load.
- *Server-Sent Events* — viable and simpler, but WebSocket is the better-known portfolio
  signal and supports future bidirectional needs.

**Consequences.** Observability is decoupled from the domain. The UI is "just another
consumer of the event log" — the single most important framing of the whole project.

---

## ADR-003 — Choreography-based saga (no central orchestrator)

**Status:** Accepted

**Context.** The order flow spans five services and must handle partial failure
(payment declines) with compensation (refunds).

**Decision.** Use a **choreographed** saga: each service reacts to events and emits its
own. The Refund Service consuming `payment.failed` is the compensating transaction.

**Alternatives considered.**
- *Orchestration (central saga coordinator)* — clearer control flow and easier to reason
  about for complex sagas, but adds a coordinator component and obscures the
  "services react to events" story this project is built to showcase.

**Consequences.** Maximum decoupling and a vivid demonstration of event-driven flow.
Trade-off acknowledged: choreography is harder to follow as sagas grow — which is exactly
why the visualization exists. (A future iteration could add an orchestrated mode for
comparison.)

---

## ADR-004 — Transactional Outbox for publishing events

**Status:** Accepted

**Context.** A service must update its database **and** publish an event. Doing both
independently risks the dual-write problem: the DB commit succeeds but the publish fails
(or vice versa), leaving the system inconsistent.

**Decision.** Each producing service writes its domain change and the outgoing event into
an `outbox` table in a single local transaction. A relay (polling, or CDC later) reads
unpublished outbox rows and publishes them to Kafka, marking them sent.

**Alternatives considered.**
- *Publish then write (or write then publish)* — rejected: not atomic, the classic dual-write bug.
- *Kafka transactions / exactly-once across DB+broker* — out of scope complexity for a demo.

**Consequences.** Atomic, reliable publishing with at-least-once semantics. Requires an
outbox table per producing service and a relay. Pairs with ADR-006 (idempotency) because
the relay may publish a row more than once.

---

## ADR-005 — Kafka in KRaft mode (no Zookeeper)

**Status:** Accepted

**Context.** Classic Kafka deployments run a separate Zookeeper ensemble for coordination.

**Decision.** Run Kafka in KRaft mode; do not deploy Zookeeper.

**Rationale.** Zookeeper has been deprecated for Kafka coordination; KRaft is the current
standard. Fewer containers in `docker-compose`, simpler local setup, and it signals
up-to-date ecosystem knowledge.

**Consequences.** One fewer moving part. Single-broker KRaft is sufficient for the demo.

---

## ADR-006 — At-least-once delivery with idempotent consumers

**Status:** Accepted

**Context.** Kafka (and the outbox relay) deliver at-least-once: a consumer may see the
same event more than once.

**Decision.** Every consumer is idempotent. Side-effectful handlers (e.g. Payment) use an
idempotency key / dedup table so reprocessing a duplicate event is a no-op.

**Alternatives considered.**
- *Exactly-once semantics (EOS)* — possible with Kafka transactions but adds significant
  complexity and is unnecessary when consumers are idempotent.

**Consequences.** Robust under retries, restarts, and redelivery. The "duplicate delivery"
failure scenario demonstrates this directly.

---

## ADR-007 — Dead Letter Queue for poison messages

**Status:** Accepted

**Context.** Some messages can never be processed (malformed payload, permanent error).
Retrying them forever blocks the partition.

**Decision.** After N retries (default 3), a consumer routes the failing message to a
`<topic>.DLQ` topic carrying the original envelope + failure metadata (`DeadLetter`), then
returns so the offset commits and the partition keeps moving. Implemented as a reusable
`processWithDlq` wrapper in `libs/kafka`; the Event Monitor consumes the DLQ topics and
renders dead letters as red cards in the run's column.

**Carve-out from ADR-004 / rule #4.** The DLQ produce is a **direct** publish, NOT
outbox-backed. The outbox exists to publish a domain event atomically with the state change
that caused it; a dead-letter has *no* state change to be atomic with (processing failed,
nothing was written), and a dropped DLQ produce simply means the message is redelivered and
retried again — acceptable. So rule #4 ("every producer publishes via the outbox") governs
DOMAIN event publishing only; operational dead-lettering is exempt by this ADR.

**Consequences.** The pipeline stays healthy under bad input; failures are inspectable.
Drives the "poison message → DLQ" demo scenario (trigger: an order item with sku `POISON`,
which payment-service can never process).

---

## ADR-008 — PostgreSQL with schema-per-service

**Status:** Accepted

**Context.** Microservices should own their data; a shared schema couples services.

**Decision.** A single Postgres instance with a **schema per service** (plus each
service's outbox table). Services do not read each other's tables.

**Rationale.** Honors database-per-service logically while keeping the demo to one
container. The trade-off (true isolation would mean separate databases) is acknowledged
rather than hidden.

**Consequences.** Clear ownership boundaries, simple local infra. Mention the trade-off
when presenting.

---

## ADR-009 — NestJS monorepo, one app per service

**Status:** Accepted

**Context.** The repo starts as a single Nest app. We need 5 domain services + gateway +
monitor sharing event contracts.

**Decision.** Convert to a **NestJS monorepo**: each service is an app under `apps/`,
shared code (event envelope types, Kafka config, outbox helper) lives in `libs/`. Use
Nest's microservice + Kafka transport.

**Alternatives considered.**
- *Separate repos per service* — more "realistic" but heavy for a solo portfolio project.
- *Single app, multiple modules* — simplest, but undermines the "independent services /
  independent consumer groups" story.

**Consequences.** Shared contracts without duplication, independent deployables, one repo
to clone and run. Suggested layout:

```
apps/
  api-gateway/
  order-service/
  payment-service/
  shipping-service/
  notification-service/
  refund-service/
  event-monitor/
libs/
  events/      # shared event envelope + topic constants
  kafka/       # producer/consumer config, serialization
  outbox/      # outbox entity + relay
```

---

## ADR-010 — Docker Compose for local orchestration

**Status:** Accepted

**Decision.** Ship a single `docker-compose.yml` bringing up: frontend, api-gateway, the
five services, event-monitor, kafka (KRaft), and postgres. `docker compose up` starts
everything.

**Consequences.** One-command startup; reviewers can run the whole system without setup.
Deployment to AWS (ECS/EKS + MSK) is a separate, later concern and is not part of the
architecture itself.

---

## ADR-011 — Notification service publishes `notification.sent` (for visibility)

**Status:** Accepted (supersedes the original "terminal sink — publishes nothing" note in
specs §4.5).

**Context.** The notification service was specified as a pure sink: it consumes events and
"sends" email/SMS but produces nothing. Because the Event Monitor can only surface what is
on a Kafka topic (ADR-002), a pure sink is **invisible in the UI** — yet notifying the
customer is a real, demo-worthy step of the saga. Someone watching only the browser would
never know it happened.

**Decision.** Notification publishes a `notification.sent` event (one per notification it
sends) through the **same transactional outbox** every other producer uses (ADR-004). The
Event Monitor subscribes to it and broadcasts it like any other event, so each notification
shows up as a card under its order's `correlationId`.

**Consequences.**
- The browser now shows the notification step; the saga is fully observable end-to-end.
- Notification is no longer a "pure sink" example — it regains the outbox + relay machinery.
- `notification.sent` is **observability-only**: nothing in the domain consumes it (only the
  Monitor), so it does not create new choreography or risk a feedback loop. Notification does
  not subscribe to its own topic.
- Idempotency is unchanged: dedupe is on the *consumed* event's `eventId`; the emitted
  `notification.sent` carries its own fresh id, so there is no key collision.

---

## ADR-012 — Event replay is read-only and reconstructs the UI from the log

**Status:** Accepted.

**Context.** Kafka retains the log, so the timeline a viewer sees should be reconstructable
from the topics alone — not dependent on having watched the browser live. specs §4.7 / §6
call for a "Replay events" action. The risk: a naïve replay could re-trigger the saga
(double charges, duplicate shipments) or let the browser reach into Kafka, both of which
break earlier decisions.

**Decision.** The **Event Monitor** exposes `POST /replay` (optional `?topic=`; omitted =
all domain topics). For each topic it snapshots the high-water mark, then drains from offset
0 with a **throwaway consumer group** (random id, `fromBeginning`) and re-pushes each
historical envelope over the existing WebSocket, tagged `replayed: true`. It stops the
instant every partition reaches the watermark. It **never produces to Kafka**.

**Consequences.**
- Replay is pure observability (ADR-002): a fresh group commits no offsets and disturbs no
  real consumer; no produce means no domain service is re-triggered. Idempotency (ADR-006)
  is not even exercised by replay — nothing in the domain re-consumes.
- The browser POSTs to the **monitor**, not the gateway. This does **not** weaken ADR-001:
  rule #1 is "the browser never *publishes to Kafka*," and replay is a read-only admin call;
  the monitor only consumes. Domain *intent* still goes only to the gateway.
- The log is shown to be the source of truth and the UI a projection of it: clearing the
  board and replaying rebuilds the same timeline from the topics alone.
- DLQ topics carry a `DeadLetter` wrapper, not an `EventEnvelope`, so replay is restricted
  to the known domain topics (unknown/`.DLQ` topic → 400).

---

## ADR-013 — Demonstrate idempotency by re-emitting the identical event from its owner

**Status:** Accepted (realizes ADR-006 as a runnable demo).

**Context.** specs §7 calls for a "duplicate delivery" scenario: re-deliver `order.created` and
show no second charge. The consumers are already idempotent (ADR-006), but we need a way to
*trigger* a redelivery on demand. Several options: (a) reset payment-service's consumer-group
offset and restart — operational, can't run while the group is live, and re-delivers to only
one consumer; (b) let the browser or Event Monitor re-publish the event — breaks rules #1/#4
(only an owning domain service may publish a domain event, via its outbox); (c) re-emit the
event from the service that owns it.

**Decision.** Option (c). `POST /orders/:id/redeliver` on the gateway emits an
`order.redeliver` **command** (rule #1: intent enters via the gateway, never the browser
touching Kafka). The **Order Service** — the owner of `order.created` — handles it by reading
the order's original outbox row and queuing a **new outbox row carrying the identical
envelope** (same `eventId`). The relay republishes it verbatim (rule #4), so the broker
effectively redelivers the same message.

**Consequences.**
- It's a *true* at-least-once redelivery: same `eventId`, so both dedupe strategies fire —
  Payment dedupes on `orderId` (no second charge / no second `payment.succeeded`), Notification
  on the consumed `eventId` (no second email). Shipping/Refund are never reached because no new
  `payment.*` is produced.
- The proof is visible: the order's column gains a second `order.created` card while every
  downstream count holds steady. Reusing the *same* `eventId` is essential — a fresh id would
  make Notification treat it as new and re-send.
- Redelivery deliberately bypasses `createOrder`'s order-exists guard (we *want* to re-emit);
  it only re-queues the event, never a second order row.
- No new infra and no offset surgery: the demo is repeatable from the UI per order.

---

## ADR-014 — Kill-a-consumer is a reversible pause driven over a control topic

**Status:** Accepted (realizes the kill-a-consumer demo from specs §7 as a one-click UI action).

**Context.** specs §7 calls for a "kill a consumer" scenario: stop a service, watch its events
buffer as consumer lag, restart it, watch the lag drain. Originally this was a manual `Ctrl+C`
in a terminal. To trigger it from the UI we need a browser-reachable mechanism. Options: (a) the
browser shells out to `docker stop`/process kill — impossible from a browser and not reversible
in-process; (b) block inside the message handler until released — risks Kafka session-timeout
rebalances and unpredictable reprocessing; (c) pause/resume the service's Kafka consumer on its
domain topic via kafkajs `consumer.pause/resume`.

**Decision.** Option (c). A new **`control.consumer`** topic carries `{service, action}` messages.
`POST /control/:service/:action` on the gateway publishes one (rule #1: intent enters via the
gateway, never the browser touching Kafka). Each **controllable service** (scope: payment +
shipping) consumes `control.consumer` and, for messages addressed to it, calls a shared
`ConsumerControl` (in `libs/kafka`) that pauses/resumes **only its domain topic** — the control
topic keeps flowing, so resume always lands. `ConsumerControl` is wired to the live kafkajs
consumer in `main.ts` after `listen()` via `app.unwrap<ServerKafka>()`. The **Event Monitor**
also consumes `control.consumer` (read-only) and marks the service `paused` in the health bar it
already broadcasts — observability stays decoupled (ADR-002).

**Consequences.**
- Pausing stops fetching the domain topic, so its events buffer in the partition (lag climbs);
  resume drains them — the exact "this isn't a REST call" proof, now reversible from the UI.
- The consumer stays a group member while paused, so describeGroups still shows it `up`; the
  monitor tracks the pause set separately and overrides the status to `paused`.
- A short, demo-friendly companion of the same idea: sentinel skus `FAIL` (force `payment.failed`)
  and `SLOW` (delay processing) need no control plane — they ride an ordinary order POST, like
  `POISON` (ADR-007).
- Reaching the kafkajs consumer uses `unwrap()` + a narrow cast to a protected field; contained to
  one helper in `libs/kafka`. If Nest's internals change, only that helper needs updating.

---

## Decision summary

| ADR | Decision | One-line why |
|---|---|---|
| 001 | Commands over HTTP, not direct Kafka | Trust boundary + protocol reality |
| 002 | Event Monitor → WebSocket | Decouple observability from domain |
| 003 | Choreography saga | Showcase event-driven flow; refund = compensation |
| 004 | Transactional outbox | Solve the dual-write problem |
| 005 | Kafka KRaft mode | Current standard, fewer containers |
| 006 | At-least-once + idempotency | Correct under redelivery |
| 007 | Dead letter queue | Survive poison messages |
| 008 | Postgres schema-per-service | Data ownership, one container |
| 009 | NestJS monorepo | Shared contracts, independent services |
| 010 | Docker Compose | One-command startup |
| 011 | Notification publishes `notification.sent` | Make the notify step visible in the UI |
| 012 | Read-only replay from the log | Rebuild the timeline without re-triggering the saga |
| 013 | Redeliver the identical event from its owner | Prove idempotency: no second charge on redelivery |
| 014 | Kill-a-consumer = reversible pause over a control topic | One-click pause/resume; lag builds then drains |
