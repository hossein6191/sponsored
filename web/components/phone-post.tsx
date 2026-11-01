// The creator's post inside a phone frame, as a social post card. A demo post is shown word for word as
// it reads in posts/ (its heading and its paragraphs; the picture above them is decoration, and the
// validators never see it). Any other post is shown as its address, with the fingerprint every validator
// agreed on: the site never copies another site's page.

import * as React from "react";

import { IconBubble, IconExternal, IconHeart, IconSend } from "@/components/icons";
import { DEMO_CREATOR_NAME, DEMO_HANDLE, type DemoPost } from "@/lib/demo-creator";
import { cx } from "@/lib/cx";

export function PhoneFrame({ children, className, label }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <figure className={cx("phone", className)} aria-label={label}>
      <div className="phone-island" aria-hidden="true" />
      <div className="phone-screen">
        <div className="flex items-center justify-between px-7 pt-3.5 pb-2 text-[12px] font-bold text-ink" aria-hidden="true">
          <span className="mono">9:41</span>
          <span className="flex items-center gap-1">
            <span className="flex items-end gap-[2px]">
              {[4, 6, 8, 10].map((h) => (
                <span key={h} className="w-[3px] rounded-sm bg-ink" style={{ height: h }} />
              ))}
            </span>
            <span className="ml-1 inline-block h-[10px] w-[20px] rounded-[3px] border-[1.5px] border-ink p-[1px]">
              <span className="block h-full w-3/4 rounded-[1px] bg-ink" />
            </span>
          </span>
        </div>
        {children}
      </div>
    </figure>
  );
}

/** A sea, a sun and the dry bag, in CSS: orange, or grey for the wrong bag. */
function Cover({ grey }: { grey?: boolean }) {
  return (
    <div className="post-cover" aria-hidden="true">
      <span className="absolute top-5 right-8 size-9 rounded-full bg-[#ffd27a]" />
      <span className="absolute right-0 bottom-0 left-0 h-[52%] bg-[repeating-linear-gradient(170deg,transparent_0_10px,rgba(255,255,255,0.18)_10px_12px)]" />
      <span className={cx("absolute bottom-6 left-[38%] h-[74px] w-[58px] rounded-b-[18px] rounded-t-[10px] border-2 border-ink/70", grey ? "bg-[#a9aab3]" : "bg-[#ff7a2e]")}>
        <span className={cx("absolute -top-3 left-1 h-4 w-[46px] rounded-md border-2 border-ink/70", grey ? "bg-[#8d8e98]" : "bg-[#e35f16]")} />
        <span className="absolute top-5 left-2 h-1.5 w-9 rounded-full bg-white/50" />
      </span>
    </div>
  );
}

/** The demo post as a reader sees it. */
export function DemoPostCard({ post, time }: { post: DemoPost; time?: string }) {
  return (
    <article className="pb-4">
      <header className="flex items-center gap-2.5 px-4 pt-1 pb-3">
        <span className="grid size-10 place-items-center rounded-full bg-[conic-gradient(from_200deg,#ff5a36,#ffb36b,#3ddc97,#ff5a36)] p-[2.5px]" aria-hidden="true">
          <span className="display grid size-full place-items-center rounded-full bg-white text-[12px]">HE</span>
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-[14px] font-bold">{DEMO_CREATOR_NAME}</span>
          <span className="block text-[12px] text-ink-3">
            {DEMO_HANDLE}
            {time ? ` · ${time}` : ""}
          </span>
        </span>
      </header>
      <Cover grey={post.key === "wrong-product"} />
      <p className="px-4 pt-1.5 text-[10.5px] text-ink-3">The picture is not read: only the words below are.</p>
      <div className="px-4 pt-2 text-[13.5px] leading-[1.5] text-ink">
        <h3 className="text-[16px] leading-snug">{post.heading}</h3>
        {post.paragraphs.map((p, i) => (
          <p key={i} className={cx("mt-2", /sponsored by/.test(p) && "font-semibold")}>
            {p.includes("tidewell.example/bags") ? (
              <>
                {p.split("tidewell.example/bags")[0]}
                <span className="text-[#2f62ff] underline">tidewell.example/bags</span>
                {p.split("tidewell.example/bags")[1]}
              </>
            ) : (
              p
            )}
          </p>
        ))}
      </div>
      <footer className="mt-3 flex items-center gap-4 px-4 text-ink-2" aria-hidden="true">
        <IconHeart size={20} />
        <IconBubble size={19} />
        <IconSend size={19} />
      </footer>
    </article>
  );
}

/** A post that is not one of the demo posts: its address, which every validator fetched itself. */
export function LinkPostCard({ url }: { url: string }) {
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    host = "";
  }
  return (
    <article className="px-4 pt-2 pb-5">
      <div className="rounded-3xl border border-line bg-canvas p-4">
        <p className="kicker text-ink-3">The post</p>
        <p className="display mt-1 text-[17px] break-words">{host || "the creator's site"}</p>
        <a href={url} target="_blank" rel="noreferrer nofollow" className="mono link mt-2 inline-flex items-start gap-1 text-[12px] break-all text-ink-2">
          {url}
          <IconExternal size={12} className="mt-0.5 shrink-0" />
        </a>
        <p className="mt-3 text-[12.5px] leading-snug text-ink-3">
          The site does not copy other pages. Every validator fetched this address itself and read its words; the fingerprint below is what they agreed it said.
        </p>
      </div>
    </article>
  );
}

/** No post yet: the screen waits. */
export function EmptyPost({ title, line }: { title: string; line: string }) {
  return (
    <div className="flex min-h-[440px] flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-canvas-2 text-ink-3" aria-hidden="true">
        <span className="reading-dots">
          <span />
          <span />
          <span />
        </span>
      </span>
      <p className="display text-[17px]">{title}</p>
      <p className="text-[13px] leading-snug text-ink-3">{line}</p>
    </div>
  );
}
