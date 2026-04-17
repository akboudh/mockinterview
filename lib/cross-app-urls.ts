import { getAppSurface } from "@/lib/app-surface";

function trimBase(url: string | undefined): string | null {
  const t = url?.trim();
  return t ? t.replace(/\/$/, "") : null;
}

/** Student login page path on the student app (same or other origin). */
export function getStudentLoginHref(): string {
  const surface = getAppSurface();
  const base =
    trimBase(process.env.STUDENT_APP_URL) ?? trimBase(process.env.NEXT_PUBLIC_STUDENT_APP_URL);
  if (surface === "mentor" && base) {
    return `${base}/login`;
  }
  return "/login";
}

/** Mentor login path on the mentor app (same or other origin). */
export function getMentorLoginHref(): string {
  const surface = getAppSurface();
  const base =
    trimBase(process.env.MENTOR_APP_URL) ?? trimBase(process.env.NEXT_PUBLIC_MENTOR_APP_URL);
  if (surface === "student" && base) {
    return `${base}/mentor/login`;
  }
  return "/mentor/login";
}
