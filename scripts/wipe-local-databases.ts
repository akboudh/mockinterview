/**
 * Deletes all local SQLite files under data/ and legacy data/mock-db.json.
 * Stop the dev server first so the DB is not held open.
 *
 * Usage: npm run db:wipe
 */
import { existsSync, readdirSync, unlinkSync } from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");

if (!existsSync(dataDir)) {
  console.log("No data/ directory — nothing to wipe.");
  process.exit(0);
}

for (const name of readdirSync(dataDir)) {
  if (name.endsWith(".sqlite")) {
    unlinkSync(path.join(dataDir, name));
    console.log("Removed", path.join("data", name));
  }
}

const legacyJson = path.join(dataDir, "mock-db.json");
if (existsSync(legacyJson)) {
  unlinkSync(legacyJson);
  console.log("Removed data/mock-db.json");
}

console.log("Done. Start the app again; SQLite will be recreated empty on first use.");
