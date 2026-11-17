import { Link } from "react-router";

/* Trips the Dibs team seeded so people can look around. They are labelled, never the main way in: everything they
   show also works on a trip of your own. */
const EXAMPLES = new Set(["lis0312", "lis0314", "sin1025", "drw0001", "lismain", "lismain2"]);
export const isExample = (code: string) => EXAMPLES.has(code.replace(/-/g, "").toLowerCase());

export function ExampleBanner({ mainnet }: { mainnet: boolean }) {
  return (
    <div className="glass mt-5 flex flex-col gap-3 rounded-[22px] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[14px] leading-relaxed text-fg-2">
        <span className="font-semibold text-fg">Example trip.</span>{" "}
        {mainnet
          ? "Real USDC on NEAR mainnet, seeded by the Dibs team. Every payment, swap and DAO deposit links to its explorer in the receipts, so you can check the money moved without paying."
          : "Seeded by the Dibs team so you can look around. Everything here also works on a trip of your own."}
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
