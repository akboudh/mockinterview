import path from "path";

/**
 * Redundant with `vitest.config.ts` (which runs first) — keeps DATABASE_URL
 * pointed at `data/vitest.sqlite` if setup order ever changes.
 */
const vitestDbPath = path.resolve(__dirname, "../data/vitest.sqlite");
process.env.DATABASE_URL = vitestDbPath;
process.env.APP_SURFACE = process.env.APP_SURFACE ?? "all";
