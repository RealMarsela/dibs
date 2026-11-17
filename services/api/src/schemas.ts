import { z } from "zod";

export const tripCode = z.string().regex(/^[a-z0-9]{3,12}$/, "trip code: 3-12 chars a-z 0-9");
export const IMPLICIT = z.string().regex(/^[0-9a-f]{64}$/);
export const NAMED = /^(?=.{2,64}$)([a-z\d]+[-_])*[a-z\d]+(\.([a-z\d]+[-_])*[a-z\d]+)*$/;
export const ETH_IMPLICIT = z.string().regex(/^0x[0-9a-f]{40}$/);
/** A 64-hex implicit id, a 0x eth-implicit id, or a NEAR named account. */
export const accountId = z.union([IMPLICIT, ETH_IMPLICIT, z.string().regex(NAMED, "not a valid NEAR account id")]);
export const bedIndex = z.number().int().min(1).max(99);

export const FROM_CHAINS = ["eth", "arb", "base", "sol", "pol", "op"] as const;
export type FromChain = (typeof FROM_CHAINS)[number];

const refundAddr = (chain: FromChain, a: string): boolean =>
  chain === "sol" ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) : /^0x[0-9a-fA-F]{40}$/.test(a);

export const quoteBody = z
  .object({
    trip: tripCode,
    n: bedIndex,
    kind: z.enum(["bed", "wait"]),
    fromChain: z.enum(FROM_CHAINS),
    refundTo: z.string().min(20).max(64),
    dry: z.boolean().optional(),
    // Dry-only overrides so the quote path can be smoke-tested without a deployed trip.
    dry_amount: z.string().regex(/^\d{1,12}$/).optional(),
    dry_recipient: z.string().min(2).max(64).optional(),
  })
  .strict()
  .refine((b) => refundAddr(b.fromChain, b.refundTo), {
    message: "refundTo is not a valid address for fromChain",
    path: ["refundTo"],
  })
  .refine((b) => b.dry || (!b.dry_amount && !b.dry_recipient), {
    message: "dry_amount and dry_recipient are only allowed with dry:true",
    path: ["dry"],
  });

export const relayBody = z
  .object({
    // base64 of borsh-encoded SignedDelegate (near-api-js encodeSignedDelegate)
    signed_delegate: z.string().min(40).max(20000).regex(/^[A-Za-z0-9+/=_-]+$/, "base64"),
  })
  .strict();

export const depositAddressParam = z.string().min(2).max(128).regex(/^[A-Za-z0-9._:-]+$/);
