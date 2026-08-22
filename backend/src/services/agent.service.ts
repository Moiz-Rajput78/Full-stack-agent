import { Agent } from "@mastra/core/agent";
import { groq } from "@ai-sdk/groq";
import { createAgentMemory } from "../config/memory.js";
import { getAgentInstructions } from "../config/agent-instructions.js";
import { createCalendarTools } from "./agent-tools.service.js";

export type AgentEvent = {
  type: "started" | "progress" | "token" | "completed" | "error";
  message?: string;
  token?: string;
};

export type StreamAgentReplyInput = {
  userId: string;
  authUserId: string;
  threadId: string;
  message: string;
  onEvent: (event: AgentEvent) => void;
};

export type ThreadSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export type ThreadMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

/**
 * Groq model used by the calendar agent.
 *
 * You can override this using AI_MODEL in .env
 *
 * Default:
 * openai/gpt-oss-20b
 */
function modelName() {
  return groq(process.env.AI_MODEL ?? "openai/gpt-oss-20b");
}

/**
 * Converts Mastra/AI SDK message content into plain text.
 */
function messageText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!content || typeof content !== "object") {
    return "";
  }

  const record = content as {
    content?: unknown;
    parts?: Array<{
      type?: string;
      text?: string;
    }>;
  };

  if (
    typeof record.content === "string" &&
    record.content.trim()
  ) {
    return record.content.trim();
  }

  if (!Array.isArray(record.parts)) {
    return "";
  }

  return record.parts
    .filter(
      (part) =>
        part.type === "text" &&
        typeof part.text === "string",
    )
    .map((part) => part.text!.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

/**
 * List all chat threads for a user.
 */
export async function listUserThreads(
  authUserId: string,
): Promise<ThreadSummary[]> {
  const memory = createAgentMemory();

  const result = await memory.listThreads({
    filter: {
      resourceId: authUserId,
    },
    perPage: 30,
    orderBy: {
      field: "updatedAt",
      direction: "DESC",
    },
  });

  return result.threads.map((thread) => ({
    id: thread.id,

    title:
      thread.title?.trim() ||
      "Untitled Chat",

    updatedAt:
      thread.updatedAt instanceof Date
        ? thread.updatedAt.toISOString()
        : String(thread.updatedAt),
  }));
}

/**
 * Get all messages from a specific thread.
 */
export async function getThreadMessages(
  authUserId: string,
  threadId: string,
): Promise<ThreadMessage[]> {
  const memory = createAgentMemory();

  const thread = await memory.getThreadById({
    threadId,
    resourceId: authUserId,
  });

  if (
    !thread ||
    thread.resourceId !== authUserId
  ) {
    throw new Error("Thread not found");
  }

  const recalledMemoryData = await memory.recall({
    threadId,
    resourceId: authUserId,
    perPage: false,
  });

  const messages: ThreadMessage[] = [];

  for (const message of recalledMemoryData.messages) {
    const content = messageText(message.content);

    if (!content) {
      continue;
    }

    const role: ThreadMessage["role"] =
      message.role === "user" ||
      message.role === "assistant"
        ? message.role
        : "system";

    messages.push({
      id: message.id,
      role,
      content,
    });
  }

  return messages;
}

/**
 * Stream an agent response.
 *
 * The agent uses:
 * - Groq for the LLM
 * - Mastra memory for conversation history
 * - Google Calendar tools for calendar actions
 */
export async function streamAgentReply(
  input: StreamAgentReplyInput,
) {
  /**
   * Make sure the Groq API key exists.
   *
   * @ai-sdk/groq automatically reads:
   * GROQ_API_KEY
   */
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not set in environment variables",
    );
  }

  input.onEvent({
    type: "started",
    message: "Agent is planning",
  });

  const memory = createAgentMemory();

  /**
   * Create the calendar agent.
   */
  const agent = new Agent({
    id: "meeting-assistant",

    name: "Meeting Assistant",

    instructions: getAgentInstructions(),

    model: modelName(),

    tools: createCalendarTools(
      input.authUserId,
    ),

    memory,
  });

  /**
   * Start streaming the response.
   */
  const result = await agent.stream(
    input.message,
    {
      memory: {
        resource: input.authUserId,
        thread: input.threadId,
      },
    },
  );

  /**
   * Process streaming events.
   */
  for await (const chunk of result.fullStream) {
    /**
     * Calendar/tool execution.
     */
    if (chunk.type === "tool-call") {
      input.onEvent({
        type: "progress",
        message: `Running ${chunk.payload.toolName}`,
      });

      continue;
    }

    /**
     * Normal assistant text.
     */
    if (chunk.type === "text-delta") {
      const text = chunk.payload.text;

      if (text) {
        input.onEvent({
          type: "token",
          token: text,
        });
      }
    }
  }

  /**
   * Streaming has finished.
   *
   * Update the thread title if it doesn't have one.
   */
  const thread = await memory.getThreadById({
    threadId: input.threadId,
    resourceId: input.authUserId,
  });

  if (
    thread &&
    !thread.title?.trim()
  ) {
    await memory.updateThread({
      id: thread.id,

      title: input.message.slice(0, 80),

      metadata: thread.metadata ?? {},
    });
  }

  /**
   * Tell the frontend the response is complete.
   */
  input.onEvent({
    type: "completed",
    message: "done",
  });
}
