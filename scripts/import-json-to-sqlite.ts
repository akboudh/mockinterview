import { readFileSync } from "fs";
import path from "path";

import { getDatabaseFilePath, writeDb } from "../lib/db";
import type { MockInterviewDB } from "../lib/types";

async function main() {
  const jsonPath = path.join(process.cwd(), "data/mock-db.json");
  const raw = readFileSync(jsonPath, "utf-8");
  const parsed = JSON.parse(raw) as MockInterviewDB;

  await writeDb({
    ...parsed,
    agentSessionStates: parsed.agentSessionStates ?? [],
    conversationSummaries: parsed.conversationSummaries ?? []
  });

  console.log(`Imported JSON seed into SQLite: ${getDatabaseFilePath()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
