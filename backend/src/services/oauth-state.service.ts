import { createHmac, timingSafeEqual } from "node:crypto";

const secret =
  process.env.OAUTH_STATE_SECRET ??
  "development-oauth-state-secret";

const encode = (value: string) =>
  Buffer.from(value).toString("base64url");

const sign = (input: string) =>
  createHmac("sha256", secret)
    .update(input)
    .digest("base64url");

export function createOAuthState(
  userId: string,
) {
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encode(
    JSON.stringify({ userId, exp: Math.floor(Date.now() / 1000) + 600 }),
  );
  const input = `${header}.${payload}`;

  return `${input}.${sign(input)}`;
}

export function verifyOAuthState(
  state: string,
) {
  const parts = state.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid OAuth state");
  }

  const [header, payload, signature] = parts;
  const expectedSignature = sign(`${header}.${payload}`);

  if (
    signature.length !== expectedSignature.length ||
    !timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    )
  ) {
    throw new Error("Invalid OAuth state");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid OAuth state");
  }

  if (typeof decoded !== "object" || decoded === null) {
    throw new Error(
      "Invalid OAuth state",
    );
  }

  const payloadData = decoded as Record<string, unknown>;

  if (
    typeof payloadData.userId !== "string" ||
    typeof payloadData.exp !== "number" ||
    payloadData.exp < Math.floor(Date.now() / 1000)
  ) {
    throw new Error(
      "Invalid OAuth state",
    );
  }

  return {
    userId: payloadData.userId,
  };
}
