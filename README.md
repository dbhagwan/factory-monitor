# Factory Floor Monitoring Dashboard

Operator dashboard for a factory floor: a top-down map of every zone and machine, an isometric drill-down per zone that shows which subsystem is in trouble, live telemetry charts, and a problems list with acknowledgement. Built in a 90-minute assessment window.

Run it with `npm install` then `npm run dev` and open http://localhost:5173.

## What was built

| Requirement | Where | Notes |
|---|---|---|
| Factory overview | Floor (`/`) | Status strip: link state, machines running, open problems by severity, zones needing attention. |
| Active problems | Problems (`/alerts`), rail on Floor | Sorted unacknowledged → severity → newest. Filters by severity and zone. Acknowledge is optimistic. |
| Zone health | Floor map, zone counters | Health is derived on the client (see decisions). Counter = unacknowledged alerts, coloured by the worst one. |
| Real-time | Everywhere | One WebSocket subscriber at the app root merges telemetry and alerts into the UI. The dot in the header ripples on every message. |
| Topology | Floor map, `/topology`, `/zones/:zoneId` | Top-down SVG map; isometric SVG scene per zone with a 2×2 of subsystem tiles on each machine. Click a tile for a live chart, the alerts on that subsystem, and a runbook link. |

## Decisions worth asking about

- **Zone health is derived, not read from `/api/zones`.** The mock returns a static health per zone that never changes when alerts stream in. `src/lib/health.ts` computes it from machine status plus open alerts, so the map reacts live. A real backend would own this; the function is small enough to move server-side.
- **Subsystems are the four telemetry channels.** The data model has no subsystem concept. Each alert is classified by keyword into thermal, mechanical, output or electrical (`src/lib/channels.ts`), which is also the channel the machine reports telemetry for. This is a presentation heuristic and is labelled as such in code; a real alert would carry a subsystem id.
- **A normalisation layer absorbs the bad data.** `src/lib/normalize.ts` handles records that use `machine_name` instead of `machineName`, zone names that are wrong or are actually the zone id (WebSocket payloads do this), and implausible timestamps (one alert is dated 1969 and shows as "time unknown"). Every alert, whichever source, passes through it once.
- **Alerts are fetched unfiltered and filtered on the client.** One cache entry means live alerts and server alerts are merged in one place (`useAlertsFeed`). Filtering 50 rows in memory is free; it would need revisiting at thousands.
- **Acknowledging a live alert returns 404.** Alerts that arrive over the socket are not in the mock server's store. The mutation keeps the optimistic acknowledgement and tells the operator it is local, instead of silently reverting or pretending it succeeded.
- **The WebSocket hook was fixed.** The starter's `useFactoryWebSocket` captured a stale callback and never disconnected. It now holds the callback in a ref and disconnects on unmount, and is mounted once at the root (`useLiveFeed`).
- **Telemetry history lives outside React Query.** It is an append-only client stream, so it sits in a small `useSyncExternalStore` ring buffer (60 samples per machine), seeded from the REST value so charts are never empty. Telemetry arrives for one random machine every 3 s, so any one chart fills slowly. That is a property of the feed, and the drawer says so.
- **Acknowledged is a visual state, not a hidden one.** An acknowledged alert keeps its colour but renders hollow, meaning "someone is on it". Counters only count unacknowledged alerts.
- **No coordinates in the API**, so the floor is a fixed 2×2 of zones and machines are laid out on a grid. Machine footprint and height in the isometric view come from the machine type.
- **Design.** Dark carbon surfaces with white type, blue as the only interaction accent, and a semantic alert ramp (red, amber, gray, green) that never overlaps with the accent. One typeface. Motion is limited to a single page-load reveal, a pulse on critical machines, and the live dot. Reduced-motion is respected.

### Known gaps

- The painting zone reports 4 machines but only 3 exist; the UI trusts the machine list, not the count.
- No automated tests. The pieces with logic (`normalize`, `health`, `channels`, `iso`) are pure functions written to be unit-tested first.
- Alerts that have been cleared server-side would need an `alert_cleared` event to disappear; the mock never sends one.

### Try it

In the browser console: `window.__setAlertScenario("stress")` (50 alerts), `"empty"`, or `"default"`, then reload the Problems page.

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
