"use client";

// The creator submits the address of the post, with chips for the addresses below the brief's site. The
// field says what the contract would refuse before anything is fetched; a submission needs 0.01 GEN of
// credit deposited beforehand, so the form offers the deposit when the credit is short.

import * as React from "react";

import { Pill } from "@/components/button";
import { IconDrop, IconSend } from "@/components/icons";
import { Suggest } from "@/components/suggest";
import { gen } from "@/lib/format";
import { MAX_SUBMITS, SUBMIT_FEE, postUrlProblem, sentence } from "@/lib/rules";
import { urlChips } from "@/lib/suggestions";

export function SubmitForm({
  briefId,
  prefix,
  tries,
  creditAtto,
  demoPosts,
  busy,
  onSubmit,
  onDeposit,
}: {
  briefId: string;
  prefix: string;
  tries: number;
  /** the creator's credit, or null while it is being read */
  creditAtto: bigint | null;
  /** true when the four demo posts sit below this prefix (the demo creator's site, or any site in the demo build) */
  demoPosts: boolean;
  busy?: boolean;
  onSubmit: (url: string) => void;
  onDeposit: (atto: bigint) => void;
}) {
  const [url, setUrl] = React.useState("");
  const problem = url.trim() ? sentence(postUrlProblem(url, prefix, briefId)) : "";
  const short = creditAtto !== null && creditAtto < SUBMIT_FEE;
  const id = `post-url-${briefId}`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="label">
        The post&apos;s address {tries > 0 ? `(try ${tries + 1} of ${MAX_SUBMITS})` : ""}
      </label>
      <input id={id} className="field mono" placeholder={prefix + "…"} value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} autoComplete="off" aria-invalid={!!problem} />
      {problem && <p className="text-[13.5px] text-tomato-ink">{problem}</p>}
      <Suggest label="Post address suggestions" chips={urlChips(prefix, demoPosts)} onPick={setUrl} isOn={(v) => v === url.trim()} />
      <p className="text-[12.5px] text-ink-3">
        Your credit: <span className="mono">{creditAtto === null ? "…" : gen(creditAtto)}</span>. A clear reading keeps the {gen(SUBMIT_FEE)} fee in your credit; an unclear one
        moves it to the sponsor.
      </p>
      <div className="flex flex-wrap gap-2">
        {short ? (
          <Pill variant="ink" icon={<IconDrop size={16} />} disabled={busy} onClick={() => onDeposit(SUBMIT_FEE * 2n)}>
            Deposit {gen(SUBMIT_FEE * 2n)} of credit first
          </Pill>
        ) : (
          <Pill icon={<IconSend size={16} />} disabled={busy || !url.trim() || !!problem || creditAtto === null} onClick={() => onSubmit(url.trim())}>
            Submit the post
          </Pill>
        )}
      </div>
    </div>
  );
}
