"use client";

export function TopBar({
  connected,
  busy,
  onReplay,
  onClear,
}: {
  connected: boolean;
  busy: boolean;
  onReplay: () => void;
  onClear: () => void;
}) {
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-lg bg-[var(--order)]/15 text-[var(--order)]">
          <span className="text-lg">⚡</span>
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight">EventTracer</h1>
          <p className="text-xs text-muted">distributed order saga simulator</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onReplay}
          disabled={busy}
          className="rounded-md border border-border px-3 py-1.5 text-sm transition hover:bg-surface-2 disabled:opacity-50"
          title="Re-stream the whole history from the Kafka log (read-only)"
        >
          ↻ replay
        </button>
        <button
          onClick={onClear}
          className="rounded-md border border-border px-3 py-1.5 text-sm transition hover:bg-surface-2"
          title="Clear the timeline (local only)"
        >
          clear
        </button>
        <span className="ml-2 flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs">
          <span
            className="size-2 rounded-full"
            style={{ background: connected ? "var(--up)" : "var(--down)" }}
          />
          websocket · {connected ? "live" : "offline"}
        </span>
      </div>
    </header>
  );
}
