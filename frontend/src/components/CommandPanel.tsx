"use client";

import { useState } from "react";
import type { PlaceOrderBody } from "@/lib/api";
import {
  bodyForScenario,
  sampleOrder,
  SCENARIOS,
  type Scenario,
} from "@/lib/scenarios";

export function CommandPanel({
  onRun,
  busy,
}: {
  onRun: (body: PlaceOrderBody, label: string) => void;
  busy: boolean;
}) {
  // The current (editable) order values. Scenario buttons build on these, so the
  // user can see the values are real — not hardcoded — and tweak or regenerate.
  const [base, setBase] = useState<PlaceOrderBody>(() => sampleOrder());
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const item = base.items[0];

  function generate() {
    setGenerating(true);
    // Brief delay so the "generating…" state is visible (it's a real action).
    setTimeout(() => {
      setBase(sampleOrder());
      setGenerating(false);
    }, 550);
  }

  function run(scenario: Scenario) {
    onRun(bodyForScenario(scenario, base), scenario.label);
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
        scenarios
      </h3>

      <div className="space-y-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => run(s)}
            disabled={busy}
            title={s.hint}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-sm transition hover:border-[var(--order)] hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Optional: prove the inputs are real by editing or regenerating them. */}
      <button
        onClick={() => setEditing((e) => !e)}
        className="mt-3 text-xs text-muted hover:text-foreground"
      >
        {editing ? "▾ hide inputs" : "▸ edit order inputs"}
      </button>

      {editing && (
        <div className="mt-2 space-y-2 rounded-lg border border-border bg-surface-2 p-3">
          <Field label="sku">
            <input
              value={item.sku}
              onChange={(e) =>
                setBase({ items: [{ ...item, sku: e.target.value }], amount: base.amount })
              }
              className="w-full rounded bg-surface px-2 py-1 font-mono text-xs outline-none ring-1 ring-border focus:ring-[var(--order)]"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="qty">
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) =>
                  setBase({
                    items: [{ ...item, quantity: Number(e.target.value) || 1 }],
                    amount: base.amount,
                  })
                }
                className="w-full rounded bg-surface px-2 py-1 font-mono text-xs outline-none ring-1 ring-border focus:ring-[var(--order)]"
              />
            </Field>
            <Field label="amount">
              <input
                type="number"
                min={0}
                step="0.01"
                value={base.amount}
                onChange={(e) =>
                  setBase({ items: base.items, amount: Number(e.target.value) || 0 })
                }
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
