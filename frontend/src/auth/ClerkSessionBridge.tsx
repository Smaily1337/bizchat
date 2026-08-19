import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useEffect, useRef } from "react";
import { authApi } from "@/api";
import { useAuth } from "@/auth/AuthContext";
import { clerkEnabled } from "@/auth/ClerkProvider";

/** Exchange Clerk JWT → BizChat token after sign-in. */
export function ClerkSessionBridge() {
  if (!clerkEnabled()) return null;
  return <ClerkSessionBridgeInner />;
}

function ClerkSessionBridgeInner() {
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth();
  const { token, acceptToken, logout } = useAuth();
  const exchanging = useRef(false);
  const lastClerk = useRef(false);

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
    void (async () => {
      try {
        const clerkJwt = await getToken();
        if (!clerkJwt) return;
        const data = await authApi.clerkExchange(clerkJwt);
        await acceptToken(data.access_token);
      } catch (err) {
        console.error("Clerk → BizChat bridge failed", err);
        await signOut();
      } finally {
        exchanging.current = false;
      }
    })();
  }, [isLoaded, isSignedIn, getToken, token, acceptToken, logout, signOut]);

  return null;
}
