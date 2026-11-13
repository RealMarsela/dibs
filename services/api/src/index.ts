import { Hono } from "hono";
import { cors } from "hono/cors";
import { blobRoute } from "./blob";
import type { Env } from "./env";
import { onError } from "./errors";
import { holdRoute } from "./hold";
import { quoteRoute } from "./quote";
import { relayRoute } from "./relay";
import { statusRoute } from "./status";
import { tripRoute } from "./trip";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", (c, next) => cors({ origin: c.env.ALLOWED_ORIGIN || "*", maxAge: 600 })(c, next));
  app.get("/health", (c) =>
    c.json({ ok: true, network: c.env.NEAR_NETWORK, contract: c.env.DIBS_CONTRACT, usdc: c.env.USDC_CONTRACT, relayer: c.env.RELAYER_ACCOUNT_ID }),
  );
  app.route("/", quoteRoute);
  app.route("/", statusRoute);
  app.route("/", relayRoute);
  app.route("/", holdRoute);
  app.route("/", blobRoute);
  app.route("/", tripRoute);
  app.notFound((c) => c.json({ error: "not found", code: "E_NOT_FOUND" }, 404));
  app.onError(onError);
  return app;
}

export default createApp();
