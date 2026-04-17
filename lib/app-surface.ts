/**
 * Deploy one codebase as either the student app, the mentor app, or both (default).
 * Set `APP_SURFACE=student` or `APP_SURFACE=mentor` for split servers; omit or `all` for combined.
 */
export type AppSurface = "all" | "student" | "mentor";

export function getAppSurface(): AppSurface {
  const raw = process.env.APP_SURFACE?.trim().toLowerCase();
  if (raw === "student" || raw === "mentor") {
    return raw;
  }
  return "all";
}

export function isStudentSurface(): boolean {
  return getAppSurface() === "student";
}

export function isMentorSurface(): boolean {
  return getAppSurface() === "mentor";
}
