import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * Same-origin proxy so the dashboard button works even when the browser
 * cannot reach localhost:8000 directly (or CORS blocks it).
 * Forwards the Clerk session JWT to FastAPI as Authorization: Bearer.
 */
export async function GET(_req: NextRequest) {
  const { getToken, userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "No Clerk token" }, { status: 401 });
  }

  const apiBase = (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

  try {
    const res = await fetch(`${apiBase}/api/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep text */
    }
    return NextResponse.json(
      { status: res.status, upstream: `${apiBase}/api/me`, body },
      { status: res.ok ? 200 : res.status },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "FastAPI unreachable",
        hint: "Start it with: cd web && ./start-api.sh",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
