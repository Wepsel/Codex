const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5010/api";

function withCluster(path: string, clusterId?: string): string {
  if (!clusterId) return path;
  if (path.startsWith("/clusters/")) return path;
  if (path.startsWith("/cluster/")) {
    return `/clusters/${clusterId}${path.replace("/cluster", "")}`;
  }
  return `/clusters/${clusterId}${path}`;
}

interface FetchOptions extends RequestInit {
  parseJson?: boolean;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export function isCompanyMembershipInactiveError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 403 && error.message === "Company membership is not active";
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}, clusterId?: string): Promise<T> {
  const scoped = withCluster(path, clusterId);
  const url = `${API_BASE}${scoped}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined)
  };

  const init: RequestInit = {
    ...options,
    headers
  };

  if (typeof window === "undefined") {
    try {
      const { cookies } = await import("next/headers");
      const sessionToken = cookies().get("nebula_session")?.value;
      if (sessionToken) {
        headers.Cookie = `nebula_session=${sessionToken}`;
      }
    } catch {
      // ignore when no request context is available (e.g. during build)
    }
  } else {
    init.credentials = "include";
  }

  const response = await fetch(url, init);

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    const rawBody = await response.text();
    let parsedBody: unknown = rawBody;
    let message: string | undefined;

    if (contentType.includes("application/json")) {
      try {
        parsedBody = JSON.parse(rawBody);
        if (parsedBody && typeof parsedBody === "object") {
          const data = parsedBody as Record<string, unknown>;
          const candidate =
            typeof data.error === "string"
              ? data.error
              : typeof data.message === "string"
                ? data.message
                : undefined;
          if (candidate && candidate.trim().length > 0) {
            message = candidate.trim();
          }
        }
      } catch {
        parsedBody = rawBody;
      }
    }

    if (!message) {
      const trimmed = rawBody.trim();
      if (trimmed.length > 0) {
        message = trimmed;
      }
    }

    if (!message) {
      message = `Request failed with status ${response.status}`;
    }

    throw new ApiError(message, response.status, parsedBody);
  }

  if (options.parseJson === false) {
    return undefined as unknown as T;
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const payload = await response.json();
  return payload.data as T;
}
