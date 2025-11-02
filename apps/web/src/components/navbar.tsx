import { Settings } from "lucide-react"
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs"
import { Button } from "~/components/ui/button"
import { auth } from "@clerk/nextjs/server"

export async function Navbar() {
  const { isAuthenticated } = await auth()
  return (
    <header className="absolute top-0 right-0 left-0 z-50 flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-2">
        <div className="text-foreground text-lg font-medium tracking-tight">日本語 AI</div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="hover:bg-muted/50 h-9 w-9 rounded-full">
          <Settings className="h-4 w-4" />
        </Button>
        {!isAuthenticated && (
          <>
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm" className="hover:bg-muted/50">
                Sign In
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button variant="default" size="sm">
                Sign Up
              </Button>
            </SignUpButton>
          </>
        )}
        {isAuthenticated && (
          <>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-9 w-9 rounded-full",
                },
              }}
            />
          </>
        )}
      </div>
    </header>
  )
}
