"use client";

import { useState } from "react";
import {
  Clock,
  CreditCard,
  type LucideIcon,
  ShoppingCart,
  Skull,
} from "lucide-react";
import type { PlaceOrderBody } from "@/lib/api";
import {
  bodyForScenario,
  sampleOrder,
  SCENARIOS,
  type Scenario,
  type ScenarioId,
} from "@/lib/scenarios";

// Icon per scenario (UI concern, kept out of the scenarios data module).
const SCENARIO_ICONS: Record<ScenarioId, LucideIcon> = {
  place: ShoppingCart,
  failed: CreditCard,
  delayed: Clock,
  poison: Skull,
};

export function CommandPanel({
  onRun,
  busy,
}: {
  onRun: (body: PlaceOrderBody, label: string) => void;
  busy: boolean;
}) {
  // The editable order values are held as STRINGS while typing so the fields can
  // be cleared (an empty box stays empty instead of snapping back to 0/1). They're
  // parsed into numbers only when an order is actually placed.
  const [form, setForm] = useState(() => toForm(sampleOrder()));
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  // The last-run scenario stays highlighted (white) until another takes over.
  const [active, setActive] = useState<string | null>(null);

  function setField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function generate() {
    setGenerating(true);
    // Brief delay so the "generating…" state is visible (it's a real action).
    setTimeout(() => {
      setForm(toForm(sampleOrder()));
      setGenerating(false);
    }, 550);
  }

  function run(scenario: Scenario) {
    setActive(scenario.id);
    // Coerce the strings to a valid order at submit time (empty → sensible default).
    const base: PlaceOrderBody = {
      items: [
        {
          sku: form.sku.trim() || "ITEM-1",
          quantity: Math.max(1, parseInt(form.qty, 10) || 1),
        },
      ],
      amount: parseFloat(form.amount) || 0,
    };
    onRun(bodyForScenario(scenario, base), scenario.label);
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
        scenarios
      </h3>

      <div className="space-y-2">
        {SCENARIOS.map((s) => {
          const Icon = SCENARIO_ICONS[s.id];
          return (
            <button
              key={s.id}
              onClick={() => run(s)}
              disabled={busy}
              title={s.hint}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                active === s.id
                  ? "border-foreground bg-foreground font-medium text-background"
                  : "border-border bg-surface hover:border-foreground/40 hover:bg-surface-2"
              }`}
            >
              <Icon size={16} className="shrink-0" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Optional: prove the inputs are real by editing or regenerating them. */}
      <button
        onClick={() => setEditing((e) => !e)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-foreground/80 transition hover:border-foreground hover:bg-surface-2 hover:text-foreground"
      >
        {editing ? "▾ hide order inputs" : "✎ edit order inputs"}
      </button>

      {editing && (
        <div className="mt-2 space-y-2 rounded-lg border border-border bg-surface-2 p-3">
          <Field label="sku">
            <input
              value={form.sku}
              onChange={(e) => setField("sku", e.target.value)}
              className="w-full rounded bg-surface px-2 py-1 font-mono text-xs outline-none ring-1 ring-border focus:ring-[var(--order)]"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="qty">
              <input
                type="number"
                min={1}
                value={form.qty}
                onChange={(e) => setField("qty", e.target.value)}
                className="w-full rounded bg-surface px-2 py-1 font-mono text-xs outline-none ring-1 ring-border focus:ring-[var(--order)]"
              />
            </Field>
            <Field label="amount">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.amount}
                onChange={(e) => setField("amount", e.target.value)}
                className="w-full rounded bg-surface px-2 py-1 font-mono text-xs outline-none ring-1 ring-border focus:ring-[var(--order)]"
              />
            </Field>
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="w-full rounded border border-border px-2 py-1.5 text-xs transition hover:bg-surface disabled:opacity-60"
          >
            {generating ? "✦ generating a new sample…" : "🎲 generate new sample"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Turn a generated order into editable string fields. */
function toForm(order: PlaceOrderBody) {
  return {
    sku: order.items[0].sku,
    qty: String(order.items[0].quantity),
    amount: String(order.amount),
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
