import { z } from "zod";
import type { Env } from "./env";

export const itemSchema = z.object({
  id: z.string(),
  trip: z.string(),
  blob_url: z.string(),
  blob_sha256: z.string(),
  received_at: z.string(),
  from_domain: z.string(),
  subject_hash: z.string(),
  dkim_domain: z.string().nullable(),
  wrapped: z.boolean(),
  status: z.enum(["ready", "submitted", "submit_failed", "not_eligible"]),
  tx_hash: z.string().optional(),
  note: z.string().optional(),
});
export type Item = z.infer<typeof itemSchema>;

const key = (trip: string, id: string): string => `inbox/${trip}/${id}.json`;

/** id = <received ms, 13 digits>-<8 hex>, so lexicographic order is arrival order. */
export const newId = (now: number): string => `${String(now).padStart(13, "0")}-${Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => x.toString(16).padStart(2, "0")).join("")}`;

export async function putItem(env: Env, item: Item): Promise<void> {
  await env.BLOBS.put(key(item.trip, item.id), JSON.stringify(item), { httpMetadata: { contentType: "application/json" } });
}

export async function listItems(env: Env, trip: string, limit = 20): Promise<Item[]> {
  const out: Item[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.BLOBS.list({ prefix: `inbox/${trip}/`, cursor });
    for (const o of page.objects) {
      const body = await env.BLOBS.get(o.key);
      const r = body ? itemSchema.safeParse(JSON.parse(await body.text())) : undefined;
      if (r?.success) out.push(r.data);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor && out.length < 500);
  return out.sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, limit);
}
