import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works",
  description: "The four questions word for word, why this needs GenLayer, where the money goes, the limits, and the contract's rules read live.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
