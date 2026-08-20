import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-semibold tracking-wide text-zinc-50">
            Automovia
          </Link>
          <div className="flex items-center gap-2">
            <SignedOut>
              <SignInButton mode="redirect" forceRedirectUrl="/dashboard">
                <button className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium hover:bg-white/10">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="redirect" forceRedirectUrl="/dashboard">
                <button className="rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-teal-400">
                  Sign up
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="mr-2 text-sm text-zinc-300 hover:text-white"
              >
                Dashboard
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </header>

      <div className="pt-10">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-400">
          Automovia
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
          Passwordless B2B auth
        </h1>
        <p className="mt-4 max-w-xl text-zinc-400">
          Email OTP plus Google and Apple SSO via Clerk. Use{" "}
          <strong className="font-medium text-zinc-200">Sign up</strong> in the
          top bar to create your first account.
        </p>
      </div>
    </main>
  );
}
