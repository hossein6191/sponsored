// Pill buttons: the label, then a round icon on the right; they press down by their own shadow (and stay
// still for anyone who asks for reduced motion). Tomato for the one thing to press, ink for a strong
// second choice, mint for a step that pays, white for everything else.

import * as React from "react";
import Link from "next/link";

import { IconArrow } from "@/components/icons";
import { cx } from "@/lib/cx";

export type PillVariant = "tomato" | "ink" | "mint" | "ghost";

type Common = { variant?: PillVariant; size?: "md" | "sm"; icon?: React.ReactNode; block?: boolean; className?: string; children: React.ReactNode };

const classes = (variant: PillVariant, size: "md" | "sm", block: boolean | undefined, className?: string) =>
  cx("pill", `pill-${variant}`, size === "sm" && "pill-sm", block && "w-full", className);

function Face({ icon, size, children }: { icon?: React.ReactNode; size: "md" | "sm"; children: React.ReactNode }) {
  return (
    <>
      <span className="min-w-0">{children}</span>
      <span className="pill-icon" aria-hidden="true">
        {icon ?? <IconArrow size={size === "sm" ? 15 : 18} />}
      </span>
    </>
  );
}

export function Pill({ variant = "tomato", size = "md", icon, block, className, children, ...rest }: Common & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button type="button" {...rest} className={classes(variant, size, block, className)}>
      <Face icon={icon} size={size}>
        {children}
      </Face>
    </button>
  );
}

export function PillLink({ variant = "tomato", size = "md", icon, block, className, children, href, external }: Common & { href: string; external?: boolean }) {
  if (external)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes(variant, size, block, className)}>
        <Face icon={icon} size={size}>
          {children}
        </Face>
      </a>
    );
  return (
    <Link href={href} className={classes(variant, size, block, className)}>
      <Face icon={icon} size={size}>
        {children}
      </Face>
    </Link>
  );
}
