export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    credentials: "same-origin",
  });
  const body = await response.json().catch(() => ({ error: "The server returned an unreadable response." })) as { error?: string } & T;
  if (!response.ok) throw new ApiError(response.status, body.error ?? "Request failed.");
  return body;
}
