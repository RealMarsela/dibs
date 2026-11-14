/* Paying a 1Click deposit address from the friend's own EVM wallet, on the wallet standards themselves:
   EIP-6963 to find every installed wallet (MetaMask, Rabby, Coinbase, Brave…), EIP-1193 to talk to it,
   EIP-3326/3085 to put it on the right chain and EIP-2255 to let it go again. No SDK sits in between. */

export type EvmChain = "base" | "arbitrum" | "ethereum" | "base-sepolia";

interface Eip1193 {
  request(args: { method: string; params?: unknown }): Promise<unknown>;
}
export interface EvmWallet {
  id: string;
  name: string;
  icon: string;
  provider: Eip1193;
}

const CHAIN: Record<EvmChain, { id: number; usdc: string; name: string; rpc: string; explorer: string }> = {
  base: { id: 8453, usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", name: "Base", rpc: "https://mainnet.base.org", explorer: "https://basescan.org" },
  arbitrum: { id: 42161, usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", name: "Arbitrum One", rpc: "https://arb1.arbitrum.io/rpc", explorer: "https://arbiscan.io" },
  ethereum: { id: 1, usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", name: "Ethereum", rpc: "https://ethereum-rpc.publicnode.com", explorer: "https://etherscan.io" },
  // Testnet trips: Circle's test USDC on Base Sepolia, verified by the API, which credits the bed on NEAR testnet.
  "base-sepolia": { id: 84532, usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", name: "Base Sepolia", rpc: "https://sepolia.base.org", explorer: "https://sepolia.basescan.org" },
};

export const isEvmChain = (c: string): c is EvmChain => c in CHAIN;
export const evmTxUrl = (c: EvmChain, hash: string) => `${CHAIN[c].explorer}/tx/${hash}`;

const found = new Map<string, EvmWallet>();

/** Collects every wallet that announces itself. Calls back with the full list on each announcement. */
export function discoverEvmWallets(onChange: (w: EvmWallet[]) => void): () => void {
  const announce = (e: Event) => {
    const d = (e as CustomEvent<{ info?: { rdns?: string; name?: string; icon?: string }; provider?: Eip1193 }>).detail;
    if (!d?.info?.rdns || !d.provider?.request) return;
    found.set(d.info.rdns, { id: d.info.rdns, name: d.info.name ?? d.info.rdns, icon: d.info.icon ?? "", provider: d.provider });
    onChange([...found.values()]);
  };
  window.addEventListener("eip6963:announceProvider", announce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  // An older wallet that only injects window.ethereum (EIP-1193) still counts.
  const legacy = setTimeout(() => {
    const eth = (window as unknown as { ethereum?: Eip1193 & { isMetaMask?: boolean } }).ethereum;
    if (found.size === 0 && eth?.request) {
      found.set("injected", { id: "injected", name: eth.isMetaMask ? "MetaMask" : "your browser wallet", icon: "", provider: eth });
    }
    onChange([...found.values()]);
  }, 450);
  if (found.size) onChange([...found.values()]);
  return () => {
    window.removeEventListener("eip6963:announceProvider", announce);
    clearTimeout(legacy);
  };
}

export async function connectEvm(w: EvmWallet): Promise<string> {
  const accounts = (await w.provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) throw new Error(`${w.name} did not share an address.`);
  return accounts[0];
}

/** Puts the wallet on the chain the quote is for, adding the chain first if the wallet has never seen it. */
export async function ensureChain(w: EvmWallet, c: EvmChain): Promise<void> {
  const want = `0x${CHAIN[c].id.toString(16)}`;
  if (((await w.provider.request({ method: "eth_chainId" })) as string)?.toLowerCase() === want) return;
  try {
    await w.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: want }] });
  } catch (e) {
    if (code(e) !== 4902) throw e;
    const ch = CHAIN[c];
    await w.provider.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: want, chainName: ch.name, rpcUrls: [ch.rpc], blockExplorerUrls: [ch.explorer], nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 } }],
    });
  }
  const now = ((await w.provider.request({ method: "eth_chainId" })) as string)?.toLowerCase();
  if (now !== want) throw new Error(`${w.name} is still on another network. Switch it to ${CHAIN[c].name} and try again.`);
}

const word = (hex: string) => hex.replace(/^0x/, "").toLowerCase().padStart(64, "0");

export async function usdcBalance(w: EvmWallet, c: EvmChain, owner: string): Promise<bigint> {
  const out = (await w.provider.request({ method: "eth_call", params: [{ to: CHAIN[c].usdc, data: `0x70a08231${word(owner)}` }, "latest"] })) as string;
  return BigInt(out && out !== "0x" ? out : "0x0");
}

/** ERC-20 transfer(to, amount) of native USDC, signed and sent by the wallet. Returns the transaction hash. */
export async function sendUsdc(w: EvmWallet, c: EvmChain, from: string, to: string, amount: bigint): Promise<string> {
  const data = `0xa9059cbb${word(to)}${word(amount.toString(16))}`;
  return (await w.provider.request({ method: "eth_sendTransaction", params: [{ from, to: CHAIN[c].usdc, data, value: "0x0" }] })) as string;
}

/** ERC-191 personal_sign by the browser wallet that holds `address` (an Ethereum Wallets NEAR account is that address). */
export async function signErc191(address: string, message: string): Promise<string> {
  const wallets = await new Promise<EvmWallet[]>((resolve) => {
    let list: EvmWallet[] = [];
    const stop = discoverEvmWallets((w) => (list = w));
    setTimeout(() => (stop(), resolve(list)), 600);
  });
  const want = address.toLowerCase();
  for (const w of wallets) {
    const accounts = ((await w.provider.request({ method: "eth_requestAccounts" })) as string[]).map((a) => a.toLowerCase());
    if (!accounts.includes(want)) continue;
    const hex = `0x${[...new TextEncoder().encode(message)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
    return (await w.provider.request({ method: "personal_sign", params: [hex, want] })) as string;
  }
  throw new Error(`No wallet in this browser holds ${address.slice(0, 6)}…${address.slice(-4)}. Open the wallet you signed in with.`);
}

export async function disconnectEvm(w: EvmWallet): Promise<void> {
  try {
    await w.provider.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
  } catch {
    /* Wallets without EIP-2255 keep the site connected; forgetting it here is all we can do. */
  }
}

const code = (e: unknown) => (e as { code?: number })?.code;

/** The wallet's error in words a friend can act on. */
export function evmError(e: unknown, wallet: string, c: EvmChain): string {
  const m = String((e as { message?: string })?.message ?? e);
  if (code(e) === 4001 || /user (rejected|denied)/i.test(m)) return `You cancelled in ${wallet}. Nothing was sent.`;
  if (code(e) === -32002) return `${wallet} already has a request open. Open ${wallet} and answer it.`;
  if (code(e) === 4100) return `${wallet} is locked or has not allowed this site. Unlock it and try again.`;
  if (/insufficient funds|exceeds balance|gas required/i.test(m)) return `${wallet} needs a little ETH on ${CHAIN[c].name} to pay the network fee.`;
  if ((e as { code?: string | number })?.code === "E_EVM_TX_FAILED") return `That transaction failed on ${CHAIN[c].name}. Nothing was credited.`;
  return m.length > 160 ? `${wallet} could not send it: ${m.slice(0, 157)}…` : m;
}
