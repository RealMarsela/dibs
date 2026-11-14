import { base58 } from "@/live/passkey";

/* Paying a 1Click Solana deposit address from the friend's own wallet (Phantom, Solflare, Backpack…) on the Wallet
   Standard: the app side of its register handshake, `standard:connect`, then `solana:signAndSendTransaction` with an
   SPL USDC TransferChecked. The recipient's USDC account is created first if missing (idempotent, paid by the sender).
   @solana/web3.js is loaded only on this route. */

/* Public RPCs that allow browser calls and answer token-account reads (publicnode refuses those without a token). */
const RPCS = ["https://solana-rpc.web.helium.io", "https://public.rpc.solanavibestation.com", "https://solana-rpc.publicnode.com"];
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const CHAIN = "solana:mainnet";

interface StdAccount {
  address: string;
  publicKey: Uint8Array;
  chains: readonly string[];
}
interface StdWallet {
  name: string;
  icon: string;
  chains: readonly string[];
  features: Record<string, unknown>;
}
export interface SolWallet {
  id: string;
  name: string;
  icon: string;
  w: StdWallet;
}
export interface SolSession {
  wallet: SolWallet;
  account: StdAccount;
}

type Connect = { connect(): Promise<{ accounts: readonly StdAccount[] }> };
type SignAndSend = { signAndSendTransaction(i: { account: StdAccount; chain: string; transaction: Uint8Array }): Promise<{ signature: Uint8Array }[]> };
type Disconnect = { disconnect(): Promise<void> };

const seen = new Set<StdWallet>();
const usable = (w: StdWallet) => w.chains.includes(CHAIN) && "standard:connect" in w.features && "solana:signAndSendTransaction" in w.features;

/** The app side of the Wallet Standard handshake: wallets register themselves, we keep the ones that can pay on Solana. */
export function discoverSolanaWallets(onChange: (w: SolWallet[]) => void): () => void {
  const push = () => onChange([...seen].filter(usable).map((w) => ({ id: `sol:${w.name}`, name: w.name, icon: w.icon, w })));
  const register = (...ws: StdWallet[]) => {
    ws.forEach((w) => seen.add(w));
    push();
    return () => {
      ws.forEach((w) => seen.delete(w));
      push();
    };
  };
  const api = Object.freeze({ register });
  const onRegister = (e: Event) => (e as CustomEvent<(a: typeof api) => void>).detail?.(api);
  window.addEventListener("wallet-standard:register-wallet", onRegister);
  window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: api }));
  const settle = setTimeout(push, 450);
  return () => {
    window.removeEventListener("wallet-standard:register-wallet", onRegister);
    clearTimeout(settle);
  };
}

export async function connectSolana(wallet: SolWallet): Promise<SolSession> {
  const { accounts } = await (wallet.w.features["standard:connect"] as Connect).connect();
  const account = accounts.find((a) => a.chains?.includes(CHAIN)) ?? accounts[0];
  if (!account) throw new Error(`${wallet.name} did not share an address.`);
  return { wallet, account };
}

/** `missing` answers for an account that does not exist yet (the RPC reports it as an error). */
async function rpc<T>(method: string, params: unknown[], missing?: () => T): Promise<T> {
  for (const url of RPCS) {
    try {
      const r = (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()) as { result?: T; error?: { message?: string } };
      if (r.result !== undefined) return r.result;
      if (missing && /could not find account/i.test(r.error?.message ?? "")) return missing();
    } catch {
      /* next RPC */
    }
  }
  throw new Error("Solana RPC is not answering. Try again in a moment.");
}

async function usdcAccount(owner: string): Promise<string> {
  const { PublicKey } = await import("@solana/web3.js");
  const seeds = [new PublicKey(owner).toBuffer(), new PublicKey(TOKEN_PROGRAM).toBuffer(), new PublicKey(USDC_MINT).toBuffer()];
  return PublicKey.findProgramAddressSync(seeds, new PublicKey(ATA_PROGRAM))[0].toBase58();
}

/** USDC in the owner's associated token account (the account a wallet pays from). Zero if it does not exist. */
export async function solUsdcBalance(owner: string): Promise<bigint> {
  const r = await rpc<{ value: { amount: string } }>("getTokenAccountBalance", [await usdcAccount(owner), { commitment: "confirmed" }], () => ({ value: { amount: "0" } }));
  return BigInt(r.value.amount);
}

/** USDC TransferChecked of exactly `amount` to the deposit address's USDC account. Returns the transaction signature. */
export async function sendSolUsdc(s: SolSession, to: string, amount: bigint): Promise<string> {
  const [{ PublicKey, Transaction, TransactionInstruction, SystemProgram, ComputeBudgetProgram }, { Buffer }] = await Promise.all([import("@solana/web3.js"), import("buffer")]);
  const owner = new PublicKey(s.account.address);
  const dest = new PublicKey(to);
  const mint = new PublicKey(USDC_MINT);
  const token = new PublicKey(TOKEN_PROGRAM);
  const ataProgram = new PublicKey(ATA_PROGRAM);
  const ata = (o: InstanceType<typeof PublicKey>) => PublicKey.findProgramAddressSync([o.toBuffer(), token.toBuffer(), mint.toBuffer()], ataProgram)[0];
  const [src, dst] = [ata(owner), ata(dest)];
  const createDst = new TransactionInstruction({
    programId: ataProgram,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: dst, isSigner: false, isWritable: true },
      { pubkey: dest, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: token, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]), // CreateIdempotent
  });
  const raw = new Uint8Array(10);
  const view = new DataView(raw.buffer);
  view.setUint8(0, 12); // TransferChecked
  view.setBigUint64(1, amount, true);
  view.setUint8(9, 6); // USDC decimals
  const data = Buffer.from(raw);
  const transfer = new TransactionInstruction({
    programId: token,
    keys: [
      { pubkey: src, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: dst, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  });
  const { value } = await rpc<{ value: { blockhash: string } }>("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const tx = new Transaction({ feePayer: owner, recentBlockhash: value.blockhash }).add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 80_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    createDst,
    transfer,
  );
  const bytes = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  const [out] = await (s.wallet.w.features["solana:signAndSendTransaction"] as SignAndSend).signAndSendTransaction({ account: s.account, chain: CHAIN, transaction: new Uint8Array(bytes) });
  if (!out?.signature) throw new Error(`${s.wallet.name} did not return a signature.`);
  return base58(out.signature);
}

export async function disconnectSolana(s: SolSession): Promise<void> {
  try {
    await (s.wallet.w.features["standard:disconnect"] as Disconnect | undefined)?.disconnect();
  } catch {
    /* already disconnected */
  }
}

export const solTxUrl = (sig: string) => `https://solscan.io/tx/${sig}`;

export function solError(e: unknown, wallet: string): string {
  const m = String((e as { message?: string })?.message ?? e);
  if ((e as { code?: number })?.code === 4001 || /reject|cancel|denied|declined/i.test(m)) return `You cancelled in ${wallet}. Nothing was sent.`;
  if (/insufficient (lamports|funds)|0x1\b|rent/i.test(m)) return `${wallet} needs a little SOL for the fee and the deposit account (about 0.0021 SOL).`;
  return m.length > 160 ? `${wallet} could not send it: ${m.slice(0, 157)}…` : m;
}
