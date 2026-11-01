import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ledger",
  description: "Every brief on the contract, its totals, and where every GEN went.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
