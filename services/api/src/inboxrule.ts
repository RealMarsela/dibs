import type { Env } from "./env";

/**
 * Add the literal Email Routing rule `<code>@<mail domain>` -> worker dibs-inbox (same call as
 * services/inbox/scripts/add-trip-address.sh). Returns the address, or null when the token is missing or lacks scope.
 */
export async function addInboxRule(env: Env, code: string): Promise<string | null> {
  const token = env.CF_EMAIL_TOKEN;
  const zone = env.CF_ZONE_ID;
  if (!token || !zone) return null;
  const addr = `${code}@${env.MAIL_DOMAIN || "dibs.larinova.com"}`;
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/email/routing/rules`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        name: `dibs trip ${code}`,
        enabled: true,
        matchers: [{ type: "literal", field: "to", value: addr }],
        actions: [{ type: "worker", value: ["dibs-inbox"] }],
      }),
    });
    const j = (await r.json()) as { success?: boolean };
    return r.ok && j.success ? addr : null;
  } catch {
    return null;
  }
}
