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
      // ignore when no request context is available
    }
  } else {
    init.credentials = "include";
  }

  const response = await fetch(url, init);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Unauthorized");
    }
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  if (options.parseJson === false) {
    return undefined as unknown as T;
  }

  const payload = await response.json();
  return payload.data as T;
}

