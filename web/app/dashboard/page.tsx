import { UserButton } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { ApiTokenDemo } from "@/components/ApiTokenDemo";

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = await currentUser();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Home
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-50">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Signed in as {user?.primaryEmailAddress?.emailAddress ?? userId}
          </p>
        </div>
        <UserButton afterSignOutUrl="/" />
      </header>

      <section className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
        <h2 className="text-lg font-medium text-zinc-50">
          Call your Python API with a Clerk token
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          The button below fetches a short-lived JWT via{" "}
          <code className="text-teal-300">getToken()</code> and sends it as{" "}
          <code className="text-teal-300">Authorization: Bearer …</code> to FastAPI.
        </p>
        <div className="mt-4">
          <ApiTokenDemo />
        </div>
      </section>
    </main>
  );
}
