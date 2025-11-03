import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"])

export default clerkMiddleware(
  async (auth, req) => {
    if (!isPublicRoute(req)) {
      // Add custom logic to run before redirecting
      await auth.protect()
    }
  },
  { debug: true },
)

export const config = {
  matcher: [
    // Run for all paths except those with a file extension or Next.js internals
    "/((?!.+\\.[\\w]+$|_next).*)",
    // Explicitly include the root path
    "/",
    // Always run for API and tRPC routes
    "/(api|trpc)(.*)",
  ],
}
