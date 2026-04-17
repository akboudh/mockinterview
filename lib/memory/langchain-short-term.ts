import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { BufferMemory } from "langchain/memory";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";

import type { RecalledContextItem, SpeakerType } from "@/lib/types";

function toLangChainMessage(speaker: SpeakerType, content: string) {
  switch (speaker) {
    case "student":
      return new HumanMessage(content);
    case "interviewer":
      return new AIMessage(content);
    default:
      return new SystemMessage(`${speaker}: ${content}`);
  }
}

export async function buildLangChainShortTermContext(
  items: RecalledContextItem[]
): Promise<RecalledContextItem[]> {
  const transcriptItems = items.filter(
    (item) =>
      item.memory_tier === "short_term" &&
      typeof item.content.speaker_type === "string" &&
      typeof item.content.content === "string"
  );
  const runtimeItems = items.filter((item) => !transcriptItems.includes(item));

  if (!transcriptItems.length) {
    return items;
  }

  const chatHistory = new ChatMessageHistory();
  await chatHistory.addMessages(
    transcriptItems.map((item) =>
      toLangChainMessage(
        item.content.speaker_type as SpeakerType,
        item.content.content as string
      )
    )
  );

  const memory = new BufferMemory({
    chatHistory,
    memoryKey: "conversation_history"
  });
  const memoryVariables = await memory.loadMemoryVariables({});
  const conversationHistory = String(memoryVariables.conversation_history ?? "").trim();

  return [
    {
      memory_tier: "short_term",
      content: {
        conversation_history: conversationHistory
      },
      relevance_reason: "LangChain buffer memory built from the most recent transcript turns"
    },
    ...runtimeItems
  ];
}
