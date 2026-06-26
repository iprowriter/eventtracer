# CLAUDE.md — working agreement for EventTracer

Guidance for Claude (and any AI assistant) when working in this repository. Read this,
`specs.md`, and `ARD.md` before making changes.

## What this project is

EventTracer is a **distributed order-processing simulator** that visualizes event-driven
architecture in real time. It is an educational/portfolio project, not a real e-commerce
system. The product is the *visualization* of how services choreograph through Kafka.

- `specs.md` — what we're building (services, topics, UI, scenarios, milestones).
- `ARD.md` — the architectural decisions and why they were made.

## Architecture in one paragraph

The browser issues **commands** to the API Gateway over HTTP and receives **events** back
over WebSocket. Domain services (Order, Payment, Shipping, Notification, Refund)
choreograph a saga by reacting to Kafka events — there is no central orchestrator. Each
producing service uses a **transactional outbox** to publish reliably. A dedicated
**Event Monitor** consumes all topics and streams them to the UI, keeping observability
decoupled from the domain. Kafka runs in **KRaft mode** (no Zookeeper).

## Inviolable rules (do not break without updating ARD.md first)

1. **The browser never publishes to Kafka.** User intent is always a `POST` to the
   gateway. Events flow back only via the Event Monitor's WebSocket. (ADR-001, ADR-002)
2. **Services never call each other synchronously for the saga.** They communicate by
   producing/consuming events. (ADR-003)
3. **Services don't push to the UI.** Only the Event Monitor does. (ADR-002)
4. **Every producer publishes via the outbox**, never with a direct produce-after-commit.
   (ADR-004)
5. **Every consumer is idempotent.** Assume at-least-once delivery; reprocessing a
   duplicate must be a no-op. (ADR-006)
6. **A service reads only its own schema.** No cross-service table access. (ADR-008)
7. **Shared event contracts live in `libs/events`** — never redefine an envelope or topic
   name inside a service. (ADR-009)

If a task genuinely requires changing one of these, stop and propose an ADR update first.

## Repository layout (target)

NestJS monorepo. The repo currently starts as a single Nest 11 app; converting to the
monorepo below is an early task (see `specs.md` Phase 1).

```
apps/
  api-gateway/           # only public HTTP entry; hosts/proxies the UI WebSocket
  order-service/
  payment-service/
  shipping-service/
  notification-service/
  refund-service/
  event-monitor/         # consumes all topics → WebSocket
libs/
  events/                # event envelope types + topic name constants
  kafka/                 # producer/consumer config + serialization
  outbox/                # outbox entity + relay
```

## Conventions

- **Language/stack:** TypeScript, NestJS (microservice + Kafka transport), PostgreSQL,
  Next.js + Tailwind for the frontend.
- **Event names:** lowercase dotted, past tense — `order.created`, `payment.succeeded`,
  `payment.failed`, `shipment.created`, `refund.initiated`. DLQ = `<topic>.DLQ`.
- **Event envelope:** every event carries `eventId`, `eventType`, `occurredAt`,
  `correlationId`, `version`, `payload`. The `correlationId` (the order/saga id) groups a
  run in the UI — always set it.
- **Idempotency:** side-effectful handlers must dedupe on a key (idempotency key or
  `eventId`).
- **Determinism:** simulated outcomes (payment success/failure, latency) must be seeded so
  demo scenarios are repeatable.
- **Formatting/lint:** respect the existing Prettier + ESLint config; run `npm run lint`
  and `npm run format` before finishing.

## Common commands

```bash
npm run start:dev      # run (single app today; per-app once monorepo exists)
npm run build
npm run lint
npm run test
npm run test:e2e
docker compose up      # full system once compose is added
```

(Per-service scripts like `nest start <app>` will exist after the monorepo conversion.)

## Definition of done for a change

- Honors the inviolable rules above (or updates `ARD.md` with a new/changed ADR).
- New consumer logic is idempotent and has a test for duplicate delivery where relevant.
- New events are defined once in `libs/events` and carry the full envelope.
- `npm run lint` and `npm run test` pass.
- If behavior changes the spec or a decision, update `specs.md` / `ARD.md` in the same
  change.

## Build order

Follow the milestones in `specs.md`:
1. Happy path (Order → Payment → Shipping) + Event Monitor + WebSocket timeline.
2. Notification service + failed-payment/Refund compensation saga.
3. Resilience demos: kill-a-consumer, DLQ, idempotency, replay.

Ship Phase 1 end-to-end before starting Phase 2. The visualization is the point — get one
event flowing all the way to the browser before adding breadth.
