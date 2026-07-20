/**
 * Shared API fetch wrapper for SaaSify.
 *
 * Provides consistent error handling, automatic JSON parsing,
 * and typed response helpers across all frontend API calls.
 */

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

interface ApiResult<T = unknown> {
  ok: boolean;
  data: T;
  status: number;
  error?: string;
}

/**
 * Typed fetch wrapper that:
 * - Adds Content-Type header for JSON bodies
 * - Parses JSON responses automatically
 * - Returns a structured result object
 * - Never throws on HTTP errors (caller checks `ok`)
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<ApiResult<T>> {
  const { body, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(customHeaders as Record<string, string>),
  };

  try {
    const res = await fetch(url, {
      ...rest,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let data: T;
    try {
      data = await res.json();
    } catch {
      data = undefined as T;
    }

    return {
      ok: res.ok,
      data,
      status: res.status,
      error: res.ok ? undefined : (data as Record<string, string>)?.error,
    };
  } catch {
    return {
      ok: false,
      data: undefined as T,
      status: 0,
      error: "Network error. Please check your connection.",
    };
  }
}

/**
 * Convenience helpers for common HTTP methods.
 */
export const api = {
  get: <T = unknown>(url: string) =>
    apiFetch<T>(url, { method: "GET" }),

  post: <T = unknown>(url: string, body?: unknown) =>
    apiFetch<T>(url, { method: "POST", body }),

  put: <T = unknown>(url: string, body?: unknown) =>
    apiFetch<T>(url, { method: "PUT", body }),

  del: <T = unknown>(url: string) =>
    apiFetch<T>(url, { method: "DELETE" }),
};