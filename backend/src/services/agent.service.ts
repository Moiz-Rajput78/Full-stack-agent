import { Agent } from "@mastra/core/agent";
import { groq } from "@ai-sdk/groq";

import { createAgentMemory } from "../config/memory.js";
import { getAgentInstructions } from "../config/agent-instructions.js";
import { createCalendarTools } from "./agent-tools.service.js";

export type AgentEvent = {
  type:
    | "started"
    | "progress"
    | "token"
    | "completed"
    | "error";

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

function modelName() {
  return groq(
    process.env.AI_MODEL ?? "openai/gpt-oss-20b",
  );
}

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
 * List user's threads.
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
      thread.title?.trim() || "Untitled Chat",
    updatedAt:
      thread.updatedAt instanceof Date
        ? thread.updatedAt.toISOString()
        : String(thread.updatedAt),
  }));
}

/**
 * Get messages from a thread.
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

  const recalledMemoryData =
    await memory.recall({
      threadId,
      resourceId: authUserId,
      perPage: false,
    });

  const messages: ThreadMessage[] = [];

  for (const message of recalledMemoryData.messages) {
    const content = messageText(
      message.content,
    );

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
 * Delete a user's chat thread.
 */
export async function deleteUserThread(
  authUserId: string,
  threadId: string,
): Promise<void> {
  const memory = createAgentMemory();

  // Verify ownership before deleting.
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

  const memoryWithDelete = memory as typeof memory & {
    deleteThread?: (
      threadId: string,
    ) => Promise<unknown>;

    deleteThreadById?: (
      threadId: string,
    ) => Promise<unknown>;
  };

  if (
    typeof memoryWithDelete.deleteThread ===
    "function"
  ) {
    await memoryWithDelete.deleteThread(
      threadId,
    );

    return;
  }

  if (
    typeof memoryWithDelete.deleteThreadById ===
    "function"
  ) {
    await memoryWithDelete.deleteThreadById(
      threadId,
    );

    return;
  }

  throw new Error(
    "This memory provider does not support deleting threads.",
  );
}


/**
 * Stream agent response.
 */
export async function streamAgentReply(
  input: StreamAgentReplyInput,
) {
  if (!process.env.GROQ_API_KEY) {
    input.onEvent({
      type: "error",
      message:
        "GROQ_API_KEY is not configured.",
    });

    return;
  }

  const memory = createAgentMemory();

  try {
    input.onEvent({
      type: "started",
      message: "Thinking",
    });

    const agent = new Agent({
      id: "meeting-assistant",

      name: "Meeting Assistant",

      instructions:
        getAgentInstructions(),

      model: modelName(),

      tools: createCalendarTools(
        input.authUserId,
      ),

      memory,
    });

    const result = await agent.stream(
      input.message,
      {
        memory: {
          resource:
            input.authUserId,

          thread:
            input.threadId,
        },  

        maxSteps: 2,
      },
    );

    let assistantText = "";

    const toolResults: Array<{
      toolName: string;
      result: unknown;
    }> = [];

    for await (
      const chunk of result.fullStream
    ) {
      /**
       * Tool call.
       *
       * Do NOT send this to frontend.
       */
      if (
        chunk.type === "tool-call"
      ) {
        console.log(
          "[AGENT TOOL CALL]",
          chunk.payload.toolName,
          chunk.payload.args,
        );

        continue;
      }

      /**
       * Tool result.
       */
      if (
        chunk.type === "tool-result"
      ) {
        console.log(
          "[AGENT TOOL RESULT]",
          chunk.payload.toolName,
          chunk.payload.result,
        );

        toolResults.push({
          toolName:
            chunk.payload.toolName,

          result:
            chunk.payload.result,
        });

        continue;
      }

      /**
       * Tool error.
       */
      if (
        chunk.type === "tool-error"
      ) {
        console.error(
          "[AGENT TOOL ERROR]",
          chunk,
        );

        input.onEvent({
          type: "error",
          message:
            "The calendar operation failed.",
        });

        return;
      }

      /**
       * Assistant text.
       */
      if (
        chunk.type === "text-delta"
      ) {
        const text =
          chunk.payload.text;

        if (text) {
          assistantText += text;

          input.onEvent({
            type: "token",
            token: text,
          });
        }

        continue;
      }

      /**
       * Stream error.
       */
      if (
        chunk.type === "error"
      ) {
        console.error(
          "[AGENT STREAM ERROR]",
          chunk,
        );
      }
    }

    console.log(
      "[AGENT FINAL TEXT]",
      assistantText,
    );

    console.log(
      "[AGENT TOOL RESULTS]",
      toolResults,
    );

    /**
     * If the model did not produce a response,
     * create one from the tool result.
     */
    if (!assistantText.trim() && toolResults.length) {
      const lastTool =
        toolResults[
          toolResults.length - 1
        ];

      const fallback =
        createCalendarFallbackMessage(
          lastTool.toolName,
          lastTool.result,
        );

      if (fallback) {
        input.onEvent({
          type: "token",
          token: fallback,
        });

        assistantText = fallback;
      }
    }

    /**
     * Never send a generic completed message.
     */
    if (
      isGenericCompletionResponse(
        assistantText,
      )
    ) {
      const lastCalendarTool =
        [...toolResults]
          .reverse()
          .find((item) =>
            [
              "listUpcomingMeetings",
              "checkCalendarBusy",
              "createMeeting",
              "rescheduleMeeting",
              "cancelMeeting",
              "updateMeetingAgenda",
            ].includes(
              item.toolName,
            ),
          );

      if (lastCalendarTool) {
        const fallback =
          createCalendarFallbackMessage(
            lastCalendarTool.toolName,
            lastCalendarTool.result,
          );

        if (fallback) {
          input.onEvent({
            type: "token",
            token: fallback,
          });

          assistantText = fallback;
        }
      }
    }

    /**
     * Nothing useful was generated.
     */
    if (!assistantText.trim()) {
      input.onEvent({
        type: "error",
        message:
          "I could not generate a response for that request.",
      });

      return;
    }

    /**
     * Set title for a new thread.
     */
    const thread =
      await memory.getThreadById({
        threadId:
          input.threadId,

        resourceId:
          input.authUserId,
      });

    if (
      thread &&
      !thread.title?.trim()
    ) {
      await memory.updateThread({
        id: thread.id,

        title:
          input.message.slice(
            0,
            80,
          ),

        metadata:
          thread.metadata ?? {},
      });
    }

    input.onEvent({
      type: "completed",
      message: "done",
    });
  } catch (error) {
    console.error(
      "[AGENT ERROR]",
      error,
    );

    input.onEvent({
      type: "error",
      message:
        error instanceof Error
          ? error.message
          : "Something went wrong while processing your request.",
    });
  }
}

function isGenericCompletionResponse(
  text: string,
): boolean {
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return [
    "i completed the request.",
    "i completed the request",
    "the request is completed.",
    "the request is completed",
    "the request was completed.",
    "the request was completed",
    "request completed.",
    "request completed",
    "done.",
    "done",
    "completed.",
    "completed",
  ].includes(normalized);
}

function createCalendarFallbackMessage(
  toolName: string,
  result: unknown,
): string | null {
  /**
   * LIST MEETINGS
   */
  if (
    toolName ===
    "listUpcomingMeetings"
  ) {
    if (!Array.isArray(result)) {
      return null;
    }

    const meetings =
      result as Array<
        Record<string, unknown>
      >;

    if (meetings.length === 0) {
      return "You don't have any upcoming meetings.";
    }

    const lines = meetings.map(
      (meeting) => {
        const title =
          typeof meeting.title ===
          "string"
            ? meeting.title
            : "(no title)";

        const start =
          typeof meeting.start ===
          "string"
            ? meeting.start
            : null;

        const end =
          typeof meeting.end ===
          "string"
            ? meeting.end
            : null;

        let line =
          `- **${title}**`;

        if (start) {
          line +=
            ` — ${formatCalendarTime(start)}`;
        }

        if (end) {
          line +=
            ` – ${formatCalendarTime(end)}`;
        }

        if (
          typeof meeting.meetLink ===
          "string"
        ) {
          line +=
            ` — [Join Meet](${meeting.meetLink})`;
        }

        return line;
      },
    );

    return (
      "### Your meetings\n\n" +
      lines.join("\n")
    );
  }

  /**
   * CREATE
   */
  if (
    toolName ===
    "createMeeting"
  ) {
    if (
      !result ||
      typeof result !== "object"
    ) {
      return "The meeting was created successfully.";
    }

    const data =
      result as Record<
        string,
        unknown
      >;

    const title =
      typeof data.title ===
      "string"
        ? data.title
        : "Meeting";

    const start =
      typeof data.start ===
      "string"
        ? data.start
        : null;

    const end =
      typeof data.end ===
      "string"
        ? data.end
        : null;

    const meetLink =
      typeof data.meetLink ===
      "string"
        ? data.meetLink
        : null;

    const invites =
      data.inviteEmailsSent ===
      true;

    let message =
      "### Meeting created successfully\n\n";

    message +=
      `- **Title:** ${title}\n`;

    if (start) {
      message +=
        `- **Time:** ${formatCalendarTime(start)}`;

      if (end) {
        message +=
          ` – ${formatCalendarTime(end)}`;
      }

      message += "\n";
    }

    if (meetLink) {
      message +=
        `- **Meet:** [Join Meet](${meetLink})\n`;
    }

    if (invites) {
      message +=
        "- **Invites:** Sent to attendees\n";
    }

    return message.trim();
  }

  /**
   * RESCHEDULE
   */
  if (
    toolName ===
    "rescheduleMeeting"
  ) {
    if (
      !result ||
      typeof result !== "object"
    ) {
      return "The meeting was rescheduled successfully.";
    }

    const data =
      result as Record<
        string,
        unknown
      >;

    const title =
      typeof data.title ===
      "string"
        ? data.title
        : "Meeting";

    const start =
      typeof data.start ===
      "string"
        ? data.start
        : null;

    const end =
      typeof data.end ===
      "string"
        ? data.end
        : null;

    let message =
      "### Meeting rescheduled successfully\n\n";

    message +=
      `- **Title:** ${title}\n`;

    if (start) {
      message +=
        `- **New time:** ${formatCalendarTime(start)}`;

      if (end) {
        message +=
          ` – ${formatCalendarTime(end)}`;
      }

      message += "\n";
    }

    return message.trim();
  }

  /**
   * CANCEL
   */
  if (
    toolName ===
    "cancelMeeting"
  ) {
    return "### Meeting cancelled successfully";
  }

  /**
   * UPDATE AGENDA
   */
  if (
    toolName ===
    "updateMeetingAgenda"
  ) {
    return "### Meeting agenda updated successfully";
  }

  /**
   * BUSY
   */
  if (
    toolName ===
    "checkCalendarBusy"
  ) {
    if (
      !result ||
      typeof result !== "object"
    ) {
      return null;
    }

    const data =
      result as Record<
        string,
        unknown
      >;

    const busy =
      Array.isArray(data.busy)
        ? data.busy
        : [];

    return busy.length === 0
      ? "That time is free."
      : "That time is already busy.";
  }

  return null;
}

function formatCalendarTime(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(
    "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}