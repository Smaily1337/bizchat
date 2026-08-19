import { SignIn, SignUp, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useState } from "react";
import { clerkEnabled } from "@/auth/ClerkProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const appearance = {
  variables: {
    colorPrimary: "#0f766e",
    colorBackground: "transparent",
    colorInputBackground: "rgba(255,255,255,0.55)",
    colorText: "#0b0b0b",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full mx-auto",
    card: "bg-transparent shadow-none border-0",
    socialButtonsBlockButton:
      "bg-white/60 border border-white/40 hover:bg-white/80",
    formButtonPrimary: "bg-teal-700 hover:bg-teal-600",
  },
};

export function ClerkAuthPanel() {
  if (!clerkEnabled()) return null;
  return (
    <ErrorBoundary>
      <ClerkAuthPanelInner />
    </ErrorBoundary>
  );
}

function ClerkAuthPanelInner() {
  const { isSignedIn } = useClerkAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");

  if (isSignedIn) {
    return (
      <p className="text-center text-sm text-[var(--muted)]">
        Clerk: jesteś zalogowany — łączę z panelem Automovia…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
            mode === "sign-in"
              ? "bg-[var(--accent)] text-[var(--on-accent)]"
              : "bg-white/40 text-[var(--text-bright)]"
          }`}
          onClick={() => setMode("sign-in")}
        >
          Clerk — logowanie
        </button>
        <button
          type="button"
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
            mode === "sign-up"
              ? "bg-[var(--accent)] text-[var(--on-accent)]"
              : "bg-white/40 text-[var(--text-bright)]"
          }`}
          onClick={() => setMode("sign-up")}
        >
          Clerk — rejestracja
        </button>
      </div>
      <div className="rounded-2xl border border-white/40 bg-black/5 p-2 backdrop-blur-md">
        {mode === "sign-in" ? (
          <SignIn appearance={appearance} routing="virtual" fallbackRedirectUrl="/" />
        ) : (
          <SignUp appearance={appearance} routing="virtual" fallbackRedirectUrl="/" />
        )}
      </div>
      <p className="text-center text-[11px] text-[var(--muted)]">
        OTP e-mail / Google / Apple (wg ustawień w Clerk Dashboard)
      </p>
    </div>
  );
}
