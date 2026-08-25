import { apiFetch } from "@/lib/api";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

export type AgentStreamEvent = {
  type:
    | "started"
    | "progress"
    | "token"
    | "completed"
    | "error";

  message?: string;

  token?: string;
};

export type ThreadSummary = {
  id: string;

  title: string;

  updatedAt: string;
};

export type ThreadMessage = {
  id: string;

  role:
    | "user"
    | "assistant"
    | "system";

  content: string;
};

/**
 * List chats.
 */
export async function listThreads(
  token: string,
) {
  return apiFetch<{
    threads: ThreadSummary[];
  }>(
    "/api/agent/threads",
    {
      token,
    },
  );
}

/**
 * Load one chat.
 */
export async function loadThread(
  token: string,
  threadId: string,
) {
  return apiFetch<{
    threadId: string;

    messages: ThreadMessage[];
  }>(
    `/api/agent/threads/${threadId}`,
    {
      token,
    },
  );
}

/**
 * Delete one chat.
 */
export async function deleteThread(
  token: string,
  threadId: string,
) {
  return apiFetch<{
    success: boolean;

    threadId: string;
  }>(
    `/api/agent/threads/${threadId}`,
    {
      method: "DELETE",

      token,
    },
  );
}

/**
 * Stream agent chat.
 */
export async function streamAgentChat(
  token: string,
  input: {
    message: string;

    threadId: string;
  },
  onEvent: (
    event: AgentStreamEvent,
  ) => void,
) {
  const res = await fetch(
    `${API_URL.replace(/\/$/, "")}/api/agent/chat`,
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },

      body: JSON.stringify(input),
    },
  );

  if (
    !res.ok ||
    !res.body
  ) {
    let message =
      "Agent request failed";

    try {
      const data =
        await res.json();

      message =
        data.error ??
        data.message ??
        message;
    } catch {
      // Ignore invalid error JSON.
    }

    throw new Error(message);
  }

  const reader =
    res.body.getReader();

  const decoder =
    new TextDecoder();

  let buffer = "";

  while (true) {
    const {
      value,
      done,
    } = await reader.read();

    buffer += decoder.decode(
      value ?? new Uint8Array(),
      {
        stream: !done,
      },
    );

    const blocks =
      buffer.split(/\r?\n\r?\n/);

    buffer =
      blocks.pop() ?? "";

    for (
      const block of blocks
    ) {
      const lines =
        block.split(/\r?\n/);

      for (
        const line of lines
      ) {
        if (
          !line.startsWith(
            "data:",
          )
        ) {
          continue;
        }

        const data =
          line
            .slice(5)
            .trim();

        if (!data) {
          continue;
        }

        try {
          const event =
            JSON.parse(
              data,
            ) as AgentStreamEvent;

          onEvent(event);
        } catch (error) {
          console.error(
            "[SSE JSON ERROR]",
            error,
            data,
          );
        }
      }
    }

    if (done) {
      break;
    }
  }
}