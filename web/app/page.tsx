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
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-400">
          Automovia
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
          Passwordless B2B auth
        </h1>
        <p className="mt-4 max-w-xl text-zinc-400">
          Email OTP plus Google and Apple SSO via Clerk. Protected routes live
          under <code className="text-teal-300">/dashboard</code>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SignedOut>
          <SignInButton mode="redirect" forceRedirectUrl="/dashboard">
            <button className="rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-sm font-medium backdrop-blur-md hover:bg-white/5">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="redirect" forceRedirectUrl="/dashboard">
            <button className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-teal-400">
              Sign up
            </button>
          </SignUpButton>
          <Link
            href="/sign-in"
            className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
          >
            Full sign-in page
          </Link>
        </SignedOut>
        <SignedIn>
          <Link
            href="/dashboard"
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-teal-400"
          >
            Open dashboard
          </Link>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </div>
    </main>
  );
}
