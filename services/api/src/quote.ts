import { Hono } from "hono";
import { ApiError, parse, readJson } from "./errors";
import { type Env, isTestnet, receiptAccount } from "./env";
import { accountExists, getTrip, isStorageRegistered } from "./near";
import { requestQuote, QUOTE_TTL_MS, ORIGIN_ASSET } from "./oneclick";
import { quoteBody } from "./schemas";

export const quoteRoute = new Hono<{ Bindings: Env }>();

quoteRoute.post("/quote", async (c) => {
  const b = parse(quoteBody, await readJson(c));
  const env = c.env;
  const dry = b.dry === true;

  // Dry mode (smoke tests) skips every on-chain read and never creates a deposit.
  let recipient = b.dry_recipient ?? receiptAccount(env, b.kind, b.trip, b.n);
  let price = b.dry_amount ?? "250000";

  if (!dry) {
    const trip = await getTrip(env, b.trip);
    if (!trip) throw new ApiError(404, "E_TRIP_NOT_FOUND", `trip ${b.trip} not found`);
    if (b.kind === "bed" && b.n > trip.n_beds) throw new ApiError(400, "E_BAD_INPUT", "n is out of range for this trip");
    price = String(trip.price);
    recipient = receiptAccount(env, b.kind, b.trip, b.n);
    if (!(await accountExists(env, recipient))) throw new ApiError(409, "E_RECEIPT_NOT_FOUND", `receipt account ${recipient} does not exist yet`);
    if (!(await isStorageRegistered(env, recipient))) throw new ApiError(409, "E_RECEIPT_NOT_REGISTERED", `receipt account ${recipient} has no USDC storage deposit`);
  }

  if (isTestnet(env) && !dry) {
    // 1Click has no testnet: the payer sends testnet USDC straight to the receipt account.
    return c.json({
      mode: "testnet",
      depositAddress: recipient,
      amountIn: price,
      token: env.USDC_CONTRACT,
      expiresAt: null,
      instructions: [
        { step: 1, text: "Mint testnet USDC straight into the receipt account (open faucet)", call: { contract: env.USDC_CONTRACT, method: "mint", args: { account_id: recipient, amount: price } } },
        { step: 2, text: "Poll GET /status/<depositAddress>; the API sweeps the receipt account into the trip" },
      ],
    });
  }

  const q = await requestQuote(env, { fromChain: b.fromChain, refundTo: b.refundTo, recipient, amountOut: price, dry });
  return c.json({
    mode: "oneclick",
    dry,
    depositAddress: q.quote.depositAddress ?? null,
    amountIn: q.quote.amountIn,
    minAmountIn: q.quote.minAmountIn ?? null,
    amountOut: q.quote.amountOut,
    token: ORIGIN_ASSET[b.fromChain],
    expiresAt: q.quote.deadline ?? q.quoteRequest.deadline ?? new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
    etaSeconds: q.quote.timeEstimate ?? null,
    refundFee: q.quote.refundFee ?? null,
    recipient,
  });
});
