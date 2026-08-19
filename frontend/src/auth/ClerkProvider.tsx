import { ClerkProvider } from "@clerk/clerk-react";
import type { ReactNode } from "react";

const publishableKey = (
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
)?.trim();

export function clerkEnabled(): boolean {
  return Boolean(publishableKey);
}

/** Wraps the app with Clerk when VITE_CLERK_PUBLISHABLE_KEY is set. */
export function MaybeClerkProvider({ children }: { children: ReactNode }) {
  if (!publishableKey) {
    return <>{children}</>;
  }
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl="/login"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
