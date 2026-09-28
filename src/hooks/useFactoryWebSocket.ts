import { useEffect, useRef } from "react";
import type { WebSocketMessage } from "../types";
import { mockWebSocket } from "../mocks/websocket";

/**
 * Subscribe to real-time factory events via WebSocket.
 *
 * The callback is held in a ref so the latest closure is always invoked
 * without re-subscribing, and the connection is closed on unmount.
 * Intended to be mounted once at the app root (see useLiveFeed).
 */
export function useFactoryWebSocket(
  onMessage: (message: WebSocketMessage) => void,
  onConnectionChange?: (connected: boolean) => void
) {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;
  const connRef = useRef(onConnectionChange);
  connRef.current = onConnectionChange;

  useEffect(() => {
    mockWebSocket.connect();
    connRef.current?.(true);
    const unsubscribe = mockWebSocket.onMessage((m) => handlerRef.current(m));

    return () => {
      unsubscribe();
      mockWebSocket.disconnect();
      connRef.current?.(false);
    };
  }, []);
}
