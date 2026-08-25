import { apiFetch } from "./api";
import { ConnectionInfo } from "./types";

export async function fetchCalendarConnection(
  token: string,
) {
  if (
    typeof token !== "string" ||
    !token.trim()
  ) {
    throw new Error(
      "Invalid session token",
    );
  }

  const data = await apiFetch<{
    connection: ConnectionInfo | null;
  }>("/api/connections", {
    token,
  });

  return data.connection;
}

export async function connectCalendar(
  token: string,
) {
  if (
    typeof token !== "string" ||
    !token.trim()
  ) {
    throw new Error(
      "Invalid session token",
    );
  }

  const result = await apiFetch<{
    url?: string;
    redirectUrl?: string;
    connection?: ConnectionInfo;
  }>("/api/connections/connect", {
    method: "POST",
    token,
    body: {
      redirectUrl:
        `${window.location.origin}/dashboard`,
    },
  });

  console.log(
    "[connectCalendar] result:",
    result,
  );

  const authorizationUrl =
    result.url ??
    result.redirectUrl;

  if (!authorizationUrl) {
    throw new Error(
      "Google did not return an authorization URL.",
    );
  }

  window.location.assign(
    authorizationUrl,
  );
}

export async function refreshCalendarConnection(
  token: string,
) {
  if (
    typeof token !== "string" ||
    !token.trim()
  ) {
    throw new Error(
      "Invalid session token",
    );
  }

  await apiFetch(
    "/api/connections/refresh-status",
    {
      method: "POST",
      token,
    },
  );
}
