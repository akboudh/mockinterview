import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { BufferMemory } from "langchain/memory";

import type { InterviewSession, Message } from "@/lib/types";

export async function createShortTermMemory(messages: Message[]) {
  const memory = new BufferMemory({
    returnMessages: true,
    memoryKey: "conversation_history",
    inputKey: "latest_input",
    outputKey: "latest_output"
  });

  for (const message of messages.slice(-6)) {
    await memory.saveContext(
      { latest_input: `${message.speaker_type}: ${message.content}` },
      { latest_output: message.content }
    );
  }

  return memory;
}

export async function summarizeAdaptiveIntent(
  session: InterviewSession,
  latestAnswer: string | null,
  weakSkills: string[]
) {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are an adaptive mock interview orchestrator. Produce a concise planning note for the next question."
    ],
    [
      "human",
      "Mode: {mode}\nRole: {role}\nWeak skills: {weakSkills}\nLatest answer: {latestAnswer}"
    ]
  ]);

  const chain = RunnableSequence.from([
    prompt,
    new RunnableLambda({
      func: async (value: unknown) => {
        const serialized = JSON.stringify(value);
        if (!latestAnswer) {
          return `Open with a high-trust ${session.mode} question tailored to ${session.target_role}.`;
        }

        const weakFocus = weakSkills[0] ? ` Probe ${weakSkills[0]} explicitly.` : "";
        return `Use the latest answer to choose a deeper follow-up for ${session.target_role}.${weakFocus} Prompt context: ${serialized.slice(0, 180)}...`;
      }
    })
  ]);

  return chain.invoke({
    mode: session.mode,
    role: session.target_role,
    weakSkills: weakSkills.join(", ") || "none",
    latestAnswer: latestAnswer ?? "no answer yet"
  });
}
