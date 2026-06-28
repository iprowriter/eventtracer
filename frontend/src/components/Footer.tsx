import { LEGEND } from "@/lib/events-meta";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface px-6 py-10">
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--order)]">
            What is this?
          </h3>
          <p className="text-sm leading-relaxed text-muted">
            EventTracer is a distributed order-processing simulator that
            visualizes event-driven architecture in real time. It is an
            educational, portfolio project — not a real store. The product is the
            visualization itself: watching independent services choreograph a
            saga by reacting to events, with no central orchestrator pulling the
            strings.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--payment)]">
            How it works
          </h3>
          <p className="text-sm leading-relaxed text-muted">
            Every action on the left is a <strong>command</strong> — an HTTP POST
            to the API Gateway. The browser never publishes to Kafka; intent
            always enters through the gateway. The Order Service persists the
            order and its outbound event in one database transaction (the{" "}
            <strong>transactional outbox</strong>), and a relay forwards it to
            Kafka. From there the saga choreographs itself: Payment reacts to{" "}
            <code>order.created</code>, Shipping to{" "}
            <code>payment.succeeded</code>, Refund to{" "}
            <code>payment.failed</code>, Notification to everything — each an
            independent, idempotent consumer. Services never call each other
            synchronously; a dedicated Event Monitor streams every topic back to
            this page over a WebSocket, keeping observability decoupled from the
            domain.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--shipping)]">
            The tech &amp; the demos
          </h3>
          <p className="text-sm leading-relaxed text-muted">
            TypeScript and NestJS power the seven services, Apache Kafka in KRaft
            mode (no Zookeeper) is the log, PostgreSQL gives each service its own
            schema, and Next.js + Tailwind render this UI. The resilience demos
            are the memorable part: pause a consumer and watch lag build then
            drain, force a payment failure into the refund saga, poison a message
            into the dead-letter queue, or replay the whole log read-only — proof
            this is asynchronous choreography, not a disguised chain of function
            calls.
          </p>
        </section>
      </div>

      {/* Event-type key — each family has its own colour on the timeline. */}
      <div className="mx-auto mt-8 flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-6">
        {/* <span className="text-xs uppercase tracking-wide text-muted">
          event types
        </span> */}
        {/* {LEGEND.map((f) => (
          <span
            key={f.key}
            className="flex items-center gap-1.5 text-xs text-muted"
          >
            <span
              className="size-2.5 rounded-full"
              style={{ background: `var(${f.colorVar})` }}
            />
            {f.label}
          </span>
        ))} */}
      </div>

      <p className="mx-auto mt-6 max-w-5xl text-xs text-muted/70">
        EventTracer · built with NestJS · Kafka · PostgreSQL · Next.js  (- Martin Oputa)
      </p>
    </footer>
  );
}
