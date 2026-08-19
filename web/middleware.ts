import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Public routes — everything else requires a signed-in Clerk session.
 * Expand this list as you add marketing pages / webhooks.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files unless in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Clerk frontend API auto-proxy
    "/__clerk/:path*",
  ],
};
