/**
 * One-time / maintenance: remove impossible mentor+student role pairs in SQLite.
 * If both are present: keep mentor only when email is listed in MENTOR_EMAILS, else student only.
 *
 * Usage: npm run db:clean-roles
 */
import { readDb, updateDb } from "@/lib/db";
import type { UserProfile, UserRole } from "@/lib/types";

function parseRoleList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeRolesForUser(user: UserProfile): UserRole[] {
  const email = user.email?.toLowerCase() ?? "";
  const mentorEmails = new Set(parseRoleList(process.env.MENTOR_EMAILS));
  const roles = new Set<UserRole>(user.roles ?? []);

  if (roles.has("mentor") && roles.has("student")) {
    if (mentorEmails.has(email)) {
      roles.delete("student");
    } else {
      roles.delete("mentor");
    }
  }

  return Array.from(roles);
}

async function main() {
  const before = await readDb();
  let changed = 0;

  await updateDb((db) => ({
    ...db,
    users: db.users.map((user) => {
      const next = normalizeRolesForUser(user);
      const prev = user.roles ?? [];
      const same =
        [...prev].sort().join(",") === [...next].sort().join(",");
      if (!same) {
        changed += 1;
        return { ...user, roles: next, updated_at: new Date().toISOString() };
      }
      return user;
    })
  }));

  console.log(
    `Normalized roles for ${changed} of ${before.users.length} user(s). Database: ${before.users.length ? "ok" : "empty"}.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
