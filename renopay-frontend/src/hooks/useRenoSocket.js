import { useEffect, useRef, useCallback } from "react";

/**
 * Connects to the backend's /ws endpoint and calls `onEvent({type, data})`
 * for every push. Auto-reconnects with backoff if the connection drops
 * (mobile networks flap constantly — a payments app can't just give up).
 */
export function useRenoSocket(onEvent) {
  const wsRef = useRef(null);
  const retryDelay = useRef(1000);
  const handlerRef = useRef(onEvent);
  const timeoutRef = useRef(null);
  handlerRef.current = onEvent;

  const connect = useCallback(() => {
    const token = localStorage.getItem("renopay_access_token");
    if (!token) return;

    const isNativeApp =
      typeof window !== "undefined" &&
      (window.Capacitor?.isNativePlatform?.() ||
        window.location.protocol === "capacitor:" ||
        window.location.protocol === "file:" ||
        (window.location.hostname === "localhost" && !window.location.port));

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const defaultHost = isNativeApp ? "renopay-original.vercel.app" : window.location.host;
    const wsUrl = import.meta.env.VITE_WS_URL || `${isNativeApp ? "wss:" : protocol}//${defaultHost}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      retryDelay.current = 1000;
      ws.send(JSON.stringify({ type: "auth", token }));
    };
    ws.onmessage = (evt) => {
      try {
        const parsed = JSON.parse(evt.data);
        handlerRef.current?.(parsed);
      } catch { /* ignore malformed frames */ }
    };
    ws.onclose = () => {
      timeoutRef.current = setTimeout(connect, retryDelay.current);
      retryDelay.current = Math.min(retryDelay.current * 2, 30000);
    };
    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connect();
    const handleOnline = () => {
      retryDelay.current = 1000;
      connect();
    };
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
