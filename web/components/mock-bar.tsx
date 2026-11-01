"use client";

// Mock mode only. There is no wallet and no chain: the visitor acts as one of the demo accounts of the
// in-memory contract, and this bar says so on every page, lets them change account, gives test GEN, and
// moves the clock on so a hold can be seen ending and a window closing.

import { useLocal } from "@/components/use-local";
import { PERSONAS, advanceClock, mockAddress, mockBalanceText, mockClockOffset, setMockPersona } from "@/lib/chain-mock";
import { faucet } from "@/lib/chain";
import { gen, span } from "@/lib/format";

const small = "h-8 rounded-full border-[1.5px] border-ink bg-white px-2.5 text-xs font-bold hover:bg-canvas-2 active:translate-y-px";

export function MockBar() {
  const address = useLocal(mockAddress, PERSONAS[0].address);
  const balance = useLocal(() => mockBalanceText(mockAddress()), "0");
  const offset = useLocal(mockClockOffset, 0);
  return (
    <div className="border-b-2 border-dashed border-ink/25 bg-mint-wash">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-2 px-4 py-2 text-xs xl:flex-row xl:items-center xl:justify-between">
        <p className="min-w-0">
          <strong className="font-bold">Demo build.</strong> An in-memory copy of the contract. No post is fetched and no model is asked here: the four demo posts are read as
          the demo expects against the three demo lines (any other line reads as unclear), where on chain every validator reads for itself. A reload starts again.
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <label htmlFor="mock-persona" className="shrink-0 font-bold">
            Acting as
          </label>
          <select id="mock-persona" value={address} onChange={(e) => setMockPersona(e.target.value)} className="h-8 max-w-full min-w-0 rounded-full border-[1.5px] border-ink bg-white px-2 text-xs">
            {PERSONAS.map((p) => (
              <option key={p.address} value={p.address}>
                {p.name}: {p.note}
              </option>
            ))}
          </select>
          <span className="mono whitespace-nowrap">{gen(balance)}</span>
          <button type="button" onClick={() => void faucet(address)} className={small}>
            +10 GEN
          </button>
          <button type="button" onClick={() => advanceClock(300)} className={small}>
            Clock +5 min
          </button>
          <button type="button" onClick={() => advanceClock(3600)} className={small}>
            +1 h
          </button>
          <button type="button" onClick={() => advanceClock(86400)} className={small}>
            +1 day
          </button>
          {offset > 0 && <span className="text-ink-2">clock moved on {span(offset)}</span>}
        </div>
      </div>
    </div>
  );
}
