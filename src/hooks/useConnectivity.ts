import { useFactoryStatus } from "./useFactoryStatus";
import { useLiveStatus } from "../lib/telemetryStore";

const SOCKET_SILENCE_MS = 30_000;

/**
 * Whether we can trust what the floor is showing. The API has no per-machine
 * link state, so a machine is considered unreachable when the factory link
 * is down or the socket has gone silent; every machine then shows the badge.
 */
export function useConnectivity() {
  const status = useFactoryStatus();
  const live = useLiveStatus();
  const factoryLinkDown = status.isError || status.data?.connected === false;
  const socketSilent =
    !live.connected ||
    (live.lastMessageAt !== null && Date.now() - live.lastMessageAt > SOCKET_SILENCE_MS);
  const offline = factoryLinkDown || socketSilent;
  return {
    offline,
    factoryLinkDown,
    socketSilent,
    isMachineOffline: (_machineId: string) => offline,
  };
}
