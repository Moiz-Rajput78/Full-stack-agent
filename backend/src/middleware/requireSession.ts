import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { descopeClient } from "../config/descope.js";
import { ensureUser } from "../repositories/user.repository.js";

type AuthenticatedRequest = Request & {
  auth: {
    authUserId: string;
    email?: string;
    name?: string;
    userId: string;
    token: Record<string, unknown>;
  };
};

export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;

  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : null;

  console.log(
    "[requireSession] token:",
    token
      ? {
          type: typeof token,
          length: token.length,
          parts: token.split(".").length,
        }
      : null,
  );

  if (!token) {
    return res.status(401).json({
      error: "Unauthorized",
      success: false,
    });
  }

  try {
    const authInfo =
      await descopeClient.validateSession(token);

    if (!authInfo) {
      return res.status(401).json({
        error: "Invalid session",
        success: false,
      });
    }

    const claims =
      authInfo.token as Record<string, unknown>;

    const authUserId = String(
      claims.sub ?? "",
    );

    if (!authUserId) {
      return res.status(401).json({
        error: "Invalid session",
        success: false,
      });
    }

    const email =
      typeof claims.email === "string"
        ? claims.email
        : undefined;

    const user = await ensureUser({
      authUserId,
      email,
    });

    (req as AuthenticatedRequest).auth = {
      authUserId,
      email,
      name:
        typeof claims.name === "string"
          ? claims.name
          : undefined,
      userId: user.id,
      token: claims,
    };

    next();
  } catch (error) {
    console.error(
      "Descope session validation failed:",
      error,
    );

    return res.status(401).json({
      error: "Session expired or invalid",
      success: false,
    });
  }
}
