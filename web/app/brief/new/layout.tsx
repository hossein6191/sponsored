import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Open a brief",
  description: "Open a brief for a creator: the lines the post must meet, the fee, and how long it must stay up. The contract adds the #ad line itself.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
