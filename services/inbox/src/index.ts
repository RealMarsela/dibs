import { Hono } from "hono";
import { cors } from "hono/cors";
import { type Env, TRIP_RE } from "./env";
import { ingest, type MailLike } from "./ingest";
import { listItems } from "./store";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", (c, next) => cors({ origin: c.env.ALLOWED_ORIGIN ?? "*", allowMethods: ["GET"] })(c, next));
  app.get("/health", (c) => c.json({ ok: true, domain: c.env.MAIL_DOMAIN, contract: c.env.DIBS_CONTRACT, auto_submit: c.env.AUTO_SUBMIT === "1" }));
  // Metadata only: never any email content.
  app.get("/inbox/:trip", async (c) => {
    const trip = c.req.param("trip");
    if (!TRIP_RE.test(trip)) return c.json({ error: "bad trip code", code: "E_BAD_INPUT" }, 400);
    const items = await listItems(c.env, trip);
    c.header("cache-control", "public, max-age=2");
    return c.json({ trip, address: `${trip}@${c.env.MAIL_DOMAIN}`, items, fetched_at: new Date().toISOString() });
  });
  app.notFound((c) => c.json({ error: "not found", code: "E_NOT_FOUND" }, 404));
  app.onError((_e, c) => c.json({ error: "internal error", code: "E_INTERNAL" }, 500));
  return app;
}

const app = createApp();

export default {
  fetch: app.fetch,
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const mail: MailLike = { from: message.from, to: message.to, raw: message.raw, rawSize: message.rawSize, setReject: (r) => message.setReject(r) };
    await ingest(env, mail);
  },
} satisfies ExportedHandler<Env>;
