import Link from "next/link";
import { auth, signOut } from "@/auth";
import { EyeIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const session = await auth();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href={session?.user ? "/dashboard" : "/"} className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <EyeIcon className="h-4 w-4" />
          </span>
          <span>Trinethra</span>
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
            · Supervisor Feedback Analyzer
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          {session?.user ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {session.user.email}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <Button variant="outline" size="sm" type="submit">
                  <ArrowRightOnRectangleIcon className="h-4 w-4" />
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
