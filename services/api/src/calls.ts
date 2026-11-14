import { ApiError } from "./errors";
import type { Env } from "./env";
import { relayerAccount } from "./near";
import { txHashOf } from "./sweep";

export const NEAR = 10n ** 24n;
export const GAS_300 = 300_000_000_000_000n;

/** Relayer-signed function call; returns the tx hash or throws ApiError(502, failCode). */
export async function relayerCall(env: Env, contractId: string, methodName: string, args: Record<string, unknown>, opts: { deposit?: bigint; gas?: bigint; failCode: string; failMsg: string }): Promise<string | null> {
  try {
    const res = await relayerAccount(env).callFunctionRaw({
      contractId,
      methodName,
      args,
      gas: opts.gas ?? 100_000_000_000_000n,
      deposit: opts.deposit ?? 0n,
      waitUntil: "EXECUTED_OPTIMISTIC",
    });
    return txHashOf(res);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(502, opts.failCode, opts.failMsg);
  }
}

export const clientIp = (c: { req: { header(n: string): string | undefined } }): string => c.req.header("cf-connecting-ip") ?? "anon";
