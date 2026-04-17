import { writeDb } from "@/lib/db";
import { generateSyntheticMemoryDataset } from "@/lib/memory/synthetic-data";

/** Resets the DB file Vitest uses (`data/vitest.sqlite` via `DATABASE_URL` in vitest.config). */
export async function resetDb() {
  const parsed = await generateSyntheticMemoryDataset(new Date("2026-04-06T00:00:00.000Z"));
  await writeDb(parsed);
}
