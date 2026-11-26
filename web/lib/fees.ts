// Studio v0.123 charges a fee on every write. Before each one the site asks Studio for a quote with
// genlayer-js's estimateTransactionFees() and passes it with the call; a write without fees is refused
// (FeesDistributionMissing). The quote is a deposit of about 0.1 GEN: what the transaction did not use comes
// back when it is final. The leader and validator time-unit allocations are raised to the policy's maximum so
// a submission, where every validator reads the post on the live web, fits. (estimateTransactionFeesForWrite
// answers "fee below_minimum" on Studio, so it is not used.)
//
// Shared by the wallet path (lib/chain.ts), the demo creator (lib/demo-server.ts) and
// tools/open-demo-creator.mjs, which imports this file directly, so it imports nothing.

export const FEE_TIMEUNITS = 600n;

/** What the visitor reads where the wallet asks them to sign. */
export const FEE_NOTE =
  "Every transaction also includes a small network fee, a deposit of about 0.1 GEN; the part it does not use is refunded at once.";

type Quote<D> = { distribution: D; feeValue: bigint; policy?: { enabled?: boolean } };
type Quoter<D> = {
  estimateTransactionFees: (args: { leaderTimeunitsAllocation: bigint; validatorTimeunitsAllocation: bigint }) => Promise<Quote<D>>;
};

export const NO_FEE_QUOTE = "Studio did not quote the network fee for this transaction, so nothing was sent. Try again in a minute.";

/** The fees to pass with one write: asked three times at most, never invented. */
export async function quoteFees<D>(client: Quoter<D>, wait: (ms: number) => Promise<unknown> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<{ distribution: D; feeValue: bigint }> {
  for (let i = 0; ; i++) {
    try {
      const q = await client.estimateTransactionFees({ leaderTimeunitsAllocation: FEE_TIMEUNITS, validatorTimeunitsAllocation: FEE_TIMEUNITS });
      if (q?.policy?.enabled === false || !q?.distribution || !(typeof q.feeValue === "bigint" && q.feeValue > 0n)) throw new Error(NO_FEE_QUOTE);
      return { distribution: q.distribution, feeValue: q.feeValue };
    } catch (e) {
      if (i >= 2) throw new Error(NO_FEE_QUOTE, { cause: e });
      await wait(3000);
    }
  }
}

/** A transaction is done only when it is FINALIZED and carries its execution result. */
export const EXECUTION_DONE = new Set(["FINISHED_WITH_RETURN", "FINISHED_WITH_ERROR"]);
