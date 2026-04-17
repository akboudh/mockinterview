/** Session token cookie (httpOnly). */
export const AUTH_COOKIE_NAME = "vantage_session";

/**
 * Set at login: `mentor` | `student`. Used by middleware (Edge-safe import — no DB).
 * Must match {@link ACCOUNT_KIND_COOKIE} usage in `lib/auth.ts` `applySessionCookie`.
 */
export const ACCOUNT_KIND_COOKIE = "vantage_account_kind";
