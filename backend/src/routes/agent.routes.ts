import { Router } from "express";
import { z } from "zod";

import { requireSession } from "../middleware/requireSession.js";

import {
  deleteUserThread,
  getThreadMessages,
  listUserThreads,
  streamAgentReply,
} from "../services/agent.service.js";

export const agentRoutes = Router();

const chatSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1)
    .max(5000),

  threadId: z.uuid(),
});

const threadIdSchema = z.uuid();

agentRoutes.use(requireSession);

/**
 * GET /api/agent/threads
 */
agentRoutes.get(
  "/threads",
  async (req, res) => {
    try {
      const threads =
        await listUserThreads(
          req.auth!.authUserId,
        );

      res.json({
        threads,
      });
    } catch (error) {
      console.error(
        "[GET /threads]",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : "Failed to list threads";

      res.status(500).json({
        error: message,
      });
    }
  },
);

/**
 * GET /api/agent/threads/:threadId
 */
agentRoutes.get(
  "/threads/:threadId",
  async (req, res) => {
    const parsed =
      threadIdSchema.safeParse(
        req.params.threadId,
      );

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid threadId",
      });

      return;
    }

    try {
      const messages =
        await getThreadMessages(
          req.auth!.authUserId,
          parsed.data,
        );

      res.json({
        threadId:
          parsed.data,

        messages,
      });
    } catch (error) {
      console.error(
        "[GET /threads/:threadId]",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : "Failed to load thread";

      const status =
        message === "Thread not found"
          ? 404
          : 500;

      res.status(status).json({
        error: message,
      });
    }
  },
);

/**
 * DELETE /api/agent/threads/:threadId
 */
agentRoutes.delete(
  "/threads/:threadId",
  async (req, res) => {
    const parsed =
      threadIdSchema.safeParse(
        req.params.threadId,
      );

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid threadId",
      });

      return;
    }

    try {
      await deleteUserThread(
        req.auth!.authUserId,
        parsed.data,
      );

      res.json({
        success: true,
        threadId:
          parsed.data,
      });
    } catch (error) {
      console.error(
        "[DELETE /threads/:threadId]",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : "Failed to delete thread";

      const status =
        message === "Thread not found"
          ? 404
          : 500;

      res.status(status).json({
        error: message,
      });
    }
  },
);

/**
 * POST /api/agent/chat
 */
agentRoutes.post(
  "/chat",
  async (req, res) => {
    const parsed =
      chatSchema.safeParse(
        req.body,
      );

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid chat body",
        details: parsed.error.flatten(),
      });

      return;
    }

    res.status(200);

    res.setHeader(
      "Content-Type",
      "text/event-stream; charset=utf-8",
    );

    res.setHeader(
      "Cache-Control",
      "no-cache, no-transform",
    );

    res.setHeader(
      "Connection",
      "keep-alive",
    );

    res.setHeader(
      "X-Accel-Buffering",
      "no",
    );

    res.flushHeaders();

    const write = (
      event: Record<string, unknown>,
    ) => {
      if (res.writableEnded) {
        return;
      }

      res.write(
        `data: ${JSON.stringify(
          event,
        )}\n\n`,
      );
    };

    try {
      await streamAgentReply({
        userId:
          req.auth!.userId,

        authUserId:
          req.auth!.authUserId,

        threadId:
          parsed.data.threadId,

        message:
          parsed.data.message,

        onEvent:
          write,
      });
    } catch (error) {
      console.error(
        "[POST /chat]",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : "Failed to process request";

      write({
        type: "error",
        message,
      });
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  },
);