import { clerkMiddleware } from "@clerk/nextjs/server"

export default clerkMiddleware(async (auth) => {
  const { isAuthenticated, redirectToSignIn } = await auth()

  if (!isAuthenticated) {
    // Add custom logic to run before redirecting

    return redirectToSignIn()
  }
})

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
