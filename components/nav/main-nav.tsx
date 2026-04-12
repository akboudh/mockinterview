import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { NAV_LINKS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { getCurrentUser, userHasRole } from "@/lib/auth";

export async function MainNav() {
  noStore();
  const user = await getCurrentUser();
  const visibleLinks = NAV_LINKS.filter(
    (link) => link.href !== "/mentor" || userHasRole(user, ["mentor", "admin"])
  );

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgba(6,10,16,0.45)] backdrop-blur-xl">
      <div className="page-shell flex items-center justify-between gap-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-sm font-semibold tracking-[0.22em] text-mist">
            VG
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/45">Vantage</p>
            <p className="text-sm text-white/90">Mock Interview Agent</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-white/72 md:flex">
          {visibleLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden text-right md:block">
                <p className="text-sm text-white/88">{user.display_name ?? user.email}</p>
                <p className="text-xs text-white/45">{user.email}</p>
              </div>
              <form
                action="/auth/logout"
                method="post"
              >
                <Button type="submit" variant="light" size="sm" className="min-w-[7rem]">
                  Log out
                </Button>
              </form>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Log in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
