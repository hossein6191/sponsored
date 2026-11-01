// An address, short, with the whole of it in the title and a link to the explorer.

import { addressUrl, isMock } from "@/lib/chain";
import { short } from "@/lib/format";
import { cx } from "@/lib/cx";

export function Addr({ address, you, className }: { address: string; you?: boolean; className?: string }) {
  if (!address) return <span className="text-ink-3">nobody yet</span>;
  const text = short(address);
  return (
    <span className={cx("inline-flex min-w-0 items-center gap-1", className)}>
      {isMock ? (
        <span className="mono text-[0.92em]" title={address}>
          {text}
        </span>
      ) : (
        <a href={addressUrl(address)} target="_blank" rel="noreferrer" className="mono link text-[0.92em]" title={address}>
          {text}
        </a>
      )}
      {you && <span className="rounded-full bg-ink px-1.5 text-[11px] font-bold text-white">you</span>}
    </span>
  );
}
