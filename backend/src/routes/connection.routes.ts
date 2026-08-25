import { Router, type Request } from "express";
import { requireSession } from "../middleware/requireSession.js";

import {
  refreshCalendarStatus,
  getCalendarConnection,
} from "../services/connection.service.js";

import {
  createGoogleAuthorizationUrl,
  exchangeGoogleCode,
} from "../services/google-oauth.service.js";

import {
  createOAuthState,
  verifyOAuthState,
} from "../services/oauth-state.service.js";

import {
  upsertCalendarConnection,
} from "../repositories/connection.repository.js";

export const connectionRouter = Router();

type AuthenticatedRequest = Request & {
  auth: {
    userId: string;
    authUserId: string;
  };
};

/**
 * ============================================================
 * GOOGLE OAUTH CALLBACK
 * ============================================================
 *
 * IMPORTANT:
 * This route must be BEFORE requireSession.
 *
 * Google redirects here without the Descope
 * Authorization header.
 *
 * GET /api/connections/google/callback
 */
connectionRouter.get(
  "/google/callback",
  async (req, res) => {
    try {
      const code =
        typeof req.query.code === "string"
          ? req.query.code
          : null;

      const state =
        typeof req.query.state === "string"
          ? req.query.state
          : null;

      if (!code) {
        return res.status(400).send(
          "Missing Google OAuth authorization code.",
        );
      }

      if (!state) {
        return res.status(400).send(
          "Missing OAuth state.",
        );
      }

      /**
       * Verify that this OAuth request was
       * started by one of our authenticated users.
       */
      const { userId } =
        verifyOAuthState(state);

      /**
       * Exchange Google's authorization code
       * for access + refresh tokens.
       */
      const tokens =
        await exchangeGoogleCode(code);

      if (!tokens.refresh_token) {
        throw new Error(
          "Google did not return a refresh token. Please try connecting again.",
        );
      }

      const tokenExpiry =
        tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null;

      /**
       * Save the Google tokens against the
       * authenticated application user.
       */
      await upsertCalendarConnection({
        userId,

        status: "connected",

        accessToken:
          tokens.access_token ?? null,

        refreshToken:
          tokens.refresh_token,

        expiresAt:
          tokenExpiry,

        scope:
          tokens.scope ?? null,
      });

      const frontendUrl =
        process.env.FRONTEND_URL ??
        "http://localhost:3000";

      console.log(
        `[Google OAuth] Calendar connected for user ${userId}`,
      );

      return res.redirect(
        `${frontendUrl}/dashboard?calendar=connected`,
      );
    } catch (error) {
      console.error(
        "[Google OAuth] Callback failed:",
        error,
      );

      const frontendUrl =
        process.env.FRONTEND_URL ??
        "http://localhost:3000";

      return res.redirect(
        `${frontendUrl}/dashboard?calendar=error`,
      );
    }
  },
);

/**
 * ============================================================
 * AUTHENTICATED CONNECTION ROUTES
 * ============================================================
 *
 * Everything below this point requires a valid
 * Descope session.
 */
connectionRouter.use(
  requireSession,
);

/**
 * GET /api/connections
 *
 * Return the current calendar connection
 * for the authenticated user.
 */
connectionRouter.get(
  "/",
  async (req, res) => {
    try {
      const connection =
        await getCalendarConnection({
          userId:
            (
              req as AuthenticatedRequest
            ).auth.userId,
        });

      return res.json({
        connection,
      });
    } catch (error) {
      console.error(
        "Failed to get calendar connection:",
        error,
      );

      return res.status(500).json({
        error:
          "Failed to get calendar connection.",
      });
    }
  },
);

/**
 * POST /api/connections/connect
 *
 * Start Google Calendar OAuth.
 */
connectionRouter.post(
  "/connect",
  async (req, res) => {
    try {
      const userId =
        (
          req as AuthenticatedRequest
        ).auth.userId;

      /**
       * Create a short-lived signed state
       * containing our application user ID.
       */
      const state =
        createOAuthState(userId);

      /**
       * Generate the Google authorization URL.
       */
      const url =
        createGoogleAuthorizationUrl(
          state,
        );

      /**
       * Mark the connection as pending
       * while the user is on Google's page.
       */
      await upsertCalendarConnection({
        userId,
        status: "pending",
      });

      console.log(
        `[Google OAuth] Starting calendar connection for user ${userId}`,
      );

      return res.json({
        url,
      });
    } catch (error) {
      console.error(
        "Could not start Google Calendar OAuth:",
        error,
      );

      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Could not start Google Calendar OAuth.",
      });
    }
  },
);

/**
 * POST /api/connections/refresh-status
 */
connectionRouter.post(
  "/refresh-status",
  async (req, res) => {
    try {
      const connection =
        await refreshCalendarStatus({
          userId:
            (
              req as AuthenticatedRequest
            ).auth.userId,

          authUserId:
            (
              req as AuthenticatedRequest
            ).auth.authUserId,
        });

      return res.json({
        connection,
      });
    } catch (error) {
      console.error(
        "Failed to refresh the status:",
        error,
      );

      return res.status(500).json({
        error:
          "Failed to refresh the status.",
      });
    }
  },
);
