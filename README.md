# Factory OS

One-screen operator console for a factory floor. A plan of the plant with every zone and machine, a camera zoom into any zone that becomes an isometric scene of its equipment, a problems rail with ownership, and live telemetry per subsystem. Built in a 90-minute assessment window on top of the provided starter.

Run it with `npm install` then `npm run dev` and open http://localhost:5173. The mock API and WebSocket start with the dev server.

## What was built

| Requirement | Where | Notes |
|---|---|---|
| Factory overview | Header line + plan | Machines running, open problems by severity, zones needing attention. Nothing invented: no uptime, no "live" pill. |
| Active problems | Alerts rail (right) | Sorted open → severity → newest. Severity and zone filters. Hovering a row highlights its machine on the plan or in the zone scene. Acknowledge is a two-step "take ownership", never a clear. |
| Zone health | Plan outlines and counters | Health derived on the client (see decisions). Counter = open problems, coloured by the worst one. |
| Real-time | Everywhere | One WebSocket subscriber merges telemetry into the plan's readouts and the charts, and streams new alerts into the rail. |
| KPIs | Insights band (toggle in the stage header, expand to full screen, Esc to return, range: day / week / month / quarter / year / all time) | Failures per hour, mean time to acknowledge, machines running; alerts per hour stacked by severity, share by subsystem, open vs in-progress by zone, machines with most alerts. Scoped to the zone you are in. Categorical colours validated for colour-vision deficiency; severity uses the status ramp with legends. |
| Topology | Plan → zone → machine | Authored floor plan with irregular bays, aisles, offices, storage, dock. Zoom into a zone for an isometric scene of modelled machines; click a subsystem chip for a live chart, the alerts on it and a runbook link. |

## Decisions worth asking about

- **Everything fits one screen.** The plan (or the zone) and the alerts rail share the viewport; only the rail's list and the detail drawer scroll. Zooming into a zone is a camera move on the same SVG, then the isometric scene fades in place, so it never feels like a page change. Phones fall back to a scrolling stack.
- **Acknowledge means "I've got it", not "clear".** The brief requires acknowledging; operators fear accidental clears. So it is a two-step confirm, it records who took it (name set once in the header, kept in local storage because the mock endpoint takes no body), and the alert stays visible everywhere as "In progress · name", including on hover over the machine. Alerts only disappear when the backend clears them, which the mock never does.
- **Zone health is derived, not read from `/api/zones`.** The mock's zone health is static and never reflects streamed alerts. `src/lib/health.ts` computes it from machine status plus open alerts, so the plan reacts live.
- **Subsystems are the four telemetry channels.** The data has no subsystem concept. Each alert is classified by keyword into thermal, mechanical, output or electrical (`src/lib/channels.ts`), the channel the machine also reports telemetry for. It is a presentation heuristic and is labelled as such; a real alert would carry a subsystem id.
- **Connectivity is shown, not assumed.** There is no per-machine link state in the API, so when the factory link is down or the feed has gone quiet for 30 s every machine gets a no-link badge and the header shows the same icon (hover it for the reason). Demo it with `window.__setFactoryConnected(false)` in the console.
- **A machine cell shows the readings that are alerting.** Each plan cell has room for one to three readouts depending on its slot shape. They go to the subsystems with alerts, most severe first and coloured by severity, so the misbehaving number is the one on screen; healthy machines fall back to throughput (`src/lib/signals.ts`).
- **The floor plan is authored data.** No coordinates come from the API, so `src/lib/floorPlan.ts` holds the bays as polygons with named machine slots, plus aisles, columns, offices, QC bench, racks, dock doors and exits. Swapping in a real plant is a data change, not a code change.
- **Machines are modelled, not iconed.** Third-party isometric icon packs come with licences and fixed perspectives. Each machine type is a small list of boxes and cylinders in `src/lib/machineModels.ts`, rendered by a 40-line projection (`src/lib/iso.ts`) with painter's-order sorting. A CNC mill has an enclosure window and pendant, a press has columns and a ram, a conveyor has legs, rollers and rails.
- **A normalisation layer absorbs bad data.** `src/lib/normalize.ts` handles the `machine_name` key, zone names that are wrong or are actually the zone id (WebSocket payloads do this), and implausible timestamps (one alert is dated 1969 and shows "time unknown").
- **Alerts are fetched unfiltered and filtered on the client**, so socket alerts and server alerts merge in one place (`useAlertsFeed`). A 15 s poll reconciles what the socket does not carry. Acknowledging a socket-only alert gets a 404 from the mock; the UI keeps the ownership locally without interrupting the operator.
- **The simulation was extended, and says so.** The starter emulator sent one random machine's telemetry every 3 s, so any single chart got a point every ~40 s, and there was no history endpoint. `src/mocks/telemetrySim.ts` now drives both: every machine streams every 3 s as a random walk, and `GET /api/machines/:id/telemetry?minutes=60` returns the last hour at 20 s resolution, shaped so a machine with an alert steps from a healthy baseline to its faulted values around the alert time. Fixture timestamps are rebased to the session (`src/mocks/time.ts`) so "raised 2 min ago" and the chart's time axis agree; the deliberate 1969 record is left alone. Alerts appear on charts as vertical markers. The chart follows live as a rolling 15-minute window. A two-finger sideways swipe or a drag scrubs back through time, pinch zooms, the strip underneath shows the whole loaded range and can be dragged, and reaching the start fetches six hours; a Live button snaps back to the newest data. Gestures are coalesced to one update per frame and the chart draws at most 320 points.
- **Insights sit under the plan, never instead of it.** The band slides up from the bottom of the stage and the plan scales to fit above it, so the real-time view stays visible. KPIs are pure reducers in `src/lib/kpis.ts` over the same alert feed the rail uses. With six fixture alerts the charts are sparse; the stress scenario or a few minutes of the live feed fills them.
- **Design.** Dark carbon surfaces with white type, blue as the only interaction accent, and a semantic ramp (red, amber, gray, green) that never overlaps with it. One typeface. Motion is one reveal per view, the camera zoom, and a slow pulse on critical machines; reduced-motion is respected. The brand mark at `public/brand-mark.svg` is a placeholder to be replaced with the official logo.

### Known gaps

- The painting zone reports 4 machines but only 3 exist; the UI trusts the machine list, not the count.
- No automated tests. The logic lives in pure functions (`normalize`, `health`, `channels`, `iso`, `floorPlan`) written to be unit-tested first.
- Ownership is per browser. A real system would store the acknowledging user server-side and broadcast it.

### Try it

In the browser console: `window.__setAlertScenario("stress")` (50 alerts) or `"empty"`, then press the refresh icon in the Alerts rail. `window.__setFactoryConnected(false)` drops the factory link.

---

## Starter documentation

A React + TypeScript starter project for a factory floor monitoring UI. The app simulates a factory with multiple **zones**, each containing **machines** that report telemetry data and raise **alerts**.

All backend data is mocked via [MSW](https://mswjs.io/) (Mock Service Worker) — no real server required.

---

## Quick Start

All dependencies are pre-installed. Just run:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The mock API is already running — you should see a navigation bar with Dashboard, Alerts, and Topology links.

> If you need to reinstall dependencies for any reason: `npm install`

---

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 6 | Dev server and build |
| Chakra UI | 2 | Component library ([docs](https://v2.chakra-ui.com/docs/components)) |
| React Query | 5 | Server state management |
| React Router | 6 | Client-side routing |
| MSW | 2 | API mocking |

---

## Project Structure

```
src/
├── types.ts                  # All TypeScript interfaces
├── App.tsx                   # Root component (providers, router, navbar)
├── main.tsx                  # Entry point (MSW initialization)
├── hooks/
│   ├── useFactoryStatus.ts   # Factory connection status + stats
│   ├── useZones.ts           # Zone list with health
│   ├── useAlerts.ts          # Alerts with optional filtering
│   ├── useAcknowledgeAlert.ts # Mutation to acknowledge an alert
│   └── useFactoryWebSocket.ts # Real-time event subscription
├── components/
│   └── SampleCard.tsx        # Example Chakra UI card (for reference)
├── pages/
│   ├── Dashboard.tsx         # Main dashboard page
│   ├── Alerts.tsx            # Alerts / active problems page
│   └── Topology.tsx          # Factory topology page
└── mocks/
    ├── browser.ts            # MSW browser setup
    ├── handlers.ts           # REST API mock handlers
    ├── websocket.ts          # WebSocket emulator
    └── data/
        ├── zones.json        # 4 factory zones
        ├── machines.json     # 14 machines across zones
        ├── alerts.json       # Active alerts
        └── events.json       # Event log
```

---

## Data Hooks

Pre-built hooks that handle all data fetching via React Query. Import from `src/hooks/`.

### `useFactoryStatus()`

Returns overall factory connection info.

```ts
const { data, isLoading, isError } = useFactoryStatus();
// data: FactoryStatus | undefined
```

### `useZones()`

Returns the list of factory zones.

```ts
const { data, isLoading, isError } = useZones();
// data: Zone[] | undefined
```

### `useAlerts(filters?)`

Returns active alerts. Accepts optional filters.

```ts
const { data, isLoading, isError } = useAlerts();
const { data } = useAlerts({ severity: "critical" });
const { data } = useAlerts({ zone: "welding" });
```

### `useAcknowledgeAlert()`

Mutation hook. Marks an alert as acknowledged.

```ts
const { mutate } = useAcknowledgeAlert();
mutate("alert-id-here");
```

### `useFactoryWebSocket(callback)`

Subscribes to real-time events. Manages connection lifecycle.

```ts
useFactoryWebSocket((message) => {
  // message.type: "telemetry" | "alert" | "event"
  // message.payload: varies by type
});
```

---

## REST API Endpoints

All endpoints are mocked and available immediately when the dev server runs.

| Endpoint | Method | Returns |
|---|---|---|
| `/api/factory/status` | GET | `FactoryStatus` object |
| `/api/zones` | GET | `Zone[]` |
| `/api/zones/:zoneId/machines` | GET | `Machine[]` for that zone |
| `/api/machines/:machineId` | GET | Single `Machine` |
| `/api/alerts` | GET | `Alert[]` — supports `?severity=` and `?zone=` query params |
| `/api/events` | GET | `FactoryEvent[]` |
| `/api/alerts/:alertId/acknowledge` | POST | `{ success: true }` |

---

## Data Types

All TypeScript interfaces are defined in `src/types.ts`:

```ts
interface FactoryStatus {
  connected: boolean;
  totalMachines: number;
  zoneCount: number;
  uptimeHours: number;
  lastUpdated: string;
}

interface Zone {
  id: string;
  name: string;
  machineCount: number;
  health: "healthy" | "degraded" | "faulted";
}

interface Machine {
  id: string;
  name: string;
  type: "cnc_mill" | "robotic_arm" | "conveyor" | "press" | "welder" | "spray_booth";
  zoneId: string;
  status: "running" | "idle" | "error" | "maintenance";
  telemetry: MachineTelemetry;
  lastUpdated: string;
}

interface MachineTelemetry {
  temperature: number;
  vibration: number;
  throughput: number;
  powerDraw: number;
}

interface Alert {
  id: string;
  machineId: string;
  machineName: string;
  zoneId: string;
  zoneName: string;
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface FactoryEvent {
  id: string;
  machineId: string;
  machineName: string;
  type: "machine_started" | "machine_stopped" | "alert_raised" | "alert_cleared" | "maintenance_scheduled";
  message: string;
  timestamp: string;
}

interface WebSocketMessage {
  type: "telemetry" | "alert" | "event";
  payload: unknown;
}
```

---

## Mock Data Summary

| Dataset | Records | Notes |
|---|---|---|
| Zones | 4 | Assembly, Welding, Painting, Packaging |
| Machines | 14 | Spread across all zones |
| Alerts | 6 | Mix of critical, warning, info; some acknowledged |
| Events | 20 | Machine starts/stops, alerts raised, maintenance |

### WebSocket Events

The WebSocket emulator pushes:
- **Telemetry updates** every ~3 seconds (random machine)
- **New alerts** every ~15 seconds (30% chance each interval)

---

## Reference Component

`src/components/SampleCard.tsx` demonstrates common Chakra UI patterns:
- Card with header, body, badge
- Loading skeleton state
- Props interface with TypeScript
