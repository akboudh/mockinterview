import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { NAV_LINKS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { accountKindFromUser, getCurrentUser } from "@/lib/auth";

const STUDENT_NAV = NAV_LINKS.filter((link) => link.href !== "/mentor");

const CONNECT_MENTOR = { href: "/student/mentor", label: "Connect to mentor" } as const;

export async function MainNav() {
  noStore();
  const user = await getCurrentUser();
  const mentorSurface = user ? accountKindFromUser(user) === "mentor" : false;

  const studentLinks = [...STUDENT_NAV, CONNECT_MENTOR];

  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div className="page-shell flex items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-[rgba(5,10,18,0.72)] px-4 py-3 shadow-[0_18px_40px_rgba(3,8,18,0.22)] backdrop-blur-2xl md:px-5">
        <Link
          href={mentorSurface ? "/mentor" : "/"}
          className="flex min-w-0 items-center gap-3"
        >
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-sm font-semibold tracking-[0.22em] text-mist">
            VG
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.28em] text-white/45">Vantage</p>
            <p className="truncate text-sm text-white/90">
              {mentorSurface ? "Mentor dashboard" : "Interview Prep Studio"}
            </p>
          </div>
        </Link>
        <nav className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2 py-2 text-sm text-white/72 md:flex">
          {mentorSurface ? (
            <Link
              href="/mentor"
              className="rounded-full px-4 py-2 transition duration-200 hover:bg-white/[0.06] hover:text-white"
            >
              Dashboard
            </Link>
          ) : (
            studentLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 transition duration-200 hover:bg-white/[0.06] hover:text-white ${
                  link.href === CONNECT_MENTOR.href ? "border border-sky-300/25 bg-sky-400/10 text-sky-100" : ""
                }`}
              >
                {link.label}
              </Link>
            ))
          )}
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden text-right md:block">
                <p className="text-sm text-white/88">{user.display_name ?? user.email}</p>
                <p className="text-xs text-white/45">{user.email}</p>
              </div>
              <form action="/auth/logout" method="post">
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
