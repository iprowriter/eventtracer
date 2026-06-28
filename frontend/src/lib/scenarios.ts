import type { PlaceOrderBody } from "./api";

// Catalogue of sample SKUs used to generate "real" (non-hardcoded) orders, so
// the user can see the values change. POISON / FAIL / SLOW are the sentinel
// SKUs the backend reacts to (DLQ / forced failure / delay).
const CATALOGUE = [
  "BOOK-1",
  "TSHIRT-M",
  "MUG-2",
  "CABLE-USB-C",
  "HEADPHONES",
  "NOTEBOOK-A5",
  "BOTTLE-1L",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** A fresh, randomised order body — the "generate new sample" feature. */
export function sampleOrder(): PlaceOrderBody {
  const quantity = 1 + Math.floor(Math.random() * 3);
  const amount = Number((9.99 + Math.random() * 90).toFixed(2));
  return { items: [{ sku: pick(CATALOGUE), quantity }], amount };
}

export type ScenarioId = "place" | "failed" | "delayed" | "poison";

export interface Scenario {
  id: ScenarioId;
  label: string;
  hint: string;
  /** Sentinel sku to inject, if any (else a normal catalogue item). */
  sku?: "FAIL" | "SLOW" | "POISON";
}

export const SCENARIOS: Scenario[] = [
  { id: "place", label: "place order", hint: "a normal order — ~80% succeed" },
  {
    id: "failed",
    label: "failed payment",
    hint: "sku FAIL → payment declined → refund saga",
    sku: "FAIL",
  },
  {
    id: "delayed",
    label: "delayed order",
    hint: "sku SLOW → payment lags ~4s then drains",
    sku: "SLOW",
  },
  {
    id: "poison",
    label: "poison → DLQ",
    hint: "sku POISON → routed to the dead-letter queue",
    sku: "POISON",
  },
];

/** Build the POST body for a scenario, optionally honouring user-edited values. */
export function bodyForScenario(
  scenario: Scenario,
  base: PlaceOrderBody = sampleOrder(),
): PlaceOrderBody {
  if (!scenario.sku) return base;
  // Inject the sentinel sku while keeping the user's amount/quantity.
  return {
    items: [{ sku: scenario.sku, quantity: base.items[0]?.quantity ?? 1 }],
    amount: base.amount,
  };
}
