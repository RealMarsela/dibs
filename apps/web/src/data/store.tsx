import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { sampleTrip } from "./sample";
import { reduce, type Action } from "./reduce";
import type { ChainId, Trip } from "./types";
import * as api from "@/live/api";
import { gasless } from "@/live/relay";
import { useLiveTrip } from "@/live/use-live-trip";
import type { DeviceKey } from "@/live/passkey";

/* One interface for the trip, two engines. Preview (sample data, local reducer) for the showcase, and live
   (the NEAR contract through the API) for real trips. Every action returns the tx it caused when there is one,
   so the UI can link the receipt. */
export const LIVE_TRIPS = ["lis0312", "lis0314", "sin1025", "drw0001"];

export interface ActResult {
  tx?: string;
  code?: string;
}
export interface Actions {
  pay: (n: number, who: string, chain: ChainId) => Promise<ActResult>;
  refuse: (n: number) => Promise<ActResult>;
  list: (n: number, key?: DeviceKey) => Promise<ActResult>;
  resell: (n: number) => Promise<ActResult>;
  join: (who: string) => Promise<ActResult>;
  draw: (order?: number[]) => Promise<ActResult>;
  proof: (blob?: { blob_url: string; blob_sha256: string }) => Promise<ActResult>;
  drawOut: () => Promise<ActResult>;
  reset: () => void;
}

interface Ctx {
  trip: Trip;
  live: boolean;
  code: string;
  contract: string;
  network: api.Network;
  paidCount: number;
  funded: boolean;
  lastError: string;
  proofPending: boolean;
  act: Actions;
  refresh: () => Promise<void>;
}

const TripCtx = createContext<Ctx | null>(null);
const noop = async () => ({});

export function TripProvider({ code, children }: { code: string; children: ReactNode }) {
  const live = code.toLowerCase() !== "demo" && (LIVE_TRIPS.includes(code.toLowerCase()) || /^[a-z0-9]{3,12}$/.test(code.toLowerCase()));
  // Set before the first fetch below: a mainnet trip reads and pays through the API's /mainnet path.
  const net = api.networkFor(code);
  api.setNetwork(net);
  const CONTRACT = api.CONTRACTS[net];
  const [sample, dispatch] = useReducer(reduce, undefined, sampleTrip);
  const liveTrip = useLiveTrip(code.toLowerCase(), live);
  const trip = live ? liveTrip.trip : sample;

  const value = useMemo<Ctx | null>(() => {
    if (!trip) return null;
    const paidCount = trip.spots.filter((s) => s.status === "paid" || s.status === "listed").length;
    const funded = paidCount === trip.spots.length;
    const c = code.toLowerCase();
    const after = async (r: ActResult) => {
      await liveTrip.refresh();
      return r;
    };
    const act: Actions = live
      ? {
          pay: async (n) => after({ tx: (await api.fund({ trip: c, kind: "bed", n })).sweep_tx }),
          refuse: async (n) => after(await api.refundCheck({ trip: c, n })),
          list: async (n, key) => {
            if (!key) throw new Error("Sign in with your passkey first");
            return after({ tx: (await gasless(key, CONTRACT, "list_for_resale", { trip: c, n }, 300)).tx_hash });
          },
          resell: async () => after({}),
          join: async (who) => {
            // Reuse a slot this account already reserved; otherwise take the first free one. Reservations are on chain
            // (wait_res), so a slot someone reserved but never paid is skipped rather than collided with.
            const res = (await api.getTrip(c)).trip.wait_res ?? [];
            const own = res.indexOf(who);
            const free = res.indexOf(null);
            if (own < 0 && free < 0) throw new Error("The waitlist is full.");
            const slot = (own >= 0 ? own : free) + 1;
            if (own < 0) await api.hold({ trip: c, kind: "wait", n: slot, holder: who });
            return after({ tx: (await api.fund({ trip: c, kind: "wait", n: slot })).sweep_tx });
          },
          draw: async () => after({ tx: (await api.draw(c)).tx_hash }),
          proof: async (blob) => (blob ? after({ tx: (await api.proofSubmit({ trip: c, ...blob })).tx_hash }) : after({})),
          drawOut: async () => after({}),
          reset: () => undefined,
        }
      : {
          pay: async (n, who, chain) => (dispatch({ type: "pay", n, who, chain }), {}),
          refuse: async (n) => (dispatch({ type: "refuse", n }), { code: "E_NO_REFUND" }),
          list: async (n) => (dispatch({ type: "list", n }), {}),
          resell: async (n) => (dispatch({ type: "resell", n }), {}),
          join: async (who) => (dispatch({ type: "join", who }), {}),
          draw: async (order) => (dispatch({ type: "draw", order: order ?? trip.beds.map((_, i) => i) }), {}),
          proof: async () => (
            dispatch({
              type: "proof",
              facts: { stay: trip.stay, checkIn: trip.checkIn, checkOut: trip.checkOut, guests: trip.spots.length, total: trip.price * trip.spots.length, signedBy: "booking.com" },
            }),
            {}
          ),
          drawOut: async () => (dispatch({ type: "drawOut" }), {}),
          reset: () => dispatch({ type: "reset" }),
        };
    return {
      trip,
      live,
      code: c,
      contract: CONTRACT,
      network: net,
      paidCount,
      funded,
      lastError: live ? liveTrip.lastError : "",
      proofPending: live ? liveTrip.proofPending : false,
      act,
      refresh: live ? liveTrip.refresh : noop.bind(null) as unknown as () => Promise<void>,
    };
  }, [trip, live, code, liveTrip, net, CONTRACT]);

  if (!value) return <LiveLoading error={liveTrip.error} />;
  return <TripCtx.Provider value={value}>{children}</TripCtx.Provider>;
}


function LiveLoading({ error }: { error: string | null }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      {error ? (
        <>
          <p className="display text-[22px]">Can’t reach the trip right now.</p>
          <p className="text-[14.5px] text-fg-2">{error}. It retries on its own every few seconds.</p>
        </>
      ) : (
        <>
          <span className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-fg" aria-hidden />
          <p className="text-[14.5px] text-fg-2">Reading the trip from NEAR…</p>
        </>
      )}
    </div>
  );
}

export function useTrip(): Ctx {
  const v = useContext(TripCtx);
  if (!v) throw new Error("useTrip outside TripProvider");
  return v;
}

export type { Action };

/** Fisher-Yates on [0..n). Stand-in for the VRF output in the preview. */
export function shuffledOrder(n: number): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
