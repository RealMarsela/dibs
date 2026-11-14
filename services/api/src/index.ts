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
import { ApiError, onError } from "./errors";
import { isMainnetPath, mainnetAllowed, mainnetEnv, type MainnetVars } from "./mainnet";
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
  app.use("*", async (c, next) => {
    if (c.env.NEAR_NETWORK === "mainnet" && !mainnetAllowed(c.req.method, new URL(c.req.url).pathname)) {
      throw new ApiError(403, "E_MAINNET_SCOPE", "Mainnet runs the pay-in only (hold, quote, status). This action runs on testnet.");
    }
    await next();
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

const app = createApp();

/* /mainnet/* is the same API against NEAR mainnet (see mainnet.ts); everything else is testnet. */
export default {
  fetch(req: Request, env: Env & MainnetVars, ctx: ExecutionContext) {
    const url = new URL(req.url);
    if (!isMainnetPath(url.pathname)) return app.fetch(req, env, ctx);
    const m = mainnetEnv(env);
    if (!m) return Response.json({ error: "mainnet is not configured", code: "E_MAINNET_UNCONFIGURED" }, { status: 503 });
    url.pathname = url.pathname.slice("/mainnet".length) || "/";
    return app.fetch(new Request(url, req), m, ctx);
  },
};
