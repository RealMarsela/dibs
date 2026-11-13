import type { Context } from "hono";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500 | 502 | 503,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function zodMessage(e: ZodError): string {
  return e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
}

/** Hono onError: every failure is { error, code } with no stack and no raw upstream text. */
export function onError(e: unknown, c: Context) {
  if (e instanceof ApiError) return c.json({ error: e.message, code: e.code }, e.status);
  if (e instanceof ZodError) return c.json({ error: zodMessage(e), code: "E_BAD_INPUT" }, 400);
  return c.json({ error: "internal error", code: "E_INTERNAL" }, 500);
}

export function parse<T>(schema: { safeParse(v: unknown): { success: boolean; data?: T; error?: ZodError } }, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success) throw new ApiError(400, "E_BAD_INPUT", zodMessage(r.error as ZodError));
  return r.data as T;
}

export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new ApiError(400, "E_BAD_JSON", "request body must be valid JSON");
  }
}
