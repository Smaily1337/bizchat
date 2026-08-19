"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

/**
 * Client-side pattern: get a Clerk session JWT and attach it to API calls.
 * Prefer this (or a thin fetch wrapper) for browser → FastAPI requests.
 */
export function ApiTokenDemo() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [status, setStatus] = useState<string>("");

  async function callPythonApi() {
    setStatus("Requesting token…");
    const token = await getToken();
    if (!token) {
      setStatus("No token — are you signed in?");
      return;
    }

    const apiBase =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
      "http://localhost:8000";

    setStatus("Calling FastAPI…");
    try {
      const res = await fetch(`${apiBase}/api/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      const body = await res.text();
      setStatus(`${res.status}: ${body.slice(0, 400)}`);
    } catch (err) {
      setStatus(
        `Network error (is FastAPI running?): ${
          err instanceof Error ? err.message : String(err)
        }`,
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
      <button
        type="button"
        onClick={callPythonApi}
        className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-teal-400"
      >
        GET /api/me with Bearer token
      </button>
      {status ? (
        <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/50 p-3 text-xs text-zinc-300">
          {status}
        </pre>
      ) : null}
    </div>
  );
}
