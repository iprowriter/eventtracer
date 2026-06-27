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

**Decision.** After N retries, a consumer routes the failing message to a `<topic>.DLQ`
topic with failure metadata, then commits and moves on.

**Consequences.** The pipeline stays healthy under bad input; failures are inspectable.
Drives the "poison message → DLQ" demo scenario.

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
