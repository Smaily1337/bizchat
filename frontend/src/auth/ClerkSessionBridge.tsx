import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useEffect, useRef, useState } from "react";
import { authApi } from "@/api";
import { useAuth } from "@/auth/AuthContext";
import { clerkEnabled } from "@/auth/ClerkProvider";

import { ErrorBoundary } from "@/components/ErrorBoundary";

/** Exchange Clerk JWT → Automovia token after sign-in. */
export function ClerkSessionBridge() {
  if (!clerkEnabled()) return null;
  return (
    <ErrorBoundary>
      <ClerkSessionBridgeInner />
    </ErrorBoundary>
  );
}

function ClerkSessionBridgeInner() {
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth();
  const { token, acceptToken, logout } = useAuth();
  const exchanging = useRef(false);
  const lastClerk = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      if (lastClerk.current && token) {
        lastClerk.current = false;
        logout();
      }
      return;
    }

    lastClerk.current = true;
    if (token || exchanging.current) return;

    exchanging.current = true;
    setError(null);
    void (async () => {
      try {
        const clerkJwt = await getToken();
        if (!clerkJwt) {
          setError("Brak tokena Clerk — spróbuj ponownie.");
          return;
        }
        const data = await authApi.clerkExchange(clerkJwt);
        await acceptToken(data.access_token);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Nie udało się połączyć z API";
        setError(msg);
        console.error("Clerk → Automovia bridge failed", err);
        await signOut();
      } finally {
        exchanging.current = false;
      }
    })();
  }, [isLoaded, isSignedIn, getToken, token, acceptToken, logout, signOut]);

  if (!error) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[100] border-b border-red-500/30 bg-red-950/90 px-4 py-3 text-center text-sm text-red-100 backdrop-blur-md"
    >
      Logowanie Clerk nie doszło do panelu: {error}. Sprawdź CLERK_* na API i
      odśwież stronę.
    </div>
  );
}
