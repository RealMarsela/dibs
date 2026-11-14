import { Hono } from "hono";
import { cors } from "hono/cors";
import { blobRoute } from "./blob";
import { activityRoute } from "./activity";
import { bootstrapRoute } from "./bootstrap";
import { cardRoute } from "./card";
import { createRoute } from "./create";
import { fundRoute } from "./fund";
import { namesRoute } from "./names";
import { proofRoute } from "./proof";
import type { Env } from "./env";
import { onError } from "./errors";
import { holdRoute } from "./hold";
import { quoteRoute } from "./quote";
import { relayRoute } from "./relay";
import { statusRoute } from "./status";
import { tripRoute } from "./trip";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", (c, next) => {
    const allowed = (c.env.ALLOWED_ORIGIN || "*").split(",").map((o) => o.trim()).filter(Boolean);
    return cors({
      origin: (origin) => (allowed.includes("*") ? "*" : allowed.includes(origin) ? origin : null),
      maxAge: 600,
    })(c, next);
  });
  app.get("/health", (c) =>
    c.json({ ok: true, network: c.env.NEAR_NETWORK, contract: c.env.DIBS_CONTRACT, usdc: c.env.USDC_CONTRACT, relayer: c.env.RELAYER_ACCOUNT_ID }),
  );
  app.route("/", quoteRoute);
  app.route("/", statusRoute);
  app.route("/", relayRoute);
  app.route("/", holdRoute);
  app.route("/", blobRoute);
  app.route("/", tripRoute);
  app.route("/", cardRoute);
  app.route("/", activityRoute);
  app.route("/", bootstrapRoute);
  app.route("/", fundRoute);
  app.route("/", namesRoute);
  app.route("/", proofRoute);
  app.route("/", createRoute);
  app.notFound((c) => c.json({ error: "not found", code: "E_NOT_FOUND" }, 404));
  app.onError(onError);
  return app;
}

export default createApp();
