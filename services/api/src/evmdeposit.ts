import { Hono } from "hono";
import { z } from "zod";
import { ApiError, parse, readJson } from "./errors";
import { type Env, isTestnet } from "./env";
import { getTrip } from "./near";
import { clientIp } from "./calls";
import { rateLimit } from "./ratelimit";
import { bedIndex, tripCode } from "./schemas";
import { creditTestDeposit } from "./fund";

export const evmDepositRoute = new Hono<{ Bindings: Env }>();

const CHAIN_ID = 84532;
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const DEFAULT_RPCS = "https://sepolia.base.org,https://base-sepolia-rpc.publicnode.com";

const body = z.object({ trip: tripCode, kind: z.enum(["bed", "wait"]), n: bedIndex, txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "txHash: 0x + 64 hex") }).strict();

interface Log { address?: string; topics?: string[]; data?: string }
interface EvmReceipt { status?: string; logs?: Log[] }

async function fetchReceipt(env: Env, txHash: string): Promise<EvmReceipt | null> {
  const urls = (env.BASE_SEPOLIA_RPC_URLS || DEFAULT_RPCS).split(",").map((s) => s.trim()).filter(Boolean);
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [txHash] }),
      });
      if (!res.ok) continue;
      const j = (await res.json()) as { result?: EvmReceipt | null; error?: unknown };
      if (j.error || !("result" in j)) continue;
      return j.result ?? null;
    } catch {
      /* try the next RPC */
    }
  }
  throw new ApiError(502, "E_RPC", "could not reach Base Sepolia RPC");
}

const padTopic = (addr: string) => "0x" + addr.slice(2).toLowerCase().padStart(64, "0");

evmDepositRoute.get("/testnet/evm-info", (c) => {
  if (!isTestnet(c.env)) return c.json({ error: "not found", code: "E_NOT_FOUND" }, 404);
  if (!c.env.TESTNET_EVM_DEPOSIT) throw new ApiError(503, "E_EVM_UNCONFIGURED", "EVM deposit address is not configured");
  return c.json({ chainId: CHAIN_ID, chain: "base-sepolia", usdc: BASE_SEPOLIA_USDC, address: c.env.TESTNET_EVM_DEPOSIT });
});

/** Testnet stand-in for the bridge: verify a real Base Sepolia test-USDC transfer, then credit the bed like the faucet. */
evmDepositRoute.post("/testnet/evm-deposit", async (c) => {
  const env = c.env;
  if (!isTestnet(env)) return c.json({ error: "not found", code: "E_NOT_FOUND" }, 404);
  const to = env.TESTNET_EVM_DEPOSIT;
  if (!to) throw new ApiError(503, "E_EVM_UNCONFIGURED", "EVM deposit address is not configured");
  const b = parse(body, await readJson(c));
  const txHash = b.txHash.toLowerCase();
  rateLimit(`evmdep:ip:${clientIp(c)}`, 8, 10 * 60_000);
  rateLimit(`evmdep:tx:${txHash}`, 3, 60_000);

  const trip = (await getTrip(env, b.trip)) as { price: string } | undefined;
  if (!trip) throw new ApiError(404, "E_TRIP_NOT_FOUND", `trip ${b.trip} not found`);
  const price = BigInt(trip.price);

  const receipt = await fetchReceipt(env, txHash);
  if (!receipt) throw new ApiError(409, "E_EVM_TX_PENDING", "transaction not mined yet, retry in a few seconds");
  if (receipt.status !== "0x1") throw new ApiError(400, "E_EVM_TX_FAILED", "the Base Sepolia transaction failed");

  const want = padTopic(to);
  const log = (receipt.logs ?? []).find((l) => {
    const t = l.topics ?? [];
    if (l.address?.toLowerCase() !== BASE_SEPOLIA_USDC.toLowerCase() || t.length < 3) return false;
    if (t[0]?.toLowerCase() !== TRANSFER_TOPIC || t[2]?.toLowerCase() !== want) return false;
    try {
      return BigInt(l.data || "0x0") >= price;
    } catch {
      return false;
    }
  });
  if (!log) {
    throw new ApiError(400, "E_EVM_NO_TRANSFER", `no Base Sepolia USDC transfer of at least ${price} (6 decimals) to ${to} found in this transaction`);
  }

  const key = `evmdep/${txHash}`;
  const claimed = await env.BLOBS.put(key, JSON.stringify({ trip: b.trip, kind: b.kind, n: b.n, at: new Date().toISOString() }), { onlyIf: { etagDoesNotMatch: "*" } });
  if (claimed === null) throw new ApiError(409, "E_DEPOSIT_USED", "this transaction has already been credited");
  try {
    const r = await creditTestDeposit(env, b.trip, b.kind, b.n, `${b.kind === "bed" ? "Bed" : "Waitlist slot"} ${b.n} paid from Base Sepolia (test USDC)`);
    return c.json({ evm_tx: txHash, from: "0x" + (log.topics as string[])[1].slice(-40), ...r });
  } catch (e) {
    await env.BLOBS.delete(key); // release so a retry works
    throw e;
  }
});
