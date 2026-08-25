const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

function getApiUrl(path: string) {
  if (!path) {
    throw new Error("API path is undefined");
  }

  const base = API_URL.replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");

  return `${base}/${cleanPath}`;
}


export async function apiFetch<T>(
  path: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  if (!path || path === "undefined") {
    console.error("[apiFetch] Invalid API path:", path);
    throw new Error("API path is undefined");
  }

  const url = getApiUrl(path);

  // rest of your code...


  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.token) {
  if (typeof options.token !== "string") {
    console.error(
      "[apiFetch] Invalid token type:",
      typeof options.token,
      options.token,
    );

    throw new Error(
      "Invalid session token. Expected a JWT string.",
    );
  }

  headers.Authorization = `Bearer ${options.token}`;
}


  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
      signal: options.signal,

      // Important for authenticated browser requests.
      credentials: "include",

      cache: "no-store",
    });

    const contentType =
      response.headers.get("content-type") ?? "";

    let data: any = null;

    if (
      response.status !== 204 &&
      contentType.includes("application/json")
    ) {
      data = await response.json();
    } else if (response.status !== 204) {
      const text = await response.text();

      data = text
        ? { message: text }
        : null;
    }

    if (!response.ok) {
      const message =
        data?.error ??
        data?.message ??
        `Request failed: ${response.status} ${response.statusText}`;

      throw new Error(message);
    }

    return data as T;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith(
        "Backend connection failed",
      )
    ) {
      throw error;
    }

    if (
      error instanceof TypeError &&
      error.message
        .toLowerCase()
        .includes("fetch")
    ) {
      console.error(
        "[apiFetch] Backend connection failed",
        {
          url,
          error: error.message,
        },
      );

      throw new Error(
        `Backend connection failed.

URL: ${url}

Make sure your backend is running and accessible.`,
      );
    }

    console.error(
      "[apiFetch] Request failed",
      {
        url,
        error,
      },
    );

    throw error;
  }
}
