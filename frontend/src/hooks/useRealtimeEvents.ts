import { useEffect, useRef } from "react";
import { API_BASE, getToken } from "@/api/client";
import { useToast, type ToastTone } from "@/components/ToastProvider";

export type RealtimeEvent = {
  type: string;
  title?: string;
  message?: string;
  payload?: Record<string, unknown>;
  ts?: string;
};

function eventTone(ev: RealtimeEvent): ToastTone {
  if (ev.type === "feedback.created" && ev.payload?.routed_to === "alert") {
    return "danger";
  }
  if (ev.type === "waitlist.offered") return "canary";
  if (ev.type === "notification.sent") return "canary";
  if (ev.type.startsWith("appointment")) return "canary";
  if (ev.type.startsWith("chat")) return "canary";
  if (ev.type.startsWith("feedback")) return "danger";
  return "muted";
}

/** Subscribe to admin WS events and optionally show toasts. */
export function useRealtimeEvents(
  enabled: boolean,
  onEvent?: (ev: RealtimeEvent) => void,
  options?: { toasts?: boolean },
) {
  const { push } = useToast();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const showToasts = options?.toasts !== false;

  useEffect(() => {
    if (!enabled) return;
    const token = getToken();
    if (!token) return;

    const wsBase = API_BASE.replace(/^http/, "ws");
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let timer: number | undefined;

    let pingTimer: number | undefined;

    const connect = () => {
      if (closed) return;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
      }
      ws = new WebSocket(
        `${wsBase}/ws/events?token=${encodeURIComponent(token)}`,
      );
      ws.onopen = () => {
        retry = 0;
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = window.setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
              ws.send("ping");
            } catch {
              /* ignore */
            }
          }
        }, 20000);
      };
      ws.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data as string) as RealtimeEvent;
          onEventRef.current?.(ev);
          if (ev.type === "connected") return;
          if (showToasts) {
            push({
              title: ev.title || ev.type,
              message: ev.message || "",
              tone: eventTone(ev),
            });
            try {
              const ctx = new AudioContext();
              const o = ctx.createOscillator();
              const g = ctx.createGain();
              o.type = "sine";
              o.frequency.value = ev.type.includes("feedback") ? 320 : 660;
              g.gain.value = 0.04;
              o.connect(g);
              g.connect(ctx.destination);
              o.start();
              o.stop(ctx.currentTime + 0.08);
              window.setTimeout(() => void ctx.close(), 200);
            } catch {
              /* ignore audio */
            }
          }
        } catch {
          /* ignore bad payload */
        }
      };
      ws.onclose = () => {
        if (pingTimer) clearInterval(pingTimer);
        if (closed) return;
        retry += 1;
        timer = window.setTimeout(connect, Math.min(6000, 500 * retry));
      };
      ws.onerror = () => ws?.close();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          connect();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    connect();
    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timer) window.clearTimeout(timer);
      if (pingTimer) window.clearInterval(pingTimer);
      ws?.close();
    };
  }, [enabled, push, showToasts]);
}
