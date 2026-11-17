import { Link } from "react-router";
import { localDeadline } from "@/lib/utils";

/* Trips the Dibs team seeded so people can look around. They are labelled, never the main way in: everything they
   show also works on a trip of your own. Three of them carry no booking, so at their deadline the cron refunds every
   paid bed: they double as the live example of the refund guarantee. */
const EXAMPLES = new Set(["lis0312", "lis0314", "sin1025", "drw0001", "lismain", "lismain2"]);
const REFUND_EXAMPLES = new Set(["lis0312", "lis0314", "drw0001"]);
const norm = (code: string) => code.replace(/-/g, "").toLowerCase();
export const isExample = (code: string) => EXAMPLES.has(norm(code));

function blurb(code: string, mainnet: boolean, refunded: boolean, bookBy: string): string {
  if (mainnet)
    return "Real USDC on NEAR mainnet, seeded by the Dibs team. Every payment, swap and DAO deposit links to its explorer in the receipts, so you can check the money moved without paying.";
  if (norm(code) === "sin1025")
    return "Seeded by the Dibs team. A real booking.com confirmation was checked inside the enclave and the crew’s money was paid out to the booker; the proof and payout are in the receipts.";
  if (REFUND_EXAMPLES.has(norm(code)))
    return refunded
      ? "Seeded by the Dibs team, and now the refund guarantee in action: its deadline passed without a verified booking, so the contract refunded every paid bed. Each refund is in the receipts with its transaction."
      : `Seeded by the Dibs team. Nobody has proven a booking, so at its deadline (${localDeadline(bookBy)}) every paid bed is refunded automatically, each refund listed in the receipts with its transaction.`;
  return "Seeded by the Dibs team so you can look around. Everything here also works on a trip of your own.";
}

export function ExampleBanner({ code, mainnet, refunded, bookBy }: { code: string; mainnet: boolean; refunded: boolean; bookBy: string }) {
  return (
    <div className="glass mt-5 flex flex-col gap-3 rounded-[22px] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[14px] leading-relaxed text-fg-2">
        <span className="font-semibold text-fg">Example trip.</span> {blurb(code, mainnet, refunded, bookBy)}
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
        {mainnet && (
          <a href="https://near.rocks/account/dibs-lismain.sputnik-dao.near" target="_blank" rel="noreferrer" className="pill-dark pill-sm focus-ring press">
            Crew DAO balance ↗
          </a>
        )}
        <Link to="/new" className="pill-light pill-sm focus-ring press">
          Start your own trip
        </Link>
      </div>
    </div>
  );
}
