import { readFileSync } from "fs";
import path from "path";

import { writeDb } from "@/lib/db";
import type { MockInterviewDB } from "@/lib/types";

const seedPath = path.join(process.cwd(), "data/mock-db.json");
const seedContents = readFileSync(seedPath, "utf-8");

export async function resetDb() {
  const parsed = JSON.parse(seedContents) as MockInterviewDB;
  await writeDb({
    ...parsed,
    agentSessionStates: parsed.agentSessionStates ?? [],
    conversationSummaries: parsed.conversationSummaries ?? [],
    memoryVectors: parsed.memoryVectors ?? []
  });
}
