"use client";

// rules(), read live from the contract (or the demo build's in-memory copy), shown as it answers.

import * as React from "react";

import { Placeholder, ReadError } from "@/components/read-state";
import { useRead } from "@/components/use-read";
import { readRules } from "@/lib/chain";

function Value({ v }: { v: unknown }) {
  if (Array.isArray(v))
    return (
      <ul className="flex flex-col gap-1">
        {v.map((x, i) => (
          <li key={i} className="min-w-0">
            <Value v={x} />
          </li>
        ))}
      </ul>
    );
  if (v && typeof v === "object")
    return (
      <dl className="grid gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
        {Object.entries(v as Record<string, unknown>).map(([k, x]) => (
          <React.Fragment key={k}>
            <dt className="mono text-[12px] font-semibold break-words text-tomato-ink">{k}</dt>
            <dd className="min-w-0 text-[13.5px] break-words text-ink-2">
              <Value v={x} />
            </dd>
          </React.Fragment>
        ))}
      </dl>
    );
  return <span>{String(v)}</span>;
}

export function LiveRules() {
  const read = useRead(() => readRules(), []);
  if (read.loading && !read.data) return <Placeholder lines={6} />;
  if (read.error && !read.data) return <ReadError detail={read.error} onRetry={read.retry} />;
  if (!read.data) return null;
  return (
    <div>
      <p className="mb-3 text-[13px] text-ink-3">{read.source === "mock" ? "From the demo build's in-memory copy of the contract." : "Read just now from the deployed contract."}</p>
      <Value v={read.data} />
    </div>
  );
}
