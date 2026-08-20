"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

/**
 * Calls same-origin /api/me (Next proxy → FastAPI) so the browser does not
 * need to talk to :8000 directly. Falls back to direct FastAPI URL if needed.
 */
export function ApiTokenDemo() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [status, setStatus] = useState<string>("");

  async function callViaProxy() {
    setStatus("Calling Next.js /api/me → FastAPI…");
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      const body = await res.text();
      setStatus(`${res.status}: ${body.slice(0, 600)}`);
    } catch (err) {
      setStatus(
        `Proxy error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async function callDirectFastApi() {
    setStatus("Requesting Clerk token…");
    const token = await getToken();
    if (!token) {
      setStatus("No token — are you signed in?");
      return;
    }

    const apiBase =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
      "http://localhost:8000";

    setStatus(`Calling ${apiBase}/api/me …`);
    try {
      const res = await fetch(`${apiBase}/api/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      const body = await res.text();
      setStatus(`${res.status}: ${body.slice(0, 600)}`);
    } catch (err) {
      setStatus(
        `Network error (is FastAPI running on :8000?): ${
          err instanceof Error ? err.message : String(err)
        }\nHint: cd web && ./start-api.sh`,
      );
    }
  }

  if (!isLoaded) {
    return <p className="text-sm text-zinc-500">Loading session…</p>;
  }

  if (!isSignedIn) {
    return <p className="text-sm text-zinc-500">Sign in to call the API.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={callViaProxy}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-teal-400"
        >
          GET /api/me (via Next proxy)
        </button>
        <button
          type="button"
          onClick={callDirectFastApi}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
        >
          Direct → FastAPI :8000
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Prefer the proxy button. FastAPI must be running:{" "}
        <code className="text-teal-300">cd web && ./start-api.sh</code>
      </p>
      {status ? (
        <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/50 p-3 text-xs text-zinc-300 whitespace-pre-wrap">
          {status}
        </pre>
      ) : null}
    </div>
  );
}
