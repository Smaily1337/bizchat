import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

/**
 * Dark Glassmorphism wrapper for Clerk <SignIn /> / <SignUp />.
 */
export function AuthShell({
  children,
  title = "Automovia",
  subtitle,
}: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[#07090c]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl"
      />

      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-2xl font-semibold tracking-tight text-zinc-50">
            {title}
          </p>
          {subtitle ? (
            <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
