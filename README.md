# EventTracer

A distributed order-processing simulator that makes **event-driven architecture visible**.
Click a scenario and watch an order saga propagate through Kafka — publish, consume,
background job, notification — streamed to the browser in real time.

It is not a real e-commerce platform. It is a simulator whose product is the *live
visualization* of how independent services choreograph through an event log.

---

## Why it exists

Most backends say "we use Kafka." Few can *show* what actually happens between services.
EventTracer turns the normally-invisible event flow into something you can watch, pause on,
and explain — including the failure modes that separate a tutorial from real distributed-
systems understanding (compensation, consumer lag, dead-letter queues, idempotency, replay).

## What it demonstrates

- **Choreographed saga** across five services with no central orchestrator.
- **Command/event split** — the browser issues commands over HTTP; events stream back over
  WebSocket. The browser never touches Kafka.
- **Transactional outbox** — reliable publishing without the dual-write problem.
- **Decoupled observability** — a dedicated Event Monitor is "just another consumer."
- **Resilience patterns** — idempotent consumers, DLQ, consumer-down recovery, replay.

## Architecture

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

The browser sends **commands**; services react to **events**. Kafka runs in **KRaft mode**
(no Zookeeper). See [`ARD.md`](./ARD.md) for the reasoning behind every decision.

## Services

| Service | Role |
|---|---|
| API Gateway | Only public HTTP entry; hosts the UI WebSocket |
| Order | Creates orders, publishes `order.created` (via outbox) |
| Payment | Consumes `order.created`, publishes `payment.succeeded` / `payment.failed` |
| Shipping | Consumes `payment.succeeded`, publishes `shipment.created` |
| Notification | Consumes events, simulates email/SMS (terminal sink) |
| Refund | Consumes `payment.failed`, runs the compensation saga |
| Event Monitor | Consumes all topics, streams to the UI over WebSocket |

## Tech stack

NestJS (monorepo, Kafka transport) · Apache Kafka (KRaft) · PostgreSQL · WebSocket ·
Next.js + TypeScript + Tailwind · Docker Compose.

## Status

Early development. The repo currently starts as a single Nest 11 app; converting to the
monorepo layout below is the first task.

```
apps/    api-gateway · order-service · payment-service · shipping-service
         notification-service · refund-service · event-monitor
libs/    events · kafka · outbox
```

### Roadmap

1. **Phase 1** — happy path (Order → Payment → Shipping) + Event Monitor + live timeline.
2. **Phase 2** — Notification service + failed-payment/Refund compensation saga.
3. **Phase 3** — resilience demos: kill-a-consumer, DLQ, idempotency, replay.

## Getting started

> Docker Compose is added in Phase 1. Until then, run the single Nest app directly.

```bash
npm install
npm run start:dev        # run the app (per-service once the monorepo exists)

# once compose is added:
docker compose up        # brings up frontend, gateway, services, kafka, postgres
```

## Scripts

```bash
npm run build
npm run lint
npm run test
npm run test:e2e
```

## Documentation

- [`specs.md`](./specs.md) — what we're building: services, topics, UI, scenarios, milestones.
- [`ARD.md`](./ARD.md) — architecture decision records: the why behind each choice.
- [`CLAUDE.md`](./CLAUDE.md) — working agreement and inviolable architectural rules.

## License

UNLICENSED — portfolio / educational project.
