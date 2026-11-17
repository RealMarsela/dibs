import type { Env } from "./env";

/**
 * "My trips" index in the NAMES KV: `acct/<account>/<code>` -> { role, n?, network, at, roles }.
 * `role`/`n` are the first role seen (the shape the app contract promises); `roles` lists every role the account
 * holds on the trip (a booker can also hold a later bed). The entry is mirrored into the key's metadata so a
 * prefix list returns everything in one call.
 */
export type Role = "booker" | "bed" | "waitlist" | "left";
export interface RoleRef {
  role: Role;
  n?: number;
}
export interface AcctEntry extends RoleRef {
  network: "testnet" | "mainnet";
  at: string;
  roles: RoleRef[];
}

export const acctKey = (account: string, code: string): string => `acct/${account}/${code}`;
export const acctPrefix = (account: string): string => `acct/${account}/`;
const sameRole = (a: RoleRef, b: RoleRef): boolean => a.role === b.role && (a.n ?? 0) === (b.n ?? 0);

export function mergeEntry(prev: AcctEntry | null, ref: RoleRef, network: AcctEntry["network"], at: string): AcctEntry {
  const roles = [...(prev?.roles ?? (prev ? [{ role: prev.role, ...(prev.n ? { n: prev.n } : {}) }] : []))];
  if (!roles.some((r) => sameRole(r, ref))) roles.push(ref);
  const first = roles[0];
  return { role: first.role, ...(first.n ? { n: first.n } : {}), network, at: prev?.at ?? at, roles };
}

/** Best effort: a KV failure never fails the request that triggered it. */
export async function indexAccount(env: Env, account: string, code: string, ref: RoleRef): Promise<void> {
  try {
    const key = acctKey(account, code);
    const prev = ((await env.NAMES.get(key, "json")) as AcctEntry | null) ?? null;
    const entry = mergeEntry(prev, ref, env.NEAR_NETWORK === "mainnet" ? "mainnet" : "testnet", new Date().toISOString());
    await env.NAMES.put(key, JSON.stringify(entry), { metadata: entry });
  } catch (e) {
    console.error("acct index write failed", e instanceof Error ? e.message : "unknown");
  }
}

/** Every indexed trip for one account, read from key metadata. */
export async function listAccount(env: Env, account: string): Promise<{ code: string; entry: AcctEntry }[]> {
  const prefix = acctPrefix(account);
  const out: { code: string; entry: AcctEntry }[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 5; i++) {
    const page = await env.NAMES.list<AcctEntry>({ prefix, limit: 1000, cursor });
    for (const k of page.keys) if (k.metadata) out.push({ code: k.name.slice(prefix.length), entry: k.metadata });
    if (page.list_complete) break;
    cursor = page.cursor;
  }
  return out;
}
