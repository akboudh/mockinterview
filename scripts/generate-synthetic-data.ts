import { readDb, writeDb } from "../lib/db";
import { generateSyntheticMemoryDataset } from "../lib/memory/synthetic-data";

async function main() {
  const db = await readDb();
  const synthetic = await generateSyntheticMemoryDataset(new Date());

  await writeDb({
    ...db,
    users: [...db.users, ...synthetic.users],
    sessions: [...db.sessions, ...synthetic.sessions],
    messages: [...db.messages, ...synthetic.messages],
    evaluations: [...db.evaluations, ...synthetic.evaluations],
    memoryEvents: [...db.memoryEvents, ...synthetic.memoryEvents],
    memoryVectors: [...db.memoryVectors, ...synthetic.memoryVectors],
    skillSignals: [...db.skillSignals, ...synthetic.skillSignals],
    agentSessionStates: [...db.agentSessionStates, ...synthetic.agentSessionStates],
    conversationSummaries: [...db.conversationSummaries, ...synthetic.conversationSummaries]
  });

  console.log(
    `Synthetic memory data appended for ${synthetic.users.length} users across ${synthetic.sessions.length} sessions.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
