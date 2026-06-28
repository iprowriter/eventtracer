# EventTracer — Frontend

The Next.js dashboard for [EventTracer](../README.md): a live visualization of an event-driven
order saga choreographing through Kafka. It is a **pure subscriber** — it issues commands to the
API Gateway over HTTP and receives events back over a WebSocket; it never talks to Kafka directly.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS v4 · socket.io-client · lucide-react.

## Run it

The UI needs the backend running (API Gateway on `:5000`, Event Monitor on `:4000`). From the
repo root: `make up-all` (everything in Docker) or `make up` + the per-service dev targets. Then:

```bash
npm install      # first time
npm run dev      # http://localhost:3001
```

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

> Dev/start run on **:3001** (3000 is intentionally avoided).

## Configuration

Backend URLs come from env vars (sensible defaults, so it works out of the box):

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_GATEWAY_URL` | `http://localhost:5000` | where commands are POSTed |
| `NEXT_PUBLIC_MONITOR_URL` | `http://localhost:4000` | WebSocket events + `/replay` |

## Structure

```
src/
  app/            # layout, page (dashboard composition), globals.css, icon.svg
  components/     # TopBar, CommandPanel, ServiceBar, MetricCards, Timeline,
                  # RawMessageDrawer, KillConsumerMenu, HowItWorks, Footer
  hooks/          # useMonitor — the single socket.io subscription
  lib/            # api (HTTP commands), events-meta (colors/labels/narration),
                  # scenarios, types
public/
  how-it-works/   # drop walkthrough.mp4 here for the "how it works" modal
```

## Notes

- The dev/prod server runs on port 3001.
- `next.config.ts` sets `output: "standalone"` for a lean Docker image (see `Dockerfile`).
- Always-dark theme; event-family colors live as CSS tokens in `app/globals.css`.
