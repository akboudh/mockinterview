import { clearDb, getDatabaseFilePath } from "@/lib/db";

async function main() {
  await clearDb();
  console.log(`Cleared local SQLite dataset at ${getDatabaseFilePath()}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
