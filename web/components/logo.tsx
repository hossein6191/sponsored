// The mark (a phone with a mint check and a small "ad" tag, lib/mark.ts) and the wordmark beside it.

import { MARK_SHAPES } from "@/lib/mark";

export function Mark({ size = 34, className }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className} dangerouslySetInnerHTML={{ __html: MARK_SHAPES }} />;
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <Mark size={36} />
      <span className="display text-[21px] tracking-tight text-ink">Sponsored</span>
    </span>
  );
}
